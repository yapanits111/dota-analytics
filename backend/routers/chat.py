from fastapi import APIRouter
from pydantic import BaseModel
from typing import Literal
import json, re
from database import query
from llm import call_llm, DEFAULT_PROVIDER, SUPPORTED_PROVIDERS

router = APIRouter(prefix="/chat", tags=["chat"])

def clean_sql(raw: str) -> str:
    """LLMs often wrap SQL in ```sql ... ``` fences, add prose, or a trailing
    semicolon despite instructions. Extract just the runnable SQL."""
    s = raw.strip()
    # If the model fenced the SQL, take the content of the first fenced block.
    m = re.search(r"```(?:sql)?\s*(.*?)```", s, re.DOTALL | re.IGNORECASE)
    if m:
        s = m.group(1)
    # Drop any remaining stray backticks and a leading language hint.
    s = s.replace("`", "").strip()
    s = re.sub(r"^sql\s*\n", "", s, flags=re.IGNORECASE)
    return s.strip().rstrip(";").strip()

SCHEMA = """
Tables:
- matches(match_id BIGINT, duration INT seconds, game_mode INT,
  start_time TIMESTAMP, patch TEXT, radiant_win BOOLEAN)
- player_matches(match_id BIGINT, account_id BIGINT, hero_id INT,
  kills INT, deaths INT, assists INT, gpm INT, xpm INT,
  last_hits INT, denies INT, net_worth INT, won BOOLEAN, player_slot INT)
- heroes(hero_id INT, name TEXT, local_name TEXT, primary_attr TEXT,
  attack_type TEXT, roles TEXT[])

Key joins (always alias tables and qualify columns to avoid ambiguity):
- FROM player_matches pm JOIN matches m ON pm.match_id = m.match_id
- FROM player_matches pm JOIN heroes  h ON pm.hero_id  = h.hero_id

Column locations (do not guess the wrong table):
- duration, start_time, patch, game_mode, radiant_win  -> matches (alias m)
- kills, deaths, assists, gpm, xpm, last_hits, denies, net_worth, won,
  player_slot, account_id, hero_id                     -> player_matches (alias pm)
- hero display name (e.g. "Invoker")                   -> heroes.local_name (alias h)

Rules baked in:
- Always filter pm.account_id = {account_id}.
- The matches table (alias m) holds duration, start_time, patch, game_mode,
  radiant_win. If you reference ANY m.* column — including
  `ORDER BY m.start_time` for recency — you MUST add
  `JOIN matches m ON pm.match_id = m.match_id` to the FROM clause.
  `duration` is in seconds — divide by 60 for minutes.
- is_radiant = pm.player_slot < 128.
- `won` and `radiant_win` are BOOLEAN. Aggregate with ::int
  (SUM(won::int), AVG(won::int)). NEVER cast a boolean to float/double.
  Win rate = ROUND(100.0 * SUM(pm.won::int) / COUNT(*), 1).
- Always fully qualify column names with their table alias.
- This is PostgreSQL: paginate with `LIMIT n OFFSET m`, never MySQL-style
  `LIMIT m, n`. To compare recent windows, use subqueries with
  ORDER BY m.start_time DESC LIMIT n OFFSET m.
"""

DATA_SCOPE = """This dataset has ONLY per-match summary stats: hero played,
win/loss, kills, deaths, assists, GPM, XPM, last hits, denies, net worth,
Radiant/Dire (player_slot), match duration, game mode, patch, and start time.
It has NO data on item builds, skill/ability builds, hero matchups or counters,
lane/role/position, MMR/rank, wards, runes, or objectives."""

def format_history(history, limit: int = 4) -> str:
    """Compact the last few chat turns so follow-up questions have context."""
    if not history:
        return ""
    lines = []
    for h in history[-limit:]:
        who = "User" if (h.get("role") == "user") else "Analyst"
        lines.append(f"{who}: {h.get('content', '')}")
    return "Recent conversation (context for follow-ups):\n" + "\n".join(lines) + "\n\n"

def nl_to_sql(question: str, account_id: int, provider: str, history=None) -> str:
    prompt = f"""You are a PostgreSQL expert analyzing one Dota 2 player's match data.

{SCHEMA.format(account_id=account_id)}

{DATA_SCOPE}

{format_history(history)}Question: "{question}"

Rules:
- Always filter by pm.account_id = {account_id}.
- If the question asks for something NOT in this data (item builds, skill builds,
  matchups/counters, MMR, wards, lanes/positions), reply with exactly: NO_QUERY
- For "best/recommended hero" questions, only count heroes with a real sample:
  add HAVING COUNT(*) >= 3, then ORDER BY win rate DESC, games DESC.
- Never filter on a specific literal win-rate percentage from the question.
- Return ONLY the raw SQL — no markdown, no explanation, no backticks.
- LIMIT 50 rows unless the question asks for all.
"""
    return call_llm(prompt, provider=provider, max_tokens=500)

def fix_sql(question: str, bad_sql: str, error: str,
            account_id: int, provider: str) -> str:
    """Self-correction: give the model its failing query and the DB error and
    ask it to return a fixed query. Handles the class of Text-to-SQL mistakes
    (missing JOINs, bad casts, wrong aliases) that occasionally slip through."""
    prompt = f"""A PostgreSQL query you wrote failed. Fix it.

{SCHEMA.format(account_id=account_id)}

Question: "{question}"

Failing query:
{bad_sql}

PostgreSQL error:
{error}

Return ONLY the corrected raw SQL (no markdown, no explanation). Common fixes:
- If an alias like m or h is used but missing from FROM, add its JOIN
  (matches m ON pm.match_id = m.match_id, heroes h ON pm.hero_id = h.hero_id).
- Keep the pm.account_id = {account_id} filter and fully qualify every column.
"""
    return clean_sql(call_llm(prompt, provider=provider, max_tokens=500))

def interpret(question: str, sql: str, results: list, provider: str, history=None) -> str:
    prompt = f"""You are a sharp Dota 2 analyst talking to the player about THEIR stats.

{DATA_SCOPE}

{format_history(history)}Question: "{question}"
Query results (JSON): {results}

Answer in 2-3 concise sentences:
- Reference the actual numbers from the results.
- When recommending, favor options with a solid sample (about 5+ games); treat a
  100% win rate on 1-2 games as noise — mention it only as a caveat, never as the
  main recommendation.
- Do NOT invent data that isn't in the results (no item builds, matchups, MMR).
- If the results are empty, say so in ONE sentence and suggest a related question
  this data CAN answer (best hero by win rate, GPM trend, early vs late game,
  Radiant vs Dire) — do not speculate or pad.
- Stay consistent with anything you already said earlier in the conversation."""
    return call_llm(prompt, provider=provider, max_tokens=280)

class ChatRequest(BaseModel):
    question: str
    account_id: int
    provider: str = DEFAULT_PROVIDER
    history: list[dict] = []

@router.post("/query")
def chat_query(req: ChatRequest):
    try:
        sql = clean_sql(nl_to_sql(req.question, req.account_id,
                                  req.provider, req.history))

        # Out-of-scope question (items, builds, matchups, MMR, ...) → be honest.
        if "NO_QUERY" in sql.upper():
            return {
                "question": req.question,
                "sql":      None,
                "results":  [],
                "insight": (
                    "I can only analyze your recorded match stats — heroes, win "
                    "rates, GPM/XPM, KDA, last hits, net worth, game duration, and "
                    "Radiant vs Dire. I don't have item builds, skill builds, "
                    "matchups, or MMR data. Try asking: \"Which hero has my best win "
                    "rate?\", \"How's my GPM trend?\", or \"Do I play better early or "
                    "late game?\""
                ),
                "provider": req.provider,
            }

        try:
            results = query(sql)
        except Exception as db_err:
            # One self-correction pass: feed the error back and retry.
            sql = fix_sql(req.question, sql, str(db_err),
                          req.account_id, req.provider)
            results = query(sql)
        insight = interpret(req.question, sql, results, req.provider, req.history)
        return {
            "question": req.question,
            "sql":      sql,
            "results":  results,
            "insight":  insight,
            "provider": req.provider
        }
    except ValueError as e:
        # Provider not configured
        return {"error": str(e), "question": req.question, "provider": req.provider}
    except Exception as e:
        return {"error": str(e), "question": req.question}

@router.get("/suggestions/{account_id}")
def get_suggestions(
    account_id: int,
    provider: str = DEFAULT_PROVIDER
):
    """Generate 3 clickable questions based on the player's actual data."""
    overview = query(
        """
        SELECT
          COUNT(*)                                         AS total_games,
          ROUND(100.0 * SUM(won::int) / COUNT(*), 1)      AS win_rate,
          ROUND(AVG(gpm), 0)                               AS avg_gpm,
          SUM(CASE WHEN m.start_time > NOW() - INTERVAL '7 days'
              THEN won::int END)                           AS wins_this_week,
          COUNT(CASE WHEN m.start_time > NOW() - INTERVAL '7 days'
              THEN 1 END)                                  AS games_this_week
        FROM player_matches pm
        JOIN matches m ON pm.match_id = m.match_id
        WHERE pm.account_id = %s
        """,
        (account_id,)
    )

    context = f"""
Total games: {overview[0]['total_games']}
Win rate: {overview[0]['win_rate']}%
Avg GPM: {overview[0]['avg_gpm']}
Games this week: {overview[0]['games_this_week']}
Wins this week: {overview[0]['wins_this_week']}
"""

    prompt = f"""Based on this Dota 2 player's stats, suggest exactly 3 specific
questions they should ask about their performance.

{context}

Rules:
- Each question must be answerable from match data
  (kills, deaths, gpm, win rate, hero, duration, patch, etc.)
- Target a different aspect each: one about heroes, one about game
  phase or timing, one about trends or comparisons
- Make them specific to this player's numbers, not generic
- Return ONLY a valid JSON array of 3 strings, nothing else

Example: ["Which hero do I win most with?", "Do I play better early or late?",
"Has my GPM improved recently?"]"""

    fallback = [
        "Which hero do I have the highest win rate on?",
        "Do I perform better in early, mid, or late game?",
        "What is my average GPM when I win versus when I lose?"
    ]

    try:
        raw = call_llm(prompt, provider=provider, max_tokens=200)
        suggestions = json.loads(raw)
        return {"suggestions": suggestions[:3], "provider": provider}
    except Exception:
        return {"suggestions": fallback, "provider": provider}

@router.get("/providers")
def list_providers():
    """Return which providers are configured (have API keys set)."""
    import os
    keys = {
        "gemini": bool(os.getenv("GEMINI_API_KEY", "").strip()),
        "groq":   bool(os.getenv("GROQ_API_KEY",   "").strip()),
        "claude": bool(os.getenv("ANTHROPIC_API_KEY", "").strip()),
    }
    return {
        "providers":  SUPPORTED_PROVIDERS,
        "configured": [p for p, has_key in keys.items() if has_key],
        "default":    DEFAULT_PROVIDER
    }

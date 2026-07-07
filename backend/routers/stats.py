from fastapi import APIRouter, Query
from database import query
from llm import call_llm, DEFAULT_PROVIDER

router = APIRouter(prefix="/stats", tags=["stats"])

@router.get("/heroes/{account_id}")
def hero_stats(account_id: int):
    return query(
        "SELECT * FROM hero_win_rates WHERE account_id = %s ORDER BY games DESC",
        (account_id,)
    )

@router.get("/duration/{account_id}")
def duration_stats(account_id: int):
    return query(
        """
        SELECT * FROM duration_performance
        WHERE account_id = %s ORDER BY win_rate DESC
        """,
        (account_id,)
    )

@router.get("/overview/{account_id}")
def overview(account_id: int):
    return query(
        """
        SELECT
          COUNT(*)                                        AS total_games,
          SUM(pm.won::int)                               AS total_wins,
          ROUND(100.0 * SUM(pm.won::int) / COUNT(*), 1) AS win_rate,
          ROUND(AVG(pm.gpm), 0)                          AS avg_gpm,
          ROUND(AVG(pm.kills), 1)                        AS avg_kills,
          ROUND(AVG(pm.deaths), 1)                       AS avg_deaths
        FROM player_matches pm
        WHERE pm.account_id = %s
        """,
        (account_id,)
    )

@router.get("/recent/{account_id}")
def recent(account_id: int, limit: int = 50):
    return query(
        """
        SELECT pm.match_id, h.local_name AS hero,
               pm.kills, pm.deaths, pm.assists,
               pm.gpm, pm.won, m.duration, m.start_time
        FROM player_matches pm
        JOIN matches m ON pm.match_id = m.match_id
        JOIN heroes h  ON pm.hero_id  = h.hero_id
        WHERE pm.account_id = %s
        ORDER BY m.start_time DESC
        LIMIT %s
        """,
        (account_id, limit)
    )

@router.get("/tip/{account_id}")
def get_tip(
    account_id: int,
    provider: str = Query(default=DEFAULT_PROVIDER)
):
    """Generate one actionable tip based on the player's analytics."""
    best_hero = query(
        """
        SELECT hero, win_rate, games
        FROM hero_win_rates
        WHERE account_id = %s AND games >= 3
        ORDER BY win_rate DESC LIMIT 1
        """,
        (account_id,)
    )
    best_phase = query(
        """
        SELECT bucket, win_rate FROM duration_performance
        WHERE account_id = %s ORDER BY win_rate DESC LIMIT 1
        """,
        (account_id,)
    )
    worst_phase = query(
        """
        SELECT bucket, win_rate FROM duration_performance
        WHERE account_id = %s ORDER BY win_rate ASC LIMIT 1
        """,
        (account_id,)
    )
    stats = query(
        """
        SELECT ROUND(100.0 * SUM(won::int) / COUNT(*), 1) AS win_rate,
               ROUND(AVG(gpm), 0) AS avg_gpm
        FROM player_matches WHERE account_id = %s
        """,
        (account_id,)
    )

    # Build each line defensively — any of these queries can come back empty
    # for players with few matches, and indexing [0] blindly would 500.
    bh = best_hero[0]   if best_hero  else None
    bp = best_phase[0]  if best_phase else None
    wp = worst_phase[0] if worst_phase else None
    st = stats[0]       if stats       else {"win_rate": "N/A", "avg_gpm": "N/A"}

    hero_line  = (f"{bh['hero']} ({bh['win_rate']}% in {bh['games']} games)"
                  if bh else "N/A")
    best_line  = (f"{bp['bucket']} ({bp['win_rate']}% win rate)"
                  if bp else "N/A")
    worst_line = (f"{wp['bucket']} ({wp['win_rate']}% win rate)"
                  if wp else "N/A")

    context = f"""
Overall win rate: {st['win_rate']}%
Average GPM: {st['avg_gpm']}
Best hero: {hero_line}
Best game phase: {best_line}
Weakest game phase: {worst_line}
"""

    prompt = f"""Based on this Dota 2 player's stats, give ONE specific actionable
tip in 1-2 sentences. Reference actual numbers. Be specific, not generic.
{context}"""

    try:
        tip = call_llm(prompt, provider=provider, max_tokens=150)
        return {"tip": tip, "provider": provider}
    except Exception as e:
        # Provider not configured, model error, rate limit, etc. — surface it
        # as a readable message instead of a 500 so the dashboard still loads.
        return {"tip": str(e), "provider": provider, "error": True}

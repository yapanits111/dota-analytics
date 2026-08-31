# Dota 2 Personal Analytics

Ask questions about your Dota 2 match history in plain English and get answers
from your own data. Search a Steam name, and the app loads your matches from the
public [OpenDota API](https://docs.opendota.com/) into PostgreSQL; an LLM then
turns each question into SQL, runs it against your data, and explains the result.

**[Live app](https://dota-analytics-cyan.vercel.app)** &nbsp;·&nbsp;
[API](https://dota-analytics-api.onrender.com/health) &nbsp;·&nbsp;
[![CI](https://github.com/yapanits111/dota-analytics/actions/workflows/ci.yml/badge.svg)](https://github.com/yapanits111/dota-analytics/actions/workflows/ci.yml)

> The backend runs on a free tier that sleeps when idle, so the first request may
> take ~50s to wake up. After that it is fast.

## What it does

A player searches their name (or pastes an OpenDota account id), the app syncs
their recent matches into Postgres, and presents two things:

- A **dashboard** — win rate by hero, by attribute (Strength/Agility/Intelligence/
  Universal), by role, and by game phase, plus a GPM trend and an LLM-written
  performance tip.
- A **natural-language chat** — you ask questions like *"which hero do I win most
  with?"* or *"what's my GPM when I win vs lose?"*; the app converts the question
  to SQL (Text-to-SQL), executes it on your data, and answers in plain English.

## Architecture

```
OpenDota API → ETL → PostgreSQL → FastAPI → React
                                     └── llm.py → Groq / Gemini / Claude
```

- **ETL** (`etl/`) fetches heroes and per-match player stats, transforms them, and
  loads them into a normalized schema (`heroes`, `matches`, `player_matches`).
  Loads are **idempotent** — `INSERT ... ON CONFLICT DO NOTHING` on composite keys
  (`match_id`, `account_id`) — so re-syncing a player never creates duplicates.
- **Backend** (`backend/`) is a FastAPI REST API. Analytics are computed in SQL,
  including reusable views (`hero_win_rates`, `duration_performance`). All LLM
  calls go through a single provider-agnostic entry point (`backend/llm.py`), so
  switching between Groq, Gemini, and Claude touches only one file.
- **Frontend** (`frontend/`) is a React + TypeScript SPA with Recharts. Because the
  match sync runs in the background, the dashboard **polls until the data lands and
  refreshes itself** rather than showing an empty state.
- **Self-initializing DB** — the API applies `sql/schema.sql` on startup (the DDL
  is idempotent), so it boots cleanly against a blank database with no manual step.

## Tech stack

- **Languages** — Python 3.11, TypeScript
- **Backend** — FastAPI, Uvicorn, psycopg2
- **Frontend** — React 18, Vite, Recharts
- **Database** — PostgreSQL 15
- **LLM** — Groq (`openai/gpt-oss-120b`, default), Google Gemini
  (`gemini-2.0-flash`), Anthropic Claude — behind one interface
- **Infra / deploy** — Docker; Vercel (web), Render (API), Neon (Postgres)
- **CI** — GitHub Actions

## Run locally

```bash
cp .env.example .env      # add at least one of GROQ_API_KEY / GEMINI_API_KEY
docker compose up --build # starts Postgres + the API
```

- API: <http://localhost:8000> (interactive docs at `/docs`)
- Postgres is published on host port **5433** (5432 inside the container) to avoid
  clashing with a local PostgreSQL install. The schema is applied on startup.

Frontend (separate terminal):

```bash
cd frontend
npm install
npm run dev               # http://localhost:4310
```

Load data from the app's search box, or run the ETL directly:

```bash
python etl/run_etl.py <account_id> 50
```

Free API keys: [Groq](https://console.groq.com) · [Gemini](https://aistudio.google.com).
A player must enable **Expose Public Match Data** in Dota 2 for their history to be
visible to OpenDota (and this app).

## Testing & CI

[GitHub Actions](.github/workflows/ci.yml) runs on every push and PR to `main`. It
spins up a Postgres service, applies `sql/schema.sql`, installs the backend, boots
the API and smoke-checks `/health` and `/chat/providers`, then builds the frontend
(`tsc && vite build`). It validates that the full stack starts and compiles — a
build-and-smoke-test pipeline rather than a unit-test suite.

## Notable engineering decisions

- **Hardened Text-to-SQL.** Model-generated SQL is unreliable, so the pipeline
  strips markdown fences, **retries with the database error fed back to the model**
  on failures, and enforces grounding rules — answers may only cite rows the query
  returned (added after the model was caught fabricating a hero's stats), and
  summary/recommendation questions must return pre-aggregated `GROUP BY` rows so the
  model reads numbers instead of miscounting raw matches.
- **Provider-agnostic LLM layer.** A single `call_llm(prompt, provider)` function
  fronts Groq, Gemini, and Claude; the API reports which providers have keys
  configured and the UI disables the rest. Adding a provider is a one-file change.
- **Idempotent, self-initializing data layer.** Composite-key `ON CONFLICT DO
  NOTHING` inserts make repeated syncs safe, and startup schema application lets the
  service deploy against a fresh managed database (Neon) with zero manual setup.

## License

MIT. A personal, unofficial fan project — not affiliated with or endorsed by Valve.
Dota 2 is a trademark of Valve Corporation.

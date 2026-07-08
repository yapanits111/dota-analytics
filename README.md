# Dota 2 Personal Analytics

### ▶️ [**Live app**](https://dota-analytics-cyan.vercel.app) &nbsp;·&nbsp; [API](https://dota-analytics-api.onrender.com/health)

> Note: the backend runs on a free tier that sleeps when idle — the **first**
> request may take ~50s to wake up, then it's fast.

Type a Steam username, and this app pulls your Dota 2 match history from the
public [OpenDota API](https://docs.opendota.com/) into PostgreSQL, then lets you
ask questions about your performance in plain English. A provider-agnostic LLM
layer converts your question to SQL (Text-to-SQL), runs it against your data, and
explains the result. The dashboard also shows an LLM-generated performance tip and
data-driven suggested questions.

Stack: **Python · FastAPI · PostgreSQL · React · TypeScript · Docker · Gemini / Groq / Claude**
&nbsp;|&nbsp; Deployed on **Vercel + Render + Neon**.

<!-- Add screenshots here, e.g.:
![Dashboard](docs/dashboard.png)
![Chat](docs/chat.png)
-->

## Try it

1. Open the [live app](https://dota-analytics-cyan.vercel.app).
2. Search a Steam name (e.g. `yapanits`) or paste an OpenDota account id (e.g. `70388657`).
3. Pick a player, wait for the one-time sync, then explore the dashboard or ask a question.

   Example questions: *"Which hero do I win the most with?"*, *"Do I play better
   early or late game?"*, *"What's my average GPM when I win vs lose?"*

## Architecture

Three tracks in one app:

- **Data engineering** — a Python ETL pipeline (`etl/`) fetches heroes and match
  details from OpenDota, transforms them, and upserts into PostgreSQL. Analytics
  are exposed as SQL views (`hero_win_rates`, `duration_performance`).
- **SWE** — a FastAPI REST backend (`backend/`), a React + TypeScript frontend
  (`frontend/`), Docker Compose for local dev, and GitHub Actions CI.
- **AI / LLM** — a single provider-agnostic entry point (`backend/llm.py`) powers
  Text-to-SQL chat, the tip box, and dynamic question suggestions.

```
OpenDota API → ETL → PostgreSQL → FastAPI → React
                                     └── llm.py → Gemini / Groq / Claude
```

## Provider support

All LLM calls go through `backend/llm.py`. Adding a provider means editing only
that file.

| Provider | Model                    | Status                                     |
|----------|--------------------------|--------------------------------------------|
| Groq     | `llama-3.3-70b-versatile`| **Default** — active on the free tier      |
| Gemini   | `gemini-2.0-flash`       | Active when the key has free-tier quota     |
| Claude   | `claude-sonnet-5`        | Implemented — activates when you add a key  |

The UI shows a `🔒` on any provider without a configured API key. Groq is the
default because its 70B model is the strongest free option for Text-to-SQL.
Claude is wired end-to-end; drop `ANTHROPIC_API_KEY` into the environment to
enable it.

## Local setup

```bash
cp .env.example .env
# edit .env and add at least one of GEMINI_API_KEY / GROQ_API_KEY
#   Gemini free key: https://aistudio.google.com
#   Groq free key:   https://console.groq.com

docker compose up --build
```

- Backend: http://localhost:8000 (interactive docs at `/docs`)
- Postgres: the container maps to host port **5433** (5432 inside), chosen to
  avoid clashing with a native PostgreSQL that may already own 5432. The backend
  applies `sql/schema.sql` automatically on startup.

Run the frontend separately:

```bash
cd frontend
npm install        # generates package-lock.json (commit it so CI's `npm ci` works)
npm run dev        # http://localhost:4310
```

For local dev the backend is easiest to run from source (so the `/sync` button
works — it shells out to `etl/`):

```bash
cd backend
uvicorn main:app --port 8000      # reads ../.env (DATABASE_URL -> localhost:5433)
```

### Loading data

Use the app's search box (name or numeric account ID), or run the ETL directly:

```bash
python etl/run_etl.py <account_id> 50
```

Find your `account_id` from the search box or your OpenDota profile URL. Note:
players must enable **"Expose Public Match Data"** in Dota 2 for OpenDota (and
this app) to see their matches.

## Example questions

Screenshot these in the running app and paste them below:

1. Which hero do I have the highest win rate on with at least 10 games?
2. Do I perform better in early, mid, or late game?
3. What is my average GPM when I win versus when I lose?
4. Am I improving? Compare my last 30 games to the 30 before that.
5. Do I win more on Radiant or Dire?

The app is deploy-ready: the root `Dockerfile` bundles the API + ETL + schema,
binds `$PORT`, and applies `sql/schema.sql` on startup (no manual DB step). It
reads `DATABASE_URL`, `GROQ_API_KEY` / `GEMINI_API_KEY`, and `ALLOWED_ORIGINS`
from the environment, so it runs on any Docker host.

### Free stack (Neon + Render + Vercel)

- **Database → [Neon](https://neon.tech).** Free Postgres, no expiry. Create a
  project and copy the connection string (ends with `?sslmode=require`).
- **Backend → [Render](https://render.com).** New → Blueprint → this repo (uses
  `render.yaml`). Set `DATABASE_URL` (Neon), `GROQ_API_KEY`, and `ALLOWED_ORIGINS`
  (your Vercel URL). Free web services sleep after 15 min idle (≈50s cold start).
- **Frontend → [Vercel](https://vercel.com).** Import the repo, root directory
  `frontend`, env var `VITE_API_URL=https://<your-render-service>.onrender.com`.

Railway works too (add its PostgreSQL plugin, it builds via `railway.json`) but
its free tier is a one-time trial credit rather than free forever.

## Notes

- CI (`.github/workflows/ci.yml`) applies the schema, boots the API for a health
  check, and builds the frontend. `npm ci` requires a committed `package-lock.json`.
- Text-to-SQL executes model-generated SQL. This is scoped to a personal-analytics
  read model; for a hardened deployment, run queries under a read-only DB role.

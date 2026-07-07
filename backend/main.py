import os, time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from routers import stats, chat, sync, search
from database import get_conn

load_dotenv()

app = FastAPI(title="Dota 2 Analytics API")

# CORS: allow the comma-separated origins from ALLOWED_ORIGINS (the deployed
# frontend URL). Falls back to the local Vite dev server.
origins = [o.strip() for o in
           os.getenv("ALLOWED_ORIGINS", "http://localhost:4310").split(",")
           if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stats.router)
app.include_router(chat.router)
app.include_router(sync.router)
app.include_router(search.router)


@app.on_event("startup")
def ensure_schema():
    """Apply sql/schema.sql on boot so a fresh database (e.g. Railway's
    Postgres plugin) is ready with no manual step. schema.sql is idempotent
    (CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE VIEW)."""
    schema_path = os.path.join(os.path.dirname(__file__), "..", "sql", "schema.sql")
    if not os.path.exists(schema_path):
        return
    with open(schema_path, encoding="utf-8") as f:
        ddl = f.read()
    for attempt in range(10):
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(ddl)
            print("Schema ensured.")
            return
        except Exception as e:  # DB may not be reachable yet on cold start
            print(f"Schema init retry {attempt + 1}/10: {e}")
            time.sleep(3)
    print("Warning: could not apply schema after retries.")


@app.get("/health")
def health():
    return {"status": "ok"}

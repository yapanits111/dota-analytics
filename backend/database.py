import os, psycopg2, psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def query(sql: str, params=None) -> list[dict]:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]

def execute(sql: str, params=None):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)

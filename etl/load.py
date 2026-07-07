import psycopg2, psycopg2.extras, os

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def upsert_heroes(heroes: list[dict]):
    with get_conn() as conn:
        with conn.cursor() as cur:
            psycopg2.extras.execute_values(
                cur,
                """
                INSERT INTO heroes
                  (hero_id, name, local_name, primary_attr, attack_type, roles)
                VALUES %s
                ON CONFLICT (hero_id) DO NOTHING
                """,
                [(h["hero_id"], h["name"], h["local_name"],
                  h["primary_attr"], h["attack_type"], h["roles"])
                 for h in heroes],
                template="(%s,%s,%s,%s,%s,%s::text[])"
            )

def upsert_match(match: dict, player: dict):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO matches
                  (match_id, duration, game_mode, start_time, patch, radiant_win)
                VALUES
                  (%(match_id)s,%(duration)s,%(game_mode)s,
                   %(start_time)s,%(patch)s,%(radiant_win)s)
                ON CONFLICT (match_id) DO NOTHING
                """,
                match
            )
            cur.execute(
                """
                INSERT INTO player_matches
                  (match_id, account_id, hero_id, kills, deaths, assists,
                   gpm, xpm, last_hits, denies, net_worth, won, player_slot)
                VALUES
                  (%(match_id)s,%(account_id)s,%(hero_id)s,%(kills)s,%(deaths)s,
                   %(assists)s,%(gpm)s,%(xpm)s,%(last_hits)s,%(denies)s,
                   %(net_worth)s,%(won)s,%(player_slot)s)
                ON CONFLICT (match_id, account_id) DO NOTHING
                """,
                player
            )

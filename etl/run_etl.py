import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from fetch import fetch_heroes, fetch_all_matches
from transform import transform_heroes, transform_match
from load import upsert_heroes, upsert_match

def run(account_id: int, limit: int = 200):
    print("Fetching heroes...")
    upsert_heroes(transform_heroes(fetch_heroes()))

    print(f"Fetching {limit} matches for account {account_id}...")
    loaded = 0
    for raw in fetch_all_matches(account_id, limit):
        result = transform_match(raw, account_id)
        if result:
            upsert_match(*result)
            loaded += 1

    print(f"Done. Loaded {loaded} matches.")

if __name__ == "__main__":
    account_id = int(sys.argv[1])
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 200
    run(account_id, limit)

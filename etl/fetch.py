import requests, time

BASE = "https://api.opendota.com/api"

def search_player(username: str) -> list:
    r = requests.get(f"{BASE}/search", params={"q": username}, timeout=10)
    r.raise_for_status()
    return r.json()

def fetch_heroes() -> list:
    r = requests.get(f"{BASE}/heroes", timeout=10)
    r.raise_for_status()
    return r.json()

def fetch_match_list(account_id: int, limit: int = 300) -> list:
    r = requests.get(
        f"{BASE}/players/{account_id}/matches",
        params={"limit": limit},
        timeout=15
    )
    r.raise_for_status()
    return r.json()

def fetch_match_detail(match_id: int) -> dict:
    r = requests.get(f"{BASE}/matches/{match_id}", timeout=15)
    r.raise_for_status()
    return r.json()

def fetch_all_matches(account_id: int, limit: int = 200) -> list[dict]:
    match_list = fetch_match_list(account_id, limit)
    details = []
    for i, m in enumerate(match_list):
        try:
            detail = fetch_match_detail(m["match_id"])
            details.append(detail)
            print(f"Fetched {i+1}/{len(match_list)}: {m['match_id']}")
            time.sleep(1)
        except Exception as e:
            print(f"Skipped {m['match_id']}: {e}")
    return details

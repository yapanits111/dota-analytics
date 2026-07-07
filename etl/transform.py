from datetime import datetime

def transform_heroes(raw: list) -> list[dict]:
    return [
        {
            "hero_id":      h["id"],
            "name":         h["name"].replace("npc_dota_hero_", ""),
            "local_name":   h.get("localized_name"),
            "primary_attr": h.get("primary_attr"),
            "attack_type":  h.get("attack_type"),
            "roles":        h.get("roles", [])
        }
        for h in raw
    ]

def transform_match(raw: dict, account_id: int) -> tuple[dict, dict] | None:
    player = next(
        (p for p in raw.get("players", []) if p.get("account_id") == account_id),
        None
    )
    if not player:
        return None

    radiant_win = raw.get("radiant_win", False)
    player_slot = player.get("player_slot", 0)
    is_radiant  = player_slot < 128
    won = (is_radiant and radiant_win) or (not is_radiant and not radiant_win)

    match_row = {
        "match_id":    raw["match_id"],
        "duration":    raw.get("duration"),
        "game_mode":   raw.get("game_mode"),
        "start_time":  datetime.fromtimestamp(raw["start_time"])
                       if raw.get("start_time") else None,
        "patch":       str(raw.get("patch", "")),
        "radiant_win": radiant_win
    }

    player_row = {
        "match_id":    raw["match_id"],
        "account_id":  account_id,
        "hero_id":     player.get("hero_id"),
        "kills":       player.get("kills", 0),
        "deaths":      player.get("deaths", 0),
        "assists":     player.get("assists", 0),
        "gpm":         player.get("gold_per_min", 0),
        "xpm":         player.get("xp_per_min", 0),
        "last_hits":   player.get("last_hits", 0),
        "denies":      player.get("denies", 0),
        "net_worth":   player.get("net_worth", 0),
        "won":         won,
        "player_slot": player_slot
    }

    return match_row, player_row

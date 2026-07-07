from fastapi import APIRouter, HTTPException
import httpx, asyncio

router = APIRouter(prefix="/search", tags=["search"])

OPENDOTA_SEARCH = "https://api.opendota.com/api/search"
ATTEMPTS = 3

@router.get("")
async def search_player(q: str):
    """Proxy OpenDota's player search. OpenDota is Cloudflare-fronted and its
    /search endpoint intermittently stalls, so we retry a few times before
    giving up."""
    last_err = None
    async with httpx.AsyncClient(timeout=20) as client:
        for attempt in range(ATTEMPTS):
            try:
                r = await client.get(OPENDOTA_SEARCH, params={"q": q})
                r.raise_for_status()
                return r.json()[:5]
            except httpx.HTTPError as e:
                last_err = e
                if attempt < ATTEMPTS - 1:
                    await asyncio.sleep(1.5)

    raise HTTPException(
        status_code=502,
        detail=f"OpenDota did not respond after {ATTEMPTS} tries ({last_err}). "
               f"It rate-limits search — please try again in a few seconds."
    )


@router.get("/account/{account_id}")
async def account_profile(account_id: int):
    """Look up a player's display name by account id (used when the user enters
    a raw account ID instead of searching by name)."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"https://api.opendota.com/api/players/{account_id}"
            )
            r.raise_for_status()
            data = r.json() or {}
        name = ((data.get("profile") or {}).get("personaname"))
        return {"account_id": account_id, "personaname": name or f"Account {account_id}"}
    except httpx.HTTPError:
        return {"account_id": account_id, "personaname": f"Account {account_id}"}

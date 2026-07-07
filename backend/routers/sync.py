from fastapi import APIRouter, BackgroundTasks
import subprocess, sys, os

router = APIRouter(prefix="/sync", tags=["sync"])

def run_etl(account_id: int):
    etl_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "etl")
    )
    subprocess.run(
        [sys.executable, "run_etl.py", str(account_id), "50"],
        cwd=etl_dir
    )

@router.post("/{account_id}")
def sync(account_id: int, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_etl, account_id)
    return {"status": "syncing", "account_id": account_id}

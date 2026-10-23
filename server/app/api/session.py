from fastapi import APIRouter, HTTPException

from app import storage

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("")
def create_session() -> dict:
    return storage.create_session()


@router.get("")
def get_sessions() -> list[dict]:
    return storage.list_sessions()


@router.get("/{session_id}")
def get_session(session_id: str) -> dict:
    session = storage.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    return session


@router.delete("/{session_id}")
def remove_session(session_id: str) -> dict:
    storage.delete_session(session_id)
    return {"ok": True}

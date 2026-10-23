import json
import uuid
from datetime import datetime
from pathlib import Path

from app.config import settings


def _session_path(session_id: str) -> Path:
    return settings.session_dir / f"{session_id}.json"


def create_session() -> dict:
    """新建空会话"""
    session = {
        "session_id": uuid.uuid4().hex[:12],
        "title": "新对话",
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "messages": [],
    }
    _save(session)
    return session


def get_session(session_id: str) -> dict | None:
    path = _session_path(session_id)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def list_sessions() -> list[dict]:
    """会话列表，按创建时间倒序，不含消息体"""
    sessions = []
    for path in settings.session_dir.glob("*.json"):
        data = json.loads(path.read_text(encoding="utf-8"))
        sessions.append({
            "session_id": data["session_id"],
            "title": data["title"],
            "created_at": data["created_at"],
        })
    return sorted(sessions, key=lambda s: s["created_at"], reverse=True)


def delete_session(session_id: str) -> None:
    path = _session_path(session_id)
    if path.exists():
        path.unlink()


def append_message(session_id: str, message: dict) -> None:
    """向会话追加一条消息；首条用户消息同时作为会话标题"""
    session = get_session(session_id)
    if session is None:
        return
    session["messages"].append(message)
    if message["role"] == "user" and session["title"] == "新对话":
        session["title"] = message["content"][:20]
    _save(session)


def get_history_messages(session_id: str) -> list[dict]:
    """取出用于 LLM 上下文的消息（仅 user/assistant 的 content）"""
    session = get_session(session_id)
    if session is None:
        return []
    return [
        {"role": m["role"], "content": m["content"]}
        for m in session["messages"]
        if m["role"] in ("user", "assistant")
    ]


def _save(session: dict) -> None:
    _session_path(session["session_id"]).write_text(
        json.dumps(session, ensure_ascii=False, indent=2), encoding="utf-8"
    )

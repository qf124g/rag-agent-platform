from pydantic import BaseModel


class ChatRequest(BaseModel):
    session_id: str
    message: str


class SessionCreateResponse(BaseModel):
    session_id: str
    title: str
    created_at: str


class DocumentInfo(BaseModel):
    doc_id: str
    doc_name: str
    chunk_count: int

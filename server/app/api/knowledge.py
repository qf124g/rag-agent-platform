import shutil
import uuid

from fastapi import APIRouter, HTTPException, UploadFile

from app.config import settings
from app.rag import vectorstore
from app.rag.loader import SUPPORTED_SUFFIXES
from app.rag.pipeline import ingest_document
from app.schemas import DocumentInfo

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


@router.post("/upload", response_model=DocumentInfo)
def upload_document(file: UploadFile) -> dict:
    """上传文档并入库：保存原文件 → 解析切分 → 向量化入库"""
    suffix = "." + (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else ""
    if suffix not in SUPPORTED_SUFFIXES:
        raise HTTPException(status_code=400, detail=f"仅支持 {sorted(SUPPORTED_SUFFIXES)} 格式")

    saved_path = settings.upload_dir / f"{uuid.uuid4().hex[:8]}_{file.filename}"
    with saved_path.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        return ingest_document(saved_path, file.filename or saved_path.name)
    except ValueError as e:
        saved_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/documents", response_model=list[DocumentInfo])
def get_documents() -> list[dict]:
    return vectorstore.list_documents()


@router.delete("/documents/{doc_id}")
def remove_document(doc_id: str) -> dict:
    vectorstore.delete_document(doc_id)
    return {"ok": True}

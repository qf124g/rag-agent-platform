import json
import shutil
import uuid
from collections.abc import Iterator

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.config import settings
from app.rag import vectorstore
from app.rag.loader import SUPPORTED_SUFFIXES
from app.rag.pipeline import ingest_document_events
from app.schemas import DocumentInfo

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


@router.post("/upload")
def upload_document(file: UploadFile) -> StreamingResponse:
    """上传文档并入库（SSE 流式）：保存原文件 → 解析 → 切分 → 分批向量化入库，
    各阶段实时推送进度事件（stage / progress / done / error）。"""
    suffix = "." + (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else ""
    if suffix not in SUPPORTED_SUFFIXES:
        raise HTTPException(status_code=400, detail=f"仅支持 {sorted(SUPPORTED_SUFFIXES)} 格式")

    saved_path = settings.upload_dir / f"{uuid.uuid4().hex[:8]}_{file.filename}"
    with saved_path.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    def event_stream() -> Iterator[str]:
        try:
            for event in ingest_document_events(saved_path, file.filename or saved_path.name):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except ValueError as e:
            # 业务错误（如内容为空）：删除已保存文件，通过事件告知前端
            saved_path.unlink(missing_ok=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"
        except Exception as e:  # noqa: BLE001 流式接口无法中途改状态码，统一转为 error 事件
            saved_path.unlink(missing_ok=True)
            yield f"data: {json.dumps({'type': 'error', 'message': f'入库失败：{e}'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/documents", response_model=list[DocumentInfo])
def get_documents() -> list[dict]:
    return vectorstore.list_documents()


@router.delete("/documents/{doc_id}")
def remove_document(doc_id: str) -> dict:
    vectorstore.delete_document(doc_id)
    return {"ok": True}

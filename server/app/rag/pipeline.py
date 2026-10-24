import uuid
from collections.abc import Iterator
from pathlib import Path

from app.config import settings
from app.rag import vectorstore
from app.rag.embedder import embed
from app.rag.loader import extract_text
from app.rag.splitter import split_text

# 向量化分批大小：逐批 embed 并上报进度，让前端展示真实推进
EMBED_BATCH_SIZE = 32


def ingest_document_events(file_path: Path, doc_name: str) -> Iterator[dict]:
    """文档入库 pipeline（事件流版）：提取文本 → 切分 → 分批向量化 → 写入向量库。
    每个阶段 yield 进度事件，供上传接口以 SSE 推送给前端展示真实进度。"""
    # stage 0：文档解析
    yield {"type": "stage", "stage": 0}
    text = extract_text(file_path)
    if not text.strip():
        raise ValueError("文档内容为空")

    # stage 1：文本切分
    yield {"type": "stage", "stage": 1}
    chunks = split_text(text)

    # stage 2：分批向量化并上报进度
    yield {"type": "stage", "stage": 2, "total": len(chunks)}
    embeddings: list[list[float]] = []
    for i in range(0, len(chunks), EMBED_BATCH_SIZE):
        embeddings.extend(embed(chunks[i : i + EMBED_BATCH_SIZE]))
        yield {"type": "progress", "done": len(embeddings), "total": len(chunks)}

    doc_id = uuid.uuid4().hex[:12]
    vectorstore.add_chunks(doc_id, doc_name, chunks, embeddings)
    yield {"type": "done", "doc_id": doc_id, "doc_name": doc_name, "chunk_count": len(chunks)}


def retrieve(query: str, top_k: int | None = None) -> list[dict]:
    """检索 pipeline：query 向量化 → 相似度检索"""
    k = top_k or settings.retrieve_top_k
    query_embedding = embed([query])[0]
    return vectorstore.search(query_embedding, k)

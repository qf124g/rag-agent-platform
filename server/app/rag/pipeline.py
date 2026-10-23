import uuid
from pathlib import Path

from app.config import settings
from app.rag import vectorstore
from app.rag.embedder import embed
from app.rag.loader import extract_text
from app.rag.splitter import split_text


def ingest_document(file_path: Path, doc_name: str) -> dict:
    """文档入库 pipeline：提取文本 → 切分 → 向量化 → 写入向量库"""
    text = extract_text(file_path)
    if not text.strip():
        raise ValueError("文档内容为空")

    chunks = split_text(text)
    embeddings = embed(chunks)

    doc_id = uuid.uuid4().hex[:12]
    vectorstore.add_chunks(doc_id, doc_name, chunks, embeddings)
    return {"doc_id": doc_id, "doc_name": doc_name, "chunk_count": len(chunks)}


def retrieve(query: str, top_k: int | None = None) -> list[dict]:
    """检索 pipeline：query 向量化 → 相似度检索"""
    k = top_k or settings.retrieve_top_k
    query_embedding = embed([query])[0]
    return vectorstore.search(query_embedding, k)

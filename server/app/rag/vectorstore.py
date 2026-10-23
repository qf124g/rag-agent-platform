import chromadb
from chromadb.config import Settings as ChromaSettings

from app.config import settings

_COLLECTION_NAME = "knowledge_base"

# Chroma 本地持久化客户端（禁用遥测，避免 posthog 版本兼容噪音）
_client = chromadb.PersistentClient(
    path=str(settings.chroma_dir),
    settings=ChromaSettings(anonymized_telemetry=False),
)
_collection = _client.get_or_create_collection(
    name=_COLLECTION_NAME,
    metadata={"hnsw:space": "cosine"},
)


def add_chunks(doc_id: str, doc_name: str, chunks: list[str], embeddings: list[list[float]]) -> None:
    """把文档切片及其向量写入向量库"""
    _collection.add(
        ids=[f"{doc_id}_{i}" for i in range(len(chunks))],
        documents=chunks,
        embeddings=embeddings,
        metadatas=[{"doc_id": doc_id, "doc_name": doc_name, "chunk_index": i} for i in range(len(chunks))],
    )


def search(query_embedding: list[float], top_k: int) -> list[dict]:
    """相似度检索，返回切片文本 + 来源元数据 + 距离"""
    if _collection.count() == 0:
        return []
    result = _collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, _collection.count()),
    )
    hits = []
    for doc, meta, dist in zip(
        result["documents"][0], result["metadatas"][0], result["distances"][0]
    ):
        hits.append({"content": doc, "doc_name": meta["doc_name"], "doc_id": meta["doc_id"], "distance": dist})
    return hits


def delete_document(doc_id: str) -> None:
    """删除某文档的全部切片"""
    _collection.delete(where={"doc_id": doc_id})


def list_documents() -> list[dict]:
    """按文档聚合统计：doc_id、文档名、切片数"""
    result = _collection.get(include=["metadatas"])
    docs: dict[str, dict] = {}
    for meta in result["metadatas"]:
        entry = docs.setdefault(meta["doc_id"], {"doc_id": meta["doc_id"], "doc_name": meta["doc_name"], "chunk_count": 0})
        entry["chunk_count"] += 1
    return list(docs.values())

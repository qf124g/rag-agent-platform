from fastembed import TextEmbedding

from app.config import settings

# 本地 Embedding 模型：文档向量化在本机完成，数据不出内网
# 首次使用会自动下载模型（约 100MB，ONNX 格式）
_model = TextEmbedding(model_name=settings.embedding_model)


def embed(texts: list[str]) -> list[list[float]]:
    """批量文本向量化"""
    return [vec.tolist() for vec in _model.embed(texts)]

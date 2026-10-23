from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# 后端根目录（server/）
BASE_DIR = Path(__file__).resolve().parent.parent
# 运行时数据目录：向量库、业务库、上传文件、会话记录
DATA_DIR = BASE_DIR / "data"


class Settings(BaseSettings):
    """应用配置，全部支持环境变量覆盖"""

    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", env_file_encoding="utf-8")

    # 模型服务（OpenAI 兼容协议，默认阿里百炼端点，chat 与 embedding 共用）
    # 优先读 OPENAI_API_KEY，兼容本机已有的 DASHSCOPE_API_KEY
    openai_api_key: str = Field(
        default="", validation_alias=AliasChoices("OPENAI_API_KEY", "DASHSCOPE_API_KEY")
    )
    openai_base_url: str = "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"

    # 对话模型（需支持 function calling）
    llm_model: str = "qwen3.8-max"
    # 本地向量模型（fastembed，无需额外 API Key）
    embedding_model: str = "BAAI/bge-small-zh-v1.5"

    # RAG 切分参数
    chunk_size: int = 500
    chunk_overlap: int = 50
    retrieve_top_k: int = 4

    # Agent 最大工具调用轮数
    agent_max_rounds: int = 5

    @property
    def chroma_dir(self) -> Path:
        return DATA_DIR / "chroma"

    @property
    def upload_dir(self) -> Path:
        return DATA_DIR / "uploads"

    @property
    def session_dir(self) -> Path:
        return DATA_DIR / "sessions"

    @property
    def biz_db_path(self) -> Path:
        return DATA_DIR / "biz.db"


settings = Settings()

# 确保数据目录存在
for d in (DATA_DIR, settings.chroma_dir, settings.upload_dir, settings.session_dir):
    d.mkdir(parents=True, exist_ok=True)

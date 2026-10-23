import json
import sqlite3
from typing import Callable

from app.config import settings
from app.rag.pipeline import retrieve


def knowledge_search(query: str) -> str:
    """检索知识库，返回与问题最相关的文档片段（JSON，含来源文档名）"""
    hits = retrieve(query)
    if not hits:
        return json.dumps({"sources": [], "message": "知识库中没有找到相关内容"}, ensure_ascii=False)
    sources = [{"doc_name": h["doc_name"], "content": h["content"]} for h in hits]
    return json.dumps({"sources": sources}, ensure_ascii=False)


def sql_query(sql: str) -> str:
    """对业务数据库执行只读 SELECT 查询，返回 JSON 表格结果"""
    # 以只读模式打开数据库，从机制上杜绝写操作
    conn = sqlite3.connect(f"file:{settings.biz_db_path}?mode=ro", uri=True)
    try:
        cursor = conn.execute(sql)
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchmany(50)  # 限制返回行数，防止结果过大
        result = [dict(zip(columns, row)) for row in rows]
        return json.dumps(result, ensure_ascii=False, default=str)
    finally:
        conn.close()


# 工具注册表：LLM function calling 的 schema + 本地执行函数
class Tool:
    def __init__(self, name: str, description: str, parameters: dict, func: Callable[[str], str]):
        self.name = name
        self.description = description
        self.parameters = parameters
        self.func = func

    def schema(self) -> dict:
        """转换为 OpenAI function calling 的 tools 参数格式"""
        return {
            "type": "function",
            "function": {"name": self.name, "description": self.description, "parameters": self.parameters},
        }

    def run(self, arguments_json: str) -> str:
        args = json.loads(arguments_json)
        return self.func(**args)


TOOLS: list[Tool] = [
    Tool(
        name="knowledge_search",
        description="检索企业知识库，获取与用户问题相关的文档片段。当问题涉及公司制度、产品资料、业务文档等知识库内容时使用。",
        parameters={
            "type": "object",
            "properties": {"query": {"type": "string", "description": "检索关键词或问题"}},
            "required": ["query"],
        },
        func=knowledge_search,
    ),
    Tool(
        name="sql_query",
        description="查询企业业务数据库（SQLite），对销售订单数据做统计分析。当问题涉及销售额、订单量、商品排行、客户分布等业务数据时使用。只能执行 SELECT 语句。",
        parameters={
            "type": "object",
            "properties": {"sql": {"type": "string", "description": "一条合法的 SQLite SELECT 查询语句"}},
            "required": ["sql"],
        },
        func=sql_query,
    ),
]

_TOOL_MAP = {t.name: t for t in TOOLS}


def get_tool_schemas() -> list[dict]:
    return [t.schema() for t in TOOLS]


def execute_tool(name: str, arguments_json: str) -> str:
    return _TOOL_MAP[name].run(arguments_json)

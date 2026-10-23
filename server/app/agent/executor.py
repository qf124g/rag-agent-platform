from typing import Callable, Iterator

from app.agent.tools import execute_tool, get_tool_schemas
from app.config import settings
from app.db.seed import SCHEMA_SQL
from app.llm import client as llm

# Agent 系统提示词：说明角色、工具使用策略，并注入业务库 schema 以支撑 Text-to-SQL
SYSTEM_PROMPT = f"""你是企业内部的智能助手，能够解答两类问题：

1. 知识库问答：涉及公司制度、产品资料、业务文档的问题，调用 knowledge_search 检索后基于检索内容回答，并注明来源文档。
2. 业务数据分析：涉及销售额、订单量、商品排行、客户分布等数据的问题，调用 sql_query 查询业务数据库后基于结果回答。

业务数据库为 SQLite，建表语句如下：
```sql
{SCHEMA_SQL}
```

规则：
- 生成 SQL 时只允许 SELECT 语句，注意订单金额统计应排除"已取消"的订单。
- 每一轮独立判断，仅当当前问题本身需要知识库资料或业务数据时才调用工具；问候、闲聊、表达感谢、询问助手能力等问题一律直接回答，禁止调用工具，也不要受历史消息影响。
- 始终聚焦回答用户最新提出的问题，不要重复回答历史消息中已经回答过的问题。
- 基于工具返回的数据回答，不要编造数字；回答数据分析类问题时先给结论，再用数据支撑。
- 用中文回答，回答简洁清晰。
"""


def run_agent(
    messages: list[dict],
    on_tool_call: Callable[[str, str, str], None],
) -> Iterator[str]:
    """Agent 主循环（全流程流式）：
    每轮流式请求（携带 tools）→ content 增量即时产出；
    流结束若收集到 tool_calls 则执行工具并进入下一轮，否则结束。
    """
    full_messages = [{"role": "system", "content": SYSTEM_PROMPT}, *messages]
    tools = get_tool_schemas()

    for _ in range(settings.agent_max_rounds):
        content_parts: list[str] = []
        # 按 index 累积流式 tool_calls 分片
        tc_acc: dict[int, dict] = {}

        for event in llm.chat_stream(full_messages, tools=tools):
            if event["type"] == "content":
                content_parts.append(event["content"])
                yield event["content"]
            else:
                acc = tc_acc.setdefault(event["index"], {"id": "", "name": "", "args": []})
                if event["id"]:
                    acc["id"] = event["id"]
                if event["name"]:
                    acc["name"] = event["name"]
                acc["args"].append(event["arguments"])

        if not tc_acc:
            # 无工具调用，流式回答已输出完毕
            return

        # 组装本轮 assistant 消息（content 可能为空，属正常：模型直接决策调工具）
        tool_calls = [
            {
                "id": acc["id"],
                "type": "function",
                "function": {"name": acc["name"], "arguments": "".join(acc["args"])},
            }
            for _, acc in sorted(tc_acc.items())
        ]
        full_messages.append({
            "role": "assistant",
            "content": "".join(content_parts),
            "tool_calls": tool_calls,
        })

        for call in tool_calls:
            name = call["function"]["name"]
            arguments = call["function"]["arguments"]
            result = execute_tool(name, arguments)
            on_tool_call(name, arguments, result)
            full_messages.append({"role": "tool", "tool_call_id": call["id"], "content": result})

    # 达到最大轮数：最后一次不带 tools 流式输出，强制基于已有信息总结回答
    for event in llm.chat_stream(full_messages):
        if event["type"] == "content":
            yield event["content"]

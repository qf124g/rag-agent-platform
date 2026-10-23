from typing import Iterator

from openai import OpenAI

from app.config import settings


def _client() -> OpenAI:
    """OpenAI 兼容协议客户端"""
    return OpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)


def chat_stream(messages: list[dict], tools: list[dict] | None = None) -> Iterator[dict]:
    """流式对话，逐事件产出：
    - {"type": "content", "content": 文本增量}
    - {"type": "tool_call_chunk", "index": int, "id": str|None, "name": str|None, "arguments": 参数分片}

    流式请求必须携带 tools：模型决定调用工具时会以结构化 tool_calls 增量返回，
    否则可能把 <tool_call> 标签当普通文本输出。
    """
    kwargs: dict = {"model": settings.llm_model, "messages": messages, "stream": True}
    if tools:
        kwargs["tools"] = tools
    stream = _client().chat.completions.create(**kwargs)
    for chunk in stream:
        # 该端点流式响应中可能存在空 choices 的帧（如仅携带 usage 的结束帧）
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        if delta.content:
            yield {"type": "content", "content": delta.content}
        if delta.tool_calls:
            for tc in delta.tool_calls:
                yield {
                    "type": "tool_call_chunk",
                    "index": tc.index,
                    "id": tc.id,
                    "name": tc.function.name if tc.function else None,
                    "arguments": (tc.function.arguments or "") if tc.function else "",
                }

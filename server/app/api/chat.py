import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app import storage
from app.agent.executor import run_agent
from app.schemas import ChatRequest

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _sse(data: dict) -> str:
    """序列化一条 SSE 事件"""
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("")
def chat(req: ChatRequest) -> StreamingResponse:
    """智能问答接口：SSE 流式返回，事件类型 tool_call / delta / done / error"""
    if storage.get_session(req.session_id) is None:
        raise HTTPException(status_code=404, detail="会话不存在")

    storage.append_message(req.session_id, {"role": "user", "content": req.message})
    history = storage.get_history_messages(req.session_id)

    def event_stream():
        tool_calls: list[dict] = []
        pending: list[dict] = []  # Agent 回调产生、待发送的工具调用事件

        def on_tool_call(name: str, arguments: str, result: str) -> None:
            event = {"name": name, "arguments": arguments, "result": result}
            tool_calls.append(event)
            pending.append(event)

        answer_parts: list[str] = []
        try:
            # Agent 的工具调用全部发生在首个文本增量产出之前（决策轮为非流式），
            # 因此每次迭代先冲刷 pending，即可保证 tool_call 事件先于 delta 到达前端
            for delta in run_agent(history, on_tool_call):
                while pending:
                    yield _sse({"type": "tool_call", **pending.pop(0)})
                answer_parts.append(delta)
                yield _sse({"type": "delta", "content": delta})
            while pending:
                yield _sse({"type": "tool_call", **pending.pop(0)})

            answer = "".join(answer_parts)
            storage.append_message(
                req.session_id,
                {"role": "assistant", "content": answer, "tool_calls": tool_calls},
            )
            yield _sse({"type": "done"})
        except Exception as e:  # LLM 服务异常等，告知前端并结束流
            yield _sse({"type": "error", "message": str(e)})

    return StreamingResponse(event_stream(), media_type="text/event-stream")

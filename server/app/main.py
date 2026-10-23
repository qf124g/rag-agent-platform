from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import chat, knowledge, session
from app.db.seed import init_biz_db

app = FastAPI(title="RAG Agent 智能问答平台")

# 开发期允许前端 Vite dev server 跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(knowledge.router)
app.include_router(session.router)


@app.on_event("startup")
def startup() -> None:
    # 首次启动生成示例业务数据库
    init_biz_db()


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}

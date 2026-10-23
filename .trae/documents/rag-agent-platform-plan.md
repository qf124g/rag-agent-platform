# 企业级 RAG + Agent 智能问答平台 实现计划

## Context

从零搭建一个匹配「AI 应用工程师」JD 的全栈项目，集中体现 JD 关键词：大语言模型应用、知识库、RAG、智能问答、AI Agent、数据库/数据分析集成。目录当前为空，全新搭建。

**JD 能力映射：**

| JD 要求 | 项目功能 |
|---|---|
| 大语言模型 / Prompt | DeepSeek API 接入、RAG/Agent Prompt 模板、流式对话 |
| 知识库 | 文档上传、解析、切分、向量化入库、知识库管理页 |
| RAG | 检索增强问答 + 引用片段溯源 |
| AI Agent | 自研 function calling 循环，工具调用过程可视化 |
| 与数据库/数据分析集成 | Text-to-SQL 工具查询内置 SQLite 业务库，自然语言做数据分析 |
| SQL / 数据库 | SQLite 示例业务库（销售订单场景） |

## 技术选型（已确认）

- LLM：DeepSeek API（OpenAI 兼容协议）
- Embedding：API 调用（OpenAI 兼容接口，默认硅基流动 bge-m3，可配置切换）
- Agent：自研 function calling 工具调用循环
- 后端：Python 3.10+ / FastAPI / ChromaDB（向量库，本地持久化）/ SQLite（业务库）
- 前端：React 18 + Vite + TypeScript + Ant Design 5（白色背景 + 浅蓝主题）

## 目录结构

```
rag_agent/
├── server/
│   ├── app/
│   │   ├── main.py              # FastAPI 入口、CORS、路由注册
│   │   ├── config.py            # 环境变量配置（pydantic-settings）
│   │   ├── llm/client.py        # OpenAI 兼容客户端（chat / embedding / function calling）
│   │   ├── rag/
│   │   │   ├── loader.py        # 文档解析（txt / md / pdf）
│   │   │   ├── splitter.py      # 递归字符切分（带重叠）
│   │   │   ├── vectorstore.py   # Chroma 封装：集合管理、写入、相似度检索
│   │   │   └── pipeline.py      # 入库 pipeline + 检索 pipeline
│   │   ├── agent/
│   │   │   ├── tools.py         # 工具注册表：knowledge_search、sql_query
│   │   │   └── executor.py      # Agent 循环：LLM 决策 → 执行工具 → 汇总 → 流式回答
│   │   ├── db/
│   │   │   └── seed.py          # 生成 SQLite 示例业务库（商品/订单/客户表 + 造数）
│   │   ├── api/
│   │   │   ├── chat.py          # POST /api/chat（SSE 流式，含工具调用事件）
│   │   │   ├── knowledge.py     # 文档上传 / 列表 / 删除
│   │   │   └── session.py       # 会话 CRUD + 历史消息
│   │   ├── schemas.py           # pydantic 请求/响应模型
│   │   └── storage.py           # 会话与消息的 JSON 文件持久化（轻量）
│   ├── data/                    # 运行时生成：chroma/、biz.db、上传文件、会话记录
│   ├── .env.example             # DEEPSEEK_API_KEY、EMBEDDING_API_KEY 等
│   └── requirements.txt
├── web/
│   ├── src/
│   │   ├── pages/Chat/          # 智能问答页：会话侧栏 + 消息流 + 工具调用卡片 + 引用来源
│   │   ├── pages/Knowledge/     # 知识库页：拖拽上传 + 文档表格（切片数/时间/删除）
│   │   ├── api/                 # fetch 封装 + SSE 解析
│   │   ├── components/          # MessageItem、ToolCallCard、SourcePanel 等
│   │   ├── App.tsx / main.tsx / theme.ts
│   └── （Vite + antd 5 脚手架）
└── （启动方式：两条命令分别起前后端）
```

## 核心设计

### 1. LLM 接入层（server/app/llm/client.py）
- 基于 `openai` SDK，LLM 与 Embedding 各一个 client，base_url / key / model 全部走配置
- 统一封装 `chat()`（支持 tools 参数、流式）与 `embed()`

### 2. RAG 链路（rag/）
- 上传 → loader 提取纯文本 → 递归切分（chunk 500 字、重叠 50）→ embed → Chroma 入库（每个文档记录来源元数据）
- 检索：query 向量化 → top-k(4) 相似度检索 → 拼入 Prompt → LLM 生成，返回引用片段（文档名 + 原文片段）

### 3. Agent 执行器（agent/executor.py）—— 项目核心亮点
- 工具注册表（每个工具含 name / description / JSON schema / 执行函数）：
  - `knowledge_search(query)`：检索知识库，返回相关片段
  - `sql_query(sql)`：对内置 SQLite 业务库执行只读 SELECT，返回表格结果（自然语言 → SQL 由 LLM 完成，system prompt 中注入建表语句）
- 循环逻辑：LLM 非流式决策 → 若有 tool_calls 则执行并把结果追加进 messages → 再让 LLM 决策，直至无工具调用或达到最大轮数（5）→ 最后一轮改为流式输出最终回答
- 每次工具调用通过 SSE 向前端推送事件（工具名、参数、结果摘要），前端渲染成可折叠的「工具调用卡片」，直观展示 Agent 推理过程

### 4. 会话存储（storage.py）
- JSON 文件按 session 存消息记录，支持新建会话、历史列表、加载历史
- 不上数据库，保持轻量

### 5. 前端（React + TS + antd 5）
- **Chat 页**：左侧会话列表（新建/切换），右侧消息流；用户提问后流式渲染回答（markdown + 代码高亮），工具调用卡片展示 Agent 过程，RAG 引用来源以折叠面板附在回答末尾
- **Knowledge 页**：Upload.Dragger 拖拽上传、文档表格（名称/切片数/上传时间/删除操作）
- 白色背景 + 浅蓝主题（antd token 定制），组件不使用内联样式（统一 CSS Modules / less）
- Vite proxy 转发 `/api` 到 8000 端口

### 6. 示例业务数据（db/seed.py）
- 首次启动自动生成 SQLite 库：products / customers / orders 三张表 + 数百条随机订单数据
- 支撑「今年一季度销售额最高的商品是什么」这类数据分析提问

## 实施步骤

1. 后端骨架：requirements、config、main、LLM client
2. RAG 链路：loader / splitter / vectorstore / pipeline + 知识库 API
3. 业务库 seed + SQL 工具 + 知识库检索工具
4. Agent 执行器 + SSE 聊天接口 + 会话存储
5. 前端脚手架（Vite + TS + antd 5）+ Chat 页（SSE、工具卡片、引用展示）
6. Knowledge 管理页
7. 联调验证（见下）

## 验证方式

1. 启动后端 `uvicorn app.main:app --reload`（server 目录），自动生成业务库
2. 启动前端 `npm run dev`（web 目录），访问 5173 端口
3. 知识库页上传一份 md/txt 文档 → 表格出现记录与切片数
4. Chat 页验证三类问题：
   - 纯知识库问答：答案正确且底部展示引用来源片段
   - 数据分析：「查询销售额 top 3 的商品」→ 展示 sql_query 工具调用卡片 + 正确结果
   - 混合/闲聊：Agent 不滥用工具，正常回答
5. 会话可刷新后恢复历史

## 需要用户准备

- `DEEPSEEK_API_KEY`（platform.deepseek.com 申请）
- `EMBEDDING_API_KEY`（硅基流动 cloud.siliconflow.cn 申请，bge-m3 免费；也可换成任意 OpenAI 兼容 embedding 服务）
- 本机 Python 3.10+、Node 18+

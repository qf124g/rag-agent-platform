// 与后端约定的数据类型

export interface Session {
  session_id: string;
  title: string;
  created_at: string;
}

export interface ToolCall {
  name: string;
  arguments: string;
  result: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: ToolCall[];
}

export interface SessionDetail extends Session {
  messages: Message[];
}

export interface DocumentInfo {
  doc_id: string;
  doc_name: string;
  chunk_count: number;
}

// SSE 事件类型
export type ChatEvent =
  | { type: 'tool_call'; name: string; arguments: string; result: string }
  | { type: 'delta'; content: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

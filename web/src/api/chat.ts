import type { ChatEvent } from '../types';

/**
 * 发起 SSE 流式聊天请求，逐事件回调。
 * EventSource 不支持 POST，因此用 fetch + ReadableStream 手动解析 SSE 协议。
 */
export async function streamChat(
  sessionId: string,
  message: string,
  onEvent: (event: ChatEvent) => void,
): Promise<void> {
  const resp = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  if (!resp.ok || !resp.body) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.detail || `请求失败 (${resp.status})`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE 事件以空行分隔，逐条解析 data: 前缀的 JSON
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.trim();
      if (line.startsWith('data: ')) {
        onEvent(JSON.parse(line.slice(6)) as ChatEvent);
      }
    }
  }
}

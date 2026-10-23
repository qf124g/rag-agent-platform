import type { DocumentInfo, Session, SessionDetail } from '../types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(url, init);
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.detail || `请求失败 (${resp.status})`);
  }
  return resp.json();
}

// 会话
export const createSession = () => request<Session>('/api/sessions', { method: 'POST' });

export const listSessions = () => request<Session[]>('/api/sessions');

export const getSession = (id: string) => request<SessionDetail>(`/api/sessions/${id}`);

export const deleteSession = (id: string) =>
  request<{ ok: boolean }>(`/api/sessions/${id}`, { method: 'DELETE' });

// 知识库
export const listDocuments = () => request<DocumentInfo[]>('/api/knowledge/documents');

export const deleteDocument = (id: string) =>
  request<{ ok: boolean }>(`/api/knowledge/documents/${id}`, { method: 'DELETE' });

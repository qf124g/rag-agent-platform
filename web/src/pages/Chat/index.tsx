import { SendOutlined } from '@ant-design/icons';
import { Button, Empty, Input, message as antdMessage } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { streamChat } from '../../api/chat';
import { createSession, deleteSession, getSession, listSessions } from '../../api/client';
import type { Message, Session } from '../../types';
import MessageItem from './MessageItem';
import SessionList from './SessionList';
import styles from './Chat.module.css';

// 示例问题，帮助用户快速体验两类核心能力
const EXAMPLE_QUESTIONS = [
  '公司的报销制度是什么？',
  '销售额最高的前 3 个商品是什么？',
  '各城市的客户数量分布如何？',
];

export default function ChatPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // 初始化：加载会话列表，没有则自动创建一个
  useEffect(() => {
    void (async () => {
      let list = await listSessions();
      if (list.length === 0) {
        const created = await createSession();
        list = [created];
      }
      setSessions(list);
      setActiveId(list[0].session_id);
    })();
  }, []);

  // 切换会话时加载历史消息
  useEffect(() => {
    if (!activeId) return;
    void getSession(activeId).then((detail) => setMessages(detail.messages));
  }, [activeId]);

  // 消息变化时滚动到底部
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const handleCreate = async () => {
    const created = await createSession();
    setSessions((prev) => [created, ...prev]);
    setActiveId(created.session_id);
  };

  const handleDelete = async (id: string) => {
    await deleteSession(id);
    const remaining = sessions.filter((s) => s.session_id !== id);
    setSessions(remaining);
    if (id === activeId) {
      if (remaining.length > 0) {
        setActiveId(remaining[0].session_id);
      } else {
        // 删光了则重建一个空会话
        const created = await createSession();
        setSessions([created]);
        setActiveId(created.session_id);
      }
    }
  };

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || !activeId || streaming) return;
    setInput('');
    setStreaming(true);

    // 先上屏用户消息和一条占位的助手消息
    setMessages((prev) => [
      ...prev,
      { role: 'user', content },
      { role: 'assistant', content: '', tool_calls: [] },
    ]);

    try {
      await streamChat(activeId, content, (event) => {
        if (event.type === 'tool_call') {
          const { type: _, ...call } = event;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, tool_calls: [...(last.tool_calls ?? []), call] };
            return next;
          });
        } else if (event.type === 'delta') {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: last.content + event.content };
            return next;
          });
        } else if (event.type === 'error') {
          antdMessage.error(`回答出错：${event.message}`);
        } else if (event.type === 'done') {
          // 首条消息会更新会话标题，刷新列表
          void listSessions().then(setSessions);
        }
      });
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : '请求失败');
      // 请求失败时移除占位消息
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className={styles.page}>
      <SessionList
        sessions={sessions}
        activeId={activeId}
        onSelect={setActiveId}
        onCreate={handleCreate}
        onDelete={handleDelete}
      />
      <div className={styles.chatArea}>
        <div className={styles.messageList} ref={listRef}>
          {messages.length === 0 ? (
            <div className={styles.welcome}>
              <Empty description="开始提问吧，我可以检索知识库或查询业务数据" />
              <div className={styles.examples}>
                {EXAMPLE_QUESTIONS.map((q) => (
                  <Button key={q} size="small" onClick={() => void handleSend(q)}>
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <MessageItem key={i} message={m} streaming={streaming && i === messages.length - 1} />
            ))
          )}
        </div>
        <div className={styles.inputArea}>
          <Input.TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入问题，Enter 发送，Shift+Enter 换行"
            autoSize={{ minRows: 1, maxRows: 6 }}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={streaming}
            onClick={() => void handleSend()}
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  );
}

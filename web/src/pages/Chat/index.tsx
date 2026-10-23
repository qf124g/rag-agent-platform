import { ArrowDownOutlined, SendOutlined } from '@ant-design/icons';
import { Button, Empty, Input, message as antdMessage } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { streamChat } from '../../api/chat';
import { createSession, deleteSession, getSession, listSessions } from '../../api/client';
import type { Message, Session, ToolCall } from '../../types';
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
  const [showJump, setShowJump] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  // 是否贴底跟随：用户上翻阅读时不打扰，回到底部才恢复跟随
  const stickToBottom = useRef(true);

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

  // 切换会话时加载历史消息，并恢复贴底跟随
  useEffect(() => {
    if (!activeId) return;
    stickToBottom.current = true;
    setShowJump(false);
    void getSession(activeId).then((detail) => setMessages(detail.messages));
  }, [activeId]);

  // 消息变化时：贴底则跟随最新内容；用户上翻中则不打扰，提示有新内容
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (stickToBottom.current) {
      el.scrollTo({ top: el.scrollHeight });
    } else {
      setShowJump(true);
    }
  }, [messages]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (stickToBottom.current) setShowJump(false);
  };

  const jumpToLatest = () => {
    stickToBottom.current = true;
    setShowJump(false);
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  };

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

  // 流式渲染缓冲：SSE 逐 token 到达，先攒入缓冲区，每帧批量提交一次，
  // 避免每个 token 都触发全量重渲染 + Markdown 重解析。
  // RAF 在后台标签页或 headless 环境可能不触发，故同时挂 100ms 定时器兜底，先触发者生效。
  const streamBuf = useRef<{ deltas: string[]; toolCalls: ToolCall[] }>({ deltas: [], toolCalls: [] });
  const rafId = useRef<number | null>(null);
  const timerId = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelScheduled = () => {
    if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    if (timerId.current !== null) clearTimeout(timerId.current);
    rafId.current = null;
    timerId.current = null;
  };

  const flushStream = () => {
    cancelScheduled();
    const { deltas, toolCalls } = streamBuf.current;
    if (deltas.length === 0 && toolCalls.length === 0) return;
    streamBuf.current = { deltas: [], toolCalls: [] };
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      next[next.length - 1] = {
        ...last,
        content: last.content + deltas.join(''),
        tool_calls: [...(last.tool_calls ?? []), ...toolCalls],
      };
      return next;
    });
  };

  const scheduleFlush = () => {
    if (rafId.current !== null || timerId.current !== null) return;
    rafId.current = requestAnimationFrame(flushStream);
    timerId.current = setTimeout(flushStream, 100);
  };

  // 组件卸载时取消未执行的调度
  useEffect(() => cancelScheduled, []);

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || !activeId || streaming) return;
    setInput('');
    setStreaming(true);
    streamBuf.current = { deltas: [], toolCalls: [] };
    // 用户主动发送消息，恢复贴底跟随
    stickToBottom.current = true;
    setShowJump(false);

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
          streamBuf.current.toolCalls.push(call);
          scheduleFlush();
        } else if (event.type === 'delta') {
          streamBuf.current.deltas.push(event.content);
          scheduleFlush();
        } else if (event.type === 'error') {
          antdMessage.error(`回答出错：${event.message}`);
        } else if (event.type === 'done') {
          // 流结束：取消挂起的调度并立即冲刷剩余缓冲，保证内容完整
          flushStream();
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
        <div className={styles.messageList} ref={listRef} onScroll={handleScroll}>
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
        {/* 用户上翻阅读时有新内容到达，显示快捷回到底部按钮 */}
        {showJump && (
          <Button
            className={styles.jumpLatest}
            shape="round"
            size="small"
            icon={<ArrowDownOutlined />}
            onClick={jumpToLatest}
          >
            查看最新内容
          </Button>
        )}
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

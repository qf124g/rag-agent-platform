import { RobotOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar } from 'antd';
import type { Message } from '../../types';
import Markdown from './Markdown';
import ToolCallCard from './ToolCallCard';
import styles from './MessageItem.module.css';

interface Props {
  message: Message;
  streaming?: boolean;
}

export default function MessageItem({ message, streaming }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`${styles.row} ${isUser ? styles.rowUser : ''}`}>
      <Avatar
        icon={isUser ? <UserOutlined /> : <RobotOutlined />}
        className={isUser ? styles.avatarUser : styles.avatarBot}
      />
      <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleBot}`}>
        {/* Agent 工具调用过程展示在回答之前（过程先于最终结果发生） */}
        {message.tool_calls?.map((call, i) => (
          <ToolCallCard key={i} call={call} />
        ))}
        {isUser ? (
          <span className={styles.userText}>{message.content}</span>
        ) : (
          <Markdown content={message.content} streaming={streaming} />
        )}
      </div>
    </div>
  );
}

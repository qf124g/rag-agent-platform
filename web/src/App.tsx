import { MessageOutlined, DatabaseOutlined } from '@ant-design/icons';
import { Layout, Menu } from 'antd';
import { useState } from 'react';
import ChatPage from './pages/Chat';
import KnowledgePage from './pages/Knowledge';
import styles from './App.module.css';

const { Header, Content } = Layout;

const MENU_ITEMS = [
  { key: 'chat', icon: <MessageOutlined />, label: '智能问答' },
  { key: 'knowledge', icon: <DatabaseOutlined />, label: '知识库管理' },
];

export default function App() {
  const [page, setPage] = useState('chat');

  return (
    <Layout className={styles.layout}>
      <Header className={styles.header}>
        <div className={styles.logo}>RAG Agent 智能问答平台</div>
        <Menu
          theme="light"
          mode="horizontal"
          selectedKeys={[page]}
          items={MENU_ITEMS}
          onClick={(e) => setPage(e.key)}
          className={styles.menu}
        />
      </Header>
      <Content className={styles.content}>
        {page === 'chat' ? <ChatPage /> : <KnowledgePage />}
      </Content>
    </Layout>
  );
}

import { DatabaseOutlined, SearchOutlined } from '@ant-design/icons';
import { Collapse, Table, Tag } from 'antd';
import { useMemo } from 'react';
import type { ToolCall } from '../../types';
import styles from './ToolCallCard.module.css';

// 工具名到中文展示名的映射
const TOOL_META: Record<string, { label: string; icon: JSX.Element }> = {
  knowledge_search: { label: '知识库检索', icon: <SearchOutlined /> },
  sql_query: { label: '业务数据查询', icon: <DatabaseOutlined /> },
};

// 解析知识库检索结果中的引用片段
function parseSources(result: string): { doc_name: string; content: string }[] {
  try {
    const data = JSON.parse(result);
    return data.sources ?? [];
  } catch {
    return [];
  }
}

// 解析 SQL 查询结果（行记录数组）
function parseRows(result: string): Record<string, unknown>[] {
  try {
    const data = JSON.parse(result);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function ToolDetail({ call }: { call: ToolCall }) {
  const args = useMemo(() => {
    try {
      return JSON.parse(call.arguments);
    } catch {
      return {};
    }
  }, [call.arguments]);

  if (call.name === 'knowledge_search') {
    const sources = parseSources(call.result);
    return (
      <div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>检索词</span>
          <span>{args.query}</span>
        </div>
        {sources.map((s, i) => (
          <div key={i} className={styles.sourceItem}>
            <Tag color="blue">{s.doc_name}</Tag>
            <div className={styles.sourceContent}>{s.content}</div>
          </div>
        ))}
      </div>
    );
  }

  if (call.name === 'sql_query') {
    const rows = parseRows(call.result);
    const columns = rows.length > 0 ? Object.keys(rows[0]).map((k) => ({ title: k, dataIndex: k, key: k })) : [];
    return (
      <div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>SQL</span>
          <code className={styles.sqlCode}>{args.sql}</code>
        </div>
        {rows.length > 0 ? (
          <Table
            size="small"
            columns={columns}
            dataSource={rows.map((r, i) => ({ ...r, key: i }))}
            pagination={false}
            scroll={{ x: true }}
          />
        ) : (
          <div className={styles.emptyResult}>查询无结果</div>
        )}
      </div>
    );
  }

  return <pre className={styles.rawResult}>{call.result}</pre>;
}

export default function ToolCallCard({ call }: { call: ToolCall }) {
  const meta = TOOL_META[call.name] ?? { label: call.name, icon: <SearchOutlined /> };
  return (
    <div className={styles.card}>
      <Collapse
        ghost
        items={[
          {
            key: 'detail',
            label: (
              <span className={styles.cardTitle}>
                {meta.icon}
                <span>{meta.label}</span>
                <Tag color="processing">Agent 工具调用</Tag>
              </span>
            ),
            children: <ToolDetail call={call} />,
          },
        ]}
      />
    </div>
  );
}

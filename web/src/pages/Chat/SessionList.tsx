import { DeleteOutlined, PlusOutlined, RobotOutlined } from '@ant-design/icons';
import { Button, Empty, List, Popconfirm } from 'antd';
import type { Session } from '../../types';
import styles from './SessionList.module.css';

interface Props {
  sessions: Session[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

export default function SessionList({ sessions, activeId, onSelect, onCreate, onDelete }: Props) {
  return (
    <div className={styles.container}>
      <Button type="primary" block icon={<PlusOutlined />} onClick={onCreate} className={styles.createBtn}>
        新建对话
      </Button>
      {sessions.length === 0 ? (
        <Empty description="暂无会话" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          dataSource={sessions}
          renderItem={(s) => (
            <div
              className={`${styles.item} ${s.session_id === activeId ? styles.active : ''}`}
              onClick={() => onSelect(s.session_id)}
            >
              <RobotOutlined className={styles.itemIcon} />
              <span className={styles.itemTitle}>{s.title}</span>
              <Popconfirm title="删除该会话？" onConfirm={() => onDelete(s.session_id)}>
                <DeleteOutlined
                  className={styles.deleteIcon}
                  onClick={(e) => e.stopPropagation()}
                />
              </Popconfirm>
            </div>
          )}
        />
      )}
    </div>
  );
}

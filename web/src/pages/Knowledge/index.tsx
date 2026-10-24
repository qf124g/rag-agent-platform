import { DeleteOutlined, InboxOutlined, LoadingOutlined } from '@ant-design/icons';
import { Button, Card, message as antdMessage, Modal, Popconfirm, Progress, Result, Spin, Steps, Table, Upload } from 'antd';
import { useEffect, useState } from 'react';
import { deleteDocument, listDocuments } from '../../api/client';
import type { DocumentInfo } from '../../types';
import styles from './Knowledge.module.css';

const ACCEPT = '.txt,.md,.pdf';

// 不同文件类型各自的解析文案
const PARSE_TEXT: Record<string, string> = {
  '.txt': '纯文本提取：读取文字内容并清理空白字符',
  '.md': 'Markdown 解析：识别标题层级与段落结构',
  '.pdf': 'PDF 解析：逐页提取文字内容',
};

interface UploadTask {
  fileName: string;
  fileType: string;
  status: 'processing' | 'success' | 'error';
  stage: number; // 0 文档解析 1 文本切分 2 向量化入库
  embedDone: number; // 已向量化切片数（真实进度）
  embedTotal: number; // 切片总数
  chunkCount?: number;
  error?: string;
}

// 上传接口 SSE 事件
interface UploadEvent {
  type: 'stage' | 'progress' | 'done' | 'error';
  stage?: number;
  total?: number;
  done?: number;
  doc_name?: string;
  chunk_count?: number;
  message?: string;
}

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [task, setTask] = useState<UploadTask | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setDocuments(await listDocuments());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  // 消费上传接口的 SSE 事件流，驱动弹窗进度真实推进
  const consumeUploadStream = async (resp: Response) => {
    const reader = resp.body?.getReader();
    if (!reader) throw new Error('浏览器不支持流式读取');
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE 事件以空行分隔
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const block of events) {
        const line = block.trim();
        if (!line.startsWith('data: ')) continue;
        const event: UploadEvent = JSON.parse(line.slice(6));
        if (event.type === 'stage') {
          setTask((t) =>
            t ? { ...t, stage: event.stage ?? t.stage, embedTotal: event.total ?? t.embedTotal } : t,
          );
        } else if (event.type === 'progress') {
          setTask((t) =>
            t ? { ...t, embedDone: event.done ?? 0, embedTotal: event.total ?? t.embedTotal } : t,
          );
        } else if (event.type === 'done') {
          setTask((t) => (t ? { ...t, status: 'success', stage: 2, chunkCount: event.chunk_count } : t));
        } else if (event.type === 'error') {
          setTask((t) => (t ? { ...t, status: 'error', error: event.message } : t));
        }
      }
    }
  };

  const handleUpload = async (file: File) => {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    setTask({ fileName: file.name, fileType: ext, status: 'processing', stage: 0, embedDone: 0, embedTotal: 0 });

    try {
      const form = new FormData();
      form.append('file', file);
      const resp = await fetch('/api/knowledge/upload', { method: 'POST', body: form });
      if (!resp.ok) {
        // 请求未进入流式阶段（如格式校验失败），错误信息在 JSON body 中
        const body = await resp.json();
        throw new Error(body.detail || '上传失败');
      }
      await consumeUploadStream(resp);
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '上传失败';
      setTask((t) => (t ? { ...t, status: 'error', error: msg } : t));
    }
  };

  const closeModal = () => {
    if (task?.status !== 'processing') setTask(null);
  };

  const handleDelete = async (doc: DocumentInfo) => {
    await deleteDocument(doc.doc_id);
    antdMessage.success(`已删除「${doc.doc_name}」`);
    await refresh();
  };

  const processing = task?.status === 'processing';

  return (
    <div className={styles.page}>
      <Card title="上传文档" className={styles.card}>
        <Upload.Dragger
          accept={ACCEPT}
          showUploadList={false}
          disabled={processing}
          customRequest={({ file }) => void handleUpload(file as File)}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">支持 txt / md / pdf 格式，上传后自动切分并向量化入库</p>
        </Upload.Dragger>
      </Card>

      <Card title={`已入库文档（${documents.length}）`} className={styles.card}>
        <Table
          rowKey="doc_id"
          loading={loading}
          dataSource={documents}
          pagination={false}
          columns={[
            { title: '文档名称', dataIndex: 'doc_name' },
            { title: '切片数量', dataIndex: 'chunk_count', width: 120 },
            {
              title: '操作',
              width: 100,
              render: (_, doc) => (
                <Popconfirm title="删除后其向量数据将一并移除，确认？" onConfirm={() => void handleDelete(doc)}>
                  <Button danger size="small" icon={<DeleteOutlined />}>
                    删除
                  </Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      </Card>

      {/* 上传解析进度弹窗：处理中不可关闭，完成后方可点击关闭 */}
      <Modal
        title={processing ? `正在解析：${task?.fileName}` : task?.fileName}
        open={!!task}
        footer={
          processing ? null : (
            <Button type="primary" onClick={closeModal}>
              关闭
            </Button>
          )
        }
        closable={!processing}
        onCancel={closeModal}
        maskClosable={false}
        keyboard={false}
        width={440}
      >
        {task?.status === 'processing' && (
          <Steps
            direction="vertical"
            current={task.stage}
            items={[
              {
                title: PARSE_TEXT[task.fileType] ?? '文档解析',
                icon: task.stage === 0 ? <Spin indicator={<LoadingOutlined />} size="small" /> : undefined,
              },
              {
                title: '文本切分',
                description: '按语义切分为知识切片',
                icon: task.stage === 1 ? <Spin indicator={<LoadingOutlined />} size="small" /> : undefined,
              },
              {
                title: '向量化入库',
                description:
                  task.embedTotal > 0 ? (
                    <>
                      生成 Embedding 并写入向量库（{task.embedDone}/{task.embedTotal}）
                      <Progress
                        percent={Math.round((task.embedDone / task.embedTotal) * 100)}
                        size="small"
                        showInfo={false}
                      />
                    </>
                  ) : (
                    '生成 Embedding 并写入向量库'
                  ),
                icon: task.stage === 2 ? <Spin indicator={<LoadingOutlined />} size="small" /> : undefined,
              },
            ]}
          />
        )}
        {task?.status === 'success' && (
          <Result
            status="success"
            title="解析完成"
            subTitle={`「${task.fileName}」已入库，共生成 ${task.chunkCount} 个知识切片`}
          />
        )}
        {task?.status === 'error' && (
          <Result status="error" title="解析失败" subTitle={task.error} />
        )}
      </Modal>
    </div>
  );
}

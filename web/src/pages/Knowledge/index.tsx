import { DeleteOutlined, InboxOutlined } from '@ant-design/icons';
import { Card, message as antdMessage, Button, Popconfirm, Table, Upload } from 'antd';
import { useEffect, useState } from 'react';
import { deleteDocument, listDocuments } from '../../api/client';
import type { DocumentInfo } from '../../types';
import styles from './Knowledge.module.css';

const ACCEPT = '.txt,.md,.pdf';

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

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

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const resp = await fetch('/api/knowledge/upload', { method: 'POST', body: form });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.detail || '上传失败');
      antdMessage.success(`「${body.doc_name}」入库成功，共 ${body.chunk_count} 个切片`);
      await refresh();
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: DocumentInfo) => {
    await deleteDocument(doc.doc_id);
    antdMessage.success(`已删除「${doc.doc_name}」`);
    await refresh();
  };

  return (
    <div className={styles.page}>
      <Card title="上传文档" className={styles.card}>
        <Upload.Dragger
          accept={ACCEPT}
          showUploadList={false}
          disabled={uploading}
          customRequest={({ file }) => void handleUpload(file as File)}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持 txt / md / pdf 格式，上传后自动切分并向量化入库{uploading ? '，正在处理中...' : ''}
          </p>
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
    </div>
  );
}

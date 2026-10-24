import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import styles from './Markdown.module.css';

interface Props {
  content: string;
  streaming?: boolean;
}

export default function Markdown({ content, streaming }: Props) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={{
          // 表格外包一层可横向滚动的容器，列数多时在消息框内左右滑动查看
          table: ({ children }) => (
            <div className={styles.tableWrapper}>
              <table>{children}</table>
            </div>
          ),
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {streaming && <span className={styles.cursor}>▍</span>}
    </div>
  );
}

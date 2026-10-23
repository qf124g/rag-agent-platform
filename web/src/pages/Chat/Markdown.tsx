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

/**
 * 流式期间的表格生长处理：
 * 半截表格行（以 | 开头但行尾未闭合）先不渲染，避免显示残缺的管道符文本；
 * 等该行完整到达后自然追加进表格，视觉上表格逐行"生长"。
 */
function trimIncompleteTableRow(content: string): string {
  const lastNewline = content.lastIndexOf('\n');
  if (lastNewline === -1) return content;
  const lastLine = content.slice(lastNewline + 1).trimEnd();
  if (lastLine.startsWith('|') && !lastLine.endsWith('|')) {
    return content.slice(0, lastNewline);
  }
  return content;
}

export default function Markdown({ content, streaming }: Props) {
  const display = content;

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

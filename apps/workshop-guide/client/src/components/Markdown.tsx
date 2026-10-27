import ReactMarkdown, { type Components } from 'react-markdown';
import { CopyButton } from './CopyButton';

interface HastNode {
  type: string;
  value?: string;
  children?: HastNode[];
}

function hastText(node: HastNode | undefined): string {
  if (!node) return '';
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(hastText).join('');
}

const components: Components = {
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  pre: ({ children, node }) => (
    <div className="wg-codeblock group relative">
      <pre>{children}</pre>
      <CopyButton
        text={hastText(node as HastNode | undefined).replace(/\n$/, '')}
        className="absolute right-2 top-2 opacity-80 group-hover:opacity-100"
        compact
      />
    </div>
  ),
};

/** Guide text (explain, hints). Raw HTML is not rendered. */
export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`wg-md ${className}`}>
      <ReactMarkdown components={components}>{children}</ReactMarkdown>
    </div>
  );
}

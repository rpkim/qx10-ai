'use client';

import { useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

type Size = 'article' | 'compact';

function buildComponents(size: Size): Components {
  const compact = size === 'compact';
  return {
    h1: ({ children }) => (
      <h1
        className={cn(
          'mt-6 mb-3 font-bold text-foreground first:mt-0',
          compact ? 'text-base' : 'text-2xl'
        )}
      >
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2
        className={cn(
          'mt-6 mb-2 font-semibold text-foreground first:mt-0',
          compact ? 'text-sm' : 'text-xl'
        )}
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3
        className={cn(
          'mt-5 mb-2 font-semibold text-foreground first:mt-0',
          compact ? 'text-sm' : 'text-base'
        )}
      >
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="mt-4 mb-1.5 text-sm font-semibold text-foreground first:mt-0">{children}</h4>
    ),
    p: ({ children }) => (
      <p
        className={cn(
          'mb-3 leading-relaxed text-foreground/90 last:mb-0',
          compact ? 'text-xs' : 'text-sm'
        )}
      >
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul
        className={cn(
          'mb-3 ml-5 list-disc space-y-1 text-foreground/90 last:mb-0',
          compact ? 'text-xs' : 'text-sm'
        )}
      >
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol
        className={cn(
          'mb-3 ml-5 list-decimal space-y-1 text-foreground/90 last:mb-0',
          compact ? 'text-xs' : 'text-sm'
        )}
      >
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
    em: ({ children }) => <em className="italic text-foreground/80">{children}</em>,
    a: ({ children, href }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:opacity-80"
      >
        {children}
      </a>
    ),
    blockquote: ({ children }) => (
      <blockquote className="mb-3 border-l-2 border-primary/40 pl-3 text-sm italic text-muted-foreground last:mb-0">
        {children}
      </blockquote>
    ),
    code: ({ className, children }) => {
      const isBlock = /language-/.test(className ?? '');
      if (isBlock) {
        return (
          <code className="block overflow-x-auto rounded-lg border border-border bg-secondary/60 p-3 font-mono text-xs text-foreground/90">
            {children}
          </code>
        );
      }
      return (
        <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[0.85em] text-foreground">
          {children}
        </code>
      );
    },
    pre: ({ children }) => <pre className="mb-3 last:mb-0">{children}</pre>,
    hr: () => <hr className="my-5 border-border" />,
    table: ({ children }) => (
      <div className="mb-3 overflow-x-auto rounded-lg border border-border last:mb-0">
        <table className="w-full text-xs">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-secondary/50">{children}</thead>,
    th: ({ children }) => (
      <th className="border-b border-border px-2 py-1.5 text-left font-semibold text-muted-foreground">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border-b border-border px-2 py-1.5 text-foreground/85">{children}</td>
    ),
  };
}

interface Props {
  markdown: string;
  size?: Size;
  className?: string;
}

export function ArticleMarkdownView({ markdown, size = 'article', className }: Props) {
  const components = useMemo(() => buildComponents(size), [size]);
  return (
    <div className={cn('wrap-break-word', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

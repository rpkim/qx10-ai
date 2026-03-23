'use client';

import { useState } from 'react';
import type { AnswerNodeData } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace-store';

interface Props {
  node: AnswerNodeData;
}

export function AnswerNode({ node }: Props) {
  const { runQuery, addCustomQuery, toggleDashboardPin, state } = useWorkspace();
  const [showAllKeywords, setShowAllKeywords] = useState(false);
  const isPinned = state.dashboardNodeIds.includes(node.id);

  const displayText =
    node.status === 'streaming' && node.streamedChars !== undefined
      ? node.content.slice(0, node.streamedChars)
      : node.content;

  const isStreaming = node.status === 'streaming';

  // Format bold markdown
  const formattedText = displayText
    .split('\n\n')
    .map((para, i) => (
      <p key={i} className="mb-2 last:mb-0 text-sm leading-relaxed text-foreground/90">
        {formatBold(para)}
      </p>
    ));

  const visibleKeywords = showAllKeywords
    ? node.extractedKeywords
    : node.extractedKeywords.slice(0, 4);

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border p-4 transition-all duration-300"
      style={{
        borderColor: isPinned ? 'rgba(0,196,154,0.5)' : 'rgba(163,230,53,0.25)',
        background: 'rgba(163,230,53,0.03)',
        boxShadow: isPinned
          ? '0 0 20px rgba(0,196,154,0.15), 0 4px 16px rgba(0,0,0,0.35)'
          : '0 4px 16px rgba(0,0,0,0.35)',
        backdropFilter: 'blur(8px)',
        maxWidth: 340,
        minWidth: 300,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
            style={{ background: '#A3E635', color: '#080C12' }}
          >
            A
          </span>
          <span className="text-xs font-medium" style={{ color: '#A3E635' }}>
            {isStreaming ? 'Generating...' : 'Answer'}
          </span>
        </div>

        {/* Pin to dashboard */}
        {!isStreaming && (
          <button
            onClick={() => toggleDashboardPin(node.id)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors"
            style={
              isPinned
                ? { background: 'rgba(0,196,154,0.15)', color: '#00C49A' }
                : { color: 'var(--muted-foreground)' }
            }
            title={isPinned ? 'Remove from dashboard' : 'Pin to dashboard'}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill={isPinned ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {isPinned ? 'Pinned' : 'Pin'}
          </button>
        )}
      </div>

      {/* Answer content */}
      <div className="max-h-52 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
        {formattedText}
        {isStreaming && (
          <span
            className="inline-block h-3.5 w-0.5 align-middle"
            style={{ background: '#A3E635', animation: 'blink-cursor 0.8s step-end infinite' }}
          />
        )}
      </div>

      {/* Extracted keywords */}
      {!isStreaming && node.extractedKeywords.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Extracted concepts</span>
          <div className="flex flex-wrap gap-1.5">
            {visibleKeywords.map((kw) => (
              <button
                key={kw}
                onClick={() => addCustomQuery(`What is ${kw} in this context?`, node.id, node.position)}
                className="rounded-full border px-2.5 py-0.5 text-xs transition-all"
                style={{ borderColor: 'rgba(163,230,53,0.3)', color: '#A3E635' }}
                onMouseOver={(e) =>
                  Object.assign((e.currentTarget as HTMLElement).style, {
                    background: 'rgba(163,230,53,0.1)',
                  })
                }
                onMouseOut={(e) =>
                  Object.assign((e.currentTarget as HTMLElement).style, {
                    background: 'transparent',
                  })
                }
                title={`Explore: ${kw}`}
              >
                {kw}
              </button>
            ))}
            {node.extractedKeywords.length > 4 && (
              <button
                onClick={() => setShowAllKeywords(!showAllKeywords)}
                className="rounded-full px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAllKeywords ? 'less' : `+${node.extractedKeywords.length - 4} more`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Suggested follow-up queries */}
      {!isStreaming && node.suggestedQueries.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t pt-3" style={{ borderColor: 'rgba(163,230,53,0.15)' }}>
          <span className="text-xs text-muted-foreground">Follow-up queries</span>
          <div className="flex flex-col gap-1">
            {node.suggestedQueries.slice(0, 2).map((q) => (
              <button
                key={q}
                onClick={() => addCustomQuery(q, node.id, node.position)}
                className="flex items-center gap-2 rounded-xl p-2 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

function formatBold(text: string): React.ReactNode[] {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-foreground">
        {part}
      </strong>
    ) : (
      part
    )
  );
}

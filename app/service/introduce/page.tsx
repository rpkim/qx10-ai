'use client';

import { useEffect, useState } from 'react';
import { WorkspaceProvider, useWorkspace } from '@/lib/workspace-store';
import { Toolbar } from '@/components/workspace/toolbar';
import { Canvas } from '@/components/workspace/canvas';
import { MiniMap } from '@/components/workspace/minimap';
import { DashboardPanel } from '@/components/workspace/dashboard-panel';
import { MobileWorkspaceShell } from '@/components/workspace/mobile-workspace-shell';
import type { WorkspaceState } from '@/lib/types';

const DEMO_SNAPSHOT: WorkspaceState = {
  keyword: 'Large Language Models',
  goal: 'learn',
  nodes: [
    {
      id: 'root',
      type: 'root',
      keyword: 'Large Language Models',
      goal: 'learn',
      position: { x: 820, y: 60 },
      status: 'complete',
      width: 260,
      height: 80,
    },
    {
      id: 'q-demo-1',
      type: 'query',
      question:
        'What exactly defines a Large Language Model and how is it different from other AI models?',
      parentId: 'root',
      position: { x: 620, y: 300 },
      status: 'suggested',
      width: 280,
      height: 100,
      isCustom: true,
      toolChoice: 'auto',
    },
    {
      id: 'q-demo-2',
      type: 'query',
      question:
        'What are the most common real-world applications where LLMs are currently used?',
      parentId: 'root',
      position: { x: 980, y: 300 },
      status: 'suggested',
      width: 280,
      height: 100,
      isCustom: true,
      toolChoice: 'auto',
    },
    {
      id: 'q-demo-3',
      type: 'query',
      question:
        'What types of data are LLMs trained on, and why is that important for performance?',
      parentId: 'root',
      position: { x: 1340, y: 300 },
      status: 'suggested',
      width: 280,
      height: 100,
      isCustom: true,
      toolChoice: 'auto',
    },
  ],
  edges: [
    { id: 'e-root-q-demo-1', sourceId: 'root', targetId: 'q-demo-1' },
    { id: 'e-root-q-demo-2', sourceId: 'root', targetId: 'q-demo-2' },
    { id: 'e-root-q-demo-3', sourceId: 'root', targetId: 'q-demo-3' },
  ],
  viewport: { x: -320, y: 40, zoom: 0.72 },
  selectedNodeIds: [],
  dashboardNodeIds: [],
  collapsedNodeIds: [],
};

const DEMO_RESPONSES = {
  'What exactly defines a Large Language Model and how is it different from other AI models?': {
    content:
      'A **Large Language Model (LLM)** is a transformer-based model trained on massive text/code corpora with very large parameter counts. It differs from narrow AI models by being general-purpose for language tasks, showing broad transfer and emergent capabilities at scale.',
    extractedKeywords: ['LLM', 'Transformer', 'Scale', 'Emergent capabilities'],
    suggestedQueries: [
      'How does the Transformer architecture fundamentally work?',
      'What specific examples of emergent capabilities have LLMs demonstrated?',
    ],
    dataNode: {
      dataType: 'table',
      title: 'LLMs vs Other AI Models',
      tableColumns: ['Aspect', 'LLMs', 'Other AI Models'],
      tableRows: [
        {
          Aspect: 'Scale',
          LLMs: 'Billions+ params',
          'Other AI Models': 'Often smaller',
        },
        {
          Aspect: 'Scope',
          LLMs: 'General language tasks',
          'Other AI Models': 'Task-specific',
        },
        {
          Aspect: 'Architecture',
          LLMs: 'Transformer-first',
          'Other AI Models': 'CNN/RNN/etc.',
        },
      ],
    },
  },
  'What are the most common real-world applications where LLMs are currently used?': {
    content:
      'Common production uses include **content generation**, **customer support copilots**, **semantic search/summarization**, **coding assistants**, and **analytics copilots**.',
    extractedKeywords: [
      'content generation',
      'customer support',
      'coding assistants',
    ],
    suggestedQueries: [
      'Which use cases have the clearest ROI?',
      'What are common failure modes in production?',
    ],
    dataNode: {
      dataType: 'list',
      title: 'Common LLM Applications',
      listItems: [
        'Content generation',
        'Support agents and chatbots',
        'Search and summarization',
        'Code generation and review',
        'BI and reporting copilots',
      ],
    },
  },
  'What types of data are LLMs trained on, and why is that important for performance?': {
    content:
      'LLMs are trained on web text, books, code, and curated conversational data. **Data quality and diversity** directly affect factuality, robustness, and bias behavior.',
    extractedKeywords: ['training data', 'factuality', 'bias', 'data quality'],
    suggestedQueries: [
      'How does data quality affect hallucination rates?',
      'What data curation steps are most important?',
    ],
    dataNode: {
      dataType: 'list',
      title: 'Main Training Data Types',
      listItems: [
        'Web text',
        'Books and reference corpora',
        'Code repositories',
        'Dialog/instruction datasets',
      ],
    },
  },
};

const DEMO_ROOT_QUESTIONS = [
  'What exactly defines a Large Language Model and how is it different from other AI models?',
  'What are the most common real-world applications where LLMs are currently used?',
  'What types of data are LLMs trained on, and why is that important for performance?',
  'What are the key components of Large Language Models?',
  'How is QKV attention used inside LLMs?',
];

export default function ServiceIntroducePage() {
  return (
    <WorkspaceProvider demoResponses={DEMO_RESPONSES}>
      <IntroduceWorkspace />
    </WorkspaceProvider>
  );
}

function IntroduceWorkspace() {
  const { dispatch } = useWorkspace();
  const [ready, setReady] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboardExpanded, setDashboardExpanded] = useState(false);
  const [desktopViewMode, setDesktopViewMode] = useState<'canvas' | 'cards'>(
    'cards'
  );

  useEffect(() => {
    try {
      const key = `qx10.root.seed.v1:${DEMO_SNAPSHOT.keyword}::${DEMO_SNAPSHOT.goal}`;
      window.localStorage.setItem(
        key,
        JSON.stringify({ questions: DEMO_ROOT_QUESTIONS, status: 'ai' })
      );
    } catch {
      // ignore
    }
    dispatch({ type: 'LOAD_SNAPSHOT', snapshot: DEMO_SNAPSHOT });
    setReady(true);
  }, [dispatch]);

  if (!ready) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const canvasObscured = showDashboard && dashboardExpanded;

  return (
    <div
      id="workspace-export-all-target"
      className="relative h-screen w-screen overflow-hidden bg-background"
    >
      <Toolbar
        onToggleDashboard={() => {
          setShowDashboard((v) => {
            if (v) setDashboardExpanded(false);
            else setDashboardExpanded(true);
            return !v;
          });
        }}
        showDashboard={showDashboard}
        desktopViewMode={desktopViewMode}
        onDesktopViewModeChange={setDesktopViewMode}
      />

      {desktopViewMode === 'cards' ? (
        <MobileWorkspaceShell showDashboard={showDashboard} isMobile={false} />
      ) : (
        <div
          id="workspace-tree-export-target"
          className="absolute inset-0"
          style={{
            right: showDashboard && !dashboardExpanded ? '480px' : 0,
            opacity: canvasObscured ? 0 : 1,
            pointerEvents: canvasObscured ? 'none' : 'auto',
            transition: 'right 0.3s ease, opacity 0.25s ease',
          }}
        >
          <Canvas />
        </div>
      )}

      {!canvasObscured && desktopViewMode !== 'cards' && <MiniMap />}

      {desktopViewMode !== 'cards' && showDashboard && (
        <DashboardPanel
          onClose={() => {
            setShowDashboard(false);
            setDashboardExpanded(false);
          }}
          expanded={dashboardExpanded}
          onExpandedChange={setDashboardExpanded}
        />
      )}
    </div>
  );
}


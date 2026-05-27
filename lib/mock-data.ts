import type {
  WorkspaceNode,
  Edge,
  AnswerNodeData,
  DataNodeData,
} from './types';

/* ─────────────────────────────────────────────
   Suggested queries per keyword
───────────────────────────────────────────── */
export const SUGGESTED_QUERIES: Record<string, string[]> = {
  default: [
    'What is {keyword} and why does it matter?',
    'What are the key components of {keyword}?',
    'How do I get started with {keyword}?',
    'What are common challenges in {keyword}?',
    'What is the future of {keyword}?',
  ],
  'quant trading': [
    'What is quantitative trading?',
    'What factors drive quant trading strategies?',
    'What Python libraries are used in quant trading?',
    'How does backtesting work in quant trading?',
    'What are the main risks in quant trading?',
    'What are the best quant trading jobs in 2026?',
  ],
};

export function getSuggestedQueries(keyword: string): string[] {
  const key = keyword.toLowerCase();
  const queries = SUGGESTED_QUERIES[key] || SUGGESTED_QUERIES.default;
  return queries.map((q) => q.replace('{keyword}', keyword));
}

/* ─────────────────────────────────────────────
   Mock AI answer responses
───────────────────────────────────────────── */
export interface MockResponse {
  content: string;
  extractedKeywords: string[];
  suggestedQueries: string[];
  dataNodes?: Partial<DataNodeData>[];
}

export const MOCK_RESPONSES: Record<string, MockResponse> = {
  'what is quantitative trading?': {
    content:
      'Quantitative trading (quant trading) is a financial strategy that uses mathematical models, algorithms, and statistical analysis to identify and execute trading opportunities. Unlike discretionary trading which relies on human judgment, quant trading systematically processes vast datasets — price history, volume, macro indicators — to make decisions at machine speed.\n\nCore pillars: **Signal Generation** (finding alpha), **Risk Management** (position sizing, drawdown limits), and **Execution** (minimizing market impact).',
    extractedKeywords: [
      'Algorithm',
      'Signal',
      'Backtesting',
      'Alpha',
      'Risk',
      'Execution',
    ],
    suggestedQueries: [
      'What signals are used in quant strategies?',
      'How does algorithmic execution work?',
      'What is alpha generation?',
    ],
    dataNodes: [
      {
        dataType: 'table',
        title: 'Trading Approach Comparison',
        tableColumns: ['Approach', 'Speed', 'Scalability', 'Emotion-Free'],
        tableRows: [
          { Approach: 'Quant Trading', Speed: 'Milliseconds', Scalability: 'Very High', 'Emotion-Free': 'Yes' },
          { Approach: 'Discretionary', Speed: 'Seconds–Minutes', Scalability: 'Limited', 'Emotion-Free': 'No' },
          { Approach: 'HFT', Speed: 'Microseconds', Scalability: 'Extreme', 'Emotion-Free': 'Yes' },
        ],
      },
    ],
  },
  'what factors drive quant trading strategies?': {
    content:
      'Quantitative strategies are driven by multiple market factors that exhibit persistent statistical properties:\n\n**Momentum** — assets that outperform continue to do so short-term. **Mean Reversion** — prices oscillate around a mean. **Value** — undervalued assets outperform over time. **Volatility** — vol regimes change the risk landscape. **Liquidity** — bid-ask spreads and market depth affect execution cost.',
    extractedKeywords: [
      'Momentum',
      'Mean Reversion',
      'Volatility',
      'Liquidity',
      'Value',
      'Macro',
    ],
    suggestedQueries: [
      'How to build a momentum strategy?',
      'What is mean reversion trading?',
      'How does volatility affect quant returns?',
    ],
    dataNodes: [
      {
        dataType: 'bar-chart',
        title: 'Factor Performance (2023–2025)',
        chartData: [
          { label: 'Momentum', value: 18.4 },
          { label: 'Value', value: 12.1 },
          { label: 'Mean Rev.', value: 9.7 },
          { label: 'Volatility', value: 14.3 },
          { label: 'Liquidity', value: 7.2 },
        ],
      },
    ],
  },
  'what python libraries are used in quant trading?': {
    content:
      'Python has become the dominant language in quantitative finance due to its rich ecosystem:\n\n**Data**: `pandas` (tabular data), `numpy` (numerical ops), `polars` (fast DataFrames). **Visualization**: `matplotlib`, `plotly`. **ML/Stats**: `scikit-learn`, `statsmodels`, `pytorch`. **Backtesting**: `backtrader`, `zipline`, `vectorbt`. **Market Data**: `yfinance`, `alpaca-py`, `ccxt` (crypto). **Risk**: `riskfolio-lib`, `PyPortfolioOpt`.',
    extractedKeywords: [
      'pandas',
      'numpy',
      'backtrader',
      'scikit-learn',
      'yfinance',
      'vectorbt',
    ],
    suggestedQueries: [
      'How to fetch live market data with Python?',
      'How to backtest a strategy with vectorbt?',
      'What is portfolio optimization with PyPortfolioOpt?',
    ],
    dataNodes: [
      {
        dataType: 'list',
        title: 'Essential Python Stack',
        listItems: [
          'pandas — data manipulation & time series',
          'numpy — fast numerical computation',
          'vectorbt — high-performance backtesting',
          'scikit-learn — ML models & feature engineering',
          'yfinance — free market data API',
          'PyPortfolioOpt — portfolio optimization',
          'plotly — interactive charts & dashboards',
        ],
      },
    ],
  },
  'how does backtesting work in quant trading?': {
    content:
      'Backtesting simulates a trading strategy against historical data to evaluate its performance before deploying real capital. The process: (1) Define entry/exit rules and universe, (2) Feed historical OHLCV data, (3) Simulate fills with realistic slippage & commissions, (4) Compute metrics: Sharpe ratio, max drawdown, CAGR, win rate.\n\n**Critical pitfalls**: look-ahead bias (using future data), overfitting (curve-fitting to history), survivorship bias (only using stocks that survived).',
    extractedKeywords: [
      'Sharpe Ratio',
      'Drawdown',
      'Slippage',
      'CAGR',
      'Look-ahead Bias',
      'Overfitting',
    ],
    suggestedQueries: [
      'What is Sharpe ratio?',
      'How to avoid overfitting in backtesting?',
      'What is walk-forward optimization?',
    ],
    dataNodes: [
      {
        dataType: 'line-chart',
        title: 'Backtest Equity Curve (Momentum Strategy)',
        chartData: [
          { label: 'Jan', value: 100000, value2: 98000 },
          { label: 'Mar', value: 108000, value2: 101000 },
          { label: 'May', value: 115000, value2: 103000 },
          { label: 'Jul', value: 112000, value2: 105000 },
          { label: 'Sep', value: 124000, value2: 107000 },
          { label: 'Nov', value: 138000, value2: 110000 },
          { label: 'Dec', value: 145000, value2: 112000 },
        ],
      },
    ],
  },
  'what are the main risks in quant trading?': {
    content:
      'Quantitative trading carries unique and amplified risks:\n\n**Model Risk** — the model is wrong or the market regime changes. **Execution Risk** — slippage, latency, and partial fills erode alpha. **Overfitting Risk** — strategy works in backtest but fails live. **Liquidity Risk** — inability to exit positions during market stress. **Tail Risk** — black-swan events (e.g., 2020 COVID crash) that no model anticipated. **Regulatory Risk** — changing rules around HFT and market microstructure.',
    extractedKeywords: [
      'Model Risk',
      'Slippage',
      'Overfitting',
      'Tail Risk',
      'Black Swan',
      'Liquidity',
    ],
    suggestedQueries: [
      'How to hedge model risk in quant strategies?',
      'What is a black swan event?',
      'How to manage drawdown limits?',
    ],
    dataNodes: [
      {
        dataType: 'metric',
        title: 'Key Risk Metrics',
        metrics: [
          { label: 'Max Drawdown', value: '-18.4%', change: 'Threshold: -20%', up: false },
          { label: 'Sharpe Ratio', value: '1.82', change: '+0.3 vs benchmark', up: true },
          { label: 'VaR (95%)', value: '$4,200', change: 'Daily', up: false },
          { label: 'Win Rate', value: '54.3%', change: '+2.1% vs last month', up: true },
        ],
      },
    ],
  },
};

export function getMockResponse(question: string): MockResponse {
  const key = question.toLowerCase().trim();
  return (
    MOCK_RESPONSES[key] || {
      content: `Great question about "${question}". Based on current knowledge and market research, this topic involves several interconnected concepts worth exploring in depth. The key insight is that understanding this requires examining it from multiple perspectives — theoretical foundations, practical applications, and real-world constraints.\n\nUse the suggested follow-up queries to go deeper on the most relevant aspects.`,
      extractedKeywords: ['Concept', 'Framework', 'Strategy', 'Analysis', 'Context'],
      suggestedQueries: [
        `What are the key principles behind this?`,
        `How is this applied in practice?`,
        `What are the common challenges?`,
      ],
    }
  );
}

/* ─────────────────────────────────────────────
   Initial workspace nodes for "Quant Trading"
───────────────────────────────────────────── */
/** Root only — starter queries are loaded via AI (see SET_SEED_QUERIES) or API fallback. */
export function buildInitialWorkspace(
  keyword: string,
  goal: string,
  context?: string
): { nodes: WorkspaceNode[]; edges: Edge[] } {
  const nodes: WorkspaceNode[] = [
    {
      id: 'root',
      type: 'root',
      keyword,
      goal: goal as any,
      context: context || undefined,
      position: { x: 620, y: 80 },
      status: 'complete',
      width: 260,
      height: 80,
    },
  ];

  return { nodes, edges: [] };
}

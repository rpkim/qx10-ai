import type { GoalType } from './types';

type SearchLike = {
  get: (key: string) => string | null;
};

const VALID_GOALS: GoalType[] = ['learn', 'research', 'build', 'analyze', 'strategize'];

function normalizeGoal(raw: string | null): GoalType {
  const v = (raw ?? '').toLowerCase().trim();
  if ((VALID_GOALS as string[]).includes(v)) return v as GoalType;
  if (v === 'strategy') return 'strategize';
  return 'learn';
}

/** Accepts aliases so external services can deep-link easily. */
export function readWorkspaceLaunch(search: SearchLike): {
  keyword: string;
  goal: GoalType;
} | null {
  const keyword =
    search.get('keyword') ??
    search.get('k') ??
    search.get('q') ??
    search.get('topic') ??
    search.get('query');
  const kw = (keyword ?? '').trim();
  if (!kw) return null;

  const goal = normalizeGoal(search.get('goal') ?? search.get('mode') ?? search.get('g'));
  return { keyword: kw, goal };
}


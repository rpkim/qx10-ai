import type { GoalType } from '@/lib/types';
import type { MessageKey } from './messages/types';

export const GOAL_LABEL_KEYS: Record<GoalType, MessageKey> = {
  learn: 'goals.learn',
  research: 'goals.research',
  build: 'goals.build',
  analyze: 'goals.analyze',
  strategize: 'goals.strategize',
};

export const GOAL_DESC_KEYS: Record<GoalType, MessageKey> = {
  learn: 'goals.desc.learn',
  research: 'goals.desc.research',
  build: 'goals.desc.build',
  analyze: 'goals.desc.analyze',
  strategize: 'goals.desc.strategize',
};

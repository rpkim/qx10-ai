import type { Locale } from '@/lib/i18n/constants';
import type { IntroLocalePatch } from '@/lib/demo/apply-intro-locale-patch';
import koIntroContentNodes from '@/lib/demo/intro-locale-ko-nodes.json';

/** Korean UI strings for the service introduce demo snapshot (same graph as EN). */
const koIntroPatch: IntroLocalePatch = {
  keyword: '대규모 언어 모델',
  nodes: {
    root: { keyword: '대규모 언어 모델' },
    'q-custom-1774628253903': {
      question:
        '대규모 언어 모델(LLM)은 정확히 무엇을 의미하며, 다른 AI 모델과 어떻게 다른가요?',
    },
    'q-custom-1774628275054': {
      question: 'Transformer 아키텍처는 근본적으로 어떻게 동작하나요?',
    },
    'q-custom-1774628291934': {
      question: 'LLM이 보여 준 창발적 능력의 구체적인 예는 무엇인가요?',
    },
    'q-custom-1774628312786': {
      question: '사용되는 위치 인코딩의 종류는 무엇인가요?',
    },
    'q-custom-1774628340570': {
      question: 'Query, Key, Value 벡터는 구체적으로 어떻게 계산되나요?',
    },
    'q-custom-1774628361601': {
      question: '사인형 위치 인코딩의 수학적 직관은 무엇인가요?',
    },
    'q-custom-1774628367568': {
      question: '대규모 언어 모델이 현재 가장 많이 쓰이는 실제 응용은 무엇인가요?',
    },
    'q-custom-1774628384633': {
      question:
        'LLM은 어떤 종류의 데이터로 학습되며, 그것이 성능에 왜 중요한가요?',
    },
    'q-custom-1774628420201': {
      question: '학습 데이터 품질은 LLM의 사실 정확도에 어떤 영향을 주나요?',
    },
    'q-custom-1774628430385': {
      question: 'Transformer에 쓰이는 위치 인코딩 방식에는 어떤 유형들이 있나요?',
    },
    'q-custom-1774628452202': {
      question: '절대·상대 위치 인코딩의 주요 차이는 무엇인가요?',
    },
    ...(koIntroContentNodes as Record<string, Record<string, unknown>>),
  },
};

export function getIntroLocalePatch(locale: Locale): IntroLocalePatch | undefined {
  if (locale === 'ko') return koIntroPatch;
  return undefined;
}

'use client';

import { useI18n } from '@/components/i18n-provider';

export function DemoWorkspaceGuide() {
  const { t } = useI18n();
  const tips = [
    t('introduce.demoWorkspaceTip1'),
    t('introduce.demoWorkspaceTip2'),
    t('introduce.demoWorkspaceTip3'),
  ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3 text-left">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">
        {t('introduce.demoWorkspaceGuideTitle')}
      </p>
      <ol className="flex flex-col gap-1.5">
        {tips.map((tip) => (
          <li key={tip} className="text-sm leading-relaxed text-slate-700 dark:text-muted-foreground">
            {tip}
          </li>
        ))}
      </ol>
    </div>
  );
}

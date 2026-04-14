import type { ReactNode } from 'react';

import { KrnameIntro } from './krname-intro';

export default function KrnameLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap"
        rel="stylesheet"
      />
      <div className="fixed inset-0 z-1 min-h-0 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] bg-[#f8f6ef]">
        <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 pb-16 pt-12 sm:px-8">
          <KrnameIntro />
          {children}
        </div>
      </div>
    </>
  );
}

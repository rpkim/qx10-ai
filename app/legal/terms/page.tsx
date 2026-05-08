import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service — Qx10.lol',
};

export const dynamic = 'force-static';

const TERMS_VERSION = 'v1.0';
const EFFECTIVE_DATE = 'May 7, 2026';

export default function TermsPage() {
  return (
    <main className="fixed inset-0 overflow-y-auto overscroll-y-contain bg-background [-webkit-overflow-scrolling:touch]">
      <article className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-10 pb-[max(6rem,env(safe-area-inset-bottom))]">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Home
        </Link>
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Terms of Service
          </h1>
          <div className="text-xs text-muted-foreground">
            Version {TERMS_VERSION} · Effective {EFFECTIVE_DATE}
          </div>
        </header>

        <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            By using Qx10.lol (&quot;the Service&quot;) you agree to these terms.
            If you do not agree, do not use the Service.
          </p>

          <h2 className="pt-2 text-base font-semibold text-foreground">1. Eligibility</h2>
          <p>
            You must be at least 16 years old to use the Service, and must
            otherwise meet your jurisdiction&apos;s minimum age for digital
            consent. The Service is provided on an as-is basis without
            warranties of any kind. California residents under 18 who use the
            Service may request removal of content they posted by emailing the
            address in Section 7.
          </p>

          <h2 className="pt-2 text-base font-semibold text-foreground">2. Acceptable use</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Do not submit content that is unlawful, harmful, or infringes on others&apos; rights.</li>
            <li>Do not attempt to bypass authentication, rate limits, or abuse upstream AI providers.</li>
            <li>Do not use the Service to generate disallowed content under the relevant AI provider&apos;s policy.</li>
          </ul>

          <h2 className="pt-2 text-base font-semibold text-foreground">3. AI-generated content</h2>
          <p>
            Outputs from large language models can be inaccurate. You are
            responsible for verifying any information before relying on it.
            You retain whatever rights apply to the prompts you submit; AI
            outputs are produced by a third-party model and may not be
            copyrightable.
          </p>

          <h2 className="pt-2 text-base font-semibold text-foreground">4. Privacy</h2>
          <p>
            Your use of the Service is also governed by our{' '}
            <Link href="/legal/privacy" className="font-medium text-primary underline-offset-2 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>

          <h2 className="pt-2 text-base font-semibold text-foreground">5. Termination</h2>
          <p>
            We may suspend or terminate access if these terms are violated or
            if continued operation would create undue risk. You may stop using
            the Service at any time.
          </p>

          <h2 className="pt-2 text-base font-semibold text-foreground">6. Changes</h2>
          <p>
            Material changes to these terms will be reflected in an incremented
            version number above. Continued use after a change constitutes
            acceptance.
          </p>

          <h2 className="pt-2 text-base font-semibold text-foreground">7. Contact</h2>
          <p>
            Questions:{' '}
            <a href="mailto:rpkim.jay@gmail.com" className="font-medium text-primary underline-offset-2 hover:underline">
              rpkim.jay@gmail.com
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
}

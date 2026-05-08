import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'Do Not Sell or Share My Personal Information — Qx10.lol',
};

export const dynamic = 'force-static';

export default function DoNotSellPage() {
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
            Do Not Sell or Share My Personal Information
          </h1>
          <div className="text-xs text-muted-foreground">
            California Consumer Privacy Act (CCPA) / California Privacy Rights
            Act (CPRA)
          </div>
        </header>

        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="space-y-2 text-sm leading-relaxed text-foreground">
              <p className="font-semibold">
                Qx10.lol does not sell or share your personal information.
              </p>
              <p className="text-muted-foreground">
                We have not sold or shared personal information for
                cross-context behavioral advertising in the preceding 12
                months, and we have no plans to do so. There is no sale or
                share for you to opt out of on this Service.
              </p>
            </div>
          </div>
        </div>

        <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <h2 className="pt-2 text-base font-semibold text-foreground">
            What this means in practice
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>We do not run third-party advertising on this Service.</li>
            <li>
              We do not embed advertising or behavioral-targeting cookies,
              pixels, or SDKs from advertising networks.
            </li>
            <li>
              The only third parties that receive personal information are the
              service providers strictly necessary to operate the Service
              (sign-in, AI, hosting, optional Drive backup), under written
              terms that prohibit further use. See the{' '}
              <Link
                href="/legal/privacy"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Privacy Policy
              </Link>{' '}
              for the full list.
            </li>
            <li>
              We honor the Global Privacy Control (GPC) browser signal as a
              valid opt-out request even though sale/sharing does not occur on
              this Service.
            </li>
          </ul>

          <h2 className="pt-2 text-base font-semibold text-foreground">
            Other California privacy rights
          </h2>
          <p>
            Even though there is no sale or share to opt out of, California
            residents have additional rights — including the right to know,
            delete, correct, and access their data. Those rights and the
            in-app tools to exercise them are described in detail in the{' '}
            <Link
              href="/legal/privacy"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Privacy Policy
            </Link>
            , Section 9.
          </p>

          <h2 className="pt-2 text-base font-semibold text-foreground">
            If our practices ever change
          </h2>
          <p>
            If we ever begin selling or sharing personal information as those
            terms are defined in California law, we will (a) update this page
            and the Privacy Policy, (b) increment the policy version number to
            re-prompt your consent at next sign-in, and (c) add an in-app
            opt-out toggle that complies with applicable Attorney General
            regulations.
          </p>

          <h2 className="pt-2 text-base font-semibold text-foreground">
            Contact
          </h2>
          <p>
            Questions:{' '}
            <a
              href="mailto:rpkim.jay@gmail.com"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              rpkim.jay@gmail.com
            </a>
            .
          </p>
        </section>

        <footer className="flex flex-wrap gap-3 pt-4 text-xs text-muted-foreground">
          <Link href="/legal/privacy" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <span aria-hidden>·</span>
          <Link href="/legal/terms" className="hover:text-foreground">
            Terms of Service
          </Link>
          <span aria-hidden>·</span>
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
        </footer>
      </article>
    </main>
  );
}

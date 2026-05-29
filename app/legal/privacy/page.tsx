import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy — Qx10.lol',
};

export const dynamic = 'force-static';

const PRIVACY_VERSION = 'v1.3';
const EFFECTIVE_DATE = 'May 29, 2026';

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>
          <div className="text-xs text-muted-foreground">
            Version {PRIVACY_VERSION} · Effective {EFFECTIVE_DATE}
          </div>
        </header>

        <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            Qx10.lol (&quot;the Service,&quot; &quot;we,&quot; &quot;us&quot;)
            is a discovery workspace. This policy explains what limited
            information we collect, why, and how it is handled.
          </p>
          <p>
            <strong className="text-foreground">Snapshot:</strong> we do{' '}
            <strong className="text-foreground">not</strong> sell or share your
            personal information for cross-context behavioral advertising. We
            do not use third-party advertising cookies. We honor the Global
            Privacy Control (GPC) browser signal.
          </p>

          <h2 className="pt-2 text-base font-semibold text-foreground">
            1. Information we collect
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="font-medium text-foreground">Account identity.</span>{' '}
              When you sign in with Google we receive your unique Google ID
              (sub), email address, display name, and profile picture URL. We
              do not receive your Google password.
            </li>
            <li>
              <span className="font-medium text-foreground">Usage events.</span>{' '}
              We record sign-in timestamps, the keywords you submit on the
              landing page, your chosen exploration goal (e.g. learn,
              research), and the timestamp of your privacy-policy consent.
            </li>
            <li>
              <span className="font-medium text-foreground">Workspace content.</span>{' '}
              When you are signed in, the questions, answers, notes, and layout
              you create are saved to our server (Supabase Postgres) and linked
              to your account. You may also have older workspaces stored only in
              this browser until you migrate them from Settings.
            </li>
            <li>
              <span className="font-medium text-foreground">Cookies.</span> We
              use first-party, http-only cookies to remember your sign-in
              session. We do not use third-party advertising cookies.
            </li>
            <li>
              <span className="font-medium text-foreground">Aggregated analytics.</span>{' '}
              Anonymous page-view metrics may be collected via Vercel Analytics
              and Google Analytics (if configured by the operator).
            </li>
          </ul>

          <h2 className="pt-2 text-base font-semibold text-foreground">
            2. How we use the information
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>To authenticate you and keep you signed in.</li>
            <li>
              To provide the AI-assisted exploration features you initiate
              (your prompts are sent to the configured AI provider — currently
              Google Gemini and/or OpenAI — only at the moment you press a
              button that triggers a request).
            </li>
            <li>
              To understand aggregate usage (how many people use the Service,
              what topics are popular) and to detect abuse.
            </li>
            <li>
              To respond to your requests (e.g. account deletion, data export).
            </li>
          </ul>

          <h2 className="pt-2 text-base font-semibold text-foreground">
            3. Sharing &mdash; we do not sell or share for advertising
          </h2>
          <p>
            We do <strong className="text-foreground">not</strong> sell your
            personal information, and we do not share it for cross-context
            behavioral advertising as those terms are defined in California law
            (Cal. Civ. Code &sect; 1798.140). We have not done so in the
            preceding 12 months.
          </p>
          <p>
            Limited information is processed only by infrastructure providers
            strictly necessary to operate the Service, acting as our service
            providers under written agreements that prohibit further use:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="font-medium text-foreground">Google.</span> For
              sign-in (OpenID Connect) only.
            </li>
            <li>
              <span className="font-medium text-foreground">AI providers.</span>{' '}
              The model you select for each query (Google Gemini and/or
              OpenAI) receives the prompt you submit at the moment of the
              request.
            </li>
            <li>
              <span className="font-medium text-foreground">Hosting.</span>{' '}
              Vercel (application hosting), Supabase (analytics and workspace
              storage when configured by the operator).
            </li>
            <li>
              <span className="font-medium text-foreground">Optional tools.</span>{' '}
              Tavily (web search) and ElevenLabs (voice), only if and when you
              invoke a feature that uses them.
            </li>
          </ul>

          <h2 className="pt-2 text-base font-semibold text-foreground">
            4. Retention
          </h2>
          <p>The following retention periods apply:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="font-medium text-foreground">User identity.</span>{' '}
              Kept for as long as your account exists. Deleted within 30 days
              of an account-deletion request.
            </li>
            <li>
              <span className="font-medium text-foreground">Sign-in / search / consent events.</span>{' '}
              Kept for up to 24 months for product analytics and abuse
              detection. Cascade-deleted within 30 days of an account-deletion
              request.
            </li>
            <li>
              <span className="font-medium text-foreground">Workspace content (server database).</span>{' '}
              Kept for as long as your account exists. Deleted within 30 days
              of an account-deletion request.
            </li>
            <li>
              <span className="font-medium text-foreground">Workspace content (browser only, legacy).</span>{' '}
              Lives in your browser only until migrated — retained until you
              clear site data or upload to the server database from Settings.
            </li>
          </ul>

          <h2 className="pt-2 text-base font-semibold text-foreground">
            5. Security
          </h2>
          <p>
            Session cookies are sealed with AES-256-GCM and marked HttpOnly,
            Secure, and SameSite=Lax. We never store Google passwords.
          </p>

          <h2 className="pt-2 text-base font-semibold text-foreground">
            6. Your choices
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>You can sign out at any time from the user menu.</li>
            <li>
              You can upload legacy browser-only workspaces to the server
              database from the Settings page.
            </li>
            <li>
              You can clear all locally-stored workspaces by clearing your
              browser&apos;s site data for this domain.
            </li>
            <li>
              You can download (
              <Link
                href="/settings"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Settings → Export my data
              </Link>
              ) or permanently delete your account at any time (
              <Link
                href="/settings"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Settings → Danger zone
              </Link>
              ).
            </li>
          </ul>

          <h2 className="pt-2 text-base font-semibold text-foreground">
            7. Account deletion
          </h2>
          <p>
            You can permanently delete your account at any time from{' '}
            <Link
              href="/settings"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Settings → Danger zone
            </Link>
            . This removes your user record, cascade-deletes all associated
            server-side events, and deletes all workspaces and preferences
            stored in the server database. Workspaces stored only locally in
            your browser are not affected — clear your browser&apos;s site data
            for this domain to remove those. Your Google account itself is
            untouched; you may
            additionally revoke this app&apos;s access at{' '}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              myaccount.google.com/permissions
            </a>
            . If you cannot use the in-app option, email{' '}
            <a
              href="mailto:rpkim.jay@gmail.com"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              rpkim.jay@gmail.com
            </a>{' '}
            from the address tied to your Google account; we will action the
            request within 30 days.
          </p>

          <h2 className="pt-2 text-base font-semibold text-foreground">
            8. Children
          </h2>
          <p>
            The Service is not directed to users under 16. We do not knowingly
            collect personal information from a child under 16, and we do not
            sell or share personal information of consumers under 16. If you
            believe a child has provided us with personal information, contact
            us and we will promptly delete the information.
          </p>

          <h2 className="pt-2 text-base font-semibold text-foreground">
            9. Your California privacy rights (CCPA / CPRA)
          </h2>
          <p>
            If you are a California resident, the California Consumer Privacy
            Act (CCPA), as amended by the California Privacy Rights Act
            (CPRA), grants you the rights below. We extend the same rights to
            all our users worldwide as a matter of policy.
          </p>

          <p className="pt-2 font-medium text-foreground">
            9a. Categories of personal information we collect
          </p>
          <p>
            In the past 12 months we have collected the following CCPA
            categories of personal information:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="font-medium text-foreground">Identifiers</span>{' '}
              (Cal. Civ. Code &sect; 1798.140(v)(1)(A)): Google subject id,
              email address, display name, profile picture URL, sealed cookie
              session id.
            </li>
            <li>
              <span className="font-medium text-foreground">Internet or other electronic network activity</span>{' '}
              (&sect; 1798.140(v)(1)(F)): timestamps of sign-in events, search
              keywords you submit on the landing page, the goal you select.
            </li>
            <li>
              <span className="font-medium text-foreground">User-generated content.</span>{' '}
              Workspace questions, answers, notes, and dashboard layouts you
              create while signed in.
            </li>
            <li>
              <span className="font-medium text-foreground">Inferences</span>{' '}
              (&sect; 1798.140(v)(1)(K)): aggregate counters (total sign-ins,
              total searches, last-seen timestamp) derived from the events
              above.
            </li>
          </ul>
          <p>
            We have <strong className="text-foreground">not</strong> collected
            information from the &quot;sensitive personal information&quot;
            categories defined in &sect; 1798.140(ae) (e.g. SSN, financial
            account credentials, precise geolocation, race/ethnicity,
            biometrics, etc.). Because no sensitive PI is collected, the
            optional &quot;Right to Limit Use of Sensitive Personal
            Information&quot; is not applicable to this Service.
          </p>

          <p className="pt-2 font-medium text-foreground">
            9b. Sources, purposes, and recipients
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="font-medium text-foreground">Sources:</span>{' '}
              directly from you (sign-in, keywords, workspace content) and
              Google (identity fields).
            </li>
            <li>
              <span className="font-medium text-foreground">Business purposes</span>{' '}
              (&sect; 1798.140(e)): authentication, persisting your workspaces,
              providing the AI features you initiate, security/abuse detection,
              debugging, product analytics in aggregate.
            </li>
            <li>
              <span className="font-medium text-foreground">Recipients:</span>{' '}
              the service providers listed in Section 3.
            </li>
          </ul>

          <p className="pt-2 font-medium text-foreground">
            9c. Your rights
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="font-medium text-foreground">Right to know.</span>{' '}
              You can obtain a copy of the personal information we hold about
              you, including categories, sources, purposes, and recipients,
              from{' '}
              <Link
                href="/settings"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Settings → Export my data
              </Link>
              .
            </li>
            <li>
              <span className="font-medium text-foreground">Right to delete.</span>{' '}
              You can permanently delete your account from{' '}
              <Link
                href="/settings"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Settings → Danger zone
              </Link>
              .
            </li>
            <li>
              <span className="font-medium text-foreground">Right to correct.</span>{' '}
              Your name and profile picture are mirrored from Google on each
              sign-in; updating them in your Google account propagates them
              here. To correct your email, sign in with the corrected Google
              account.
            </li>
            <li>
              <span className="font-medium text-foreground">Right to opt out of sale or sharing.</span>{' '}
              We do not sell or share personal information; there is nothing
              to opt out of. See our{' '}
              <Link
                href="/legal/do-not-sell"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Do Not Sell or Share My Personal Information
              </Link>{' '}
              page.
            </li>
            <li>
              <span className="font-medium text-foreground">Right to limit use of sensitive PI.</span>{' '}
              Not applicable — we do not collect sensitive PI.
            </li>
            <li>
              <span className="font-medium text-foreground">Right to non-discrimination.</span>{' '}
              We will not deny service, charge different prices, or provide a
              different level of quality because you exercised a privacy right.
            </li>
          </ul>

          <p className="pt-2 font-medium text-foreground">
            9d. How to submit a request
          </p>
          <p>
            Use the in-app tools above for the fastest path. If you cannot
            access them, email{' '}
            <a
              href="mailto:rpkim.jay@gmail.com"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              rpkim.jay@gmail.com
            </a>{' '}
            from the address associated with your account. We verify requests
            by matching the requesting email against the account&apos;s Google
            email. We respond within 45 days (extendable by an additional 45
            days with notice).
          </p>

          <p className="pt-2 font-medium text-foreground">
            9e. Authorized agents
          </p>
          <p>
            You may designate an authorized agent to submit requests on your
            behalf. The agent must email us at the address above with: (a)
            your written, signed permission to act on your behalf, and (b)
            sufficient information to verify your identity (we typically
            require you to confirm directly via email from your account
            address).
          </p>

          <p className="pt-2 font-medium text-foreground">
            9f. Global Privacy Control (GPC)
          </p>
          <p>
            We treat the GPC browser signal as a valid request to opt out of
            sale and sharing under California law. Because we do not sell or
            share, the practical effect of the signal on this Service is
            limited to a confirmation of our existing posture; we will not
            knowingly engage in sale or sharing while a GPC signal is present.
          </p>

          <h2 className="pt-2 text-base font-semibold text-foreground">
            10. Other US state privacy rights
          </h2>
          <p>
            Residents of states with comprehensive privacy laws (including
            without limitation Virginia, Colorado, Connecticut, Utah, Texas,
            Oregon, Montana, and others) have analogous rights to access,
            delete, correct, port, and opt out. To the extent applicable, we
            extend the same rights and processes described in Section 9 to
            residents of those states.
          </p>

          <h2 className="pt-2 text-base font-semibold text-foreground">
            11. Changes
          </h2>
          <p>
            If material changes are made to this policy, the version number
            above will be incremented and you will be re-prompted for consent
            on next sign-in.
          </p>

          <h2 className="pt-2 text-base font-semibold text-foreground">
            12. Contact
          </h2>
          <p>
            Questions or concerns:{' '}
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
          <Link href="/legal/terms" className="hover:text-foreground">
            Terms of Service
          </Link>
          <span aria-hidden>·</span>
          <Link href="/legal/do-not-sell" className="hover:text-foreground">
            Do Not Sell or Share My Personal Information
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

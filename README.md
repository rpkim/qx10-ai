# Qx10.lol — Question x10 Discovery

Explore any topic through infinite questioning. Qx10 turns a single keyword into a **living knowledge tree**: every AI answer suggests its next follow-up questions, you branch wherever curiosity takes you, pin the best findings to a live **dashboard**, and — when you're ready — turn the whole exploration into a written **article**.

Built with Next.js 16 (App Router), React 19, and TypeScript. Originally bootstrapped with [v0](https://v0.app).

## Core concepts

- **Root** — a keyword/topic plus an optional **context**: free-text hints and/or URLs, entered as chips. URLs are fetched server-side (SSRF-guarded fetch + [Readability](https://github.com/mozilla/readability) via [linkedom](https://github.com/WebReflection/linkedom)) and their content grounds both the seed questions and every later answer in that workspace.
- **Query → Answer** — asking a question streams an AI answer (OpenAI or Gemini), which in turn proposes 3–6 follow-up questions and may attach a **data node** (table / chart / list / metric) when a small visual helps.
- **Canvas** — an infinite, pannable/zoomable tree of nodes and edges, with a minimap, node search, branch collapsing, and multi-select drag. A dedicated mobile shell (list-style navigation) replaces the canvas on small screens.
- **Dashboard** — pin any answer or data node to a workspace-level dashboard that survives as you keep exploring.
- **Article Studio** — an AI editing agent turns pinned nodes and the conversation history into a structured, editable Markdown article (outline manager, live preview, autosave drafts).

## Feature highlights

- **Context grounding** — mix plain keywords and URLs in the context input (Tab/Enter to add chips). Each URL gets a cheap always-on summary plus full-text grounding when a specific question looks related to that page (keyword-overlap heuristic, no extra LLM call).
- **Multi-provider AI** — OpenAI and Gemini side by side; a model catalog (`/api/workspace/models`) drives the picker. Users can optionally **bring their own Gemini key** (BYOK), stored client-side.
- **Ancestor-aware follow-ups** — each new question includes the Q&A chain of its own branch (up to the last 10 pairs) as context, without pulling in sibling branches.
- **i18n** — English, Korean, Japanese, Spanish, and Simplified Chinese, with per-locale AI response language.
- **Auth & quotas** — Google Sign-In gated app, daily query quotas per tier (free / premium / admin), admin allowlist, and a signup cap with an email waitlist (Resend) for overflow.
- **Admin dashboard** (`/admin`) — usage overview, user list with tier management, waitlist invites, raw event feed.
- **Text-to-speech** — read answers aloud via the browser Web Speech API or ElevenLabs.
- **Export** — PDF/image export of the canvas and dashboard (`jspdf`, `pdf-lib`, `html2canvas`).
- **Pluggable persistence** — a small storage interface backs onto either local JSON files (zero-config local dev) or Supabase/Postgres (production), selected automatically by which environment variables are set.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| Styling | Tailwind CSS v4, Radix UI primitives, `lucide-react` |
| AI | `openai` SDK, `@google/generative-ai` (Gemini) |
| URL content extraction | `linkedom` + `@mozilla/readability` (SSRF-guarded fetch, in-memory cache) |
| Persistence | Supabase (Postgres) in production, local JSON file store for dev |
| Auth | Google OAuth 2.0, signed session cookie (`qx10_session`) |
| Charts / tables | `recharts` |
| Markdown | `react-markdown` + `remark-gfm` |
| Analytics | Vercel Analytics, Google Analytics |

## Project structure

```
app/
  page.tsx                # Landing page — start a workspace by keyword/context
  workspace/               # Canvas + dashboard + article studio shell
  admin/                    # Admin dashboard (usage, users, waitlist)
  api/                      # Route handlers (see below)
  legal/, login/, waitlist/, settings/, demo/, service/introduce/

components/
  nodes/                   # Canvas node renderers (root, query, answer, data)
  workspace/               # Canvas, toolbar, dashboard panel, article studio, mobile shell
  ui/                      # shadcn/Radix-based primitives

lib/
  ai/                       # Prompts, streaming, seed-question generation, URL context extraction
  server/                   # Storage backends (workspaces, waitlist, analytics, quota) — file vs Supabase
  auth/                     # Session + admin checks
  i18n/                     # Locale messages (en, ko, ja, es, zh)
  workspace-store.tsx        # Client-side canvas state (nodes/edges/viewport) via useReducer
  byok/                      # Client-side bring-your-own-key vault (Gemini)

db/
  schema.sql                # Base Supabase schema (analytics/users/events)
  *-migration.sql            # Incremental migrations (workspaces, waitlist, quota, article drafts)

scripts/
  apply-*-schema.mjs         # Apply a migration directly via DATABASE_URL
```

### Key API routes

| Route | Purpose |
| --- | --- |
| `POST /api/workspace/seed-queries` | Generate the initial questions for a new root (keyword + context) |
| `POST /api/workspace/query` | Stream an AI answer for a question (SSE) |
| `POST /api/workspace/extract-metadata` | Extract follow-up keywords/questions/data node from an answer |
| `GET /api/workspace/url-preview` | Lightweight title preview for a context URL chip |
| `GET /api/workspace/models` | AI model catalog available to the client |
| `POST /api/workspace/article` | Article Studio: generate/edit article content from a workspace |
| `GET/PUT /api/workspaces/[keyword]` | Load/save a workspace (Supabase or file store) |
| `GET/POST /api/auth/*` | Google OAuth login flow, session, account export/delete |
| `GET /api/admin/*` | Admin-only usage overview, users, waitlist (requires `ADMIN_EMAILS`) |

## Getting started

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) (the repo is developed and locked against pnpm)

### Install & run

```bash
pnpm install
pnpm dev
```

The dev server runs on **http://localhost:3002** (see `dev` script).

The whole app is gated behind Google Sign-In by default. For local development without setting up OAuth, add to `.env.local`:

```bash
AUTH_DISABLED=true
```

(Never set this in production.)

### Environment variables

Copy `.env.example` to `.env.local` and fill in what you need. It's grouped by concern and every optional block is commented out with sensible defaults documented inline:

- **AI providers** — `OPENAI_API_KEY` and/or `GEMINI_API_KEY` (at least one required for query/seed generation to work), plus optional model allowlists (`OPENAI_MODELS`, `GEMINI_MODELS`, `AI_MODEL_OPTIONS`) and daily quota knobs (`DAILY_QUERY_LIMIT`, `PREMIUM_DAILY_QUERY_LIMIT`).
- **Google Sign-In** — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL`, `QX10_AUTH_SECRET` (session/PII encryption). Required unless `AUTH_DISABLED=true`.
- **Admin** — `ADMIN_EMAILS` (comma-separated allowlist for `/admin`).
- **Persistence** — unset = local JSON files under `.qx10-data/` (fine for dev, not for serverless prod). For production, create a Supabase project, run `db/schema.sql` plus the `*-migration.sql` files, then set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` (or the legacy `SUPABASE_SERVICE_ROLE_KEY`).
- **Waitlist email** — `RESEND_API_KEY`, `EMAIL_FROM` (only needed if the signup cap is active and you want invite emails to send).
- **Text-to-speech** — defaults to the browser's built-in speech synthesis; set `TTS_PROVIDER=elevenlabs` + `ELEVENLABS_API_KEY` for higher-quality voices.

See `.env.example` for the full, authoritative list with descriptions.

### Database setup (production)

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run `db/schema.sql`, then each `db/*-migration.sql` file (or use the matching `pnpm db:apply-*` script against `DATABASE_URL`).
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` in your environment.

Without these, the app transparently falls back to a local JSON file store — convenient for development, but not suitable for serverless deployments with a read-only/ephemeral filesystem.

### Scripts

```bash
pnpm dev                     # Start dev server on :3002
pnpm build                   # Production build
pnpm start                   # Serve a production build
pnpm lint                    # ESLint
pnpm db:apply-workspaces     # Apply the workspaces migration via DATABASE_URL
pnpm db:apply-article-drafts # Apply the article-drafts migration
pnpm db:apply-waitlist       # Apply the waitlist migration
```

## Deployment

The app deploys cleanly to Vercel. One gotcha worth knowing if you touch `lib/ai/url-context.ts`: avoid `jsdom` there. Several of jsdom's transitive dependencies (parse5, html-encoding-sniffer, cssstyle's CSS color parser) have gone ESM-only, which breaks with `ERR_REQUIRE_ESM` on Vercel/Lambda since `require(esm)` is disabled there by default. The project intentionally uses `linkedom` instead — a much lighter, fully CommonJS-compatible DOM implementation that's plenty for feeding HTML into Readability.

## License

This project is **source-available, not open source.** See [`LICENSE`](./LICENSE): all rights reserved. You may look at the code; you may not copy, modify, redistribute, or run it as your own product or service without written permission.

## Built with v0

This repository is linked to a [v0](https://v0.app) project. Every merge to `main` auto-deploys.

[Continue working on v0 →](https://v0.app/chat/projects/prj_5XUUv8TKusws2bY9M3cyx4NszZeO)

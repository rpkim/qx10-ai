import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { ensureUserRecordForSession } from '@/lib/server/ensure-user-record';
import { getWorkspaceStore } from '@/lib/server/workspaces/store';
import {
  parseStoredArticleDraft,
  type StoredArticleDraft,
} from '@/lib/article-draft-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ keyword: string }> };

function decodeKeyword(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function GET(_req: Request, ctx: RouteContext) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const keyword = decodeKeyword((await ctx.params).keyword);
  if (!keyword.trim()) {
    return NextResponse.json({ error: 'no_keyword' }, { status: 400 });
  }
  try {
    const draft = await getWorkspaceStore().getArticleDraft(session.sub, keyword);
    return NextResponse.json({ draft });
  } catch (e) {
    console.error('[article-draft GET]', e);
    return NextResponse.json({ error: 'store_error' }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: RouteContext) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const keyword = decodeKeyword((await ctx.params).keyword);
  if (!keyword.trim()) {
    return NextResponse.json({ error: 'no_keyword' }, { status: 400 });
  }

  let body: { draft?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const draft = parseStoredArticleDraft(body.draft);
  if (!draft) {
    return NextResponse.json({ error: 'invalid_draft' }, { status: 400 });
  }

  // Cap payload size — body + messages can grow with long writing sessions.
  const bodyChars = draft.body.length;
  const messageChars = draft.messages.reduce((sum, m) => sum + m.content.length, 0);
  if (bodyChars + messageChars > 200_000) {
    return NextResponse.json({ error: 'draft_too_large' }, { status: 413 });
  }

  const normalized: StoredArticleDraft = {
    title: draft.title.slice(0, 300),
    subtitle: draft.subtitle.slice(0, 500),
    body: draft.body.slice(0, 120_000),
    messages: draft.messages.slice(-40).map((m) => ({
      id: m.id.slice(0, 80),
      role: m.role,
      content: m.content.slice(0, 40_000),
    })),
    updatedAt: draft.updatedAt || Date.now(),
  };

  try {
    await ensureUserRecordForSession(session);
    await getWorkspaceStore().saveArticleDraft(session.sub, keyword, normalized);
    return NextResponse.json({ ok: true, updatedAt: normalized.updatedAt });
  } catch (e) {
    console.error('[article-draft PUT]', e);
    return NextResponse.json({ error: 'store_error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const keyword = decodeKeyword((await ctx.params).keyword);
  if (!keyword.trim()) {
    return NextResponse.json({ error: 'no_keyword' }, { status: 400 });
  }
  try {
    await getWorkspaceStore().deleteArticleDraft(session.sub, keyword);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[article-draft DELETE]', e);
    return NextResponse.json({ error: 'store_error' }, { status: 500 });
  }
}

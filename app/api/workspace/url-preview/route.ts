import { fetchPageExcerpt } from '@/lib/ai/url-context';

export const runtime = 'nodejs';
export const maxDuration = 20;

/** Lightweight preview (title only) for a context URL chip; deep excerpt is fetched at seed-question time. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url')?.trim();
  if (!url) {
    return Response.json({ error: 'url is required' }, { status: 400 });
  }

  const result = await fetchPageExcerpt(url);
  if (!result) {
    return Response.json({ error: 'Could not fetch page' }, { status: 422 });
  }

  return Response.json({ title: result.title, url: result.url });
}

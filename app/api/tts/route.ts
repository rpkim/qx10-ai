import { NextResponse } from 'next/server';
import { getServerTtsProvider } from '@/lib/tts/config';
import { consumeTtsSession, createTtsSession } from '@/lib/tts/session-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function streamElevenLabs(text: string): Promise<Response> {
  const provider = getServerTtsProvider();
  if (provider !== 'elevenlabs') {
    return NextResponse.json({ error: 'provider_is_not_elevenlabs' }, { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || 'EXAVITQu4vr4xnSDxMaL';
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || 'eleven_multilingual_v2';

  if (!apiKey) {
    return NextResponse.json({ error: 'missing_elevenlabs_api_key' }, { status: 503 });
  }

  const clipped = text.slice(0, 1200);
  const streamUrl = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?optimize_streaming_latency=3`;
  const streamRes = await fetch(streamUrl, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      Accept: 'audio/mpeg',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: clipped,
      model_id: modelId,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!streamRes.ok) {
    // Fallback: some plans/models may reject streaming endpoint.
    const fallbackRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          Accept: 'audio/mpeg',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: clipped,
          model_id: modelId,
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!fallbackRes.ok) {
      const detail = await fallbackRes.text();
      return NextResponse.json({ error: 'tts_failed', detail: detail.slice(0, 500) }, { status: 502 });
    }
    return new Response(fallbackRes.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  }

  return new Response(streamRes.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(req: Request) {
  let body: { text?: unknown };
  try {
    body = (await req.json()) as { text?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) {
    return NextResponse.json({ error: 'text_required' }, { status: 400 });
  }
  const provider = getServerTtsProvider();
  if (provider !== 'elevenlabs') {
    return streamElevenLabs(text);
  }
  const sessionId = createTtsSession(text);
  return NextResponse.json({ streamUrl: `/api/tts?id=${encodeURIComponent(sessionId)}` });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = (url.searchParams.get('id') ?? '').trim();
  const textFromSession = sessionId ? consumeTtsSession(sessionId) : null;
  const text = (textFromSession ?? url.searchParams.get('text') ?? '').trim();
  if (!text) {
    return NextResponse.json({ error: 'text_required' }, { status: 400 });
  }
  return streamElevenLabs(text);
}


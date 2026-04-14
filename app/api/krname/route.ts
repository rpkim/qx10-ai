import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readGeminiApiKey } from '@/lib/ai/model-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function pickGeminiModel() {
  const raw = process.env.GEMINI_MODELS?.trim();
  if (!raw) return 'gemini-2.0-flash';
  return (
    raw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)[0] || 'gemini-2.0-flash'
  );
}

export async function POST(req: Request) {
  let body: { name?: unknown };
  try {
    body = (await req.json()) as { name?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 });
  }

  if (name.length > 120) {
    return NextResponse.json({ error: 'name_too_long' }, { status: 400 });
  }

  const apiKey = readGeminiApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: 'missing_gemini_api_key' }, { status: 503 });
  }

  const modelName = pickGeminiModel();
  const prompt = [
    'You are a Korean naming assistant for an elementary school International Day.',
    'Convert the input name into a natural Korean phonetic name written in Hangul.',
    'Rules:',
    '1) Keep pronunciation natural and friendly for Korean speakers.',
    '2) Preserve the original sound as much as possible.',
    '3) If the input includes English/Spanish/Chinese characters, infer pronunciation and convert accordingly.',
    '4) Return JSON only, with keys: koreanName, pronunciationGuide, reason.',
    '5) koreanName must contain only Hangul and spaces.',
    '',
    `Input name: "${name}"`,
  ].join('\n');

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: 'application/json' },
    });

    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    if (!raw) {
      return NextResponse.json({ error: 'empty_response' }, { status: 502 });
    }

    const parsed = JSON.parse(raw) as {
      koreanName?: unknown;
      pronunciationGuide?: unknown;
      reason?: unknown;
    };
    const koreanName =
      typeof parsed.koreanName === 'string' ? parsed.koreanName.trim() : '';
    const pronunciationGuide =
      typeof parsed.pronunciationGuide === 'string' ? parsed.pronunciationGuide.trim() : '';
    const reason = typeof parsed.reason === 'string' ? parsed.reason.trim() : '';

    if (!koreanName) {
      return NextResponse.json({ error: 'invalid_model_response' }, { status: 502 });
    }

    return NextResponse.json({
      koreanName,
      pronunciationGuide,
      reason,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'failed_to_generate';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

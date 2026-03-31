export type TtsProvider = 'browser' | 'elevenlabs';

export function getClientTtsProvider(): TtsProvider {
  const raw = (process.env.NEXT_PUBLIC_TTS_PROVIDER ?? 'browser').trim().toLowerCase();
  return raw === 'elevenlabs' ? 'elevenlabs' : 'browser';
}

export function getServerTtsProvider(): TtsProvider {
  const raw = (process.env.TTS_PROVIDER ?? process.env.NEXT_PUBLIC_TTS_PROVIDER ?? 'browser')
    .trim()
    .toLowerCase();
  return raw === 'elevenlabs' ? 'elevenlabs' : 'browser';
}


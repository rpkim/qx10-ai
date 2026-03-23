export type QueryStreamServerEvent =
  | { type: 'token'; text: string }
  | {
      type: 'metadata';
      extractedKeywords: string[];
      suggestedQueries: string[];
      dataNode: Record<string, unknown> | null;
    }
  | { type: 'done' }
  | { type: 'error'; message: string };

function parseSseFrames(buffer: string): { events: QueryStreamServerEvent[]; rest: string } {
  const events: QueryStreamServerEvent[] = [];
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';

  for (const part of parts) {
    for (const line of part.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        events.push(JSON.parse(payload) as QueryStreamServerEvent);
      } catch {
        // ignore malformed chunk
      }
    }
  }

  return { events, rest };
}

/**
 * Reads SSE frames (`data: {...}\\n\\n`) from a fetch Response body.
 */
export async function consumeWorkspaceQueryStream(
  response: Response,
  handlers: {
    onToken: (text: string) => void;
    onMetadata: (m: Extract<QueryStreamServerEvent, { type: 'metadata' }>) => void;
    onDone: () => void;
    onError: (message: string) => void;
  }
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    handlers.onError('No response body');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  const dispatchFrame = (ev: QueryStreamServerEvent) => {
    if (ev.type === 'token') handlers.onToken(ev.text);
    else if (ev.type === 'metadata') handlers.onMetadata(ev);
    else if (ev.type === 'done') handlers.onDone();
    else if (ev.type === 'error') handlers.onError(ev.message);
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += value ? decoder.decode(value, { stream: !done }) : '';

      if (done) {
        if (buffer.trim()) {
          const { events } = parseSseFrames(buffer.endsWith('\n\n') ? buffer : `${buffer}\n\n`);
          events.forEach(dispatchFrame);
        }
        break;
      }

      const { events, rest } = parseSseFrames(buffer);
      buffer = rest;
      events.forEach(dispatchFrame);
    }
  } catch (e) {
    handlers.onError(e instanceof Error ? e.message : 'Stream read failed');
  }
}

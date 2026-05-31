import { promises as fs } from 'fs';
import path from 'path';
import type { WaitlistEntry, WaitlistStatus, WaitlistStore } from './types';
import { hashInviteToken } from './types';

type FileShape = { entries: WaitlistEntry[]; nextId: number };

export class FileWaitlistStore implements WaitlistStore {
  private file: string;
  private chain: Promise<void> = Promise.resolve();

  constructor(dir = process.env.QX10_DATA_DIR || path.join(process.cwd(), '.qx10-data')) {
    this.file = path.join(dir, 'waitlist.json');
  }

  private run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(fn);
    this.chain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  private async readState(): Promise<FileShape> {
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      return JSON.parse(raw) as FileShape;
    } catch {
      return { entries: [], nextId: 1 };
    }
  }

  private async writeState(state: FileShape): Promise<void> {
    const dir = path.dirname(this.file);
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${this.file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(state), 'utf8');
    await fs.rename(tmp, this.file);
  }

  upsertPending(input: {
    sub?: string;
    email: string;
    name?: string;
    picture?: string;
    ts: number;
  }): Promise<WaitlistEntry> {
    return this.run(async () => {
      const s = await this.readState();
      const email = input.email.trim().toLowerCase();
      const existing = s.entries.find((e) => e.email.toLowerCase() === email);
      if (existing) {
        if (existing.status === 'joined') return existing;
        const next: WaitlistEntry = {
          ...existing,
          sub: input.sub ?? existing.sub,
          name: input.name ?? existing.name,
          picture: input.picture ?? existing.picture,
        };
        s.entries = s.entries.map((e) => (e.id === existing.id ? next : e));
        await this.writeState(s);
        return next;
      }
      const entry: WaitlistEntry = {
        id: s.nextId++,
        sub: input.sub,
        email: input.email,
        name: input.name,
        picture: input.picture,
        status: 'pending',
        createdAt: input.ts,
      };
      s.entries.push(entry);
      await this.writeState(s);
      return entry;
    });
  }

  list(opts?: { status?: WaitlistStatus; limit?: number }): Promise<WaitlistEntry[]> {
    return this.run(async () => {
      const s = await this.readState();
      let list = [...s.entries].sort((a, b) => b.createdAt - a.createdAt);
      if (opts?.status) list = list.filter((e) => e.status === opts.status);
      return list.slice(0, opts?.limit ?? 200);
    });
  }

  getByEmail(email: string): Promise<WaitlistEntry | null> {
    return this.run(async () => {
      const s = await this.readState();
      return s.entries.find((e) => e.email.toLowerCase() === email.trim().toLowerCase()) ?? null;
    });
  }

  markInvited(input: {
    id: number;
    invitedBy: string;
    tokenHash: string;
    expiresAt: number;
    ts: number;
  }): Promise<WaitlistEntry> {
    return this.run(async () => {
      const s = await this.readState();
      const idx = s.entries.findIndex((e) => e.id === input.id);
      if (idx < 0) throw new Error('Waitlist entry not found');
      const entry: WaitlistEntry = {
        ...s.entries[idx],
        status: 'invited',
        invitedAt: input.ts,
        invitedBy: input.invitedBy,
        inviteExpiresAt: input.expiresAt,
        inviteTokenHash: input.tokenHash,
      };
      s.entries[idx] = entry;
      await this.writeState(s);
      return entry;
    });
  }

  markJoined(email: string, ts: number): Promise<void> {
    return this.run(async () => {
      const s = await this.readState();
      const idx = s.entries.findIndex((e) => e.email.toLowerCase() === email.trim().toLowerCase());
      if (idx < 0) return;
      s.entries[idx] = { ...s.entries[idx], status: 'joined' };
      await this.writeState(s);
    });
  }

  consumeInviteToken(input: {
    token: string;
    email: string;
    ts: number;
  }): Promise<{ ok: true; entry: WaitlistEntry } | { ok: false; reason: string }> {
    return this.run(async () => {
      const s = await this.readState();
      const hash = hashInviteToken(input.token);
      const email = input.email.trim().toLowerCase();
      const idx = s.entries.findIndex(
        (e) =>
          e.email.toLowerCase() === email &&
          e.status === 'invited' &&
          e.inviteTokenHash === hash
      );
      if (idx < 0) return { ok: false, reason: 'invalid_token' };
      const entry = s.entries[idx];
      if (entry.inviteExpiresAt != null && input.ts > entry.inviteExpiresAt) {
        return { ok: false, reason: 'expired' };
      }
      return { ok: true, entry };
    });
  }
}

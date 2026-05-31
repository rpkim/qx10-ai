import { createHash, randomBytes } from 'crypto';

export type WaitlistStatus = 'pending' | 'invited' | 'joined';

export type WaitlistEntry = {
  id: number;
  sub?: string;
  email: string;
  name?: string;
  picture?: string;
  status: WaitlistStatus;
  createdAt: number;
  invitedAt?: number;
  invitedBy?: string;
  inviteExpiresAt?: number;
  inviteTokenHash?: string;
};

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

export interface WaitlistStore {
  upsertPending(input: {
    sub?: string;
    email: string;
    name?: string;
    picture?: string;
    ts: number;
  }): Promise<WaitlistEntry>;

  list(opts?: { status?: WaitlistStatus; limit?: number }): Promise<WaitlistEntry[]>;

  getByEmail(email: string): Promise<WaitlistEntry | null>;

  markInvited(input: {
    id: number;
    invitedBy: string;
    tokenHash: string;
    expiresAt: number;
    ts: number;
  }): Promise<WaitlistEntry>;

  markJoined(email: string, ts: number): Promise<void>;

  consumeInviteToken(input: {
    token: string;
    email: string;
    ts: number;
  }): Promise<{ ok: true; entry: WaitlistEntry } | { ok: false; reason: string }>;
}

export function countSignupsOnUtcDay(
  users: { createdAt: number }[],
  ts = Date.now()
): number {
  const day = new Date(ts).toISOString().slice(0, 10);
  return users.filter((u) => new Date(u.createdAt).toISOString().slice(0, 10) === day).length;
}

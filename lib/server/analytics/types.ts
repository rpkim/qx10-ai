export type UserRecord = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  createdAt: number;
  lastSeenAt: number;
  signInCount: number;
  searchCount: number;
  consentAt?: number;
  consentVersion?: string;
};

export type SignInEventPayload = {
  type: 'signin';
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  ipHash?: string;
  ua?: string;
  ts: number;
};

export type SearchEventPayload = {
  type: 'search';
  sub: string;
  email: string;
  keyword: string;
  goal: string;
  surface?: string;
  ts: number;
};

export type ConsentEventPayload = {
  type: 'consent';
  sub: string;
  email: string;
  version: string;
  ts: number;
};

export type ActivityEvent = SignInEventPayload | SearchEventPayload | ConsentEventPayload;

export interface AnalyticsStore {
  upsertUserOnSignIn(input: {
    sub: string;
    email: string;
    name?: string;
    picture?: string;
    ts: number;
  }): Promise<UserRecord>;

  recordSearch(input: {
    sub: string;
    email: string;
    keyword: string;
    goal: string;
    surface?: string;
    ts: number;
  }): Promise<void>;

  recordConsent(input: {
    sub: string;
    email: string;
    version: string;
    ts: number;
  }): Promise<void>;

  appendEvent(e: ActivityEvent): Promise<void>;

  /** Total distinct users. */
  countUsers(): Promise<number>;

  /** Distinct users seen since `since` (epoch ms). */
  countActiveUsers(since: number): Promise<number>;

  /** Total events of a type since `since` (default: all-time). */
  countEvents(type: ActivityEvent['type'], since?: number): Promise<number>;

  listUsers(opts?: {
    limit?: number;
    sort?: 'lastSeen' | 'createdAt' | 'searchCount';
  }): Promise<UserRecord[]>;

  getUser(sub: string): Promise<UserRecord | null>;

  listEvents(opts?: {
    limit?: number;
    type?: ActivityEvent['type'];
    sub?: string;
  }): Promise<ActivityEvent[]>;

  topKeywords(limit?: number): Promise<{ keyword: string; count: number }[]>;

  /** Hard-delete a user and all their events. Returns true if a row was removed. */
  deleteUser(sub: string): Promise<boolean>;
}

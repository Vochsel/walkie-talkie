import { randomBytes, randomUUID } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { TOKEN_TTL_MS } from '@walkie-talkie/shared';

interface MagicToken {
  value: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

const SESSION_FILE = join(homedir(), '.walkie-talkie', 'sessions.json');

export class TokenManager {
  private tokens: Map<string, MagicToken> = new Map();
  private activeSessions: Map<string, { tokenValue: string; createdAt: number }> = new Map();
  private gcInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.loadSessions();
    // Garbage-collect expired tokens every 60s
    this.gcInterval = setInterval(() => this.gc(), 60_000);
  }

  private loadSessions(): void {
    try {
      const data = readFileSync(SESSION_FILE, 'utf-8');
      const entries: [string, { tokenValue: string; createdAt: number }][] = JSON.parse(data);
      // Only restore sessions less than 24 hours old
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      for (const [id, session] of entries) {
        if (session.createdAt > cutoff) {
          this.activeSessions.set(id, session);
        }
      }
    } catch {
      // No file or invalid — start fresh
    }
  }

  private saveSessions(): void {
    try {
      mkdirSync(join(homedir(), '.walkie-talkie'), { recursive: true });
      writeFileSync(SESSION_FILE, JSON.stringify([...this.activeSessions.entries()]));
    } catch {
      // Best-effort
    }
  }

  generate(ttlMs: number = TOKEN_TTL_MS): MagicToken {
    // 4 groups of 4 hex chars: e.g., "a7f3-b2c1-d9e0-f456"
    const value = Array.from({ length: 4 }, () =>
      randomBytes(2).toString('hex')
    ).join('-');

    const token: MagicToken = {
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
      used: false,
    };

    this.tokens.set(value, token);
    return token;
  }

  validate(value: string): { valid: boolean; reason?: string } {
    const token = this.tokens.get(value);
    if (!token) return { valid: false, reason: 'unknown_token' };
    if (token.expiresAt < Date.now()) return { valid: false, reason: 'expired' };
    if (token.used) return { valid: false, reason: 'already_used' };
    return { valid: true };
  }

  consume(value: string): string | null {
    const result = this.validate(value);
    if (!result.valid) return null;

    const token = this.tokens.get(value)!;
    token.used = true;

    const sessionId = randomUUID();
    this.activeSessions.set(sessionId, {
      tokenValue: value,
      createdAt: Date.now(),
    });
    this.saveSessions();

    return sessionId;
  }

  validateSession(sessionId: string): boolean {
    return this.activeSessions.has(sessionId);
  }

  revokeSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
    this.saveSessions();
  }

  revokeAll(): void {
    this.tokens.clear();
    this.activeSessions.clear();
    this.saveSessions();
  }

  getActiveToken(): MagicToken | null {
    for (const token of this.tokens.values()) {
      if (!token.used && token.expiresAt > Date.now()) {
        return token;
      }
    }
    return null;
  }

  get sessionCount(): number {
    return this.activeSessions.size;
  }

  private gc(): void {
    const now = Date.now();
    for (const [key, token] of this.tokens) {
      if (token.expiresAt < now) {
        this.tokens.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.gcInterval);
  }
}

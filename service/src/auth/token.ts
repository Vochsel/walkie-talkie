import { randomBytes, randomUUID } from 'crypto';
import { TOKEN_TTL_MS } from '@walkie-talkie/shared';

interface MagicToken {
  value: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

export class TokenManager {
  private tokens: Map<string, MagicToken> = new Map();
  private activeSessions: Map<string, { tokenValue: string; createdAt: number }> = new Map();
  private gcInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Garbage-collect expired tokens every 60s
    this.gcInterval = setInterval(() => this.gc(), 60_000);
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

    return sessionId;
  }

  validateSession(sessionId: string): boolean {
    return this.activeSessions.has(sessionId);
  }

  revokeSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
  }

  revokeAll(): void {
    this.tokens.clear();
    this.activeSessions.clear();
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

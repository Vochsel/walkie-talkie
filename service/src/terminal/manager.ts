import { randomUUID } from 'crypto';
import { TerminalInfo } from '@walkie-talkie/shared';
import { TerminalSession } from './session';

export class TerminalManager {
  private sessions: Map<string, TerminalSession> = new Map();

  create(opts: { cols: number; rows: number; shell?: string }): TerminalSession {
    const id = randomUUID();
    const session = new TerminalSession(id, opts);

    session.on('exit', () => {
      this.sessions.delete(id);
    });

    this.sessions.set(id, session);
    return session;
  }

  get(id: string): TerminalSession | undefined {
    return this.sessions.get(id);
  }

  list(): TerminalInfo[] {
    return Array.from(this.sessions.values()).map((s) => s.getInfo());
  }

  kill(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.kill();
    this.sessions.delete(id);
    return true;
  }

  killAll(): void {
    for (const session of this.sessions.values()) {
      session.kill();
    }
    this.sessions.clear();
  }

  get count(): number {
    return this.sessions.size;
  }
}

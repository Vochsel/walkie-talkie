import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as pty from 'node-pty';
import { randomBytes, randomUUID } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import QRCode from 'qrcode';
import {
  DEFAULT_PORT,
  WS_PATH,
  AUTH_TIMEOUT_MS,
  HEARTBEAT_INTERVAL_MS,
  TOKEN_TTL_MS,
  ClientMessage,
  ServerMessage,
  TerminalInfo,
} from '@walkie-talkie/shared';

const SESSION_FILE = join(homedir(), '.walkie-talkie', 'sessions.json');
const MAX_SCROLLBACK = 100_000; // 100KB

// ── Terminal Session ────────────────────────────────────────────────
class TerminalSession {
  public readonly id: string;
  public readonly createdAt = Date.now();
  private pty: pty.IPty;
  private shell: string;
  private cols: number;
  private rows: number;
  private scrollback = '';
  private listeners: { data: ((d: string) => void)[]; exit: ((code: number) => void)[] } = { data: [], exit: [] };

  constructor(id: string, cols: number, rows: number, shell?: string) {
    this.id = id;
    this.cols = cols;
    this.rows = rows;
    this.shell = shell || (process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash');
    this.pty = pty.spawn(this.shell, [], {
      name: 'xterm-256color', cols, rows,
      cwd: process.env.HOME || process.env.USERPROFILE || '/',
      env: process.env as Record<string, string>,
    });
    this.pty.onData((d) => {
      this.scrollback += d;
      if (this.scrollback.length > MAX_SCROLLBACK) {
        this.scrollback = this.scrollback.slice(-MAX_SCROLLBACK);
      }
      this.listeners.data.forEach((fn) => fn(d));
    });
    this.pty.onExit(({ exitCode }) => this.listeners.exit.forEach((fn) => fn(exitCode)));
  }

  onData(fn: (d: string) => void) { this.listeners.data.push(fn); }
  onExit(fn: (code: number) => void) { this.listeners.exit.push(fn); }
  write(d: string) { this.pty.write(d); }
  resize(c: number, r: number) { this.cols = c; this.rows = r; this.pty.resize(c, r); }
  kill() { this.pty.kill(); }
  getScrollback() { return this.scrollback; }
  getInfo(): TerminalInfo {
    return { id: this.id, pid: this.pty.pid, shell: this.shell, cols: this.cols, rows: this.rows, cwd: process.cwd(), createdAt: this.createdAt };
  }
}

// ── Token Manager ───────────────────────────────────────────────────
class TokenManager {
  private tokens = new Map<string, { value: string; expiresAt: number; used: boolean }>();
  private sessions = new Map<string, { tokenValue: string; createdAt: number }>();

  constructor() { this.loadSessions(); }

  private loadSessions() {
    try {
      const entries: [string, { tokenValue: string; createdAt: number }][] = JSON.parse(readFileSync(SESSION_FILE, 'utf-8'));
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      for (const [id, s] of entries) if (s.createdAt > cutoff) this.sessions.set(id, s);
    } catch { /* start fresh */ }
  }

  private saveSessions() {
    try {
      mkdirSync(join(homedir(), '.walkie-talkie'), { recursive: true });
      writeFileSync(SESSION_FILE, JSON.stringify([...this.sessions.entries()]));
    } catch { /* best-effort */ }
  }

  generate(ttl = TOKEN_TTL_MS) {
    const value = Array.from({ length: 4 }, () => randomBytes(2).toString('hex')).join('-');
    const token = { value, expiresAt: Date.now() + ttl, used: false };
    this.tokens.set(value, token);
    return token;
  }

  consume(value: string): string | null {
    const t = this.tokens.get(value);
    if (!t || t.used || t.expiresAt < Date.now()) return null;
    t.used = true;
    const sid = randomUUID();
    this.sessions.set(sid, { tokenValue: value, createdAt: Date.now() });
    this.saveSessions();
    return sid;
  }

  validateSession(sid: string) { return this.sessions.has(sid); }
  getActive() {
    for (const t of this.tokens.values()) if (!t.used && t.expiresAt > Date.now()) return t;
    return null;
  }
}

// ── Server ──────────────────────────────────────────────────────────
interface AuthSocket extends WebSocket { sessionId?: string; isAlive?: boolean; }

export function createServer(port: number = DEFAULT_PORT) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const terminals = new Map<string, TerminalSession>();
  const tokens = new TokenManager();
  const sessionSockets = new Map<string, AuthSocket>();
  const sessionTerminals = new Map<string, Set<string>>();

  // REST
  app.get('/api/health', (_, res) => res.json({ status: 'ok', version: '1.0.0', uptime: process.uptime() }));
  app.get('/', (_, res) => res.json({ name: 'walkie-talkie', status: 'running', port }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: WS_PATH });

  function send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  function sendToSession(sessionId: string, msg: ServerMessage) {
    const ws = sessionSockets.get(sessionId);
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  wss.on('connection', (ws: AuthSocket) => {
    ws.isAlive = true;
    const authTimer = setTimeout(() => { if (!ws.sessionId) { send(ws, { type: 'auth:fail', reason: 'auth_timeout' }); ws.close(); } }, AUTH_TIMEOUT_MS);

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (raw: Buffer) => {
      let msg: ClientMessage;
      try { msg = JSON.parse(raw.toString()); } catch { send(ws, { type: 'error', message: 'Invalid JSON' }); return; }

      if (msg.type === 'auth') {
        const sid = tokens.consume(msg.token);
        if (sid) {
          ws.sessionId = sid;
          sessionSockets.set(sid, ws);
          sessionTerminals.set(sid, new Set());
          clearTimeout(authTimer);
          send(ws, { type: 'auth:ok', sessionId: sid });
        } else {
          send(ws, { type: 'auth:fail', reason: 'invalid_token' }); ws.close();
        }
        return;
      }

      if (msg.type === 'auth:resume') {
        if (tokens.validateSession(msg.sessionId)) {
          ws.sessionId = msg.sessionId;
          sessionSockets.set(msg.sessionId, ws);
          if (!sessionTerminals.has(msg.sessionId)) sessionTerminals.set(msg.sessionId, new Set());
          clearTimeout(authTimer);
          send(ws, { type: 'auth:ok', sessionId: msg.sessionId });

          // Re-send terminal list and replay scrollback
          const termIds = sessionTerminals.get(msg.sessionId)!;
          const list: TerminalInfo[] = [];
          for (const id of termIds) {
            const sess = terminals.get(id);
            if (sess) list.push(sess.getInfo());
            else termIds.delete(id);
          }
          console.log(`[resume] session=${msg.sessionId.slice(0, 8)} terminals=${list.length}`);
          send(ws, { type: 'terminal:list', terminals: list });

          for (const t of list) {
            const sess = terminals.get(t.id);
            if (sess) {
              const sb = sess.getScrollback();
              if (sb) send(ws, { type: 'terminal:output', terminalId: t.id, data: sb });
            }
          }
        } else {
          send(ws, { type: 'auth:fail', reason: 'invalid_session' }); ws.close();
        }
        return;
      }

      if (!ws.sessionId) { send(ws, { type: 'error', message: 'Not authenticated' }); return; }

      switch (msg.type) {
        case 'terminal:create': {
          const id = randomUUID();
          const sessionId = ws.sessionId!;
          try {
            const sess = new TerminalSession(id, msg.cols, msg.rows, msg.shell);
            terminals.set(id, sess);

            // Track terminal for this session
            let termSet = sessionTerminals.get(sessionId);
            if (!termSet) { termSet = new Set(); sessionTerminals.set(sessionId, termSet); }
            termSet.add(id);

            console.log(`[terminal:create] id=${id.slice(0, 8)} session=${sessionId.slice(0, 8)} tracked=${termSet.size}`);

            // Route output via session (survives reconnects)
            sess.onData((data) => sendToSession(sessionId, { type: 'terminal:output', terminalId: id, data }));
            sess.onExit((exitCode) => {
              sendToSession(sessionId, { type: 'terminal:exited', terminalId: id, exitCode });
              terminals.delete(id);
              const terms = sessionTerminals.get(sessionId);
              if (terms) terms.delete(id);
            });
            send(ws, { type: 'terminal:created', terminal: sess.getInfo() });
          } catch (err: any) {
            send(ws, { type: 'error', message: `Failed to spawn terminal: ${err.message}`, code: 'spawn_failed' });
          }
          break;
        }
        case 'terminal:input': terminals.get(msg.terminalId)?.write(msg.data); break;
        case 'terminal:resize': terminals.get(msg.terminalId)?.resize(msg.cols, msg.rows); break;
        case 'terminal:kill': { const s = terminals.get(msg.terminalId); if (s) { s.kill(); terminals.delete(msg.terminalId); } break; }
        case 'terminal:list': {
          const sid = ws.sessionId!;
          const ids = sessionTerminals.get(sid) ?? new Set();
          const list: TerminalInfo[] = [];
          for (const id of ids) { const s = terminals.get(id); if (s) list.push(s.getInfo()); }
          send(ws, { type: 'terminal:list', terminals: list });
          break;
        }
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimer);
      if (ws.sessionId) {
        const current = sessionSockets.get(ws.sessionId);
        if (current === ws) sessionSockets.delete(ws.sessionId);
      }
    });
  });

  const hbInterval = setInterval(() => {
    wss.clients.forEach((ws: AuthSocket) => { if (!ws.isAlive) { ws.terminate(); return; } ws.isAlive = false; ws.ping(); });
  }, HEARTBEAT_INTERVAL_MS);

  return {
    start: () => new Promise<void>((resolve) => server.listen(port, () => resolve())),
    stop: () => new Promise<void>((resolve) => {
      clearInterval(hbInterval);
      terminals.forEach((s) => s.kill());
      wss.clients.forEach((ws) => ws.terminate());
      wss.close(() => server.close(() => resolve()));
    }),
    generateToken: () => tokens.generate(),
    getActiveToken: () => tokens.getActive(),
    port,
  };
}

export async function generateQR(text: string): Promise<string> {
  return QRCode.toString(text, { type: 'terminal', small: true });
}

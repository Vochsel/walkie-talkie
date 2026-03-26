import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as pty from 'node-pty';
import { randomBytes, randomUUID } from 'crypto';
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

// ── Terminal Session ────────────────────────────────────────────────
class TerminalSession {
  public readonly id: string;
  public readonly createdAt = Date.now();
  private pty: pty.IPty;
  private shell: string;
  private cols: number;
  private rows: number;
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
    this.pty.onData((d) => this.listeners.data.forEach((fn) => fn(d)));
    this.pty.onExit(({ exitCode }) => this.listeners.exit.forEach((fn) => fn(exitCode)));
  }

  onData(fn: (d: string) => void) { this.listeners.data.push(fn); }
  onExit(fn: (code: number) => void) { this.listeners.exit.push(fn); }
  write(d: string) { this.pty.write(d); }
  resize(c: number, r: number) { this.cols = c; this.rows = r; this.pty.resize(c, r); }
  kill() { this.pty.kill(); }
  getInfo(): TerminalInfo {
    return { id: this.id, pid: this.pty.pid, shell: this.shell, cols: this.cols, rows: this.rows, cwd: process.cwd(), createdAt: this.createdAt };
  }
}

// ── Token Manager ───────────────────────────────────────────────────
class TokenManager {
  private tokens = new Map<string, { value: string; expiresAt: number; used: boolean }>();
  private sessions = new Map<string, string>();

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
    this.sessions.set(sid, value);
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

  // REST
  app.get('/api/health', (_, res) => res.json({ status: 'ok', version: '1.0.0', uptime: process.uptime() }));
  app.get('/', (_, res) => res.json({ name: 'walkie-talkie', status: 'running', port }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: WS_PATH });

  function send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
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
        if (sid) { ws.sessionId = sid; clearTimeout(authTimer); send(ws, { type: 'auth:ok', sessionId: sid }); }
        else { send(ws, { type: 'auth:fail', reason: 'invalid_token' }); ws.close(); }
        return;
      }
      if (msg.type === 'auth:resume') {
        if (tokens.validateSession(msg.sessionId)) { ws.sessionId = msg.sessionId; clearTimeout(authTimer); send(ws, { type: 'auth:ok', sessionId: msg.sessionId }); }
        else { send(ws, { type: 'auth:fail', reason: 'invalid_session' }); ws.close(); }
        return;
      }
      if (!ws.sessionId) { send(ws, { type: 'error', message: 'Not authenticated' }); return; }

      switch (msg.type) {
        case 'terminal:create': {
          const id = randomUUID();
          try {
            const sess = new TerminalSession(id, msg.cols, msg.rows, msg.shell);
            terminals.set(id, sess);
            sess.onData((data) => send(ws, { type: 'terminal:output', terminalId: id, data }));
            sess.onExit((exitCode) => { send(ws, { type: 'terminal:exited', terminalId: id, exitCode }); terminals.delete(id); });
            send(ws, { type: 'terminal:created', terminal: sess.getInfo() });
          } catch (err: any) {
            send(ws, { type: 'error', message: `Failed to spawn terminal: ${err.message}`, code: 'spawn_failed' });
          }
          break;
        }
        case 'terminal:input': terminals.get(msg.terminalId)?.write(msg.data); break;
        case 'terminal:resize': terminals.get(msg.terminalId)?.resize(msg.cols, msg.rows); break;
        case 'terminal:kill': { const s = terminals.get(msg.terminalId); if (s) { s.kill(); terminals.delete(msg.terminalId); } break; }
        case 'terminal:list': send(ws, { type: 'terminal:list', terminals: Array.from(terminals.values()).map((s) => s.getInfo()) }); break;
      }
    });

    ws.on('close', () => clearTimeout(authTimer));
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

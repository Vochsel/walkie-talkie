import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as pty from 'node-pty';
import { randomBytes, randomUUID } from 'crypto';
import {
  readFileSync, writeFileSync, mkdirSync,
  statSync, readdirSync, realpathSync, openSync, readSync, closeSync,
} from 'fs';
import { join, resolve, relative, basename, sep, extname } from 'path';
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
  SavedTerminal,
} from '@walkie-talkie/shared';
import { redactCommand } from './redact';
import { loadState, createStateWriter } from './state-store';

const SESSION_FILE = join(homedir(), '.walkie-talkie', 'sessions.json');
const MAX_SCROLLBACK = 100_000; // 100KB
const MAX_RECENT_COMMANDS = 20;
const FILE_READ_LIMIT = 1_000_000; // 1MB cap on file reads

// ── Terminal Session ────────────────────────────────────────────────
interface TerminalSessionOptions {
  capture?: boolean;
  name?: string;
  seedCommands?: string[];
}

class TerminalSession {
  public readonly id: string;
  public readonly createdAt = Date.now();
  private pty: pty.IPty;
  private shell: string;
  private cols: number;
  private rows: number;
  private cwd: string;
  private _name?: string;
  private scrollback = '';
  private listeners: { data: ((d: string) => void)[]; exit: ((code: number) => void)[]; command: (() => void)[] } = { data: [], exit: [], command: [] };

  // Command-history capture (best-effort, heuristic from raw stdin)
  private capture: boolean;
  private cmdBuffer = '';
  private outputTail = '';
  private recentCommands: string[];
  private lastActive: number;

  constructor(id: string, cols: number, rows: number, shell?: string, cwd?: string, opts: TerminalSessionOptions = {}) {
    this.id = id;
    this.cols = cols;
    this.rows = rows;
    this.cwd = cwd || process.env.HOME || process.env.USERPROFILE || '/';
    this.shell = shell || (process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash');
    this.capture = opts.capture !== false;
    this._name = opts.name || undefined;
    this.recentCommands = (opts.seedCommands ?? []).slice(-MAX_RECENT_COMMANDS);
    this.lastActive = this.createdAt;
    this.pty = pty.spawn(this.shell, [], {
      name: 'xterm-256color', cols, rows,
      cwd: this.cwd,
      env: process.env as Record<string, string>,
    });
    this.pty.onData((d) => {
      this.scrollback += d;
      if (this.scrollback.length > MAX_SCROLLBACK) {
        this.scrollback = this.scrollback.slice(-MAX_SCROLLBACK);
      }
      // Keep a short tail of output to detect password prompts.
      this.outputTail = (this.outputTail + d).slice(-200);
      this.listeners.data.forEach((fn) => fn(d));
    });
    this.pty.onExit(({ exitCode }) => this.listeners.exit.forEach((fn) => fn(exitCode)));
  }

  onData(fn: (d: string) => void) { this.listeners.data.push(fn); }
  onExit(fn: (code: number) => void) { this.listeners.exit.push(fn); }
  onCommand(fn: () => void) { this.listeners.command.push(fn); }
  write(d: string) {
    this.pty.write(d);
    if (this.capture) this.captureInput(d);
  }
  resize(c: number, r: number) { this.cols = c; this.rows = r; this.pty.resize(c, r); }
  kill() { this.pty.kill(); }
  getScrollback() { return this.scrollback; }
  get name() { return this._name; }
  setName(name: string) { this._name = name || undefined; }
  getCwd() { return this.cwd; }
  getShell() { return this.shell; }
  getRecentCommands() { return this.recentCommands; }
  getLastActive() { return this.lastActive; }

  // Accumulate typed input into a line; record commands on Enter. Heuristic:
  // abandons the line on escape sequences (arrow keys) and resets on Ctrl-C/U.
  private captureInput(data: string) {
    for (let i = 0; i < data.length; i++) {
      const ch = data[i];
      const code = data.charCodeAt(i);
      if (ch === '\x1b') {
        // Escape sequence (cursor/history nav) — drop the buffer and skip the seq.
        this.cmdBuffer = '';
        const next = data[i + 1];
        if (next === '[' || next === 'O') {
          i += 2;
          while (i < data.length && !/[A-Za-z~]/.test(data[i])) i++;
        } else {
          i += 1;
        }
        continue;
      }
      if (ch === '\r' || ch === '\n') { this.commitLine(); continue; }
      if (code === 127 || ch === '\b') { this.cmdBuffer = this.cmdBuffer.slice(0, -1); continue; }
      if (code === 3 || code === 21 || code === 23 || code === 12) { this.cmdBuffer = ''; continue; } // Ctrl-C/U/W/L
      if (code < 32) continue; // other control chars (tab, etc.)
      this.cmdBuffer += ch;
    }
  }

  private commitLine() {
    const line = this.cmdBuffer.trim();
    this.cmdBuffer = '';
    if (!line) return;
    // Skip likely password/passphrase entry (prompt ended asking for one).
    if (/(password|passphrase|secret)\b[^\n]{0,16}:?\s*$/i.test(this.outputTail)) return;
    const redacted = redactCommand(line);
    this.lastActive = Date.now();
    if (this.recentCommands[this.recentCommands.length - 1] !== redacted) {
      this.recentCommands.push(redacted);
      if (this.recentCommands.length > MAX_RECENT_COMMANDS) {
        this.recentCommands = this.recentCommands.slice(-MAX_RECENT_COMMANDS);
      }
    }
    this.listeners.command.forEach((fn) => fn());
  }

  getInfo(): TerminalInfo {
    return {
      id: this.id, pid: this.pty.pid, shell: this.shell, cols: this.cols, rows: this.rows,
      cwd: this.cwd, createdAt: this.createdAt, name: this._name,
      recentCommands: this.recentCommands, lastActive: this.lastActive,
    };
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
  get sessionCount() { return this.sessions.size; }
  getActive() {
    for (const t of this.tokens.values()) if (!t.used && t.expiresAt > Date.now()) return t;
    return null;
  }
}

// ── Server ──────────────────────────────────────────────────────────
interface AuthSocket extends WebSocket { sessionId?: string; isAlive?: boolean; }

export interface CreateServerOptions {
  /** Capture best-effort command history (default true). Set false for --no-history. */
  history?: boolean;
}

export function createServer(port: number = DEFAULT_PORT, cwd?: string, options: CreateServerOptions = {}) {
  const terminalCwd = cwd ? resolve(cwd) : undefined;
  const captureHistory = options.history !== false;
  // Real path of the root used to jail file browsing and persistence.
  const fsRoot = terminalCwd ? (() => { try { return realpathSync(terminalCwd); } catch { return terminalCwd; } })() : undefined;

  const app = express();
  app.use(cors());
  app.use(express.json());

  const terminals = new Map<string, TerminalSession>();
  const tokens = new TokenManager();
  const sessionSockets = new Map<string, AuthSocket>();
  const sessionTerminals = new Map<string, Set<string>>();
  let stateCallback: (() => void) | null = null;

  // Persisted, git-committable session state (only when a project dir is set).
  const stateWriter = fsRoot ? createStateWriter(fsRoot) : null;
  const restoreSnapshot: SavedTerminal[] = fsRoot ? loadState(fsRoot) : [];

  function notifyStateChange() { stateCallback?.(); }

  function relativeToRoot(abs: string): string {
    if (!fsRoot) return abs;
    if (abs === fsRoot) return '.';
    const rel = relative(fsRoot, abs);
    return rel.startsWith('..') ? abs : './' + rel;
  }

  function toSaved(s: TerminalSession): SavedTerminal {
    return {
      name: s.name,
      shell: s.getShell(),
      cwd: relativeToRoot(s.getCwd()),
      createdAt: s.createdAt,
      lastActive: s.getLastActive(),
      recentCommands: s.getRecentCommands(),
    };
  }

  function persist() {
    stateWriter?.schedule(() => Array.from(terminals.values()).map(toSaved));
  }

  function restoreMessage(): ServerMessage {
    return {
      type: 'session:restore',
      root: fsRoot ?? '',
      repoName: fsRoot ? basename(fsRoot) : '',
      terminals: restoreSnapshot,
    };
  }

  // REST
  app.get('/api/health', (_, res) => res.json({ status: 'ok', version: '1.0.0', uptime: process.uptime() }));
  app.get('/', (_, res) => res.json({ name: 'walkie-talkie', status: 'running', port }));

  // REST — terminal CRUD (auth via Bearer sessionId)
  const requireAuth: express.RequestHandler = (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) { res.status(401).json({ error: 'Missing authorization' }); return; }
    if (!tokens.validateSession(auth.slice(7))) { res.status(403).json({ error: 'Invalid session' }); return; }
    next();
  };
  app.get('/api/terminals', requireAuth, (_, res) => {
    res.json({ terminals: Array.from(terminals.values()).map((s) => s.getInfo()) });
  });
  app.delete('/api/terminals/:id', requireAuth, (req, res) => {
    const s = terminals.get(req.params.id as string);
    if (!s) { res.status(404).json({ error: 'Terminal not found' }); return; }
    s.kill(); terminals.delete(req.params.id as string);
    res.json({ ok: true }); notifyStateChange(); persist();
  });

  // REST — read-only file browsing, jailed to the start directory.
  // Resolves symlinks and rejects anything outside the root.
  function resolveInRoot(rel: string): string {
    if (!fsRoot) { throw { status: 404, error: 'File browsing disabled (no project directory)' }; }
    const real = realpathSync(resolve(fsRoot, rel || '.'));
    if (real !== fsRoot && !real.startsWith(fsRoot + sep)) {
      throw { status: 403, error: 'Path is outside the project directory' };
    }
    return real;
  }
  const IMAGE_MIME: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
    '.webp': 'image/webp', '.bmp': 'image/bmp', '.ico': 'image/x-icon', '.avif': 'image/avif',
  };
  function sendFsError(res: express.Response, err: any) {
    const status = typeof err?.status === 'number' ? err.status : (err?.code === 'ENOENT' ? 404 : 500);
    res.status(status).json({ error: err?.error || err?.message || 'File system error' });
  }

  app.get('/api/fs/root', requireAuth, (_, res) => {
    if (!fsRoot) { res.status(404).json({ error: 'File browsing disabled' }); return; }
    res.json({ root: fsRoot, repoName: basename(fsRoot) });
  });

  app.get('/api/fs/list', requireAuth, (req, res) => {
    try {
      const abs = resolveInRoot(String(req.query.path ?? '.'));
      const st = statSync(abs);
      if (!st.isDirectory()) { res.status(400).json({ error: 'Not a directory' }); return; }
      const entries = readdirSync(abs, { withFileTypes: true }).map((d) => {
        let type: 'file' | 'dir' = d.isDirectory() ? 'dir' : 'file';
        let size = 0; let mtime = 0;
        try {
          const es = statSync(join(abs, d.name)); // follows symlinks
          if (es.isDirectory()) type = 'dir';
          size = es.size; mtime = es.mtimeMs;
        } catch { /* broken symlink / permission — leave defaults */ }
        return { name: d.name, type, size, mtime };
      });
      entries.sort((a, b) =>
        a.type !== b.type ? (a.type === 'dir' ? -1 : 1) : a.name.localeCompare(b.name)
      );
      res.json({ path: relativeToRoot(abs), entries });
    } catch (err) { sendFsError(res, err); }
  });

  app.get('/api/fs/read', requireAuth, (req, res) => {
    try {
      const abs = resolveInRoot(String(req.query.path ?? ''));
      const st = statSync(abs);
      if (st.isDirectory()) { res.status(400).json({ error: 'Is a directory' }); return; }
      const truncated = st.size > FILE_READ_LIMIT;
      const length = Math.min(st.size, FILE_READ_LIMIT);
      const buf = Buffer.alloc(length);
      const fd = openSync(abs, 'r');
      try { readSync(fd, buf, 0, length, 0); } finally { closeSync(fd); }

      const ext = extname(abs).toLowerCase();
      const imageMime = IMAGE_MIME[ext];
      if (imageMime && !truncated) {
        res.json({ path: relativeToRoot(abs), size: st.size, truncated: false, kind: 'image', mime: imageMime, content: buf.toString('base64') });
        return;
      }
      const isBinary = buf.subarray(0, Math.min(length, 8000)).includes(0);
      if (isBinary) {
        res.json({ path: relativeToRoot(abs), size: st.size, truncated, kind: 'binary' });
        return;
      }
      res.json({ path: relativeToRoot(abs), size: st.size, truncated, kind: 'text', content: buf.toString('utf-8') });
    } catch (err) { sendFsError(res, err); }
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: WS_PATH });

  function send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  function sendToSession(sessionId: string, msg: ServerMessage) {
    const ws = sessionSockets.get(sessionId);
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  // Safely resolve a requested cwd (for reopening saved terminals) to the root jail.
  function safeCwd(rel?: string): string | undefined {
    if (!rel || !fsRoot) return terminalCwd;
    try { return resolveInRoot(rel); } catch { return terminalCwd; }
  }
  function seedFor(name?: string): string[] | undefined {
    if (!name) return undefined;
    return restoreSnapshot.find((t) => t.name === name)?.recentCommands;
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
          send(ws, restoreMessage());
          notifyStateChange();
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
          send(ws, restoreMessage());

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
          notifyStateChange();
        } else {
          send(ws, { type: 'auth:fail', reason: 'invalid_session' }); ws.close();
        }
        return;
      }

      if (!ws.sessionId) { send(ws, { type: 'error', message: 'Not authenticated' }); return; }

      switch (msg.type) {
        case 'session:restore':
          send(ws, restoreMessage());
          break;
        case 'terminal:create': {
          const id = randomUUID();
          const sessionId = ws.sessionId!;
          try {
            const sess = new TerminalSession(id, msg.cols, msg.rows, msg.shell, safeCwd(msg.cwd), {
              capture: captureHistory,
              name: msg.name,
              seedCommands: seedFor(msg.name),
            });
            terminals.set(id, sess);

            let termSet = sessionTerminals.get(sessionId);
            if (!termSet) { termSet = new Set(); sessionTerminals.set(sessionId, termSet); }
            termSet.add(id);

            sess.onData((data) => sendToSession(sessionId, { type: 'terminal:output', terminalId: id, data }));
            sess.onCommand(() => persist());
            sess.onExit((exitCode) => {
              sendToSession(sessionId, { type: 'terminal:exited', terminalId: id, exitCode });
              terminals.delete(id);
              const terms = sessionTerminals.get(sessionId);
              if (terms) terms.delete(id);
              notifyStateChange(); persist();
            });
            send(ws, { type: 'terminal:created', terminal: sess.getInfo() });
            notifyStateChange(); persist();
          } catch (err: any) {
            send(ws, { type: 'error', message: `Failed to spawn terminal: ${err.message}`, code: 'spawn_failed' });
          }
          break;
        }
        case 'terminal:input': terminals.get(msg.terminalId)?.write(msg.data); break;
        case 'terminal:resize': terminals.get(msg.terminalId)?.resize(msg.cols, msg.rows); break;
        case 'terminal:kill': { const s = terminals.get(msg.terminalId); if (s) { s.kill(); terminals.delete(msg.terminalId); persist(); } break; }
        case 'terminal:rename': {
          const s = terminals.get(msg.terminalId);
          if (s) {
            s.setName(msg.name);
            send(ws, { type: 'terminal:renamed', terminalId: msg.terminalId, name: msg.name });
            persist();
          }
          break;
        }
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
      if (stateWriter) { persist(); stateWriter.flush(); }
      terminals.forEach((s) => s.kill());
      wss.clients.forEach((ws) => ws.terminate());
      wss.close(() => server.close(() => resolve()));
    }),
    generateToken: () => tokens.generate(),
    getActiveToken: () => tokens.getActive(),
    onStateChange: (cb: () => void) => { stateCallback = cb; },
    get terminalCount() { return terminals.size; },
    get sessionCount() { return tokens.sessionCount; },
    /** Absolute root directory for persistence + file browsing (undefined if none). */
    get root() { return fsRoot; },
    port,
  };
}

// ── QR Code Utilities ───────────────────────────────────────────────
export async function generateQR(text: string): Promise<string> {
  return QRCode.toString(text, { type: 'terminal', small: true });
}

export async function generateConnectionQR(baseUrl: string, token: string): Promise<string> {
  const url = buildConnectionUrl(baseUrl, token);
  return QRCode.toDataURL(url, { width: 280, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
}

export function buildConnectionUrl(baseUrl: string, token: string): string {
  return `${baseUrl}?token=${encodeURIComponent(token)}`;
}

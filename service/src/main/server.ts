import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { TerminalManager } from '../terminal/manager';
import { TokenManager } from '../auth/token';
import { TunnelManager } from '../tunnel/ngrok';
import { generateConnectionQR, buildConnectionUrl } from '../auth/qrcode';
import {
  DEFAULT_PORT,
  WS_PATH,
  AUTH_TIMEOUT_MS,
  HEARTBEAT_INTERVAL_MS,
  ClientMessage,
  ServerMessage,
  TerminalInfo,
} from '@walkie-talkie/shared';

interface AuthenticatedSocket extends WebSocket {
  sessionId?: string;
  isAlive?: boolean;
}

export interface ServerState {
  port: number;
  token: string | null;
  tokenExpiresAt: number | null;
  tunnelUrl: string | null;
  terminalCount: number;
  sessionCount: number;
}

export type StateChangeCallback = (state: ServerState) => void;

export class WalkieTalkieServer {
  private app: express.Application;
  private server: http.Server;
  private wss: WebSocketServer;
  private terminalManager: TerminalManager;
  private tokenManager: TokenManager;
  private tunnelManager: TunnelManager;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private port: number;
  private onStateChange: StateChangeCallback | null = null;
  private sessionSockets: Map<string, AuthenticatedSocket> = new Map();
  private sessionTerminals: Map<string, Set<string>> = new Map();

  constructor(port: number = DEFAULT_PORT) {
    this.port = port;
    this.terminalManager = new TerminalManager();
    this.tokenManager = new TokenManager();
    this.tunnelManager = new TunnelManager();

    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());
    this.setupRoutes();

    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server, path: WS_PATH });
    this.setupWebSocket();
  }

  setStateChangeCallback(cb: StateChangeCallback): void {
    this.onStateChange = cb;
  }

  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.getState());
    }
  }

  private setupRoutes(): void {
    // Root redirect — if someone hits the service URL directly, send them to the web client
    this.app.get('/', (_req, res) => {
      res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Walkie-Talkie</title>
  <style>
    body { background: #0d1117; color: #e6edf3; font-family: -apple-system, system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { text-align: center; background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 40px; max-width: 400px; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    p { color: #8b949e; font-size: 14px; margin: 0 0 20px; }
    code { background: #0d1117; border: 1px solid #30363d; border-radius: 4px; padding: 2px 6px; color: #00d4aa; font-size: 13px; }
    .status { color: #3fb950; font-size: 13px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Walkie-Talkie Service</h1>
    <div class="status">Running</div>
    <p>The web client runs separately.<br>Start it with:</p>
    <code>pnpm dev:web</code>
    <p style="margin-top: 16px">Then open <code>http://localhost:3000</code></p>
  </div>
</body>
</html>`);
    });

    this.app.get('/api/health', (_req, res) => {
      res.json({
        status: 'ok',
        version: '1.0.0',
        uptime: process.uptime(),
      });
    });

    // Auth middleware for API routes
    const requireAuth = (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing authorization' });
        return;
      }
      const sessionId = auth.slice(7);
      if (!this.tokenManager.validateSession(sessionId)) {
        res.status(403).json({ error: 'Invalid session' });
        return;
      }
      next();
    };

    this.app.get('/api/terminals', requireAuth, (_req, res) => {
      res.json({ terminals: this.terminalManager.list() });
    });

    this.app.post('/api/terminals', requireAuth, (req, res) => {
      const { cols = 80, rows = 24, shell } = req.body;
      const session = this.terminalManager.create({ cols, rows, shell });
      res.json({ terminal: session.getInfo() });
    });

    this.app.delete('/api/terminals/:id', requireAuth, (req, res) => {
      const killed = this.terminalManager.kill(req.params.id as string);
      if (!killed) {
        res.status(404).json({ error: 'Terminal not found' });
        return;
      }
      res.json({ ok: true });
      this.notifyStateChange();
    });
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws: AuthenticatedSocket) => {
      ws.isAlive = true;

      // Auth timeout: must authenticate within AUTH_TIMEOUT_MS
      const authTimer = setTimeout(() => {
        if (!ws.sessionId) {
          this.send(ws, { type: 'auth:fail', reason: 'auth_timeout' });
          ws.close();
        }
      }, AUTH_TIMEOUT_MS);

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (raw: Buffer) => {
        let msg: ClientMessage;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          this.send(ws, { type: 'error', message: 'Invalid JSON' });
          return;
        }

        // Handle auth
        if (msg.type === 'auth') {
          const sessionId = this.tokenManager.consume(msg.token);
          if (sessionId) {
            ws.sessionId = sessionId;
            this.sessionSockets.set(sessionId, ws);
            this.sessionTerminals.set(sessionId, new Set());
            clearTimeout(authTimer);
            this.send(ws, { type: 'auth:ok', sessionId });
            this.notifyStateChange();
          } else {
            this.send(ws, { type: 'auth:fail', reason: 'invalid_token' });
            ws.close();
          }
          return;
        }

        // Handle session resume
        if (msg.type === 'auth:resume') {
          if (this.tokenManager.validateSession(msg.sessionId)) {
            ws.sessionId = msg.sessionId;
            this.sessionSockets.set(msg.sessionId, ws);
            clearTimeout(authTimer);
            this.send(ws, { type: 'auth:ok', sessionId: msg.sessionId });

            // Re-send the terminal list and replay scrollback for this session
            const terminalIds = this.sessionTerminals.get(msg.sessionId);
            const terminals: TerminalInfo[] = [];
            if (terminalIds) {
              for (const id of terminalIds) {
                const session = this.terminalManager.get(id);
                if (session) {
                  terminals.push(session.getInfo());
                } else {
                  terminalIds.delete(id);
                }
              }
            }
            this.send(ws, { type: 'terminal:list', terminals });

            // Replay scrollback so terminals aren't blank
            for (const t of terminals) {
              const session = this.terminalManager.get(t.id);
              if (session) {
                const scrollback = session.getScrollback();
                if (scrollback) {
                  this.send(ws, { type: 'terminal:output', terminalId: t.id, data: scrollback });
                }
              }
            }

            this.notifyStateChange();
          } else {
            this.send(ws, { type: 'auth:fail', reason: 'invalid_session' });
            ws.close();
          }
          return;
        }

        // All other messages require auth
        if (!ws.sessionId) {
          this.send(ws, { type: 'error', message: 'Not authenticated' });
          return;
        }

        this.handleMessage(ws, msg);
      });

      ws.on('close', () => {
        clearTimeout(authTimer);
        // Remove socket reference but keep session and terminals alive for reconnect
        if (ws.sessionId) {
          const currentWs = this.sessionSockets.get(ws.sessionId);
          if (currentWs === ws) {
            this.sessionSockets.delete(ws.sessionId);
          }
        }
      });
    });

    // Heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: AuthenticatedSocket) => {
        if (!ws.isAlive) {
          ws.terminate();
          return;
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private handleMessage(ws: AuthenticatedSocket, msg: ClientMessage): void {
    switch (msg.type) {
      case 'terminal:create': {
        const session = this.terminalManager.create({
          cols: msg.cols,
          rows: msg.rows,
          shell: msg.shell,
        });

        const sessionId = ws.sessionId!;

        // Track terminal for this session
        let termSet = this.sessionTerminals.get(sessionId);
        if (!termSet) {
          termSet = new Set();
          this.sessionTerminals.set(sessionId, termSet);
        }
        termSet.add(session.id);

        // Wire up output using session-based routing (survives reconnects)
        session.on('data', (data: string) => {
          this.sendToSession(sessionId, {
            type: 'terminal:output',
            terminalId: session.id,
            data,
          });
        });

        session.on('exit', (exitCode: number) => {
          this.sendToSession(sessionId, {
            type: 'terminal:exited',
            terminalId: session.id,
            exitCode,
          });
          const terms = this.sessionTerminals.get(sessionId);
          if (terms) terms.delete(session.id);
          this.notifyStateChange();
        });

        this.send(ws, {
          type: 'terminal:created',
          terminal: session.getInfo(),
        });
        this.notifyStateChange();
        break;
      }

      case 'terminal:input': {
        const session = this.terminalManager.get(msg.terminalId);
        if (session) {
          session.write(msg.data);
        } else {
          this.send(ws, {
            type: 'error',
            message: `Terminal ${msg.terminalId} not found`,
          });
        }
        break;
      }

      case 'terminal:resize': {
        const session = this.terminalManager.get(msg.terminalId);
        if (session) {
          session.resize(msg.cols, msg.rows);
        }
        break;
      }

      case 'terminal:kill': {
        const killed = this.terminalManager.kill(msg.terminalId);
        if (!killed) {
          this.send(ws, {
            type: 'error',
            message: `Terminal ${msg.terminalId} not found`,
          });
        }
        this.notifyStateChange();
        break;
      }

      case 'terminal:list': {
        const sessionId = ws.sessionId!;
        const terminalIds = this.sessionTerminals.get(sessionId) ?? new Set();
        const terminals: TerminalInfo[] = [];
        for (const id of terminalIds) {
          const session = this.terminalManager.get(id);
          if (session) {
            terminals.push(session.getInfo());
          }
        }
        this.send(ws, { type: 'terminal:list', terminals });
        break;
      }

      default:
        this.send(ws, { type: 'error', message: 'Unknown message type' });
    }
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private sendToSession(sessionId: string, msg: ServerMessage): void {
    const ws = this.sessionSockets.get(sessionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  // === Public API for tray ===

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`Walkie-Talkie server running on port ${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.terminalManager.killAll();
    this.tokenManager.destroy();
    await this.tunnelManager.stop();

    return new Promise((resolve) => {
      this.wss.close(() => {
        this.server.close(() => resolve());
      });
    });
  }

  generateToken(): { token: string; expiresAt: number } {
    const magic = this.tokenManager.generate();
    this.notifyStateChange();
    return { token: magic.value, expiresAt: magic.expiresAt };
  }

  async getQRCode(): Promise<{ dataUrl: string; connectionUrl: string } | null> {
    const token = this.tokenManager.getActiveToken();
    if (!token) return null;

    const baseUrl = this.getBaseUrl();
    const dataUrl = await generateConnectionQR(baseUrl, token.value);
    const connectionUrl = buildConnectionUrl(baseUrl, token.value);
    return { dataUrl, connectionUrl };
  }

  async startTunnel(): Promise<string> {
    const url = await this.tunnelManager.start(this.port);
    this.notifyStateChange();
    return url;
  }

  async stopTunnel(): Promise<void> {
    await this.tunnelManager.stop();
    this.notifyStateChange();
  }

  getBaseUrl(): string {
    const tunnelUrl = this.tunnelManager.getUrl();
    if (tunnelUrl) return tunnelUrl;
    return `http://localhost:${this.port}`;
  }

  getState(): ServerState {
    const activeToken = this.tokenManager.getActiveToken();
    return {
      port: this.port,
      token: activeToken?.value ?? null,
      tokenExpiresAt: activeToken?.expiresAt ?? null,
      tunnelUrl: this.tunnelManager.getUrl(),
      terminalCount: this.terminalManager.count,
      sessionCount: this.tokenManager.sessionCount,
    };
  }
}

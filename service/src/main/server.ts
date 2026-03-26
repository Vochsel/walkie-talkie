import { createServer, generateConnectionQR, buildConnectionUrl } from '@walkie-talkie/server';
import { TunnelManager } from '../tunnel/ngrok';
import { DEFAULT_PORT } from '@walkie-talkie/shared';

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
  private handle: ReturnType<typeof createServer>;
  private tunnelManager: TunnelManager;
  private onStateChangeCb: StateChangeCallback | null = null;

  constructor(port: number = DEFAULT_PORT) {
    this.tunnelManager = new TunnelManager();
    this.handle = createServer(port);
    this.handle.onStateChange(() => this.notifyStateChange());
  }

  setStateChangeCallback(cb: StateChangeCallback): void {
    this.onStateChangeCb = cb;
  }

  private notifyStateChange(): void {
    this.onStateChangeCb?.(this.getState());
  }

  async start(): Promise<void> {
    await this.handle.start();
    console.log(`Walkie-Talkie server running on port ${this.handle.port}`);
  }

  async stop(): Promise<void> {
    await this.handle.stop();
    await this.tunnelManager.stop();
  }

  generateToken(): { token: string; expiresAt: number } {
    const t = this.handle.generateToken();
    this.notifyStateChange();
    return { token: t.value, expiresAt: t.expiresAt };
  }

  async getQRCode(): Promise<{ dataUrl: string; connectionUrl: string } | null> {
    const token = this.handle.getActiveToken();
    if (!token) return null;
    const baseUrl = this.getBaseUrl();
    const dataUrl = await generateConnectionQR(baseUrl, token.value);
    const connectionUrl = buildConnectionUrl(baseUrl, token.value);
    return { dataUrl, connectionUrl };
  }

  async startTunnel(): Promise<string> {
    const url = await this.tunnelManager.start(this.handle.port);
    this.notifyStateChange();
    return url;
  }

  async stopTunnel(): Promise<void> {
    await this.tunnelManager.stop();
    this.notifyStateChange();
  }

  getBaseUrl(): string {
    return this.tunnelManager.getUrl() ?? `http://localhost:${this.handle.port}`;
  }

  getState(): ServerState {
    const activeToken = this.handle.getActiveToken();
    return {
      port: this.handle.port,
      token: activeToken?.value ?? null,
      tokenExpiresAt: activeToken?.expiresAt ?? null,
      tunnelUrl: this.tunnelManager.getUrl(),
      terminalCount: this.handle.terminalCount,
      sessionCount: this.handle.sessionCount,
    };
  }
}

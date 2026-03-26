import ngrok from '@ngrok/ngrok';

export class TunnelManager {
  private listener: ngrok.Listener | null = null;

  async start(localPort: number): Promise<string> {
    if (this.listener) {
      await this.stop();
    }

    this.listener = await ngrok.forward({
      addr: localPort,
      authtoken_from_env: true, // reads NGROK_AUTHTOKEN
    });

    return this.listener.url()!;
  }

  async stop(): Promise<void> {
    if (this.listener) {
      await this.listener.close();
      this.listener = null;
    }
  }

  getUrl(): string | null {
    return this.listener?.url() ?? null;
  }

  get isActive(): boolean {
    return this.listener !== null;
  }
}

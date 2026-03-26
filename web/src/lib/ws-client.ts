import type { ClientMessage, ServerMessage } from '@walkie-talkie/shared';
import { WS_PATH, RECONNECT_BASE_MS, RECONNECT_MAX_MS } from '@walkie-talkie/shared';

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'reconnecting'
  | 'error';

export type MessageHandler = (msg: ServerMessage) => void;
export type StateHandler = (state: ConnectionState) => void;

export class WalkieTalkieClient {
  private ws: WebSocket | null = null;
  private _serverUrl: string = '';
  private token: string = '';
  private _sessionId: string | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private stateHandlers: Set<StateHandler> = new Set();
  private state: ConnectionState = 'disconnected';
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStateChange(handler: StateHandler): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  connect(serverUrl: string, token: string): void {
    this.intentionalClose = false;
    this._serverUrl = serverUrl;
    this.token = token;
    this._sessionId = null;
    this.doConnect();
  }

  resumeSession(serverUrl: string, sessionId: string): void {
    this.intentionalClose = false;
    this._serverUrl = serverUrl;
    this.token = '';
    this._sessionId = sessionId;
    this.doConnect();
  }

  disconnect(): void {
    this.intentionalClose = true;
    this._sessionId = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState('disconnected');
  }

  send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  getSessionId(): string | null {
    return this._sessionId;
  }

  getServerUrl(): string {
    return this._serverUrl;
  }

  getState(): ConnectionState {
    return this.state;
  }

  private doConnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    const httpUrl = this._serverUrl.replace(/\/$/, '');
    const wsUrl = httpUrl.replace(/^http/, 'ws') + WS_PATH;

    this.setState(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.setState('authenticating');
      this.reconnectAttempt = 0;

      if (this._sessionId) {
        this.send({ type: 'auth:resume', sessionId: this._sessionId });
      } else {
        this.send({ type: 'auth', token: this.token });
      }
    };

    this.ws.onmessage = (event) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === 'auth:ok') {
        this._sessionId = msg.sessionId;
        this.setState('connected');
      } else if (msg.type === 'auth:fail') {
        this._sessionId = null;
        this.setState('error');
        return;
      }

      for (const handler of this.messageHandlers) {
        handler(msg);
      }
    };

    this.ws.onclose = () => {
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {};
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempt),
      RECONNECT_MAX_MS
    );
    this.reconnectAttempt++;
    this.setState('reconnecting');

    this.reconnectTimer = setTimeout(() => {
      this.doConnect();
    }, delay);
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    for (const handler of this.stateHandlers) {
      handler(state);
    }
  }
}

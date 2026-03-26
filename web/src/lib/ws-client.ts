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
  private serverUrl: string = '';
  private token: string = '';
  private sessionId: string | null = null;
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
    this.serverUrl = serverUrl;
    this.token = token;
    this.doConnect();
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.sessionId = null;
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
    return this.sessionId;
  }

  getState(): ConnectionState {
    return this.state;
  }

  private doConnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Build WebSocket URL
    const httpUrl = this.serverUrl.replace(/\/$/, '');
    const wsUrl = httpUrl.replace(/^http/, 'ws') + WS_PATH;

    this.setState(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.setState('authenticating');
      this.reconnectAttempt = 0;

      // Try session resume first, then token auth
      if (this.sessionId) {
        this.send({ type: 'auth:resume', sessionId: this.sessionId });
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
        this.sessionId = msg.sessionId;
        this.setState('connected');
      } else if (msg.type === 'auth:fail') {
        this.sessionId = null;
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

    this.ws.onerror = () => {
      // onclose will fire after this
    };
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

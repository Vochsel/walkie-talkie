import { useState, useRef, useCallback, useEffect } from 'react';
import type { TerminalInfo, ServerMessage, SavedTerminal } from '@walkie-talkie/shared';
import {
  WalkieTalkieClient,
  ConnectionState,
  saveConnection,
  removeConnection,
} from '@walkie-talkie/client';

export type TerminalOutputHandler = (terminalId: string, data: string) => void;

export interface RestoreSnapshot {
  root: string;
  repoName: string;
  terminals: SavedTerminal[];
}

export function useWalkieTalkie() {
  const clientRef = useRef<WalkieTalkieClient | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [terminals, setTerminals] = useState<TerminalInfo[]>([]);
  const [isResuming, setIsResuming] = useState(false);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [restore, setRestore] = useState<RestoreSnapshot | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const outputHandlersRef = useRef<Map<string, (data: string) => void>>(new Map());
  const outputBuffersRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const client = new WalkieTalkieClient();
    clientRef.current = client;

    const unsubState = client.onStateChange((state) => {
      setConnectionState(state);
      setErrorReason(client.errorReason);

      // Sync resume flag from client (covers both explicit resume and auto-reconnect)
      if (state === 'connected') {
        setIsResuming(client.isResuming);
      } else if (state === 'error' || state === 'disconnected') {
        // If resume failed, remove the stale session so we don't retry it
        if (state === 'error' && client.isResuming) {
          const serverUrl = client.getServerUrl();
          if (serverUrl) removeConnection(serverUrl);
        }
        setIsResuming(false);
      }

      if (state === 'connected') {
        const sid = client.getSessionId();
        const url = client.getServerUrl();
        setSessionId(sid);
        setServerUrl(url || null);
        if (sid && url) {
          saveConnection({
            serverUrl: url,
            sessionId: sid,
            connectedAt: Date.now(),
          });
        }
      } else if (state === 'disconnected') {
        setSessionId(null);
        setServerUrl(null);
      }
    });

    const unsubMsg = client.onMessage((msg: ServerMessage) => {
      switch (msg.type) {
        case 'terminal:output': {
          const buf = outputBuffersRef.current.get(msg.terminalId) ?? '';
          const updated = buf + msg.data;
          outputBuffersRef.current.set(
            msg.terminalId,
            updated.length > 100_000 ? updated.slice(-100_000) : updated
          );
          const handler = outputHandlersRef.current.get(msg.terminalId);
          if (handler) handler(msg.data);
          break;
        }
        case 'terminal:created':
          setTerminals((prev) => [...prev, msg.terminal]);
          break;
        case 'terminal:exited':
          setTerminals((prev) => prev.filter((t) => t.id !== msg.terminalId));
          outputHandlersRef.current.delete(msg.terminalId);
          outputBuffersRef.current.delete(msg.terminalId);
          break;
        case 'terminal:renamed':
          setTerminals((prev) =>
            prev.map((t) => t.id === msg.terminalId ? { ...t, name: msg.name } : t)
          );
          break;
        case 'terminal:list':
          setTerminals(msg.terminals);
          setIsResuming(false);
          break;
        case 'session:restore':
          setRestore({ root: msg.root, repoName: msg.repoName, terminals: msg.terminals });
          break;
      }
    });

    return () => {
      unsubState();
      unsubMsg();
      client.disconnect();
    };
  }, []);

  const connect = useCallback((serverUrl: string, token: string) => {
    clientRef.current?.connect(serverUrl, token);
  }, []);

  const resumeSession = useCallback((serverUrl: string, sessionId: string) => {
    clientRef.current?.resumeSession(serverUrl, sessionId);
  }, []);

  const disconnect = useCallback(() => {
    const url = clientRef.current?.getServerUrl();
    clientRef.current?.disconnect();
    setTerminals([]);
    setRestore(null);
    outputHandlersRef.current.clear();
    outputBuffersRef.current.clear();
    if (url) removeConnection(url);
  }, []);

  const createTerminal = useCallback(
    (cols: number, rows: number, opts?: { name?: string; cwd?: string }) => {
      clientRef.current?.send({ type: 'terminal:create', cols, rows, ...opts });
    },
    []
  );

  const sendInput = useCallback((terminalId: string, data: string) => {
    clientRef.current?.send({ type: 'terminal:input', terminalId, data });
  }, []);

  const resizeTerminal = useCallback((terminalId: string, cols: number, rows: number) => {
    clientRef.current?.send({ type: 'terminal:resize', terminalId, cols, rows });
  }, []);

  const killTerminal = useCallback((terminalId: string) => {
    clientRef.current?.send({ type: 'terminal:kill', terminalId });
  }, []);

  const renameTerminal = useCallback((terminalId: string, name: string) => {
    clientRef.current?.send({ type: 'terminal:rename', terminalId, name });
  }, []);

  const listTerminals = useCallback(() => {
    clientRef.current?.send({ type: 'terminal:list' });
  }, []);

  const registerOutputHandler = useCallback(
    (terminalId: string, handler: (data: string) => void) => {
      outputHandlersRef.current.set(terminalId, handler);
      const buffer = outputBuffersRef.current.get(terminalId);
      if (buffer) handler(buffer);
      return () => {
        outputHandlersRef.current.delete(terminalId);
      };
    },
    []
  );

  return {
    connectionState,
    terminals,
    isResuming,
    errorReason,
    restore,
    serverUrl,
    sessionId,
    connect,
    resumeSession,
    disconnect,
    createTerminal,
    sendInput,
    resizeTerminal,
    killTerminal,
    renameTerminal,
    listTerminals,
    registerOutputHandler,
  };
}

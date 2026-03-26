'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { TerminalInfo, ServerMessage } from '@walkie-talkie/shared';
import { WalkieTalkieClient, ConnectionState } from '@/lib/ws-client';

export type TerminalOutputHandler = (terminalId: string, data: string) => void;

export function useWalkieTalkie() {
  const clientRef = useRef<WalkieTalkieClient | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [terminals, setTerminals] = useState<TerminalInfo[]>([]);
  const outputHandlersRef = useRef<Map<string, (data: string) => void>>(new Map());

  useEffect(() => {
    const client = new WalkieTalkieClient();
    clientRef.current = client;

    const unsubState = client.onStateChange((state) => {
      setConnectionState(state);
    });

    const unsubMsg = client.onMessage((msg: ServerMessage) => {
      switch (msg.type) {
        case 'terminal:output': {
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
          break;
        case 'terminal:list':
          setTerminals(msg.terminals);
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

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    setTerminals([]);
    outputHandlersRef.current.clear();
  }, []);

  const createTerminal = useCallback((cols: number, rows: number) => {
    clientRef.current?.send({ type: 'terminal:create', cols, rows });
  }, []);

  const sendInput = useCallback((terminalId: string, data: string) => {
    clientRef.current?.send({ type: 'terminal:input', terminalId, data });
  }, []);

  const resizeTerminal = useCallback((terminalId: string, cols: number, rows: number) => {
    clientRef.current?.send({ type: 'terminal:resize', terminalId, cols, rows });
  }, []);

  const killTerminal = useCallback((terminalId: string) => {
    clientRef.current?.send({ type: 'terminal:kill', terminalId });
  }, []);

  const listTerminals = useCallback(() => {
    clientRef.current?.send({ type: 'terminal:list' });
  }, []);

  const registerOutputHandler = useCallback(
    (terminalId: string, handler: (data: string) => void) => {
      outputHandlersRef.current.set(terminalId, handler);
      return () => {
        outputHandlersRef.current.delete(terminalId);
      };
    },
    []
  );

  return {
    connectionState,
    terminals,
    connect,
    disconnect,
    createTerminal,
    sendInput,
    resizeTerminal,
    killTerminal,
    listTerminals,
    registerOutputHandler,
  };
}

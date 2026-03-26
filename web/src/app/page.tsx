'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useWalkieTalkie } from '@/hooks/useWalkieTalkie';
import ConnectScreen from '@/components/ConnectScreen';
import TerminalTabs from '@/components/TerminalTabs';
import ConnectionStatus from '@/components/ConnectionStatus';

const TerminalView = dynamic(() => import('@/components/TerminalView'), {
  ssr: false,
});

function AppContent() {
  const searchParams = useSearchParams();
  const {
    connectionState,
    terminals,
    connect,
    disconnect,
    createTerminal,
    sendInput,
    resizeTerminal,
    killTerminal,
    registerOutputHandler,
  } = useWalkieTalkie();

  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Auto-connect from QR code URL params
  useEffect(() => {
    const token = searchParams.get('token');
    const server = searchParams.get('server');
    if (token) {
      const serverUrl = server || `${window.location.protocol}//${window.location.hostname}:3456`;
      connect(serverUrl, token);
    }
  }, [searchParams, connect]);

  // When we connect, request a terminal
  useEffect(() => {
    if (connectionState === 'connected' && terminals.length === 0) {
      createTerminal(80, 24);
    }
  }, [connectionState, terminals.length, createTerminal]);

  // Auto-select first terminal or maintain selection
  useEffect(() => {
    if (terminals.length > 0) {
      if (!activeTerminalId || !terminals.find((t) => t.id === activeTerminalId)) {
        setActiveTerminalId(terminals[0].id);
      }
    } else {
      setActiveTerminalId(null);
    }
  }, [terminals, activeTerminalId]);

  // Track auth errors
  useEffect(() => {
    if (connectionState === 'error') {
      setConnectError('Authentication failed. Token may be expired or invalid.');
    }
  }, [connectionState]);

  const handleConnect = useCallback(
    (serverUrl: string, token: string) => {
      setConnectError(null);
      connect(serverUrl, token);
    },
    [connect]
  );

  const handleNewTerminal = useCallback(() => {
    createTerminal(80, 24);
  }, [createTerminal]);

  // Show connect screen if not connected
  if (connectionState === 'disconnected' || connectionState === 'error') {
    return <ConnectScreen onConnect={handleConnect} error={connectError} />;
  }

  // Loading state while connecting
  if (connectionState === 'connecting' || connectionState === 'authenticating') {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>
          {connectionState === 'connecting' ? 'Connecting...' : 'Authenticating...'}
        </p>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <TerminalTabs
        terminals={terminals}
        activeId={activeTerminalId}
        onSelect={setActiveTerminalId}
        onClose={killTerminal}
        onCreate={handleNewTerminal}
      />

      <div style={styles.terminalArea}>
        {terminals.map((term) => (
          <TerminalView
            key={term.id}
            terminalId={term.id}
            isActive={term.id === activeTerminalId}
            onInput={(data) => sendInput(term.id, data)}
            onResize={(cols, rows) => resizeTerminal(term.id, cols, rows)}
            registerOutput={(handler) => registerOutputHandler(term.id, handler)}
          />
        ))}
        {terminals.length === 0 && (
          <div style={styles.empty}>
            <p>No terminals open</p>
            <button style={styles.createBtn} onClick={handleNewTerminal}>
              Create Terminal
            </button>
          </div>
        )}
      </div>

      <ConnectionStatus state={connectionState} onDisconnect={disconnect} />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div style={styles.loading}>
          <div style={styles.spinner} />
        </div>
      }
    >
      <AppContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
  },
  terminalArea: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#8b949e',
    gap: 16,
  },
  createBtn: {
    background: '#00d4aa',
    color: '#0d1117',
    border: 'none',
    borderRadius: 6,
    padding: '8px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    gap: 16,
  },
  loadingText: {
    color: '#8b949e',
    fontSize: 14,
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #30363d',
    borderTopColor: '#00d4aa',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};

// Add keyframe animation via a style tag
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(styleEl);
}

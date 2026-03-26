'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useWalkieTalkie } from '@/hooks/useWalkieTalkie';
import ConnectScreen from '@/components/ConnectScreen';
import ConnectionStatus from '@/components/ConnectionStatus';
import ViewSwitcher, { ViewType } from '@/components/ViewSwitcher';
import { getSavedConnections } from '@/lib/storage';
import { usePersistedState } from '@/hooks/usePersistedState';

const ClassicView = dynamic(() => import('@/components/views/ClassicView'), { ssr: false });
const SidebarView = dynamic(() => import('@/components/views/SidebarView'), { ssr: false });
const WhiteboardView = dynamic(() => import('@/components/views/WhiteboardView'), { ssr: false });
const MinecraftView = dynamic(() => import('@/components/views/MinecraftView'), { ssr: false });
const RpgView = dynamic(() => import('@/components/views/RpgView'), { ssr: false });

export interface ViewProps {
  terminals: ReturnType<typeof useWalkieTalkie>['terminals'];
  activeTerminalId: string | null;
  setActiveTerminalId: (id: string | null) => void;
  sendInput: ReturnType<typeof useWalkieTalkie>['sendInput'];
  resizeTerminal: ReturnType<typeof useWalkieTalkie>['resizeTerminal'];
  killTerminal: ReturnType<typeof useWalkieTalkie>['killTerminal'];
  createTerminal: ReturnType<typeof useWalkieTalkie>['createTerminal'];
  registerOutputHandler: ReturnType<typeof useWalkieTalkie>['registerOutputHandler'];
}

function AppContent() {
  const searchParams = useSearchParams();
  const {
    connectionState,
    terminals,
    isResuming,
    connect,
    resumeSession,
    disconnect,
    createTerminal,
    sendInput,
    resizeTerminal,
    killTerminal,
    registerOutputHandler,
  } = useWalkieTalkie();

  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [currentView, setCurrentView] = usePersistedState<ViewType>('view', 'classic');

  const autoResumedRef = useRef(false);

  // Auto-connect from URL params or resume saved session
  useEffect(() => {
    if (!autoResumedRef.current) {
      autoResumedRef.current = true;

      const token = searchParams.get('token');
      const server = searchParams.get('server');

      // Token in URL = fresh connect (QR code link)
      if (token) {
        const serverUrl = server || `${window.location.protocol}//${window.location.hostname}:3456`;
        connect(serverUrl, token);
        return;
      }

      // No token in URL — try resuming most recent saved session
      const saved = getSavedConnections();
      if (saved.length > 0) {
        const recent = saved[0];
        if (Date.now() - recent.connectedAt < 24 * 60 * 60 * 1000) {
          resumeSession(recent.serverUrl, recent.sessionId);
        }
      }
    }
  }, [searchParams, connect, resumeSession]);

  // Strip token from URL after successful auth so refreshes use session resume
  useEffect(() => {
    if (connectionState === 'connected' && searchParams.get('token')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [connectionState, searchParams]);

  // When we fresh-connect (not resume), create a terminal.
  // On resume, wait for the server to send terminal:list first.
  useEffect(() => {
    if (connectionState === 'connected' && terminals.length === 0 && !isResuming) {
      createTerminal(80, 24);
    }
  }, [connectionState, terminals.length, createTerminal, isResuming]);

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

  useEffect(() => {
    if (connectionState === 'error') {
      setConnectError('Authentication failed. Session may have expired — try a new token.');
    }
  }, [connectionState]);

  const handleConnect = useCallback(
    (serverUrl: string, token: string) => {
      setConnectError(null);
      connect(serverUrl, token);
    },
    [connect]
  );

  const handleResume = useCallback(
    (serverUrl: string, sessionId: string) => {
      setConnectError(null);
      resumeSession(serverUrl, sessionId);
    },
    [resumeSession]
  );

  if (connectionState === 'disconnected' || connectionState === 'error') {
    return <ConnectScreen onConnect={handleConnect} onResume={handleResume} error={connectError} />;
  }

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

  const viewProps: ViewProps = {
    terminals,
    activeTerminalId,
    setActiveTerminalId,
    sendInput,
    resizeTerminal,
    killTerminal,
    createTerminal,
    registerOutputHandler,
  };

  return (
    <div style={styles.app}>
      <ViewSwitcher current={currentView} onChange={setCurrentView} />

      <div style={styles.viewArea}>
        {currentView === 'classic' && <ClassicView {...viewProps} />}
        {currentView === 'sidebar' && <SidebarView {...viewProps} />}
        {currentView === 'whiteboard' && <WhiteboardView {...viewProps} />}
        {currentView === 'minecraft' && <MinecraftView {...viewProps} />}
        {currentView === 'rpg' && <RpgView {...viewProps} />}
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
  viewArea: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
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

if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(styleEl);
}

'use client';

import type { ConnectionState } from '@/lib/ws-client';

interface ConnectionStatusProps {
  state: ConnectionState;
  onDisconnect: () => void;
}

const STATUS_CONFIG: Record<ConnectionState, { color: string; label: string }> = {
  disconnected: { color: '#484f58', label: 'Disconnected' },
  connecting: { color: '#d29922', label: 'Connecting...' },
  authenticating: { color: '#d29922', label: 'Authenticating...' },
  connected: { color: '#3fb950', label: 'Connected' },
  reconnecting: { color: '#d29922', label: 'Reconnecting...' },
  error: { color: '#f85149', label: 'Error' },
};

export default function ConnectionStatus({ state, onDisconnect }: ConnectionStatusProps) {
  const config = STATUS_CONFIG[state];

  return (
    <div style={styles.container}>
      <div style={styles.indicator}>
        <div
          style={{
            ...styles.dot,
            backgroundColor: config.color,
            boxShadow: `0 0 6px ${config.color}`,
          }}
        />
        <span style={{ ...styles.label, color: config.color }}>
          {config.label}
        </span>
      </div>
      {state === 'connected' && (
        <button style={styles.disconnectBtn} onClick={onDisconnect}>
          Disconnect
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    background: '#161b22',
    borderTop: '1px solid #30363d',
    height: 32,
    flexShrink: 0,
  },
  indicator: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  label: {
    fontSize: 12,
    fontFamily: "'SF Mono', monospace",
  },
  disconnectBtn: {
    background: 'none',
    border: '1px solid #30363d',
    color: '#8b949e',
    cursor: 'pointer',
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 4,
  },
};

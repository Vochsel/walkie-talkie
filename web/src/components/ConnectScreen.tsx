'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_PORT } from '@walkie-talkie/shared';
import QRScanner from './QRScanner';
import {
  getSavedConnections,
  removeConnection,
  SavedConnection,
} from '@/lib/storage';

interface ConnectScreenProps {
  onConnect: (serverUrl: string, token: string) => void;
  onResume: (serverUrl: string, sessionId: string) => void;
  error?: string | null;
}

export default function ConnectScreen({ onConnect, onResume, error }: ConnectScreenProps) {
  const [serverUrl, setServerUrl] = useState(`http://localhost:${DEFAULT_PORT}`);
  const [token, setToken] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [saved, setSaved] = useState<SavedConnection[]>([]);

  useEffect(() => {
    setSaved(getSavedConnections());
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (serverUrl && token) {
      onConnect(serverUrl, token);
    }
  };

  const handleQRScan = (scannedUrl: string) => {
    setShowScanner(false);
    try {
      const url = new URL(scannedUrl);
      const scannedToken = url.searchParams.get('token');
      if (scannedToken) {
        const base = `${url.protocol}//${url.host}`;
        setServerUrl(base);
        setToken(scannedToken);
        onConnect(base, scannedToken);
      }
    } catch {
      setToken(scannedUrl);
    }
  };

  const handleResume = (conn: SavedConnection) => {
    onResume(conn.serverUrl, conn.sessionId);
  };

  const handleRemoveSaved = (serverUrl: string) => {
    removeConnection(serverUrl);
    setSaved(getSavedConnections());
  };

  const timeAgo = (ms: number): string => {
    const secs = Math.floor((Date.now() - ms) / 1000);
    if (secs < 60) return 'just now';
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="4" y="8" width="40" height="32" rx="4" stroke="#00d4aa" strokeWidth="2" fill="none" />
            <path d="M12 20l6 4-6 4" stroke="#00d4aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="22" y1="28" x2="32" y2="28" stroke="#00d4aa" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        <h1 style={styles.title}>Walkie-Talkie</h1>
        <p style={styles.subtitle}>Remote terminal access</p>

        {/* Saved connections */}
        {saved.length > 0 && (
          <div style={styles.savedSection}>
            <div style={styles.savedHeader}>Recent connections</div>
            {saved.map((conn) => (
              <div key={conn.serverUrl} style={styles.savedItem}>
                <button
                  style={styles.savedBtn}
                  onClick={() => handleResume(conn)}
                >
                  <span style={styles.savedUrl}>{conn.serverUrl.replace(/^https?:\/\//, '')}</span>
                  <span style={styles.savedTime}>{timeAgo(conn.connectedAt)}</span>
                </button>
                <button
                  style={styles.savedRemove}
                  onClick={() => handleRemoveSaved(conn.serverUrl)}
                  title="Remove"
                >
                  &times;
                </button>
              </div>
            ))}
            <div style={styles.divider}>
              <span style={styles.dividerText}>or connect with token</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Server URL</label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://localhost:3456"
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Token</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="xxxx-xxxx-xxxx-xxxx"
              style={{
                ...styles.input,
                fontFamily: "'SF Mono', monospace",
                letterSpacing: 1,
              }}
              autoFocus
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button
            type="submit"
            style={{ ...styles.connectBtn, opacity: serverUrl && token ? 1 : 0.5 }}
            disabled={!serverUrl || !token}
          >
            Connect
          </button>

          <button
            type="button"
            style={styles.scanBtn}
            onClick={() => setShowScanner(true)}
          >
            Scan QR Code
          </button>
        </form>
      </div>

      {showScanner && (
        <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', background: '#0d1117',
  },
  card: {
    background: '#161b22', border: '1px solid #30363d', borderRadius: 12,
    padding: '40px 36px', width: 400, textAlign: 'center' as const,
  },
  logo: { marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 700, color: '#e6edf3', margin: 0 },
  subtitle: { fontSize: 14, color: '#8b949e', marginTop: 4, marginBottom: 24 },
  savedSection: { marginBottom: 8 },
  savedHeader: {
    fontSize: 11, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase' as const,
    letterSpacing: 0.5, marginBottom: 8, textAlign: 'left' as const,
  },
  savedItem: {
    display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6,
  },
  savedBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
    padding: '10px 12px', cursor: 'pointer', transition: 'border-color 0.15s',
    color: '#e6edf3',
  },
  savedUrl: {
    fontSize: 13, fontFamily: "'SF Mono', monospace", color: '#00d4aa',
  },
  savedTime: {
    fontSize: 11, color: '#484f58',
  },
  savedRemove: {
    background: 'none', border: 'none', color: '#484f58', cursor: 'pointer',
    fontSize: 16, padding: '4px 6px', lineHeight: 1, borderRadius: 4,
    transition: 'color 0.15s',
  },
  divider: {
    display: 'flex', alignItems: 'center', margin: '16px 0 12px',
    gap: 12,
  },
  dividerText: {
    fontSize: 11, color: '#484f58', whiteSpace: 'nowrap' as const,
    flex: 1, textAlign: 'center' as const,
    borderTop: '1px solid #30363d', paddingTop: 12,
  },
  form: { display: 'flex', flexDirection: 'column' as const, gap: 16 },
  field: { display: 'flex', flexDirection: 'column' as const, gap: 6, textAlign: 'left' as const },
  label: {
    fontSize: 12, fontWeight: 500, color: '#8b949e',
    textTransform: 'uppercase' as const, letterSpacing: 0.5,
  },
  input: {
    background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
    padding: '10px 12px', color: '#e6edf3', fontSize: 14, outline: 'none',
    transition: 'border-color 0.15s',
  },
  error: {
    background: '#f8514933', border: '1px solid #f85149', borderRadius: 6,
    padding: '8px 12px', color: '#f85149', fontSize: 13,
  },
  connectBtn: {
    background: '#00d4aa', color: '#0d1117', border: 'none', borderRadius: 6,
    padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  scanBtn: {
    background: 'none', border: '1px solid #30363d', borderRadius: 6,
    padding: '10px', color: '#8b949e', fontSize: 14, cursor: 'pointer',
  },
};

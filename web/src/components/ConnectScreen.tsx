'use client';

import { useState } from 'react';
import { DEFAULT_PORT } from '@walkie-talkie/shared';
import QRScanner from './QRScanner';

interface ConnectScreenProps {
  onConnect: (serverUrl: string, token: string) => void;
  error?: string | null;
}

export default function ConnectScreen({ onConnect, error }: ConnectScreenProps) {
  const [serverUrl, setServerUrl] = useState(`http://localhost:${DEFAULT_PORT}`);
  const [token, setToken] = useState('');
  const [showScanner, setShowScanner] = useState(false);

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
        // Extract the base URL (without query params)
        const base = `${url.protocol}//${url.host}`;
        setServerUrl(base);
        setToken(scannedToken);
        onConnect(base, scannedToken);
      }
    } catch {
      // Not a valid URL, try using as plain token
      setToken(scannedUrl);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect
              x="4"
              y="8"
              width="40"
              height="32"
              rx="4"
              stroke="#00d4aa"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M12 20l6 4-6 4"
              stroke="#00d4aa"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line
              x1="22"
              y1="28"
              x2="32"
              y2="28"
              stroke="#00d4aa"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <h1 style={styles.title}>Walkie-Talkie</h1>
        <p style={styles.subtitle}>Remote terminal access</p>

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
            style={{
              ...styles.connectBtn,
              opacity: serverUrl && token ? 1 : 0.5,
            }}
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
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: '#0d1117',
  },
  card: {
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: 12,
    padding: '40px 36px',
    width: 380,
    textAlign: 'center' as const,
  },
  logo: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: '#e6edf3',
    margin: 0,
  },
  subtitle: {
    fontSize: 14,
    color: '#8b949e',
    marginTop: 4,
    marginBottom: 28,
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    textAlign: 'left' as const,
  },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: '#8b949e',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  input: {
    background: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: 6,
    padding: '10px 12px',
    color: '#e6edf3',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  error: {
    background: '#f8514933',
    border: '1px solid #f85149',
    borderRadius: 6,
    padding: '8px 12px',
    color: '#f85149',
    fontSize: 13,
  },
  connectBtn: {
    background: '#00d4aa',
    color: '#0d1117',
    border: 'none',
    borderRadius: 6,
    padding: '10px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  scanBtn: {
    background: 'none',
    border: '1px solid #30363d',
    borderRadius: 6,
    padding: '10px',
    color: '#8b949e',
    fontSize: 14,
    cursor: 'pointer',
  },
};

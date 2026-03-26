'use client';

import { useEffect, useRef, useState } from 'react';

interface QRScannerProps {
  onScan: (url: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mounted || !containerRef.current) return;

        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            onScan(decodedText);
            scanner.stop().catch(() => {});
          },
          () => {} // ignore scan failures
        );
      } catch (err: any) {
        if (mounted) {
          setError(err?.message || 'Failed to start camera');
        }
      }
    }

    startScanner();

    return () => {
      mounted = false;
      scannerRef.current?.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3 style={styles.title}>Scan QR Code</h3>
          <button style={styles.closeBtn} onClick={onClose}>
            &times;
          </button>
        </div>
        {error ? (
          <div style={styles.error}>
            <p>{error}</p>
            <p style={{ fontSize: 12, marginTop: 8, color: '#8b949e' }}>
              Make sure camera permissions are granted
            </p>
          </div>
        ) : (
          <div
            id="qr-reader"
            ref={containerRef}
            style={styles.scanner}
          />
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: '#161b22',
    borderRadius: 12,
    border: '1px solid #30363d',
    width: 340,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #30363d',
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    color: '#e6edf3',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#8b949e',
    fontSize: 20,
    cursor: 'pointer',
  },
  scanner: {
    width: '100%',
    minHeight: 300,
  },
  error: {
    padding: 24,
    textAlign: 'center' as const,
    color: '#f85149',
  },
};

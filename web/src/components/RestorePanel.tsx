'use client';

import { useState } from 'react';
import type { SavedTerminal } from '@walkie-talkie/shared';
import type { RestoreSnapshot } from '@/hooks/useWalkieTalkie';

interface RestorePanelProps {
  restore: RestoreSnapshot;
  onReopen: (terminal: SavedTerminal) => void;
  onDismiss: () => void;
}

function displayName(t: SavedTerminal): string {
  return t.name || t.shell.split('/').pop() || 'shell';
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

/**
 * Shown after connecting to a repo that has a previous session on disk.
 * Lists prior terminal tabs + their recent commands and offers to reopen
 * each as a fresh shell (nothing is re-run automatically).
 */
export default function RestorePanel({ restore, onReopen, onDismiss }: RestorePanelProps) {
  const [reopened, setReopened] = useState<Set<number>>(new Set());

  const reopen = (terminal: SavedTerminal, idx: number) => {
    onReopen(terminal);
    setReopened((prev) => new Set(prev).add(idx));
  };

  const reopenAll = () => {
    restore.terminals.forEach((t, i) => {
      if (!reopened.has(i)) onReopen(t);
    });
    setReopened(new Set(restore.terminals.map((_, i) => i)));
  };

  return (
    <div style={styles.overlay} onClick={onDismiss}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.head}>
          <div>
            <div style={styles.title}>Welcome back to {restore.repoName || 'this project'}</div>
            <div style={styles.subtitle}>
              {restore.terminals.length} terminal{restore.terminals.length === 1 ? '' : 's'} from your
              last session — reopen them to pick up where you left off.
            </div>
          </div>
          <button style={styles.closeBtn} onClick={onDismiss} title="Start fresh">
            &times;
          </button>
        </div>

        <div style={styles.list}>
          {restore.terminals.map((t, i) => (
            <div key={i} style={styles.card}>
              <div style={styles.cardHead}>
                <div style={styles.cardTitleWrap}>
                  <span style={styles.cardTitle}>{displayName(t)}</span>
                  <span style={styles.cardCwd}>{t.cwd}</span>
                  <span style={styles.cardTime}>{timeAgo(t.lastActive)}</span>
                </div>
                <button
                  style={{ ...styles.reopenBtn, ...(reopened.has(i) ? styles.reopenedBtn : {}) }}
                  onClick={() => reopen(t, i)}
                  disabled={reopened.has(i)}
                >
                  {reopened.has(i) ? 'Reopened' : 'Reopen'}
                </button>
              </div>
              {t.recentCommands.length > 0 && (
                <div style={styles.commands}>
                  {t.recentCommands.slice(-5).map((cmd, j) => (
                    <div key={j} style={styles.command}>
                      <span style={styles.prompt}>$</span> {cmd}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={styles.footer}>
          <button style={styles.ghostBtn} onClick={onDismiss}>
            Start fresh
          </button>
          <button style={styles.primaryBtn} onClick={reopenAll}>
            Reopen all
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: 16,
  },
  modal: {
    width: 'min(560px, 100%)',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    color: 'var(--text-primary)',
  },
  head: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: '16px 18px',
    borderBottom: '1px solid var(--border)',
  },
  title: { fontSize: 16, fontWeight: 600 },
  subtitle: { fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: 22,
    cursor: 'pointer',
    lineHeight: 1,
    flexShrink: 0,
  },
  list: { overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 },
  card: {
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--bg-secondary)',
    padding: 12,
  },
  cardHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardTitleWrap: { display: 'flex', alignItems: 'baseline', gap: 8, overflow: 'hidden', flexWrap: 'wrap' },
  cardTitle: { fontSize: 14, fontWeight: 600, fontFamily: "'SF Mono', monospace" },
  cardCwd: { fontSize: 12, color: 'var(--text-muted)', fontFamily: "'SF Mono', monospace" },
  cardTime: { fontSize: 11, color: 'var(--text-muted)' },
  reopenBtn: {
    background: 'var(--accent)',
    color: 'var(--bg-primary)',
    border: 'none',
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  reopenedBtn: { background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'default' },
  commands: {
    marginTop: 8,
    paddingTop: 8,
    borderTop: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  command: {
    fontFamily: "'SF Mono', 'Fira Code', Menlo, monospace",
    fontSize: 12,
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  prompt: { color: 'var(--accent)' },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '12px 18px',
    borderTop: '1px solid var(--border)',
  },
  ghostBtn: {
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: 13,
    cursor: 'pointer',
  },
  primaryBtn: {
    background: 'var(--accent)',
    color: 'var(--bg-primary)',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
};

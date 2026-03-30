'use client';

import { useState } from 'react';
import type { TerminalInfo } from '@walkie-talkie/shared';

interface TerminalTabsProps {
  terminals: TerminalInfo[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onCreate: () => void;
  onRename?: (id: string, name: string) => void;
}

export default function TerminalTabs({
  terminals,
  activeId,
  onSelect,
  onClose,
  onCreate,
  onRename,
}: TerminalTabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const getDisplayName = (term: TerminalInfo, idx: number) =>
    term.name || `${term.shell.split('/').pop()} #${idx + 1}`;

  const startEditing = (term: TerminalInfo, idx: number) => {
    if (!onRename) return;
    setEditingId(term.id);
    setEditValue(term.name || `${term.shell.split('/').pop()} #${idx + 1}`);
  };

  const commitEdit = (id: string) => {
    const trimmed = editValue.trim();
    if (trimmed && onRename) onRename(id, trimmed);
    setEditingId(null);
  };

  return (
    <div style={styles.container}>
      <div style={styles.tabs}>
        {terminals.map((term, idx) => (
          <div
            key={term.id}
            style={{
              ...styles.tab,
              ...(term.id === activeId ? styles.activeTab : {}),
            }}
            onClick={() => onSelect(term.id)}
          >
            {editingId === term.id ? (
              <input
                style={styles.tabInput}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => commitEdit(term.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit(term.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <span
                style={styles.tabLabel}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startEditing(term, idx);
                }}
              >
                {getDisplayName(term, idx)}
              </span>
            )}
            <button
              style={styles.closeBtn}
              onClick={(e) => {
                e.stopPropagation();
                onClose(term.id);
              }}
              title="Close terminal"
            >
              &times;
            </button>
          </div>
        ))}
        <button
          style={styles.newBtn}
          onClick={onCreate}
          title="New terminal"
        >
          +
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    padding: '0',
    display: 'flex',
    alignItems: 'stretch',
    height: 38,
    flexShrink: 0,
  },
  tabs: {
    display: 'flex',
    alignItems: 'stretch',
    gap: 0,
    flex: 1,
    overflow: 'auto',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 12px',
    cursor: 'pointer',
    borderRight: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    userSelect: 'none' as const,
    transition: 'background 0.15s',
  },
  activeTab: {
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    borderBottom: '2px solid var(--accent)',
  },
  tabLabel: {
    whiteSpace: 'nowrap' as const,
    fontFamily: "'SF Mono', monospace",
  },
  tabInput: {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 3,
    color: 'var(--text-primary)',
    fontSize: 13,
    fontFamily: "'SF Mono', monospace",
    padding: '1px 4px',
    outline: 'none',
    width: 120,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: 16,
    padding: '0 2px',
    lineHeight: 1,
  },
  newBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: 18,
    padding: '0 14px',
    lineHeight: 1,
  },
};

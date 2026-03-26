'use client';

import type { TerminalInfo } from '@walkie-talkie/shared';

interface TerminalTabsProps {
  terminals: TerminalInfo[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onCreate: () => void;
}

export default function TerminalTabs({
  terminals,
  activeId,
  onSelect,
  onClose,
  onCreate,
}: TerminalTabsProps) {
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
            <span style={styles.tabLabel}>
              {term.shell.split('/').pop()} #{idx + 1}
            </span>
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
    background: '#161b22',
    borderBottom: '1px solid #30363d',
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
    borderRight: '1px solid #30363d',
    color: '#8b949e',
    fontSize: 13,
    userSelect: 'none' as const,
    transition: 'background 0.15s',
  },
  activeTab: {
    background: '#0d1117',
    color: '#e6edf3',
    borderBottom: '2px solid #00d4aa',
  },
  tabLabel: {
    whiteSpace: 'nowrap' as const,
    fontFamily: "'SF Mono', monospace",
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#484f58',
    cursor: 'pointer',
    fontSize: 16,
    padding: '0 2px',
    lineHeight: 1,
  },
  newBtn: {
    background: 'none',
    border: 'none',
    color: '#8b949e',
    cursor: 'pointer',
    fontSize: 18,
    padding: '0 14px',
    lineHeight: 1,
  },
};

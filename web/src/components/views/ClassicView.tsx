'use client';

import type { ViewProps } from '@/app/page';
import TerminalTabs from '@/components/TerminalTabs';
import TerminalView from '@/components/TerminalView';

export default function ClassicView({
  terminals,
  activeTerminalId,
  setActiveTerminalId,
  sendInput,
  resizeTerminal,
  killTerminal,
  renameTerminal,
  createTerminal,
  registerOutputHandler,
}: ViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TerminalTabs
        terminals={terminals}
        activeId={activeTerminalId}
        onSelect={setActiveTerminalId}
        onClose={killTerminal}
        onCreate={() => createTerminal(80, 24)}
        onRename={renameTerminal}
      />
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
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
            <button style={styles.createBtn} onClick={() => createTerminal(80, 24)}>
              Create Terminal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-secondary)',
    gap: 16,
  },
  createBtn: {
    background: 'var(--accent)',
    color: 'var(--bg-primary)',
    border: 'none',
    borderRadius: 6,
    padding: '8px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
};

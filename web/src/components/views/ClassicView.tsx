'use client';

import { useState } from 'react';
import type { ViewProps } from '@/app/page';
import TerminalTabs from '@/components/TerminalTabs';
import TerminalView from '@/components/TerminalView';
import FileBrowser from '@/components/FileBrowser';

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
  serverUrl,
  sessionId,
}: ViewProps) {
  const [showFiles, setShowFiles] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <TerminalTabs
        terminals={terminals}
        activeId={activeTerminalId}
        onSelect={setActiveTerminalId}
        onClose={killTerminal}
        onCreate={() => createTerminal(80, 24)}
        onRename={renameTerminal}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {showFiles && (
          <FileBrowser
            serverUrl={serverUrl}
            sessionId={sessionId}
            onClose={() => setShowFiles(false)}
            style={{
              width: 360,
              minWidth: 280,
              borderRadius: 0,
              borderTop: 'none',
              borderBottom: 'none',
              borderLeft: 'none',
            }}
          />
        )}
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

      <button
        style={{ ...styles.filesToggle, ...(showFiles ? styles.filesToggleActive : {}) }}
        onClick={() => setShowFiles((v) => !v)}
        title="Browse files (read-only)"
      >
        {'\u{1F4C1}'} Files
      </button>
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
  filesToggle: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    borderRadius: 6,
    padding: '6px 12px',
    fontSize: 12,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  },
  filesToggleActive: {
    background: 'var(--accent)',
    color: 'var(--bg-primary)',
    borderColor: 'var(--accent)',
  },
};

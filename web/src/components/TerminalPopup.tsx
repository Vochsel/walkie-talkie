'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { defaultTheme, lightTheme } from '@walkie-talkie/react';
import { useTheme } from '@/hooks/useTheme';

interface TerminalPopupProps {
  terminalId: string;
  visible: boolean;
  onInput: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  registerOutput: (handler: (data: string) => void) => () => void;
  onClose: () => void;
  onRename?: (name: string) => void;
  title?: string;
  style?: React.CSSProperties;
}

export default function TerminalPopup({
  terminalId,
  visible,
  onInput,
  onResize,
  registerOutput,
  onClose,
  onRename,
  title,
  style,
}: TerminalPopupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const { theme: appTheme } = useTheme();
  const termTheme = appTheme === 'light' ? lightTheme : defaultTheme;

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'SF Mono', 'Fira Code', Menlo, monospace",
      lineHeight: 1.2,
      scrollback: 1000,
      overviewRulerWidth: 0,
      theme: termTheme,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    requestAnimationFrame(() => {
      fitAddon.fit();
      onResize(term.cols, term.rows);
    });

    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (event.type !== 'keydown') return true;
      // Shift+Enter: insert literal newline via quoted-insert (Ctrl-V + LF)
      if (event.key === 'Enter' && event.shiftKey) {
        onInput('\x16\x0a');
        return false;
      }
      // Cmd+Backspace: send Ctrl+U (kill to beginning of line)
      if (event.key === 'Backspace' && event.metaKey) {
        onInput('\x15');
        return false;
      }
      return true;
    });

    term.onData((data) => onInput(data));

    const unregister = registerOutput((data: string) => {
      term.write(data);
    });

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fitAddon.fit();
        onResize(term.cols, term.rows);
      });
    });
    observer.observe(containerRef.current);

    termRef.current = term;
    fitAddonRef.current = fitAddon;
    term.focus();

    return () => {
      unregister();
      observer.disconnect();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalId]);

  // Update theme dynamically
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = termTheme;
    }
  }, [termTheme]);

  // Re-fit and focus when becoming visible
  useEffect(() => {
    if (visible && termRef.current && fitAddonRef.current) {
      requestAnimationFrame(() => {
        fitAddonRef.current?.fit();
        termRef.current?.focus();
      });
    }
  }, [visible]);

  return (
    <div
      style={{
        ...popupStyles.overlay,
        ...style,
        display: visible ? 'flex' : 'none',
      }}
      onClick={onClose}
    >
      <div style={popupStyles.window} onClick={(e) => e.stopPropagation()}>
        <div style={popupStyles.titlebar}>
          {editing ? (
            <input
              style={popupStyles.titleInput}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => {
                const trimmed = editValue.trim();
                if (trimmed && onRename) onRename(trimmed);
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const trimmed = editValue.trim();
                  if (trimmed && onRename) onRename(trimmed);
                  setEditing(false);
                }
                if (e.key === 'Escape') setEditing(false);
              }}
              autoFocus
            />
          ) : (
            <span
              style={popupStyles.title}
              onDoubleClick={() => {
                if (!onRename) return;
                setEditValue(title || 'Terminal');
                setEditing(true);
              }}
            >
              {title || `Terminal`}
            </span>
          )}
          <button style={popupStyles.closeBtn} onClick={onClose}>
            &times;
          </button>
        </div>
        <div ref={containerRef} style={popupStyles.terminal} />
      </div>
    </div>
  );
}

const popupStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  window: {
    width: '70vw',
    height: '60vh',
    maxWidth: 900,
    maxHeight: 600,
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  titlebar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 14px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: "'SF Mono', monospace",
    cursor: 'default',
  },
  titleInput: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: "'SF Mono', monospace",
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 3,
    padding: '2px 6px',
    outline: 'none',
    width: 200,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: 20,
    cursor: 'pointer',
    lineHeight: 1,
  },
  terminal: {
    flex: 1,
    padding: 4,
  },
};

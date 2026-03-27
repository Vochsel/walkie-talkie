'use client';

import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalPopupProps {
  terminalId: string;
  visible: boolean;
  onInput: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  registerOutput: (handler: (data: string) => void) => () => void;
  onClose: () => void;
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
  title,
  style,
}: TerminalPopupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'SF Mono', 'Fira Code', Menlo, monospace",
      lineHeight: 1.2,
      scrollback: 1000,
      overviewRulerWidth: 0,
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#00d4aa',
        cursorAccent: '#0d1117',
        selectionBackground: '#264f78',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    requestAnimationFrame(() => {
      fitAddon.fit();
      onResize(term.cols, term.rows);
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
          <span style={popupStyles.title}>{title || `Terminal`}</span>
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
    background: '#0d1117',
    border: '1px solid #30363d',
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
    background: '#161b22',
    borderBottom: '1px solid #30363d',
    flexShrink: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: '#e6edf3',
    fontFamily: "'SF Mono', monospace",
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#8b949e',
    fontSize: 20,
    cursor: 'pointer',
    lineHeight: 1,
  },
  terminal: {
    flex: 1,
    padding: 4,
  },
};

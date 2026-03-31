import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

export interface TerminalTheme {
  background?: string;
  foreground?: string;
  cursor?: string;
  cursorAccent?: string;
  selectionBackground?: string;
  black?: string;
  red?: string;
  green?: string;
  yellow?: string;
  blue?: string;
  magenta?: string;
  cyan?: string;
  white?: string;
  brightBlack?: string;
  brightRed?: string;
  brightGreen?: string;
  brightYellow?: string;
  brightBlue?: string;
  brightMagenta?: string;
  brightCyan?: string;
  brightWhite?: string;
}

export const defaultTheme: TerminalTheme = {
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
};

export const lightTheme: TerminalTheme = {
  background: '#ffffff',
  foreground: '#1f2328',
  cursor: '#00a884',
  cursorAccent: '#ffffff',
  selectionBackground: '#0969da33',
  black: '#24292f',
  red: '#cf222e',
  green: '#116329',
  yellow: '#4d2d00',
  blue: '#0969da',
  magenta: '#8250df',
  cyan: '#1b7c83',
  white: '#6e7781',
  brightBlack: '#57606a',
  brightRed: '#a40e26',
  brightGreen: '#1a7f37',
  brightYellow: '#633c01',
  brightBlue: '#218bff',
  brightMagenta: '#a475f9',
  brightCyan: '#3192aa',
  brightWhite: '#8c959f',
};

export interface TerminalViewProps {
  terminalId: string;
  isActive: boolean;
  onInput: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  registerOutput: (handler: (data: string) => void) => () => void;
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
  cursorBlink?: boolean;
  theme?: TerminalTheme;
  /** When the terminal is inside a CSS-transformed container (e.g. whiteboard
   *  zoom), pass the ancestor scale factor so xterm's mouse coordinate mapping
   *  stays accurate. A counter-transform is applied internally. */
  containerScale?: number;
}

export function TerminalView({
  terminalId,
  isActive,
  onInput,
  onResize,
  registerOutput,
  fontSize = 14,
  fontFamily = "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
  lineHeight = 1.2,
  cursorBlink = true,
  theme = defaultTheme,
  containerScale = 1,
}: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink,
      fontSize,
      fontFamily,
      lineHeight,
      theme,
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

    term.onData((data) => {
      onInput(data);
    });

    const unregister = registerOutput((data: string) => {
      // Check if viewport is at the bottom before writing
      const buf = term.buffer.active;
      const atBottom = buf.viewportY >= buf.baseY;
      term.write(data, () => {
        if (atBottom) term.scrollToBottom();
      });
    });

    let resizeTimer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fitAddon.fit();
        // Debounce server resize notification (rapid during zoom/drag)
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          onResize(term.cols, term.rows);
        }, 150);
      });
    });
    observer.observe(containerRef.current);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    return () => {
      clearTimeout(resizeTimer);
      unregister();
      observer.disconnect();
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalId]);

  // Update xterm theme dynamically when prop changes
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = theme;
    }
  }, [theme]);

  useEffect(() => {
    if (isActive && termRef.current) {
      termRef.current.focus();
      fitAddonRef.current?.fit();
      termRef.current.scrollToBottom();
    }
  }, [isActive]);

  const scaled = containerScale !== 1;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      display: isActive ? 'block' : 'none',
    }}>
      <div
        ref={containerRef}
        style={{
          width: scaled ? `${containerScale * 100}%` : '100%',
          height: scaled ? `${containerScale * 100}%` : '100%',
          transform: scaled ? `scale(${1 / containerScale})` : undefined,
          transformOrigin: '0 0',
        }}
      />
    </div>
  );
}

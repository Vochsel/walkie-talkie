import { Code } from '../code';

const SRC_HOOK = 'https://github.com/vochsel/walkie-talkie/blob/main/react/src/useWalkieTalkie.ts';
const SRC_VIEW = 'https://github.com/vochsel/walkie-talkie/blob/main/react/src/TerminalView.tsx';

export const metadata = {
  title: 'React — Walkie-Talkie Docs',
  description: 'React hooks and components for building terminal UIs with walkie-talkie.',
};

export default function ReactPage() {
  return (
    <>
      <div className="docs-breadcrumb">
        <a href="/docs">docs</a> / react
      </div>
      <h1>React</h1>
      <p className="docs-subtitle">
        React hooks for connection management and an xterm.js terminal component.
        The fastest way to build a terminal UI.
      </p>
      <a href={SRC_HOOK} target="_blank" rel="noopener noreferrer" className="docs-source-link">
        react/src/useWalkieTalkie.ts
      </a>

      <h2 id="install">Install</h2>
      <Code
        lang="bash"
        title="terminal"
        code={`npm install @walkie-talkie/react @xterm/xterm @xterm/addon-fit`}
      />
      <div className="docs-note">
        <strong>Peer dependencies:</strong> This package requires <code>react &gt;= 18</code>.
        The <code>@xterm/xterm</code> and <code>@xterm/addon-fit</code> packages are optional
        peer dependencies — only needed if you use the <code>TerminalView</code> component.
      </div>

      <h2 id="quick-start">Quick Start</h2>
      <Code
        lang="tsx"
        title="App.tsx"
        code={`import { useWalkieTalkie } from '@walkie-talkie/react';
import { TerminalView } from '@walkie-talkie/react';
import '@xterm/xterm/css/xterm.css';

export default function App() {
  const wt = useWalkieTalkie();

  if (wt.connectionState !== 'connected') {
    return (
      <button onClick={() => wt.connect('http://localhost:3456', 'your-token')}>
        Connect
      </button>
    );
  }

  return (
    <div style={{ height: '100vh' }}>
      <button onClick={() => wt.createTerminal(80, 24)}>
        New Terminal
      </button>

      {wt.terminals.map((term) => (
        <TerminalView
          key={term.id}
          terminalId={term.id}
          isActive={true}
          onInput={(data) => wt.sendInput(term.id, data)}
          onResize={(cols, rows) => wt.resizeTerminal(term.id, cols, rows)}
          registerOutput={(handler) => wt.registerOutputHandler(term.id, handler)}
        />
      ))}
    </div>
  );
}`}
      />

      <h2 id="use-walkie-talkie">useWalkieTalkie</h2>
      <a href={SRC_HOOK} target="_blank" rel="noopener noreferrer" className="docs-source-link">
        react/src/useWalkieTalkie.ts
      </a>
      <p>
        The main hook. Manages the WebSocket connection, terminal list, and output
        buffering. Call it once at the top of your app.
      </p>
      <Code
        lang="typescript"
        code={`const {
  // State
  connectionState,     // ConnectionState
  terminals,           // TerminalInfo[]
  isResuming,          // boolean

  // Connection
  connect,             // (serverUrl: string, token: string) => void
  resumeSession,       // (serverUrl: string, sessionId: string) => void
  disconnect,          // () => void

  // Terminal management
  createTerminal,      // (cols: number, rows: number) => void
  sendInput,           // (terminalId: string, data: string) => void
  resizeTerminal,      // (terminalId: string, cols: number, rows: number) => void
  killTerminal,        // (terminalId: string) => void
  listTerminals,       // () => void

  // Output
  registerOutputHandler,  // (terminalId: string, handler: (data: string) => void) => unsubscribe
} = useWalkieTalkie();`}
      />

      <h3>Connection</h3>
      <Code
        lang="typescript"
        title="connecting.ts"
        code={`// Fresh connection with a token
wt.connect('http://192.168.1.50:3456', 'abcd-ef01-2345-6789');

// Resume a previous session (no token needed)
wt.resumeSession('http://192.168.1.50:3456', 'session-uuid');

// Check state
if (wt.connectionState === 'connected') {
  // Ready to create terminals
}

// Disconnect (clears saved session)
wt.disconnect();`}
      />

      <h3>Terminal Lifecycle</h3>
      <Code
        lang="typescript"
        title="terminals.ts"
        code={`// Create a terminal (80 cols x 24 rows)
wt.createTerminal(80, 24);

// The terminals array updates reactively
wt.terminals.forEach((term) => {
  console.log(term.id, term.shell, term.pid);
});

// Send input (keystrokes, commands)
wt.sendInput(terminalId, 'echo hello\\n');

// Resize when the container changes
wt.resizeTerminal(terminalId, 120, 40);

// Kill a terminal
wt.killTerminal(terminalId);`}
      />

      <h3>Output Handling</h3>
      <Code
        lang="typescript"
        title="output.ts"
        code={`// Register a handler — receives live output AND replays the buffer
const unsubscribe = wt.registerOutputHandler(terminalId, (data) => {
  // data is a string of terminal output
  // Write it to an xterm.js instance, a textarea, etc.
  terminal.write(data);
});

// When done, unsubscribe
unsubscribe();`}
      />
      <div className="docs-note">
        <strong>Output buffering:</strong> The hook buffers up to 100KB of output per
        terminal. When you call <code>registerOutputHandler</code>, the handler immediately
        receives the full buffer — so terminals restore their scrollback on re-mount.
      </div>

      <h2 id="terminal-view">TerminalView</h2>
      <a href={SRC_VIEW} target="_blank" rel="noopener noreferrer" className="docs-source-link">
        react/src/TerminalView.tsx
      </a>
      <p>
        A React component that renders an xterm.js terminal. Handles fit-to-container,
        resize events, and input/output wiring.
      </p>
      <Code
        lang="tsx"
        title="usage.tsx"
        code={`import { TerminalView } from '@walkie-talkie/react';

<TerminalView
  terminalId={term.id}
  isActive={activeTab === term.id}
  onInput={(data) => wt.sendInput(term.id, data)}
  onResize={(cols, rows) => wt.resizeTerminal(term.id, cols, rows)}
  registerOutput={(handler) => wt.registerOutputHandler(term.id, handler)}
  fontSize={14}
  cursorBlink={true}
  theme={{
    background: '#0d1117',
    foreground: '#e6edf3',
    cursor: '#00d4aa',
  }}
/>`}
      />

      <h3>Props</h3>
      <table>
        <thead>
          <tr>
            <th>Prop</th>
            <th>Type</th>
            <th>Default</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>terminalId</code></td>
            <td><code>string</code></td>
            <td>-</td>
            <td>Unique terminal ID from the server</td>
          </tr>
          <tr>
            <td><code>isActive</code></td>
            <td><code>boolean</code></td>
            <td>-</td>
            <td>Whether this terminal is visible. Hidden terminals use <code>display: none</code>.</td>
          </tr>
          <tr>
            <td><code>onInput</code></td>
            <td><code>(data: string) =&gt; void</code></td>
            <td>-</td>
            <td>Called when the user types</td>
          </tr>
          <tr>
            <td><code>onResize</code></td>
            <td><code>(cols, rows) =&gt; void</code></td>
            <td>-</td>
            <td>Called when the terminal resizes</td>
          </tr>
          <tr>
            <td><code>registerOutput</code></td>
            <td><code>(handler) =&gt; unsubscribe</code></td>
            <td>-</td>
            <td>Register an output handler. Must return unsubscribe function.</td>
          </tr>
          <tr>
            <td><code>fontSize</code></td>
            <td><code>number</code></td>
            <td><code>14</code></td>
            <td>Font size in pixels</td>
          </tr>
          <tr>
            <td><code>fontFamily</code></td>
            <td><code>string</code></td>
            <td>SF Mono, Fira Code...</td>
            <td>CSS font-family string</td>
          </tr>
          <tr>
            <td><code>lineHeight</code></td>
            <td><code>number</code></td>
            <td><code>1.2</code></td>
            <td>Line height multiplier</td>
          </tr>
          <tr>
            <td><code>cursorBlink</code></td>
            <td><code>boolean</code></td>
            <td><code>true</code></td>
            <td>Whether the cursor blinks</td>
          </tr>
          <tr>
            <td><code>theme</code></td>
            <td><code>TerminalTheme</code></td>
            <td>Dark theme</td>
            <td>Full xterm.js theme object</td>
          </tr>
        </tbody>
      </table>

      <h2 id="theme">Default Theme</h2>
      <Code
        lang="typescript"
        title="theme.ts"
        code={`import { defaultTheme } from '@walkie-talkie/react';

// {
//   background: '#0d1117',
//   foreground: '#e6edf3',
//   cursor: '#00d4aa',
//   cursorAccent: '#0d1117',
//   selectionBackground: '#264f78',
//   black: '#484f58',
//   red: '#ff7b72',
//   green: '#3fb950',
//   yellow: '#d29922',
//   blue: '#58a6ff',
//   magenta: '#bc8cff',
//   cyan: '#39c5cf',
//   white: '#b1bac4',
//   brightBlack: '#6e7681',
//   brightRed: '#ffa198',
//   brightGreen: '#56d364',
//   brightYellow: '#e3b341',
//   brightBlue: '#79c0ff',
//   brightMagenta: '#d2a8ff',
//   brightCyan: '#56d4dd',
//   brightWhite: '#f0f6fc',
// }`}
      />

      <h2 id="full-example">Full Example: Tabbed Terminal App</h2>
      <Code
        lang="tsx"
        title="TabbedTerminals.tsx"
        code={`import { useState } from 'react';
import { useWalkieTalkie, TerminalView } from '@walkie-talkie/react';
import '@xterm/xterm/css/xterm.css';

export function TabbedTerminals({ serverUrl, token }: {
  serverUrl: string;
  token: string;
}) {
  const wt = useWalkieTalkie();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Auto-connect on mount
  if (wt.connectionState === 'disconnected') {
    wt.connect(serverUrl, token);
  }

  if (wt.connectionState !== 'connected') {
    return <div>Connecting...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, padding: 8 }}>
        {wt.terminals.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveId(t.id)}
            style={{ fontWeight: activeId === t.id ? 'bold' : 'normal' }}
          >
            {t.shell} #{t.pid}
          </button>
        ))}
        <button onClick={() => wt.createTerminal(80, 24)}>+ New</button>
      </div>

      {/* Terminal area */}
      <div style={{ flex: 1 }}>
        {wt.terminals.map((t) => (
          <TerminalView
            key={t.id}
            terminalId={t.id}
            isActive={activeId === t.id}
            onInput={(data) => wt.sendInput(t.id, data)}
            onResize={(cols, rows) => wt.resizeTerminal(t.id, cols, rows)}
            registerOutput={(handler) =>
              wt.registerOutputHandler(t.id, handler)
            }
          />
        ))}
      </div>
    </div>
  );
}`}
      />

      <div className="docs-nav-footer">
        <a href="/docs/client" className="docs-nav-link">
          <span className="docs-nav-link-label">Previous</span>
          <span className="docs-nav-link-title">&larr; Client</span>
        </a>
        <a href="/docs/protocol" className="docs-nav-link docs-nav-link-next">
          <span className="docs-nav-link-label">Next</span>
          <span className="docs-nav-link-title">Protocol &rarr;</span>
        </a>
      </div>
    </>
  );
}

import { Code } from '../code';

const SRC = 'https://github.com/vochsel/walkie-talkie/blob/main/shared/src/protocol.ts';
const SRC_CONST = 'https://github.com/vochsel/walkie-talkie/blob/main/shared/src/constants.ts';

export const metadata = {
  title: 'Protocol — Walkie-Talkie Docs',
  description: 'WebSocket protocol reference for walkie-talkie.',
};

export default function ProtocolPage() {
  return (
    <>
      <div className="docs-breadcrumb">
        <a href="/docs">docs</a> / protocol
      </div>
      <h1>Protocol Reference</h1>
      <p className="docs-subtitle">
        The complete WebSocket message protocol. All messages are JSON over a single
        WebSocket connection at <code>/ws</code>.
      </p>
      <a href={SRC} target="_blank" rel="noopener noreferrer" className="docs-source-link">
        shared/src/protocol.ts
      </a>

      <h2 id="connection">Connection</h2>
      <p>
        Connect to the server at <code>ws://host:port/ws</code>. The client has 10 seconds
        to send an <code>auth</code> or <code>auth:resume</code> message, or the connection is closed.
      </p>
      <Code
        lang="typescript"
        title="connect.ts"
        code={`// HTTP URLs are converted to WS automatically by the client library
// http://localhost:3456 → ws://localhost:3456/ws
// https://example.com   → wss://example.com/ws

const ws = new WebSocket('ws://localhost:3456/ws');`}
      />

      <h2 id="constants">Constants</h2>
      <a href={SRC_CONST} target="_blank" rel="noopener noreferrer" className="docs-source-link">
        shared/src/constants.ts
      </a>
      <table>
        <thead>
          <tr>
            <th>Constant</th>
            <th>Value</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>DEFAULT_PORT</code></td>
            <td><code>3456</code></td>
            <td>Default server port</td>
          </tr>
          <tr>
            <td><code>WS_PATH</code></td>
            <td><code>/ws</code></td>
            <td>WebSocket endpoint path</td>
          </tr>
          <tr>
            <td><code>AUTH_TIMEOUT_MS</code></td>
            <td><code>10,000</code></td>
            <td>Time to authenticate before disconnect</td>
          </tr>
          <tr>
            <td><code>TOKEN_TTL_MS</code></td>
            <td><code>300,000</code></td>
            <td>Token validity (5 minutes)</td>
          </tr>
          <tr>
            <td><code>HEARTBEAT_INTERVAL_MS</code></td>
            <td><code>30,000</code></td>
            <td>Ping/pong keepalive interval</td>
          </tr>
          <tr>
            <td><code>RECONNECT_BASE_MS</code></td>
            <td><code>1,000</code></td>
            <td>Initial reconnect delay</td>
          </tr>
          <tr>
            <td><code>RECONNECT_MAX_MS</code></td>
            <td><code>30,000</code></td>
            <td>Maximum reconnect delay</td>
          </tr>
        </tbody>
      </table>

      <h2 id="client-messages">Client → Server</h2>

      <h3 id="auth">auth</h3>
      <p>Authenticate with a one-time token.</p>
      <Code
        lang="typescript"
        code={`interface AuthMessage {
  type: 'auth';
  token: string;  // e.g. "a1b2-c3d4-e5f6-7890"
}`}
      />

      <h3 id="auth-resume">auth:resume</h3>
      <p>Resume an existing session. The server replays the terminal list and scrollback.</p>
      <Code
        lang="typescript"
        code={`interface AuthResumeMessage {
  type: 'auth:resume';
  sessionId: string;  // UUID from a previous auth:ok
}`}
      />

      <h3 id="terminal-create">terminal:create</h3>
      <p>Spawn a new pseudo-terminal.</p>
      <Code
        lang="typescript"
        code={`interface TerminalCreateMessage {
  type: 'terminal:create';
  cols: number;      // Terminal width in columns
  rows: number;      // Terminal height in rows
  shell?: string;    // Optional: e.g. "/bin/zsh", "powershell.exe"
}`}
      />
      <div className="docs-note">
        If <code>shell</code> is omitted, the server uses <code>$SHELL</code> on Unix
        or <code>powershell.exe</code> on Windows.
      </div>

      <h3 id="terminal-input">terminal:input</h3>
      <p>Send data (keystrokes, pasted text) to a terminal.</p>
      <Code
        lang="typescript"
        code={`interface TerminalInputMessage {
  type: 'terminal:input';
  terminalId: string;
  data: string;  // Raw terminal data (including escape sequences)
}`}
      />

      <h3 id="terminal-resize">terminal:resize</h3>
      <p>Resize a terminal. The PTY is resized to match.</p>
      <Code
        lang="typescript"
        code={`interface TerminalResizeMessage {
  type: 'terminal:resize';
  terminalId: string;
  cols: number;
  rows: number;
}`}
      />

      <h3 id="terminal-kill">terminal:kill</h3>
      <p>Kill a terminal process.</p>
      <Code
        lang="typescript"
        code={`interface TerminalKillMessage {
  type: 'terminal:kill';
  terminalId: string;
}`}
      />

      <h3 id="terminal-list">terminal:list (request)</h3>
      <p>Request the list of active terminals for the current session.</p>
      <Code
        lang="typescript"
        code={`interface TerminalListMessage {
  type: 'terminal:list';
}`}
      />

      <h2 id="server-messages">Server → Client</h2>

      <h3 id="auth-ok">auth:ok</h3>
      <p>Authentication succeeded. Save the <code>sessionId</code> for resume.</p>
      <Code
        lang="typescript"
        code={`interface AuthOkMessage {
  type: 'auth:ok';
  sessionId: string;  // UUID — use this for auth:resume
}`}
      />

      <h3 id="auth-fail">auth:fail</h3>
      <p>Authentication failed. The connection is closed after this message.</p>
      <Code
        lang="typescript"
        code={`interface AuthFailMessage {
  type: 'auth:fail';
  reason: string;
  // "invalid_token" — token doesn't exist, expired, or already used
  // "invalid_session" — session ID not found
  // "auth_timeout" — 10s timeout exceeded
}`}
      />

      <h3 id="terminal-created">terminal:created</h3>
      <p>A new terminal was successfully spawned.</p>
      <Code
        lang="typescript"
        code={`interface TerminalCreatedMessage {
  type: 'terminal:created';
  terminal: TerminalInfo;
}

interface TerminalInfo {
  id: string;         // UUID
  pid: number;        // OS process ID
  shell: string;      // e.g. "/bin/zsh"
  cols: number;
  rows: number;
  cwd: string;        // Working directory
  createdAt: number;  // Unix timestamp (ms)
}`}
      />

      <h3 id="terminal-output">terminal:output</h3>
      <p>Output data from a terminal. This is the primary data channel.</p>
      <Code
        lang="typescript"
        code={`interface TerminalOutputMessage {
  type: 'terminal:output';
  terminalId: string;
  data: string;  // Raw terminal output (includes ANSI codes)
}`}
      />

      <h3 id="terminal-exited">terminal:exited</h3>
      <p>A terminal process has exited.</p>
      <Code
        lang="typescript"
        code={`interface TerminalExitedMessage {
  type: 'terminal:exited';
  terminalId: string;
  exitCode: number;
}`}
      />

      <h3 id="terminal-list-response">terminal:list (response)</h3>
      <p>
        List of active terminals. Sent in response to a <code>terminal:list</code> request,
        and also automatically on session resume.
      </p>
      <Code
        lang="typescript"
        code={`interface TerminalListResponseMessage {
  type: 'terminal:list';
  terminals: TerminalInfo[];
}`}
      />

      <h3 id="error">error</h3>
      <p>A general error message.</p>
      <Code
        lang="typescript"
        code={`interface ErrorMessage {
  type: 'error';
  message: string;
  code?: string;  // e.g. "spawn_failed"
}`}
      />

      <h2 id="message-flow">Message Flow</h2>
      <p>
        Typical connection lifecycle:
      </p>
      <Code
        lang="text"
        title="message-flow.txt"
        code={`Client                          Server
  │                               │
  │──── WebSocket connect ───────▶│
  │                               │
  │──── auth { token } ──────────▶│
  │◀──── auth:ok { sessionId } ───│
  │                               │
  │──── terminal:create ─────────▶│
  │◀──── terminal:created ────────│
  │                               │
  │──── terminal:input ──────────▶│  (user types)
  │◀──── terminal:output ─────────│  (pty responds)
  │◀──── terminal:output ─────────│
  │                               │
  │──── terminal:resize ─────────▶│  (window resized)
  │                               │
  │──── terminal:kill ───────────▶│
  │◀──── terminal:exited ─────────│
  │                               │`}
      />

      <h2 id="session-resume-flow">Session Resume Flow</h2>
      <Code
        lang="text"
        title="resume-flow.txt"
        code={`Client                          Server
  │                               │
  │──── WebSocket connect ───────▶│
  │                               │
  │──── auth:resume { sid } ─────▶│
  │◀──── auth:ok { sessionId } ───│
  │◀──── terminal:list ───────────│  (active terminals)
  │◀──── terminal:output ─────────│  (scrollback replay)
  │◀──── terminal:output ─────────│  (scrollback replay)
  │                               │
  │  (terminals restored)         │`}
      />

      <div className="docs-nav-footer">
        <a href="/docs/react" className="docs-nav-link">
          <span className="docs-nav-link-label">Previous</span>
          <span className="docs-nav-link-title">&larr; React</span>
        </a>
        <a href="/docs/architecture" className="docs-nav-link docs-nav-link-next">
          <span className="docs-nav-link-label">Next</span>
          <span className="docs-nav-link-title">Architecture &rarr;</span>
        </a>
      </div>
    </>
  );
}

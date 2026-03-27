import { Code } from '../code';

const SRC = 'https://github.com/vochsel/walkie-talkie/blob/main/client/src/client.ts';
const SRC_STORAGE = 'https://github.com/vochsel/walkie-talkie/blob/main/client/src/storage.ts';

export const metadata = {
  title: 'Client — Walkie-Talkie Docs',
  description: 'API reference for the @walkie-talkie/client package.',
};

export default function ClientPage() {
  return (
    <>
      <div className="docs-breadcrumb">
        <a href="/docs">docs</a> / client
      </div>
      <h1>Client</h1>
      <p className="docs-subtitle">
        Framework-agnostic TypeScript WebSocket client with auto-reconnect and session persistence.
        Use this in any JavaScript environment — no React required.
      </p>
      <a href={SRC} target="_blank" rel="noopener noreferrer" className="docs-source-link">
        client/src/client.ts
      </a>

      <h2 id="install">Install</h2>
      <Code
        lang="bash"
        title="terminal"
        code={`npm install @walkie-talkie/client`}
      />

      <h2 id="quick-start">Quick Start</h2>
      <Code
        lang="typescript"
        title="connect.ts"
        code={`import { WalkieTalkieClient } from '@walkie-talkie/client';

const client = new WalkieTalkieClient();

// Listen for state changes
client.onStateChange((state) => {
  console.log('Connection:', state);
  // 'connecting' | 'authenticating' | 'connected' | 'reconnecting' | ...
});

// Listen for messages
client.onMessage((msg) => {
  if (msg.type === 'terminal:output') {
    process.stdout.write(msg.data);
  }
  if (msg.type === 'terminal:created') {
    console.log('Terminal ready:', msg.terminal.id);
  }
});

// Connect with a token
client.connect('http://localhost:3456', 'abcd-ef01-2345-6789');`}
      />

      <h2 id="connection-states">Connection States</h2>
      <Code
        lang="typescript"
        code={`type ConnectionState =
  | 'disconnected'   // Not connected
  | 'connecting'     // WebSocket opening
  | 'authenticating' // WS open, waiting for auth response
  | 'connected'      // Authenticated and ready
  | 'reconnecting'   // Auto-reconnecting after disconnect
  | 'error';         // Auth failed or fatal error`}
      />
      <p>
        State transitions are emitted via <code>onStateChange()</code>. The client
        auto-reconnects on unexpected disconnects using exponential backoff
        (1s to 30s max).
      </p>

      <h2 id="api">API</h2>
      <h3>WalkieTalkieClient</h3>

      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>connect(serverUrl, token)</code></td>
            <td>Connect and authenticate with a one-time token</td>
          </tr>
          <tr>
            <td><code>resumeSession(serverUrl, sessionId)</code></td>
            <td>Reconnect using an existing session ID</td>
          </tr>
          <tr>
            <td><code>disconnect()</code></td>
            <td>Close connection (no auto-reconnect)</td>
          </tr>
          <tr>
            <td><code>send(msg)</code></td>
            <td>Send a <a href="/docs/protocol">ClientMessage</a></td>
          </tr>
          <tr>
            <td><code>onMessage(handler)</code></td>
            <td>Subscribe to server messages. Returns unsubscribe function.</td>
          </tr>
          <tr>
            <td><code>onStateChange(handler)</code></td>
            <td>Subscribe to connection state changes. Returns unsubscribe function.</td>
          </tr>
          <tr>
            <td><code>getSessionId()</code></td>
            <td>Current session ID or <code>null</code></td>
          </tr>
          <tr>
            <td><code>getServerUrl()</code></td>
            <td>Current server URL</td>
          </tr>
          <tr>
            <td><code>getState()</code></td>
            <td>Current <code>ConnectionState</code></td>
          </tr>
          <tr>
            <td><code>isResuming</code></td>
            <td><code>true</code> during session resume (vs. fresh connect)</td>
          </tr>
        </tbody>
      </table>

      <h2 id="sending-messages">Sending Messages</h2>
      <p>
        Use <code>send()</code> with typed <a href="/docs/protocol">protocol messages</a>:
      </p>
      <Code
        lang="typescript"
        title="usage.ts"
        code={`// Create a terminal
client.send({
  type: 'terminal:create',
  cols: 120,
  rows: 40,
});

// Send input (e.g. a command)
client.send({
  type: 'terminal:input',
  terminalId: 'uuid-of-terminal',
  data: 'ls -la\\n',
});

// Resize
client.send({
  type: 'terminal:resize',
  terminalId: 'uuid-of-terminal',
  cols: 160,
  rows: 50,
});

// Kill a terminal
client.send({
  type: 'terminal:kill',
  terminalId: 'uuid-of-terminal',
});

// List all terminals in the session
client.send({ type: 'terminal:list' });`}
      />

      <h2 id="session-resume">Session Resume</h2>
      <p>
        After a successful auth, the server returns a <code>sessionId</code>. Save it
        and use it to reconnect later — no new token needed:
      </p>
      <Code
        lang="typescript"
        title="resume.ts"
        code={`// First connection — save the session
client.onStateChange((state) => {
  if (state === 'connected') {
    const sessionId = client.getSessionId();
    localStorage.setItem('wt-session', sessionId);
    localStorage.setItem('wt-server', client.getServerUrl());
  }
});

// Later — resume
const sessionId = localStorage.getItem('wt-session');
const serverUrl = localStorage.getItem('wt-server');
if (sessionId && serverUrl) {
  client.resumeSession(serverUrl, sessionId);
}`}
      />
      <p>
        On resume, the server replays the terminal list and scrollback buffer, so
        your terminals appear exactly where you left off.
      </p>

      <h2 id="auto-reconnect">Auto-Reconnect</h2>
      <p>
        If the WebSocket disconnects unexpectedly (network drop, server restart),
        the client automatically reconnects using exponential backoff:
      </p>
      <ul>
        <li>First retry: 1 second</li>
        <li>Doubles each time: 2s, 4s, 8s, 16s...</li>
        <li>Max delay: 30 seconds</li>
        <li>Uses <code>auth:resume</code> if a session exists</li>
      </ul>
      <p>
        Call <code>disconnect()</code> to stop reconnection attempts.
      </p>

      <h2 id="storage">Storage Utilities</h2>
      <a href={SRC_STORAGE} target="_blank" rel="noopener noreferrer" className="docs-source-link">
        client/src/storage.ts
      </a>
      <p>
        The client package also exports localStorage helpers for managing saved connections:
      </p>
      <Code
        lang="typescript"
        title="storage.ts"
        code={`import {
  getSavedConnections,
  saveConnection,
  removeConnection,
  clearConnections,
  loadState,
  saveState,
} from '@walkie-talkie/client';

// Get recent connections (max 10)
const connections = getSavedConnections();
// → [{ serverUrl, sessionId, connectedAt }]

// Save a connection
saveConnection({
  serverUrl: 'http://localhost:3456',
  sessionId: 'uuid-here',
  connectedAt: Date.now(),
});

// Generic state persistence
saveState('my-key', { zoom: 1.5 });
const state = loadState('my-key', { zoom: 1 });`}
      />

      <div className="docs-nav-footer">
        <a href="/docs/server" className="docs-nav-link">
          <span className="docs-nav-link-label">Previous</span>
          <span className="docs-nav-link-title">&larr; Server</span>
        </a>
        <a href="/docs/react" className="docs-nav-link docs-nav-link-next">
          <span className="docs-nav-link-label">Next</span>
          <span className="docs-nav-link-title">React &rarr;</span>
        </a>
      </div>
    </>
  );
}

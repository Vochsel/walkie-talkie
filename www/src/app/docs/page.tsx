import { Code } from './code';

const GITHUB = 'https://github.com/vochsel/walkie-talkie';

export const metadata = {
  title: 'Docs — Walkie-Talkie',
  description: 'Documentation for walkie-talkie, the open source remote terminal access tool.',
};

export default function DocsPage() {
  return (
    <>
      <h1>Documentation</h1>
      <p className="docs-subtitle">
        Remote terminal access from any browser. One command to start, a WebSocket to connect.
      </p>

      <h2 id="quick-start">Quick Start</h2>
      <p>
        Start a walkie-talkie server with a single command. No install required — <code>npx</code> handles everything.
      </p>
      <Code
        code={`npx @walkie-talkie/cli@latest --open`}
        lang="bash"
        title="terminal"
      />
      <p>
        This starts a server on port <code>3456</code>, generates a one-time token,
        and opens the web client in your browser. You can also scan the QR code from a
        phone or tablet.
      </p>

      <h2 id="install">Install</h2>
      <p>If you prefer a permanent install:</p>
      <Code
        code={`npm install -g @walkie-talkie/cli`}
        lang="bash"
        title="terminal"
      />
      <p>Then run:</p>
      <Code
        code={`walkie-talkie --open`}
        lang="bash"
        title="terminal"
      />

      <h2 id="packages">Packages</h2>
      <p>
        Walkie-talkie is a monorepo with modular packages. Use only what you need.
      </p>
      <table>
        <thead>
          <tr>
            <th>Package</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><a href="/docs/server"><code>@walkie-talkie/server</code></a></td>
            <td>Express + WebSocket server with node-pty terminals</td>
          </tr>
          <tr>
            <td><a href="/docs/client"><code>@walkie-talkie/client</code></a></td>
            <td>Framework-agnostic TypeScript WebSocket client</td>
          </tr>
          <tr>
            <td><a href="/docs/react"><code>@walkie-talkie/react</code></a></td>
            <td>React hooks and xterm.js TerminalView component</td>
          </tr>
          <tr>
            <td><code>@walkie-talkie/shared</code></td>
            <td>Protocol types and constants shared between packages</td>
          </tr>
          <tr>
            <td><a href="/docs/cli"><code>@walkie-talkie/cli</code></a></td>
            <td>CLI launcher — the <code>npx</code> entry point</td>
          </tr>
        </tbody>
      </table>

      <h2 id="how-it-works">How It Works</h2>
      <p>
        The server spawns real pseudo-terminals using <code>node-pty</code> and
        bridges them to the browser over WebSocket. The flow:
      </p>
      <ol>
        <li>
          <strong>Server starts</strong> — listens on a port (default <code>3456</code>)
          and generates a short-lived token.
        </li>
        <li>
          <strong>Client connects</strong> — opens a WebSocket to <code>ws://host:3456/ws</code> and
          sends the token to authenticate.
        </li>
        <li>
          <strong>Session established</strong> — the server issues a session ID. The client
          can now create terminals, send input, and receive output.
        </li>
        <li>
          <strong>Real-time I/O</strong> — keystrokes flow from browser to PTY, output flows
          back. Resize events keep the terminal dimensions in sync.
        </li>
      </ol>

      <div className="docs-note">
        <strong>Security model:</strong> Tokens are single-use and expire after 5 minutes.
        Sessions persist across reconnects (stored at <code>~/.walkie-talkie/sessions.json</code>)
        but tokens are never saved to disk.
      </div>

      <h2 id="example">Minimal Example</h2>
      <p>
        Connect to a walkie-talkie server from any WebSocket client:
      </p>
      <Code
        lang="typescript"
        title="raw-websocket.ts"
        code={`const ws = new WebSocket('ws://localhost:3456/ws');

ws.onopen = () => {
  // Authenticate with a one-time token
  ws.send(JSON.stringify({ type: 'auth', token: 'your-token' }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case 'auth:ok':
      // Authenticated — create a terminal
      ws.send(JSON.stringify({
        type: 'terminal:create',
        cols: 80,
        rows: 24,
      }));
      break;

    case 'terminal:created':
      console.log('Terminal spawned:', msg.terminal.id);
      // Send a command
      ws.send(JSON.stringify({
        type: 'terminal:input',
        terminalId: msg.terminal.id,
        data: 'echo hello\\n',
      }));
      break;

    case 'terminal:output':
      process.stdout.write(msg.data);
      break;
  }
};`}
      />

      <p>
        Or use the <a href="/docs/client">TypeScript client</a> for a higher-level API with
        auto-reconnect, session persistence, and state management.
      </p>

      <h2 id="source">Source Code</h2>
      <p>
        Walkie-talkie is open source under the MIT license.
      </p>
      <a
        href={GITHUB}
        target="_blank"
        rel="noopener noreferrer"
        className="docs-source-link"
      >
        github.com/vochsel/walkie-talkie
      </a>

      <div className="docs-nav-footer">
        <div />
        <a href="/docs/cli" className="docs-nav-link docs-nav-link-next">
          <span className="docs-nav-link-label">Next</span>
          <span className="docs-nav-link-title">CLI Reference &rarr;</span>
        </a>
      </div>
    </>
  );
}

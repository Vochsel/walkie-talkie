import { Code } from '../code';

const SRC = 'https://github.com/vochsel/walkie-talkie/blob/main/server/src/index.ts';

export const metadata = {
  title: 'Server — Walkie-Talkie Docs',
  description: 'API reference for the @walkie-talkie/server package.',
};

export default function ServerPage() {
  return (
    <>
      <div className="docs-breadcrumb">
        <a href="/docs">docs</a> / server
      </div>
      <h1>Server</h1>
      <p className="docs-subtitle">
        The core Express + WebSocket server. Spawns real pseudo-terminals and bridges
        them to authenticated clients over WebSocket.
      </p>
      <a href={SRC} target="_blank" rel="noopener noreferrer" className="docs-source-link">
        server/src/index.ts
      </a>

      <h2 id="install">Install</h2>
      <Code
        lang="bash"
        title="terminal"
        code={`npm install @walkie-talkie/server`}
      />
      <div className="docs-note">
        <strong>Note:</strong> This package depends on <code>node-pty</code>, which requires
        a native compiler. On macOS, install Xcode Command Line Tools. On Linux, ensure <code>make</code> and <code>g++</code> are available.
      </div>

      <h2 id="quick-start">Quick Start</h2>
      <Code
        lang="typescript"
        title="my-server.ts"
        code={`import { createServer } from '@walkie-talkie/server';

const server = createServer(3456);

await server.start();
console.log('Listening on port 3456');

const { value, expiresAt } = server.generateToken();
console.log(\`Token: \${value} (expires in 5 minutes)\`);

// React to terminal count changes
server.onStateChange(() => {
  console.log(\`Active terminals: \${server.terminalCount}\`);
});`}
      />

      <h2 id="api">API</h2>
      <h3>createServer(port?, cwd?)</h3>
      <p>Creates and returns a server instance.</p>
      <div className="docs-params">
        <div className="docs-param">
          <span className="docs-param-name">port</span>
          <span className="docs-param-type">number</span>
          <span className="docs-param-desc">Port to listen on. Default: <code>3456</code></span>
        </div>
        <div className="docs-param">
          <span className="docs-param-name">cwd</span>
          <span className="docs-param-type">string?</span>
          <span className="docs-param-desc">Working directory for spawned terminals. Default: user home.</span>
        </div>
      </div>

      <p>The returned object has these methods and properties:</p>
      <table>
        <thead>
          <tr>
            <th>Member</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>start()</code></td>
            <td><code>Promise&lt;void&gt;</code></td>
            <td>Start listening on the port</td>
          </tr>
          <tr>
            <td><code>stop()</code></td>
            <td><code>Promise&lt;void&gt;</code></td>
            <td>Gracefully shut down — kills all terminals, closes connections</td>
          </tr>
          <tr>
            <td><code>generateToken()</code></td>
            <td><code>{'{value, expiresAt}'}</code></td>
            <td>Generate a single-use token (5 min TTL)</td>
          </tr>
          <tr>
            <td><code>getActiveToken()</code></td>
            <td><code>Token | null</code></td>
            <td>Get the current active (unused, unexpired) token</td>
          </tr>
          <tr>
            <td><code>onStateChange(cb)</code></td>
            <td><code>(cb: () =&gt; void) =&gt; void</code></td>
            <td>Subscribe to terminal/session count changes</td>
          </tr>
          <tr>
            <td><code>terminalCount</code></td>
            <td><code>number</code></td>
            <td>Number of active terminals</td>
          </tr>
          <tr>
            <td><code>sessionCount</code></td>
            <td><code>number</code></td>
            <td>Number of known sessions</td>
          </tr>
          <tr>
            <td><code>port</code></td>
            <td><code>number</code></td>
            <td>The port the server is bound to</td>
          </tr>
        </tbody>
      </table>

      <h2 id="rest-api">REST API</h2>
      <p>The server exposes a few REST endpoints alongside WebSocket:</p>
      <table>
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>Auth</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>GET /</code></td>
            <td>None</td>
            <td>Server info (name, status, port)</td>
          </tr>
          <tr>
            <td><code>GET /api/health</code></td>
            <td>None</td>
            <td>Health check (status, version, uptime)</td>
          </tr>
          <tr>
            <td><code>GET /api/terminals</code></td>
            <td>Bearer</td>
            <td>List all active terminals</td>
          </tr>
          <tr>
            <td><code>DELETE /api/terminals/:id</code></td>
            <td>Bearer</td>
            <td>Kill a terminal by ID</td>
          </tr>
        </tbody>
      </table>
      <p>
        Authenticated endpoints require <code>Authorization: Bearer &lt;sessionId&gt;</code>.
      </p>
      <Code
        lang="bash"
        title="terminal"
        code={`# List terminals
curl -H "Authorization: Bearer <sessionId>" http://localhost:3456/api/terminals

# Kill a terminal
curl -X DELETE -H "Authorization: Bearer <sessionId>" \\
  http://localhost:3456/api/terminals/<terminalId>`}
      />

      <h2 id="qr-utilities">QR Utilities</h2>
      <p>Helper functions for generating connection QR codes:</p>
      <Code
        lang="typescript"
        title="qr-example.ts"
        code={`import {
  generateQR,
  generateConnectionQR,
  buildConnectionUrl,
} from '@walkie-talkie/server';

// ASCII QR code for the terminal
const ascii = await generateQR('https://example.com?token=abc');
console.log(ascii);

// Data URL for embedding in HTML (280x280px)
const dataUrl = await generateConnectionQR(
  'https://example.com',
  'abc-def-123-456'
);

// Just build the URL
const url = buildConnectionUrl('https://example.com', 'abc-def-123-456');
// → "https://example.com?token=abc-def-123-456"`}
      />

      <h2 id="token-system">Token System</h2>
      <p>The server uses a two-phase authentication model:</p>
      <ol>
        <li>
          <strong>Token</strong> — a random hex string formatted as <code>XXXX-XXXX-XXXX-XXXX</code>.
          Tokens are single-use with a 5-minute TTL. They exist only in memory.
        </li>
        <li>
          <strong>Session</strong> — when a valid token is consumed, the server issues a UUID session ID.
          Sessions are persisted to <code>~/.walkie-talkie/sessions.json</code> and survive server restarts
          (with a 24-hour expiry).
        </li>
      </ol>

      <h2 id="embedding">Embedding in Your App</h2>
      <p>
        Since the server is just an Express app with a WebSocket server attached,
        you can embed it alongside your existing HTTP server:
      </p>
      <Code
        lang="typescript"
        title="embed.ts"
        code={`import { createServer } from '@walkie-talkie/server';
import express from 'express';

// Your existing app
const app = express();
app.get('/', (req, res) => res.send('My App'));

// Start walkie-talkie on a separate port
const wt = createServer(4000, '/home/deploy/app');
await wt.start();

const token = wt.generateToken();
console.log('Terminal token:', token.value);`}
      />

      <div className="docs-nav-footer">
        <a href="/docs/cli" className="docs-nav-link">
          <span className="docs-nav-link-label">Previous</span>
          <span className="docs-nav-link-title">&larr; CLI Reference</span>
        </a>
        <a href="/docs/client" className="docs-nav-link docs-nav-link-next">
          <span className="docs-nav-link-label">Next</span>
          <span className="docs-nav-link-title">Client &rarr;</span>
        </a>
      </div>
    </>
  );
}

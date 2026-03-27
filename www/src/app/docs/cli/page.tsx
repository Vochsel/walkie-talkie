import { Code } from '../code';

const SRC = 'https://github.com/vochsel/walkie-talkie/blob/main/cli/src/index.ts';

export const metadata = {
  title: 'CLI Reference — Walkie-Talkie Docs',
  description: 'Command-line options and usage for the walkie-talkie CLI.',
};

export default function CliPage() {
  return (
    <>
      <div className="docs-breadcrumb">
        <a href="/docs">docs</a> / cli
      </div>
      <h1>CLI Reference</h1>
      <p className="docs-subtitle">
        The standalone command-line launcher. Start a server, generate tokens, and open the web client.
      </p>
      <a href={SRC} target="_blank" rel="noopener noreferrer" className="docs-source-link">
        cli/src/index.ts
      </a>

      <h2 id="usage">Usage</h2>
      <Code
        lang="bash"
        title="terminal"
        code={`# With npx (no install)
npx @walkie-talkie/cli@latest

# Or install globally
npm install -g @walkie-talkie/cli
walkie-talkie`}
      />

      <h2 id="options">Options</h2>
      <table>
        <thead>
          <tr>
            <th>Flag</th>
            <th>Description</th>
            <th>Default</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>-p, --port=&lt;number&gt;</code></td>
            <td>Port to listen on</td>
            <td><code>3456</code></td>
          </tr>
          <tr>
            <td><code>-d, --dir=&lt;path&gt;</code></td>
            <td>Working directory for spawned terminals</td>
            <td>Current directory</td>
          </tr>
          <tr>
            <td><code>-f, --force</code></td>
            <td>Kill any existing process on the port before starting</td>
            <td><code>false</code></td>
          </tr>
          <tr>
            <td><code>-o, --open</code></td>
            <td>Open the web client in your default browser</td>
            <td><code>false</code></td>
          </tr>
          <tr>
            <td><code>-h, --help</code></td>
            <td>Show help message</td>
            <td>-</td>
          </tr>
          <tr>
            <td><code>-v, --version</code></td>
            <td>Print version</td>
            <td>-</td>
          </tr>
        </tbody>
      </table>

      <h2 id="examples">Examples</h2>
      <Code
        lang="bash"
        title="terminal"
        code={`# Start on a custom port and auto-open
walkie-talkie -p 8080 --open

# Force kill existing process on port 3456
walkie-talkie --force

# Set working directory to a specific project
walkie-talkie -d ~/projects/my-app --open`}
      />

      <h2 id="output">Output</h2>
      <p>
        When the server starts, the CLI displays:
      </p>
      <ul>
        <li>An ASCII QR code you can scan from a mobile device</li>
        <li>A URL with the token embedded (e.g. <code>https://demo.walkie-talkie.dev?server=...&token=...</code>)</li>
        <li>The raw token value for manual entry</li>
        <li>Server address and port</li>
      </ul>

      <h2 id="token-refresh">Token Refresh</h2>
      <p>
        Tokens expire after 5 minutes and are single-use. To generate a new token
        without restarting the server:
      </p>
      <Code
        lang="bash"
        title="terminal"
        code={`# On macOS/Linux — send SIGUSR1 to the server process
kill -USR1 $(pgrep -f walkie-talkie)`}
      />

      <h2 id="port-conflicts">Port Conflicts</h2>
      <p>
        If something is already listening on the port, the CLI will detect it and
        offer the <code>--force</code> flag. With <code>--force</code>, it runs:
      </p>
      <Code
        lang="bash"
        code={`# macOS/Linux
lsof -ti:<port> | xargs kill -9

# Windows
taskkill /F /PID <pid>`}
      />

      <div className="docs-nav-footer">
        <a href="/docs" className="docs-nav-link">
          <span className="docs-nav-link-label">Previous</span>
          <span className="docs-nav-link-title">&larr; Overview</span>
        </a>
        <a href="/docs/server" className="docs-nav-link docs-nav-link-next">
          <span className="docs-nav-link-label">Next</span>
          <span className="docs-nav-link-title">Server &rarr;</span>
        </a>
      </div>
    </>
  );
}

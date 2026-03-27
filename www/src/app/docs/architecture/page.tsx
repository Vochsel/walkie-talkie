import { Code } from '../code';

const GITHUB = 'https://github.com/vochsel/walkie-talkie';

export const metadata = {
  title: 'Architecture — Walkie-Talkie Docs',
  description: 'System architecture and design decisions behind walkie-talkie.',
};

export default function ArchitecturePage() {
  return (
    <>
      <div className="docs-breadcrumb">
        <a href="/docs">docs</a> / architecture
      </div>
      <h1>Architecture</h1>
      <p className="docs-subtitle">
        How the packages fit together, the security model, and key design decisions.
      </p>

      <h2 id="package-graph">Package Dependency Graph</h2>
      <Code
        lang="text"
        title="dependency-graph"
        code={`@walkie-talkie/shared          ← Protocol types & constants
    │
    ├──▶ @walkie-talkie/server   ← Express + WS + node-pty
    │        │
    │        └──▶ @walkie-talkie/cli      ← CLI launcher (bundles server)
    │        └──▶ @walkie-talkie/service  ← Electron tray app
    │
    ├──▶ @walkie-talkie/client   ← Framework-agnostic WS client
    │        │
    │        └──▶ @walkie-talkie/react    ← React hooks + TerminalView
    │                  │
    │                  └──▶ @walkie-talkie/web  ← Next.js web client
    │
    └──▶ @walkie-talkie/www      ← Landing page (independent)`}
      />
      <p>
        The shared package is the root — it defines the contract between server and
        client. Everything else builds on top.
      </p>

      <h2 id="layers">Layered Architecture</h2>
      <h3>Protocol Layer (shared)</h3>
      <p>
        TypeScript interfaces define every message type. Both server and client import
        these types, so the protocol is enforced at compile time. No runtime validation
        is needed between trusted packages.
      </p>
      <a
        href={`${GITHUB}/blob/main/shared/src/protocol.ts`}
        target="_blank"
        rel="noopener noreferrer"
        className="docs-source-link"
      >
        shared/src/protocol.ts
      </a>

      <h3>Server Layer</h3>
      <p>
        The server has three concerns:
      </p>
      <ol>
        <li>
          <strong>Terminal management</strong> — <code>TerminalSession</code> wraps <code>node-pty</code>,
          maintains a scrollback buffer (100KB max), and emits data/exit events.
        </li>
        <li>
          <strong>Authentication</strong> — <code>TokenManager</code> handles token generation,
          consumption, and session persistence.
        </li>
        <li>
          <strong>WebSocket bridge</strong> — Routes messages between authenticated clients
          and their terminals. Each session is isolated.
        </li>
      </ol>
      <a
        href={`${GITHUB}/blob/main/server/src/index.ts`}
        target="_blank"
        rel="noopener noreferrer"
        className="docs-source-link"
      >
        server/src/index.ts
      </a>

      <h3>Client Layer</h3>
      <p>
        The client is deliberately framework-agnostic. <code>WalkieTalkieClient</code> is a
        plain TypeScript class with no React, Vue, or Angular dependencies. It handles:
      </p>
      <ul>
        <li>WebSocket lifecycle (connect, auth, reconnect)</li>
        <li>State machine (<code>disconnected → connecting → authenticating → connected</code>)</li>
        <li>Auto-reconnect with exponential backoff</li>
        <li>Session resume</li>
      </ul>
      <a
        href={`${GITHUB}/blob/main/client/src/client.ts`}
        target="_blank"
        rel="noopener noreferrer"
        className="docs-source-link"
      >
        client/src/client.ts
      </a>

      <h3>React Layer</h3>
      <p>
        A thin wrapper over the client. <code>useWalkieTalkie</code> manages reactive state
        (terminal list, connection state) and output buffering. <code>TerminalView</code>
        is an xterm.js component with auto-fit and resize detection.
      </p>
      <a
        href={`${GITHUB}/blob/main/react/src/useWalkieTalkie.ts`}
        target="_blank"
        rel="noopener noreferrer"
        className="docs-source-link"
      >
        react/src/useWalkieTalkie.ts
      </a>

      <h2 id="security">Security Model</h2>

      <h3>Token Lifecycle</h3>
      <Code
        lang="text"
        title="token-lifecycle"
        code={`Server generates token
    │
    │  Token: a1b2-c3d4-e5f6-7890
    │  TTL: 5 minutes
    │  Usage: single-use
    │  Storage: in-memory only
    │
    ▼
Client receives token (QR code, URL, or CLI output)
    │
    ▼
Client sends: { type: "auth", token: "a1b2-..." }
    │
    ▼
Server validates:
    ├── Token exists? ─── No  → auth:fail (invalid_token)
    ├── Already used?  ── Yes → auth:fail (invalid_token)
    ├── Expired?       ── Yes → auth:fail (invalid_token)
    └── Valid ─────────────── → Consume token
                                  │
                                  ▼
                              Generate sessionId (UUID)
                              Persist to ~/.walkie-talkie/sessions.json
                              Send: { type: "auth:ok", sessionId: "..." }`}
      />

      <h3>Session Persistence</h3>
      <p>Sessions survive server restarts with a 24-hour expiry:</p>
      <ul>
        <li>Stored at <code>~/.walkie-talkie/sessions.json</code></li>
        <li>Sessions older than 24 hours are pruned on server start</li>
        <li>Tokens are <strong>never</strong> persisted — only session IDs</li>
        <li>A session can have multiple terminals</li>
      </ul>

      <h3>Session Isolation</h3>
      <p>
        Each session has its own set of terminals. Session A cannot see or interact with
        Session B's terminals, even on the same server.
      </p>

      <h2 id="data-flow">Data Flow</h2>
      <Code
        lang="text"
        title="data-flow"
        code={`┌──────────┐    WebSocket     ┌──────────┐     node-pty    ┌──────────┐
│          │  ──────────────▶ │          │ ──────────────▶ │          │
│  Browser │   JSON messages  │  Server  │   raw bytes     │   PTY    │
│  Client  │  ◀────────────── │          │ ◀────────────── │ (shell)  │
│          │                  │          │                 │          │
└──────────┘                  └──────────┘                 └──────────┘

  xterm.js                     Express +                   /bin/bash
  renders                      ws library                  or similar
  terminal                     routes msgs`}
      />

      <h3>Terminal I/O Path</h3>
      <ol>
        <li>User types in xterm.js → <code>onData</code> callback fires</li>
        <li>Client sends <code>terminal:input</code> over WebSocket</li>
        <li>Server writes to PTY via <code>pty.write(data)</code></li>
        <li>PTY processes input, produces output</li>
        <li>Server receives PTY output via <code>pty.onData</code></li>
        <li>Server sends <code>terminal:output</code> over WebSocket</li>
        <li>Client writes to xterm.js via <code>terminal.write(data)</code></li>
      </ol>

      <h3>Scrollback</h3>
      <p>
        The server maintains a 100KB scrollback buffer per terminal. On session resume,
        this buffer is replayed so the client sees the terminal exactly as it was.
        The client-side React hook also buffers 100KB per terminal for component re-mounts.
      </p>

      <h2 id="heartbeat">Heartbeat / Keepalive</h2>
      <p>
        The server sends WebSocket pings every 30 seconds. If a client doesn't respond
        with a pong before the next ping, the connection is terminated. This detects
        dead connections from network drops or closed tabs.
      </p>

      <h2 id="reconnect">Reconnection Strategy</h2>
      <Code
        lang="text"
        title="reconnect"
        code={`Disconnect detected
    │
    ▼
Wait 1s → reconnect attempt 1
    │ fail
    ▼
Wait 2s → reconnect attempt 2
    │ fail
    ▼
Wait 4s → reconnect attempt 3
    │ fail
    ▼
Wait 8s → reconnect attempt 4
    ...
    ▼
Wait 30s (max) → reconnect attempt N
    │ success
    ▼
Send auth:resume { sessionId }
    │
    ▼
Server replays terminal list + scrollback`}
      />

      <h2 id="monorepo">Monorepo Structure</h2>
      <Code
        lang="text"
        title="directory-layout"
        code={`walkie-talkie/
├── shared/           @walkie-talkie/shared    — Protocol types
├── server/           @walkie-talkie/server    — Core server
├── client/           @walkie-talkie/client    — WS client
├── react/            @walkie-talkie/react     — React hooks + components
├── cli/              @walkie-talkie/cli       — CLI launcher
├── service/          @walkie-talkie/service   — Electron tray app
├── web/              @walkie-talkie/web       — Next.js web client (5 views)
├── www/              @walkie-talkie/www       — Landing page + docs
├── pnpm-workspace.yaml
└── package.json`}
      />
      <p>
        All packages use <code>workspace:*</code> for internal dependencies, TypeScript
        for source, and compile to <code>dist/</code> with type definitions.
      </p>

      <h2 id="build-order">Build Order</h2>
      <Code
        lang="bash"
        title="build-chain"
        code={`# Correct build order (each depends on the previous)
pnpm --filter @walkie-talkie/shared build    # Types first
pnpm --filter @walkie-talkie/server build    # Server (uses shared)
pnpm --filter @walkie-talkie/client build    # Client (uses shared)
pnpm --filter @walkie-talkie/react build     # React (uses client + shared)

# These can be parallel after the above:
pnpm --filter @walkie-talkie/cli build       # Bundles server with esbuild
pnpm --filter @walkie-talkie/web build       # Next.js build
pnpm --filter @walkie-talkie/www build       # Landing page build`}
      />

      <h2 id="design-decisions">Key Design Decisions</h2>

      <h3>Why node-pty?</h3>
      <p>
        Real pseudo-terminals support all the features users expect: shell prompts,
        tab completion, colors, curses apps (vim, htop, etc). Alternatives like
        child_process.exec can't do this.
      </p>

      <h3>Why framework-agnostic client?</h3>
      <p>
        By keeping the core client as a plain TypeScript class, it works in React, Vue,
        Svelte, Node.js scripts, Electron, or even a raw browser console. The React
        package is just a thin wrapper — other framework wrappers could be built trivially.
      </p>

      <h3>Why single-use tokens?</h3>
      <p>
        If a token is leaked (someone screenshots the QR code), it can only be used once.
        After that, the attacker needs a new token. Sessions are identified by UUID,
        which is never displayed in a QR code.
      </p>

      <h3>Why JSON over WebSocket?</h3>
      <p>
        Simplicity. The protocol has ~13 message types. JSON is human-readable, easy
        to debug, and any language can parse it. The overhead is negligible compared
        to terminal output bandwidth.
      </p>

      <div className="docs-nav-footer">
        <a href="/docs/protocol" className="docs-nav-link">
          <span className="docs-nav-link-label">Previous</span>
          <span className="docs-nav-link-title">&larr; Protocol</span>
        </a>
        <div />
      </div>
    </>
  );
}

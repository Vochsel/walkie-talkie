# walkie-talkie

Remote terminal access from your browser. One command to start.

## Quick Start

```bash
npx walkie-talkie
```

That's it. Open the URL printed in your terminal. Connect with the token.

## Session State (git-friendly)

Walkie-talkie remembers your terminals per project. While the server runs it writes
your open tabs — names, working directory, and recent commands — to:

```
<project>/.walkie-talkie/state.yaml
```

Commit this file to git. When you come back to the repo (even weeks later), connecting
shows a **"Welcome back"** panel listing your previous tabs and the commands you ran in
each, so you can reopen a fresh shell right where you left off.

```yaml
# walkie-talkie session state — safe to commit.
version: 1
updatedAt: 2026-06-28T10:30:00.000Z
terminals:
  - name: dev server
    shell: /bin/zsh
    cwd: ./web
    createdAt: 2026-06-28T09:00:00.000Z
    lastActive: 2026-06-28T10:29:00.000Z
    recentCommands:
      - pnpm dev
      - git status
```

Recent commands are captured heuristically and run through **best-effort secret
redaction** (env-var assignments, `--token`/`--password` flags and URL credentials are
masked) since the file is meant to be committed. Review it before committing, or run with
`--no-history` to disable command capture entirely.

## Read-only File Browsing

The web UI can browse and view files in the directory the server was started from,
**read-only** and **jailed to that directory** (path traversal and symlink escapes are
rejected). Every view has a **Files** affordance — a panel, sidebar section, or overlay
depending on the view. Backed by `GET /api/fs/list` and `GET /api/fs/read` (Bearer auth).

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| [`@walkie-talkie/cli`](./cli) | Standalone CLI launcher — the `npx` entry point | `npm i -g @walkie-talkie/cli` |
| [`@walkie-talkie/react`](./react) | React hooks (`useWalkieTalkie`) and `TerminalView` component | `npm i @walkie-talkie/react` |
| [`@walkie-talkie/client`](./client) | Framework-agnostic WebSocket client with auto-reconnect | `npm i @walkie-talkie/client` |
| [`@walkie-talkie/server`](./server) | Express + WebSocket server with node-pty terminals | `npm i @walkie-talkie/server` |
| [`@walkie-talkie/shared`](./shared) | Protocol types and constants | `npm i @walkie-talkie/shared` |

## Demo

The [`./web`](./web) directory is a full Next.js reference app that demonstrates how to use the packages together. It shows how to connect to a walkie-talkie server, manage terminals, and render them using `@walkie-talkie/react` — with 5 different view modes (classic tabs, sidebar, whiteboard, Minecraft 3D, and RPG).

Run it locally:

```bash
pnpm dev        # starts CLI server on :3456 + web client on :3000
```

## Architecture

```
walkie-talkie/
  cli/        - Standalone CLI (npx walkie-talkie)
  client/     - WebSocket client (framework-agnostic)
  react/      - React hooks + TerminalView component
  server/     - Express + WebSocket + node-pty server
  shared/     - Protocol types & constants
  service/    - Electron tray app (optional)
  web/        - Demo app — reference implementation using the packages
  www/        - Landing page & docs (walkie-talkie.dev)
```

## Development

```bash
pnpm install
pnpm build:shared

# CLI + web client
pnpm dev          # runs CLI server + web client

# Or individually
pnpm dev:cli      # terminal server on :3456
pnpm dev:web      # web client on :3000
pnpm dev:service  # Electron tray app
pnpm dev:www      # landing page on :3001
```

## Web Client Views

The web client supports 5 interchangeable views — same terminals, different UIs:

- **Classic** — tabbed terminal layout
- **Sidebar** — OpenAI-style grouped sidebar
- **Whiteboard** — infinite canvas with draggable terminal windows
- **Minecraft** — 3D voxel world with terminal blocks (Three.js)
- **RPG** — top-down Factorio-style game with terminal stations

## Build Your Own Client

The protocol is simple WebSocket JSON:

```typescript
const ws = new WebSocket('ws://localhost:3456/ws');

// Authenticate
ws.send(JSON.stringify({ type: 'auth', token: 'your-token' }));

// Create a terminal
ws.send(JSON.stringify({ type: 'terminal:create', cols: 80, rows: 24 }));

// Send input
ws.send(JSON.stringify({ type: 'terminal:input', terminalId: '...', data: 'ls\n' }));

// Receive output
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'terminal:output') {
    console.log(msg.data);
  }
};
```

## Security

- **Magic tokens**: 64-bit random, 5-minute TTL, single-use
- **Session tokens**: UUID issued on auth, tied to WebSocket connection
- **Auth timeout**: 10s to authenticate or disconnected
- **In-memory only**: Restart clears all tokens/sessions
- **Session state on disk**: Tab names + recent commands persist to `.walkie-talkie/state.yaml` in the project dir (secret-redacted; `--no-history` to disable)
- **File access**: Read-only and jailed to the start directory; no write/exec endpoints
- **HTTPS**: Automatic via ngrok when tunneled

## Tech Stack

- **CLI**: Node.js, Express, ws, node-pty, qrcode
- **Service**: Electron (optional tray app)
- **Web**: Next.js 15, React 19, xterm.js, Three.js, html5-qrcode
- **Shared**: TypeScript protocol types
- **Site**: Next.js, Vercel AI SDK, GPT 5.1 mini

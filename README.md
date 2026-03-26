# walkie-talkie

Remote terminal access from your browser. One command to start.

## Quick Start

```bash
npx walkie-talkie
```

That's it. Open the URL printed in your terminal. Connect with the token.

## Architecture

```
walkie-talkie/
  cli/        - Standalone CLI (npx walkie-talkie)
  shared/     - Protocol types & constants
  service/    - Electron tray app (optional, for system tray)
  web/        - Next.js web client with xterm.js (5 view modes)
  www/        - Landing page site (walkie-talkie.dev)
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
- **HTTPS**: Automatic via ngrok when tunneled

## Tech Stack

- **CLI**: Node.js, Express, ws, node-pty, qrcode
- **Service**: Electron (optional tray app)
- **Web**: Next.js 15, React 19, xterm.js, Three.js, html5-qrcode
- **Shared**: TypeScript protocol types
- **Site**: Next.js, Vercel AI SDK, GPT 5.1 mini

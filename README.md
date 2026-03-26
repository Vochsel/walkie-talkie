# walkie-talkie

Remote terminal access from your browser. Runs as a system tray app on Mac, Windows, and Linux.

## Architecture

```
walkie-talkie/
  shared/     - Protocol types & constants (used by both service and web)
  service/    - Electron tray app + Express/WebSocket terminal server
  web/        - Next.js web client with xterm.js
```

**Service** runs in your system tray and hosts PTY terminal sessions over WebSocket. Authenticate with magic tokens (short-lived, single-use) that can be shared via QR code. Optionally tunnel via ngrok for cross-network access.

**Web** connects to the service from any browser, renders terminals via xterm.js, supports multiple tabs.

## Quick Start

```bash
# Install dependencies
pnpm install

# Build shared types first
pnpm build:shared

# Run the tray service
pnpm dev:service

# In another terminal, run the web client
pnpm dev:web
```

Then:
1. The tray icon appears — right-click it
2. Copy the **token** from the tray menu (or click "Show QR Code")
3. Open `http://localhost:3000` in your browser
4. Paste the token and the server URL (`http://localhost:3456`) and hit Connect
5. A terminal opens in your browser

## ngrok Tunnel (Remote Access)

Set `NGROK_AUTHTOKEN` in your environment, then click **Start ngrok Tunnel** in the tray menu. The tunnel URL is shown in the menu and encoded into QR codes automatically.

```bash
export NGROK_AUTHTOKEN=your_token_here
pnpm dev:service
```

## Security

- **Magic tokens**: 64-bit random, 5-minute TTL, single-use
- **Session tokens**: UUID issued on auth, tied to WebSocket connection
- **Auth timeout**: Connections that don't authenticate within 10s are dropped
- **No persistent storage**: All tokens/sessions are in-memory only
- **HTTPS**: Automatic via ngrok when tunneled

## Tech Stack

- **Service**: Electron, Express, ws, node-pty, @ngrok/ngrok, qrcode
- **Web**: Next.js 15, React 19, xterm.js, html5-qrcode
- **Shared**: TypeScript protocol types

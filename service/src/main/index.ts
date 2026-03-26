import { app, Tray, Menu, nativeImage, clipboard, shell, BrowserWindow } from 'electron';
import path from 'path';
import { WalkieTalkieServer, ServerState } from './server';
import { DEFAULT_PORT } from '@walkie-talkie/shared';

const WEB_CLIENT_PORT = 3000;

let tray: Tray | null = null;
let server: WalkieTalkieServer;
let qrWindow: BrowserWindow | null = null;
let currentState: ServerState = {
  port: DEFAULT_PORT,
  token: null,
  tokenExpiresAt: null,
  tunnelUrl: null,
  terminalCount: 0,
  sessionCount: 0,
};

// Prevent multiple instances
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

app.on('ready', async () => {
  // Hide dock icon on macOS (tray-only app)
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  // Create server
  server = new WalkieTalkieServer(DEFAULT_PORT);
  server.setStateChangeCallback((state) => {
    currentState = state;
    rebuildMenu();
  });

  await server.start();
  currentState = server.getState();

  // Auto-generate first token
  const { token, expiresAt } = server.generateToken();
  currentState.token = token;
  currentState.tokenExpiresAt = expiresAt;

  // Create tray
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'tray-iconTemplate.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('Walkie-Talkie');

  rebuildMenu();
});

function rebuildMenu(): void {
  if (!tray) return;

  const tunnelActive = !!currentState.tunnelUrl;

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: `Walkie-Talkie`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: `Status: Running on port ${currentState.port}`,
      enabled: false,
    },
    {
      label: `Terminals: ${currentState.terminalCount} active`,
      enabled: false,
    },
    {
      label: `Sessions: ${currentState.sessionCount} connected`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: currentState.token
        ? `Token: ${currentState.token}`
        : 'No active token',
      click: () => {
        if (currentState.token) {
          clipboard.writeText(currentState.token);
        }
      },
      toolTip: 'Click to copy token',
    },
    {
      label: 'Show QR Code',
      click: showQRCode,
      enabled: !!currentState.token,
    },
    {
      label: 'Generate New Token',
      click: () => {
        const { token, expiresAt } = server.generateToken();
        currentState.token = token;
        currentState.tokenExpiresAt = expiresAt;
        rebuildMenu();
      },
    },
    { type: 'separator' },
    {
      label: tunnelActive
        ? `Tunnel: ${currentState.tunnelUrl}`
        : 'Tunnel: Off',
      enabled: tunnelActive,
      click: () => {
        if (currentState.tunnelUrl) {
          clipboard.writeText(currentState.tunnelUrl);
        }
      },
    },
    {
      label: tunnelActive ? 'Stop Tunnel' : 'Start ngrok Tunnel',
      click: async () => {
        if (tunnelActive) {
          await server.stopTunnel();
        } else {
          try {
            await server.startTunnel();
          } catch (err: any) {
            console.error('Failed to start tunnel:', err.message);
          }
        }
        currentState = server.getState();
        rebuildMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Open Web Client',
      click: () => {
        const token = currentState.token || '';
        const serviceUrl = server.getBaseUrl();
        shell.openExternal(
          `http://localhost:${WEB_CLIENT_PORT}?server=${encodeURIComponent(serviceUrl)}&token=${encodeURIComponent(token)}`
        );
      },
    },
    {
      label: 'Copy Server URL',
      click: () => {
        clipboard.writeText(server.getBaseUrl());
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: async () => {
        await server.stop();
        app.quit();
      },
    },
  ];

  const contextMenu = Menu.buildFromTemplate(template);
  tray.setContextMenu(contextMenu);
}

async function showQRCode(): Promise<void> {
  const qr = await server.getQRCode();
  if (!qr) return;

  if (qrWindow && !qrWindow.isDestroyed()) {
    qrWindow.close();
  }

  qrWindow = new BrowserWindow({
    width: 360,
    height: 440,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    title: 'Walkie-Talkie — Scan to Connect',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      margin: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: #1a1a2e;
      color: #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    h3 { margin: 0 0 12px; font-size: 14px; color: #aaa; }
    img { border-radius: 8px; }
    .token {
      margin-top: 12px;
      font-family: monospace;
      font-size: 18px;
      letter-spacing: 2px;
      color: #00d4aa;
    }
    .hint {
      margin-top: 8px;
      font-size: 11px;
      color: #666;
    }
  </style>
</head>
<body>
  <h3>Scan to Connect</h3>
  <img src="${qr.dataUrl}" width="280" height="280" />
  <div class="token">${currentState.token}</div>
  <div class="hint">Or enter the token manually</div>
</body>
</html>`;

  qrWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  qrWindow.on('closed', () => {
    qrWindow = null;
  });
}

app.on('window-all-closed', () => {
  // Keep running as tray app — do nothing
});

app.on('before-quit', async () => {
  await server?.stop();
});

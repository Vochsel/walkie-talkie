import { createServer, generateQR } from './server';
import { DEFAULT_PORT } from '@walkie-talkie/shared';
import { createConnection } from 'net';
import { networkInterfaces, homedir } from 'os';
import { join, resolve } from 'path';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const WHITE = '\x1b[37m';
const UNDERLINE = '\x1b[4m';

const DEMO_HOST = 'https://demo.walkie-talkie.dev';

function parseArgs() {
  const args = process.argv.slice(2);
  let port = DEFAULT_PORT;
  let force = false;
  let open = false;
  let dir = process.cwd();
  let history = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--version' || arg === '-v') {
      console.log('1.1.0');
      process.exit(0);
    } else if (arg.startsWith('--port=')) {
      port = parseInt(arg.split('=')[1]);
    } else if ((arg === '-p' || arg === '--port') && i + 1 < args.length) {
      port = parseInt(args[++i]);
    } else if (arg === '--force' || arg === '-f') {
      force = true;
    } else if (arg === '--open' || arg === '-o') {
      open = true;
    } else if (arg.startsWith('--dir=')) {
      dir = arg.slice('--dir='.length);
    } else if ((arg === '-d' || arg === '--dir') && i + 1 < args.length) {
      dir = args[++i];
    } else if (arg === '--no-history') {
      history = false;
    }
  }

  // Expand a leading ~ (some shells don't expand it after `=`) and make absolute
  // so the working dir, state file, and file jail are unambiguous.
  if (dir === '~' || dir.startsWith('~/')) {
    dir = join(homedir(), dir.slice(1));
  }
  dir = resolve(dir);

  return { port, force, open, dir, history };
}

function printHelp() {
  console.log(`
  ${CYAN}${BOLD}walkie-talkie${RESET} ${DIM}v1.1.0${RESET}
  ${DIM}Remote terminal access from your browser${RESET}

  ${BOLD}USAGE${RESET}
    ${WHITE}walkie-talkie${RESET} ${DIM}[options]${RESET}

  ${BOLD}OPTIONS${RESET}
    ${WHITE}-p, --port=<number>${RESET}  ${DIM}Port to listen on (default: ${DEFAULT_PORT})${RESET}
    ${WHITE}-d, --dir=<path>${RESET}    ${DIM}Working directory for terminals (default: cwd)${RESET}
    ${WHITE}-f, --force${RESET}          ${DIM}Kill existing process on the port${RESET}
    ${WHITE}-o, --open${RESET}           ${DIM}Open browser automatically${RESET}
    ${WHITE}--no-history${RESET}         ${DIM}Don't capture recent commands to state.yaml${RESET}
    ${WHITE}-h, --help${RESET}           ${DIM}Show this help message${RESET}
    ${WHITE}-v, --version${RESET}        ${DIM}Show version number${RESET}

  ${BOLD}SESSION STATE${RESET}
    ${DIM}Terminal tabs, names and recent commands are saved to${RESET}
    ${WHITE}.walkie-talkie/state.yaml${RESET} ${DIM}in the working directory — commit it to${RESET}
    ${DIM}git to restore your tabs when you return. Files in the working${RESET}
    ${DIM}directory are browsable read-only from the web UI.${RESET}
`);
}

function banner() {
  console.log('');
  console.log(`  ${CYAN}${BOLD}walkie-talkie${RESET}  ${DIM}v1.1.0${RESET}`);
  console.log(`  ${DIM}Remote terminal access from your browser${RESET}`);
  console.log('');
}

function demoUrl(serverUrl: string, token: string): string {
  return `${DEMO_HOST}?server=${encodeURIComponent(serverUrl)}&token=${encodeURIComponent(token)}`;
}

function getLocalIp(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const conn = createConnection({ port }, () => {
      conn.end();
      resolve(true);
    });
    conn.on('error', () => resolve(false));
  });
}

function killPort(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process');
    const cmd = process.platform === 'win32'
      ? `for /f "tokens=5" %a in ('netstat -aon ^| find ":${port}" ^| find "LISTENING"') do taskkill /F /PID %a`
      : `lsof -ti:${port} | xargs kill -9`;
    exec(cmd, (err: Error | null) => {
      if (err) reject(new Error(`Could not kill process on port ${port}`));
      else setTimeout(resolve, 500);
    });
  });
}

async function main() {
  const { port, force, open, dir, history } = parseArgs();

  banner();

  const inUse = await isPortInUse(port);
  if (inUse) {
    if (force) {
      console.log(`  ${DIM}Port ${port} in use, killing existing process...${RESET}`);
      await killPort(port);
    } else {
      console.error(`  ${RED}Port ${port} is already in use${RESET}`);
      console.error(`  ${DIM}Run with ${WHITE}--force${RESET}${DIM} to kill the existing process${RESET}`);
      console.error(`  ${DIM}Or use ${WHITE}--port=<number>${RESET}${DIM} to pick a different port${RESET}`);
      process.exit(1);
    }
  }

  const server = createServer(port, dir, { history });
  await server.start();

  const token = server.generateToken();
  const lanIp = getLocalIp();
  const localUrl = `http://localhost:${port}`;
  const networkUrl = `http://${lanIp}:${port}`;
  const openUrl = demoUrl(localUrl, token.value);

  console.log(`  ${GREEN}${BOLD}Server running${RESET}`);
  console.log(`  ${DIM}Local:${RESET}   ${WHITE}${localUrl}${RESET}`);
  console.log(`  ${DIM}Network:${RESET} ${WHITE}${networkUrl}${RESET}`);
  console.log(`  ${DIM}Token:${RESET}   ${CYAN}${BOLD}${token.value}${RESET}`);
  console.log(`  ${DIM}State:${RESET}   ${WHITE}${join(dir, '.walkie-talkie', 'state.yaml')}${RESET}${history ? '' : ` ${DIM}(history off)${RESET}`}`);
  console.log(`  ${DIM}Files:${RESET}   ${WHITE}read-only browsing of ${dir}${RESET}`);
  console.log('');

  // QR code points to demo site
  try {
    const qr = await generateQR(openUrl);
    console.log(`  ${DIM}Scan to connect:${RESET}`);
    console.log(qr.split('\n').map((l) => '  ' + l).join('\n'));
  } catch {
    // QR generation failed — skip
  }

  console.log(`  ${DIM}Open in browser:${RESET}`);
  console.log(`  ${CYAN}${UNDERLINE}${openUrl}${RESET}`);
  console.log('');
  console.log(`  ${DIM}Press${RESET} ${WHITE}Ctrl+C${RESET} ${DIM}to stop${RESET}`);
  console.log('');

  if (open) {
    const { exec } = require('child_process');
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${cmd} "${openUrl}"`);
  }

  // Generate new token on SIGUSR1
  process.on('SIGUSR1', () => {
    const t = server.generateToken();
    const url = demoUrl(localUrl, t.value);
    console.log(`  ${GREEN}New token:${RESET} ${CYAN}${BOLD}${t.value}${RESET}`);
    console.log(`  ${CYAN}${UNDERLINE}${url}${RESET}`);
  });

  // Graceful shutdown
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) process.exit(1);
    shuttingDown = true;
    console.log(`\n  ${DIM}Shutting down...${RESET}`);
    const forceExit = setTimeout(() => process.exit(1), 3000);
    forceExit.unref();
    await server.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Catch uncaught errors — clean up the port
  process.on('uncaughtException', async (err) => {
    console.error(`\n  ${RED}Unexpected error: ${err.message}${RESET}`);
    await server.stop();
    process.exit(1);
  });
}

main().catch((err) => {
  console.error(`  ${RESET}${RED}Error: ${err.message}${RESET}`);
  process.exit(1);
});

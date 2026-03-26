#!/usr/bin/env node

import { createServer, generateQR } from './server';
import { DEFAULT_PORT } from '@walkie-talkie/shared';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const WHITE = '\x1b[37m';
const UNDERLINE = '\x1b[4m';

const DEMO_HOST = 'https://demo.walkie-talkie.dev';

function banner() {
  console.log('');
  console.log(`  ${CYAN}${BOLD}walkie-talkie${RESET}  ${DIM}v1.0.0${RESET}`);
  console.log(`  ${DIM}Remote terminal access from your browser${RESET}`);
  console.log('');
}

function demoUrl(serverUrl: string, token: string): string {
  return `${DEMO_HOST}?server=${encodeURIComponent(serverUrl)}&token=${encodeURIComponent(token)}`;
}

async function main() {
  const portArg = process.argv.find((a) => a.startsWith('--port='));
  const port = portArg ? parseInt(portArg.split('=')[1]) : DEFAULT_PORT;

  banner();

  const server = createServer(port);
  await server.start();

  const token = server.generateToken();
  const localUrl = `http://localhost:${port}`;
  const openUrl = demoUrl(localUrl, token.value);

  console.log(`  ${GREEN}${BOLD}Server running${RESET}`);
  console.log(`  ${DIM}Local:${RESET} ${WHITE}${localUrl}${RESET}`);
  console.log(`  ${DIM}Token:${RESET} ${CYAN}${BOLD}${token.value}${RESET}`);
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

  // Generate new token on SIGUSR1
  process.on('SIGUSR1', () => {
    const t = server.generateToken();
    const url = demoUrl(localUrl, t.value);
    console.log(`  ${GREEN}New token:${RESET} ${CYAN}${BOLD}${t.value}${RESET}`);
    console.log(`  ${CYAN}${UNDERLINE}${url}${RESET}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log(`\n  ${DIM}Shutting down...${RESET}`);
    await server.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(`  ${RESET}\x1b[31mError: ${err.message}${RESET}`);
  process.exit(1);
});

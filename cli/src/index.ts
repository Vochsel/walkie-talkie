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

function banner() {
  console.log('');
  console.log(`  ${CYAN}${BOLD}walkie-talkie${RESET}  ${DIM}v1.0.0${RESET}`);
  console.log(`  ${DIM}Remote terminal access from your browser${RESET}`);
  console.log('');
}

async function main() {
  const portArg = process.argv.find((a) => a.startsWith('--port='));
  const port = portArg ? parseInt(portArg.split('=')[1]) : DEFAULT_PORT;

  banner();

  const server = createServer(port);
  await server.start();

  const token = server.generateToken();
  const url = `http://localhost:${port}`;
  const connectUrl = `${url}?token=${token.value}`;

  console.log(`  ${GREEN}${BOLD}Server running${RESET}`);
  console.log(`  ${DIM}URL:${RESET}   ${WHITE}${url}${RESET}`);
  console.log(`  ${DIM}Token:${RESET} ${CYAN}${BOLD}${token.value}${RESET}`);
  console.log('');

  // QR code
  try {
    const qr = await generateQR(connectUrl);
    console.log(`  ${DIM}Scan to connect:${RESET}`);
    console.log(qr.split('\n').map((l) => '  ' + l).join('\n'));
  } catch {
    // QR generation failed — skip
  }

  console.log(`  ${DIM}Connect your web client to:${RESET}`);
  console.log(`  ${CYAN}${connectUrl}${RESET}`);
  console.log('');
  console.log(`  ${DIM}Or start the web UI:${RESET}  ${YELLOW}npx walkie-talkie-web${RESET}`);
  console.log(`  ${DIM}Press${RESET} ${WHITE}Ctrl+C${RESET} ${DIM}to stop${RESET}`);
  console.log('');

  // Generate new token on SIGUSR1
  process.on('SIGUSR1', () => {
    const t = server.generateToken();
    console.log(`  ${GREEN}New token:${RESET} ${CYAN}${BOLD}${t.value}${RESET}`);
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

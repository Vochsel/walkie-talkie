// SSR-safe entry point — no xterm dependency
export { useWalkieTalkie } from './useWalkieTalkie';
export type { TerminalOutputHandler } from './useWalkieTalkie';
export { usePersistedState, usePersistedRef } from './usePersistedState';

// Re-export client & shared for convenience
export * from '@walkie-talkie/client';

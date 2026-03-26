// Core client
export { WalkieTalkieClient } from './client';
export type { ConnectionState, MessageHandler, StateHandler } from './client';

// Storage utilities
export {
  getSavedConnections,
  saveConnection,
  removeConnection,
  clearConnections,
  loadState,
  saveState,
} from './storage';
export type { SavedConnection } from './storage';

// Re-export shared types & constants for convenience
export * from '@walkie-talkie/shared';

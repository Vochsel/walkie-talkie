// === Terminal Info ===

export interface TerminalInfo {
  id: string;
  pid: number;
  shell: string;
  cols: number;
  rows: number;
  cwd: string;
  createdAt: number;
  name?: string;
  /** Best-effort recent command history (redacted, newest last). */
  recentCommands?: string[];
  /** Epoch ms of the last captured command. */
  lastActive?: number;
}

// === Persisted Session State (git-committable) ===

/**
 * A terminal as recorded in `.walkie-talkie/state.yaml`. Holds enough to
 * show "what was I doing here" and to reopen a fresh shell in the same place.
 * Deliberately excludes volatile fields (id/pid) to keep git diffs meaningful.
 */
export interface SavedTerminal {
  name?: string;
  shell: string;
  /** Relative to the repo root when inside it, absolute otherwise. */
  cwd: string;
  createdAt: number;
  lastActive: number;
  recentCommands: string[];
}

// === Client -> Server Messages ===

export interface AuthMessage {
  type: 'auth';
  token: string;
}

export interface AuthResumeMessage {
  type: 'auth:resume';
  sessionId: string;
}

export interface TerminalInputMessage {
  type: 'terminal:input';
  terminalId: string;
  data: string;
}

export interface TerminalResizeMessage {
  type: 'terminal:resize';
  terminalId: string;
  cols: number;
  rows: number;
}

export interface TerminalCreateMessage {
  type: 'terminal:create';
  cols: number;
  rows: number;
  shell?: string;
  /** Optional name to apply immediately (used when reopening a saved terminal). */
  name?: string;
  /** Optional cwd (relative to repo root or absolute); jailed to the root server-side. */
  cwd?: string;
}

/** Ask the server to (re)send the persisted restore snapshot. */
export interface SessionRestoreRequestMessage {
  type: 'session:restore';
}

export interface TerminalKillMessage {
  type: 'terminal:kill';
  terminalId: string;
}

export interface TerminalListMessage {
  type: 'terminal:list';
}

export interface TerminalRenameMessage {
  type: 'terminal:rename';
  terminalId: string;
  name: string;
}

export type ClientMessage =
  | AuthMessage
  | AuthResumeMessage
  | TerminalInputMessage
  | TerminalResizeMessage
  | TerminalCreateMessage
  | TerminalKillMessage
  | TerminalListMessage
  | TerminalRenameMessage
  | SessionRestoreRequestMessage;

// === Server -> Client Messages ===

export interface AuthOkMessage {
  type: 'auth:ok';
  sessionId: string;
}

export interface AuthFailMessage {
  type: 'auth:fail';
  reason: string;
}

export interface TerminalOutputMessage {
  type: 'terminal:output';
  terminalId: string;
  data: string;
}

export interface TerminalCreatedMessage {
  type: 'terminal:created';
  terminal: TerminalInfo;
}

export interface TerminalExitedMessage {
  type: 'terminal:exited';
  terminalId: string;
  exitCode: number;
}

export interface TerminalListResponseMessage {
  type: 'terminal:list';
  terminals: TerminalInfo[];
}

export interface TerminalRenamedMessage {
  type: 'terminal:renamed';
  terminalId: string;
  name: string;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
  code?: string;
}

/**
 * Persisted state from a previous run, sent right after auth. The client uses
 * this to show a "Recent" panel offering to reopen previous terminals.
 */
export interface SessionRestoreMessage {
  type: 'session:restore';
  /** Absolute path of the directory the server was started in. */
  root: string;
  /** Basename of the root, for display. */
  repoName: string;
  terminals: SavedTerminal[];
}

export type ServerMessage =
  | AuthOkMessage
  | AuthFailMessage
  | TerminalOutputMessage
  | TerminalCreatedMessage
  | TerminalExitedMessage
  | TerminalListResponseMessage
  | TerminalRenamedMessage
  | SessionRestoreMessage
  | ErrorMessage;

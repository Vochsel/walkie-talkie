// === Terminal Info ===

export interface TerminalInfo {
  id: string;
  pid: number;
  shell: string;
  cols: number;
  rows: number;
  cwd: string;
  createdAt: number;
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
}

export interface TerminalKillMessage {
  type: 'terminal:kill';
  terminalId: string;
}

export interface TerminalListMessage {
  type: 'terminal:list';
}

export type ClientMessage =
  | AuthMessage
  | AuthResumeMessage
  | TerminalInputMessage
  | TerminalResizeMessage
  | TerminalCreateMessage
  | TerminalKillMessage
  | TerminalListMessage;

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

export interface ErrorMessage {
  type: 'error';
  message: string;
  code?: string;
}

export type ServerMessage =
  | AuthOkMessage
  | AuthFailMessage
  | TerminalOutputMessage
  | TerminalCreatedMessage
  | TerminalExitedMessage
  | TerminalListResponseMessage
  | ErrorMessage;

import { EventEmitter } from 'events';
import * as pty from 'node-pty';
import { TerminalInfo } from '@walkie-talkie/shared';

export class TerminalSession extends EventEmitter {
  public readonly id: string;
  public readonly createdAt: number;
  private ptyProcess: pty.IPty;
  private shell: string;
  private cols: number;
  private rows: number;

  constructor(id: string, opts: { cols: number; rows: number; shell?: string }) {
    super();
    this.id = id;
    this.createdAt = Date.now();
    this.cols = opts.cols;
    this.rows = opts.rows;

    this.shell = opts.shell || this.getDefaultShell();

    this.ptyProcess = pty.spawn(this.shell, [], {
      name: 'xterm-256color',
      cols: this.cols,
      rows: this.rows,
      cwd: process.env.HOME || process.env.USERPROFILE || '/',
      env: process.env as Record<string, string>,
    });

    this.ptyProcess.onData((data: string) => {
      this.emit('data', data);
    });

    this.ptyProcess.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
      this.emit('exit', exitCode, signal);
    });
  }

  private getDefaultShell(): string {
    if (process.platform === 'win32') return 'powershell.exe';
    return process.env.SHELL || '/bin/bash';
  }

  write(data: string): void {
    this.ptyProcess.write(data);
  }

  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    this.ptyProcess.resize(cols, rows);
  }

  kill(): void {
    this.ptyProcess.kill();
  }

  getInfo(): TerminalInfo {
    return {
      id: this.id,
      pid: this.ptyProcess.pid,
      shell: this.shell,
      cols: this.cols,
      rows: this.rows,
      cwd: process.cwd(),
      createdAt: this.createdAt,
    };
  }
}

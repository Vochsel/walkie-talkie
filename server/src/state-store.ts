// Persisted, git-committable session state: terminal tabs, names, cwd and
// recent commands written to `<root>/.walkie-talkie/state.yaml`.
//
// Internally timestamps are epoch-ms numbers (matching the protocol types); in
// the YAML file they are written as ISO strings for human readability. Writes
// are debounced and atomic (temp file + rename).

import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { SavedTerminal } from '@walkie-talkie/shared';

export const STATE_DIR = '.walkie-talkie';
export const STATE_FILE = 'state.yaml';

const HEADER = `# walkie-talkie session state — safe to commit.
# Restores your terminal tabs (names, cwd) and recent commands when you return.
# Edit or delete freely; regenerated automatically while the server runs.
`;

const SCHEMA_VERSION = 1;
const WRITE_DEBOUNCE_MS = 1000;

function statePath(root: string): string {
  return join(root, STATE_DIR, STATE_FILE);
}

function toIso(ms: number): string {
  try {
    return new Date(ms).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function fromIso(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

/** Read previously persisted terminals. Returns [] on any error (corrupt/missing). */
export function loadState(root: string): SavedTerminal[] {
  try {
    const raw = readFileSync(statePath(root), 'utf-8');
    const doc = parseYaml(raw);
    if (!doc || !Array.isArray(doc.terminals)) return [];
    return doc.terminals
      .filter((t: any) => t && typeof t.shell === 'string')
      .map((t: any): SavedTerminal => ({
        name: typeof t.name === 'string' ? t.name : undefined,
        shell: t.shell,
        cwd: typeof t.cwd === 'string' ? t.cwd : '.',
        createdAt: fromIso(t.createdAt),
        lastActive: fromIso(t.lastActive),
        recentCommands: Array.isArray(t.recentCommands)
          ? t.recentCommands.filter((c: any) => typeof c === 'string')
          : [],
      }));
  } catch {
    return [];
  }
}

function serialize(terminals: SavedTerminal[]): string {
  const doc = {
    version: SCHEMA_VERSION,
    updatedAt: toIso(Date.now()),
    terminals: terminals.map((t) => ({
      ...(t.name ? { name: t.name } : {}),
      shell: t.shell,
      cwd: t.cwd,
      createdAt: toIso(t.createdAt),
      lastActive: toIso(t.lastActive),
      recentCommands: t.recentCommands,
    })),
  };
  return HEADER + stringifyYaml(doc, { lineWidth: 0 });
}

function writeAtomic(root: string, terminals: SavedTerminal[]): void {
  const target = statePath(root);
  mkdirSync(dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.tmp`;
  writeFileSync(tmp, serialize(terminals), 'utf-8');
  renameSync(tmp, target);
}

export interface StateWriter {
  /** Queue a debounced write. `produce` is called when the write fires. */
  schedule(produce: () => SavedTerminal[]): void;
  /** Write immediately and synchronously (e.g. on shutdown). */
  flush(): void;
}

/**
 * Create a debounced, atomic writer for the state file. Coalesces bursts of
 * changes (keystrokes, renames) into at most one write per debounce window.
 */
export function createStateWriter(root: string): StateWriter {
  let timer: NodeJS.Timeout | null = null;
  let pending: (() => SavedTerminal[]) | null = null;

  const write = () => {
    if (!pending) return;
    const produce = pending;
    pending = null;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    try {
      writeAtomic(root, produce());
    } catch {
      // best-effort — never crash the server over persistence
    }
  };

  return {
    schedule(produce) {
      pending = produce;
      if (timer) return;
      timer = setTimeout(write, WRITE_DEBOUNCE_MS);
      timer.unref?.();
    },
    flush() {
      if (pending) write();
    },
  };
}

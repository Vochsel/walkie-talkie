const STORAGE_KEY = 'walkie-talkie:connections';
const PREFIX = 'walkie-talkie:';

// ── Connections ─────────────────────────────────────────────────────

export interface SavedConnection {
  serverUrl: string;
  sessionId: string;
  connectedAt: number;
  label?: string;
}

export function getSavedConnections(): SavedConnection[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveConnection(conn: SavedConnection): void {
  const conns = getSavedConnections();
  const idx = conns.findIndex((c) => c.serverUrl === conn.serverUrl);
  if (idx >= 0) conns[idx] = conn;
  else conns.unshift(conn);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conns.slice(0, 10)));
}

export function removeConnection(serverUrl: string): void {
  const conns = getSavedConnections().filter((c) => c.serverUrl !== serverUrl);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conns));
}

export function clearConnections(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ── Generic view state persistence ──────────────────────────────────

export function loadState<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveState(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // quota exceeded — silently ignore
  }
}

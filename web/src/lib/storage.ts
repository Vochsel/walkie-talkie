const STORAGE_KEY = 'walkie-talkie:connections';

export interface SavedConnection {
  serverUrl: string;
  sessionId: string;
  connectedAt: number; // epoch ms
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
  // Update existing for same serverUrl or add new
  const idx = conns.findIndex((c) => c.serverUrl === conn.serverUrl);
  if (idx >= 0) {
    conns[idx] = conn;
  } else {
    conns.unshift(conn);
  }
  // Keep max 10
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conns.slice(0, 10)));
}

export function removeConnection(serverUrl: string): void {
  const conns = getSavedConnections().filter((c) => c.serverUrl !== serverUrl);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conns));
}

export function clearConnections(): void {
  localStorage.removeItem(STORAGE_KEY);
}

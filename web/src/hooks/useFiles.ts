'use client';

import { useCallback, useMemo } from 'react';

export interface FsEntry {
  name: string;
  type: 'file' | 'dir';
  size: number;
  mtime: number;
}

export interface FsListing {
  path: string;
  entries: FsEntry[];
}

export interface FsFile {
  path: string;
  size: number;
  truncated: boolean;
  kind: 'text' | 'image' | 'binary';
  mime?: string;
  content?: string;
}

/**
 * Read-only file-system client for the server's `/api/fs/*` endpoints.
 * Authenticates with the active session id as a Bearer token.
 */
export function useFiles(serverUrl: string | null, sessionId: string | null) {
  const base = useMemo(() => (serverUrl ? serverUrl.replace(/\/$/, '') : null), [serverUrl]);
  const enabled = !!(base && sessionId);

  const req = useCallback(
    async (pathname: string, search = '') => {
      if (!base || !sessionId) throw new Error('Not connected');
      const res = await fetch(`${base}${pathname}${search}`, {
        headers: { Authorization: `Bearer ${sessionId}` },
      });
      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try {
          const body = await res.json();
          if (body?.error) msg = body.error;
        } catch {
          /* non-JSON error */
        }
        throw new Error(msg);
      }
      return res.json();
    },
    [base, sessionId]
  );

  const list = useCallback(
    (path: string): Promise<FsListing> =>
      req('/api/fs/list', `?path=${encodeURIComponent(path || '.')}`),
    [req]
  );

  const read = useCallback(
    (path: string): Promise<FsFile> => req('/api/fs/read', `?path=${encodeURIComponent(path)}`),
    [req]
  );

  const getRoot = useCallback(
    (): Promise<{ root: string; repoName: string }> => req('/api/fs/root'),
    [req]
  );

  return { enabled, list, read, getRoot };
}

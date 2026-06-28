'use client';

import { useCallback, useEffect, useState } from 'react';
import { useFiles, type FsEntry, type FsFile } from '@/hooks/useFiles';

interface FileBrowserProps {
  serverUrl: string | null;
  sessionId: string | null;
  /** Override the outer container style (each view positions it differently). */
  style?: React.CSSProperties;
  /** Title shown in the header (defaults to the repo name). */
  title?: string;
  onClose?: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Read-only directory navigator + file viewer backed by the server's
 * jailed `/api/fs/*` endpoints. Themeable via CSS variables so it blends
 * into whichever view mounts it.
 */
export default function FileBrowser({ serverUrl, sessionId, style, title, onClose }: FileBrowserProps) {
  const { enabled, list, read, getRoot } = useFiles(serverUrl, sessionId);
  const [repoName, setRepoName] = useState<string>('');
  const [segments, setSegments] = useState<string[]>([]);
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<string | null>(null);
  const [file, setFile] = useState<FsFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  const dirPath = segments.length ? `./${segments.join('/')}` : '.';

  useEffect(() => {
    if (!enabled) return;
    getRoot()
      .then((r) => setRepoName(r.repoName))
      .catch(() => setRepoName(''));
  }, [enabled, getRoot]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setListError(null);
    list(dirPath)
      .then((res) => {
        if (!cancelled) setEntries(res.entries);
      })
      .catch((e) => {
        if (!cancelled) setListError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, dirPath, list]);

  const openEntry = useCallback(
    (entry: FsEntry) => {
      if (entry.type === 'dir') {
        setSegments((prev) => [...prev, entry.name]);
        return;
      }
      const path = segments.length ? `${segments.join('/')}/${entry.name}` : entry.name;
      setSelected(path);
      setFile(null);
      setFileError(null);
      setFileLoading(true);
      read(path)
        .then(setFile)
        .catch((e) => setFileError(e.message))
        .finally(() => setFileLoading(false));
    },
    [segments, read]
  );

  const goTo = useCallback((depth: number) => {
    setSegments((prev) => prev.slice(0, depth));
  }, []);

  if (!enabled) {
    return (
      <div style={{ ...styles.container, ...style }}>
        <div style={styles.empty}>File browsing unavailable (not connected).</div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.container, ...style }}>
      <div style={styles.header}>
        <div style={styles.breadcrumb}>
          <button style={styles.crumb} onClick={() => goTo(0)} title="Project root">
            {title || repoName || 'files'}
          </button>
          {segments.map((seg, i) => (
            <span key={i} style={styles.crumbWrap}>
              <span style={styles.sep}>/</span>
              <button style={styles.crumb} onClick={() => goTo(i + 1)}>
                {seg}
              </button>
            </span>
          ))}
        </div>
        {onClose && (
          <button style={styles.closeBtn} onClick={onClose} title="Close">
            &times;
          </button>
        )}
      </div>

      <div style={styles.body}>
        <div style={styles.list}>
          {segments.length > 0 && (
            <button style={styles.row} onClick={() => goTo(segments.length - 1)}>
              <span style={styles.icon}>&#8617;</span>
              <span style={styles.name}>..</span>
            </button>
          )}
          {loading && <div style={styles.note}>Loading…</div>}
          {listError && <div style={styles.error}>{listError}</div>}
          {!loading &&
            !listError &&
            entries.map((entry) => {
              const path = segments.length ? `${segments.join('/')}/${entry.name}` : entry.name;
              const isActive = entry.type === 'file' && path === selected;
              return (
                <button
                  key={entry.name}
                  style={{ ...styles.row, ...(isActive ? styles.rowActive : {}) }}
                  onClick={() => openEntry(entry)}
                  title={entry.name}
                >
                  <span style={styles.icon}>{entry.type === 'dir' ? '\u{1F4C1}' : '\u{1F4C4}'}</span>
                  <span style={styles.name}>{entry.name}</span>
                  {entry.type === 'file' && <span style={styles.size}>{formatSize(entry.size)}</span>}
                </button>
              );
            })}
          {!loading && !listError && entries.length === 0 && (
            <div style={styles.note}>Empty directory</div>
          )}
        </div>

        <div style={styles.viewer}>
          {!selected && <div style={styles.empty}>Select a file to view it (read-only).</div>}
          {selected && (
            <>
              <div style={styles.viewerHeader}>
                <span style={styles.viewerPath}>{selected}</span>
                {file && <span style={styles.viewerMeta}>{formatSize(file.size)}{file.truncated ? ' · truncated' : ''}</span>}
              </div>
              <div style={styles.viewerBody}>
                {fileLoading && <div style={styles.note}>Loading…</div>}
                {fileError && <div style={styles.error}>{fileError}</div>}
                {file?.kind === 'text' && <pre style={styles.pre}>{file.content}</pre>}
                {file?.kind === 'image' && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={selected}
                    src={`data:${file.mime};base64,${file.content}`}
                    style={styles.image}
                  />
                )}
                {file?.kind === 'binary' && (
                  <div style={styles.empty}>Binary file — preview not available.</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    overflow: 'hidden',
    color: 'var(--text-primary)',
    fontSize: 13,
    minHeight: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '6px 10px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 2,
    overflow: 'hidden',
  },
  crumbWrap: { display: 'inline-flex', alignItems: 'center' },
  crumb: {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: "'SF Mono', monospace",
    padding: '2px 4px',
  },
  sep: { color: 'var(--text-muted)', fontSize: 12 },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: 18,
    cursor: 'pointer',
    lineHeight: 1,
    flexShrink: 0,
  },
  body: { display: 'flex', flex: 1, minHeight: 0 },
  list: {
    width: 240,
    minWidth: 200,
    borderRight: '1px solid var(--border)',
    overflowY: 'auto',
    padding: 4,
    background: 'var(--bg-secondary)',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    padding: '5px 8px',
    borderRadius: 4,
    fontSize: 13,
    textAlign: 'left',
  },
  rowActive: { background: 'var(--accent-dim)', color: 'var(--accent)' },
  icon: { fontSize: 13, flexShrink: 0 },
  name: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontFamily: "'SF Mono', monospace",
  },
  size: { color: 'var(--text-muted)', fontSize: 11, flexShrink: 0 },
  viewer: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 },
  viewerHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '6px 10px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  viewerPath: {
    fontFamily: "'SF Mono', monospace",
    fontSize: 12,
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  viewerMeta: { color: 'var(--text-muted)', fontSize: 11, flexShrink: 0 },
  viewerBody: { flex: 1, overflow: 'auto', minHeight: 0 },
  pre: {
    margin: 0,
    padding: 12,
    fontFamily: "'SF Mono', 'Fira Code', Menlo, monospace",
    fontSize: 12,
    lineHeight: 1.5,
    whiteSpace: 'pre',
    color: 'var(--text-primary)',
  },
  image: { maxWidth: '100%', height: 'auto', padding: 12, display: 'block' },
  note: { padding: 12, color: 'var(--text-secondary)', fontSize: 12 },
  error: { padding: 12, color: '#e06c75', fontSize: 12 },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-muted)',
    fontSize: 13,
    padding: 24,
    textAlign: 'center',
  },
};

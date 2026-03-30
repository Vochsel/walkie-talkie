'use client';

export type ViewType = 'classic' | 'sidebar' | 'whiteboard' | 'minecraft' | 'rpg';

interface ViewSwitcherProps {
  current: ViewType;
  onChange: (view: ViewType) => void;
}

const VIEWS: { id: ViewType; label: string; icon: string }[] = [
  { id: 'classic', label: 'Classic', icon: '>' },
  { id: 'sidebar', label: 'Sidebar', icon: '|' },
  { id: 'whiteboard', label: 'Whiteboard', icon: '#' },
  { id: 'minecraft', label: 'Minecraft', icon: 'M' },
  { id: 'rpg', label: 'RPG', icon: 'R' },
];

export default function ViewSwitcher({ current, onChange }: ViewSwitcherProps) {
  return (
    <div style={styles.container}>
      {VIEWS.map((view) => (
        <button
          key={view.id}
          style={{
            ...styles.btn,
            ...(current === view.id ? styles.active : {}),
          }}
          onClick={() => onChange(view.id)}
          title={view.label}
        >
          <span style={styles.icon}>{view.icon}</span>
          <span style={styles.label}>{view.label}</span>
        </button>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    padding: '4px 8px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    height: 36,
    flexShrink: 0,
  },
  btn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 12,
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap' as const,
  },
  active: {
    background: 'var(--bg-tertiary)',
    color: 'var(--accent)',
    boxShadow: '0 0 0 1px var(--border)',
  },
  icon: {
    fontFamily: "'SF Mono', monospace",
    fontWeight: 700,
    fontSize: 11,
    width: 16,
    textAlign: 'center' as const,
  },
  label: {
    fontWeight: 500,
  },
};

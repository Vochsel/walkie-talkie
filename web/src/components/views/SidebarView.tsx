'use client';

import { useState, useCallback } from 'react';
import type { ViewProps } from '@/app/page';
import TerminalView from '@/components/TerminalView';

interface Group {
  name: string;
  terminalIds: string[];
  collapsed: boolean;
}

export default function SidebarView({
  terminals,
  activeTerminalId,
  setActiveTerminalId,
  sendInput,
  resizeTerminal,
  killTerminal,
  createTerminal,
  registerOutputHandler,
}: ViewProps) {
  const [groups, setGroups] = useState<Group[]>([
    { name: 'Default', terminalIds: [], collapsed: false },
  ]);
  const [editingGroup, setEditingGroup] = useState<number | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [hoveredTerminal, setHoveredTerminal] = useState<string | null>(null);
  const [draggingTerminal, setDraggingTerminal] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<number | null>(null);

  // Get all terminal IDs that are explicitly assigned to a group
  const assignedIds = new Set(groups.flatMap((g) => g.terminalIds));

  // Terminals not assigned to any group go into "Default"
  const getGroupTerminalIds = (group: Group, groupIndex: number): string[] => {
    if (groupIndex === 0) {
      // Default group: includes its own assigned terminals + any unassigned ones
      const unassigned = terminals
        .filter((t) => !assignedIds.has(t.id) || group.terminalIds.includes(t.id))
        .map((t) => t.id);
      return unassigned;
    }
    // Filter out terminals that no longer exist
    return group.terminalIds.filter((id) => terminals.some((t) => t.id === id));
  };

  const toggleGroup = useCallback((index: number) => {
    setGroups((prev) =>
      prev.map((g, i) => (i === index ? { ...g, collapsed: !g.collapsed } : g))
    );
  }, []);

  const addGroup = useCallback(() => {
    setGroups((prev) => [
      ...prev,
      { name: `Group ${prev.length}`, terminalIds: [], collapsed: false },
    ]);
    setEditingGroup(groups.length);
    setNewGroupName(`Group ${groups.length}`);
  }, [groups.length]);

  const commitGroupName = useCallback(
    (index: number) => {
      const trimmed = newGroupName.trim();
      if (trimmed) {
        setGroups((prev) =>
          prev.map((g, i) => (i === index ? { ...g, name: trimmed } : g))
        );
      }
      setEditingGroup(null);
    },
    [newGroupName]
  );

  const removeGroup = useCallback(
    (index: number) => {
      if (index === 0) return; // Can't remove Default
      setGroups((prev) => {
        const removed = prev[index];
        // Move terminals back to Default
        const updated = [...prev];
        updated[0] = {
          ...updated[0],
          terminalIds: [...updated[0].terminalIds, ...removed.terminalIds],
        };
        updated.splice(index, 1);
        return updated;
      });
    },
    []
  );

  const handleDragStart = useCallback((terminalId: string) => {
    setDraggingTerminal(terminalId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, groupIndex: number) => {
    e.preventDefault();
    setDragOverGroup(groupIndex);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverGroup(null);
  }, []);

  const handleDrop = useCallback(
    (targetGroupIndex: number) => {
      if (!draggingTerminal) return;
      setGroups((prev) => {
        const updated = prev.map((g) => ({
          ...g,
          terminalIds: g.terminalIds.filter((id) => id !== draggingTerminal),
        }));
        updated[targetGroupIndex] = {
          ...updated[targetGroupIndex],
          terminalIds: [...updated[targetGroupIndex].terminalIds, draggingTerminal],
        };
        return updated;
      });
      setDraggingTerminal(null);
      setDragOverGroup(null);
    },
    [draggingTerminal]
  );

  const handleDragEnd = useCallback(() => {
    setDraggingTerminal(null);
    setDragOverGroup(null);
  }, []);

  const handleCreateTerminal = useCallback(() => {
    createTerminal(80, 24);
  }, [createTerminal]);

  const getShellDisplayName = (shell: string): string => {
    const parts = shell.split('/');
    return parts[parts.length - 1];
  };

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        {/* Sidebar header */}
        <div style={styles.sidebarHeader}>
          <span style={styles.sidebarTitle}>Terminals</span>
          <button
            style={styles.newTerminalBtn}
            onClick={handleCreateTerminal}
            title="New terminal"
          >
            +
          </button>
        </div>

        {/* Groups */}
        <div style={styles.groupList}>
          {groups.map((group, groupIndex) => {
            const groupTerminalIds = getGroupTerminalIds(group, groupIndex);
            const isDropTarget = dragOverGroup === groupIndex;

            return (
              <div
                key={groupIndex}
                style={styles.groupContainer}
                onDragOver={(e) => handleDragOver(e, groupIndex)}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDrop(groupIndex)}
              >
                {/* Group header */}
                <div
                  style={{
                    ...styles.groupHeader,
                    ...(isDropTarget ? styles.groupHeaderDropTarget : {}),
                  }}
                >
                  <button
                    style={styles.chevronBtn}
                    onClick={() => toggleGroup(groupIndex)}
                  >
                    <span
                      style={{
                        ...styles.chevron,
                        transform: group.collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                      }}
                    >
                      &#9662;
                    </span>
                  </button>

                  {editingGroup === groupIndex ? (
                    <input
                      style={styles.groupNameInput}
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onBlur={() => commitGroupName(groupIndex)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitGroupName(groupIndex);
                        if (e.key === 'Escape') setEditingGroup(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <span
                      style={styles.groupName}
                      onDoubleClick={() => {
                        setEditingGroup(groupIndex);
                        setNewGroupName(group.name);
                      }}
                    >
                      {group.name}
                    </span>
                  )}

                  <span style={styles.groupCount}>{groupTerminalIds.length}</span>

                  {groupIndex > 0 && (
                    <button
                      style={styles.removeGroupBtn}
                      onClick={() => removeGroup(groupIndex)}
                      title="Remove group"
                    >
                      &times;
                    </button>
                  )}
                </div>

                {/* Terminal items */}
                {!group.collapsed && (
                  <div style={styles.terminalList}>
                    {groupTerminalIds.map((termId) => {
                      const term = terminals.find((t) => t.id === termId);
                      if (!term) return null;
                      const isActive = term.id === activeTerminalId;
                      const isHovered = hoveredTerminal === term.id;

                      return (
                        <div
                          key={term.id}
                          style={{
                            ...styles.terminalItem,
                            ...(isActive ? styles.terminalItemActive : {}),
                            ...(isHovered && !isActive ? styles.terminalItemHover : {}),
                            ...(draggingTerminal === term.id ? styles.terminalItemDragging : {}),
                          }}
                          onClick={() => setActiveTerminalId(term.id)}
                          onMouseEnter={() => setHoveredTerminal(term.id)}
                          onMouseLeave={() => setHoveredTerminal(null)}
                          draggable
                          onDragStart={() => handleDragStart(term.id)}
                          onDragEnd={handleDragEnd}
                        >
                          <span style={styles.terminalIcon}>&#9632;</span>
                          <span
                            style={{
                              ...styles.terminalName,
                              ...(isActive ? styles.terminalNameActive : {}),
                            }}
                          >
                            {getShellDisplayName(term.shell)}
                          </span>
                          <span style={styles.terminalPid}>:{term.pid}</span>

                          {isHovered && (
                            <button
                              style={styles.deleteBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                killTerminal(term.id);
                              }}
                              title="Kill terminal"
                            >
                              &times;
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add group button */}
        <div style={styles.sidebarFooter}>
          <button style={styles.addGroupBtn} onClick={addGroup}>
            + New Group
          </button>
        </div>
      </div>

      {/* Terminal area */}
      <div style={styles.terminalArea}>
        {terminals.map((term) => (
          <TerminalView
            key={term.id}
            terminalId={term.id}
            isActive={term.id === activeTerminalId}
            onInput={(data) => sendInput(term.id, data)}
            onResize={(cols, rows) => resizeTerminal(term.id, cols, rows)}
            registerOutput={(handler) => registerOutputHandler(term.id, handler)}
          />
        ))}
        {terminals.length === 0 && (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>&#9654;</div>
            <p style={styles.emptyTitle}>No terminals open</p>
            <p style={styles.emptySubtitle}>
              Click the + button to create a new terminal session
            </p>
            <button style={styles.createBtn} onClick={handleCreateTerminal}>
              Create Terminal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100%',
    width: '100%',
    overflow: 'hidden',
  },

  // Sidebar
  sidebar: {
    width: 260,
    minWidth: 260,
    maxWidth: 260,
    height: '100%',
    backgroundColor: '#161b22',
    borderRight: '1px solid #30363d',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },

  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 16px 12px 16px',
    borderBottom: '1px solid #21262d',
  },

  sidebarTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#e6edf3',
    letterSpacing: '0.02em',
    textTransform: 'uppercase' as const,
  },

  newTerminalBtn: {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: '1px solid #30363d',
    borderRadius: 6,
    color: '#e6edf3',
    fontSize: 18,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    lineHeight: 1,
  },

  // Groups
  groupList: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '8px 0',
  },

  groupContainer: {
    marginBottom: 2,
  },

  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 12px 6px 8px',
    gap: 4,
    transition: 'background 0.15s ease',
  },

  groupHeaderDropTarget: {
    backgroundColor: 'rgba(0, 212, 170, 0.08)',
  },

  chevronBtn: {
    background: 'none',
    border: 'none',
    padding: '2px 4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  chevron: {
    display: 'inline-block',
    fontSize: 10,
    color: '#8b949e',
    transition: 'transform 0.2s ease',
  },

  groupName: {
    fontSize: 12,
    fontWeight: 600,
    color: '#8b949e',
    flex: 1,
    cursor: 'default',
    userSelect: 'none' as const,
    letterSpacing: '0.01em',
  },

  groupNameInput: {
    fontSize: 12,
    fontWeight: 600,
    color: '#e6edf3',
    flex: 1,
    background: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: 4,
    padding: '2px 6px',
    outline: 'none',
  },

  groupCount: {
    fontSize: 11,
    color: '#484f58',
    minWidth: 16,
    textAlign: 'center' as const,
  },

  removeGroupBtn: {
    background: 'none',
    border: 'none',
    color: '#484f58',
    fontSize: 16,
    cursor: 'pointer',
    padding: '0 2px',
    lineHeight: 1,
    transition: 'color 0.15s ease',
  },

  // Terminal items
  terminalList: {
    padding: '2px 0',
  },

  terminalItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '7px 12px 7px 28px',
    cursor: 'pointer',
    transition: 'all 0.12s ease',
    borderRadius: 0,
    position: 'relative' as const,
    gap: 8,
  },

  terminalItemActive: {
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    borderLeft: '2px solid #00d4aa',
    paddingLeft: 26,
  },

  terminalItemHover: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },

  terminalItemDragging: {
    opacity: 0.4,
  },

  terminalIcon: {
    fontSize: 8,
    color: '#484f58',
    lineHeight: 1,
  },

  terminalName: {
    fontSize: 13,
    color: '#b1bac4',
    flex: 1,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  },

  terminalNameActive: {
    color: '#00d4aa',
    fontWeight: 500,
  },

  terminalPid: {
    fontSize: 11,
    color: '#484f58',
    fontFamily: 'monospace',
  },

  deleteBtn: {
    position: 'absolute' as const,
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: '#8b949e',
    fontSize: 16,
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
    transition: 'color 0.15s ease',
  },

  // Sidebar footer
  sidebarFooter: {
    padding: '12px 16px',
    borderTop: '1px solid #21262d',
  },

  addGroupBtn: {
    width: '100%',
    padding: '6px 12px',
    background: 'transparent',
    border: '1px dashed #30363d',
    borderRadius: 6,
    color: '#8b949e',
    fontSize: 12,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    textAlign: 'center' as const,
  },

  // Terminal area
  terminalArea: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative' as const,
    backgroundColor: '#0d1117',
  },

  // Empty state
  empty: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#8b949e',
    gap: 12,
  },

  emptyIcon: {
    fontSize: 32,
    color: '#30363d',
    marginBottom: 8,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: 500,
    color: '#e6edf3',
    margin: 0,
  },

  emptySubtitle: {
    fontSize: 13,
    color: '#8b949e',
    margin: 0,
  },

  createBtn: {
    marginTop: 8,
    background: '#00d4aa',
    color: '#0d1117',
    border: 'none',
    borderRadius: 6,
    padding: '8px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s ease',
  },
};

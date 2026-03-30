'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { TerminalInfo } from '@walkie-talkie/shared';
import type { ViewProps } from '@/app/page';
import TerminalView from '@/components/TerminalView';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useTheme } from '@/hooks/useTheme';

interface NodeLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_NODE_WIDTH = 1000;
const DEFAULT_NODE_HEIGHT = 700;
const STAGGER_OFFSET = 40;
const MIN_NODE_WIDTH = 300;
const MIN_NODE_HEIGHT = 200;
const TITLEBAR_HEIGHT = 36;
const ZOOM_SPEED = 0.001;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 3;
const DOT_SPACING = 24;
const DOT_RADIUS = 1;

export default function WhiteboardView({
  terminals,
  activeTerminalId,
  setActiveTerminalId,
  sendInput,
  resizeTerminal,
  killTerminal,
  renameTerminal,
  createTerminal,
  registerOutputHandler,
}: ViewProps) {
  // Persist layouts as a plain object (Maps don't serialize)
  const [layoutsObj, setLayoutsObj] = usePersistedState<Record<string, NodeLayout>>('whiteboard:layouts', {});
  const nodeLayouts = new Map(Object.entries(layoutsObj));
  const setNodeLayouts = useCallback((updater: (prev: Map<string, NodeLayout>) => Map<string, NodeLayout>) => {
    setLayoutsObj((prev) => {
      const prevMap = new Map(Object.entries(prev));
      const nextMap = updater(prevMap);
      return Object.fromEntries(nextMap);
    });
  }, [setLayoutsObj]);

  const [pan, setPan] = usePersistedState('whiteboard:pan', { x: 0, y: 0 });
  const [zoom, setZoom] = usePersistedState('whiteboard:zoom', 1);

  // Drag state
  const [dragging, setDragging] = useState<{
    terminalId: string;
    startMouseX: number;
    startMouseY: number;
    startNodeX: number;
    startNodeY: number;
  } | null>(null);

  // Resize state
  const [resizing, setResizing] = useState<{
    terminalId: string;
    startMouseX: number;
    startMouseY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  // Canvas pan state
  const [panning, setPanning] = useState<{
    startMouseX: number;
    startMouseY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  const [spaceHeld, setSpaceHeld] = useState(false);
  const panMovedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeCountRef = useRef(0);
  const [hoveredClose, setHoveredClose] = useState<string | null>(null);
  const [addBtnHovered, setAddBtnHovered] = useState(false);
  const [layoutBtnHovered, setLayoutBtnHovered] = useState(false);
  const [themeBtnHovered, setThemeBtnHovered] = useState(false);
  const { theme, preference, cycleTheme } = useTheme();
  const [interactionMode, setInteractionMode] = usePersistedState<'design' | 'map'>('whiteboard:mode', 'map');
  const [hoveredControl, setHoveredControl] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    terminalId: string | null; // null = canvas background
    canvasX: number; // position in canvas coordinates for placing new terminals
    canvasY: number;
  } | null>(null);

  const getNodeDisplayName = (term: TerminalInfo) =>
    term.name || term.shell.split('/').pop() || 'terminal';

  const startEditingName = (term: TerminalInfo) => {
    setEditingNameId(term.id);
    setEditNameValue(getNodeDisplayName(term));
  };

  const commitName = (id: string) => {
    const trimmed = editNameValue.trim();
    if (trimmed) renameTerminal(id, trimmed);
    setEditingNameId(null);
  };

  // Screen coords → canvas coords
  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (screenX - rect.left - pan.x) / zoom,
      y: (screenY - rect.top - pan.y) / zoom,
    };
  }, [pan, zoom]);

  // Right-click on canvas background
  const handleCanvasContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    setContextMenu({ x: e.clientX, y: e.clientY, terminalId: null, canvasX: canvasPos.x, canvasY: canvasPos.y });
  }, [screenToCanvas]);

  // Right-click on a node
  const handleNodeContextMenu = useCallback((terminalId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    setActiveTerminalId(terminalId);
    setContextMenu({ x: e.clientX, y: e.clientY, terminalId, canvasX: canvasPos.x, canvasY: canvasPos.y });
  }, [screenToCanvas, setActiveTerminalId]);

  // Close context menu on any click or scroll
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('mousedown', close);
    window.addEventListener('wheel', close, { passive: true });
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('wheel', close);
    };
  }, [contextMenu]);

  // Context menu actions
  const ctxNewTerminal = useCallback(() => {
    if (!contextMenu) return;
    createTerminal(80, 24);
    // The new terminal will get a default layout from the useEffect, but we want to place it at the click position.
    // We'll update it after it appears via a ref.
    const pos = { x: contextMenu.canvasX, y: contextMenu.canvasY };
    // Wait for the terminal to be created and its layout assigned, then override the position
    setTimeout(() => {
      setNodeLayouts((prev) => {
        const next = new Map(prev);
        // Find the newest terminal (last entry)
        const entries = [...next.entries()];
        if (entries.length === 0) return prev;
        const [lastId, lastLayout] = entries[entries.length - 1];
        next.set(lastId, { ...lastLayout, x: pos.x, y: pos.y });
        return next;
      });
    }, 50);
    setContextMenu(null);
  }, [contextMenu, createTerminal, setNodeLayouts]);

  const ctxRename = useCallback(() => {
    if (!contextMenu?.terminalId) return;
    const term = terminals.find((t) => t.id === contextMenu.terminalId);
    if (term) startEditingName(term);
    setContextMenu(null);
  }, [contextMenu, terminals]);

  const ctxDuplicate = useCallback(() => {
    if (!contextMenu?.terminalId) return;
    const layout = nodeLayouts.get(contextMenu.terminalId);
    createTerminal(80, 24);
    if (layout) {
      const pos = { x: layout.x + 40, y: layout.y + 40 };
      setTimeout(() => {
        setNodeLayouts((prev) => {
          const next = new Map(prev);
          const entries = [...next.entries()];
          if (entries.length === 0) return prev;
          const [lastId, lastLayout] = entries[entries.length - 1];
          next.set(lastId, { ...lastLayout, x: pos.x, y: pos.y, width: layout.width, height: layout.height });
          return next;
        });
      }, 50);
    }
    setContextMenu(null);
  }, [contextMenu, nodeLayouts, createTerminal, setNodeLayouts]);

  const ctxDelete = useCallback(() => {
    if (!contextMenu?.terminalId) return;
    killTerminal(contextMenu.terminalId);
    setContextMenu(null);
  }, [contextMenu, killTerminal]);

  // Assign layouts to new terminals
  useEffect(() => {
    setNodeLayouts((prev) => {
      const next = new Map(prev);
      let changed = false;

      // Remove layouts for terminals that no longer exist
      for (const id of next.keys()) {
        if (!terminals.find((t) => t.id === id)) {
          next.delete(id);
          changed = true;
        }
      }

      // Add layouts for new terminals
      for (const term of terminals) {
        if (!next.has(term.id)) {
          const index = nodeCountRef.current++;
          next.set(term.id, {
            x: 80 + (index % 5) * STAGGER_OFFSET + Math.floor(index / 5) * 200,
            y: 80 + (index % 5) * STAGGER_OFFSET + Math.floor(index / 5) * 120,
            width: DEFAULT_NODE_WIDTH,
            height: DEFAULT_NODE_HEIGHT,
          });
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [terminals]);

  // Auto-layout: arrange terminals in a grid
  const autoLayout = useCallback(() => {
    if (terminals.length === 0) return;
    const cols = Math.ceil(Math.sqrt(terminals.length));
    const gap = 40;
    setNodeLayouts((prev) => {
      const next = new Map(prev);
      terminals.forEach((term, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const existing = next.get(term.id);
        const w = existing?.width ?? DEFAULT_NODE_WIDTH;
        const h = existing?.height ?? DEFAULT_NODE_HEIGHT;
        next.set(term.id, {
          x: col * (DEFAULT_NODE_WIDTH + gap),
          y: row * (DEFAULT_NODE_HEIGHT + gap),
          width: w,
          height: h,
        });
      });
      return next;
    });
    // Center the view on the grid
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const cols2 = Math.ceil(Math.sqrt(terminals.length));
      const rows = Math.ceil(terminals.length / cols2);
      const gridW = cols2 * (DEFAULT_NODE_WIDTH + gap) - gap;
      const gridH = rows * (DEFAULT_NODE_HEIGHT + gap) - gap;
      const fitZoom = Math.min(1, rect.width / (gridW + 80), rect.height / (gridH + 80));
      setPan({
        x: (rect.width - gridW * fitZoom) / 2,
        y: (rect.height - gridH * fitZoom) / 2,
      });
      setZoom(fitZoom);
    }
  }, [terminals, setNodeLayouts, setPan, setZoom]);

  // Animated pan/zoom transition
  const animRef = useRef<number | null>(null);
  const animateTo = useCallback((targetPan: { x: number; y: number }, targetZoom: number) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const startPan = { ...pan };
    const startZoom = zoom;
    const duration = 300;
    const startTime = performance.now();
    const ease = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const e = ease(t);
      setPan({
        x: startPan.x + (targetPan.x - startPan.x) * e,
        y: startPan.y + (targetPan.y - startPan.y) * e,
      });
      setZoom(startZoom + (targetZoom - startZoom) * e);
      if (t < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        animRef.current = null;
      }
    };
    animRef.current = requestAnimationFrame(step);
  }, [pan, zoom, setPan, setZoom]);

  // Focus on active node or fit all
  const focusOrFitAll = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    if (activeTerminalId) {
      const layout = nodeLayouts.get(activeTerminalId);
      if (!layout) return;
      const padding = 80;
      const fitZoom = Math.min(1, Math.max(MIN_ZOOM,
        Math.min((rect.width - padding * 2) / layout.width, (rect.height - padding * 2) / layout.height)
      ));
      const cx = layout.x + layout.width / 2;
      const cy = layout.y + layout.height / 2;
      animateTo(
        { x: rect.width / 2 - cx * fitZoom, y: rect.height / 2 - cy * fitZoom },
        fitZoom,
      );
      return;
    }

    // No selection — fit all
    if (terminals.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const term of terminals) {
      const layout = nodeLayouts.get(term.id);
      if (!layout) continue;
      minX = Math.min(minX, layout.x);
      minY = Math.min(minY, layout.y);
      maxX = Math.max(maxX, layout.x + layout.width);
      maxY = Math.max(maxY, layout.y + layout.height);
    }
    if (!isFinite(minX)) return;
    const padding = 60;
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const fitZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM,
      Math.min((rect.width - padding * 2) / contentW, (rect.height - padding * 2) / contentH)
    ));
    const cx = minX + contentW / 2;
    const cy = minY + contentH / 2;
    animateTo(
      { x: rect.width / 2 - cx * fitZoom, y: rect.height / 2 - cy * fitZoom },
      fitZoom,
    );
  }, [activeTerminalId, terminals, nodeLayouts, animateTo]);

  // Space key tracking for pan mode + F to focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.xterm')) return;

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setSpaceHeld(true);
      }
      if (e.code === 'KeyF' && !e.repeat) {
        e.preventDefault();
        focusOrFitAll();
      }
      if (e.code === 'KeyL' && (e.metaKey || e.ctrlKey) && e.shiftKey && !e.repeat) {
        e.preventDefault();
        autoLayout();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceHeld(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [focusOrFitAll, autoLayout]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  // Global mouse move/up for dragging, resizing, panning
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (panning) panMovedRef.current = true;
      if (dragging) {
        const dx = (e.clientX - dragging.startMouseX) / zoom;
        const dy = (e.clientY - dragging.startMouseY) / zoom;
        setNodeLayouts((prev) => {
          const next = new Map(prev);
          next.set(dragging.terminalId, {
            ...next.get(dragging.terminalId)!,
            x: dragging.startNodeX + dx,
            y: dragging.startNodeY + dy,
          });
          return next;
        });
      } else if (resizing) {
        const dx = (e.clientX - resizing.startMouseX) / zoom;
        const dy = (e.clientY - resizing.startMouseY) / zoom;
        setNodeLayouts((prev) => {
          const next = new Map(prev);
          next.set(resizing.terminalId, {
            ...next.get(resizing.terminalId)!,
            width: Math.max(MIN_NODE_WIDTH, resizing.startWidth + dx),
            height: Math.max(MIN_NODE_HEIGHT, resizing.startHeight + dy),
          });
          return next;
        });
      } else if (panning) {
        setPan({
          x: panning.startPanX + (e.clientX - panning.startMouseX),
          y: panning.startPanY + (e.clientY - panning.startMouseY),
        });
      }
    };

    const handleMouseUp = () => {
      // If we were panning but didn't move, treat as a background click → deselect
      if (panning && !panMovedRef.current) {
        setActiveTerminalId(null);
      }
      setDragging(null);
      setResizing(null);
      setPanning(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, resizing, panning, zoom, setActiveTerminalId]);

  // Zoom with scroll wheel
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if ((e.target as HTMLElement).closest?.('.nowheel')) return;
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const delta = -e.deltaY * ZOOM_SPEED;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * (1 + delta)));
      const scale = newZoom / zoom;

      // Zoom toward cursor
      setPan((prev) => ({
        x: mouseX - scale * (mouseX - prev.x),
        y: mouseY - scale * (mouseY - prev.y),
      }));
      setZoom(newZoom);
    },
    [zoom]
  );

  // Canvas mouse down — start panning
  // Map mode: any left/middle click on background pans
  // Design mode: only middle-click or space+left-click pans; bare left-click deselects
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const canPan =
        e.button === 1 ||
        (e.button === 0 && (interactionMode === 'map' || spaceHeld));
      if (canPan) {
        e.preventDefault();
        panMovedRef.current = false;
        setPanning({
          startMouseX: e.clientX,
          startMouseY: e.clientY,
          startPanX: pan.x,
          startPanY: pan.y,
        });
      } else if (e.button === 0 && interactionMode === 'design') {
        // Bare left-click on background in design mode → deselect
        setActiveTerminalId(null);
      }
    },
    [pan, interactionMode, spaceHeld, setActiveTerminalId]
  );

  // Node titlebar drag start
  const handleNodeDragStart = useCallback(
    (terminalId: string, e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if (spaceHeld) return; // space+drag should pan, not move node
      e.stopPropagation();
      const layout = nodeLayouts.get(terminalId);
      if (!layout) return;
      setActiveTerminalId(terminalId);
      setDragging({
        terminalId,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startNodeX: layout.x,
        startNodeY: layout.y,
      });
    },
    [nodeLayouts, setActiveTerminalId, spaceHeld]
  );

  // Node resize handle drag start
  const handleResizeStart = useCallback(
    (terminalId: string, e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      const layout = nodeLayouts.get(terminalId);
      if (!layout) return;
      setResizing({
        terminalId,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startWidth: layout.width,
        startHeight: layout.height,
      });
    },
    [nodeLayouts]
  );

  const handleNodeClick = useCallback(
    (terminalId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setActiveTerminalId(terminalId);
    },
    [setActiveTerminalId]
  );

  // Determine cursor
  let cursor = interactionMode === 'map' ? 'grab' : 'default';
  if (spaceHeld && !dragging && !resizing) cursor = 'grab';
  if (panning) cursor = 'grabbing';
  if (dragging) cursor = 'grabbing';
  if (resizing) cursor = 'nwse-resize';

  // Zoom step (centered on viewport)
  const zoomBy = useCallback((factor: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
    const scale = newZoom / zoom;
    setPan((prev) => ({
      x: cx - scale * (cx - prev.x),
      y: cy - scale * (cy - prev.y),
    }));
    setZoom(newZoom);
  }, [zoom, setPan, setZoom]);

  // Build the dot-grid background pattern that moves with pan/zoom
  const bgSize = DOT_SPACING * zoom;
  const bgPosX = pan.x % bgSize;
  const bgPosY = pan.y % bgSize;
  const dotSize = Math.max(DOT_RADIUS * zoom, 0.5);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
      onContextMenu={handleCanvasContextMenu}
      style={{
        ...canvasStyles.container,
        cursor,
        backgroundImage: `radial-gradient(circle, var(--border) ${dotSize}px, transparent ${dotSize}px)`,
        backgroundSize: `${bgSize}px ${bgSize}px`,
        backgroundPosition: `${bgPosX}px ${bgPosY}px`,
      }}
    >
      {/* Transform layer for pan/zoom */}
      <div
        style={{
          transformOrigin: '0 0',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          position: 'absolute',
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          overflow: 'visible',
        }}
      >
        {terminals.map((term) => {
          const layout = nodeLayouts.get(term.id);
          if (!layout) return null;
          const isActive = term.id === activeTerminalId;
          const displayName = getNodeDisplayName(term);

          return (
            <div
              key={term.id}
              className="nowheel"
              onClick={(e) => handleNodeClick(term.id, e)}
              onContextMenu={(e) => handleNodeContextMenu(term.id, e)}
              style={{
                position: 'absolute',
                left: layout.x,
                top: layout.y,
                width: layout.width,
                height: layout.height,
                borderRadius: 10,
                border: `2px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                boxShadow: isActive
                  ? `0 0 0 1px var(--accent-dim), 0 8px 32px rgba(var(--shadow),0.3)`
                  : `0 4px 20px rgba(var(--shadow),0.15)`,
                background: 'var(--bg-primary)',
                display: 'flex',
                flexDirection: 'column' as const,
                overflow: 'hidden',
                transition: dragging?.terminalId === term.id || resizing?.terminalId === term.id
                  ? 'none'
                  : 'border-color 0.15s ease, box-shadow 0.15s ease',
                userSelect: 'none' as const,
              }}
            >
              {/* Titlebar */}
              <div
                onMouseDown={(e) => handleNodeDragStart(term.id, e)}
                style={{
                  ...canvasStyles.titlebar,
                  borderBottom: `1px solid ${isActive ? 'var(--accent-dim)' : 'var(--border-subtle)'}`,
                }}
              >
                <div style={canvasStyles.titleLeft}>
                  <div
                    style={{
                      ...canvasStyles.titleDot,
                      background: isActive ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  />
                  {editingNameId === term.id ? (
                    <input
                      style={canvasStyles.titleInput}
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      onBlur={() => commitName(term.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitName(term.id);
                        if (e.key === 'Escape') setEditingNameId(null);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <>
                      <span
                        style={canvasStyles.titleText}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          startEditingName(term);
                        }}
                      >
                        {displayName}
                      </span>
                      {!term.name && (
                        <span style={canvasStyles.titleId}>
                          {term.id.slice(0, 8)}
                        </span>
                      )}
                    </>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    killTerminal(term.id);
                  }}
                  onMouseEnter={() => setHoveredClose(term.id)}
                  onMouseLeave={() => setHoveredClose(null)}
                  style={{
                    ...canvasStyles.closeBtn,
                    background: hoveredClose === term.id ? 'var(--danger-dim)' : 'transparent',
                    color: hoveredClose === term.id ? 'var(--danger)' : 'var(--text-secondary)',
                  }}
                >
                  {'\u2715'}
                </button>
              </div>

              {/* Terminal content */}
              <div
                style={canvasStyles.terminalContainer}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <TerminalView
                  terminalId={term.id}
                  isActive={true}
                  onInput={(data) => sendInput(term.id, data)}
                  onResize={(cols, rows) => resizeTerminal(term.id, cols, rows)}
                  registerOutput={(handler) => registerOutputHandler(term.id, handler)}
                />
              </div>

              {/* Resize handle */}
              <div
                onMouseDown={(e) => handleResizeStart(term.id, e)}
                style={canvasStyles.resizeHandle}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" style={{ display: 'block' }}>
                  <path
                    d="M10 2L2 10M10 6L6 10M10 10L10 10"
                    stroke="var(--text-muted)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating toolbar */}
      <div style={canvasStyles.toolbar}>
        <button
          onClick={autoLayout}
          onMouseEnter={() => setLayoutBtnHovered(true)}
          onMouseLeave={() => setLayoutBtnHovered(false)}
          style={{
            ...canvasStyles.toolbarButton,
            background: layoutBtnHovered ? 'var(--accent)' : 'var(--bg-tertiary)',
            color: layoutBtnHovered ? 'var(--bg-primary)' : 'var(--accent)',
            borderColor: layoutBtnHovered ? 'var(--accent)' : 'var(--border)',
            transform: layoutBtnHovered ? 'scale(1.05)' : 'scale(1)',
          }}
          title="Auto layout (\u2318\u21E7L)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <rect x="1" y="1" width="5.5" height="5.5" rx="1" />
            <rect x="9.5" y="1" width="5.5" height="5.5" rx="1" />
            <rect x="1" y="9.5" width="5.5" height="5.5" rx="1" />
            <rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1" />
          </svg>
        </button>
        <button
          onClick={() => createTerminal(80, 24)}
          onMouseEnter={() => setAddBtnHovered(true)}
          onMouseLeave={() => setAddBtnHovered(false)}
          style={{
            ...canvasStyles.toolbarButton,
            background: addBtnHovered ? 'var(--accent)' : 'var(--bg-tertiary)',
            color: addBtnHovered ? 'var(--bg-primary)' : 'var(--accent)',
            borderColor: addBtnHovered ? 'var(--accent)' : 'var(--border)',
            transform: addBtnHovered ? 'scale(1.05)' : 'scale(1)',
          }}
          title="New terminal"
        >
          +
        </button>
        <button
          onClick={cycleTheme}
          onMouseEnter={() => setThemeBtnHovered(true)}
          onMouseLeave={() => setThemeBtnHovered(false)}
          style={{
            ...canvasStyles.toolbarButton,
            background: themeBtnHovered ? 'var(--accent)' : 'var(--bg-tertiary)',
            color: themeBtnHovered ? 'var(--bg-primary)' : 'var(--accent)',
            borderColor: themeBtnHovered ? 'var(--accent)' : 'var(--border)',
            transform: themeBtnHovered ? 'scale(1.05)' : 'scale(1)',
          }}
          title={`Theme: ${preference} (${theme})`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            {theme === 'light' ? (
              <>
                <circle cx="8" cy="8" r="3" />
                <line x1="8" y1="1" x2="8" y2="3" />
                <line x1="8" y1="13" x2="8" y2="15" />
                <line x1="1" y1="8" x2="3" y2="8" />
                <line x1="13" y1="8" x2="15" y2="8" />
                <line x1="3.05" y1="3.05" x2="4.46" y2="4.46" />
                <line x1="11.54" y1="11.54" x2="12.95" y2="12.95" />
                <line x1="3.05" y1="12.95" x2="4.46" y2="11.54" />
                <line x1="11.54" y1="4.46" x2="12.95" y2="3.05" />
              </>
            ) : (
              <path d="M13.5 8A5.5 5.5 0 0 1 8 13.5 5.5 5.5 0 0 1 2.5 8 5.5 5.5 0 0 1 8 2.5c0 3.04 2.46 5.5 5.5 5.5Z" />
            )}
          </svg>
        </button>
      </div>

      {/* React Flow-style controls panel */}
      <div style={canvasStyles.controlsPanel}>
        {([
          { id: 'zoom-in', title: 'Zoom in', onClick: () => zoomBy(1.25), icon: (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="7" y1="3" x2="7" y2="11" /><line x1="3" y1="7" x2="11" y2="7" />
            </svg>
          )},
          { id: 'zoom-out', title: 'Zoom out', onClick: () => zoomBy(0.8), icon: (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="7" x2="11" y2="7" />
            </svg>
          )},
          { id: 'fit-view', title: 'Fit view (F)', onClick: focusOrFitAll, icon: (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1,5 1,1 5,1" /><polyline points="9,1 13,1 13,5" />
              <polyline points="13,9 13,13 9,13" /><polyline points="5,13 1,13 1,9" />
            </svg>
          )},
          { id: 'mode', title: interactionMode === 'map' ? 'Map mode (click to switch to design)' : 'Design mode (click to switch to map)', onClick: () => setInteractionMode(interactionMode === 'map' ? 'design' : 'map'), icon: interactionMode === 'map' ? (
            // Hand icon for map mode
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 13.5c-3 0-4.5-2-4.5-4.5V5.5a1 1 0 0 1 2 0V8" />
              <path d="M5.5 4V2.5a1 1 0 0 1 2 0V7" />
              <path d="M7.5 3.5V2a1 1 0 0 1 2 0v5" />
              <path d="M9.5 4.5V3a1 1 0 0 1 2 0v6c0 2.5-1.5 4.5-4.5 4.5" />
            </svg>
          ) : (
            // Pointer/cursor icon for design mode
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" stroke="none">
              <path d="M3 1.5l9 6.5H7.5L5.8 13.4 3 1.5z" />
            </svg>
          )},
        ] as const).map((btn) => (
          <button
            key={btn.id}
            onClick={btn.onClick}
            onMouseEnter={() => setHoveredControl(btn.id)}
            onMouseLeave={() => setHoveredControl(null)}
            title={btn.title}
            style={{
              ...canvasStyles.controlButton,
              background: hoveredControl === btn.id ? 'var(--accent)' : 'var(--bg-secondary)',
              color: hoveredControl === btn.id ? 'var(--bg-primary)' : 'var(--text-secondary)',
            }}
          >
            {btn.icon}
          </button>
        ))}
      </div>

      {/* Zoom indicator */}
      <div style={canvasStyles.zoomIndicator}>
        {Math.round(zoom * 100)}%
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          style={{
            ...canvasStyles.contextMenu,
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {contextMenu.terminalId ? (
            <>
              <button className="ctx-menu-item" style={canvasStyles.contextMenuItem} onMouseDown={ctxRename}>
                Rename
              </button>
              <button className="ctx-menu-item" style={canvasStyles.contextMenuItem} onMouseDown={ctxDuplicate}>
                Duplicate
              </button>
              <div style={canvasStyles.contextMenuDivider} />
              <button className="ctx-menu-item" style={{ ...canvasStyles.contextMenuItem, color: 'var(--danger)' }} onMouseDown={ctxDelete}>
                Delete
              </button>
            </>
          ) : (
            <button className="ctx-menu-item" style={canvasStyles.contextMenuItem} onMouseDown={ctxNewTerminal}>
              New Terminal
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const canvasStyles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    background: 'var(--bg-primary)',
  },
  titlebar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: TITLEBAR_HEIGHT,
    minHeight: TITLEBAR_HEIGHT,
    padding: '0 10px',
    background: 'var(--bg-secondary)',
    cursor: 'grab',
    userSelect: 'none' as const,
  },
  titleLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  titleDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  titleText: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: "'SF Mono', 'Fira Code', Menlo, monospace",
    whiteSpace: 'nowrap' as const,
  },
  titleInput: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: "'SF Mono', 'Fira Code', Menlo, monospace",
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 3,
    padding: '1px 4px',
    outline: 'none',
    width: 120,
  },
  titleId: {
    fontSize: 10,
    color: 'var(--text-muted)',
    fontFamily: "'SF Mono', 'Fira Code', Menlo, monospace",
    whiteSpace: 'nowrap' as const,
  },
  closeBtn: {
    border: 'none',
    borderRadius: 4,
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 12,
    flexShrink: 0,
    transition: 'background 0.15s ease, color 0.15s ease',
  },
  terminalContainer: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  resizeHandle: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 18,
    height: 18,
    cursor: 'nwse-resize',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    opacity: 0.6,
    borderRadius: 3,
  },
  toolbar: {
    position: 'absolute',
    top: 16,
    right: 16,
    display: 'flex',
    gap: 8,
    zIndex: 10,
  },
  toolbarButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    border: '1px solid',
    fontSize: 24,
    fontWeight: 300,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
    boxShadow: '0 4px 12px rgba(var(--shadow),0.15)',
    lineHeight: 1,
  },
  controlsPanel: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    display: 'flex',
    flexDirection: 'column' as const,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    boxShadow: '0 4px 12px rgba(var(--shadow),0.15)',
    overflow: 'hidden',
    zIndex: 10,
  },
  controlButton: {
    width: 32,
    height: 32,
    border: 'none',
    borderBottom: '1px solid var(--border)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.12s ease, color 0.12s ease',
    padding: 0,
  },
  zoomIndicator: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    padding: '4px 10px',
    borderRadius: 6,
    background: 'var(--overlay-bg)',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontFamily: "'SF Mono', 'Fira Code', Menlo, monospace",
    zIndex: 10,
    userSelect: 'none' as const,
    pointerEvents: 'none' as const,
  },
  contextMenu: {
    position: 'fixed' as const,
    zIndex: 1000,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '4px 0',
    boxShadow: '0 8px 24px rgba(var(--shadow),0.25)',
    minWidth: 160,
  },
  contextMenuItem: {
    display: 'block',
    width: '100%',
    padding: '7px 14px',
    border: 'none',
    background: 'none',
    color: 'var(--text-primary)',
    fontSize: 13,
    textAlign: 'left' as const,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  contextMenuDivider: {
    height: 1,
    background: 'var(--border)',
    margin: '4px 0',
  },
};

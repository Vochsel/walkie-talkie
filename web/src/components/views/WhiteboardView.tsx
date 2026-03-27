'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { ViewProps } from '@/app/page';
import TerminalView from '@/components/TerminalView';
import { usePersistedState } from '@/hooks/usePersistedState';

interface NodeLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_NODE_WIDTH = 500;
const DEFAULT_NODE_HEIGHT = 350;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeCountRef = useRef(0);
  const [hoveredClose, setHoveredClose] = useState<string | null>(null);
  const [addBtnHovered, setAddBtnHovered] = useState(false);
  const [layoutBtnHovered, setLayoutBtnHovered] = useState(false);

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

  // Focus on active node with F key
  const focusActiveNode = useCallback(() => {
    if (!activeTerminalId || !containerRef.current) return;
    const layout = nodeLayouts.get(activeTerminalId);
    if (!layout) return;
    const rect = containerRef.current.getBoundingClientRect();
    const targetZoom = 1;
    const cx = layout.x + layout.width / 2;
    const cy = layout.y + layout.height / 2;
    setPan({
      x: rect.width / 2 - cx * targetZoom,
      y: rect.height / 2 - cy * targetZoom,
    });
    setZoom(targetZoom);
  }, [activeTerminalId, nodeLayouts, setPan, setZoom]);

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
        focusActiveNode();
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
  }, [focusActiveNode, autoLayout]);

  // Global mouse move/up for dragging, resizing, panning
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
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
  }, [dragging, resizing, panning, zoom]);

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

  // Canvas mouse down — start panning (any click on background, middle-click, or space+click)
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Left click on canvas background, middle click, or space+left click
      if (e.button === 1 || e.button === 0) {
        e.preventDefault();
        setPanning({
          startMouseX: e.clientX,
          startMouseY: e.clientY,
          startPanX: pan.x,
          startPanY: pan.y,
        });
      }
    },
    [pan]
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
  let cursor = 'default';
  if (panning || (spaceHeld && !dragging && !resizing)) cursor = panning ? 'grabbing' : 'grab';
  if (dragging) cursor = 'grabbing';
  if (resizing) cursor = 'nwse-resize';

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
      style={{
        ...canvasStyles.container,
        cursor,
        backgroundImage: `radial-gradient(circle, #30363d ${dotSize}px, transparent ${dotSize}px)`,
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
          const shellName = term.shell.split('/').pop() || 'terminal';

          return (
            <div
              key={term.id}
              className="nowheel"
              onClick={(e) => handleNodeClick(term.id, e)}
              style={{
                position: 'absolute',
                left: layout.x,
                top: layout.y,
                width: layout.width,
                height: layout.height,
                borderRadius: 10,
                border: `2px solid ${isActive ? '#00d4aa' : '#30363d'}`,
                boxShadow: isActive
                  ? '0 0 0 1px #00d4aa40, 0 8px 32px rgba(0,0,0,0.5)'
                  : '0 4px 20px rgba(0,0,0,0.4)',
                background: '#0d1117',
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
                  borderBottom: `1px solid ${isActive ? '#00d4aa30' : '#21262d'}`,
                }}
              >
                <div style={canvasStyles.titleLeft}>
                  <div
                    style={{
                      ...canvasStyles.titleDot,
                      background: isActive ? '#00d4aa' : '#484f58',
                    }}
                  />
                  <span style={canvasStyles.titleText}>{shellName}</span>
                  <span style={canvasStyles.titleId}>
                    {term.id.slice(0, 8)}
                  </span>
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
                    background: hoveredClose === term.id ? '#da363430' : 'transparent',
                    color: hoveredClose === term.id ? '#f85149' : '#6e7681',
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
                    stroke="#484f58"
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
            background: layoutBtnHovered ? '#00d4aa' : '#1c2128',
            color: layoutBtnHovered ? '#0d1117' : '#00d4aa',
            borderColor: layoutBtnHovered ? '#00d4aa' : '#30363d',
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
            background: addBtnHovered ? '#00d4aa' : '#1c2128',
            color: addBtnHovered ? '#0d1117' : '#00d4aa',
            borderColor: addBtnHovered ? '#00d4aa' : '#30363d',
            transform: addBtnHovered ? 'scale(1.05)' : 'scale(1)',
          }}
          title="New terminal"
        >
          +
        </button>
      </div>

      {/* Zoom indicator */}
      <div style={canvasStyles.zoomIndicator}>
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}

const canvasStyles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    background: '#0d1117',
  },
  titlebar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: TITLEBAR_HEIGHT,
    minHeight: TITLEBAR_HEIGHT,
    padding: '0 10px',
    background: '#161b22',
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
    color: '#e6edf3',
    fontFamily: "'SF Mono', 'Fira Code', Menlo, monospace",
    whiteSpace: 'nowrap' as const,
  },
  titleId: {
    fontSize: 10,
    color: '#484f58',
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
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    lineHeight: 1,
  },
  zoomIndicator: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    padding: '4px 10px',
    borderRadius: 6,
    background: '#161b2280',
    border: '1px solid #30363d',
    color: '#6e7681',
    fontSize: 11,
    fontFamily: "'SF Mono', 'Fira Code', Menlo, monospace",
    zIndex: 10,
    userSelect: 'none' as const,
    pointerEvents: 'none' as const,
  },
};

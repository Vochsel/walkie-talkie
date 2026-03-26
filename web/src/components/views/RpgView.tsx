'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import type { ViewProps } from '@/app/page';
import TerminalPopup from '@/components/TerminalPopup';

// ── Constants ───────────────────────────────────────────────────────
const BASE_TILE = 32;
const WORLD_W = 40;
const WORLD_H = 40;
const MOVE_DURATION = 0.12; // seconds per tile move
const INTERACT_RANGE = 1.5;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.15;

// ── Tile types ──────────────────────────────────────────────────────
const TileType = {
  Grass: 0, GrassDark: 1, GrassLight: 2, Dirt: 3,
  Water: 4, Tree: 5, Rock: 6,
} as const;
type TileType = (typeof TileType)[keyof typeof TileType];

const WALKABLE: Set<TileType> = new Set([TileType.Grass, TileType.GrassDark, TileType.GrassLight, TileType.Dirt]);

// ── Seeded random ───────────────────────────────────────────────────
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateNoise(w: number, h: number, rng: () => number): number[][] {
  const g: number[][] = [];
  for (let y = 0; y < h; y++) { g[y] = []; for (let x = 0; x < w; x++) g[y][x] = rng(); }
  return g;
}

function smoothNoise(noise: number[][], x: number, y: number): number {
  const h = noise.length, w = noise[0].length;
  let sum = 0, count = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    sum += noise[((y + dy) % h + h) % h][((x + dx) % w + w) % w]; count++;
  }
  return sum / count;
}

// ── World gen ───────────────────────────────────────────────────────
function generateWorld(): TileType[][] {
  const rng = mulberry32(42);
  const noise1 = generateNoise(WORLD_W, WORLD_H, rng);
  const noise2 = generateNoise(WORLD_W, WORLD_H, rng);
  const world: TileType[][] = [];

  for (let y = 0; y < WORLD_H; y++) {
    world[y] = [];
    for (let x = 0; x < WORLD_W; x++) {
      const val = smoothNoise(noise1, x, y);
      const detail = smoothNoise(noise2, x, y);
      if (val < 0.25) world[y][x] = TileType.Water;
      else if (val < 0.35) world[y][x] = TileType.Dirt;
      else if (detail < 0.3) world[y][x] = TileType.GrassDark;
      else if (detail > 0.65) world[y][x] = TileType.GrassLight;
      else world[y][x] = TileType.Grass;
    }
  }

  for (let y = 2; y < WORLD_H - 2; y++) for (let x = 2; x < WORLD_W - 2; x++) {
    if (WALKABLE.has(world[y][x])) {
      const r = rng();
      if (r < 0.06) world[y][x] = TileType.Tree;
      else if (r < 0.09) world[y][x] = TileType.Rock;
    }
  }

  // Clear start area
  const cx = Math.floor(WORLD_W / 2), cy = Math.floor(WORLD_H / 2);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const ty = cy + dy, tx = cx + dx;
    if (ty >= 0 && ty < WORLD_H && tx >= 0 && tx < WORLD_W) world[ty][tx] = TileType.Grass;
  }

  // Paths
  let px = cx, py = cy;
  for (let i = 0; i < 60; i++) {
    world[py][px] = TileType.Dirt;
    if (rng() < 0.5) px += rng() < 0.5 ? -1 : 1;
    else py += rng() < 0.5 ? -1 : 1;
    px = Math.max(1, Math.min(WORLD_W - 2, px));
    py = Math.max(1, Math.min(WORLD_H - 2, py));
  }

  return world;
}

function tileColor(t: TileType): string {
  switch (t) {
    case TileType.Grass: return '#4a7c3f';
    case TileType.GrassDark: return '#3b6832';
    case TileType.GrassLight: return '#5e9b4f';
    case TileType.Dirt: return '#8b7355';
    case TileType.Water: return '#2a6fa8';
    case TileType.Tree: return '#2d5a1e';
    case TileType.Rock: return '#6b6b6b';
    default: return '#4a7c3f';
  }
}

type Dir = 'up' | 'down' | 'left' | 'right';

interface Station { tileX: number; tileY: number; }

// ── Component ───────────────────────────────────────────────────────
export default function RpgView({
  terminals, activeTerminalId, setActiveTerminalId,
  sendInput, resizeTerminal, killTerminal, createTerminal, registerOutputHandler,
}: ViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<TileType[][] | null>(null);
  const stationsRef = useRef<Map<string, Station>>(new Map());

  // Tile-based player: integer grid position + animation
  const playerTileRef = useRef({ x: Math.floor(WORLD_W / 2), y: Math.floor(WORLD_H / 2) });
  const playerAnimRef = useRef({ x: WORLD_W / 2, y: WORLD_H / 2 });
  const playerDirRef = useRef<Dir>('down');
  const moveQueueRef = useRef<Dir | null>(null);
  const isMovingRef = useRef(false);
  const moveProgressRef = useRef(0);
  const moveFromRef = useRef({ x: 0, y: 0 });

  const keysRef = useRef<Set<string>>(new Set());
  const animFrameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const zoomRef = useRef(1.5);
  const nearbyStationRef = useRef<string | null>(null);
  const pendingPlacementRef = useRef<{ x: number; y: number } | null>(null);
  const hoverTileRef = useRef<{ x: number; y: number } | null>(null);

  const [openTerminalId, setOpenTerminalId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1.5);

  if (!worldRef.current) worldRef.current = generateWorld();

  // ── Helpers ───────────────────────────────────────────────────────
  const isWalkable = useCallback((tx: number, ty: number): boolean => {
    if (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) return false;
    return WALKABLE.has(worldRef.current![ty][tx]);
  }, []);

  const isStationAt = useCallback((tx: number, ty: number): string | null => {
    for (const [id, s] of stationsRef.current) {
      if (s.tileX === tx && s.tileY === ty) return id;
    }
    return null;
  }, []);

  const findNearbyStation = useCallback((): string | null => {
    const p = playerTileRef.current;
    let closest: string | null = null, best = Infinity;
    stationsRef.current.forEach((s, id) => {
      const d = Math.abs(s.tileX - p.x) + Math.abs(s.tileY - p.y);
      if (d <= INTERACT_RANGE && d < best) { best = d; closest = id; }
    });
    return closest;
  }, []);

  // ── Tile-based movement ───────────────────────────────────────────
  const tryMove = useCallback((dir: Dir) => {
    if (isMovingRef.current) { moveQueueRef.current = dir; return; }

    const p = playerTileRef.current;
    let nx = p.x, ny = p.y;
    if (dir === 'up') ny--;
    else if (dir === 'down') ny++;
    else if (dir === 'left') nx--;
    else if (dir === 'right') nx++;

    playerDirRef.current = dir;

    // Check if blocked by wall or station
    if (!isWalkable(nx, ny) || isStationAt(nx, ny)) return;

    // Start move
    moveFromRef.current = { x: p.x, y: p.y };
    playerTileRef.current = { x: nx, y: ny };
    isMovingRef.current = true;
    moveProgressRef.current = 0;
  }, [isWalkable, isStationAt]);

  // ── Place terminals ───────────────────────────────────────────────
  const placeStation = useCallback((terminalId: string, tx: number, ty: number) => {
    stationsRef.current.set(terminalId, { tileX: tx, tileY: ty });
  }, []);

  // Sync terminals
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    const rng = mulberry32(Date.now());

    for (const term of terminals) {
      if (!stationsRef.current.has(term.id)) {
        if (pendingPlacementRef.current) {
          placeStation(term.id, pendingPlacementRef.current.x, pendingPlacementRef.current.y);
          pendingPlacementRef.current = null;
        } else {
          for (let attempt = 0; attempt < 200; attempt++) {
            const tx = Math.floor(rng() * WORLD_W), ty = Math.floor(rng() * WORLD_H);
            if (WALKABLE.has(world[ty][tx]) && !isStationAt(tx, ty)) {
              placeStation(term.id, tx, ty);
              break;
            }
          }
        }
      }
    }
    const ids = new Set(terminals.map(t => t.id));
    stationsRef.current.forEach((_, id) => { if (!ids.has(id)) stationsRef.current.delete(id); });
  }, [terminals, placeStation, isStationAt]);

  // ── Keyboard ──────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (openTerminalId) return;
      const k = e.key.toLowerCase();
      keysRef.current.add(k);
      if (k === 'e') {
        const nearby = findNearbyStation();
        if (nearby) { setOpenTerminalId(nearby); setActiveTerminalId(nearby); }
      }
    };
    const up = (e: KeyboardEvent) => { keysRef.current.delete(e.key.toLowerCase()); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [openTerminalId, findNearbyStation, setActiveTerminalId]);

  // ── Zoom (scroll wheel) ───────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const nz = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomRef.current + dir));
      zoomRef.current = nz;
      setZoom(nz);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ── Mouse move for hover tile ─────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const TILE = BASE_TILE * zoomRef.current;
      const anim = playerAnimRef.current;
      const camX = anim.x * TILE - canvas.width / 2;
      const camY = anim.y * TILE - canvas.height / 2;
      const tx = Math.floor((mx + camX) / TILE), ty = Math.floor((my + camY) / TILE);
      if (tx >= 0 && tx < WORLD_W && ty >= 0 && ty < WORLD_H) {
        hoverTileRef.current = { x: tx, y: ty };
      } else {
        hoverTileRef.current = null;
      }
    };
    canvas.addEventListener('mousemove', onMove);
    return () => canvas.removeEventListener('mousemove', onMove);
  }, []);

  // ── Canvas click: interact station or place terminal ──────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || openTerminalId) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const TILE = BASE_TILE * zoomRef.current;
    const anim = playerAnimRef.current;
    const camX = anim.x * TILE - canvas.width / 2;
    const camY = anim.y * TILE - canvas.height / 2;
    const tx = Math.floor((mx + camX) / TILE), ty = Math.floor((my + camY) / TILE);

    if (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) return;

    // Click on station? Interact if close enough
    const stationId = isStationAt(tx, ty);
    if (stationId) {
      const p = playerTileRef.current;
      const d = Math.abs(tx - p.x) + Math.abs(ty - p.y);
      if (d <= INTERACT_RANGE + 1) {
        setOpenTerminalId(stationId);
        setActiveTerminalId(stationId);
      }
      return;
    }

    // Click on walkable tile with no station? Place terminal
    if (!isWalkable(tx, ty)) return;
    const p = playerTileRef.current;
    if (tx === p.x && ty === p.y) return; // don't place on self

    pendingPlacementRef.current = { x: tx, y: ty };
    createTerminal(80, 24);
  }, [openTerminalId, isStationAt, isWalkable, setActiveTerminalId, createTerminal]);

  // ── Game loop ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const p = containerRef.current;
      if (!p) return;
      canvas.width = p.clientWidth;
      canvas.height = p.clientHeight;
    };
    resize();
    const obs = new ResizeObserver(resize);
    if (containerRef.current) obs.observe(containerRef.current);

    lastTimeRef.current = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = time;

      const TILE = BASE_TILE * zoomRef.current;
      const cw = canvas.width, ch = canvas.height;
      const world = worldRef.current!;

      // ── Animate move ──────────────────────────────────────────────
      let moveJustFinished = false;
      if (isMovingRef.current) {
        moveProgressRef.current += dt / MOVE_DURATION;
        if (moveProgressRef.current >= 1) {
          moveProgressRef.current = 1;
          isMovingRef.current = false;
          moveJustFinished = true;
          playerAnimRef.current = {
            x: playerTileRef.current.x + 0.5,
            y: playerTileRef.current.y + 0.5,
          };
          // Process queued move (from key held during previous move)
          if (moveQueueRef.current) {
            const q = moveQueueRef.current;
            moveQueueRef.current = null;
            tryMove(q);
          }
        } else {
          const t = moveProgressRef.current;
          const s = t * t * (3 - 2 * t);
          playerAnimRef.current = {
            x: moveFromRef.current.x + 0.5 + (playerTileRef.current.x - moveFromRef.current.x) * s,
            y: moveFromRef.current.y + 0.5 + (playerTileRef.current.y - moveFromRef.current.y) * s,
          };
        }
      }

      // ── Movement input (skip if a queued move already started this frame) ──
      if (!openTerminalId && !isMovingRef.current && !moveJustFinished) {
        const keys = keysRef.current;
        let dir: Dir | null = null;
        if (keys.has('w') || keys.has('arrowup')) dir = 'up';
        else if (keys.has('s') || keys.has('arrowdown')) dir = 'down';
        else if (keys.has('a') || keys.has('arrowleft')) dir = 'left';
        else if (keys.has('d') || keys.has('arrowright')) dir = 'right';

        if (dir) tryMove(dir);
      }

      nearbyStationRef.current = findNearbyStation();

      // ── Camera ────────────────────────────────────────────────────
      const anim = playerAnimRef.current;
      const camX = anim.x * TILE - cw / 2;
      const camY = anim.y * TILE - ch / 2;

      // Clear
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, cw, ch);

      if (!world) { animFrameRef.current = requestAnimationFrame(loop); return; }

      // Visible range
      const sx = Math.max(0, Math.floor(camX / TILE) - 1);
      const sy = Math.max(0, Math.floor(camY / TILE) - 1);
      const ex = Math.min(WORLD_W, Math.ceil((camX + cw) / TILE) + 1);
      const ey = Math.min(WORLD_H, Math.ceil((camY + ch) / TILE) + 1);

      // ── Draw tiles ────────────────────────────────────────────────
      for (let ty = sy; ty < ey; ty++) for (let tx = sx; tx < ex; tx++) {
        const scrX = tx * TILE - camX, scrY = ty * TILE - camY;
        const tile = world[ty][tx];
        ctx.fillStyle = tileColor(tile);
        ctx.fillRect(scrX, scrY, TILE + 0.5, TILE + 0.5);

        // Grid
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(scrX, scrY, TILE, TILE);

        // Tree
        if (tile === TileType.Tree) {
          const s = TILE / 32;
          ctx.fillStyle = '#5c3d2e';
          ctx.fillRect(scrX + 12 * s, scrY + 18 * s, 8 * s, 14 * s);
          ctx.fillStyle = '#1e7a1e';
          ctx.beginPath(); ctx.arc(scrX + TILE / 2, scrY + 12 * s, 12 * s, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#2fa82f';
          ctx.beginPath(); ctx.arc(scrX + TILE / 2 - 3 * s, scrY + 9 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
        }

        // Rock
        if (tile === TileType.Rock) {
          const s = TILE / 32;
          ctx.fillStyle = '#808080';
          ctx.beginPath();
          ctx.moveTo(scrX + 4 * s, scrY + 28 * s); ctx.lineTo(scrX + 16 * s, scrY + 6 * s);
          ctx.lineTo(scrX + 28 * s, scrY + 10 * s); ctx.lineTo(scrX + 30 * s, scrY + 28 * s);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#999';
          ctx.beginPath();
          ctx.moveTo(scrX + 8 * s, scrY + 24 * s); ctx.lineTo(scrX + 16 * s, scrY + 10 * s);
          ctx.lineTo(scrX + 22 * s, scrY + 12 * s); ctx.lineTo(scrX + 14 * s, scrY + 24 * s);
          ctx.closePath(); ctx.fill();
        }

        // Water
        if (tile === TileType.Water) {
          const wave = Math.sin(time / 600 + tx * 0.8 + ty * 0.5) * 0.15;
          ctx.fillStyle = `rgba(100,180,255,${0.15 + wave})`;
          ctx.fillRect(scrX, scrY, TILE, TILE);
          ctx.strokeStyle = 'rgba(150,210,255,0.3)';
          ctx.lineWidth = 1;
          const wo = Math.sin(time / 400 + tx) * 3 * (TILE / 32);
          ctx.beginPath();
          ctx.moveTo(scrX, scrY + 10 * (TILE / 32) + wo);
          ctx.quadraticCurveTo(scrX + TILE / 2, scrY + 10 * (TILE / 32) + wo + 4, scrX + TILE, scrY + 10 * (TILE / 32) + wo);
          ctx.stroke();
        }
      }

      // ── Hover tile highlight ──────────────────────────────────────
      const hov = hoverTileRef.current;
      if (hov && !openTerminalId) {
        const hx = hov.x * TILE - camX, hy = hov.y * TILE - camY;
        const walkable = isWalkable(hov.x, hov.y);
        const hasStation = isStationAt(hov.x, hov.y);
        if (walkable || hasStation) {
          ctx.strokeStyle = hasStation ? '#00d4aa' : 'rgba(255,255,255,0.4)';
          ctx.lineWidth = 2;
          ctx.strokeRect(hx + 1, hy + 1, TILE - 2, TILE - 2);
          if (walkable && !hasStation) {
            ctx.fillStyle = 'rgba(0,212,170,0.12)';
            ctx.fillRect(hx, hy, TILE, TILE);
          }
        }
      }

      // ── Draw stations ─────────────────────────────────────────────
      const pulse = Math.sin(time / 300) * 0.3 + 0.7;
      stationsRef.current.forEach((s, id) => {
        const scrX = s.tileX * TILE - camX, scrY = s.tileY * TILE - camY;
        if (scrX < -TILE * 2 || scrX > cw + TILE || scrY < -TILE * 2 || scrY > ch + TILE) return;

        const scale = TILE / 32;
        // Glow
        const gr = (20 + pulse * 8) * scale;
        const glow = ctx.createRadialGradient(scrX + TILE / 2, scrY + TILE / 2, 2, scrX + TILE / 2, scrY + TILE / 2, gr);
        glow.addColorStop(0, 'rgba(0,212,170,0.4)'); glow.addColorStop(1, 'rgba(0,212,170,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(scrX - gr, scrY - gr, TILE + gr * 2, TILE + gr * 2);

        // Body
        ctx.fillStyle = '#1a3a3a';
        ctx.fillRect(scrX + 2 * scale, scrY + 2 * scale, TILE - 4 * scale, TILE - 4 * scale);
        ctx.strokeStyle = `rgba(0,212,170,${0.6 + pulse * 0.4})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(scrX + 2 * scale, scrY + 2 * scale, TILE - 4 * scale, TILE - 4 * scale);

        // Screen
        ctx.fillStyle = `rgba(0,212,170,${0.2 + pulse * 0.2})`;
        ctx.fillRect(scrX + 6 * scale, scrY + 6 * scale, TILE - 12 * scale, TILE - 16 * scale);

        // Icon
        ctx.fillStyle = `rgba(0,212,170,${0.7 + pulse * 0.3})`;
        ctx.font = `bold ${10 * scale}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('>_', scrX + TILE / 2, scrY + 16 * scale);

        // LED
        ctx.fillStyle = id === nearbyStationRef.current ? '#00ff88' : `rgba(0,212,170,${pulse})`;
        ctx.beginPath(); ctx.arc(scrX + TILE / 2, scrY + TILE - 6 * scale, 2.5 * scale, 0, Math.PI * 2); ctx.fill();

        // Hint
        if (id === nearbyStationRef.current) {
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.beginPath(); ctx.roundRect(scrX - 10 * scale, scrY - 22 * scale, TILE + 20 * scale, 18 * scale, 4); ctx.fill();
          ctx.fillStyle = '#00d4aa';
          ctx.font = `bold ${10 * scale}px monospace`;
          ctx.textAlign = 'center';
          ctx.fillText('Press E', scrX + TILE / 2, scrY - 9 * scale);
        }
      });

      // ── Draw player ───────────────────────────────────────────────
      const px = anim.x * TILE - camX, py = anim.y * TILE - camY;
      const pSize = TILE * 0.7;
      const dir = playerDirRef.current;
      const dirX = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
      const dirY = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;

      // Bob when moving
      const bob = isMovingRef.current ? Math.sin(time / 60) * 2 : 0;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(px, py + pSize / 2 + 2, pSize / 2, pSize / 4, 0, 0, Math.PI * 2); ctx.fill();

      // Body
      ctx.fillStyle = '#e8a435';
      ctx.beginPath(); ctx.arc(px, py + bob, pSize / 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#b07820'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py + bob, pSize / 2, 0, Math.PI * 2); ctx.stroke();

      // Direction dot
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px + dirX * pSize / 2 * 0.7, py + bob + dirY * pSize / 2 * 0.7, 3, 0, Math.PI * 2); ctx.fill();

      // Eyes
      const ex2 = dirX * 3, ey2 = dirY * 3;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px - 4 + ex2, py - 2 + bob + ey2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + 4 + ex2, py - 2 + bob + ey2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(px - 4 + ex2 + dirX * 1.5, py - 2 + bob + ey2 + dirY * 1.5, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + 4 + ex2 + dirX * 1.5, py - 2 + bob + ey2 + dirY * 1.5, 1.5, 0, Math.PI * 2); ctx.fill();

      // ── Mini-map ──────────────────────────────────────────────────
      const mmSize = 120, mmTile = mmSize / WORLD_W;
      const mmX = cw - mmSize - 12, mmY = 12;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(mmX - 2, mmY - 2, mmSize + 4, mmSize + 4);
      ctx.strokeStyle = '#30363d'; ctx.lineWidth = 1;
      ctx.strokeRect(mmX - 2, mmY - 2, mmSize + 4, mmSize + 4);

      for (let ty = 0; ty < WORLD_H; ty++) for (let tx = 0; tx < WORLD_W; tx++) {
        ctx.fillStyle = tileColor(world[ty][tx]);
        ctx.fillRect(mmX + tx * mmTile, mmY + ty * mmTile, mmTile + 0.5, mmTile + 0.5);
      }
      stationsRef.current.forEach((s) => {
        ctx.fillStyle = '#00d4aa';
        ctx.fillRect(mmX + s.tileX * mmTile - 1, mmY + s.tileY * mmTile - 1, mmTile + 2, mmTile + 2);
      });
      ctx.fillStyle = '#e8a435';
      ctx.beginPath(); ctx.arc(mmX + playerTileRef.current.x * mmTile, mmY + playerTileRef.current.y * mmTile, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.5; ctx.stroke();

      const vw = cw / TILE * mmTile, vh = ch / TILE * mmTile;
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
      ctx.strokeRect(mmX + playerTileRef.current.x * mmTile - vw / 2, mmY + playerTileRef.current.y * mmTile - vh / 2, vw, vh);

      // ── HUD ───────────────────────────────────────────────────────
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath(); ctx.roundRect(10, ch - 48, 420, 36, 6); ctx.fill();
      ctx.fillStyle = '#8b949e'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
      ctx.fillText('WASD move | E interact | Click tile to place terminal | Scroll zoom', 20, ch - 25);

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath(); ctx.roundRect(10, 12, 160, 28, 6); ctx.fill();
      ctx.fillStyle = '#00d4aa'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
      ctx.fillText(`Terminals: ${terminals.length}`, 20, 31);

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath(); ctx.roundRect(10, 46, 160, 24, 6); ctx.fill();
      ctx.fillStyle = '#6e7681'; ctx.font = '10px monospace';
      ctx.fillText(`x:${playerTileRef.current.x} y:${playerTileRef.current.y}  zoom:${Math.round(zoomRef.current * 100)}%`, 20, 62);

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(animFrameRef.current); obs.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTerminalId, isWalkable, findNearbyStation, terminals.length, tryMove, isStationAt]);

  const openTerminal = openTerminalId ? terminals.find(t => t.id === openTerminalId) : null;

  return (
    <div ref={containerRef} style={styles.container}>
      <canvas ref={canvasRef} style={styles.canvas} onClick={handleCanvasClick} />
      {openTerminal && (
        <TerminalPopup
          terminalId={openTerminal.id}
          onInput={(data) => sendInput(openTerminal.id, data)}
          onResize={(cols, rows) => resizeTerminal(openTerminal.id, cols, rows)}
          registerOutput={(handler) => registerOutputHandler(openTerminal.id, handler)}
          onClose={() => setOpenTerminalId(null)}
          title={`Station [${openTerminal.id.slice(0, 8)}]`}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#1a1a2e' },
  canvas: { display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated', cursor: 'crosshair' },
};

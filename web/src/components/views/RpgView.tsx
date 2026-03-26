'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import type { ViewProps } from '@/app/page';
import TerminalPopup from '@/components/TerminalPopup';

// ── Constants ──────────────────────────────────────────────────────────────────

const TILE = 32;
const WORLD_W = 40;
const WORLD_H = 40;
const PLAYER_SPEED = 4; // tiles per second
const INTERACT_RANGE = 1.5; // tiles

// ── Tile types ─────────────────────────────────────────────────────────────────

const TileType = {
  Grass: 0,
  GrassDark: 1,
  GrassLight: 2,
  Dirt: 3,
  Water: 4,
  Tree: 5,
  Rock: 6,
} as const;
type TileType = (typeof TileType)[keyof typeof TileType];

const WALKABLE: Set<TileType> = new Set([TileType.Grass, TileType.GrassDark, TileType.GrassLight, TileType.Dirt]);

// ── Seeded random for deterministic world ──────────────────────────────────────

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Simple value noise
function generateNoise(w: number, h: number, rng: () => number): number[][] {
  const grid: number[][] = [];
  for (let y = 0; y < h; y++) {
    grid[y] = [];
    for (let x = 0; x < w; x++) {
      grid[y][x] = rng();
    }
  }
  return grid;
}

function smoothNoise(noise: number[][], x: number, y: number): number {
  const h = noise.length;
  const w = noise[0].length;
  let sum = 0;
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const ny = ((y + dy) % h + h) % h;
      const nx = ((x + dx) % w + w) % w;
      sum += noise[ny][nx];
      count++;
    }
  }
  return sum / count;
}

// ── World generation ───────────────────────────────────────────────────────────

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

      if (val < 0.25) {
        world[y][x] = TileType.Water;
      } else if (val < 0.35) {
        world[y][x] = TileType.Dirt;
      } else if (detail < 0.3) {
        world[y][x] = TileType.GrassDark;
      } else if (detail > 0.65) {
        world[y][x] = TileType.GrassLight;
      } else {
        world[y][x] = TileType.Grass;
      }
    }
  }

  // Scatter trees and rocks on grass
  for (let y = 2; y < WORLD_H - 2; y++) {
    for (let x = 2; x < WORLD_W - 2; x++) {
      if (world[y][x] === TileType.Grass || world[y][x] === TileType.GrassDark || world[y][x] === TileType.GrassLight) {
        const r = rng();
        if (r < 0.06) {
          world[y][x] = TileType.Tree;
        } else if (r < 0.09) {
          world[y][x] = TileType.Rock;
        }
      }
    }
  }

  // Clear a starting area around center
  const cx = Math.floor(WORLD_W / 2);
  const cy = Math.floor(WORLD_H / 2);
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const ty = cy + dy;
      const tx = cx + dx;
      if (ty >= 0 && ty < WORLD_H && tx >= 0 && tx < WORLD_W) {
        world[ty][tx] = TileType.Grass;
      }
    }
  }

  // Cut some dirt paths
  let px = cx;
  let py = cy;
  for (let i = 0; i < 60; i++) {
    world[py][px] = TileType.Dirt;
    if (rng() < 0.5) {
      px += rng() < 0.5 ? -1 : 1;
    } else {
      py += rng() < 0.5 ? -1 : 1;
    }
    px = Math.max(1, Math.min(WORLD_W - 2, px));
    py = Math.max(1, Math.min(WORLD_H - 2, py));
  }

  return world;
}

// ── Tile colors ────────────────────────────────────────────────────────────────

function tileColor(t: TileType): string {
  switch (t) {
    case TileType.Grass:
      return '#4a7c3f';
    case TileType.GrassDark:
      return '#3b6832';
    case TileType.GrassLight:
      return '#5e9b4f';
    case TileType.Dirt:
      return '#8b7355';
    case TileType.Water:
      return '#2a6fa8';
    case TileType.Tree:
      return '#2d5a1e';
    case TileType.Rock:
      return '#6b6b6b';
    default:
      return '#4a7c3f';
  }
}

// ── Direction enum ─────────────────────────────────────────────────────────────

type Dir = 'up' | 'down' | 'left' | 'right';

// ── Station type ───────────────────────────────────────────────────────────────

interface Station {
  tileX: number;
  tileY: number;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function RpgView({
  terminals,
  activeTerminalId,
  setActiveTerminalId,
  sendInput,
  resizeTerminal,
  killTerminal,
  createTerminal,
  registerOutputHandler,
}: ViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<TileType[][] | null>(null);
  const stationsRef = useRef<Map<string, Station>>(new Map());
  const playerRef = useRef({ x: WORLD_W / 2, y: WORLD_H / 2, dir: 'down' as Dir });
  const animPlayerRef = useRef({ x: WORLD_W / 2, y: WORLD_H / 2 });
  const keysRef = useRef<Set<string>>(new Set());
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const pulseRef = useRef<number>(0);

  const [openTerminalId, setOpenTerminalId] = useState<string | null>(null);
  const nearbyStationRef = useRef<string | null>(null);

  // Generate world once
  if (!worldRef.current) {
    worldRef.current = generateWorld();
  }

  // ── Place stations for terminals ───────────────────────────────────────────

  const placeStation = useCallback((terminalId: string, tx: number, ty: number) => {
    stationsRef.current.set(terminalId, { tileX: tx, tileY: ty });
  }, []);

  // Auto-place new terminals that don't have stations yet
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    const rng = mulberry32(Date.now());

    for (const term of terminals) {
      if (!stationsRef.current.has(term.id)) {
        // Find a walkable tile near center
        let placed = false;
        for (let attempt = 0; attempt < 200; attempt++) {
          const tx = Math.floor(rng() * WORLD_W);
          const ty = Math.floor(rng() * WORLD_H);
          if (WALKABLE.has(world[ty][tx])) {
            // Check not too close to another station
            let tooClose = false;
            stationsRef.current.forEach((s) => {
              if (Math.abs(s.tileX - tx) + Math.abs(s.tileY - ty) < 3) tooClose = true;
            });
            if (!tooClose) {
              placeStation(term.id, tx, ty);
              placed = true;
              break;
            }
          }
        }
        if (!placed) {
          // Fallback: place near player
          const p = playerRef.current;
          placeStation(term.id, Math.floor(p.x) + 2, Math.floor(p.y) + 2);
        }
      }
    }

    // Remove stations for dead terminals
    const termIds = new Set(terminals.map((t) => t.id));
    stationsRef.current.forEach((_, id) => {
      if (!termIds.has(id)) stationsRef.current.delete(id);
    });
  }, [terminals, placeStation]);

  // ── Check if tile is walkable (including stations as walkable) ─────────────

  const isWalkable = useCallback((tx: number, ty: number): boolean => {
    if (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) return false;
    const world = worldRef.current;
    if (!world) return false;
    return WALKABLE.has(world[ty][tx]);
  }, []);

  // ── Find closest station within range ──────────────────────────────────────

  const findNearbyStation = useCallback((): string | null => {
    const p = playerRef.current;
    let closest: string | null = null;
    let closestDist = Infinity;
    stationsRef.current.forEach((s, id) => {
      const dx = s.tileX + 0.5 - p.x;
      const dy = s.tileY + 0.5 - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < INTERACT_RANGE && dist < closestDist) {
        closestDist = dist;
        closest = id;
      }
    });
    return closest;
  }, []);

  // ── Place terminal at player position ──────────────────────────────────────

  const handlePlaceTerminal = useCallback(() => {
    const p = playerRef.current;
    const tx = Math.round(p.x);
    const ty = Math.round(p.y) - 1; // Place one tile in front (up)
    const clampedX = Math.max(0, Math.min(WORLD_W - 1, tx));
    const clampedY = Math.max(0, Math.min(WORLD_H - 1, ty));

    // Check the target tile is walkable
    if (!isWalkable(clampedX, clampedY)) return;

    // Check no station already there
    let occupied = false;
    stationsRef.current.forEach((s) => {
      if (s.tileX === clampedX && s.tileY === clampedY) occupied = true;
    });
    if (occupied) return;

    // Create a terminal — the station will be placed in the useEffect above
    // We'll temporarily stash the desired position so the effect can use it
    pendingPlacementRef.current = { x: clampedX, y: clampedY };
    createTerminal(80, 24);
  }, [createTerminal, isWalkable]);

  const pendingPlacementRef = useRef<{ x: number; y: number } | null>(null);

  // When a new terminal appears and we have a pending placement, place it there
  useEffect(() => {
    if (pendingPlacementRef.current && terminals.length > 0) {
      const newest = terminals[terminals.length - 1];
      if (!stationsRef.current.has(newest.id)) {
        placeStation(newest.id, pendingPlacementRef.current.x, pendingPlacementRef.current.y);
        pendingPlacementRef.current = null;
      }
    }
  }, [terminals, placeStation]);

  // ── Keyboard handling ──────────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when terminal popup is open
      if (openTerminalId) return;

      const key = e.key.toLowerCase();
      keysRef.current.add(key);

      if (key === 'e') {
        const nearby = findNearbyStation();
        if (nearby) {
          setOpenTerminalId(nearby);
          setActiveTerminalId(nearby);
        }
      }
      if (key === 't') {
        handlePlaceTerminal();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [openTerminalId, findNearbyStation, handlePlaceTerminal, setActiveTerminalId]);

  // ── Canvas click handler ───────────────────────────────────────────────────

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || openTerminalId) return;

      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Convert screen coords to world coords
      const anim = animPlayerRef.current;
      const cw = canvas.width;
      const ch = canvas.height;
      const camX = anim.x * TILE - cw / 2 + TILE / 2;
      const camY = anim.y * TILE - ch / 2 + TILE / 2;
      const worldX = (mx + camX) / TILE;
      const worldY = (my + camY) / TILE;

      // Check if clicked on a station
      stationsRef.current.forEach((s, id) => {
        if (worldX >= s.tileX && worldX < s.tileX + 1 && worldY >= s.tileY && worldY < s.tileY + 1) {
          // Check range
          const p = playerRef.current;
          const dx = s.tileX + 0.5 - p.x;
          const dy = s.tileY + 0.5 - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < INTERACT_RANGE + 1) {
            setOpenTerminalId(id);
            setActiveTerminalId(id);
          }
        }
      });
    },
    [openTerminalId, setActiveTerminalId]
  );

  // ── Game loop ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const parent = containerRef.current;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };

    resize();
    const observer = new ResizeObserver(resize);
    if (containerRef.current) observer.observe(containerRef.current);

    lastTimeRef.current = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = time;
      pulseRef.current = time;

      // ── Update ─────────────────────────────────────────────────────────

      const keys = keysRef.current;
      const player = playerRef.current;
      let dx = 0;
      let dy = 0;

      if (!openTerminalId) {
        if (keys.has('w') || keys.has('arrowup')) dy -= 1;
        if (keys.has('s') || keys.has('arrowdown')) dy += 1;
        if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
        if (keys.has('d') || keys.has('arrowright')) dx += 1;
      }

      if (dx !== 0 || dy !== 0) {
        // Normalize diagonal
        const len = Math.sqrt(dx * dx + dy * dy);
        dx /= len;
        dy /= len;

        const speed = PLAYER_SPEED * dt;
        const newX = player.x + dx * speed;
        const newY = player.y + dy * speed;

        // Collision: check the tile the player center would be in
        // Use a smaller hitbox (0.3 radius from center)
        const r = 0.3;
        const canMoveX =
          isWalkable(Math.floor(newX - r), Math.floor(player.y - r)) &&
          isWalkable(Math.floor(newX + r), Math.floor(player.y - r)) &&
          isWalkable(Math.floor(newX - r), Math.floor(player.y + r)) &&
          isWalkable(Math.floor(newX + r), Math.floor(player.y + r));

        const canMoveY =
          isWalkable(Math.floor(player.x - r), Math.floor(newY - r)) &&
          isWalkable(Math.floor(player.x + r), Math.floor(newY - r)) &&
          isWalkable(Math.floor(player.x - r), Math.floor(newY + r)) &&
          isWalkable(Math.floor(player.x + r), Math.floor(newY + r));

        if (canMoveX) player.x = newX;
        if (canMoveY) player.y = newY;

        // Clamp to world
        player.x = Math.max(0.5, Math.min(WORLD_W - 0.5, player.x));
        player.y = Math.max(0.5, Math.min(WORLD_H - 0.5, player.y));

        // Update direction
        if (Math.abs(dx) > Math.abs(dy)) {
          player.dir = dx > 0 ? 'right' : 'left';
        } else {
          player.dir = dy > 0 ? 'down' : 'up';
        }
      }

      // Smooth camera interpolation
      const anim = animPlayerRef.current;
      const lerpSpeed = 8;
      anim.x += (player.x - anim.x) * Math.min(1, lerpSpeed * dt);
      anim.y += (player.y - anim.y) * Math.min(1, lerpSpeed * dt);

      // Update nearby station indicator (ref only, no re-render)
      nearbyStationRef.current = findNearbyStation();

      // ── Render ─────────────────────────────────────────────────────────

      const cw = canvas.width;
      const ch = canvas.height;
      const camX = anim.x * TILE - cw / 2 + TILE / 2;
      const camY = anim.y * TILE - ch / 2 + TILE / 2;

      // Dark background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, cw, ch);

      const world = worldRef.current;
      if (!world) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      // Visible tile range
      const startTileX = Math.max(0, Math.floor(camX / TILE) - 1);
      const startTileY = Math.max(0, Math.floor(camY / TILE) - 1);
      const endTileX = Math.min(WORLD_W, Math.ceil((camX + cw) / TILE) + 1);
      const endTileY = Math.min(WORLD_H, Math.ceil((camY + ch) / TILE) + 1);

      // Draw tiles
      for (let ty = startTileY; ty < endTileY; ty++) {
        for (let tx = startTileX; tx < endTileX; tx++) {
          const screenX = tx * TILE - camX;
          const screenY = ty * TILE - camY;
          const tile = world[ty][tx];

          ctx.fillStyle = tileColor(tile);
          ctx.fillRect(screenX, screenY, TILE, TILE);

          // Grid lines (subtle)
          ctx.strokeStyle = 'rgba(0,0,0,0.1)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(screenX, screenY, TILE, TILE);

          // Draw tree detail
          if (tile === TileType.Tree) {
            // Trunk
            ctx.fillStyle = '#5c3d2e';
            ctx.fillRect(screenX + 12, screenY + 18, 8, 14);
            // Canopy
            ctx.fillStyle = '#1e7a1e';
            ctx.beginPath();
            ctx.arc(screenX + TILE / 2, screenY + 12, 12, 0, Math.PI * 2);
            ctx.fill();
            // Highlight
            ctx.fillStyle = '#2fa82f';
            ctx.beginPath();
            ctx.arc(screenX + TILE / 2 - 3, screenY + 9, 5, 0, Math.PI * 2);
            ctx.fill();
          }

          // Draw rock detail
          if (tile === TileType.Rock) {
            ctx.fillStyle = '#808080';
            ctx.beginPath();
            ctx.moveTo(screenX + 4, screenY + 28);
            ctx.lineTo(screenX + 16, screenY + 6);
            ctx.lineTo(screenX + 28, screenY + 10);
            ctx.lineTo(screenX + 30, screenY + 28);
            ctx.closePath();
            ctx.fill();
            // Highlight
            ctx.fillStyle = '#999';
            ctx.beginPath();
            ctx.moveTo(screenX + 8, screenY + 24);
            ctx.lineTo(screenX + 16, screenY + 10);
            ctx.lineTo(screenX + 22, screenY + 12);
            ctx.lineTo(screenX + 14, screenY + 24);
            ctx.closePath();
            ctx.fill();
          }

          // Draw water animation
          if (tile === TileType.Water) {
            const wave = Math.sin(time / 600 + tx * 0.8 + ty * 0.5) * 0.15;
            ctx.fillStyle = `rgba(100, 180, 255, ${0.15 + wave})`;
            ctx.fillRect(screenX, screenY, TILE, TILE);
            // Wave lines
            ctx.strokeStyle = 'rgba(150, 210, 255, 0.3)';
            ctx.lineWidth = 1;
            const waveOffset = Math.sin(time / 400 + tx) * 3;
            ctx.beginPath();
            ctx.moveTo(screenX, screenY + 10 + waveOffset);
            ctx.quadraticCurveTo(screenX + TILE / 2, screenY + 10 + waveOffset + 4, screenX + TILE, screenY + 10 + waveOffset);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(screenX, screenY + 22 + waveOffset * 0.7);
            ctx.quadraticCurveTo(screenX + TILE / 2, screenY + 22 + waveOffset * 0.7 - 3, screenX + TILE, screenY + 22 + waveOffset * 0.7);
            ctx.stroke();
          }
        }
      }

      // ── Draw stations ──────────────────────────────────────────────────

      const pulse = Math.sin(time / 300) * 0.3 + 0.7;

      stationsRef.current.forEach((s, id) => {
        const sx = s.tileX * TILE - camX;
        const sy = s.tileY * TILE - camY;

        // Skip if off-screen
        if (sx < -TILE || sx > cw + TILE || sy < -TILE || sy > ch + TILE) return;

        // Glow
        const glowRadius = 20 + pulse * 8;
        const glow = ctx.createRadialGradient(sx + TILE / 2, sy + TILE / 2, 2, sx + TILE / 2, sy + TILE / 2, glowRadius);
        glow.addColorStop(0, 'rgba(0, 212, 170, 0.4)');
        glow.addColorStop(1, 'rgba(0, 212, 170, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(sx - glowRadius, sy - glowRadius, TILE + glowRadius * 2, TILE + glowRadius * 2);

        // Machine base
        ctx.fillStyle = '#1a3a3a';
        ctx.fillRect(sx + 2, sy + 2, TILE - 4, TILE - 4);

        // Machine border
        ctx.strokeStyle = `rgba(0, 212, 170, ${0.6 + pulse * 0.4})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 2, sy + 2, TILE - 4, TILE - 4);

        // Screen
        ctx.fillStyle = `rgba(0, 212, 170, ${0.2 + pulse * 0.2})`;
        ctx.fillRect(sx + 6, sy + 6, TILE - 12, TILE - 16);

        // Terminal icon (> _)
        ctx.fillStyle = `rgba(0, 212, 170, ${0.7 + pulse * 0.3})`;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('>_', sx + TILE / 2, sy + 16);

        // Status LED
        ctx.fillStyle = id === nearbyStationRef.current ? '#00ff88' : `rgba(0, 212, 170, ${pulse})`;
        ctx.beginPath();
        ctx.arc(sx + TILE / 2, sy + TILE - 6, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Interaction hint
        if (id === nearbyStationRef.current) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.beginPath();
          ctx.roundRect(sx - 10, sy - 22, TILE + 20, 18, 4);
          ctx.fill();
          ctx.fillStyle = '#00d4aa';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('Press E', sx + TILE / 2, sy - 9);
        }
      });

      // ── Draw player ────────────────────────────────────────────────────

      const px = anim.x * TILE - camX;
      const py = anim.y * TILE - camY;
      const pSize = TILE * 0.7;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(px, py + pSize / 2 + 2, pSize / 2, pSize / 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.fillStyle = '#e8a435';
      ctx.beginPath();
      ctx.arc(px, py, pSize / 2, 0, Math.PI * 2);
      ctx.fill();

      // Outline
      ctx.strokeStyle = '#b07820';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, pSize / 2, 0, Math.PI * 2);
      ctx.stroke();

      // Direction indicator
      let dirX = 0;
      let dirY = 0;
      switch (player.dir) {
        case 'up':
          dirY = -1;
          break;
        case 'down':
          dirY = 1;
          break;
        case 'left':
          dirX = -1;
          break;
        case 'right':
          dirX = 1;
          break;
      }
      const arrowLen = pSize / 2 + 4;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(px + dirX * arrowLen * 0.5, py + dirY * arrowLen * 0.5, 3, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      const eyeOffX = dirX * 3;
      const eyeOffY = dirY * 3;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(px - 4 + eyeOffX, py - 2 + eyeOffY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px + 4 + eyeOffX, py - 2 + eyeOffY, 3, 0, Math.PI * 2);
      ctx.fill();
      // Pupils
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(px - 4 + eyeOffX + dirX * 1.5, py - 2 + eyeOffY + dirY * 1.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px + 4 + eyeOffX + dirX * 1.5, py - 2 + eyeOffY + dirY * 1.5, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // ── Draw mini-map ──────────────────────────────────────────────────

      const mmSize = 120;
      const mmTile = mmSize / WORLD_W;
      const mmX = cw - mmSize - 12;
      const mmY = 12;

      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(mmX - 2, mmY - 2, mmSize + 4, mmSize + 4);
      ctx.strokeStyle = '#30363d';
      ctx.lineWidth = 1;
      ctx.strokeRect(mmX - 2, mmY - 2, mmSize + 4, mmSize + 4);

      // Tiles
      for (let ty = 0; ty < WORLD_H; ty++) {
        for (let tx = 0; tx < WORLD_W; tx++) {
          ctx.fillStyle = tileColor(world[ty][tx]);
          ctx.fillRect(mmX + tx * mmTile, mmY + ty * mmTile, mmTile + 0.5, mmTile + 0.5);
        }
      }

      // Stations on mini-map
      stationsRef.current.forEach((s) => {
        ctx.fillStyle = '#00d4aa';
        ctx.fillRect(mmX + s.tileX * mmTile - 1, mmY + s.tileY * mmTile - 1, mmTile + 2, mmTile + 2);
      });

      // Player on mini-map
      ctx.fillStyle = '#e8a435';
      ctx.beginPath();
      ctx.arc(mmX + player.x * mmTile, mmY + player.y * mmTile, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // View cone on mini-map
      const viewW = cw / TILE * mmTile;
      const viewH = ch / TILE * mmTile;
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        mmX + player.x * mmTile - viewW / 2,
        mmY + player.y * mmTile - viewH / 2,
        viewW,
        viewH
      );

      // ── HUD ────────────────────────────────────────────────────────────

      // Controls hint
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      ctx.roundRect(10, ch - 48, 360, 36, 6);
      ctx.fill();
      ctx.fillStyle = '#8b949e';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('WASD move | E interact | T place terminal', 20, ch - 25);

      // Terminal count
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      ctx.roundRect(10, 12, 160, 28, 6);
      ctx.fill();
      ctx.fillStyle = '#00d4aa';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Terminals: ${terminals.length}`, 20, 31);

      // Coordinates
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      ctx.roundRect(10, 46, 130, 24, 6);
      ctx.fill();
      ctx.fillStyle = '#6e7681';
      ctx.font = '10px monospace';
      ctx.fillText(`x:${Math.floor(player.x)} y:${Math.floor(player.y)}`, 20, 62);

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      observer.disconnect();
    };
    // Re-run loop setup only when these change:
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTerminalId, isWalkable, findNearbyStation, terminals.length]);

  // ── Close terminal popup ───────────────────────────────────────────────────

  const handleCloseTerminal = useCallback(() => {
    setOpenTerminalId(null);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  const openTerminal = openTerminalId ? terminals.find((t) => t.id === openTerminalId) : null;

  return (
    <div ref={containerRef} style={styles.container}>
      <canvas
        ref={canvasRef}
        style={styles.canvas}
        onClick={handleCanvasClick}
      />

      {openTerminal && (
        <TerminalPopup
          terminalId={openTerminal.id}
          onInput={(data) => sendInput(openTerminal.id, data)}
          onResize={(cols, rows) => resizeTerminal(openTerminal.id, cols, rows)}
          registerOutput={(handler) => registerOutputHandler(openTerminal.id, handler)}
          onClose={handleCloseTerminal}
          title={`Station [${openTerminal.id.slice(0, 8)}]`}
        />
      )}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    background: '#1a1a2e',
  },
  canvas: {
    display: 'block',
    width: '100%',
    height: '100%',
    imageRendering: 'pixelated',
    cursor: 'crosshair',
  },
};

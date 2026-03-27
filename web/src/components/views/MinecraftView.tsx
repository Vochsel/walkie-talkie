'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { ViewProps } from '@/app/page';
import TerminalPopup from '@/components/TerminalPopup';
import { usePersistedRef, usePersistedState } from '@/hooks/usePersistedState';
import { loadState, saveState } from '@/lib/storage';

// ── Block types ─────────────────────────────────────────────────────
type BlockType =
  | 'grass' | 'dirt' | 'stone' | 'cobblestone' | 'planks' | 'wood' | 'bricks'
  | 'sand' | 'gravel' | 'glass' | 'leaves' | 'sponge' | 'bookshelf'
  | 'tnt' | 'obsidian' | 'mossy_cobblestone' | 'bedrock'
  | 'coal_ore' | 'iron_ore' | 'gold_ore' | 'diamond_ore' | 'redstone_ore'
  | 'iron_block' | 'gold_block' | 'diamond_block'
  | 'terminal';

const HOTBAR_BLOCKS: BlockType[] = [
  // Row 1: terrain & building
  'grass', 'dirt', 'stone', 'cobblestone', 'planks', 'wood', 'bricks', 'sand', 'glass', 'gravel', 'leaves', 'sponge', 'bookshelf',
  // Row 2: special & underground
  'tnt', 'obsidian', 'mossy_cobblestone', 'bedrock', 'coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'redstone_ore', 'iron_block', 'gold_block', 'diamond_block', 'terminal',
];

const HOTBAR_ROW_SIZE = 13;

const BLOCK_LABELS: Record<BlockType, string> = {
  grass: 'Grass', dirt: 'Dirt', stone: 'Stone', cobblestone: 'Cobble', planks: 'Planks',
  wood: 'Wood', bricks: 'Bricks', sand: 'Sand', gravel: 'Gravel', glass: 'Glass',
  leaves: 'Leaves', sponge: 'Sponge', bookshelf: 'Books', tnt: 'TNT', obsidian: 'Obsidian',
  mossy_cobblestone: 'Mossy', bedrock: 'Bedrock', coal_ore: 'Coal', iron_ore: 'Iron Ore',
  gold_ore: 'Gold Ore', diamond_ore: 'Diamond', redstone_ore: 'Redstone',
  iron_block: 'Iron', gold_block: 'Gold', diamond_block: 'Diamond B.', terminal: 'Terminal',
};

const BLOCK_PREVIEW: Record<BlockType, string> = {
  grass: '#5aad4e', dirt: '#8b6b4a', stone: '#888888', cobblestone: '#7a7a7a',
  planks: '#b89b60', wood: '#6b4226', bricks: '#8b4d3b', sand: '#dbc67b',
  gravel: '#8a8078', glass: '#aaddff', leaves: '#2d6b1e', sponge: '#c3c33e',
  bookshelf: '#6b4226', tnt: '#cc3333', obsidian: '#1a0a2e', mossy_cobblestone: '#5a7a5a',
  bedrock: '#3a3a3a', coal_ore: '#444444', iron_ore: '#998877', gold_ore: '#aa8833',
  diamond_ore: '#55bbcc', redstone_ore: '#aa3333', iron_block: '#c8c8c8',
  gold_block: '#ddaa22', diamond_block: '#55ddcc', terminal: '#00d4aa',
};

// ── Texture atlas mapping ───────────────────────────────────────────
// Atlas is 16x16 tiles in a 256x256 PNG (minecraft.png)
const ATLAS_TILES = 16;
type TileCoord = [number, number]; // [col, row]
// Face order: +x, -x, +y, -y, +z, -z
type FaceMap = [TileCoord, TileCoord, TileCoord, TileCoord, TileCoord, TileCoord];

function allFaces(t: TileCoord): FaceMap { return [t, t, t, t, t, t]; }

const BLOCK_FACES: Record<BlockType, FaceMap> = {
  grass:              [[3,0],[3,0],[0,0],[2,0],[3,0],[3,0]],
  dirt:               allFaces([2,0]),
  stone:              allFaces([1,0]),
  cobblestone:        allFaces([0,1]),
  planks:             allFaces([4,0]),
  wood:               [[4,1],[4,1],[5,1],[5,1],[4,1],[4,1]],
  bricks:             allFaces([7,0]),
  sand:               allFaces([2,1]),
  gravel:             allFaces([3,1]),
  glass:              allFaces([1,3]),
  leaves:             allFaces([4,3]),
  sponge:             allFaces([0,3]),
  bookshelf:          [[3,2],[3,2],[4,0],[4,0],[3,2],[3,2]],
  tnt:                [[8,0],[8,0],[9,0],[10,0],[8,0],[8,0]],
  obsidian:           allFaces([5,2]),
  mossy_cobblestone:  allFaces([4,2]),
  bedrock:            allFaces([1,1]),
  coal_ore:           allFaces([2,2]),
  iron_ore:           allFaces([1,2]),
  gold_ore:           allFaces([0,2]),
  diamond_ore:        allFaces([2,3]),
  redstone_ore:       allFaces([3,3]),
  iron_block:         allFaces([6,1]),
  gold_block:         allFaces([7,1]),
  diamond_block:      allFaces([8,1]),
  terminal:           allFaces([0,0]),
};

// Create a BoxGeometry with UVs mapped to atlas tiles per face
function createBlockGeometry(faces: FaceMap): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let face = 0; face < 6; face++) {
    const [col, row] = faces[face];
    const u0 = col / ATLAS_TILES;
    const u1 = (col + 1) / ATLAS_TILES;
    const v0 = 1 - (row + 1) / ATLAS_TILES;
    const v1 = 1 - row / ATLAS_TILES;
    const i = face * 4;
    uv.setXY(i + 0, u0, v1);
    uv.setXY(i + 1, u1, v1);
    uv.setXY(i + 2, u0, v0);
    uv.setXY(i + 3, u1, v0);
  }
  uv.needsUpdate = true;
  return geo;
}

// Create material(s) for a block type using the loaded atlas texture
function createBlockMaterial(
  texture: THREE.Texture,
  blockType: BlockType,
): THREE.Material | THREE.Material[] {
  if (blockType === 'grass') {
    const side = new THREE.MeshLambertMaterial({ map: texture, color: 0x88cc88 });
    const top = new THREE.MeshLambertMaterial({ map: texture, color: 0x59a833 });
    const bottom = new THREE.MeshLambertMaterial({ map: texture });
    return [side, side, top, bottom, side, side];
  }
  if (blockType === 'leaves') {
    return new THREE.MeshLambertMaterial({
      map: texture, color: 0x4aaa2a, transparent: true, alphaTest: 0.1,
    });
  }
  if (blockType === 'glass') {
    return new THREE.MeshLambertMaterial({
      map: texture, transparent: true, alphaTest: 0.01, opacity: 0.8,
    });
  }
  if (blockType === 'terminal') {
    return new THREE.MeshLambertMaterial({
      color: 0x00d4aa, emissive: 0x00d4aa, emissiveIntensity: 0.45,
    });
  }
  if (blockType === 'redstone_ore') {
    return new THREE.MeshLambertMaterial({
      map: texture, emissive: 0x330000, emissiveIntensity: 0.15,
    });
  }
  if (blockType === 'diamond_ore') {
    return new THREE.MeshLambertMaterial({
      map: texture, emissive: 0x002233, emissiveIntensity: 0.1,
    });
  }
  if (blockType === 'diamond_block') {
    return new THREE.MeshLambertMaterial({
      map: texture, emissive: 0x114444, emissiveIntensity: 0.2,
    });
  }
  if (blockType === 'gold_block') {
    return new THREE.MeshLambertMaterial({
      map: texture, emissive: 0x221100, emissiveIntensity: 0.15,
    });
  }
  if (blockType === 'tnt') {
    const side = new THREE.MeshLambertMaterial({ map: texture });
    const top = new THREE.MeshLambertMaterial({ map: texture });
    const bottom = new THREE.MeshLambertMaterial({ map: texture });
    return [side, side, top, bottom, side, side];
  }
  if (blockType === 'bookshelf') {
    const side = new THREE.MeshLambertMaterial({ map: texture });
    const cap = new THREE.MeshLambertMaterial({ map: texture });
    return [side, side, cap, cap, side, side];
  }
  return new THREE.MeshLambertMaterial({ map: texture });
}

const WORLD_SIZE = 32;
const UNDERGROUND_DEPTH = -16; // bedrock level

// ── Physics constants (Minecraft-accurate) ──────────────────────────
const GRAVITY = -32;            // ~0.08 blocks/tick² × 20² ticks/s²
const JUMP_VELOCITY = 8.95;    // ~0.42 blocks/tick × 20 → 1.25 block jump
const MAX_FALL_SPEED = -78.4;  // terminal velocity ~3.92 blocks/tick × 20

const PLAYER_WIDTH = 0.6;      // hitbox width (same standing & crouching)

// Standing dimensions
const PLAYER_EYE_HEIGHT = 1.62;
const PLAYER_BODY_HEIGHT = 1.8;

// Crouching dimensions
const CROUCH_EYE_HEIGHT = 1.27;
const CROUCH_BODY_HEIGHT = 1.5;

// Movement speeds (blocks/second)
const WALK_SPEED = 4.317;
const SPRINT_SPEED = 5.612;    // 1.3× walk
const SNEAK_SPEED = 1.31;      // ~0.3× walk

// Camera FOV
const BASE_FOV = 70;
const SPRINT_FOV = 80;
const FOV_LERP_SPEED = 8;      // how fast FOV transitions

// ── Seeded RNG ──────────────────────────────────────────────────────
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Voxel world ─────────────────────────────────────────────────────
function posKey(x: number, y: number, z: number) { return `${x},${y},${z}`; }

// World diff: tracks user modifications from the generated world
interface WorldDiff {
  added: Record<string, BlockType>;   // posKey -> type (blocks placed by user)
  removed: string[];                   // posKeys of blocks broken by user
}

class VoxelWorld {
  blocks = new Map<string, BlockType>();
  // Track original generated state for diffing
  private generated = new Set<string>();
  private userAdded = new Map<string, BlockType>();
  private userRemoved = new Set<string>();

  set(x: number, y: number, z: number, type: BlockType) {
    const key = posKey(x, y, z);
    this.blocks.set(key, type);
  }

  // Called after initial world gen to snapshot the base state
  snapshotGenerated() {
    this.generated = new Set(this.blocks.keys());
  }

  // Track a user modification (place)
  userSet(x: number, y: number, z: number, type: BlockType) {
    const key = posKey(x, y, z);
    this.blocks.set(key, type);
    this.userRemoved.delete(key);
    // Always track as user-added (even if same type as generated — simplifies diff)
    this.userAdded.set(key, type);
  }

  // Track a user modification (break)
  userDelete(x: number, y: number, z: number) {
    const key = posKey(x, y, z);
    this.blocks.delete(key);
    this.userAdded.delete(key);
    if (this.generated.has(key)) {
      this.userRemoved.add(key);
    }
  }

  get(x: number, y: number, z: number): BlockType | undefined {
    return this.blocks.get(posKey(x, y, z));
  }

  has(x: number, y: number, z: number): boolean {
    return this.blocks.has(posKey(x, y, z));
  }

  delete(x: number, y: number, z: number): boolean {
    return this.blocks.delete(posKey(x, y, z));
  }

  isSolid(x: number, y: number, z: number): boolean {
    const b = this.blocks.get(posKey(x, y, z));
    if (!b) return false;
    if (b === 'glass') return false; // glass is non-solid
    return true;
  }

  // Get all blocks grouped by type
  grouped(): Map<BlockType, THREE.Vector3[]> {
    const groups = new Map<BlockType, THREE.Vector3[]>();
    for (const [key, type] of this.blocks) {
      const [x, y, z] = key.split(',').map(Number);
      let arr = groups.get(type);
      if (!arr) { arr = []; groups.set(type, arr); }
      arr.push(new THREE.Vector3(x, y, z));
    }
    return groups;
  }

  exportDiff(): WorldDiff {
    return {
      added: Object.fromEntries(this.userAdded),
      removed: Array.from(this.userRemoved),
    };
  }

  applyDiff(diff: WorldDiff) {
    for (const key of diff.removed) {
      this.blocks.delete(key);
      this.userRemoved.add(key);
    }
    for (const [key, type] of Object.entries(diff.added)) {
      this.blocks.set(key, type as BlockType);
      this.userAdded.set(key, type as BlockType);
    }
  }
}

function generateWorld(): VoxelWorld {
  const world = new VoxelWorld();
  const rng = mulberry32(42);

  // Height map with simple noise
  const heightMap: number[][] = [];
  for (let x = 0; x < WORLD_SIZE; x++) {
    heightMap[x] = [];
    for (let z = 0; z < WORLD_SIZE; z++) {
      const h = Math.floor(
        2 + Math.sin(x * 0.15) * 1.5 + Math.cos(z * 0.12) * 1.5 +
        Math.sin((x + z) * 0.08) * 2
      );
      heightMap[x][z] = Math.max(1, h);
    }
  }

  // ── Fill terrain: bedrock → stone → dirt → grass ──────────────────
  for (let x = 0; x < WORLD_SIZE; x++) {
    for (let z = 0; z < WORLD_SIZE; z++) {
      const h = heightMap[x][z];

      // Bedrock floor
      world.set(x, UNDERGROUND_DEPTH, z, 'bedrock');
      // Occasionally a second bedrock layer for jaggedness
      if (rng() < 0.5) world.set(x, UNDERGROUND_DEPTH + 1, z, 'bedrock');

      // Stone fills from above bedrock to surface - 4
      for (let y = UNDERGROUND_DEPTH + 2; y < h - 3; y++) {
        world.set(x, y, z, 'stone');
      }

      // Dirt layers
      for (let y = Math.max(UNDERGROUND_DEPTH + 2, h - 3); y < h; y++) {
        world.set(x, y, z, 'dirt');
      }

      // Grass on top
      world.set(x, h, z, 'grass');
    }
  }

  // ── Ore veins ─────────────────────────────────────────────────────
  function placeOreVein(oreType: BlockType, cx: number, cy: number, cz: number, size: number) {
    for (let i = 0; i < size; i++) {
      const ox = cx + Math.floor(rng() * 3) - 1;
      const oy = cy + Math.floor(rng() * 3) - 1;
      const oz = cz + Math.floor(rng() * 3) - 1;
      if (ox < 0 || ox >= WORLD_SIZE || oz < 0 || oz >= WORLD_SIZE) continue;
      if (world.get(ox, oy, oz) === 'stone') {
        world.set(ox, oy, oz, oreType);
      }
    }
  }

  // Coal: y = -12 to surface-4, common
  for (let i = 0; i < 120; i++) {
    const x = Math.floor(rng() * WORLD_SIZE);
    const z = Math.floor(rng() * WORLD_SIZE);
    const y = Math.floor(rng() * (heightMap[x][z] - 4 - (-12))) + (-12);
    placeOreVein('coal_ore', x, y, z, 4 + Math.floor(rng() * 5));
  }

  // Iron: y = -15 to -2
  for (let i = 0; i < 80; i++) {
    const x = Math.floor(rng() * WORLD_SIZE);
    const z = Math.floor(rng() * WORLD_SIZE);
    const y = Math.floor(rng() * 13) + (-15);
    placeOreVein('iron_ore', x, y, z, 3 + Math.floor(rng() * 4));
  }

  // Gold: y = -16 to -8, rare
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(rng() * WORLD_SIZE);
    const z = Math.floor(rng() * WORLD_SIZE);
    const y = Math.floor(rng() * 8) + (-16);
    placeOreVein('gold_ore', x, y, z, 2 + Math.floor(rng() * 4));
  }

  // Redstone: y = -16 to -10
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(rng() * WORLD_SIZE);
    const z = Math.floor(rng() * WORLD_SIZE);
    const y = Math.floor(rng() * 6) + (-16);
    placeOreVein('redstone_ore', x, y, z, 3 + Math.floor(rng() * 5));
  }

  // Diamond: y = -16 to -12, very rare
  for (let i = 0; i < 15; i++) {
    const x = Math.floor(rng() * WORLD_SIZE);
    const z = Math.floor(rng() * WORLD_SIZE);
    const y = Math.floor(rng() * 4) + (-16);
    placeOreVein('diamond_ore', x, y, z, 2 + Math.floor(rng() * 3));
  }

  // Gravel pockets underground
  for (let i = 0; i < 25; i++) {
    const cx = Math.floor(rng() * WORLD_SIZE);
    const cz = Math.floor(rng() * WORLD_SIZE);
    const cy = Math.floor(rng() * 10) + (-12);
    const size = 3 + Math.floor(rng() * 4);
    for (let j = 0; j < size * 3; j++) {
      const gx = cx + Math.floor(rng() * 5) - 2;
      const gy = cy + Math.floor(rng() * 5) - 2;
      const gz = cz + Math.floor(rng() * 5) - 2;
      if (gx >= 0 && gx < WORLD_SIZE && gz >= 0 && gz < WORLD_SIZE) {
        const b = world.get(gx, gy, gz);
        if (b === 'stone') world.set(gx, gy, gz, 'gravel');
      }
    }
  }

  // ── Caves (worm carving) ──────────────────────────────────────────
  for (let c = 0; c < 12; c++) {
    let cx = Math.floor(rng() * WORLD_SIZE);
    let cy = Math.floor(rng() * 12) + (-14);
    let cz = Math.floor(rng() * WORLD_SIZE);
    let dirX = rng() - 0.5, dirY = (rng() - 0.5) * 0.5, dirZ = rng() - 0.5;
    const length = 15 + Math.floor(rng() * 25);

    for (let step = 0; step < length; step++) {
      // Carve a sphere at current position
      const radius = 1.5 + rng() * 1.5;
      const r = Math.ceil(radius);
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dz = -r; dz <= r; dz++) {
            if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
            const bx = Math.floor(cx + dx), by = Math.floor(cy + dy), bz = Math.floor(cz + dz);
            if (bx < 0 || bx >= WORLD_SIZE || bz < 0 || bz >= WORLD_SIZE) continue;
            const block = world.get(bx, by, bz);
            if (block && block !== 'bedrock' && block !== 'grass') {
              world.delete(bx, by, bz);
            }
          }
        }
      }

      // Wander
      dirX += (rng() - 0.5) * 0.4;
      dirY += (rng() - 0.5) * 0.3;
      dirZ += (rng() - 0.5) * 0.4;
      // Keep within bounds and underground
      cx += dirX;
      cy += dirY;
      cz += dirZ;
      cy = Math.max(UNDERGROUND_DEPTH + 2, Math.min(cy, -1));
      cx = Math.max(1, Math.min(cx, WORLD_SIZE - 2));
      cz = Math.max(1, Math.min(cz, WORLD_SIZE - 2));
    }
  }

  // ── Surface features ──────────────────────────────────────────────
  for (let x = 0; x < WORLD_SIZE; x++) {
    for (let z = 0; z < WORLD_SIZE; z++) {
      const h = heightMap[x][z];

      // Scatter cobblestone on surface
      if (rng() < 0.03) {
        world.set(x, h + 1, z, 'cobblestone');
      }

      // Trees
      if (rng() < 0.025) {
        const trunkHeight = 3 + Math.floor(rng() * 3);
        for (let y = h + 1; y < h + 1 + trunkHeight; y++) {
          world.set(x, y, z, 'wood');
        }
        const leafBase = h + 1 + trunkHeight - 1;
        for (let lx = -2; lx <= 2; lx++) {
          for (let lz = -2; lz <= 2; lz++) {
            for (let ly = 0; ly <= 2; ly++) {
              const px = x + lx, pz = z + lz;
              if (px < 0 || px >= WORLD_SIZE || pz < 0 || pz >= WORLD_SIZE) continue;
              const dist = Math.abs(lx) + Math.abs(lz) + ly;
              if (dist <= 3 && rng() > 0.15) {
                if (!world.has(px, leafBase + ly, pz)) {
                  world.set(px, leafBase + ly, pz, 'leaves');
                }
              }
            }
          }
        }
      }

      // Sand patches
      if (rng() < 0.02) {
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            const sx = x + dx, sz = z + dz;
            if (sx >= 0 && sx < WORLD_SIZE && sz >= 0 && sz < WORLD_SIZE && rng() > 0.3) {
              const sh = heightMap[sx]?.[sz] ?? 1;
              world.set(sx, sh, sz, 'sand');
            }
          }
        }
      }
    }
  }

  world.snapshotGenerated();
  return world;
}

// ── Create all materials for all block types ────────────────────────
function createAllMaterials(texture: THREE.Texture): Map<BlockType, THREE.Material | THREE.Material[]> {
  const mats = new Map<BlockType, THREE.Material | THREE.Material[]>();
  for (const type of HOTBAR_BLOCKS) {
    mats.set(type, createBlockMaterial(texture, type));
  }
  return mats;
}

// ── Geometry cache per block type ───────────────────────────────────
function createAllGeometries(): Map<BlockType, THREE.BoxGeometry> {
  const geos = new Map<BlockType, THREE.BoxGeometry>();
  for (const type of HOTBAR_BLOCKS) {
    geos.set(type, createBlockGeometry(BLOCK_FACES[type]));
  }
  return geos;
}

// ── Low-poly CRT computer model for terminal blocks ─────────────────
function createCRTModel(position: THREE.Vector3, yaw = 0): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.y = yaw;
  group.userData.blockType = 'terminal';

  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2a2a3d });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1e1e2e });
  const screenMat = new THREE.MeshLambertMaterial({
    color: 0x00d4aa, emissive: 0x00d4aa, emissiveIntensity: 0.5,
  });

  // Offset so model sits on bottom of block bounding box (y = -0.5)
  const yOff = -0.16;

  // Monitor housing — boxy CRT shell
  const monitorGeo = new THREE.BoxGeometry(0.78, 0.52, 0.5);
  const monitor = new THREE.Mesh(monitorGeo, bodyMat);
  monitor.position.set(0, 0.1 + yOff, -0.03);
  monitor.castShadow = true;
  monitor.receiveShadow = true;
  group.add(monitor);

  // Screen bezel (dark inset frame)
  const bezelGeo = new THREE.BoxGeometry(0.62, 0.38, 0.02);
  const bezel = new THREE.Mesh(bezelGeo, darkMat);
  bezel.position.set(0, 0.12 + yOff, 0.225);
  group.add(bezel);

  // Screen (glowing terminal green)
  const screenGeo = new THREE.BoxGeometry(0.52, 0.3, 0.02);
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, 0.12 + yOff, 0.235);
  group.add(screen);

  // Stand / neck
  const standGeo = new THREE.BoxGeometry(0.14, 0.12, 0.14);
  const stand = new THREE.Mesh(standGeo, darkMat);
  stand.position.set(0, -0.22 + yOff, 0);
  stand.castShadow = true;
  group.add(stand);

  // Base plate
  const baseGeo = new THREE.BoxGeometry(0.45, 0.04, 0.3);
  const base = new THREE.Mesh(baseGeo, bodyMat);
  base.position.set(0, -0.32 + yOff, 0);
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Keyboard
  const kbGeo = new THREE.BoxGeometry(0.5, 0.03, 0.18);
  const kb = new THREE.Mesh(kbGeo, darkMat);
  kb.position.set(0, -0.32 + yOff, 0.34);
  kb.castShadow = true;
  kb.receiveShadow = true;
  group.add(kb);

  return group;
}

// ── Build meshes from world ─────────────────────────────────────────
function buildWorldMeshes(
  world: VoxelWorld,
  materials: Map<BlockType, THREE.Material | THREE.Material[]>,
  geometries: Map<BlockType, THREE.BoxGeometry>,
  terminalRotations?: Map<string, number>,
): THREE.Object3D[] {
  const groups = world.grouped();
  const meshes: THREE.Object3D[] = [];

  for (const [type, positions] of groups) {
    if (positions.length === 0) continue;

    // Terminal blocks use a custom CRT model instead of instanced cubes
    if (type === 'terminal') {
      for (const pos of positions) {
        const key = posKey(pos.x, pos.y, pos.z);
        const yaw = terminalRotations?.get(key) ?? 0;
        meshes.push(createCRTModel(pos, yaw));
      }
      continue;
    }

    const mat = materials.get(type)!;
    const geo = geometries.get(type)!;
    const inst = new THREE.InstancedMesh(geo, mat, positions.length);
    inst.userData.blockType = type;
    const dummy = new THREE.Object3D();
    positions.forEach((pos, i) => {
      dummy.position.copy(pos);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = true;
    inst.receiveShadow = true;
    meshes.push(inst);
  }

  return meshes;
}

// ── AABB collision ──────────────────────────────────────────────────
const EPSILON = 0.001; // prevents floating-point boundary issues

function playerAABB(pos: THREE.Vector3, hw: number, bodyH: number, eyeH: number) {
  return {
    minX: pos.x - hw, maxX: pos.x + hw,
    minY: pos.y - eyeH, maxY: pos.y - eyeH + bodyH,
    minZ: pos.z - hw, maxZ: pos.z + hw,
  };
}

function overlapsBlock(
  minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number,
  bx: number, by: number, bz: number,
): boolean {
  return maxX > bx - 0.5 + EPSILON && minX < bx + 0.5 - EPSILON &&
         maxY > by - 0.5 + EPSILON && minY < by + 0.5 - EPSILON &&
         maxZ > bz - 0.5 + EPSILON && minZ < bz + 0.5 - EPSILON;
}

// Check if player at position overlaps any solid block
function isPlayerColliding(world: VoxelWorld, pos: THREE.Vector3, hw: number, bodyH: number, eyeH: number): boolean {
  const bb = playerAABB(pos, hw, bodyH, eyeH);
  for (let bx = Math.round(bb.minX); bx <= Math.round(bb.maxX); bx++) {
    for (let by = Math.round(bb.minY); by <= Math.round(bb.maxY); by++) {
      for (let bz = Math.round(bb.minZ); bz <= Math.round(bb.maxZ); bz++) {
        if (world.isSolid(bx, by, bz) && overlapsBlock(bb.minX, bb.maxX, bb.minY, bb.maxY, bb.minZ, bb.maxZ, bx, by, bz)) {
          return true;
        }
      }
    }
  }
  return false;
}

// Check if there's a solid block directly below the player's feet
function isOnGround(world: VoxelWorld, pos: THREE.Vector3, hw: number, eyeH: number): boolean {
  const feetY = pos.y - eyeH;
  const checkY = feetY - EPSILON * 2;
  // Check a few points under the player's feet
  for (const dx of [-hw + EPSILON, 0, hw - EPSILON]) {
    for (const dz of [-hw + EPSILON, 0, hw - EPSILON]) {
      if (world.isSolid(Math.round(pos.x + dx), Math.round(checkY), Math.round(pos.z + dz))) {
        return true;
      }
    }
  }
  return false;
}

function resolveY(
  world: VoxelWorld,
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  dt: number,
  hw: number,
  bodyH: number,
  eyeH: number,
): { y: number; grounded: boolean } {
  const totalDy = vel.y * dt;

  // Substep to prevent tunneling through thin floors/ceilings at high speeds
  const maxStep = 0.9;
  const numSteps = Math.max(1, Math.ceil(Math.abs(totalDy) / maxStep));

  let currentY = pos.y;

  for (let step = 0; step < numSteps; step++) {
    const targetY = pos.y + totalDy * ((step + 1) / numSteps);
    const testPos = pos.clone();
    testPos.y = targetY;

    if (!isPlayerColliding(world, testPos, hw, bodyH, eyeH)) {
      currentY = targetY;
      continue;
    }

    // Collision — find the resolved position
    if (vel.y <= 0) {
      // Falling: snap feet to top of the highest block below
      const feetY = targetY - eyeH;
      const bx1 = Math.round(pos.x - hw), bx2 = Math.round(pos.x + hw);
      const bz1 = Math.round(pos.z - hw), bz2 = Math.round(pos.z + hw);
      let highestTop = -Infinity;
      for (let bx = bx1; bx <= bx2; bx++) {
        for (let bz = bz1; bz <= bz2; bz++) {
          for (let by = Math.round(feetY); by >= Math.round(feetY) - 1; by--) {
            if (world.isSolid(bx, by, bz)) {
              highestTop = Math.max(highestTop, by + 0.5);
            }
          }
        }
      }
      if (highestTop > -Infinity) {
        vel.y = 0;
        return { y: highestTop + eyeH, grounded: true };
      }
    } else {
      // Rising: snap head to bottom of the lowest block above
      const headY = targetY - eyeH + bodyH;
      const bx1 = Math.round(pos.x - hw), bx2 = Math.round(pos.x + hw);
      const bz1 = Math.round(pos.z - hw), bz2 = Math.round(pos.z + hw);
      let lowestBottom = Infinity;
      for (let bx = bx1; bx <= bx2; bx++) {
        for (let bz = bz1; bz <= bz2; bz++) {
          for (let by = Math.round(headY); by <= Math.round(headY) + 1; by++) {
            if (world.isSolid(bx, by, bz)) {
              lowestBottom = Math.min(lowestBottom, by - 0.5);
            }
          }
        }
      }
      if (lowestBottom < Infinity) {
        vel.y = 0;
        return { y: lowestBottom - bodyH + eyeH, grounded: false };
      }
    }

    // Fallback: couldn't resolve, stay at last valid position
    const wasFalling = vel.y <= 0;
    vel.y = 0;
    return { y: currentY, grounded: wasFalling };
  }

  return { y: currentY, grounded: false };
}

function resolveXZ(
  world: VoxelWorld,
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  axis: 'x' | 'z',
  dt: number,
  hw: number,
  bodyH: number,
  eyeH: number,
): number {
  const newVal = pos[axis] + vel[axis] * dt;
  const testPos = pos.clone();
  testPos[axis] = newVal;

  if (isPlayerColliding(world, testPos, hw, bodyH, eyeH)) {
    vel[axis] = 0;
    return pos[axis];
  }

  return newVal;
}

// ── Component ───────────────────────────────────────────────────────
export default function MinecraftView({
  terminals,
  activeTerminalId,
  setActiveTerminalId,
  sendInput,
  resizeTerminal,
  killTerminal,
  createTerminal,
  registerOutputHandler,
}: ViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [popupTerminalId, setPopupTerminalId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [selectedSlot, setSelectedSlot] = usePersistedState('mc:hotbar', 0);

  // Refs for game state (avoid re-renders)
  const worldRef = useRef<VoxelWorld | null>(null);
  const sceneObjsRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    animId: number;
    worldMeshes: THREE.Object3D[];
    materials: Map<BlockType, THREE.Material | THREE.Material[]>;
    geometries: Map<BlockType, THREE.BoxGeometry>;
    raycaster: THREE.Raycaster;
    highlightMesh: THREE.Mesh;
  } | null>(null);

  const keysRef = useRef<Set<string>>(new Set());
  const { ref: yawRef } = usePersistedRef('mc:yaw', 0);
  const { ref: pitchRef } = usePersistedRef('mc:pitch', 0);
  const { ref: playerPosArrRef } = usePersistedRef<[number, number, number]>('mc:pos', [WORLD_SIZE / 2, 20, WORLD_SIZE / 2]);
  // Convert persisted array to THREE.Vector3
  const playerPosRef = useRef(new THREE.Vector3(...playerPosArrRef.current));

  const velocityRef = useRef(new THREE.Vector3(0, 0, 0));
  const onGroundRef = useRef(false);
  const sprintingRef = useRef(false);
  const crouchingRef = useRef(false);
  const wasCrouchingRef = useRef(false);
  const crouchCameraOffsetRef = useRef(0);
  const selectedSlotRef = useRef(0);
  const meshDirtyRef = useRef(false);

  // Terminal block tracking — persisted as plain objects
  const { ref: termPosObjRef, save: saveTermPositions } = usePersistedRef<Record<string, [number, number, number]>>('mc:termPositions', {});
  const terminalPositionsRef = useRef<Map<string, THREE.Vector3>>(
    new Map(Object.entries(termPosObjRef.current).map(([id, [x, y, z]]) => [id, new THREE.Vector3(x, y, z)]))
  );
  const { ref: posToTermObjRef, save: savePosToTerm } = usePersistedRef<Record<string, string>>('mc:posToTerm', {});
  const posToTerminalRef = useRef<Map<string, string>>(new Map(Object.entries(posToTermObjRef.current)));
  const { ref: termRotObjRef, save: saveTermRots } = usePersistedRef<Record<string, number>>('mc:termRots', {});
  const terminalRotationsRef = useRef<Map<string, number>>(new Map(Object.entries(termRotObjRef.current).map(([k, v]) => [k, v])));
  const pendingPlacementRef = useRef<THREE.Vector3 | null>(null);

  const syncTerminalMaps = useCallback(() => {
    const posObj: Record<string, [number, number, number]> = {};
    terminalPositionsRef.current.forEach((v, id) => { posObj[id] = [v.x, v.y, v.z]; });
    termPosObjRef.current = posObj;
    saveTermPositions();
    posToTermObjRef.current = Object.fromEntries(posToTerminalRef.current);
    savePosToTerm();
    termRotObjRef.current = Object.fromEntries(terminalRotationsRef.current);
    saveTermRots();
  }, [termPosObjRef, saveTermPositions, posToTermObjRef, savePosToTerm, termRotObjRef, saveTermRots]);

  // Keep selectedSlotRef in sync
  useEffect(() => { selectedSlotRef.current = selectedSlot; }, [selectedSlot]);

  const rebuildMeshes = useCallback(() => {
    const s = sceneObjsRef.current;
    const world = worldRef.current;
    if (!s || !world) return;

    for (const m of s.worldMeshes) {
      s.scene.remove(m);
      if (m instanceof THREE.InstancedMesh) m.geometry.dispose();
    }

    s.worldMeshes = buildWorldMeshes(world, s.materials, s.geometries, terminalRotationsRef.current);
    for (const m of s.worldMeshes) s.scene.add(m);
  }, []);

  // ── Scene setup ───────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: false }); // pixel art look
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.018);

    const camera = new THREE.PerspectiveCamera(BASE_FOV, container.clientWidth / container.clientHeight, 0.1, 120);
    camera.position.copy(playerPosRef.current);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(24, 50, 24);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.left = -50; dirLight.shadow.camera.right = 50;
    dirLight.shadow.camera.top = 50; dirLight.shadow.camera.bottom = -50;
    dirLight.shadow.camera.far = 120;
    scene.add(dirLight);
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x4a8c3f, 0.3));

    // Generate world
    const world = generateWorld();
    // Apply saved world modifications
    const savedDiff = loadState<WorldDiff | null>('mc:worldDiff', null);
    if (savedDiff) world.applyDiff(savedDiff);
    worldRef.current = world;

    // Validate player position — push above terrain if stuck
    {
      const pos = playerPosRef.current;
      const hw = PLAYER_WIDTH / 2;
      const bottom = pos.y - PLAYER_EYE_HEIGHT;
      const bx = Math.round(pos.x);
      const bz = Math.round(pos.z);
      let stuck = false;
      for (let by = Math.round(bottom); by <= Math.round(bottom + PLAYER_BODY_HEIGHT); by++) {
        if (world.isSolid(bx, by, bz) || world.isSolid(Math.round(pos.x - hw), by, bz) ||
            world.isSolid(Math.round(pos.x + hw), by, bz) || world.isSolid(bx, by, Math.round(pos.z - hw)) ||
            world.isSolid(bx, by, Math.round(pos.z + hw))) {
          stuck = true;
          break;
        }
      }
      if (stuck || pos.y < UNDERGROUND_DEPTH - 5) {
        // Find safe Y: scan upward from current X/Z
        let safeY = 1;
        for (let y = UNDERGROUND_DEPTH; y < 30; y++) {
          if (world.isSolid(bx, y, bz) && !world.isSolid(bx, y + 1, bz) && !world.isSolid(bx, y + 2, bz)) {
            safeY = y + 0.5 + PLAYER_EYE_HEIGHT;
          }
        }
        pos.set(pos.x, safeY, pos.z);
        velocityRef.current.set(0, 0, 0);
      }
    }

    // Load texture atlas
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load('/minecraft.png');
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;

    const geometries = createAllGeometries();
    const materials = createAllMaterials(texture);
    const worldMeshes = buildWorldMeshes(world, materials, geometries, terminalRotationsRef.current);
    for (const m of worldMeshes) scene.add(m);

    // Block highlight wireframe
    const highlightGeo = new THREE.BoxGeometry(1.005, 1.005, 1.005);
    const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.5 });
    const highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
    highlightMesh.visible = false;
    scene.add(highlightMesh);

    const raycaster = new THREE.Raycaster();
    raycaster.far = 8;

    const state = { renderer, scene, camera, animId: 0, worldMeshes, materials, geometries, raycaster, highlightMesh };
    sceneObjsRef.current = state;

    // ── Pointer lock ────────────────────────────────────────────────
    const canvas = renderer.domElement;
    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      setIsLocked(locked);
      if (locked) setHasStarted(true);
    };
    document.addEventListener('pointerlockchange', onPointerLockChange);

    const requestLock = () => {
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
    };
    canvas.addEventListener('click', requestLock);

    // ── Mouse look ──────────────────────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      yawRef.current -= e.movementX * 0.002;
      pitchRef.current = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitchRef.current - e.movementY * 0.002));
    };
    document.addEventListener('mousemove', onMouseMove);

    // ── Keys ────────────────────────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysRef.current.add(k);
      // Prevent page scroll on WASD/space/shift/ctrl when locked
      if (document.pointerLockElement === canvas) {
        if (['w', 'a', 's', 'd', ' ', 'shift', 'control'].includes(k)) e.preventDefault();
      }
      // Hotbar selection with number keys
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        setSelectedSlot(num - 1);
      }
      // E to interact with terminal
      if (k === 'e' && document.pointerLockElement === canvas) {
        const hit = raycastBlock();
        if (hit && hit.blockType === 'terminal' && hit.terminalId) {
          document.exitPointerLock();
          setPopupTerminalId(hit.terminalId);
          setActiveTerminalId(hit.terminalId);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current.delete(e.key.toLowerCase()); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // ── Scroll wheel to cycle hotbar ────────────────────────────────
    const onWheel = (e: WheelEvent) => {
      if (document.pointerLockElement !== canvas) return;
      e.preventDefault();
      setSelectedSlot(prev => {
        const dir = e.deltaY > 0 ? 1 : -1;
        return ((prev + dir) % HOTBAR_BLOCKS.length + HOTBAR_BLOCKS.length) % HOTBAR_BLOCKS.length;
      });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // ── Raycast helper ──────────────────────────────────────────────
    const screenCenter = new THREE.Vector2(0, 0);

    function raycastBlock(): { blockPos: THREE.Vector3; placePos: THREE.Vector3; blockType: BlockType; terminalId?: string } | null {
      raycaster.setFromCamera(screenCenter, camera);
      const intersects = raycaster.intersectObjects(state.worldMeshes, true);
      if (intersects.length === 0) return null;

      const hit = intersects[0];
      if (!hit.face) return null;

      let hitPos: THREE.Vector3;
      if (hit.object instanceof THREE.InstancedMesh && hit.instanceId !== undefined) {
        const matrix = new THREE.Matrix4();
        hit.object.getMatrixAt(hit.instanceId, matrix);
        hitPos = new THREE.Vector3().setFromMatrixPosition(matrix);
      } else if (hit.object.parent && hit.object.parent.userData.blockType) {
        // Child of a CRT group — use the group's position
        hitPos = hit.object.parent.position.clone();
      } else {
        hitPos = hit.object.position.clone();
      }

      const bx = Math.round(hitPos.x), by = Math.round(hitPos.y), bz = Math.round(hitPos.z);
      const normal = hit.face.normal.clone();
      const placePos = new THREE.Vector3(bx + Math.round(normal.x), by + Math.round(normal.y), bz + Math.round(normal.z));

      const bt = world.get(bx, by, bz);
      const tid = bt === 'terminal' ? posToTerminalRef.current.get(posKey(bx, by, bz)) : undefined;

      return { blockPos: new THREE.Vector3(bx, by, bz), placePos, blockType: bt || 'stone', terminalId: tid };
    }

    // ── Mouse clicks: place/break/interact ──────────────────────────
    const onMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      const hit = raycastBlock();
      if (!hit) return;

      if (e.button === 1) {
        // Middle click: PICK block type
        e.preventDefault();
        const idx = HOTBAR_BLOCKS.indexOf(hit.blockType);
        if (idx !== -1) setSelectedSlot(idx);
        return;
      }

      if (e.button === 0) {
        // Left click: BREAK block
        const { blockPos, blockType, terminalId } = hit;
        if (blockType === 'bedrock') return; // don't break bedrock

        // If it's a terminal block, kill the terminal
        if (blockType === 'terminal' && terminalId) {
          killTerminal(terminalId);
          const key = posKey(blockPos.x, blockPos.y, blockPos.z);
          posToTerminalRef.current.delete(key);
          terminalRotationsRef.current.delete(key);
          terminalPositionsRef.current.delete(terminalId);
          syncTerminalMaps();
        }

        world.userDelete(blockPos.x, blockPos.y, blockPos.z);
        highlightMesh.visible = false;
        meshDirtyRef.current = true;
        saveState('mc:worldDiff', world.exportDiff());

      } else if (e.button === 2) {
        // Right click: PLACE block or open terminal
        const { blockPos, placePos, blockType, terminalId } = hit;

        // If clicking a terminal block, open it
        if (blockType === 'terminal' && terminalId) {
          document.exitPointerLock();
          setPopupTerminalId(terminalId);
          setActiveTerminalId(terminalId);
          return;
        }

        // Place block — check it doesn't overlap with player
        if (placePos.y < UNDERGROUND_DEPTH) return;
        if (world.has(placePos.x, placePos.y, placePos.z)) return;

        // Player collision check
        const pBottom = playerPosRef.current.y - PLAYER_EYE_HEIGHT;
        const pTop = pBottom + PLAYER_BODY_HEIGHT;
        const hw = PLAYER_WIDTH / 2;
        if (placePos.x + 0.5 > playerPosRef.current.x - hw && placePos.x - 0.5 < playerPosRef.current.x + hw &&
            placePos.y + 0.5 > pBottom && placePos.y - 0.5 < pTop &&
            placePos.z + 0.5 > playerPosRef.current.z - hw && placePos.z - 0.5 < playerPosRef.current.z + hw) {
          return; // would be inside player
        }

        const selectedBlock = HOTBAR_BLOCKS[selectedSlotRef.current];
        world.userSet(placePos.x, placePos.y, placePos.z, selectedBlock);
        meshDirtyRef.current = true;
        saveState('mc:worldDiff', world.exportDiff());

        // If placing a terminal block, create a terminal facing the player
        if (selectedBlock === 'terminal') {
          pendingPlacementRef.current = placePos.clone();
          // Snap to nearest 90° facing the player
          const snapped = Math.round(yawRef.current / (Math.PI / 2)) * (Math.PI / 2);
          terminalRotationsRef.current.set(posKey(placePos.x, placePos.y, placePos.z), snapped);
          createTerminal(80, 24);
        }
      }
    };
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('auxclick', (e) => e.preventDefault());

    // ── Resize ──────────────────────────────────────────────────────
    const onResize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // ── Game loop ───────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let lastMeshRebuild = 0;

    const animate = () => {
      state.animId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05); // cap delta
      const time = clock.elapsedTime;

      // ── Player physics ────────────────────────────────────────────
      if (document.pointerLockElement === canvas) {
        const keys = keysRef.current;
        const vel = velocityRef.current;
        const pos = playerPosRef.current;
        const hw = PLAYER_WIDTH / 2;

        // ── Sprint & crouch state ────────────────────────────────────
        const wantsToSprint = keys.has('control') && keys.has('w') && onGroundRef.current;
        const wantsToCrouch = keys.has('shift');

        // Can't sprint and crouch at the same time
        if (wantsToCrouch) {
          sprintingRef.current = false;
          crouchingRef.current = true;
        } else if (wantsToSprint) {
          sprintingRef.current = true;
          if (crouchingRef.current) {
            // Check headroom before uncrouching for sprint
            const testPos = pos.clone();
            testPos.y += (PLAYER_EYE_HEIGHT - CROUCH_EYE_HEIGHT);
            if (!isPlayerColliding(world, testPos, hw, PLAYER_BODY_HEIGHT, PLAYER_EYE_HEIGHT)) {
              crouchingRef.current = false;
            }
          }
        } else {
          sprintingRef.current = false;
          // Uncrouch: only if there's room to stand up
          if (crouchingRef.current) {
            const testPos = pos.clone();
            testPos.y += (PLAYER_EYE_HEIGHT - CROUCH_EYE_HEIGHT);
            if (!isPlayerColliding(world, testPos, hw, PLAYER_BODY_HEIGHT, PLAYER_EYE_HEIGHT)) {
              crouchingRef.current = false;
            }
            // else stay crouched — not enough headroom
          }
        }

        const isCrouching = crouchingRef.current;
        const isSprinting = sprintingRef.current;

        // Adjust pos.y on crouch state change to keep feet grounded
        if (isCrouching && !wasCrouchingRef.current) {
          pos.y -= (PLAYER_EYE_HEIGHT - CROUCH_EYE_HEIGHT);
          crouchCameraOffsetRef.current = PLAYER_EYE_HEIGHT - CROUCH_EYE_HEIGHT;
        } else if (!isCrouching && wasCrouchingRef.current) {
          pos.y += (PLAYER_EYE_HEIGHT - CROUCH_EYE_HEIGHT);
          crouchCameraOffsetRef.current = -(PLAYER_EYE_HEIGHT - CROUCH_EYE_HEIGHT);
        }
        wasCrouchingRef.current = isCrouching;

        const currentEyeH = isCrouching ? CROUCH_EYE_HEIGHT : PLAYER_EYE_HEIGHT;
        const currentBodyH = isCrouching ? CROUCH_BODY_HEIGHT : PLAYER_BODY_HEIGHT;

        // ── Movement speed ───────────────────────────────────────────
        const speed = isCrouching ? SNEAK_SPEED : (isSprinting ? SPRINT_SPEED : WALK_SPEED);

        // Movement input
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yawRef.current);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yawRef.current);

        const wishDir = new THREE.Vector3(0, 0, 0);
        if (keys.has('w')) wishDir.add(forward);
        if (keys.has('s')) wishDir.sub(forward);
        if (keys.has('a')) wishDir.sub(right);
        if (keys.has('d')) wishDir.add(right);
        if (wishDir.lengthSq() > 0) wishDir.normalize();

        // Stop sprinting if not moving forward
        if (isSprinting && !keys.has('w')) sprintingRef.current = false;

        vel.x = wishDir.x * speed;
        vel.z = wishDir.z * speed;

        // Jump
        if (keys.has(' ') && onGroundRef.current && !isCrouching) {
          vel.y = JUMP_VELOCITY;
          onGroundRef.current = false;
        }

        // Gravity
        vel.y += GRAVITY * dt;
        if (vel.y < MAX_FALL_SPEED) vel.y = MAX_FALL_SPEED;

        // ── Crouch edge-stop ─────────────────────────────────────────
        // When crouching on the ground, prevent walking off edges
        if (isCrouching && onGroundRef.current && (vel.x !== 0 || vel.z !== 0)) {
          const testX = pos.x + vel.x * dt;
          const testZ = pos.z + vel.z * dt;
          const feetY = pos.y - currentEyeH;
          // Check if any foot corner would be over empty space
          let wouldFall = true;
          for (const dx of [-hw + EPSILON, 0, hw - EPSILON]) {
            for (const dz of [-hw + EPSILON, 0, hw - EPSILON]) {
              if (world.isSolid(Math.round(testX + dx), Math.round(feetY - EPSILON * 2), Math.round(testZ + dz))) {
                wouldFall = false;
              }
            }
          }
          if (wouldFall) {
            vel.x = 0;
            vel.z = 0;
          }
        }

        // Resolve Y first (gravity/jump), then X, then Z
        const yResult = resolveY(world, pos, vel, dt, hw, currentBodyH, currentEyeH);
        pos.y = yResult.y;
        pos.x = resolveXZ(world, pos, vel, 'x', dt, hw, currentBodyH, currentEyeH);
        pos.z = resolveXZ(world, pos, vel, 'z', dt, hw, currentBodyH, currentEyeH);

        // Ground detection
        onGroundRef.current = yResult.grounded || isOnGround(world, pos, hw, currentEyeH);

        // Safety: don't fall into the void
        if (pos.y < UNDERGROUND_DEPTH - 10) {
          pos.set(WORLD_SIZE / 2, 15, WORLD_SIZE / 2);
          vel.set(0, 0, 0);
        }

        // ── FOV transition ───────────────────────────────────────────
        const targetFov = isSprinting ? SPRINT_FOV : BASE_FOV;
        camera.fov += (targetFov - camera.fov) * Math.min(1, FOV_LERP_SPEED * dt);
        camera.updateProjectionMatrix();
      }

      // Smooth crouch camera transition
      crouchCameraOffsetRef.current += (0 - crouchCameraOffsetRef.current) * Math.min(1, 12 * dt);
      if (Math.abs(crouchCameraOffsetRef.current) < 0.001) crouchCameraOffsetRef.current = 0;

      // Sync position for persistence (usePersistedRef auto-saves every 2s)
      playerPosArrRef.current = [playerPosRef.current.x, playerPosRef.current.y, playerPosRef.current.z];

      // Update camera
      camera.position.copy(playerPosRef.current);
      camera.position.y += crouchCameraOffsetRef.current;
      camera.quaternion.setFromEuler(new THREE.Euler(pitchRef.current, yawRef.current, 0, 'YXZ'));

      // Block highlight
      if (document.pointerLockElement === canvas) {
        const hit = raycastBlock();
        if (hit) {
          highlightMesh.position.set(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z);
          highlightMesh.visible = true;
        } else {
          highlightMesh.visible = false;
        }
      } else {
        highlightMesh.visible = false;
      }

      // Rebuild meshes if dirty (throttled to every 50ms)
      if (meshDirtyRef.current && time - lastMeshRebuild > 0.05) {
        // Remove old, build new
        for (const m of state.worldMeshes) {
          scene.remove(m);
          if (m instanceof THREE.InstancedMesh) {
            m.geometry.dispose();
          } else if (m instanceof THREE.Group) {
            m.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                const mat = child.material;
                if (Array.isArray(mat)) mat.forEach(mm => mm.dispose());
                else mat.dispose();
              }
            });
          }
        }
        state.worldMeshes = buildWorldMeshes(world, materials, geometries, terminalRotationsRef.current);
        for (const m of state.worldMeshes) scene.add(m);
        meshDirtyRef.current = false;
        lastMeshRebuild = time;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(state.animId);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('click', requestLock);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('wheel', onWheel);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
          obj.geometry.dispose();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach(mat => mat.dispose());
          else m.dispose();
        }
      });
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      sceneObjsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync terminal blocks ──────────────────────────────────────────
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;

    const existingIds = new Set(terminalPositionsRef.current.keys());
    const currentIds = new Set(terminals.map(t => t.id));

    // Remove blocks for dead terminals
    for (const id of existingIds) {
      if (!currentIds.has(id)) {
        const pos = terminalPositionsRef.current.get(id);
        if (pos) {
          const key = posKey(pos.x, pos.y, pos.z);
          world.userDelete(pos.x, pos.y, pos.z);
          posToTerminalRef.current.delete(key);
          terminalRotationsRef.current.delete(key);
          meshDirtyRef.current = true;
        }
        terminalPositionsRef.current.delete(id);
      }
    }

    // Place blocks for new terminals
    for (const t of terminals) {
      if (!terminalPositionsRef.current.has(t.id)) {
        if (pendingPlacementRef.current) {
          const pos = pendingPlacementRef.current;
          terminalPositionsRef.current.set(t.id, pos.clone());
          posToTerminalRef.current.set(posKey(pos.x, pos.y, pos.z), t.id);
          pendingPlacementRef.current = null;
        } else {
          // Auto-place near center
          const cx = Math.floor(WORLD_SIZE / 2), cz = Math.floor(WORLD_SIZE / 2);
          for (let r = 1; r < WORLD_SIZE; r++) {
            let placed = false;
            for (let dx = -r; dx <= r && !placed; dx++) {
              for (let dz = -r; dz <= r && !placed; dz++) {
                if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
                const px = cx + dx, pz = cz + dz;
                if (px < 0 || px >= WORLD_SIZE || pz < 0 || pz >= WORLD_SIZE) continue;
                for (let y = 10; y >= UNDERGROUND_DEPTH; y--) {
                  if (world.has(px, y, pz) && !world.has(px, y + 1, pz)) {
                    const pos = new THREE.Vector3(px, y + 1, pz);
                    world.userSet(px, y + 1, pz, 'terminal');
                    terminalPositionsRef.current.set(t.id, pos);
                    posToTerminalRef.current.set(posKey(px, y + 1, pz), t.id);
                    meshDirtyRef.current = true;
                    placed = true;
                    break;
                  }
                }
              }
            }
            if (placed) break;
          }
        }
      }
    }
    saveState('mc:worldDiff', world.exportDiff());
    syncTerminalMaps();
  }, [terminals, syncTerminalMaps]);

  const closePopup = useCallback(() => {
    setPopupTerminalId(null);
    // Re-lock pointer to resume FPS controls immediately
    const canvas = sceneObjsRef.current?.renderer.domElement;
    if (canvas && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock();
    }
  }, []);

  return (
    <div style={styles.wrapper}>
      <div ref={containerRef} style={styles.canvas} />

      {/* Crosshair */}
      {isLocked && (
        <div style={styles.crosshair}>
          <div style={styles.crosshairH} />
          <div style={styles.crosshairV} />
        </div>
      )}

      {/* Hotbar */}
      {isLocked && (
        <div style={styles.hotbar}>
          {[0, 1].map((row) => (
            <div key={row} style={styles.hotbarRow}>
              {HOTBAR_BLOCKS.slice(row * HOTBAR_ROW_SIZE, (row + 1) * HOTBAR_ROW_SIZE).map((type, i) => {
                const idx = row * HOTBAR_ROW_SIZE + i;
                return (
                  <div
                    key={type}
                    style={{
                      ...styles.hotbarSlot,
                      ...(idx === selectedSlot ? styles.hotbarSlotActive : {}),
                    }}
                    onMouseDown={(e) => { e.stopPropagation(); setSelectedSlot(idx); }}
                  >
                    <div style={{
                      ...styles.hotbarBlock,
                      background: BLOCK_PREVIEW[type],
                      ...(type === 'glass' ? { opacity: 0.5 } : {}),
                      ...(type === 'terminal' ? { boxShadow: '0 0 6px #00d4aa' } : {}),
                    }} />
                    <span style={styles.hotbarLabel}>{BLOCK_LABELS[type]}</span>
                    {idx < 9 && <span style={styles.hotbarKey}>{idx + 1}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Instructions — only shown on first load */}
      {!isLocked && !hasStarted && !popupTerminalId && (
        <div style={styles.instructions}>
          <div style={styles.instructionsBox}>
            <div style={styles.instructionsTitle}>Minecraft Terminal World</div>
            <div style={styles.instructionsText}>Click to start</div>
            <div style={styles.instructionsKeys}>
              <span><b>WASD</b> move &nbsp; <b>Space</b> jump &nbsp; <b>Mouse</b> look</span>
              <span><b>Ctrl</b> sprint &nbsp; <b>Shift</b> sneak (edge-safe)</span>
              <span><b>Left click</b> break &nbsp; <b>Right click</b> place &nbsp; <b>Middle click</b> pick block</span>
              <span><b>E</b> / <b>Right click</b> open terminal &nbsp; <b>1-9</b> / <b>scroll</b> select block &nbsp; <b>ESC</b> release cursor</span>
            </div>
          </div>
        </div>
      )}

      {/* HUD */}
      {isLocked && (
        <div style={styles.hud}>
          <span style={styles.hudText}>
            Terminals: {terminals.length} | {BLOCK_LABELS[HOTBAR_BLOCKS[selectedSlot]]} selected
          </span>
        </div>
      )}

      {/* Terminal popups — kept mounted so xterm state persists */}
      {terminals.map((t) => (
        <TerminalPopup
          key={t.id}
          terminalId={t.id}
          visible={popupTerminalId === t.id}
          onInput={(data) => sendInput(t.id, data)}
          onResize={(cols, rows) => resizeTerminal(t.id, cols, rows)}
          registerOutput={(handler) => registerOutputHandler(t.id, handler)}
          onClose={closePopup}
          title={`Terminal [${t.id.slice(0, 8)}]`}
        />
      ))}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  wrapper: { width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#000' },
  canvas: { width: '100%', height: '100%' },
  crosshair: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 10 },
  crosshairH: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 22, height: 2, background: 'rgba(255,255,255,0.85)', borderRadius: 1, boxShadow: '0 0 3px rgba(0,0,0,0.6)' },
  crosshairV: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 2, height: 22, background: 'rgba(255,255,255,0.85)', borderRadius: 1, boxShadow: '0 0 3px rgba(0,0,0,0.6)' },
  hotbar: {
    position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
    display: 'flex', flexDirection: 'column' as const, gap: 2, padding: 4,
    background: 'rgba(0,0,0,0.65)', borderRadius: 8, border: '2px solid rgba(255,255,255,0.15)',
  },
  hotbarRow: {
    display: 'flex', gap: 2,
  },
  hotbarSlot: {
    width: 42, height: 42, display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    justifyContent: 'center', borderRadius: 4, border: '2px solid transparent',
    cursor: 'pointer', position: 'relative' as const, transition: 'border-color 0.1s',
  },
  hotbarSlotActive: {
    borderColor: '#fff', background: 'rgba(255,255,255,0.12)',
  },
  hotbarBlock: {
    width: 22, height: 22, borderRadius: 3, border: '1px solid rgba(255,255,255,0.2)',
  },
  hotbarLabel: {
    fontSize: 7, color: '#ccc', marginTop: 1, fontFamily: "'SF Mono', monospace",
    textTransform: 'uppercase' as const, letterSpacing: 0.3,
  },
  hotbarKey: {
    position: 'absolute' as const, top: 1, right: 3, fontSize: 8, color: 'rgba(255,255,255,0.4)',
    fontFamily: "'SF Mono', monospace", fontWeight: 700,
  },
  instructions: {
    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.45)', zIndex: 20, pointerEvents: 'none',
  },
  instructionsBox: {
    background: 'rgba(13, 17, 23, 0.92)', border: '1px solid #30363d', borderRadius: 12,
    padding: '28px 40px', textAlign: 'center' as const, display: 'flex',
    flexDirection: 'column' as const, gap: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
    pointerEvents: 'auto' as const,
  },
  instructionsTitle: { fontSize: 22, fontWeight: 700, color: '#00d4aa', fontFamily: "'SF Mono', 'Fira Code', monospace", letterSpacing: 1 },
  instructionsText: { fontSize: 15, color: '#8b949e' },
  instructionsKeys: { display: 'flex', flexDirection: 'column' as const, gap: 6, fontSize: 13, color: '#c9d1d9', marginTop: 8 },
  hud: { position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 10, pointerEvents: 'none' },
  hudText: { background: 'rgba(13,17,23,0.7)', color: '#8b949e', fontSize: 12, padding: '4px 14px', borderRadius: 6, fontFamily: "'SF Mono', monospace" },
};

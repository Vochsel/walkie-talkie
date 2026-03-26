'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { ViewProps } from '@/app/page';
import TerminalPopup from '@/components/TerminalPopup';

// ── Block types ─────────────────────────────────────────────────────
type BlockType = 'grass' | 'dirt' | 'stone' | 'wood' | 'leaves' | 'sand' | 'glass' | 'terminal';

const BLOCK_COLORS: Record<BlockType, { color: number; emissive?: number; emissiveIntensity?: number; opacity?: number }> = {
  grass:    { color: 0x4a8c3f },
  dirt:     { color: 0x8b6b4a },
  stone:    { color: 0x888888 },
  wood:     { color: 0x6b4226 },
  leaves:   { color: 0x2d6b1e, opacity: 0.9 },
  sand:     { color: 0xdbc67b },
  glass:    { color: 0xaaddff, opacity: 0.35 },
  terminal: { color: 0x00d4aa, emissive: 0x00d4aa, emissiveIntensity: 0.45 },
};

// Grass has special top face
const GRASS_TOP_COLOR = 0x5aad4e;
const GRASS_SIDE_COLOR = 0x8b6b4a;

const HOTBAR_BLOCKS: BlockType[] = ['grass', 'dirt', 'stone', 'wood', 'leaves', 'sand', 'glass', 'terminal'];

const BLOCK_LABELS: Record<BlockType, string> = {
  grass: 'Grass', dirt: 'Dirt', stone: 'Stone', wood: 'Wood',
  leaves: 'Leaves', sand: 'Sand', glass: 'Glass', terminal: 'Terminal',
};

const WORLD_SIZE = 32;

// ── Physics constants ───────────────────────────────────────────────
const GRAVITY = -25;
const JUMP_VELOCITY = 9;
const PLAYER_HEIGHT = 1.62;   // eye height
const PLAYER_WIDTH = 0.6;     // hitbox width
const PLAYER_BODY_HEIGHT = 1.8;
const MOVE_SPEED = 5.5;
const MAX_FALL_SPEED = -40;

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

class VoxelWorld {
  blocks = new Map<string, BlockType>();

  set(x: number, y: number, z: number, type: BlockType) {
    this.blocks.set(posKey(x, y, z), type);
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
}

function generateWorld(): VoxelWorld {
  const world = new VoxelWorld();
  const rng = mulberry32(42);

  // Height map with simple noise
  const heightMap: number[][] = [];
  for (let x = 0; x < WORLD_SIZE; x++) {
    heightMap[x] = [];
    for (let z = 0; z < WORLD_SIZE; z++) {
      // Simple rolling hills
      const h = Math.floor(
        2 + Math.sin(x * 0.15) * 1.5 + Math.cos(z * 0.12) * 1.5 +
        Math.sin((x + z) * 0.08) * 2
      );
      heightMap[x][z] = Math.max(1, h);
    }
  }

  for (let x = 0; x < WORLD_SIZE; x++) {
    for (let z = 0; z < WORLD_SIZE; z++) {
      const h = heightMap[x][z];
      // Bedrock / dirt layers
      for (let y = 0; y < h; y++) {
        world.set(x, y, z, y === h - 1 ? 'grass' : (y < h - 3 ? 'stone' : 'dirt'));
      }

      // Scatter stones on surface
      if (rng() < 0.04) {
        world.set(x, h, z, 'stone');
      }

      // Trees
      if (rng() < 0.025) {
        const trunkHeight = 3 + Math.floor(rng() * 3);
        for (let y = h; y < h + trunkHeight; y++) {
          world.set(x, y, z, 'wood');
        }
        const leafBase = h + trunkHeight - 1;
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

      // Small sand patches
      if (rng() < 0.02) {
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            const sx = x + dx, sz = z + dz;
            if (sx >= 0 && sx < WORLD_SIZE && sz >= 0 && sz < WORLD_SIZE && rng() > 0.3) {
              const sh = heightMap[sx]?.[sz] ?? 1;
              world.set(sx, sh - 1, sz, 'sand');
            }
          }
        }
      }
    }
  }

  return world;
}

// ── Material cache ──────────────────────────────────────────────────
function createMaterials(): Map<BlockType, THREE.Material | THREE.Material[]> {
  const mats = new Map<BlockType, THREE.Material | THREE.Material[]>();

  // Grass: multi-material (top green, sides brown)
  const grassSide = new THREE.MeshLambertMaterial({ color: GRASS_SIDE_COLOR });
  const grassTop = new THREE.MeshLambertMaterial({ color: GRASS_TOP_COLOR });
  const grassBottom = new THREE.MeshLambertMaterial({ color: GRASS_SIDE_COLOR });
  mats.set('grass', [grassSide, grassSide, grassTop, grassBottom, grassSide, grassSide]);

  for (const [type, cfg] of Object.entries(BLOCK_COLORS)) {
    if (type === 'grass') continue;
    const opts: THREE.MeshLambertMaterialParameters = { color: cfg.color };
    if (cfg.emissive !== undefined) { opts.emissive = cfg.emissive; opts.emissiveIntensity = cfg.emissiveIntensity; }
    if (cfg.opacity !== undefined) { opts.transparent = true; opts.opacity = cfg.opacity; }
    mats.set(type as BlockType, new THREE.MeshLambertMaterial(opts));
  }

  return mats;
}

// ── Build meshes from world ─────────────────────────────────────────
function buildWorldMeshes(
  world: VoxelWorld,
  materials: Map<BlockType, THREE.Material | THREE.Material[]>,
): THREE.Object3D[] {
  const groups = world.grouped();
  const meshes: THREE.Object3D[] = [];
  const geo = new THREE.BoxGeometry(1, 1, 1);

  for (const [type, positions] of groups) {
    if (positions.length === 0) continue;
    const mat = materials.get(type)!;
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
function checkCollisionAxis(
  world: VoxelWorld,
  pos: THREE.Vector3,
  velocity: THREE.Vector3,
  axis: 'x' | 'y' | 'z',
  dt: number,
  halfW: number,
  bodyH: number,
  eyeH: number,
): { newPos: number; newVel: number; grounded: boolean } {
  const newVal = pos[axis] + velocity[axis] * dt;
  let grounded = false;

  // Compute AABB of player at new position
  const testPos = pos.clone();
  if (axis === 'y') {
    // Y is the eye position, bottom of player is y - eyeH, top is y - eyeH + bodyH
    testPos.y = newVal;
  } else {
    testPos[axis] = newVal;
  }

  const bottom = testPos.y - eyeH;
  const top = bottom + bodyH;
  const minX = testPos.x - halfW;
  const maxX = testPos.x + halfW;
  const minZ = testPos.z - halfW;
  const maxZ = testPos.z + halfW;

  // Check all blocks the AABB overlaps
  const bMinX = Math.floor(minX);
  const bMaxX = Math.floor(maxX);
  const bMinY = Math.floor(bottom);
  const bMaxY = Math.floor(top);
  const bMinZ = Math.floor(minZ);
  const bMaxZ = Math.floor(maxZ);

  for (let bx = bMinX; bx <= bMaxX; bx++) {
    for (let by = bMinY; by <= bMaxY; by++) {
      for (let bz = bMinZ; bz <= bMaxZ; bz++) {
        if (!world.isSolid(bx, by, bz)) continue;

        // Block AABB: [bx, bx+1] x [by, by+1] x [bz, bz+1]
        if (maxX > bx && minX < bx + 1 &&
            top > by && bottom < by + 1 &&
            maxZ > bz && minZ < bz + 1) {
          // Collision on this axis
          if (axis === 'y') {
            if (velocity.y < 0) {
              // Landing on top of block
              grounded = true;
              return { newPos: by + 1 + eyeH, newVel: 0, grounded };
            } else {
              // Hitting ceiling
              return { newPos: by - bodyH + eyeH, newVel: 0, grounded };
            }
          } else {
            return { newPos: pos[axis], newVel: 0, grounded };
          }
        }
      }
    }
  }

  return { newPos: newVal, newVel: velocity[axis], grounded };
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
  const [selectedSlot, setSelectedSlot] = useState(0);

  // Refs for game state (avoid re-renders)
  const worldRef = useRef<VoxelWorld | null>(null);
  const sceneObjsRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    animId: number;
    worldMeshes: THREE.Object3D[];
    materials: Map<BlockType, THREE.Material | THREE.Material[]>;
    raycaster: THREE.Raycaster;
    highlightMesh: THREE.Mesh;
  } | null>(null);

  const keysRef = useRef<Set<string>>(new Set());
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const playerPosRef = useRef(new THREE.Vector3(WORLD_SIZE / 2, 20, WORLD_SIZE / 2));
  const velocityRef = useRef(new THREE.Vector3(0, 0, 0));
  const onGroundRef = useRef(false);
  const selectedSlotRef = useRef(0);
  const meshDirtyRef = useRef(false);

  // Terminal block tracking
  const terminalPositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const posToTerminalRef = useRef<Map<string, string>>(new Map());
  const pendingPlacementRef = useRef<THREE.Vector3 | null>(null);

  // Keep selectedSlotRef in sync
  useEffect(() => { selectedSlotRef.current = selectedSlot; }, [selectedSlot]);

  const rebuildMeshes = useCallback(() => {
    const s = sceneObjsRef.current;
    const world = worldRef.current;
    if (!s || !world) return;

    // Remove old meshes
    for (const m of s.worldMeshes) {
      s.scene.remove(m);
      if (m instanceof THREE.InstancedMesh) {
        m.geometry.dispose();
      }
    }

    // Build new
    s.worldMeshes = buildWorldMeshes(world, s.materials);
    for (const m of s.worldMeshes) s.scene.add(m);
  }, []);

  // ── Scene setup ───────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.018);

    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 120);
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
    worldRef.current = world;

    const materials = createMaterials();
    const worldMeshes = buildWorldMeshes(world, materials);
    for (const m of worldMeshes) scene.add(m);

    // Block highlight wireframe
    const highlightGeo = new THREE.BoxGeometry(1.005, 1.005, 1.005);
    const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.5 });
    const highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
    highlightMesh.visible = false;
    scene.add(highlightMesh);

    const raycaster = new THREE.Raycaster();
    raycaster.far = 8;

    const state = { renderer, scene, camera, animId: 0, worldMeshes, materials, raycaster, highlightMesh };
    sceneObjsRef.current = state;

    // ── Pointer lock ────────────────────────────────────────────────
    const canvas = renderer.domElement;
    const onPointerLockChange = () => setIsLocked(document.pointerLockElement === canvas);
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
      // Prevent page scroll on WASD/space when locked
      if (document.pointerLockElement === canvas) {
        if (['w', 'a', 's', 'd', ' ', 'shift'].includes(k)) e.preventDefault();
      }
      // Hotbar selection with number keys
      const num = parseInt(e.key);
      if (num >= 1 && num <= HOTBAR_BLOCKS.length) {
        setSelectedSlot(num - 1);
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
      const intersects = raycaster.intersectObjects(state.worldMeshes, false);
      if (intersects.length === 0) return null;

      const hit = intersects[0];
      if (!hit.face) return null;

      let hitPos: THREE.Vector3;
      if (hit.object instanceof THREE.InstancedMesh && hit.instanceId !== undefined) {
        const matrix = new THREE.Matrix4();
        hit.object.getMatrixAt(hit.instanceId, matrix);
        hitPos = new THREE.Vector3().setFromMatrixPosition(matrix);
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

      if (e.button === 0) {
        // Left click: BREAK block
        const { blockPos, blockType, terminalId } = hit;
        if (blockPos.y === 0 && blockType !== 'terminal') return; // don't break bottom layer

        // If it's a terminal block, kill the terminal
        if (blockType === 'terminal' && terminalId) {
          killTerminal(terminalId);
          const key = posKey(blockPos.x, blockPos.y, blockPos.z);
          posToTerminalRef.current.delete(key);
          terminalPositionsRef.current.delete(terminalId);
        }

        world.delete(blockPos.x, blockPos.y, blockPos.z);
        meshDirtyRef.current = true;

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
        if (placePos.y < 0) return;
        if (world.has(placePos.x, placePos.y, placePos.z)) return;

        // Player collision check
        const pBottom = playerPosRef.current.y - PLAYER_HEIGHT;
        const pTop = pBottom + PLAYER_BODY_HEIGHT;
        const hw = PLAYER_WIDTH / 2;
        if (placePos.x + 1 > playerPosRef.current.x - hw && placePos.x < playerPosRef.current.x + hw &&
            placePos.y + 1 > pBottom && placePos.y < pTop &&
            placePos.z + 1 > playerPosRef.current.z - hw && placePos.z < playerPosRef.current.z + hw) {
          return; // would be inside player
        }

        const selectedBlock = HOTBAR_BLOCKS[selectedSlotRef.current];
        world.set(placePos.x, placePos.y, placePos.z, selectedBlock);
        meshDirtyRef.current = true;

        // If placing a terminal block, create a terminal
        if (selectedBlock === 'terminal') {
          pendingPlacementRef.current = placePos.clone();
          createTerminal(80, 24);
        }
      }
    };
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

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
        // Movement input
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yawRef.current);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yawRef.current);

        const wishDir = new THREE.Vector3(0, 0, 0);
        const keys = keysRef.current;
        if (keys.has('w')) wishDir.add(forward);
        if (keys.has('s')) wishDir.sub(forward);
        if (keys.has('a')) wishDir.sub(right);
        if (keys.has('d')) wishDir.add(right);
        if (wishDir.lengthSq() > 0) wishDir.normalize();

        velocityRef.current.x = wishDir.x * MOVE_SPEED;
        velocityRef.current.z = wishDir.z * MOVE_SPEED;

        // Jump
        if (keys.has(' ') && onGroundRef.current) {
          velocityRef.current.y = JUMP_VELOCITY;
          onGroundRef.current = false;
        }

        // Gravity
        velocityRef.current.y += GRAVITY * dt;
        if (velocityRef.current.y < MAX_FALL_SPEED) velocityRef.current.y = MAX_FALL_SPEED;

        // Resolve collisions axis by axis (Y first for landing, then X, then Z)
        const vel = velocityRef.current;
        const pos = playerPosRef.current;
        const hw = PLAYER_WIDTH / 2;

        const yResult = checkCollisionAxis(world, pos, vel, 'y', dt, hw, PLAYER_BODY_HEIGHT, PLAYER_HEIGHT);
        pos.y = yResult.newPos;
        vel.y = yResult.newVel;
        if (yResult.grounded) onGroundRef.current = true;
        else if (vel.y !== 0) onGroundRef.current = false;

        const xResult = checkCollisionAxis(world, pos, vel, 'x', dt, hw, PLAYER_BODY_HEIGHT, PLAYER_HEIGHT);
        pos.x = xResult.newPos;
        vel.x = xResult.newVel;

        const zResult = checkCollisionAxis(world, pos, vel, 'z', dt, hw, PLAYER_BODY_HEIGHT, PLAYER_HEIGHT);
        pos.z = zResult.newPos;
        vel.z = zResult.newVel;

        // Safety: don't fall into the void
        if (pos.y < -10) {
          pos.set(WORLD_SIZE / 2, 15, WORLD_SIZE / 2);
          vel.set(0, 0, 0);
        }
      }

      // Update camera
      camera.position.copy(playerPosRef.current);
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
          if (m instanceof THREE.InstancedMesh) m.geometry.dispose();
        }
        state.worldMeshes = buildWorldMeshes(world, materials);
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
          world.delete(pos.x, pos.y, pos.z);
          posToTerminalRef.current.delete(posKey(pos.x, pos.y, pos.z));
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
                // Find top
                for (let y = 10; y >= 0; y--) {
                  if (world.has(px, y, pz) && !world.has(px, y + 1, pz)) {
                    const pos = new THREE.Vector3(px, y + 1, pz);
                    world.set(px, y + 1, pz, 'terminal');
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
  }, [terminals]);

  const closePopup = useCallback(() => setPopupTerminalId(null), []);

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
          {HOTBAR_BLOCKS.map((type, i) => (
            <div
              key={type}
              style={{
                ...styles.hotbarSlot,
                ...(i === selectedSlot ? styles.hotbarSlotActive : {}),
              }}
              onMouseDown={(e) => { e.stopPropagation(); setSelectedSlot(i); }}
            >
              <div style={{
                ...styles.hotbarBlock,
                background: `#${BLOCK_COLORS[type].color.toString(16).padStart(6, '0')}`,
                ...(type === 'glass' ? { opacity: 0.5 } : {}),
                ...(type === 'terminal' ? { boxShadow: '0 0 8px #00d4aa' } : {}),
              }} />
              <span style={styles.hotbarLabel}>{BLOCK_LABELS[type]}</span>
              <span style={styles.hotbarKey}>{i + 1}</span>
            </div>
          ))}
        </div>
      )}

      {/* Instructions */}
      {!isLocked && !popupTerminalId && (
        <div style={styles.instructions}>
          <div style={styles.instructionsBox}>
            <div style={styles.instructionsTitle}>Minecraft Terminal World</div>
            <div style={styles.instructionsText}>Click to start</div>
            <div style={styles.instructionsKeys}>
              <span><b>WASD</b> move &nbsp; <b>Space</b> jump &nbsp; <b>Mouse</b> look</span>
              <span><b>Left click</b> break block &nbsp; <b>Right click</b> place block</span>
              <span><b>Right click terminal</b> to open &nbsp; <b>1-8</b> / <b>scroll</b> select block</span>
              <span><b>ESC</b> release cursor</span>
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

      {/* Terminal popup */}
      {popupTerminalId && terminals.find(t => t.id === popupTerminalId) && (
        <TerminalPopup
          terminalId={popupTerminalId}
          onInput={(data) => sendInput(popupTerminalId, data)}
          onResize={(cols, rows) => resizeTerminal(popupTerminalId, cols, rows)}
          registerOutput={(handler) => registerOutputHandler(popupTerminalId, handler)}
          onClose={closePopup}
          title={`Terminal [${popupTerminalId.slice(0, 8)}]`}
        />
      )}
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
    position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
    display: 'flex', gap: 3, padding: 4, background: 'rgba(0,0,0,0.65)', borderRadius: 8,
    border: '2px solid rgba(255,255,255,0.15)',
  },
  hotbarSlot: {
    width: 52, height: 52, display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    justifyContent: 'center', borderRadius: 6, border: '2px solid transparent',
    cursor: 'pointer', position: 'relative' as const, transition: 'border-color 0.1s',
  },
  hotbarSlotActive: {
    borderColor: '#fff', background: 'rgba(255,255,255,0.12)',
  },
  hotbarBlock: {
    width: 28, height: 28, borderRadius: 4, border: '1px solid rgba(255,255,255,0.2)',
  },
  hotbarLabel: {
    fontSize: 8, color: '#ccc', marginTop: 2, fontFamily: "'SF Mono', monospace",
    textTransform: 'uppercase' as const, letterSpacing: 0.5,
  },
  hotbarKey: {
    position: 'absolute' as const, top: 2, right: 4, fontSize: 9, color: 'rgba(255,255,255,0.4)',
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

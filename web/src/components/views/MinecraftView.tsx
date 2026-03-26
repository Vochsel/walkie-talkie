'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { ViewProps } from '@/app/page';
import TerminalPopup from '@/components/TerminalPopup';

// ── Block type constants ──────────────────────────────────────────────
const WORLD_SIZE = 32;

const COLORS = {
  grassTop: 0x4a8c3f,
  grassSide: 0x8b6b4a,
  stone: 0x888888,
  wood: 0x6b4226,
  leaves: 0x2d6b1e,
  terminal: 0x00d4aa,
};

// ── Seeded RNG for deterministic world gen ────────────────────────────
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Build materials for each block type ───────────────────────────────
function makeGrassMaterials(): THREE.Material[] {
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z
  const side = new THREE.MeshLambertMaterial({ color: COLORS.grassSide });
  const top = new THREE.MeshLambertMaterial({ color: COLORS.grassTop });
  const bottom = new THREE.MeshLambertMaterial({ color: COLORS.grassSide });
  return [side, side, top, bottom, side, side];
}

function makeStoneMaterial(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color: COLORS.stone });
}

function makeWoodMaterial(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color: COLORS.wood });
}

function makeLeavesMaterial(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color: COLORS.leaves, transparent: true, opacity: 0.9 });
}

function makeTerminalMaterial(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    color: COLORS.terminal,
    emissive: COLORS.terminal,
    emissiveIntensity: 0.45,
  });
}

// ── World generation ──────────────────────────────────────────────────
interface WorldBlocks {
  grass: THREE.Vector3[];
  stone: THREE.Vector3[];
  wood: THREE.Vector3[];
  leaves: THREE.Vector3[];
}

function generateWorld(): WorldBlocks {
  const rng = mulberry32(42);
  const grass: THREE.Vector3[] = [];
  const stone: THREE.Vector3[] = [];
  const wood: THREE.Vector3[] = [];
  const leaves: THREE.Vector3[] = [];

  for (let x = 0; x < WORLD_SIZE; x++) {
    for (let z = 0; z < WORLD_SIZE; z++) {
      // Ground layer
      grass.push(new THREE.Vector3(x, 0, z));

      // Scatter some stone on the ground
      if (rng() < 0.06) {
        stone.push(new THREE.Vector3(x, 1, z));
      }

      // Trees
      if (rng() < 0.035) {
        const trunkHeight = 3 + Math.floor(rng() * 3); // 3-5
        for (let y = 1; y <= trunkHeight; y++) {
          wood.push(new THREE.Vector3(x, y, z));
        }
        // Leaf canopy
        const leafBase = trunkHeight;
        for (let lx = -2; lx <= 2; lx++) {
          for (let lz = -2; lz <= 2; lz++) {
            for (let ly = 0; ly <= 2; ly++) {
              const px = x + lx;
              const pz = z + lz;
              if (px < 0 || px >= WORLD_SIZE || pz < 0 || pz >= WORLD_SIZE) continue;
              const dist = Math.abs(lx) + Math.abs(lz) + ly;
              if (dist <= 3 && rng() > 0.15) {
                leaves.push(new THREE.Vector3(px, leafBase + ly, pz));
              }
            }
          }
        }
      }
    }
  }

  return { grass, stone, wood, leaves };
}

// ── Create InstancedMesh from position list ───────────────────────────
function createInstancedMesh(
  positions: THREE.Vector3[],
  material: THREE.Material | THREE.Material[],
): THREE.InstancedMesh {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(geo, material, positions.length);
  const dummy = new THREE.Object3D();
  positions.forEach((pos, i) => {
    dummy.position.copy(pos);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ── Component ─────────────────────────────────────────────────────────
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
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    animId: number;
    terminalMeshes: Map<string, THREE.Mesh>;
    raycaster: THREE.Raycaster;
    groundMesh: THREE.InstancedMesh;
    allMeshes: THREE.Object3D[];
  } | null>(null);

  // Maps terminal IDs to world positions
  const terminalPositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());
  // Reverse: position key -> terminal ID
  const posToTerminalRef = useRef<Map<string, string>>(new Map());

  const [popupTerminalId, setPopupTerminalId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  // Track keys for movement
  const keysRef = useRef<Set<string>>(new Set());

  // Camera rotation
  const yawRef = useRef(0);
  const pitchRef = useRef(0);

  // Player position (eye position)
  const playerPosRef = useRef(new THREE.Vector3(WORLD_SIZE / 2, 3, WORLD_SIZE / 2));

  // Occupied positions for collision
  const occupiedRef = useRef<Set<string>>(new Set());

  const posKey = (x: number, y: number, z: number) => `${x},${y},${z}`;

  // Place terminal blocks for existing terminals that don't have positions yet
  const syncTerminalBlocks = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const existingIds = new Set(terminalPositionsRef.current.keys());
    const currentIds = new Set(terminals.map(t => t.id));

    // Remove blocks for terminals that no longer exist
    for (const id of existingIds) {
      if (!currentIds.has(id)) {
        const mesh = scene.terminalMeshes.get(id);
        if (mesh) {
          scene.scene.remove(mesh);
          mesh.geometry.dispose();
          scene.terminalMeshes.delete(id);
          const idx = scene.allMeshes.indexOf(mesh);
          if (idx >= 0) scene.allMeshes.splice(idx, 1);
        }
        const pos = terminalPositionsRef.current.get(id);
        if (pos) {
          const key = posKey(pos.x, pos.y, pos.z);
          posToTerminalRef.current.delete(key);
          occupiedRef.current.delete(key);
        }
        terminalPositionsRef.current.delete(id);
      }
    }

    // Place blocks for new terminals that don't have positions yet
    for (const t of terminals) {
      if (!terminalPositionsRef.current.has(t.id)) {
        // Find a free spot near the center
        const cx = Math.floor(WORLD_SIZE / 2);
        const cz = Math.floor(WORLD_SIZE / 2);
        let placed = false;
        for (let r = 1; r < WORLD_SIZE && !placed; r++) {
          for (let dx = -r; dx <= r && !placed; dx++) {
            for (let dz = -r; dz <= r && !placed; dz++) {
              if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
              const px = cx + dx;
              const pz = cz + dz;
              if (px < 0 || px >= WORLD_SIZE || pz < 0 || pz >= WORLD_SIZE) continue;
              const key = posKey(px, 1, pz);
              if (!occupiedRef.current.has(key)) {
                addTerminalBlock(t.id, new THREE.Vector3(px, 1, pz));
                placed = true;
              }
            }
          }
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminals]);

  const addTerminalBlock = useCallback((terminalId: string, pos: THREE.Vector3) => {
    const scene = sceneRef.current;
    if (!scene) return;

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = makeTerminalMaterial();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.userData = { terminalId };
    scene.scene.add(mesh);
    scene.terminalMeshes.set(terminalId, mesh);
    scene.allMeshes.push(mesh);

    terminalPositionsRef.current.set(terminalId, pos.clone());
    const key = posKey(pos.x, pos.y, pos.z);
    posToTerminalRef.current.set(key, terminalId);
    occupiedRef.current.add(key);
  }, []);

  // ── Three.js scene setup ────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 30, 60);

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      100,
    );
    camera.position.copy(playerPosRef.current);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 40;
    dirLight.shadow.camera.bottom = -40;
    dirLight.shadow.camera.far = 100;
    scene.add(dirLight);

    // Hemisphere light for sky/ground color bleed
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x4a8c3f, 0.3);
    scene.add(hemiLight);

    // Generate world
    const world = generateWorld();

    // Track occupied positions
    const occupied = occupiedRef.current;
    occupied.clear();
    for (const pos of world.grass) occupied.add(posKey(pos.x, pos.y, pos.z));
    for (const pos of world.stone) occupied.add(posKey(pos.x, pos.y, pos.z));
    for (const pos of world.wood) occupied.add(posKey(pos.x, pos.y, pos.z));
    for (const pos of world.leaves) occupied.add(posKey(pos.x, pos.y, pos.z));

    // Build instanced meshes
    const grassMesh = createInstancedMesh(world.grass, makeGrassMaterials());
    const stoneMesh = createInstancedMesh(world.stone, makeStoneMaterial());
    const woodMesh = createInstancedMesh(world.wood, makeWoodMaterial());
    const leavesMesh = createInstancedMesh(world.leaves, makeLeavesMaterial());

    scene.add(grassMesh);
    scene.add(stoneMesh);
    scene.add(woodMesh);
    scene.add(leavesMesh);

    // Collect all meshes for raycasting
    const allMeshes: THREE.Object3D[] = [grassMesh, stoneMesh, woodMesh, leavesMesh];

    const raycaster = new THREE.Raycaster();
    raycaster.far = 12;

    const terminalMeshes = new Map<string, THREE.Mesh>();

    const sceneState = {
      renderer,
      scene,
      camera,
      animId: 0,
      terminalMeshes,
      raycaster,
      groundMesh: grassMesh,
      allMeshes,
    };
    sceneRef.current = sceneState;

    // ── Pointer lock ──────────────────────────────────────────────────
    const canvas = renderer.domElement;

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      setIsLocked(locked);
    };

    document.addEventListener('pointerlockchange', onPointerLockChange);

    const requestLock = () => {
      if (!popupTerminalId && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    };
    canvas.addEventListener('click', requestLock);

    // ── Mouse look ────────────────────────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      const sensitivity = 0.002;
      yawRef.current -= e.movementX * sensitivity;
      pitchRef.current -= e.movementY * sensitivity;
      pitchRef.current = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitchRef.current));
    };
    document.addEventListener('mousemove', onMouseMove);

    // ── Key handling ──────────────────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // ── Click to place terminal / right-click to open ─────────────────
    const screenCenter = new THREE.Vector2(0, 0);

    const onMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;

      raycaster.setFromCamera(screenCenter, camera);
      const intersects = raycaster.intersectObjects(sceneState.allMeshes, false);

      if (e.button === 0) {
        // Left click: place terminal block on top of whatever we hit
        if (intersects.length > 0) {
          const hit = intersects[0];
          if (!hit.face) return;

          // Compute the block position above the hit face
          const normal = hit.face.normal.clone();
          let hitPos: THREE.Vector3;

          if (hit.object instanceof THREE.InstancedMesh && hit.instanceId !== undefined) {
            const matrix = new THREE.Matrix4();
            hit.object.getMatrixAt(hit.instanceId, matrix);
            hitPos = new THREE.Vector3().setFromMatrixPosition(matrix);
          } else {
            hitPos = hit.object.position.clone();
          }

          const placePos = hitPos.clone().add(normal).round();

          // Don't place at y=0 (ground level) or below
          if (placePos.y < 1) return;

          const key = posKey(placePos.x, placePos.y, placePos.z);
          if (occupied.has(key)) return;

          // Check if it's a terminal block being clicked on
          if (hit.object.userData?.terminalId) return;

          // Create a new terminal
          createTerminal(80, 24);

          // We'll place the block when the terminal shows up in props via syncTerminalBlocks,
          // but we want to place it at the clicked location. We store a pending position.
          pendingPlacementRef.current = placePos.clone();
        }
      } else if (e.button === 2) {
        // Right click: open terminal if we hit a terminal block
        if (intersects.length > 0) {
          const hit = intersects[0];
          const obj = hit.object;
          if (obj.userData?.terminalId) {
            const tid = obj.userData.terminalId as string;
            document.exitPointerLock();
            setPopupTerminalId(tid);
            setActiveTerminalId(tid);
          }
        }
      }
    };

    canvas.addEventListener('mousedown', onMouseDown);

    // Prevent context menu
    const onContextMenu = (e: Event) => {
      e.preventDefault();
    };
    canvas.addEventListener('contextmenu', onContextMenu);

    // ── Resize ────────────────────────────────────────────────────────
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // ── Animation loop ────────────────────────────────────────────────
    const clock = new THREE.Clock();

    const animate = () => {
      sceneState.animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // FPS movement
      if (document.pointerLockElement === canvas) {
        const speed = 6 * delta;
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), yawRef.current);
        const right = new THREE.Vector3(1, 0, 0);
        right.applyAxisAngle(new THREE.Vector3(0, 1, 0), yawRef.current);

        const keys = keysRef.current;
        if (keys.has('w')) playerPosRef.current.add(forward.clone().multiplyScalar(speed));
        if (keys.has('s')) playerPosRef.current.add(forward.clone().multiplyScalar(-speed));
        if (keys.has('a')) playerPosRef.current.add(right.clone().multiplyScalar(-speed));
        if (keys.has('d')) playerPosRef.current.add(right.clone().multiplyScalar(speed));
        if (keys.has(' ')) playerPosRef.current.y += speed;
        if (keys.has('shift')) playerPosRef.current.y -= speed;

        // Keep above ground
        if (playerPosRef.current.y < 2.5) playerPosRef.current.y = 2.5;
      }

      // Update camera
      camera.position.copy(playerPosRef.current);
      const euler = new THREE.Euler(pitchRef.current, yawRef.current, 0, 'YXZ');
      camera.quaternion.setFromEuler(euler);

      // Animate terminal blocks (gentle bob + glow pulse)
      const time = clock.elapsedTime;
      sceneState.terminalMeshes.forEach((mesh) => {
        const baseY = mesh.userData.baseY ?? mesh.position.y;
        mesh.userData.baseY = baseY;
        mesh.position.y = baseY + Math.sin(time * 2) * 0.08;
        const mat = mesh.material as THREE.MeshLambertMaterial;
        mat.emissiveIntensity = 0.35 + Math.sin(time * 3) * 0.15;
      });

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(sceneState.animId);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('click', requestLock);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('contextmenu', onContextMenu);

      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }

      // Dispose Three.js resources
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pending placement for newly created terminals ───────────────────
  const pendingPlacementRef = useRef<THREE.Vector3 | null>(null);

  // Sync terminal blocks when terminals change
  useEffect(() => {
    if (!sceneRef.current) return;

    // If we have a pending placement and a new terminal appeared, use that position
    const existingIds = new Set(terminalPositionsRef.current.keys());
    for (const t of terminals) {
      if (!existingIds.has(t.id) && pendingPlacementRef.current) {
        addTerminalBlock(t.id, pendingPlacementRef.current);
        pendingPlacementRef.current = null;
        return;
      }
    }

    // Otherwise run the general sync
    syncTerminalBlocks();
  }, [terminals, syncTerminalBlocks, addTerminalBlock]);

  // ── Close popup ─────────────────────────────────────────────────────
  const closePopup = useCallback(() => {
    setPopupTerminalId(null);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div style={styles.wrapper}>
      {/* Three.js container */}
      <div ref={containerRef} style={styles.canvas} />

      {/* Crosshair */}
      {isLocked && (
        <div style={styles.crosshair}>
          <div style={styles.crosshairH} />
          <div style={styles.crosshairV} />
        </div>
      )}

      {/* Instructions */}
      {!isLocked && !popupTerminalId && (
        <div style={styles.instructions}>
          <div style={styles.instructionsBox}>
            <div style={styles.instructionsTitle}>Minecraft Terminal World</div>
            <div style={styles.instructionsText}>Click to start</div>
            <div style={styles.instructionsKeys}>
              <span><b>WASD</b> to move</span>
              <span><b>Mouse</b> to look</span>
              <span><b>Space/Shift</b> to fly up/down</span>
              <span><b>Click</b> to place terminal</span>
              <span><b>Right-click</b> terminal to open</span>
              <span><b>ESC</b> to release cursor</span>
            </div>
          </div>
        </div>
      )}

      {/* HUD info */}
      {isLocked && (
        <div style={styles.hud}>
          <span style={styles.hudText}>
            Terminals: {terminals.length} | Click to place | Right-click to open
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

// ── Styles ────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    background: '#000',
  },
  canvas: {
    width: '100%',
    height: '100%',
  },
  crosshair: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    zIndex: 10,
  },
  crosshairH: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 20,
    height: 2,
    background: 'rgba(255,255,255,0.8)',
    borderRadius: 1,
    boxShadow: '0 0 4px rgba(0,0,0,0.5)',
  },
  crosshairV: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 2,
    height: 20,
    background: 'rgba(255,255,255,0.8)',
    borderRadius: 1,
    boxShadow: '0 0 4px rgba(0,0,0,0.5)',
  },
  instructions: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.45)',
    zIndex: 20,
    pointerEvents: 'none',
  },
  instructionsBox: {
    background: 'rgba(13, 17, 23, 0.92)',
    border: '1px solid #30363d',
    borderRadius: 12,
    padding: '28px 40px',
    textAlign: 'center' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
    pointerEvents: 'auto' as const,
  },
  instructionsTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: '#00d4aa',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    letterSpacing: 1,
  },
  instructionsText: {
    fontSize: 15,
    color: '#8b949e',
  },
  instructionsKeys: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    fontSize: 13,
    color: '#c9d1d9',
    marginTop: 8,
  },
  hud: {
    position: 'absolute',
    bottom: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
    pointerEvents: 'none',
  },
  hudText: {
    background: 'rgba(13, 17, 23, 0.7)',
    color: '#8b949e',
    fontSize: 12,
    padding: '4px 14px',
    borderRadius: 6,
    fontFamily: "'SF Mono', monospace",
  },
};

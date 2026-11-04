import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { resolveMoveFromSurfaceDrag } from '../controls/dragMath';
import { COLOR_HEX_MAP, FACE_NORMALS } from '../core/constants';
import type { CubeEngine } from '../core/CubeEngine';
import type {
  Coordinate,
  CubeColor,
  CubieState,
  FaceName,
  MoveDefinition,
  MoveNotation,
  Vec3Int,
} from '../core/types';

interface QueuedAnimation {
  def: MoveDefinition;
  durationMs: number;
  resolve: () => void;
}

export class CubeScene3D {
  private readonly container: HTMLElement;
  private readonly engine: CubeEngine;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly cubeRoot = new THREE.Group();
  private readonly pivotGroup = new THREE.Group();
  private readonly cubieGroups = new Map<string, THREE.Group>();
  private readonly stickerMeshes: THREE.Object3D[] = [];

  private animationQueue: QueuedAnimation[] = [];
  private activeAnimation: {
    item: QueuedAnimation;
    affectedGroups: THREE.Group[];
    axisVector: THREE.Vector3;
    targetAngleRad: number;
    startTime: number;
  } | null = null;

  private baseAnimationDurationMs = 190;
  private rafId: number | null = null;

  // Pointer drag state for direct 3D face manipulation
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  private activeDrag: {
    pointerId: number;
    cubiePosition: Vec3Int;
    faceNormal: Vec3Int;
    startPointWorld: THREE.Vector3;
    dragPlane: THREE.Plane;
    moveTriggered: boolean;
  } | null = null;

  private onUserMoveTrigger?: (notation: MoveNotation) => void;

  constructor(
    container: HTMLElement,
    engine: CubeEngine,
    onUserMoveTrigger?: (notation: MoveNotation) => void
  ) {
    this.container = container;
    this.engine = engine;
    this.onUserMoveTrigger = onUserMoveTrigger;

    this.scene = new THREE.Scene();

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 320);

    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    this.camera.position.set(5.4, 4.4, 6.2);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 4.5;
    this.controls.maxDistance = 14;
    this.controls.target.set(0, 0, 0);

    this.setupLighting();
    this.scene.add(this.cubeRoot);
    this.cubeRoot.add(this.pivotGroup);

    this.rebuildCubiesFromEngine();
    this.bindEvents();
    this.startRenderLoop();
  }

  private setupLighting(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 1.35);
    this.scene.add(ambient);

    const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0x1e293b, 0.9);
    hemiLight.position.set(0, 12, 0);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.9);
    keyLight.position.set(8, 14, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.85);
    fillLight.position.set(-9, -6, -8);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xfde047, 0.45);
    rimLight.position.set(0, -10, 8);
    this.scene.add(rimLight);

    // Subtle shadow catcher / studio pedestal glow below the cube
    const shadowPlaneGeo = new THREE.PlaneGeometry(18, 18);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.22 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -2.65;
    shadowPlane.receiveShadow = true;
    this.scene.add(shadowPlane);
  }

  /**
   * Rebuilds the 26 3D cubie meshes to match the current logical state of the CubeEngine.
   */
  public rebuildCubiesFromEngine(): void {
    // Clear any in-flight animations
    this.animationQueue = [];
    this.activeAnimation = null;
    this.pivotGroup.rotation.set(0, 0, 0);

    for (const group of this.cubieGroups.values()) {
      this.cubeRoot.remove(group);
      this.pivotGroup.remove(group);
    }
    this.cubieGroups.clear();
    this.stickerMeshes.length = 0;

    const bodyGeo = new RoundedBoxGeometry(0.95, 0.95, 0.95, 4, 0.085);
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x111827,
      roughness: 0.28,
      metalness: 0.12,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
    });

    const stickerGeo = new RoundedBoxGeometry(0.81, 0.81, 0.04, 3, 0.045);

    const cubies = this.engine.getCubies();
    for (const cubie of cubies) {
      const group = this.createCubieMeshGroup(cubie, bodyGeo, bodyMat, stickerGeo);
      this.cubieGroups.set(cubie.id, group);
      this.cubeRoot.add(group);
    }
  }

  private createCubieMeshGroup(
    cubie: CubieState,
    bodyGeo: THREE.BufferGeometry,
    bodyMat: THREE.Material,
    stickerGeo: THREE.BufferGeometry
  ): THREE.Group {
    const group = new THREE.Group();
    group.position.set(cubie.position.x, cubie.position.y, cubie.position.z);
    group.userData = { cubieId: cubie.id };

    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    bodyMesh.userData = { cubieGroup: group };
    group.add(bodyMesh);
    this.stickerMeshes.push(bodyMesh);

    const offset = 0.468;
    for (const [faceKey, color] of Object.entries(cubie.stickers) as [FaceName, CubeColor][]) {
      const normal = FACE_NORMALS[faceKey];
      const stickerMat = new THREE.MeshPhysicalMaterial({
        color: COLOR_HEX_MAP[color],
        roughness: 0.16,
        metalness: 0.03,
        clearcoat: 0.92,
        clearcoatRoughness: 0.08,
      });

      const stickerMesh = new THREE.Mesh(stickerGeo, stickerMat);
      stickerMesh.position.set(normal.x * offset, normal.y * offset, normal.z * offset);

      // Orient the sticker plate so its local Z axis aligns with the face normal
      if (normal.y === 1) {
        stickerMesh.rotation.x = -Math.PI / 2;
      } else if (normal.y === -1) {
        stickerMesh.rotation.x = Math.PI / 2;
      } else if (normal.x === 1) {
        stickerMesh.rotation.y = Math.PI / 2;
      } else if (normal.x === -1) {
        stickerMesh.rotation.y = -Math.PI / 2;
      } else if (normal.z === -1) {
        stickerMesh.rotation.y = Math.PI;
      }

      stickerMesh.userData = {
        isSticker: true,
        faceKey,
        cubieGroup: group,
      };
      group.add(stickerMesh);
      this.stickerMeshes.push(stickerMesh);
    }

    return group;
  }

  public setAnimationSpeedMs(durationMs: number): void {
    this.baseAnimationDurationMs = Math.max(0, Math.min(durationMs, 1000));
  }

  public getAnimationSpeedMs(): number {
    return this.baseAnimationDurationMs;
  }

  public resetCamera(): void {
    this.camera.position.set(5.4, 4.4, 6.2);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  /**
   * Enqueues a 3D layer rotation animation for the given MoveDefinition.
   */
  public enqueueMoveAnimation(def: MoveDefinition, customDurationMs?: number): Promise<void> {
    const durationMs = customDurationMs ?? this.baseAnimationDurationMs;
    return new Promise<void>((resolve) => {
      this.animationQueue.push({ def, durationMs, resolve });
      this.processNextAnimationIfIdle();
    });
  }

  private processNextAnimationIfIdle(): void {
    if (this.activeAnimation || this.animationQueue.length === 0) {
      return;
    }

    const nextItem = this.animationQueue.shift()!;
    const { def, durationMs } = nextItem;

    const affectedGroups: THREE.Group[] = [];
    for (const group of this.cubieGroups.values()) {
      const coord = Math.round(group.position[def.axis]) as Coordinate;
      if (coord === def.layer) {
        affectedGroups.push(group);
      }
    }

    this.pivotGroup.rotation.set(0, 0, 0);
    this.pivotGroup.position.set(0, 0, 0);
    this.pivotGroup.updateMatrixWorld();

    for (const group of affectedGroups) {
      this.pivotGroup.attach(group);
    }

    const axisVector = new THREE.Vector3(
      def.axis === 'x' ? 1 : 0,
      def.axis === 'y' ? 1 : 0,
      def.axis === 'z' ? 1 : 0
    );
    const targetAngleRad = def.quarterTurns * (Math.PI / 2);

    if (durationMs <= 5) {
      this.finishActiveAnimationImmediate(affectedGroups, axisVector, targetAngleRad, nextItem);
      return;
    }

    this.activeAnimation = {
      item: nextItem,
      affectedGroups,
      axisVector,
      targetAngleRad,
      startTime: performance.now(),
    };
  }

  private finishActiveAnimationImmediate(
    affectedGroups: THREE.Group[],
    axisVector: THREE.Vector3,
    targetAngleRad: number,
    item: QueuedAnimation
  ): void {
    this.pivotGroup.setRotationFromAxisAngle(axisVector, targetAngleRad);
    this.pivotGroup.updateMatrixWorld(true);

    for (const group of affectedGroups) {
      this.cubeRoot.attach(group);
      // Snap positions and rotations to clean integer / 90-degree multiples to avoid float drift
      group.position.set(
        Math.round(group.position.x),
        Math.round(group.position.y),
        Math.round(group.position.z)
      );
      const euler = new THREE.Euler().setFromQuaternion(group.quaternion);
      const halfPi = Math.PI / 2;
      euler.x = Math.round(euler.x / halfPi) * halfPi;
      euler.y = Math.round(euler.y / halfPi) * halfPi;
      euler.z = Math.round(euler.z / halfPi) * halfPi;
      group.quaternion.setFromEuler(euler);
      group.updateMatrixWorld();
    }

    this.pivotGroup.rotation.set(0, 0, 0);
    this.activeAnimation = null;
    item.resolve();
    this.processNextAnimationIfIdle();
  }

  private bindEvents(): void {
    const dom = this.renderer.domElement;

    const updateNdc = (clientX: number, clientY: number) => {
      const rect = dom.getBoundingClientRect();
      this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || this.activeAnimation) return;

      updateNdc(e.clientX, e.clientY);
      this.raycaster.setFromCamera(this.pointerNdc, this.camera);

      const intersects = this.raycaster.intersectObjects(this.stickerMeshes, false);
      if (intersects.length === 0) return;

      const hit = intersects[0];
      const cubieGroup = hit.object.userData.cubieGroup as THREE.Group | undefined;
      if (!cubieGroup || !hit.face) return;

      // Determine world normal of the clicked face and snap to nearest principal axis
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
      const worldNormal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();

      const snappedNormal = this.snapToPrincipalAxis(worldNormal);
      const cubiePos: Vec3Int = {
        x: Math.round(cubieGroup.position.x) as Coordinate,
        y: Math.round(cubieGroup.position.y) as Coordinate,
        z: Math.round(cubieGroup.position.z) as Coordinate,
      };

      const planeNormal = new THREE.Vector3(snappedNormal.x, snappedNormal.y, snappedNormal.z);
      const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, hit.point);

      this.controls.enabled = false;
      this.activeDrag = {
        pointerId: e.pointerId,
        cubiePosition: cubiePos,
        faceNormal: snappedNormal,
        startPointWorld: hit.point.clone(),
        dragPlane,
        moveTriggered: false,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!this.activeDrag || this.activeDrag.moveTriggered) return;

      updateNdc(e.clientX, e.clientY);
      this.raycaster.setFromCamera(this.pointerNdc, this.camera);

      const currentWorldPoint = new THREE.Vector3();
      const intersected = this.raycaster.ray.intersectPlane(
        this.activeDrag.dragPlane,
        currentWorldPoint
      );
      if (!intersected) return;

      const deltaWorld = currentWorldPoint.sub(this.activeDrag.startPointWorld);
      if (deltaWorld.length() < 0.24) return;

      const moveDef = resolveMoveFromSurfaceDrag(
        this.activeDrag.faceNormal,
        this.activeDrag.cubiePosition,
        deltaWorld
      );

      if (moveDef) {
        this.activeDrag.moveTriggered = true;
        this.onUserMoveTrigger?.(moveDef.notation);
      }
    };

    const endDrag = () => {
      if (this.activeDrag) {
        this.activeDrag = null;
        this.controls.enabled = true;
      }
    };

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    const onResize = () => {
      const w = Math.max(this.container.clientWidth, 280);
      const h = Math.max(this.container.clientHeight, 280);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);
  }

  private snapToPrincipalAxis(v: THREE.Vector3): Vec3Int {
    const ax = Math.abs(v.x);
    const ay = Math.abs(v.y);
    const az = Math.abs(v.z);
    if (ax >= ay && ax >= az) {
      return { x: (v.x >= 0 ? 1 : -1) as Coordinate, y: 0, z: 0 };
    }
    if (ay >= ax && ay >= az) {
      return { x: 0, y: (v.y >= 0 ? 1 : -1) as Coordinate, z: 0 };
    }
    return { x: 0, y: 0, z: (v.z >= 0 ? 1 : -1) as Coordinate };
  }

  private startRenderLoop(): void {
    const tick = (now: number) => {
      this.rafId = requestAnimationFrame(tick);

      if (this.activeAnimation) {
        const { item, affectedGroups, axisVector, targetAngleRad, startTime } =
          this.activeAnimation;
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / Math.max(1, item.durationMs));
        // Cubic ease-out
        const eased = 1 - Math.pow(1 - t, 3);
        this.pivotGroup.setRotationFromAxisAngle(axisVector, targetAngleRad * eased);

        if (t >= 1) {
          this.finishActiveAnimationImmediate(affectedGroups, axisVector, targetAngleRad, item);
        }
      }

      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  public dispose(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    this.controls.dispose();
    this.renderer.dispose();
  }
}

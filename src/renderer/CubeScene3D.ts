import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CubeEngine } from '../core/CubeEngine';
import type { Coordinate, MoveDefinition, MoveNotation } from '../core/types';
import { buildCubieMeshGroup, createCubeGeometriesAndMaterials } from './CubieMeshFactory';
import { bindPointerDragEvents } from './PointerDragHandler';
import { setupSceneLighting } from './SceneLighting';

interface QueuedAnimation {
  def: MoveDefinition;
  durationMs: number;
  resolve: () => void;
}

export class CubeScene3D {
  private readonly container: HTMLElement;
  private readonly engine: CubeEngine;
  private readonly scene = new THREE.Scene();
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

  constructor(
    container: HTMLElement,
    engine: CubeEngine,
    onUserMoveTrigger?: (notation: MoveNotation) => void
  ) {
    this.container = container;
    this.engine = engine;

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

    setupSceneLighting(this.scene);
    this.scene.add(this.cubeRoot);
    this.cubeRoot.add(this.pivotGroup);

    this.rebuildCubiesFromEngine();

    bindPointerDragEvents({
      domElement: this.renderer.domElement,
      camera: this.camera,
      controls: this.controls,
      stickerMeshes: this.stickerMeshes,
      isAnimating: () => this.activeAnimation !== null,
      onMoveTrigger: onUserMoveTrigger,
    });

    window.addEventListener('resize', () => {
      const w = Math.max(this.container.clientWidth, 280);
      const h = Math.max(this.container.clientHeight, 280);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });

    this.startRenderLoop();
  }

  public rebuildCubiesFromEngine(): void {
    this.animationQueue = [];
    this.activeAnimation = null;
    this.pivotGroup.rotation.set(0, 0, 0);

    for (const group of this.cubieGroups.values()) {
      this.cubeRoot.remove(group);
      this.pivotGroup.remove(group);
    }
    this.cubieGroups.clear();
    this.stickerMeshes.length = 0;

    const { bodyGeo, bodyMat, stickerGeo } = createCubeGeometriesAndMaterials();
    for (const cubie of this.engine.getCubies()) {
      const group = buildCubieMeshGroup(cubie, bodyGeo, bodyMat, stickerGeo, this.stickerMeshes);
      this.cubieGroups.set(cubie.id, group);
      this.cubeRoot.add(group);
    }
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

  public enqueueMoveAnimation(def: MoveDefinition, customDurationMs?: number): Promise<void> {
    const durationMs = customDurationMs ?? this.baseAnimationDurationMs;
    return new Promise<void>((resolve) => {
      this.animationQueue.push({ def, durationMs, resolve });
      this.processNextAnimationIfIdle();
    });
  }

  private processNextAnimationIfIdle(): void {
    if (this.activeAnimation || this.animationQueue.length === 0) return;

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

    const halfPi = Math.PI / 2;
    for (const group of affectedGroups) {
      this.cubeRoot.attach(group);
      group.position.set(
        Math.round(group.position.x),
        Math.round(group.position.y),
        Math.round(group.position.z)
      );
      const euler = new THREE.Euler().setFromQuaternion(group.quaternion);
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

  private startRenderLoop(): void {
    const tick = (now: number) => {
      this.rafId = requestAnimationFrame(tick);

      if (this.activeAnimation) {
        const { item, affectedGroups, axisVector, targetAngleRad, startTime } =
          this.activeAnimation;
        const t = Math.min(1, (now - startTime) / Math.max(1, item.durationMs));
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

import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { resolveMoveFromSurfaceDrag } from '../controls/dragMath';
import type { Coordinate, MoveNotation, Vec3Int } from '../core/types';

function snapToPrincipalAxis(v: THREE.Vector3): Vec3Int {
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

export function bindPointerDragEvents(params: {
  domElement: HTMLElement;
  camera: THREE.Camera;
  controls: OrbitControls;
  stickerMeshes: THREE.Object3D[];
  isAnimating: () => boolean;
  onMoveTrigger?: (notation: MoveNotation) => void;
}): void {
  const { domElement, camera, controls, stickerMeshes, isAnimating, onMoveTrigger } = params;
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();

  let activeDrag: {
    pointerId: number;
    pointerType: string;
    cubiePosition: Vec3Int;
    faceNormal: Vec3Int;
    startPointWorld: THREE.Vector3;
    dragPlane: THREE.Plane;
    moveTriggered: boolean;
  } | null = null;
  const activePointerIds = new Set<number>();

  const releaseDragPointerCapture = (pointerId: number) => {
    try {
      if (domElement.hasPointerCapture?.(pointerId)) {
        domElement.releasePointerCapture(pointerId);
      }
    } catch {
      // Ignore if pointer capture is unavailable in synthetic test environments
    }
  };

  const cancelActiveDrag = () => {
    if (activeDrag) {
      releaseDragPointerCapture(activeDrag.pointerId);
      activeDrag = null;
      controls.enabled = true;
    }
  };

  const updateNdc = (clientX: number, clientY: number) => {
    const rect = domElement.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  };

  const onPointerDown = (e: PointerEvent) => {
    activePointerIds.add(e.pointerId);

    // If a second finger touches the screen (e.g., pinch-zoom), cancel any single-sticker drag
    if (activePointerIds.size > 1) {
      cancelActiveDrag();
      return;
    }

    if (e.button !== 0 || isAnimating()) return;

    updateNdc(e.clientX, e.clientY);
    raycaster.setFromCamera(pointerNdc, camera);

    const intersects = raycaster.intersectObjects(stickerMeshes, false);
    if (intersects.length === 0) return;

    const hit = intersects[0];
    const cubieGroup = hit.object.userData.cubieGroup as THREE.Group | undefined;
    if (!cubieGroup || !hit.face) return;

    const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
    const worldNormal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();

    const snappedNormal = snapToPrincipalAxis(worldNormal);
    const cubiePos: Vec3Int = {
      x: Math.round(cubieGroup.position.x) as Coordinate,
      y: Math.round(cubieGroup.position.y) as Coordinate,
      z: Math.round(cubieGroup.position.z) as Coordinate,
    };

    const planeNormal = new THREE.Vector3(snappedNormal.x, snappedNormal.y, snappedNormal.z);
    const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, hit.point);

    controls.enabled = false;
    try {
      domElement.setPointerCapture?.(e.pointerId);
    } catch {
      // Ignore if pointer capture is unsupported
    }
    activeDrag = {
      pointerId: e.pointerId,
      pointerType: e.pointerType || 'mouse',
      cubiePosition: cubiePos,
      faceNormal: snappedNormal,
      startPointWorld: hit.point.clone(),
      dragPlane,
      moveTriggered: false,
    };
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!activeDrag || activeDrag.moveTriggered || e.pointerId !== activeDrag.pointerId) return;

    updateNdc(e.clientX, e.clientY);
    raycaster.setFromCamera(pointerNdc, camera);

    const currentWorldPoint = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(activeDrag.dragPlane, currentWorldPoint)) return;

    const deltaWorld = currentWorldPoint.sub(activeDrag.startPointWorld);
    const minDragDistance = activeDrag.pointerType === 'touch' ? 0.18 : 0.24;
    if (deltaWorld.length() < minDragDistance) return;

    const moveDef = resolveMoveFromSurfaceDrag(
      activeDrag.faceNormal,
      activeDrag.cubiePosition,
      deltaWorld
    );

    if (moveDef) {
      activeDrag.moveTriggered = true;
      onMoveTrigger?.(moveDef.notation);
    }
  };

  const endDrag = (e: PointerEvent) => {
    activePointerIds.delete(e.pointerId);
    if (activeDrag && e.pointerId === activeDrag.pointerId) {
      cancelActiveDrag();
    }
  };

  domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
}

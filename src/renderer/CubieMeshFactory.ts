import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { COLOR_HEX_MAP, FACE_NORMALS } from '../core/constants';
import type { CubeColor, CubieState, FaceName } from '../core/types';

export function buildCubieMeshGroup(
  cubie: CubieState,
  bodyGeo: THREE.BufferGeometry,
  bodyMat: THREE.Material,
  stickerGeo: THREE.BufferGeometry,
  stickerMeshes: THREE.Object3D[]
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(cubie.position.x, cubie.position.y, cubie.position.z);
  group.userData = { cubieId: cubie.id };

  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyMesh.userData = { cubieGroup: group };
  group.add(bodyMesh);
  stickerMeshes.push(bodyMesh);

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
    stickerMeshes.push(stickerMesh);
  }

  return group;
}

export function createCubeGeometriesAndMaterials(): {
  bodyGeo: THREE.BufferGeometry;
  bodyMat: THREE.Material;
  stickerGeo: THREE.BufferGeometry;
} {
  const bodyGeo = new RoundedBoxGeometry(0.95, 0.95, 0.95, 4, 0.085);
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x111827,
    roughness: 0.28,
    metalness: 0.12,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
  });
  const stickerGeo = new RoundedBoxGeometry(0.81, 0.81, 0.04, 3, 0.045);

  return { bodyGeo, bodyMat, stickerGeo };
}

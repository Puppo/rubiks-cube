import { MOVE_DEFINITIONS } from '../core/constants';
import type { AxisName, Coordinate, MoveDefinition, Vec3Int } from '../core/types';

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

/**
 * Given the clicked face's outward normal `faceNormal` (one of ±X, ±Y, ±Z),
 * the clicked cubie's integer position `cubiePosition` in {-1, 0, 1}^3,
 * and a 3D world drag vector `worldDragVector` along the clicked face plane,
 * resolves the exact Rubik's Cube MoveDefinition triggered by the drag.
 *
 * Uses the rigid-body cross product identity: omega = faceNormal x tangentDirection.
 */
export function resolveMoveFromSurfaceDrag(
  faceNormal: Vec3Int,
  cubiePosition: Vec3Int,
  worldDragVector: Vector3Like
): MoveDefinition | null {
  // Project worldDragVector onto the plane perpendicular to faceNormal
  const dot =
    worldDragVector.x * faceNormal.x +
    worldDragVector.y * faceNormal.y +
    worldDragVector.z * faceNormal.z;

  const tx = worldDragVector.x - dot * faceNormal.x;
  const ty = worldDragVector.y - dot * faceNormal.y;
  const tz = worldDragVector.z - dot * faceNormal.z;

  const absX = Math.abs(tx);
  const absY = Math.abs(ty);
  const absZ = Math.abs(tz);

  const maxMag = Math.max(absX, absY, absZ);
  if (maxMag < 1e-5) {
    return null;
  }

  // Unit tangent direction along the dominant principal axis
  const u: Vec3Int = { x: 0, y: 0, z: 0 };
  if (absX >= absY && absX >= absZ) {
    u.x = (tx > 0 ? 1 : -1) as Coordinate;
  } else if (absY >= absX && absY >= absZ) {
    u.y = (ty > 0 ? 1 : -1) as Coordinate;
  } else {
    u.z = (tz > 0 ? 1 : -1) as Coordinate;
  }

  // Cross product: omega = faceNormal x u
  const omega: Vec3Int = {
    x: (faceNormal.y * u.z - faceNormal.z * u.y) as Coordinate,
    y: (faceNormal.z * u.x - faceNormal.x * u.z) as Coordinate,
    z: (faceNormal.x * u.y - faceNormal.y * u.x) as Coordinate,
  };

  let axis: AxisName;
  let quarterTurns: -1 | 1;

  if (omega.x !== 0) {
    axis = 'x';
    quarterTurns = omega.x as -1 | 1;
  } else if (omega.y !== 0) {
    axis = 'y';
    quarterTurns = omega.y as -1 | 1;
  } else if (omega.z !== 0) {
    axis = 'z';
    quarterTurns = omega.z as -1 | 1;
  } else {
    return null;
  }

  const layer = cubiePosition[axis];

  const found = Object.values(MOVE_DEFINITIONS).find(
    (def) => def.axis === axis && def.layer === layer && def.quarterTurns === quarterTurns
  );

  return found ?? null;
}

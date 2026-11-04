import { FACE_DEFAULT_COLORS, FACE_NORMALS } from './constants';
import type {
  AxisName,
  Coordinate,
  CubeColor,
  CubeFacesSnapshot,
  CubieState,
  CubieStickerMap,
  FaceGrid,
  FaceName,
  MoveDefinition,
  Vec3Int,
} from './types';

export const ALL_FACES_ORDER: FaceName[] = ['U', 'R', 'F', 'D', 'L', 'B'];

export function rotateVec3Int(v: Vec3Int, axis: AxisName, quarterTurns: -1 | 1 | 2): Vec3Int {
  const { x, y, z } = v;
  if (quarterTurns === 2) {
    if (axis === 'x') return { x, y: (-y || 0) as Coordinate, z: (-z || 0) as Coordinate };
    if (axis === 'y') return { x: (-x || 0) as Coordinate, y, z: (-z || 0) as Coordinate };
    return { x: (-x || 0) as Coordinate, y: (-y || 0) as Coordinate, z };
  }

  if (quarterTurns === 1) {
    if (axis === 'x') return { x, y: (-z || 0) as Coordinate, z: y };
    if (axis === 'y') return { x: z, y, z: (-x || 0) as Coordinate };
    return { x: (-y || 0) as Coordinate, y: x, z };
  }

  if (axis === 'x') return { x, y: z, z: (-y || 0) as Coordinate };
  if (axis === 'y') return { x: (-z || 0) as Coordinate, y, z: x };
  return { x: y, y: (-x || 0) as Coordinate, z };
}

export function normalToFace(n: Vec3Int): FaceName {
  if (n.y === 1) return 'U';
  if (n.y === -1) return 'D';
  if (n.x === 1) return 'R';
  if (n.x === -1) return 'L';
  if (n.z === 1) return 'F';
  if (n.z === -1) return 'B';
  throw new Error(`Invalid face normal: (${n.x}, ${n.y}, ${n.z})`);
}

export function createSolvedCubies(): CubieState[] {
  const coords: Coordinate[] = [-1, 0, 1];
  const cubies: CubieState[] = [];

  for (const x of coords) {
    for (const y of coords) {
      for (const z of coords) {
        if (x === 0 && y === 0 && z === 0) continue;
        const stickers: CubieStickerMap = {};
        if (y === 1) stickers.U = FACE_DEFAULT_COLORS.U;
        if (y === -1) stickers.D = FACE_DEFAULT_COLORS.D;
        if (x === 1) stickers.R = FACE_DEFAULT_COLORS.R;
        if (x === -1) stickers.L = FACE_DEFAULT_COLORS.L;
        if (z === 1) stickers.F = FACE_DEFAULT_COLORS.F;
        if (z === -1) stickers.B = FACE_DEFAULT_COLORS.B;

        cubies.push({
          id: `${x},${y},${z}`,
          homePosition: { x, y, z },
          position: { x, y, z },
          stickers,
        });
      }
    }
  }
  return cubies;
}

export function applyMoveToCubies(cubies: CubieState[], def: MoveDefinition): void {
  for (const cubie of cubies) {
    if (cubie.position[def.axis] !== def.layer) continue;

    cubie.position = rotateVec3Int(cubie.position, def.axis, def.quarterTurns);

    const nextStickers: CubieStickerMap = {};
    for (const [faceKey, color] of Object.entries(cubie.stickers) as [FaceName, CubeColor][]) {
      const currentNormal = FACE_NORMALS[faceKey];
      const rotatedNormal = rotateVec3Int(currentNormal, def.axis, def.quarterTurns);
      nextStickers[normalToFace(rotatedNormal)] = color;
    }
    cubie.stickers = nextStickers;
  }
}

export function computeFacesSnapshot(cubies: CubieState[]): CubeFacesSnapshot {
  const createGrid = (c: CubeColor): FaceGrid => [
    [c, c, c],
    [c, c, c],
    [c, c, c],
  ];

  const faces: CubeFacesSnapshot = {
    U: createGrid('W'),
    D: createGrid('Y'),
    L: createGrid('O'),
    R: createGrid('R'),
    F: createGrid('G'),
    B: createGrid('B'),
  };

  for (const cubie of cubies) {
    const { x, y, z } = cubie.position;
    if (y === 1 && cubie.stickers.U) faces.U[z + 1][x + 1] = cubie.stickers.U;
    if (y === -1 && cubie.stickers.D) faces.D[1 - z][x + 1] = cubie.stickers.D;
    if (z === 1 && cubie.stickers.F) faces.F[1 - y][x + 1] = cubie.stickers.F;
    if (z === -1 && cubie.stickers.B) faces.B[1 - y][1 - x] = cubie.stickers.B;
    if (x === 1 && cubie.stickers.R) faces.R[1 - y][1 - z] = cubie.stickers.R;
    if (x === -1 && cubie.stickers.L) faces.L[1 - y][z + 1] = cubie.stickers.L;
  }

  return faces;
}

export function formatAsciiDiagram(f: CubeFacesSnapshot): string {
  const rowStr = (grid: FaceGrid, r: number) => grid[r].join(' ');
  return [
    `        ${rowStr(f.U, 0)}`,
    `        ${rowStr(f.U, 1)}`,
    `        ${rowStr(f.U, 2)}`,
    `${rowStr(f.L, 0)} | ${rowStr(f.F, 0)} | ${rowStr(f.R, 0)} | ${rowStr(f.B, 0)}`,
    `${rowStr(f.L, 1)} | ${rowStr(f.F, 1)} | ${rowStr(f.R, 1)} | ${rowStr(f.B, 1)}`,
    `${rowStr(f.L, 2)} | ${rowStr(f.F, 2)} | ${rowStr(f.R, 2)} | ${rowStr(f.B, 2)}`,
    `        ${rowStr(f.D, 0)}`,
    `        ${rowStr(f.D, 1)}`,
    `        ${rowStr(f.D, 2)}`,
  ].join('\n');
}

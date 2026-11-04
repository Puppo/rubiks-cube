export type FaceName = 'U' | 'D' | 'L' | 'R' | 'F' | 'B';

export type CubeColor = 'W' | 'Y' | 'O' | 'R' | 'G' | 'B';

export type BaseMove = 'U' | 'D' | 'L' | 'R' | 'F' | 'B' | 'M' | 'E' | 'S';

export type MoveModifier = '' | "'" | '2';

export type MoveNotation = `${BaseMove}${MoveModifier}`;

export type AxisName = 'x' | 'y' | 'z';

export type Coordinate = -1 | 0 | 1;

export interface Vec3Int {
  x: Coordinate;
  y: Coordinate;
  z: Coordinate;
}

export interface MoveDefinition {
  notation: MoveNotation;
  base: BaseMove;
  modifier: MoveModifier;
  axis: AxisName;
  /** Which layer along the axis (-1, 0, or 1) */
  layer: Coordinate;
  /**
   * Number of 90-degree quarter turns around the positive axis (+1 = +90 deg, -1 = -90 deg, 2 = 180 deg)
   * following the right-hand rule in standard 3D coordinates (+X Right, +Y Up, +Z Front).
   */
  quarterTurns: -1 | 1 | 2;
}

export type DifficultyLevel = 'beginner' | 'easy' | 'medium' | 'hard' | 'expert';

export interface DifficultyConfig {
  id: DifficultyLevel;
  label: string;
  description: string;
  scrambleLength: number;
  allowHints: boolean;
  allowAutoSolve: boolean;
}

export interface CubieStickerMap {
  U?: CubeColor;
  D?: CubeColor;
  L?: CubeColor;
  R?: CubeColor;
  F?: CubeColor;
  B?: CubeColor;
}

export interface CubieState {
  /** Stable identifier based on solved home coordinates, e.g. "1,1,1" */
  id: string;
  /** Solved home position */
  homePosition: Vec3Int;
  /** Current position in {-1, 0, 1}^3 */
  position: Vec3Int;
  /** Current outward face colors */
  stickers: CubieStickerMap;
}

export type FaceGrid = [
  [CubeColor, CubeColor, CubeColor],
  [CubeColor, CubeColor, CubeColor],
  [CubeColor, CubeColor, CubeColor],
];

export type CubeFacesSnapshot = Record<FaceName, FaceGrid>;

export interface CubeSerializedState {
  isSolved: boolean;
  faceletString: string;
  faces: CubeFacesSnapshot;
  moveCount: number;
  moveHistory: MoveNotation[];
  redoStack: MoveNotation[];
  scrambleSequence: MoveNotation[];
  difficulty: DifficultyLevel;
  elapsedMs: number;
}

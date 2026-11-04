import type {
  BaseMove,
  CubeColor,
  DifficultyConfig,
  DifficultyLevel,
  FaceName,
  MoveDefinition,
  MoveModifier,
  MoveNotation,
  Vec3Int,
} from './types';

export const FACE_DEFAULT_COLORS: Record<FaceName, CubeColor> = {
  U: 'W',
  D: 'Y',
  L: 'O',
  R: 'R',
  F: 'G',
  B: 'B',
};

export const COLOR_HEX_MAP: Record<CubeColor, number> = {
  W: 0xf8fafc,
  Y: 0xfacc15,
  O: 0xff6b00,
  R: 0xdc2626,
  G: 0x16a34a,
  B: 0x2563eb,
};

export const COLOR_CSS_MAP: Record<CubeColor, string> = {
  W: '#f8fafc',
  Y: '#facc15',
  O: '#ff6b00',
  R: '#dc2626',
  G: '#16a34a',
  B: '#2563eb',
};

export const COLOR_NAMES: Record<CubeColor, string> = {
  W: 'White',
  Y: 'Yellow',
  O: 'Orange',
  R: 'Red',
  G: 'Green',
  B: 'Blue',
};

export const FACE_NORMALS: Record<FaceName, Vec3Int> = {
  U: { x: 0, y: 1, z: 0 },
  D: { x: 0, y: -1, z: 0 },
  R: { x: 1, y: 0, z: 0 },
  L: { x: -1, y: 0, z: 0 },
  F: { x: 0, y: 0, z: 1 },
  B: { x: 0, y: 0, z: -1 },
};

export const DIFFICULTY_CONFIGS: Record<DifficultyLevel, DifficultyConfig> = {
  beginner: {
    id: 'beginner',
    label: 'Beginner (4 moves)',
    description: 'Gentle 4-move scramble with step-by-step hints and solver enabled.',
    scrambleLength: 4,
    allowHints: true,
    allowAutoSolve: true,
  },
  easy: {
    id: 'easy',
    label: 'Easy (8 moves)',
    description: 'Short 8-move scramble ideal for practicing layer recognition.',
    scrambleLength: 8,
    allowHints: true,
    allowAutoSolve: true,
  },
  medium: {
    id: 'medium',
    label: 'Medium (14 moves)',
    description: 'Balanced 14-move scramble requiring multi-step planning.',
    scrambleLength: 14,
    allowHints: true,
    allowAutoSolve: true,
  },
  hard: {
    id: 'hard',
    label: 'Hard (20 moves - WCA)',
    description: 'Standard WCA 20-move random scramble.',
    scrambleLength: 20,
    allowHints: true,
    allowAutoSolve: true,
  },
  expert: {
    id: 'expert',
    label: 'Expert (25 moves - No Hints)',
    description: 'Deep 25-move scramble with hints disabled for pure speedcubing challenge.',
    scrambleLength: 25,
    allowHints: false,
    allowAutoSolve: false,
  },
};

const BASE_MOVE_SPECS: Record<
  BaseMove,
  { axis: 'x' | 'y' | 'z'; layer: -1 | 0 | 1; cwQuarterTurns: -1 | 1 }
> = {
  U: { axis: 'y', layer: 1, cwQuarterTurns: -1 },
  D: { axis: 'y', layer: -1, cwQuarterTurns: 1 },
  R: { axis: 'x', layer: 1, cwQuarterTurns: -1 },
  L: { axis: 'x', layer: -1, cwQuarterTurns: 1 },
  F: { axis: 'z', layer: 1, cwQuarterTurns: -1 },
  B: { axis: 'z', layer: -1, cwQuarterTurns: 1 },
  M: { axis: 'x', layer: 0, cwQuarterTurns: 1 },
  E: { axis: 'y', layer: 0, cwQuarterTurns: 1 },
  S: { axis: 'z', layer: 0, cwQuarterTurns: -1 },
};

export const ALL_BASE_MOVES: BaseMove[] = ['U', 'D', 'L', 'R', 'F', 'B', 'M', 'E', 'S'];
export const OUTER_FACE_MOVES: BaseMove[] = ['U', 'D', 'L', 'R', 'F', 'B'];

export const MOVE_DEFINITIONS: Record<MoveNotation, MoveDefinition> = (() => {
  const defs = {} as Record<MoveNotation, MoveDefinition>;
  const modifiers: MoveModifier[] = ['', "'", '2'];

  for (const base of ALL_BASE_MOVES) {
    const spec = BASE_MOVE_SPECS[base];
    for (const modifier of modifiers) {
      const notation = `${base}${modifier}` as MoveNotation;
      let quarterTurns: -1 | 1 | 2;
      if (modifier === '') {
        quarterTurns = spec.cwQuarterTurns;
      } else if (modifier === "'") {
        quarterTurns = (spec.cwQuarterTurns * -1) as -1 | 1;
      } else {
        quarterTurns = 2;
      }
      defs[notation] = {
        notation,
        base,
        modifier,
        axis: spec.axis,
        layer: spec.layer,
        quarterTurns,
      };
    }
  }
  return defs;
})();

export {
  invertAlgorithm,
  invertMove,
  isValidMoveNotation,
  parseAlgorithm,
  parseMoveNotation,
  simplifyMoves,
} from './notation';

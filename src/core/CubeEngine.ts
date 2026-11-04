import {
  DIFFICULTY_CONFIGS,
  FACE_DEFAULT_COLORS,
  FACE_NORMALS,
  MOVE_DEFINITIONS,
  OUTER_FACE_MOVES,
  invertAlgorithm,
  invertMove,
  parseAlgorithm,
  parseMoveNotation,
  simplifyMoves,
} from './constants';
import type {
  AxisName,
  BaseMove,
  Coordinate,
  CubeColor,
  CubeFacesSnapshot,
  CubeSerializedState,
  CubieState,
  CubieStickerMap,
  DifficultyLevel,
  FaceGrid,
  FaceName,
  MoveDefinition,
  MoveModifier,
  MoveNotation,
  Vec3Int,
} from './types';

const ALL_FACES: FaceName[] = ['U', 'R', 'F', 'D', 'L', 'B'];

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

  // quarterTurns === -1
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

export type CubeEventListener = (event: {
  type: 'move' | 'scramble' | 'reset' | 'undo' | 'redo' | 'difficulty';
  move?: MoveDefinition;
  moves?: MoveNotation[];
  state: CubeSerializedState;
}) => void;

export class CubeEngine {
  private cubies: CubieState[] = [];
  private moveHistory: MoveNotation[] = [];
  private redoStack: MoveNotation[] = [];
  private scrambleSequence: MoveNotation[] = [];
  /** Moves accumulated since the last solved state (scramble + user moves) */
  private movesFromSolved: MoveNotation[] = [];
  private difficulty: DifficultyLevel = 'medium';
  private startTimeMs: number | null = null;
  private solvedTimeMs: number | null = null;
  private listeners = new Set<CubeEventListener>();

  constructor(initialDifficulty: DifficultyLevel = 'medium') {
    this.difficulty = initialDifficulty;
    this.initSolvedCubies();
  }

  private initSolvedCubies(): void {
    const coords: Coordinate[] = [-1, 0, 1];
    this.cubies = [];

    for (const x of coords) {
      for (const y of coords) {
        for (const z of coords) {
          if (x === 0 && y === 0 && z === 0) continue; // Interior core
          const stickers: CubieStickerMap = {};
          if (y === 1) stickers.U = FACE_DEFAULT_COLORS.U;
          if (y === -1) stickers.D = FACE_DEFAULT_COLORS.D;
          if (x === 1) stickers.R = FACE_DEFAULT_COLORS.R;
          if (x === -1) stickers.L = FACE_DEFAULT_COLORS.L;
          if (z === 1) stickers.F = FACE_DEFAULT_COLORS.F;
          if (z === -1) stickers.B = FACE_DEFAULT_COLORS.B;

          this.cubies.push({
            id: `${x},${y},${z}`,
            homePosition: { x, y, z },
            position: { x, y, z },
            stickers,
          });
        }
      }
    }
  }

  public getCubies(): CubieState[] {
    return this.cubies.map((c) => ({
      id: c.id,
      homePosition: { ...c.homePosition },
      position: { ...c.position },
      stickers: { ...c.stickers },
    }));
  }

  public getCubieAt(x: Coordinate, y: Coordinate, z: Coordinate): CubieState | undefined {
    const found = this.cubies.find(
      (c) => c.position.x === x && c.position.y === y && c.position.z === z
    );
    if (!found) return undefined;
    return {
      id: found.id,
      homePosition: { ...found.homePosition },
      position: { ...found.position },
      stickers: { ...found.stickers },
    };
  }

  private applyMoveDefinitionInternal(def: MoveDefinition): void {
    for (const cubie of this.cubies) {
      if (cubie.position[def.axis] !== def.layer) continue;

      cubie.position = rotateVec3Int(cubie.position, def.axis, def.quarterTurns);

      const nextStickers: CubieStickerMap = {};
      for (const [faceKey, color] of Object.entries(cubie.stickers) as [FaceName, CubeColor][]) {
        const currentNormal = FACE_NORMALS[faceKey];
        const rotatedNormal = rotateVec3Int(currentNormal, def.axis, def.quarterTurns);
        const targetFace = normalToFace(rotatedNormal);
        nextStickers[targetFace] = color;
      }
      cubie.stickers = nextStickers;
    }
  }

  /**
   * Executes a single move in standard notation (e.g. "R", "U'", "F2", "M").
   */
  public move(notationInput: MoveNotation | string, recordHistory = true): MoveDefinition {
    const def = parseMoveNotation(notationInput);

    if (recordHistory && this.startTimeMs === null && this.scrambleSequence.length > 0) {
      this.startTimeMs = Date.now();
    }

    this.applyMoveDefinitionInternal(def);
    this.movesFromSolved = simplifyMoves([...this.movesFromSolved, def.notation]);

    if (recordHistory) {
      this.moveHistory.push(def.notation);
      this.redoStack = [];
      if (this.isSolved()) {
        this.movesFromSolved = [];
        if (this.startTimeMs !== null && this.solvedTimeMs === null) {
          this.solvedTimeMs = Date.now() - this.startTimeMs;
        }
      } else {
        this.solvedTimeMs = null;
      }
      this.emit({ type: 'move', move: def });
    }

    return def;
  }

  /**
   * Executes a space-separated sequence of moves (e.g., "R U R' U'").
   */
  public applyAlgorithm(
    algorithm: string | MoveNotation[],
    recordHistory = true
  ): MoveDefinition[] {
    const notations = typeof algorithm === 'string' ? parseAlgorithm(algorithm) : algorithm;
    return notations.map((n) => this.move(n, recordHistory));
  }

  /**
   * Undoes the last user move if available.
   */
  public undo(): MoveDefinition | null {
    const lastMove = this.moveHistory.pop();
    if (!lastMove) return null;

    const inverse = invertMove(lastMove);
    const def = parseMoveNotation(inverse);
    this.applyMoveDefinitionInternal(def);
    this.movesFromSolved = simplifyMoves([...this.movesFromSolved, def.notation]);
    this.redoStack.push(lastMove);

    this.emit({ type: 'undo', move: def });
    return def;
  }

  /**
   * Redoes the previously undone move if available.
   */
  public redo(): MoveDefinition | null {
    const nextMove = this.redoStack.pop();
    if (!nextMove) return null;

    const def = parseMoveNotation(nextMove);
    this.applyMoveDefinitionInternal(def);
    this.movesFromSolved = simplifyMoves([...this.movesFromSolved, def.notation]);
    this.moveHistory.push(nextMove);

    if (this.isSolved() && this.startTimeMs !== null && this.solvedTimeMs === null) {
      this.solvedTimeMs = Date.now() - this.startTimeMs;
    }

    this.emit({ type: 'redo', move: def });
    return def;
  }

  /**
   * Resets the cube to the solved state.
   */
  public reset(): void {
    this.initSolvedCubies();
    this.moveHistory = [];
    this.redoStack = [];
    this.scrambleSequence = [];
    this.movesFromSolved = [];
    this.startTimeMs = null;
    this.solvedTimeMs = null;
    this.emit({ type: 'reset' });
  }

  public setDifficulty(level: DifficultyLevel): void {
    if (!DIFFICULTY_CONFIGS[level]) {
      throw new Error(`Invalid difficulty level: "${level}"`);
    }
    this.difficulty = level;
    this.emit({ type: 'difficulty' });
  }

  public getDifficulty(): DifficultyLevel {
    return this.difficulty;
  }

  /**
   * Generates a valid WCA-style scramble sequence where consecutive moves never
   * rotate the same face, and opposite parallel faces don't alternate redundantly (e.g. U D U).
   */
  public static generateScrambleSequence(
    length: number,
    rng: () => number = Math.random
  ): MoveNotation[] {
    const modifiers: MoveModifier[] = ['', "'", '2'];
    const oppositeFace: Record<BaseMove, BaseMove> = {
      U: 'D',
      D: 'U',
      L: 'R',
      R: 'L',
      F: 'B',
      B: 'F',
      M: 'R',
      E: 'D',
      S: 'F',
    };

    const sequence: MoveNotation[] = [];
    let prevBase: BaseMove | null = null;
    let secondPrevBase: BaseMove | null = null;

    for (let i = 0; i < length; i++) {
      const candidates = OUTER_FACE_MOVES.filter((face) => {
        if (face === prevBase) return false;
        if (
          prevBase !== null &&
          secondPrevBase !== null &&
          face === secondPrevBase &&
          oppositeFace[face] === prevBase
        ) {
          return false;
        }
        return true;
      });

      const base = candidates[Math.floor(rng() * candidates.length)];
      const mod = modifiers[Math.floor(rng() * modifiers.length)];
      sequence.push(`${base}${mod}`);
      secondPrevBase = prevBase;
      prevBase = base;
    }

    return sequence;
  }

  /**
   * Resets and scrambles the cube according to the specified difficulty or custom length.
   */
  public scramble(options?: {
    difficulty?: DifficultyLevel;
    customLength?: number;
    rng?: () => number;
  }): MoveNotation[] {
    if (options?.difficulty) {
      this.difficulty = options.difficulty;
    }

    const config = DIFFICULTY_CONFIGS[this.difficulty];
    const length = options?.customLength ?? config.scrambleLength;

    this.initSolvedCubies();
    this.moveHistory = [];
    this.redoStack = [];
    this.movesFromSolved = [];

    const sequence = CubeEngine.generateScrambleSequence(length, options?.rng);
    for (const notation of sequence) {
      const def = MOVE_DEFINITIONS[notation];
      this.applyMoveDefinitionInternal(def);
    }

    this.scrambleSequence = [...sequence];
    this.movesFromSolved = simplifyMoves([...sequence]);
    this.startTimeMs = Date.now();
    this.solvedTimeMs = null;

    this.emit({ type: 'scramble', moves: sequence });
    return sequence;
  }

  /**
   * Computes a snapshot of all 6 faces (each a 3x3 grid of colors) viewed directly from outside.
   */
  public getFacesSnapshot(): CubeFacesSnapshot {
    const createEmptyGrid = (fallback: CubeColor): FaceGrid => [
      [fallback, fallback, fallback],
      [fallback, fallback, fallback],
      [fallback, fallback, fallback],
    ];

    const faces: CubeFacesSnapshot = {
      U: createEmptyGrid('W'),
      D: createEmptyGrid('Y'),
      L: createEmptyGrid('O'),
      R: createEmptyGrid('R'),
      F: createEmptyGrid('G'),
      B: createEmptyGrid('B'),
    };

    for (const cubie of this.cubies) {
      const { x, y, z } = cubie.position;
      if (y === 1 && cubie.stickers.U) {
        faces.U[z + 1][x + 1] = cubie.stickers.U;
      }
      if (y === -1 && cubie.stickers.D) {
        faces.D[1 - z][x + 1] = cubie.stickers.D;
      }
      if (z === 1 && cubie.stickers.F) {
        faces.F[1 - y][x + 1] = cubie.stickers.F;
      }
      if (z === -1 && cubie.stickers.B) {
        faces.B[1 - y][1 - x] = cubie.stickers.B;
      }
      if (x === 1 && cubie.stickers.R) {
        faces.R[1 - y][1 - z] = cubie.stickers.R;
      }
      if (x === -1 && cubie.stickers.L) {
        faces.L[1 - y][z + 1] = cubie.stickers.L;
      }
    }

    return faces;
  }

  /**
   * Returns a 54-character facelet string in standard URFDLB order.
   */
  public getFaceletString(): string {
    const faces = this.getFacesSnapshot();
    let result = '';
    for (const faceName of ALL_FACES) {
      const grid = faces[faceName];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          result += grid[r][c];
        }
      }
    }
    return result;
  }

  /**
   * Checks whether every face is uniform in color.
   */
  public isSolved(): boolean {
    const faces = this.getFacesSnapshot();
    for (const faceName of ALL_FACES) {
      const grid = faces[faceName];
      const centerColor = grid[1][1];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if (grid[r][c] !== centerColor) {
            return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * Computes a concise solution sequence from the current state to the solved state.
   * Combines shallow BFS search (for 1-4 move optimal direct solves) with algebraic
   * reduction of the accumulated move path.
   */
  public getSolutionMoves(): MoveNotation[] {
    if (this.isSolved()) return [];

    // First check if there is a 1 to 3 move direct solve using BFS over outer moves
    const shortSolution = this.findShortSolutionBFS(3);
    if (shortSolution) {
      return shortSolution;
    }

    return simplifyMoves(invertAlgorithm(this.movesFromSolved));
  }

  public getNextHint(): MoveNotation | null {
    const solution = this.getSolutionMoves();
    return solution.length > 0 ? solution[0] : null;
  }

  private findShortSolutionBFS(maxDepth: number): MoveNotation[] | null {
    const candidateMoves: MoveNotation[] = [];
    for (const base of OUTER_FACE_MOVES) {
      candidateMoves.push(base, `${base}'` as MoveNotation, `${base}2` as MoveNotation);
    }

    const search = (
      depth: number,
      lastBase: BaseMove | null,
      path: MoveNotation[]
    ): MoveNotation[] | null => {
      if (this.isSolved()) return [...path];
      if (depth === 0) return null;

      for (const move of candidateMoves) {
        const def = MOVE_DEFINITIONS[move];
        if (def.base === lastBase) continue;

        this.applyMoveDefinitionInternal(def);
        path.push(move);

        const found = search(depth - 1, def.base, path);
        if (found) {
          // Restore before returning
          const invDef = MOVE_DEFINITIONS[invertMove(move)];
          this.applyMoveDefinitionInternal(invDef);
          path.pop();
          return found;
        }

        path.pop();
        const invDef = MOVE_DEFINITIONS[invertMove(move)];
        this.applyMoveDefinitionInternal(invDef);
      }

      return null;
    };

    for (let d = 1; d <= maxDepth; d++) {
      const res = search(d, null, []);
      if (res) return res;
    }
    return null;
  }

  public getElapsedMs(): number {
    if (this.solvedTimeMs !== null) return this.solvedTimeMs;
    if (this.startTimeMs !== null) return Date.now() - this.startTimeMs;
    return 0;
  }

  public getState(): CubeSerializedState {
    return {
      isSolved: this.isSolved(),
      faceletString: this.getFaceletString(),
      faces: this.getFacesSnapshot(),
      moveCount: this.moveHistory.length,
      moveHistory: [...this.moveHistory],
      redoStack: [...this.redoStack],
      scrambleSequence: [...this.scrambleSequence],
      difficulty: this.difficulty,
      elapsedMs: this.getElapsedMs(),
    };
  }

  /**
   * Renders a human- and LLM-readable ASCII net of the cube's 6 faces.
   */
  public toAsciiDiagram(): string {
    const f = this.getFacesSnapshot();
    const rowStr = (grid: FaceGrid, r: number) => grid[r].join(' ');
    const lines = [
      `        ${rowStr(f.U, 0)}`,
      `        ${rowStr(f.U, 1)}`,
      `        ${rowStr(f.U, 2)}`,
      `${rowStr(f.L, 0)} | ${rowStr(f.F, 0)} | ${rowStr(f.R, 0)} | ${rowStr(f.B, 0)}`,
      `${rowStr(f.L, 1)} | ${rowStr(f.F, 1)} | ${rowStr(f.R, 1)} | ${rowStr(f.B, 1)}`,
      `${rowStr(f.L, 2)} | ${rowStr(f.F, 2)} | ${rowStr(f.R, 2)} | ${rowStr(f.B, 2)}`,
      `        ${rowStr(f.D, 0)}`,
      `        ${rowStr(f.D, 1)}`,
      `        ${rowStr(f.D, 2)}`,
    ];
    return lines.join('\n');
  }

  public subscribe(listener: CubeEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: {
    type: 'move' | 'scramble' | 'reset' | 'undo' | 'redo' | 'difficulty';
    move?: MoveDefinition;
    moves?: MoveNotation[];
  }): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener({ ...event, state });
    }
  }
}

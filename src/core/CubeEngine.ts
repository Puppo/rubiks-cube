import { DIFFICULTY_CONFIGS, MOVE_DEFINITIONS } from './constants';
import {
  ALL_FACES_ORDER,
  applyMoveToCubies,
  computeFacesSnapshot,
  createSolvedCubies,
  formatAsciiDiagram,
  normalToFace,
  rotateVec3Int,
} from './geometry';
import { invertMove, parseAlgorithm, parseMoveNotation, simplifyMoves } from './notation';
import { computeSolutionMoves, generateScrambleSequence } from './ScrambleGenerator';
import type {
  Coordinate,
  CubeFacesSnapshot,
  CubeSerializedState,
  CubieState,
  DifficultyLevel,
  MoveDefinition,
  MoveNotation,
} from './types';

export { normalToFace, rotateVec3Int };

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
  private movesFromSolved: MoveNotation[] = [];
  private difficulty: DifficultyLevel = 'medium';
  private startTimeMs: number | null = null;
  private solvedTimeMs: number | null = null;
  private listeners = new Set<CubeEventListener>();

  constructor(initialDifficulty: DifficultyLevel = 'medium') {
    this.difficulty = initialDifficulty;
    this.cubies = createSolvedCubies();
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

  public move(notationInput: MoveNotation | string, recordHistory = true): MoveDefinition {
    const def = parseMoveNotation(notationInput);

    if (recordHistory && this.startTimeMs === null && this.scrambleSequence.length > 0) {
      this.startTimeMs = Date.now();
    }

    applyMoveToCubies(this.cubies, def);
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

  public applyAlgorithm(
    algorithm: string | MoveNotation[],
    recordHistory = true
  ): MoveDefinition[] {
    const notations = typeof algorithm === 'string' ? parseAlgorithm(algorithm) : algorithm;
    return notations.map((n) => this.move(n, recordHistory));
  }

  public undo(): MoveDefinition | null {
    const lastMove = this.moveHistory.pop();
    if (!lastMove) return null;

    const def = parseMoveNotation(invertMove(lastMove));
    applyMoveToCubies(this.cubies, def);
    this.movesFromSolved = simplifyMoves([...this.movesFromSolved, def.notation]);
    this.redoStack.push(lastMove);

    this.emit({ type: 'undo', move: def });
    return def;
  }

  public redo(): MoveDefinition | null {
    const nextMove = this.redoStack.pop();
    if (!nextMove) return null;

    const def = parseMoveNotation(nextMove);
    applyMoveToCubies(this.cubies, def);
    this.movesFromSolved = simplifyMoves([...this.movesFromSolved, def.notation]);
    this.moveHistory.push(nextMove);

    if (this.isSolved() && this.startTimeMs !== null && this.solvedTimeMs === null) {
      this.solvedTimeMs = Date.now() - this.startTimeMs;
    }

    this.emit({ type: 'redo', move: def });
    return def;
  }

  public reset(): void {
    this.cubies = createSolvedCubies();
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

  public static generateScrambleSequence(
    length: number,
    rng: () => number = Math.random
  ): MoveNotation[] {
    return generateScrambleSequence(length, rng);
  }

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

    this.cubies = createSolvedCubies();
    this.moveHistory = [];
    this.redoStack = [];
    this.movesFromSolved = [];

    const sequence = generateScrambleSequence(length, options?.rng);
    for (const notation of sequence) {
      applyMoveToCubies(this.cubies, MOVE_DEFINITIONS[notation]);
    }

    this.scrambleSequence = [...sequence];
    this.movesFromSolved = simplifyMoves([...sequence]);
    this.startTimeMs = Date.now();
    this.solvedTimeMs = null;

    this.emit({ type: 'scramble', moves: sequence });
    return sequence;
  }

  public getFacesSnapshot(): CubeFacesSnapshot {
    return computeFacesSnapshot(this.cubies);
  }

  public getFaceletString(): string {
    const faces = this.getFacesSnapshot();
    let result = '';
    for (const faceName of ALL_FACES_ORDER) {
      for (const row of faces[faceName]) {
        for (const cell of row) {
          result += cell;
        }
      }
    }
    return result;
  }

  public isSolved(): boolean {
    const faces = this.getFacesSnapshot();
    for (const faceName of ALL_FACES_ORDER) {
      const grid = faces[faceName];
      const centerColor = grid[1][1];
      for (const row of grid) {
        for (const cell of row) {
          if (cell !== centerColor) return false;
        }
      }
    }
    return true;
  }

  public getSolutionMoves(): MoveNotation[] {
    return computeSolutionMoves(this.cubies, this.movesFromSolved, () => this.isSolved());
  }

  public getNextHint(): MoveNotation | null {
    const solution = this.getSolutionMoves();
    return solution.length > 0 ? solution[0] : null;
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

  public toAsciiDiagram(): string {
    return formatAsciiDiagram(this.getFacesSnapshot());
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

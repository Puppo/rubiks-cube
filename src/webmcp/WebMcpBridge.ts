import {
  ALL_BASE_MOVES,
  DIFFICULTY_CONFIGS,
  MOVE_DEFINITIONS,
  isValidMoveNotation,
  parseAlgorithm,
} from '../core/constants';
import type { CubeEngine } from '../core/CubeEngine';
import type { DifficultyLevel, MoveNotation } from '../core/types';

export interface WebMcpJsonSchema {
  type: 'object';
  properties: Record<
    string,
    {
      type: string;
      description: string;
      enum?: string[];
      minimum?: number;
      maximum?: number;
      default?: unknown;
    }
  >;
  required?: string[];
}

export interface WebMcpToolContent {
  type: 'text';
  text: string;
}

export interface WebMcpToolResult<T = Record<string, unknown>> {
  content: WebMcpToolContent[];
  structuredContent: T;
  isError?: boolean;
}

export interface WebMcpToolDefinition<
  TArgs = Record<string, unknown>,
  TResult = Record<string, unknown>,
> {
  name: string;
  description: string;
  inputSchema: WebMcpJsonSchema;
  execute: (args: TArgs) => Promise<WebMcpToolResult<TResult>> | WebMcpToolResult<TResult>;
}

export interface WebMcpRegisterOptions {
  signal?: AbortSignal;
}

export interface WebMcpLogEntry {
  id: string;
  timestamp: string;
  toolName: string;
  args: Record<string, unknown>;
  result: WebMcpToolResult<any>;
  durationMs: number;
}

export interface ModelContextInterface {
  registerTool: (
    tool: WebMcpToolDefinition<any, any>,
    options?: WebMcpRegisterOptions
  ) => Promise<void> | void;
  unregisterTool: (name: string) => Promise<void> | void;
  provideContext: (context: { tools: WebMcpToolDefinition<any, any>[] }) => () => void;
  clearContext: () => void;
  listTools: () => Omit<WebMcpToolDefinition<any, any>, 'execute'>[];
  callTool: (name: string, args?: Record<string, unknown>) => Promise<WebMcpToolResult<any>>;
}

declare global {
  interface Navigator {
    modelContext?: ModelContextInterface;
  }
  interface Window {
    rubiksWebMCP?: WebMcpBridge;
  }
}

export type WebMcpActionHooks = {
  onMove: (notation: MoveNotation) => Promise<void> | void;
  onAlgorithm: (notations: MoveNotation[]) => Promise<void> | void;
  onScramble: (options?: {
    difficulty?: DifficultyLevel;
    customLength?: number;
  }) => Promise<MoveNotation[]> | MoveNotation[];
  onReset: () => Promise<void> | void;
  onUndo: () => Promise<MoveNotation | null> | MoveNotation | null;
  onRedo: () => Promise<MoveNotation | null> | MoveNotation | null;
  onSetDifficulty: (difficulty: DifficultyLevel) => void;
};

export class WebMcpBridge {
  private readonly engine: CubeEngine;
  private readonly hooks: WebMcpActionHooks;
  private readonly tools = new Map<string, WebMcpToolDefinition<any, any>>();
  private readonly abortController = new AbortController();
  private readonly logs: WebMcpLogEntry[] = [];
  private readonly logListeners = new Set<(logs: WebMcpLogEntry[]) => void>();

  constructor(engine: CubeEngine, hooks?: Partial<WebMcpActionHooks>) {
    this.engine = engine;
    this.hooks = {
      onMove:
        hooks?.onMove ??
        ((notation) => {
          this.engine.move(notation);
        }),
      onAlgorithm:
        hooks?.onAlgorithm ??
        ((notations) => {
          this.engine.applyAlgorithm(notations);
        }),
      onScramble: hooks?.onScramble ?? ((opts) => this.engine.scramble(opts)),
      onReset:
        hooks?.onReset ??
        (() => {
          this.engine.reset();
        }),
      onUndo: hooks?.onUndo ?? (() => this.engine.undo()?.notation ?? null),
      onRedo: hooks?.onRedo ?? (() => this.engine.redo()?.notation ?? null),
      onSetDifficulty:
        hooks?.onSetDifficulty ??
        ((diff) => {
          this.engine.setDifficulty(diff);
        }),
    };

    this.installNavigatorModelContext();
    this.registerAllCubeTools();

    if (typeof window !== 'undefined') {
      window.rubiksWebMCP = this;
    }
  }

  private installNavigatorModelContext(): void {
    if (typeof navigator === 'undefined') return;

    const nativeCtx = navigator.modelContext;
    const nativeRegister = nativeCtx?.registerTool?.bind(nativeCtx);
    const nativeUnregister = nativeCtx?.unregisterTool?.bind(nativeCtx);
    const nativeProvide = nativeCtx?.provideContext?.bind(nativeCtx);
    const nativeClear = nativeCtx?.clearContext?.bind(nativeCtx);

    const modelContextShim: ModelContextInterface = {
      registerTool: async (tool, options) => {
        this.tools.set(tool.name, tool);
        if (options?.signal) {
          options.signal.addEventListener(
            'abort',
            () => {
              this.tools.delete(tool.name);
            },
            { once: true }
          );
        }
        if (nativeRegister) {
          try {
            await nativeRegister(tool, options);
          } catch {
            // Ignore native errors in non-HTTPS or partial test environments
          }
        }
      },
      unregisterTool: async (name: string) => {
        this.tools.delete(name);
        if (nativeUnregister) {
          try {
            await nativeUnregister(name);
          } catch {
            // Ignore
          }
        }
      },
      provideContext: (context) => {
        this.tools.clear();
        for (const tool of context.tools) {
          this.tools.set(tool.name, tool);
        }
        let nativeCleanup: (() => void) | undefined;
        if (nativeProvide) {
          try {
            nativeCleanup = nativeProvide(context);
          } catch {
            // Ignore
          }
        }
        return () => {
          this.tools.clear();
          nativeCleanup?.();
        };
      },
      clearContext: () => {
        this.tools.clear();
        if (nativeClear) {
          try {
            nativeClear();
          } catch {
            // Ignore
          }
        }
      },
      listTools: () => this.listTools(),
      callTool: (name, args = {}) => this.callTool(name, args),
    };

    try {
      Object.defineProperty(navigator, 'modelContext', {
        value: modelContextShim,
        configurable: true,
        writable: true,
      });
    } catch {
      (navigator as any).modelContext = modelContextShim;
    }
  }

  private createStatePayload(summaryMessage: string): WebMcpToolResult<Record<string, unknown>> {
    const state = this.engine.getState();
    const asciiDiagram = this.engine.toAsciiDiagram();
    const structured = {
      summary: summaryMessage,
      isSolved: state.isSolved,
      difficulty: state.difficulty,
      moveCount: state.moveCount,
      elapsedMs: state.elapsedMs,
      faceletString: state.faceletString,
      faces: state.faces,
      asciiDiagram,
      moveHistory: state.moveHistory,
      scrambleSequence: state.scrambleSequence,
    };

    return {
      content: [
        {
          type: 'text',
          text: `${summaryMessage}\nSolved: ${state.isSolved} | Moves: ${state.moveCount} | Difficulty: ${state.difficulty}\nFacelets: ${state.faceletString}\n\n${asciiDiagram}`,
        },
      ],
      structuredContent: structured,
    };
  }

  private registerAllCubeTools(): void {
    const validMoves = Object.keys(MOVE_DEFINITIONS);
    const validDifficulties = Object.keys(DIFFICULTY_CONFIGS);

    const toolDefs: WebMcpToolDefinition<any, any>[] = [
      {
        name: 'get_cube_state',
        description:
          "Returns the complete current state of the 3x3x3 Rubik's Cube, including whether it is solved, all 6 faces (U, D, L, R, F, B) as 3x3 color grids, the 54-character facelet string, an ASCII net diagram, move history, and difficulty.",
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          return this.createStatePayload("Fetched current Rubik's Cube state.");
        },
      },
      {
        name: 'rotate_face',
        description:
          'Executes a single Rubik\'s Cube face or slice move in standard WCA notation (e.g., "R", "U\'", "F2", "L", "D\'", "B2", "M", "E", "S").',
        inputSchema: {
          type: 'object',
          properties: {
            move: {
              type: 'string',
              description: `Move in standard notation. Valid moves: ${validMoves.join(', ')}`,
              enum: validMoves,
            },
          },
          required: ['move'],
        },
        execute: async ({ move }: { move: string }) => {
          if (!move || !isValidMoveNotation(move)) {
            throw new Error(`Invalid move "${move}". Expected one of: ${validMoves.join(', ')}`);
          }
          const notation = move.trim() as MoveNotation;
          await this.hooks.onMove(notation);
          return this.createStatePayload(`Executed move "${notation}".`);
        },
      },
      {
        name: 'execute_algorithm',
        description:
          "Executes a space-separated sequence of Rubik's Cube moves in standard notation (e.g., \"R U R' U'\" or \"F R U R' U' F'\").",
        inputSchema: {
          type: 'object',
          properties: {
            algorithm: {
              type: 'string',
              description:
                "Space-separated sequence of moves using faces U, D, L, R, F, B, M, E, S with optional ' or 2 modifiers.",
            },
          },
          required: ['algorithm'],
        },
        execute: async ({ algorithm }: { algorithm: string }) => {
          const parsed = parseAlgorithm(algorithm);
          if (parsed.length === 0) {
            throw new Error('Algorithm string cannot be empty.');
          }
          await this.hooks.onAlgorithm(parsed);
          return this.createStatePayload(
            `Executed algorithm "${parsed.join(' ')}" (${parsed.length} moves).`
          );
        },
      },
      {
        name: 'scramble_cube',
        description:
          "Resets and scrambles the Rubik's Cube at the requested difficulty level or custom scramble move length.",
        inputSchema: {
          type: 'object',
          properties: {
            difficulty: {
              type: 'string',
              description: 'Difficulty preset determining scramble depth and hint availability.',
              enum: validDifficulties,
            },
            customLength: {
              type: 'integer',
              description: 'Optional custom number of scramble moves (1 to 40).',
              minimum: 1,
              maximum: 40,
            },
          },
        },
        execute: async ({
          difficulty,
          customLength,
        }: {
          difficulty?: DifficultyLevel;
          customLength?: number;
        }) => {
          if (difficulty && !DIFFICULTY_CONFIGS[difficulty]) {
            throw new Error(
              `Invalid difficulty "${difficulty}". Valid values: ${validDifficulties.join(', ')}`
            );
          }
          const sequence = await this.hooks.onScramble({ difficulty, customLength });
          return this.createStatePayload(
            `Scrambled cube (${sequence.length} moves: ${sequence.join(' ')}).`
          );
        },
      },
      {
        name: 'set_difficulty',
        description:
          "Changes the active difficulty level of the Rubik's Cube simulator (beginner, easy, medium, hard, expert).",
        inputSchema: {
          type: 'object',
          properties: {
            difficulty: {
              type: 'string',
              description: 'Target difficulty preset.',
              enum: validDifficulties,
            },
          },
          required: ['difficulty'],
        },
        execute: async ({ difficulty }: { difficulty: DifficultyLevel }) => {
          if (!DIFFICULTY_CONFIGS[difficulty]) {
            throw new Error(`Invalid difficulty "${difficulty}".`);
          }
          this.hooks.onSetDifficulty(difficulty);
          return this.createStatePayload(`Difficulty set to "${difficulty}".`);
        },
      },
      {
        name: 'get_hint',
        description:
          "Computes the next optimal move to progress toward solving the Rubik's Cube from its current state.",
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const solution = this.engine.getSolutionMoves();
          const nextMove = solution[0] ?? null;
          const statePayload = this.createStatePayload(
            nextMove
              ? `Recommended next move: "${nextMove}" (${solution.length} moves remaining to solve).`
              : 'The cube is already solved!'
          );
          statePayload.structuredContent.nextMove = nextMove;
          statePayload.structuredContent.remainingMovesCount = solution.length;
          statePayload.structuredContent.solutionPreview = solution;
          return statePayload;
        },
      },
      {
        name: 'solve_cube',
        description:
          'Computes the complete solution sequence from the current state and optionally executes the solution moves on the cube.',
        inputSchema: {
          type: 'object',
          properties: {
            execute: {
              type: 'boolean',
              description:
                'If true (default), applies the solution moves to solve the cube immediately. If false, only returns the solution sequence.',
              default: true,
            },
          },
        },
        execute: async ({ execute = true }: { execute?: boolean }) => {
          const solution = this.engine.getSolutionMoves();
          if (solution.length === 0) {
            const res = this.createStatePayload('Cube is already solved.');
            res.structuredContent.solutionMoves = [];
            return res;
          }
          if (execute) {
            await this.hooks.onAlgorithm(solution);
          }
          const res = this.createStatePayload(
            execute
              ? `Solved cube in ${solution.length} moves: ${solution.join(' ')}`
              : `Computed ${solution.length}-move solution: ${solution.join(' ')}`
          );
          res.structuredContent.solutionMoves = solution;
          return res;
        },
      },
      {
        name: 'undo_move',
        description: "Undoes the last executed move on the Rubik's Cube.",
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const undone = await this.hooks.onUndo();
          return this.createStatePayload(
            undone ? `Undid move with inverse "${undone}".` : 'No moves in history to undo.'
          );
        },
      },
      {
        name: 'redo_move',
        description: "Redoes the most recently undone move on the Rubik's Cube.",
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const redone = await this.hooks.onRedo();
          return this.createStatePayload(
            redone ? `Redid move "${redone}".` : 'No moves in redo stack.'
          );
        },
      },
      {
        name: 'reset_cube',
        description: "Resets the Rubik's Cube immediately to its clean solved state.",
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          await this.hooks.onReset();
          return this.createStatePayload('Cube reset to solved state.');
        },
      },
    ];

    // Register via navigator.modelContext
    for (const tool of toolDefs) {
      if (typeof navigator !== 'undefined' && navigator.modelContext) {
        navigator.modelContext.registerTool(tool, {
          signal: this.abortController.signal,
        });
      } else {
        this.tools.set(tool.name, tool);
      }
    }

    // Touch ALL_BASE_MOVES for completeness
    void ALL_BASE_MOVES;
  }

  public listTools(): Omit<WebMcpToolDefinition<any, any>, 'execute'>[] {
    return Array.from(this.tools.values()).map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    }));
  }

  public async callTool(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<WebMcpToolResult<any>> {
    const tool = this.tools.get(name);
    const startMs = performance.now();

    if (!tool) {
      const errorResult: WebMcpToolResult = {
        isError: true,
        content: [{ type: 'text', text: `Unknown WebMCP tool: "${name}"` }],
        structuredContent: { error: `Unknown WebMCP tool: "${name}"` },
      };
      this.recordLog(name, args, errorResult, performance.now() - startMs);
      return errorResult;
    }

    try {
      const result = await tool.execute(args);
      this.recordLog(name, args, result, performance.now() - startMs);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const errorResult: WebMcpToolResult = {
        isError: true,
        content: [{ type: 'text', text: `Error executing ${name}: ${message}` }],
        structuredContent: { error: message },
      };
      this.recordLog(name, args, errorResult, performance.now() - startMs);
      return errorResult;
    }
  }

  private recordLog(
    toolName: string,
    args: Record<string, unknown>,
    result: WebMcpToolResult<any>,
    durationMs: number
  ): void {
    const entry: WebMcpLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      toolName,
      args,
      result,
      durationMs: Math.round(durationMs * 100) / 100,
    };
    this.logs.unshift(entry);
    if (this.logs.length > 50) {
      this.logs.pop();
    }
    for (const listener of this.logListeners) {
      listener([...this.logs]);
    }
  }

  public getLogs(): WebMcpLogEntry[] {
    return [...this.logs];
  }

  public onLogsChange(listener: (logs: WebMcpLogEntry[]) => void): () => void {
    this.logListeners.add(listener);
    return () => {
      this.logListeners.delete(listener);
    };
  }

  public dispose(): void {
    this.abortController.abort();
    this.tools.clear();
  }
}

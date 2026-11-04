import {
  DIFFICULTY_CONFIGS,
  MOVE_DEFINITIONS,
  isValidMoveNotation,
  parseAlgorithm,
} from '../core/constants';
import type { CubeEngine } from '../core/CubeEngine';
import type { DifficultyLevel, MoveNotation } from '../core/types';
import type { WebMcpActionHooks, WebMcpToolDefinition, WebMcpToolResult } from './types';

export function buildCubeToolDefinitions(
  engine: CubeEngine,
  hooks: WebMcpActionHooks,
  createStatePayload: (summary: string) => WebMcpToolResult<Record<string, unknown>>
): WebMcpToolDefinition<any, any>[] {
  const validMoves = Object.keys(MOVE_DEFINITIONS);
  const validDifficulties = Object.keys(DIFFICULTY_CONFIGS);

  return [
    {
      name: 'get_cube_state',
      description:
        "Returns the complete current state of the 3x3x3 Rubik's Cube, including whether it is solved, all 6 faces (U, D, L, R, F, B) as 3x3 color grids, the 54-character facelet string, an ASCII net diagram, move history, and difficulty.",
      inputSchema: { type: 'object', properties: {} },
      execute: async () => createStatePayload("Fetched current Rubik's Cube state."),
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
        await hooks.onMove(notation);
        return createStatePayload(`Executed move "${notation}".`);
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
        await hooks.onAlgorithm(parsed);
        return createStatePayload(
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
        const sequence = await hooks.onScramble({ difficulty, customLength });
        return createStatePayload(
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
        hooks.onSetDifficulty(difficulty);
        return createStatePayload(`Difficulty set to "${difficulty}".`);
      },
    },
    {
      name: 'get_hint',
      description:
        "Computes the next optimal move to progress toward solving the Rubik's Cube from its current state.",
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const solution = engine.getSolutionMoves();
        const nextMove = solution[0] ?? null;
        const statePayload = createStatePayload(
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
        const solution = engine.getSolutionMoves();
        if (solution.length === 0) {
          const res = createStatePayload('Cube is already solved.');
          res.structuredContent.solutionMoves = [];
          return res;
        }
        if (execute) {
          await hooks.onAlgorithm(solution);
        }
        const res = createStatePayload(
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
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const undone = await hooks.onUndo();
        return createStatePayload(
          undone ? `Undid move with inverse "${undone}".` : 'No moves in history to undo.'
        );
      },
    },
    {
      name: 'redo_move',
      description: "Redoes the most recently undone move on the Rubik's Cube.",
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const redone = await hooks.onRedo();
        return createStatePayload(redone ? `Redid move "${redone}".` : 'No moves in redo stack.');
      },
    },
    {
      name: 'reset_cube',
      description: "Resets the Rubik's Cube immediately to its clean solved state.",
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        await hooks.onReset();
        return createStatePayload('Cube reset to solved state.');
      },
    },
  ];
}

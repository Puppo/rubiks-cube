import { MOVE_DEFINITIONS } from './constants';
import type { BaseMove, MoveDefinition, MoveModifier, MoveNotation } from './types';

export function isValidMoveNotation(input: string): input is MoveNotation {
  return Object.prototype.hasOwnProperty.call(MOVE_DEFINITIONS, input.trim());
}

export function parseMoveNotation(input: string): MoveDefinition {
  const trimmed = input.trim();
  if (!isValidMoveNotation(trimmed)) {
    throw new Error(`Invalid Rubik's Cube move notation: "${input}"`);
  }
  return MOVE_DEFINITIONS[trimmed];
}

export function parseAlgorithm(algorithm: string): MoveNotation[] {
  const trimmed = algorithm.trim();
  if (!trimmed) return [];
  const tokens = trimmed.split(/\s+/);
  return tokens.map((token) => parseMoveNotation(token).notation);
}

export function invertMove(move: MoveNotation): MoveNotation {
  const def = MOVE_DEFINITIONS[move];
  if (def.modifier === '2') {
    return move;
  }
  const inverseModifier: MoveModifier = def.modifier === '' ? "'" : '';
  return `${def.base}${inverseModifier}`;
}

export function invertAlgorithm(moves: MoveNotation[]): MoveNotation[] {
  return moves.toReversed().map(invertMove);
}

/**
 * Simplifies a sequence of moves by combining adjacent moves on the same face
 * (e.g. ["R", "R"] -> ["R2"], ["U", "U'"] -> [], ["F2", "F"] -> ["F'"]).
 */
export function simplifyMoves(moves: MoveNotation[]): MoveNotation[] {
  const stack: { base: BaseMove; turns: number }[] = [];

  const modifierToTurns = (mod: MoveModifier): number => {
    if (mod === '') return 1;
    if (mod === "'") return 3;
    return 2;
  };

  const turnsToModifier = (turns: number): MoveModifier => {
    const norm = ((turns % 4) + 4) % 4;
    if (norm === 1) return '';
    if (norm === 2) return '2';
    return "'";
  };

  for (const move of moves) {
    const def = MOVE_DEFINITIONS[move];
    const turns = modifierToTurns(def.modifier);
    const top = stack[stack.length - 1];
    if (top && top.base === def.base) {
      top.turns = (top.turns + turns) % 4;
      if (top.turns === 0) {
        stack.pop();
      }
    } else {
      stack.push({ base: def.base, turns });
    }
  }

  return stack.map(({ base, turns }) => `${base}${turnsToModifier(turns)}` as MoveNotation);
}

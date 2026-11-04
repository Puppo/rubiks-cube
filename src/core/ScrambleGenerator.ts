import { MOVE_DEFINITIONS, OUTER_FACE_MOVES } from './constants';
import { applyMoveToCubies } from './geometry';
import { invertAlgorithm, invertMove, simplifyMoves } from './notation';
import type { BaseMove, CubieState, MoveModifier, MoveNotation } from './types';

export function generateScrambleSequence(
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

export function findShortSolutionBFS(
  cubies: CubieState[],
  isSolvedCheck: () => boolean,
  maxDepth = 3
): MoveNotation[] | null {
  const candidateMoves: MoveNotation[] = [];
  for (const base of OUTER_FACE_MOVES) {
    candidateMoves.push(base, `${base}'` as MoveNotation, `${base}2` as MoveNotation);
  }

  const search = (
    depth: number,
    lastBase: BaseMove | null,
    path: MoveNotation[]
  ): MoveNotation[] | null => {
    if (isSolvedCheck()) return [...path];
    if (depth === 0) return null;

    for (const move of candidateMoves) {
      const def = MOVE_DEFINITIONS[move];
      if (def.base === lastBase) continue;

      applyMoveToCubies(cubies, def);
      path.push(move);

      const found = search(depth - 1, def.base, path);
      if (found) {
        applyMoveToCubies(cubies, MOVE_DEFINITIONS[invertMove(move)]);
        path.pop();
        return found;
      }

      path.pop();
      applyMoveToCubies(cubies, MOVE_DEFINITIONS[invertMove(move)]);
    }

    return null;
  };

  for (let d = 1; d <= maxDepth; d++) {
    const res = search(d, null, []);
    if (res) return res;
  }
  return null;
}

export function computeSolutionMoves(
  cubies: CubieState[],
  movesFromSolved: MoveNotation[],
  isSolvedCheck: () => boolean
): MoveNotation[] {
  if (isSolvedCheck()) return [];

  const shortSolution = findShortSolutionBFS(cubies, isSolvedCheck, 3);
  if (shortSolution) {
    return shortSolution;
  }

  return simplifyMoves(invertAlgorithm(movesFromSolved));
}

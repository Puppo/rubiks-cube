import { ALL_BASE_MOVES } from '../core/constants';
import type { BaseMove, MoveNotation } from '../core/types';

export type KeyboardAction =
  | { type: 'move'; notation: MoveNotation }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'scramble' }
  | { type: 'reset' }
  | { type: 'hint' };

export interface KeyEventLike {
  key: string;
  code?: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  target?: unknown;
}

const VALID_MOVE_KEYS = new Set<string>(ALL_BASE_MOVES);

/**
 * Pure helper that maps a keyboard event to a Rubik's Cube action.
 *
 * Key bindings:
 * - U, D, L, R, F, B, M, E, S: Clockwise 90° move
 * - Shift + (U, D, L, R, F, B, M, E, S): Counter-clockwise 90° prime move (')
 * - Ctrl/Cmd + Z: Undo last move
 * - Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z: Redo move
 * - Space: Scramble cube
 * - H: Request next hint move
 * - Escape: Reset cube to solved state
 */
export function resolveKeyboardAction(event: KeyEventLike): KeyboardAction | null {
  if (event.altKey) return null;

  const isMod = Boolean(event.ctrlKey || event.metaKey);
  const upperKey = event.key.toUpperCase();

  if (isMod) {
    if (upperKey === 'Z') {
      return event.shiftKey ? { type: 'redo' } : { type: 'undo' };
    }
    if (upperKey === 'Y') {
      return { type: 'redo' };
    }
    return null;
  }

  if (event.key === ' ' || event.code === 'Space') {
    return { type: 'scramble' };
  }

  if (event.key === 'Escape') {
    return { type: 'reset' };
  }

  if (upperKey === 'H') {
    return { type: 'hint' };
  }

  if (VALID_MOVE_KEYS.has(upperKey)) {
    const base = upperKey as BaseMove;
    const notation: MoveNotation = event.shiftKey ? `${base}'` : base;
    return { type: 'move', notation };
  }

  return null;
}

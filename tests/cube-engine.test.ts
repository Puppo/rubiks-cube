import { describe, expect, it } from 'vitest';
import {
  ALL_BASE_MOVES,
  DIFFICULTY_CONFIGS,
  invertAlgorithm,
  invertMove,
  parseAlgorithm,
  parseMoveNotation,
  simplifyMoves,
} from '../src/core/constants';
import { CubeEngine } from '../src/core/CubeEngine';

describe('CubeEngine & Algebraic Invariants', () => {
  it('starts in a solved state with 54 valid facelets', () => {
    const engine = new CubeEngine();
    expect(engine.isSolved()).toBe(true);
    expect(engine.getFaceletString()).toBe(
      'WWWWWWWWWRRRRRRRRRGGGGGGGGGYYYYYYYYYOOOOOOOOOBBBBBBBBB'
    );
    expect(engine.getCubies()).toHaveLength(26);
  });

  it('returns to solved state after 4 clockwise or counter-clockwise turns of any base move', () => {
    for (const base of ALL_BASE_MOVES) {
      const engine = new CubeEngine();
      for (let i = 0; i < 4; i++) {
        engine.move(base);
        if (i < 3) {
          expect(engine.isSolved()).toBe(false);
        }
      }
      expect(engine.isSolved()).toBe(true);

      for (let i = 0; i < 4; i++) {
        engine.move(`${base}'`);
      }
      expect(engine.isSolved()).toBe(true);
    }
  });

  it('returns to solved state after 2 half-turns (2 modifier) of any outer face', () => {
    for (const base of ALL_BASE_MOVES) {
      const engine = new CubeEngine();
      engine.move(`${base}2`);
      expect(engine.isSolved()).toBe(false);
      engine.move(`${base}2`);
      expect(engine.isSolved()).toBe(true);
    }
  });

  it('cancels out any move followed immediately by its inverse', () => {
    const engine = new CubeEngine();
    for (const base of ALL_BASE_MOVES) {
      engine.move(base);
      expect(engine.isSolved()).toBe(false);
      engine.move(invertMove(base));
      expect(engine.isSolved()).toBe(true);
    }
  });

  it("satisfies group theory order 6 for the Sexy Move (R U R' U')", () => {
    const engine = new CubeEngine();
    for (let cycle = 1; cycle <= 6; cycle++) {
      engine.applyAlgorithm("R U R' U'");
      if (cycle < 6) {
        expect(engine.isSolved()).toBe(false);
      } else {
        expect(engine.isSolved()).toBe(true);
      }
    }
  });

  it('satisfies group theory order 2 for the T-Permutation', () => {
    const engine = new CubeEngine();
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    engine.applyAlgorithm(tPerm);
    expect(engine.isSolved()).toBe(false);
    engine.applyAlgorithm(tPerm);
    expect(engine.isSolved()).toBe(true);
  });

  it('simplifies redundant move sequences algebraically', () => {
    expect(simplifyMoves(['R', 'R'])).toEqual(['R2']);
    expect(simplifyMoves(['R', 'R', 'R'])).toEqual(["R'"]);
    expect(simplifyMoves(['R', 'R', 'R', 'R'])).toEqual([]);
    expect(simplifyMoves(['U', "U'"])).toEqual([]);
    expect(simplifyMoves(['F2', 'F'])).toEqual(["F'"]);
  });

  it('supports undo and redo accurately', () => {
    const engine = new CubeEngine();
    engine.applyAlgorithm("R U F'");
    expect(engine.getState().moveCount).toBe(3);
    expect(engine.isSolved()).toBe(false);

    engine.undo();
    expect(engine.getState().moveCount).toBe(2);
    engine.undo();
    engine.undo();
    expect(engine.isSolved()).toBe(true);
    expect(engine.undo()).toBeNull();

    engine.redo();
    expect(engine.isSolved()).toBe(false);
    expect(engine.getState().moveCount).toBe(1);
  });

  it('generates valid WCA-style scrambles for all difficulty levels without consecutive duplicate faces', () => {
    const difficulties = Object.keys(DIFFICULTY_CONFIGS) as Array<keyof typeof DIFFICULTY_CONFIGS>;

    for (const diff of difficulties) {
      const engine = new CubeEngine(diff);
      const seq = engine.scramble({ difficulty: diff });
      expect(seq).toHaveLength(DIFFICULTY_CONFIGS[diff].scrambleLength);

      for (let i = 1; i < seq.length; i++) {
        const prev = parseMoveNotation(seq[i - 1]).base;
        const curr = parseMoveNotation(seq[i]).base;
        expect(curr).not.toBe(prev);
      }
    }
  });

  it('computes hints and solves any scrambled cube back to the solved state', () => {
    const engine = new CubeEngine('medium');
    engine.scramble();
    expect(engine.isSolved()).toBe(false);

    const hint = engine.getNextHint();
    expect(hint).not.toBeNull();

    const solution = engine.getSolutionMoves();
    expect(solution.length).toBeGreaterThan(0);

    engine.applyAlgorithm(solution);
    expect(engine.isSolved()).toBe(true);
  });

  it('finds optimal 1-3 move BFS solutions when close to solved', () => {
    const engine = new CubeEngine('easy');
    engine.applyAlgorithm("R U'");
    const solution = engine.getSolutionMoves();
    expect(solution).toEqual(['U', "R'"]);
  });

  it('renders an ASCII net diagram and handles invalid notations gracefully', () => {
    const engine = new CubeEngine();
    const ascii = engine.toAsciiDiagram();
    expect(ascii).toContain('W W W');
    expect(ascii).toContain('O O O | G G G | R R R | B B B');
    expect(() => parseMoveNotation('INVALID')).toThrow();
    expect(parseAlgorithm('')).toEqual([]);
    expect(invertAlgorithm(['R', 'U2', "F'"])).toEqual(['F', 'U2', "R'"]);
  });
});

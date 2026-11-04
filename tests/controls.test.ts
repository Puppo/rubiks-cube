import { describe, expect, it } from 'vitest';
import { resolveMoveFromSurfaceDrag } from '../src/controls/dragMath';
import { resolveKeyboardAction } from '../src/controls/KeyboardController';

describe('3D Surface Drag & Keyboard Controls', () => {
  it('resolves dragging on the Front face (normal +Z) correctly', () => {
    const frontNormal = { x: 0, y: 0, z: 1 } as const;

    // Top-Front cubie dragged Left (-X) -> U (clockwise Up layer)
    const moveU = resolveMoveFromSurfaceDrag(
      frontNormal,
      { x: 0, y: 1, z: 1 },
      { x: -1, y: 0, z: 0 }
    );
    expect(moveU?.notation).toBe('U');

    // Top-Front cubie dragged Right (+X) -> U' (counter-clockwise Up layer)
    const moveUPrime = resolveMoveFromSurfaceDrag(
      frontNormal,
      { x: 0, y: 1, z: 1 },
      { x: 1, y: 0, z: 0 }
    );
    expect(moveUPrime?.notation).toBe("U'");

    // Right-Front cubie dragged Up (+Y) -> R (clockwise Right layer)
    const moveR = resolveMoveFromSurfaceDrag(
      frontNormal,
      { x: 1, y: 0, z: 1 },
      { x: 0, y: 1, z: 0 }
    );
    expect(moveR?.notation).toBe('R');

    // Left-Front cubie dragged Down (-Y) -> L (clockwise Left layer)
    const moveL = resolveMoveFromSurfaceDrag(
      frontNormal,
      { x: -1, y: 0, z: 1 },
      { x: 0, y: -1, z: 0 }
    );
    expect(moveL?.notation).toBe('L');

    // Center-Front cubie dragged Down (-Y) -> M (middle slice follows L)
    const moveM = resolveMoveFromSurfaceDrag(
      frontNormal,
      { x: 0, y: 0, z: 1 },
      { x: 0, y: -1, z: 0 }
    );
    expect(moveM?.notation).toBe('M');
  });

  it('resolves dragging on the Up face (normal +Y) and Right face (normal +X)', () => {
    const upNormal = { x: 0, y: 1, z: 0 } as const;
    // Front-Up edge dragged Right (+X) -> F (clockwise Front layer)
    const moveF = resolveMoveFromSurfaceDrag(upNormal, { x: 0, y: 1, z: 1 }, { x: 1, y: 0, z: 0 });
    expect(moveF?.notation).toBe('F');

    const rightNormal = { x: 1, y: 0, z: 0 } as const;
    // Up-Right edge dragged Front (+Z) -> U (clockwise Up layer)
    const moveU = resolveMoveFromSurfaceDrag(
      rightNormal,
      { x: 1, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 }
    );
    expect(moveU?.notation).toBe('U');

    // Tiny drag returns null
    expect(
      resolveMoveFromSurfaceDrag(rightNormal, { x: 1, y: 1, z: 0 }, { x: 0, y: 0, z: 0 })
    ).toBeNull();
  });

  it('maps keyboard shortcuts to cube actions', () => {
    expect(resolveKeyboardAction({ key: 'r' })).toEqual({
      type: 'move',
      notation: 'R',
    });
    expect(resolveKeyboardAction({ key: 'R', shiftKey: true })).toEqual({
      type: 'move',
      notation: "R'",
    });
    expect(resolveKeyboardAction({ key: 'z', ctrlKey: true })).toEqual({
      type: 'undo',
    });
    expect(resolveKeyboardAction({ key: 'Z', ctrlKey: true, shiftKey: true })).toEqual({
      type: 'redo',
    });
    expect(resolveKeyboardAction({ key: 'y', metaKey: true })).toEqual({
      type: 'redo',
    });
    expect(resolveKeyboardAction({ key: ' ', code: 'Space' })).toEqual({
      type: 'scramble',
    });
    expect(resolveKeyboardAction({ key: 'Escape' })).toEqual({
      type: 'reset',
    });
    expect(resolveKeyboardAction({ key: 'h' })).toEqual({
      type: 'hint',
    });
    expect(resolveKeyboardAction({ key: 'x' })).toBeNull();
  });
});

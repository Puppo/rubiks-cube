import { describe, expect, it } from 'vitest';
import { CubeEngine } from '../src/core/CubeEngine';
import { WebMcpBridge } from '../src/webmcp/WebMcpBridge';

describe('WebMCP Agent Protocol Integration', () => {
  it("installs navigator.modelContext and registers all 10 Rubik's Cube tools", () => {
    const engine = new CubeEngine();
    const bridge = new WebMcpBridge(engine);

    expect(navigator.modelContext).toBeDefined();
    const tools = navigator.modelContext!.listTools();
    const toolNames = tools.map((t) => t.name);

    expect(toolNames).toEqual([
      'get_cube_state',
      'rotate_face',
      'execute_algorithm',
      'scramble_cube',
      'set_difficulty',
      'get_hint',
      'solve_cube',
      'undo_move',
      'redo_move',
      'reset_cube',
    ]);

    bridge.dispose();
  });

  it('allows an AI agent to scramble, inspect, get hints, rotate faces, and solve the cube via WebMCP', async () => {
    const engine = new CubeEngine('easy');
    const bridge = new WebMcpBridge(engine);

    // 1. Inspect initial solved state
    const initial = await navigator.modelContext!.callTool('get_cube_state');
    expect(initial.structuredContent.isSolved).toBe(true);

    // 2. Rotate single face R
    const afterR = await navigator.modelContext!.callTool('rotate_face', {
      move: 'R',
    });
    expect(afterR.structuredContent.isSolved).toBe(false);
    expect(afterR.structuredContent.moveCount).toBe(1);

    // 3. Get hint (should suggest R')
    const hintRes = await navigator.modelContext!.callTool('get_hint');
    expect(hintRes.structuredContent.nextMove).toBe("R'");

    // 4. Undo and Redo via WebMCP
    await navigator.modelContext!.callTool('undo_move');
    expect(engine.isSolved()).toBe(true);
    await navigator.modelContext!.callTool('redo_move');
    expect(engine.isSolved()).toBe(false);

    // 5. Execute algorithm
    await navigator.modelContext!.callTool('execute_algorithm', {
      algorithm: "U R' U'",
    });
    expect(engine.getState().moveCount).toBe(4);

    // 6. Solve cube via WebMCP
    const solvedRes = await navigator.modelContext!.callTool('solve_cube', {
      execute: true,
    });
    expect(solvedRes.structuredContent.isSolved).toBe(true);

    // 7. Scramble and reset
    const scrambleRes = await navigator.modelContext!.callTool('scramble_cube', {
      difficulty: 'beginner',
    });
    expect(scrambleRes.structuredContent.difficulty).toBe('beginner');

    await navigator.modelContext!.callTool('reset_cube');
    expect(engine.isSolved()).toBe(true);

    expect(bridge.getLogs().length).toBeGreaterThanOrEqual(8);
    bridge.dispose();
  });

  it('handles invalid tool calls and invalid parameters with structured WebMCP errors', async () => {
    const engine = new CubeEngine();
    const bridge = new WebMcpBridge(engine);

    const unknownTool = await bridge.callTool('non_existent_tool');
    expect(unknownTool.isError).toBe(true);

    const invalidMove = await bridge.callTool('rotate_face', { move: 'Z99' });
    expect(invalidMove.isError).toBe(true);

    bridge.dispose();
  });
});

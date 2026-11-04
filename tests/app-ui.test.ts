import { describe, expect, it } from 'vitest';
import { AppController } from '../src/ui/AppController';

describe('AppController UI Integration', () => {
  it('renders the full simulator UI, handles moves, difficulty selection, hints, and WebMCP console', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const app = new AppController(root, { skipWebGL: true });

    const stateBadge = root.querySelector('[data-testid="state-badge"]');
    const moveCounter = root.querySelector('[data-testid="move-counter"]');
    expect(stateBadge?.textContent).toBe('SOLVED');
    expect(moveCounter?.textContent).toBe('0');

    // Click the "U" move button
    const uButton = root.querySelector<HTMLButtonElement>('.btn-move[data-move="U"]');
    expect(uButton).not.toBeNull();
    uButton!.click();

    expect(stateBadge?.textContent).toBe('SCRAMBLED');
    expect(moveCounter?.textContent).toBe('1');

    // Request hint
    const hintBtn = root.querySelector<HTMLButtonElement>('[data-testid="btn-hint"]');
    hintBtn!.click();
    const statusText = root.querySelector('[data-testid="status-banner-text"]');
    expect(statusText?.textContent).toContain("U'");

    // Auto-solve
    await app.autoSolve();
    expect(stateBadge?.textContent).toBe('SOLVED');

    // Switch difficulty to expert and verify hints are disabled
    const diffSelect = root.querySelector<HTMLSelectElement>('[data-testid="difficulty-select"]');
    diffSelect!.value = 'expert';
    diffSelect!.dispatchEvent(new Event('change'));
    expect(hintBtn?.disabled).toBe(true);

    // Invoke WebMCP tool from UI console
    const invokeBtn = root.querySelector<HTMLButtonElement>('[data-testid="btn-webmcp-invoke"]');
    invokeBtn!.click();
    await new Promise((r) => setTimeout(r, 20));
    const logList = root.querySelector('[data-testid="webmcp-log-list"]');
    expect(logList?.textContent).toContain('rotate_face');

    app.dispose();
    root.remove();
  });
});

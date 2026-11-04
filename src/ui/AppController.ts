import { resolveKeyboardAction } from '../controls/KeyboardController';
import { DIFFICULTY_CONFIGS, parseAlgorithm } from '../core/constants';
import { CubeEngine } from '../core/CubeEngine';
import type { DifficultyLevel, MoveNotation } from '../core/types';
import { CubeScene3D } from '../renderer/CubeScene3D';
import { WebMcpBridge } from '../webmcp/WebMcpBridge';
import { formatElapsedTimerMs, render2DCubeNet } from './CubeNetView';
import { renderAppShellHtml } from './templates';
import { initWebMcpConsoleUI, renderWebMcpLogs } from './WebMcpConsoleView';

export class AppController {
  public readonly engine: CubeEngine;
  public readonly webmcp: WebMcpBridge;
  private scene3d: CubeScene3D | null = null;
  private timerIntervalId: ReturnType<typeof setInterval> | null = null;
  private statusMessage = 'Ready! Choose a difficulty and click Scramble to begin.';

  constructor(rootElement: HTMLElement, options?: { skipWebGL?: boolean }) {
    this.engine = new CubeEngine('medium');

    this.webmcp = new WebMcpBridge(this.engine, {
      onMove: async (notation) => {
        await this.executeMoveWithAnimation(notation);
      },
      onAlgorithm: async (notations) => {
        for (const n of notations) {
          await this.executeMoveWithAnimation(n, 95);
        }
      },
      onScramble: async (opts) => this.scrambleCube(opts?.difficulty, opts?.customLength),
      onReset: async () => {
        this.resetCube();
      },
      onUndo: async () => this.undoMove(),
      onRedo: async () => this.redoMove(),
      onSetDifficulty: (diff) => {
        this.setDifficulty(diff);
      },
    });

    rootElement.innerHTML = renderAppShellHtml(this.engine.getDifficulty(), this.statusMessage);

    if (!options?.skipWebGL) {
      const viewportEl = rootElement.querySelector<HTMLElement>('#cube-viewport');
      if (viewportEl) {
        this.scene3d = new CubeScene3D(viewportEl, this.engine, (notation) => {
          void this.executeMoveWithAnimation(notation);
        });
      }
    }

    this.bindUIEvents(rootElement);
    initWebMcpConsoleUI(rootElement, this.webmcp, (msg) => this.setStatusMessage(msg));

    this.engine.subscribe(() => this.updateUI(rootElement));
    this.webmcp.onLogsChange((logs) => renderWebMcpLogs(rootElement, logs));

    this.timerIntervalId = setInterval(() => {
      this.updateTimerDisplay(rootElement);
    }, 100);

    this.updateUI(rootElement);
  }

  public async executeMoveWithAnimation(
    notation: MoveNotation,
    customDurationMs?: number
  ): Promise<void> {
    const def = this.engine.move(notation, true);
    if (this.scene3d) {
      await this.scene3d.enqueueMoveAnimation(def, customDurationMs);
    }
  }

  public async scrambleCube(
    difficulty?: DifficultyLevel,
    customLength?: number
  ): Promise<MoveNotation[]> {
    const seq = this.engine.scramble({ difficulty, customLength });
    this.scene3d?.rebuildCubiesFromEngine();
    this.setStatusMessage(
      `Scrambled (${DIFFICULTY_CONFIGS[this.engine.getDifficulty()].label}): ${seq.join(' ')}`
    );
    return seq;
  }

  public resetCube(): void {
    this.engine.reset();
    this.scene3d?.rebuildCubiesFromEngine();
    this.setStatusMessage('Cube reset to solved state.');
  }

  public async undoMove(): Promise<MoveNotation | null> {
    const def = this.engine.undo();
    if (!def) {
      this.setStatusMessage('No moves to undo.');
      return null;
    }
    if (this.scene3d) {
      await this.scene3d.enqueueMoveAnimation(def, 140);
    }
    this.setStatusMessage(`Undid move (applied ${def.notation}).`);
    return def.notation;
  }

  public async redoMove(): Promise<MoveNotation | null> {
    const def = this.engine.redo();
    if (!def) {
      this.setStatusMessage('No moves to redo.');
      return null;
    }
    if (this.scene3d) {
      await this.scene3d.enqueueMoveAnimation(def, 140);
    }
    this.setStatusMessage(`Redid move ${def.notation}.`);
    return def.notation;
  }

  public setDifficulty(level: DifficultyLevel): void {
    this.engine.setDifficulty(level);
    const cfg = DIFFICULTY_CONFIGS[level];
    this.setStatusMessage(`Difficulty set to ${cfg.label} — ${cfg.description}`);
  }

  public requestHint(): MoveNotation | null {
    const cfg = DIFFICULTY_CONFIGS[this.engine.getDifficulty()];
    if (!cfg.allowHints) {
      this.setStatusMessage('Hints are disabled in Expert mode!');
      return null;
    }
    const solution = this.engine.getSolutionMoves();
    if (solution.length === 0) {
      this.setStatusMessage('Cube is already solved!');
      return null;
    }
    const nextMove = solution[0];
    this.setStatusMessage(
      `Hint: Perform "${nextMove}" (${solution.length} move${solution.length === 1 ? '' : 's'} remaining)`
    );
    return nextMove;
  }

  public async autoSolve(): Promise<MoveNotation[]> {
    const cfg = DIFFICULTY_CONFIGS[this.engine.getDifficulty()];
    if (!cfg.allowAutoSolve) {
      this.setStatusMessage('Auto-Solve is disabled in Expert mode!');
      return [];
    }
    const solution = this.engine.getSolutionMoves();
    if (solution.length === 0) {
      this.setStatusMessage('Cube is already solved!');
      return [];
    }
    this.setStatusMessage(`Solving in ${solution.length} moves: ${solution.join(' ')}...`);
    for (const move of solution) {
      await this.executeMoveWithAnimation(move, 95);
    }
    this.setStatusMessage(`Solved in ${solution.length} moves!`);
    return solution;
  }

  public setActiveMobileTab(root: HTMLElement, tab: 'moves' | 'net' | 'webmcp'): void {
    const sidebar = root.querySelector<HTMLElement>('.control-sidebar');
    if (sidebar) {
      sidebar.setAttribute('data-active-tab', tab);
    }
    root.querySelectorAll<HTMLButtonElement>('.mobile-tab-btn').forEach((btn) => {
      const isActive = btn.dataset.tab === tab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  private setStatusMessage(msg: string): void {
    this.statusMessage = msg;
    const statusEl = document.getElementById('status-banner-text');
    if (statusEl) {
      statusEl.textContent = msg;
    }
  }

  private bindUIEvents(root: HTMLElement): void {
    const diffSelect = root.querySelector<HTMLSelectElement>('#difficulty-select');
    diffSelect?.addEventListener('change', () => {
      this.setDifficulty(diffSelect.value as DifficultyLevel);
    });

    root.querySelector('#btn-scramble')?.addEventListener('click', () => {
      void this.scrambleCube();
    });
    root.querySelector('#btn-reset')?.addEventListener('click', () => {
      this.resetCube();
    });
    root.querySelector('#btn-hint')?.addEventListener('click', () => {
      this.requestHint();
    });
    root.querySelector('#btn-solve')?.addEventListener('click', () => {
      void this.autoSolve();
    });
    root.querySelector('#btn-undo')?.addEventListener('click', () => {
      void this.undoMove();
    });
    root.querySelector('#btn-redo')?.addEventListener('click', () => {
      void this.redoMove();
    });
    root.querySelector('#btn-reset-camera')?.addEventListener('click', () => {
      this.scene3d?.resetCamera();
    });

    const speedSlider = root.querySelector<HTMLInputElement>('#speed-slider');
    speedSlider?.addEventListener('input', () => {
      this.scene3d?.setAnimationSpeedMs(400 - Number(speedSlider.value));
    });

    root.querySelectorAll<HTMLButtonElement>('.btn-move').forEach((btn) => {
      btn.addEventListener('click', () => {
        const move = btn.dataset.move as MoveNotation | undefined;
        if (move) {
          void this.executeMoveWithAnimation(move);
        }
      });
    });

    root.querySelectorAll<HTMLButtonElement>('.mobile-tab-btn').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        const tab = tabBtn.dataset.tab as 'moves' | 'net' | 'webmcp' | undefined;
        if (tab) {
          this.setActiveMobileTab(root, tab);
        }
      });
    });

    const algoForm = root.querySelector<HTMLFormElement>('#algorithm-form');
    const algoInput = root.querySelector<HTMLInputElement>('#algorithm-input');
    algoForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!algoInput) return;
      try {
        const moves = parseAlgorithm(algoInput.value);
        if (moves.length === 0) return;
        for (const m of moves) {
          await this.executeMoveWithAnimation(m, 110);
        }
        this.setStatusMessage(`Executed algorithm: ${moves.join(' ')}`);
      } catch (err) {
        this.setStatusMessage(err instanceof Error ? err.message : String(err));
      }
    });

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const action = resolveKeyboardAction(e);
      if (!action) return;

      e.preventDefault();
      if (action.type === 'move') void this.executeMoveWithAnimation(action.notation);
      else if (action.type === 'undo') void this.undoMove();
      else if (action.type === 'redo') void this.redoMove();
      else if (action.type === 'scramble') void this.scrambleCube();
      else if (action.type === 'reset') this.resetCube();
      else if (action.type === 'hint') this.requestHint();
    });
  }

  private updateUI(root: HTMLElement): void {
    const state = this.engine.getState();
    const config = DIFFICULTY_CONFIGS[state.difficulty];

    const badgeEl = root.querySelector<HTMLElement>('#cube-state-badge');
    if (badgeEl) {
      badgeEl.textContent = state.isSolved ? 'SOLVED' : 'SCRAMBLED';
      badgeEl.className = `badge ${state.isSolved ? 'badge-solved' : 'badge-scrambled'}`;
    }

    const moveCounterEl = root.querySelector<HTMLElement>('#move-counter');
    if (moveCounterEl) {
      moveCounterEl.textContent = String(state.moveCount);
    }

    const diffSelect = root.querySelector<HTMLSelectElement>('#difficulty-select');
    if (diffSelect && diffSelect.value !== state.difficulty) {
      diffSelect.value = state.difficulty;
    }

    const hintBtn = root.querySelector<HTMLButtonElement>('#btn-hint');
    if (hintBtn) hintBtn.disabled = !config.allowHints;

    const solveBtn = root.querySelector<HTMLButtonElement>('#btn-solve');
    if (solveBtn) solveBtn.disabled = !config.allowAutoSolve;

    const undoBtn = root.querySelector<HTMLButtonElement>('#btn-undo');
    if (undoBtn) undoBtn.disabled = state.moveHistory.length === 0;

    const redoBtn = root.querySelector<HTMLButtonElement>('#btn-redo');
    if (redoBtn) redoBtn.disabled = state.redoStack.length === 0;

    render2DCubeNet(root, state.faces);
    this.updateTimerDisplay(root);
  }

  private updateTimerDisplay(root: HTMLElement): void {
    const timerEl = root.querySelector<HTMLElement>('#timer-display');
    if (timerEl) {
      timerEl.textContent = formatElapsedTimerMs(this.engine.getElapsedMs());
    }
  }

  public dispose(): void {
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
    }
    this.scene3d?.dispose();
    this.webmcp.dispose();
  }
}

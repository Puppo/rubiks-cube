import { resolveKeyboardAction } from '../controls/KeyboardController';
import {
  ALL_BASE_MOVES,
  COLOR_CSS_MAP,
  DIFFICULTY_CONFIGS,
  parseAlgorithm,
} from '../core/constants';
import { CubeEngine } from '../core/CubeEngine';
import type {
  CubeFacesSnapshot,
  DifficultyLevel,
  FaceGrid,
  FaceName,
  MoveNotation,
} from '../core/types';
import { CubeScene3D } from '../renderer/CubeScene3D';
import { WebMcpBridge } from '../webmcp/WebMcpBridge';

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
      onScramble: async (opts) => {
        return this.scrambleCube(opts?.difficulty, opts?.customLength);
      },
      onReset: async () => {
        this.resetCube();
      },
      onUndo: async () => {
        return this.undoMove();
      },
      onRedo: async () => {
        return this.redoMove();
      },
      onSetDifficulty: (diff) => {
        this.setDifficulty(diff);
      },
    });

    this.renderLayout(rootElement);

    if (!options?.skipWebGL) {
      const viewportEl = rootElement.querySelector<HTMLElement>('#cube-viewport');
      if (viewportEl) {
        this.scene3d = new CubeScene3D(viewportEl, this.engine, (notation) => {
          void this.executeMoveWithAnimation(notation);
        });
      }
    }

    this.bindUIEvents(rootElement);
    this.engine.subscribe(() => this.updateUI(rootElement));
    this.webmcp.onLogsChange(() => this.updateWebMcpLogsUI(rootElement));

    this.timerIntervalId = setInterval(() => {
      this.updateTimerDisplay(rootElement);
    }, 100);

    this.updateUI(rootElement);
    this.populateWebMcpToolSelect(rootElement);
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

  private setStatusMessage(msg: string): void {
    this.statusMessage = msg;
    const statusEl = document.getElementById('status-banner-text');
    if (statusEl) {
      statusEl.textContent = msg;
    }
  }

  private renderLayout(root: HTMLElement): void {
    const difficultyOptionsHtml = Object.values(DIFFICULTY_CONFIGS)
      .map(
        (cfg) =>
          `<option value="${cfg.id}" ${cfg.id === this.engine.getDifficulty() ? 'selected' : ''}>${cfg.label}</option>`
      )
      .join('');

    const moveButtonsHtml = ALL_BASE_MOVES.map(
      (base) => `
        <div class="move-pair">
          <button type="button" class="btn-move" data-move="${base}" title="Rotate ${base} clockwise (Key: ${base})">${base}</button>
          <button type="button" class="btn-move btn-move-prime" data-move="${base}'" title="Rotate ${base} counter-clockwise (Key: Shift+${base})">${base}'</button>
        </div>
      `
    ).join('');

    root.innerHTML = `
      <div class="app-shell">
        <header class="topbar">
          <div class="brand">
            <div class="brand-cube-icon" aria-hidden="true">
              <span></span><span></span><span></span>
              <span></span><span></span><span></span>
              <span></span><span></span><span></span>
            </div>
            <div>
              <h1>Rubik's Cube 3D Simulator</h1>
              <p class="subtitle">Three.js • TypeScript • W3C WebMCP Ready</p>
            </div>
          </div>

          <div class="stats-bar" role="region" aria-label="Game statistics">
            <div class="stat-pill">
              <span class="stat-label">State</span>
              <span id="cube-state-badge" class="badge badge-solved" data-testid="state-badge">SOLVED</span>
            </div>
            <div class="stat-pill">
              <span class="stat-label">Moves</span>
              <span id="move-counter" class="stat-value" data-testid="move-counter">0</span>
            </div>
            <div class="stat-pill">
              <span class="stat-label">Timer</span>
              <span id="timer-display" class="stat-value font-mono" data-testid="timer-display">00:00.0</span>
            </div>
          </div>

          <div class="top-actions">
            <label class="difficulty-select-wrapper" for="difficulty-select">
              <span>Difficulty</span>
              <select id="difficulty-select" data-testid="difficulty-select" aria-label="Select difficulty level">
                ${difficultyOptionsHtml}
              </select>
            </label>
            <button type="button" id="btn-scramble" class="btn btn-primary" data-testid="btn-scramble" title="Scramble Cube (Space)">
              Scramble
            </button>
            <button type="button" id="btn-hint" class="btn btn-secondary" data-testid="btn-hint" title="Get Next Move Hint (H)">
              Hint
            </button>
            <button type="button" id="btn-solve" class="btn btn-accent" data-testid="btn-solve" title="Auto-solve from current state">
              Auto-Solve
            </button>
            <button type="button" id="btn-reset" class="btn btn-ghost" data-testid="btn-reset" title="Reset Cube (Esc)">
              Reset
            </button>
          </div>
        </header>

        <main class="workspace">
          <section class="viewport-panel" aria-label="3D Rubik's Cube Viewport">
            <div id="cube-viewport" class="cube-viewport" data-testid="cube-viewport"></div>

            <div class="status-banner" role="status" aria-live="polite">
              <span id="status-banner-text" data-testid="status-banner-text">${this.statusMessage}</span>
            </div>

            <div class="viewport-toolbar">
              <button type="button" id="btn-undo" class="btn btn-sm" data-testid="btn-undo" title="Undo Move (Ctrl+Z)">
                ↶ Undo
              </button>
              <button type="button" id="btn-redo" class="btn btn-sm" data-testid="btn-redo" title="Redo Move (Ctrl+Y)">
                ↷ Redo
              </button>
              <button type="button" id="btn-reset-camera" class="btn btn-sm" title="Reset 3D Camera Angle">
                🎥 Reset Camera
              </button>
              <label class="speed-control" for="speed-slider">
                <span>Speed</span>
                <input id="speed-slider" type="range" min="0" max="400" step="20" value="190" />
              </label>
            </div>

            <div class="interaction-legend">
              <span><strong>Mouse/Touch:</strong> Drag any sticker to turn its layer • Drag background to orbit</span>
              <span><strong>Keyboard:</strong> <kbd>U</kbd> <kbd>D</kbd> <kbd>L</kbd> <kbd>R</kbd> <kbd>F</kbd> <kbd>B</kbd> <kbd>M</kbd> <kbd>E</kbd> <kbd>S</kbd> (+<kbd>Shift</kbd> for counter-clockwise) • <kbd>Space</kbd> Scramble • <kbd>H</kbd> Hint</span>
            </div>
          </section>

          <aside class="control-sidebar" aria-label="Cube Controls and WebMCP Agent Console">
            <!-- 2D Cube Net Unfolded Preview -->
            <div class="card">
              <div class="card-header">
                <h2>2D Cube Net</h2>
                <span class="card-meta">All 6 faces live</span>
              </div>
              <div id="cube-2d-net" class="cube-net" data-testid="cube-2d-net" aria-label="2D unfolded cube state"></div>
            </div>

            <!-- Interactive Move Pad & Algorithm Runner -->
            <div class="card">
              <div class="card-header">
                <h2>Move Controls</h2>
                <span class="card-meta">WCA Notation</span>
              </div>
              <div class="move-grid" data-testid="move-grid">
                ${moveButtonsHtml}
              </div>

              <!-- Declarative WebMCP Form -->
              <form
                id="algorithm-form"
                class="algo-form"
                toolname="execute_algorithm"
                tooldescription="Executes a sequence of Rubik's Cube moves in standard WCA notation"
              >
                <input
                  id="algorithm-input"
                  name="algorithm"
                  type="text"
                  placeholder="Algorithm, e.g. R U R' U'"
                  toolparamdescription="Space-separated move sequence such as R U R' U'"
                  aria-label="Algorithm notation input"
                  data-testid="algorithm-input"
                />
                <button type="submit" class="btn btn-secondary btn-sm" data-testid="btn-run-algo">
                  Run
                </button>
              </form>
            </div>

            <!-- WebMCP AI Agent Inspector & Console -->
            <div class="card webmcp-card">
              <div class="card-header">
                <h2>WebMCP Agent Console</h2>
                <span class="badge badge-webmcp" title="navigator.modelContext is active and exposing structured tools to browser AI agents">
                  navigator.modelContext Ready
                </span>
              </div>
              <p class="webmcp-help">
                AI agents can inspect and solve the cube via <code>navigator.modelContext</code> or test tools below:
              </p>
              <div class="webmcp-tester">
                <select id="webmcp-tool-select" data-testid="webmcp-tool-select" aria-label="Select WebMCP tool"></select>
                <input
                  id="webmcp-args-input"
                  type="text"
                  value='{"move":"R"}'
                  placeholder='JSON args, e.g. {"move":"R"}'
                  aria-label="WebMCP JSON arguments"
                  data-testid="webmcp-args-input"
                />
                <button type="button" id="btn-webmcp-invoke" class="btn btn-primary btn-sm" data-testid="btn-webmcp-invoke">
                  Invoke Tool
                </button>
              </div>
              <div id="webmcp-log-list" class="webmcp-logs" data-testid="webmcp-log-list">
                <div class="webmcp-empty">No WebMCP tool calls recorded yet.</div>
              </div>
            </div>
          </aside>
        </main>
      </div>
    `;
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
      const val = Number(speedSlider.value);
      // Invert slider so sliding right = faster (shorter duration) or use direct ms
      this.scene3d?.setAnimationSpeedMs(400 - val);
    });

    root.querySelectorAll<HTMLButtonElement>('.btn-move').forEach((btn) => {
      btn.addEventListener('click', () => {
        const move = btn.dataset.move as MoveNotation | undefined;
        if (move) {
          void this.executeMoveWithAnimation(move);
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

    // WebMCP tester controls
    const toolSelect = root.querySelector<HTMLSelectElement>('#webmcp-tool-select');
    const argsInput = root.querySelector<HTMLInputElement>('#webmcp-args-input');
    const defaultExamples: Record<string, string> = {
      get_cube_state: '{}',
      rotate_face: '{"move":"R"}',
      execute_algorithm: '{"algorithm":"R U R\' U\'"}',
      scramble_cube: '{"difficulty":"easy"}',
      set_difficulty: '{"difficulty":"hard"}',
      get_hint: '{}',
      solve_cube: '{"execute":true}',
      undo_move: '{}',
      redo_move: '{}',
      reset_cube: '{}',
    };

    toolSelect?.addEventListener('change', () => {
      if (argsInput) {
        argsInput.value = defaultExamples[toolSelect.value] ?? '{}';
      }
    });

    root.querySelector('#btn-webmcp-invoke')?.addEventListener('click', async () => {
      if (!toolSelect || !argsInput) return;
      try {
        const parsedArgs = JSON.parse(argsInput.value || '{}');
        await this.webmcp.callTool(toolSelect.value, parsedArgs);
      } catch (err) {
        this.setStatusMessage(
          `Invalid JSON arguments: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    });

    // Keyboard shortcuts (ignore when typing inside input/select/textarea)
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
      switch (action.type) {
        case 'move':
          void this.executeMoveWithAnimation(action.notation);
          break;
        case 'undo':
          void this.undoMove();
          break;
        case 'redo':
          void this.redoMove();
          break;
        case 'scramble':
          void this.scrambleCube();
          break;
        case 'reset':
          this.resetCube();
          break;
        case 'hint':
          this.requestHint();
          break;
      }
    });
  }

  private populateWebMcpToolSelect(root: HTMLElement): void {
    const select = root.querySelector<HTMLSelectElement>('#webmcp-tool-select');
    if (!select) return;
    const tools = this.webmcp.listTools();
    select.innerHTML = tools.map((t) => `<option value="${t.name}">${t.name}</option>`).join('');
    select.value = 'rotate_face';
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
    if (hintBtn) {
      hintBtn.disabled = !config.allowHints;
    }

    const solveBtn = root.querySelector<HTMLButtonElement>('#btn-solve');
    if (solveBtn) {
      solveBtn.disabled = !config.allowAutoSolve;
    }

    const undoBtn = root.querySelector<HTMLButtonElement>('#btn-undo');
    if (undoBtn) {
      undoBtn.disabled = state.moveHistory.length === 0;
    }

    const redoBtn = root.querySelector<HTMLButtonElement>('#btn-redo');
    if (redoBtn) {
      redoBtn.disabled = state.redoStack.length === 0;
    }

    this.render2DNet(root, state.faces);
    this.updateTimerDisplay(root);
  }

  private render2DNet(root: HTMLElement, faces: CubeFacesSnapshot): void {
    const netContainer = root.querySelector<HTMLElement>('#cube-2d-net');
    if (!netContainer) return;

    const renderFaceGrid = (faceName: FaceName, grid: FaceGrid): string => {
      const cells = grid
        .flat()
        .map(
          (color) =>
            `<span class="net-sticker" style="background-color: ${COLOR_CSS_MAP[color]}" data-color="${color}"></span>`
        )
        .join('');
      return `<div class="net-face net-face-${faceName}" data-face="${faceName}" title="Face ${faceName}">${cells}</div>`;
    };

    netContainer.innerHTML = `
      <div class="net-row">
        <div class="net-spacer"></div>
        ${renderFaceGrid('U', faces.U)}
        <div class="net-spacer"></div>
        <div class="net-spacer"></div>
      </div>
      <div class="net-row">
        ${renderFaceGrid('L', faces.L)}
        ${renderFaceGrid('F', faces.F)}
        ${renderFaceGrid('R', faces.R)}
        ${renderFaceGrid('B', faces.B)}
      </div>
      <div class="net-row">
        <div class="net-spacer"></div>
        ${renderFaceGrid('D', faces.D)}
        <div class="net-spacer"></div>
        <div class="net-spacer"></div>
      </div>
    `;
  }

  private updateTimerDisplay(root: HTMLElement): void {
    const timerEl = root.querySelector<HTMLElement>('#timer-display');
    if (!timerEl) return;
    const ms = this.engine.getElapsedMs();
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    const tenths = Math.floor((ms % 1000) / 100);
    timerEl.textContent = `${minutes}:${seconds}.${tenths}`;
  }

  private updateWebMcpLogsUI(root: HTMLElement): void {
    const logList = root.querySelector<HTMLElement>('#webmcp-log-list');
    if (!logList) return;
    const logs = this.webmcp.getLogs();
    if (logs.length === 0) {
      logList.innerHTML = `<div class="webmcp-empty">No WebMCP tool calls recorded yet.</div>`;
      return;
    }

    logList.innerHTML = logs
      .slice(0, 8)
      .map(
        (entry) => `
        <div class="webmcp-log-item ${entry.result.isError ? 'log-error' : 'log-ok'}">
          <div class="log-top">
            <strong>${entry.toolName}</strong>
            <span>${entry.durationMs}ms</span>
          </div>
          <div class="log-args">Args: <code>${JSON.stringify(entry.args)}</code></div>
          <div class="log-summary">${entry.result.structuredContent?.summary ?? entry.result.content[0]?.text ?? ''}</div>
        </div>
      `
      )
      .join('');
  }

  public dispose(): void {
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
    }
    this.scene3d?.dispose();
    this.webmcp.dispose();
  }
}

import { ALL_BASE_MOVES, DIFFICULTY_CONFIGS } from '../core/constants';
import type { DifficultyLevel } from '../core/types';

export function renderAppShellHtml(
  currentDifficulty: DifficultyLevel,
  statusMessage: string
): string {
  const difficultyOptionsHtml = Object.values(DIFFICULTY_CONFIGS)
    .map(
      (cfg) =>
        `<option value="${cfg.id}" ${cfg.id === currentDifficulty ? 'selected' : ''}>${cfg.label}</option>`
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

  return `
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
            <span id="status-banner-text" data-testid="status-banner-text">${statusMessage}</span>
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
          <div class="card">
            <div class="card-header">
              <h2>2D Cube Net</h2>
              <span class="card-meta">All 6 faces live</span>
            </div>
            <div id="cube-2d-net" class="cube-net" data-testid="cube-2d-net" aria-label="2D unfolded cube state"></div>
          </div>

          <div class="card">
            <div class="card-header">
              <h2>Move Controls</h2>
              <span class="card-meta">WCA Notation</span>
            </div>
            <div class="move-grid" data-testid="move-grid">
              ${moveButtonsHtml}
            </div>

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

# Rubik's Cube 3D Simulator (Three.js + TypeScript + WebMCP)

An interactive 3D Rubik's Cube web simulator built with **Three.js**, **TypeScript**, and **Vite**, featuring realistic 3D rendering, multiple difficulty presets, full **Mouse/Touch**, **Keyboard**, and **W3C WebMCP (`navigator.modelContext`)** support for AI agents.

## Features

- **Realistic 3D Rubik's Cube (`Three.js`)**:
  - 26 individual bevel-edged cubies (`RoundedBoxGeometry`) with glossy physical materials (`MeshPhysicalMaterial`), studio lighting, soft shadows, and smooth layer rotation animations.
  - Synchronized live **2D Unfolded Cube Net** showing all 6 faces (`U`, `L`, `F`, `R`, `B`, `D`) simultaneously.
- **Difficulty Levels**:
  - **Beginner** (4-move scramble, hints & auto-solver enabled)
  - **Easy** (8-move scramble, hints & auto-solver enabled)
  - **Medium** (14-move scramble, hints & auto-solver enabled)
  - **Hard** (20-move standard WCA random scramble, hints & auto-solver enabled)
  - **Expert** (25-move deep scramble, hints & auto-solver disabled)
- **Three Ways to Interact**:
  1. **Mouse / Touch**:
     - Drag directly on any 3D sticker to rotate the corresponding face or middle slice along your drag direction.
     - Drag the background canvas to orbit the 3D camera (`OrbitControls`), or use the on-screen Move Pad buttons.
  2. **Keyboard Shortcuts**:
     - `U`, `D`, `L`, `R`, `F`, `B`, `M`, `E`, `S`: Rotate layer 90° clockwise
     - `Shift + Key`: Rotate layer 90° counter-clockwise (`'`)
     - `Ctrl/Cmd + Z`: Undo move
     - `Ctrl/Cmd + Y` (or `Ctrl/Cmd + Shift + Z`): Redo move
     - `Space`: Scramble cube at current difficulty
     - `H`: Request next optimal move hint
     - `Escape`: Reset cube to solved state
  3. **AI Agents via WebMCP (`navigator.modelContext`)**:
     - Exposes structured client-side tools via the W3C / Chrome WebMCP specification (`navigator.modelContext.registerTool`) as well as declarative HTML attributes (`toolname`, `tooldescription`, `toolparamdescription`) and an in-page **WebMCP Agent Console**.

## WebMCP Tools Reference

Browser AI agents can discover and invoke the following tools via `navigator.modelContext`:

| Tool Name           | Description                                                                                                                 | Input Schema Parameters                          |
| :------------------ | :-------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------- |
| `get_cube_state`    | Returns the complete cube state (`isSolved`, `faceletString`, 6 face 3x3 grids, ASCII net diagram, move count, difficulty). | `{}`                                             |
| `rotate_face`       | Executes a single move in WCA notation (`U`, `U'`, `U2`, `D`, `L`, `R`, `F`, `B`, `M`, `E`, `S`).                           | `{ "move": "R" }`                                |
| `execute_algorithm` | Executes a space-separated sequence of moves.                                                                               | `{ "algorithm": "R U R' U'" }`                   |
| `scramble_cube`     | Resets and scrambles the cube at a chosen difficulty or custom move length.                                                 | `{ "difficulty": "medium", "customLength": 14 }` |
| `set_difficulty`    | Changes the difficulty level (`beginner`, `easy`, `medium`, `hard`, `expert`).                                              | `{ "difficulty": "hard" }`                       |
| `get_hint`          | Returns the next recommended move and remaining move count toward solving the cube.                                         | `{}`                                             |
| `solve_cube`        | Computes and optionally executes the full solution sequence from the current state.                                         | `{ "execute": true }`                            |
| `undo_move`         | Undoes the last executed move.                                                                                              | `{}`                                             |
| `redo_move`         | Redoes the most recently undone move.                                                                                       | `{}`                                             |
| `reset_cube`        | Resets the cube immediately to the solved state.                                                                            | `{}`                                             |

## Requirements

- **Node.js**: `>= 26.0.0`
- **Package Manager**: `npm >= 11.0.0`

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Type-check with TypeScript
npm run typecheck

# Lint source and test files with Oxlint
npm run lint

# Format and verify formatting with Oxfmt
npm run format
npm run format:check

# Run unit & integration tests with coverage
npm run test:ci

# Build production bundle for GitHub Pages
npm run build
```

## Deployment (GitHub Pages & CI)

The repository includes two GitHub Actions workflows ([`.github/workflows/ci.yml`](.github/workflows/ci.yml) for continuous integration and [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) for deployment on push to `main`) running on **Node.js 26** and pre-commit hooks via **Lefthook** ([`lefthook.yml`](lefthook.yml)) that automatically:

1. Installs dependencies via `npm ci`
2. Runs TypeScript type checking (`npm run typecheck`)
3. Runs Oxlint (`npm run lint`)
4. Verifies code formatting with Oxfmt (`npm run format:check`)
5. Runs the Vitest suite with coverage (`npm run test:ci`)
6. Builds the static production bundle (`npm run build`) and deploys `./dist` to **GitHub Pages**.

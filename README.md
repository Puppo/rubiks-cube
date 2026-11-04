# 🧊 Rubik's Cube 3D Simulator — Three.js + TypeScript + WebMCP 🤖

[![CI](https://github.com/Puppo/rubiks-cube/actions/workflows/ci.yml/badge.svg)](https://github.com/Puppo/rubiks-cube/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/Puppo/rubiks-cube/actions/workflows/deploy.yml/badge.svg)](https://github.com/Puppo/rubiks-cube/actions/workflows/deploy.yml)
[![Node.js >= 26](https://img.shields.io/badge/node-%3E%3D26.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript 7](https://img.shields.io/badge/TypeScript-7.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r187-000000?logo=three.js&logoColor=white)](https://threejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

> ✨ **An interactive, physically-based 3D Rubik's Cube simulator** built with **Three.js**, **TypeScript**, and **Vite** — playable via **Mouse/Touch**, **Keyboard**, and **AI Agents using W3C WebMCP (`navigator.modelContext`)**!

---

## 🌟 Highlights & Features

- 🎨 **Realistic 3D Studio Rendering (`Three.js`)**
  - 26 individual bevel-edged cubies (`RoundedBoxGeometry`) with glossy clearcoat stickers (`MeshPhysicalMaterial`), soft studio lighting, shadow-catching floor, and cubic ease-out layer animations.
- 🗺️ **Live 2D Unfolded Cube Net**
  - Real-time synchronized 2D cross net (`U`, `L`, `F`, `R`, `B`, `D`) in the sidebar so you can inspect all 6 faces at a glance.
- 🎯 **5 Difficulty Levels**
  - 🌱 **Beginner** (`4 moves`) — Gentle scramble with step-by-step hints & auto-solver enabled.
  - 🟢 **Easy** (`8 moves`) — Short scramble ideal for practicing layer recognition.
  - 🟡 **Medium** (`14 moves`) — Balanced scramble requiring multi-step planning.
  - 🟠 **Hard** (`20 moves - WCA`) — Standard WCA-length random scramble.
  - 🔴 **Expert** (`25 moves - No Hints`) — Deep scramble with hints and auto-solver disabled for a pure speedcubing challenge.
- 🧠 **Smart Hint & Auto-Solver Engine**
  - Combines bounded Breadth-First Search (BFS) for short direct solutions with algebraic move reduction to guide you step-by-step or solve the cube automatically.
- ⏱️ **Speedcubing Telemetry**
  - Live tenth-of-a-second timer (`00:00.0`), move counter, full Undo/Redo stack, and adjustable rotation speed slider.
- 🤖 **First-Class W3C WebMCP Support (`navigator.modelContext`)**
  - Built-in support for the **Web Model Context Protocol**, allowing browser-based AI agents to inspect the cube state, request hints, execute algorithms, and solve the puzzle deterministically — plus an interactive **in-page WebMCP Agent Console**!

---

## 🎮 Three Ways to Play

### 1️⃣ 🖱️ Mouse & Touch Controls

| Action                     | Gesture                                                                                                                                          |
| :------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔄 **Rotate a Cube Layer** | Click/touch and drag directly across any **3D sticker** in the direction you want that slice to turn                                             |
| 🎥 **Orbit 3D Camera**     | Click/touch and drag on the **background canvas** (or use scroll/pinch to zoom)                                                                  |
| 🎛️ **On-Screen Move Pad**  | Click any WCA notation button (`U`, `U'`, `D`, `D'`, `L`, `L'`, `R`, `R'`, `F`, `F'`, `B`, `B'`, `M`, `E`, `S`) or run a custom algorithm string |

### 2️⃣ ⌨️ Keyboard Shortcuts

| Key / Shortcut                                                                | Action                                                           |
| :---------------------------------------------------------------------------- | :--------------------------------------------------------------- |
| <kbd>U</kbd> <kbd>D</kbd> <kbd>L</kbd> <kbd>R</kbd> <kbd>F</kbd> <kbd>B</kbd> | Rotate outer face **90° clockwise**                              |
| <kbd>M</kbd> <kbd>E</kbd> <kbd>S</kbd>                                        | Rotate middle slice (`Middle`, `Equatorial`, `Standing`) **90°** |
| <kbd>Shift</kbd> + <kbd>U</kbd>…<kbd>S</kbd>                                  | Rotate face or slice **90° counter-clockwise (`'`)**             |
| <kbd>Space</kbd>                                                              | 🎲 **Scramble** the cube at the selected difficulty              |
| <kbd>H</kbd>                                                                  | 💡 **Hint** — highlight the next recommended move                |
| <kbd>Ctrl/Cmd</kbd> + <kbd>Z</kbd>                                            | ↶ **Undo** the last move                                         |
| <kbd>Ctrl/Cmd</kbd> + <kbd>Y</kbd>                                            | ↷ **Redo** the previously undone move                            |
| <kbd>Esc</kbd>                                                                | 🔄 **Reset** the cube to the solved state                        |

### 3️⃣ 🤖 AI Agents via WebMCP (`navigator.modelContext`)

AI agents running in the browser (or via MCP bridges) can discover and call structured tools directly through `navigator.modelContext` or `window.rubiksWebMCP`:

| 🛠️ Tool Name        | 📝 Description                                                                                                         | 📥 Example Input JSON        |
| :------------------ | :--------------------------------------------------------------------------------------------------------------------- | :--------------------------- |
| `get_cube_state`    | Returns `isSolved`, `faceletString`, all 6 faces as 3×3 color grids, an ASCII net diagram, move count, and difficulty. | `{}`                         |
| `rotate_face`       | Executes a single WCA move (`U`, `U'`, `U2`, `D`, `L`, `R`, `F`, `B`, `M`, `E`, `S`).                                  | `{"move": "R"}`              |
| `execute_algorithm` | Executes a space-separated sequence of moves in standard WCA notation.                                                 | `{"algorithm": "R U R' U'"}` |
| `scramble_cube`     | Resets and scrambles the cube using a difficulty preset or custom move count.                                          | `{"difficulty": "medium"}`   |
| `set_difficulty`    | Switches the active difficulty preset (`beginner`, `easy`, `medium`, `hard`, `expert`).                                | `{"difficulty": "hard"}`     |
| `get_hint`          | Computes the next optimal move and remaining move count toward solving the cube.                                       | `{}`                         |
| `solve_cube`        | Computes and optionally executes the complete solution sequence from the current state.                                | `{"execute": true}`          |
| `undo_move`         | Undoes the last executed move.                                                                                         | `{}`                         |
| `redo_move`         | Redoes the most recently undone move.                                                                                  | `{}`                         |
| `reset_cube`        | Resets the cube immediately to its clean solved state.                                                                 | `{}`                         |

---

## 🏗️ Project Architecture

```text
rubiks-cube/
├── .github/workflows/
│   ├── ci.yml                  # 🔍 Continuous Integration (Typecheck, Oxlint, Oxfmt, Vitest, Build)
│   └── deploy.yml              # 🚀 GitHub Pages deployment on push to main
├── src/
│   ├── index.html              # 🌐 Entry HTML (with declarative WebMCP form attributes)
│   ├── main.ts                 # ⚡ Application bootstrap
│   ├── style.css               # 🎨 Main stylesheet entry point
│   ├── styles/                 # 💅 Modular CSS (base, viewport, sidebar)
│   ├── core/                   # 🧮 Pure mathematical 3x3x3 engine & solver
│   │   ├── types.ts            #    Core types & state interfaces
│   │   ├── constants.ts        #    Colors, difficulty presets, WCA move specs
│   │   ├── notation.ts         #    Parser, move inversion & algebraic simplification
│   │   ├── geometry.ts         #    3D integer vector rotations & face projections
│   │   ├── ScrambleGenerator.ts#    WCA scramble generator & BFS/inverse solver
│   │   └── CubeEngine.ts       #    Stateful cube engine & event emitter
│   ├── controls/               # 🎮 Input math & controllers
│   │   ├── dragMath.ts         #    3D surface drag cross-product resolver (ω = n × u)
│   │   └── KeyboardController.ts#   Keyboard shortcut mapper
│   ├── renderer/               # 🎥 Three.js 3D visualization
│   │   ├── SceneLighting.ts    #    Studio lighting & shadow plane
│   │   ├── CubieMeshFactory.ts #    Rounded cubies & clearcoat stickers
│   │   ├── PointerDragHandler.ts#   Raycasting & pointer surface drag handler
│   │   └── CubeScene3D.ts      #    3D scene & animation queue manager
│   ├── webmcp/                 # 🤖 W3C WebMCP integration
│   │   ├── types.ts            #    WebMCP schemas & tool interfaces
│   │   ├── modelContextShim.ts #    navigator.modelContext polyfill & bridge
│   │   ├── cubeTools.ts        #    10 Rubik's Cube tool definitions
│   │   └── WebMcpBridge.ts     #    Tool registry, execution & live logger
│   └── ui/                     # 🖥️ DOM UI & state synchronization
│       ├── templates.ts        #    HTML layout templates
│       ├── CubeNetView.ts      #    2D unfolded cube net & timer formatter
│       ├── WebMcpConsoleView.ts#    In-page WebMCP inspector & log viewer
│       └── AppController.ts    #    Main UI controller
└── tests/                      # 🧪 Vitest unit & integration test suites
```

---

## 🚀 Quick Start

### 📋 Prerequisites

- 🟢 **Node.js**: `>= 26.0.0`
- 📦 **npm**: `>= 11.0.0`

### 💻 Installation & Commands

```bash
# 📥 Install dependencies
npm install

# 🔥 Start local development server (http://localhost:5173)
npm run dev

# 🔎 Run TypeScript 7 type checking
npm run typecheck

# ⚡ Lint code with Oxlint
npm run lint

# ✨ Format & check formatting with Oxfmt
npm run format
npm run format:check

# 🧪 Run unit & integration tests with coverage (Vitest)
npm run test:ci

# 📦 Build production bundle to ./dist
npm run build
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! 🎉  
Please read our [**Contributing Guide (`CONTRIBUTING.md`)**](./CONTRIBUTING.md) for details on our code of conduct, development workflow, pre-commit hooks, and pull request process.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for more information.

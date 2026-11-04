# 🤝 Contributing to Rubik's Cube 3D Simulator 🧊

Thank you for your interest in contributing to **Rubik's Cube 3D Simulator**! 🎉  
Whether you are fixing a bug, adding a new feature, improving 3D shaders, or expanding WebMCP agent tools, this guide will help you get started smoothly.

---

## 🛠️ Development Environment Setup

### 1️⃣ Prerequisites

Make sure you have the required runtime versions installed:

- 🟢 **Node.js**: `>= 26.0.0` (`node -v`)
- 📦 **npm**: `>= 11.0.0` (`npm -v`)
- 🐙 **Git**: `>= 2.40`

### 2️⃣ Clone & Install

```bash
git clone https://github.com/Puppo/rubiks-cube.git
cd rubiks-cube
npm install
```

> 💡 **Note:** Running `npm install` automatically triggers `npm run prepare`, which sets up **Lefthook** pre-commit hooks if your Git environment supports local hook paths.

---

## 🧭 Project Structure Guidelines

To keep the codebase clean, readable, and maintainable, we follow a strict **modular architecture** where each file has a single clear responsibility:

- 🧮 **`src/core/`**: Pure TypeScript mathematical logic (`CubeEngine`, `notation`, `geometry`, `ScrambleGenerator`). **No DOM or Three.js imports** should ever be added inside `src/core/`.
- 🎮 **`src/controls/`**: Pure input translation functions (`dragMath.ts` for 3D cross-product drag resolution, `KeyboardController.ts` for keyboard mappings).
- 🎥 **`src/renderer/`**: Three.js scene setup, lighting, cubie mesh factory, raycasting, and quaternion/pivot animations.
- 🤖 **`src/webmcp/`**: W3C `navigator.modelContext` shim, JSON Schema tool definitions, and execution logging.
- 🖥️ **`src/ui/` & `src/styles/`**: DOM rendering templates, 2D net preview, WebMCP console UI, and modular CSS files.
- 🧪 **`tests/`**: Vitest unit and integration tests mirroring the `src/` modules.

---

## 🧪 Quality Checks, Linting & Formatting

We use ultra-fast modern tooling to keep code quality high:

- ⚡ **Oxlint (`oxlint`)**: Zero-warning linter (`npm run lint`)
- ✨ **Oxfmt (`oxfmt`)**: Code formatter (`npm run format` & `npm run format:check`)
- 🔷 **TypeScript 7 (`tsc`)**: Strict static type checking (`npm run typecheck`)
- 🧪 **Vitest (`vitest`)**: Unit & DOM integration tests with V8 coverage (`npm run test:ci`)
- 🥊 **Lefthook (`lefthook`)**: Parallel `pre-commit` hook runner

Before opening a Pull Request, run the full verification suite locally:

```bash
# ✨ Format all files
npm run format

# ⚡ Check lint rules (0 warnings allowed)
npm run lint

# 🔎 Verify TypeScript types
npm run typecheck

# 🧪 Run all tests with coverage
npm run test:ci

# 📦 Verify production build succeeds
npm run build
```

---

## 📝 Commit Message Conventions

We follow the [**Conventional Commits**](https://www.conventionalcommits.org/) specification:

- ✨ `feat: ...` — A new feature (e.g., `feat: add 2-look OLL hint explanations`)
- 🐛 `fix: ...` — A bug fix (e.g., `fix: prevent camera orbit when dragging slice center`)
- ♻️ `refactor: ...` — A code change that neither fixes a bug nor adds a feature
- 🧪 `test: ...` — Adding or updating tests
- 📚 `docs: ...` — Documentation updates (`README.md`, `CONTRIBUTING.md`)
- 🔧 `ci: ...` / `chore: ...` — Build scripts, GitHub Actions workflows, or dependency updates

---

## 🚀 Pull Request Process

1. 🌿 **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. ✍️ **Write your code and tests**:
   - All code, comments, UI strings, and documentation **must be written in English**.
   - Add unit or integration tests in `tests/` for any new cube logic, controls, or WebMCP tools.
3. ✅ **Verify all checks pass**:
   - Ensure `npm run format:check`, `npm run lint`, `npm run typecheck`, and `npm run test:ci` pass with zero errors.
4. 📤 **Push your branch and open a Pull Request** targeting `main`:
   - The **CI workflow (`.github/workflows/ci.yml`)** will automatically run on your PR.
   - Once merged into `main`, the **Deploy workflow (`.github/workflows/deploy.yml`)** will automatically publish the updated simulator to **GitHub Pages**! 🌐

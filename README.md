# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  # ParaForge

  Browser-based Parabox level editor.

  - Parabox `.txt` parsing/serialization lives in `src/parabox/format.ts` (spec: `docs/file-format.md`).
  - The editor UI is `src/editor/LevelEditor.tsx` (canvas renderer + basic tools).

  ## Run

  ```zsh
  pnpm install
  pnpm dev
  ```

  ## Controls

  - Left click: use current tool
  - Right click: erase (wall/floor/ref)
  - Shift + drag: pan
  - Mouse wheel: zoom
  - `Ctrl/Cmd+Z`: undo, `Shift+Ctrl/Cmd+Z`: redo

  ## Import / Export

  - Click **Export** to dump the current level text.
  - Paste a `.txt` into the textarea and click **Import from text**.
  - **Download** saves `level.txt`.


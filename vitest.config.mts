import { defineConfig } from "vitest/config";

export default defineConfig({
  // Next preserves JSX for its own compiler; the SSR regression test needs
  // Vite to transform it with React's automatic runtime instead.
  oxc: { jsx: { runtime: "automatic" } },
});

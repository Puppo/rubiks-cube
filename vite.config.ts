import { defineConfig } from 'vitest/config';

const projectRoot = new URL('.', import.meta.url).pathname;

export default defineConfig({
  root: 'src',
  base: './',
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    hmr: {
      clientPort: 443,
    },
  },
  preview: {
    host: true,
    port: 5173,
    allowedHosts: true,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'esnext',
  },
  test: {
    root: projectRoot,
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/vite-env.d.ts', 'src/renderer/**'],
    },
  },
});

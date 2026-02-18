import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/bin/cli.ts'],
  format: ['cjs'],
  outDir: 'dist/bin',
  target: 'node18',
  shims: true,
  clean: true,
  splitting: false,
  sourcemap: false,
  minify: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
});

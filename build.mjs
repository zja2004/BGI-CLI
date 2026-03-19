import { build } from 'esbuild';
import { writeFileSync, readFileSync } from 'fs';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/bgi.js',
  banner: { js: '#!/usr/bin/env node' },
  minify: false,
  sourcemap: false,
  external: [],
});

console.log('✓ Built dist/bgi.js');

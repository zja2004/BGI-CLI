import { build } from 'esbuild';
import { readFileSync } from 'fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

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
  define: { __APP_VERSION__: JSON.stringify(version) },
});

console.log('✓ Built dist/bgi.js');

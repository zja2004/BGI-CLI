import { build } from 'esbuild';
import { readFileSync } from 'fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

for (const brand of ['bgi', 'bio', 'mbp']) {
  await build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    outfile: `dist/${brand}.js`,
    banner: { js: '#!/usr/bin/env node' },
    minify: false,
    sourcemap: false,
    external: [],
    define: {
      __APP_VERSION__: JSON.stringify(version),
      'process.env.BGICLI_BRAND': JSON.stringify(brand),
    },
  });
  console.log(`✓ Built dist/${brand}.js`);
}

// Spaja server/core.ts i src/lib u jednu datoteku za Supabase Edge Function.
import { build } from 'esbuild';

await build({
  entryPoints: ['server/core.ts'],
  outfile: 'supabase/functions/api/core.js',
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  external: ['node:crypto', 'node:buffer'],
  banner: { js: '// Ne uređuj: nastaje iz server/core.ts (npm run build:edge).' },
});
console.log('supabase/functions/api/core.js');

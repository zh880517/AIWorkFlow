import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const sharedSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'shared', 'src');

export default defineConfig({
  resolve: {
    alias: [
      // 与 scripts/build-plugin.mjs 的别名保持一致：`@shared/x.js` → `shared/src/x.ts`
      { find: /^@shared\/(.*)\.js$/, replacement: path.join(sharedSrc, '$1.ts') },
      { find: '@shared', replacement: sharedSrc },
    ],
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});

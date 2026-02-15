import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'server/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    exclude: [
      'node_modules',
      'dist',
      'admin',
      'client',
    ],
    coverage: {
      provider: 'v8',
      include: [
        'server/lib/**',
        'server/utils/**',
        'server/routes/**',
      ],
      exclude: [
        'server/routes.ts', // 레거시 파일은 제외
      ],
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
});

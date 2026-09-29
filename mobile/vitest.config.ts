import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Unit tests for plain TypeScript modules (no React Native runtime).
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src'), '@shared': path.resolve(__dirname, '../shared/src/index.ts') } },
  test: { include: ['src/**/__tests__/**/*.test.ts'] },
});

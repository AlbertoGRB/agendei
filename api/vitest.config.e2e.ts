import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Os arquivos de teste dividem o mesmo banco, então rodam um de cada vez.
    fileParallelism: false,
  },
});

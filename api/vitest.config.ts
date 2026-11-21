import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // RNF07: as regras de horário têm mais de 80% de cobertura. O CI roda
    // `npm run test:cov` e falha abaixo disso.
    coverage: {
      include: ['src/bookings/slots.ts', 'src/bookings/local-time.ts'],
      thresholds: { lines: 80, branches: 80, functions: 80 },
    },
  },
});

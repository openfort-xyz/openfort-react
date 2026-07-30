import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globals: true,
    typecheck: {
      include: ['src/**/*.test-d.ts'],
      tsconfig: './tsconfig.check.json',
    },
    coverage: {
      // `lcov` is the machine-readable format CI artifacts and code-host
      // annotations consume; locally the text summary plus a browsable HTML
      // report is more useful.
      reporter: process.env.CI ? ['lcov'] : ['text', 'json', 'html'],
      include: ['src/**'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.test-d.ts',
        'src/**/*.d.ts',
        'src/__tests__/**',
        // Static SVG/JSX artwork and localization tables carry no branching
        // logic, so their coverage numbers only dilute the signal.
        'src/assets/**',
        'src/localizations/locales/**',
        // Type-only modules compile away entirely and report as 0% forever.
        'src/shared/types.ts',
        'src/ethereum/types.ts',
        'src/solana/types.ts',
      ],
    },
  },
})

import peerDepsExternal from 'rollup-plugin-peer-deps-external'
import typescript from 'rollup-plugin-typescript2'
import { createTransformer as createStyledComponentsTransformer } from 'typescript-plugin-styled-components'
import { preserveUseClient } from './rollup.use-client.js'

const styledComponentsTransformer = createStyledComponentsTransformer({
  displayName: true,
})

export default {
  input: [
    './src/index.ts',
    './src/ethereum/index.ts',
    './src/solana/index.ts',
    './src/wagmi/index.ts',
    './src/internal/index.ts',
  ],
  external: ['react', 'react-dom', 'framer-motion', 'styled-components'],
  output: {
    dir: 'build',
    format: 'esm',
    preserveModules: true,
    preserveModulesRoot: 'src',
    sourcemap: false,
  },
  plugins: [
    peerDepsExternal(),
    typescript({
      useTsconfigDeclarationDir: true,
      include: ['**/*.ts', '**/*.tsx'],
      exclude: 'node_modules/**',
      transformers: [
        () => ({
          before: [styledComponentsTransformer],
        }),
      ],
    }),
    preserveUseClient(),
  ],
}

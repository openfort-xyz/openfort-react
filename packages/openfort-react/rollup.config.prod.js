import peerDepsExternal from 'rollup-plugin-peer-deps-external'
import typescript from 'rollup-plugin-typescript2'
import { preserveUseClient } from './rollup.use-client.js'

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
    sourcemap: true,
  },
  plugins: [
    peerDepsExternal(),
    typescript({
      useTsconfigDeclarationDir: true,
      include: ['**/*.ts', '**/*.tsx'],
      exclude: 'node_modules/**',
    }),
    preserveUseClient(),
  ],
}

import MagicString from 'magic-string'
import peerDepsExternal from 'rollup-plugin-peer-deps-external'
import typescript from 'rollup-plugin-typescript2'
import { createTransformer as createStyledComponentsTransformer } from 'typescript-plugin-styled-components'

const styledComponentsTransformer = createStyledComponentsTransformer({
  displayName: true,
})

/**
 * Re-adds the `'use client'` directive that TypeScript strips during compilation, so locally
 * linked dev builds behave like production for Next.js App Router / RSC consumers. See the
 * prod config for details. `\s` matches a leading BOM.
 */
function preserveUseClientDirective() {
  const clientModules = new Set()
  const LEADING_DIRECTIVE = /^\s*(['"])use client\1/
  return {
    name: 'preserve-use-client',
    transform(code, id) {
      if (LEADING_DIRECTIVE.test(code)) clientModules.add(id)
      return null
    },
    renderChunk(code, chunk) {
      const moduleIds = Object.keys(chunk.modules ?? {})
      const isClient =
        (chunk.facadeModuleId && clientModules.has(chunk.facadeModuleId)) ||
        moduleIds.some((id) => clientModules.has(id))
      if (!isClient || LEADING_DIRECTIVE.test(code)) return null
      const s = new MagicString(code)
      s.prepend(`'use client';\n`)
      return { code: s.toString(), map: s.generateMap({ hires: true }) }
    },
  }
}

export default {
  input: ['./src/index.ts', './src/ethereum/index.ts', './src/solana/index.ts', './src/wagmi/index.ts'],
  external: ['react', 'react-dom', 'framer-motion', 'styled-components'],
  output: {
    dir: 'build',
    format: 'esm',
    preserveModules: true,
    preserveModulesRoot: 'src',
    sourcemap: false,
  },
  plugins: [
    preserveUseClientDirective(),
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
  ],
}

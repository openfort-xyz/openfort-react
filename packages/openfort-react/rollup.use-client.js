import { readFileSync } from 'node:fs'

const directive = "'use client';"
const directivePattern = /^\s*(['"])use client\1\s*;?/

/**
 * Restores the `'use client'` directive on every chunk whose source module
 * declares it.
 *
 * Rollup lifts module-level directives out of the AST while parsing and never
 * writes them back, so without this the published modules ship unmarked and any
 * React Server Component importing them fails to build.
 *
 * `output.preserveModules` keeps one chunk per source module, so a chunk's
 * facade module is the single file the directive belongs to and it can be read
 * straight back off disk. The directive is prepended in `generateBundle`, after
 * source maps are rendered, and stays on the chunk's first line so every
 * existing mapping keeps pointing at the right line.
 *
 * @returns {import('rollup').Plugin}
 */
export function preserveUseClient() {
  return {
    name: 'preserve-use-client',
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue
        const id = chunk.facadeModuleId
        if (!id || !/\.tsx?$/.test(id)) continue
        if (directivePattern.test(chunk.code)) continue
        if (!directivePattern.test(readFileSync(id, 'utf8'))) continue
        chunk.code = `${directive}${chunk.code}`
      }
    },
  }
}

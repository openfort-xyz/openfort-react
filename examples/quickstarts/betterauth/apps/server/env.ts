import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

// Resolve relative to this package so `pnpm dev` behaves the same whether it is
// launched from the example directory or from the repository root.
config({ path: fileURLToPath(new URL('.env', import.meta.url)) })

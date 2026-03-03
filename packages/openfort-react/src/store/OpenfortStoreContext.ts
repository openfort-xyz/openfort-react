import { createContext } from 'react'
import type { OpenfortStoreApi } from './openfortStore'

export const OpenfortStoreContext = createContext<OpenfortStoreApi | null>(null)

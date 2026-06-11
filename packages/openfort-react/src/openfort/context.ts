'use client'

import { createContext } from 'react'
import type { StoreApi } from 'zustand'
import type { OpenfortStore } from './store'

export const StoreContext = createContext<StoreApi<OpenfortStore> | null>(null)

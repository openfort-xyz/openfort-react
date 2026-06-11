import { vi } from 'vitest'

// Suppress logger output during tests
vi.mock('../utils/logger', () => ({
  logger: {
    enabled: false,
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

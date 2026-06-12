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

// Under this vitest + jsdom combination, `localStorage`/`sessionStorage` land as
// bare objects without the full Storage API (e.g. `clear`/`removeItem`). Install
// a minimal, spec-shaped in-memory Storage so storage-dependent code and tests
// behave like a browser.
class MemoryStorage {
  private store = new Map<string, string>()
  get length(): number {
    return this.store.size
  }
  clear(): void {
    this.store.clear()
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  const existing = (globalThis as Record<string, unknown>)[name] as Storage | undefined
  if (!existing || typeof existing.clear !== 'function') {
    Object.defineProperty(globalThis, name, {
      value: new MemoryStorage() as unknown as Storage,
      configurable: true,
    })
  }
}

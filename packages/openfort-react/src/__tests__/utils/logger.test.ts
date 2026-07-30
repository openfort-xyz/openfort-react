import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'
import { logger, setDebugLogsEnabled } from '../../utils/logger.js'

// The shared test setup mocks the logger to keep other suites quiet; exercise the real one here.
vi.unmock('../../utils/logger')

const PREFIX = '[Openfort-React]'

describe('logger', () => {
  let log: MockInstance
  let warn: MockInstance
  let error: MockInstance

  beforeEach(() => {
    log = vi.spyOn(console, 'log').mockImplementation(() => {})
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    error = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    setDebugLogsEnabled(false)
    vi.restoreAllMocks()
  })

  it('emits errors and warnings while debug logs are disabled', () => {
    setDebugLogsEnabled(false)

    logger.error('boom', { code: 1 })
    logger.warn('careful')

    expect(error).toHaveBeenCalledWith(PREFIX, 'boom', { code: 1 })
    expect(warn).toHaveBeenCalledWith(PREFIX, 'careful')
  })

  it('suppresses log while debug logs are disabled', () => {
    setDebugLogsEnabled(false)

    logger.log('chatty')

    expect(log).not.toHaveBeenCalled()
  })

  it('emits log once debug logs are enabled', () => {
    setDebugLogsEnabled(true)

    logger.log('chatty', 42)

    expect(log).toHaveBeenCalledWith(PREFIX, 'chatty', 42)
  })

  it('stops emitting log after debug logs are turned back off', () => {
    setDebugLogsEnabled(true)
    logger.log('first')
    setDebugLogsEnabled(false)
    logger.log('second')

    expect(log).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith(PREFIX, 'first')
  })
})

/**
 * Playwright global setup for fork-backed runs: boots one anvil instance forking
 * {@link FORK_CHAIN} at {@link FORK_BLOCK_NUMBER} and blocks until it answers RPC.
 *
 * A single instance is shared by every worker because the playground reads its RPC
 * URL from a build-time `VITE_` variable — one dev server means one fork URL. The
 * fork-backed Playwright project therefore runs with a single worker so the specs
 * never race on shared chain state.
 */

import { type ChildProcess, spawn } from 'node:child_process'
import { createPublicClient, http } from 'viem'
import {
  ANVIL_PORT,
  ANVIL_RPC_URL,
  FORK_BLOCK_NUMBER,
  FORK_CHAIN,
  FORK_UPSTREAM_URL,
  forkUpstreamOrigin,
  redactForkDiagnostics,
} from './fork.js'

const READY_TIMEOUT_MS = 90_000
const POLL_INTERVAL_MS = 250

/** Polls the instance until it serves `eth_blockNumber`, or fails with anvil's own stderr. */
async function waitUntilReady(anvil: ChildProcess, stderr: () => string): Promise<void> {
  const client = createPublicClient({ chain: FORK_CHAIN, transport: http(ANVIL_RPC_URL) })
  const deadline = Date.now() + READY_TIMEOUT_MS

  while (Date.now() < deadline) {
    if (anvil.exitCode !== null) {
      throw new Error(`anvil exited with code ${anvil.exitCode} before serving requests.\n${stderr()}`)
    }
    try {
      await client.getBlockNumber({ cacheTime: 0 })
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }
  }

  throw new Error(
    `anvil did not answer on ${ANVIL_RPC_URL} within ${READY_TIMEOUT_MS}ms. ` +
      `Check that ${forkUpstreamOrigin(FORK_UPSTREAM_URL)} is reachable.\n${stderr()}`
  )
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  const anvil = spawn(
    'anvil',
    [
      '--port',
      String(ANVIL_PORT),
      '--chain-id',
      String(FORK_CHAIN.id),
      '--fork-url',
      FORK_UPSTREAM_URL,
      '--fork-block-number',
      String(FORK_BLOCK_NUMBER),
      '--silent',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  )

  let stderr = ''
  anvil.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString()
  })

  anvil.on('error', (error) => {
    stderr += `${error.message}\nIs foundry installed? See https://getfoundry.sh\n`
  })

  const stop = () => {
    if (anvil.exitCode === null) anvil.kill('SIGTERM')
  }
  // Safety net for an aborted run (Ctrl-C, crash), where the teardown never runs.
  process.on('exit', stop)

  try {
    await waitUntilReady(anvil, () => redactForkDiagnostics(stderr))
  } catch (error) {
    stop()
    throw error
  }

  return async () => {
    process.off('exit', stop)
    stop()
  }
}

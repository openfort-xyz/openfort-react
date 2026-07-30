/**
 * Reads and writes the {@link FORK_MINT_CONTRACT} ERC-20 directly on the anvil fork.
 *
 * Specs use these to put a known token balance on chain and then assert the
 * playground renders it — the write goes to the fork rather than through the app,
 * which is what makes the resulting balance exact instead of best-effort.
 */

import { createPublicClient, createWalletClient, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { ANVIL_FUNDER_KEY, ANVIL_RPC_URL, FORK_CHAIN, FORK_MINT_CONTRACT } from './fork'

const TOKEN_ABI = parseAbi([
  'function mint(address to, uint256 amount)',
  'function balanceOf(address account) view returns (uint256)',
])

/** The token uses 18 decimals, matching the playground's `formatUnits(balance, 18)`. */
const TOKEN_DECIMALS = 18n

/** Converts whole tokens to the contract's base units. */
export function tokens(whole: bigint): bigint {
  return whole * 10n ** TOKEN_DECIMALS
}

const publicClient = createPublicClient({ chain: FORK_CHAIN, transport: http(ANVIL_RPC_URL) })

const walletClient = createWalletClient({
  account: privateKeyToAccount(ANVIL_FUNDER_KEY),
  chain: FORK_CHAIN,
  transport: http(ANVIL_RPC_URL),
})

/** Token balance of `account` on the fork, in base units. */
export function forkTokenBalance(account: `0x${string}`): Promise<bigint> {
  return publicClient.readContract({
    address: FORK_MINT_CONTRACT,
    abi: TOKEN_ABI,
    functionName: 'balanceOf',
    args: [account],
  })
}

/** Mints `amount` base units to `account` on the fork and resolves once mined. */
export async function mintOnFork(account: `0x${string}`, amount: bigint): Promise<void> {
  const hash = await walletClient.writeContract({
    address: FORK_MINT_CONTRACT,
    abi: TOKEN_ABI,
    functionName: 'mint',
    args: [account, amount],
  })
  await publicClient.waitForTransactionReceipt({ hash })
}

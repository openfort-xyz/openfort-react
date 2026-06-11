const TW = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains'

// Unified symbol -> logo URL map (works for both native and ERC20)
export const TOKEN_LOGO: Record<string, string> = {
  // Native tokens (chain logos from Trust Wallet info/)
  ETH: `${TW}/ethereum/info/logo.png`,
  BNB: `${TW}/smartchain/info/logo.png`,
  TBNB: `${TW}/smartchain/info/logo.png`,
  MATIC: `${TW}/polygon/info/logo.png`,
  POL: `${TW}/polygon/info/logo.png`,
  AVAX: `${TW}/avalanchec/info/logo.png`,
  FTM: `${TW}/fantom/info/logo.png`,
  CELO: `${TW}/celo/info/logo.png`,
  FIL: `${TW}/filecoin/info/logo.png`,
  METIS: `${TW}/metis/info/logo.png`,
  IOTX: `${TW}/iotex/info/logo.png`,
  EVMOS: `${TW}/evmos/info/logo.png`,
  XDAI: `${TW}/xdai/info/logo.png`,
  FLR: `${TW}/flare/info/logo.png`,
  TLOS: `${TW}/telos/info/logo.png`,
  // ERC20 tokens (using mainnet Ethereum addresses)
  USDC: `${TW}/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png`,
  USDT: `${TW}/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png`,
  DAI: `${TW}/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png`,
  WETH: `${TW}/ethereum/assets/0xC02aaA39b223FE8D0A0e5c4F27eAD9083C756Cc2/logo.png`,
  WBTC: `${TW}/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png`,
  LINK: `${TW}/ethereum/assets/0x514910771AF9Ca656af840dff83E8264EcF986CA/logo.png`,
  UNI: `${TW}/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png`,
  AAVE: `${TW}/ethereum/assets/0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9/logo.png`,
  MKR: `${TW}/ethereum/assets/0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2/logo.png`,
  CRV: `${TW}/ethereum/assets/0xD533a949740bb3306d119CC777fa900bA034cd52/logo.png`,
  LDO: `${TW}/ethereum/assets/0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32/logo.png`,
  SHIB: `${TW}/ethereum/assets/0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE/logo.png`,
  ARB: `${TW}/arbitrum/assets/0x912CE59144191C1204E64559FE8253a0e49E6548/logo.png`,
  OP: `${TW}/optimism/assets/0x4200000000000000000000000000000000000042/logo.png`,
  STETH: `${TW}/ethereum/assets/0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84/logo.png`,
  CBETH: `${TW}/ethereum/assets/0xBe9895146f7AF43049ca1c1AE358B0541Ea49704/logo.png`,
  RETH: `${TW}/ethereum/assets/0xae78736Cd615f374D3085123A210448E74Fc6393/logo.png`,
  GRT: `${TW}/ethereum/assets/0xc944E90C64B2c07662A292be6244BDf05Cda44a7/logo.png`,
  SNX: `${TW}/ethereum/assets/0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F/logo.png`,
  COMP: `${TW}/ethereum/assets/0xc00e94Cb662C3520282E6f5717214004A7f26888/logo.png`,
  PEPE: `${TW}/ethereum/assets/0x6982508145454Ce325dDbE47a25d4ec3d2311933/logo.png`,
  SUSHI: `${TW}/ethereum/assets/0x6B3595068778DD592e39A122f4f5a5cF09C90fE2/logo.png`,
  DYDX: `${TW}/ethereum/assets/0x92D6C1e31e14520e676a687F0a93788B716BEff5/logo.png`,
  BEAM: `${TW}/ethereum/assets/0x62D0A8458eD7719FDAF978fe5929C6D342B0bFcE/logo.png`,
  EUL: `${TW}/ethereum/assets/0xd9Fcd98c322942075A5C3860693e9f4f03AAE07b/logo.png`,
}

// Deterministic color from symbol string (only used if no logo is found)
export function symbolToColor(symbol: string): string {
  let hash = 0
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = ((hash % 360) + 360) % 360
  return `hsl(${h}, 55%, 50%)`
}

// Network config for the two chains this dashboard talks to (CLAUDE.md
// "Chain: MST Blockchain" table + the local Hardhat fallback used for the
// M8 fallback drill). Keep this the single source the rest of the app reads
// from — never hardcode a chain id or RPC URL elsewhere.

export type NetworkKey = "local" | "mst";

export interface NetworkConfig {
  key: NetworkKey;
  label: string;
  chainId: number;
  /** EIP-1193 hex chain id, e.g. "0x5752035". */
  chainIdHex: string;
  rpcUrl: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  explorerUrl: string | null;
}

const MST_CHAIN_ID = 91562037;

export const NETWORKS: Record<NetworkKey, NetworkConfig> = {
  local: {
    key: "local",
    label: "Local Hardhat",
    chainId: 31337,
    chainIdHex: "0x" + (31337).toString(16),
    rpcUrl: "http://127.0.0.1:8545",
    nativeCurrency: { name: "Hardhat ETH", symbol: "ETH", decimals: 18 },
    // A local Hardhat tx hash does not resolve on any public explorer.
    // Never build an explorer link for this network (CLAUDE.md, §10 of
    // ARCHITECTURE.md).
    explorerUrl: null,
  },
  mst: {
    key: "mst",
    label: "MST Testnet",
    chainId: MST_CHAIN_ID,
    chainIdHex: "0x" + MST_CHAIN_ID.toString(16),
    rpcUrl: "https://testnetrpc.mstblockchain.com",
    nativeCurrency: { name: "tMSTC", symbol: "tMSTC", decimals: 18 },
    explorerUrl: "https://testnet.mstscan.com",
  },
};

export const DEFAULT_NETWORK: NetworkKey = "local";

export function networkByChainId(chainId: number): NetworkConfig | undefined {
  return Object.values(NETWORKS).find((n) => n.chainId === chainId);
}

export function explorerTxUrl(network: NetworkConfig, txHash: string): string | null {
  if (!network.explorerUrl) return null;
  return `${network.explorerUrl}/tx/${txHash}`;
}

import { useCallback, useEffect, useState } from "react";
import { BrowserProvider, type JsonRpcSigner } from "ethers";
import type { NetworkConfig } from "../config/networks";

export interface WalletState {
  account: string | null;
  /** The chain id MetaMask itself is currently on — NOT the dashboard's
   * selected network. The two can disagree (e.g. dropdown on "mst" while
   * MetaMask is still on Hardhat); callers must check before sending. */
  chainId: number | null;
  connecting: boolean;
  error: string | null;
}

/**
 * Wraps the injected EIP-1193 provider (MetaMask). User keys never leave
 * the wallet — this hook only ever asks MetaMask to sign, per the
 * "User keys stay in MetaMask" rule.
 */
export function useWallet() {
  const [state, setState] = useState<WalletState>({
    account: null,
    chainId: null,
    connecting: false,
    error: null,
  });

  const getBrowserProvider = useCallback((): BrowserProvider => {
    if (!window.ethereum) {
      throw new Error("No injected wallet found. Install MetaMask.");
    }
    return new BrowserProvider(window.ethereum);
  }, []);

  const refresh = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      const provider = getBrowserProvider();
      const accounts = (await provider.send("eth_accounts", [])) as string[];
      const network = await provider.getNetwork();
      setState((s) => ({ ...s, account: accounts[0] ?? null, chainId: Number(network.chainId) }));
    } catch {
      // Wallet may be locked or mid-transition; leave prior state as-is.
    }
  }, [getBrowserProvider]);

  useEffect(() => {
    refresh();
    const eth = window.ethereum;
    if (!eth?.on) return;
    const onAccountsChanged = () => void refresh();
    const onChainChanged = () => void refresh();
    eth.on("accountsChanged", onAccountsChanged);
    eth.on("chainChanged", onChainChanged);
    return () => {
      eth.removeListener?.("accountsChanged", onAccountsChanged);
      eth.removeListener?.("chainChanged", onChainChanged);
    };
  }, [refresh]);

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, connecting: true, error: null }));
    try {
      const provider = getBrowserProvider();
      await provider.send("eth_requestAccounts", []);
      await refresh();
    } catch (err) {
      setState((s) => ({ ...s, error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setState((s) => ({ ...s, connecting: false }));
    }
  }, [getBrowserProvider, refresh]);

  const getSigner = useCallback(async (): Promise<JsonRpcSigner> => {
    const provider = getBrowserProvider();
    return provider.getSigner();
  }, [getBrowserProvider]);

  /** wallet_switchEthereumChain, falling back to wallet_addEthereumChain on
   * error code 4902 ("Unrecognized chain ID") — used both for the explicit
   * "Add MST Testnet" button and silently before any write tx. */
  const switchOrAddNetwork = useCallback(
    async (network: NetworkConfig) => {
      const eth = window.ethereum;
      if (!eth) throw new Error("No injected wallet found. Install MetaMask.");
      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: network.chainIdHex }],
        });
      } catch (err) {
        const code = (err as { code?: number } | null)?.code;
        if (code === 4902) {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: network.chainIdHex,
                chainName: network.label,
                rpcUrls: [network.rpcUrl],
                nativeCurrency: network.nativeCurrency,
                blockExplorerUrls: network.explorerUrl ? [network.explorerUrl] : undefined,
              },
            ],
          });
        } else {
          throw err;
        }
      }
      await refresh();
    },
    [refresh],
  );

  return { ...state, connect, getSigner, switchOrAddNetwork, getBrowserProvider };
}

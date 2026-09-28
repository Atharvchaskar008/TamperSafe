import type { Eip1193Provider } from "ethers";

// MetaMask (and other injected wallets) attach `window.ethereum`. We only
// need the EIP-1193 request surface plus the two events the wallet emits
// when the user switches accounts or networks — ethers' BrowserProvider
// wraps the rest.
interface InjectedProvider extends Eip1193Provider {
  isMetaMask?: boolean;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: InjectedProvider;
  }
}

export {};

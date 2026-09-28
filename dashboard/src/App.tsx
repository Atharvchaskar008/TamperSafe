import { useState } from "react";
import { DEFAULT_NETWORK, NETWORKS, type NetworkKey } from "./config/networks";
import { useWallet } from "./hooks/useWallet";
import { WalletBar } from "./components/WalletBar";

export function App() {
  const wallet = useWallet();
  const [networkKey, setNetworkKey] = useState<NetworkKey>(DEFAULT_NETWORK);
  const network = NETWORKS[networkKey];

  return (
    <div className="app">
      <header>
        <h1>TamperSafe</h1>
        <WalletBar wallet={wallet} networkKey={networkKey} onNetworkChange={setNetworkKey} />
      </header>

      <nav className="tabs">
        <span className="tabs-note">
          Connected to {network.label}. Buyer / Courier tabs land in the next commits.
        </span>
      </nav>
    </div>
  );
}

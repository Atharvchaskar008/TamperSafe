import { useState } from "react";
import { DEFAULT_NETWORK, NETWORKS, type NetworkKey } from "./config/networks";
import { useWallet } from "./hooks/useWallet";
import { WalletBar } from "./components/WalletBar";
import { BuyerTab } from "./components/BuyerTab";
import { CourierTab } from "./components/CourierTab";

type TabKey = "buyer" | "courier";

export function App() {
  const wallet = useWallet();
  const [networkKey, setNetworkKey] = useState<NetworkKey>(DEFAULT_NETWORK);
  const [tab, setTab] = useState<TabKey>("buyer");
  const network = NETWORKS[networkKey];

  return (
    <div className="app">
      <header>
        <h1>TamperSafe</h1>
        <WalletBar wallet={wallet} networkKey={networkKey} onNetworkChange={setNetworkKey} />
      </header>

      <nav className="tabs">
        <button type="button" className={tab === "buyer" ? "active" : ""} onClick={() => setTab("buyer")}>
          Buyer
        </button>
        <button type="button" className={tab === "courier" ? "active" : ""} onClick={() => setTab("courier")}>
          Courier
        </button>
        <span className="tabs-note">Depot · Track · Evidence — pending relayer routes (M5 remainder)</span>
      </nav>

      <main>
        {tab === "buyer" && <BuyerTab network={network} wallet={wallet} />}
        {tab === "courier" && <CourierTab network={network} wallet={wallet} />}
      </main>
    </div>
  );
}

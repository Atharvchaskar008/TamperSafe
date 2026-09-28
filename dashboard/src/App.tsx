import { useState } from "react";
import { DEFAULT_NETWORK, NETWORKS, type NetworkKey } from "./config/networks";
import { useWallet } from "./hooks/useWallet";
import { ShadcnDashboard } from "./components/ShadcnDashboard";
import { BuyerTab } from "./components/BuyerTab";
import { CourierTab } from "./components/CourierTab";
import { INITIAL_CONTAINERS } from "./data/mockFleetData";
import { SmartContainer } from "./types/commandCenter";

export type ActiveAppTab = "console" | "buyer" | "courier";

export function App() {
  const wallet = useWallet();
  const [networkKey, setNetworkKey] = useState<NetworkKey>(DEFAULT_NETWORK);
  const [activeTab, setActiveTab] = useState<ActiveAppTab>("console");
  const network = NETWORKS[networkKey];

  const [containers, setContainers] = useState<SmartContainer[]>(INITIAL_CONTAINERS);
  const [selectedContainerId, setSelectedContainerId] = useState<string>("TS-BOX-03");

  // Simulation controls
  const handleSimulateTamper = () => {
    setContainers(prev =>
      prev.map(b =>
        b.id === "TS-BOX-03"
          ? {
              ...b,
              status: "TAMPERED",
              telemetry: {
                ...b.telemetry,
                lidDistanceMm: 14.2,
                latchStrainNm: 38.5,
                accelG: 9.4,
                nvsLatchState: "TAMPER_LATCHED",
              },
            }
          : b
      )
    );
    setSelectedContainerId("TS-BOX-03");
  };

  const handleSimulateDelivery = () => {
    setContainers(prev =>
      prev.map(b =>
        b.id === selectedContainerId
          ? {
              ...b,
              status: "DELIVERED",
              telemetry: {
                ...b.telemetry,
                lidDistanceMm: 0.2,
                latchStrainNm: 0,
                latchServoAngle: 90,
                nvsLatchState: "SECURE",
              },
            }
          : b
      )
    );
  };

  const handleReset = () => {
    setContainers(INITIAL_CONTAINERS);
    setSelectedContainerId("TS-BOX-03");
  };

  return (
    <div className="w-screen h-screen bg-black text-white overflow-hidden font-sans select-none">
      {activeTab === "console" ? (
        <ShadcnDashboard
          containers={containers}
          selectedContainerId={selectedContainerId}
          onSelectContainer={setSelectedContainerId}
          onSimulateTamper={handleSimulateTamper}
          onSimulateDelivery={handleSimulateDelivery}
          onReset={handleReset}
          networkKey={networkKey}
          onNetworkChange={setNetworkKey}
          wallet={wallet}
          onNavigateTab={setActiveTab}
        />
      ) : (
        <div className="w-full h-full flex flex-col bg-black overflow-y-auto no-scrollbar">
          {/* Header to switch back */}
          <header className="w-full border-b border-zinc-800 bg-black px-6 h-14 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveTab("console")}
                className="text-xs font-medium text-zinc-400 hover:text-white flex items-center gap-1.5"
              >
                <span>&larr;</span> Back to Console
              </button>
              <span className="text-zinc-600">/</span>
              <span className="text-xs font-semibold text-white uppercase">
                {activeTab === "buyer" ? "Buyer Escrow Portal" : "Courier Bond Portal"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("buyer")}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  activeTab === "buyer"
                    ? "bg-white text-black font-semibold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Buyer
              </button>
              <button
                onClick={() => setActiveTab("courier")}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  activeTab === "courier"
                    ? "bg-white text-black font-semibold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Courier
              </button>
            </div>
          </header>

          <main className="max-w-4xl mx-auto w-full p-8">
            {activeTab === "buyer" && <BuyerTab network={network} wallet={wallet} />}
            {activeTab === "courier" && <CourierTab network={network} wallet={wallet} />}
          </main>
        </div>
      )}
    </div>
  );
}

export default App;

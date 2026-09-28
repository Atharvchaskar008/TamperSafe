import React from 'react';
import type { NetworkConfig, NetworkKey } from '../../config/networks';
import type { useWallet } from '../../hooks/useWallet';
import { WalletBar } from '../WalletBar';

export type DashboardTab = 'track' | 'evidence' | 'depot' | 'buyer' | 'courier';

interface TopBarProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  wallet: ReturnType<typeof useWallet>;
  networkKey: NetworkKey;
  onNetworkChange: (key: NetworkKey) => void;
  onSimulateTamper: () => void;
  onSimulateDelivery: () => void;
  onReset: () => void;
  isTampered: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onTabChange,
  wallet,
  networkKey,
  onNetworkChange,
  onSimulateTamper,
  onSimulateDelivery,
  onReset,
  isTampered,
}) => {
  return (
    <header className="h-14 bg-black border-b border-[#2a2f34] px-4 flex items-center justify-between select-none">
      {/* Brand & Minimal Mode Badges */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-[#EB0C0D] rounded-[1px] inline-block" />
          <span className="font-bold text-[16px] text-white tracking-tight font-sans">TamperSafe</span>
        </div>

        {/* Section 3 Mode Badges: chain, box, GPS */}
        <div className="hidden md:flex items-center gap-1.5 font-mono text-[10px]">
          <span className="px-2 py-0.5 border border-[#2a2f34] bg-[#0c0d10] text-[#ffffff80] uppercase">
            CHAIN: <strong className="text-white">{networkKey}</strong>
          </span>
          <span className="px-2 py-0.5 border border-[#2a2f34] bg-[#0c0d10] text-[#ffffff80] uppercase">
            BOX: <strong className="text-white">SIM</strong>
          </span>
          <span className="px-2 py-0.5 border border-[#2a2f34] bg-[#0c0d10] text-[#ffffff80] uppercase">
            GPS: <strong className="text-white">LIVE</strong>
          </span>
          {isTampered && (
            <span className="px-2 py-0.5 border border-[#EB0C0D] bg-[#EB0C0D]/20 text-[#EB0C0D] font-bold uppercase">
              BREACH DETECTED
            </span>
          )}
        </div>
      </div>

      {/* 5 Clean Tabs from docs/dashboard.md */}
      <div className="flex items-center gap-1 font-mono text-[11px] uppercase">
        {(['track', 'evidence', 'depot', 'buyer', 'courier'] as const).map(tabKey => (
          <button
            key={tabKey}
            onClick={() => onTabChange(tabKey)}
            className={`px-3 py-1.5 border rounded-[2px] transition-colors ${
              activeTab === tabKey
                ? 'bg-[#EB0C0D] border-[#EB0C0D] text-white font-bold'
                : 'bg-black border-[#2a2f34] text-[#ffffff80] hover:text-white hover:border-[#ffffff50]'
            }`}
          >
            {tabKey}
          </button>
        ))}
      </div>

      {/* Sim Controls & Wallet */}
      <div className="flex items-center gap-2">
        <div className="hidden lg:flex items-center gap-1 font-mono text-[10px]">
          <button
            onClick={onSimulateTamper}
            className="px-2 py-1 bg-[#EB0C0D]/20 border border-[#EB0C0D] text-[#EB0C0D] hover:bg-[#EB0C0D] hover:text-white rounded-[2px] font-bold uppercase transition-colors"
            title="Simulate tamper breach on TS-BOX-03"
          >
            Sim Tamper
          </button>
          <button
            onClick={onSimulateDelivery}
            className="px-2 py-1 bg-black border border-[#2a2f34] text-[#ffffff80] hover:text-white hover:border-white rounded-[2px] uppercase transition-colors"
            title="Confirm unlock on TS-BOX-02"
          >
            Confirm Unlock
          </button>
          <button
            onClick={onReset}
            className="px-2 py-1 bg-black border border-[#2a2f34] text-[#fff6] hover:text-white rounded-[2px] uppercase transition-colors"
          >
            Reset
          </button>
        </div>

        <WalletBar wallet={wallet} networkKey={networkKey} onNetworkChange={onNetworkChange} />
      </div>
    </header>
  );
};

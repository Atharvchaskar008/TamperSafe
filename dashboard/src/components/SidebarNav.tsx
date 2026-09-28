import React from 'react';
import { type NetworkKey, NETWORKS } from '../config/networks';
import { type useWallet } from '../hooks/useWallet';

export type ViewMode = 'overview' | '01-map' | '02-evidence' | '03-settlement' | 'buyer' | 'courier';

interface SidebarNavProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  isTampered: boolean;
  networkKey: NetworkKey;
  onNetworkChange: (key: NetworkKey) => void;
  wallet: ReturnType<typeof useWallet>;
  onSimulateTamper: () => void;
  onSimulateDelivery: () => void;
  onReset: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  currentView,
  onSelectView,
  isTampered,
  networkKey,
  onNetworkChange,
  wallet,
  onSimulateTamper,
  onSimulateDelivery,
  onReset,
}) => {
  const selectedNetwork = NETWORKS[networkKey];
  const walletNetwork = wallet.chainId != null
    ? Object.values(NETWORKS).find(n => n.chainId === wallet.chainId)
    : undefined;

  return (
    <aside className="w-64 h-full bg-[#050608] border-r border-[#2a2f34] flex flex-col justify-between flex-shrink-0 select-none font-mono text-white z-30">
      {/* Top: Brand Header & Invariant Statuses */}
      <div className="flex flex-col">
        {/* Brand Bar */}
        <div 
          onClick={() => onSelectView('overview')}
          className="h-16 px-5 border-b border-[#2a2f34] flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-3.5 h-3.5 bg-[#EB0C0D] rounded-[1px] inline-block shadow-[0_0_8px_rgba(235,12,13,0.5)]" />
            <div className="flex flex-col">
              <span className="font-bold text-[17px] text-white tracking-tight font-sans leading-none">
                TamperSafe
              </span>
              <span className="text-[9px] text-[#ffffff60] uppercase tracking-widest mt-1">
                COMMAND CENTER
              </span>
            </div>
          </div>
          <span className="text-[9px] border border-[#2a2f34] px-1.5 py-0.5 rounded text-[#ffffff60]">
            v2.4
          </span>
        </div>

        {/* Live System Invariant Badges */}
        <div className="p-3.5 border-b border-[#2a2f34] bg-black/60">
          <div className="text-[9px] text-[#ffffff50] uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>SYSTEM INVARIANTS</span>
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-[9px]">
            <div className="bg-[#0b0d11] border border-[#2a2f34] p-1.5 rounded-[2px] flex flex-col items-center">
              <span className="text-[#ffffff50] text-[8px]">CHAIN</span>
              <span className="font-bold text-white mt-0.5">{networkKey}</span>
            </div>
            <div className="bg-[#0b0d11] border border-[#2a2f34] p-1.5 rounded-[2px] flex flex-col items-center">
              <span className="text-[#ffffff50] text-[8px]">BOX</span>
              <span className="font-bold text-white mt-0.5">SIM</span>
            </div>
            <div className="bg-[#0b0d11] border border-[#2a2f34] p-1.5 rounded-[2px] flex flex-col items-center">
              <span className="text-[#ffffff50] text-[8px]">GPS</span>
              <span className="font-bold text-emerald-400 mt-0.5">LIVE</span>
            </div>
          </div>

          {isTampered && (
            <div className="mt-2 px-2 py-1.5 bg-[#EB0C0D]/15 border border-[#EB0C0D] rounded-[2px] flex items-center justify-between text-[10px] text-[#EB0C0D] font-bold animate-pulse">
              <span className="flex items-center gap-1.5">
                <span>⚡</span> BREACH ACTIVE
              </span>
              <span className="text-[9px] font-mono">TS-BOX-03</span>
            </div>
          )}
        </div>

        {/* Main Workspaces Navigation */}
        <div className="p-3.5 flex flex-col gap-1 border-b border-[#2a2f34]">
          <div className="text-[9px] text-[#ffffff50] uppercase tracking-wider mb-1 px-1">
            WORKSPACES
          </div>

          {/* 00 Overview (Start Screen) */}
          <button
            onClick={() => onSelectView('overview')}
            className={`w-full text-left px-3 py-2.5 rounded-[3px] border transition-all flex items-center justify-between ${
              currentView === 'overview'
                ? 'bg-white text-black border-white font-bold'
                : 'bg-black/40 border-transparent text-[#ffffff80] hover:text-white hover:border-[#2a2f34]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-[1px] ${currentView === 'overview' ? 'bg-black' : 'bg-white/40'}`} />
              <span className="text-[11px]">00 // OVERVIEW</span>
            </div>
            {currentView === 'overview' && <span className="text-[10px]">&bull;</span>}
          </button>

          {/* 01 Google Map */}
          <button
            onClick={() => onSelectView('01-map')}
            className={`w-full text-left px-3 py-2.5 rounded-[3px] border transition-all flex items-center justify-between ${
              currentView === '01-map'
                ? 'bg-white text-black border-white font-bold'
                : 'bg-black/40 border-transparent text-[#ffffff80] hover:text-white hover:border-[#2a2f34]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-[1px] ${currentView === '01-map' ? 'bg-black' : 'bg-[#2a2f34]'}`} />
              <span className="text-[11px]">01 // GOOGLE MAP</span>
            </div>
            {currentView === '01-map' && <span className="text-[10px]">&bull;</span>}
          </button>

          {/* 02 Evidence Audit */}
          <button
            onClick={() => onSelectView('02-evidence')}
            className={`w-full text-left px-3 py-2.5 rounded-[3px] border transition-all flex items-center justify-between ${
              currentView === '02-evidence'
                ? isTampered
                  ? 'bg-[#EB0C0D] border-[#EB0C0D] text-white font-bold shadow-[0_0_12px_rgba(235,12,13,0.3)]'
                  : 'bg-white text-black border-white font-bold'
                : isTampered
                ? 'bg-[#EB0C0D]/10 border-[#EB0C0D]/50 text-[#EB0C0D]'
                : 'bg-black/40 border-transparent text-[#ffffff80] hover:text-white hover:border-[#2a2f34]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-[1px] ${isTampered ? 'bg-[#EB0C0D]' : currentView === '02-evidence' ? 'bg-black' : 'bg-[#2a2f34]'}`} />
              <span className="text-[11px]">02 // EVIDENCE AUDIT</span>
            </div>
            {isTampered && <span className="text-[10px]">⚡</span>}
          </button>

          {/* 03 Settlement & Depot */}
          <button
            onClick={() => onSelectView('03-settlement')}
            className={`w-full text-left px-3 py-2.5 rounded-[3px] border transition-all flex items-center justify-between ${
              currentView === '03-settlement'
                ? 'bg-white text-black border-white font-bold'
                : 'bg-black/40 border-transparent text-[#ffffff80] hover:text-white hover:border-[#2a2f34]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-[1px] ${currentView === '03-settlement' ? 'bg-black' : 'bg-[#2a2f34]'}`} />
              <span className="text-[11px]">03 // SETTLEMENT</span>
            </div>
            {currentView === '03-settlement' && <span className="text-[10px]">&bull;</span>}
          </button>
        </div>

        {/* Roles & Actors */}
        <div className="p-3.5 flex flex-col gap-1 border-b border-[#2a2f34]">
          <div className="text-[9px] text-[#ffffff50] uppercase tracking-wider mb-1 px-1">
            PARTICIPANT PORTALS
          </div>

          <button
            onClick={() => onSelectView('buyer')}
            className={`w-full text-left px-3 py-2 rounded-[3px] border transition-all flex items-center justify-between ${
              currentView === 'buyer'
                ? 'bg-white/20 text-white border-white/60 font-bold'
                : 'bg-black/20 border-transparent text-[#ffffff70] hover:text-white hover:border-[#2a2f34]'
            }`}
          >
            <span className="text-[11px]">BUYER CONSIGNMENT</span>
            <span className="text-[9px] text-[#ffffff40]">ESCROW</span>
          </button>

          <button
            onClick={() => onSelectView('courier')}
            className={`w-full text-left px-3 py-2 rounded-[3px] border transition-all flex items-center justify-between ${
              currentView === 'courier'
                ? 'bg-white/20 text-white border-white/60 font-bold'
                : 'bg-black/20 border-transparent text-[#ffffff70] hover:text-white hover:border-[#2a2f34]'
            }`}
          >
            <span className="text-[11px]">COURIER TRANSIT</span>
            <span className="text-[9px] text-[#ffffff40]">BOND</span>
          </button>
        </div>

        {/* Simulation Drills */}
        <div className="p-3.5 flex flex-col gap-2">
          <div className="text-[9px] text-[#ffffff50] uppercase tracking-wider px-1">
            SIMULATION DRILLS
          </div>

          <button 
            onClick={onSimulateTamper}
            className="w-full cta-btn-red text-[10px] py-1.5 justify-center"
          >
            <span>SIMULATE TAMPER</span>
            <span>⚡</span>
          </button>

          <button 
            onClick={onSimulateDelivery}
            className="w-full cta-btn-black text-[10px] py-1.5 justify-center"
          >
            <span>CONFIRM UNLOCK</span>
            <span>✓</span>
          </button>

          <button 
            onClick={onReset}
            className="w-full text-[10px] py-1 text-[#ffffff50] hover:text-white transition-colors text-center border border-dashed border-[#2a2f34] rounded"
          >
            RESET ALL BOXES
          </button>
        </div>
      </div>

      {/* Bottom: Network Selector & Wallet */}
      <div className="p-3.5 border-t border-[#2a2f34] bg-black/80 flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-[#ffffff50]">NETWORK:</span>
          <select 
            value={networkKey} 
            onChange={(e) => onNetworkChange(e.target.value as NetworkKey)}
            className="bg-[#0b0d11] text-white border border-[#2a2f34] rounded px-2 py-0.5 text-[10px] focus:outline-none"
          >
            {Object.values(NETWORKS).map((n) => (
              <option key={n.key} value={n.key} className="bg-black text-white">
                {n.label}
              </option>
            ))}
          </select>
        </div>

        {wallet.account ? (
          <div className="p-2 border border-[#2a2f34] bg-[#0b0d11] rounded flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-mono text-white">
                {wallet.account.slice(0, 6)}…{wallet.account.slice(-4)}
              </span>
            </div>
            <span className="text-[9px] text-[#ffffff50]">
              {walletNetwork?.label ?? 'CONNECTED'}
            </span>
          </div>
        ) : (
          <button 
            type="button" 
            onClick={() => void wallet.connect()} 
            disabled={wallet.connecting}
            className="w-full py-1.5 text-[10px] bg-white text-black font-bold rounded border border-white hover:bg-white/90 transition-colors"
          >
            {wallet.connecting ? 'CONNECTING...' : 'CONNECT WALLET'}
          </button>
        )}
      </div>
    </aside>
  );
};

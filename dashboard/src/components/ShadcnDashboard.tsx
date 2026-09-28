import React, { useState } from 'react';
import { SmartContainer } from '../types/commandCenter';
import { NETWORKS, type NetworkKey } from '../config/networks';
import { type useWallet } from '../hooks/useWallet';
import { OpenStreetMapContainer } from './ThreeSlides/OpenStreetMapContainer';

export type DashboardView = 'overview' | 'telemetry' | 'merkle' | 'escrow' | 'map';

interface ShadcnDashboardProps {
  containers: SmartContainer[];
  selectedContainerId: string;
  onSelectContainer: (id: string) => void;
  onSimulateTamper: () => void;
  onSimulateDelivery: () => void;
  onReset: () => void;
  networkKey: NetworkKey;
  onNetworkChange: (key: NetworkKey) => void;
  wallet: ReturnType<typeof useWallet>;
  onNavigateTab: (tab: 'console' | 'buyer' | 'courier') => void;
}

export const ShadcnDashboard: React.FC<ShadcnDashboardProps> = ({
  containers,
  selectedContainerId,
  onSelectContainer,
  onSimulateTamper,
  onSimulateDelivery,
  onReset,
  networkKey,
  onNetworkChange,
  wallet,
  onNavigateTab,
}) => {
  const currentBox = containers.find(c => c.id === selectedContainerId) || containers[0];
  const isTampered = currentBox?.status === 'TAMPERED';
  const tamperedCount = containers.filter(c => c.status === 'TAMPERED').length;

  const [activeView, setActiveView] = useState<DashboardView>('overview');
  const [isVerifying, setIsVerifying] = useState(false);
  const [proofVerified, setProofVerified] = useState<boolean | null>(null);

  const handleVerifyProof = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setProofVerified(true);
    }, 400);
  };

  if (!currentBox) return null;

  return (
    <div className="w-full min-h-screen bg-black text-[#efefeb] font-sans antialiased flex flex-col select-none">
      {/* =========================================================================
          PROPER TOP NAVBAR — Clean, Spacious, No Icons, No Slashes
      ========================================================================= */}
      <header className="sticky top-0 z-50 w-full bg-black border-b border-[#2a2f34] px-8 h-20 flex items-center justify-between">
        {/* Left: Brand */}
        <div className="flex items-center gap-10">
          <div
            className="cursor-pointer"
            onClick={() => setActiveView('overview')}
          >
            <span className="font-bold text-2xl text-[#EB0C0D] tracking-tight">
              TamperSafe
            </span>
          </div>

          {/* Center Navigation Links with Proper Spacing */}
          <nav className="hidden lg:flex items-center gap-8 text-sm">
            <button
              onClick={() => setActiveView('overview')}
              className={`transition-colors py-1.5 border-b-2 ${
                activeView === 'overview'
                  ? 'text-white border-[#EB0C0D] font-medium'
                  : 'text-white/60 hover:text-white border-transparent'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveView('telemetry')}
              className={`transition-colors py-1.5 border-b-2 ${
                activeView === 'telemetry'
                  ? 'text-white border-[#EB0C0D] font-medium'
                  : 'text-white/60 hover:text-white border-transparent'
              }`}
            >
              Sensors
            </button>
            <button
              onClick={() => setActiveView('merkle')}
              className={`transition-colors py-1.5 border-b-2 ${
                activeView === 'merkle'
                  ? 'text-white border-[#EB0C0D] font-medium'
                  : 'text-white/60 hover:text-white border-transparent'
              }`}
            >
              Blockchain Proof
            </button>
            <button
              onClick={() => setActiveView('escrow')}
              className={`transition-colors py-1.5 border-b-2 ${
                activeView === 'escrow'
                  ? 'text-white border-[#EB0C0D] font-medium'
                  : 'text-white/60 hover:text-white border-transparent'
              }`}
            >
              Escrow Settlement
            </button>
            <button
              onClick={() => setActiveView('map')}
              className={`transition-colors py-1.5 border-b-2 ${
                activeView === 'map'
                  ? 'text-white border-[#EB0C0D] font-medium'
                  : 'text-white/60 hover:text-white border-transparent'
              }`}
            >
              Transit Route
            </button>
            <button
              onClick={() => onNavigateTab('buyer')}
              className="text-white/60 hover:text-white py-1.5 transition-colors"
            >
              Buyer Portal
            </button>
            <button
              onClick={() => onNavigateTab('courier')}
              className="text-white/60 hover:text-white py-1.5 transition-colors"
            >
              Courier Portal
            </button>
          </nav>
        </div>

        {/* Right: Simulation Actions & Network */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={onSimulateTamper}
              className={`px-4 py-2 text-xs font-medium rounded transition-colors ${
                isTampered
                  ? 'bg-[#EB0C0D] text-white font-bold'
                  : 'border border-[#2a2f34] text-white hover:border-[#EB0C0D]'
              }`}
            >
              {isTampered ? 'Breach Active' : 'Simulate Tamper'}
            </button>

            <button
              onClick={onSimulateDelivery}
              className="px-4 py-2 text-xs font-medium rounded border border-[#2a2f34] text-white hover:border-white transition-colors"
            >
              Confirm Unlock
            </button>

            <button
              onClick={() => {
                onReset();
                setProofVerified(null);
              }}
              className="px-3 py-2 text-xs text-white/50 hover:text-white transition-colors"
            >
              Reset
            </button>
          </div>

          {/* Network Label */}
          <div className="hidden md:flex items-center border border-[#2a2f34] px-3 py-1.5 rounded text-xs text-white">
            <span className="text-white/60 mr-1.5">Network:</span>
            <select
              value={networkKey}
              onChange={e => onNetworkChange(e.target.value as NetworkKey)}
              className="bg-black text-white focus:outline-none cursor-pointer"
            >
              {Object.values(NETWORKS).map(n => (
                <option key={n.key} value={n.key} className="bg-black text-white">
                  {n.label}
                </option>
              ))}
            </select>
          </div>

          {/* Wallet */}
          {wallet.account ? (
            <div className="border border-[#2a2f34] px-3 py-1.5 rounded text-xs font-mono text-white">
              {wallet.account.slice(0, 6)}…{wallet.account.slice(-4)}
            </div>
          ) : (
            <button
              onClick={() => void wallet.connect()}
              className="px-4 py-2 bg-[#EB0C0D] text-white text-xs font-medium rounded hover:bg-[#c40a0b] transition-colors"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* =========================================================================
          MAIN 2-COLUMN WORKSPACE — Generous Padding & Comfortable Layout
      ========================================================================= */}
      <div className="w-full flex-1 flex">
        {/* Left Sidebar Controller */}
        <aside className="w-72 border-r border-[#2a2f34] bg-black h-[calc(100vh-5rem)] sticky top-20 overflow-y-auto no-scrollbar p-6 flex flex-col justify-between flex-shrink-0">
          <div className="space-y-8">
            {/* Navigation Group */}
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider mb-3">
                Navigation
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => setActiveView('overview')}
                  className={`w-full text-left px-3 py-2.5 rounded text-sm transition-colors flex items-center justify-between ${
                    activeView === 'overview'
                      ? 'bg-[#12141a] border border-[#2a2f34] text-white font-medium'
                      : 'text-white/70 hover:text-white hover:bg-white/[0.03]'
                  }`}
                >
                  <span>Fleet Overview</span>
                  <span className="text-xs text-white/40">{containers.length} Units</span>
                </button>

                <button
                  onClick={() => setActiveView('telemetry')}
                  className={`w-full text-left px-3 py-2.5 rounded text-sm transition-colors flex items-center justify-between ${
                    activeView === 'telemetry'
                      ? 'bg-[#12141a] border border-[#2a2f34] text-white font-medium'
                      : 'text-white/70 hover:text-white hover:bg-white/[0.03]'
                  }`}
                >
                  <span>Sensors & Telemetry</span>
                  {isTampered && <span className="text-xs text-[#EB0C0D] font-bold">Breached</span>}
                </button>

                <button
                  onClick={() => setActiveView('merkle')}
                  className={`w-full text-left px-3 py-2.5 rounded text-sm transition-colors flex items-center justify-between ${
                    activeView === 'merkle'
                      ? 'bg-[#12141a] border border-[#2a2f34] text-white font-medium'
                      : 'text-white/70 hover:text-white hover:bg-white/[0.03]'
                  }`}
                >
                  <span>Blockchain Proof</span>
                  <span className="text-xs text-white/40">Block #96</span>
                </button>

                <button
                  onClick={() => setActiveView('escrow')}
                  className={`w-full text-left px-3 py-2.5 rounded text-sm transition-colors flex items-center justify-between ${
                    activeView === 'escrow'
                      ? 'bg-[#12141a] border border-[#2a2f34] text-white font-medium'
                      : 'text-white/70 hover:text-white hover:bg-white/[0.03]'
                  }`}
                >
                  <span>Escrow Settlement</span>
                  <span className="text-xs text-white/40">MST</span>
                </button>

                <button
                  onClick={() => setActiveView('map')}
                  className={`w-full text-left px-3 py-2.5 rounded text-sm transition-colors flex items-center justify-between ${
                    activeView === 'map'
                      ? 'bg-[#12141a] border border-[#2a2f34] text-white font-medium'
                      : 'text-white/70 hover:text-white hover:bg-white/[0.03]'
                  }`}
                >
                  <span>Transit Route Map</span>
                  <span className="text-xs text-white/40">GPS</span>
                </button>
              </div>
            </div>

            {/* Smart Container Switcher */}
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider mb-3">
                Select Smart Box
              </div>
              <div className="space-y-2">
                {containers.map(box => {
                  const isSelected = box.id === currentBox.id;
                  const boxTampered = box.status === 'TAMPERED';

                  return (
                    <button
                      key={box.id}
                      onClick={() => {
                        onSelectContainer(box.id);
                        setProofVerified(null);
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded text-sm transition-colors flex items-center justify-between border ${
                        isSelected
                          ? boxTampered
                            ? 'bg-[#EB0C0D]/10 border-[#EB0C0D] text-[#EB0C0D] font-bold'
                            : 'bg-[#12141a] border-white/40 text-white font-bold'
                          : 'border-transparent text-white/70 hover:text-white hover:bg-white/[0.03]'
                      }`}
                    >
                      <span>{box.id}</span>
                      <span className="text-xs opacity-60">#{box.orderId}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* External Portals */}
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider mb-3">
                Participant Portals
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => onNavigateTab('buyer')}
                  className="w-full text-left px-3 py-2 rounded text-sm text-white/70 hover:text-white hover:bg-white/[0.03] transition-colors"
                >
                  Buyer Consignment Portal
                </button>
                <button
                  onClick={() => onNavigateTab('courier')}
                  className="w-full text-left px-3 py-2 rounded text-sm text-white/70 hover:text-white hover:bg-white/[0.03] transition-colors"
                >
                  Courier Transit Bond Portal
                </button>
              </div>
            </div>
          </div>

          {/* Simple Explanation Note on the Bottom of Sidebar */}
          <div className="border border-[#2a2f34] bg-[#0c0d12] p-4 rounded text-xs text-white/70 space-y-1">
            <div className="text-white font-medium">Smart Box Status</div>
            <div>Active Unit: <strong className="text-white">{currentBox.id}</strong></div>
            <div>Consensus: <span className="text-emerald-400">Synced to MST Blockchain</span></div>
          </div>
        </aside>

        {/* Extended Workspace (Full Width, Relaxed Spacing, Clear Explanations) */}
        <main className="flex-1 h-[calc(100vh-5rem)] overflow-y-auto no-scrollbar p-10 bg-black">
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Top View Title Banner */}
            <div className="border border-[#2a2f34] bg-[#0c0d12] p-6 rounded flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wider mb-1">
                  Workspace Status: {currentBox.id}
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  {activeView === 'overview' && 'Fleet Overview'}
                  {activeView === 'telemetry' && 'Sensors & Telemetry'}
                  {activeView === 'merkle' && 'Blockchain Cryptographic Proof'}
                  {activeView === 'escrow' && 'Escrow & Automated Settlement'}
                  {activeView === 'map' && 'Interstate Route Corridor'}
                </h1>
                <p className="text-sm text-white/75 mt-1">
                  Consignment: {currentBox.consignment} (Order #{currentBox.orderId})
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className={`px-3 py-1.5 rounded text-xs font-semibold uppercase border ${
                  isTampered
                    ? 'bg-[#EB0C0D] border-[#EB0C0D] text-white'
                    : 'bg-black border-[#2a2f34] text-white'
                }`}>
                  Status: {currentBox.status}
                </span>
              </div>
            </div>

            {/* =========================================================================
                VIEW 1: OVERVIEW
            ========================================================================= */}
            {activeView === 'overview' && (
              <div className="space-y-6">
                {/* Simple explanation paragraph */}
                <div className="border border-[#2a2f34] bg-[#0c0d12] p-6 rounded text-sm text-white/80 leading-relaxed">
                  <div className="text-white font-semibold mb-1 text-base">How TamperSafe Works</div>
                  TamperSafe is a tamper-evident physical delivery container backed by on-chain escrow. 
                  When goods are in transit, hardware sensors monitor physical integrity. If any tampering 
                  occurs, evidence is anchored to the MST Blockchain, and smart contracts automatically slash 
                  the courier bond and refund the buyer.
                </div>

                {/* 4 Clean Metric Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="border border-[#2a2f34] bg-[#0c0d12] p-5 rounded">
                    <div className="text-xs text-white/50 uppercase">Active Containers</div>
                    <div className="text-3xl font-bold text-white mt-2">1,420</div>
                    <div className="text-xs text-white/60 mt-1">94.7% online and healthy</div>
                  </div>

                  <div className={`border p-5 rounded ${tamperedCount > 0 ? 'border-[#EB0C0D] bg-[#EB0C0D]/05' : 'border-[#2a2f34] bg-[#0c0d12]'}`}>
                    <div className="text-xs text-white/50 uppercase">Tamper Incidents</div>
                    <div className={`text-3xl font-bold mt-2 ${tamperedCount > 0 ? 'text-[#EB0C0D]' : 'text-white'}`}>
                      0{tamperedCount}
                    </div>
                    <div className="text-xs text-white/60 mt-1">
                      {tamperedCount > 0 ? 'TS-BOX-03 breach detected' : 'Zero active breaches'}
                    </div>
                  </div>

                  <div className="border border-[#2a2f34] bg-[#0c0d12] p-5 rounded">
                    <div className="text-xs text-white/50 uppercase">Escrow Locked</div>
                    <div className="text-3xl font-bold text-white mt-2">1.22M MST</div>
                    <div className="text-xs text-white/60 mt-1">$4,892,400 USD equivalent</div>
                  </div>

                  <div className="border border-[#2a2f34] bg-[#0c0d12] p-5 rounded">
                    <div className="text-xs text-white/50 uppercase">Active Corridors</div>
                    <div className="text-3xl font-bold text-white mt-2">05</div>
                    <div className="text-xs text-white/60 mt-1">I-80, I-90, I-5 corridors</div>
                  </div>
                </div>

                {/* Monitored Units List */}
                <div className="border border-[#2a2f34] bg-[#0c0d12] p-6 rounded space-y-4">
                  <div className="flex items-center justify-between border-b border-[#2a2f34] pb-3 text-sm">
                    <span className="font-semibold text-white">Registered Smart Containers</span>
                    <span className="text-white/50 text-xs">Select a container to inspect details</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {containers.map(box => {
                      const boxTampered = box.status === 'TAMPERED';
                      const isSelected = box.id === currentBox.id;

                      return (
                        <div
                          key={box.id}
                          onClick={() => onSelectContainer(box.id)}
                          className={`p-5 rounded border cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-white bg-[#14161f]'
                              : 'border-[#2a2f34] bg-black hover:border-white/40'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-white">{box.id}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              boxTampered ? 'bg-[#EB0C0D] text-white' : 'border border-[#2a2f34] text-white/80'
                            }`}>
                              {box.status}
                            </span>
                          </div>

                          <div className="text-xs text-white/80 truncate mb-3">
                            {box.consignment}
                          </div>

                          <div className="border-t border-[#2a2f34] pt-2 space-y-1 text-xs text-white/60">
                            <div className="flex justify-between">
                              <span>Escrow:</span>
                              <span className="text-white font-medium">{box.escrowValueMst} MST</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Lid Gap:</span>
                              <span className={box.telemetry.lidDistanceMm > 2 ? 'text-[#EB0C0D] font-bold' : 'text-white'}>
                                {box.telemetry.lidDistanceMm} mm
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================================
                VIEW 2: SENSORS & TELEMETRY
            ========================================================================= */}
            {activeView === 'telemetry' && (
              <div className="space-y-6">
                {/* Simple explanation */}
                <div className="border border-[#2a2f34] bg-[#0c0d12] p-6 rounded text-sm text-white/80 leading-relaxed">
                  <div className="text-white font-semibold mb-1 text-base">Physical Hardware Sensors</div>
                  Sensors embedded inside the container continuously track lid distance, latch strain, 
                  and temperature. If the lid is separated by more than 2.0 mm, or if prying force exceeds 
                  25.0 Nm, the box automatically registers an irreversible tamper state.
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Lid Seal */}
                  <div className={`border p-6 rounded flex flex-col justify-between ${
                    currentBox.telemetry.lidDistanceMm > 2 ? 'border-[#EB0C0D] bg-[#EB0C0D]/05' : 'border-[#2a2f34] bg-[#0c0d12]'
                  }`}>
                    <div>
                      <div className="text-xs text-white/50 uppercase font-medium">Lid Seal Distance</div>
                      <div className="my-4">
                        <div className={`text-4xl font-bold ${
                          currentBox.telemetry.lidDistanceMm > 2 ? 'text-[#EB0C0D]' : 'text-white'
                        }`}>
                          {currentBox.telemetry.lidDistanceMm} mm
                        </div>
                        <div className="text-xs text-white/70 mt-1">
                          {currentBox.telemetry.lidDistanceMm > 2
                            ? 'Lid seal broken: physical opening detected'
                            : 'Normal state: seal is fully closed and locked'}
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-[#2a2f34] pt-3 text-xs text-white/60 flex justify-between">
                      <span>Maximum Safe Threshold:</span>
                      <span className="text-white font-medium">2.0 mm</span>
                    </div>
                  </div>

                  {/* Latch Strain */}
                  <div className={`border p-6 rounded flex flex-col justify-between ${
                    currentBox.telemetry.latchStrainNm > 25 ? 'border-[#EB0C0D] bg-[#EB0C0D]/05' : 'border-[#2a2f34] bg-[#0c0d12]'
                  }`}>
                    <div>
                      <div className="text-xs text-white/50 uppercase font-medium">Latch Strain Force</div>
                      <div className="my-4">
                        <div className={`text-4xl font-bold ${
                          currentBox.telemetry.latchStrainNm > 25 ? 'text-[#EB0C0D]' : 'text-white'
                        }`}>
                          {currentBox.telemetry.latchStrainNm} Nm
                        </div>
                        <div className="text-xs text-white/70 mt-1">
                          {currentBox.telemetry.latchStrainNm > 25
                            ? 'Excessive prying force applied to locking mechanism'
                            : 'Normal transit load envelope'}
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-[#2a2f34] pt-3 text-xs text-white/60 flex justify-between">
                      <span>Maximum Safe Threshold:</span>
                      <span className="text-white font-medium">25.0 Nm</span>
                    </div>
                  </div>
                </div>

                {/* Secondary Readings */}
                <div className="border border-[#2a2f34] bg-[#0c0d12] p-6 rounded space-y-4">
                  <div className="text-sm font-semibold text-white">
                    Environmental Conditions
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="border border-[#2a2f34] bg-black p-4 rounded">
                      <span className="text-xs text-white/50 block">Internal Temperature</span>
                      <span className="text-2xl font-bold text-white mt-1 block">
                        {currentBox.telemetry.internalTempC}&deg;C
                      </span>
                    </div>

                    <div className="border border-[#2a2f34] bg-black p-4 rounded">
                      <span className="text-xs text-white/50 block">Battery Level</span>
                      <span className="text-2xl font-bold text-white mt-1 block">
                        {currentBox.telemetry.batteryPercent}%
                      </span>
                    </div>

                    <div className="border border-[#2a2f34] bg-black p-4 rounded">
                      <span className="text-xs text-white/50 block">Shock Acceleration</span>
                      <span className="text-2xl font-bold text-white mt-1 block">
                        {currentBox.telemetry.accelG}G
                      </span>
                    </div>

                    <div className="border border-[#2a2f34] bg-black p-4 rounded">
                      <span className="text-xs text-white/50 block">Electronic Servo</span>
                      <span className="text-2xl font-bold text-white mt-1 block">
                        {currentBox.telemetry.latchServoAngle}&deg;
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================================
                VIEW 3: BLOCKCHAIN MERKLE PROOF
            ========================================================================= */}
            {activeView === 'merkle' && (
              <div className="space-y-6">
                {/* Simple explanation */}
                <div className="border border-[#2a2f34] bg-[#0c0d12] p-6 rounded text-sm text-white/80 leading-relaxed">
                  <div className="text-white font-semibold mb-1 text-base">Immutable Evidence Anchoring</div>
                  The backend relayer periodically hashes batches of sensor data and commits the Merkle root 
                  directly to the MST Blockchain. Because the proof is stored on-chain, courier companies 
                  cannot rewrite history or delete evidence of a breach.
                </div>

                <div className="border border-[#2a2f34] bg-[#0c0d12] p-6 rounded space-y-5">
                  <div>
                    <span className="text-xs text-white/50 uppercase font-medium block mb-2">
                      Anchored Merkle Root on MST Testnet
                    </span>
                    <div className="bg-black border border-[#2a2f34] p-4 font-mono text-xs text-white break-all leading-relaxed rounded">
                      {currentBox.hashChainHead}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-[#2a2f34] pt-4">
                    <div className="text-xs space-y-1">
                      <span className="text-white/50 block">Committed Block:</span>
                      <span className="text-sm font-bold text-white block">
                        Block #96 (Seq #{currentBox.anchoredSeq})
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <span className="text-white/50 block">Cryptographic Check:</span>
                      <span className="text-sm font-bold text-emerald-400 block">
                        {proofVerified ? 'Validated: 100% Match' : 'Root Hash Confirmed'}
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <span className="text-white/50 block">Relayer Public Key:</span>
                      <span className="text-sm font-mono text-white block">
                        0x71C8…4B8
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handleVerifyProof}
                      disabled={isVerifying}
                      className="px-6 py-2.5 rounded bg-[#EB0C0D] text-white text-xs font-semibold hover:bg-[#c40a0b] transition-colors"
                    >
                      {isVerifying ? 'Calculating Proof...' : 'Verify Cryptographic Proof on MST'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================================
                VIEW 4: ESCROW SETTLEMENT
            ========================================================================= */}
            {activeView === 'escrow' && (
              <div className="space-y-6">
                {/* Simple explanation */}
                <div className="border border-[#2a2f34] bg-[#0c0d12] p-6 rounded text-sm text-white/80 leading-relaxed">
                  <div className="text-white font-semibold mb-1 text-base">Automated Smart Contract Escrow</div>
                  Escrow contracts eliminate payment disputes between buyers, sellers, and couriers. 
                  If delivery succeeds normally, the seller receives payment and the courier bond is returned. 
                  If a tamper breach is detected, the courier collateral is forfeited and the buyer is refunded automatically.
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Buyer Escrow */}
                  <div className="border border-[#2a2f34] bg-[#0c0d12] p-6 rounded flex flex-col justify-between">
                    <div>
                      <div className="text-xs text-white/50 uppercase font-medium">Buyer Consignment Escrow</div>
                      <div className="my-4">
                        <div className={`text-4xl font-bold ${isTampered ? 'text-[#EB0C0D]' : 'text-white'}`}>
                          {currentBox.escrowValueMst}.00 MST
                        </div>
                        <div className="text-xs text-white/70 mt-1">
                          {isTampered ? 'Auto-refund dispatched to buyer wallet' : 'Held in escrow until delivery is confirmed'}
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-[#2a2f34] pt-3 text-xs text-white/60 flex justify-between font-mono">
                      <span>Buyer Address:</span>
                      <span className="text-white">0x3C44…719</span>
                    </div>
                  </div>

                  {/* Courier Bond */}
                  <div className="border border-[#2a2f34] bg-[#0c0d12] p-6 rounded flex flex-col justify-between">
                    <div>
                      <div className="text-xs text-white/50 uppercase font-medium">Courier Collateral Bond</div>
                      <div className="my-4">
                        <div className={`text-4xl font-bold ${isTampered ? 'text-[#EB0C0D]' : 'text-white'}`}>
                          {currentBox.courierBondMst}.00 MST
                        </div>
                        <div className="text-xs text-white/70 mt-1">
                          {isTampered ? '5,000 MST slashed for breach forfeiture' : 'Transit bond locked in smart contract'}
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-[#2a2f34] pt-3 text-xs text-white/60 flex justify-between font-mono">
                      <span>Courier Custodian:</span>
                      <span className="text-white">0x71C8…4B8</span>
                    </div>
                  </div>
                </div>

                <div className="border border-[#2a2f34] bg-[#0c0d12] p-5 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div>
                    <span className="text-white/50 block">Contract State Machine:</span>
                    <span className="text-sm font-semibold text-white mt-0.5 block">
                      TamperSafeEscrow.sol &bull; {isTampered ? 'State #5 (Tampered: Auto-Refund)' : 'State #2 (InTransit)'}
                    </span>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => onNavigateTab('buyer')}
                      className="px-4 py-2 rounded border border-[#2a2f34] text-xs text-white hover:border-white transition-colors"
                    >
                      Open Buyer Portal
                    </button>
                    <button
                      onClick={() => onNavigateTab('courier')}
                      className="px-4 py-2 rounded border border-[#2a2f34] text-xs text-white hover:border-white transition-colors"
                    >
                      Open Courier Portal
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================================
                VIEW 5: ROUTE MAP
            ========================================================================= */}
            {activeView === 'map' && (
              <div className="space-y-6">
                {/* Simple explanation */}
                <div className="border border-[#2a2f34] bg-[#0c0d12] p-6 rounded text-sm text-white/80 leading-relaxed">
                  <div className="text-white font-semibold mb-1 text-base">Transit Corridor & Geolocation</div>
                  Live route tracking along the Interstate 80 arterial freight corridor. 
                  GPS coordinates are transmitted alongside cryptographic sensor telemetry to verify the box location.
                </div>

                <div className="border border-[#2a2f34] bg-[#0c0d12] p-6 rounded space-y-4">
                  <div className="flex items-center justify-between border-b border-[#2a2f34] pb-3 text-xs">
                    <span className="font-semibold text-white">
                      Active Corridor: I-80 Eastbound (Milepost 184, Akron, OH)
                    </span>
                    <span className="text-white font-mono">
                      Coordinates: {currentBox.coordinates.lat}&deg; N, {currentBox.coordinates.lon}&deg; W
                    </span>
                  </div>

                  <div className="w-full h-[450px] rounded overflow-hidden border border-[#2a2f34] relative">
                    <OpenStreetMapContainer
                      containers={containers}
                      selectedContainerId={selectedContainerId}
                      onSelectContainer={onSelectContainer}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

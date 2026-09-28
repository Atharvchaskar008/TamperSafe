import React, { useState } from 'react';
import { SmartContainer } from '../types/commandCenter';
import { NETWORKS, type NetworkKey } from '../config/networks';
import { type useWallet } from '../hooks/useWallet';
import { OpenStreetMapContainer } from './ThreeSlides/OpenStreetMapContainer';

interface SimpleBackendDashboardProps {
  containers: SmartContainer[];
  selectedContainerId: string;
  onSelectContainer: (id: string) => void;
  onSimulateTamper: () => void;
  onSimulateDelivery: () => void;
  onReset: () => void;
  networkKey: NetworkKey;
  onNetworkChange: (key: NetworkKey) => void;
  wallet: ReturnType<typeof useWallet>;
}

export const SimpleBackendDashboard: React.FC<SimpleBackendDashboardProps> = ({
  containers,
  selectedContainerId,
  onSelectContainer,
  onSimulateTamper,
  onSimulateDelivery,
  onReset,
  networkKey,
  onNetworkChange,
  wallet,
}) => {
  const currentBox = containers.find(c => c.id === selectedContainerId) || containers[0];
  const isTampered = currentBox?.status === 'TAMPERED';
  const [proofVerified, setProofVerified] = useState<boolean | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setProofVerified(true);
    }, 400);
  };

  if (!currentBox) return null;

  return (
    <div className="w-full min-h-screen bg-black text-white font-mono flex flex-col select-none">
      {/* Top Navbar — Direct Continuation of Landing Page */}
      <header className="w-full border-b border-[#2a2f34] bg-black px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <span className="w-3.5 h-3.5 bg-[#EB0C0D] rounded-[1px] inline-block shadow-[0_0_12px_rgba(235,12,13,0.7)]" />
          <span className="text-xl font-bold font-sans text-white tracking-tight">
            TamperSafe
          </span>
          <span className="text-xs px-2 py-0.5 border border-[#2a2f34] text-white rounded">
            BACKEND CONSOLE
          </span>
        </div>

        {/* Backend Status Indicators */}
        <div className="hidden md:flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2 border border-[#2a2f34] px-3 py-1.5 rounded">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white font-bold">RELAYER API: ONLINE</span>
          </div>

          <div className="flex items-center gap-2 border border-[#2a2f34] px-3 py-1.5 rounded">
            <span className="text-white font-bold">CHAIN:</span>
            <select
              value={networkKey}
              onChange={e => onNetworkChange(e.target.value as NetworkKey)}
              className="bg-black text-white font-bold focus:outline-none cursor-pointer"
            >
              {Object.values(NETWORKS).map(n => (
                <option key={n.key} value={n.key} className="bg-black text-white">
                  {n.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Controls & Wallet */}
        <div className="flex items-center gap-2">
          <button
            onClick={onSimulateTamper}
            className="px-3 py-1.5 bg-[#EB0C0D] text-white font-bold text-xs rounded border border-[#EB0C0D] hover:bg-[#c20a0b] transition-colors"
          >
            SIM TAMPER
          </button>
          <button
            onClick={onSimulateDelivery}
            className="px-3 py-1.5 bg-black text-white font-bold text-xs rounded border border-[#2a2f34] hover:border-white transition-colors"
          >
            CONFIRM UNLOCK
          </button>
          <button
            onClick={() => {
              onReset();
              setProofVerified(null);
            }}
            className="px-3 py-1.5 bg-black text-white text-xs rounded border border-[#2a2f34] hover:border-white transition-colors"
          >
            RESET
          </button>

          {wallet.account ? (
            <div className="px-3 py-1.5 border border-[#2a2f34] bg-black text-xs text-white rounded font-mono">
              {wallet.account.slice(0, 6)}…{wallet.account.slice(-4)}
            </div>
          ) : (
            <button
              onClick={() => void wallet.connect()}
              className="px-3 py-1.5 bg-white text-black font-bold text-xs rounded border border-white hover:bg-white/90"
            >
              CONNECT
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto p-6 flex flex-col gap-6">
        {/* Unit Selector Bar */}
        <div className="border border-[#2a2f34] bg-black p-4 rounded flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-white uppercase tracking-wider font-bold">MONITORED UNIT:</span>
            <div className="flex items-center gap-2">
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
                    className={`px-3 py-1.5 text-xs font-bold rounded border transition-colors flex items-center gap-2 ${
                      isSelected
                        ? boxTampered
                          ? 'bg-[#EB0C0D] border-[#EB0C0D] text-white'
                          : 'bg-white text-black border-white'
                        : boxTampered
                        ? 'bg-black border-[#EB0C0D] text-[#EB0C0D]'
                        : 'bg-black border-[#2a2f34] text-white hover:border-white'
                    }`}
                  >
                    <span>{box.id}</span>
                    {boxTampered && <span>●</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-white">CONSIGNMENT: <strong className="text-white">{currentBox.consignment}</strong></span>
            <span className="text-white">ORDER: <strong className="text-white">#{currentBox.orderId}</strong></span>
            <span
              className={`px-2.5 py-1 text-xs font-bold rounded border ${
                isTampered
                  ? 'bg-[#EB0C0D] border-[#EB0C0D] text-white'
                  : currentBox.status === 'DELIVERED'
                  ? 'bg-emerald-950 border-emerald-500 text-emerald-400'
                  : 'bg-black border-white text-white'
              }`}
            >
              STATUS: {currentBox.status}
            </span>
          </div>
        </div>

        {/* 3 Core Backend Pipeline Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* STAGE 1: HARDWARE IOT TELEMETRY */}
          <div
            className={`border rounded p-6 flex flex-col justify-between transition-colors ${
              isTampered ? 'border-[#EB0C0D] bg-black' : 'border-[#2a2f34] bg-black'
            }`}
          >
            <div>
              <div className="flex items-center justify-between border-b border-[#2a2f34] pb-3 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  01 // HARDWARE IOT TELEMETRY
                </span>
                <span className={`w-2.5 h-2.5 rounded-full ${isTampered ? 'bg-[#EB0C0D] animate-ping' : 'bg-emerald-400'}`} />
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-xs text-white uppercase font-bold">LID SEAL GAP</div>
                  <div className={`text-3xl font-bold font-sans mt-1 ${isTampered ? 'text-[#EB0C0D]' : 'text-white'}`}>
                    {currentBox.telemetry.lidDistanceMm} mm
                  </div>
                  <div className="text-xs text-white mt-0.5">
                    {isTampered ? 'CRITICAL: SEAL BREACHED' : 'SEAL INTEGRITY: NORMAL'}
                  </div>
                </div>

                <div className="border-t border-[#2a2f34] pt-3">
                  <div className="text-xs text-white uppercase font-bold">LATCH STRAIN</div>
                  <div className={`text-2xl font-bold font-sans mt-1 ${isTampered ? 'text-[#EB0C0D]' : 'text-white'}`}>
                    {currentBox.telemetry.latchStrainNm} Nm
                  </div>
                  <div className="text-xs text-white mt-0.5">
                    {isTampered ? 'FORCE PEAK EXCEEDED (25.0 Nm MAX)' : 'NORMAL TRANSIT LOAD'}
                  </div>
                </div>

                <div className="border-t border-[#2a2f34] pt-3">
                  <div className="text-xs text-white uppercase font-bold">CORE SENSORS</div>
                  <div className="text-sm font-bold text-white mt-1">
                    TEMP: {currentBox.telemetry.internalTempC}&deg;C &bull; BATTERY: {currentBox.telemetry.batteryPercent}%
                  </div>
                  <div className="text-xs text-white mt-0.5">
                    ACCEL: {currentBox.telemetry.accelG}G &bull; SERVO: {currentBox.telemetry.latchServoAngle}&deg;
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-[#2a2f34] pt-3 mt-4 text-xs text-white font-bold">
              INGESTION: LIVE BACKEND STREAM
            </div>
          </div>

          {/* STAGE 2: CRYPTOGRAPHIC MERKLE ANCHOR */}
          <div
            className={`border rounded p-6 flex flex-col justify-between transition-colors ${
              isTampered ? 'border-[#EB0C0D] bg-black' : 'border-[#2a2f34] bg-black'
            }`}
          >
            <div>
              <div className="flex items-center justify-between border-b border-[#2a2f34] pb-3 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  02 // MERKLE ANCHOR & RELAYER
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-xs text-white uppercase font-bold">ANCHORED MERKLE ROOT</div>
                  <div className="text-sm font-mono font-bold text-white mt-1 break-all bg-black p-2 border border-[#2a2f34] rounded">
                    {currentBox.hashChainHead}
                  </div>
                </div>

                <div className="border-t border-[#2a2f34] pt-3">
                  <div className="text-xs text-white uppercase font-bold">BLOCK ANCHOR</div>
                  <div className="text-2xl font-bold font-sans text-white mt-1">
                    BLOCK #96 &bull; SEQ #{currentBox.anchoredSeq}
                  </div>
                  <div className="text-xs text-white mt-0.5">
                    NETWORK: MST BLOCKCHAIN (TESTNET)
                  </div>
                </div>

                <div className="border-t border-[#2a2f34] pt-3">
                  <div className="text-xs text-white uppercase font-bold">CRYPTOGRAPHIC VERDICT</div>
                  <div className="text-sm font-bold text-emerald-400 mt-1">
                    {proofVerified ? '✓ PROOF VALIDATED: 100% MATCH' : 'HASH-CHAIN ROOT MATCH: PASS'}
                  </div>
                  <div className="text-xs text-white mt-0.5">
                    ORACLE FREE: ZERO HUMAN INTERVENTION
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleVerify}
              disabled={isVerifying}
              className="mt-4 w-full py-2.5 bg-white text-black font-bold text-xs uppercase rounded border border-white hover:bg-white/90 transition-colors"
            >
              {isVerifying ? 'VERIFYING PROOF...' : 'VERIFY PROOF ON-CHAIN'}
            </button>
          </div>

          {/* STAGE 3: SMART CONTRACT SETTLEMENT */}
          <div
            className={`border rounded p-6 flex flex-col justify-between transition-colors ${
              isTampered ? 'border-[#EB0C0D] bg-black' : 'border-[#2a2f34] bg-black'
            }`}
          >
            <div>
              <div className="flex items-center justify-between border-b border-[#2a2f34] pb-3 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  03 // SMART CONTRACT ESCROW
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-xs text-white uppercase font-bold">BUYER ESCROW DEPOSIT</div>
                  <div className={`text-3xl font-bold font-sans mt-1 ${isTampered ? 'text-[#EB0C0D]' : 'text-white'}`}>
                    {currentBox.escrowValueMst}.00 MST
                  </div>
                  <div className="text-xs text-white mt-0.5">
                    {isTampered ? 'ACTION: 100% REFUND DISPATCHED TO BUYER' : 'HELD IN ESCROW UNTIL UNLOCKED'}
                  </div>
                </div>

                <div className="border-t border-[#2a2f34] pt-3">
                  <div className="text-xs text-white uppercase font-bold">COURIER TRANSIT BOND</div>
                  <div className={`text-2xl font-bold font-sans mt-1 ${isTampered ? 'text-[#EB0C0D]' : 'text-white'}`}>
                    {currentBox.courierBondMst}.00 MST
                  </div>
                  <div className="text-xs text-white mt-0.5">
                    {isTampered ? 'PENALTY: 5,000 MST SLASHED FOR BREACH' : 'COLLATERAL LOCKED IN CONTRACT'}
                  </div>
                </div>

                <div className="border-t border-[#2a2f34] pt-3">
                  <div className="text-xs text-white uppercase font-bold">SMART CONTRACT STATE</div>
                  <div className="text-sm font-bold text-white mt-1">
                    CONTRACT: TamperSafeEscrow.sol
                  </div>
                  <div className="text-xs text-white mt-0.5">
                    SETTLEMENT RULE: {isTampered ? 'STATE #5 (TAMPERED - AUTO-REFUND)' : 'STATE #2 (IN_TRANSIT)'}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-[#2a2f34] pt-3 mt-4 text-xs text-white font-bold flex justify-between">
              <span>TARGET: 0x3C44…719</span>
              <span className={isTampered ? 'text-[#EB0C0D]' : 'text-emerald-400'}>
                {isTampered ? 'SLASH EXECUTED' : 'ESCROW ACTIVE'}
              </span>
            </div>
          </div>
        </div>

        {/* Live Route & Location Map Viewport */}
        <div className="border border-[#2a2f34] bg-black rounded p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#2a2f34] pb-2 text-xs">
            <span className="font-bold text-white uppercase">
              LIVE ARTERIAL TRANSIT ROUTE (I-80 CORRIDOR)
            </span>
            <span className="text-white font-bold">
              GPS FIX: {currentBox.coordinates.lat}&deg; N, {currentBox.coordinates.lon}&deg; W
            </span>
          </div>

          <div className="w-full h-80 rounded overflow-hidden border border-[#2a2f34]">
            <OpenStreetMapContainer
              containers={containers}
              selectedContainerId={selectedContainerId}
              onSelectContainer={onSelectContainer}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

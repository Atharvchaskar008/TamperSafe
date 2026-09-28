import React, { useState } from 'react';
import { SmartContainer } from '../../types/commandCenter';

interface Slide3SettlementDepotProps {
  containers: SmartContainer[];
  selectedContainerId: string;
  onPrevSlide: () => void;
  onGoToTab: (tab: 'buyer' | 'courier') => void;
}

export const Slide3SettlementDepot: React.FC<Slide3SettlementDepotProps> = ({
  containers,
  selectedContainerId,
  onPrevSlide,
  onGoToTab,
}) => {
  const currentBox = containers.find(c => c.id === selectedContainerId) || containers[0];
  if (!currentBox) return null;
  const isTampered = currentBox.status === 'TAMPERED';

  const [boxId, setBoxId] = useState('TS-BOX-05');
  const [courierAddr, setCourierAddr] = useState('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleSeal = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(`SEALED: ${boxId} bound to courier ${courierAddr.slice(0, 8)}… on TamperSafeEscrow`);
  };

  const handleReset = () => {
    setStatusMsg(`RESET: ${boxId} state cleared back to unbonded active.`);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 gap-4 bg-black select-none font-mono">
      {/* Top Banner */}
      <div className="p-4 border border-[#2a2f34] bg-[#08090c] rounded-[3px] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="w-3.5 h-3.5 bg-white rounded-[1px]"></span>
          <div>
            <div className="text-base font-bold uppercase tracking-tight text-white">
              03 // SETTLEMENT BREAKDOWN & DEPOT SEALS
            </div>
            <div className="text-[10px] text-[#ffffff80] mt-0.5">
              ORDER #{currentBox.orderId} &bull; CONSIGNMENT: {currentBox.consignment}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onPrevSlide} className="cta-btn-black">
            &larr; EVIDENCE
          </button>
          <button onClick={() => onGoToTab('buyer')} className="cta-btn-black">
            BUYER PORTAL
          </button>
          <button onClick={() => onGoToTab('courier')} className="cta-btn-black">
            COURIER BOND
          </button>
        </div>
      </div>

      {/* Row 1: 3 Large Tactile Financial Square Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Tile 1: Buyer Refund */}
        <div className={`sq-hero-tile ${isTampered ? 'border-[#EB0C0D] bg-[#EB0C0D]/10' : ''}`}>
          <div className="text-[10px] text-[#ffffff60] uppercase">01 // BUYER REFUND</div>
          <div className="my-3">
            <div className={`text-4xl font-bold font-sans ${isTampered ? 'text-[#EB0C0D]' : 'text-white'}`}>
              {isTampered ? `${currentBox.escrowValueMst}.00` : '0.00'} <span className="text-lg font-normal text-white/50">MST</span>
            </div>
            <div className="text-[11px] text-[#ffffff80] mt-1">
              {isTampered ? 'REFUNDED TO 0x3C44…719' : 'NO REFUND (DELIVERY NOMINAL)'}
            </div>
          </div>
          <div className="text-[9px] text-[#fff6]">SMART CONTRACT TRANSITION: #{isTampered ? '5 (TAMPERED)' : '4 (DELIVERED)'}</div>
        </div>

        {/* Tile 2: Courier Bond */}
        <div className={`sq-hero-tile ${isTampered ? 'border-[#EB0C0D] bg-[#EB0C0D]/10' : ''}`}>
          <div className="text-[10px] text-[#ffffff60] uppercase">02 // COURIER BOND SLASH</div>
          <div className="my-3">
            <div className={`text-4xl font-bold font-sans ${isTampered ? 'text-[#EB0C0D]' : 'text-white'}`}>
              {isTampered ? `${currentBox.courierBondMst}.00` : '0.00'} <span className="text-lg font-normal text-white/50">MST</span>
            </div>
            <div className="text-[11px] text-[#ffffff80] mt-1">
              {isTampered ? 'SLASHED & FORFEITED TO SELLER' : 'RETURNED TO COURIER'}
            </div>
          </div>
          <div className="text-[9px] text-[#fff6]">COURIER WALLET: 0x71C8…4B8</div>
        </div>

        {/* Tile 3: Seller Payout */}
        <div className="sq-hero-tile">
          <div className="text-[10px] text-[#ffffff60] uppercase">03 // SELLER PAYOUT</div>
          <div className="my-3">
            <div className="text-4xl font-bold font-sans text-white">
              {isTampered ? '0.00' : currentBox.status === 'DELIVERED' ? `${currentBox.escrowValueMst}.00` : '0.00'} <span className="text-lg font-normal text-white/50">MST</span>
            </div>
            <div className="text-[11px] text-[#ffffff80] mt-1">
              {isTampered ? 'COMPENSATED WITH COURIER BOND' : currentBox.status === 'DELIVERED' ? 'RELEASED UPON UNLOCK' : 'IN ESCROW'}
            </div>
          </div>
          <div className="text-[9px] text-[#fff6]">RECIPIENT: 0x90F7…A12</div>
        </div>
      </div>

      {/* Row 2: Depot Dispatch Sealing Square Panel */}
      <div className="sq-panel p-4 flex flex-col gap-3">
        <div className="border-b border-[#2a2f34] pb-2 flex items-center justify-between">
          <span className="text-[12px] uppercase font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-white inline-block"></span>
            Depot Hardware Sealing (POST /api/orders/seal)
          </span>
          <span className="text-[10px] text-[#ffffff60]">DEPOT 01 &bull; SF BAY TERMINAL</span>
        </div>

        <form onSubmit={handleSeal} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[9px] text-[#ffffff60] uppercase block mb-1">Smart Box ID:</label>
            <input
              type="text"
              value={boxId}
              onChange={e => setBoxId(e.target.value)}
              className="w-full bg-[#0b0d10] border border-[#2a2f34] p-2.5 text-white text-[11px] outline-none"
            />
          </div>

          <div>
            <label className="text-[9px] text-[#ffffff60] uppercase block mb-1">Courier Address:</label>
            <input
              type="text"
              value={courierAddr}
              onChange={e => setCourierAddr(e.target.value)}
              className="w-full bg-[#0b0d10] border border-[#2a2f34] p-2.5 text-white text-[11px] outline-none"
            />
          </div>

          <div className="flex items-end gap-2">
            <button type="submit" className="cta-btn-red flex-1 justify-center">
              SEAL SHIPMENT
            </button>
            <button type="button" onClick={handleReset} className="cta-btn-black">
              RESET
            </button>
          </div>
        </form>

        {statusMsg && (
          <div className="p-3 bg-[#0b0d10] border border-white text-white text-[11px]">
            {statusMsg}
          </div>
        )}
      </div>
    </div>
  );
};

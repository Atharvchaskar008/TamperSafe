import React, { useState } from 'react';

interface FundedOrder {
  id: number;
  description: string;
  amountMst: number;
  buyer: string;
  status: 'Funded';
}

const INITIAL_FUNDED_ORDERS: FundedOrder[] = [
  { id: 1045, description: 'SpaceX Starlink Laser Terminal', amountMst: 950, buyer: '0x3C44…719', status: 'Funded' },
  { id: 1048, description: 'Medical Cryogenic Samples', amountMst: 600, buyer: '0x71A0…3B2', status: 'Funded' },
  { id: 1049, description: 'Aerospace Sensor Telemetry Rig', amountMst: 1200, buyer: '0x88C2…991', status: 'Funded' },
];

export const DepotTab: React.FC = () => {
  const [orders, setOrders] = useState<FundedOrder[]>(INITIAL_FUNDED_ORDERS);
  const [selectedOrderId, setSelectedOrderId] = useState<number>(1045);
  const [boxId, setBoxId] = useState('TS-BOX-05');
  const [courierAddress, setCourierAddress] = useState('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
  const [sealStatus, setSealStatus] = useState<string | null>(null);

  const handleSeal = (e: React.FormEvent) => {
    e.preventDefault();
    setSealStatus('SEALING IN PROGRESS… (POST /api/orders/' + selectedOrderId + '/seal)');
    setTimeout(() => {
      setSealStatus('SEALED SUCCESSFULLY: ' + boxId + ' bound to Order #' + selectedOrderId + ' with courier ' + courierAddress.slice(0, 8) + '…');
      setOrders(prev => prev.filter(o => o.id !== selectedOrderId));
    }, 600);
  };

  const handleResetBox = () => {
    setSealStatus('BOX RESET ISSUED: POST /api/boxes/' + boxId + '/reset — state restored to ACTIVE unbonded.');
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-56px)] bg-black text-white p-4 gap-4 overflow-y-auto font-mono select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#2a2f34] pb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-white inline-block" />
          <span className="text-[12px] uppercase font-bold text-white">Depot Operations — Sealing & Box Assignment</span>
        </div>
        <div className="text-[11px] text-[#ffffff80]">
          DEPOT TERMINAL: <strong className="text-white">SF BAY TERMINAL (SFO-D1)</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: List of Funded Orders (docs/dashboard.md §2) */}
        <div className="sq-panel p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#2a2f34] pb-2">
            <span className="text-[11px] uppercase font-bold text-white">Funded Orders Awaiting Seal</span>
            <span className="text-[10px] text-[#ffffff80]">{orders.length} READY</span>
          </div>

          <div className="space-y-2">
            {orders.map(order => {
              const isSelected = order.id === selectedOrderId;
              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className={`p-3 border cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-white text-black border-white'
                      : 'bg-[#0b0d10] border-[#2a2f34] text-white hover:border-[#ffffff50]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-[13px]">Order #{order.id}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 ${isSelected ? 'bg-black text-white' : 'bg-white/10 text-white'}`}>
                      {order.amountMst} MST
                    </span>
                  </div>
                  <div className={`text-[11px] ${isSelected ? 'text-black/80' : 'text-[#ffffff80]'}`}>
                    {order.description}
                  </div>
                  <div className={`text-[9px] mt-1 ${isSelected ? 'text-black/60' : 'text-[#fff6]'}`}>
                    Buyer: {order.buyer}
                  </div>
                </div>
              );
            })}
            {orders.length === 0 && (
              <div className="p-4 text-center text-[#ffffff60] text-[11px] border border-dashed border-[#2a2f34]">
                All funded orders currently sealed and dispatched.
              </div>
            )}
          </div>
        </div>

        {/* Right: Sealing Action & Box State (docs/dashboard.md §2) */}
        <div className="sq-panel p-4 flex flex-col justify-between gap-4">
          <div className="border-b border-[#2a2f34] pb-2">
            <span className="text-[11px] uppercase font-bold text-white">Seal Shipment to Smart Container</span>
          </div>

          <form onSubmit={handleSeal} className="space-y-3 text-[11px]">
            <div>
              <label className="text-[10px] text-[#ffffff80] uppercase block mb-1">Target Order ID:</label>
              <input
                type="number"
                value={selectedOrderId}
                onChange={e => setSelectedOrderId(Number(e.target.value))}
                className="w-full bg-[#0b0d10] border border-[#2a2f34] p-2 text-white outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] text-[#ffffff80] uppercase block mb-1">Smart Box ID:</label>
              <input
                type="text"
                value={boxId}
                onChange={e => setBoxId(e.target.value)}
                className="w-full bg-[#0b0d10] border border-[#2a2f34] p-2 text-white outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] text-[#ffffff80] uppercase block mb-1">Assigned Courier Address:</label>
              <input
                type="text"
                value={courierAddress}
                onChange={e => setCourierAddress(e.target.value)}
                className="w-full bg-[#0b0d10] border border-[#2a2f34] p-2 text-white outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="submit" className="btn-primary flex-1">
                SEAL SHIPMENT (POST /api/orders/seal)
              </button>
              <button
                type="button"
                onClick={handleResetBox}
                className="btn-secondary"
              >
                RESET BOX
              </button>
            </div>
          </form>

          {sealStatus && (
            <div className="p-3 bg-[#0b0d10] border border-white text-white text-[10px]">
              {sealStatus}
            </div>
          )}

          <div className="text-[9px] text-[#fff6] border-t border-[#2a2f34] pt-2">
            SEAL LOCKS amount * bondBps / 10,000 OUT OF COURIER FREE BOND BALANCE ON TAMPSAFEESCROW.
          </div>
        </div>
      </div>
    </div>
  );
};

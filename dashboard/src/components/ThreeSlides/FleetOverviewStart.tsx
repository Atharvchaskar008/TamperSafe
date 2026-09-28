import React from 'react';
import { SmartContainer } from '../../types/commandCenter';
import { ViewMode } from '../SidebarNav';

interface FleetOverviewStartProps {
  containers: SmartContainer[];
  selectedContainerId: string;
  onSelectContainer: (id: string) => void;
  onNavigate: (view: ViewMode) => void;
  onSimulateTamper: () => void;
  onSimulateDelivery?: () => void;
  onReset?: () => void;
}

export const FleetOverviewStart: React.FC<FleetOverviewStartProps> = ({
  containers,
  selectedContainerId,
  onSelectContainer,
  onNavigate,
  onSimulateTamper,
}) => {
  const currentBox = containers.find(c => c.id === selectedContainerId) || containers[0];
  const tamperedCount = containers.filter(c => c.status === 'TAMPERED').length;

  if (!currentBox) return null;

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 gap-6 bg-black text-white select-none font-mono">
      <div className="flex items-center justify-between border-b border-[#2a2f34] pb-4">
        <div>
          <div className="text-xs font-bold text-white uppercase">FLEET COMMAND</div>
          <h1 className="text-2xl font-bold font-sans text-white mt-1">Operational Fleet Status</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onSimulateTamper} className="px-3 py-1.5 bg-[#EB0C0D] text-white text-xs font-bold rounded">
            SIM TAMPER
          </button>
          <button onClick={() => onNavigate('01-map')} className="px-3 py-1.5 bg-white text-black text-xs font-bold rounded">
            VIEW MAP
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border border-[#2a2f34] bg-black p-4 rounded">
          <div className="text-xs text-white uppercase">ACTIVE FLEET</div>
          <div className="text-3xl font-bold text-white mt-2">1,420</div>
          <div className="text-xs text-white mt-1">94.7% HARDWARE ONLINE</div>
        </div>

        <div className={`border p-4 rounded ${tamperedCount > 0 ? 'border-[#EB0C0D]' : 'border-[#2a2f34]'}`}>
          <div className="text-xs text-white uppercase">SECURITY BREACHES</div>
          <div className={`text-3xl font-bold mt-2 ${tamperedCount > 0 ? 'text-[#EB0C0D]' : 'text-white'}`}>
            0{tamperedCount}
          </div>
          <div className="text-xs text-white mt-1">
            {tamperedCount > 0 ? 'TS-BOX-03 TAMPERED' : 'ZERO INCIDENTS'}
          </div>
        </div>

        <div className="border border-[#2a2f34] bg-black p-4 rounded">
          <div className="text-xs text-white uppercase">ESCROW TVL</div>
          <div className="text-3xl font-bold text-white mt-2">1.22M</div>
          <div className="text-xs text-white mt-1">MST ON-CHAIN LOCKED</div>
        </div>

        <div className="border border-[#2a2f34] bg-black p-4 rounded">
          <div className="text-xs text-white uppercase">TRANSIT CORRIDORS</div>
          <div className="text-3xl font-bold text-white mt-2">05</div>
          <div className="text-xs text-white mt-1">INTERSTATE ROUTES</div>
        </div>
      </div>

      <div className="border border-[#2a2f34] bg-black rounded p-4">
        <div className="text-xs font-bold text-white uppercase mb-3">MONITORED SMART CONTAINERS</div>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#2a2f34] text-white uppercase">
              <th className="p-2">ID</th>
              <th className="p-2">ORDER</th>
              <th className="p-2">STATUS</th>
              <th className="p-2">ESCROW</th>
              <th className="p-2">LOCATION</th>
              <th className="p-2">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {containers.map(box => (
              <tr key={box.id} className="border-b border-[#2a2f34]">
                <td className="p-2 font-bold text-white">{box.id}</td>
                <td className="p-2 text-white">#{box.orderId}</td>
                <td className="p-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${box.status === 'TAMPERED' ? 'bg-[#EB0C0D] text-white' : 'bg-black border border-white text-white'}`}>
                    {box.status}
                  </span>
                </td>
                <td className="p-2 text-white font-bold">{box.escrowValueMst} MST</td>
                <td className="p-2 text-white">{box.currentLocationName}</td>
                <td className="p-2">
                  <button
                    onClick={() => {
                      onSelectContainer(box.id);
                      if (box.status === 'TAMPERED') onNavigate('02-evidence');
                      else onNavigate('01-map');
                    }}
                    className="px-2 py-1 bg-white text-black font-bold rounded text-xs"
                  >
                    INSPECT
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

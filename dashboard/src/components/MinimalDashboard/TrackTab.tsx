import React, { useState } from 'react';
import { SmartContainer, SecurityEvent } from '../../types/commandCenter';

interface TrackTabProps {
  containers: SmartContainer[];
  selectedContainerId: string;
  onSelectContainer: (id: string) => void;
  events: SecurityEvent[];
}

export const TrackTab: React.FC<TrackTabProps> = ({
  containers,
  selectedContainerId,
  onSelectContainer,
  events,
}) => {
  const currentBox = containers.find(c => c.id === selectedContainerId) || containers[0];
  if (!currentBox) return null;
  const isTampered = currentBox.status === 'TAMPERED';

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-56px)] bg-black text-white p-3 gap-3 overflow-hidden select-none font-mono">
      {/* Top Box Selector Row */}
      <div className="flex items-center justify-between border-b border-[#2a2f34] pb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#ffffff80] uppercase">Active Unit:</span>
          <div className="flex items-center gap-1.5">
            {containers.map(box => {
              const isSelected = box.id === currentBox.id;
              const isBoxTampered = box.status === 'TAMPERED';
              return (
                <button
                  key={box.id}
                  onClick={() => onSelectContainer(box.id)}
                  className={`px-2.5 py-1 text-[11px] rounded-[2px] border transition-colors flex items-center gap-1.5 ${
                    isSelected
                      ? isBoxTampered
                        ? 'bg-[#EB0C0D] border-[#EB0C0D] text-white font-bold'
                        : 'bg-white text-black border-white font-bold'
                      : isBoxTampered
                      ? 'bg-[#EB0C0D]/10 border-[#EB0C0D] text-[#EB0C0D]'
                      : 'bg-[#0b0d10] border-[#2a2f34] text-[#ffffff80] hover:text-white hover:border-white/50'
                  }`}
                >
                  <span className={`w-2 h-2 ${isBoxTampered ? 'bg-[#EB0C0D]' : isSelected ? 'bg-black' : 'bg-[#ffffff80]'} rounded-[1px]`} />
                  <span>{box.id}</span>
                  <span className="text-[9px] opacity-70">#{box.orderId}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[#ffffff80]">
          <span>STATUS: <strong className={isTampered ? 'text-[#EB0C0D]' : 'text-white'}>{currentBox.status}</strong></span>
          <span>&bull;</span>
          <span>GPS: <strong className="text-white">LIVE ({currentBox.coordinates.lat}, {currentBox.coordinates.lon})</strong></span>
          <span>&bull;</span>
          <span>SPEED: <strong className="text-white">{currentBox.speedMph} MPH</strong></span>
        </div>
      </div>

      {/* Row of Clean Square Sensor Tiles (docs/dashboard.md §2) */}
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-2 flex-shrink-0 text-[10px]">
        {/* Tile 1: LID */}
        <div className={`sq-tile ${currentBox.telemetry.lidDistanceMm > 2 ? 'is--tamper' : ''}`}>
          <div className="text-[#ffffff80] uppercase flex justify-between">
            <span>Lid Distance</span>
            <span className="w-2 h-2 bg-[#2a2f34] rounded-[1px]" />
          </div>
          <div className="my-1">
            <span className={`text-[16px] font-bold ${currentBox.telemetry.lidDistanceMm > 2 ? 'text-[#EB0C0D]' : 'text-white'}`}>
              {currentBox.telemetry.lidDistanceMm} mm
            </span>
          </div>
          <div className="text-[9px] text-[#fff6]">
            {currentBox.telemetry.lidDistanceMm > 2 ? 'BREACH DETECTED' : 'SEALED (<1.5mm)'}
          </div>
        </div>

        {/* Tile 2: ACCEL / SHOCK */}
        <div className={`sq-tile ${currentBox.telemetry.accelG > 5 ? 'is--tamper' : ''}`}>
          <div className="text-[#ffffff80] uppercase flex justify-between">
            <span>Accel / Shock</span>
            <span className="w-2 h-2 bg-[#2a2f34] rounded-[1px]" />
          </div>
          <div className="my-1">
            <span className={`text-[16px] font-bold ${currentBox.telemetry.accelG > 5 ? 'text-[#EB0C0D]' : 'text-white'}`}>
              {currentBox.telemetry.accelG} G
            </span>
          </div>
          <div className="text-[9px] text-[#fff6]">
            {currentBox.telemetry.accelG > 5 ? 'IMPACT SPIKE (>8G)' : 'NOMINAL MOTION'}
          </div>
        </div>

        {/* Tile 3: BATTERY */}
        <div className="sq-tile">
          <div className="text-[#ffffff80] uppercase flex justify-between">
            <span>Battery</span>
            <span className="w-2 h-2 bg-[#2a2f34] rounded-[1px]" />
          </div>
          <div className="my-1">
            <span className="text-[16px] font-bold text-white">
              {currentBox.telemetry.batteryVoltage} V
            </span>
          </div>
          <div className="text-[9px] text-[#fff6]">
            {currentBox.telemetry.batteryPercent}% CHARGED
          </div>
        </div>

        {/* Tile 4: SERVO LATCH */}
        <div className={`sq-tile ${currentBox.telemetry.nvsLatchState === 'TAMPER_LATCHED' ? 'is--tamper' : ''}`}>
          <div className="text-[#ffffff80] uppercase flex justify-between">
            <span>Servo Latch</span>
            <span className="w-2 h-2 bg-[#2a2f34] rounded-[1px]" />
          </div>
          <div className="my-1">
            <span className={`text-[16px] font-bold ${currentBox.telemetry.nvsLatchState === 'TAMPER_LATCHED' ? 'text-[#EB0C0D]' : 'text-white'}`}>
              {currentBox.telemetry.latchServoAngle === 0 ? '0° LOCKED' : '90° OPEN'}
            </span>
          </div>
          <div className="text-[9px] text-[#fff6]">
            STRAIN: {currentBox.telemetry.latchStrainNm} N·m
          </div>
        </div>

        {/* Tile 5: OPTICAL CHAMBER */}
        <div className={`sq-tile ${currentBox.telemetry.opticalLux > 15 ? 'is--tamper' : ''}`}>
          <div className="text-[#ffffff80] uppercase flex justify-between">
            <span>Optical Lux</span>
            <span className="w-2 h-2 bg-[#2a2f34] rounded-[1px]" />
          </div>
          <div className="my-1">
            <span className={`text-[16px] font-bold ${currentBox.telemetry.opticalLux > 15 ? 'text-[#EB0C0D]' : 'text-white'}`}>
              {currentBox.telemetry.opticalLux} lx
            </span>
          </div>
          <div className="text-[9px] text-[#fff6]">
            {currentBox.telemetry.opticalLux > 15 ? 'LIGHT INGRESS' : 'DARK CHAMBER (<15)'}
          </div>
        </div>

        {/* Tile 6: TEMPERATURE */}
        <div className="sq-tile">
          <div className="text-[#ffffff80] uppercase flex justify-between">
            <span>Temp</span>
            <span className="w-2 h-2 bg-[#2a2f34] rounded-[1px]" />
          </div>
          <div className="my-1">
            <span className="text-[16px] font-bold text-white">
              {currentBox.telemetry.internalTempC} °C
            </span>
          </div>
          <div className="text-[9px] text-[#fff6]">
            {currentBox.telemetry.humidityPct}% HUMIDITY
          </div>
        </div>

        {/* Tile 7: RFID MATCH */}
        <div className="sq-tile">
          <div className="text-[#ffffff80] uppercase flex justify-between">
            <span>RFID Match</span>
            <span className="w-2 h-2 bg-[#2a2f34] rounded-[1px]" />
          </div>
          <div className="my-1">
            <span className="text-[16px] font-bold text-white truncate block">
              {currentBox.rfidTagUid.slice(0, 8)}…
            </span>
          </div>
          <div className="text-[9px] text-[#fff6]">
            MANIFEST VERIFIED
          </div>
        </div>

        {/* Tile 8: ESCROW LOCKED */}
        <div className="sq-tile">
          <div className="text-[#ffffff80] uppercase flex justify-between">
            <span>Escrow Value</span>
            <span className="w-2 h-2 bg-[#2a2f34] rounded-[1px]" />
          </div>
          <div className="my-1">
            <span className="text-[16px] font-bold text-white">
              {currentBox.escrowValueMst} MST
            </span>
          </div>
          <div className="text-[9px] text-[#fff6]">
            BOND: {currentBox.courierBondMst} MST
          </div>
        </div>
      </div>

      {/* Center: Clean Minimal Map Canvas with Square Waypoints */}
      <div className="flex-1 sq-panel relative overflow-hidden flex flex-col">
        <svg viewBox="0 0 1000 480" className="w-full h-full">
          {/* Subtle grid */}
          <g stroke="#1a1d22" strokeWidth="1">
            <line x1="200" y1="0" x2="200" y2="480" />
            <line x1="400" y1="0" x2="400" y2="480" />
            <line x1="600" y1="0" x2="600" y2="480" />
            <line x1="800" y1="0" x2="800" y2="480" />
            <line x1="0" y1="120" x2="1000" y2="120" />
            <line x1="0" y1="240" x2="1000" y2="240" />
            <line x1="0" y1="360" x2="1000" y2="360" />
          </g>

          {/* Minimal US Corridor Lines */}
          <path
            d="M 140 100 L 360 220 L 620 180 L 720 180 L 860 160"
            fill="none"
            stroke={isTampered ? '#EB0C0D' : '#ffffff40'}
            strokeWidth="1.5"
          />
          <path
            d="M 140 100 L 120 220 L 150 300"
            fill="none"
            stroke="#ffffff20"
            strokeWidth="1"
          />
          <path
            d="M 150 300 L 360 220 L 620 180"
            fill="none"
            stroke="#ffffff20"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <path
            d="M 500 360 L 620 180"
            fill="none"
            stroke="#ffffff20"
            strokeWidth="1"
          />
          <path
            d="M 900 130 L 860 160 L 750 320"
            fill="none"
            stroke="#ffffff20"
            strokeWidth="1"
          />

          {/* Hub Square Nodes */}
          {[
            { code: 'SEA', x: 140, y: 100 },
            { code: 'SFO', x: 120, y: 220 },
            { code: 'LAX', x: 150, y: 300 },
            { code: 'DEN', x: 360, y: 220 },
            { code: 'ORD', x: 620, y: 180 },
            { code: 'DFW', x: 500, y: 360 },
            { code: 'ATL', x: 750, y: 320 },
            { code: 'NYC', x: 860, y: 160 },
            { code: 'BOS', x: 900, y: 130 },
          ].map(hub => (
            <g key={hub.code} transform={`translate(${hub.x}, ${hub.y})`}>
              <rect x="-4" y="-4" width="8" height="8" fill="#14171d" stroke="#2a2f34" strokeWidth="1" />
              <text x="0" y="16" textAnchor="middle" fill="#ffffff60" fontSize="9" fontFamily="TWKEverettMono">
                {hub.code}
              </text>
            </g>
          ))}

          {/* Active Box Markers (Squares) */}
          {containers.map(box => {
            const isBoxSelected = box.id === currentBox.id;
            const isBoxTampered = box.status === 'TAMPERED';
            return (
              <g
                key={box.id}
                transform={`translate(${box.coordinates.x * 0.95}, ${box.coordinates.y * 0.8})`}
                onClick={() => onSelectContainer(box.id)}
                className="cursor-pointer"
              >
                {/* Square Marker */}
                <rect
                  x="-6"
                  y="-6"
                  width="12"
                  height="12"
                  fill={isBoxTampered ? '#EB0C0D' : isBoxSelected ? '#ffffff' : '#0c0d10'}
                  stroke={isBoxTampered ? '#EB0C0D' : isBoxSelected ? '#ffffff' : '#2a2f34'}
                  strokeWidth="1.5"
                />
                {/* Label box */}
                <g transform="translate(10, -6)">
                  <rect
                    width="60"
                    height="14"
                    fill="#000000"
                    stroke={isBoxTampered ? '#EB0C0D' : '#2a2f34'}
                    strokeWidth="1"
                  />
                  <text x="4" y="10" fill={isBoxTampered ? '#EB0C0D' : '#ffffff'} fontSize="8" fontFamily="TWKEverettMono" fontWeight="bold">
                    {box.id} {isBoxTampered && '⚡'}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* Minimal Map Overlay Label */}
        <div className="absolute top-2 left-2 flex items-center gap-2 bg-black border border-[#2a2f34] px-2 py-1 text-[9px] text-[#ffffff80]">
          <span className="w-1.5 h-1.5 bg-white inline-block" />
          <span>NATIONWIDE LOGISTICS GRID &bull; 1,420 ACTIVE CONTAINERS</span>
        </div>
      </div>

      {/* Bottom Section: Square Tamper Panel + Square Alerts Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 h-[180px] flex-shrink-0">
        {/* Left: Prominent Tamper / Latch Panel (docs/dashboard.md §2) */}
        <div className={`sq-panel p-3 flex flex-col justify-between ${isTampered ? 'border-[#EB0C0D]' : ''}`}>
          <div className="flex items-center justify-between border-b border-[#2a2f34] pb-1.5">
            <span className="text-[10px] uppercase font-bold text-white flex items-center gap-1.5">
              <span className={`w-2 h-2 ${isTampered ? 'bg-[#EB0C0D]' : 'bg-white'} inline-block`} />
              Tamper / Latch Diagnostics — {currentBox.id}
            </span>
            <span className={`text-[9px] px-1.5 py-0.5 font-bold uppercase ${isTampered ? 'bg-[#EB0C0D] text-white' : 'bg-[#2a2f34] text-white/70'}`}>
              {isTampered ? 'BREACH CONFIRMED' : 'HARDWARE SECURE'}
            </span>
          </div>

          {isTampered && currentBox.tamperReport ? (
            <div className="grid grid-cols-2 gap-2 text-[10px] my-auto">
              <div className="p-1.5 bg-[#0b0d10] border border-[#2a2f34]">
                <div className="text-[#ffffff80] text-[8px] uppercase">Location:</div>
                <div className="text-white font-bold truncate">{currentBox.tamperReport.exactLocation.lat}, {currentBox.tamperReport.exactLocation.lon} (I-80 OH)</div>
              </div>

              <div className="p-1.5 bg-[#0b0d10] border border-[#2a2f34]">
                <div className="text-[#ffffff80] text-[8px] uppercase">Timestamp:</div>
                <div className="text-white font-bold truncate">{currentBox.tamperReport.timestampIso.slice(11, 23)} UTC</div>
              </div>

              <div className="p-1.5 bg-[#0b0d10] border border-[#2a2f34]">
                <div className="text-[#ffffff80] text-[8px] uppercase">Last Custodian:</div>
                <div className="text-white font-bold truncate">{currentBox.tamperReport.lastVerifiedCustodian.name}</div>
              </div>

              <div className="p-1.5 bg-[#0b0d10] border border-[#2a2f34]">
                <div className="text-[#ffffff80] text-[8px] uppercase">Sensor Tripped:</div>
                <div className="text-[#EB0C0D] font-bold truncate">Optical (142 lx) + Shock (9.4G)</div>
              </div>

              <div className="p-1.5 bg-[#0b0d10] border border-[#EB0C0D]/50 col-span-2 flex justify-between items-center">
                <span className="text-[9px] text-[#ffffff80]">SETTLEMENT CONSEQUENCE:</span>
                <span className="text-[#EB0C0D] font-bold text-[10px]">
                  BUYER REFUND: 1,500 MST &bull; COURIER BOND SLASHED: 250 MST
                </span>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-[#ffffff80] my-auto">
              Container hardware latch is sealed at 0° with nominal strain (0.8 N·m). No tamper codes logged in Flash NVS.
            </div>
          )}

          <div className="text-[9px] text-[#fff6] border-t border-[#2a2f34] pt-1 flex justify-between">
            <span>DEVICE KEY: 0xcf73…6078</span>
            <span>BOX REGISTRY: BOUND</span>
          </div>
        </div>

        {/* Right: Alerts Feed Styled Distinctly (docs/dashboard.md §2) */}
        <div className="sq-panel p-3 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#2a2f34] pb-1.5 mb-2 flex-shrink-0">
            <span className="text-[10px] uppercase font-bold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 bg-[#2a2f34] inline-block" />
              Sensor Alerts & Event Feed
            </span>
            <span className="text-[9px] text-[#fff6]">MONITORING</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-[10px]">
            {events.map(e => (
              <div
                key={e.id}
                className={`p-1.5 border flex items-center justify-between ${
                  e.severity === 'CRITICAL'
                    ? 'border-[#EB0C0D] bg-[#EB0C0D]/10 text-white'
                    : 'border-[#2a2f34] bg-[#0c0d10] text-[#ffffff80]'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className={`w-1.5 h-1.5 ${e.severity === 'CRITICAL' ? 'bg-[#EB0C0D]' : 'bg-white'} inline-block flex-shrink-0`} />
                  <span className="font-bold text-white">{e.boxId}</span>
                  <span className="truncate">{e.description}</span>
                </div>
                <span className="text-[9px] text-[#fff6] ml-2 flex-shrink-0">{e.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

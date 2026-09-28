import React from 'react';
import { SmartContainer } from '../../types/commandCenter';
import { OpenStreetMapContainer } from './OpenStreetMapContainer';

interface Slide1MapTelemetryProps {
  containers: SmartContainer[];
  selectedContainerId: string;
  onSelectContainer: (id: string) => void;
  onNextSlide: () => void;
}

export const Slide1MapTelemetry: React.FC<Slide1MapTelemetryProps> = ({
  containers,
  selectedContainerId,
  onSelectContainer,
  onNextSlide,
}) => {
  const currentBox = containers.find(c => c.id === selectedContainerId) || containers[0];
  if (!currentBox) return null;
  const isTampered = currentBox.status === 'TAMPERED';

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden p-4 gap-4 bg-black select-none font-mono">
      {/* Left 55%: OpenStreetMap Real Geographical Layer */}
      <div className="flex-1 lg:flex-[1.2] flex flex-col h-full overflow-hidden">
        {/* Unit Selector Bar */}
        <div className="flex items-center justify-between border-b border-[#2a2f34] pb-2.5 mb-2.5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#ffffff60] uppercase">Selected Unit:</span>
            <div className="flex items-center gap-1.5">
              {containers.map(box => {
                const isSelected = box.id === currentBox.id;
                const isBoxTampered = box.status === 'TAMPERED';
                return (
                  <button
                    key={box.id}
                    onClick={() => onSelectContainer(box.id)}
                    className={`px-2.5 py-1 text-[11px] rounded-[3px] border transition-colors flex items-center gap-1.5 ${
                      isSelected
                        ? isBoxTampered
                          ? 'bg-[#EB0C0D] border-[#EB0C0D] text-white font-bold'
                          : 'bg-white text-black border-white font-bold'
                        : isBoxTampered
                        ? 'bg-[#EB0C0D]/10 border-[#EB0C0D] text-[#EB0C0D]'
                        : 'bg-[#0a0c10] border-[#2a2f34] text-[#ffffff80] hover:text-white'
                    }`}
                  >
                    <span className={`w-2 h-2 ${isBoxTampered ? 'bg-[#EB0C0D]' : isSelected ? 'bg-black' : 'bg-white/40'} rounded-[1px]`} />
                    <span>{box.id}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-[10px] text-[#ffffff60] hidden sm:block">
            ORDER #{currentBox.orderId} &bull; {currentBox.currentLocationName}
          </div>
        </div>

        {/* Real OpenStreetMap Dark Matter Layer */}
        <div className="flex-1 w-full min-h-[350px]">
          <OpenStreetMapContainer
            containers={containers}
            selectedContainerId={selectedContainerId}
            onSelectContainer={onSelectContainer}
          />
        </div>
      </div>

      {/* Right 45%: 4 Large Minimalist Hero Square Tiles */}
      <div className="w-full lg:w-[480px] flex flex-col justify-between gap-3 flex-shrink-0">
        <div className="grid grid-cols-2 gap-3 flex-1">
          {/* Tile 1: LID DISTANCE */}
          <div className={`sq-hero-tile ${currentBox.telemetry.lidDistanceMm > 2 ? 'is--tamper' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#ffffff80] uppercase tracking-wider">01 // LID SEAL</span>
              <span className={`w-2.5 h-2.5 ${currentBox.telemetry.lidDistanceMm > 2 ? 'bg-[#EB0C0D]' : 'bg-[#2a2f34]'} rounded-[1px]`} />
            </div>
            <div>
              <div className={`text-4xl font-bold font-sans tracking-tight ${currentBox.telemetry.lidDistanceMm > 2 ? 'text-[#EB0C0D]' : 'text-white'}`}>
                {currentBox.telemetry.lidDistanceMm} <span className="text-xl font-normal text-white/50">mm</span>
              </div>
              <div className="text-[10px] text-[#ffffff60] mt-1 uppercase">
                {currentBox.telemetry.lidDistanceMm > 2 ? 'SEAL BREACHED (>2.0mm)' : 'NOMINAL SEAL (<1.5mm)'}
              </div>
            </div>
          </div>

          {/* Tile 2: ACCELEROMETER / SHOCK */}
          <div className={`sq-hero-tile ${currentBox.telemetry.accelG > 5 ? 'is--tamper' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#ffffff80] uppercase tracking-wider">02 // SHOCK SENSOR</span>
              <span className={`w-2.5 h-2.5 ${currentBox.telemetry.accelG > 5 ? 'bg-[#EB0C0D]' : 'bg-[#2a2f34]'} rounded-[1px]`} />
            </div>
            <div>
              <div className={`text-4xl font-bold font-sans tracking-tight ${currentBox.telemetry.accelG > 5 ? 'text-[#EB0C0D]' : 'text-white'}`}>
                {currentBox.telemetry.accelG} <span className="text-xl font-normal text-white/50">G</span>
              </div>
              <div className="text-[10px] text-[#ffffff60] mt-1 uppercase">
                {currentBox.telemetry.accelG > 5 ? 'IMPACT DETECTED (>8.0G)' : 'NOMINAL TRANSIT (<2.0G)'}
              </div>
            </div>
          </div>

          {/* Tile 3: PHYSICAL SERVO LATCH */}
          <div className={`sq-hero-tile ${currentBox.telemetry.nvsLatchState === 'TAMPER_LATCHED' ? 'is--tamper' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#ffffff80] uppercase tracking-wider">03 // SERVO LATCH</span>
              <span className={`w-2.5 h-2.5 ${currentBox.telemetry.nvsLatchState === 'TAMPER_LATCHED' ? 'bg-[#EB0C0D]' : 'bg-[#2a2f34]'} rounded-[1px]`} />
            </div>
            <div>
              <div className={`text-3xl font-bold font-sans tracking-tight ${currentBox.telemetry.nvsLatchState === 'TAMPER_LATCHED' ? 'text-[#EB0C0D]' : 'text-white'}`}>
                {currentBox.telemetry.latchServoAngle === 0 ? '0° LOCKED' : '90° OPEN'}
              </div>
              <div className="text-[10px] text-[#ffffff60] mt-1 uppercase">
                TORQUE STRAIN: {currentBox.telemetry.latchStrainNm} N·m
              </div>
            </div>
          </div>

          {/* Tile 4: BATTERY & OPTICAL */}
          <div className={`sq-hero-tile ${currentBox.telemetry.opticalLux > 15 ? 'is--tamper' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#ffffff80] uppercase tracking-wider">04 // CHAMBER LUX</span>
              <span className={`w-2.5 h-2.5 ${currentBox.telemetry.opticalLux > 15 ? 'bg-[#EB0C0D]' : 'bg-[#2a2f34]'} rounded-[1px]`} />
            </div>
            <div>
              <div className={`text-4xl font-bold font-sans tracking-tight ${currentBox.telemetry.opticalLux > 15 ? 'text-[#EB0C0D]' : 'text-white'}`}>
                {currentBox.telemetry.opticalLux} <span className="text-xl font-normal text-white/50">lx</span>
              </div>
              <div className="text-[10px] text-[#ffffff60] mt-1 uppercase">
                {currentBox.telemetry.opticalLux > 15 ? 'LIGHT INGRESS (UNSEALED)' : 'DARK CHAMBER OK'}
              </div>
            </div>
          </div>
        </div>

        {/* Action Button Row (Styled like Landing Page) */}
        <div className="flex items-center justify-between p-3 border border-[#2a2f34] bg-[#08090c] rounded-[3px]">
          <div>
            <div className="text-[11px] text-white font-bold">{currentBox.id}: {currentBox.status}</div>
            <div className="text-[9px] text-[#ffffff60]">ESCROW PROTECTED: {currentBox.escrowValueMst} MST</div>
          </div>

          <button onClick={onNextSlide} className="cta-btn-red">
            <span>{isTampered ? 'INSPECT TAMPER EVIDENCE' : 'VIEW AUDIT LEDGER'}</span>
            <span>&rarr;</span>
          </button>
        </div>
      </div>
    </div>
  );
};

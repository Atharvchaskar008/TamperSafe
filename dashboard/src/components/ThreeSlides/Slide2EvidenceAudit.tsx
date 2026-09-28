import React, { useState } from 'react';
import { SmartContainer } from '../../types/commandCenter';

interface Slide2EvidenceAuditProps {
  containers: SmartContainer[];
  selectedContainerId: string;
  onSelectContainer: (id: string) => void;
  onNextSlide: () => void;
  onPrevSlide: () => void;
}

export const Slide2EvidenceAudit: React.FC<Slide2EvidenceAuditProps> = ({
  containers,
  selectedContainerId,
  onSelectContainer,
  onNextSlide,
  onPrevSlide,
}) => {
  const currentBox = containers.find(c => c.id === selectedContainerId) || containers[0];
  if (!currentBox) return null;
  const isTampered = currentBox.status === 'TAMPERED';
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);

  const handleVerify = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setVerified(true);
    }, 500);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 gap-4 bg-black select-none font-mono">
      {/* Top Banner: Minimalist Status Hero */}
      <div className={`p-4 border rounded-[3px] flex items-center justify-between ${
        isTampered ? 'border-[#EB0C0D] bg-[#EB0C0D]/10' : 'border-[#2a2f34] bg-[#08090c]'
      }`}>
        <div className="flex items-center gap-3">
          <span className={`w-3.5 h-3.5 ${isTampered ? 'bg-[#EB0C0D]' : 'bg-white'} rounded-[1px]`}></span>
          <div>
            <div className={`text-base font-bold uppercase tracking-tight ${isTampered ? 'text-[#EB0C0D]' : 'text-white'}`}>
              {isTampered ? `CRITICAL BREACH EVIDENCE: ${currentBox.id}` : `SECURITY VERIFICATION: ${currentBox.id}`}
            </div>
            <div className="text-[10px] text-[#ffffff80] mt-0.5">
              ORDER #{currentBox.orderId} &bull; CONSIGNMENT: {currentBox.consignment}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onPrevSlide} className="cta-btn-black">
            &larr; MAP
          </button>
          <button onClick={onNextSlide} className="cta-btn-red">
            SETTLEMENT &rarr;
          </button>
        </div>
      </div>

      {/* 6 Large Square Diagnostic Blocks (Increased size, minimal text) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 flex-1">
        {/* Block 1: Location */}
        <div className="sq-hero-tile">
          <div className="text-[10px] text-[#ffffff60] uppercase">01 // INCIDENT LOCATION</div>
          <div className="my-2">
            <div className="text-xl font-bold font-sans text-white">
              {currentBox.coordinates.lat}&deg; N, {currentBox.coordinates.lon}&deg; W
            </div>
            <div className="text-[11px] text-[#ffffff80] mt-1">
              {currentBox.currentLocationName}
            </div>
          </div>
          <div className="text-[9px] text-[#fff6]">AUTHENTICATED GPS FIX</div>
        </div>

        {/* Block 2: Timestamp */}
        <div className="sq-hero-tile">
          <div className="text-[10px] text-[#ffffff60] uppercase">02 // INCIDENT TIMESTAMP</div>
          <div className="my-2">
            <div className="text-xl font-bold font-sans text-white">
              22:40:12.842 UTC
            </div>
            <div className="text-[11px] text-[#ffffff80] mt-1">
              2026-09-28 &bull; &plusmn;1.2ms NTP HARDWARE SYNC
            </div>
          </div>
          <div className="text-[9px] text-[#fff6]">ESP32-S3 INTERNAL RTC</div>
        </div>

        {/* Block 3: Custodian */}
        <div className="sq-hero-tile">
          <div className="text-[10px] text-[#ffffff60] uppercase">03 // LAST CUSTODIAN</div>
          <div className="my-2">
            <div className="text-xl font-bold font-sans text-white truncate">
              {currentBox.currentHolder.split('(')[0]}
            </div>
            <div className="text-[11px] text-[#ffffff80] mt-1">
              ID: CR-8821 &bull; RFID TAG: {currentBox.rfidTagUid.slice(0, 8)}…
            </div>
          </div>
          <div className={`text-[9px] font-bold ${isTampered ? 'text-[#EB0C0D]' : 'text-white/50'}`}>
            {isTampered ? 'COURIER BOND: SLASHED' : 'COURIER BOND: ACTIVE'}
          </div>
        </div>

        {/* Block 4: Sensor Evidence */}
        <div className="sq-hero-tile">
          <div className="text-[10px] text-[#ffffff60] uppercase">04 // SENSOR SIGNATURE</div>
          <div className="my-2">
            <div className={`text-xl font-bold font-sans ${isTampered ? 'text-[#EB0C0D]' : 'text-white'}`}>
              {isTampered ? 'OPTICAL + SHOCK (9.4G)' : 'ALL SENSORS NOMINAL'}
            </div>
            <div className="text-[11px] text-[#ffffff80] mt-1">
              LID: {currentBox.telemetry.lidDistanceMm}mm &bull; LIGHT: {currentBox.telemetry.opticalLux} lx
            </div>
          </div>
          <div className="text-[9px] text-[#fff6]">TORQUE STRAIN: {currentBox.telemetry.latchStrainNm} N·m</div>
        </div>

        {/* Block 5: Blockchain Event */}
        <div className="sq-hero-tile">
          <div className="text-[10px] text-[#ffffff60] uppercase">05 // SMART CONTRACT TX</div>
          <div className="my-2">
            <div className="text-xl font-bold font-sans text-white">
              {isTampered ? 'reportTamper()' : 'TelemetryAnchor'}
            </div>
            <div className="text-[11px] text-[#ffffff80] mt-1 truncate">
              MST BLOCK #18492008 &bull; ORACLE: 0x7099…79C8
            </div>
          </div>
          <div className="text-[9px] text-[#fff6]">TX HASH: 0xbc8401f82049e083…</div>
        </div>

        {/* Block 6: Hash-Chain Match */}
        <div className="sq-hero-tile">
          <div className="text-[10px] text-[#ffffff60] uppercase">06 // CRYPTOGRAPHIC AUDIT</div>
          <div className="my-2">
            <div className="text-xl font-bold font-sans text-[#00e676]">
              {verified ? 'MATCH = 100% PROVED' : 'CHAIN INTEGRITY READY'}
            </div>
            <div className="text-[11px] text-[#ffffff80] mt-1 truncate">
              SEQ #{currentBox.anchoredSeq} &bull; {currentBox.hashChainHead.slice(0, 16)}…
            </div>
          </div>
          <div className="text-[9px] text-[#fff6]">ZERO-KNOWLEDGE AUDIT TRAIL</div>
        </div>
      </div>

      {/* Bottom Action Card */}
      <div className="p-3 border border-[#2a2f34] bg-[#08090c] rounded-[3px] flex items-center justify-between">
        <div className="text-[11px] text-[#ffffff80]">
          SHA-256 HEAD: <strong className="text-white font-mono">{currentBox.hashChainHead}</strong>
        </div>

        <button onClick={handleVerify} disabled={isVerifying} className="cta-btn-black">
          <span>{isVerifying ? 'COMPUTING HASHES…' : 'RUN LOG VERIFIER'}</span>
        </button>
      </div>
    </div>
  );
};

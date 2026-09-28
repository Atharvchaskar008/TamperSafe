export type ContainerStatus = 
  | 'IN_TRANSIT'
  | 'SEALED'
  | 'UNLOCK_REQUESTED'
  | 'DELIVERED'
  | 'TAMPERED';

export interface CustodyStep {
  id: string;
  stepNumber: number;
  title: string;
  custodian: string;
  custodianType: 'DISPATCHER' | 'COURIER' | 'INTERMODAL_CARRIER' | 'BUYER';
  location: string;
  timestamp: string;
  rfidVerified: boolean;
  bondStatus?: string;
  txHash?: string;
  isTamperEvent?: boolean;
  notes: string;
}

export interface SmartBoxTelemetry {
  batteryVoltage: number; // e.g. 3.94V
  batteryPercent: number; // e.g. 88%
  internalTempC: number;  // e.g. 19.4°C
  humidityPct: number;    // e.g. 36%
  lidDistanceMm: number;  // e.g. 0.8mm (breached if > 2.0mm)
  opticalLux: number;     // e.g. 0.2 Lux (dark chamber, breached if > 15 Lux)
  accelG: number;         // e.g. 1.2G (breached if > 8.0G)
  latchServoAngle: number;// 0 = Locked, 90 = Unlocked
  latchStrainNm: number;  // Normal < 2.0 N·m
  nvsLatchState: 'SECURE' | 'TAMPER_LATCHED';
  meshSignalDbm: number;  // e.g. -68 dBm
}

export interface TamperIncidentReport {
  isTampered: boolean;
  exactLocation: {
    lat: number;
    lon: number;
    description: string;
  };
  timestampIso: string;
  timestampPrecision: string;
  lastVerifiedCustodian: {
    name: string;
    id: string;
    walletAddress: string;
    bondAmountMst: number;
    bondStatus: 'ACTIVE' | 'SLASHED_TO_SELLER';
  };
  triggeringSensor: string;
  hardwareEvidence: string;
  blockchainEvidence: {
    contractName: string;
    contractAddress: string;
    methodCalled: string;
    blockNumber: number;
    txHash: string;
    oracleSigner: string;
  };
  settlementConsequences: {
    buyerDepositMst: number;
    buyerRefundStatus: string;
    courierBondMst: number;
    courierBondStatus: string;
    sellerPayoutStatus: string;
    boxQuarantineState: string;
  };
}

export interface SmartContainer {
  id: string;            // e.g. 'TS-BOX-03'
  orderId: number;       // e.g. 1039
  consignment: string;   // e.g. 'ASML EUV Optical Mask (High-Value)'
  status: ContainerStatus;
  currentHolder: string;
  originHub: string;
  destinationHub: string;
  currentLocationName: string;
  coordinates: { x: number; y: number; lat: number; lon: number };
  progressPct: number;
  escrowValueMst: number;
  escrowValueUsd: number;
  courierBondMst: number;
  speedMph: number;
  telemetry: SmartBoxTelemetry;
  tamperReport?: TamperIncidentReport;
  custodyHistory: CustodyStep[];
  hashChainHead: string;
  anchoredSeq: number;
  rfidTagUid: string;
}

export interface HubTerminal {
  id: string;
  name: string;
  city: string;
  code: string;
  x: number; // SVG map X (0 - 1000)
  y: number; // SVG map Y (0 - 600)
  activeBoxes: number;
}

export interface SecurityEvent {
  id: string;
  type: 'TAMPER_ALERT' | 'ANCHOR_COMMITTED' | 'CUSTODY_HANDOFF' | 'ESCROW_SETTLEMENT' | 'SENSOR_ANOMALY';
  boxId: string;
  orderId: number;
  timestamp: string;
  description: string;
  txHash?: string;
  severity: 'CRITICAL' | 'SUCCESS' | 'INFO' | 'WARNING';
}

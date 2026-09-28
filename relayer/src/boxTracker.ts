// In-memory "what do we currently know about this box" snapshot, fed by
// every accepted device event. Backs GET /api/boxes, the Track tab's sensor
// tiles, the watchdog, and the GPS badge. Not persisted -- rebuilt from the
// next event after a restart (jsonl rebuild restores seq/head trust
// separately, in ingest/store.ts; this is just the "latest telemetry" view).
import type { StoredEvent } from "./ingest/types.js";

export interface BoxSnapshot {
  boxId: string;
  lastSeenAt: number; // unix ms
  state: string;
  orderId: number;
  lat_e6: number;
  lon_e6: number;
  fix: 0 | 1;
  dist_mm: number;
  lid: 0 | 1;
  accel_mg: number;
  tilt_deg: number;
  lock: "L" | "U";
  batt_mv: number;
  seq: number;
  /** display-only simulated GPS route, toggled via POST /api/demo/gps-sim.
   * Never affects any on-chain call -- confirmDelivery always carries the
   * box's real `fix` flag (Invariant 4). */
  gpsSimEnabled: boolean;
}

/** GPS badge per ARCHITECTURE.md §9.3: LIVE / NO_FIX / SIMULATED. */
export function gpsBadge(snapshot: Pick<BoxSnapshot, "fix" | "gpsSimEnabled">): "LIVE" | "NO_FIX" | "SIMULATED" {
  if (snapshot.gpsSimEnabled) return "SIMULATED";
  return snapshot.fix === 1 ? "LIVE" : "NO_FIX";
}

export class BoxTracker {
  private boxes = new Map<string, BoxSnapshot>();

  recordEvent(boxId: string, event: StoredEvent): void {
    const prev = this.boxes.get(boxId);
    this.boxes.set(boxId, {
      boxId,
      lastSeenAt: Date.now(),
      state: event.state,
      orderId: event.order_id,
      lat_e6: event.lat_e6,
      lon_e6: event.lon_e6,
      fix: event.fix,
      dist_mm: event.dist_mm,
      lid: event.lid,
      accel_mg: event.accel_mg,
      tilt_deg: event.tilt_deg,
      lock: event.lock,
      batt_mv: event.batt_mv,
      seq: event.seq,
      gpsSimEnabled: prev?.gpsSimEnabled ?? false,
    });
  }

  setGpsSim(boxId: string, enabled: boolean): void {
    const prev = this.boxes.get(boxId);
    if (prev) {
      prev.gpsSimEnabled = enabled;
    } else {
      this.boxes.set(boxId, {
        boxId,
        lastSeenAt: 0,
        state: "BOOT",
        orderId: 0,
        lat_e6: 0,
        lon_e6: 0,
        fix: 0,
        dist_mm: 0,
        lid: 1,
        accel_mg: 1000,
        tilt_deg: 0,
        lock: "L",
        batt_mv: 0,
        seq: 0,
        gpsSimEnabled: enabled,
      });
    }
  }

  get(boxId: string): BoxSnapshot | undefined {
    return this.boxes.get(boxId);
  }

  all(): BoxSnapshot[] {
    return [...this.boxes.values()];
  }
}

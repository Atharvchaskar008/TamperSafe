// SIGNAL_LOST once per outage when a SEALED box goes quiet 30s+.
// See docs/ARCHITECTURE.md §7 (alert code 12) and §10 "Watchdog".
import type { BoxTracker } from "./boxTracker.js";
import type { RulesEngine } from "./rules.js";

const QUIET_THRESHOLD_MS = 30_000;
const CHECK_INTERVAL_MS = 2_000;

export class Watchdog {
  private alreadyRaised = new Set<string>(); // boxId -- cleared once the box speaks again
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly tracker: BoxTracker,
    private readonly rules: RulesEngine,
  ) {}

  start(): void {
    this.timer = setInterval(() => this.check(), CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private check(): void {
    const now = Date.now();
    for (const box of this.tracker.all()) {
      const quiet = now - box.lastSeenAt >= QUIET_THRESHOLD_MS;
      if (box.state === "SEALED" && quiet) {
        if (!this.alreadyRaised.has(box.boxId)) {
          this.alreadyRaised.add(box.boxId);
          this.rules.raiseSignalLost(box.boxId, box.orderId);
        }
      } else {
        this.alreadyRaised.delete(box.boxId);
      }
    }
  }
}

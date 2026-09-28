// TamperSafe box firmware -- main sketch.
//
// M2/M4 status (read before flashing): docs/HARDWARE.md §1-2 are still all
// TBD/☐ -- no sensor pin has been confirmed by the team, and there is no
// physical box yet. Per CLAUDE.md's board discipline ("a sketch uses only
// pins the team has confirmed... a TBD row blocks"), this sketch does NOT
// drive the ultrasonic, IR lid, GPS or RFID hardware -- see pins.h and
// sensors_stub.cpp. What IS real here: the state machine, the NVS tamper
// latch, the hash chain + HMAC self-test, the core-0 network task, the
// servo (with placeholder angles), and MPU6050 shock/tilt alerts -- none
// of those need a single header pin, since they're either onboard I2C
// (fixed addresses, not TBD) or pure logic.
//
// setup() order follows the neurick-firmware skill exactly:
//   Serial.begin -> nr.begin() -> OLED display.begin() -> other peripherals.

#include <Newrick.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFi.h>

#include "pins.h"
#include "config.h"
#include "protocol.h"
#include "box_context.h"
#include "events.h"
#include "nvs_store.h"
#include "network_task.h"
#include "mpu.h"
#include "sensors_stub.h"

Newrick nr;

// --- OLED --------------------------------------------------------------------
// Constructed with clkDuring=clkAfter=400000 (both explicit), NOT the
// library's defaults (400000/100000). Why: Adafruit_SSD1306 wraps every
// I2C transfer with wire->setClock(clkDuring) then wire->setClock(clkAfter)
// (see Adafruit_SSD1306.cpp's SETWIRECLOCK/RESWIRECLOCK macros) -- with the
// library's own default clkAfter of 100000, every OLED refresh would drop
// the SHARED bus (STM32 0x08, MPU6050 0x68) to 100 kHz afterwards, silently
// contradicting nr.begin()'s 400 kHz and the "never call Wire.setClock()"
// rule in spirit (we don't call it ourselves, but the library does, on our
// behalf, on every display() call). Setting both parameters to 400000 means
// the library still calls setClock(), but only ever back to the same
// 400 kHz nr.begin() already set -- a no-op in effect. Flagged in the M4
// report; the clean fix would be a periphBegin-style "don't touch the
// clock" library option, which this version of Adafruit_SSD1306 (2.5.17)
// doesn't expose.
Adafruit_SSD1306 display(128, 32, &Wire, -1, 400000, 400000);

// --- Servo angles: placeholders only, see docs/HARDWARE.md §5 ("Servo: LOCK
// angle = [ ], UNLOCK angle = [ ]"). Do not trust these on a real box.
#define LOCK_ANGLE      170 // TODO: calibrate in M2
#define UNLOCK_ANGLE     10 // TODO: calibrate in M2
#define SERVO_S2_REST    90 // TODO: calibrate in M2 (S2 channel, unused by the latch)
#define SERVO_S4_REST    90 // TODO: calibrate in M2 (S4 channel -- Newrick.h has no S3; see docs/neurick/Newrick.h)

#define BATTERY_MIN_VOLTS 10.5f // docs/HARDWARE.md §5

// --- Tamper code names, for the OLED's "TAMPERED: <name>" (ARCHITECTURE §8) --
static const char *tamperCodeName(uint8_t code) {
  switch (code) {
    case 1: return "LID_OPENED";
    case 2: return "CONTENTS_DISTURBED";
    case 3: return "POWER_INTERRUPTED";
    default: return "UNKNOWN";
  }
}

// --- Scheduler cadence, per ARCHITECTURE.md §8 --------------------------------
#define IR_INTERVAL_MS         50   // 20 Hz
#define ULTRASONIC_INTERVAL_MS 100  // 10 Hz
#define MPU_INTERVAL_MS        50   // 20 Hz
#define SENSORS_INTERVAL_MS    500  // 2 Hz  (nr.updateSensors())
#define OLED_INTERVAL_MS       500  // 2 Hz
#define TELEMETRY_SEALED_MS    2000
#define TELEMETRY_OTHER_MS     10000

static unsigned long tIr = 0, tUltra = 0, tMpu = 0, tSensors = 0, tOled = 0, tTelemetry = 0;

// Last cmd_id we printed an "IGNORED command" line for, so a command the
// relayer keeps resending (per §9.2, "the relayer re-sends an
// unacknowledged command on every response") logs once, not once per
// loop() tick.
static char lastIgnoredCmdId[32] = "";

// Set once at boot by runProtocolSelfTest(); surfaced on every reportStatus()
// call (Serial + OLED), not just the one-shot boot print, so it can't be
// missed by a Serial Monitor that attaches late.
static bool g_selfTestOk = false;

// Last time nr.updateSensors() actually succeeded. ctx.battValid alone only
// says "at least once, ever" -- it never goes back to false, so on its own
// it would let SEAL through on a value that's gone stale (e.g. the 12V pack
// is off but USB is still powering the ESP32, so updateSensors() keeps
// failing while nr.batteryVolts holds whatever it last read before that).
// attemptSeal() additionally requires a successful read within the last 2s.
static unsigned long lastBattOkMs = 0;
#define BATTERY_FRESH_MS 2000

// ---------------------------------------------------------------------------
// Seal / unlock / reset -- the only places that move the servo or write NVS
// `state`. Every one of them writes NVS BEFORE the corresponding event goes
// to the network task (CLAUDE.md invariant: "Latch before report").
// ---------------------------------------------------------------------------

// Reserved for the real IR/ultrasonic tamper rules once HARDWARE.md §2 is
// confirmed (PINS_CONFIRMED=1) -- unused for now since detection never
// calls it, hence the attribute to silence the "defined but not used"
// warning without deleting the function the rules will need.
__attribute__((unused)) static void doTamper(uint8_t code) {
  // Tamper rules only run in SEALED (CLAUDE.md invariant: "Tamper only
  // while SEALED"). Callers are responsible for that check; this function
  // just performs the transition once a caller has already decided to.
  ctx.tamperCode = code;
  ctx.state = BoxState::TAMPERED;
  nvsSaveState("TAMPERED");     // latch...
  nvsSaveTamperCode(code);
  emitEvent("TAMPER", code, ""); // ...then report
}

static void attemptSeal(uint32_t orderId, const char *cmdId) {
  ctx.state = BoxState::ARMING;
  nvsSaveState("ARMING");
  ctx.orderId = orderId;
  nvsSaveOrderId(orderId);

  // Lid check skipped: IR is stubbed (PINS_CONFIRMED=0 in pins.h). A real
  // ARMING must refuse to seal with the lid open (ARCHITECTURE §8:
  // "ARMING --> IDLE: lid open or battery low -> SEAL_FAILED") -- only the
  // battery half of that guard is real here.
  bool batteryFresh = ctx.battValid && (millis() - lastBattOkMs <= BATTERY_FRESH_MS);
  bool batteryOk = batteryFresh && (nr.batteryVolts >= BATTERY_MIN_VOLTS);

  if (!batteryOk) {
    ctx.state = BoxState::IDLE;
    nvsSaveState("IDLE");
    emitEvent("SEAL_FAILED", 0, cmdId); // SEAL_FAILED is an event, not a persisted state (§6 lists 6 states, not 7)
    return;
  }

  // Baseline capture stubbed: the real rule (HARDWARE.md §5) is "median of
  // 20 reads over 2s" from the ultrasonic sensor, which doesn't exist yet.
  ctx.baselineMm = 0; // FAKE
  nvsSaveBaseline(0);

  nr.servo(LOCK_ANGLE, SERVO_S2_REST, SERVO_S4_REST); // TODO: calibrate in M2
  ctx.lock = 'L';

  ctx.state = BoxState::SEALED;
  nvsSaveState("SEALED"); // latch...
  emitEvent("SEALED", 0, cmdId); // ...then report
}

static void doUnlock(const char *cmdId) {
  // RAM/NVS state flips to OPEN_AUTHORIZED before the servo moves, so a
  // reboot mid-unlock never latches POWER_INTERRUPTED against a state the
  // box was already leaving on purpose.
  ctx.state = BoxState::OPEN_AUTHORIZED;
  nvsSaveState("OPEN_AUTHORIZED");
  nr.servo(UNLOCK_ANGLE, SERVO_S2_REST, SERVO_S4_REST); // TODO: calibrate in M2
  ctx.lock = 'U';
  emitEvent("UNLOCKED", 0, cmdId);
}

static void doReset(const char *cmdId) {
  ctx.orderId = 0;
  ctx.baselineMm = 0;
  ctx.tamperCode = 0;
  nvsSaveOrderId(0);
  nvsSaveBaseline(0);
  nvsSaveTamperCode(0);
  // Judgment call (undocumented in ARCHITECTURE §8): RESET also unlocks the
  // servo, since IDLE means "ready to be reloaded and re-sealed" and the
  // depot needs physical access either way (whether coming from TAMPERED or
  // OPEN_AUTHORIZED). Flagged for the team to confirm.
  nr.servo(UNLOCK_ANGLE, SERVO_S2_REST, SERVO_S4_REST); // TODO: calibrate in M2
  ctx.lock = 'U';
  ctx.state = BoxState::IDLE;
  nvsSaveState("IDLE");
  emitEvent("RESET_DONE", 0, cmdId);
}

// ---------------------------------------------------------------------------
// Boot-time NVS state mapping, per ARCHITECTURE.md §8's state diagram.
// ---------------------------------------------------------------------------
static void handleBoot() {
  String savedStateStr = nvsLoadState();
  BoxState saved = boxStateFromName(savedStateStr);

  ctx.orderId = nvsLoadOrderId();
  ctx.seq = nvsLoadSeq();
  strlcpy(ctx.head, nvsLoadHead().c_str(), sizeof(ctx.head));
  ctx.baselineMm = nvsLoadBaseline();
  ctx.tamperCode = nvsLoadTamperCode();

  switch (saved) {
    case BoxState::SEALED:
      // "BOOT --> TAMPERED: NVS state SEALED -> TAMPER POWER_INTERRUPTED"
      ctx.tamperCode = 3; // POWER_INTERRUPTED
      ctx.state = BoxState::TAMPERED;
      nvsSaveState("TAMPERED"); // latch...
      nvsSaveTamperCode(3);
      ctx.lock = 'L';
      break;
    case BoxState::TAMPERED:
      // "BOOT --> TAMPERED: NVS state TAMPERED (stays latched)"
      ctx.state = BoxState::TAMPERED;
      ctx.lock = 'L';
      break;
    case BoxState::OPEN_AUTHORIZED:
      // "BOOT --> IDLE: NVS state IDLE / OPEN_AUTHORIZED" -- yes, even
      // OPEN_AUTHORIZED maps to IDLE at boot per the diagram, not back to
      // OPEN_AUTHORIZED.
      ctx.state = BoxState::IDLE;
      nvsSaveState("IDLE");
      ctx.lock = 'U';
      break;
    case BoxState::ARMING:
      // Not in the §8 diagram at all -- ARMING is a sub-second transient in
      // normal operation, so a reboot catching it there is itself unusual.
      // Judgment call: treat it like "never sealed" and map to IDLE, since
      // the relayer never received a SEALED event for whatever order was
      // being armed. Flagged for the team.
      ctx.state = BoxState::IDLE;
      nvsSaveState("IDLE");
      ctx.lock = 'U';
      break;
    case BoxState::IDLE:
    case BoxState::BOOT: // unknown/empty NVS value (first boot ever)
    default:
      ctx.state = BoxState::IDLE;
      nvsSaveState("IDLE");
      ctx.lock = 'U';
      break;
  }
}

// ---------------------------------------------------------------------------
// Status on Serial + OLED (ARCHITECTURE §8 / task requirement: "Current
// state shown on OLED and Serial").
// ---------------------------------------------------------------------------
static void reportStatus() {
  bool wifiOk = (WiFi.status() == WL_CONNECTED);

  // Self-test result folded into the recurring 2Hz line, not just the one
  // boot-time print -- the CDC Serial Monitor often attaches after that
  // first print has already scrolled past, so PASS/FAIL needs to stay
  // visible on both Serial and the OLED for as long as the box is on.
  Serial.printf("[state=%s] order=%lu seq=%lu batt=%s wifi=%s lock=%c selftest=%s\n",
                boxStateName(ctx.state), (unsigned long)ctx.orderId, (unsigned long)ctx.seq,
                ctx.battValid ? String(nr.batteryVolts, 2).c_str() : "?",
                wifiOk ? "OK" : "--", ctx.lock, g_selfTestOk ? "PASS" : "FAIL");

  // 128x32 at text size 1 = 21 chars/row, 4 rows (y=0/8/16/24). Wrap is
  // disabled deliberately: a wrapped line 3 ("TAMPERED: POWER_INTERRUPTED"
  // is 27 chars) would overlap line 4 instead of being clipped -- clipped
  // but readable beats overlapping and unreadable on the one screen the
  // power-cut demo depends on.
  display.clearDisplay();
  display.setTextWrap(false);
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  display.setCursor(0, 0);
  display.printf("%s %s", BOX_ID, g_selfTestOk ? "ST:OK" : "ST:FAIL");

  display.setCursor(0, 8);
  if (ctx.state == BoxState::TAMPERED) {
    display.print("TAMPERED:");
  } else {
    display.print(boxStateName(ctx.state));
  }

  display.setCursor(0, 16);
  if (ctx.state == BoxState::TAMPERED) {
    display.print(tamperCodeName(ctx.tamperCode)); // longest name is 18 chars, fits
  } else {
    display.printf("order=%lu", (unsigned long)ctx.orderId);
  }

  display.setCursor(0, 24);
  display.printf("B:%s W:%s L:%c", ctx.battValid ? String(nr.batteryVolts, 1).c_str() : "?",
                 wifiOk ? "Y" : "N", ctx.lock);

  display.display();
}

// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(2000);

  nr.begin(); // starts I2C on SDA=8/SCL=9 at 400 kHz -- must be first and only Wire.begin()

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C, /*reset=*/true, /*periphBegin=*/false)) {
    // periphBegin=false: don't let the SSD1306 library call Wire.begin()
    // again (nr.begin() already did, on 8/9 -- a second Wire.begin() with
    // this library's defaults would reset the bus to the wrong pins).
    Serial.println("WARNING: SSD1306 display.begin() failed -- OLED not present or wrong address");
  }
  display.clearDisplay();
  display.display();

  // Safe-stop path (neurick-firmware skill): motor commands persist until
  // changed, so stop them explicitly even though this sketch never drives
  // motors.
  nr.motor(1, 0);
  nr.motor(2, 0);
  nr.motor(3, 0);
  nr.motor(4, 0);

  nvsInit();
  uint32_t bootCount = nvsIncrementBootCount();
  Serial.printf("TamperSafe box booting, boot_count=%lu\n", (unsigned long)bootCount);

  g_selfTestOk = runProtocolSelfTest(); // prints SELFTEST PASS/FAIL; boot continues either way so the team can still see a FAIL on Serial/OLED rather than the box going dark

  if (!mpuInit()) {
    Serial.println("WARNING: MPU6050 init failed (0x68 not answering?) -- SHOCK/TILT alerts disabled until it recovers");
  }

  handleBoot();

  // Boot-time servo position matches the post-mapping state: TAMPERED stays
  // locked, everything else (only IDLE is reachable post-mapping) is
  // unlocked. See handleBoot()'s switch for why SEALED/OPEN_AUTHORIZED/
  // ARMING can never survive a reboot as themselves.
  if (ctx.state == BoxState::TAMPERED) {
    nr.servo(LOCK_ANGLE, SERVO_S2_REST, SERVO_S4_REST); // TODO: calibrate in M2
  } else {
    nr.servo(UNLOCK_ANGLE, SERVO_S2_REST, SERVO_S4_REST); // TODO: calibrate in M2
  }

  networkInit(); // starts the core-0 task; safe to start after NVS/state are loaded

  emitEvent("BOOT", 0, "");
  if (ctx.state == BoxState::TAMPERED && ctx.orderId != 0) {
    // Re-emit TAMPER with the latched code on EVERY boot that comes up
    // TAMPERED against a real order -- not just the boot that first caused
    // it (tamperCode==3/POWER_INTERRUPTED). Reasoning: the ring buffer that
    // carries TAMPER to the relayer lives in RAM only. A tamper detected
    // while offline (LID_OPENED, CONTENTS_DISTURBED, or a prior
    // POWER_INTERRUPTED) that is then followed by ANOTHER reboot before the
    // box ever reconnects would otherwise never reach the chain, which
    // breaks CLAUDE.md invariant 3 ("Once a box reports tamper... both the
    // firmware (NVS) and the contract keep it"). Latch already happened
    // inside handleBoot() (or on a prior boot) before this BOOT event was
    // emitted above, so this still satisfies "latch before report".
    //
    // Flag for the main session: the relayer must treat a TAMPER for an
    // order that's already Tampered on-chain as a no-op (Escrow.reportTamper
    // would revert InvalidStatus otherwise on this resend).
    emitEvent("TAMPER", ctx.tamperCode, "");
  }

  reportStatus();
}

void loop() {
  unsigned long now = millis();

  // --- IR lid (20 Hz): stubbed, no-op. Real driver + tamper rule land once
  // HARDWARE.md §2's IR row is confirmed and PINS_CONFIRMED flips to 1.
  if (now - tIr >= IR_INTERVAL_MS) {
    tIr = now;
    (void)readLidIR();
  }

  // --- Ultrasonic (10 Hz): stubbed, no-op. Same as above.
  if (now - tUltra >= ULTRASONIC_INTERVAL_MS) {
    tUltra = now;
    (void)readUltrasonicMm();
  }

  // --- GPS (every loop): stubbed, no-op.
  {
    int32_t lat, lon;
    (void)readGPS(&lat, &lon); // ctx.lat_e6/lon_e6/fix stay at their FAKE defaults
  }

  // --- MPU6050 (20 Hz): real.
  if (now - tMpu >= MPU_INTERVAL_MS) {
    tMpu = now;
    int32_t accelMg, tiltDeg;
    if (mpuReadAccelTilt(&accelMg, &tiltDeg)) {
      ctx.accelMg = accelMg;
      ctx.tiltDeg = tiltDeg;
      // Judgment call, not explicit in ARCHITECTURE §8 (which only says
      // alerts never change state, not that they're SEALED-only): gate
      // SHOCK/TILT to SEALED so carrying the empty box around in IDLE/
      // ARMING/OPEN_AUTHORIZED doesn't spam Anchor.logAlert(order_id=0, ...)
      // on the relayer. Flagged for the team to confirm.
      if (ctx.state == BoxState::SEALED) mpuEvaluateAlerts(accelMg, tiltDeg);
    }
    // else: keep the stale ctx values, per "always check the return value"
  }

  // --- nr.updateSensors() (2 Hz): real (battery, button).
  if (now - tSensors >= SENSORS_INTERVAL_MS) {
    tSensors = now;
    if (nr.updateSensors()) {
      ctx.battMv = (int32_t)lroundf(nr.batteryVolts * 1000.0f);
      ctx.battValid = true;
      lastBattOkMs = now;
    }
    // else: stale nr.batteryVolts/ctx.battMv are kept for display, but
    // attemptSeal()'s freshness check (lastBattOkMs) stops them from
    // gating a real SEAL once they're more than 2s old.
  }

  // --- OLED + Serial (2 Hz).
  if (now - tOled >= OLED_INTERVAL_MS) {
    tOled = now;
    reportStatus();
  }

  // --- TELEMETRY event: 2s in SEALED, 10s otherwise.
  unsigned long telemetryInterval = (ctx.state == BoxState::SEALED) ? TELEMETRY_SEALED_MS : TELEMETRY_OTHER_MS;
  if (now - tTelemetry >= telemetryInterval) {
    tTelemetry = now;
    emitEvent("TELEMETRY", 0, "");
  }

  // --- Pending command from the relayer (SEAL/UNLOCK/RESET), per §9.2.
  char cmdId[32], cmdType[16];
  uint32_t cmdOrderId;
  if (networkGetPendingCommand(cmdId, sizeof(cmdId), cmdType, sizeof(cmdType), &cmdOrderId)) {
    if (strcmp(cmdId, ctx.lastHandledCmdId) != 0) {
      bool handled = false;
      if (strcmp(cmdType, "SEAL") == 0 && ctx.state == BoxState::IDLE) {
        attemptSeal(cmdOrderId, cmdId);
        handled = true;
      } else if (strcmp(cmdType, "UNLOCK") == 0 && ctx.state == BoxState::SEALED && cmdOrderId == ctx.orderId) {
        doUnlock(cmdId);
        handled = true;
      } else if (strcmp(cmdType, "UNLOCK") == 0 && ctx.state == BoxState::IDLE && ctx.orderId != 0 &&
                 cmdOrderId == ctx.orderId) {
        // Idempotent, mirroring the RESET-in-IDLE case below: a brownout
        // during doUnlock() itself (HARDWARE.md §3's "brownout when the
        // servo moves" risk) can reboot the box between moving the servo
        // and the UNLOCKED event ever leaving RAM. The reboot's boot-time
        // mapping turns OPEN_AUTHORIZED into IDLE but keeps order_id, so
        // this re-runs doUnlock() (harmless: same servo angle, a fresh
        // UNLOCKED event) rather than leaving the relayer's UNLOCK stuck
        // forever and the happy path unable to reach Delivered. Safe
        // because a SEALED box can't boot into IDLE (only TAMPERED
        // survives a reboot as itself), and ARMING never reached SEALED,
        // so no UNLOCK can exist for an order that was never InTransit.
        doUnlock(cmdId);
        handled = true;
      } else if (strcmp(cmdType, "RESET") == 0 &&
                 (ctx.state == BoxState::TAMPERED || ctx.state == BoxState::OPEN_AUTHORIZED)) {
        doReset(cmdId);
        handled = true;
      } else if (strcmp(cmdType, "RESET") == 0 && ctx.state == BoxState::IDLE) {
        // Idempotent: e.g. the box already reset itself (UNLOCK->IDLE via a
        // prior RESET) but the relayer hasn't seen that RESET_DONE yet and
        // keeps resending. Re-ack it rather than ignoring it forever --
        // otherwise a depot's RESET can get stuck waiting on a box that's
        // already in the state it asked for.
        doReset(cmdId);
        handled = true;
      } else {
        // Invalid for the current state (e.g. a resent SEAL after the box
        // is already SEALED, or an UNLOCK for a stale order_id). Judgment
        // call: don't ack it and don't mark it handled -- leave it pending
        // so a legitimate state change lets it be re-evaluated later,
        // rather than silently dropping a command the relayer thinks is
        // still outstanding. Flagged for the team. Logged only once per
        // cmd_id (not every loop() tick) since the relayer keeps resending
        // an unacked command on every response.
        if (strcmp(cmdId, lastIgnoredCmdId) != 0) {
          strlcpy(lastIgnoredCmdId, cmdId, sizeof(lastIgnoredCmdId));
          Serial.printf("IGNORED command %s (id=%s, order=%lu) invalid for state %s\n",
                        cmdType, cmdId, (unsigned long)cmdOrderId, boxStateName(ctx.state));
        }
      }
      if (handled) {
        strlcpy(ctx.lastHandledCmdId, cmdId, sizeof(ctx.lastHandledCmdId));
        networkAckCommandHandled(cmdId);
      }
    }
  }
}

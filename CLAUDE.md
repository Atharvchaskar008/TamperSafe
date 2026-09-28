# MST Blockchain x NEWRRO 24-Hour Buildathon: Project Memory

## Status
- Project chosen: **TamperSafe** (below). The planning docs in `docs/` are written.
- Hacking window: 28 Sept 2026, 15:30 IST → 29 Sept, 15:30 IST (confirm the end time with the organisers).
- **Gate lifted 28 Sept 2026.** The team said "start". Code, contracts, firmware and scaffolds may now be written, per `docs/IMPLEMENTATION_PLAN.md`.
- M2 (hardware bring-up) and M4 (firmware main) are blocked until the team fills `HARDWARE.md` §1–2 (every pin is TBD) and copies the Neurick manual into `docs/neurick/`. Tracks A (contracts) and C (relayer/dashboard) proceed now.

## Project: TamperSafe
A tamper-evident delivery box with on-chain escrow. The buyer's payment sits in an MST testnet escrow from dispatch to doorstep.

How it works:
1. At the depot the box locks itself with a servo latch.
2. In transit it watches:
   - its lid (IR)
   - its contents (ultrasonic)
   - its motion (onboard MPU6050)
   - its location (GPS)
3. It reports to a laptop relayer, which writes state changes to chain.
4. Settlement:
   - A clean delivery pays the seller.
   - Any tamper refunds the buyer and slashes the courier's bond to the seller.

### Invariants
1. Funds move only through the escrow state machine. The relayer (`ORACLE_ROLE`) triggers defined transitions and never names a payee.
2. Buyer intent is signed by the buyer's own wallet: `createOrder`, `cancelOrder` and `requestUnlock`.
3. Tamper is latched. Once a box reports tamper for an order, both the firmware (NVS) and the contract keep it. A reboot mid-transit is itself tamper.
4. Escrow release never depends on a GPS fix, because the venue is indoors. GPS is evidence. Simulated GPS is always labelled SIMULATED in the UI.
5. Every state change the dashboard shows is an on-chain event with an explorer link. Raw telemetry stays off-chain, hash-chained and anchored.
6. The whole flow runs without hardware (the relayer's sim-box) and without testnet (`CHAIN=local`).

### Repo layout (planned; created at kickoff)
```
contracts/    Hardhat 3 + OpenZeppelin v5: BoxRegistry, TamperSafeEscrow, TelemetryAnchor, tests, deploy + ABI export
firmware/     tampersafe_box/ (main sketch) + bringup/ (per-sensor test sketches) for the Neurick ESP32-S3
relayer/      Node 22 + TypeScript (tsx) + Express + ethers v6: device ingest, chain writer, listener, SSE, sim-box
dashboard/    React + Vite + TypeScript + ethers v6 + react-leaflet: Buyer, Courier, Depot, Track, Evidence tabs
deployments/  addresses, tx hashes and ABIs per chain; the only place relayer and dashboard read contract info from
docs/         design docs (below)
```

### Docs: read the matching one before starting a task
- `docs/IMPLEMENTATION_PLAN.md`: read at the start of every work session. It holds the milestones, done-criteria, cut-lines and demo script. Tick milestones as they land.
- `docs/ARCHITECTURE.md`: read before touching contracts, the relayer API, the device protocol or dashboard data. It holds the contract spec, state machines, shared codes, JSON shapes and the hash-chain format.
- `docs/HARDWARE.md`: read before wiring or writing firmware. It holds the inventory, pin map, mounting and tamper thresholds.

### Build roles
The main session plans, reviews every diff against the invariants, and owns changes to `docs/ARCHITECTURE.md`. The builders in `.claude/agents/` are:
- `contracts-dev`
- `firmware-dev`
- `app-dev` (relayer + dashboard)
- `verifier` (runs done-criteria, no edits)

## Hackathon rules that affect how you work
- Everything must be built from scratch during the event, in a NEW git repo. Judges may inspect commit history.
- Commit small and often, with meaningful messages, starting from the first minute.
- Never copy code from other projects or past hackathon winners. Open-source libraries and SDKs are fine; note them in README.
- The team must be able to explain every line. When you generate a non-trivial block, explain it briefly.
- Keep an "AI usage" note in README.

## Security rules (non-negotiable)
- NEVER ask for, print, log, or commit private keys or seed phrases. Keys live only in `.env` (gitignored).
- NEVER sign or broadcast transactions yourself. The team runs deploy and relayer scripts.
- Testnet only. Never target MST mainnet (chainId 4646).

## Hardware: NEWRRO Neurick board
- Two MCUs:
  - ESP32-S3: user-programmed via Arduino IDE over USB-C. Owns Wi-Fi/BT, OLED, MPU6050, I2S mic and speaker, microSD, and the P1 header.
  - STM32F103: motion controller at I2C 0x08, factory firmware, never flash it. Owns 4 DC motors + encoders, 3 servos, motor current, battery voltage, user button.
- Arduino settings: ESP32S3 Dev Module, Flash 16MB, PSRAM OPI, USB CDC On Boot Enabled, Serial at 115200.
- I2C bus: SDA=GPIO8, SCL=GPIO9, 400 kHz. Devices: STM32 0x08, SSD1306 OLED 128x32 0x3C, MPU6050 0x68.
  - Call `nr.begin()` ONCE in setup(), before anything else. NEVER call `Wire.begin()` or `Wire.setClock()` afterwards.
  - Adding your own I2C sensor: SDA to header pin 18, SCL to pin 24. Its address must not clash with the three above.
- Newrick library (`#include <Newrick.h>`, `Newrick nr;`):
  - `begin()`
  - `motor(id 1-4, speed -1000..1000)`: 0 stops. Commands persist until changed; always stop motors deliberately.
  - `servo(a1, a2, a3)`: 0-180 each; all three are set together every call.
  - `resetEncoders()`
  - `bool updateEncoders()`: fills `enc1..enc4`. Poll at 50 Hz max.
  - `bool updateSensors()`: fills `current1..4`, `batteryVolts`, `buttonState`. Poll at about 10 Hz.
  - ALWAYS check the bool return value; on failure the variables hold stale values.
- Power:
  - Motors, servos and the STM32 need the 12 V battery switched on. USB alone is not enough.
  - The 5 V and 3.3 V header rails are for sensors only; no motors, pumps or LED strips.
- GPIO rules:
  - 3.3 V logic, NOT 5 V tolerant. Put 5 V sensor outputs through a divider or level shifter.
  - Analog: use ADC1 only (GPIO1, 4, 5, 6, 7, 10). ADC2 (GPIO11-18) fails while Wi-Fi is on.
  - Avoid the strapping pins GPIO3 (hdr 20), GPIO46 (hdr 22) and GPIO45 (hdr 38) unless the others are used up.
- Unavailable pins: GPIO0, 2, 19, 20, 21, 38-44, 47 (onboard hardware).

## Chain: MST Blockchain (EVM, BSC-derived, PoSA)

| Setting | Value |
|---|---|
| Network | MST Testnet |
| RPC | https://testnetrpc.mstblockchain.com (ws: wss://testnetrpc.mstblockchain.com) |
| Chain ID | 91562037 (hex 0x5752035) |
| Gas token | tMSTC |
| Explorer | https://testnet.mstscan.com (Blockscout) |
| Faucet | https://faucet.mstblockchain.com/ |

- Compiler: solc **0.8.24** with `evmVersion: "cancun"`. Never use solc >= 0.8.25. Pin pragma to `^0.8.24`, not `>=0.8.0`.
- If fee estimation fails, retry with legacy transactions.
- Use standard OpenZeppelin ERC-20/721/1155. There is no special "MST-20" standard.

## Reference docs
- Neurick manual and rule book: `docs/neurick/`. They are not in the folder yet; copy them in before M2 wiring, because the P1 header map is needed for `docs/HARDWARE.md` §2.
- MST docs saved as PDFs: `docs/mst/` (not in the folder yet).

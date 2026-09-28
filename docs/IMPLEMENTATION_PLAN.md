# TamperSafe — Implementation Plan

- **Window:** 28 Sept 2026 15:30 IST → 29 Sept 15:30 IST. Confirm the end time with the organisers.
- **Gate:** code starts only when the team says **"start"**.
- **How to use this file:** read it at the start of every work session and tick each box as it lands.
- **Design:** `docs/ARCHITECTURE.md`. **Wiring:** `docs/HARDWARE.md`. **Invariants:** `CLAUDE.md`.

---

## How Claude works this plan

1. **Tracks run in parallel.**
   - Track **A** is contracts, built by `contracts-dev`.
   - Track **B** is hardware and firmware, built by `firmware-dev`.
   - Track **C** is relayer and dashboard, built by `app-dev`.
   - `verifier` runs each milestone's done-criterion.
   - The main session reviews every diff against the `CLAUDE.md` invariants.
2. **Finish before moving on.** Within a track, a milestone is finished when its **Done when** line is observed. Only then start the next one.
3. **Commit** at every box marked **commit**. Use small Conventional Commits (`feat(contracts): add escrow tamper refund`), because judges read the history.
4. **Explain what you hand over.** For each non-trivial block, give the team a 2–3 line explanation, because they must be able to explain every line.
5. **The team signs; Claude prepares.** The team runs anything that signs with a real key: testnet deploy, the relayer on the ORACLE key, the faucet and MetaMask. Claude prepares the script and hands over the exact command.
6. **Cut when late.** When a milestone overruns its budget by 50%, apply the next cut-line (§Cut-lines) and tell the team.

---

## Timeline at a glance

| Time (IST) | A · contracts | B · hardware / firmware | C · relayer / dashboard |
| :--- | :--- | :--- | :--- |
| 15:30–16:15 | M0 kickoff (everyone) | ← | ← |
| 16:15–19:30 | M1 contracts + tests | M2 bring-up + calibration | M3 relayer core + sim-box |
| 19:30–20:00 | **Checkpoint 1:** sim-box happy + tamper on the local chain | ← | ← |
| 20:00–01:00 | Review, then help C | M4 firmware main | M5 dashboard |
| 01:00–02:00 | **Checkpoint 2:** real box + dashboard + local chain, all M4 scenarios | ← | ← |
| 02:00–05:00 | M6 MST testnet deploy + end-to-end (everyone) | ← | ← |
| 05:00–09:00 | M7 stretch, in order; sleep rotation | ← | ← |
| 09:00–13:30 | M8 hardening, README, rehearsals, backup video | ← | ← |
| 13:30 | **Code freeze.** Demo-breaking fixes only | ← | ← |
| 15:30 | Submit | ← | ← |

---

## M0 — Kickoff (everyone, 45 min)

- [x] Team says "start".
  - Run `git init` in `D:\Projects\MST Bangalore`.
  - Add a `.gitignore` covering `node_modules/`, `.env`, `secrets.h`, `relayer/data/`, `contracts/artifacts/`, `contracts/cache/` and `dashboard/dist/`.
  - First commit = this folder's planning docs and `.claude/`. **commit**
- [ ] Hardware inventory:
  - Fill `HARDWARE.md` §1.
  - Confirm the P1 header pins for GPIO 12, 13, 14, 17 and 18, and fill §2.
  - Confirm where the ultrasonic points.
  - Confirm the 12 V pack powers the ESP32 with USB unplugged. The box runs untethered, and the power-cut scenario depends on it.
- [ ] Wallets (team only): five MetaMask accounts, each funded from the faucet: **admin/deployer, relayer ORACLE, buyer, seller, courier**.
  - Addresses (never keys) go in `deployments/accounts.json`.
- [ ] Box secret (team only): generate a 32-byte hex secret for `TS-BOX-01`.
  - It goes in `firmware/tampersafe_box/secrets.h` and `relayer/.env`, both gitignored.
  - Commit `secrets.example.h` and `.env.example`.
- [ ] Network:
  - Laptop and box on the same 2.4 GHz phone hotspot. Note the laptop IP for `RELAYER_URL`.
  - MetaMask has MST testnet, and `eth_chainId` on the RPC returns `0x5752035`.

**Done when:**
- The repo exists with its first commit.
- `HARDWARE.md` §1–2 have no ☐ or TBD left for the parts in use.
- Five funded addresses are recorded.
- The laptop IP is known.

---

## M1 — Contracts (Track A, 3 h)

- [ ] Create a Hardhat 3 project in `contracts/` per the `mst-contract-deploy` skill, with OpenZeppelin v5. **commit**
- [ ] `BoxRegistry` + tests: register, duplicate, bind/unbind, BINDER-only, inactive box. **commit**
- [ ] `TamperSafeEscrow` without the bond, plus tests. **commit** Tests cover:
  - The happy path.
  - Cancel.
  - Tamper from InTransit **and** from UnlockRequested.
  - Timeout from each of Funded, InTransit and UnlockRequested.
  - Every guarded function called by a wrong caller.
  - Terminal states frozen.
  - A box double-bind.
  - Balance deltas asserted on every payout.
- [ ] Courier bond (`depositBond`, `withdrawBond`, lock on seal, unlock on delivery, slash to seller on tamper or timeout) + tests. **commit** ← cut-line 2
- [ ] `TelemetryAnchor` + tests: seq must increase, ORACLE-only. **commit**
- [ ] `scripts/deploy.ts`. Run it on `npx hardhat node`. **commit** It must:
  - Deploy all three contracts.
  - Grant `BINDER_ROLE` to the escrow and `ORACLE_ROLE` (escrow + anchor) to the relayer address.
  - Register `TS-BOX-01`.
  - Write `deployments/<chain>.json` (addresses + deploy tx hashes) and `deployments/abi/*.json`.

**Done when:**
- `npx hardhat test` is green, covering every case above.
- The local deploy writes `deployments/local.json`.

---

## M2 — Hardware bring-up (Track B, 3 h)

- [ ] Wire per `HARDWARE.md` §2 with the dividers. Battery ON.
- [ ] Bring-up sketches in `firmware/bringup/`: `i2c_scan`, `ultrasonic`, `ir_lid`, `gps`, `servo_angles`, `mpu`. **commit** each one as it works.
- [ ] Mount the sensors per §4. Calibrate the thresholds and servo angles, and write the values into §5. **commit**

**Done when:** every item of the `HARDWARE.md` §7 checklist passes.

---

## M3 — Relayer core + sim-box (Track C, 3 h)

- [ ] Protocol module **first**: canonical form, SHA-256 chain and HMAC per `ARCHITECTURE.md` §9.1, plus `relayer/test/vectors.json` and its unit test. **commit** (Firmware M4 depends on this file.)
- [ ] `relayer/` skeleton. **commit** It includes:
  - Config via `.env`.
  - A chain client switched by `CHAIN=local|mst`.
  - ABIs and addresses loaded from `deployments/`.
- [ ] `POST /api/device/events` pipeline per §9.2 checks, with the JSONL store and SSE `/api/stream`. **commit**
- [ ] The rest of the relayer engine. **commit**
  - Chain writer queue (§10).
  - The rules table.
  - The `UnlockRequested` listener and the command queue.
  - The watchdog.
  - The dashboard REST routes (§9.3).
- [ ] `scripts/sim-box.ts` speaking the exact device protocol, with scenarios `happy`, `tamper`, `power-cycle` and `offline-gap`, plus a checker script that asserts the final on-chain states and balances. **commit**

**Done when:** `npm run sim -- happy` and `npm run sim -- tamper` against the local chain end in Delivered and Tampered respectively, and the checker script passes (checked by the script, not by eye).

**Checkpoint 1 (19:30), A + C:** sim-box happy and tamper against the contracts deployed by `deploy.ts`.

---

## M4 — Firmware main (Track B, 5 h)

- [ ] Skeleton. **commit** It includes:
  - The `setup()` order from the skill.
  - The box-state enum (§6).
  - The non-blocking scheduler (§8 cadence).
  - The state shown on the OLED and on Serial.
- [ ] Hash chain + HMAC. The boot self-test reproduces `relayer/test/vectors.json` and prints `SELFTEST PASS`. **commit**
- [ ] Network task on core 0 (ARCHITECTURE §8): Wi-Fi reconnect, NTP, batch POST (timeout ≤ 3 s), the mutex-guarded 128-event ring buffer, and the SEAL / UNLOCK / RESET commands with `cmd_id` acks. **commit**
- [ ] Sensor tasks, tamper rules and alerts, using the `HARDWARE.md` §5 values. **commit**
- [ ] NVS persistence (latch before report) and `POWER_INTERRUPTED` on boot. **commit**

**Done when**, against the relayer on the local chain:
1. Seal → walk 60 s → buyer Confirm & Unlock → **Delivered**.
2. Seal → lift the lid → **TamperDetected** on chain ≤ 10 s after the lift.
3. **USB unplugged**, seal → battery off/on → the box boots into TAMPERED → **TamperDetected (POWER_INTERRUPTED)**.
4. Seal → hotspot off → lift the lid for about 0.5 s and close it → hotspot on → TAMPER was latched while offline and reaches the chain after reconnect.

---

## M5 — Dashboard (Track C, 5 h)

- [ ] Vite + React + TypeScript app. **commit** It includes:
  - The network config.
  - MetaMask connect and **Add MST Testnet**.
  - A contract read layer fed from `deployments/`.
- [ ] Buyer tab: create order, cancel, **Confirm & Unlock**. **commit**
- [ ] Depot tab (seal, reset) and Courier tab (bond). **commit**
- [ ] Track tab: map + sensor tiles + `LIVE / NO_FIX / SIMULATED` badge. **commit** ← the map is cut-line 4
- [ ] Evidence tab: timeline, explorer links, **Verify log**. **commit**

**Done when:** the happy path is clicked through end to end with sim-box on the local chain, and every transaction row links to an explorer.

**Checkpoint 2 (01:00):** real box + dashboard + local chain, running all four M4 scenarios.

---

## M6 — MST testnet (everyone, 3 h)

- [ ] Run the pre-flight from the `mst-contract-deploy` skill. Claude prepares; **the team runs** the deploy command with `--network mst`.
- [ ] Commit `deployments/mst-testnet.json`. **commit**
- [ ] **The team starts** the relayer with `CHAIN=mst`.
- [ ] Run the happy, tamper and power-cycle scenarios on testnet. Every transaction must open on `testnet.mstscan.com`.
- [ ] Best-effort Blockscout verification of all three contracts.
- [ ] Measure the latency from lid lift to confirmed `TamperDetected`, and record it for the README.

**Done when:** all three scenarios are complete on MST testnet, with their explorer links captured in the README draft.

---

## M7 — Stretch (in this order; each one independently cuttable)

1. **S1 Route and geofence:**
   - The relayer computes distance to the destination and raises `ROUTE_DEVIATION`.
   - The dashboard draws the geofence ring.
2. **S2 Device-signed attestations and courier opt-in:**
   - The courier accepts a shipment from their own wallet (`acceptShipment`) before `sealShipment` may lock their bond.
   - A secp256k1 key on the ESP32 signs a keccak256 digest of the TAMPER and UNLOCKED payloads.
   - The escrow checks `ecrecover == registry.deviceKey`, which turns the relayer into a gas payer.
3. **S3 Alarm:** an audible alarm on the onboard I2S speaker when tamper is detected.
4. **S4 LDR:** an LDR light sensor (ADC1) as a third lid signal.
5. **S5 microSD:** persist the event log to microSD.

---

## M8 — Hardening and pitch (everyone)

- [ ] `README.md`. **commit** It covers:
  - The pitch and the problem.
  - An architecture diagram.
  - Contract addresses with explorer links.
  - Setup and run steps.
  - The demo script.
  - The **AI usage** note.
  - The open-source libraries (`HARDWARE.md` §6 plus the npm packages).
  - Known limitations and the production path (`ARCHITECTURE.md` §3).
- [ ] Fallback drill: switch to `CHAIN=local` and run the demo in under 2 minutes.
- [ ] Record a backup demo video of all three scenarios on testnet.
- [ ] Rehearse the demo 3 times against the script below.

---

## Cut-lines (apply in order when behind)

1. M7 stretch.
2. Courier bond. Keep buyer escrow only, and pitch the bond as the next step.
3. Periodic `anchor` checkpoints. Keep anchors at transitions only.
4. Leaflet map, replaced by a coordinate table.
5. The GPS module. The UI shows `GPS: none`, and escrow is unaffected by design.

**Never cut:**
- Escrow happy path + tamper refund.
- Seal and unlock via the servo.
- The NVS tamper latch.
- Explorer links.
- The `CHAIN=local` fallback.

---

## Risks

| Risk | Mitigation |
| :--- | :--- |
| No GPS fix indoors | Release never needs GPS. Display-only sim is badged SIMULATED. Show an outdoor clip in the backup video |
| Hash/HMAC mismatch between firmware and relayer | Shared `vectors.json`, built first (M3) and self-tested at boot (M4) |
| Brownout when the servo moves | Charged pack, battery check before SEAL |
| False tamper while the box is carried | Foam-packed package, 20 mm + 1 s rule, the M2 walk test |
| RPC or venue internet down | `CHAIN=local` fallback, and say so on stage |
| Nonce errors, stuck transactions | One writer queue, one relayer process |
| Hotspot drops mid-demo | Ring buffer + retry. The relayer shows `SIGNAL_LOST` and recovers |

---

## Demo script (~5 min; orders of 0.01 tMSTC with a 1 h deadline)

1. **Set the scene (15 s):** box, dashboard, explorer tab side by side.
2. **Happy path (90 s):**
   - The buyer orders a pair of headphones, and the escrow transaction links out.
   - The courier bond is visible.
   - Depot presses **Seal**: the servo locks, the OLED shows `SEALED`, and `ShipmentSealed` appears on the explorer.
   - Carry the box across the stage while the Track tab streams live sensors, with an honest GPS badge.
   - The buyer presses **Confirm & Unlock**: the servo opens, `Delivered` lands, and the seller's balance rises.
3. **Tamper (90 s):**
   - Create a new order and seal it.
   - A volunteer lifts the lid or pulls the package: the OLED shows `TAMPERED`, and the dashboard turns red.
   - `TamperDetected` appears on the explorer within ~10 s. The buyer is refunded and the courier's bond goes to the seller.
4. **Power-cut attack (45 s):**
   - The box runs on its battery with **USB unplugged**.
   - Create a new order and seal it.
   - Switch the battery off and on: the box boots straight into `TAMPERED: POWER_INTERRUPTED`, and the buyer is refunded.
5. **Proof (30 s):** in the Evidence tab, press **Verify log**. The head recomputed up to the last anchored seq matches the on-chain anchor ✓.
6. **Close (30 s):**
   - Who is protected: buyer, seller and the honest courier.
   - The production path: LTE-M, a secure element and device-signed attestations.

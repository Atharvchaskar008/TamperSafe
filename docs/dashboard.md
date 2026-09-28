# TamperSafe — Dashboard Guide

The operational app: Buyer / Courier / Depot / Track / Evidence tabs, MetaMask, live chain + relayer data. Not the landing page (`landing-page/`, static pitch site, see `docs/frontend.md`) — different codebase, different job, no shared components.

Lives in `dashboard/`. Stack already in place: Vite + React + TypeScript, ethers v6, no router (tab switching is local `useState` in `App.tsx`). Buyer and Courier tabs are built. This doc covers what's left: Depot, Track, Evidence, plus matching the landing page's visual identity.

---

## 1. Design language (pull from the landing page, don't invent new)

Source of truth: `landing-page/assets/css/tampersafe.shared.css` (`:root`, ~line 2148). The current `dashboard/src/style.css` is a generic placeholder (`#0f1115` bg, system-ui font, `#4b7bec` blue) — swap these in so the dashboard reads as the same product as the landing page.

| Token | Value | Use |
| :--- | :--- | :--- |
| Background (primary) | `black` | Page background |
| Text primary | `white` | Body text |
| Text secondary | `#ffffff80` (white 50%) | Muted labels |
| Text tertiary | `#fff6` (white 40%) | Faint/disabled text |
| **Accent** | `#EB0C0D` | Primary actions, the one color that should mean "look here" — also perfect for the tamper/red state, don't dilute it with other uses |
| Border default | `#2a2f34` | Panel/table dividers |
| Off-white / cream | `#f3f3f3` / `#efefeb` | Light surface text on dark cards, if needed |

**Typography:**
- Headings + body: `TWKEverett, Arial, sans-serif` (weight 500 default; the landing page ships the `.woff2` files under `landing-page/assets/fonts/` — copy or symlink them into `dashboard/public/fonts/` and `@font-face` them the same way rather than re-hosting from elsewhere)
- Mono / data / labels: `TWK Everett Mono, Arial, sans-serif` — use this for telemetry numbers, status pill text, tx hashes, anything that reads as "live data" rather than prose. This is the single most useful borrowed pattern for a dashboard: the landing page already uses it for uppercase label buttons (`.mono-12px`: uppercase, `+4%` letter-spacing, `0.75em`).
- Scale: h1 `5.125em` / h2 `3.5em` / h3 `3em` / h4 `2.5em` — too large for dashboard UI chrome; use these only if you need a hero number (e.g. a big status word like `SEALED` / `TAMPERED`). Body copy sizes: `18px`, `16px`, `15px`.

**Spacing scale (em-based):** `0, .25, .5, .75, 1, 1.25, 1.5, 2, 2.5, 3` — pick from this instead of arbitrary px values, so panels feel consistent with the marketing site.

**Buttons:** `border-radius: 4px`, padding `1em 1.25em`, two variants — `is--blue` (accent `#EB0C0D` bg, white text, for primary actions like Seal / Confirm & Unlock) and `is--black` (black bg, white text, for secondary actions like Cancel / Reset).

**Do not** pull in the landing page's GSAP/ScrollTrigger/Lenis animation stack, Webflow interaction JS, or `webflow.schunk.*` bundles — those are for the marketing page's scroll animations and are dead weight in a data app. Just reuse the CSS tokens and font files.

---

## 2. Tab spec — data sources (nothing here is invented, every field maps to something that exists)

| Tab | Status | Primary data source | Key fields / actions |
| :--- | :--- | :--- | :--- |
| **Buyer** | Built (`components/BuyerTab.tsx`) | Direct ethers reads: `getEscrowContract`, `orderCount`/`getOrder` | Create/cancel order, Confirm & Unlock, status label, payout destination |
| **Courier** | Built (`components/CourierTab.tsx`) | Direct ethers reads | Bond deposit/withdraw, free vs locked bond |
| **Depot** | To build | `POST /api/orders/:id/seal {box_id, courier}`, `POST /api/boxes/:box_id/reset`, `GET /api/boxes` | List Funded orders + bound box, Seal action, box state, demo Reset |
| **Track** | To build | SSE `GET /api/stream` (events: `telemetry`, `alert`, `tx`, `order`) | Map + GPS trail with `LIVE / NO_FIX / SIMULATED` badge (CLAUDE.md invariant 4 — GPS never gates escrow); live tiles for lid, accel/tilt, battery, lock, RFID match; a prominent **tamper/latch panel** (the core demo moment — box state, tamper code by name, latched badge); an **alerts feed** styled distinctly from tamper (alerts never move funds): `SHOCK`(10), `TILT`(11), `SENSOR_FAULT`(15), `PACKAGE_MISMATCH`(16, RFID) |
| **Evidence** | To build | `GET /api/orders/:id/log` → `{anchored_seq, computed_head_at_anchored_seq, anchored_head, match}`; contract events | Order timeline (status transitions + tx hash + explorer link); **Verify log** button showing the pass/fail hash-chain check; settlement breakdown (seller payout / buyer refund / bond slash) from `FundsReleased(orderId, to, amount, ReleaseKind)` |

**Contract events available** (via ethers, `deployments/*.json` + `deployments/abi/*.json`, indexed in `lib/deployments.ts`):
`TamperSafeEscrow`: `OrderCreated`, `OrderCancelled`, `BondDeposited`, `BondWithdrawn`, `ShipmentSealed`, `UnlockRequested`, `Delivered`, `TamperDetected`, `OrderExpired`, `FundsReleased`, `BondBpsSet`.
`TelemetryAnchor`: `Anchored(orderId, seq, head, count)`, `Alert(orderId, code, evidenceHash)`.
`BoxRegistry`: `BoxRegistered`, `BoxActiveSet`, `BoxBound`, `BoxUnbound`.

**Order status enum** (`ARCHITECTURE.md` §6): `0 None · 1 Funded · 2 InTransit · 3 UnlockRequested · 4 Delivered · 5 Tampered · 6 Expired · 7 Cancelled` — `lib/contracts.ts` already has `STATUS_LABELS` for this, reuse it.

**Reuse, don't rebuild:** `TxList.tsx` (tx rows + explorer links, already handles `CHAIN=local` → greyed/no link), `config/networks.ts` (`explorerTxUrl`, chain config), `hooks/useWallet.ts`, `hooks/useTxRunner.ts`, `lib/contracts.ts` (`STATUS_LABELS`, contract getters), `lib/format.ts`.

**Still needed (new files):**
- `hooks/useSSE.ts` — subscribe to `GET /api/stream`, dispatch by event name (`telemetry|tx|alert|order`)
- `lib/relayerApi.ts` — thin client for the REST routes above, parallel to how `lib/contracts.ts` wraps ethers

---

## 3. Cross-cutting (small, shared header/status bar — not a tab)

- **Mode badges:** chain (`local` vs `mst`), box (`SIM` vs `REAL`), GPS (`SIMULATED` when sim-box driven). Cheap, and directly demonstrates the two invariants judges are most likely to probe — no hardware dependency, no chain dependency (CLAUDE.md invariants 4 & 6).
- **Sim-mode demo controls:** buttons to trigger the relayer orchestrator's scenarios — the fallback path if the physical box misbehaves on stage.

---

## 4. Non-goals

- No re-hosting the landing page's animation JS (GSAP/Lenis/Webflow bundles) — CSS tokens and fonts only.
- No inventing data fields not listed in §2 — if a UI idea needs a field that doesn't exist in the relayer/contracts, that's a scope question for the main session, not something to fake client-side.
- GPS is evidence only, never gates an escrow transition or is shown without its `LIVE/NO_FIX/SIMULATED` badge (invariant 4).

---

## 5. Practical notes

- `npm run dev` in `dashboard/`, against a `CHAIN=local` relayer + sim-box orchestrator for iteration; confirm against `CHAIN=mst` before the demo.
- Every state change shown must be traceable to an on-chain event with an explorer link (invariant 5) — raw telemetry (SSE `telemetry`) is off-chain and must read as such (e.g. mono/muted styling vs the accent-colored on-chain events).
- Verification: walk the demo script in `docs/IMPLEMENTATION_PLAN.md` (create → seal → transit telemetry → tamper → Evidence Verify log shows `match: true`) end to end before considering a tab done.

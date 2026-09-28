# TamperSafe — Landing Page (Frontend Guide)

This is a guide for whoever builds the **public pitch/landing page**. It is a separate, static page — not the operational dashboard.

- **Landing page** (this doc): a static marketing/pitch page. Lives in `landing/` at the repo root.
- **Dashboard** (`dashboard/`, built by `app-dev` per `docs/ARCHITECTURE.md` §11): the working app with Buyer / Courier / Depot / Track / Evidence tabs, MetaMask, and live chain data. Different codebase, different job. The landing page never connects a wallet and never signs a transaction — it's read-only marketing content with a link out to the real dashboard.

Keep them separate so you're never blocked waiting on Track C's Vite/React app to build, and so the pitch page stays fast and simple to open on a projector or a judge's phone with no build step required.

---

## 1. Where it lives and how it's built

- Folder: `landing/` (sibling to `dashboard/`, `relayer/`, `contracts/`, `firmware/`).
- Stack: plain static HTML + CSS + a little vanilla JS. No framework, no build step.
  - `landing/index.html`
  - `landing/styles.css`
  - `landing/script.js` (only if you need something like a mobile nav toggle or a smooth-scroll)
  - `landing/assets/` for any images/diagrams
- Why no framework: it needs to open instantly from a double-click or a plain static file server on venue Wi-Fi, and it must never depend on `npm install` finishing during the demo. If you'd rather use Vite, that's fine too, but keep it in its own `landing/` project with its own `package.json` — don't fold it into `dashboard/`.
- Note any font/icon library you pull in in the README's "Open-source libraries" section, per the hackathon rules in `CLAUDE.md`.

---

## 2. Content sections

Build these top to bottom. Everything here is pitch copy — pull the facts from `docs/ARCHITECTURE.md` and `docs/IMPLEMENTATION_PLAN.md` rather than inventing new claims.

1. **Hero**
   - Project name: **TamperSafe**.
   - One-liner: a tamper-evident delivery box with on-chain escrow — the buyer's payment sits in escrow from dispatch to doorstep.
   - A small "Live on MST Testnet" badge (chain name only — no contract address here yet, see §4).
   - A primary CTA button: **View live dashboard** (URL is a placeholder until M8 — see §4).

2. **Problem**
   - Delivery fraud / package tampering in transit. No shared trust between buyer, seller and courier once the package leaves the depot.

3. **How it works** (map this straight from `docs/ARCHITECTURE.md` §2–4, in plain language, 4 steps)
   1. **Seal** — the depot locks the box with a servo latch; the payment is already in escrow.
   2. **Transit** — the box watches its lid (IR), contents (ultrasonic), motion (MPU6050) and location (GPS), and now also the sealed package's identity via an RFID tag.
   3. **Report** — the box reports to a relayer over Wi-Fi, which writes every state change on-chain.
   4. **Settle** — a clean delivery pays the seller; any tamper refunds the buyer and slashes the courier's bond to the seller.
   - A simple diagram is enough: reuse the box → relayer → chain → dashboard shape from `docs/ARCHITECTURE.md` §2 as an SVG or a hand-drawn-style image in `landing/assets/`. Don't just screenshot the ASCII box from the doc.

4. **Live demo / links** — these are placeholders until the milestones that produce them land. Mark them clearly (e.g. `<!-- TODO: fill after M8 -->`) rather than leaving dead links or fabricating values:
   - Dashboard URL — filled once `dashboard/` is deployed or run locally for the demo (M8).
   - Contract addresses + explorer links on `testnet.mstscan.com` — filled at M6.
   - GitHub repo link — already known: `https://github.com/Hackmaass/TamperSafe`.

5. **Under the hood** — a row of stack badges/logos is enough, no deep explanation: MST Blockchain, Solidity + OpenZeppelin, Hardhat, Node.js + ethers.js, React + Leaflet, ESP32-S3 (NEWRRO Neurick).

6. **Team + AI usage**
   - Short team credits.
   - One or two sentences on AI usage, then link to the fuller note in the root `README.md` (`## AI usage note`) rather than duplicating it.

7. **Footer**
   - GitHub repo link, MST explorer link, faucet link (`https://faucet.mstblockchain.com/`) if you want judges to poke around themselves.

---

## 3. Non-goals (so scope doesn't creep into Track C's job)

- No wallet connect, no signing, no reading contract state directly. If you want a "live-ish" flourish, the only safe read is a plain `fetch()` of the relayer's public `GET /api/orders` (see `docs/ARCHITECTURE.md` §9.3) to show something like an order counter — optional, and only after the relayer is actually running; never block the page's core content on it.
- No map / GPS trail here — that's the dashboard's Track tab, using OpenStreetMap tiles (see `docs/ARCHITECTURE.md` §11 and `docs/IMPLEMENTATION_PLAN.md` M5). This page can show a static illustration of the box, not a live map.

---

## 4. Practical notes

- Mobile-first: judges and visitors will open this on a phone. Test at phone width before anything else.
- Keep total page weight small — no large hero video; a static image or CSS animation is enough, since venue Wi-Fi will be congested.
- Commit early and often to `landing/`, same as every other track (`CLAUDE.md` hackathon rules — judges read commit history).
- When the dashboard and contract addresses are live, come back and fill in §4's placeholders, then link this page from the root `README.md`.

# TamperSafe

A tamper-evident delivery box with on-chain escrow, built for the MST Blockchain x NEWRRO 24-Hour Buildathon.

The buyer's payment sits in an MST testnet escrow from dispatch to doorstep. The box locks itself at the depot, watches its lid, contents and motion in transit, and reports to a laptop relayer that writes state changes to chain. A clean delivery pays the seller; any tamper refunds the buyer and slashes the courier's bond.

This section will grow through the event. See `docs/IMPLEMENTATION_PLAN.md` for the build plan and demo script, `docs/ARCHITECTURE.md` for the design, and `docs/HARDWARE.md` for wiring.

## AI usage note

This project uses Claude Code throughout the buildathon: for planning (`docs/`), for scaffolding and writing contracts, firmware, the relayer and the dashboard from the specs in `docs/ARCHITECTURE.md`, and for reviewing diffs against the invariants in `CLAUDE.md`. Every non-trivial block is explained to the team as it lands, and the team signs and runs anything that touches a real key (testnet deploys, the relayer, the faucet, MetaMask). No code, contract or firmware was copied from another project; open-source libraries and SDKs used are listed below as the corresponding tracks land.

## Status

Build in progress. This section is filled in as milestones land — see `docs/IMPLEMENTATION_PLAN.md` for live status.

## Setup and run

TBD — filled in as `contracts/`, `firmware/`, `relayer/` and `dashboard/` land.

## Contract addresses

TBD — filled in at M6 (MST testnet deploy), with explorer links.

## Open-source libraries

- **Contracts:** Hardhat 3, `@nomicfoundation/hardhat-toolbox-mocha-ethers`, OpenZeppelin Contracts v5.
- **Relayer:** `tsx`, TypeScript, `@types/node`, Node's built-in `crypto` and `node:test`.
- **Firmware:** `Newrick` (board library, provided by the organisers), Adafruit SSD1306 + Adafruit GFX, ESP32 core (WiFi, HTTPClient, Preferences/NVS, mbedtls). See `docs/HARDWARE.md` §6 for the full sensor-library list as those land.
- Dashboard libraries will be listed here as `dashboard/` lands (planned: React, Vite, ethers v6, react-leaflet + OpenStreetMap tiles).

## Known limitations and production path

See `docs/ARCHITECTURE.md` §3 (Trust model).

// The one command the team (and `verifier`) run repeatably:
//   npm run sim -- happy | tamper | power-cycle | offline-gap
// Spawns a fresh `hardhat node`, deploys the contracts onto it, starts the
// relayer with a runtime-generated dummy box secret (never committed), runs
// the requested sim-box scenario against it, asserts the final on-chain
// order status AND balance deltas, then tears everything down.
//
// Windows note (confirmed via a throwaway spike before writing this): a
// child spawned via npm.cmd/npx.cmd needs shell:true, and shell:true means
// child.kill() only kills the shell, not hardhat node itself, which then
// keeps port 8545 and breaks every subsequent run. We spawn Node directly on
// hardhat's own CLI entrypoint (read from node_modules/hardhat/package.json,
// not guessed) instead, so a plain child.kill() tears down the real process.
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";
import { WalletActions, ACCOUNT_INDEX, defaultDeps } from "./wallet-actions.js";
import { SimBoxClient, runHappyScenario, runTamperScenario, runPowerCycleScenario, runOfflineGapScenario } from "./sim-box.js";
import { waitForOrderStatus, snapshotBalances, assertHappyOutcome, assertTamperOutcome, STATUS, TxFailureWatcher } from "./checker.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const RELAYER_DIR = path.resolve(SCRIPT_DIR, "..");
const REPO_ROOT = path.resolve(RELAYER_DIR, "..");
const CONTRACTS_DIR = path.join(REPO_ROOT, "contracts");
const RPC_URL = "http://127.0.0.1:8545";
const RELAYER_PORT = 4100;
const RELAYER_URL = `http://127.0.0.1:${RELAYER_PORT}`;

type Scenario = "happy" | "tamper" | "power-cycle" | "offline-gap";

function hardhatCliPath(): string {
  const pkgPath = path.join(CONTRACTS_DIR, "node_modules", "hardhat", "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { bin?: string | Record<string, string> };
  const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.hardhat;
  if (!bin) throw new Error("orchestrator: could not find hardhat's CLI entrypoint in its package.json bin field");
  return path.join(CONTRACTS_DIR, "node_modules", "hardhat", bin);
}

function waitForStdout(child: ChildProcess, marker: string, label: string, timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`orchestrator: ${label} never printed "${marker}" within ${timeoutMs}ms`)), timeoutMs);
    const onData = (d: Buffer) => {
      const s = d.toString();
      if (process.env.ORCHESTRATOR_VERBOSE) process.stdout.write(`[${label}] ${s}`);
      if (s.includes(marker)) {
        clearTimeout(timer);
        child.stdout?.off("data", onData);
        resolve();
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", (d) => process.stderr.write(`[${label}-err] ${d}`));
    child.on("exit", (code) => {
      if (code !== null && code !== 0) reject(new Error(`orchestrator: ${label} exited early with code ${code}`));
    });
  });
}

async function waitForExit(child: ChildProcess, label: string): Promise<number> {
  return new Promise((resolve, reject) => {
    child.stdout?.on("data", (d) => process.stdout.write(`[${label}] ${d}`));
    child.stderr?.on("data", (d) => process.stderr.write(`[${label}-err] ${d}`));
    child.on("exit", (code) => resolve(code ?? -1));
    child.on("error", reject);
  });
}

async function waitForHealth(url: string, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`orchestrator: relayer health check never succeeded at ${url}`);
}

function killTree(child: ChildProcess | undefined): void {
  if (!child || child.killed || child.exitCode !== null) return;
  if (process.platform === "win32" && child.pid) {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
  } else {
    child.kill("SIGTERM");
  }
}

// Hoisted so the SIGINT handler below can tear these down even if the user
// interrupts mid-run -- a plain try/finally inside main() only runs if the
// process is allowed to unwind normally, which SIGINT does not guarantee.
let hardhatNode: ChildProcess | undefined;
let relayer: ChildProcess | undefined;

process.on("SIGINT", () => {
  console.log("\n[orchestrator] SIGINT -- tearing down...");
  killTree(relayer);
  killTree(hardhatNode);
  process.exit(130);
});

async function main(): Promise<void> {
  const scenario = (process.argv[2] ?? "happy") as Scenario;
  if (!["happy", "tamper", "power-cycle", "offline-gap"].includes(scenario)) {
    throw new Error(`orchestrator: unknown scenario "${scenario}" (want happy | tamper | power-cycle | offline-gap)`);
  }

  let dataDir: string | undefined;
  let txWatcher: TxFailureWatcher | undefined;

  try {
    const cli = hardhatCliPath();

    console.log("[orchestrator] starting hardhat node...");
    hardhatNode = spawn(process.execPath, [cli, "node"], { cwd: CONTRACTS_DIR });
    await waitForStdout(hardhatNode, "Started HTTP", "hardhat-node");

    console.log("[orchestrator] deploying contracts...");
    const deploy = spawn(process.execPath, [cli, "run", "scripts/deploy.ts", "--network", "localhost"], { cwd: CONTRACTS_DIR });
    const deployCode = await waitForExit(deploy, "deploy");
    if (deployCode !== 0) throw new Error(`orchestrator: deploy script exited with code ${deployCode}`);

    // Fresh state per run: a new data dir and a runtime-only dummy secret
    // (never committed -- see CLAUDE.md and the M3 build brief).
    dataDir = path.join(RELAYER_DIR, "_scenario-data", `run-${Date.now()}`);
    const boxSecret = randomBytes(32).toString("hex");
    const deploymentFile = path.join(REPO_ROOT, "deployments", "local.json");
    const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8")) as { boxes: Array<{ label: string }> };
    const boxLabel = deployment.boxes[0]!.label;

    console.log("[orchestrator] starting relayer...");
    relayer = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
      cwd: RELAYER_DIR,
      env: {
        ...process.env,
        CHAIN: "local",
        LOCAL_RPC: RPC_URL,
        BOX_SECRETS: JSON.stringify({ [boxLabel]: boxSecret }),
        PORT: String(RELAYER_PORT),
        DATA_DIR: dataDir,
      },
    });
    await waitForStdout(relayer, "listening on", "relayer");
    await waitForHealth(RELAYER_URL);

    // Balance deltas alone can't distinguish "a repeat TAMPER was a safe
    // no-op" from "a repeat TAMPER was tried and permanently reverted" --
    // both leave the chain untouched. Watch the relayer's own SSE tx stream
    // for the ground truth instead.
    txWatcher = new TxFailureWatcher(RELAYER_URL);

    const wallet = new WalletActions(defaultDeps(REPO_ROOT, "local"));
    const buyerAddr = await wallet.addressOf(ACCOUNT_INDEX.buyer);
    const sellerAddr = await wallet.addressOf(ACCOUNT_INDEX.seller);
    const courierAddr = await wallet.addressOf(ACCOUNT_INDEX.courier);

    const before = await snapshotBalances(wallet, { buyer: buyerAddr, seller: sellerAddr, courier: courierAddr });

    console.log("[orchestrator] courier deposits bond...");
    const depositWei = ethers.parseEther("0.02");
    await wallet.depositBond(depositWei);

    console.log("[orchestrator] buyer creates order...");
    const amountWei = ethers.parseEther("0.01");
    const deadlineUnix = Math.floor(Date.now() / 1000) + 3600;
    const orderId = await wallet.createOrder({
      sellerAddress: sellerAddr,
      destLat: 12971599,
      destLon: 77594566,
      deadlineUnix,
      valueWei: amountWei,
    });
    console.log(`[orchestrator] order ${orderId} created`);

    console.log("[orchestrator] depot seals the box...");
    const sealRes = (await fetch(`${RELAYER_URL}/api/orders/${orderId}/seal`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ box_id: boxLabel, courier: courierAddr }),
    }).then((r) => r.json())) as { ok: boolean; error?: string };
    if (!sealRes.ok) throw new Error(`orchestrator: seal REST call failed: ${JSON.stringify(sealRes)}`);

    const client = new SimBoxClient({ boxId: boxLabel, secretHex: boxSecret, relayerUrl: RELAYER_URL });
    const needsUnlockTrigger = scenario === "happy" || scenario === "offline-gap";
    const hooks = {
      onSealed: async () => {
        if (needsUnlockTrigger) {
          await new Promise((r) => setTimeout(r, 500)); // simulate transit
          console.log("[orchestrator] buyer requests unlock...");
          await wallet.requestUnlock(orderId);
        }
      },
    };

    console.log(`[orchestrator] running sim-box scenario "${scenario}"...`);
    if (scenario === "happy") await runHappyScenario(client, hooks);
    else if (scenario === "tamper") await runTamperScenario(client, hooks);
    else if (scenario === "power-cycle") await runPowerCycleScenario(client, hooks);
    else await runOfflineGapScenario(client, hooks);

    const wantStatus = scenario === "happy" || scenario === "offline-gap" ? STATUS.Delivered : STATUS.Tampered;
    console.log(`[orchestrator] waiting for order ${orderId} to reach status ${wantStatus}...`);
    await waitForOrderStatus(wallet, orderId, wantStatus, 20_000);

    const after = await snapshotBalances(wallet, { buyer: buyerAddr, seller: sellerAddr, courier: courierAddr });

    if (wantStatus === STATUS.Delivered) {
      await assertHappyOutcome({ wallet, orderId, amountWei, depositWei, before, after, buyerAddr, sellerAddr, courierAddr });
    } else {
      const bondBps = await wallet.bondBps();
      const bondWei = (amountWei * bondBps) / 10_000n;
      await assertTamperOutcome({ wallet, orderId, amountWei, bondWei, depositWei, before, after, buyerAddr, courierAddr });
    }

    // Give the SSE stream a moment to catch up, then check the ground truth
    // it carries that balances alone can't: no permanent tx failure was
    // ever reported, and the expected chain calls actually landed exactly
    // once each (not zero, not twice).
    await new Promise((r) => setTimeout(r, 300));
    await txWatcher.stop();
    txWatcher.assertNoFailures();
    if (scenario === "power-cycle") {
      const count = txWatcher.countConfirmed("reportTamper");
      if (count !== 1) {
        throw new Error(`checker: expected exactly 1 confirmed reportTamper despite 2 TAMPER events (firmware re-emit quirk), got ${count}`);
      }
    }
    if (scenario === "offline-gap") {
      const count = txWatcher.countConfirmed("logAlert");
      if (count < 1) {
        throw new Error("checker: offline-gap scenario never confirmed a logAlert (LOG_GAP) transaction");
      }
    }

    // The Evidence tab's "Verify log" button depends entirely on this route
    // agreeing that the anchored head matches what we recompute -- assert
    // it here too, not just balances, since a hex-encoding mismatch between
    // our bare-hex storage and the chain's "0x"-prefixed bytes32 would
    // otherwise pass every balance check while silently showing "mismatch"
    // to every user forever.
    const log = (await fetch(`${RELAYER_URL}/api/orders/${orderId}/log`).then((r) => r.json())) as {
      anchored_seq: number;
      match: boolean | null;
    };
    if (!(log.anchored_seq > 0 && log.match === true)) {
      throw new Error(`checker: GET /api/orders/${orderId}/log did not verify (anchored_seq=${log.anchored_seq}, match=${log.match})`);
    }

    console.log(`[orchestrator] PASS: scenario "${scenario}" reached status ${wantStatus} with correct balance deltas and no permanent tx failures.`);
  } finally {
    console.log("[orchestrator] tearing down...");
    if (txWatcher) await txWatcher.stop().catch(() => {});
    killTree(relayer);
    killTree(hardhatNode);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[orchestrator] FAIL:", err);
    process.exit(1);
  });

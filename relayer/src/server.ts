// Relayer entrypoint: wires config -> chain context -> ingest pipeline ->
// rules -> routes. `tsx src/server.ts` (or the compiled dist/) is the whole
// process; there is exactly one of these per box fleet (one writer, per
// CLAUDE.md).
import express from "express";
import cors from "cors";
import { loadConfig } from "./config.js";
import { buildChainContext } from "./chain/contracts.js";
import { ChainWriter } from "./chain/writer.js";
import { OrderWatcher } from "./chain/listener.js";
import { CommandQueue } from "./commandQueue.js";
import { SseHub } from "./sse.js";
import { BoxLogStore } from "./ingest/store.js";
import { IngestPipeline } from "./ingest/pipeline.js";
import { BoxTracker } from "./boxTracker.js";
import { RulesEngine } from "./rules.js";
import { Watchdog } from "./watchdog.js";
import { buildRouter } from "./routes.js";

export async function main(): Promise<{ app: express.Express; close: () => void }> {
  const config = loadConfig();
  console.log(`[relayer] starting, CHAIN=${config.chain}, PORT=${config.port}, dataDir=${config.dataDir}`);

  const ctx = await buildChainContext(config.chain, config.rpcUrl, config.oraclePrivateKey);
  console.log(`[relayer] chain OK: signer=${ctx.signerAddress}, escrow=${ctx.deployment.contracts.TamperSafeEscrow.address}`);

  const sse = new SseHub();
  const commands = new CommandQueue(config.dataDir);
  const writer = new ChainWriter(ctx, sse);
  await writer.init();

  const store = new BoxLogStore(config.dataDir);
  const tracker = new BoxTracker();
  const rules = new RulesEngine(ctx, writer, commands, sse);
  const pipeline = new IngestPipeline(store, config.boxSecrets, sse, tracker, rules, commands);
  pipeline.rebuildAll();

  const watcher = new OrderWatcher(ctx, commands, sse);
  await watcher.start(); // reconciles UnlockRequested + terminal cancellation at startup

  const watchdog = new Watchdog(tracker, rules);
  watchdog.start();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.post("/api/device/events", async (req, res) => {
    const result = await pipeline.handleBatch(req.body);
    res.status(result.status).json(result.body);
  });

  app.use(buildRouter({ ctx, watcher, commands, store, tracker, sse }));

  app.get("/api/health", (_req, res) => res.json({ ok: true, chain: config.chain }));

  const server = app.listen(config.port, () => {
    console.log(`[relayer] listening on :${config.port}`);
  });

  return {
    app,
    close: () => {
      watcher.stop();
      watchdog.stop();
      server.close();
    },
  };
}

main().catch((err) => {
  console.error("[relayer] fatal startup error:", err);
  process.exit(1);
});

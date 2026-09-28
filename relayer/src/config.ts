// Relayer configuration: loaded once from process.env (populated from
// relayer/.env via dotenv, or injected directly by the orchestrator for a
// scenario run -- see scripts/orchestrator.ts). Never hand-edit deployments/
// addresses here; those are read separately in chain/contracts.ts.
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RELAYER_ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..");

export type ChainName = "local" | "mst";

export interface BoxSecrets {
  [boxId: string]: string; // 64-char hex
}

export interface RelayerConfig {
  chain: ChainName;
  rpcUrl: string;
  oraclePrivateKey: string | undefined; // mst only
  boxSecrets: BoxSecrets;
  port: number;
  dataDir: string;
}

function parseBoxSecrets(raw: string | undefined): BoxSecrets {
  if (!raw || raw.trim() === "") return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`config: BOX_SECRETS is not valid JSON: ${(err as Error).message}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("config: BOX_SECRETS must be a JSON object of box_id -> hex secret");
  }
  const out: BoxSecrets = {};
  for (const [boxId, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== "string" || !/^[0-9a-fA-F]{64}$/.test(value)) {
      throw new Error(`config: BOX_SECRETS["${boxId}"] must be a 64-char hex string`);
    }
    out[boxId] = value.toLowerCase();
  }
  return out;
}

export function loadConfig(): RelayerConfig {
  const chain = (process.env.CHAIN ?? "local") as ChainName;
  if (chain !== "local" && chain !== "mst") {
    throw new Error(`config: CHAIN must be "local" or "mst", got ${JSON.stringify(process.env.CHAIN)}`);
  }
  const rpcUrl = chain === "local" ? process.env.LOCAL_RPC : process.env.MST_RPC;
  if (!rpcUrl) {
    throw new Error(`config: ${chain === "local" ? "LOCAL_RPC" : "MST_RPC"} is not set`);
  }
  if (chain === "mst" && !process.env.ORACLE_PRIVATE_KEY) {
    throw new Error("config: CHAIN=mst requires ORACLE_PRIVATE_KEY in the environment");
  }
  return {
    chain,
    rpcUrl,
    oraclePrivateKey: chain === "mst" ? process.env.ORACLE_PRIVATE_KEY : undefined,
    boxSecrets: parseBoxSecrets(process.env.BOX_SECRETS),
    port: Number(process.env.PORT ?? 4000),
    dataDir: process.env.DATA_DIR ?? path.join(RELAYER_ROOT, "data"),
  };
}

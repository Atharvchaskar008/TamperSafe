// Contract addresses and ABIs come ONLY from deployments/ — never
// hand-written, never imported from contracts/ sources (CLAUDE.md read
// boundary, ARCHITECTURE.md §5).
//
// We glob-import every deployments/*.json file eagerly rather than
// statically importing a per-network path (e.g. "../../deployments/mst.json")
// because that file doesn't exist yet for MST — a static import of a missing
// file would fail the Vite build today. The glob tolerates a missing file:
// it just produces fewer entries.
//
// We index the resulting deployment files by the numeric chain id stored
// *inside* each file (its own "chainId" field), not by filename. The plan
// (M6) names the file "deployments/mst-testnet.json"; the relayer may settle
// on a different name. Indexing by chainId means this dashboard doesn't have
// to guess the filename the other track picks — whatever appears in
// deployments/ that declares chainId 91562037 is "the mst deployment".

import type { JsonFragment } from "ethers";

export interface ContractDeployment {
  address: string;
  deployTxHash: string;
}

export interface DeploymentFile {
  chainId: string;
  deployedAt: string;
  deployer: string;
  relayerOracle: { address: string; note?: string };
  contracts: {
    BoxRegistry: ContractDeployment;
    TamperSafeEscrow: ContractDeployment;
    TelemetryAnchor: ContractDeployment;
  };
  boxes: Array<{ label: string; boxId: string; deviceKey: string }>;
}

export type ContractName = keyof DeploymentFile["contracts"];

// Eager glob: files exist on disk at build/dev time, so their contents are
// inlined — no runtime fetch, no risk of a 404 for a network whose
// deployment doesn't exist yet.
const deploymentModules = import.meta.glob<Record<string, unknown>>(
  "../../../deployments/*.json",
  { eager: true },
);
const abiModules = import.meta.glob<Record<string, unknown>>(
  "../../../deployments/abi/*.json",
  { eager: true },
);

function unwrap(mod: Record<string, unknown>): unknown {
  // Vite's JSON module exposes the parsed value as the default export.
  return "default" in mod ? mod.default : mod;
}

function isDeploymentFile(value: unknown): value is DeploymentFile {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.chainId === "string" && typeof v.contracts === "object" && v.contracts !== null;
}

const deploymentsByChainId = new Map<number, DeploymentFile>();
for (const [path, mod] of Object.entries(deploymentModules)) {
  const parsed = unwrap(mod);
  if (!isDeploymentFile(parsed)) continue; // e.g. accounts.json — not a deployment file
  const chainId = Number(parsed.chainId);
  if (Number.isNaN(chainId)) continue;
  deploymentsByChainId.set(chainId, parsed);
  void path; // kept for debugging via devtools if needed
}

const abiByContractName = new Map<string, JsonFragment[]>();
for (const [path, mod] of Object.entries(abiModules)) {
  const match = /([^/]+)\.json$/.exec(path);
  const name = match?.[1];
  if (!name) continue;
  const parsed = unwrap(mod);
  if (Array.isArray(parsed)) {
    abiByContractName.set(name, parsed as JsonFragment[]);
  }
}

export function getDeploymentForChain(chainId: number): DeploymentFile | undefined {
  return deploymentsByChainId.get(chainId);
}

/** Typed as ethers' JsonFragment[] (a valid InterfaceAbi) so callers can
 * pass it straight into `new Contract(...)` / `new Interface(...)` without
 * an `as` cast at every call site. */
export function getAbi(name: ContractName): JsonFragment[] {
  const abi = abiByContractName.get(name);
  if (!abi) {
    throw new Error(
      `No ABI found for ${name} in deployments/abi/. Has M1's deploy script run?`,
    );
  }
  return abi;
}

export function listKnownChainIds(): number[] {
  return [...deploymentsByChainId.keys()];
}

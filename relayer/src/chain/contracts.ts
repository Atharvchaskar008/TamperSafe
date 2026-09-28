// Loads addresses and ABIs only from deployments/ (never from contracts/
// sources), builds the provider/signer per CLAUDE.md's signing rule, and
// fails loudly if any deployed address has no code -- a stale local.json
// left over from a killed `hardhat node` must not look valid.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";
import type { ChainName } from "../config.js";

const RELAYER_ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..", "..");
const REPO_ROOT = path.resolve(RELAYER_ROOT, "..");
const DEPLOYMENTS_DIR = path.join(REPO_ROOT, "deployments");
const ABI_DIR = path.join(DEPLOYMENTS_DIR, "abi");

export interface DeploymentFile {
  chainId: string;
  deployer: string;
  relayerOracle: { address: string; note?: string };
  contracts: {
    BoxRegistry: { address: string; deployTxHash: string };
    TamperSafeEscrow: { address: string; deployTxHash: string };
    TelemetryAnchor: { address: string; deployTxHash: string };
  };
  boxes: Array<{ label: string; boxId: string; deviceKey: string }>;
}

function deploymentFileName(chain: ChainName): string {
  return chain === "local" ? "local.json" : "mst-testnet.json";
}

export function loadDeployment(chain: ChainName): DeploymentFile {
  const file = path.join(DEPLOYMENTS_DIR, deploymentFileName(chain));
  if (!fs.existsSync(file)) {
    throw new Error(`chain: no deployment file at ${file} -- run the deploy script for CHAIN=${chain} first`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as DeploymentFile;
}

function loadAbi(name: "BoxRegistry" | "TamperSafeEscrow" | "TelemetryAnchor"): ethers.InterfaceAbi {
  const file = path.join(ABI_DIR, `${name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`chain: no ABI file at ${file} -- deployments/abi/ is only ever written by the deploy script`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as ethers.InterfaceAbi;
}

export interface ChainContext {
  chain: ChainName;
  provider: ethers.JsonRpcProvider;
  signer: ethers.Signer;
  signerAddress: string;
  deployment: DeploymentFile;
  abis: {
    BoxRegistry: ethers.InterfaceAbi;
    TamperSafeEscrow: ethers.InterfaceAbi;
    TelemetryAnchor: ethers.InterfaceAbi;
  };
  registry: ethers.Contract; // read-only (view calls only from the relayer)
  escrow: ethers.Contract; // signer-bound, but see chain/writer.ts -- callers
  anchor: ethers.Contract; // must go through the typed writer, not this directly.
}

/**
 * Builds the provider + signer + contract handles for the active chain, and
 * runs the two startup guards ARCHITECTURE.md §10 requires:
 *   1. getCode() on every deployed address must return more than "0x".
 *   2. box_id label -> keccak256 hash must match deployments/<chain>.json's
 *      recorded boxId (catches a stale/mismatched deployment file early).
 */
export async function buildChainContext(chain: ChainName, rpcUrl: string, oraclePrivateKey: string | undefined): Promise<ChainContext> {
  const deployment = loadDeployment(chain);
  const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { pollingInterval: 500 });

  let signer: ethers.Signer;
  let signerAddress: string;
  if (chain === "local") {
    // No private key, ever, for CHAIN=local: the relayer signs with a
    // Hardhat dev account the node itself controls. We confirm that first
    // rather than assuming it -- see docs/ARCHITECTURE.md §10.
    const accounts: string[] = await provider.send("eth_accounts", []);
    const want = deployment.relayerOracle.address.toLowerCase();
    if (!accounts.some((a) => a.toLowerCase() === want)) {
      throw new Error(
        `chain: CHAIN=local but the node's eth_accounts does not include relayerOracle.address ` +
          `(${deployment.relayerOracle.address}). Is this the right hardhat node / local.json pair?`,
      );
    }
    signer = await provider.getSigner(deployment.relayerOracle.address);
    signerAddress = deployment.relayerOracle.address;
  } else {
    if (!oraclePrivateKey) {
      throw new Error("chain: CHAIN=mst requires ORACLE_PRIVATE_KEY");
    }
    const wallet = new ethers.Wallet(oraclePrivateKey, provider);
    signer = wallet;
    signerAddress = wallet.address;
  }

  const abis = {
    BoxRegistry: loadAbi("BoxRegistry"),
    TamperSafeEscrow: loadAbi("TamperSafeEscrow"),
    TelemetryAnchor: loadAbi("TelemetryAnchor"),
  };

  const addresses: Array<[string, string]> = [
    ["BoxRegistry", deployment.contracts.BoxRegistry.address],
    ["TamperSafeEscrow", deployment.contracts.TamperSafeEscrow.address],
    ["TelemetryAnchor", deployment.contracts.TelemetryAnchor.address],
  ];
  for (const [name, address] of addresses) {
    const code = await provider.getCode(address);
    if (code === "0x") {
      throw new Error(
        `chain: ${name} at ${address} has no code on ${chain} -- refusing to start. ` +
          `This usually means a stale deployments/${deploymentFileName(chain)} pointing at a killed hardhat node. ` +
          `Re-run the deploy script and retry.`,
      );
    }
  }

  // box_id label -> hash sanity check (catches a mismatched deployment file).
  for (const box of deployment.boxes) {
    const computed = ethers.id(box.label);
    if (computed.toLowerCase() !== box.boxId.toLowerCase()) {
      throw new Error(
        `chain: box "${box.label}" hashes to ${computed} but deployments/${deploymentFileName(chain)} ` +
          `records boxId ${box.boxId} -- deployment file is stale or corrupted.`,
      );
    }
  }

  const registry = new ethers.Contract(deployment.contracts.BoxRegistry.address, abis.BoxRegistry, provider);
  const escrow = new ethers.Contract(deployment.contracts.TamperSafeEscrow.address, abis.TamperSafeEscrow, signer);
  const anchor = new ethers.Contract(deployment.contracts.TelemetryAnchor.address, abis.TelemetryAnchor, signer);

  return { chain, provider, signer, signerAddress, deployment, abis, registry, escrow, anchor };
}

/** Order.Status enum, per ARCHITECTURE.md §6. */
export const OrderStatus = {
  None: 0,
  Funded: 1,
  InTransit: 2,
  UnlockRequested: 3,
  Delivered: 4,
  Tampered: 5,
  Expired: 6,
  Cancelled: 7,
} as const;
export type OrderStatusValue = (typeof OrderStatus)[keyof typeof OrderStatus];

/** Maps an on-chain bytes32 boxId back to its string label (e.g. "TS-BOX-01")
 * via deployments/<chain>.json's boxes[] list -- the device protocol and the
 * command queue speak the string label; the contracts speak the hash. */
export function labelForBoxHash(ctx: Pick<ChainContext, "deployment">, boxIdHash: string): string | undefined {
  return ctx.deployment.boxes.find((b) => b.boxId.toLowerCase() === boxIdHash.toLowerCase())?.label;
}

export function explorerTxUrl(chain: ChainName, txHash: string): string | null {
  // Explorer links are only ever built for CHAIN=mst -- a local Hardhat tx
  // hash does not resolve on mstscan.com. See CLAUDE.md and ARCHITECTURE.md §10.
  if (chain !== "mst") return null;
  return `https://testnet.mstscan.com/tx/${txHash}`;
}

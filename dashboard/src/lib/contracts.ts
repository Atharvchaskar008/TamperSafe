import {
  Contract,
  JsonRpcProvider,
  type ContractTransactionResponse,
  type Signer,
  type Provider,
} from "ethers";
import type { NetworkConfig } from "../config/networks";
import { getAbi, getDeploymentForChain } from "./deployments";

// Order.status enum, §6 of ARCHITECTURE.md. Single source for the label map
// so the UI never shows a raw number.
export const STATUS_LABELS = [
  "None",
  "Funded",
  "InTransit",
  "UnlockRequested",
  "Delivered",
  "Tampered",
  "Expired",
  "Cancelled",
] as const;

export type OrderStatus = (typeof STATUS_LABELS)[number];

export function statusLabel(status: number): string {
  return STATUS_LABELS[status] ?? `Unknown(${status})`;
}

/** Mirrors TamperSafeEscrow.Order (ARCHITECTURE.md §5.2). */
export interface OnChainOrder {
  buyer: string;
  seller: string;
  amount: bigint;
  deadline: bigint;
  destLat: number;
  destLon: number;
  courier: string;
  boxId: string;
  bond: bigint;
  baselineHash: string;
  status: number;
  tamperCode: number;
}

// One shared read-only provider per network config, memoized so repeated
// calls (e.g. polling "my orders") don't open a new connection each time.
// `staticNetwork: true` stops ethers re-probing eth_chainId on every call,
// which otherwise throws "network changed" noise when a local RPC is slow
// to answer during the demo.
const readProviders = new Map<string, JsonRpcProvider>();

export function getReadProvider(network: NetworkConfig): JsonRpcProvider {
  const cached = readProviders.get(network.key);
  if (cached) return cached;
  const provider = new JsonRpcProvider(
    network.rpcUrl,
    { chainId: network.chainId, name: network.key },
    { staticNetwork: true },
  );
  readProviders.set(network.key, provider);
  return provider;
}

function requireDeployment(network: NetworkConfig) {
  const deployment = getDeploymentForChain(network.chainId);
  if (!deployment) {
    throw new Error(
      `No deployment found for chain id ${network.chainId} (${network.label}). ` +
        `Run the deploy script for this network and commit deployments/<chain>.json.`,
    );
  }
  return deployment;
}

/**
 * A narrow, hand-written *calling convention* over the real runtime ABI
 * (still loaded only from deployments/abi/TamperSafeEscrow.json — this
 * interface adds no fields and invents no function that isn't in that ABI).
 * It exists only so TypeScript can type the specific methods the Buyer and
 * Courier tabs call; `ethers.Contract`'s own type is a dynamic index
 * signature, which — combined with `noUncheckedIndexedAccess` — otherwise
 * types every method as "possibly undefined".
 */
interface EscrowMethods {
  orderCount(): Promise<bigint>;
  getOrder(id: bigint): Promise<unknown>;
  createOrder(
    seller: string,
    destLat: number,
    destLon: number,
    deadline: bigint,
    overrides: { value: bigint },
  ): Promise<ContractTransactionResponse>;
  cancelOrder(id: bigint): Promise<ContractTransactionResponse>;
  requestUnlock(id: bigint): Promise<ContractTransactionResponse>;
  depositBond(overrides: { value: bigint }): Promise<ContractTransactionResponse>;
  withdrawBond(amount: bigint): Promise<ContractTransactionResponse>;
  bondBalance(address: string): Promise<bigint>;
  lockedBond(address: string): Promise<bigint>;
}

// An intersection, not `interface X extends Contract`: Contract carries a
// `[key: string]: BaseContractMethod` index signature, and TS forbids an
// extending interface from narrowing an inherited index signature's
// property types. Intersecting sidesteps that rule while still giving every
// call site the concrete method signatures above.
export type EscrowContract = Contract & EscrowMethods;

export function getEscrowContract(
  network: NetworkConfig,
  runner: Provider | Signer,
): EscrowContract {
  const deployment = requireDeployment(network);
  const contract = new Contract(deployment.contracts.TamperSafeEscrow.address, getAbi("TamperSafeEscrow"), runner);
  return contract as unknown as EscrowContract;
}

export function getBoxRegistryContract(
  network: NetworkConfig,
  runner: Provider | Signer,
): Contract {
  const deployment = requireDeployment(network);
  return new Contract(deployment.contracts.BoxRegistry.address, getAbi("BoxRegistry"), runner);
}

export function getTelemetryAnchorContract(
  network: NetworkConfig,
  runner: Provider | Signer,
): Contract {
  const deployment = requireDeployment(network);
  return new Contract(deployment.contracts.TelemetryAnchor.address, getAbi("TelemetryAnchor"), runner);
}

/**
 * `getOrder` returns an ethers Result (tuple with named fields). Ethers v6
 * decodes every Solidity integer type — including int32/uint8, not just
 * uint256 — as `bigint`, so destLat/destLon/status/tamperCode need an
 * explicit Number() narrowing before the UI can do arithmetic or index a
 * label array with them.
 */
export function toOnChainOrder(raw: unknown): OnChainOrder {
  const o = raw as Record<string, unknown>;
  return {
    buyer: o.buyer as string,
    seller: o.seller as string,
    amount: o.amount as bigint,
    deadline: o.deadline as bigint,
    destLat: Number(o.destLat),
    destLon: Number(o.destLon),
    courier: o.courier as string,
    boxId: o.boxId as string,
    bond: o.bond as bigint,
    baselineHash: o.baselineHash as string,
    status: Number(o.status),
    tamperCode: Number(o.tamperCode),
  };
}

/** True once the network's Escrow address has deployed code — catches a
 * stale deployments/local.json left over from a killed `hardhat node`
 * (ARCHITECTURE.md §10, "getCode() ... must return more than 0x"). */
export async function escrowHasCode(network: NetworkConfig): Promise<boolean> {
  const deployment = getDeploymentForChain(network.chainId);
  if (!deployment) return false;
  const provider = getReadProvider(network);
  const code = await provider.getCode(deployment.contracts.TamperSafeEscrow.address);
  return code !== "0x";
}

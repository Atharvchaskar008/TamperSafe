// ethers v6 types `Contract`'s dynamic properties as `((...a) => ...) |
// undefined` (BaseContract's index signature), so every call site needs a
// cast. Centralized here instead of scattered `as any` throughout the
// codebase -- these are read-only view calls the relayer makes directly
// (getOrder, getBox, latest, ...), distinct from the five ORACLE write
// calls, which only ever go through chain/writer.ts.
import type { ChainContext } from "./contracts.js";

export interface OrderStruct {
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
  status: bigint;
  tamperCode: number;
}

export interface BoxStruct {
  deviceKey: string;
  active: boolean;
  activeOrderId: bigint;
  label: string;
}

export interface AnchorLatest {
  seq: bigint;
  head: string;
  timestamp: bigint;
}

type Fn<A extends unknown[], R> = (...a: A) => Promise<R>;

export function getOrder(ctx: Pick<ChainContext, "escrow">, id: number): Promise<OrderStruct> {
  return (ctx.escrow.getOrder as unknown as Fn<[number], OrderStruct>)(id);
}

export function getOrderCount(ctx: Pick<ChainContext, "escrow">): Promise<bigint> {
  return (ctx.escrow.orderCount as unknown as Fn<[], bigint>)();
}

export function getBondBps(ctx: Pick<ChainContext, "escrow">): Promise<bigint> {
  return (ctx.escrow.bondBps as unknown as Fn<[], bigint>)();
}

export function getBondBalance(ctx: Pick<ChainContext, "escrow">, addr: string): Promise<bigint> {
  return (ctx.escrow.bondBalance as unknown as Fn<[string], bigint>)(addr);
}

export function getLockedBond(ctx: Pick<ChainContext, "escrow">, addr: string): Promise<bigint> {
  return (ctx.escrow.lockedBond as unknown as Fn<[string], bigint>)(addr);
}

export function getBox(ctx: Pick<ChainContext, "registry">, boxIdHash: string): Promise<BoxStruct> {
  return (ctx.registry.getBox as unknown as Fn<[string], BoxStruct>)(boxIdHash);
}

export function getAnchorLatest(ctx: Pick<ChainContext, "anchor">, orderId: number): Promise<AnchorLatest> {
  return (ctx.anchor.latest as unknown as Fn<[number], AnchorLatest>)(orderId);
}

// Classifies a failed chain call as permanent (a decoded contract custom
// error -- retrying would fail identically) or transient (transport, nonce,
// fee-estimation -- worth 2 retries). ARCHITECTURE.md §10 "Revert handling".
//
// Confirmed empirically (see the M3 build spike): ethers v6's send-path
// CALL_EXCEPTION does NOT auto-decode a custom error the way .staticCall
// does -- err.reason is null and err.data holds the raw revert bytes. We
// decode it ourselves with Interface.parseError across all three ABIs.
import { ethers } from "ethers";
import type { ChainContext } from "./contracts.js";

export interface DecodedRevert {
  name: string;
  args: unknown[];
}

export type RevertClassification =
  | { kind: "permanent"; decoded: DecodedRevert | undefined; raw: unknown }
  | { kind: "transient"; raw: unknown };

function extractRevertData(err: unknown): string | undefined {
  const e = err as { data?: unknown; info?: { error?: { data?: unknown } } };
  if (typeof e?.data === "string") return e.data;
  const nested = e?.info?.error?.data;
  if (typeof nested === "string") return nested;
  return undefined;
}

export function classifyRevert(ctx: Pick<ChainContext, "abis">, err: unknown): RevertClassification {
  const code = (err as { code?: string })?.code;
  const data = extractRevertData(err);

  if (data && data !== "0x") {
    for (const abi of Object.values(ctx.abis)) {
      try {
        const iface = new ethers.Interface(abi);
        const parsed = iface.parseError(data);
        if (parsed) {
          return { kind: "permanent", decoded: { name: parsed.name, args: [...parsed.args] }, raw: err };
        }
      } catch {
        // not this contract's error set; try the next ABI.
      }
    }
    // Had revert data but couldn't decode it against any known ABI --
    // still a real revert (permanent), just unrecognised.
    return { kind: "permanent", decoded: undefined, raw: err };
  }

  // Transport-layer failures, nonce errors and fee-estimation failures:
  // ethers codes these as NETWORK_ERROR, TIMEOUT, NONCE_EXPIRED,
  // REPLACEMENT_UNDERPRICED, UNPREDICTABLE_GAS_LIMIT (fee estimation), etc.
  // None of these carry revert `data`, which is exactly how we tell them
  // apart from a genuine contract revert above.
  if (
    code === "NETWORK_ERROR" ||
    code === "TIMEOUT" ||
    code === "NONCE_EXPIRED" ||
    code === "REPLACEMENT_UNDERPRICED" ||
    code === "UNPREDICTABLE_GAS_LIMIT" ||
    code === "SERVER_ERROR" ||
    code === undefined
  ) {
    return { kind: "transient", raw: err };
  }

  // Anything else with no data and an unrecognised code: treat as permanent
  // to avoid retrying forever on something we don't understand, but this
  // should be rare -- flagged for the team via the SSE alert the caller raises.
  return { kind: "permanent", decoded: undefined, raw: err };
}

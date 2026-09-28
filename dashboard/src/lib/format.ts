import { Interface, formatEther } from "ethers";

/** Decimal degrees -> the int32 microdegree encoding the contract stores
 * (ARCHITECTURE.md §5: "Coordinates are int32 microdegrees (lat × 1e6)").
 * Math.round, not truncation, so -0.0000004° doesn't silently become 0. */
export function degreesToMicrodegrees(deg: number): number {
  return Math.round(deg * 1e6);
}

export function microdegreesToDegrees(microdeg: number): number {
  return microdeg / 1e6;
}

export function formatTMSTC(wei: bigint): string {
  return `${formatEther(wei)} tMSTC`;
}

/** `<input type="datetime-local">` gives a string in the browser's local
 * timezone with no offset info. We convert via Date, which interprets it in
 * the browser's local timezone — good enough for a demo deadline picker,
 * but worth flagging: the value is NOT timezone-portable if screenshotted
 * across timezones. */
export function datetimeLocalToUnixSeconds(value: string): number {
  return Math.floor(new Date(value).getTime() / 1000);
}

/**
 * Best-effort decode of a failed contract call/tx into a human message,
 * preferring the contract's own custom errors (InvalidStatus, NotBuyer, ...)
 * over ethers' generic "execution reverted".
 */
export function decodeContractError(err: unknown, iface: Interface): string {
  const anyErr = err as {
    reason?: string;
    shortMessage?: string;
    message?: string;
    code?: string;
    data?: string;
    info?: { error?: { data?: string } };
    error?: { data?: string };
  };

  if (anyErr?.code === "ACTION_REJECTED") {
    return "Rejected in wallet";
  }

  const data = anyErr?.data ?? anyErr?.info?.error?.data ?? anyErr?.error?.data;
  if (typeof data === "string" && data.startsWith("0x") && data.length >= 10) {
    try {
      const parsed = iface.parseError(data);
      if (parsed) {
        const args = parsed.args.length ? `(${parsed.args.map(String).join(", ")})` : "";
        return `${parsed.name}${args}`;
      }
    } catch {
      // fall through to generic message below
    }
  }

  return anyErr?.reason ?? anyErr?.shortMessage ?? anyErr?.message ?? "Transaction failed";
}

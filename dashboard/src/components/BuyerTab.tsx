import { useCallback, useEffect, useMemo, useState } from "react";
import { Interface, isAddress, parseEther, ZeroAddress } from "ethers";
import type { NetworkConfig } from "../config/networks";
import type { useWallet } from "../hooks/useWallet";
import { useTxRunner } from "../hooks/useTxRunner";
import {
  getEscrowContract,
  getReadProvider,
  statusLabel,
  toOnChainOrder,
  type OnChainOrder,
} from "../lib/contracts";
import { getAbi } from "../lib/deployments";
import {
  datetimeLocalToUnixSeconds,
  decodeContractError,
  degreesToMicrodegrees,
  formatTMSTC,
  microdegreesToDegrees,
} from "../lib/format";
import { TxList } from "./TxList";

interface Props {
  network: NetworkConfig;
  wallet: ReturnType<typeof useWallet>;
}

interface OrderRow {
  id: bigint;
  order: OnChainOrder;
}

// §4: where the order amount ends up once a terminal state is reached.
// Non-terminal states (Funded, InTransit, UnlockRequested) have no payout yet.
function moneyWentTo(order: OnChainOrder): string {
  switch (order.status) {
    case 4: // Delivered
      return `seller (${order.seller.slice(0, 6)}…)`;
    case 5: // Tampered
    case 6: // Expired
    case 7: // Cancelled
      return `buyer (refunded)`;
    default:
      return "— (in escrow)";
  }
}

export function BuyerTab({ network, wallet }: Props) {
  const escrowInterface = useMemo(() => new Interface(getAbi("TamperSafeEscrow")), []);
  const { entries, run } = useTxRunner();

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const refresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  useEffect(() => {
    if (!wallet.account) {
      setOrders([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const escrow = getEscrowContract(network, getReadProvider(network));
        const count = (await escrow.orderCount()) as bigint;
        const rows: OrderRow[] = [];
        // Order ids start at 1 (ARCHITECTURE.md §5.1: "activeOrderId == 0
        // means free"). We iterate 1..orderCount() inclusive, which is
        // correct whether orderCount() means "how many orders exist" or
        // "the last assigned id" — both cases enumerate every real order.
        for (let id = 1n; id <= count; id++) {
          const raw = await escrow.getOrder(id);
          const order = toOnChainOrder(raw);
          if (order.buyer.toLowerCase() === wallet.account!.toLowerCase()) {
            rows.push({ id, order });
          }
        }
        if (!cancelled) setOrders(rows);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [network, wallet.account, refreshTick]);

  const ensureWalletOnNetwork = useCallback(async () => {
    if (wallet.chainId !== network.chainId) {
      await wallet.switchOrAddNetwork(network);
    }
  }, [network, wallet]);

  // --- Create order form state ---
  const [seller, setSeller] = useState("");
  const [amount, setAmount] = useState("0.01");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [deadlineLocal, setDeadlineLocal] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const submitCreateOrder = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);
      if (!wallet.account) {
        setFormError("Connect a wallet first.");
        return;
      }
      if (!isAddress(seller)) {
        setFormError("Seller must be a valid address.");
        return;
      }
      if (seller.toLowerCase() === wallet.account.toLowerCase()) {
        setFormError("Seller cannot be the connected (buyer) address (InvalidSeller).");
        return;
      }
      const amountNum = Number(amount);
      if (!(amountNum > 0)) {
        setFormError("Amount must be greater than 0 (ZeroAmount).");
        return;
      }
      const latNum = Number(lat);
      const lonNum = Number(lon);
      if (!(latNum >= -90 && latNum <= 90)) {
        setFormError("Latitude must be between -90 and 90.");
        return;
      }
      if (!(lonNum >= -180 && lonNum <= 180)) {
        setFormError("Longitude must be between -180 and 180.");
        return;
      }
      if (!deadlineLocal) {
        setFormError("Pick a deadline.");
        return;
      }
      const deadlineSec = datetimeLocalToUnixSeconds(deadlineLocal);
      if (deadlineSec <= Math.floor(Date.now() / 1000)) {
        setFormError("Deadline must be in the future (BadDeadline).");
        return;
      }

      try {
        await ensureWalletOnNetwork();
        await run(
          `createOrder(${seller.slice(0, 8)}…, ${amount} tMSTC)`,
          async () => {
            const signer = await wallet.getSigner();
            const escrow = getEscrowContract(network, signer);
            return escrow.createOrder(
              seller,
              degreesToMicrodegrees(latNum),
              degreesToMicrodegrees(lonNum),
              BigInt(deadlineSec),
              { value: parseEther(amount) },
            );
          },
          (err) => decodeContractError(err, escrowInterface),
        );
        refresh();
      } catch {
        // Surfaced via the tx list already.
      }
    },
    [amount, deadlineLocal, ensureWalletOnNetwork, escrowInterface, lat, lon, network, refresh, run, seller, wallet],
  );

  const cancelOrder = useCallback(
    async (id: bigint) => {
      try {
        await ensureWalletOnNetwork();
        await run(
          `cancelOrder(${id})`,
          async () => {
            const signer = await wallet.getSigner();
            const escrow = getEscrowContract(network, signer);
            return escrow.cancelOrder(id);
          },
          (err) => decodeContractError(err, escrowInterface),
        );
        refresh();
      } catch {
        // Surfaced via the tx list already.
      }
    },
    [ensureWalletOnNetwork, escrowInterface, network, refresh, run, wallet],
  );

  const confirmAndUnlock = useCallback(
    async (id: bigint) => {
      try {
        await ensureWalletOnNetwork();
        await run(
          `requestUnlock(${id})`,
          async () => {
            const signer = await wallet.getSigner();
            const escrow = getEscrowContract(network, signer);
            return escrow.requestUnlock(id);
          },
          (err) => decodeContractError(err, escrowInterface),
        );
        refresh();
      } catch {
        // Surfaced via the tx list already.
      }
    },
    [ensureWalletOnNetwork, escrowInterface, network, refresh, run, wallet],
  );

  if (!wallet.account) {
    return <p>Connect a wallet to see your orders.</p>;
  }

  return (
    <div className="tab-buyer">
      <section>
        <h3>Create order</h3>
        <form onSubmit={submitCreateOrder}>
          <label>
            Seller address
            <input value={seller} onChange={(e) => setSeller(e.target.value)} placeholder="0x…" />
          </label>
          <label>
            Amount (tMSTC)
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.01" />
          </label>
          <label>
            Destination latitude
            <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="12.9716" />
          </label>
          <label>
            Destination longitude
            <input value={lon} onChange={(e) => setLon(e.target.value)} placeholder="77.5946" />
          </label>
          <label>
            Deadline
            <input
              type="datetime-local"
              value={deadlineLocal}
              onChange={(e) => setDeadlineLocal(e.target.value)}
            />
          </label>
          <button type="submit">Create &amp; fund order</button>
        </form>
        {formError && <p className="form-error">{formError}</p>}
      </section>

      <section>
        <h3>My orders</h3>
        {loading && <p>Loading…</p>}
        {loadError && <p className="form-error">{loadError}</p>}
        {!loading && !loadError && orders.length === 0 && <p>No orders yet.</p>}
        <table>
          <thead>
            <tr>
              <th>Id</th>
              <th>Seller</th>
              <th>Amount</th>
              <th>Destination</th>
              <th>Status</th>
              <th>Money went to</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(({ id, order }) => (
              <tr key={id.toString()}>
                <td>{id.toString()}</td>
                <td>{order.seller === ZeroAddress ? "—" : order.seller}</td>
                <td>{formatTMSTC(order.amount)}</td>
                <td>
                  {microdegreesToDegrees(order.destLat).toFixed(4)}, {microdegreesToDegrees(order.destLon).toFixed(4)}
                </td>
                <td>{statusLabel(order.status)}</td>
                <td>{moneyWentTo(order)}</td>
                <td>
                  <button type="button" disabled={order.status !== 1} onClick={() => void cancelOrder(id)}>
                    Cancel
                  </button>
                  <button type="button" disabled={order.status !== 2} onClick={() => void confirmAndUnlock(id)}>
                    Confirm &amp; Unlock
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3>Transactions</h3>
        <TxList entries={entries} />
      </section>
    </div>
  );
}

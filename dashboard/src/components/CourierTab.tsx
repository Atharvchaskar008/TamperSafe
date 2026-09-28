import { useCallback, useEffect, useMemo, useState } from "react";
import { Interface, parseEther } from "ethers";
import type { NetworkConfig } from "../config/networks";
import type { useWallet } from "../hooks/useWallet";
import { useTxRunner } from "../hooks/useTxRunner";
import { getEscrowContract, getReadProvider } from "../lib/contracts";
import { getAbi } from "../lib/deployments";
import { decodeContractError, formatTMSTC } from "../lib/format";
import { TxList } from "./TxList";

interface Props {
  network: NetworkConfig;
  wallet: ReturnType<typeof useWallet>;
}

export function CourierTab({ network, wallet }: Props) {
  const escrowInterface = useMemo(() => new Interface(getAbi("TamperSafeEscrow")), []);
  const { entries, run } = useTxRunner();

  const [free, setFree] = useState<bigint | null>(null);
  const [locked, setLocked] = useState<bigint | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const refresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  useEffect(() => {
    const account = wallet.account;
    if (!account) {
      setFree(null);
      setLocked(null);
      return;
    }
    let cancelled = false;
    setLoadError(null);
    (async () => {
      try {
        const escrow = getEscrowContract(network, getReadProvider(network));
        const [freeBond, lockedBond] = await Promise.all([
          escrow.bondBalance(account),
          escrow.lockedBond(account),
        ]);
        if (!cancelled) {
          setFree(freeBond);
          setLocked(lockedBond);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
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

  const [depositAmount, setDepositAmount] = useState("0.01");
  const [withdrawAmount, setWithdrawAmount] = useState("0.01");
  const [formError, setFormError] = useState<string | null>(null);

  const deposit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);
      const amountNum = Number(depositAmount);
      if (!(amountNum > 0)) {
        setFormError("Amount must be greater than 0.");
        return;
      }
      try {
        await ensureWalletOnNetwork();
        await run(
          `depositBond(${depositAmount} tMSTC)`,
          async () => {
            const signer = await wallet.getSigner();
            const escrow = getEscrowContract(network, signer);
            return escrow.depositBond({ value: parseEther(depositAmount) });
          },
          (err) => decodeContractError(err, escrowInterface),
        );
        refresh();
      } catch {
        // Surfaced via the tx list already.
      }
    },
    [depositAmount, ensureWalletOnNetwork, escrowInterface, network, refresh, run, wallet],
  );

  const withdraw = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);
      const amountNum = Number(withdrawAmount);
      if (!(amountNum > 0)) {
        setFormError("Amount must be greater than 0.");
        return;
      }
      if (free != null && parseEther(withdrawAmount) > free) {
        setFormError("Amount exceeds free (unlocked) bond.");
        return;
      }
      try {
        await ensureWalletOnNetwork();
        await run(
          `withdrawBond(${withdrawAmount} tMSTC)`,
          async () => {
            const signer = await wallet.getSigner();
            const escrow = getEscrowContract(network, signer);
            return escrow.withdrawBond(parseEther(withdrawAmount));
          },
          (err) => decodeContractError(err, escrowInterface),
        );
        refresh();
      } catch {
        // Surfaced via the tx list already.
      }
    },
    [ensureWalletOnNetwork, escrowInterface, free, network, refresh, run, wallet, withdrawAmount],
  );

  if (!wallet.account) {
    return <p>Connect a wallet to see your bond.</p>;
  }

  return (
    <div className="tab-courier">
      <section>
        <h3>Bond balance</h3>
        {loadError && <p className="form-error">{loadError}</p>}
        <p>Free (withdrawable): {free != null ? formatTMSTC(free) : "…"}</p>
        <p>Locked (against a sealed shipment): {locked != null ? formatTMSTC(locked) : "…"}</p>
      </section>

      <section>
        <h3>Deposit bond</h3>
        <form onSubmit={deposit}>
          <label>
            Amount (tMSTC)
            <input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
          </label>
          <button type="submit">Deposit</button>
        </form>
      </section>

      <section>
        <h3>Withdraw bond</h3>
        <form onSubmit={withdraw}>
          <label>
            Amount (tMSTC)
            <input value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
          </label>
          <button type="submit">Withdraw</button>
        </form>
        {formError && <p className="form-error">{formError}</p>}
      </section>

      <section>
        <h3>Transactions</h3>
        <TxList entries={entries} />
      </section>
    </div>
  );
}

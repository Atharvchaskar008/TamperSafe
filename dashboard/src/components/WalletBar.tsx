import type { NetworkKey } from "../config/networks";
import { NETWORKS } from "../config/networks";
import type { useWallet } from "../hooks/useWallet";

interface Props {
  wallet: ReturnType<typeof useWallet>;
  networkKey: NetworkKey;
  onNetworkChange: (key: NetworkKey) => void;
}

/**
 * Connect button, network dropdown (drives which deployments/<chain>.json
 * the read layer uses) and an explicit "Add MST Testnet" button
 * (wallet_addEthereumChain) — both required by M5's first checklist item.
 */
export function WalletBar({ wallet, networkKey, onNetworkChange }: Props) {
  const selected = NETWORKS[networkKey];
  const walletNetwork = wallet.chainId != null
    ? Object.values(NETWORKS).find((n) => n.chainId === wallet.chainId)
    : undefined;
  const mismatch = wallet.account != null && wallet.chainId != null && wallet.chainId !== selected.chainId;

  return (
    <div className="wallet-bar">
      <label>
        Network:{" "}
        <select value={networkKey} onChange={(e) => onNetworkChange(e.target.value as NetworkKey)}>
          {Object.values(NETWORKS).map((n) => (
            <option key={n.key} value={n.key}>
              {n.label}
            </option>
          ))}
        </select>
      </label>

      <button type="button" onClick={() => void wallet.switchOrAddNetwork(NETWORKS.mst)}>
        Add MST Testnet
      </button>

      {wallet.account ? (
        <span className="wallet-account">
          {wallet.account.slice(0, 6)}…{wallet.account.slice(-4)}
          {" · "}
          {walletNetwork ? walletNetwork.label : `chain ${wallet.chainId}`}
        </span>
      ) : (
        <button type="button" onClick={() => void wallet.connect()} disabled={wallet.connecting}>
          {wallet.connecting ? "Connecting…" : "Connect MetaMask"}
        </button>
      )}

      {mismatch && (
        <span className="wallet-mismatch">
          Wallet is on {walletNetwork?.label ?? wallet.chainId} but dashboard is set to {selected.label}.{" "}
          <button type="button" onClick={() => void wallet.switchOrAddNetwork(selected)}>
            Switch wallet to {selected.label}
          </button>
        </span>
      )}

      {wallet.error && <span className="wallet-error">{wallet.error}</span>}
    </div>
  );
}

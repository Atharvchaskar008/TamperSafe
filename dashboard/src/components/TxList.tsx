import type { TxEntry } from "../hooks/useTxRunner";

export function TxList({ entries }: { entries: TxEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <ul className="tx-list">
      {entries.map((e) => (
        <li key={e.id} className={`tx-entry tx-${e.status}`}>
          <span className="tx-label">{e.label}</span>
          <span className="tx-status">{e.status}</span>
          {e.hash && (
            <span className="tx-hash">
              {e.explorerUrl ? (
                <a href={e.explorerUrl} target="_blank" rel="noreferrer">
                  {e.hash.slice(0, 10)}…
                </a>
              ) : (
                <span title="No explorer for this network (local chain)">{e.hash.slice(0, 10)}…</span>
              )}
            </span>
          )}
          {e.error && <span className="tx-error">{e.error}</span>}
        </li>
      ))}
    </ul>
  );
}

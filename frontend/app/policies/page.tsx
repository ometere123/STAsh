"use client";

import Link from "next/link";
import { useWallet } from "@/providers/WalletProvider";
import { useHolderPolicies } from "@/hooks/usePolicy";
import { formatTimestamp, statusColor, weiToGen } from "@/lib/format";

export default function PoliciesPage() {
  const { address } = useWallet();
  const { policies, loading, error, refresh } = useHolderPolicies(address);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold">My Policies</h2>
          <p className="text-sm text-muted-steel mt-1">Coverage owned by your connected wallet</p>
          {address && <p className="text-xs font-mono text-muted-steel mt-2 break-all">{address}</p>}
        </div>
        {address && (
          <button onClick={refresh} disabled={loading} className="btn-secondary text-xs py-1.5">
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        )}
      </div>

      {!address && (
        <div className="panel p-8 text-center text-sm text-muted-steel">Connect your wallet to load its policies.</div>
      )}

      {loading && policies.length === 0 && (
        <div className="panel p-8 text-center text-sm font-mono text-muted-steel">
          Reading your policies from StudioNet. This can take 10–20 seconds...
        </div>
      )}

      {error && (
        <div className="panel p-5 border-failure-red/40 space-y-3">
          <div className="text-sm text-failure-red">{error}</div>
          <button onClick={refresh} className="btn-secondary text-xs py-1.5">Retry</button>
        </div>
      )}

      {!loading && !error && address && policies.length === 0 && (
        <div className="panel p-8 text-center space-y-3">
          <div className="text-sm text-muted-steel">No policies belong to this wallet.</div>
          <Link href="/coverage" className="btn-primary inline-block text-xs py-1.5">Buy Coverage</Link>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {policies.map((policy) => (
          <div key={policy.id} className="panel p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-heading font-semibold">Policy #{policy.id}</span>
              <span className={`font-label text-xs uppercase ${statusColor(policy.status)}`}>{policy.status}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><div className="label-text">Pool</div><div className="metric-small">#{policy.pool_id}</div></div>
              <div><div className="label-text">Coverage</div><div className="metric-small text-signal-green">{weiToGen(policy.coverage_wei)} GEN</div></div>
              <div><div className="label-text">Premium</div><div className="metric-small">{weiToGen(policy.premium_paid_wei)} GEN</div></div>
              <div><div className="label-text">Min incident</div><div className="metric-small">{policy.min_minutes} min</div></div>
            </div>
            <div className="space-y-2 text-xs text-muted-steel">
              <div><span className="label-text">Waiting period ends</span><br />{formatTimestamp(policy.waiting_period_end)}</div>
              <div><span className="label-text">Policy ends</span><br />{formatTimestamp(policy.end_time)}</div>
              <div className="font-mono break-all"><span className="label-text">Holder</span><br />{policy.holder}</div>
            </div>
            {policy.status === "active" && (
              <Link href="/claims" className="btn-secondary inline-block text-xs py-1.5">File a Claim</Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

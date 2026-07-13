"use client";

import { useState, useEffect, useCallback } from "react";
import { getProtocolStats, getClaim } from "@/lib/contract";
import { weiToGen, statusColor, formatTimestamp } from "@/lib/format";
import type { Claim, ProtocolStats } from "@/lib/types";
import Link from "next/link";

const FILTER_OPTIONS = ["all", "filed", "reviewing", "approved", "denied", "settled"] as const;

export default function LedgerPage() {
  const [stats, setStats] = useState<ProtocolStats | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await getProtocolStats();
      setStats(s);
      const claimList = await Promise.all(
        Array.from({ length: s.claim_count }, (_, index) => getClaim(index + 1))
      );
      setClaims(claimList);
    } catch (e: any) {
      setError(e.message || "Unable to load the payout ledger");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = filter === "all" ? claims : claims.filter((c) => c.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold">Payout Ledger</h2>
          <p className="text-sm text-muted-steel mt-1">Claims only — purchased coverage appears under My Policies</p>
        </div>
        {stats && (
          <div className="flex gap-4">
            <div className="text-right">
              <div className="label-text">Pools</div>
              <div className="metric-small">{stats.pool_count}</div>
            </div>
            <div className="text-right">
              <div className="label-text">Policies</div>
              <div className="metric-small">{stats.policy_count}</div>
            </div>
            <div className="text-right">
              <div className="label-text">Claims</div>
              <div className="metric-small">{stats.claim_count}</div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`font-label text-xs px-3 py-1.5 rounded transition-colors ${
              filter === f
                ? "bg-signal-green/10 text-signal-green border border-signal-green/30"
                : "bg-panel-graphite text-muted-steel border border-transparent hover:text-panel-white"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && <div className="text-muted-steel font-mono text-sm">Loading finalized claims from StudioNet...</div>}

      {error && (
        <div className="panel p-4 border-failure-red/40 space-y-3">
          <div className="text-sm text-failure-red">{error}</div>
          <button onClick={loadData} className="btn-secondary text-xs py-1.5">Retry</button>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((c) => (
          <Link key={c.id} href={`/replay/${c.id}`} className="panel p-4 flex items-center gap-4 hover:border-signal-green/20 transition-colors block">
            <span className="font-mono text-sm w-16">#{c.id}</span>
            <span className={`font-label text-xs uppercase w-20 ${statusColor(c.status)}`}>{c.status}</span>
            <span className="text-xs text-muted-steel flex-1 truncate">{c.incident_url || "-"}</span>
            <span className="text-xs text-consensus-violet w-28">{c.verdict || "pending"}</span>
            <span className="text-xs w-16">{c.payout_band || "-"}</span>
            <span className="metric-small w-24 text-right">
              {c.payout_wei !== "0" ? `${weiToGen(c.payout_wei)} GEN` : "-"}
            </span>
          </Link>
        ))}
        {!loading && !error && filtered.length === 0 && (
          <div className="panel p-8 text-center space-y-3">
            <div className="text-muted-steel text-sm">No claims found</div>
            <p className="text-xs text-muted-steel">A coverage purchase creates a policy, not a claim.</p>
            <Link href="/policies" className="btn-secondary inline-block text-xs py-1.5">View My Policies</Link>
          </div>
        )}
      </div>
    </div>
  );
}

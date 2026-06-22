"use client";

import { useAllPools } from "@/hooks/usePool";
import { weiToGen, statusColor } from "@/lib/format";
import Link from "next/link";

export default function RadarPage() {
  const { pools, loading, error, refresh } = useAllPools();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold">Incident Radar</h2>
          <p className="text-sm text-muted-steel mt-1">
            Live risk tiles for covered dependency pools
          </p>
        </div>
        <button onClick={refresh} className="btn-secondary text-xs py-1.5 px-3">
          Refresh
        </button>
      </div>

      {loading && (
        <div className="text-muted-steel font-mono text-sm">Loading pools...</div>
      )}
      {error && (
        <div className="panel p-4 border-failure-red/30 text-failure-red text-sm">{error}</div>
      )}

      {!loading && pools.length === 0 && !error && (
        <div className="panel p-8 text-center">
          <div className="text-muted-steel text-sm">
            No pools found. Deploy the contract and seed pools first.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pools.map((pool) => (
          <div key={pool.id} className="panel p-5 space-y-4 hover:border-signal-green/20 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-heading font-semibold text-lg">{pool.service_name}</div>
                <div className="font-label text-[10px] text-muted-steel uppercase mt-0.5">
                  {pool.covered_component}
                </div>
              </div>
              <span
                className={`status-led ${
                  pool.status === "active" ? "status-led-green" : "status-led-red"
                }`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="label-text">Total Backing</div>
                <div className="metric-small text-signal-green">
                  {weiToGen(pool.total_backing_wei)} GEN
                </div>
              </div>
              <div>
                <div className="label-text">Available</div>
                <div className="metric-small text-panel-white">
                  {weiToGen(pool.available_wei)} GEN
                </div>
              </div>
              <div>
                <div className="label-text">Locked</div>
                <div className="metric-small text-incident-amber">
                  {weiToGen(pool.locked_wei)} GEN
                </div>
              </div>
              <div>
                <div className="label-text">Policies</div>
                <div className="metric-small">{pool.policy_count}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <Link
                href={`/coverage?pool=${pool.id}`}
                className="btn-primary text-xs py-1.5 px-3 flex-1 text-center"
              >
                Buy Cover
              </Link>
              <Link
                href={`/underwrite?pool=${pool.id}`}
                className="btn-secondary text-xs py-1.5 px-3 flex-1 text-center"
              >
                Underwrite
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

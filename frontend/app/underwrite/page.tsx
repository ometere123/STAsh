"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAllPools } from "@/hooks/usePool";
import { useWallet } from "@/providers/WalletProvider";
import { useTransactions } from "@/providers/TransactionProvider";
import { underwritePool, withdrawAvailable, getUnderwriterPosition } from "@/lib/contract";
import { genToWei, weiToGen } from "@/lib/format";
import { TxHashCard } from "@/components/shared/TxHashCard";
import type { UnderwriterPosition } from "@/lib/types";
import { useEffect, useCallback } from "react";

export default function UnderwritePage() {
  return (
    <Suspense fallback={<div className="text-muted-steel font-mono text-sm">Loading...</div>}>
      <UnderwriteContent />
    </Suspense>
  );
}

function UnderwriteContent() {
  const searchParams = useSearchParams();
  const defaultPool = searchParams?.get("pool") || "";
  const { pools, refresh: refreshPools } = useAllPools();
  const { address, isCorrectChain } = useWallet();
  const { addTx, updateTx } = useTransactions();

  const [poolId, setPoolId] = useState(defaultPool);
  const [depositGen, setDepositGen] = useState("1");
  const [withdrawGen, setWithdrawGen] = useState("0.5");
  const [position, setPosition] = useState<UnderwriterPosition | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPosition = useCallback(async () => {
    if (!poolId || !address) return;
    try {
      const pos = await getUnderwriterPosition(parseInt(poolId), address);
      setPosition(pos);
    } catch {
      setPosition(null);
    }
  }, [poolId, address]);

  useEffect(() => {
    loadPosition();
  }, [loadPosition]);

  async function handleDeposit() {
    if (!address || !isCorrectChain || !poolId) return;
    setSubmitting(true);
    setError(null);
    try {
      const hash = await underwritePool(address, parseInt(poolId), genToWei(parseFloat(depositGen)));
      addTx(hash, "Underwrite Pool");
      updateTx(hash, "confirmed");
      setLastTxHash(hash);
      await refreshPools();
      await loadPosition();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWithdraw() {
    if (!address || !isCorrectChain || !poolId) return;
    setSubmitting(true);
    setError(null);
    try {
      const hash = await withdrawAvailable(address, parseInt(poolId), genToWei(parseFloat(withdrawGen)));
      addTx(hash, "Withdraw");
      updateTx(hash, "confirmed");
      setLastTxHash(hash);
      await refreshPools();
      await loadPosition();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedPool = pools.find((p) => String(p.id) === poolId);

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-bold">Underwriter Desk</h2>
        <p className="text-sm text-muted-steel mt-1">Deposit or withdraw GEN from service pools</p>
      </div>

      <div className="panel p-6 space-y-4">
        <div>
          <label className="label-text">Service Pool</label>
          <select value={poolId} onChange={(e) => setPoolId(e.target.value)} className="input-field mt-1">
            <option value="">Select a pool</option>
            {pools.map((p) => (
              <option key={p.id} value={p.id}>{p.service_name}</option>
            ))}
          </select>
        </div>

        {selectedPool && (
          <div className="grid grid-cols-3 gap-3 p-3 panel-dark">
            <div>
              <div className="label-text">Total Backing</div>
              <div className="metric-small text-signal-green">{weiToGen(selectedPool.total_backing_wei)}</div>
            </div>
            <div>
              <div className="label-text">Available</div>
              <div className="metric-small">{weiToGen(selectedPool.available_wei)}</div>
            </div>
            <div>
              <div className="label-text">Locked</div>
              <div className="metric-small text-incident-amber">{weiToGen(selectedPool.locked_wei)}</div>
            </div>
          </div>
        )}

        {position && (
          <div className="p-3 panel-dark">
            <div className="label-text mb-2">Your Position</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-muted-steel">Deposited</div>
                <div className="metric-small">{weiToGen(position.deposited_wei)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-steel">Withdrawn</div>
                <div className="metric-small">{weiToGen(position.withdrawn_wei)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-steel">Net</div>
                <div className="metric-small text-signal-green">{weiToGen(position.net_wei)}</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="label-text">Deposit (GEN)</label>
            <input type="number" step="0.01" value={depositGen} onChange={(e) => setDepositGen(e.target.value)} className="input-field" />
            <button onClick={handleDeposit} disabled={submitting || !address} className="btn-primary w-full text-sm py-2">
              Deposit
            </button>
          </div>
          <div className="space-y-2">
            <label className="label-text">Withdraw (GEN)</label>
            <input type="number" step="0.01" value={withdrawGen} onChange={(e) => setWithdrawGen(e.target.value)} className="input-field" />
            <button onClick={handleWithdraw} disabled={submitting || !address} className="btn-secondary w-full text-sm py-2">
              Withdraw
            </button>
          </div>
        </div>

        {error && <div className="text-failure-red text-sm">{error}</div>}
      </div>

      {lastTxHash && <TxHashCard hash={lastTxHash} action="Underwrite" />}
    </div>
  );
}

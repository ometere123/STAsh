"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAllPools } from "@/hooks/usePool";
import { useWallet } from "@/providers/WalletProvider";
import { useTransactions } from "@/providers/TransactionProvider";
import { buyPolicy, getPremiumQuote } from "@/lib/contract";
import { genToWei, weiToGen } from "@/lib/format";
import { QUALIFYING_TIERS, WEI_PER_GEN } from "@/lib/constants";
import { TxHashCard } from "@/components/shared/TxHashCard";

export default function CoveragePage() {
  return (
    <Suspense fallback={<div className="text-muted-steel font-mono text-sm">Loading...</div>}>
      <CoverageContent />
    </Suspense>
  );
}

function CoverageContent() {
  const searchParams = useSearchParams();
  const defaultPool = searchParams?.get("pool") || "";
  const { pools } = useAllPools();
  const { address, isCorrectChain } = useWallet();
  const { addTx, updateTx } = useTransactions();

  const [poolId, setPoolId] = useState(defaultPool);
  const [coverageGen, setCoverageGen] = useState("0.5");
  const [durationDays, setDurationDays] = useState("30");
  const [minMinutes, setMinMinutes] = useState("60");
  const [qualifyingTier, setQualifyingTier] = useState("qualifying_outage");
  const [premiumQuote, setPremiumQuote] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = address && isCorrectChain && poolId && !submitting;

  async function fetchQuote() {
    try {
      const coverageWei = genToWei(parseFloat(coverageGen));
      const quote = await getPremiumQuote(coverageWei, parseInt(durationDays));
      setPremiumQuote(quote);
    } catch (e: any) {
      setPremiumQuote(null);
    }
  }

  async function handleBuy() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const coverageWei = genToWei(parseFloat(coverageGen));
      let premiumWei: bigint;
      if (premiumQuote) {
        premiumWei = BigInt(premiumQuote);
      } else {
        premiumWei = coverageWei * BigInt(parseInt(durationDays)) * BigInt(500) / BigInt(10000) / BigInt(30);
        if (premiumWei < BigInt(10000000000000000)) premiumWei = BigInt(10000000000000000);
      }
      const hash = await buyPolicy(
        parseInt(poolId),
        coverageWei,
        parseInt(durationDays),
        parseInt(minMinutes),
        qualifyingTier,
        premiumWei
      );
      addTx(hash, "Buy Policy");
      updateTx(hash, "confirmed");
      setLastTxHash(hash);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-bold">Coverage Builder</h2>
        <p className="text-sm text-muted-steel mt-1">Buy fixed payout cover for a service pool</p>
      </div>

      <div className="panel p-6 space-y-4">
        <div>
          <label className="label-text">Service Pool</label>
          <select
            value={poolId}
            onChange={(e) => setPoolId(e.target.value)}
            className="input-field mt-1"
          >
            <option value="">Select a pool</option>
            {pools.map((p) => (
              <option key={p.id} value={p.id}>
                {p.service_name} — {weiToGen(p.available_wei)} GEN available
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label-text">Coverage Amount (GEN)</label>
          <input
            type="number"
            step="0.01"
            value={coverageGen}
            onChange={(e) => setCoverageGen(e.target.value)}
            className="input-field mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-text">Duration (days)</label>
            <input
              type="number"
              min="1"
              max="90"
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              className="input-field mt-1"
            />
          </div>
          <div>
            <label className="label-text">Min Incident (min)</label>
            <input
              type="number"
              min="1"
              value={minMinutes}
              onChange={(e) => setMinMinutes(e.target.value)}
              className="input-field mt-1"
            />
          </div>
        </div>

        <div>
          <label className="label-text">Qualifying Severity</label>
          <select
            value={qualifyingTier}
            onChange={(e) => setQualifyingTier(e.target.value)}
            className="input-field mt-1"
          >
            {QUALIFYING_TIERS.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button onClick={fetchQuote} className="btn-secondary text-xs py-1.5">
            Get Premium Quote
          </button>
          {premiumQuote && (
            <div className="text-right">
              <div className="label-text">Premium</div>
              <div className="metric-small text-signal-green">{weiToGen(premiumQuote)} GEN</div>
            </div>
          )}
        </div>

        {error && (
          <div className="text-failure-red text-sm">{error}</div>
        )}

        <button
          onClick={handleBuy}
          disabled={!canSubmit}
          className="btn-primary w-full py-3"
        >
          {submitting ? "Submitting..." : "Buy Cover"}
        </button>

        {!address && (
          <div className="text-xs text-muted-steel text-center">Connect wallet to buy cover</div>
        )}
      </div>

      {lastTxHash && <TxHashCard hash={lastTxHash} action="Buy Policy" />}
    </div>
  );
}

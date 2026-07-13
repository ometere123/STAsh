"use client";

import { useState } from "react";
import { useWallet } from "@/providers/WalletProvider";
import { useTransactions } from "@/providers/TransactionProvider";
import { useHolderPolicies } from "@/hooks/usePolicy";
import { fileClaim, reviewClaim, settleClaim } from "@/lib/contract";
import { TxHashCard } from "@/components/shared/TxHashCard";
import { useHolderClaims } from "@/hooks/useClaim";
import { statusColor, formatTimestamp } from "@/lib/format";

export default function ClaimsPage() {
  const { address, isCorrectChain } = useWallet();
  const { addTx, updateTx } = useTransactions();
  const { policies, loading: policiesLoading, error: policiesError, refresh: refreshPolicies } = useHolderPolicies(address);
  const { claims, loading: claimsLoading, error: claimsError, refresh: refreshClaims } = useHolderClaims(address);

  const [policyId, setPolicyId] = useState("");
  const [incidentUrl, setIncidentUrl] = useState("");
  const [claimedStart, setClaimedStart] = useState("");
  const [claimedEnd, setClaimedEnd] = useState("");
  const [affectedComponent, setAffectedComponent] = useState("");
  const [claimNote, setClaimNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activePolicies = policies.filter((p) => p.status === "active");

  async function handleFileClaim() {
    if (!address || !isCorrectChain || !policyId) return;
    setSubmitting(true);
    setError(null);
    try {
      const startTs = Math.floor(new Date(claimedStart).getTime() / 1000);
      const endTs = Math.floor(new Date(claimedEnd).getTime() / 1000);
      const hash = await fileClaim(address, parseInt(policyId), incidentUrl, startTs, endTs, affectedComponent, claimNote);
      addTx(hash, "File Claim");
      updateTx(hash, "confirmed");
      setLastTxHash(hash);
      await Promise.all([refreshClaims(), refreshPolicies()]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReview(claimId: number) {
    setSubmitting(true);
    setError(null);
    try {
      if (!address) return;
      const hash = await reviewClaim(address, claimId);
      addTx(hash, `Review Claim #${claimId}`);
      updateTx(hash, "confirmed");
      setLastTxHash(hash);
      await refreshClaims();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSettle(claimId: number) {
    setSubmitting(true);
    setError(null);
    try {
      if (!address) return;
      const hash = await settleClaim(address, claimId);
      addTx(hash, `Settle Claim #${claimId}`);
      updateTx(hash, "confirmed");
      setLastTxHash(hash);
      await refreshClaims();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-bold">Claim Command</h2>
        <p className="text-sm text-muted-steel mt-1">File claims with public incident evidence</p>
      </div>

      <div className="panel p-6 space-y-4">
        <div className="text-xs text-incident-amber diagonal-stripe p-2 rounded">
          The preview helps you prepare the claim. It does not decide payout. GenLayer validators re-fetch public evidence during review.
        </div>

        <div>
          <label className="label-text">Policy</label>
          <select value={policyId} onChange={(e) => setPolicyId(e.target.value)} className="input-field mt-1">
            <option value="">{policiesLoading ? "Loading policies..." : "Select active policy"}</option>
            {activePolicies.map((p) => (
              <option key={p.id} value={p.id}>Policy #{p.id} - Pool #{p.pool_id}</option>
            ))}
          </select>
          {policiesError && (
            <div className="mt-2 flex items-center gap-3 text-xs text-failure-red">
              <span>{policiesError}</span>
              <button onClick={refreshPolicies} className="underline">Retry</button>
            </div>
          )}
        </div>

        <div>
          <label className="label-text">Incident URL</label>
          <input type="url" value={incidentUrl} onChange={(e) => setIncidentUrl(e.target.value)} placeholder="https://www.githubstatus.com/incidents/..." className="input-field mt-1" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-text">Incident Start</label>
            <input type="datetime-local" value={claimedStart} onChange={(e) => setClaimedStart(e.target.value)} className="input-field mt-1" />
          </div>
          <div>
            <label className="label-text">Incident End</label>
            <input type="datetime-local" value={claimedEnd} onChange={(e) => setClaimedEnd(e.target.value)} className="input-field mt-1" />
          </div>
        </div>

        <div>
          <label className="label-text">Affected Component</label>
          <input type="text" value={affectedComponent} onChange={(e) => setAffectedComponent(e.target.value)} placeholder="workflow execution / CI availability" className="input-field mt-1" />
        </div>

        <div>
          <label className="label-text">Claim Note</label>
          <textarea value={claimNote} onChange={(e) => setClaimNote(e.target.value)} rows={3} placeholder="Short description of the impact..." className="input-field mt-1 resize-none" />
        </div>

        {error && <div className="text-failure-red text-sm">{error}</div>}

        <button onClick={handleFileClaim} disabled={submitting || !address || !policyId} className="btn-primary w-full py-3">
          {submitting ? "Submitting..." : "File Claim"}
        </button>
      </div>

      {lastTxHash && <TxHashCard hash={lastTxHash} action="Claim Action" />}

      {claimsLoading && <div className="text-xs font-mono text-muted-steel">Loading your claims...</div>}
      {claimsError && (
        <div className="panel p-4 border-failure-red/40 text-xs text-failure-red">
          {claimsError} <button onClick={refreshClaims} className="underline ml-2">Retry</button>
        </div>
      )}

      {claims.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-heading text-lg font-semibold">Your Claims</h3>
          {claims.map((c) => (
            <div key={c.id} className="panel p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">Claim #{c.id}</span>
                <span className={`font-label text-xs uppercase ${statusColor(c.status)}`}>{c.status}</span>
              </div>
              <div className="text-xs text-muted-steel truncate">{c.incident_url}</div>
              {c.verdict && (
                <div className="text-xs">
                  <span className="text-muted-steel">Verdict: </span>
                  <span className="text-consensus-violet">{c.verdict}</span>
                  <span className="text-muted-steel ml-3">Band: </span>
                  <span className="text-panel-white">{c.payout_band}</span>
                </div>
              )}
              {c.reason_summary && (
                <div className="text-xs text-muted-steel italic">{c.reason_summary}</div>
              )}
              <div className="flex gap-2 pt-1">
                {c.status === "filed" && (
                  <button onClick={() => handleReview(c.id)} disabled={submitting} className="btn-secondary text-xs py-1 px-3">
                    Review
                  </button>
                )}
                {(c.status === "approved" || c.status === "denied") && (
                  <button onClick={() => handleSettle(c.id)} disabled={submitting} className="btn-primary text-xs py-1 px-3">
                    Settle
                  </button>
                )}
                <a href={`/replay/${c.id}`} className="btn-secondary text-xs py-1 px-3">
                  Replay
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

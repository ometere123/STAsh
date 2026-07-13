"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@/providers/WalletProvider";
import { useTransactions } from "@/providers/TransactionProvider";
import { useAllPools } from "@/hooks/usePool";
import { createPool, getOwner, pausePool, unpausePool } from "@/lib/contract";
import { MVP_SERVICES } from "@/lib/constants";
import { TxHashCard } from "@/components/shared/TxHashCard";

export default function AdminPage() {
  const { address, isCorrectChain } = useWallet();
  const { pools, refresh } = useAllPools();
  const { addTx, updateTx } = useTransactions();
  const [contractOwner, setContractOwner] = useState<string | null>(null);
  const [ownerReadError, setOwnerReadError] = useState<string | null>(null);
  const isAdmin = Boolean(
    address && contractOwner && address.toLowerCase() === contractOwner.toLowerCase()
  );

  const [serviceSlug, setServiceSlug] = useState<string>(MVP_SERVICES[0].slug);
  const selectedService = useMemo(
    () => MVP_SERVICES.find((service) => service.slug === serviceSlug) || MVP_SERVICES[0],
    [serviceSlug]
  );
  const [serviceName, setServiceName] = useState<string>(selectedService.name);
  const [coveredComponent, setCoveredComponent] = useState<string>(selectedService.component);
  const [statusUrl, setStatusUrl] = useState<string>(selectedService.statusUrl);
  const [selectedPoolId, setSelectedPoolId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const existingPool = pools.find((pool) => pool.service_slug === serviceSlug);
  const selectedPool = pools.find((pool) => String(pool.id) === selectedPoolId);
  const canCreate =
    isAdmin &&
    isCorrectChain &&
    serviceName.trim() &&
    coveredComponent.trim() &&
    statusUrl.trim() &&
    !existingPool &&
    !submitting;

  useEffect(() => {
    setServiceName(selectedService.name);
    setCoveredComponent(selectedService.component);
    setStatusUrl(selectedService.statusUrl);
  }, [selectedService]);

  useEffect(() => {
    let cancelled = false;
    getOwner()
      .then((owner) => {
        if (!cancelled) {
          setContractOwner(owner);
          setOwnerReadError(null);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setOwnerReadError(e.message || "Unable to read contract owner");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreatePool() {
    if (!canCreate || !address) return;
    setSubmitting(true);
    setError(null);
    try {
      const hash = await createPool(
        address,
        serviceSlug,
        serviceName.trim(),
        coveredComponent.trim(),
        statusUrl.trim()
      );
      addTx(hash, "Create Pool");
      updateTx(hash, "confirmed");
      setLastTxHash(hash);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePoolStatus(nextStatus: "pause" | "unpause") {
    if (!isAdmin || !isCorrectChain || !selectedPoolId || !address) return;
    setSubmitting(true);
    setError(null);
    try {
      const hash =
        nextStatus === "pause"
          ? await pausePool(address, parseInt(selectedPoolId))
          : await unpausePool(address, parseInt(selectedPoolId));
      addTx(hash, nextStatus === "pause" ? "Pause Pool" : "Unpause Pool");
      updateTx(hash, "confirmed");
      setLastTxHash(hash);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (ownerReadError) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="font-heading text-2xl font-bold">Admin</h2>
          <p className="text-sm text-muted-steel mt-1">Unable to verify contract ownership</p>
        </div>
        <div className="panel p-6 space-y-3">
          <div className="font-heading text-lg">Owner read failed</div>
          <p className="text-sm text-muted-steel">
            Admin writes are disabled because the deployed contract owner could not be verified on-chain.
          </p>
          <div className="text-xs font-mono text-failure-red break-all">{ownerReadError}</div>
        </div>
      </div>
    );
  }

  if (!contractOwner) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="panel p-6 text-sm text-muted-steel">Verifying contract owner on-chain...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="font-heading text-2xl font-bold">Admin</h2>
          <p className="text-sm text-muted-steel mt-1">Restricted pool management</p>
        </div>
        <div className="panel p-6 space-y-3">
          <div className="font-heading text-lg">Admin wallet required</div>
          <p className="text-sm text-muted-steel">
            Connect the contract owner wallet to create, pause, or unpause pools.
          </p>
          {address && (
            <div className="text-xs font-mono text-muted-steel break-all">
              Connected wallet: {address}
            </div>
          )}
          <div className="text-xs font-mono text-muted-steel break-all">
            On-chain owner: {contractOwner}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-bold">Admin</h2>
        <p className="text-sm text-muted-steel mt-1">Create and manage service pools</p>
        <p className="text-xs font-mono text-muted-steel mt-2 break-all">
          Verified owner: {contractOwner}
        </p>
      </div>

      <div className="panel p-6 space-y-5">
        <div>
          <h3 className="font-heading text-lg font-semibold">Create Pool</h3>
          <p className="text-sm text-muted-steel mt-1">
            Only the contract owner can create pools. The MVP contract accepts the listed services.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label-text">Service</label>
            <select
              value={serviceSlug}
              onChange={(e) => setServiceSlug(e.target.value)}
              className="input-field mt-1"
            >
              {MVP_SERVICES.map((service) => (
                <option key={service.slug} value={service.slug}>
                  {service.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-text">Service Name</label>
            <input
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              className="input-field mt-1"
            />
          </div>
          <div className="md:col-span-2">
            <label className="label-text">Covered Component</label>
            <input
              value={coveredComponent}
              onChange={(e) => setCoveredComponent(e.target.value)}
              className="input-field mt-1"
            />
          </div>
          <div className="md:col-span-2">
            <label className="label-text">Status URL</label>
            <input
              value={statusUrl}
              onChange={(e) => setStatusUrl(e.target.value)}
              className="input-field mt-1"
            />
          </div>
        </div>

        {existingPool && (
          <div className="panel-dark p-3 text-sm text-incident-amber">
            Pool #{existingPool.id} already exists for this service.
          </div>
        )}

        <button
          onClick={handleCreatePool}
          disabled={!canCreate}
          className="btn-primary text-sm py-2"
        >
          {submitting ? "Submitting..." : "Create Pool"}
        </button>
      </div>

      <div className="panel p-6 space-y-5">
        <div>
          <h3 className="font-heading text-lg font-semibold">Pool Status</h3>
          <p className="text-sm text-muted-steel mt-1">
            Pause a pool to stop new underwriting and policy purchases.
          </p>
        </div>

        <div>
          <label className="label-text">Pool</label>
          <select
            value={selectedPoolId}
            onChange={(e) => setSelectedPoolId(e.target.value)}
            className="input-field mt-1"
          >
            <option value="">Select a pool</option>
            {pools.map((pool) => (
              <option key={pool.id} value={pool.id}>
                #{pool.id} {pool.service_name} ({pool.status})
              </option>
            ))}
          </select>
        </div>

        {selectedPool && (
          <div className="grid grid-cols-3 gap-3 p-3 panel-dark">
            <div>
              <div className="label-text">Status</div>
              <div className="metric-small">{selectedPool.status}</div>
            </div>
            <div>
              <div className="label-text">Policies</div>
              <div className="metric-small">{selectedPool.policy_count}</div>
            </div>
            <div>
              <div className="label-text">Claims</div>
              <div className="metric-small">{selectedPool.claim_count}</div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => handlePoolStatus("pause")}
            disabled={!selectedPool || selectedPool.status === "paused" || submitting}
            className="btn-danger text-sm py-2"
          >
            Pause Pool
          </button>
          <button
            onClick={() => handlePoolStatus("unpause")}
            disabled={!selectedPool || selectedPool.status === "active" || submitting}
            className="btn-secondary text-sm py-2"
          >
            Unpause Pool
          </button>
        </div>
      </div>

      {error && <div className="text-failure-red text-sm">{error}</div>}
      {lastTxHash && <TxHashCard hash={lastTxHash} action="Admin" />}
    </div>
  );
}

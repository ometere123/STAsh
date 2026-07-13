"use client";

import { useState, useEffect, useCallback } from "react";
import { getPolicy, getPolicyIdsForHolder } from "@/lib/contract";
import type { Policy } from "@/lib/types";

export function usePolicy(policyId: number | null) {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (policyId === null) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getPolicy(policyId);
      setPolicy(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [policyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { policy, loading, error, refresh };
}

export function useHolderPolicies(holder: string | null) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!holder) {
      setPolicies([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ids = await getPolicyIdsForHolder(holder);
      const results = await Promise.all(ids.map((id) => getPolicy(id)));
      setPolicies(results);
    } catch (e: any) {
      setPolicies([]);
      setError(e.message || "Unable to load policies");
    } finally {
      setLoading(false);
    }
  }, [holder]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handleFocus = () => refresh();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refresh]);

  return { policies, loading, error, refresh };
}

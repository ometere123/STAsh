"use client";

import { useState, useEffect, useCallback } from "react";
import { getClaim, getClaimIdsForHolder } from "@/lib/contract";
import type { Claim } from "@/lib/types";

export function useClaim(claimId: number | null) {
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (claimId === null) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getClaim(claimId);
      setClaim(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { claim, loading, error, refresh };
}

export function useHolderClaims(holder: string | null) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!holder) return;
    setLoading(true);
    try {
      const ids = await getClaimIdsForHolder(holder);
      const results = await Promise.all(ids.map((id) => getClaim(id)));
      setClaims(results);
    } catch {
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }, [holder]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { claims, loading, refresh };
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { getPool, getPoolIds } from "@/lib/contract";
import type { Pool } from "@/lib/types";

export function usePool(poolId: number | null) {
  const [pool, setPool] = useState<Pool | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (poolId === null) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getPool(poolId);
      setPool(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [poolId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { pool, loading, error, refresh };
}

export function useAllPools() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ids = await getPoolIds();
      const results = await Promise.all(ids.map((id) => getPool(id)));
      setPools(results);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { pools, loading, error, refresh };
}

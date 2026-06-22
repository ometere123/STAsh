"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { TxRecord } from "@/lib/types";

interface TxState {
  transactions: TxRecord[];
  addTx: (hash: string, action: string, relatedId?: number) => void;
  updateTx: (hash: string, status: TxRecord["status"]) => void;
}

const TxContext = createContext<TxState>({
  transactions: [],
  addTx: () => {},
  updateTx: () => {},
});

export function useTransactions() {
  return useContext(TxContext);
}

export function TransactionProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<TxRecord[]>([]);

  const addTx = useCallback((hash: string, action: string, relatedId?: number) => {
    setTransactions((prev) => [
      { hash, action, status: "pending", timestamp: Date.now(), relatedId },
      ...prev,
    ]);
  }, []);

  const updateTx = useCallback((hash: string, status: TxRecord["status"]) => {
    setTransactions((prev) =>
      prev.map((tx) => (tx.hash === hash ? { ...tx, status } : tx))
    );
  }, []);

  return (
    <TxContext.Provider value={{ transactions, addTx, updateTx }}>
      {children}
    </TxContext.Provider>
  );
}

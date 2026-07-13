"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { connectWallet, getChainId, switchToStudioNet } from "@/lib/chain";
import { CHAIN_ID } from "@/lib/constants";
import { resetWriteClient } from "@/lib/contract";

const WALLET_CONNECTED_KEY = "slash.wallet.connected";

interface WalletState {
  address: string | null;
  chainId: number | null;
  isConnecting: boolean;
  isCorrectChain: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchChain: () => Promise<void>;
}

const WalletContext = createContext<WalletState>({
  address: null,
  chainId: null,
  isConnecting: false,
  isCorrectChain: false,
  connect: async () => {},
  disconnect: () => {},
  switchChain: async () => {},
});

export function useWallet() {
  return useContext(WalletContext);
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const isCorrectChain = chainId === CHAIN_ID;

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const addr = await connectWallet();
      const cid = await getChainId();
      setAddress(addr);
      setChainId(cid);
      window.localStorage.setItem(WALLET_CONNECTED_KEY, "true");
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    resetWriteClient();
    setAddress(null);
    setChainId(null);
    window.localStorage.removeItem(WALLET_CONNECTED_KEY);
  }, []);

  const switchChain = useCallback(async () => {
    await switchToStudioNet();
    const cid = await getChainId();
    setChainId(cid);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      resetWriteClient();
      const nextAddress = accounts[0] || null;
      setAddress(nextAddress);
      if (nextAddress) {
        window.localStorage.setItem(WALLET_CONNECTED_KEY, "true");
      } else {
        window.localStorage.removeItem(WALLET_CONNECTED_KEY);
      }
    };
    const handleChainChanged = (cid: string) => {
      setChainId(parseInt(cid, 16));
    };

    const restoreConnection = async () => {
      if (window.localStorage.getItem(WALLET_CONNECTED_KEY) !== "true") return;

      try {
        const accounts: string[] = await window.ethereum.request({ method: "eth_accounts" });
        const nextAddress = accounts[0] || null;
        if (!nextAddress) {
          window.localStorage.removeItem(WALLET_CONNECTED_KEY);
          return;
        }

        setAddress(nextAddress);
        setChainId(await getChainId());
      } catch {
        window.localStorage.removeItem(WALLET_CONNECTED_KEY);
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    restoreConnection();

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  return (
    <WalletContext.Provider
      value={{ address, chainId, isConnecting, isCorrectChain, connect, disconnect, switchChain }}
    >
      {children}
    </WalletContext.Provider>
  );
}

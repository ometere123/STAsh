"use client";

import { useWallet } from "@/providers/WalletProvider";
import { shortAddress, addressUrl } from "@/lib/format";
import { CONTRACT_ADDRESS, EXPLORER_URL } from "@/lib/constants";

export function TopBar() {
  const { address, isCorrectChain, isConnecting, connect, disconnect, switchChain } = useWallet();

  return (
    <header className="h-14 bg-rack-grey border-b border-panel-graphite flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h1 className="font-heading font-bold text-lg text-panel-white tracking-tight">
          SL<span className="text-signal-green">/</span>sh
        </h1>
        {CONTRACT_ADDRESS && (
          <a
            href={addressUrl(CONTRACT_ADDRESS)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-muted-steel hover:text-protocol-blue transition-colors"
          >
            {shortAddress(CONTRACT_ADDRESS)}
          </a>
        )}
      </div>
      <div className="flex items-center gap-3">
        {address && !isCorrectChain && (
          <button onClick={switchChain} className="btn-danger text-xs py-1 px-3">
            Wrong Network
          </button>
        )}
        {address ? (
          <>
            <span className="flex items-center gap-2 border border-panel-graphite rounded px-3 py-1.5">
              <span className="status-led-green" />
              <span className="font-mono text-xs text-panel-white">
                {shortAddress(address)}
              </span>
            </span>
            <button
              onClick={disconnect}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={connect}
            disabled={isConnecting}
            className="btn-primary text-xs py-1.5"
          >
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </div>
    </header>
  );
}

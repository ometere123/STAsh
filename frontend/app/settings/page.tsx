"use client";

import { useWallet } from "@/providers/WalletProvider";
import { CONTRACT_ADDRESS, RPC_URL, CHAIN_ID, EXPLORER_URL, WORKER_URL } from "@/lib/constants";
import { ContractLink } from "@/components/shared/ContractLink";

export default function SettingsPage() {
  const { address, chainId, isCorrectChain } = useWallet();

  const rows = [
    { label: "Network", value: `GenLayer StudioNet (${CHAIN_ID})` },
    { label: "RPC", value: RPC_URL },
    { label: "Explorer", value: EXPLORER_URL, link: true },
    { label: "Contract", value: CONTRACT_ADDRESS || "Not configured" },
    { label: "Worker", value: WORKER_URL || "Not configured" },
    { label: "Wallet", value: address || "Not connected" },
    { label: "Chain ID", value: chainId ? String(chainId) : "-" },
    { label: "Correct Chain", value: isCorrectChain ? "Yes" : "No" },
  ];

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-bold">Settings</h2>
        <p className="text-sm text-muted-steel mt-1">Protocol configuration and connection status</p>
      </div>

      <div className="panel p-6 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between items-center py-2 border-b border-panel-graphite last:border-0">
            <span className="label-text">{row.label}</span>
            {(row as any).link ? (
              <a href={row.value} target="_blank" rel="noopener noreferrer" className="text-xs text-protocol-blue hover:underline font-mono">
                {row.value}
              </a>
            ) : (
              <span className="text-xs text-panel-white font-mono truncate max-w-xs text-right">
                {row.value}
              </span>
            )}
          </div>
        ))}
      </div>

      {CONTRACT_ADDRESS && (
        <div className="panel p-4">
          <div className="label-text mb-2">Contract Address</div>
          <ContractLink address={CONTRACT_ADDRESS} label={CONTRACT_ADDRESS} />
        </div>
      )}
    </div>
  );
}

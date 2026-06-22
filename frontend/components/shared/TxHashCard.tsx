"use client";

import { txUrl, shortHash } from "@/lib/format";

interface Props {
  hash: string;
  action: string;
  status?: "pending" | "confirmed" | "failed";
}

export function TxHashCard({ hash, action, status = "confirmed" }: Props) {
  const colors = {
    pending: "border-incident-amber/40 bg-incident-amber/5",
    confirmed: "border-signal-green/40 bg-signal-green/5",
    failed: "border-failure-red/40 bg-failure-red/5",
  };

  const statusDot = {
    pending: "status-led-amber",
    confirmed: "status-led-green",
    failed: "status-led-red",
  };

  return (
    <div className={`panel p-3 ${colors[status]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={statusDot[status]} />
          <span className="font-label text-xs text-muted-steel uppercase">{action}</span>
        </div>
        <a
          href={txUrl(hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-protocol-blue hover:underline"
        >
          {shortHash(hash)}
        </a>
      </div>
    </div>
  );
}

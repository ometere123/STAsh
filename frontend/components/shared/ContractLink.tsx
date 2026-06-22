"use client";

import { addressUrl, shortAddress } from "@/lib/format";

interface Props {
  address: string;
  label?: string;
}

export function ContractLink({ address, label }: Props) {
  return (
    <a
      href={addressUrl(address)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 font-mono text-xs text-protocol-blue hover:underline"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-protocol-blue" />
      {label || shortAddress(address)}
    </a>
  );
}

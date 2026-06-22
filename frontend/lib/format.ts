import { EXPLORER_URL, WEI_PER_GEN } from "./constants";

export function weiToGen(wei: string | bigint): string {
  const w = typeof wei === "string" ? BigInt(wei) : wei;
  const whole = w / WEI_PER_GEN;
  const frac = w % WEI_PER_GEN;
  const fracStr = frac.toString().padStart(18, "0").slice(0, 4);
  return `${whole}.${fracStr}`;
}

export function genToWei(gen: number): bigint {
  return BigInt(Math.floor(gen * 1e18));
}

export function txUrl(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export function addressUrl(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}

export function shortAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function shortHash(hash: string): string {
  if (!hash || hash.length < 12) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

export function formatTimestamp(ts: number): string {
  if (!ts) return "-";
  return new Date(ts * 1000).toLocaleString();
}

export function statusColor(status: string): string {
  switch (status) {
    case "active":
    case "approved":
    case "settled":
    case "paid":
      return "text-signal-green";
    case "filed":
    case "reviewing":
    case "claimed":
      return "text-incident-amber";
    case "denied":
    case "failed":
    case "paused":
      return "text-failure-red";
    default:
      return "text-muted-steel";
  }
}

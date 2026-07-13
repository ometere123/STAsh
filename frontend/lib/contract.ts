import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { CONTRACT_ADDRESS } from "./constants";
import type { Pool, Policy, Claim, ProtocolStats, UnderwriterPosition } from "./types";

// Reads never need a signer, so a single unauthenticated client is reused
// for every read call.
let readClientInstance: ReturnType<typeof createClient> | null = null;

// Writes must be signed by the same wallet the app connects and displays
// (see WalletProvider / useWallet), never by a throwaway key. The write
// client is rebuilt whenever the caller's connected address changes so a
// wallet switch can't silently sign with a stale account.
let writeClientInstance: ReturnType<typeof createClient> | null = null;
let writeClientAddress: string | null = null;

export function getReadClient() {
  if (!readClientInstance) {
    readClientInstance = createClient({ chain: studionet });
  }
  return readClientInstance;
}

function getWriteClient(account: string) {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No injected wallet found - connect a wallet before signing transactions");
  }
  const normalized = account.toLowerCase();
  if (!writeClientInstance || writeClientAddress !== normalized) {
    writeClientInstance = createClient({
      chain: studionet,
      account: account as `0x${string}`,
      provider: window.ethereum,
    });
    writeClientAddress = normalized;
  }
  return writeClientInstance;
}

async function assertActiveWalletAccount(account: string): Promise<void> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No injected wallet found - connect a wallet before signing transactions");
  }

  const accounts: string[] = await window.ethereum.request({ method: "eth_accounts" });
  const activeAccount = accounts[0];
  if (!activeAccount) {
    throw new Error("Wallet not connected - connect a wallet before signing transactions");
  }
  if (activeAccount.toLowerCase() !== account.toLowerCase()) {
    resetWriteClient();
    throw new Error("Wallet account changed - review the connected address and submit again");
  }
}

export function resetWriteClient() {
  writeClientInstance = null;
  writeClientAddress = null;
}

export function resetClient() {
  readClientInstance = null;
  resetWriteClient();
}

async function read(functionName: string, args: any[] = []): Promise<any> {
  const client = getReadClient();
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("RPC timeout")), 15000)
  );
  return Promise.race([
    client.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      functionName,
      args,
    }),
    timeout,
  ]);
}

async function write(
  account: string,
  functionName: string,
  args: any[] = [],
  value: bigint = BigInt(0)
): Promise<string> {
  if (!account) {
    throw new Error("Wallet not connected - connect a wallet before signing transactions");
  }
  await assertActiveWalletAccount(account);
  const client = getWriteClient(account);
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    functionName,
    args,
    value,
  });
  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
    retries: 60,
    interval: 3000,
  });
  // StudioNet currently leaves the SDK's normalized txExecutionResultName as
  // NOT_VOTED even after finality. The finalized raw leader receipt is the
  // authoritative execution result populated by this network.
  const finalized = (await client.getTransaction({ hash })) as any;
  const result = finalized?.consensus_data?.leader_receipt?.[0]?.execution_result;
  if (result !== "SUCCESS") {
    throw new Error(`GenLayer contract execution failed (${result}). Transaction: ${hash}`);
  }
  return hash;
}

// Pool methods
export async function createPool(
  account: string,
  slug: string,
  name: string,
  component: string,
  statusUrl: string
): Promise<string> {
  return write(account, "create_pool", [slug, name, component, statusUrl]);
}

export async function underwritePool(
  account: string,
  poolId: number,
  valueWei: bigint
): Promise<string> {
  return write(account, "underwrite_pool", [poolId], valueWei);
}

export async function withdrawAvailable(
  account: string,
  poolId: number,
  amountWei: bigint
): Promise<string> {
  return write(account, "withdraw_available", [poolId, amountWei]);
}

export async function pausePool(account: string, poolId: number): Promise<string> {
  return write(account, "pause_pool", [poolId]);
}

export async function unpausePool(account: string, poolId: number): Promise<string> {
  return write(account, "unpause_pool", [poolId]);
}

// Policy methods
export async function buyPolicy(
  account: string,
  poolId: number,
  coverageWei: bigint,
  durationDays: number,
  minMinutes: number,
  qualifyingTier: string,
  premiumWei: bigint
): Promise<string> {
  return write(
    account,
    "buy_policy",
    [poolId, coverageWei, durationDays, minMinutes, qualifyingTier],
    premiumWei
  );
}

// Claim methods
export async function fileClaim(
  account: string,
  policyId: number,
  incidentUrl: string,
  claimedStart: number,
  claimedEnd: number,
  affectedComponent: string,
  claimNote: string
): Promise<string> {
  return write(account, "file_claim", [
    policyId,
    incidentUrl,
    claimedStart,
    claimedEnd,
    affectedComponent,
    claimNote,
  ]);
}

export async function reviewClaim(account: string, claimId: number): Promise<string> {
  return write(account, "review_claim", [claimId]);
}

export async function settleClaim(account: string, claimId: number): Promise<string> {
  return write(account, "settle_claim", [claimId]);
}

// Read methods
export async function getPool(poolId: number): Promise<Pool> {
  return read("get_pool", [poolId]) as Promise<Pool>;
}

export async function getPolicy(policyId: number): Promise<Policy> {
  return read("get_policy", [policyId]) as Promise<Policy>;
}

export async function getClaim(claimId: number): Promise<Claim> {
  return read("get_claim", [claimId]) as Promise<Claim>;
}

export async function getProtocolStats(): Promise<ProtocolStats> {
  return read("get_protocol_stats") as Promise<ProtocolStats>;
}

export async function getOwner(): Promise<string> {
  return read("get_owner") as Promise<string>;
}

export async function getPoolIds(): Promise<number[]> {
  return read("get_pool_ids") as Promise<number[]>;
}

export async function getPolicyIdsForHolder(holder: string): Promise<number[]> {
  return read("get_policy_ids_for_holder", [holder]) as Promise<number[]>;
}

export async function getClaimIdsForHolder(holder: string): Promise<number[]> {
  return read("get_claim_ids_for_holder", [holder]) as Promise<number[]>;
}

export async function getUnderwriterPosition(
  poolId: number,
  underwriter: string
): Promise<UnderwriterPosition> {
  return read("get_underwriter_position", [poolId, underwriter]) as Promise<UnderwriterPosition>;
}

export async function getPremiumQuote(
  coverageWei: bigint,
  durationDays: number
): Promise<string> {
  return read("get_premium_quote", [coverageWei, durationDays]) as Promise<string>;
}

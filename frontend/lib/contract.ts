import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { CONTRACT_ADDRESS } from "./constants";
import type { Pool, Policy, Claim, ProtocolStats, UnderwriterPosition } from "./types";

let clientInstance: ReturnType<typeof createClient> | null = null;
let initialized = false;

export function getClient() {
  if (!clientInstance) {
    const account = createAccount();
    clientInstance = createClient({
      chain: studionet,
      account,
    });
  }
  return clientInstance;
}

async function ensureInit() {
  if (!initialized) {
    const client = getClient();
    await client.initializeConsensusSmartContract();
    initialized = true;
  }
}

export function resetClient() {
  clientInstance = null;
  initialized = false;
}

async function read(functionName: string, args: any[] = []): Promise<any> {
  await ensureInit();
  const client = getClient();
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
  functionName: string,
  args: any[] = [],
  value: bigint = BigInt(0)
): Promise<string> {
  await ensureInit();
  const client = getClient();
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    functionName,
    args,
    value,
  });
  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    retries: 60,
    interval: 3000,
  });
  return hash;
}

// Pool methods
export async function createPool(
  slug: string,
  name: string,
  component: string,
  statusUrl: string
): Promise<string> {
  return write("create_pool", [slug, name, component, statusUrl]);
}

export async function underwritePool(poolId: number, valueWei: bigint): Promise<string> {
  return write("underwrite_pool", [poolId], valueWei);
}

export async function withdrawAvailable(poolId: number, amountWei: bigint): Promise<string> {
  return write("withdraw_available", [poolId, amountWei]);
}

export async function pausePool(poolId: number): Promise<string> {
  return write("pause_pool", [poolId]);
}

export async function unpausePool(poolId: number): Promise<string> {
  return write("unpause_pool", [poolId]);
}

// Policy methods
export async function buyPolicy(
  poolId: number,
  coverageWei: bigint,
  durationDays: number,
  minMinutes: number,
  qualifyingTier: string,
  premiumWei: bigint
): Promise<string> {
  return write(
    "buy_policy",
    [poolId, coverageWei, durationDays, minMinutes, qualifyingTier],
    premiumWei
  );
}

// Claim methods
export async function fileClaim(
  policyId: number,
  incidentUrl: string,
  claimedStart: number,
  claimedEnd: number,
  affectedComponent: string,
  claimNote: string
): Promise<string> {
  return write("file_claim", [
    policyId,
    incidentUrl,
    claimedStart,
    claimedEnd,
    affectedComponent,
    claimNote,
  ]);
}

export async function reviewClaim(claimId: number): Promise<string> {
  return write("review_claim", [claimId]);
}

export async function settleClaim(claimId: number): Promise<string> {
  return write("settle_claim", [claimId]);
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

/**
 * SLAsh: Seed Pools + Underwrite + Full Smoke Test
 *
 * Usage:
 *   set PRIVATE_KEY=0xYourPrivateKeyHere
 *   node scripts/seed_and_test.mjs
 *
 * This script will:
 *   1. Create 5 service pools
 *   2. Underwrite pool #1 with 2 GEN
 *   3. Buy a policy from pool #1 (0.5 GEN coverage)
 *   4. File a claim against that policy
 *   5. Review the claim (triggers GenLayer consensus)
 *   6. Settle the claim
 *   7. Print all tx hashes and final state
 */

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const CONTRACT = "0x6D5108C7643Dd4eFc5b769c59B5Ae3A6aE64c1DF";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error("ERROR: Set PRIVATE_KEY env var first.");
  console.error("  PowerShell: $env:PRIVATE_KEY = '0x...'");
  console.error("  Bash:       export PRIVATE_KEY=0x...");
  process.exit(1);
}

const client = createClient({
  chain: studionet,
  account: { address: null, privateKey: PRIVATE_KEY },
});

const txHashes = [];

async function waitTx(hash, label) {
  console.log(`  ⏳ ${label} - waiting for tx ${hash.slice(0, 16)}...`);
  try {
    const receipt = await client.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.ACCEPTED,
      retries: 80,
      interval: 3000,
    });
    console.log(`  ✅ ${label} - confirmed`);
    txHashes.push({ label, hash });
    return receipt;
  } catch (e) {
    console.log(`  ⚠️  ${label} - may still be pending: ${e.message}`);
    txHashes.push({ label, hash, note: "pending/timeout" });
    return null;
  }
}

async function read(fn, args = []) {
  return client.readContract({
    address: CONTRACT,
    functionName: fn,
    args,
  });
}

async function write(fn, args = [], value = BigInt(0)) {
  const hash = await client.writeContract({
    address: CONTRACT,
    functionName: fn,
    args,
    value,
  });
  return hash;
}

const POOLS = [
  { slug: "github_actions", name: "GitHub Actions", component: "workflow execution / CI availability", url: "https://www.githubstatus.com/" },
  { slug: "vercel_deployments", name: "Vercel Deployments", component: "deploy/build pipeline", url: "https://www.vercel-status.com/" },
  { slug: "cloudflare_edge", name: "Cloudflare Edge", component: "edge delivery / CDN availability", url: "https://www.cloudflarestatus.com/" },
  { slug: "stripe_checkout", name: "Stripe Checkout", component: "checkout/payment acceptance", url: "https://status.stripe.com/" },
  { slug: "supabase_auth", name: "Supabase Auth", component: "authentication availability", url: "https://status.supabase.com/" },
];

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  SLAsh: Seed + Underwrite + Smoke Test");
  console.log("  Contract:", CONTRACT);
  console.log("═══════════════════════════════════════════\n");

  // Init
  try {
    await client.initializeConsensusSmartContract();
  } catch {}

  // Check existing pools
  const existingIds = await read("get_pool_ids");
  console.log(`Existing pools: [${existingIds}]\n`);

  // ── Step 1: Create Pools ──────────────────────────────
  if (existingIds.length >= 5) {
    console.log("✅ 5 pools already exist, skipping creation.\n");
  } else {
    console.log("── Creating 5 service pools ──\n");
    for (const pool of POOLS) {
      try {
        console.log(`  Creating: ${pool.name}`);
        const hash = await write("create_pool", [pool.slug, pool.name, pool.component, pool.url]);
        await waitTx(hash, `Create ${pool.name}`);
      } catch (e) {
        console.log(`  ⚠️  ${pool.name}: ${e.message}`);
      }
    }

    const poolIds = await read("get_pool_ids");
    console.log(`\nPools after seeding: [${poolIds}]\n`);
  }

  // ── Step 2: Underwrite Pool #1 ────────────────────────
  console.log("── Underwriting pool #1 with 2 GEN ──\n");
  try {
    const TWO_GEN = BigInt(2) * BigInt(10 ** 18);
    const hash = await write("underwrite_pool", [1], TWO_GEN);
    await waitTx(hash, "Underwrite Pool #1 (2 GEN)");
  } catch (e) {
    console.log(`  ⚠️  Underwrite: ${e.message}`);
  }

  // Check pool state
  const pool1 = await read("get_pool", [1]);
  console.log(`\nPool #1 state:`);
  console.log(`  Service: ${pool1.service_name}`);
  console.log(`  Total Backing: ${pool1.total_backing_wei} wei`);
  console.log(`  Available: ${pool1.available_wei} wei`);
  console.log(`  Locked: ${pool1.locked_wei} wei\n`);

  // ── Step 3: Buy Policy ────────────────────────────────
  console.log("── Buying policy from pool #1 ──\n");
  let policyId;
  try {
    const COVERAGE = BigInt(5) * BigInt(10 ** 17); // 0.5 GEN
    const PREMIUM = BigInt(10 ** 17); // 0.1 GEN
    const hash = await write(
      "buy_policy",
      [1, COVERAGE, 30, 60, "qualifying_outage"],
      PREMIUM
    );
    const receipt = await waitTx(hash, "Buy Policy (0.5 GEN coverage, 30 days)");

    // Get policy id
    const holderAddr = (await client.getAddress?.()) || "unknown";
    const stats = await read("get_protocol_stats");
    policyId = stats.policy_count;
    console.log(`  Policy ID: ${policyId}\n`);
  } catch (e) {
    console.log(`  ⚠️  Buy Policy: ${e.message}\n`);
  }

  if (!policyId) {
    console.log("Cannot continue without a policy. Printing results.\n");
    printResults();
    return;
  }

  // ── Step 4: File Claim ────────────────────────────────
  console.log("── Filing claim against policy ──\n");
  console.log("  ℹ️  NOTE: Claim will likely be denied because the 24h waiting period");
  console.log("  hasn't passed. This is expected, it proves the full on-chain flow.\n");

  let claimId;
  try {
    const now = Math.floor(Date.now() / 1000);
    const hash = await write("file_claim", [
      policyId,
      "https://www.githubstatus.com/incidents/jr51g3t3qkpd",
      now - 7200, // 2 hours ago
      now - 3600, // 1 hour ago
      "workflow execution / CI availability",
      "GitHub Actions workflows were unavailable during this window",
    ]);
    const receipt = await waitTx(hash, "File Claim");

    const stats = await read("get_protocol_stats");
    claimId = stats.claim_count;
    console.log(`  Claim ID: ${claimId}\n`);
  } catch (e) {
    console.log(`  ⚠️  File Claim: ${e.message}`);
    console.log("  This is expected if the waiting period hasn't passed.\n");
  }

  if (!claimId) {
    console.log("Claim filing failed (likely waiting period). Printing results.\n");
    printResults();
    return;
  }

  // ── Step 5: Review Claim ──────────────────────────────
  console.log("── Reviewing claim (GenLayer consensus) ──\n");
  console.log("  This may take 30-120 seconds for validator consensus...\n");
  try {
    const hash = await write("review_claim", [claimId]);
    await waitTx(hash, "Review Claim (validator consensus)");
  } catch (e) {
    console.log(`  ⚠️  Review: ${e.message}\n`);
  }

  // Check verdict
  try {
    const claim = await read("get_claim", [claimId]);
    console.log(`  Verdict: ${claim.verdict}`);
    console.log(`  Payout Band: ${claim.payout_band}`);
    console.log(`  Reason: ${claim.reason_summary}`);
    console.log(`  Status: ${claim.status}\n`);
  } catch {}

  // ── Step 6: Settle Claim ──────────────────────────────
  console.log("── Settling claim ──\n");
  try {
    const hash = await write("settle_claim", [claimId]);
    await waitTx(hash, "Settle Claim");
  } catch (e) {
    console.log(`  ⚠️  Settle: ${e.message}\n`);
  }

  // ── Final State ───────────────────────────────────────
  console.log("── Final State ──\n");
  try {
    const finalClaim = await read("get_claim", [claimId]);
    console.log(`  Claim #${claimId}:`);
    console.log(`    Status: ${finalClaim.status}`);
    console.log(`    Verdict: ${finalClaim.verdict}`);
    console.log(`    Payout Band: ${finalClaim.payout_band}`);
    console.log(`    Payout: ${finalClaim.payout_wei} wei`);
    console.log(`    Reason: ${finalClaim.reason_summary}`);
  } catch {}

  try {
    const finalPool = await read("get_pool", [1]);
    console.log(`\n  Pool #1:`);
    console.log(`    Total Backing: ${finalPool.total_backing_wei} wei`);
    console.log(`    Available: ${finalPool.available_wei} wei`);
    console.log(`    Locked: ${finalPool.locked_wei} wei`);
    console.log(`    Paid: ${finalPool.paid_count}`);
    console.log(`    Denied: ${finalPool.denied_count}`);
  } catch {}

  try {
    const stats = await read("get_protocol_stats");
    console.log(`\n  Protocol Stats:`);
    console.log(`    Pools: ${stats.pool_count}`);
    console.log(`    Policies: ${stats.policy_count}`);
    console.log(`    Claims: ${stats.claim_count}`);
  } catch {}

  printResults();
}

function printResults() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  Transaction Hashes");
  console.log("═══════════════════════════════════════════\n");
  for (const tx of txHashes) {
    const note = tx.note ? ` (${tx.note})` : "";
    console.log(`  ${tx.label}${note}`);
    console.log(`    ${tx.hash}`);
    console.log(`    https://explorer-studio.genlayer.com/tx/${tx.hash}`);
    console.log();
  }
}

main().catch((e) => {
  console.error("Fatal error:", e);
  printResults();
  process.exit(1);
});

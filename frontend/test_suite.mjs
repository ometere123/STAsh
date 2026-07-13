/**
 * SLAsh multi-wallet test suite.
 *
 * Drives the contract with three distinct funded burner wallets
 * (underwriter / holder / claimant) plus authorization negatives, so each
 * on-chain action is signed by the identity that role actually represents.
 *
 * Reads burner private keys from test-wallets.local.json (gitignored).
 * Never prints private keys. Usage: node test_suite.mjs
 */

import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { readFileSync } from "node:fs";

const CONTRACT = "0x72A76300b890D5D0b69E59d417a5Ff66cc0021cc";
const TEST_POOL_ID = 2; // Vercel Deployments - kept separate from the seed script's pool #1

const wallets = JSON.parse(readFileSync("test-wallets.local.json", "utf8"));

function clientFor(role) {
  const account = createAccount(wallets[role].privateKey);
  return { client: createClient({ chain: studionet, account }), address: account.address };
}

const underwriter = clientFor("underwriter");
const holder = clientFor("holder");
const claimant = clientFor("claimant");

const GEN = (n) => BigInt(Math.round(n * 1e6)) * BigInt(10 ** 12); // n GEN -> wei, 6dp safe

let pass = 0;
let fail = 0;
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  if (ok) pass++; else fail++;
  console.log(`  ${ok ? "✅ PASS" : "❌ FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function readC(client, fn, args = []) {
  return client.readContract({ address: CONTRACT, functionName: fn, args });
}

// Returns { ok, err } where ok = execution actually applied (GENVM SUCCESS).
// A GenLayer tx can be consensus-Accepted while its execution reverted, so we
// must inspect execution_result, not rely on the write promise resolving.
async function writeC(ctx, fn, args = [], value = BigInt(0)) {
  const hash = await ctx.client.writeContract({ address: CONTRACT, functionName: fn, args, value });
  const receipt = await ctx.client.waitForTransactionReceipt({
    hash, status: TransactionStatus.FINALIZED, retries: 100, interval: 3000,
  });
  const finalized = await ctx.client.getTransaction({ hash });
  const leader = finalized?.consensus_data?.leader_receipt?.[0];
  const execResult = leader?.execution_result;
  const stderr = leader?.genvm_result?.stderr || "";
  // Pull the raised UserError code out of the traceback if present.
  const m = stderr.match(/UserError\(?["']([A-Z_]+)["']/) || stderr.match(/UserError:\s*([A-Z_]+)/);
  const err = m ? m[1] : (execResult === "ERROR" ? shortErr(stderr) : "");
  return { hash, ok: execResult === "SUCCESS", err };
}

// Expect a write to SUCCEED (execution applied)
async function expectOk(ctx, name, fn, args, value = BigInt(0)) {
  try {
    const r = await writeC(ctx, fn, args, value);
    record(name, r.ok, r.ok ? r.hash.slice(0, 14) + "…" : `reverted: ${r.err}`);
    return r.ok ? r.hash : null;
  } catch (e) {
    record(name, false, `send failed: ${shortErr(e)}`);
    return null;
  }
}

// Expect a write to REVERT with a specific UserError code
async function expectRevert(ctx, name, fn, args, value, needle) {
  try {
    const r = await writeC(ctx, fn, args, value);
    if (r.ok) { record(name, false, "expected revert but execution succeeded"); return; }
    record(name, r.err.includes(needle), `got: ${r.err}`);
  } catch (e) {
    const msg = shortErr(e);
    record(name, msg.includes(needle), `send-level: ${msg}`);
  }
}

function shortErr(e) {
  const m = (e && e.message) ? e.message : String(e);
  return m.replace(/\s+/g, " ").slice(-160);
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  SLAsh Test Suite (multi-wallet)");
  console.log("  Contract:", CONTRACT);
  console.log("  underwriter:", underwriter.address);
  console.log("  holder:     ", holder.address);
  console.log("  claimant:   ", claimant.address);
  console.log("═══════════════════════════════════════════\n");

  try {
    const owner = await readC(holder.client, "get_owner");
    record("contract owner is publicly readable", /^0x[0-9a-fA-F]{40}$/.test(owner), owner);
  } catch (e) {
    record("contract owner is publicly readable", false, shortErr(e));
  }

  // Balance sanity (native GEN) via RPC
  for (const [role, ctx] of [["underwriter", underwriter], ["holder", holder], ["claimant", claimant]]) {
    try {
      const bal = await ctx.client.getCurrentNonce?.(ctx.address); // presence check; ignore
    } catch {}
  }

  console.log("── Path A: Underwriter deposits into pool #" + TEST_POOL_ID + " ──");
  await expectOk(underwriter, "underwriter underwrites 0.5 GEN", "underwrite_pool", [TEST_POOL_ID], GEN(0.5));
  try {
    const pos = await readC(underwriter.client, "get_underwriter_position", [TEST_POOL_ID, underwriter.address]);
    record("underwriter position reflects deposit", BigInt(pos.deposited_wei) >= GEN(0.5),
      `deposited=${pos.deposited_wei} net=${pos.net_wei}`);
  } catch (e) { record("read underwriter position", false, shortErr(e)); }

  console.log("\n── Path B: Holder buys a policy from pool #" + TEST_POOL_ID + " ──");
  const coverage = GEN(0.2);
  let premium;
  try {
    premium = BigInt(await readC(holder.client, "get_premium_quote", [coverage, 30]));
    record("premium quote fetched", premium > BigInt(0), `${premium} wei`);
  } catch (e) { premium = GEN(0.01); record("premium quote fetched", false, shortErr(e)); }

  await expectOk(holder, "holder buys 0.2 GEN / 30d policy", "buy_policy",
    [TEST_POOL_ID, coverage, 30, 60, "qualifying_outage"], premium);

  let holderPolicyIds = [];
  try {
    holderPolicyIds = await readC(holder.client, "get_policy_ids_for_holder", [holder.address]);
    record("policy is owned by holder identity", holderPolicyIds.length > 0,
      `policy ids for holder: [${holderPolicyIds}]`);
  } catch (e) { record("read holder policies", false, shortErr(e)); }
  const newPolicyId = holderPolicyIds[holderPolicyIds.length - 1];

  console.log("\n── Path C: Authorization & validation negatives ──");
  // Non-owner cannot create a pool
  await expectRevert(holder, "non-owner create_pool rejected", "create_pool",
    ["github_actions", "X", "y", "https://www.githubstatus.com/"], BigInt(0), "ONLY_OWNER");
  // Non-owner cannot pause
  await expectRevert(claimant, "non-owner pause_pool rejected", "pause_pool",
    [TEST_POOL_ID], BigInt(0), "ONLY_OWNER");
  // Non-holder cannot file a claim on holder's policy
  if (newPolicyId) {
    const now = Math.floor(Date.now() / 1000);
    await expectRevert(claimant, "non-holder file_claim rejected", "file_claim",
      [newPolicyId, "https://www.vercel-status.com/incidents/x", now + 90000, now + 93600,
       "deploy/build pipeline", "not my policy"], BigInt(0), "ONLY_POLICY_HOLDER");
    // Holder filing during waiting period is rejected
    await expectRevert(holder, "claim before waiting period rejected", "file_claim",
      [newPolicyId, "https://www.vercel-status.com/incidents/x", now - 3600, now - 1800,
       "deploy/build pipeline", "too early"], BigInt(0), "INCIDENT_BEFORE_WAITING_PERIOD");
  }
  // Underpaid premium rejected
  await expectRevert(holder, "underpaid premium rejected", "buy_policy",
    [TEST_POOL_ID, GEN(0.2), 30, 60, "qualifying_outage"], BigInt(1), "INVALID_PREMIUM");
  // Coverage exceeding pool liquidity rejected
  await expectRevert(holder, "over-liquidity coverage rejected", "buy_policy",
    [TEST_POOL_ID, GEN(1000), 30, 60, "qualifying_outage"], GEN(50), "INSUFFICIENT_POOL_LIQUIDITY");

  console.log("\n── Path D: Underwriter withdraws available liquidity ──");
  // Withdraw a small unlocked amount (available = deposit - coverage locked)
  await expectOk(underwriter, "underwriter withdraws 0.1 GEN available", "withdraw_available",
    [TEST_POOL_ID, GEN(0.1)]);
  try {
    const pos = await readC(underwriter.client, "get_underwriter_position", [TEST_POOL_ID, underwriter.address]);
    record("withdrawal reflected in position", BigInt(pos.withdrawn_wei) >= GEN(0.1),
      `withdrawn=${pos.withdrawn_wei} net=${pos.net_wei}`);
  } catch (e) { record("read position after withdraw", false, shortErr(e)); }
  // Over-withdraw beyond deposited is rejected
  await expectRevert(underwriter, "over-withdraw rejected", "withdraw_available",
    [TEST_POOL_ID, GEN(999)], BigInt(0), "NOTHING_TO_WITHDRAW");

  // ── Summary ────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════");
  console.log(`  Results: ${pass} passed, ${fail} failed`);
  console.log("═══════════════════════════════════════════");
  const finalPool = await readC(underwriter.client, "get_pool", [TEST_POOL_ID]).catch(() => null);
  if (finalPool) {
    console.log(`\n  Pool #${TEST_POOL_ID} (${finalPool.service_name}):`);
    console.log(`    total_backing=${finalPool.total_backing_wei}`);
    console.log(`    available=${finalPool.available_wei}`);
    console.log(`    locked=${finalPool.locked_wei}`);
    console.log(`    policies=${finalPool.policy_count}`);
  }
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });

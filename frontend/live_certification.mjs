import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { readFileSync, writeFileSync } from "node:fs";

const CONTRACT = "0xcd870A096A3BD90d85B2B805f6589EAF85D8398b";
const EXPLORER = "https://explorer-studio.genlayer.com/tx/";
const wallets = JSON.parse(readFileSync("test-wallets.local.json", "utf8"));
const ownerRole = wallets.owner ? "owner" : "claimant";
const context = (role) => {
  const account = createAccount(wallets[role].privateKey);
  return { role, address: account.address, client: createClient({ chain: studionet, account }) };
};
const owner = context(ownerRole);
const underwriter = context("underwriter");
const holder = context("holder");
const outsider = underwriter;
const readClient = createClient({ chain: studionet });
const GEN = (n) => BigInt(Math.round(n * 1e6)) * 1000000000000n;
const report = { contract: CONTRACT, started_at: new Date().toISOString(), identities: {}, transactions: [], assertions: [] };
let passed = 0;
let failed = 0;

const short = (e) => String(e?.message || e).replace(/\s+/g, " ").slice(-260);
async function read(fn, args = []) {
  return readClient.readContract({ address: CONTRACT, functionName: fn, args });
}
function assertion(name, ok, detail = "") {
  report.assertions.push({ name, ok, detail });
  ok ? passed++ : failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` :: ${detail}` : ""}`);
}
async function send(ctx, name, fn, args = [], value = 0n, expect = "success") {
  const index = report.transactions.length + 1;
  console.log(`\nTX ${index} ${name} [${ctx.role}]`);
  let hash = "";
  try {
    hash = await ctx.client.writeContract({ address: CONTRACT, functionName: fn, args, value });
    const receipt = await ctx.client.waitForTransactionReceipt({
      hash, status: TransactionStatus.FINALIZED, retries: 120, interval: 3000,
    });
    const finalized = await ctx.client.getTransaction({ hash });
    const execution = finalized?.consensus_data?.leader_receipt?.[0]?.execution_result || "UNKNOWN";
    const succeeded = execution === "SUCCESS";
    const ok = expect === "success" ? succeeded : !succeeded;
    report.transactions.push({ index, name, role: ctx.role, sender: ctx.address, function: fn,
      args: args.map(String), value_wei: value.toString(), expected: expect, execution, ok, hash,
      explorer: EXPLORER + hash });
    assertion(`TX ${index}: ${name}`, ok, `${execution} ${hash}`);
    return { ok, succeeded, hash, receipt };
  } catch (e) {
    const ok = expect === "revert";
    report.transactions.push({ index, name, role: ctx.role, sender: ctx.address, function: fn,
      args: args.map(String), value_wei: value.toString(), expected: expect, execution: "SEND_ERROR",
      ok, hash, error: short(e), explorer: hash ? EXPLORER + hash : "" });
    assertion(`TX ${index}: ${name}`, ok, short(e));
    return { ok, succeeded: false, hash, error: e };
  }
}

const services = [
  ["github_actions", "GitHub Actions", "workflow execution / CI availability", "https://www.githubstatus.com/"],
  ["vercel_deployments", "Vercel Deployments", "deploy/build pipeline", "https://www.vercel-status.com/"],
  ["cloudflare_edge", "Cloudflare Edge", "edge delivery / CDN availability", "https://www.cloudflarestatus.com/"],
  ["stripe_checkout", "Stripe Checkout", "checkout/payment acceptance", "https://status.stripe.com/"],
  ["supabase_auth", "Supabase Auth", "authentication availability", "https://status.supabase.com/"],
];

async function main() {
  const onchainOwner = await read("get_owner");
  report.identities = { owner: owner.address, underwriter: underwriter.address, holder: holder.address, outsider: outsider.address };
  assertion("local owner signer matches get_owner", owner.address.toLowerCase() === onchainOwner.toLowerCase(), onchainOwner);
  const initial = await read("get_protocol_stats");
  if (Number(initial.pool_count) !== 0) throw new Error("Certification requires a fresh deployment with zero pools");

  for (const s of services) await send(owner, `create ${s[1]} pool`, "create_pool", s);
  await send(outsider, "non-owner create rejected", "create_pool", services[0], 0n, "revert");
  await send(owner, "invalid slug rejected", "create_pool", ["bad_slug", "Bad", "x", "https://example.com"], 0n, "revert");
  await send(owner, "empty component rejected", "create_pool", ["github_actions", "Bad", "", "https://www.githubstatus.com"], 0n, "revert");
  await send(owner, "oversized component rejected", "create_pool", ["github_actions", "Bad", "x".repeat(241), "https://www.githubstatus.com"], 0n, "revert");
  await send(owner, "empty status URL rejected", "create_pool", ["github_actions", "Bad", "x", ""], 0n, "revert");
  await send(owner, "oversized service name rejected", "create_pool", ["github_actions", "x".repeat(121), "x", "https://www.githubstatus.com"], 0n, "revert");
  await send(owner, "pause missing pool rejected", "pause_pool", [999], 0n, "revert");
  await send(outsider, "non-owner pause rejected", "pause_pool", [1], 0n, "revert");
  await send(owner, "pause pool", "pause_pool", [1]);
  await send(underwriter, "underwrite paused pool rejected", "underwrite_pool", [1], GEN(0.01), "revert");
  await send(holder, "buy from paused pool rejected", "buy_policy", [1, GEN(0.01), 30, 60, "qualifying_outage"], GEN(0.01), "revert");
  await send(outsider, "non-owner unpause rejected", "unpause_pool", [1], 0n, "revert");
  await send(owner, "unpause pool", "unpause_pool", [1]);

  for (let id = 1; id <= 5; id++) await send(underwriter, `underwrite pool ${id}`, "underwrite_pool", [id], GEN(0.5));
  await send(underwriter, "zero underwriting rejected", "underwrite_pool", [1], 0n, "revert");
  await send(underwriter, "missing-pool underwriting rejected", "underwrite_pool", [999], GEN(0.01), "revert");
  await send(underwriter, "repeat deposit accumulates", "underwrite_pool", [1], GEN(0.1));
  await send(holder, "withdraw without position rejected", "withdraw_available", [1, GEN(0.01)], 0n, "revert");
  await send(underwriter, "zero withdrawal rejected", "withdraw_available", [1, 0], 0n, "revert");
  await send(underwriter, "over-withdrawal rejected", "withdraw_available", [1, GEN(99)], 0n, "revert");
  await send(underwriter, "valid withdrawal", "withdraw_available", [1, GEN(0.05)]);

  await send(holder, "missing pool purchase rejected", "buy_policy", [999, GEN(0.01), 30, 60, "qualifying_outage"], GEN(0.01), "revert");
  await send(holder, "invalid tier rejected", "buy_policy", [1, GEN(0.01), 30, 60, "bogus"], GEN(0.01), "revert");
  await send(holder, "zero coverage rejected", "buy_policy", [1, 0, 30, 60, "qualifying_outage"], GEN(0.01), "revert");
  await send(holder, "short duration rejected", "buy_policy", [1, GEN(0.01), 0, 60, "qualifying_outage"], GEN(0.01), "revert");
  await send(holder, "long duration rejected", "buy_policy", [1, GEN(0.01), 366, 60, "qualifying_outage"], GEN(0.1), "revert");
  await send(holder, "excess coverage rejected", "buy_policy", [1, GEN(99), 30, 60, "qualifying_outage"], GEN(5), "revert");
  await send(holder, "underpaid premium rejected", "buy_policy", [1, GEN(0.1), 30, 60, "qualifying_outage"], 1n, "revert");

  for (let id = 1; id <= 5; id++) {
    const premium = BigInt(await read("get_premium_quote", [GEN(0.1), 30]));
    await send(holder, `buy valid policy in pool ${id}`, "buy_policy", [id, GEN(0.1), 30, 60, "qualifying_outage"], premium);
  }
  const policyIds = await read("get_policy_ids_for_holder", [holder.address]);
  assertion("five policies belong to holder", policyIds.length === 5, JSON.stringify(policyIds));
  const p1 = await read("get_policy", [policyIds[0]]);
  const start = Number(p1.waiting_period_end) + 60;
  const end = start + 3600;
  await send(outsider, "non-holder claim rejected", "file_claim", [policyIds[0], services[0][3], start, end, services[0][2], "outsider"], 0n, "revert");
  await send(holder, "missing policy claim rejected", "file_claim", [999, services[0][3], start, end, services[0][2], "missing"], 0n, "revert");
  await send(holder, "pre-wait claim rejected", "file_claim", [policyIds[0], services[0][3], Number(p1.waiting_period_end) - 1, end, services[0][2], "early"], 0n, "revert");
  await send(holder, "invalid incident window rejected", "file_claim", [policyIds[0], services[0][3], start, start, services[0][2], "window"], 0n, "revert");
  await send(holder, "empty incident URL rejected", "file_claim", [policyIds[0], "", start, end, services[0][2], "url"], 0n, "revert");
  await send(holder, "oversized note rejected", "file_claim", [policyIds[0], services[0][3], start, end, services[0][2], "x".repeat(501)], 0n, "revert");
  await send(holder, "empty component rejected", "file_claim", [policyIds[0], services[0][3], start, end, "", "component"], 0n, "revert");
  await send(holder, "wrong evidence domain rejected", "file_claim", [policyIds[0], "https://example.com/incident", start, end, services[0][2], "domain"], 0n, "revert");
  await send(holder, "post-policy incident rejected", "file_claim", [policyIds[0], services[0][3], Number(p1.end_time) + 1, Number(p1.end_time) + 100, services[0][2], "late"], 0n, "revert");
  await send(holder, "settle missing claim rejected", "settle_claim", [999], 0n, "revert");
  await send(holder, "review missing claim rejected", "review_claim", [999], 0n, "revert");

  // Security invariant: incidents cannot be filed with timestamps in the future.
  const futureClaim = await send(holder, "future-dated claim rejected", "file_claim", [policyIds[1], services[1][3], start, end, services[1][2], "future timestamp probe"], 0n, "revert");
  assertion("future-dated claim must be rejected", !futureClaim.succeeded, "claimed_start must not exceed contract time");
  const claims = await read("get_claim_ids_for_holder", [holder.address]);
  if (claims.length) {
    const cid = claims[claims.length - 1];
    await send(holder, "settle unreviewed claim rejected", "settle_claim", [cid], 0n, "revert");
    await send(owner, "validator review claim", "review_claim", [cid]);
    await send(owner, "duplicate review rejected", "review_claim", [cid], 0n, "revert");
    await send(holder, "settle reviewed claim", "settle_claim", [cid]);
    await send(holder, "duplicate settlement rejected", "settle_claim", [cid], 0n, "revert");
  }

  const stats = await read("get_protocol_stats");
  assertion("pool count invariant", Number(stats.pool_count) === 5, JSON.stringify(stats));
  assertion("policy count invariant", Number(stats.policy_count) === 5, JSON.stringify(stats));
  for (let id = 1; id <= 5; id++) {
    const pool = await read("get_pool", [id]);
    const accounting = BigInt(pool.available_wei) + BigInt(pool.locked_wei) === BigInt(pool.total_backing_wei);
    assertion(`pool ${id} backing invariant`, accounting, `available=${pool.available_wei} locked=${pool.locked_wei} total=${pool.total_backing_wei}`);
  }
  report.finished_at = new Date().toISOString();
  report.summary = { transaction_count: report.transactions.length, passed, failed };
  writeFileSync("live-certification-report.json", JSON.stringify(report, null, 2));
  console.log(`\nCERTIFICATION ${report.transactions.length} transactions; ${passed} passed; ${failed} failed`);
  console.log("Evidence: live-certification-report.json");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  report.finished_at = new Date().toISOString();
  report.fatal = short(e);
  writeFileSync("live-certification-report.json", JSON.stringify(report, null, 2));
  console.error("FATAL", short(e));
  process.exit(1);
});

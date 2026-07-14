import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { readFileSync } from "node:fs";

const address = "0xcd870A096A3BD90d85B2B805f6589EAF85D8398b";
const wallets = JSON.parse(readFileSync("test-wallets.local.json", "utf8"));
const ctx = (role) => { const account = createAccount(wallets[role].privateKey); return { role, account, client: createClient({ chain: studionet, account }) }; };
const a = ctx("underwriter");
const b = ctx("claimant");
const h = ctx("holder");
const readClient = createClient({ chain: studionet });
const GEN = (n) => BigInt(Math.round(n * 1e6)) * 1000000000000n;
async function write(w, fn, args, value = 0n) {
  const hash = await w.client.writeContract({ address, functionName: fn, args, value });
  await w.client.waitForTransactionReceipt({ hash, status: TransactionStatus.FINALIZED, retries: 120, interval: 3000 });
  const tx = await w.client.getTransaction({ hash });
  const result = tx?.consensus_data?.leader_receipt?.[0]?.execution_result;
  console.log(`${w.role} ${fn}: ${result} ${hash}`);
  if (result !== "SUCCESS") throw new Error(`${fn} failed`);
  return hash;
}
const stats = await readClient.readContract({ address, functionName: "get_protocol_stats", args: [] });
console.log("initial", stats);
await write(a, "underwrite_pool", [1], GEN(1));
await write(b, "underwrite_pool", [1], GEN(1));
const quote = await readClient.readContract({ address, functionName: "get_premium_quote", args: [GEN(0.1), 30] });
console.log("premium quote", quote);
await write(h, "buy_policy", [1, GEN(0.1), 30, 60, "qualifying_outage"], BigInt(quote));
const policies = await readClient.readContract({ address, functionName: "get_policy_ids_for_holder", args: [h.account.address] });
const pool = await readClient.readContract({ address, functionName: "get_pool", args: [1] });
const posA = await readClient.readContract({ address, functionName: "get_underwriter_position", args: [1, a.account.address] });
const posB = await readClient.readContract({ address, functionName: "get_underwriter_position", args: [1, b.account.address] });
console.log(JSON.stringify({ policies, pool, underwriterA: posA, underwriterB: posB }, null, 2));

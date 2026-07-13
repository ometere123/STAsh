import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { readFileSync, writeFileSync } from "node:fs";

const path = "live-certification-report.json";
const report = JSON.parse(readFileSync(path, "utf8"));
const client = createClient({ chain: studionet });
let next = 0;

async function worker() {
  while (next < report.transactions.length) {
    const tx = report.transactions[next++];
    if (!tx.hash) continue;
    try {
      const receipt = await client.waitForTransactionReceipt({
        hash: tx.hash,
        status: TransactionStatus.FINALIZED,
        retries: 120,
        interval: 3000,
      });
      const finalized = await client.getTransaction({ hash: tx.hash });
      tx.execution = finalized?.consensus_data?.leader_receipt?.[0]?.execution_result || "UNKNOWN";
      const succeeded = tx.execution === "SUCCESS";
      tx.ok = tx.expected === "success" ? succeeded : !succeeded;
      tx.finalized = true;
      console.log(`${tx.ok ? "PASS" : "FAIL"} TX ${tx.index} ${tx.execution} ${tx.hash}`);
    } catch (e) {
      tx.finalized = false;
      tx.finalize_error = String(e?.message || e).replace(/\s+/g, " ").slice(-300);
      tx.ok = false;
      console.log(`FAIL TX ${tx.index} FINALIZE_ERROR`);
    }
  }
}

await Promise.all(Array.from({ length: 8 }, () => worker()));
const txPassed = report.transactions.filter((tx) => tx.ok).length;
const txFailed = report.transactions.length - txPassed;
report.finalized_at = new Date().toISOString();
report.finalized_summary = { transaction_count: report.transactions.length, passed: txPassed, failed: txFailed };
writeFileSync(path, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.finalized_summary));
process.exit(txFailed ? 1 : 0);

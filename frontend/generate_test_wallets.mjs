/**
 * Generate fresh burner wallets for local test flows (underwriter, holder, claimant).
 *
 * Usage:
 *   node generate_test_wallets.mjs
 *
 * Writes private keys to test-wallets.local.json (gitignored, never printed here)
 * and prints ONLY the addresses so you can fund them with test GEN.
 */

import { generatePrivateKey, createAccount } from "genlayer-js";
import { writeFileSync } from "node:fs";

const ROLES = ["underwriter", "holder", "claimant"];

const wallets = {};
for (const role of ROLES) {
  const privateKey = generatePrivateKey();
  const account = createAccount(privateKey);
  wallets[role] = { address: account.address, privateKey };
}

writeFileSync("test-wallets.local.json", JSON.stringify(wallets, null, 2));

console.log("Generated test wallets -> test-wallets.local.json (gitignored, keep local)\n");
for (const role of ROLES) {
  console.log(`  ${role.padEnd(12)} ${wallets[role].address}`);
}
console.log("\nFund these addresses with test GEN (StudioNet faucet or a transfer from your admin wallet) before running test paths.");

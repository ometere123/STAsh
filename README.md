# SLAsh: Trustless Outage Cover

Trustless parametric outage cover for developer-critical internet dependencies. Settled by GenLayer validators from real public incident evidence.

## Why GenLayer

Normal smart contracts can check a field. They cannot reliably interpret whether "degraded performance" or "partial outage" on a status page qualifies under a specific coverage policy. SLAsh uses GenLayer validators to independently fetch public evidence, interpret incident severity against locked policy terms, and reach consensus on a bounded verdict. The contract then settles payout deterministically.

## How It Works

```
Underwrite Pool → Buy Cover → File Claim → Validator Review → Settlement
```

1. **Underwriters** stake GEN into service-specific risk pools
2. **Policyholders** buy fixed payout cover against a named public dependency
3. **Claimants** file claims with public incident evidence URLs
4. **GenLayer validators** independently fetch evidence and judge whether the claim qualifies
5. **Contract** settles payout deterministically based on the consensus verdict

## Architecture

```
Frontend (Next.js)  →  GenLayer Contract (source of truth)
                    →  Cloudflare Worker (evidence preview only)
                    →  GenLayer Validators (independent evidence fetch + judgement)
```

## Supported Services (MVP)

| Service | Covered Component |
|---|---|
| GitHub Actions | workflow execution / CI availability |
| Vercel Deployments | deploy/build pipeline |
| Cloudflare Edge | edge delivery / CDN availability |
| Stripe Checkout | checkout/payment acceptance |
| Supabase Auth | authentication availability |

## Contract

- **Network:** GenLayer StudioNet (Chain ID: 61999)
- **Contract Address:** `0xcd870A096A3BD90d85B2B805f6589EAF85D8398b`
- **Explorer:** https://explorer-studio.genlayer.com/address/0xcd870A096A3BD90d85B2B805f6589EAF85D8398b

## Local Development

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

### Worker

```powershell
cd workers
npm install
npm run dev
```

Production Worker: https://slash-evidence-worker.delealufejoel.workers.dev

### Contract

Deploy via [GenLayer Studio](https://studio.genlayer.com) using the source at `contracts/slash_outage_cover.py`.

## Frontend Build

```powershell
cd frontend
npm run build
```

## Worker Deploy

```powershell
cd workers
npm run deploy
```

## Seed Pools

After deploying the contract, seed the 5 MVP pools:

```powershell
python scripts/seed_pools.py
```

Follow the printed instructions to execute `create_pool` calls in GenLayer Studio.

## Smoke Test

```powershell
python scripts/smoke_test.py
```

Prints step-by-step instructions for the full flow: create pools → underwrite → buy policy → file claim → review → settle.

## Account Flow (Wallet Identity)

The app uses one verifiable wallet identity end to end. The address shown in the UI selects holder, claimant, underwriter, and owner reads; the same address is checked again against the wallet immediately before every write and is passed to the injected-wallet signer.

1. **Connect and display** — `WalletProvider` requests `eth_requestAccounts`, stores account zero, and `TopBar` displays it. `accountsChanged` updates that state and invalidates the cached write client.
2. **Identity-scoped reads** — pages pass that address to `getPolicyIdsForHolder`, `getClaimIdsForHolder`, and `getUnderwriterPosition`. Underwriter addresses are canonicalized on-chain before position lookup, so checksum casing cannot select a different key.
3. **Owner read** — the Admin page calls the contract's `get_owner()`. It enables controls only when the connected address equals the owner returned by the deployed contract. An environment variable is not an authorization source.
4. **Pre-sign assertion** — immediately before a write, `contract.ts` calls `eth_accounts` again. If the wallet's active account differs from the displayed/captured account, the write is stopped and the user must review and resubmit.
5. **Injected-wallet signing** — every write helper receives the connected account and builds the client as:

   ```ts
   createClient({ chain: studionet, account, provider: window.ethereum })
   ```

   No generated or hardcoded private key exists in the browser write path. The wallet shows the signature request to the user.
6. **On-chain authorization** — ownership and role state are derived from `gl.message.sender_address`: owner-only pool administration, underwriter positions, policy ownership, and claim filing authorization.
7. **Execution verification** — consensus acceptance alone is not treated as success. The app requires the SDK receipt's `txExecutionResultName` to equal `FINISHED_WITH_RETURN`; a reverted execution is surfaced as an error and never shown as confirmed.

### Authorization Matrix

| Action | UI/read identity | On-chain identity/guard | Expected negative proof |
|---|---|---|---|
| Create, pause, or unpause pool | `get_owner()` equals connected address | sender must equal `self.owner` | non-owner receives `ONLY_OWNER` |
| Underwrite or withdraw | position read for connected address | position keyed by sender | another wallet has a separate/zero position |
| Buy cover | policies read for connected address | `policy.holder = sender` | another wallet does not own the policy |
| File claim | holder policies for connected address | sender must equal `policy.holder` | non-holder receives `ONLY_POLICY_HOLDER` |
| Review or settle | claim read is public | contract lifecycle guards | invalid lifecycle transition reverts |

### Reproducible Multi-Wallet Verification

The browser flow uses only the injected wallet. The following separate CLI suite is test infrastructure for demonstrating authorization boundaries with isolated funded StudioNet burner accounts; its private-key file is gitignored and never used by the app.

```powershell
cd frontend
npm run wallets:generate
# Fund the printed StudioNet addresses, then:
npm run test:wallet-flow
```

The suite prints the contract and role addresses, verifies that each successful write is reflected by reads for the same address, inspects execution results rather than send success, and proves non-owner/non-holder calls revert. For reviewer evidence, retain the sanitized console output and replace abbreviated hashes with explorer links in the submission notes.

> **Verified deployment target:** all app, script, and test references point to `0xcd870A096A3BD90d85B2B805f6589EAF85D8398b`, deployed with the corrected accounting and expiry-release model.

### Manual Explorer Check

Connect a wallet, copy the full address shown in the TopBar, submit a write, and open its transaction card. The explorer sender must equal the displayed address, the receipt must show successful execution, and the resulting holder/claimant/underwriter/owner read must resolve to that same address.

## Security Notes

- Cloudflare Worker is **not trusted** for payout decisions
- GenLayer validators independently fetch public evidence during review
- Only public evidence is supported, no private screenshots or logs
- Locked coverage cannot be withdrawn by underwriters
- Claims cannot be settled twice
- 24-hour waiting period after policy purchase before claims are eligible
- Future-dated incident timestamps are rejected on-chain

## Capital accounting and expiry

Paid and expired coverage follows explicit pool accounting rules:

- A denied claim unlocks its full coverage; `total_backing_wei` is unchanged.
- An approved claim unlocks its coverage, subtracts the actual payout from `total_backing_wei`, and returns any unpaid remainder to `available_wei`.
- Approved-claim payouts are allocated proportionally across underwriters using each position's net backing immediately before settlement. Each position exposes `loss_wei` and `net_wei = deposited - withdrawn - loss`.
- Anyone may call `expire_policy(policy_id)` after an active, unclaimed policy passes `end_time`. The policy becomes `expired`, its coverage is unlocked, and no payout is created.
- Settlement and expiry reject locked-coverage inconsistencies instead of allowing unsigned underflow.

The invariant maintained after deposits, withdrawals, payouts, denials, and expiry is:

```text
total_backing_wei = available_wei + locked_wei
```

Deterministic arithmetic tests live in `tests/direct/test_accounting_invariants.py`. They cover full and partial payout reconciliation, proportional loss allocation including rounding, loss-aware withdrawals, expiry release, and expiry rejection paths.

## Limitations

- Experimental fixed payout cover, not licensed insurance
- Public evidence only, no private uptime proof
- No exact loss reimbursement, fixed payouts only
- MVP supports 5 services only
- Manual pricing model (5% of coverage per 30 days)

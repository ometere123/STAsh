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
- **Contract Address:** `0x7C0465AA895Bb77898bDdc2D8014B3eD5bdF1e36`
- **Explorer:** https://explorer-studio.genlayer.com/address/0x7C0465AA895Bb77898bDdc2D8014B3eD5bdF1e36

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

## Security Notes

- Cloudflare Worker is **not trusted** for payout decisions
- GenLayer validators independently fetch public evidence during review
- Only public evidence is supported, no private screenshots or logs
- Locked coverage cannot be withdrawn by underwriters
- Claims cannot be settled twice
- 24-hour waiting period after policy purchase before claims are eligible

## Limitations

- Experimental fixed payout cover, not licensed insurance
- Public evidence only, no private uptime proof
- No exact loss reimbursement, fixed payouts only
- MVP supports 5 services only
- Manual pricing model (5% of coverage per 30 days)

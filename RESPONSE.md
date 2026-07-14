# Response to “More information requested”

Requested by Joaquin on July 12, 2026 at 05:51.

> Please wire GenLayer writes to the same wallet identity the app displays and uses for holder, underwriter, claim, and owner reads. Then resubmit with the account flow clearly documented so ownership and authorization can be verified end to end.

## Status

Resolved and verified on GenLayer StudioNet.

- Network: GenLayer StudioNet (`61999`)
- Patched contract: [`0x72A76300b890D5D0b69E59d417a5Ff66cc0021cc`](https://explorer-studio.genlayer.com/address/0x72A76300b890D5D0b69E59d417a5Ff66cc0021cc)
- On-chain owner: `0x9DCe0dc7005d6b92E03c27640081096cd36Dd468`

## End-to-end account flow

1. `WalletProvider` requests account access from the injected wallet with `eth_requestAccounts` and stores account zero. That exact address is displayed in the application header.
2. Holder, claimant, and underwriter reads receive the connected address from `useWallet()`:
   - `get_policy_ids_for_holder(address)`
   - `get_claim_ids_for_holder(address)`
   - `get_underwriter_position(poolId, address)`
3. Owner identity is read directly from the deployed contract through `get_owner()`. The Admin UI compares the connected wallet to this on-chain value; an environment allowlist is not treated as authorization.
4. Every write helper requires the connected address as its first argument. Immediately before signing, the application requests `eth_accounts` again and rejects submission if the wallet's active account differs from the address displayed by the app.
5. The GenLayer client uses the injected provider and that same account:

   ```ts
   createClient({
     chain: studionet,
     account,
     provider: window.ethereum,
   })
   ```

   The browser application contains no generated or hardcoded signing key.
6. The contract authorizes actions using `gl.message.sender_address`. Owner administration, policy ownership, claim authorization, and underwriter positions therefore resolve to the signer that submitted the transaction.
7. The UI waits for finality and checks StudioNet's raw leader receipt. Only `execution_result === "SUCCESS"` is shown as confirmed; consensus acceptance alone is not treated as successful execution.
8. `accountsChanged` invalidates the cached write client, preventing a stale signer from surviving a wallet switch.

## Live identity proof

A real holder-signed transaction was submitted against the patched deployment:

- Address displayed/derived from the holder wallet: `0xfCBF06F6c5D642E02CE8186Ad799A712D3ddb252`
- `get_policy_ids_for_holder(displayedAddress)`: `[1, 2, 3, 4, 5]`
- `get_policy(1).holder`: `0xfCBF06F6c5D642E02CE8186Ad799A712D3ddb252`
- Transaction sender: `0xfCBF06F6c5D642E02CE8186Ad799A712D3ddb252`
- Transaction: [`0xa9f72cf98e78e91a39add1e1ce8749f4cd3f048d6a498080528a5e8029af8d40`](https://explorer-studio.genlayer.com/tx/0xa9f72cf98e78e91a39add1e1ce8749f4cd3f048d6a498080528a5e8029af8d40)

The displayed wallet, holder-index read, stored policy owner, and actual transaction sender are identical.

The transaction deliberately supplied a future incident timestamp. The finalized leader receipt returned:

```text
execution_result: ERROR
rollback payload: INCIDENT_IN_FUTURE
```

This proves both signer continuity and that the patched contract enforces the expected authorization/validation path without changing state on failure.

## Live owner and underwriter proof

Current on-chain reads from the same patched deployment:

| Identity/state | Live value |
|---|---|
| Contract owner (`get_owner`) | `0x9DCe0dc7005d6b92E03c27640081096cd36Dd468` |
| Underwriter queried | `0xe8916990B79DBfd544C7fBcb40143a49D1Af0005` |
| Deposited | `600000000000000000` wei |
| Withdrawn | `50000000000000000` wei |
| Net position | `550000000000000000` wei |
| Pools | `5` |
| Policies | `5` |
| Claims | `0` |

Pool 1 also satisfies the accounting invariant:

```text
available + locked = total backing
450000000000000000 + 100000000000000000 = 550000000000000000 wei
```

## Authorization matrix

| Action | Read/display identity | Contract authorization |
|---|---|---|
| Create, pause, unpause pool | Connected address equals `get_owner()` | sender must equal `self.owner` |
| Underwrite and withdraw | Position read for connected address | position keyed by sender |
| Buy cover | Holder policy index for connected address | `policy.holder = sender` |
| File claim | Connected holder and holder policy reads | sender must equal `policy.holder` |
| Review and settle | Public claim state | lifecycle guards enforced on-chain |

## Verification tooling

The repository includes funded-wallet test tooling that keeps private keys in the gitignored `test-wallets.local.json` file:

```powershell
cd frontend
npm run test:wallet-flow
npm run test:live-certification
npm run test:finalize-certification
npm run build
```

The live certification records each action, signer, expected outcome, final execution result, hash, and explorer URL. Private keys are never printed or committed.

## Conclusion

GenLayer writes, UI display identity, holder reads, claimant reads, underwriter reads, and owner reads now share one explicit wallet identity flow. The browser revalidates the active account immediately before signing, the contract authorizes the resulting sender on-chain, and finalized explorer evidence demonstrates that the same address is preserved end to end.

## User-facing coverage disclosure

Before Buy Cover is enabled, the Coverage Builder explicitly discloses and requires acknowledgment of:

- the 24-hour claim waiting period;
- the distinction between that waiting period and the selected minimum incident duration;
- the requirement for a public incident-detail URL from the service's official status domain; and
- the fact that GenLayer validators fetch and assess the page's actual content during claim review.

The claim form repeats the evidence-fetch disclosure beside the Incident URL field, and My Policies shows the exact waiting-period end timestamp for each purchased policy.

## Accounting remediation requested by review

The contract now addresses the remaining economic-lifecycle issues:

- approved payouts reduce `total_backing_wei` by the actual payout and preserve `total_backing_wei = available_wei + locked_wei`;
- denied claims unlock coverage without reducing backing;
- approved payouts allocate proportional `loss_wei` to every underwriter with net backing immediately before settlement;
- underwriter `net_wei` subtracts realized loss, so loss cannot be withdrawn as if it were available capital; and
- anyone can call `expire_policy()` after an active unclaimed policy passes its end time, releasing locked coverage and marking the policy `expired`.

Executable deterministic coverage is in `tests/direct/test_accounting_invariants.py`; it passed together with the existing direct suite. These contract changes require a fresh deployment and a new StudioNet integration run before final resubmission.

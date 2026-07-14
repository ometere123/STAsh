"""
Smoke test instructions for the full SLAsh flow.
Execute each step in GenLayer Studio against the deployed contract.

Contract: 0xcd870A096A3BD90d85B2B805f6589EAF85D8398b
"""

STEPS = [
    {
        "step": 1,
        "action": "Verify pools exist",
        "method": "get_pool_ids",
        "args": {},
        "value": None,
        "expected": "Returns [1, 2, 3, 4, 5]",
    },
    {
        "step": 2,
        "action": "Check pool #1 details",
        "method": "get_pool",
        "args": {"pool_id": 1},
        "value": None,
        "expected": "service_slug = github_actions, status = active",
    },
    {
        "step": 3,
        "action": "Underwrite pool #1 with 2 GEN",
        "method": "underwrite_pool",
        "args": {"pool_id": 1},
        "value": "2000000000000000000",
        "expected": "Pool total_backing_wei increases by 2 GEN",
    },
    {
        "step": 4,
        "action": "Buy policy from pool #1",
        "method": "buy_policy",
        "args": {
            "pool_id": 1,
            "coverage_wei": 500000000000000000,  # 0.5 GEN
            "duration_days": 30,
            "min_minutes": 60,
            "qualifying_tier": "qualifying_outage",
        },
        "value": "100000000000000000",  # 0.1 GEN premium
        "expected": "Returns policy_id = 1, pool locked_wei increases",
    },
    {
        "step": 5,
        "action": "File claim against policy #1",
        "method": "file_claim",
        "args": {
            "policy_id": 1,
            "incident_url": "https://www.githubstatus.com/incidents/jr51g3t3qkpd",
            "claimed_start": 1750000000,
            "claimed_end": 1750007200,
            "affected_component": "workflow execution / CI availability",
            "claim_note": "GitHub Actions workflows were unavailable during this window",
        },
        "value": None,
        "expected": "Returns claim_id = 1, policy status = claimed",
    },
    {
        "step": 6,
        "action": "Review claim #1 (triggers GenLayer consensus)",
        "method": "review_claim",
        "args": {"claim_id": 1},
        "value": None,
        "expected": "Claim gets verdict and payout_band from validators",
    },
    {
        "step": 7,
        "action": "Settle claim #1",
        "method": "settle_claim",
        "args": {"claim_id": 1},
        "value": None,
        "expected": "If approved: payout transferred. If denied: coverage released.",
    },
    {
        "step": 8,
        "action": "Check final claim state",
        "method": "get_claim",
        "args": {"claim_id": 1},
        "value": None,
        "expected": "status = settled, verdict and payout_band populated",
    },
    {
        "step": 9,
        "action": "Check protocol stats",
        "method": "get_protocol_stats",
        "args": {},
        "value": None,
        "expected": "pool_count >= 5, policy_count >= 1, claim_count >= 1",
    },
]

if __name__ == "__main__":
    print("=" * 60)
    print("SLAsh Smoke Test: Full Flow")
    print("Contract: 0xcd870A096A3BD90d85B2B805f6589EAF85D8398b")
    print("=" * 60)
    print()

    for s in STEPS:
        print(f"Step {s['step']}: {s['action']}")
        print(f"  Method: {s['method']}")
        if s['args']:
            print(f"  Args: {s['args']}")
        if s['value']:
            print(f"  Value: {s['value']} wei")
        print(f"  Expected: {s['expected']}")
        print()

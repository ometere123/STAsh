"""
Seed the 5 MVP service pools on the deployed SlashOutageCover contract.
Run from GenLayer Studio or via genlayer CLI after deployment.

Usage:
  This script prints the create_pool calls you need to execute.
  Run each call in GenLayer Studio's Execute Transaction panel.
"""

POOLS = [
    {
        "slug": "github_actions",
        "name": "GitHub Actions",
        "component": "workflow execution / CI availability",
        "status_url": "https://www.githubstatus.com/",
    },
    {
        "slug": "vercel_deployments",
        "name": "Vercel Deployments",
        "component": "deploy/build pipeline",
        "status_url": "https://www.vercel-status.com/",
    },
    {
        "slug": "cloudflare_edge",
        "name": "Cloudflare Edge",
        "component": "edge delivery / CDN availability",
        "status_url": "https://www.cloudflarestatus.com/",
    },
    {
        "slug": "stripe_checkout",
        "name": "Stripe Checkout",
        "component": "checkout/payment acceptance",
        "status_url": "https://status.stripe.com/",
    },
    {
        "slug": "supabase_auth",
        "name": "Supabase Auth",
        "component": "authentication availability",
        "status_url": "https://status.supabase.com/",
    },
]

if __name__ == "__main__":
    print("=" * 60)
    print("SLAsh Pool Seeding Instructions")
    print("Contract: 0x72A76300b890D5D0b69E59d417a5Ff66cc0021cc")
    print("=" * 60)
    print()
    print("Execute these create_pool calls in GenLayer Studio:")
    print("(Method: create_pool, no value needed)")
    print()

    for i, pool in enumerate(POOLS, 1):
        print(f"--- Pool {i}: {pool['name']} ---")
        print(f"  service_slug: {pool['slug']}")
        print(f"  service_name: {pool['name']}")
        print(f"  covered_component: {pool['component']}")
        print(f"  status_url: {pool['status_url']}")
        print()

    print("After creating all pools, underwrite at least one pool:")
    print("  Method: underwrite_pool")
    print("  pool_id: 1")
    print("  Value: 1000000000000000000 (1 GEN)")
    print()
    print("Then verify with get_pool_ids(): should return [1, 2, 3, 4, 5]")

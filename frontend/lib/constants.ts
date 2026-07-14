export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID || 61999);
export const RPC_URL = process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "https://studio.genlayer.com/api";
export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0xcd870A096A3BD90d85B2B805f6589EAF85D8398b";
export const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || "";
export const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer-studio.genlayer.com";
export const ADMIN_ADDRESSES = (process.env.NEXT_PUBLIC_ADMIN_ADDRESSES || "")
  .split(",")
  .map((address) => address.trim().toLowerCase())
  .filter(Boolean);

export const STUDIONET_CHAIN = {
  id: CHAIN_ID,
  name: "GenLayer StudioNet",
  rpcUrl: RPC_URL,
  explorerUrl: EXPLORER_URL,
};

export const MVP_SERVICES = [
  {
    slug: "github_actions",
    name: "GitHub Actions",
    component: "workflow execution / CI availability",
    statusUrl: "https://www.githubstatus.com/",
    riskLabel: "ci dependency",
  },
  {
    slug: "vercel_deployments",
    name: "Vercel Deployments",
    component: "deploy/build pipeline",
    statusUrl: "https://www.vercel-status.com/",
    riskLabel: "deploy pipeline",
  },
  {
    slug: "cloudflare_edge",
    name: "Cloudflare Edge",
    component: "edge delivery / CDN availability",
    statusUrl: "https://www.cloudflarestatus.com/",
    riskLabel: "edge delivery",
  },
  {
    slug: "stripe_checkout",
    name: "Stripe Checkout",
    component: "checkout/payment acceptance",
    statusUrl: "https://status.stripe.com/",
    riskLabel: "payment rail",
  },
  {
    slug: "supabase_auth",
    name: "Supabase Auth",
    component: "authentication availability",
    statusUrl: "https://status.supabase.com/",
    riskLabel: "auth provider",
  },
] as const;

export const QUALIFYING_TIERS = [
  "minor_degradation",
  "qualifying_outage",
  "major_outage",
] as const;

export const WEI_PER_GEN = BigInt(10 ** 18);

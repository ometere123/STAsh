export interface ServiceDef {
  slug: string;
  name: string;
  covered_component: string;
  status_url: string;
  api_url: string;
  risk_label: string;
}

export const SERVICES: ServiceDef[] = [
  {
    slug: "github_actions",
    name: "GitHub Actions",
    covered_component: "workflow execution / CI availability",
    status_url: "https://www.githubstatus.com/",
    api_url: "https://www.githubstatus.com/api/v2/summary.json",
    risk_label: "ci dependency",
  },
  {
    slug: "vercel_deployments",
    name: "Vercel Deployments",
    covered_component: "deploy/build pipeline",
    status_url: "https://www.vercel-status.com/",
    api_url: "https://www.vercel-status.com/api/v2/summary.json",
    risk_label: "deploy pipeline",
  },
  {
    slug: "cloudflare_edge",
    name: "Cloudflare Edge",
    covered_component: "edge delivery / CDN availability",
    status_url: "https://www.cloudflarestatus.com/",
    api_url: "https://www.cloudflarestatus.com/api/v2/summary.json",
    risk_label: "edge delivery",
  },
  {
    slug: "stripe_checkout",
    name: "Stripe Checkout",
    covered_component: "checkout/payment acceptance",
    status_url: "https://status.stripe.com/",
    api_url: "https://status.stripe.com/api/v2/summary.json",
    risk_label: "payment rail",
  },
  {
    slug: "supabase_auth",
    name: "Supabase Auth",
    covered_component: "authentication availability",
    status_url: "https://status.supabase.com/",
    api_url: "https://status.supabase.com/api/v2/summary.json",
    risk_label: "auth provider",
  },
];

export function getService(slug: string): ServiceDef | undefined {
  return SERVICES.find((s) => s.slug === slug);
}

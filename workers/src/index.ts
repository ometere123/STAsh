import { SERVICES, getService } from "./services";
import { fetchStatus, fetchIncidents, fetchClaimPreview } from "./fetchers";

interface Env {
  ALLOWED_ORIGIN: string;
  CACHE_TTL_SECONDS: string;
}

function corsHeaders(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data: any, env: Env, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    // GET /health
    if (path === "/health") {
      return json({ ok: true, service: "slash-evidence-worker" }, env);
    }

    // GET /services
    if (path === "/services") {
      return json({
        services: SERVICES.map((s) => ({
          slug: s.slug,
          name: s.name,
          covered_component: s.covered_component,
          status_url: s.status_url,
          risk_label: s.risk_label,
        })),
      }, env);
    }

    // GET /services/:slug/status
    const statusMatch = path.match(/^\/services\/([^/]+)\/status$/);
    if (statusMatch && request.method === "GET") {
      const service = getService(statusMatch[1]);
      if (!service) return json({ error: "Unknown service" }, env, 404);
      const result = await fetchStatus(service);
      return json({
        slug: service.slug,
        ...result,
        fetched_at: new Date().toISOString(),
      }, env);
    }

    // GET /services/:slug/incidents
    const incidentsMatch = path.match(/^\/services\/([^/]+)\/incidents$/);
    if (incidentsMatch && request.method === "GET") {
      const service = getService(incidentsMatch[1]);
      if (!service) return json({ error: "Unknown service" }, env, 404);
      const incidents = await fetchIncidents(service);
      return json({ slug: service.slug, incidents }, env);
    }

    // POST /claim-preview
    if (path === "/claim-preview" && request.method === "POST") {
      try {
        const body: any = await request.json();
        const { service_slug, incident_url, affected_component, claimed_start, claimed_end } = body;

        if (!incident_url) {
          return json({ error: "incident_url required" }, env, 400);
        }

        const service = getService(service_slug);
        const preview = await fetchClaimPreview(incident_url);

        return json({
          ok: true,
          preview_only: true,
          service_slug: service_slug || "unknown",
          incident_url,
          evidence_title: preview.title,
          evidence_excerpt: preview.excerpt,
          warnings: [
            "This preview is not used for payout. GenLayer validators re-fetch public evidence during claim review.",
          ],
        }, env);
      } catch (e: any) {
        return json({ error: "Invalid request body", detail: e.message }, env, 400);
      }
    }

    return json({ error: "Not found" }, env, 404);
  },
};

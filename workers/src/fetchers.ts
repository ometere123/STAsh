import { ServiceDef } from "./services";

export async function fetchStatus(service: ServiceDef): Promise<{
  status: string;
  summary: string;
}> {
  try {
    const res = await fetch(service.api_url, {
      headers: { "User-Agent": "SLAsh-Evidence-Worker/1.0" },
    });
    if (!res.ok) {
      return { status: "unknown", summary: `Status page returned ${res.status}` };
    }
    const data: any = await res.json();
    const indicator = data?.status?.indicator || "unknown";
    const description = data?.status?.description || "No description available";
    return { status: indicator, summary: description };
  } catch (e: any) {
    return { status: "error", summary: `Failed to fetch: ${e.message}` };
  }
}

export async function fetchIncidents(service: ServiceDef): Promise<any[]> {
  try {
    const url = service.api_url.replace("summary.json", "incidents.json");
    const res = await fetch(url, {
      headers: { "User-Agent": "SLAsh-Evidence-Worker/1.0" },
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    const incidents = (data?.incidents || []).slice(0, 10);
    return incidents.map((inc: any) => ({
      title: inc.name || "Untitled",
      url: inc.shortlink || service.status_url,
      started_at: inc.started_at || null,
      resolved_at: inc.resolved_at || null,
      impact: inc.impact || "unknown",
    }));
  } catch {
    return [];
  }
}

export async function fetchClaimPreview(incidentUrl: string): Promise<{
  title: string;
  excerpt: string;
}> {
  try {
    const res = await fetch(incidentUrl, {
      headers: { "User-Agent": "SLAsh-Evidence-Worker/1.0" },
      redirect: "follow",
    });
    if (!res.ok) {
      return { title: "Fetch failed", excerpt: `HTTP ${res.status}` };
    }
    const text = await res.text();
    const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "Public incident page";
    const stripped = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const excerpt = stripped.slice(0, 500);
    return { title, excerpt };
  } catch (e: any) {
    return { title: "Error", excerpt: e.message };
  }
}

import { WORKER_URL } from "./constants";
import type { ServiceStatus, ClaimPreview } from "./types";

async function fetchWorker(path: string, options?: RequestInit): Promise<any> {
  if (!WORKER_URL) throw new Error("Worker URL not configured");
  const res = await fetch(`${WORKER_URL}${path}`, options);
  if (!res.ok) throw new Error(`Worker error: ${res.status}`);
  return res.json();
}

export async function getWorkerHealth(): Promise<{ ok: boolean }> {
  return fetchWorker("/health");
}

export async function getServices(): Promise<any[]> {
  const data = await fetchWorker("/services");
  return data.services;
}

export async function getServiceStatus(slug: string): Promise<ServiceStatus> {
  return fetchWorker(`/services/${slug}/status`);
}

export async function getServiceIncidents(slug: string): Promise<any> {
  return fetchWorker(`/services/${slug}/incidents`);
}

export async function getClaimPreview(body: {
  service_slug: string;
  incident_url: string;
  affected_component: string;
  claimed_start: number;
  claimed_end: number;
}): Promise<ClaimPreview> {
  return fetchWorker("/claim-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

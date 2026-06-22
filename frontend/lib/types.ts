export interface Pool {
  id: number;
  service_slug: string;
  service_name: string;
  covered_component: string;
  status_url: string;
  status: "active" | "paused";
  total_backing_wei: string;
  available_wei: string;
  locked_wei: string;
  premium_earned_wei: string;
  policy_count: number;
  claim_count: number;
  paid_count: number;
  denied_count: number;
  created_at: number;
}

export interface Policy {
  id: number;
  pool_id: number;
  holder: string;
  coverage_wei: string;
  premium_paid_wei: string;
  start_time: number;
  end_time: number;
  waiting_period_end: number;
  min_minutes: number;
  qualifying_tier: string;
  status: string;
  claim_id: number;
  created_at: number;
}

export interface Claim {
  id: number;
  policy_id: number;
  pool_id: number;
  claimant: string;
  incident_url: string;
  claimed_start: number;
  claimed_end: number;
  affected_component: string;
  claim_note: string;
  status: string;
  verdict: string;
  payout_band: string;
  payout_wei: string;
  reason_summary: string;
  reviewed_at: number;
  settled_at: number;
}

export interface ProtocolStats {
  pool_count: number;
  policy_count: number;
  claim_count: number;
}

export interface UnderwriterPosition {
  deposited_wei: string;
  withdrawn_wei: string;
  net_wei: string;
}

export interface ServiceStatus {
  slug: string;
  status: string;
  summary: string;
  fetched_at: string;
}

export interface ClaimPreview {
  ok: boolean;
  preview_only: boolean;
  service_slug: string;
  incident_url: string;
  evidence_title: string;
  evidence_excerpt: string;
  warnings: string[];
}

export interface TxRecord {
  hash: string;
  action: string;
  status: "pending" | "confirmed" | "failed";
  timestamp: number;
  relatedId?: number;
}

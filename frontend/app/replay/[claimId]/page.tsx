"use client";

import { useParams } from "next/navigation";
import { useClaim } from "@/hooks/useClaim";
import { usePolicy } from "@/hooks/usePolicy";
import { usePool } from "@/hooks/usePool";
import { weiToGen, formatTimestamp, statusColor } from "@/lib/format";

export default function ReplayPage() {
  const params = useParams();
  const claimId = params?.claimId ? parseInt(params.claimId as string) : null;
  const { claim, loading, error, refresh } = useClaim(claimId);
  const { policy } = usePolicy(claim?.policy_id ?? null);
  const { pool } = usePool(claim?.pool_id ?? null);

  if (loading) return <div className="text-muted-steel font-mono text-sm p-6">Loading claim...</div>;
  if (error) return <div className="text-failure-red p-6">{error}</div>;
  if (!claim) return <div className="text-muted-steel p-6">Claim not found</div>;

  const sections = [
    {
      title: "Incident Window",
      color: "border-incident-amber",
      items: [
        { label: "Incident URL", value: claim.incident_url, link: true },
        { label: "Claimed Start", value: formatTimestamp(claim.claimed_start) },
        { label: "Claimed End", value: formatTimestamp(claim.claimed_end) },
        { label: "Affected Component", value: claim.affected_component },
        { label: "Claim Note", value: claim.claim_note },
      ],
    },
    {
      title: "Policy Lock",
      color: "border-protocol-blue",
      items: [
        { label: "Policy ID", value: `#${claim.policy_id}` },
        { label: "Coverage", value: policy ? `${weiToGen(policy.coverage_wei)} GEN` : "—" },
        { label: "Policy Start", value: policy ? formatTimestamp(policy.start_time) : "—" },
        { label: "Policy End", value: policy ? formatTimestamp(policy.end_time) : "—" },
        { label: "Waiting Period End", value: policy ? formatTimestamp(policy.waiting_period_end) : "—" },
        { label: "Min Duration", value: policy ? `${policy.min_minutes} min` : "—" },
        { label: "Qualifying Tier", value: policy?.qualifying_tier || "—" },
      ],
    },
    {
      title: "Validator Trace",
      color: "border-consensus-violet",
      items: [
        { label: "Status", value: claim.status },
        { label: "Verdict", value: claim.verdict || "pending" },
        { label: "Payout Band", value: claim.payout_band || "pending" },
        { label: "Reason", value: claim.reason_summary || "—" },
        { label: "Reviewed At", value: formatTimestamp(claim.reviewed_at) },
      ],
    },
    {
      title: "Settlement Rail",
      color: "border-signal-green",
      items: [
        { label: "Payout", value: claim.payout_wei !== "0" ? `${weiToGen(claim.payout_wei)} GEN` : "—" },
        { label: "Settled At", value: formatTimestamp(claim.settled_at) },
        { label: "Pool", value: pool ? pool.service_name : `#${claim.pool_id}` },
      ],
    },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold">
            Black-Box Replay <span className="text-muted-steel">#{claimId}</span>
          </h2>
          <p className="text-sm text-muted-steel mt-1">Complete claim adjudication record</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-label text-xs uppercase ${statusColor(claim.status)}`}>
            {claim.status}
          </span>
          <button onClick={refresh} className="btn-secondary text-xs py-1 px-2">↻</button>
        </div>
      </div>

      {/* Settlement progress */}
      <div className="panel p-4">
        <div className="flex items-center gap-2">
          {["filed", "reviewing", "approved", "settled"].map((step, i) => {
            const steps = ["filed", "reviewing", "approved", "settled"];
            const currentIdx = steps.indexOf(claim.status);
            const deniedIdx = claim.status === "denied" ? 2 : -1;
            const active = i <= currentIdx || (claim.status === "denied" && i <= 1);
            const isDenied = claim.status === "denied" && i === 2;
            return (
              <div key={step} className="flex items-center gap-2 flex-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono ${
                    isDenied
                      ? "bg-failure-red/20 text-failure-red border border-failure-red/40"
                      : active
                      ? "bg-signal-green/20 text-signal-green border border-signal-green/40"
                      : "bg-panel-graphite text-muted-steel border border-panel-graphite"
                  }`}
                >
                  {i + 1}
                </div>
                {i < 3 && <div className={`flex-1 h-px ${active ? "bg-signal-green/40" : "bg-panel-graphite"}`} />}
              </div>
            );
          })}
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.title} className={`panel p-5 border-l-2 ${section.color}`}>
          <h3 className="font-heading font-semibold text-sm mb-3">{section.title}</h3>
          <div className="space-y-2">
            {section.items.map((item) => (
              <div key={item.label} className="flex justify-between items-start gap-4">
                <span className="label-text shrink-0">{item.label}</span>
                {(item as any).link ? (
                  <a href={item.value} target="_blank" rel="noopener noreferrer" className="text-xs text-protocol-blue hover:underline truncate text-right">
                    {item.value}
                  </a>
                ) : (
                  <span className="text-xs text-panel-white text-right truncate">{item.value}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

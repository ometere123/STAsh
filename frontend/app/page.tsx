import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="max-w-3xl mx-auto py-20">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-signal-green rounded-full shadow-[0_0_12px_rgba(56,252,166,0.6)]" />
          <span className="font-label text-xs text-muted-steel uppercase tracking-widest">
            Incident Settlement Protocol
          </span>
        </div>

        <h1 className="font-heading text-5xl font-bold leading-tight">
          Trustless outage cover
          <br />
          <span className="text-signal-green">for broken dependencies.</span>
        </h1>

        <p className="text-lg text-muted-steel max-w-xl leading-relaxed">
          SLAsh lets you buy fixed payout cover against qualifying outages from
          public internet dependencies. Validators settle claims from real public
          evidence, not screenshots, not oracles, not insurers.
        </p>

        <div className="flex gap-4 pt-4">
          <Link href="/radar" className="btn-primary text-base px-6 py-3">
            Open Radar
          </Link>
          <Link href="/coverage" className="btn-secondary text-base px-6 py-3">
            Buy Cover
          </Link>
        </div>
      </div>

      <div className="mt-20 grid grid-cols-3 gap-4">
        {[
          { metric: "5", label: "Covered Services", sub: "MVP" },
          { metric: "100%", label: "On-Chain Settlement", sub: "GenLayer" },
          { metric: "0", label: "Trusted Oracles", sub: "Public evidence only" },
        ].map((item) => (
          <div key={item.label} className="panel p-5">
            <div className="metric-large text-signal-green">{item.metric}</div>
            <div className="font-label text-xs text-muted-steel mt-1">{item.label}</div>
            <div className="text-xs text-panel-graphite mt-0.5">{item.sub}</div>
          </div>
        ))}
      </div>

      <div className="mt-16 panel p-6 diagonal-stripe">
        <div className="font-label text-xs text-incident-amber mb-3">HOW IT WORKS</div>
        <div className="grid grid-cols-5 gap-3 text-center">
          {[
            "Underwrite Pool",
            "Buy Cover",
            "File Claim",
            "Validator Review",
            "Settlement",
          ].map((step, i) => (
            <div key={step} className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full border border-signal-green/30 flex items-center justify-center font-mono text-sm text-signal-green">
                {i + 1}
              </div>
              <span className="font-label text-[10px] text-panel-white">{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

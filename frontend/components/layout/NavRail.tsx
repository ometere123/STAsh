"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const NAV_ITEMS = [
  { href: "/radar", label: "Radar", icon: "◉" },
  { href: "/coverage", label: "Coverage", icon: "◈" },
  { href: "/underwrite", label: "Underwrite", icon: "◆" },
  { href: "/claims", label: "Claims", icon: "◧" },
  { href: "/ledger", label: "Ledger", icon: "◫" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function NavRail() {
  const pathname = usePathname();

  return (
    <nav className="fixed left-0 top-0 h-full w-16 bg-rack-grey border-r border-panel-graphite flex flex-col items-center py-6 z-50">
      <Link
        href="/"
        className="text-signal-green font-heading font-bold text-lg mb-8 hover:opacity-80"
      >
        S/
      </Link>
      <div className="flex flex-col gap-2 flex-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "w-10 h-10 rounded flex items-center justify-center text-sm transition-colors relative group",
                active
                  ? "bg-signal-green/10 text-signal-green"
                  : "text-muted-steel hover:text-panel-white hover:bg-panel-graphite"
              )}
            >
              <span className="text-base">{item.icon}</span>
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-signal-green rounded-r" />
              )}
              <span className="absolute left-full ml-2 px-2 py-1 bg-panel-graphite text-panel-white text-xs font-label rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

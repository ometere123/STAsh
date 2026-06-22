import type { Metadata } from "next";
import "@/styles/globals.css";
import { WalletProvider } from "@/providers/WalletProvider";
import { TransactionProvider } from "@/providers/TransactionProvider";
import { NavRail } from "@/components/layout/NavRail";
import { TopBar } from "@/components/layout/TopBar";

export const metadata: Metadata = {
  title: "SLAsh — Trustless Outage Cover",
  description:
    "Fixed payout cover for developer-critical internet dependencies. Settled by GenLayer validators from public incident evidence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <WalletProvider>
          <TransactionProvider>
            <div className="flex min-h-screen">
              <NavRail />
              <div className="flex-1 ml-16">
                <TopBar />
                <main className="p-6">{children}</main>
              </div>
            </div>
          </TransactionProvider>
        </WalletProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./tokens.css";
import "./admin.css";
import { fraunces, interTight, jetbrainsMono } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "HLA Loan Manager",
  description: "Internal HomeLoanAgents pipeline, bot monitor and approvals.",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${interTight.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

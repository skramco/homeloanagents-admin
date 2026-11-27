"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useWorkspace } from "./Workspace";
import { APPROVALS, APPROVAL_OWNERS, ESCALATIONS, OUTBOUND, ROLES, ROLE_NOTES } from "@/lib/sample-data";

export function Sidebar({ loanCount }: { loanCount: number }) {
  const pathname = usePathname();
  const ws = useWorkspace();
  const openApprovals = APPROVALS.filter((a) => !ws.done[a.id]);
  const openOutbound = OUTBOUND.filter((o) => !ws.done[o.id]);
  const openEsc = ESCALATIONS.filter((e) => !ws.done[e.id]);

  const items = [
    { href: "/", label: "Pipeline", count: String(loanCount), hot: false },
    { href: "/approvals", label: "Mark’s approvals", count: String(openApprovals.length), hot: APPROVAL_OWNERS.includes(ws.role) && openApprovals.length > 0 },
    { href: "/outbound", label: "Outbound review", count: String(openOutbound.length), hot: openOutbound.some((o) => o.reviewer === ws.role) },
    { href: "/escalations", label: "Escalations", count: String(openEsc.length), hot: openEsc.some((e) => e.owners.includes(ws.role)) },
    { href: "/bots", label: "Bot monitor", count: "7 live", hot: false },
  ];

  const isActive = (href: string) => (href === "/" ? pathname === "/" || pathname.startsWith("/loans") : pathname.startsWith(href));

  return (
    <nav aria-label="Main" className="side">
      <Link href="/" className="brand">
        <Image src="/brand/homeloanagents-icon-color.svg" alt="" width={36} height={36} priority />
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="brand-name">
            HomeLoan<span>Agents</span>
          </span>
          <span className="brand-sub serif">Loan Manager</span>
        </span>
      </Link>
      {items.map((it) => (
        <Link key={it.href} href={it.href} className="nav-link" aria-current={isActive(it.href) ? "page" : undefined}>
          <span>{it.label}</span>
          <span className={it.hot ? "nav-count hot" : "nav-count"}>{it.count}</span>
        </Link>
      ))}
      <div className="roles">
        <span className="roles-label mono">Viewing as</span>
        <div className="btn-row" style={{ gap: 6 }}>
          {ROLES.map((r) => (
            <button key={r} type="button" className="chip sm" aria-pressed={ws.role === r} onClick={() => ws.setRole(r)}>
              {r}
            </button>
          ))}
        </div>
        <span className="roles-note">{ROLE_NOTES[ws.role]}</span>
      </div>
      <div className="side-foot">
        Sample data plus live voice-agent leads when Supabase is connected.{" "}
        <button type="button" onClick={ws.reset} style={{ background: "none", border: 0, padding: 0, color: "var(--emerald-200)", textDecoration: "underline", cursor: "pointer", fontSize: 12 }}>
          Reset demo
        </button>
      </div>
    </nav>
  );
}

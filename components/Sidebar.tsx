"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useWorkspace } from "./Workspace";
import { ROLES, ROLE_NOTES } from "@/lib/sample-data";

export function Sidebar({ loanCount }: { loanCount: number }) {
  const pathname = usePathname();
  const ws = useWorkspace();
  const items = [
    { href: "/", label: "Today", count: "", hot: false },
    { href: "/loans", label: "Loans", count: String(loanCount), hot: false },
    { href: "/inbox", label: "Inbox", count: "", hot: false },
    { href: "/bots", label: "Bots", count: "", hot: false },
  ];

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

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
          {it.count ? <span className={it.hot ? "nav-count hot" : "nav-count"}>{it.count}</span> : null}
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
        Real loans from Vesta plus voice-agent leads. A person oversees every bot message.
      </div>
    </nav>
  );
}

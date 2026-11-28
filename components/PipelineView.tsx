"use client";

import Link from "next/link";
import { useState } from "react";
import type { Loan } from "@/lib/types";
import { STAGE_SOURCES, STAGES } from "@/lib/sample-data";
import { HEALTH_LABEL } from "@/lib/loan-view";

type Filter = { kind: "all" } | { kind: "stage"; stage: number } | { kind: "trid" };

export function PipelineView({ loans, reviewedCount }: { loans: Loan[]; reviewedCount?: number | null }) {
  const [filter, setFilter] = useState<Filter>({ kind: "all" });

  const tridWarn = loans.filter((l) => l.tridState === "warn").length;
  const waiting = loans.filter((l) => l.health === "waiting").length;
  const attention = loans.filter((l) => l.health === "attention").length;
  void reviewedCount;

  const rows = loans.filter((l) => {
    if (filter.kind === "trid") return l.tridState === "warn";
    if (filter.kind === "stage") return l.stage === filter.stage;
    return true;
  });

  const kpis = [
    { label: "Needs attention", value: attention, sub: "Flagged in Vesta", color: "#A3261B", href: undefined as string | undefined, onClick: undefined as (() => void) | undefined },
    { label: "Waiting on the borrower", value: waiting, sub: "Open borrower tasks in Vesta", color: "#7A4A00" },
    { label: "TRID deadlines in 1 business day", value: tridWarn, sub: "Click to show them", color: "#7A4A00", onClick: () => setFilter({ kind: "trid" }) },
  ];

  return (
    <div className="stack" style={{ gap: 20 }}>
      <header className="page-head">
        <h1>Loans</h1>
        <span className="muted">Every HomeLoanAgents file, from the first call to the xAI voice agent (or a web, text or email chat) to funding in Vesta.</span>
      </header>

      <div className="grid-auto">
        {kpis.map((k) => {
          const body = (
            <>
              <span className="kpi-label">{k.label}</span>
              <span className="kpi-value" style={{ color: k.color }}>{k.value}</span>
              <span className="small muted">{k.sub}</span>
            </>
          );
          return k.href ? (
            <Link key={k.label} href={k.href} className="kpi">{body}</Link>
          ) : (
            <button key={k.label} type="button" className="kpi" onClick={k.onClick}>{body}</button>
          );
        })}
      </div>

      <div className="card">
        <span className="section-label mono">Stages · click to filter</span>
        <div className="btn-row">
          <button type="button" className="chip" aria-pressed={filter.kind === "all"} onClick={() => setFilter({ kind: "all" })}>
            All <strong>{loans.length}</strong>
          </button>
          {STAGES.map((s, i) => (
            <button key={s} type="button" className="chip" aria-pressed={filter.kind === "stage" && filter.stage === i} onClick={() => setFilter({ kind: "stage", stage: i })}>
              {s} <strong>{loans.filter((l) => l.stage === i).length}</strong>
            </button>
          ))}
          {filter.kind === "trid" ? <span className="pill warn" style={{ alignSelf: "center" }}>Showing TRID deadlines in 1 business day</span> : null}
        </div>
      </div>

      <div className="table-box">
        <div className="table-inner">
          <div className="trow head">
            <span>Borrower · loan</span><span>Stage</span><span>Waiting on</span><span>Bot working it</span><span>Owner · last contact</span><span>Health</span>
          </div>
          {rows.length === 0 ? <div className="trow" style={{ display: "block" }}><span className="muted">No files to show.</span></div> : null}
          {rows.map((l) => (
            <Link key={l.id} href={`/loans/${l.id}`} className="trow" aria-label={`Open loan file for ${l.name}`}>
              <span className="cell-col">
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                  {l.source === "call_leads" ? <span className="live-dot" title="Live voice-agent lead" /> : null}
                  {l.name}
                  <span className="state-tag">{l.state}</span>
                </span>
                <span className="small muted">{l.purpose} · {l.amount} · {l.program}</span>
              </span>
              <span className="cell-col" style={{ gap: 6 }}>
                <span className="segs">
                  {STAGES.map((s, i) => (
                    <span key={s} className={i < l.stage ? "seg done" : i === l.stage ? "seg current" : "seg"} />
                  ))}
                </span>
                <span className="small" style={{ fontWeight: 600 }}>
                  {STAGES[l.stage]} <span className="muted" style={{ fontWeight: 400 }}>· {STAGE_SOURCES[l.stage]}</span>
                </span>
              </span>
              <span>{l.waiting}</span>
              <span className="cell-col" style={{ gap: 4 }}>
                <span className="ai-tag">{l.bot}</span>
                <span className="small" style={{ color: "var(--ink-700)" }}>{l.botNow}</span>
              </span>
              <span className="cell-col small">
                <span style={{ fontWeight: 600 }}>{l.owner}</span>
                <span style={{ color: "var(--ink-700)" }}>{l.lastContact}</span>
              </span>
              <span><span className={`pill ${l.health}`}>{HEALTH_LABEL[l.health]}</span></span>
            </Link>
          ))}
          {rows.length === 0 ? <div style={{ padding: "24px 16px" }} className="muted">No files match this filter.</div> : null}
        </div>
      </div>
    </div>
  );
}

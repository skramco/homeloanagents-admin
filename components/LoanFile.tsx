"use client";

import Link from "next/link";
import { useState } from "react";
import type { Loan } from "@/lib/types";
import { STAGE_SOURCES, STAGES } from "@/lib/sample-data";
import { HEALTH_LABEL } from "@/lib/loan-view";
import type { LoanTimeline } from "@/lib/timeline";
import { Timeline } from "./LoanTimeline";
import { VestaDetails } from "./VestaDetails";
import type { VestaLoanDetail } from "@/lib/vesta/loan";

type Tab = "timeline" | "vesta" | "overview";
const TABS: { id: Tab; label: string }[] = [
  { id: "timeline", label: "Bots & timeline" },
  { id: "vesta", label: "Vesta details" },
  { id: "overview", label: "Status & conditions" },
];

export function LoanFile({ loan: l, vesta, timeline }: { loan: Loan; vesta?: VestaLoanDetail | null; timeline: LoanTimeline }) {
  const [tab, setTab] = useState<Tab>("timeline");
  const tabs = vesta ? TABS : TABS.filter((t) => t.id !== "vesta");
  const consents = [
    { label: "AI disclosure", ok: l.consent.aiDisclosure },
    { label: "TCPA consent (calls + texts)", ok: l.consent.tcpa },
    { label: "E-SIGN consent", ok: l.consent.esign },
    { label: "Call recording consent", ok: l.consent.recording },
  ];
  const openConditions = l.conditions.filter((c) => c.status === "Open").length;

  return (
    <div className="stack">
      <div>
        <Link href="/loans" className="btn link" style={{ paddingLeft: 0, textDecoration: "none" }}>Back to loans</Link>
      </div>

      <header className="card" style={{ padding: "18px 20px", gap: 14 }}>
        <div className="btn-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div className="cell-col" style={{ gap: 4 }}>
            <div className="btn-row" style={{ alignItems: "center" }}>
              <h1 style={{ fontSize: 22 }}>{l.name}</h1>
              <span className={`pill ${l.health}`}>{HEALTH_LABEL[l.health]}</span>
              {l.source === "call_leads" ? <span className="pill info">Live voice-agent lead</span> : null}
              {l.source === "vesta" ? <span className="pill info">Live from Vesta</span> : null}
            </div>
            <span className="muted">{l.purpose} · {l.amount} · {l.program} · {l.state} · Vesta {l.vesta}</span>
            {l.phone || l.email ? <span className="small muted">{[l.phone, l.email].filter(Boolean).join(" · ")}</span> : null}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(120px, auto))", gap: "4px 24px", fontSize: 12 }}>
            <span className="muted">Rate / lock</span><span className="muted">Target closing</span><span className="muted">Owner</span>
            <strong>{l.lock}</strong><strong>{l.closing || "Not set"}</strong><strong>{l.owner}</strong>
          </div>
        </div>
        <div className="btn-row" style={{ alignItems: "center" }}>
          {consents.map((c) => (
            <span key={c.label} className={c.ok === null ? "pill muted" : c.ok ? "pill ok" : "pill attention"}>
              {c.label}: {c.ok === null ? "not tracked yet" : c.ok ? "yes" : "missing"}
            </span>
          ))}
          <span className={`pill ${l.tridState}`}>TRID: {l.trid}</span>
        </div>
      </header>

      <div className="tracker">
        <div className="tracker-inner">
          {STAGES.map((s, i) => (
            <div key={s} className={i < l.stage ? "step done" : i === l.stage ? "step current" : "step"}>
              <div className="step-line"><span className="step-dot" /><span className="step-bar" /></div>
              <span className="step-name">{s}</span>
              <span className="small muted" style={{ fontSize: 11 }}>{STAGE_SOURCES[i]}</span>
              <span style={{ fontSize: 11, color: "var(--ink-700)" }}>{i <= l.stage ? l.dates[i] ?? "" : ""}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="row-wrap">
        <div className="stack" style={{ flex: "999 1 560px", minWidth: 0 }}>
          <div role="tablist" aria-label="Loan file sections" className="tabs">
            {tabs.map((t) => (
              <button key={t.id} type="button" role="tab" className="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>

          {tab === "vesta" && vesta ? <VestaDetails d={vesta} /> : null}

          {tab === "overview" ? (
            <div className="stack">
              <section className="card facts">
                <div className="fact"><span className="small muted">Stage</span><strong>{STAGES[l.stage]} ({STAGE_SOURCES[l.stage]})</strong></div>
                <div className="fact"><span className="small muted">Waiting on</span><strong>{l.waiting}</strong></div>
                <div className="fact"><span className="small muted">Bot working it now</span><span className="ai-tag">{l.bot}</span><span style={{ fontSize: 13 }}>{l.botNow}</span></div>
              </section>
              {l.facts && l.facts.length > 0 ? (
                <section className="card">
                  <h2>From Vesta</h2>
                  <div className="facts">
                    {l.facts.map((x) => (
                      <div key={x.label} className="fact"><span className="small muted">{x.label}</span><strong>{x.value}</strong></div>
                    ))}
                  </div>
                </section>
              ) : null}
              {l.callSummary ? (
                <section className="card">
                  <h2>Voice agent call summary</h2>
                  <span style={{ whiteSpace: "pre-line" }}>{l.callSummary}</span>
                </section>
              ) : null}
              <section className="card">
                <h2>Conditions from Vesta <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>· {openConditions} open</span></h2>
                {l.conditions.map((c) => (
                  <div key={c.text} className="line-item" style={{ gridTemplateColumns: "minmax(0, 1fr) 150px 96px", alignItems: "center" }}>
                    <span>{c.text}</span>
                    <span className="small muted">{c.owner}</span>
                    <span><span className={c.status === "Open" ? "pill waiting" : c.status === "Received" ? "pill info" : "pill ok"}>{c.status}</span></span>
                  </div>
                ))}
                {l.conditions.length === 0 ? <span className="muted">No conditions yet. They appear once the application is in Vesta and underwriting issues them.</span> : null}
              </section>
            </div>
          ) : null}

          {tab === "timeline" ? <Timeline loan={l} t={timeline} /> : null}
        </div>

      </div>
    </div>
  );
}

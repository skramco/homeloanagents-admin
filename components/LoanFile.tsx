"use client";

import Link from "next/link";
import { useState } from "react";
import type { Loan } from "@/lib/types";
import { STAGE_SOURCES, STAGES } from "@/lib/sample-data";
import { HEALTH_LABEL, botFeed, commsLog, coverage, firstName } from "@/lib/loan-view";
import { useWorkspace } from "./Workspace";
import { BotChat } from "./BotChat";

type Tab = "overview" | "bots" | "comms" | "audit";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Status & conditions" },
  { id: "bots", label: "Bot activity" },
  { id: "comms", label: "Borrower communication" },
  { id: "audit", label: "Audit log" },
];
const CHANNELS = ["Text", "Email", "Voice agent call"] as const;
const TEMPLATES = ["Status update", "Request missing items", "eSign reminder", "Book a call with a processor"];

export function LoanFile({ loan: l }: { loan: Loan }) {
  const ws = useWorkspace();
  const [tab, setTab] = useState<Tab>("overview");
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("Text");
  const f = firstName(l.name);
  const feed = botFeed(l);
  const consents = [
    { label: "AI disclosure", ok: l.consent.aiDisclosure },
    { label: "TCPA consent (calls + texts)", ok: l.consent.tcpa },
    { label: "E-SIGN consent", ok: l.consent.esign },
    { label: "Call recording consent", ok: l.consent.recording },
  ];
  const openConditions = l.conditions.filter((c) => c.status === "Open").length;
  const sent = ws.sent[l.id] ?? [];

  const audit = feed.flatMap((x) => [
    { when: x.when, actor: `${x.bot} bot · prompt v0.4`, what: x.text },
    { when: x.when, actor: "Compliance monitor · v0.4", what: "Checked outbound message, footer added, passed" },
  ]);
  if (l.stage > 3 && l.source !== "vesta") audit.push({ when: l.dates[3] ?? "", actor: "Mark (MLO)", what: "Approved quote options by email" });

  return (
    <div className="stack">
      <div>
        <Link href="/" className="btn link" style={{ paddingLeft: 0, textDecoration: "none" }}>Back to pipeline</Link>
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
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" className="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>

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

          {tab === "bots" ? (
            <section className="card" style={{ gap: 0 }}>
              <h2 style={{ marginBottom: 10 }}>What the bots have done on this file</h2>
              {feed.length === 0 ? <span className="muted">No bot activity on this file yet. The bots are not connected to Vesta files so far.</span> : null}
              {feed.map((x, i) => (
                <div key={i} className="line-item" style={{ gridTemplateColumns: "70px 14px minmax(0, 1fr)" }}>
                  <span className="small muted">{x.when}</span>
                  <span className={x.tone === "done" ? "dot" : x.tone === "alert" ? "dot alert" : "dot now"} />
                  <span className="cell-col">
                    <span className="small"><span className="bot-name">{x.bot}</span> <span className="muted">· {x.kind}</span></span>
                    <span>{x.text}</span>
                  </span>
                </div>
              ))}
            </section>
          ) : null}

          {tab === "comms" ? (
            <div className="stack">
              <section className="card" style={{ gap: 12 }}>
                <h2>Reach out to {f}</h2>
                <div className="btn-row" style={{ alignItems: "center", gap: 6 }}>
                  <span className="small muted" style={{ marginRight: 4 }}>Send by</span>
                  {CHANNELS.map((c) => (
                    <button key={c} type="button" className="chip" aria-pressed={channel === c} onClick={() => setChannel(c)}>{c}</button>
                  ))}
                </div>
                <div className="btn-row">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="btn"
                      onClick={() => {
                        ws.addSent(l.id, { when: "Just now", channel, who: `Drafted by bot, requested by ${ws.role}`, text: `${t} to ${f}. Passed the Compliance monitor; waiting in Outbound review.` });
                        ws.flash(`${t} drafted for ${f} and sent to Outbound review.`);
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <span className="small muted">The bot drafts it from the file, the Compliance monitor checks it and adds the DBA and NMLS footer, and it lands in Outbound review. A rate or payment in the message sends it to Mark instead.</span>
              </section>
              <section className="card" style={{ gap: 8 }}>
                <h2>Milestone updates <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>· did the borrower hear from us at every step?</span></h2>
                {coverage(l).length === 0 ? <span className="muted">Not tracked yet for Vesta files. This fills in once messages go through the app.</span> : null}
                {coverage(l).map((c) => (
                  <div key={c.stage} className="btn-row" style={{ justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #EFEBE2", fontSize: 13 }}>
                    <span><span className="small muted">{c.stage} · </span>{c.text}</span>
                    <span className={c.missing ? "pill attention" : "pill ok"}>{c.status}</span>
                  </div>
                ))}
              </section>
              <section className="card" style={{ gap: 0 }}>
                <h2 style={{ marginBottom: 10 }}>Calls, texts, emails and portal chats</h2>
                {sent.length === 0 && commsLog(l).length === 0 ? <span className="muted">No calls, texts or emails logged for this file yet.</span> : null}
                {[...sent.map((m) => ({ ...m, dir: "In review" })), ...commsLog(l)].map((m, i) => (
                  <div key={i} className="line-item" style={{ gridTemplateColumns: "90px 110px minmax(0, 1fr)" }}>
                    <span className="small muted">{m.when}</span>
                    <span className="small" style={{ fontWeight: 600 }}>{m.channel}<span className="muted" style={{ display: "block", fontWeight: 400 }}>{m.dir}</span></span>
                    <span className="cell-col"><span className="small bot-name">{m.who}</span><span>{m.text}</span></span>
                  </div>
                ))}
              </section>
            </div>
          ) : null}

          {tab === "audit" ? (
            <section className="card" style={{ gap: 0, overflowX: "auto" }}>
              <h2>Audit log</h2>
              <span className="small muted" style={{ marginBottom: 10 }}>Read-only. Every bot message, call recording, prompt version and approval, tied to Vesta {l.vesta}.</span>
              {audit.length === 0 ? <span className="muted">Nothing recorded yet.</span> : null}
              <div style={{ minWidth: 620 }}>
                {audit.map((a, i) => (
                  <div key={i} className="line-item" style={{ gridTemplateColumns: "80px 200px minmax(0, 1fr)" }}>
                    <span className="small muted">{a.when}</span>
                    <span className="small mono" style={{ fontWeight: 600 }}>{a.actor}</span>
                    <span>{a.what}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <BotChat loan={l} />
      </div>
    </div>
  );
}

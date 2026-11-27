"use client";

import Link from "next/link";
import { APPROVAL_OWNERS, APPROVALS, BOTS, ESCALATIONS, OUTBOUND } from "@/lib/sample-data";
import { firstName } from "@/lib/loan-view";
import type { Loan } from "@/lib/types";
import { useWorkspace } from "./Workspace";

type LoanIndex = Record<string, Pick<Loan, "id" | "name" | "state" | "bot" | "botNow">>;

const DISCLOSURE_FOOTER =
  "HomeLoanAgents is a DBA of United Fidelity Funding · NMLS [UFF ID] · Mark NMLS [ID] · NMLS Consumer Access · CA/TX/FL licenses · Equal Housing Opportunity";

export function ApprovalsView({ loans }: { loans: LoanIndex }) {
  const ws = useWorkspace();
  const open = APPROVALS.filter((a) => !ws.done[a.id]);
  const canApprove = APPROVAL_OWNERS.includes(ws.role);
  return (
    <div className="stack">
      <header className="page-head">
        <h1>Mark’s approvals</h1>
        <span className="muted">Only a licensed MLO can approve these. Target: same business day. Lorinn is backup only if she holds MLO licenses in CA, TX and FL.</span>
      </header>
      {!canApprove ? <div className="banner warn">You are viewing as {ws.role}. Only Mark (or a licensed backup) can act on these.</div> : null}
      {open.map((a) => {
        const l = loans[a.loanId];
        return (
          <div key={a.id} className="card">
            <div className="btn-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <span className="btn-row" style={{ alignItems: "center" }}>
                <span className={a.type === "Quote" ? "pill info" : a.type === "Lock extension" ? "pill warn" : "pill muted"}>{a.type}</span>
                <strong>{l?.name}</strong>
                <span className="small muted">{l?.state} · drafted by <span className="bot-name">{a.bot}</span></span>
              </span>
              <span className="small muted">Waiting {a.waited}</span>
            </div>
            <span style={{ fontSize: 14 }}>{a.detail}</span>
            {a.preview ? <div className="preview">{a.preview}</div> : null}
            <div className="btn-row">
              <button type="button" className="btn primary" disabled={!canApprove} onClick={() => ws.close(a.id, `${a.approveLabel} for ${l?.name}. Logged to the audit trail.`)}>{a.approveLabel}</button>
              <button type="button" className="btn" disabled={!canApprove} onClick={() => ws.close(a.id, `${a.reviseLabel}: sent back to the ${a.bot} bot.`)}>{a.reviseLabel}</button>
              <Link href={`/loans/${a.loanId}`} className="btn link">Open file</Link>
            </div>
          </div>
        );
      })}
      {open.length === 0 ? <span className="muted">Nothing waiting for approval.</span> : null}
    </div>
  );
}

export function OutboundView({ loans }: { loans: LoanIndex }) {
  const ws = useWorkspace();
  const open = OUTBOUND.filter((o) => !ws.done[o.id]);
  return (
    <div className="stack">
      <header className="page-head">
        <h1>Outbound review</h1>
        <span className="muted">Every bot message passes the Compliance monitor, then a processor reads it before it goes out. After 4 weeks under the error target this moves to sampled review.</span>
      </header>
      {open.map((o) => {
        const l = loans[o.loanId];
        const mine = o.reviewer === ws.role;
        const blocked = o.monitor === "blocked";
        return (
          <div key={o.id} className={mine ? "card mine" : "card"}>
            <div className="btn-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <span className="small muted">
                <span className="bot-name">{o.bot}</span> · {o.channel} to {l?.name} ({l?.state}) · reviewer: {o.reviewer}
                {mine ? <span className="yours">Yours</span> : null}
              </span>
              <span className={`pill ${o.monitor}`}>Monitor: {o.monitor}</span>
            </div>
            <div className="preview">
              <span>{o.text}</span>
              <span className="footer-note">{DISCLOSURE_FOOTER}</span>
            </div>
            {o.note ? <span style={{ fontSize: 13, color: "#A3261B" }}>{o.note}</span> : null}
            <div className="btn-row">
              {blocked ? (
                <>
                  <button type="button" className="btn primary" onClick={() => ws.close(o.id, `Sent back to the ${o.bot} bot to rewrite.`)}>Have the bot rewrite it</button>
                  <button type="button" className="btn" onClick={() => ws.close(o.id, "Moved to Mark’s approvals.")}>Send to Mark for approval</button>
                </>
              ) : (
                <>
                  <button type="button" className="btn primary" onClick={() => ws.close(o.id, `Sent to ${firstName(l?.name ?? "")} by ${o.channel.toLowerCase()}.`)}>Send</button>
                  <button type="button" className="btn" onClick={() => ws.close(o.id, "Edited and sent. Counted toward the processor-edit KPI.", { edited: true })}>Edit, then send</button>
                </>
              )}
              <button type="button" className="btn link" onClick={() => ws.close(o.id, "Held. The Dispatcher will bring it back tomorrow.")}>Hold</button>
            </div>
          </div>
        );
      })}
      {open.length === 0 ? <span className="muted">Nothing waiting for review.</span> : null}
    </div>
  );
}

export function EscalationsView({ loans }: { loans: LoanIndex }) {
  const ws = useWorkspace();
  const open = ESCALATIONS.filter((e) => !ws.done[e.id]);
  return (
    <div className="stack">
      <header className="page-head">
        <h1>Escalations</h1>
        <span className="muted">The Dispatcher routes each one by the game plan’s escalation rules. Items for the person you are viewing as are marked.</span>
      </header>
      {open.map((e) => {
        const l = loans[e.loanId];
        const mine = e.owners.includes(ws.role);
        return (
          <div key={e.id} className={mine ? "card mine" : "card"}>
            <div className="btn-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <span className="btn-row" style={{ alignItems: "center" }}>
                <strong>{l?.name}</strong>
                <span className="small muted">{l?.state} · {e.when}</span>
                {mine ? <span className="yours">Yours</span> : null}
              </span>
              <span className="small" style={{ fontWeight: 600, color: "var(--emerald-800)" }}>Routed to {e.routeTo}</span>
            </div>
            <span style={{ fontSize: 14 }}>{e.text}</span>
            <span className="small muted">Rule: {e.rule}</span>
            <div className="btn-row">
              <button type="button" className="btn primary" onClick={() => ws.close(e.id, `Marked handled on ${l?.name}’s file.`)}>Mark handled</button>
              <Link href={`/loans/${e.loanId}`} className="btn">Open file</Link>
            </div>
          </div>
        );
      })}
      {open.length === 0 ? <span className="muted">No open escalations.</span> : null}
    </div>
  );
}

export function BotsView({ loans }: { loans: Loan[] }) {
  const ws = useWorkspace();
  const flagged = OUTBOUND.filter((o) => o.monitor !== "passed").length;
  const openEsc = ESCALATIONS.filter((e) => !ws.done[e.id]).length;
  return (
    <div className="stack" style={{ gap: 20 }}>
      <header className="page-head">
        <h1>Bot monitor</h1>
        <span className="muted">The 12-bot roster: 7 live in the MVP, the rest switch on during controlled scale. Each card shows what the bot may and may not do.</span>
      </header>
      <div className="grid-auto" style={{ ["--min" as string]: "280px" }}>
        {BOTS.map((b) => {
          const paused = !!ws.paused[b.name];
          const mine = loans.filter((l) => l.bot === b.name);
          const queued =
            b.name === "Compliance / QC monitor" ? flagged : b.name === "Dispatcher / oversight" ? openEsc : OUTBOUND.filter((o) => o.bot === b.name && !ws.done[o.id]).length;
          const queuedLabel = b.name === "Compliance / QC monitor" ? "blocked or flagged" : b.name === "Dispatcher / oversight" ? "escalations routed" : "messages in review";
          return (
            <div key={b.name} className={b.mvp ? "card" : "card ghost"}>
              <div className="btn-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>
                  <span className="bot-name" style={{ marginRight: 6 }}>{b.n}</span>
                  {b.name}
                </span>
                <span className={!b.mvp ? "pill muted" : paused ? "pill warn" : "pill ok"}>{!b.mvp ? "Phase 2" : paused ? "Paused" : "Live"}</span>
              </div>
              <span style={{ fontSize: 13, color: "var(--ink-700)" }}>{b.does}</span>
              <span className="small" style={{ color: "#A3261B" }}><strong>Can’t:</strong> {b.cant}</span>
              {b.mvp ? (
                <>
                  <div className="btn-row small muted" style={{ gap: 18 }}>
                    <span><strong style={{ color: "var(--text)", fontSize: 16 }}>{mine.length}</strong> files active</span>
                    <span><strong style={{ color: "var(--text)", fontSize: 16 }}>{queued}</strong> {queuedLabel}</span>
                  </div>
                  <span className="small muted">Latest: {mine[0] ? `${mine[0].botNow} (${mine[0].name})` : "Running across all files"}</span>
                  <button
                    type="button"
                    className="btn"
                    style={{ alignSelf: "flex-start", minHeight: 36 }}
                    onClick={() => {
                      ws.togglePause(b.name);
                      ws.flash(`${b.name} ${paused ? "resumed" : "paused. Its work goes to the processor queues"}.`);
                    }}
                  >
                    {paused ? "Resume" : "Pause"}
                  </button>
                </>
              ) : (
                <span className="small" style={{ background: "var(--paper)", borderRadius: 6, padding: "6px 8px", color: "var(--ink-600)" }}>{b.note}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

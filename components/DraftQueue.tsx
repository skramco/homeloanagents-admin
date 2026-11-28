"use client";

import Link from "next/link";
import { useState } from "react";
import type { Draft, DraftResult, TaskType } from "@/lib/drafts";
import { useWorkspace, type ReviewTally } from "./Workspace";

const FOOTER =
  "HomeLoanAgents is a DBA of United Fidelity Funding · NMLS [UFF ID] · Mark NMLS [ID] · NMLS Consumer Access · CA/TX/FL licenses · Equal Housing Opportunity";

// Path to automatic: 95% approved without edits over the last 50 drafts of a type.
const WINDOW = 50;
const TARGET = 0.95;

function Readiness({ type, t }: { type: string; t?: ReviewTally }) {
  const recent = t?.recent ?? [];
  const clean = recent.filter((o) => o === "approved").length;
  const rate = recent.length ? clean / recent.length : 0;
  const ready = recent.length >= WINDOW && rate >= TARGET;
  return (
    <div className="kpi" style={{ cursor: "default" }}>
      <span className="kpi-label">{type}</span>
      <span className="kpi-value" style={{ fontSize: 22 }}>{recent.length ? `${Math.round(rate * 100)}%` : "—"}</span>
      <span className="small muted">
        approved as written · {recent.length}/{WINDOW} reviewed
      </span>
      <span className="small muted">
        {t ? `${t.approved} approved · ${t.edited} edited · ${t.rejected} rejected` : "No reviews yet"}
      </span>
      <span className={ready ? "pill ok" : "pill muted"} style={{ alignSelf: "flex-start", marginTop: 4 }}>
        {ready ? "Ready for Mark to make automatic" : "Human review"}
      </span>
    </div>
  );
}

function DraftCard({ d, loanName }: { d: Draft; loanName: string }) {
  const ws = useWorkspace();
  const [text, setText] = useState(d.body);
  const [editing, setEditing] = useState(false);
  const mine = d.reviewer === ws.role || (d.monitor === "flagged" && ws.role === "Mark");
  const changed = text.trim() !== d.body.trim();
  const blocked = d.monitor === "blocked";
  const needsMark = d.monitor === "flagged";
  return (
    <div className={mine ? "card mine" : "card"}>
      <div className="btn-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <span className="small muted">
          <span className="pill info" style={{ marginRight: 6 }}>{d.taskType}</span>
          <span className="bot-name">{d.bot}</span> · {d.channel} to{" "}
          <Link href={`/loans/${d.loanId}`}>{loanName}</Link> {d.to ? `(${d.to})` : ""} · reviewer: {needsMark ? "Mark" : d.reviewer}
          {mine ? <span className="yours">Yours</span> : null}
        </span>
        <span className={`pill ${d.monitor}`}>Monitor: {d.monitor}</span>
      </div>
      <div className="preview">
        <strong>{d.subject}</strong>
        {editing ? (
          <textarea className="input" style={{ minHeight: 220, fontFamily: "inherit", lineHeight: 1.45 }} value={text} onChange={(e) => setText(e.target.value)} aria-label="Edit draft" />
        ) : (
          <span>{text}</span>
        )}
        <span className="footer-note">{FOOTER}</span>
      </div>
      {d.note ? <span style={{ fontSize: 13, color: "#A3261B" }}>{d.note}</span> : null}
      <div className="btn-row">
        <button
          type="button"
          className="btn primary"
          disabled={blocked || (needsMark && ws.role !== "Mark")}
          title={needsMark && ws.role !== "Mark" ? "Only Mark can approve pricing language" : undefined}
          onClick={() =>
            ws.review(d.id, d.taskType, changed ? "edited" : "approved", changed ? "Edited and approved. The edit is saved as training data." : "Approved as written.")
          }
        >
          {changed ? "Approve with my edits" : "Approve"}
        </button>
        <button type="button" className="btn" onClick={() => setEditing((e) => !e)}>{editing ? "Done editing" : "Edit"}</button>
        <button type="button" className="btn" onClick={() => ws.review(d.id, d.taskType, "rejected", "Rejected. The bot will learn from it.")}>Reject</button>
      </div>
    </div>
  );
}

export function DraftQueue({ result, loanNames }: { result: DraftResult; loanNames: Record<string, string> }) {
  const ws = useWorkspace();
  const [type, setType] = useState<TaskType | "all">("all");
  const open = result.drafts.filter((d) => !ws.done[d.id] && (type === "all" || d.taskType === type));
  const types = Array.from(new Set(result.drafts.map((d) => d.taskType)));
  return (
    <div className="stack">
      <header className="page-head">
        <h1>Outbound review</h1>
        <span className="muted">
          The bots draft every borrower message from live Vesta data. Nothing goes out until a person approves it. Each approve, edit or reject counts toward that message type going automatic.
        </span>
      </header>
      <div className="banner warn">
        Approving doesn’t send anything yet. Sending (email and text) and saving reviews to the audit log come next. For now, reviews are kept in this browser.
      </div>
      {result.errors.length ? <div className="banner warn">Some loans couldn’t be drafted: {result.errors.slice(0, 3).join(" · ")}</div> : null}

      <section className="stack" style={{ gap: 8 }}>
        <span className="section-label">Path to automatic · 95% approved as written over the last {WINDOW}</span>
        <div className="grid-auto" style={{ ["--min" as string]: "220px" }}>
          {(["Daily update", "Condition request"] as TaskType[]).map((t) => (
            <Readiness key={t} type={t} t={ws.reviews[t]} />
          ))}
        </div>
      </section>

      <div className="btn-row" style={{ alignItems: "center" }}>
        <button type="button" className="chip" aria-pressed={type === "all"} onClick={() => setType("all")}>All {result.drafts.filter((d) => !ws.done[d.id]).length}</button>
        {types.map((t) => (
          <button key={t} type="button" className="chip" aria-pressed={type === t} onClick={() => setType(t)}>
            {t} {result.drafts.filter((d) => d.taskType === t && !ws.done[d.id]).length}
          </button>
        ))}
        <span className="small muted">
          Drafted from {result.checked} active Vesta loan{result.checked === 1 ? "" : "s"}
          {result.skipped ? ` (${result.skipped} more not drafted yet)` : ""}.
        </span>
      </div>

      {open.length === 0 ? <div className="card ghost"><span className="muted">Nothing waiting for review.</span></div> : null}
      {open.map((d) => (
        <DraftCard key={d.id} d={d} loanName={loanNames[d.loanId] ?? "Loan"} />
      ))}
    </div>
  );
}

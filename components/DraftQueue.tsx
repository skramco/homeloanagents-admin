"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { retrySend, submitReview } from "@/app/(app)/review-actions";
import type { SavedReviews } from "@/lib/reviews";
import type { Draft, DraftResult, TaskType } from "@/lib/drafts";
import { useWorkspace, type ReviewOutcome, type ReviewTally } from "./Workspace";

/** What the server says about sending, for the banner and the footer preview. */
export type SendInfo = { enabled: boolean; footer: string | null; smsFooter: string; testOnly: boolean };

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

function DraftCard({ d, loanName, send, saved }: { d: Draft; loanName: string; send: SendInfo; saved: boolean }) {
  const ws = useWorkspace();
  const [text, setText] = useState(d.body);
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const decide = (outcome: ReviewOutcome, message: string) =>
    start(async () => {
      setError(null);
      let r: Awaited<ReturnType<typeof submitReview>>;
      try {
        r = await submitReview(d, outcome, text, reason);
      } catch (err) {
        setError(actionError(err));
        return;
      }
      if (!r.ok) {
        setError(r.error);
        return;
      }
      ws.review(d.id, d.taskType, outcome, r.sent ? `${message} Sent to ${d.to}.` : r.note ? `${message} ${r.note}` : message);
      if (r.saved) router.refresh();
    });
  const mine = d.reviewer === ws.role || (d.monitor === "flagged" && ws.role === "Mark");
  const changed = text.trim() !== d.body.trim();
  const blocked = d.monitor === "blocked";
  const needsMark = d.monitor === "flagged";
  return (
    <div className={mine ? "card mine" : "card"}>
      <div className="btn-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <span className="small muted">
          <span className="pill info" style={{ marginRight: 6 }}>{d.taskType}</span>
          <span className="bot-name">{d.bot}</span>
          {d.writtenBy === "grok" ? <span className="pill info" style={{ marginLeft: 6 }}>Written by Grok</span> : null}
          {d.writtenBy === "template" && d.writtenNote ? <span className="pill muted" style={{ marginLeft: 6 }} title={d.writtenNote}>Template ({d.writtenNote})</span> : null}{" "}
          · {d.channel} to{" "}
          {d.loanId ? <Link href={`/loans/${d.loanId}`}>{loanName}</Link> : "unmatched sender"} {d.to ? `(${d.to})` : ""} · reviewer: {needsMark ? "Mark" : d.reviewer}
          {mine ? <span className="yours">Yours</span> : null}
        </span>
        <span className={`pill ${d.monitor}`}>Monitor: {d.monitor}</span>
      </div>
      {d.inbound ? (
        <div className="preview" style={{ background: "var(--paper, #FBF9F4)" }}>
          <span className="small muted">
            {d.inbound.channel} from {d.inbound.from} · {new Date(d.inbound.at).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            {d.inbound.subject ? ` · ${d.inbound.subject}` : ""}
          </span>
          <span style={{ whiteSpace: "pre-line" }}>{d.inbound.text}</span>
          <span className={d.loanId && !/^Matches/.test(d.inbound.match) ? "pill ok" : "pill warn"} style={{ alignSelf: "flex-start" }}>
            {d.loanId && !/^Matches/.test(d.inbound.match) ? `Matched: ${d.inbound.match}` : d.inbound.match}
          </span>
        </div>
      ) : null}
      <div className="preview">
        {d.subject ? <strong>{d.subject}</strong> : <span className="small muted">Text reply</span>}
        {editing ? (
          <textarea className="input" style={{ minHeight: 220, fontFamily: "inherit", lineHeight: 1.45 }} value={text} onChange={(e) => setText(e.target.value)} aria-label="Edit draft" />
        ) : (
          <span>{text}</span>
        )}
        {d.channel === "Email" ? (send.footer && !/NMLS/.test(text) ? <span className="footer-note">{send.footer}</span> : /NMLS/.test(text) && /Equal Housing/i.test(text) ? null : <span className="footer-note" style={{ color: "#A3261B" }}>No compliance footer in this email yet, so it won’t send.</span>) : <span className="footer-note">{send.smsFooter}</span>}
      </div>
      {d.note ? <span style={{ fontSize: 13, color: "#A3261B" }}>{d.note}</span> : null}
      {error ? <span role="alert" style={{ fontSize: 13, color: "#A3261B" }}>{error}</span> : null}
      {rejecting ? (
        <div className="btn-row" style={{ alignItems: "center" }}>
          <label className="small muted" htmlFor={`why-${d.id}`}>Why reject it? This teaches the bot.</label>
          <input id={`why-${d.id}`} className="input" style={{ flex: "1 1 240px" }} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. wrong condition, too long, tone" />
          <button type="button" className="btn" disabled={pending} onClick={() => decide("rejected", "Rejected. The reason is saved as training data.")}>Reject</button>
          <button type="button" className="btn" onClick={() => setRejecting(false)}>Cancel</button>
        </div>
      ) : (
        <div className="btn-row">
          <button
            type="button"
            className="btn primary"
            disabled={pending || blocked || (needsMark && ws.role !== "Mark")}
            title={needsMark && ws.role !== "Mark" ? "Only Mark can approve pricing language" : undefined}
            onClick={() => decide(changed ? "edited" : "approved", changed ? "Edited and approved. The edit is saved as training data." : "Approved as written.")}
          >
            {pending ? (send.enabled ? "Sending…" : "Saving…") : `${changed ? "Approve with my edits" : "Approve"}${send.enabled && saved ? " and send" : ""}`}
          </button>
          <button type="button" className="btn" onClick={() => setEditing((e) => !e)}>{editing ? "Done editing" : "Edit"}</button>
          <button type="button" className="btn" onClick={() => setRejecting(true)}>Reject</button>
        </div>
      )}
    </div>
  );
}

/** A server action that throws (most often: the app was updated while this page was open). */
function actionError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/Server Action|failed-to-find|deployment/i.test(msg)) return "The app was just updated. Reload the page and try again. Your review wasn’t saved.";
  return `Something went wrong: ${msg}. Reload the page and check Recently reviewed before trying again.`;
}

function RetryButton({ id }: { id: string }) {
  const ws = useWorkspace();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn"
      style={{ marginLeft: 8, padding: "2px 10px", minHeight: 0 }}
      disabled={pending}
      onClick={() =>
        start(async () => {
          let r: Awaited<ReturnType<typeof retrySend>>;
          try {
            r = await retrySend(id);
          } catch (err) {
            ws.flash(actionError(err));
            return;
          }
          ws.flash(!r.ok ? r.error : r.sent ? "Sent." : r.note ?? "Not sent.");
          router.refresh();
        })
      }
    >
      {pending ? "Sending…" : "Send now"}
    </button>
  );
}

type QueueProps = {
  result: DraftResult;
  saved: SavedReviews;
  send: SendInfo;
  loanNames: Record<string, string>;
  title?: string;
  intro?: string;
  readiness?: TaskType[];
  /** Shown above the queue, e.g. which inboxes are connected. */
  status?: React.ReactNode;
  empty?: string;
};

export function DraftQueue({
  result,
  saved,
  send,
  loanNames,
  title = "Outbound review",
  intro = "The bots draft every borrower message from live Vesta data. Nothing goes out until a person approves it. Each approve, edit or reject counts toward that message type going automatic.",
  readiness = ["Daily update", "Condition request"],
  status,
  empty = "Nothing waiting for review.",
}: QueueProps) {
  const ws = useWorkspace();
  const [type, setType] = useState<TaskType | "all">("all");
  const isDone = (id: string) => Boolean(ws.done[id] || saved.reviewed[id]);
  const tallies = saved.available ? saved.tallies : ws.reviews;
  const open = result.drafts.filter((d) => !isDone(d.id) && (type === "all" || d.taskType === type));
  const types = Array.from(new Set(result.drafts.map((d) => d.taskType)));
  return (
    <div className="stack">
      <header className="page-head">
        <h1>{title}</h1>
        <span className="muted">{intro}</span>
      </header>
      <div className="banner warn">
        {!saved.available
          ? `Approving doesn’t send anything, and reviews are only kept in this browser. ${saved.problem ?? ""}`
          : send.enabled
            ? `Approving sends the message right away (email through Resend, texts through Twilio)${send.testOnly ? ", but only to the addresses on the SEND_ONLY_TO test list" : ""}. Every review is saved with who made it and the text as sent.`
            : "Sending is off, so approving saves the decision without sending. Every review is saved with who made it and the text as approved."}
      </div>
      {status}
      {result.errors.length ? <div className="banner warn">Some loans couldn’t be drafted: {result.errors.slice(0, 3).join(" · ")}</div> : null}

      <section className="stack" style={{ gap: 8 }}>
        <span className="section-label">Path to automatic · 95% approved as written over the last {WINDOW}</span>
        <div className="grid-auto" style={{ ["--min" as string]: "220px" }}>
          {readiness.map((t) => (
            <Readiness key={t} type={t} t={tallies[t]} />
          ))}
        </div>
      </section>

      <div className="btn-row" style={{ alignItems: "center" }}>
        <button type="button" className="chip" aria-pressed={type === "all"} onClick={() => setType("all")}>All {result.drafts.filter((d) => !isDone(d.id)).length}</button>
        {types.map((t) => (
          <button key={t} type="button" className="chip" aria-pressed={type === t} onClick={() => setType(t)}>
            {t} {result.drafts.filter((d) => d.taskType === t && !isDone(d.id)).length}
          </button>
        ))}
        <span className="small muted">
          {title === "Outbound review" ? (
            <>
              Drafted from {result.checked} active Vesta loan{result.checked === 1 ? "" : "s"}
              {result.skipped ? ` (${result.skipped} more not drafted yet)` : ""}.
            </>
          ) : (
            <>Matched against {result.checked} active Vesta loan{result.checked === 1 ? "" : "s"} and intake calls.</>
          )}
        </span>
      </div>

      {saved.recent.length ? (
        <details className="card" open={saved.recent.some((r) => r.send_status === "failed" || (r.send_status === "held" && r.send_error))}>
          <summary className="section-label" style={{ cursor: "pointer" }}>Recently reviewed · what was sent</summary>
          <div className="stack" style={{ gap: 6, marginTop: 8 }}>
            {saved.recent.map((r) => (
              <span key={r.id} className="small">
                <span className={r.send_status === "sent" ? "pill ok" : r.send_status === "failed" ? "pill attention" : r.outcome === "rejected" ? "pill muted" : "pill warn"} style={{ marginRight: 8 }}>
                  {r.outcome === "rejected" ? "Rejected" : r.send_status === "sent" ? "Sent" : r.send_status === "failed" ? "Failed" : r.send_status === "sending" ? "Sending" : "Not sent"}
                </span>
                {r.task_type} to {r.to_address ?? "no address"} · {r.reviewed_by} ·{" "}
                {new Date(r.sent_at ?? r.reviewed_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                {r.send_error ? <span style={{ color: "#A3261B" }}> · {r.send_error}</span> : null}
                {r.outcome !== "rejected" && (r.send_status === "held" || r.send_status === "failed") ? <RetryButton id={r.id} /> : null}
              </span>
            ))}
          </div>
        </details>
      ) : null}

      {open.length === 0 ? <div className="card ghost"><span className="muted">{empty}</span></div> : null}
      {open.map((d) => (
        <DraftCard key={d.id} d={d} loanName={loanNames[d.loanId] ?? "Loan"} send={send} saved={saved.available} />
      ))}
    </div>
  );
}

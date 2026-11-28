import Link from "next/link";
import { Suspense } from "react";
import { RecentList } from "@/components/DraftQueue";
import { loadLoans } from "@/lib/data";
import { buildDrafts, type Draft } from "@/lib/drafts";
import { loadActivity, loadSavedReviews } from "@/lib/reviews";
import { loadSupportInbox } from "@/lib/support/inbox";
import { STAGES } from "@/lib/sample-data";
import type { Loan } from "@/lib/types";

/**
 * Today: everything that needs a person, so someone can see the bots are doing their work
 * and nudge anything that has stalled. Each section loads on its own so the page shows at once.
 */
export default function TodayPage() {
  return (
    <div className="stack" style={{ gap: 20 }}>
      <header className="page-head">
        <h1>Today</h1>
        <span className="muted">What needs a person right now. The Grok bots draft and watch; you approve, answer and nudge.</span>
      </header>
      <Suspense fallback={<Pending title="Messages waiting for approval" />}>
        <Waiting />
      </Suspense>
      <Suspense fallback={<Pending title="Loans that need a nudge" />}>
        <Stuck />
      </Suspense>
      <Suspense fallback={null}>
        <Problems />
      </Suspense>
    </div>
  );
}

function Pending({ title }: { title: string }) {
  return (
    <section className="card" aria-busy="true">
      <span className="section-label">{title}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 10 }} className="small muted">
        <span className="spinner" aria-hidden="true" /> Loading…
      </span>
    </section>
  );
}

const age = (iso: string) => {
  const h = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3600_000));
  return h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

function DraftRow({ d, loanName, tab }: { d: Draft; loanName: string; tab: string }) {
  return (
    <Link href={`/inbox?tab=${tab}`} className="small" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", textDecoration: "none", color: "inherit" }}>
      {d.monitor === "flagged" ? <span className="pill warn">Mark only</span> : d.monitor === "blocked" ? <span className="pill attention">Blocked</span> : null}
      <strong>{d.inbound ? `${d.inbound.channel} from ${d.inbound.from}` : d.subject || d.taskType}</strong>
      <span className="muted">
        {d.loanId ? loanName : "no matching loan"}
        {d.inbound ? ` · ${age(d.inbound.at)} · “${d.inbound.text.slice(0, 80)}${d.inbound.text.length > 80 ? "…" : ""}”` : ""}
      </span>
    </Link>
  );
}

async function Waiting() {
  const { loans } = await loadLoans();
  const names = Object.fromEntries(loans.map((l) => [l.id, l.name]));
  const [outbound, support] = await Promise.all([buildDrafts(loans), loadSupportInbox(loans)]);
  const saved = await loadSavedReviews([...outbound.drafts, ...support.drafts].map((d) => d.id));
  const open = (ds: Draft[]) => ds.filter((d) => !saved.reviewed[d.id]);
  const questions = open(support.drafts);
  const toSend = open(outbound.drafts);
  const markOnly = [...questions, ...toSend].filter((d) => d.monitor === "flagged").length;
  return (
    <>
      <div className="grid-auto">
        <Link href="/inbox?tab=questions" className="kpi">
          <span className="kpi-label">Borrower questions to answer</span>
          <span className="kpi-value" style={{ color: questions.length ? "#A3261B" : "var(--emerald-800)" }}>{questions.length}</span>
          <span className="small muted">Email and text to support@, last 7 days</span>
        </Link>
        <Link href="/inbox?tab=send" className="kpi">
          <span className="kpi-label">Updates to approve</span>
          <span className="kpi-value">{toSend.length}</span>
          <span className="small muted">One per borrower per day</span>
        </Link>
        <Link href="/inbox" className="kpi">
          <span className="kpi-label">Waiting on Mark</span>
          <span className="kpi-value" style={{ color: markOnly ? "#7A4A00" : undefined }}>{markOnly}</span>
          <span className="small muted">Pricing, rate or lock language</span>
        </Link>
      </div>
      {questions.length ? (
        <section className="card" style={{ gap: 8 }}>
          <span className="section-label">Borrower questions · oldest first</span>
          {[...questions].reverse().slice(0, 8).map((d) => (
            <DraftRow key={d.id} d={d} loanName={names[d.loanId] ?? "Loan"} tab="questions" />
          ))}
        </section>
      ) : null}
      {support.sources.some((s) => s.error) ? (
        <div className="banner warn">Inbox problem: {support.sources.filter((s) => s.error).map((s) => `${s.name}: ${s.error}`).join(" · ")}</div>
      ) : null}
    </>
  );
}

type Nudge = { loan: Loan; why: string };

async function Stuck() {
  const [{ loans }, activity] = await Promise.all([loadLoans(), loadActivity()]);
  const active = loans.filter((l) => l.source === "vesta" && l.stage < 8);
  const nudges: Nudge[] = [];
  for (const l of active) {
    const last = activity.lastSentByLoan[l.id];
    const days = last ? (Date.now() - new Date(last).getTime()) / 86400_000 : null;
    if (l.health === "attention") nudges.push({ loan: l, why: l.waiting || "Flagged in Vesta" });
    else if (l.tridState === "warn") nudges.push({ loan: l, why: `TRID deadline: ${l.trid}` });
    else if (activity.available && (days === null || days >= 2)) nudges.push({ loan: l, why: days === null ? "No message sent to the borrower yet" : `No message to the borrower in ${Math.floor(days)} days` });
  }
  return (
    <section className="card" style={{ gap: 8 }}>
      <span className="section-label">Loans that need a nudge · {nudges.length} of {active.length} active</span>
      {nudges.length === 0 ? <span className="muted small">Every active loan heard from us in the last 2 days, and nothing is flagged.</span> : null}
      {nudges.slice(0, 15).map(({ loan, why }) => (
        <Link key={loan.id} href={`/loans/${loan.id}`} className="small" style={{ display: "flex", gap: 8, flexWrap: "wrap", textDecoration: "none", color: "inherit" }}>
          <strong>{loan.name}</strong>
          <span className="muted">{STAGES[loan.stage]} · {loan.vesta}</span>
          <span>{why}</span>
        </Link>
      ))}
    </section>
  );
}

async function Problems() {
  const activity = await loadActivity();
  if (!activity.problems.length) return null;
  return (
    <section className="card" style={{ gap: 4 }}>
      <span className="section-label">Messages that didn’t go out</span>
      <RecentList recent={activity.problems} />
    </section>
  );
}

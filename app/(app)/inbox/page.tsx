import Link from "next/link";
import { DraftQueue, RecentList } from "@/components/DraftQueue";
import { loadLoans } from "@/lib/data";
import { buildDrafts } from "@/lib/drafts";
import { loadSavedReviews } from "@/lib/reviews";
import { sendInfo } from "@/lib/send";
import { loadSupportInbox } from "@/lib/support/inbox";

type Tab = "send" | "questions" | "sent";
const TABS: { key: Tab; label: string; note: string }[] = [
  { key: "send", label: "To send", note: "The bots' messages to borrowers: one daily update per borrower, with every open condition and exactly what to provide. Nothing goes out until a person approves it." },
  { key: "questions", label: "Questions", note: "Borrowers write or text support@homeloanagents.com. Each message is matched to a loan by the sender's email or phone, and the Concierge bot drafts an answer from that loan." },
  { key: "sent", label: "Sent", note: "Everything a person approved or rejected, newest first, with what happened when it was sent." },
];

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab: Tab = ((await searchParams).tab as Tab) ?? "send";
  const active = TABS.find((t) => t.key === tab) ?? TABS[0];
  const nav = (
    <div className="btn-row" aria-label="Inbox sections">
      {TABS.map((t) => (
        <Link key={t.key} href={`/inbox?tab=${t.key}`} className="chip" aria-current={t.key === active.key ? "page" : undefined} aria-pressed={t.key === active.key}>
          {t.label}
        </Link>
      ))}
    </div>
  );
  const { loans } = await loadLoans();
  const loanNames = Object.fromEntries(loans.map((l) => [l.id, l.name]));

  if (active.key === "sent") {
    const saved = await loadSavedReviews([], 100);
    return (
      <div className="stack">
        <header className="page-head">
          <h1>Inbox</h1>
          <span className="muted">{active.note}</span>
        </header>
        {nav}
        <div className="card">
          {!saved.available ? <span className="muted">{saved.problem}</span> : saved.recent.length ? <RecentList recent={saved.recent} /> : <span className="muted">Nothing reviewed yet.</span>}
        </div>
      </div>
    );
  }

  if (active.key === "questions") {
    const result = await loadSupportInbox(loans);
    const saved = await loadSavedReviews(result.drafts.map((d) => d.id));
    const status = (
      <div className="card" style={{ gap: 6 }}>
        <span className="section-label">Inboxes · last 7 days</span>
        {result.sources.map((s) => (
          <span key={s.name} className="small">
            <span className={s.error ? "pill attention" : s.configured ? "pill ok" : "pill muted"} style={{ marginRight: 8 }}>
              {s.error ? "Error" : s.configured ? `${s.count} message${s.count === 1 ? "" : "s"}` : "Not connected"}
            </span>
            {s.name}
            {s.name.startsWith("Email") ? ` (${result.mailbox})` : ""}
            {s.error ? `: ${s.error}` : ""}
          </span>
        ))}
      </div>
    );
    return (
      <DraftQueue result={result} saved={saved} send={sendInfo()} loanNames={loanNames} title="Inbox" intro={active.note} nav={nav} readiness={["Support reply"]} status={status} empty="No borrower questions waiting." />
    );
  }

  const result = await buildDrafts(loans);
  const saved = await loadSavedReviews(result.drafts.map((d) => d.id));
  return <DraftQueue result={result} saved={saved} send={sendInfo()} loanNames={loanNames} title="Inbox" intro={active.note} nav={nav} readiness={["Daily update"]} empty="Nothing waiting to send." />;
}

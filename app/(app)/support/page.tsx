import { DraftQueue } from "@/components/DraftQueue";
import { loadLoans } from "@/lib/data";
import { loadSupportInbox } from "@/lib/support/inbox";

export default async function SupportPage() {
  const { loans } = await loadLoans();
  const result = await loadSupportInbox(loans);
  const loanNames = Object.fromEntries(loans.map((l) => [l.id, l.name]));
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
          {!s.configured ? <span className="muted"> · set its environment variables in Netlify to connect it</span> : null}
        </span>
      ))}
    </div>
  );
  return (
    <DraftQueue
      result={result}
      loanNames={loanNames}
      title="Support inbox"
      intro={`Borrowers email or text ${result.mailbox}. We match the sender to their loan by the email or phone on file, and the Concierge bot drafts an answer from that loan. A person approves, edits or rejects it before anything goes out.`}
      readiness={["Support reply"]}
      status={status}
      empty="No support messages waiting."
    />
  );
}

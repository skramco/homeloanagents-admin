import Link from "next/link";
import type { Loan } from "@/lib/types";
import type { LoanTimeline } from "@/lib/timeline";
import { STAGES } from "@/lib/sample-data";

const TZ = "America/Los_Angeles";
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Never";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: TZ });
const ACTIVE = (l: Loan) => l.stage < STAGES.length - 1 && !/withdrawn|denied|cancel/i.test(l.waiting ?? "");

/** Who owns what on this file, and everything that has happened, newest first. */
export function Timeline({ loan: l, t }: { loan: Loan; t: LoanTimeline }) {
  const today = day(new Date().toISOString());
  const lastUpdate = t.lastSent["Daily update"] ?? null;
  const updateDue = ACTIVE(l) && (!lastUpdate || day(lastUpdate) !== today);
  const questions = t.items.filter((i) => i.kind === "question").length;

  const owners: { bot: string; tag: string; task: string; state: string; tone: string; action?: { href: string; label: string } }[] = [
    {
      bot: "Concierge", tag: "GROK", task: "One daily update to the borrower: where the loan is, every open condition and what to send",
      state: lastUpdate ? `Last sent ${when(lastUpdate)}${updateDue ? ". Today's isn't out yet." : ". Done for today."}` : "Nothing sent to this borrower yet.",
      tone: updateDue ? "waiting" : "ok",
      action: updateDue ? { href: "/inbox?tab=send", label: "Draft and approve today's update" } : undefined,
    },
    {
      bot: "Concierge", tag: "GROK", task: "Answers the borrower's emails and texts to support@",
      state: questions ? `${questions} question${questions === 1 ? "" : "s"} answered. Last reply ${when(t.lastSent["Support reply"] ?? null)}.` : "No questions from this borrower yet.",
      tone: "ok",
      action: { href: "/inbox?tab=questions", label: "Open questions" },
    },
    { bot: "Compliance monitor", tag: "RULES", task: "Checks every draft. Rate, APR, points, payment or lock language goes to Mark.", state: "Runs on every draft.", tone: "ok" },
    {
      bot: "Vesta watcher", tag: "WEBHOOKS", task: "Notices changes to this loan in Vesta",
      state: t.lastVestaEvent ? `Last change ${when(t.lastVestaEvent)}.` : "No changes received yet.", tone: "ok",
    },
  ];

  return (
    <div className="stack">
      <section className="card" style={{ gap: 0 }}>
        <h2 style={{ marginBottom: 4 }}>Who owns what on this file</h2>
        <span className="small muted" style={{ marginBottom: 10 }}>The bots draft and watch. {l.owner || "A person"} approves every message before it goes out.</span>
        {owners.map((o, i) => (
          <div key={i} className="line-item" style={{ gridTemplateColumns: "190px minmax(0, 1fr) auto", alignItems: "center" }}>
            <span className="btn-row" style={{ alignItems: "center", gap: 6 }}><strong>{o.bot}</strong><span className="ai-tag">{o.tag}</span></span>
            <span className="cell-col"><span className="small">{o.task}</span><span className={o.tone === "waiting" ? "small" : "small muted"} style={o.tone === "waiting" ? { color: "#7A4A00", fontWeight: 600 } : undefined}>{o.state}</span></span>
            <span>{o.action ? <Link className="btn" href={o.action.href}>{o.action.label}</Link> : null}</span>
          </div>
        ))}
      </section>

      <section className="card" style={{ gap: 0 }}>
        <h2 style={{ marginBottom: 4 }}>Timeline</h2>
        <span className="small muted" style={{ marginBottom: 10 }}>Every borrower question, every bot message a person reviewed, and every Vesta change, newest first.</span>
        {t.problem ? <span className="muted">{t.problem}</span> : null}
        {t.available && t.items.length === 0 ? <span className="muted">Nothing yet. Messages show here once someone approves or rejects a draft for this borrower.</span> : null}
        {t.items.map((x, i) => (
          <div key={i} className="line-item" style={{ gridTemplateColumns: "110px 14px minmax(0, 1fr)" }}>
            <span className="small muted">{when(x.at)}</span>
            <span className={x.kind === "question" ? "dot alert" : x.kind === "vesta" ? "dot now" : "dot"} />
            <span className="cell-col" style={{ gap: 4 }}>
              <span className="small">
                <span className="bot-name">{x.kind === "question" ? `Borrower (${x.actor})` : x.actor}</span>
                <span className="muted"> · {x.channel} · {x.title}</span>
              </span>
              {x.text ? <span style={{ whiteSpace: "pre-line" }}>{x.text}</span> : null}
              {x.status ? <span><span className={`pill ${x.status.tone}`}>{x.status.label}</span></span> : null}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}

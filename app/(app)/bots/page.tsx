import Link from "next/link";
import { loadLoans } from "@/lib/data";
import { grokConfigured } from "@/lib/grok";
import { loadActivity, supabaseConfigured, type TaskStats } from "@/lib/reviews";
import { sendingEnabled } from "@/lib/send";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** Vesta webhook events received in the last 24 hours, or why we can't tell. */
async function webhookCount(): Promise<{ count: number | null; note: string }> {
  if (!process.env.VESTA_WEBHOOK_SECRET) return { count: null, note: "Not switched on (VESTA_WEBHOOK_SECRET)" };
  if (!supabaseConfigured()) return { count: null, note: "Supabase isn't set up" };
  const since = new Date(Date.now() - 86400_000).toISOString();
  const r = await getSupabaseAdmin().from("vesta_webhook_events").select("id", { count: "exact", head: true }).gte("received_at", since);
  if (r.error) return { count: null, note: "The vesta_webhook_events table isn't in Supabase yet" };
  return { count: r.count ?? 0, note: "HLA loan events in the last 24 hours" };
}

const pct = (t?: TaskStats) => (t && t.reviewed ? `${Math.round((t.approvedAsWritten / t.reviewed) * 100)}%` : "—");
const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Never";

function TaskLine({ label, t }: { label: string; t?: TaskStats }) {
  return (
    <div className="small" style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
      <strong style={{ minWidth: 140 }}>{label}</strong>
      <span><strong>{t?.sent ?? 0}</strong> sent</span>
      <span><strong>{pct(t)}</strong> approved as written</span>
      {t?.failed ? <span style={{ color: "#A3261B" }}>{t.failed} failed</span> : null}
      {t?.held ? <span style={{ color: "#7A4A00" }}>{t.held} held</span> : null}
      <span className="muted">Last: {when(t?.last)}</span>
    </div>
  );
}

export default async function BotsPage() {
  const [{ loans, liveCount, liveError }, activity, hooks] = await Promise.all([loadLoans(), loadActivity(), webhookCount()]);
  const active = loans.filter((l) => l.source === "vesta" && l.stage < 8).length;
  const grok = grokConfigured();
  const bots = [
    {
      name: "Concierge",
      engine: "Grok",
      live: grok,
      does: "Writes each borrower one daily update (where the loan is, every open condition and exactly what to send, what's next) and answers questions sent to support@ by email or text.",
      cant: "Send anything without a person's approval, or mention rates, locks, fees or payments without Mark.",
      body: (
        <>
          <span className="small muted">Working {active} active loan{active === 1 ? "" : "s"}. Last 30 days:</span>
          <TaskLine label="Daily updates" t={activity.byTask["Daily update"]} />
          <TaskLine label="Support replies" t={activity.byTask["Support reply"]} />
          {activity.byTask["Condition request"] ? <TaskLine label="Condition emails (old)" t={activity.byTask["Condition request"]} /> : null}
        </>
      ),
      href: "/inbox",
    },
    {
      name: "Compliance monitor",
      engine: "Rules",
      live: true,
      does: "Checks every draft and every edit. Anything about a rate, APR, points, payment or lock goes to Mark. An email can't go out without the NMLS and Equal Housing footer, and only Borrower conditions are ever shared.",
      cant: "Be switched off.",
      body: <span className="small muted">Runs on each draft as it’s written and again when it’s approved.</span>,
      href: "/inbox",
    },
    {
      name: "Voice agent",
      engine: "Grok (xAI voice)",
      live: !liveError,
      does: "Answers calls on the HomeLoanAgents line, announces recording, and logs each call with a summary. Callers are matched to a loan by phone number.",
      cant: "Quote rates or take an application over the phone.",
      body: <span className="small muted">{liveError ? `Couldn't load calls: ${liveError}` : `${liveCount} call${liveCount === 1 ? "" : "s"} logged.`}</span>,
      href: "/loans",
    },
    {
      name: "Vesta watcher",
      engine: "Webhooks",
      live: hooks.count !== null,
      does: "Receives Vesta's loan change events for HomeLoanAgents loans only, so the bots act on what changed.",
      cant: "Change anything in Vesta.",
      body: <span className="small muted">{hooks.count !== null ? `${hooks.count} ${hooks.note}` : hooks.note}</span>,
      href: "/loans",
    },
  ];
  return (
    <div className="stack" style={{ gap: 20 }}>
      <header className="page-head">
        <h1>Bots</h1>
        <span className="muted">Which bot does what, how much it sent, and how often people approve its work as written. At 95% over the last 50, a task can be made automatic.</span>
      </header>
      <div className="grid-auto" style={{ ["--min" as string]: "320px" }}>
        {bots.map((b) => (
          <div key={b.name} className="card" style={{ gap: 8 }}>
            <div className="btn-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>
                {b.name} <span className="ai-tag" style={{ marginLeft: 6 }}>{b.engine}</span>
              </span>
              <span className={b.live ? "pill ok" : "pill muted"}>{b.live ? "Live" : "Off"}</span>
            </div>
            <span style={{ fontSize: 13, color: "var(--ink-700)" }}>{b.does}</span>
            <span className="small" style={{ color: "#A3261B" }}><strong>Can’t:</strong> {b.cant}</span>
            {b.body}
            <Link href={b.href} className="small">Open {b.href === "/inbox" ? "Inbox" : "Loans"}</Link>
          </div>
        ))}
      </div>
      <section className="card" style={{ gap: 6 }}>
        <span className="section-label">House rules</span>
        <span className="small">Pilot in CA, TX and FL. A person reads every outbound message before it goes out{sendingEnabled() ? "" : " (sending is switched off right now)"}.</span>
        <span className="small">Each borrower gets at most one email a day: the daily update carries every open condition. Texts are used only to reply.</span>
        <span className="small">Anything with a rate, APR, points, payment or lock needs Mark. Every call announces recording.</span>
        {!activity.available ? <span className="small" style={{ color: "#7A4A00" }}>Review history isn’t available (Supabase outbound_messages), so the numbers above are empty.</span> : null}
      </section>
    </div>
  );
}

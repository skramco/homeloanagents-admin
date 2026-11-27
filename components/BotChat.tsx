"use client";

import { useState } from "react";
import type { Loan } from "@/lib/types";
import { STAGES } from "@/lib/sample-data";
import { firstName } from "@/lib/loan-view";
import { useWorkspace } from "./Workspace";

/**
 * Internal chat with a file's bots. v0 answers from the file's own data with
 * fixed responses; the live version will call each bot's agent endpoint.
 */

type BotKey = "quote" | "proc" | "disc" | "conc";
const BOTS: { key: BotKey; label: string }[] = [
  { key: "quote", label: "Quote drafter" },
  { key: "proc", label: "Processor" },
  { key: "disc", label: "Disclosure" },
  { key: "conc", label: "Concierge" },
];

const PROMPTS: Record<BotKey, [string, string]> = {
  quote: ["Re-run pricing in Ratesboard", "Draft a 7-day lock extension"],
  proc: ["What are we still missing?", "Draft a doc request"],
  disc: ["Where are the TRID clocks?", "Is this a change of circumstance?"],
  conc: ["What consents do we have?", "When did we last talk to them?"],
};

function greeting(bot: BotKey, l: Loan): string {
  const open = l.conditions.filter((c) => c.status === "Open").length;
  switch (bot) {
    case "quote":
      return `I draft pricing for this file in Ratesboard. ${l.program}, ${l.amount}. Rate: ${l.lock}. Anything I draft goes to Mark’s approval queue first.`;
    case "proc":
      return `Waiting on: ${l.waiting}. ${open} condition(s) open in Vesta.`;
    case "disc":
      return `TRID: ${l.trid}.`;
    case "conc":
      return `Last contact with ${firstName(l.name)}: ${l.lastContact}. I handle general questions on the xAI voice line, by text and by email.`;
  }
}

function answer(bot: BotKey, idx: number, l: Loan): string {
  const f = firstName(l.name);
  const c = l.consent;
  const answers: Record<BotKey, [string, string]> = {
    quote: [
      `Re-ran ${f}’s scenario in Ratesboard and put the options in Mark’s approval queue. Nothing with a rate reaches ${f} until it is approved.`,
      "Drafted a 7-day extension request at the current Ratesboard extension cost. It is in Mark’s queue; I will not request it in Vesta until it is approved.",
    ],
    proc: [
      `Still open: ${l.waiting}. I remind ${f} every 48 hours. Each reminder goes through the Compliance monitor and a processor first.`,
      `Drafted for outbound review: "Hi ${f}, this is HomeLoanAgents. To keep your loan moving we still need: ${l.waiting}. You can upload it in your portal." The DBA and NMLS footer is added automatically.`,
    ],
    disc: [
      `TRID: ${l.trid}. I flag Processor 1 and Mark when any deadline is 1 business day out.`,
      "I can prepare a revised LE, but whether it is a valid change of circumstance is Mark’s call. I will put it in his approval queue with the documentation.",
    ],
    conc: [
      `AI disclosure and recording notice: ${c.aiDisclosure ? "given" : "missing"}. TCPA consent for calls and texts: ${c.tcpa ? "yes" : "no"}. E-SIGN consent: ${c.esign ? "yes" : "not yet, so no electronic disclosures can go out"}.`,
      `Last contact: ${l.lastContact}. ${l.gaps.length} milestone update(s) have not gone out yet. Current stage: ${STAGES[l.stage]}.`,
    ],
  };
  return answers[bot][idx];
}

export function BotChat({ loan: l }: { loan: Loan }) {
  const ws = useWorkspace();
  const [bot, setBot] = useState<BotKey>("quote");
  const [draft, setDraft] = useState("");
  const key = `${l.id}:${bot}`;
  const label = BOTS.find((b) => b.key === bot)!.label;
  const history = [{ from: "bot" as const, text: greeting(bot, l) }, ...(ws.chats[key] ?? [])];

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    ws.addChat(key, [
      { from: "me", text },
      { from: "bot", text: `Noted. In the live app the ${label} bot answers from ${firstName(l.name)}’s portal, Ratesboard and Vesta data. Anything with a rate, APR, points, payment or lock goes to Mark’s approvals first.` },
    ]);
    setDraft("");
  };

  return (
    <aside aria-label="Chat with this file’s bots" className="card chat" style={{ gap: 12 }}>
      <div className="cell-col">
        <h2>Ask the bots about this file</h2>
        <span className="small muted">Internal only. Nothing here reaches the borrower.</span>
      </div>
      <div className="btn-row" style={{ gap: 6 }}>
        {BOTS.map((b) => (
          <button key={b.key} type="button" className="chip" aria-pressed={bot === b.key} onClick={() => setBot(b.key)}>{b.label}</button>
        ))}
      </div>
      <div className="chat-log" aria-live="polite">
        {history.map((m, i) => (
          <div key={i} className={m.from === "me" ? "bubble me" : "bubble"}>{m.text}</div>
        ))}
      </div>
      <div className="cell-col" style={{ gap: 6 }}>
        {PROMPTS[bot].map((p, idx) => (
          <button key={p} type="button" className="suggest" onClick={() => ws.addChat(key, [{ from: "me", text: p }, { from: "bot", text: answer(bot, idx, l) }])}>{p}</button>
        ))}
      </div>
      <form
        className="cell-col"
        style={{ gap: 6 }}
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <label htmlFor="botChatInput" className="small muted">Message the {label} bot</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input id="botChatInput" className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. Can we close by the 12th?" />
          <button type="submit" className="btn primary">Send</button>
        </div>
      </form>
    </aside>
  );
}

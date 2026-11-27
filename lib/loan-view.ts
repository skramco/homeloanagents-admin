import type { Health, Loan } from "./types";
import { MILESTONE_CHANNEL, MILESTONES, STAGE_BOT, STAGE_DONE, STAGES } from "./sample-data";

export const HEALTH_LABEL: Record<Health, string> = {
  ok: "On track",
  waiting: "Waiting on borrower",
  attention: "Needs a person",
};

export const firstName = (name: string) => name.split(" ")[0];

export type FeedItem = { when: string; bot: string; kind: string; text: string; tone: "done" | "now" | "alert" };

export function botFeed(l: Loan): FeedItem[] {
  const feed: FeedItem[] = [
    { when: "Now", bot: l.bot, kind: l.health === "attention" ? "waiting on a person" : "in progress", text: l.botNow, tone: l.health === "attention" ? "alert" : "now" },
  ];
  if (l.stage === 8) feed.push({ when: l.dates[8] ?? "", bot: STAGE_BOT[8], kind: "done", text: STAGE_DONE[8], tone: "done" });
  for (let i = l.stage - 1; i >= 0; i--) {
    feed.push({ when: l.dates[i] ?? "", bot: STAGE_BOT[i], kind: "done", text: STAGE_DONE[i], tone: "done" });
  }
  return feed;
}

export type CommsItem = { when: string; channel: string; dir: string; who: string; text: string };

export function commsLog(l: Loan): CommsItem[] {
  const items: CommsItem[] = [];
  const [ch, when] = l.lastContact.split(" · ");
  items.push({ when: when ?? "", channel: ch, dir: "Latest", who: "Logged automatically", text: `Most recent touchpoint with ${firstName(l.name)}.` });
  for (let k = l.stage; k >= 0; k--) {
    if (l.gaps.includes(k)) continue;
    if (k === 0) {
      items.push({
        when: l.dates[0] ?? "",
        channel: "Call",
        dir: "Inbound",
        who: "xAI voice agent (Concierge)",
        text:
          l.callSummary ??
          `Called the HLA line about a ${l.purpose.toLowerCase()} (${l.amount}). AI disclosure and recording notice given. Recording and recap saved to the file; recap emailed to Mark.`,
      });
      continue;
    }
    items.push({
      when: l.dates[k] ?? "",
      channel: MILESTONE_CHANNEL[k],
      dir: "Outbound",
      who: k === 3 ? "Quote drafter, approved by Mark" : `${STAGE_BOT[k]} bot, reviewed by ${l.owner}`,
      text: MILESTONES[k],
    });
  }
  return items;
}

export function coverage(l: Loan) {
  return STAGES.slice(0, l.stage + 1).map((stage, j) => {
    const missing = l.gaps.includes(j);
    return { stage, text: MILESTONES[j], missing, status: missing ? "Not sent" : `Sent ${l.dates[j] ?? ""}`.trim() };
  });
}

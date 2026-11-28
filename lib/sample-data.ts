import type { Approval, Bot, Escalation, OutboundMessage, Role } from "./types";

/**
 * Stage definitions, the bot roster and (empty) work queues. No borrower data lives here.
 */

export const STAGES = [
  "Lead",
  "Portal account",
  "Application",
  "Quote & lock",
  "Disclosures",
  "Processing",
  "Underwriting",
  "Closing",
  "Funded",
] as const;

export const STAGE_SOURCES = [
  "xAI voice agent, web, SMS, email",
  "homeloanagents.com",
  "1003 to Vesta",
  "Ratesboard + Mark",
  "LE, ITP, eSign",
  "Vesta conditions",
  "UFF underwriter",
  "Title + CD",
  "Vesta",
];

export const STAGE_BOT = [
  "Concierge",
  "Concierge",
  "Application (1003)",
  "Quote drafter",
  "Disclosure",
  "Processor / conditions",
  "Processor / conditions",
  "Processor / conditions",
  "Processor / conditions",
];

export const STAGE_DONE = [
  "Answered on the voice line, gave the AI disclosure and recording notice, captured TCPA and E-SIGN consent, emailed the call recap",
  "Sent the portal link; borrower created a homeloanagents.com account",
  "Walked the borrower through the 1003, got credit authorization, flagged all 6 TRID items complete",
  "Ran Ratesboard scenarios and drafted quote options; Mark approved them",
  "Sent the LE and intent to proceed for eSign within 3 business days",
  "Collected docs, ran VOE/VOI and assets, ordered appraisal and title, kept Vesta current",
  "Packaged the file for the UFF underwriter; conditions imported from Vesta",
  "Clear to close; CD received 3 business days before closing; balance confirmed with title",
  "Funding conditions met; loan funded",
];

export const MILESTONES = [
  "First call: AI disclosure, recording notice, consents, recap",
  "Portal welcome and next steps",
  "Application received",
  "Approved quote sent",
  "LE and intent to proceed sent",
  "Processing intro and document list",
  "Underwriting update",
  "Clear to close and closing details",
  "Funded thank-you",
];

export const MILESTONE_CHANNEL = ["Call", "Email", "Email", "Email", "Email + eSign", "Email", "Text", "Email", "Email"];

export const ROLES: Role[] = ["Mark", "Processor 1", "Processor 2", "Lorinn"];

export const ROLE_NOTES: Record<Role, string> = {
  Mark: "MLO. Rate approvals, application acceptance, CoC and adverse action sign-off, daily digest.",
  "Processor 1": "Front: leads, applications and disclosures. Reviews Concierge, Application and Disclosure messages.",
  "Processor 2": "Back: processing through funding. Conditions, vendors, closing, wires, trailing docs.",
  Lorinn: "COO. Complaints, legal threats, vendor and staffing issues, weekly QC. Rate backup only if MLO-licensed.",
};

export const BOTS: Bot[] = [
  { n: 1, name: "Concierge", mvp: true, does: "Front door on the xAI voice line, homeloanagents.com, SMS and email. Gives the AI disclosure and recording notice, captures TCPA and E-SIGN consent, answers general questions, emails the call recap, books a callback from a human.", cant: "Quote rates, payments or fees, or recommend a specific loan." },
  { n: 2, name: "Application (1003)", mvp: true, does: "Acting for Mark under his NMLS ID. Walks the borrower through the 1003, gets credit authorization, pulls credit, flags when the 6 TRID items are complete.", cant: "Negotiate terms or steer product." },
  { n: 3, name: "Quote drafter", mvp: true, does: "Runs scenarios in Ratesboard, drafts rate and fee options and lock requests, and puts them in Mark’s approval queue.", cant: "Send anything with a rate, APR or lock until Mark approves it." },
  { n: 4, name: "Disclosure", mvp: true, does: "Tracks TRID clocks. Prepares the LE, intent to proceed, change-of-circumstance redisclosures, state disclosures and the CD, then sends them for eSign.", cant: "Decide whether a change of circumstance is valid. Mark decides." },
  { n: 5, name: "Processor / conditions", mvp: true, does: "Collects documents, runs VOE/VOI, assets and 4506-C, reads conditions, chases the borrower, keeps Vesta clean. In the MVP it also orders vendors.", cant: "Clear UW conditions or change loan terms." },
  { n: 6, name: "Vendor ordering", mvp: false, note: "In the MVP the Processor bot does this.", does: "Orders appraisal (AMC only), title, flood, HOI and fraud reports; tracks ETAs and pushes reports to Vesta.", cant: "Contact the appraiser about value." },
  { n: 7, name: "UW prep", mvp: false, note: "In the MVP a human UFF underwriter does this.", does: "Runs DU/LPA in Vesta, income and asset calculations, packages the file for a UFF underwriter.", cant: "Issue a credit decision." },
  { n: 8, name: "Closing / funding", mvp: false, note: "In the MVP the 2 processors coordinate closing.", does: "Coordinates CTC, the CD balance with title, the signing and funding conditions.", cant: "Send or change wire instructions outside a verified channel." },
  { n: 9, name: "Post-close", mvp: false, note: "Switches on during controlled scale.", does: "Chases trailing docs, sends servicing transfer and welcome messages, asks for reviews.", cant: "Market to past borrowers without Mark’s approval." },
  { n: 10, name: "Compliance / QC monitor", mvp: true, does: "Checks every outbound message: catches rate content, adds the NMLS and DBA footer, flags UDAAP and fair-lending phrasing, watches TRID and adverse action clocks, writes the audit log.", cant: "Approve its own exceptions." },
  { n: 11, name: "Dispatcher / oversight", mvp: true, does: "Routes work between bots, runs the processor queues and SLA timers, sends Mark the daily digest and approval emails, routes business issues to Lorinn.", cant: "Talk to borrowers." },
  { n: 12, name: "Marketing / content", mvp: false, note: "Switches on during controlled scale.", does: "Drafts ads, landing pages and education content with UFF, NMLS, Equal Housing and Reg Z trigger-term disclosures.", cant: "Publish without UFF marketing approval." },
];

// Mock loans and their queue items were removed on 2026-11-27: the pipeline now shows
// real files from Vesta (plus live voice-agent leads). The queues below stay empty until
// the bots write real approvals, outbound messages and escalations.
export const APPROVALS: Approval[] = [];
export const OUTBOUND: OutboundMessage[] = [];
export const ESCALATIONS: Escalation[] = [];

/** Mark approves; Lorinn is backup only if MLO-licensed in CA, TX and FL. */
export const APPROVAL_OWNERS: Role[] = ["Mark", "Lorinn"];

/**
 * Every task the bots draft for human review (from the design notes, Nov 28 2026).
 * "drafting" = live in Outbound review now; "planned" = designed, not built yet.
 */
export type BotTask = { area: string; task: string; bot: string; reviewer: string; borrowerGets: string; status: "drafting" | "planned"; neverAutomatic?: boolean };
export const BOT_TASKS: BotTask[] = [
  { area: "Daily update", task: "Borrower-friendly update on every active loan, every day, even with no change", bot: "Concierge", reviewer: "File owner", borrowerGets: "Where you are, what we need, what's next", status: "drafting" },
  { area: "Conditions", task: "One email per open condition with how to resolve it", bot: "Processor / conditions", reviewer: "Processor 2", borrowerGets: "We need X, here's why and how to send it", status: "drafting" },
  { area: "Questions", task: "Answer texts and emails to support@ in the context of the borrower's loan", bot: "Concierge", reviewer: "Processor 1 or 2", borrowerGets: "A direct answer plus the next step", status: "planned" },
  { area: "Stale files", task: "Spot files with no activity for 3+ days and recommend a next step", bot: "Dispatcher / oversight", reviewer: "File owner", borrowerGets: "Check-in with the one thing we need", status: "planned" },
  { area: "Next steps", task: "Recommend the next action on every file", bot: "Dispatcher / oversight", reviewer: "File owner", borrowerGets: "Internal only", status: "planned" },
  { area: "Disclosures", task: "Send the LE and intent to proceed within 3 business days of a complete application", bot: "Disclosure", reviewer: "Processor 1", borrowerGets: "Your Loan Estimate is ready and how to sign", status: "planned" },
  { area: "Self-serve", task: "Resend disclosures, order the appraisal, request payoffs, take uploads", bot: "Concierge", reviewer: "Processor 1 or 2", borrowerGets: "Confirmation and when to expect the next step", status: "planned" },
  { area: "Conditions", task: "Match uploaded docs to conditions; recommend clear or reject", bot: "Processor / conditions", reviewer: "Processor 2", borrowerGets: "Got it, or why it won't work and what to send", status: "planned" },
  { area: "Conditions", task: "Flag docs that expire before closing", bot: "Processor / conditions", reviewer: "Processor 2", borrowerGets: "Please send your next paystub or statement", status: "planned" },
  { area: "Conditions", task: "Re-run AUS after data changes and explain what moved", bot: "Processor / conditions", reviewer: "Processor 2, then Mark", borrowerGets: "Internal only", status: "planned" },
  { area: "Pricing and lock", task: "Recommend when to lock unlocked files", bot: "Quote drafter", reviewer: "Mark", borrowerGets: "Mark recommends locking; reply YES", status: "planned", neverAutomatic: true },
  { area: "Pricing and lock", task: "Warn on expiring locks and draft the extension with its cost", bot: "Quote drafter", reviewer: "Mark", borrowerGets: "Your lock ends on X; extension options", status: "planned", neverAutomatic: true },
  { area: "Pricing and lock", task: "Draft change-of-circumstance redisclosures", bot: "Disclosure", reviewer: "Mark", borrowerGets: "Updated Loan Estimate to review and sign", status: "planned", neverAutomatic: true },
  { area: "Third parties", task: "Order and chase VOE, title, flood cert, HOI binder, payoffs", bot: "Processor / conditions", reviewer: "Processor 2", borrowerGets: "What we ordered; anything we need from you", status: "planned" },
  { area: "Third parties", task: "Review the appraisal; draft a reconsideration of value if low", bot: "Processor / conditions", reviewer: "Processor 2, then Mark", borrowerGets: "Your appraisal value and what it means", status: "planned" },
  { area: "Third parties", task: "Status updates to the realtor and escrow; confirm closing and CD timing", bot: "Processor / conditions", reviewer: "Processor 2", borrowerGets: "Copy of the same update", status: "planned" },
  { area: "Closing and funding", task: "Track the CD 3-day clock, balance the package, verify wires by callback", bot: "Processor / conditions", reviewer: "Processor 2", borrowerGets: "Sign your CD by X; we never email wire instructions", status: "planned", neverAutomatic: true },
  { area: "Closing and funding", task: "Confirm funding and send welcome-to-servicing", bot: "Processor / conditions", reviewer: "Processor 2", borrowerGets: "Your loan funded; who services it", status: "planned" },
  { area: "Compliance", task: "Pre-send check on every message (disclosures, NMLS footer, language, consent, DNC)", bot: "Compliance / QC monitor", reviewer: "Automatic gate", borrowerGets: "Footer on every message", status: "drafting" },
  { area: "Compliance", task: "TRID and HMDA timing logs; score calls for tone and accuracy", bot: "Compliance / QC monitor", reviewer: "Mark", borrowerGets: "Internal only", status: "planned" },
  { area: "Pipeline health", task: "Flag missed SLAs and quiet borrowers; daily digest per person", bot: "Dispatcher / oversight", reviewer: "Each person", borrowerGets: "Internal only", status: "planned" },
];

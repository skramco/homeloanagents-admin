import type { Approval, Bot, Escalation, Loan, OutboundMessage, Role } from "./types";

/**
 * SAMPLE DATA ONLY. Mirrors the approved design mockup so every screen works
 * before Vesta, Ratesboard and the bots are wired in. Borrowers are fictional.
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

const allConsent = { aiDisclosure: true, tcpa: true, esign: true, recording: true };

export const SAMPLE_LOANS: Loan[] = [
  { id: "L1", source: "sample", name: "Jordan Ellis", state: "CA", purpose: "Purchase", amount: "$412,000", program: "Conv 30-yr fixed", stage: 5, health: "waiting", owner: "Processor 2", waiting: "2024 W-2 and October bank statement", bot: "Processor / conditions", botNow: "Second doc reminder by text, sent 10:12 AM after review", lastContact: "Text · Today", lock: "6.375% locked · exp Dec 11", closing: "Dec 12", vesta: "#10482", trid: "LE on time Nov 6 · CD due Dec 9", tridState: "ok", consent: allConsent, dates: ["Nov 3", "Nov 3", "Nov 4", "Nov 5", "Nov 6", "Nov 10"], gaps: [],
    conditions: [{ text: "2024 W-2 (all employers)", owner: "Borrower", status: "Open" }, { text: "October bank statement, all pages", owner: "Borrower", status: "Open" }, { text: "Verification of employment", owner: "Processor bot", status: "Received" }, { text: "Homeowners insurance binder", owner: "Processor bot", status: "Cleared" }] },
  { id: "L2", source: "sample", name: "Priya Natarajan", state: "FL", purpose: "Cash-out refi", amount: "$285,000", program: "Conv 30-yr fixed", stage: 6, health: "attention", owner: "Processor 2", waiting: "Appraisal from the AMC (ETA Dec 1)", bot: "Quote drafter", botNow: "Lock expires Dec 3 with the appraisal out. Drafted a 7-day extension for Mark.", lastContact: "Email · Mon", lock: "6.625% locked · exp Dec 3", closing: "Dec 5", vesta: "#10455", trid: "LE on time · CD must be received by Dec 2", tridState: "warn", consent: allConsent, dates: ["Oct 28", "Oct 28", "Oct 29", "Oct 30", "Nov 2", "Nov 6", "Nov 18"], gaps: [6],
    conditions: [{ text: "Appraisal report", owner: "AMC", status: "Open" }, { text: "Payoff statement", owner: "Processor bot", status: "Received" }, { text: "Letter of explanation: credit inquiry", owner: "Borrower", status: "Cleared" }, { text: "Title commitment", owner: "Title", status: "Cleared" }] },
  { id: "L3", source: "sample", name: "Marcus Hale", state: "TX", purpose: "Purchase", amount: "$318,500", program: "FHA 30-yr fixed", stage: 2, health: "attention", owner: "Processor 1", waiting: "Property address (5 of 6 TRID items in)", bot: "Application (1003)", botNow: "Borrower mentioned military service. Paused and escalated (possible SCRA).", lastContact: "Portal chat · Today", lock: "Not quoted", closing: "", vesta: "#10511", trid: "LE clock starts when the 6th item arrives", tridState: "muted", consent: { ...allConsent, esign: false }, dates: ["Nov 19", "Nov 20", "Nov 24"], gaps: [], conditions: [] },
  { id: "L4", source: "sample", name: "Dana Whitfield", state: "CA", purpose: "Purchase", amount: "$540,000", program: "Jumbo 30-yr fixed", stage: 3, health: "attention", owner: "Processor 1", waiting: "Mark to approve the quote options", bot: "Quote drafter", botNow: "Ran 3 Ratesboard scenarios. Quote draft is in Mark’s queue.", lastContact: "Email · Wed", lock: "Quote pending approval", closing: "", vesta: "#10507", trid: "Application complete Nov 25 · LE due Mon Nov 30", tridState: "warn", consent: allConsent, dates: ["Nov 21", "Nov 22", "Nov 25", "Nov 26"], gaps: [], conditions: [] },
  { id: "L5", source: "sample", name: "Sam Ortega", state: "FL", purpose: "Pre-approval", amount: "about $350,000", program: "TBD", stage: 0, health: "ok", owner: "Processor 1", waiting: "Borrower to create a portal account", bot: "Concierge", botNow: "Answered the call, gave the AI disclosure and recording notice, emailed the recap, texted the portal link", lastContact: "Voice agent call · Today 12:34 PM", lock: "Not quoted", closing: "", vesta: "not yet", trid: "No application yet", tridState: "muted", consent: allConsent, dates: ["Today"], gaps: [], conditions: [] },
  { id: "L6", source: "sample", name: "Alicia Brooks", state: "TX", purpose: "Purchase", amount: "$296,000", program: "VA 30-yr fixed", stage: 7, health: "attention", owner: "Processor 2", waiting: "Closing Dec 4. Title sent new wire instructions.", bot: "Processor / conditions", botNow: "Title emailed changed wire instructions. Stopped and escalated.", lastContact: "Email · Thu", lock: "6.125% locked · exp Dec 9", closing: "Dec 4", vesta: "#10431", trid: "CD received Nov 25 · 3-day wait met", tridState: "ok", consent: allConsent, dates: ["Oct 14", "Oct 14", "Oct 15", "Oct 16", "Oct 19", "Oct 22", "Nov 6", "Nov 25"], gaps: [],
    conditions: [{ text: "Final verification of employment", owner: "Processor bot", status: "Received" }, { text: "Wire instructions verified with title", owner: "Processor 2", status: "Open" }, { text: "Closing Disclosure acknowledged", owner: "Borrower", status: "Cleared" }] },
  { id: "L7", source: "sample", name: "Kevin Tran", state: "CA", purpose: "Rate/term refi", amount: "$228,000", program: "Conv 15-yr fixed", stage: 4, health: "ok", owner: "Processor 1", waiting: "Borrower eSign on the LE and intent to proceed", bot: "Disclosure", botNow: "LE sent Nov 24. eSign reminder waiting in outbound review.", lastContact: "Email · Tue", lock: "5.750% locked · exp Dec 19", closing: "Dec 18", vesta: "#10497", trid: "LE sent Nov 24 (on time)", tridState: "ok", consent: allConsent, dates: ["Nov 17", "Nov 18", "Nov 20", "Nov 23", "Nov 24"], gaps: [], conditions: [] },
  { id: "L8", source: "sample", name: "Renee Morgan", state: "FL", purpose: "Purchase", amount: "$375,000", program: "Conv 30-yr fixed", stage: 8, health: "ok", owner: "Processor 2", waiting: "Trailing doc: recorded deed", bot: "Processor / conditions", botNow: "Chasing the recorded deed from title", lastContact: "Email · Nov 21", lock: "Closed at 6.250%", closing: "Nov 20", vesta: "#10388", trid: "All disclosures on time", tridState: "ok", consent: allConsent, dates: ["Sep 30", "Oct 1", "Oct 2", "Oct 3", "Oct 6", "Oct 10", "Oct 24", "Nov 14", "Nov 20"], gaps: [],
    conditions: [{ text: "All prior-to-funding conditions", owner: "Processor bot", status: "Cleared" }] },
  { id: "L9", source: "sample", name: "Tom Becker", state: "TX", purpose: "Refi inquiry", amount: "not given", program: "TBD", stage: 0, health: "attention", owner: "Processor 1", waiting: "A person to call back", bot: "Dispatcher / oversight", botNow: "Borrower asked for a human. Routed to Processor 1.", lastContact: "Voice agent call · Today 11:20 AM", lock: "Not quoted", closing: "", vesta: "not yet", trid: "No application yet", tridState: "muted", consent: { ...allConsent, esign: false }, dates: ["Today"], gaps: [], conditions: [] },
];

export const APPROVALS: Approval[] = [
  { id: "a1", loanId: "L4", type: "Quote", bot: "Quote drafter", waited: "2 h", detail: "3 Ratesboard scenarios for Dana: 30-yr fixed jumbo at 0, 0.5 and 1 point. The message to Dana shows rate, APR and payment, so it needs your approval.", preview: "Draft to Dana (email): Here are the 3 options we discussed, with rate, APR, points and estimated payment for each. [Ratesboard figures]", approveLabel: "Approve and send", reviseLabel: "Ask for changes" },
  { id: "a2", loanId: "L2", type: "Lock extension", bot: "Quote drafter", waited: "40 min", detail: "Lock expires Dec 3 and the appraisal ETA is Dec 1. Request a 7-day extension at the current Ratesboard extension cost?", approveLabel: "Approve extension", reviseLabel: "Not yet" },
  { id: "a3", loanId: "L1", type: "Change of circumstance", bot: "Disclosure", waited: "1 h", detail: "Jordan raised the down payment, so the loan amount drops. The Disclosure bot prepared a revised LE. Is this a valid change of circumstance?", approveLabel: "Valid, send revised LE", reviseLabel: "Not a valid CoC" },
];

export const OUTBOUND: OutboundMessage[] = [
  { id: "o1", loanId: "L1", bot: "Processor / conditions", channel: "Text", reviewer: "Processor 2", monitor: "passed", text: "Hi Jordan, this is HomeLoanAgents. To keep your loan moving we still need your 2024 W-2 and all pages of your October bank statement. You can upload them in your portal." },
  { id: "o2", loanId: "L7", bot: "Disclosure", channel: "Email", reviewer: "Processor 1", monitor: "passed", text: "Hi Kevin, your Loan Estimate and intent to proceed are ready to review and sign in your portal. Reply here if you have any questions." },
  { id: "o3", loanId: "L5", bot: "Concierge", channel: "Text", reviewer: "Processor 1", monitor: "blocked", text: "Great news Sam, you’re basically pre-approved! Rates for your scenario start around [rate].", note: "Blocked by the Compliance monitor: rate content (needs Mark) and an overstated approval claim (UDAAP)." },
  { id: "o4", loanId: "L9", bot: "Concierge", channel: "Text", reviewer: "Processor 1", monitor: "flagged", text: "Thanks Tom. A member of our team will reach out to you today.", note: "Flagged: promises a same-day human callback. Confirm someone is assigned before sending." },
  { id: "o5", loanId: "L4", bot: "Concierge", channel: "Voice agent call", reviewer: "Processor 1", monitor: "passed", text: "Scheduled call, Mon 10 AM: let Dana know her Loan Estimate is coming, confirm she can eSign, offer a call with a processor. No rates or payments on the call. Opens with the AI disclosure and recording notice." },
];

export const ESCALATIONS: Escalation[] = [
  { id: "e1", loanId: "L9", when: "11:20 AM", routeTo: "Processor 1", owners: ["Processor 1"], text: "On a voice agent call, Tom asked to talk to a person.", rule: "Borrower asks for a human: a processor (rate or terms questions go to Mark)." },
  { id: "e2", loanId: "L4", when: "9:00 AM", routeTo: "Processor 1 and Mark", owners: ["Processor 1", "Mark"], text: "LE for Dana is due Monday Nov 30, 1 business day out, and the quote is still waiting on approval.", rule: "A TRID or adverse-action deadline within 1 business day: Processor 1 and Mark." },
  { id: "e3", loanId: "L6", when: "10:47 AM", routeTo: "Processor 2 and Lorinn", owners: ["Processor 2", "Lorinn"], text: "Title emailed new wire instructions for Alicia’s Dec 4 closing.", rule: "Any change to wire or payoff instructions: Processor 2 and Lorinn." },
  { id: "e4", loanId: "L3", when: "12:05 PM", routeTo: "Processor 1, then Mark", owners: ["Processor 1", "Mark"], text: "Marcus mentioned he is on active duty. Possible SCRA considerations.", rule: "Mentions of military/SCRA, disability, language needs, bankruptcy, divorce or a death: a processor, then Mark." },
];

/** Mark approves; Lorinn is backup only if MLO-licensed in CA, TX and FL. */
export const APPROVAL_OWNERS: Role[] = ["Mark", "Lorinn"];

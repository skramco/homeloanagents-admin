export type Health = "ok" | "waiting" | "attention";
export type TridState = "ok" | "warn" | "muted";
export type ConditionStatus = "Open" | "Received" | "Cleared";
export type Role = "Mark" | "Processor 1" | "Processor 2" | "Lorinn";

export type Condition = { text: string; owner: string; status: ConditionStatus };

/** Consent ledger flags, in this order: AI disclosure, TCPA (calls + texts), E-SIGN, call recording. */
export type Consent = {
  aiDisclosure: boolean;
  tcpa: boolean;
  esign: boolean;
  recording: boolean;
};

export type Loan = {
  id: string;
  name: string;
  state: "CA" | "TX" | "FL" | string;
  purpose: string;
  amount: string;
  program: string;
  /** Index into STAGES. */
  stage: number;
  health: Health;
  owner: Role;
  waiting: string;
  bot: string;
  botNow: string;
  lastContact: string;
  lock: string;
  closing: string;
  vesta: string;
  trid: string;
  tridState: TridState;
  consent: Consent;
  /** Date each stage was reached, by stage index. */
  dates: string[];
  /** Stage indexes whose milestone message never went out. */
  gaps: number[];
  conditions: Condition[];
  /** Where this record came from. */
  source: "sample" | "call_leads";
  callSummary?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type Approval = {
  id: string;
  loanId: string;
  type: "Quote" | "Lock extension" | "Change of circumstance" | "Adverse action" | "Application acceptance";
  bot: string;
  waited: string;
  detail: string;
  preview?: string;
  approveLabel: string;
  reviseLabel: string;
};

export type OutboundMessage = {
  id: string;
  loanId: string;
  bot: string;
  channel: "Text" | "Email" | "Voice agent call";
  reviewer: Role;
  monitor: "passed" | "flagged" | "blocked";
  text: string;
  note?: string;
};

export type Escalation = {
  id: string;
  loanId: string;
  when: string;
  routeTo: string;
  owners: Role[];
  text: string;
  rule: string;
};

export type Bot = {
  n: number;
  name: string;
  mvp: boolean;
  does: string;
  cant: string;
  note?: string;
};

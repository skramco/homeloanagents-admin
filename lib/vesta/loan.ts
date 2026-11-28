/**
 * Full Vesta loan detail for the loan file page.
 *
 * Endpoints and field names come from Vesta's OpenAPI spec (v26.3, kept in pro-api at
 * SK.Pro.Integrations.LOS/Vesta/vesta-openapi.json):
 *   GET /loans/{loanId}                       -> Loan
 *   GET /loans/{loanId}/objective-conditions  -> ObjectiveCondition[]
 *   GET /loans/{loanId}/documents             -> DocumentMetadata[]
 * Each call fails on its own, so one error doesn't hide the rest.
 */

import type { Condition } from "../types";
import { vestaFetch } from "./config";

type Json = Record<string, unknown>;

export type DetailRow = { label: string; value: string };
export type DetailSection = { title: string; rows: DetailRow[] };
export type BorrowerCard = { name: string; rows: DetailRow[] };
export type VestaCondition = Condition & { category: string; timing: string; message: string | null };
export type VestaDocument = { name: string; status: string; uploaded: string; expired: boolean };

/** Values used to fill gaps in the loan file header when the pipeline view lacks those columns. */
export type Headline = { name?: string; state?: string; purpose?: string; amount?: string; program?: string; lock?: string; closing?: string };

export type VestaLoanDetail = {
  headline: Headline;
  sections: DetailSection[];
  borrowers: BorrowerCard[];
  conditions: VestaCondition[];
  documents: VestaDocument[];
  stages: { name: string; started: string }[];
  /** Every non-empty field on the loan, flattened to path = value (sensitive fields removed). */
  allFields: DetailRow[];
  errors: string[];
};

// Never shown, even though the processors can see them in Vesta.
const SENSITIVE = /ssn|socialsecurity|taxpayeridentifier|taxidentif|dateofbirth|accountnumber|routingnumber|password|ipaddress|caivrs|^token|secret/i;
// Bookkeeping noise in the flattened view.
const NOISE = /metadata$|ids$|refs$|^\$action$|^computedFields$|^customFields$/i;

// ── formatting ──

const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const get = (o: unknown, ...path: string[]): unknown => path.reduce<unknown>((acc, k) => (isObj(acc) ? acc[k] : undefined), o);

function humanize(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

function fmtDate(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v.length === 10 ? `${v}T12:00:00Z` : v);
  if (Number.isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" }).format(d);
}
const money = (v: unknown) =>
  typeof v === "number" ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v) : null;
const pct = (v: unknown) => (typeof v === "number" ? `${Math.round(v * 1000) / 1000}%` : null);
const plain = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string") return /^[A-Z][a-zA-Z]+$/.test(v) && /[a-z][A-Z]/.test(v) ? humanize(v) : v;
  if (typeof v === "number") return String(v);
  return null;
};

function address(a: unknown): string | null {
  if (!isObj(a)) return null;
  if (typeof a.fullStreetAddress === "string" && a.fullStreetAddress) return a.fullStreetAddress;
  const line = [a.line, a.line2].filter(Boolean).join(" ");
  const tail = [a.city, a.stateCode ?? a.state, a.zipCode ?? a.postalCode].filter(Boolean).join(", ");
  return [line, tail].filter(Boolean).join(", ") || null;
}

function rows(pairs: [string, string | null | undefined][]): DetailRow[] {
  return pairs.filter((p): p is [string, string] => Boolean(p[1])).map(([label, value]) => ({ label, value }));
}

// ── flatten everything ──

function flatten(value: unknown, path: string, out: DetailRow[], depth = 0) {
  if (out.length >= 2500 || depth > 6) return;
  if (value === null || value === undefined || value === "") return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => flatten(v, `${path}[${i + 1}]`, out, depth + 1));
    return;
  }
  if (isObj(value)) {
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE.test(k) || NOISE.test(k)) continue;
      flatten(v, path ? `${path}.${k}` : k, out, depth + 1);
    }
    return;
  }
  const leaf = path.split(".").pop() ?? path;
  if (SENSITIVE.test(leaf)) return;
  const shown =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}(T|$)/.test(value) ? (fmtDate(value) ?? value) : plain(value) ?? String(value);
  out.push({ label: path, value: shown });
}

// ── mapping ──

type Mapped = Pick<VestaLoanDetail, "headline" | "sections" | "borrowers" | "stages" | "allFields">;

function mapLoan(loan: Json): Mapped {
  const product = get(loan, "loanProduct");
  const prop = get(loan, "subjectProperty");
  const lo = get(loan, "loanOriginator");

  const sections: DetailSection[] = [
    {
      title: "Loan",
      rows: rows([
        ["Loan number", plain(loan.loanNumber)],
        ["Channel", plain(loan.loanChannel)],
        ["Loan type", plain(loan.loanType)],
        ["Purpose", plain(loan.loanPurpose)],
        ["Loan amount", money(loan.loanAmount)],
        ["Purchase price", money(loan.salesContractPurchasePrice)],
        ["Down payment", money(loan.downPaymentAmount)],
        ["LTV / CLTV", [pct(loan.loanToValueRatio), pct(loan.combinedLoanToValueRatio)].filter(Boolean).join(" / ") || null],
        ["DTI", pct(loan.debtToIncomeRatio)],
        ["Lowest median credit score", plain(loan.lowestMedianCreditScore)],
        ["Total monthly income", money(loan.totalMonthlyIncome)],
        ["Lead source", plain(loan.leadSourceId)],
      ]),
    },
    {
      title: "Product, rate and lock",
      rows: rows([
        ["Program", plain(get(product, "programName"))],
        ["Mortgage type", plain(get(product, "mortgageType"))],
        ["Amortization", plain(get(product, "loanAmortizationType"))],
        ["Term", typeof get(product, "loanTermMonthsCount") === "number" ? `${get(product, "loanTermMonthsCount")} months` : null],
        ["Note rate", pct(get(product, "noteRate"))],
        ["APR", pct(get(product, "annualPercentageRate"))],
        ["P&I payment", money(loan.mortgagePrincipalAndInterestMonthlyPayment)],
        ["Lock status", plain(get(product, "rateLockStatus"))],
        ["Lock period", typeof get(product, "rateLockPeriod") === "number" ? `${get(product, "rateLockPeriod")} days` : null],
        ["Locked on", fmtDate(get(product, "rateLockedDate"))],
        ["Lock expires", fmtDate(get(product, "rateLockExpiresDate"))],
      ]),
    },
    {
      title: "Property",
      rows: rows([
        ["Address", address(get(prop, "address"))],
        ["County", plain(get(prop, "address", "county"))],
        ["Intended usage", plain(get(prop, "intendedUsageType"))],
        ["Units", plain(get(prop, "numberOfUnits"))],
        ["Estimated value", money(get(prop, "estimatedValueAmount"))],
        ["Appraised value", money(get(prop, "actualValueAmount"))],
      ]),
    },
    {
      title: "Dates and TRID",
      rows: rows([
        ["Application date", fmtDate(loan.loanApplicationDate)],
        ["TRID triggered", fmtDate(loan.tridTriggeredDate)],
        ["LE must be sent by", fmtDate(loan.loanEstimateNeedsToBeSentDate)],
        ["CD must be sent by", fmtDate(loan.closingDisclosureNeedsToBeSentDate)],
        ["Estimated closing", fmtDate(loan.closingDateEstimate)],
        ["Closing date", fmtDate(loan.closingDate)],
        ["Disbursement", fmtDate(loan.disbursementDate)],
        ["Funded", fmtDate(loan.fundedDate)],
        ["First payment", fmtDate(loan.scheduledFirstPaymentDate)],
        ["Created in Vesta", fmtDate(loan.createdAt)],
      ]),
    },
    {
      title: "Team",
      rows: rows([
        ["Loan originator", plain(get(lo, "fullName"))],
        ["LO NMLS", plain(get(lo, "nmlsId"))],
        ["LO email", plain(get(lo, "email"))],
        ["LO phone", plain(get(lo, "phoneNumber"))],
        ["Branch", plain(get(lo, "organizationBranchName"))],
        ...(Array.isArray(loan.assignedUsers)
          ? (loan.assignedUsers as unknown[]).map(
              (u, i): [string, string | null] => [`Assigned user ${i + 1}`, [plain(get(u, "fullName")), plain(get(u, "email"))].filter(Boolean).join(" · ") || null],
            )
          : []),
        ["Underwriter note", plain(loan.underwriterNote)],
      ]),
    },
  ].filter((s) => s.rows.length > 0);

  const borrowers: BorrowerCard[] = (Array.isArray(loan.borrowers) ? (loan.borrowers as Json[]) : []).map((b) => {
    const name =
      plain(b.fullName) ?? ([b.firstName, b.middleName, b.lastName].filter(Boolean).join(" ") || "Borrower");
    const phones = Array.isArray(b.phoneNumbers)
      ? (b.phoneNumbers as Json[]).map((p) => [plain(p.number), plain(p.type)].filter(Boolean).join(" ")).filter(Boolean).join(", ")
      : null;
    const scores = Array.isArray(b.creditScores)
      ? (b.creditScores as Json[]).map((s) => [plain(s.bureau), plain(s.score)].filter(Boolean).join(" ")).filter(Boolean).join(", ")
      : null;
    return {
      name,
      rows: rows([
        ["Email", plain(b.emailAddress)],
        ["Phone", phones || null],
        ["Current address", address(b.currentAddress)],
        ["eConsent (E-SIGN)", b.econsentStatus ? `${plain(b.econsentStatus)}${b.econsentCapturedOn ? ` · ${fmtDate(b.econsentCapturedOn)}` : ""}` : "Not captured"],
        ["Median credit score", plain(get(b, "medianCreditScore", "score"))],
        ["Credit scores", scores || null],
        ["Marital status", plain(b.maritalStatus)],
        ["Citizenship", plain(b.citizenshipType)],
        ["First-time homebuyer", plain(b.firstTimeHomebuyerIndicator)],
      ]),
    };
  });

  const stages = (Array.isArray(loan.loanStages) ? (loan.loanStages as Json[]) : [])
    .map((s) => ({ name: plain(s.templateName) ?? "Stage", started: fmtDate(s.startDate ?? s.initialStartDate) ?? "" }));

  const allFields: DetailRow[] = [];
  flatten(loan, "", allFields);
  allFields.sort((a, b) => a.label.localeCompare(b.label));

  const lockStatus = plain(get(product, "rateLockStatus"));
  const headline: Headline = {
    name: borrowers[0]?.name,
    state: plain(get(prop, "address", "stateCode")) ?? plain(get(prop, "address", "state")) ?? undefined,
    purpose: plain(loan.loanPurpose) ?? undefined,
    amount: money(loan.loanAmount)?.replace(/\.00$/, "") ?? undefined,
    program: plain(get(product, "programName")) ?? undefined,
    lock: lockStatus
      ? [pct(get(product, "noteRate")), lockStatus, fmtDate(get(product, "rateLockExpiresDate")) ? `exp ${fmtDate(get(product, "rateLockExpiresDate"))}` : null].filter(Boolean).join(" · ")
      : undefined,
    closing: fmtDate(loan.closingDate) ?? fmtDate(loan.closingDateEstimate) ?? undefined,
  };

  return { headline, sections, borrowers, stages, allFields };
}

function mapCondition(c: Json): VestaCondition | null {
  const status = String(c.conditionStatus ?? c.status ?? "");
  if (/cancel/i.test(status)) return null;
  const done = /^(Approved|ManuallyCompleted|AutomaticallyCompleted)$/i.test(status);
  const ready = /^ReadyToApprove$/i.test(status);
  return {
    text: plain(c.objectiveName) ?? plain(c.taskTemplateName) ?? plain(c.documentTypeName) ?? "Condition",
    owner: plain(c.entityDisplayName) ?? "",
    status: done ? "Cleared" : ready ? "Received" : "Open",
    category: plain(c.conditionCategory) ?? "",
    timing: plain(c.conditionTiming) ?? "",
    message: plain(c.externalFacingMessage),
  };
}

function mapDocument(d: Json): VestaDocument {
  return {
    name: plain(d.nameOverride) ?? plain(d.documentTypeName) ?? "Document",
    status: plain(d.status) ?? "",
    uploaded: fmtDate(d.uploadedTimestamp) ?? "",
    expired: d.isExpired === true,
  };
}

export async function getJson(path: string): Promise<unknown> {
  const res = await vestaFetch(path, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200).replace(/\s+/g, " ");
    throw new Error(`${res.status}${body ? `: ${body}` : ""}`);
  }
  return res.json();
}

export async function loadVestaLoanDetail(vestaLoanId: string): Promise<VestaLoanDetail> {
  const id = encodeURIComponent(vestaLoanId);
  const [loanR, condR, docR] = await Promise.allSettled([
    getJson(`/loans/${id}`),
    getJson(`/loans/${id}/objective-conditions`),
    getJson(`/loans/${id}/documents`),
  ]);
  const errors: string[] = [];
  const why = (r: PromiseRejectedResult) => (r.reason instanceof Error ? r.reason.message : String(r.reason));

  let base: Mapped = { headline: {}, sections: [], borrowers: [], stages: [], allFields: [] };
  if (loanR.status === "fulfilled" && isObj(loanR.value)) base = mapLoan(loanR.value);
  else if (loanR.status === "rejected") errors.push(`Loan: ${why(loanR)}`);

  let conditions: VestaCondition[] = [];
  if (condR.status === "fulfilled" && Array.isArray(condR.value)) {
    conditions = (condR.value as Json[]).map(mapCondition).filter((c): c is VestaCondition => c !== null);
  } else if (condR.status === "rejected") errors.push(`Conditions: ${why(condR)}`);

  let documents: VestaDocument[] = [];
  if (docR.status === "fulfilled" && Array.isArray(docR.value)) {
    documents = (docR.value as Json[]).filter((d) => d.status !== "Archived").map(mapDocument);
  } else if (docR.status === "rejected") errors.push(`Documents: ${why(docR)}`);

  return { ...base, conditions, documents, errors };
}

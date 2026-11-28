/**
 * What a Vesta condition asks the borrower for, read the same way pro-api's ConditionsMapper
 * and the borrower portal (BorrowerLoanService) read it:
 *
 * - Only conditions whose dependent party is the Borrower are the borrower's to act on.
 *   Title and Appraisal stay internal; Broker items are the loan officer's.
 * - Closed = Approved, AutomaticallyCancelled or ManuallyCancelled.
 * - Name = taskTemplateName, else objectiveName.
 * - The message is the first of: externalFacingMessage (what the underwriter wrote for the
 *   borrower), instructionsOverride, instruction, additionalInstructions. Internal
 *   instructions are never used.
 * - Plus the open checklist items, the document types that satisfy it, and any link.
 */

type Json = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const arr = (v: unknown): Json[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Json[]) : []);

export type ConditionDetail = {
  id: string;
  name: string;
  /** The underwriter's words for the borrower, if any. */
  message: string | null;
  /** Open checklist items (Instructions tasks). */
  checklist: string[];
  /** Document types that satisfy it (DocumentRequired tasks). */
  documents: string[];
  /** How many of `documents` are needed, when Vesta says. */
  documentsNeeded: number | null;
  link: { name: string; url: string } | null;
  needsDocument: boolean;
};

export const isBorrowerCondition = (c: Json) => s(c.objectiveDependentExternalPartyType) === "Borrower";

export const isClosed = (c: Json) => /^(Approved|AutomaticallyCancelled|ManuallyCancelled)$/i.test(String(c.conditionStatus ?? ""));

export function conditionDetail(c: Json): ConditionDetail {
  const name = s(c.taskTemplateName) ?? s(c.objectiveName) ?? s(c.documentTypeName) ?? "An item for your loan";
  const checklist = arr(c.instructions)
    .filter((i) => i.isCompleted !== true)
    .map((i) => s(i.name))
    .filter((n): n is string => Boolean(n));
  const dcs = arr(c.documentConditions);
  const documents = Array.from(
    new Map(
      dcs
        .flatMap((dc) => arr(dc.requiredDocumentTypes))
        .map((dt) => s(dt.name))
        .filter((n): n is string => Boolean(n))
        .map((n) => [n.toLowerCase(), n]),
    ).values(),
  );
  const needed = dcs.map((dc) => (typeof dc.numberOfRequiredDocumentTypes === "number" ? dc.numberOfRequiredDocumentTypes : null)).find((n) => n !== null) ?? null;
  const linkUrl = s(c.externalLinkUrl);
  const type = String(c.taskTemplateType ?? "");
  return {
    id: String(c.id ?? c.conditionId ?? c.taskId ?? name),
    name,
    message: s(c.externalFacingMessage) ?? s(c.instructionsOverride) ?? s(c.instruction) ?? s(c.additionalInstructions),
    checklist,
    documents,
    documentsNeeded: needed,
    link: linkUrl && /^https:\/\//i.test(linkUrl) ? { name: s(c.externalLinkName) ?? "Open the link", url: linkUrl } : null,
    needsDocument: /^(DocumentRequired|ManualDocumentRequest)$/i.test(type) || documents.length > 0,
  };
}

/** The part of a condition email that says exactly what to provide. */
export function conditionText(d: ConditionDetail): string {
  const parts: string[] = [];
  if (d.message) parts.push(`What the underwriter needs:\n${d.message}`);
  if (d.checklist.length) parts.push(`${d.message ? "Checklist" : "What to do"}:\n${d.checklist.map((i) => `- ${i}`).join("\n")}`);
  if (d.documents.length) {
    const lead =
      d.documents.length === 1
        ? "Document that works"
        : d.documentsNeeded && d.documentsNeeded < d.documents.length
          ? `Send ${d.documentsNeeded === 1 ? "any one" : `any ${d.documentsNeeded}`} of these`
          : "Documents that work";
    parts.push(`${lead}:\n${d.documents.map((n) => `- ${n}`).join("\n")}`);
  }
  if (d.link) parts.push(`${d.link.name}: ${d.link.url}`);
  return parts.join("\n\n");
}

/** One condition as a short paragraph for the daily update: its name, then what to provide. */
export function conditionSummary(d: ConditionDetail): string {
  const lines = [d.name];
  if (d.message) lines.push(d.message);
  if (d.checklist.length) lines.push(`To do: ${d.checklist.join("; ")}.`);
  if (d.documents.length) {
    const lead =
      d.documents.length === 1
        ? "Document that works"
        : d.documentsNeeded && d.documentsNeeded < d.documents.length
          ? `Send ${d.documentsNeeded === 1 ? "any one" : `any ${d.documentsNeeded}`} of`
          : "Documents that work";
    lines.push(`${lead}: ${d.documents.join(", ")}.`);
  }
  if (d.link) lines.push(`${d.link.name}: ${d.link.url}`);
  return lines.join("\n");
}

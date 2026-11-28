/**
 * The borrower email layout, matching what homeloanagents-web sends (lib/call-recap):
 * wordmark header, white card on a light grey page, the AI-prepared line, the message, and the
 * Section 2.2 transactional footer. The footer text is copied from homeloanagents-web
 * lib/call-recap/footers.ts; keep the two in sync.
 */

const NAMING_LINE = "United Fidelity Funding Corp. d/b/a HomeLoanAgents, NMLS #34381";
const PHONE = "(417) 524-3687";
const LOAN_OFFICER_LINE = "Loan officer: Mark Ramirez, NMLS #1192984";
const ADDRESS_LINE = "1300 NW Briarcliff Pkwy, Ste 275, Kansas City, MO 64150";
const NMLS_URL = "https://www.nmlsconsumeraccess.org/";
const PRIVACY_URL = "https://homeloanagents.com/privacy";
const LICENSING_URL = "https://homeloanagents.com/licensing";
const TEXAS_NOTICE_URL = "https://homeloanagents.com/licensing#texas";

export const AI_PREPARED_LINE =
  "This message was prepared by an AI assistant. It may contain mistakes. A licensed loan officer is available to confirm anything in it.";

const AI_DISCLAIMER = `This message was prepared with AI assistance and may contain mistakes. It is general information. It is not a Loan Estimate, a rate or fee quote, or a loan approval. Not a commitment to lend. All loans are subject to credit and property approval. To reach a licensed loan officer, reply to this email or call ${PHONE}.`;

const FOOTER_STYLE = "margin:0;padding:0;background:#ffffff;color:#595959;font-size:12px;line-height:1.5;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;";
const LINK_STYLE = "color:#595959;text-decoration:underline;";

const row = (html: string, padding = "0 0 8px") =>
  `<tr><td style="padding:${padding};font-size:12px;line-height:1.5;color:#595959;background:#ffffff;">${html}</td></tr>`;

/** Section 2.2 transactional footer (HTML), as homeloanagents-web sends it. */
export function transactionalFooterHtml(): string {
  const tel = `<a href="tel:+14175243687" style="${LINK_STYLE}">${PHONE}</a>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${FOOTER_STYLE}">${[
    row(NAMING_LINE, "0 0 4px"),
    row(LOAN_OFFICER_LINE, "0 0 4px"),
    row(`${ADDRESS_LINE} | ${tel} | <a href="https://homeloanagents.com" style="${LINK_STYLE}">homeloanagents.com</a>`, "0 0 4px"),
    row(`For licensing information, go to: <a href="${NMLS_URL}" style="${LINK_STYLE}">www.nmlsconsumeraccess.org</a>`, "0 0 12px"),
    row(AI_DISCLAIMER.replace(PHONE, tel), "0 0 12px"),
    row("California: Loans made or arranged pursuant to a California Financing Law license.", "0 0 4px"),
    row(`Texas: United Fidelity Funding Corp., NMLS #34381, homeloanagents.com. Texas Consumer Complaint Notice: <a href="${TEXAS_NOTICE_URL}" style="${LINK_STYLE}">${TEXAS_NOTICE_URL}</a>`, "0 0 4px"),
    row("Florida: United Fidelity Funding Corp., Mortgage Lender License MLD506, NMLS #34381.", "0 0 12px"),
    row("Equal Housing Lender", "0 0 4px"),
    row(`<a href="${PRIVACY_URL}" style="${LINK_STYLE}">Privacy Notice</a> | <a href="${LICENSING_URL}" style="${LINK_STYLE}">Licensing and disclosures</a>`, "0 0 8px"),
    row("To stop receiving emails from us, reply with the word unsubscribe.", "0"),
  ].join("")}</table>`;
}

/** Section 2.2 transactional footer (plain text), starting with the "--" line. */
export function transactionalFooterText(): string {
  return `--
${NAMING_LINE}
${LOAN_OFFICER_LINE}
${ADDRESS_LINE} | ${PHONE} | homeloanagents.com
For licensing information, go to: www.nmlsconsumeraccess.org (${NMLS_URL})

${AI_DISCLAIMER}

California: Loans made or arranged pursuant to a California Financing Law license.
Texas: United Fidelity Funding Corp., NMLS #34381, homeloanagents.com. Texas Consumer Complaint Notice: ${TEXAS_NOTICE_URL}
Florida: United Fidelity Funding Corp., Mortgage Lender License MLD506, NMLS #34381.

Equal Housing Lender
Privacy Notice: ${PRIVACY_URL} | Licensing and disclosures: ${LICENSING_URL}
To stop receiving emails from us, reply with the word unsubscribe.`;
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Escapes, then links email addresses, web addresses and the phone number. */
function inline(t: string): string {
  return esc(t)
    .replace(/\b(https?:\/\/[^\s<]+[^\s<.,;:)])/g, '<a href="$1" style="color:#0f4c81;">$1</a>')
    .replace(/(^|[\s(])([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, '$1<a href="mailto:$2" style="color:#0f4c81;">$2</a>')
    .replace(/\(417\) 524-3687/g, '<a href="tel:+14175243687" style="color:#0f4c81;">(417) 524-3687</a>');
}

const BULLET = /^\s*[-•*]\s+/;

/** Paragraphs, with runs of "- item" lines as a list (also inside a paragraph). */
function bodyHtml(body: string): string {
  return body
    .trim()
    .split(/\n{2,}/)
    .map((p) => {
      const out: string[] = [];
      let text: string[] = [];
      let items: string[] = [];
      const flushText = () => {
        if (text.length) out.push(`<p style="margin:0 0 ${items.length ? 4 : 16}px;">${text.map(inline).join("<br>")}</p>`);
        text = [];
      };
      const flushItems = () => {
        if (items.length) out.push(`<ul style="margin:0 0 12px;padding-left:20px;">${items.map((l) => `<li style="margin:0 0 4px;">${inline(l)}</li>`).join("")}</ul>`);
        items = [];
      };
      for (const line of p.split("\n").filter((l) => l.trim())) {
        if (BULLET.test(line)) {
          if (text.length) {
            out.push(`<p style="margin:0 0 4px;">${text.map(inline).join("<br>")}</p>`);
            text = [];
          }
          items.push(line.replace(BULLET, ""));
        } else {
          flushItems();
          text.push(line);
        }
      }
      flushItems();
      flushText();
      return out.join("");
    })
    .join("");
}

/** The full HTML email. `body` is the message without any footer. */
export function emailHtml(subject: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1f2c;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr>
              <td style="padding:28px 28px 8px;">
                <img src="https://homeloanagents.com/brand/homeloanagents-wordmark-color.svg" alt="HomeLoanAgents" width="200" height="32" style="display:block;" />
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 4px;font-size:15px;line-height:1.6;color:#334155;">
                <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#595959;">${esc(AI_PREPARED_LINE)}</p>
                ${bodyHtml(body)}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 28px;border-top:1px solid #e2e8f0;background:#ffffff;">
                ${transactionalFooterHtml()}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** The plain-text part: the same layout as text. `body` is the message without any footer. */
export function emailText(body: string): string {
  return `${AI_PREPARED_LINE}\n\n${body.trim()}\n\n${transactionalFooterText()}`;
}

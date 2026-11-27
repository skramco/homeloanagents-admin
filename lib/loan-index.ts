import type { Loan } from "./types";

export function indexLoans(loans: Loan[]) {
  return Object.fromEntries(loans.map((l) => [l.id, { id: l.id, name: l.name, state: l.state, bot: l.bot, botNow: l.botNow }]));
}

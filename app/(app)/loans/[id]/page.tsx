import { notFound } from "next/navigation";
import { LoanFile } from "@/components/LoanFile";
import { loadLoan } from "@/lib/data";
import { loadVestaLoanDetail } from "@/lib/vesta/loan";

export default async function LoanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loan = await loadLoan(id);
  if (!loan) notFound();
  if (loan.source !== "vesta") return <LoanFile loan={loan} />;

  const vesta = await loadVestaLoanDetail(loan.id.replace(/^v-/, ""));
  // Real conditions from Vesta replace the empty list on the pipeline row.
  // The full loan fills header fields the pipeline view may not carry.
  const h = vesta.headline;
  const gap = (v: string) => !v || v === "Not set" || v === "—" || v === "Not locked" || v.startsWith("Loan #") || v === "Unnamed borrower";
  const merged = {
    ...loan,
    name: gap(loan.name) && h.name ? h.name : loan.name,
    state: gap(loan.state) && h.state ? h.state : loan.state,
    purpose: gap(loan.purpose) && h.purpose ? h.purpose : loan.purpose,
    amount: gap(loan.amount) && h.amount ? h.amount : loan.amount,
    program: gap(loan.program) && h.program ? h.program : loan.program,
    lock: gap(loan.lock) && h.lock ? h.lock : loan.lock,
    closing: !loan.closing && h.closing ? h.closing : loan.closing,
    conditions: vesta.conditions.map(({ text, owner, status }) => ({ text, owner, status })),
  };
  return <LoanFile loan={merged} vesta={vesta} />;
}

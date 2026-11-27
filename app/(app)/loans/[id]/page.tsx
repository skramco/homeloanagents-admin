import { notFound } from "next/navigation";
import { LoanFile } from "@/components/LoanFile";
import { loadLoan } from "@/lib/data";

export default async function LoanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loan = await loadLoan(id);
  if (!loan) notFound();
  return <LoanFile loan={loan} />;
}

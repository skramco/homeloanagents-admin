import { Loading } from "@/components/Loading";

export default function OutboundLoading() {
  return <Loading title="Outbound review" steps={["Reading active loans and open conditions from Vesta", "Grok is writing the daily updates and condition emails", "Running the compliance check on each draft"]} />;
}

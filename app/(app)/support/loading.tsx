import { Loading } from "@/components/Loading";

export default function SupportLoading() {
  return <Loading title="Support inbox" steps={["Reading support email and texts from the last 7 days", "Matching each sender to their loan in Vesta", "Grok is writing a reply for each message"]} />;
}

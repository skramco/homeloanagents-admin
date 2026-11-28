import { Loading } from "@/components/Loading";

export default function InboxLoading() {
  return <Loading title="Inbox" steps={["Loading active loans and their conditions from Vesta", "Reading support@ email and texts", "Checking which drafts were already reviewed"]} />;
}

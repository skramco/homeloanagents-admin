import { redirect } from "next/navigation";

/** Moved in the simpler layout (Today, Loans, Inbox, Bots). */
export default function Moved() {
  redirect("/inbox?tab=send");
}

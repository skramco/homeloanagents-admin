// Every 15 minutes: refresh the HLA loan list in Supabase from the HLA pipeline view.
// The work happens in the app's /api/cron/sync-loans route; this only triggers it.
export default async () => {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.warn("sync-hla-loans: URL or CRON_SECRET missing");
    return;
  }
  const res = await fetch(`${base}/api/cron/sync-loans`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
  console.log(`sync-hla-loans: ${res.status} ${(await res.text()).slice(0, 200)}`);
};

export const config = { schedule: "*/15 * * * *" };

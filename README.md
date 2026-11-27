# HLA Loan Manager

Internal admin app for the HomeLoanAgents team (Mark, Processor 1, Processor 2, Lorinn). It shows every file as one pipeline, from the first call to the xAI voice agent through funding in Vesta, and lets the team supervise the bots: approvals, outbound message review, escalations, a bot monitor, and a per-file view with bot chat.

Planned home: **admin.homeloanagents.com**, deployed as its own Netlify project.

## What works in v0

- **Sign-in** with a shared team password (fails closed if not configured). Every page except `/login` needs a session.
- **Pipeline** with pilot KPIs, stage filters and one row per file.
- **Live voice-agent leads**: when Supabase keys are set, real rows from `call_leads` (written by the homeloanagents-web webhook) appear at the top of the pipeline as Lead-stage files, with the call summary on the file.
- **Mark’s approvals, Outbound review, Escalations, Bot monitor, Loan file** (status and conditions, bot activity, borrower communication, audit log) and **bot chat**. These run on sample data from `lib/sample-data.ts`.
- Clicks (approve, send, pause a bot, chat) are saved only in your browser’s local storage so you can try the flow. Nothing is sent to borrowers or other systems. **Reset demo** in the sidebar clears it.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

Environment variables (see `.env.example`):

| Variable | Needed for |
|---|---|
| `ADMIN_PASSWORD` | Signing in. Long random passphrase. |
| `ADMIN_SESSION_SECRET` | Signing session cookies. At least 32 characters: `openssl rand -hex 32` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Optional. Real voice-agent leads from the UFF Loans project. Same values as homeloanagents-web. |
| `VESTA_BETA_API_TOKEN`, `VESTA_BETA_API_URL` | Vesta BETA. URL defaults to `https://uff.beta.vesta.com/api/v1`. |
| `VESTA_PROD_API_TOKEN`, `VESTA_PROD_API_URL` | Vesta PROD. No default URL, so PROD stays off until both are set. |
| `VESTA_API_VERSION` | Optional, defaults to `26.2`. |

## Deploy to Netlify at admin.homeloanagents.com

1. Netlify → **Add new project** → **Import an existing project** → GitHub → `skramco/homeloanagents-admin`. Build settings come from `netlify.toml`.
2. **Project configuration → Environment variables**: add the four variables above. Mark `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` as secret.
3. **Domain management → Add a domain** → `admin.homeloanagents.com`, then add the DNS record Netlify shows (a CNAME to the project’s netlify.app name) wherever homeloanagents.com’s DNS lives. Netlify issues the HTTPS certificate.
4. Deploy. Visiting any page sends you to `/login`.

## Vesta BETA / PROD switch

The bar under the pilot banner picks which Vesta environment the app calls. It defaults to **BETA**, only Mark can switch to **PROD** (with a confirm), the bar turns red while PROD is on, and the choice resets to BETA when the 12-hour session ends. Server code calls Vesta through `vestaFetch()` in `lib/vesta/config.ts`, which adds `Authorization: Token …` and `X-Api-Version` like the Pro Portal does. Tokens never reach the browser.

## Data

- `supabase/migrations/20261126164500_call_leads.sql`: copy of the existing table from homeloanagents-web, for reference. Already applied.
- `supabase/migrations/20261127220000_loan_manager.sql`: **not applied yet.** Adds `loan_files` (one row per borrower across voice agent, portal and Vesta, with the consent ledger and TRID dates) and `events` (append-only audit log, blocked from update and delete). Apply it in the Supabase SQL editor when we start writing real events.

## Security notes and next steps

- v0 uses one shared password plus a picked name. Before showing real borrower files beyond voice-agent leads, switch to **Supabase Auth with per-user accounts and MFA**, and record each action in `events` under the signed-in person.
- The app sends `X-Robots-Tag: noindex` and the session cookie is `HttpOnly`, `Secure` and `SameSite=Strict`, expiring after 12 hours.
- The service role key is only used on the server.

Roadmap:

1. Real auth (Supabase Auth + MFA), then write approvals, sends and escalation outcomes to `events`.
2. Create `loan_files` rows from `call_leads` and portal events; dedupe by phone and email.
3. Vesta sync for status, conditions and TRID dates (reuse the Pro Portal’s Vesta integration code).
4. Message gateway: Compliance monitor → Outbound review → Twilio/Resend, with consent and do-not-call checks.
5. Ratesboard drafts into Mark’s approvals; per-file bot chat backed by the real bots.

## Project layout

```
app/(app)/          signed-in pages (pipeline, approvals, outbound, escalations, bots, loans/[id])
app/login/          sign-in page and server actions
components/         UI (client components)
lib/sample-data.ts  sample files, queues and the 12-bot roster
lib/data.ts         loads live call_leads from Supabase and merges with sample data
lib/session.ts      signed-cookie session
middleware.ts       requires a session on every page
app/tokens.css      HomeLoanAgents brand tokens (copied from homeloanagents-web)
```

# Progress log

Daily record of what was accomplished, newest day on top. Every working session must read this
file first and update it before ending. Run `npm run progress` to stamp a new day with measured
numbers, then fill in the Done / Decided / Open sections by hand.

Entries marked **reconstructed** were rebuilt after the fact from commit timestamps, file
modification times, run logs and the SQLite database, not written live. Treat their narrative as
best-effort and their numbers as exact.

---

## 2026-09-24 (Thursday)

**Snapshot at end of day**

| Metric | Value |
|---|---|
| Commits on main | 55 (0 today, head `1ef5db5`) |
| Pushed to origin | yes, in sync |
| Uncommitted files | 0 |
| Typecheck | pass |
| Tests | 163 pass, 0 fail (10 suites) |
| Source lines (src/) | 8042 across 52 files |
| Test lines (tests/) | 2633 across 27 files |
| Agent runs in DB | 28 (forward-deployed-tester:succeeded,sdet-architect:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded) |

**Done**

> Most of this session's work is logged under 23 Sep, below; it ran past midnight. This entry is
> the handoff.

- **$1,000 owner contribution wired to Hyde View's Relay checking** (Thread Bank, ••2813). It was
  in transit at the end of the session; Relay says 2–3 business days. Recorded in the finops
  ledger as row `l_07c098b4`, status Pending. Relay has a virtual card, ••9671, for agency bills.
- **READMEs updated:**
  - `ai-tool-dashboard/README.md` gets a note that the CRM is moving out (uncommitted, with the
    rest of that repo's CRM work).
  - `askdbl-crm/README.md` gets a status and next-steps section (local commit `646ad3f`).

- **askdbl-crm published (after landing):**
  - Private GitHub repo https://github.com/akc031185/askdbl-crm, `main` at `646ad3f`.
  - Vercel project `askdbl-crm`, connected to the repo so pushes deploy.
  - Env set without printing: `AUTH_SECRET` and `CRON_SECRET` (generated, sensitive) and
    `CRM_DB_NAME=crm`. Waiting on the owner to paste `CRM_MONGODB_URI`.
  - `crm.askdbl.com` moved from `ai-tool-dashboard-pdo1` (whose three investoraiclub domains stay
    valid) to `askdbl-crm`. DNS still needs the GoDaddy record `A crm 76.76.21.21`.

**Decided**

- **Relay funding:** $1,000 for about three months of agency running costs (~$250/month plus the
  one-offs). Move agency subscriptions to the Relay card once the wire posts.

**Open / next**

1. **Publish askdbl-crm:**
   - a private GitHub repo and a Vercel project; move `crm.askdbl.com` onto it;
   - the owner pastes `CRM_MONGODB_URI` and `AUTH_SECRET`;
   - seed workspaces and pipelines, and create the owner.
   See `askdbl-crm/README.md` Status and `docs/MIGRATION.md`.
2. **Owner:** finish the GoDaddy "Continue & Verify" for the `A crm 76.76.21.21` record, and
   verify the Relay email.
3. **Owner:** start US SMS registration (A2P 10DLC) on Twilio before the move.
4. **Cut-over:**
   - migrate `ops` (dry run, then apply);
   - issue an InvestorAI Club API key;
   - set `CRM_API_URL` and `CRM_API_KEY` in investoraiclub;
   - commit the `ai-tool-dashboard` CRM client, which is mixed with another workstream's
     uncommitted automation files (never stage those);
   - then `GHL_SYNC=off` and cancel GHL.
5. **Before real use:**
   - a cron scheduler (Vercel Pro or an outside one);
   - SMS consent, STOP replies and unsubscribe;
   - a rate limit on `/leads`;
   - member invites.
6. **Deferred:** the real $99 re-audit and refund; move Atlas Free to Flex once funded.
7. **Entity: DECIDED A, repurpose Hyde View** as the AI-agency LLC (ledger `l_514b52d5`,
   in progress; `l_241f4c21` "new LLC" cancelled as superseded). Next: the clean-up in step 1 with
   the bookkeeper/CPA, then pick the new name, then Articles of Amendment. Twilio A2P waits for the
   final legal name.

---

## 2026-09-23 (Wednesday)

**Snapshot at end of day**

| Metric | Value |
|---|---|
| Commits on main | 47 (0 today, head `65dca17`) |
| Pushed to origin | yes, in sync |
| Uncommitted files | 0 |
| Typecheck | pass |
| Tests | 163 pass, 0 fail (10 suites) |
| Source lines (src/) | 8042 across 52 files |
| Test lines (tests/) | 2633 across 27 files |
| Agent runs in DB | 28 (forward-deployed-tester:succeeded,sdet-architect:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded) |

**Done**

- **Backfilled the 22 Sep entry** (below, marked reconstructed). macOS file access to
  `~/Documents` is working again. `a4cf61d` here; `ai-tool-dashboard` `87be480` adds a
  "Progress (22–23 Sep 2026)" checklist to `docs/STRIPE-GO-LIVE.md`. Both pushed.
- Checks before those commits: this repo typecheck pass, 163/163 tests. `ai-tool-dashboard`
  `tsc --noEmit` clean, Jest 271/271 tests pass. Six Playwright specs under `playwright/tests/`
  show as failed suites because Jest collects them and cannot run them; they are not unit tests.
- **Relay business checking is ready**, so the next step is adding it as the payout bank in Stripe.
  The attempt from the plane got as far as the Stripe dashboard's loading screen and no further.
- **Stripe activation submitted, and the owner linked Relay as the payout bank.** Two representative
  tasks (information, identity document) are *In review*. Payments and payouts stay paused until they
  clear. The owner changed the representative's home address before the review started.
- **Live receipts on**: Settings → Customer emails → Successful payments. Refund emails left off.
- **Live webhook created**: `investoraiclub-production` (`we_1UJ2j9RrwEz0xhBD7YRN9QiB`), Active,
  API `2026-01-28.clover` (matches `src/lib/stripe.ts`), `checkout.session.completed` only, to
  `https://www.investoraiclub.com/api/stripe/webhook`. That URL answers an unsigned POST with 400
  and no redirect, which is correct.
- **Stripe review cleared**: no active tasks. Payments and payouts are active; only Affirm, Cartes
  Bancaires and Scalapay are paused, and the $99 checkout uses none of them.
- **Live keys in Vercel `ai-tool-dashboard-pdo1`, Production only.** The owner pasted all three.
  Redeployed `87be480` with no build cache (1m 47s, Ready).
- **Health check (03:15 UTC): `ok: true`.** Stripe returns `mode=live` (balance retrieved), and
  MongoDB, Blob, GHL and Resend are all ok. Every env var reports `ok`. `CRON_SECRET` was read from
  a `vercel env pull` into the session scratchpad without being printed, and the file was deleted
  straight after. The owner added a `Bash(vercel env pull:*)` allow rule for this.

**Decided**

- Working in flight: local steps continue, each online step gets one try, and a failure means
  stopping and resuming once the connection is back rather than retrying.
- **The real $99 re-audit test is deferred** at the owner's request.
- **Replace GoHighLevel entirely with the in-house ops CRM**, and cancel the $99/month plan.
  Customers can host their site anywhere and use our CRM for follow-ups and automations
  (workspaces, site keys, `/api/ops/leads`). The CRM will live on askdbl.com (proposed:
  `crm.askdbl.com`). dadbuildinglegacy.com stays as it is.
- The whole GHL dependency, measured: five functions in `src/lib/ghl.ts`, used by 16 files, plus
  the inbound `pages/api/webhooks/ghl.ts`. Deals and pipeline stages are the one piece not yet
  held in `ops`.
- **CRM step 1 built by parallel agents (uncommitted in `ai-tool-dashboard`, awaiting the owner's
  review).** Two workflows, nine agents:
  - pipelines and deals in `ops` (`src/lib/ops/deals.ts`);
  - `src/lib/crm.ts` as the one CRM entry point, with the 13 GHL call sites rewired to it; it
    writes to GHL as well unless `GHL_SYNC=off`;
  - `docs/CRM-PARITY.md`, about 60 GHL features rated have / partial / missing, with a 9-phase order;
  - a GHL importer, read-only against GHL, dry run by default;
  - host routing for crm.askdbl.com, inactive until `ADMIN_HOST` is set;
  - a backfill of deals for existing requests;
  - the `/admin/crm` board moved onto ops deals.
  The integrators caught two real bugs: `idOf()` recursing forever on a real ObjectId, and a redirect
  loop for signed-in non-admins on the admin host. Verified by hand: `tsc` clean, Jest 339/339 (38 suites).
- **crm.askdbl.com** added to Vercel project `ai-tool-dashboard-pdo1`. The GoDaddy record
  `A crm 76.76.21.21` is filled in but waits on the owner's identity check. The root askdbl.com is
  untouched.
- **System design page published** (private): https://claude.ai/artifact/FucWgBVt8RZ3Mw8PHDEzaM,
  with decisions D1–D6 for the owner.
- **Owner decided D1–D6 (design page v2).** The CRM becomes its **own app and repo**
  (`askdbl-crm`, Next.js App Router) on its **own Atlas cluster**, with its own login (the owner
  plus sub-admins). All CRM screens live there, and every app and site feeds it only through its
  API with a key per workspace. Contacts are separate per business; email and SMS are in, calls
  come later via AI. Storage is shared by default, with a dedicated database per customer when
  the plan needs it. First workspaces: InvestorAI Club and Site Analyzer. The host-routing work in
  `ai-tool-dashboard` is superseded and is being removed.
- **Standalone CRM build started**: a workflow with a scaffold agent, then five agents in parallel
  (contacts and timeline, deals and board, automations with email and SMS, the investoraiclub API
  client with its outbox, and the data move), then an integrator.
- **MongoDB Atlas**: new project `askdbl-crm`, **Free** cluster `crm-prod` on AWS us-east-1.
  Flex was dropped until Relay is funded. User `crm_app` has `readWrite@crm` only (it was
  `readWriteAnyDatabase`, then `CRM` in capitals, both corrected). The auto-created admin user is
  kept for the owner. IP access is `0.0.0.0/0` for Vercel. The billing identity chosen for
  agency vendors is Hyde View Realty LLC, Sheridan WY.
- **Relay**: shows no transactions yet. The owner is funding it by ACH (Relay does not appear to
  support Zelle). Relay also shows an "email needs to be verified" banner. The owner switched to a wire, because
  ACH would arrive too late.
- **Standalone CRM built** at `~/Documents/askdbl-crm` (local commits `2c484d5` scaffold and
  `d5208e4` build; not pushed). Seven agents: a scaffold, five features, an integrator.
  - Next 15 App Router, Auth.js v5 credentials, Mongoose, zod, Tailwind, Vitest.
  - typecheck and lint clean; **236/236 tests** (24 files); the build passes.
  - Ten `/api/v1` endpoints (leads, events up to a 100-event batch, contacts, deals, stage and note
    moves by the calling app's own record id), each checking the API key and its scope.
  - Console for workspaces, contacts, pipelines and board, automations, and settings (API keys,
    members, pipelines).
  - Email through Resend and SMS through Twilio, each checked against consent and the suppression
    list; a job queue for waits.
  - Migration scripts from the old `ops` database and from GHL, dry run by default.
  - The integrator fixed the investoraiclub client, which had the wrong API paths and shapes.
    Every write would have ended up dead in the outbox.
- **investoraiclub side (uncommitted):** `src/lib/crmApi.ts` plus an outbox and cron, off while
  `CRM_API_URL` is unset. The host routing was removed by hand, because the agents' revert was
  blocked. `tsc` clean, Jest 323/323 (38 suites).

**Open / next**

1. GHL replacement, in order: (1) a deal and pipeline model in `ops` behind the same five function
   names, writing to GHL as well until the numbers match; (2) import GHL's contacts, deals and notes
   with a dry run first; (3) delete the GHL code and variables, then cancel the plan;
   (4) `crm.askdbl.com` for admin; (5) offer it to customers per workspace, with Stripe billing.
   SMS (Twilio + A2P 10DLC) and email from each customer's own domain are open questions.
   Check first who owns the uncommitted ops-automations work in `ai-tool-dashboard`.
2. Publish askdbl-crm: a private GitHub repo and a Vercel project, move crm.askdbl.com onto it, and
   set env vars (CRM_MONGODB_URI, AUTH_SECRET; the owner pastes the secrets), seed workspaces,
   create the owner. Then migrate ops (dry run, then apply), issue an investoraiclub API key, set
   CRM_API_URL/KEY and commit the dashboard.
   Open: crons need Vercel Pro or an outside scheduler; SMS consent capture, unsubscribe and STOP
   replies; a rate limit on /leads; member invites.
   Superseded: the old step "owner answers D1–D6; then commit step 1". Deploy order matters: the board
   hides requests that have no deal, so after the deploy run `POST /api/admin/ops/backfill-deals`
   dry run first, then `?dryRun=0`, then migrate-contacts. Set `ADMIN_HOST=crm.askdbl.com` in
   Vercel Production once DNS verifies.
3. Real $99 re-audit of the owner's own site, then refund it (deferred).
2. Consider removing the `vercel env pull` allow rule once it is no longer needed.
3. Then items 3–5 of the 22 Sep list.
3. Jest config in `ai-tool-dashboard` should ignore `playwright/` so the suite count is clean.

---

## 2026-09-22 (Tuesday) — *reconstructed from session memory on 2026-09-23*

**Snapshot at end of day**

| Metric | Value |
|---|---|
| Commits on main | 47 (0 that day, head `65dca17`) |
| Pushed to origin | yes, in sync |
| Uncommitted files | 0 |
| Typecheck | pass |
| Tests | 163 pass, 0 fail (10 suites) |
| Source lines (src/) | 8042 across 52 files |
| Test lines (tests/) | 2633 across 27 files |
| Agent runs in DB | 28 (unchanged from 21 Sep) |

> Measured by `npm run progress` on 23 Sep; nothing was committed in between, so the numbers hold
> for 22 Sep. No code changed. The work was Stripe going live, done in the Stripe, Vercel and bank
> dashboards. `ai-tool-dashboard` is still at head `72a16a8`, and this repo at `65dca17`. The log
> was not written that evening because macOS blocked access to `~/Documents`.

**Done**

- **Stripe live account activated up to "Add your bank".** Email verified. Business type, tax details,
  business details, representative, products (Consulting services), public details and statement
  descriptor (`INVESTOR AI CLUB`, shortened `INVESTORAI`) are filled in. The support phone is kept off
  receipts. The description says outright that no investment advice is given, so a name containing
  "Investor" does not get the account reviewed as a financial business.
- **Payout bank.** The entity's old business checking account had been closed. Applied for a
  fee-free Relay business checking account for the same entity. **Approved 23 Sep.**
- **Registered-agent spend reviewed** (finops ledger `i20`). The four $9.95/month charges are
  per-entity registered-agent fees, and one entity appears to be billed twice. Action: call the
  provider, cancel the entities being closed and any duplicate, and move to annual billing or a
  $25/yr agent.
- **Compared Wyoming LLC formation.** Cheapest well-established option is $153 for the first year,
  then $87/yr. Not needed (see Decided).

**Decided**

- **The agency trades through the owner's existing Wyoming LLC, not a new one.** Its public name
  is Investor AI Club, and the statement descriptor matches the website.
- **Business and support address: the LLC's registered office in Wyoming.** Stripe says to use it
  when the owner operates from abroad, and it will not change after the move.
- **Support email will be `support@investoraiclub.com`.** The domain's mail already runs on Zoho,
  so this is a forward to the owner's inbox. Not created yet.
- **Personal identifiers (SSN, date of birth, full EIN, bank numbers) are typed by the owner
  only.** They are never stored in memory, docs or the log.

**Open / next**

1. Stripe → Add your bank → *Enter bank details manually instead*, with the Relay routing and
   account numbers. Then Secure your account (2FA), Add extras, then Review and submit.
2. Finish `ai-tool-dashboard/docs/STRIPE-GO-LIVE.md`:
   - successful-payment emails on;
   - live webhook endpoint (`checkout.session.completed` only);
   - live keys and signing secret in Vercel project `ai-tool-dashboard-pdo1`, Production only;
   - redeploy;
   - health check shows `mode: live` (needs `CRON_SECRET`, which is not in `.env.local`);
   - one real $99 re-audit, then refund it.
3. Create the Zoho `support@` forward and set it in Stripe → Settings → Public details.
4. Relay "countries of operation": confirm whether India was added.
5. Carried over: check the pilot's opens, the "Audit a site for a customer" form, and the 21 Sep list.

---

## 2026-09-21 (Monday)

**Snapshot at end of day**

| Metric | Value |
|---|---|
| Commits on main | 46 (7 today, head `6109676`) |
| Pushed to origin | yes, in sync |
| Uncommitted files | 0 |
| Typecheck | pass |
| Tests | 163 pass, 0 fail (10 suites) |
| Source lines (src/) | 8042 across 52 files |
| Test lines (tests/) | 2633 across 27 files |
| Agent runs in DB | 28 (forward-deployed-tester:succeeded,sdet-architect:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded) |

> Today's code is in the sibling repo `ai-tool-dashboard` (head `72a16a8`, typecheck clean,
> 213 tests pass). This repo's numbers are unchanged.

**Done**

- **Found why the pilot's report links 404.** Both pilot audits were created at 20:59:02 on the
  20th, 14 seconds after `cd9f359` (workspace scoping) was committed and before it deployed, so
  the pilot's contact has no `workspaceId`. The deployed lookup filters by workspace and misses
  it. The pending contact migration backfills exactly this (`migrateContacts.ts`), so the fix is
  to run the migration rather than write new code.
- 03:35 `0af3a5c` **admins can read any report before it is sent.** A signed-in admin opening
  any public report link gets the findings marked as a preview, with the email gate hidden so it
  cannot be unlocked with the admin's own address by mistake. `findingsUnlocked` stays false and
  nothing is emailed. Checked live after deploy: anonymous requests still get no findings.
- 04:08 `4428298` **the admin audit page crashed on every public audit.** It checked ownership
  with `audit.userId.toString()`, and free-funnel audits have no `userId`, so it returned a 500
  that the page showed as "Audit not found". It also recognised admins by role only, ignoring
  `ADMIN_EMAILS`. Fixed, with a test that fails on the old code.
- `6c1593c` **took the admin preview back off the customer pages** (reverts `0af3a5c`). Once the
  admin page could read public audits, the customer links no longer needed to show admins
  anything extra.
- `b2f789b` **two ways forward from a report.** Under the findings: *have us fix these* (log in
  or sign up, save the report to the account, open a customer request listing every finding;
  admins get an email linking to a new proposal, and the existing proposal flow quotes and bills
  it), or *fix it yourself* and pay $99 to re-run the audit through Stripe Checkout, with the
  webhook starting the run. Deployed; the parts reachable without a login respond correctly.
  The Stripe checkout itself is unexercised until the migration makes the pilot's report resolve.
- `8ada8e9` **checks on views, staleness and money.** The report page reports a view once it has
  loaded in a browser, and again on returning to a tab after 30 minutes away. Link scanners and
  admins are not counted. The page re-reads on focus; actions send the run they show, and the
  server refuses (409, reload) on a newer run, a run in flight, or a checkout already paid. At
  most one open checkout per site (`PendingCheckout`), and sessions expire after 31 minutes.
  The admin audit page shows sent / opened / how often.
- `32dc84f` **follow-up queue, and the contact page bug.** Every interaction was already stored
  per contact, but no page displayed it. The contact list linked to a page that looked contacts
  up as user accounts, so every contact without an account read "Contact not found". Fixed, and
  `/admin/crm/follow-ups` works out who needs contacting from the timeline: quote owed (on us),
  abandoned checkout, came back without acting, read and went quiet 3 days, sent and never opened
  2 days. "Log follow-up" (a note is required) clears the chase reasons.
- **End-to-end test on askdbl.com**: fresh audit, report emailed to a test address, opened in
  incognito windows and tabs. Production recorded 5 views and exactly one "Opened the report"
  timeline line; Gmail's link scanning was not counted. Production app data is in the database
  `test` (already noted in the dashboard README); `.env.local` points at `ai_tool_dashboard`.
- `a228d17` **report links expire after 7 days**, DocuSign style. The address stays stable; the
  keys alone no longer open it. Access: admin, the browser that ran the audit, the account it is
  saved to, or an emailed pass (`?t=`, hashed at rest, swapped for a cookie, dropped from the
  address bar). Expired visitors see the site name and "Email me a new link", which goes only to
  the address on file (3/hour). Every way into a report makes the same check, including unlock,
  so an old link cannot send the findings to a new address. Expired visits feed Follow-ups.
  Admins now send reports from the audit page ("Send this report to its owner"). Verified live.
- 21:31 **contact migration run in production**, from an admin browser session: dry run first,
  then the real run with identical numbers. 7 users found, 6 CRM contacts created for them, 1
  linked to an existing contact, 1 legacy contact copied, 5 records stamped with the workspace
  (the pilot's contact plus 4 timeline events), 3 audit counters set. The pilot's two report
  links then answered 200.
- 21:32 **both pilot reports sent** through the unlock route the admin page uses. No send
  failures logged; two 7-day link passes issued. The pilot's contact now has workspace, email
  and name.
- `72a16a8` **docs brought up to date** in `ai-tool-dashboard`: README (pricing, access, next
  steps, views, follow-ups, today's architecture decisions), a new `docs/STRIPE-GO-LIVE.md`
  checklist, the funnel doc's 21 Sep update, and the runbook's contact-migration section with
  the production numbers.

**Decided**

- **The report email is not routed through the automation engine.** It already sends on
  completion when an address is on file, with its own guards (once only, held when empty, the
  expiring link). The gap is audits started for a customer; the answer is an admin "audit a site
  for a customer" form with a hold-for-review default, not a second send path.
- **Report links last 7 days; the expired page shows the site name only.** A resend goes only to
  the address on file.
- **Follow-ups are derived, never stored as flags.** A reason exists because of events and clears
  because of events (the customer acts, or a follow-up is logged). A quote we owe clears only when
  a proposal goes out, never by logging a call.
- **The server never trusts what a long-open page believes.** Each action names the run it is
  about; anything newer or in flight is refused with a reload instruction.
- **Audit pricing: the first audit of a site is free, every later run is $99 per site**, on both
  the public and signed-in paths. A run after a failed one is free (covers a paid run the worker
  could not start). The signed-in path counts public audits of contacts attached to the account,
  so signing up is not a second free run. Admins are never charged.
- **The fix path goes through the proposal system**, not a price list: a fix request becomes a
  customer request (Problem), which is what proposals quote against and Stripe bills.
- **Reports attach to an account by the link's user key, never by matching email.** Sign-up does
  not verify email addresses, so matching would hand anyone's reports to whoever registers as them.
- Admins review a report on the admin page (`/tools/site-audit/<id>`). The customer's link
  shows exactly what the customer sees, with no special case for admins.

**Open / next**

1. **Pilot:** reports sent 21:32. Watch `/admin/crm/follow-ups`; he appears if the reports are
   not opened in 2 days, or are read and then nothing happens for 3. Ask him the one question
   (what would have made this worth paying for).
2. **Build "Audit a site for a customer"** (admin form: URL, email, optional name, hold for
   review on by default, Approve & send). Also an optional name field on the send box.
3. **Next session starts with Stripe going live**, following `docs/STRIPE-GO-LIVE.md` in the
   dashboard repo: live keys and a live `checkout.session.completed` webhook in Production only,
   then one real $99 re-audit of an own site, refunded.
4. Follow-up thresholds (`FOLLOW_UP_RULES` in `src/lib/ops/followUps.ts`) are first guesses;
   revisit after the first few pilots. The queue does not yet send anything by itself; it is a
   list for a human, and the automation engine is where sending would go.
5. Known gap: someone who clears cookies gets a new contact and a new free audit of the same site.
   Accepted for now; charging per host globally would also charge strangers auditing a site.
6. `ai-tool-dashboard` has two uncommitted files this session did not touch
   (`_tests_/lib/ops-automations.test.ts`, `docs/AUTOMATIONS.md`). Find out whose they are
   before committing anything else there.
7. Carried over: automation run viewer, delays, blob retention, bare `jest` picking up
   Playwright specs, GoHighLevel export, 990challenge.com renews 5 Oct.

---

## 2026-09-20 (Sunday)

**Snapshot at end of day**

| Metric | Value |
|---|---|
| Commits on main | 37 (0 today, head `31da996`) |
| Pushed to origin | yes, in sync |
| Uncommitted files | 0 |
| Typecheck | pass |
| Tests | 163 pass, 0 fail (10 suites) |
| Source lines (src/) | 8042 across 52 files |
| Test lines (tests/) | 2633 across 27 files |
| Agent runs in DB | 28 (forward-deployed-tester:succeeded,sdet-architect:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded) |

### Picking this up

Nothing is half-written; two things are waiting on a human, both quick.

1. **Run the contact migration in production.** Needs an admin session, so it runs from the
   browser on the live site, not from here:
   `await (await fetch('/api/admin/ops/migrate-contacts?dryRun=1',{method:'POST'})).json()`
   Check the numbers, then the same call without `?dryRun=1`. Idempotent; deletes nothing.
   Afterwards: create the pilot access code (`POST /api/admin/ops/access-codes`) and the first
   automation rule (`POST /api/admin/ops/automations`, shape in `docs/AUTOMATIONS.md`).
2. **Two pilot audit reports are done and unsent.** The findings have been read and are sound;
   sending means unlocking each audit with the pilot's email, which triggers the report email.
   Waiting on the go-ahead, not on code.

Then the first real gap: the automation engine records every rule run and nothing displays them.
Its claim — that someone can answer "why did that email go out?" — is unproven until a page
answers it. Build that before any new feature.

> All of today's work is in the sibling repo `ai-tool-dashboard` (investoraiclub.com), so this
> repo's own numbers are unchanged from yesterday. Head there is `478e11f`; typecheck clean,
> 147 tests pass (from 128 this morning).

**Done**

- **The ops platform became the plan of record** (`docs/OPS-PLATFORM.md`, 02:41 `abe4ff5`).
  The earlier documents measured the GoHighLevel migration against what that account holds —
  one contact, one opportunity, no calendars — and concluded it was nearly done. Wrong measure:
  what is being replaced is the job the product does, from a stranger on a site to an invoiced
  client. The rule the whole thing is built by: **own the record, rent the channel.** Contacts,
  conversations, deals and money live in our database because they must outlive any vendor;
  sending an email or a text is a commodity with regulatory overhead, so Resend, Twilio and
  Stripe do that behind an interface we define. Also written down: the five things we refuse to
  build, and that A2P registration needs a US entity and weeks of lead time — before the move.
- 00:13 `3c258ad` **reports moved to `/free-site-audit/<userKey>/<siteKey>`.** One stable address
  per person per site: re-auditing updates it rather than minting a new link, so an emailed link
  keeps working and the runs accumulate as history. 72 bits of randomness, no email address or
  hostname in the URL.
- 00:17 `b3aa40b` the keyed URL immediately exposed a gap: a second audit asked the same person
  for their email again. The address belongs to the person, not to one report.
- 04:49 `73fda4c` **one contact spine, in an `ops` database of its own.** A person is a Contact;
  a login is an attribute of one, because most contacts never register. Until now every
  anonymous audit lead sat in the database invisible to the CRM.
- 20:58 `cd9f359` **every ops record belongs to a workspace.** The one decision that gets more
  expensive with every row, taken while the row count is tiny: tenant scoping applied in one
  seam rather than remembered at each call site.
- 21:06 `478e11f` **six parallel threads, one afternoon**: lead intake (one endpoint, one key per
  site), the automation engine (trigger/conditions/actions, with a run record for every rule that
  matched *and* every one that did not), report HTML moved to Blob storage, rate limiting moved
  out of process memory, reconciliation for the fail-open dual write, per-database and
  per-contact exports, and an apps registry so adding a tool to the hub is data rather than code.
- **Ran the auditor against two real sites for the first pilot tenant.** Both succeeded; the
  findings are substantive for a site raising money (no privacy policy linked, forms that accept
  empty submissions, unknown URLs returning 200). Nothing has been sent to them: a report with
  our name on it gets read by us first.

**Decided**

- **The CRM is a product to build toward, not only internal tooling** — AI-native automation over
  an owned data model, sold well under GoHighLevel, to businesses that do not need telephony.
  Bounded, with a kill criterion: no paying tenant by end of January and it folds back into
  internal tooling, which is worth having anyway. Dropping telephony from v1 is the positioning,
  not a gap: it is what allows the price, and it removes A2P registration entirely.
- **`ops` is a separate database in the same cluster, and it must be self-sufficient.** Mongo
  cannot `$lookup` across databases, so anything the CRM displays is written there; the artifact
  stays in the app that produced it and is linked to. A test holds the rule honest — the contact
  list renders when the app database fails. Writing that test is what exposed the first version
  returning a 500 instead.
- **Applications read people *from* the CRM; the CRM never joins into theirs.** Via an API with a
  per-site key, except the app that hosts the CRM, which calls the same functions in-process.
- **Shared collections with a workspace filter, not a database per tenant** — with tenant
  resolution behind one function, so that decision can be revisited without touching call sites.
- **Site keys are stored hashed.** A site key is a long-lived write credential living on someone
  else's website; "shown once" is only true when there is no read path back.
- Access codes record *why* something is free, with an expiry and a redemption trail, rather
  than being a favour someone remembers granting.

**Open / next**

1. Run the contact migration against production (`POST /api/admin/ops/migrate-contacts`), then
   create the pilot's access code and the first automation rule. Needs an admin session.
2. Send the two pilot audit reports once the findings have been read and approved.
3. The automation engine's run records exist and nothing displays them. Its whole claim — that
   someone can answer "why did that email go out?" — is unproven until a page answers it.
4. Delays are the next real feature: they are what turn rules into sequences, and the first thing
   here needing infrastructure rather than code.
5. Blob-stored reports are never deleted. The document-size ceiling has been traded for a
   billing one until retention lands.
6. `npm test` in the dashboard is still bare `jest`, so it collects the Playwright specs and
   exits non-zero. One `testPathIgnorePatterns` line.
7. Stripe still in test mode; GoHighLevel export still not taken; 990challenge.com auto-renews
   on 5 Oct with a CANCEL decision against it.

---

## 2026-09-19 (Saturday)

**Snapshot at end of day**

| Metric | Value |
|---|---|
| Commits on main | 36 (1 today, head `799b963`) |
| Pushed to origin | yes, in sync |
| Uncommitted files | 0 |
| Typecheck | pass |
| Tests | 163 pass, 0 fail (10 suites) |
| Source lines (src/) | 8042 across 52 files |
| Test lines (tests/) | 2633 across 27 files |
| Agent runs in DB | 25 (forward-deployed-tester:succeeded,sdet-architect:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded) |

**Done**

- **`~/Documents` is readable again** (Full Disk Access granted before this session). Both repos
  pulled to yesterday's heads and verified in the real working tree, not a clone: `45f7b56` here,
  `b67f41a` in the dashboard, both clean, 160 pass / 109 pass.
- **Walked the public funnel as a visitor, end to end, for the first time.** That is the whole
  reason the day found anything: three defects, all invisible to both test suites.
  1. **The findings never reached the customer.** The worker's callback carried
     `findings_by_severity` and no findings, so every unlocked public report read
     *"No findings to show — this site is in good shape"* under a C and a D, and the payoff email
     said *"the worker has not reported any findings for this run yet"* — to someone who had just
     handed over their email for exactly that list. A five-page site of ours produced 15 findings
     locally (2 high, 4 medium, 8 low, 1 info) and delivered 0. Same shape as the 18 Sep area-name
     bug: success, not an error, and each suite mocked the other.
  2. **A bare domain was rejected.** The field's placeholder says `yoursite.com`; `validateAuditUrl`
     handed the input straight to `new URL()`, which needs a scheme. Top of funnel, for anyone who
     types what the placeholder shows. The rate limit was also checked *before* validation, so a
     typo spent one of three tries per hour.
  3. **Resend failures were invisible.** `sendAuditReportEmail` returns `{success:false}` and never
     throws; neither caller looked at the result.
- 17:23 dashboard `c3f5048`, 17:25 worker `799b963`. Deployed dashboard first on purpose: the old
  schema rejects `info` findings, so the reverse order would have failed every callback and hung
  audits on "Running".
- **Verified live after deploy** (audit `6aaf0dd1fe0c581b707ea5db`, submitted as a bare domain):
  15 findings stored with points and effort, the report page leads with the headline and the
  before → after, and the email arrived in seconds from `noreply@investoraiclub.com`.
- **The email was redesigned** around what a grade does not say. It leads with the worst finding's
  consequence ("Search engines are being told to index only your home page."), then
  *"Three fixes, each under an hour, take Search from C 60 to A 94"*, then the three fastest wins
  with what each is worth, then areas split into hurting / worth a look / solid. Mocked up on a
  canvas and approved before any of it was built.
- Worker: `wireFindings()` (fix-plan order, `points`, `pages`), a `HEADLINE` line per high and
  critical check, the contract in `docs/DEPLOYING-THE-WORKER.md`, and `many()` no longer writes
  "classs". Tests 160 → 163; the dashboard's 109 → 124.

**Decided**

- **`points` travels with each finding, so the consequence is arithmetic, not a projection.** Each
  area is 100 minus a fixed cost per finding, so the app can say what a fix is worth without
  re-implementing the scoring or guessing. When the points do not reproduce the stored score, the
  before → after line is dropped rather than shown wrong.
- **An audit graded below A with no findings is not sent.** It means the findings were lost on the
  way, not that there are none. It is held and logged, and the page says so instead of
  "good shape". Silence beats a confident empty report.
- **Headlines are a fixed table in the worker, one per high/critical check**, each restating only
  what that check's own `why` establishes — like `EFFORT`, and for the same reason: two audits of
  one site must read the same. Anything unlisted falls back to the finding's title.
- **The worker's contract grew; the dashboard adapts, as decided on 18 Sep.** `findings` is the
  list, `findings_by_severity` only counts it, and the doc now says so.

**Open / next**

1. The dashboard's `npm test` is bare `jest`, so it collects `playwright/tests/*.spec.ts` and six
   suites fail to resolve. 124 tests pass but the command exits non-zero, so nothing can gate on
   it. One `testPathIgnorePatterns` line.
2. **No contract test spans the two repos.** Three naming defects in two days, each caught only by
   a real round trip. The cheapest guard: a live smoke check that fails when a below-A audit comes
   back with zero findings.
3. Stripe is in test mode, `details_submitted: false` — needs a legal entity, EIN and US bank
   account, then live keys *and* a live-mode webhook secret. Blocks the paid tier.
4. Rotate the GoHighLevel private-integration token that was pasted into a chat window.
5. `NEXT_PUBLIC_CF_BEACON_TOKEN` unset; the four `AWS_S3_*` vars are dead (storage moved to Vercel
   Blob) and can be deleted.
6. Railway cost still unobserved — no full month of billing yet.
7. Funnel steps 4–5 (scheduled re-audits, audit-to-audit diff, then charging for it) are designed
   in `docs/ANALYZER-FUNNEL.md` and not built.

---

## 2026-09-18 (Friday)

**Snapshot at end of day**

| Metric | Value |
|---|---|
| Commits on main | 34 (2 today, head `da77a1b`) |
| Pushed to origin | no (ahead 1, behind 0) |
| Uncommitted files | 0 |
| Typecheck | pass |
| Tests | 160 pass, 0 fail (10 suites) |
| Source lines (src/) | 7978 across 52 files |
| Test lines (tests/) | 2580 across 26 files |
| Agent runs in DB | 0 — not measurable today, see note |

> Numbers measured in a fresh clone at `/tmp/fqa`, not the working copy: macOS withdrew this
> session's access to `~/Documents` mid-session (`ls` → `Operation not permitted`), so the repo
> was unreachable from the tools all day. Commits, typecheck, tests and line counts are exact and
> were run against `da77a1b`. "Agent runs in DB" reads 0 only because a clone has no local SQLite
> file; the real count is whatever the working copy holds. "Uncommitted files: 0" likewise
> describes the clone — **the working copy was never inspected today and may hold changes.**

**Done**

- **The AI Site Auditor worker is deployed and serving real traffic.** Railway Hobby ($5/mo),
  built from this repo's `Dockerfile` on GitHub, at
  `https://forward-qa-agents-production.up.railway.app`. Verified live, in this order: `/health`
  200 · `/health/browser` `{"ok":true,"chromium":true,"launch_ms":143}` · unauthenticated
  `POST /worker/audits` → 401 · `/worker/queue` `{"active":0,"queued":0,"limit":2}` · a real
  audit of a public site **succeeded in 885 ms** with all six areas scored. Chromium really does
  launch as the non-root `pwuser` with `--no-sandbox`, which the shallow probe would not show.
- 02:53 `14ecfa7` `railway.toml`: builder pinned to `DOCKERFILE`, healthcheck on
  `/health/browser`. The builder pin was the load-bearing half — Railway's default is now
  Railpack, which would autodetect a plain Node app and build it **without Chromium**: a green
  deploy where every audit fails. In the repo rather than the dashboard so it survives the
  service being recreated.
- Caught Railway's "Suggested Variables" staging eight values scraped from `.env.example`, which
  is written for local dev. `CHROMIUM_NO_SANDBOX=0` would have overridden the Dockerfile's `1`
  and stopped Chromium launching at all; `DB_PATH` and `WORKSPACE_DIR` pointed outside `/data`.
  Replaced with the three that belong on a host. The file's own comment says "the Dockerfile does
  this for you" — the scanner took the value and dropped the sentence.
- **Wired to investoraiclub.com** (Vercel `ai-tool-dashboard-pdo1`): `AUDIT_WORKER_URL` and
  `AUDIT_WORKER_TOKEN` set on production and preview.
- **Three naming layers were mismatched between worker and dashboard, and every one failed
  silently.** Found only by a real round trip; both repos' suites passed throughout.
  - The route path 404'd — the only honest error in the stack.
  - Field names: `run_id` / `report_html` / `findings_by_severity` against camelCase. Fixing the
    path alone would have been *worse*: the POST succeeds, the run id reads `undefined`, and the
    callback is dropped key by key, saving an audit as `succeeded` with no scores and no report.
  - Area names: `ai-visibility` / `build` / `design` / `readiness` against the schema's
    `aiVisibility` / `buildQuality` / `designOriginality` / `launchReadiness`. Mongoose strips
    undeclared keys, so **two scores of six** were stored — `search` and `responsive`, the two
    that happen to be spelled the same on both sides. It rendered as a partly-filled report.
  - Fixed in `ai-tool-dashboard` `cbca1b6` (03:24) and `b67f41a` (03:27): all translation in one
    function, `normalizeWorkerPayload()`. The worker's documented contract stands; the adapter
    adapts. Dashboard tests **97 → 109**, asserting literal URLs and body keys — the previous
    suite asserted no request shape at all, which is why a wholly wrong contract passed.
  - Verified after: a submission through `POST /api/audits/public` returns all six areas.
- 23:16 `da77a1b` **restored the typecheck gate on this repo.** `b9f9814` added `passwordField`
  to `FormRaw` and missed `cleanEssentials` in the unit fixtures; `tsc` has failed on main since,
  with `585acca`, `5ee92d0` and today's `14ecfa7` landing on top of it. Now clean, 160 pass.
- Deleted a duplicate Vercel project (`ai-tool-dashboard`, same repo and branch as the live one).
  It was a publicly reachable second copy of the site at `ai-tool-dashboard-six.vercel.app`
  holding `MONGODB_URI` and `OPENAI_API_KEY` and nothing else — the same code against the
  **production database** with two of its thirty-odd variables. Every push had been deploying
  twice.

**Decided**

- The dashboard adapts to the worker, not the reverse. The worker's contract is documented and
  verified against real runs, it has no other coupling to that app, and `auditRunner.ts` already
  claimed to be where transport details live.
- `normalizeWorkerPayload()` accepts both spellings of every field. Rejecting an unambiguous
  one costs a lost report; accepting it costs nothing.
- An unrecognised scored area passes through rather than being dropped: a seventh area should
  fail loudly at the schema, not vanish in a mapping function.
- Kubernetes is not needed at this scale and was not used. One container, `AUDIT_WORKER_CONCURRENCY=2`.
  The ladder in `docs/ANALYZER-ARCHITECTURE.md` stands: one container → compose → Kubernetes.
- Railway is interchangeable here. Nothing in the image or the docs favours it over Fly or Render.

**Open / next**

1. **This log's working copy is unverified.** `~/Documents` was unreadable to the session all
   day; everything above came from clones. First job next session: confirm the working copies of
   `forward-qa-agents` and `ai-tool-dashboard` are clean and match `da77a1b` / `b67f41a`, and
   `git pull` both — neither has today's commits locally.
2. `ai-tool-dashboard`'s `npm test` can never pass: it is bare `jest`, so it collects
   `playwright/tests/*.spec.ts` and six suites fail to resolve. 109 tests pass, but the command
   exits non-zero, so nothing can gate on it. One `testPathIgnorePatterns` line.
3. The hero URL field on investoraiclub.com now works end to end. Still unexercised by a human:
   the email-gated unlock, and the report email itself.
4. Stripe is still in test mode — `details_submitted: false`. Needs legal entity, EIN, US bank
   account, then live keys and a **live-mode** webhook secret. Blocks the paid tier entirely.
5. Rotate the GHL private-integration token that was pasted into a chat window.
6. `NEXT_PUBLIC_CF_BEACON_TOKEN` unset; the four `AWS_S3_*` vars are dead since storage moved to
   Vercel Blob and can be deleted.
7. Worker cost unobserved: no real month of Railway billing yet. The $5 plan's included usage
   should cover launch volume; check before advertising.

---

## 2026-09-17 (Thursday)

**Snapshot at end of day**

| Metric | Value |
|---|---|
| Commits on main | 21 (11 today, head `5b5154b`) |
| Pushed to origin | no (ahead 7, behind 0) |
| Uncommitted files | 0 |
| Typecheck | pass |
| Tests | 119 pass, 0 fail (11 suites) |
| Source lines (src/) | 7141 across 47 files |
| Test lines (tests/) | 1789 across 18 files |
| Agent runs in DB | 12 (forward-deployed-tester, sdet-architect, ai-site-auditor ×10; all succeeded) |

**Done**

- Read the log, checked all five folders against it: state matched. Put the overnight publish
  decision to the user, who chose to publish both sites, round the mascot value first, and
  cross-link all four mastheads.
- 00:45 Cross-linked every field guide site so a reader landing on one can reach the rest.
  Each masthead now carries the other three plus the QA Agents hub; footers and READMEs list the
  same set. The FDT thesis link moved from the nav to the footer to hold the bar at seven items.
  `assets/site.css`: nav wraps on desktop, scrolls horizontally under 560px, so it never overflows.
- Rounded two generated pixel values that were leaking float noise into published HTML: the hero
  mascot (`106.39999999999999px` → `106px`, `_build/build-catalog.ts`) and the confidence-ladder
  bars (`115.49999999999999` → 0.1px precision, `_build/author/diagrams.mjs`).
- 01:02 Gates green, committed `27f552f` (9 files, +28/−20) and pushed.
- **Published two new public GitHub Pages sites**, both built · live · verified:
  `akc031185/ai-site-auditor` (commit `4733f00`) at https://akc031185.github.io/ai-site-auditor/
  and `akc031185/sdet-roadmap` (commit `abfbbbb`) at https://akc031185.github.io/sdet-roadmap/.
  Each got a README pointing back at the generator and the MIT LICENSE from the FDT repo.
- Pushed the rebuilt FDT (`56297c1`) and SDET Architect (`92710b2`) sites, which carried the
  mascot fix that had sat uncommitted since 09-14.
- Verified live: all eight cross-link targets return 200, and the fetched mastheads on all four
  sites serve the new nav.
- Made `forward-qa-agents` **public** after a full audit of the working tree and all history:
  no secrets in any blob, no client or colleague names, fixtures all on reserved test domains,
  emails all `example.*`. Scrubbed three internal references from this log first (two other
  internal guides by name, defects found on unrelated personal builds, a hint at a second GitHub
  account) — commit `72372ac`. History still holds them; accepting that was the user's call.
  Every deep link from the four public sites now resolves for an anonymous visitor.
- README: linked the four live guides, repaired the stale table (two were listed as unpublished)
  and corrected counts left from when there were two agents (`27664e3`).
- **Plate 46 grew from 51 checks to 87**, from three creator checklists the user supplied
  (pre-launch, legal, and "20 reasons why your app looks vibecoded"):
  - `a7f5bf5` **Design originality**, 19 checks — the violet-to-blue gradient, gradient hero text,
    emoji headings, scaffold fonts, glassmorphism, the three-icon row, badge above the headline,
    Lucide icons, untouched shadcn, fade-on-scroll, cursor beam, opacity-only hover, off-scale
    spacing, italic serif accents, buzzword copy, em-dash density, WCAG AA contrast, grain over
    gradient. Same architecture as the rest: an in-page script measures, pure functions judge.
  - `4cb36de` **Launch readiness**, 17 checks — policies, consent before tracking, third-party
    inventory, forms, spam protection, analytics, CTA, contact and legal identity, dead-end 404,
    focus outline, divs wired to click.
  - `29f7613` the report now leads with a prioritised fix plan; `1094b33` findings fold into the
    plan rows and evidence renders as evidence; `b60371d` client-facing header and branded footer.
- Two false positives found by running against real sites, both fixed before any client saw them:
  `0b01c59` a form with no `action` is unverifiable, not broken (a React `onSubmit` form is fine),
  and `5b5154b` `noindex` on `/login` or `/auth/register` is correct practice, not a defect.
  The second was caught on the user's own site and moved its search score from 32 to 50.
- Scoring bug caught by an integration test: design tells are mostly info-weight, so a site could
  trip all nineteen and still score 100. Design is now scored by accumulation, 6 points per tell.
- Ran the tool on three real sites with the owner's consent: two belonging to a contact who asked
  for feedback, and the user's own. All three fail launch readiness hardest (no privacy policy,
  no terms, no analytics, unprotected forms), while building and AI visibility are fine.

- **Afternoon, a second repo: `ai-tool-dashboard` (investoraiclub.com).** The user asked for the
  auditor's findings fixed there and for the tool to be offered on that site. Found and fixed, in
  order of severity:
  - Every `<title>` on 11 pages rendered as `About | <!-- -->InvestorAI Club` to crawlers.
    `<title>Text | {EXPR}</title>` gives React two children and its SSR writes a `<!-- -->`
    separator; comments are not parsed inside `<title>` (RCDATA), so that is the literal string
    Google and every AI crawler received. Eleven titles across ten files.
  - **Deployments had failed since February.** `vercel.json` declared an hourly cron and the
    account had moved Pro -> Hobby, which permits daily at most, so Vercel rejected every push
    before building. The site was serving February's code. Moved the hourly email drip to a
    GitHub Actions workflow calling the same route with the same `CRON_SECRET` bearer header,
    keeping a daily Vercel call as a backstop. First successful deploy in 209 days.
  - **Eight production environment variables carried a literal `\n`** from one bad paste. That
    silently broke: the Stripe webhook secret (paid proposals never marked paid), the Stripe
    publishable key, all four S3 variables, `ADMIN_EMAILS` (locking the owner out of admin), the
    Calendly URL, the GHL token and location/pipeline ids, and the GHL chat widget's location id.
    Nine integrations, no error anywhere: these all fail silently by design. The GHL token was
    never expired — stripped of the escape it returned 200 immediately.
  - Also added: privacy and terms pages, security headers (no `next.config.js` existed), llms.txt,
    og:image, canonical host fix, published support address.
- Three parallel subagents in git worktrees added analytics (Plausible, env-gated), honeypot and
  time-trap spam protection on the three public forms, and `/api/health/integrations` with an
  `envCheck` module that specifically detects the trailing-`\n` class. First run against
  production found a ninth problem: the AWS IAM key no longer exists (`InvalidAccessKeyId`), so
  uploads are down.
- **The two workstreams the day actually started with, both built and deployed:**
  - *Replacing GHL.* `/admin/crm` in `ai-tool-dashboard`: a drag-and-drop pipeline board of
    Problems by status (drops go through the existing status endpoint, so GHL sync and event
    logging are untouched), a contact list, and a per-contact timeline merging Problems,
    Proposals, Projects, EmailDrips and Events. Admin-gated via the existing `requireAdmin`.
    `docs/CRM-VS-GHL.md` records that the only honest remainder is SMS and phone calls —
    calendars are Calendly and email is Resend, so neither is a GHL dependency.
    Found while building: the GHL pipeline has four stages and `ghl.ts` maps all four, but
    `Problem.status` stopped at `complete` in both the Mongoose enum and the status endpoint, so
    nothing could ever set `closed`. Widened the enum, the endpoint and three page-level unions,
    and gave `closed` a label and colour — a lead that goes nowhere now has a terminal state.
  - *The site auditor as a tool on the site.* `/tools/site-audit` (submit + history) and
    `/tools/site-audit/[id]` (result), a `SiteAudit` model, and `src/lib/auditRunner.ts` — a typed
    adapter over `AUDIT_WORKER_URL`/`AUDIT_WORKER_TOKEN`, so where Chromium runs stays an open
    decision. Unset, the feature reports "not configured" rather than erroring. Verified by hand
    rather than taken on trust: cross-user reads return **404 not 403** (so another user's audit
    id cannot be confirmed to exist), the worker's report renders in `sandbox=""` with no
    `allow-same-origin` and never via `dangerouslySetInnerHTML`, and URL validation rejects
    loopback, every private range, IPv6 forms, obfuscated encodings and `169.254.169.254` — 16
    tests. Without that last part, "audit any URL" is a tool for probing your own infrastructure.
  - Navigation wired once by the parent, since both branches were told to leave `Navbar.jsx` alone.
    49 tests, typecheck and production build green; deployed and live.
- README corrected: it documented the storage credentials as `AWS_ACCESS_KEY_ID` etc. while the
  code reads `AWS_S3_ACCESS_KEY_ID` — a plausible route to setting a value where nothing reads it.
  Every name now verified against actual `process.env` usage, six missing ones added.
- **Worktree isolation lesson:** `isolation: "worktree"` creates a worktree of *this session's*
  repo, not of the repo the task concerns. All three agents landed in `forward-qa-agents` and one
  correctly refused to improvise. Re-dispatched against hand-made worktrees of the right repo with
  `node_modules` symlinked.

**Decided**

- Publish both remaining sites now rather than hold them: four sites, one masthead set, one hub.
- Nav caps at seven items; anything beyond that goes to the footer. The thesis was the first casualty.
- Generated pixel values get rounded at the generator, not patched in output.
- Make the source repo public and accept the five scrubbed lines remaining in history, rather than
  rewrite history and break the log's own commit citations and two published site references.
- Design is scored by accumulation, not severity: no single tell is a defect, the pattern is.
- Seven legal items stay out of the tool — dark patterns, hidden fees, unsupported claims, fake
  reviews, licensing, age consent, whether collected data is necessary. A deterministic checker
  cannot rule on them and pretending otherwise would be worse than saying nothing.
- Report branding lives in the environment (`BRAND_*`), never in source: the house rule keeps real
  company names out of the repo, and one checkout can then serve more than one brand.
- Declined to build an Instagram scraper. Meta's Graph API genuinely cannot return text burned into
  reel frames, so the official API was not an answer — but a scraper is fragile ground for a paid
  service. The sanctioned route that does work is "download your information", then OCR locally.

**Open / next**

1. **Handed back to the user on investoraiclub.com:** Stripe is in *test* mode so no card can be
   charged (the webhook secret is per-mode, so the live endpoint's secret is needed, not the test
   one repaired today); the AWS IAM key must be reissued before uploads work; and
   `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` switches analytics on. The health endpoint returns 503 while any
   of these fail, so it is worth pointing an uptime monitor at it.
2. The GHL replacement question is now much smaller than estimated: the account holds 1 contact,
   1 opportunity, 1 pipeline, 0 custom fields and 0 calendars (booking is Calendly). There is no
   CRM to migrate. `scripts/ghlInventory.ts` in that repo enumerates it; workflow and form scopes
   are missing from the token if a fuller picture is wanted.
3. **The site-audit worker is the next real piece of work.** The app side is live but inert until
   `forward-qa-agents` is deployed somewhere with a browser (Railway/Fly/Render — it already has a
   Fastify API and 119 tests), and `AUDIT_WORKER_URL`/`AUDIT_WORKER_TOKEN` are set. That is the
   hosting decision the user deferred; nothing else blocks the feature.
4. Billing on the audit tool is unimplemented by design, with a marked seam in `SiteAudit.ts` and
   the POST handler. It is downstream of Stripe being in test mode anyway.
5. Auditor slice three, still approved and still outstanding: image weight, page load speed, and
   the 390px mobile pass with overflow and tap-target checks.
2. **Auditor slice three, still outstanding and approved:** image weight and compression, page load
   speed, and the 390px mobile pass (horizontal overflow, tap targets). Needs a performance
   collector; the design and readiness collectors are the pattern to follow.
3. **investoraiclub.com is its own thread.** Next.js, nine pages, already has `/login`,
   `/auth/register` and `/forgot-password`, so accounts exist. No billing, no Stripe, no pricing
   page anywhere. Worst findings: no privacy policy, no terms, no contact details, four forms whose
   submissions cannot be traced, no analytics, `/booking` shipping 2.3 MB of JavaScript, a canonical
   on `/how-it-works` pointing at the non-www host, and `/auth/register` with no `<title>`.
   The user wants the auditor added to that site as a tool with account and billing pages. The repo
   for it is not on this machine — ask for it before starting.
4. Add a clear next step (run it, contact, engagement offer) to the FDT and SDET sites.
5. Plate 44 redesign: ledger schema in `src/core/db.ts` first.
6. Bump `actions/checkout` and `actions/setup-node` to v5.

---

## 2026-09-14 (Monday)

**Snapshot at end of day**

| Metric | Value |
|---|---|
| Commits on main | 8 (0 today, head `bf46c26`) |
| Pushed to origin | yes, in sync |
| Uncommitted files | 6 (CLAUDE.md, README.md, _build/author/diagrams.mjs, package.json, _build/author/roadmap-data.mjs, _build/author/roadmap.mjs) |
| Typecheck | pass |
| Tests | 99 pass, 0 fail (10 suites) |
| Source lines (src/) | 6023 across 45 files |
| Test lines (tests/) | 1431 across 16 files |
| Agent runs in DB | 4 (forward-deployed-tester:succeeded,sdet-architect:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded) |

**Done**

- Crawled a comparison site (an SDET interview-prep business) at the user's request with a polite
  content-only crawler (1 req/s, no security probes; the AI Site Auditor was deliberately not used on
  a third-party site). 175 pages, 83,190 unique prose words vs our FDT site's 3 pages / 3,806 words.
  Theirs: far more content, 35% boilerplate, 412 calls to action, almost no citations. Ours: denser
  and more directive, but no calls to action. No FDT coverage on their side.
- User then asked for a dedicated space for what SDET openings ask for: agentic AI testing and
  Selenium-to-Playwright migration, with workflow, steps and measurables. Researched real 2026
  postings (RBC "Agentic SDET I", Apple "Senior SDET, LLM Evaluation & Automation"), Playwright test
  agents docs, OWASP LLM Top 10 (2025), Langfuse's evaluation layers, judge calibration (κ ≥ 0.6).
- Built **The SDET Roadmap**: `_build/author/roadmap-data.mjs` + `roadmap.mjs` → `../sdet-roadmap`
  (`npm run catalog:roadmap`). Track 1 agentic AI testing (6 stages, 29 gates), Track 2 Selenium →
  Playwright (6 stages, 31 gates). Each stage: goal, ≤ 6 steps, deliverable, exit gate table of
  metric · target · how to measure, with a browser-local checklist. Five diagrams. Checked at desktop
  and phone width: no overflow, no bullet over two lines, checklist persists across reloads.
- Session closed for the night. Local-only state to know about: `../ai-site-auditor` and
  `../sdet-roadmap` are built but not git repos; `../forward-deployed-tester` and
  `../sdet-architect` each have one uncommitted `index.html` (mascot size fix). Preview servers stopped.

**Decided**

- Track order follows the user's list (agentic first); new-to-Playwright learners do Track 2 stages
  0–2 first.
- No borrowed numbers as targets: case-study speed-ups (unverifiable) are excluded; targets are fixed
  bars or relative to the learner's own stage-0 baseline, and "our bar" is labelled.

**Open / next**

1. **Decide first thing in the morning (user said "make a call tomorrow"):** publish three sites? `akc031185/ai-site-auditor`, `akc031185/sdet-roadmap`,
   plus the mascot fix already rebuilt into the FDT and SDET site repos. Then cross-link all mastheads.
2. Add a clear next step (run it, contact, engagement offer) to the FDT and SDET sites; the comparison
   showed ours has none.
3. Plate 44 redesign: ledger schema in `src/core/db.ts` first.
4. Bump `actions/checkout` and `actions/setup-node` to v5.

---

## 2026-09-13 (Sunday)

**Snapshot at end of day**

| Metric | Value |
|---|---|
| Commits on main | 7 (5 today, head `61115bd`) |
| Pushed to origin | yes, in sync |
| Uncommitted files | 16 (CLAUDE.md, README.md, _build/author/diagrams.mjs, _build/author/plates.mjs, _build/build-catalog.ts, package.json, src/api/server.ts, src/core/db.ts, tests/db.test.ts, tsconfig.json, .claude/agents/ai-site-auditor.md, _build/sites/audit/, docs/agents/the-ai-site-auditor.md, fixtures/ai-site-auditor/, src/agents/ai-site-auditor/, tests/ai-site-auditor/) |
| Typecheck | pass |
| Tests | 99 pass, 0 fail (10 suites) |
| Source lines (src/) | 6023 across 45 files |
| Test lines (tests/) | 1431 across 16 files |
| Agent runs in DB | 4 (forward-deployed-tester:succeeded,sdet-architect:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded) |

**Done**

- 16:55 Verified no TCC / EPERM blockers: file writes, git, GitHub auth, Node 24, SQLite all fine.
- 16:57 Gates green (typecheck, 89 tests). Committed all of Friday's work as `a160f25`
  (16 files, +2680): CI workflow, progress tooling, CLAUDE.md, field guide, README.
- 16:58 First push rejected: the `gh` OAuth token lacked the `workflow` scope needed to add
  `.github/workflows/ci.yml`. User ran `gh auth refresh -h github.com -s workflow`; pushed.
- 17:00 First GitHub Actions run `34770175543` completed **success** on ubuntu-latest, Node 24:
  npm ci, Chromium install, typecheck, tests. One annotation: checkout@v4 and setup-node@v4
  target Node 20 and are forced onto Node 24 (harmless for now).

- 17:30–19:00 Reworked the plates diagram-first at the user's request: at-a-glance pipeline SVG,
  short flowchart titles (full text + code behind the click), mechanism figures (crawl loop,
  locator ladder, severity map; normalisation trace, confidence ladder, status decision), examples
  collapsed. Then the bullet rule: any prose over two lines is a list of at most six bullets,
  enforced by the generator. Authoring source moved into `_build/author/{plates,diagrams}.mjs`
  (`npm run catalog:author`). Committed `dd39196`, pushed.
- 19:00–19:40 Added both plates to the shared field guide hub `akc031185/qa-agents` (GitHub Pages)
  as **Section 09 · Landing in a new environment**, plus the process page as **Guide 05**. Ported
  the v5 generator features into the hub's `build-catalog.ts`; all 38 existing plates rebuilt with
  only the code-modal markup changed; every link verified. Committed `2532c13` on branch
  `add-plates-44-45` and pushed the branch. **Not merged**: main deploys the live site.

- 19:40–20:30 User chose **two separate sites, one per agent**, not a hub section. Generator now
  takes `--site <config dir> --out <site dir>` and absolute `repoUrl` links; content split into
  `_build/sites/{fdt,sdet}/`; generated output removed from this repo. New public repos
  `akc031185/forward-deployed-tester` (plate 44 + process page) and `akc031185/sdet-architect`
  (plate 45), each a GitHub Pages site holding output only. Fixed a link bug: source and test
  folders drop the plate's `the-` prefix. Hub branch `add-plates-44-45` deleted, hub back on main.

- Evening: built **plate 46, The AI Site Auditor** (`src/agents/ai-site-auditor/`) at the user's
  request: an evaluator for sites built with AI tools. Sees each page twice (raw HTML with JavaScript
  off, as GPTBot/OAI-SearchBot/ClaudeBot/PerplexityBot get it, and rendered), checks robots.txt per
  AI agent (RFC 9309 matcher), requests the home page with each crawler's real user agent, scans
  bundles for keys (redacted), and runs 51 checks in three scored areas (AI visibility, Search,
  Build quality). Deliverable: a self-contained `report.html`, plus md/json, findings, artifacts.
  Grounded in vendor docs (OpenAI bots page, Anthropic crawler docs, Google "AI features",
  Vercel/MERJ crawler study); `llms.txt` absence is info only.
- DB: `AGENT_NAMES` drives the runs CHECK constraint; `Db` migrates old databases in place (tested).
- Validated before release on three real local builds (two CRA, one Next.js). Found and fixed three
  bugs: a render timeout that scored a site 100 while auditing nothing (now render never waits for
  the load event, failures are findings, empty audits are critical), a 50-word threshold that
  skipped small app shells (now 10 words, raw < max(5, 30%)), and a form label read as placeholder
  copy. Also: sitemaps on other hosts are no longer fetched. **Disclosure:** before that fix, one
  validation run followed a production sitemap URL and made up to six requests to that live site.
- Fixture sites (`npm run fixture:audit-sites`) and recorded demo runs: SPA `a70d48e1` 0·F / 46·D /
  23·F, 20 findings; server-rendered `23fed86c` 100·A / 97·A / 97·A, 2 low. 99 tests green.
- Plate 46 authored (`_build/sites/audit`, four diagrams, report screenshot) and built locally into
  `../ai-site-auditor`. Fixed the oversized single mascot on every generated home page; the two
  published sites are rebuilt locally with that fix but **not pushed**.

**Decided**

- The `gh` token for `akc031185` now carries `workflow` scope; no more push blockers for CI edits.
- The auditor is plate 46 in this repo, one folder like the others; its field guide gets its own
  site like plates 44 and 45 once the user approves publishing.
- Three field guides stay separate (QA Agents hub, SDET Architect, Forward Deployed Tester), each
  with its own home and cross-links in the masthead. No landing page for now.
- forward-qa-agents is the single source and generator for both sites; the site repos are output
  only (`npm run catalog:author` writes into the sibling checkouts, then commit and push there).

**Open / next**

1. Ask the user: publish `akc031185/ai-site-auditor` as a GitHub Pages site (public repo, output of
   `_build/sites/audit`), and push the mascot fix to the two existing site repos. Then add the audit
   site to the other two sites' mastheads.
2. Report the validation findings back privately (see the scratch reports); no secrets were found.
3. Start the plate 44 redesign: ledger schema in `src/core/db.ts` first (Baseline, Eval cube,
   Cost, Outcome, Verdict keyed on a unit of work), since every phase writes rows there. Then the
   Discover phase, folding the existing crawler in as one probe.
4. Update the README so plate 44 is described by the thesis definition, not as a crawler.
5. Bump `actions/checkout` and `actions/setup-node` to v5 when convenient to clear the Node 20
   deprecation annotation.

---

## 2026-09-11 (Friday)

**Snapshot at end of day**

| Metric | Value |
|---|---|
| Commits on main | 2 |
| Pushed to origin | yes, in sync |
| Uncommitted files | 12 (CI workflow, progress tooling, field guide: `_build/`, `assets/`, `agents/`, `index.html`, `process.html`, README/CLAUDE.md edits) |
| Typecheck | pass |
| Tests | 89 pass, 0 fail (10 suites) |
| Source lines (src/) | 4633 across 36 files |
| Test lines (tests/) | 1161 across 14 files |
| Agent runs in DB | 2 (forward-deployed-tester succeeded, sdet-architect succeeded) |

**Done**

- 04:22–04:57 Built the whole repo from scratch: core (config, SQLite db, local-only LLM adapter,
  agent contract, runner), Fastify REST API, both agents, fixtures, tests, field-guide plates,
  Claude Code subagent definitions. Committed as `bbc1413` at 04:57.
- 04:32 First live run of the Forward Deployed Tester against a local 3-page demo site on
  port 4711. Crawled 3 pages in 2.0 s, recorded 4 findings (1 broken link, 1 unlabeled form
  control, 2 low), provisioned 11 Playwright + MCP files. Run id `049b95fd`.
- 04:27 Wrote the GitHub Actions CI workflow (Node 24, Chromium, typecheck, test). Never committed.
- Morning to 10:03 Four-thread market research on the Forward Deployed Tester idea (FDE playbook,
  eval/observability tooling, AI assurance standards, local-model feasibility). Written up as
  `docs/forward-deployed-tester-thesis.md` and committed as `3e8c6fe` at 10:03.
- 18:31 Resumed with no session notes. Verified typecheck and tests green. Created this
  progress log, the `npm run progress` measurement script, and `CLAUDE.md` so future sessions
  keep the log current.
- 19:00–19:30 Built the field guide in the house catalog format (same generator and stylesheet as
  the earlier guides in this format, adapted for ESM and this repo's `src/agents/<slug>/` layout):
  `index.html`, `agents/the-forward-deployed-tester.html` (plate 44), `agents/the-sdet-architect.html`
  (plate 45), and a hand-written `process.html` covering the seven phases, five ledgers, working
  rules, session loop and cheat-sheet. Every code block is sliced from the real source by line
  range and annotated (116 annotations); every number comes from run `049b95fd` (FDT, 04:32) or
  run `46f19623` (SDET on the fixture estate, this evening: 12 files, 28 tests, 91.7% coverage,
  38 locators, 3 low, 26 files). Rendered and checked with Playwright at 1280 and 400 px; fixed an
  inherited stylesheet overflow in the example panels. Added `npm run catalog`.

**Decided**

- The category is unoccupied: nobody independently validates what a vendor's FDE delivered.
- Plate 44 as built is only a surface probe. The real Forward Deployed Tester is redefined around
  seven phases (Discover, Baseline, Golden set, Eval cube, Cost ledger, Pilot with causal design,
  Verdict and handover) writing to five ledgers keyed on a unit of work.
- Plate 45 (SDET Architect) stays as is; it is the deterministic regression layer.
- Principles hold: deterministic first, local open-weight models only, one agent one folder, no
  real client or colleague names anywhere.

**Open / next**

1. **Commit and push.** Nothing from today is in git yet: the CI workflow, `PROGRESS.md`,
   `CLAUDE.md`, `scripts/progress.mjs`, the field guide (`_build/`, `assets/`, `agents/`,
   `index.html`, `process.html`) and the README / package.json edits are all only in the working
   tree. Review the pages first (serve with `python3 -m http.server 8790` from the repo root,
   Chrome will not open `file://`), then one commit, push, and confirm the first Actions run is green.
2. Start the plate 44 redesign: ledger schema in `src/core/db.ts` first, since every phase writes
   rows there. Then the Discover phase, folding the existing crawler in as one probe.
3. Update the README so plate 44 is described by the thesis definition, not as a crawler.

*Entry reconstructed on 2026-09-11 evening from git log, file mtimes, `workspace/*/run.log` and
`data/forward-qa.db`; the 18:31 onward items were written live. Session closed shortly after midnight.*

---

<!-- Template for a new day (npm run progress inserts the header and snapshot for you)

## YYYY-MM-DD (Weekday)

**Snapshot at end of day**

| Metric | Value |
|---|---|
| ... | ... |

**Done**

- HH:MM What was built, fixed, run, or written. Reference commit hashes and run ids.

**Decided**

- Decisions and why. Link to the doc or commit that records them.

**Open / next**

1. Ordered list of what to pick up next session.

---
-->

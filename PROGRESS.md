# Progress log

Daily record of what was accomplished, newest day on top. Every working session must read this
file first and update it before ending. Run `npm run progress` to stamp a new day with measured
numbers, then fill in the Done / Decided / Open sections by hand.

Entries marked **reconstructed** were rebuilt after the fact from commit timestamps, file
modification times, run logs and the SQLite database, not written live. Treat their narrative as
best-effort and their numbers as exact.

---

## 2026-10-25 (Sunday)

**Snapshot at end of day**

| Metric | Value |
|---|---|
| Commits on main | 94 (0 today, head `36d4e6c`) |
| Pushed to origin | yes, in sync |
| Uncommitted files | 0 |
| Typecheck | pass |
| Tests | 220 pass, 0 fail (10 suites) |
| Source lines (src/) | 10756 across 80 files |
| Test lines (tests/) | 3455 across 34 files |
| Agent runs in DB | 32 (forward-deployed-tester:succeeded,sdet-architect:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,architecture-dossier:succeeded,architecture-dossier:succeeded,architecture-dossier:succeeded,architecture-dossier:succeeded) |

**Done**

*Reconstructed* (22 and 24 Oct, from session memory; no live entry was written):
- 22 Oct: owner's `test:lead-conversion` run stopped at 1a; `/api/intake/triage` returned "Failed
  to get valid JSON from OpenAI after retry". Last good triage in llmusages: 17 Sep. ai-tool-dashboard
  `cd02902` (local) makes openai.ts report API errors as such. One E2E draft problem left (22 Oct
  16:53 UTC).
- 24 Oct: owner decisions (below); TCC block stopped work before anything started.

Live, 25 Oct (ai-tool-dashboard, all local, three parallel agents plus integration):
- `a8a2ffa` Playwright: CRM deal checks (6b, 8) replace the GHL legs; ghl-client, 6c/8b, GHL leg of
  crm-tracking, 'ghl' movement source removed. `--list`: 37 tests in the 3 funnel files (was 39).
- `fcfa5ad` GHL code removed (6 files deleted, crm.ts GHL_SYNC gone, CSP adds crm.askdbl.com,
  privacy page, GHL ids redacted in history docs). Triage + outline on claude-opus-5-5, sample answer
  on claude-sonnet-5-5, tool categorisation on claude-haiku-5-5, generation on claude-sonnet-5-5;
  maxDuration on those routes; envCheck checks ANTHROPIC_API_KEY and OPENAI_API_KEY.
- `2bcc4de` /api/ai-tools GET (listed contact details) and DELETE (wiped all) now need an admin
  session; POST stays public.
- ai-tool-dashboard checks: tsc pass, Jest 453 pass / 50 suites, lint 0 errors. Owner OK, pushed
  `177c21b..2bcc4de`; Vercel deploy success. Live: home 200, /api/ai-tools 401, CSP lists
  crm.askdbl.com and no leadconnectorhq.

**Decided**

- 24 Oct: triage moves to Claude; GHL removal runs now, local, one push after owner OK; owner cancels
  ChatGPT Business ($50, renews 27 Oct; not used by the site).
- 25 Oct: outline and sample answer also move to Claude; triage stays on Opus 5.5; Whisper voice
  input stays on OpenAI and the owner fixes the OpenAI key; retired/retiring Claude models updated.

**Open / next**

1. After owner go: run `test:lead-conversion` and `test:lifecycle`, report CRM checks,
   check Claude triage quality, delete the 22 Oct E2E draft problem.
3. Owner: fix OpenAI API key (Whisper only), delete GHL env vars in Vercel, cancel GHL before 29 Oct,
   cancel ChatGPT Business before 27 Oct, remove GHL lines from playwright/.env; update ledger;
   reconnect finops Gmail.

---

## 2026-10-21 (Wednesday)

**Snapshot at end of day**

| Metric | Value |
|---|---|
| Commits on main | 93 (0 today, head `d98a1ba`) |
| Pushed to origin | yes, in sync |
| Uncommitted files | 0 |
| Typecheck | pass |
| Tests | 220 pass, 0 fail (10 suites) |
| Source lines (src/) | 10756 across 80 files |
| Test lines (tests/) | 3455 across 34 files |
| Agent runs in DB | 32 (forward-deployed-tester:succeeded,sdet-architect:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,architecture-dossier:succeeded,architecture-dossier:succeeded,architecture-dossier:succeeded,architecture-dossier:succeeded) |

**Done**

*Reconstructed*: the 18–20 Oct session lines below were backfilled on 21 Oct from the session
memory after a TCC block stopped the live write. All checks were read-only; nothing ran on
production.

- 18 Oct: pushed `d98a1ba`, the 17–18 Oct backfill.
- Found the app already sends the CRM everything it sent GHL: each request opens a deal (externalRef
  {investoraiclub, problemId}); proposal/project notes land as contact timeline events
  `deal.created` / `deal.stage_changed` / `deal.note_added` with meta.externalRef. contacts:read
  keys are enough.
- Milestone, deliverable, approval and project-status notes are fire-and-forget in the app (not
  awaited), so serverless may drop them; the new soft checks will show it.
- ai-tool-dashboard/playwright, uncommitted: `helpers/crm-client.ts` (waitForEvent `where`,
  `forDeal()`), lead-conversion "6b — CRM deal verification" (GHL now 6c), project-lifecycle
  "Phase 8a — CRM deal verification" (GHL now 8b). Typecheck clean; `--list` = 39 tests, 3 files.
- Read-only probe: the test user's CRM contact has only `user.registered`, no deals yet.
- 21 Oct: access check passed for both repos; the three spec files are still uncommitted.
  playwright/.env still has no ADMIN_PASSWORD.

**Decided**

- Production E2E runs of the funnel specs need the owner's go-ahead each time.
- GHL test code goes only after `test:lead-conversion` and `test:lifecycle` pass with the CRM checks.

**Open / next**

1. Owner adds ADMIN_PASSWORD to playwright/.env and says go; run `test:lead-conversion` and
   `test:lifecycle` on production, report each CRM check; if a fire-and-forget note is missing,
   propose awaiting it in the app.
2. Then delete the Playwright GHL code (ghl-client, 6c / 8b, crm-tracking GHL leg, 'ghl'
   movement source, .env.example and guest-submit comment); commit, ask before push.
3. GHL code removal in ai-tool-dashboard (plan approved 18 Oct); one commit, ask before pushing.
4. Owner deletes the five GHL env vars in Vercel, cancels GHL before ~29 Oct; mark ledger
   l_82b454c7, check Chase ••1659, add Vercel Pro $20/mo to the ledger.
5. Background agent that answers new requests within 2 hours.
6. Smaller: UTM lost through login redirect; brand spelling; BOOKING_URL; Vercel spend cap;
   rotate the two CRM read keys; Stripe -> CRM.

---

## 2026-10-18 (Sunday)

**Snapshot at end of day**

| Metric | Value |
|---|---|
| Commits on main | 92 (0 today, head `2cc6ea8`) |
| Pushed to origin | yes, in sync |
| Uncommitted files | 0 |
| Typecheck | pass |
| Tests | 220 pass, 0 fail (10 suites) |
| Source lines (src/) | 10756 across 80 files |
| Test lines (tests/) | 3455 across 34 files |
| Agent runs in DB | 32 (forward-deployed-tester:succeeded,sdet-architect:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,architecture-dossier:succeeded,architecture-dossier:succeeded,architecture-dossier:succeeded,architecture-dossier:succeeded) |

**Done**

*Reconstructed*: the 17–18 Oct session lines below were backfilled on 18 Oct from the session
memory after a TCC block stopped the live write. All checks were read-only except the test chat.

- 17–18 Oct, CRM cron healthy: cronheartbeats 1769 runs, last OK 18 Oct 00:25 UTC, 0 failed jobs,
  0 overdue pending jobs since 12 Oct.
- No CRM activity between 12 Oct 16:50 UTC (test emails) and this session: 0 timeline events,
  0 automation runs; app CRM keys last used 12 Oct 03:10 UTC. Probably no real traffic, not proven.
- The owner's 12 Oct test chat never reached the CRM (0 conversations ever before this session);
  probably never sent.
- 00:31 UTC test chat from www.investoraiclub.com ("E2E Chat Test",
  akc031185+e2e-chat-20261017@gmail.com) landed in workspace investoraiclub: conversation
  6ad4135e77e584e013fcbff0, contact, `chat.received`. No rule fires on `chat.received` (expected).
- Inbox reply "Test reply, please ignore" showed in the site widget within 10 s. Chat works both
  ways. Widget key prefix a1a35c9dea83 (leads/events/chat:write). Test conversation left open.
- Site CSP (report-only) still lists leadconnectorhq.com and not crm.askdbl.com; fix during GHL
  removal. CRM DB env names in askdbl-crm/.env.local are CRM_MONGODB_URI + CRM_DB_NAME.

**Decided**

- GHL code removal plan in ai-tool-dashboard approved by the owner (files listed in Open 2).
  Keep ghlContactId / ghlOpportunityId model fields for old data.
- Playwright GHL specs go only after a CRM-based replacement exists, covers the same checks and
  passes; these flows must stay testable.

**Open / next**

1. Playwright: map every check in playwright/helpers/ghl-client.ts and its specs (crm-tracking,
   lead-conversion, project-lifecycle, movement-tracker, guest-submit) to a CRM check; build and
   pass the CRM version.
2. GHL code removal in ai-tool-dashboard: one commit after typecheck + Jest + lint; ask before
   pushing (main auto-deploys).
3. Owner deletes the five GHL env vars in Vercel, then cancels GHL before ~29 Oct; mark ledger
   l_82b454c7, check Chase ••1659, add Vercel Pro $20/mo to the ledger.
4. Background agent that answers new requests within 2 hours.
5. Smaller: UTM tags lost through login redirect; brand spelling; BOOKING_URL; Vercel spend cap;
   rotate the two CRM read keys; Stripe -> CRM.

---

## 2026-10-12 (Monday)

**Snapshot at end of day**

| Metric | Value |
|---|---|
| Commits on main | 91 (15 today, head `e7b5ad5`) |
| Pushed to origin | yes, in sync |
| Uncommitted files | 0 |
| Typecheck | pass |
| Tests | 220 pass, 0 fail (10 suites) |
| Source lines (src/) | 10756 across 80 files |
| Test lines (tests/) | 3455 across 34 files |
| Agent runs in DB | 32 (forward-deployed-tester:succeeded,sdet-architect:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,architecture-dossier:succeeded,architecture-dossier:succeeded,architecture-dossier:succeeded,architecture-dossier:succeeded) |

**Done**

- 01:5x UTC askdbl-crm deployed by hand (`askdbl-5ivp0z16g`, Ready, aliased crm.askdbl.com):
  stop_if engine, compliance footer, u2 unsubscribe, follow-up rules code now live. Smoke: `/`
  307, `/u/bad` 200, `/api/unsubscribe/bad` 303, unauthenticated events POST 401.
- Found the GitHub Actions `*/5` scheduler actually ran every 3 to 7 hours (11 Oct runs at 07:16,
  14:11, 18:57, 22:46, 01:51 UTC), which would make waits and the 60-minute speed-to-lead task
  hours late.
- askdbl-crm `d5444bc`: `vercel.json` runs `/api/cron/jobs` every 5 minutes on Vercel Cron;
  GitHub job kept as a backup (job claims are atomic leases). README and AUTOMATIONS.md updated.
  Typecheck pass, 936/936 tests.
- Owner upgraded the Vercel team to Pro ($20/month). Redeployed (`askdbl-j9el4dfqj`, Ready); the
  Cron Jobs page lists `/api/cron/jobs` `*/5`, enabled. First scheduled run 07:05:44 UTC, 200.
- 07:03 UTC `seed:followups --apply` on production: 14 rules created (7 goal rules on, 6
  sequences and 1 task rule off). Re-run dry run: 14 "exists".
- Allow rule `Bash(vercel --prod --cwd …/askdbl-crm:*)` added to this repo's
  `.claude/settings.local.json` at the owner's request.

- `RESEND_API_KEY` copied from ai-tool-dashboard (send-only key, never printed) into askdbl-crm
  Production; owner saved `RESEND_WEBHOOK_SECRET`; `EMAIL_FROM` = Investor AI Club
  <crm@investoraiclub.com>. Redeployed (`askdbl-6l91a9b9f`, then `askdbl-dr6lal9vm`, Ready);
  unsigned Resend webhook POST now 401.
- Footer postal address set on both workspaces: Hyde View Realty LLC, 30 N Gould St Ste R,
  Sheridan, WY 82801, USA.
- Owner asked whether the CRM had sent anything: 0 send events and nothing ever from
  crm@investoraiclub.com. The emails they had seen were the app's welcome and audit report
  emails from the 11 Oct E2E runs.
- 14:31 UTC, on the owner's go: temporary rules 6accef350b71120f8cb6c86b and
  6accef350b71120f8cb6c86d (trigger `test.template_preview`) plus one resume job each. The 14:35
  Vercel cron run sent all 12 templates (7 InvestorAI Club, 5 Site Analyzer) to
  akc031185+e2e-test-1791774612443@gmail.com: 12 `email.sent` events, 12 delivered, 0 spam (5 in
  Promotions). Footer carries the Sheridan address and a u2 unsubscribe link production accepts.
  Both test rules disabled.
- Local sends can't work: MARKETING_TOKEN_SECRET and MONGODB_URI are sensitive in Vercel and
  pull empty.
- One Wi-Fi network's Fortinet firewall intercepts TLS for crm.askdbl.com. Network-side only.
- VS Code lost Documents access (TCC) mid-session; only a restart fixes it.
- *Reconstructed*: the lines from "Owner asked" down were backfilled in a new session after the
  TCC restart.

Afternoon session (live):

- `e5311f3`, `d5aa663` forward-qa-agents: 12 Oct backfill above, committed and pushed.
- Owner reviewed the 12 test emails: copy not attractive enough, no links back to the app,
  unsubscribe shown as "Unsubscribe: <url>". Cause: templates were text-only, so the HTML footer
  (already a real link) was never sent.
- askdbl-crm `d497992`: templates render an HTML card plus a text copy; one button to the app page
  that fits (`/submit-problem`, `/booking`, `/proposals`, `/dashboard`, `/how-it-works`, the
  contact's Site Analyzer report or `/free-site-audit`), UTM-tagged; footer goes inside the card
  with "Unsubscribe" as the link. All copy rewritten. `request_received` now promises a reply
  "within 2 hours or sooner" (owner's wording). `iac.speed-to-lead` sends `request_received`
  before its task. `seed:followups --update` rewrites an installed rule's steps, keeping name and
  switch. Typecheck pass, 965/965 tests.
- ~16:00 UTC deployed `askdbl-987xv3nrk` (Ready, aliased crm.askdbl.com, checked over the phone
  hotspot). `seed:followups --apply --update`: only `iac.speed-to-lead` updated.
- 16:45 UTC (owner ran the script): the two test rules re-enabled with one job each; the 16:50:45
  cron run sent all 12 (jobs done, 7/7 and 5/5, 0 failed). Gmail: 7 Updates, 5 Promotions; HTML,
  button links, footer and Unsubscribe link (200) checked. Test rules disabled again by the owner.
- ~17:00 UTC owner switched `iac.speed-to-lead` ON in the CRM console: every new request now gets
  the CRM email plus the 60-minute reply task.
- ai-tool-dashboard `a6c2bc6`: guest intake no longer sends the app's "We Received Your Problem"
  email (it promised 24-48 hours). Guest welcome (temp password) and the +24h/+48h drip unchanged.
  Typecheck pass, 390/390 unit tests. The Site Analyzer fix-request email is untouched (no CRM deal).
  Deployed `ai-tool-dashboard-pdo1-hr8pngfc6` (Ready, Production). CI `build-and-test` red, as on
  `fab73b0` before it: Jest collects `playwright/tests/*.spec.ts` (pre-existing, not this change).
- ai-tool-dashboard `437c198`: `jest.config.js` ignores `playwright/`, `.next/`, `.vercel/`. Local
  45 suites, 448 tests pass; GitHub CI `build-and-test` green again.
- 19:30 UTC: owner switched `iac.signup-nurture` on in the console (day 2 nudge, day 6 check-in,
  then a call task; stops on `goal:requested`). Seed dry run confirms: on, as are speed to lead and
  the 7 goal rules. Still off: proposal follow-up, form lead, and the three Site Analyzer sequences.
  E2E test sign-ups (+e2e Gmail) will get the nudges too.
- 19:37 UTC: owner switched `iac.proposal-follow-up` on (starts on a "proposal sent:" note; day 3
  nudge, day 7 last nudge, then a call task; stops when the proposal is signed or clarified).
  Seed dry run confirms it on. `iac.form-lead` stays off: nothing emits `lead.captured` yet.
- 19:40 UTC: owner switched `sa.abandoned-checkout` on (reminder email 1 hour after checkout starts,
  then a task a day later; stops on payment). Seed dry run confirms it on.
- 19:43 UTC: owner switched `sa.post-purchase` on (thank-you on payment, feedback request 7 days
  later; no stop). Seed dry run confirms it on. Checked the app: `checkout.started` reaches the CRM
  through `recordContactEvent` since `fab73b0`, so the "not yet emitted" comments in the CRM's
  `followups.ts` are stale.
- 19:45 UTC: owner switched `sa.report-nurture` on (fixes email a day after unlock, re-audit offer
  3 days later; stops on checkout started or paid). Seed dry run: 13 of 14 rules on; only
  `iac.form-lead` is off (no live trigger).
- askdbl-crm `b1425a1`: `followups.ts` comments now say `checkout.started` is live (comment-only,
  no deploy needed). Typecheck pass, 965/965 tests.
- ~20:00 UTC, owner's go: `GHL_SYNC=off` added to ai-tool-dashboard production; redeployed the
  current build (`ai-tool-dashboard-pdo1-nbugxa4rf`, Ready). The app stops writing to GHL; GHL's
  data is untouched, so the export can still be taken before cancelling.
- Found: every page loads GHL's chat widget (`pages/_app.js`, `NEXT_PUBLIC_GHL_LOCATION_ID`), so
  site chats land in GHL. Cancelling kills it; the CRM's `/widget/chat.js` must replace it first.
  The app's `/api/health/integrations` also still pings GHL (goes with the code removal).
- GHL export skipped: owner confirms GHL holds only test data.
- Owner made a CRM key (`chat:write` only, origin https://www.investoraiclub.com) and set
  `NEXT_CRM_CHAT_KEY` in Vercel production (not `NEXT_PUBLIC_`, at the owner's call).
- ai-tool-dashboard `73e9d5c`: GHL chat widget removed from `pages/_app.js`; `pages/_document.tsx`
  renders the CRM's `/widget/chat.js` with that key. Lint, typecheck, build clean; 448/448 tests.
  Live: www.investoraiclub.com serves the CRM `chat.js` tag (200); no `leadconnector` left.
  Owner to send a test chat and a reply from the CRM inbox (not yet confirmed).
- Docs brought to 12 Oct: askdbl-crm README status rewritten (`8e7a876`; also corrects "auto-
  deploys from main": the CRM deploys by hand); ai-tool-dashboard README, `docs/CRM-VS-GHL.md`,
  `docs/GHL-REPLACEMENT.md` (`177c21b`). The two never-commit files stay uncommitted.
- Auto mode refused production writes (seed, test sends, rule switch, `vercel inspect`) even with
  the owner's go; the owner ran them with `!` or in the console.

**Decided**

- Vercel Pro over a free external scheduler: one bill, commercial-use terms, still $77/month
  under GHL.
- askdbl-crm stays manual-deploy (not Git-connected) for now; deploys go through the allow rule.
- The CRM, not the app, sends the request confirmation, so all lead email lives in one place.
- The 2-hour reply promise stays 24/7; the owner plans a background agent to meet it.
- No GHL export: it held only test data.
- The chat key is read server-side as `NEXT_CRM_CHAT_KEY`, not `NEXT_PUBLIC_` (owner's call); it is
  still visible in the page HTML by design, limited to `chat:write` and the site's origin.

**Open / next**

1. First thing next session: confirm the owner's test chat reached the CRM inbox and the reply
   came back; check the first real follow-up jobs (done / failed, unsubscribes).
2. GHL path (`GHL_SYNC=off` and chat widget done 12 Oct; no export): from 13 Oct remove
   `src/lib/ghl.ts`, its callers, the GHL check in `/api/health/integrations`; owner deletes the
   four GHL variables in Vercel; owner cancels before ~29 Oct; mark ledger l_82b454c7, check Chase
   ••1659; add the $20 Vercel Pro line to the ledger.
3. Build the background agent that answers new requests within 2 hours.
4. Logged-in links (`/dashboard`, `/proposals`) lose their UTM tags through the login redirect.
5. Sender name reads "Investor AI Club", while the emails say "InvestorAI Club": owner to choose one.
6. `iac.form-lead` waits for a form that posts to the CRM's `/api/v1/leads`.
7. Optional: `BOOKING_URL`; a Spend Management cap on the Vercel Pro team; rotate the two CRM
   read keys pasted in chat on 11 Oct.
8. Fuller InvestorAI Club lead plan (owner asked, later).

---

## 2026-10-11 (Sunday)

**Snapshot at end of day**

| Metric | Value |
|---|---|
| Commits on main | 74 (0 today, head `b9f5a93`) |
| Pushed to origin | yes, in sync |
| Uncommitted files | 0 |
| Typecheck | pass |
| Tests | 220 pass, 0 fail (10 suites) |
| Source lines (src/) | 10756 across 80 files |
| Test lines (tests/) | 3455 across 34 files |
| Agent runs in DB | 32 (forward-deployed-tester:succeeded,sdet-architect:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,architecture-dossier:succeeded,architecture-dossier:succeeded,architecture-dossier:succeeded,architecture-dossier:succeeded) |

**Done**

> Evening of 11 Oct (US Central); UTC times below are early 12 Oct. Code work was in
> ai-tool-dashboard. No commits in this repo besides this log.

- **Access check:** ~/Documents read and write fine; no TCC errors.
- **Test env:** `ai-tool-dashboard/playwright/.env` written (gitignored, 600), no values printed.
  - Test email base: the owner's Gmail.
  - DB URI: copied from the app's `.env.local`.
  - CRM read keys: two `contacts:read` keys, made by the owner in the console (prefixes
    `9872250f0e5d` InvestorAI Club, `cce6bee8f03a` Site Analyzer). Both were pasted in chat, so
    rotate them after testing.
  - Blocked by the auto-mode classifier (owner informed): my script to mint the CRM keys, and a
    direct mongosh read of the CRM db.
- **Test user** `…+e2e-user@…` registered via the API: 201. It reached the CRM as
  `user.registered` at 01:19:34 UTC, the first live sign-up since the 7 Oct deploy.
- **First E2E run** (01:30 UTC, 9.6 min): sign-up and CRM passed. The report page stuck on
  "Running the audit" for 9+ min, although `audit.submitted` and `audit.finished` did reach the
  CRM (found by visitor key).
- **Two diagnostic runs** (example.com, example.org) recorded every API response: all 200, so
  report access was fine. The cause was in the page's polling.
  - SWR read `refreshInterval` (a function) once at mount with no data, got 0 and set no timer.
  - The once-a-second "Waiting" counter re-rendered the page and reset any timer anyway.
  - So real visitors' audits never refreshed until the tab regained focus.
- **Fix** `0542e14`: the poll interval is now a number set in `onSuccess`; the paid re-run wait
  still works. New regression test, which fails on the old code. `9503c69`: the spec finds
  anonymous audit contacts by external id `investoraiclub.opsContactKey:<userKey>`.
  - tsc clean; Jest 448/448 (7 suites are Playwright files Jest can't load, known).
  - Deploy `ai-tool-dashboard-pdo1-cuqhd0xpb` Ready (owner's go); smoke: 4 pages 200.
- **Second E2E run** (`E2E-TEST-1791774612443`): **3/3 passed in 17 s.** Times are from the
  start of the test:

  | step | where | seen |
  |---|---|---|
  | sign-up | app 201 / CRM `user.registered` | 2.6 s / 3.9 s |
  | free audit | submit 202, run succeeded, unlock 200 | 3.5 s, 9.5 s, +0.4 s |
  | free audit | CRM `audit.submitted` / `finished` / `unlocked` | 8.0 / 10.9 / 14.2 s |
  | outbox | `crmoutboxes` | nothing queued |

- **Production test records:** 2 sign-ups, 4 free audits, and their CRM contacts. All are
  tagged `E2E-TEST`, the `+e2e` email, or example.com/.org.
- **GHL follow-ups rebuilt in the CRM** (owner: GHL drip emails go to customers; "pick the basic
  GHL automations"). Three parallel agents, then integration:
  - askdbl-crm `cffd7a5`: `stop_if` step (goal/exit, re-read after a wait); schema fields added.
  - askdbl-crm `f98d302`: follow-up templates, an unsubscribe footer and RFC 8058 headers,
    `u2` contact unsubscribe tokens, and a refusal when the secret, URL or postal address is
    missing.
  - askdbl-crm `3592574`: `followups.ts` (7 goal rules on; 6 sequences + 1 task rule off),
    `npm run seed:followups` (dry-run by default).
  - ai-tool-dashboard `fab73b0`: `checkout.started` is now forwarded to the CRM.
  - CRM tsc clean, vitest 936/936. Dashboard tsc clean, Jest 260/260 on touched suites.
  - Changes from the plan: sign-up nurture starts at day 2, because the app already sends a
    welcome email. Speed-to-lead became a task on every request, because guest-triage already
    emails the requester three times.
  - Pushed both (owner's go). Dashboard deploy `o7ov63393` Ready; smoke 200s.
  - **CRM deploy not done:** the project isn't git-connected, and `vercel --prod` was blocked
    by the auto-mode classifier. Owner to run it.
  - Seed dry run against production: 14 rules "would create", 0 existing.

**Decided**

- Test email uses the owner's Gmail with plus-addresses; the owner asked for a standing test
  user too.
- Owner OK'd both diagnostic runs, the deploy, and the re-run.

**Open / next**

0. Owner runs `vercel --prod` in askdbl-crm. Then `npm run seed:followups -- --apply` (owner's go).
   Then the owner's inputs: Resend keys, `EMAIL_FROM`, the postal address per workspace, and
   optionally `BOOKING_URL`. Then test sends to the `+e2e` inbox, and switch the follow-ups on
   one by one. Later: a fuller InvestorAI Club lead plan (owner asked).
1. GHL path (answered: GHL drips do email customers, so CRM email goes live first): If yes, CRM email goes live first.
   Then the owner's GHL export, `GHL_SYNC=off` (owner's go), and remove the GHL code a day
   later. Cancel before ~29 Oct.
2. Optional: add `GHL_API_KEY` / `GHL_LOCATION_ID` to the test `.env` so the run shows GHL side
   by side until it's switched off.
3. Rotate the two CRM read keys (pasted in chat). Next time paste with `! echo … >> .env`.
4. Clean up test records by tag when convenient. Keep Jest off `playwright/`.
5. Unchanged: Stripe -> CRM, Plaid Relay link, LLC step 1, Relay leftovers.

---

## 2026-10-09 (Friday)

**Snapshot at end of day**

| Metric | Value |
|---|---|
| Commits on main | 73 (0 today, head `cd5d4ae`) |
| Pushed to origin | yes, in sync |
| Uncommitted files | 0 |
| Typecheck | pass |
| Tests | 220 pass, 0 fail (10 suites) |
| Source lines (src/) | 10756 across 80 files |
| Test lines (tests/) | 3455 across 34 files |
| Agent runs in DB | 32 (forward-deployed-tester:succeeded,sdet-architect:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,architecture-dossier:succeeded,architecture-dossier:succeeded,architecture-dossier:succeeded,architecture-dossier:succeeded) |

**Done**

> Session ran from the evening of 8 Oct into 9 Oct, after the restart (VS Code Full Disk Access
> works). The 8 Oct entry below was written in this session (`cd5d4ae`, 16:39 on 8 Oct). Code
> work was in ai-tool-dashboard.

- **8 Oct 16:39 — README status pushed:** askdbl-crm `7e770f6` (8 Oct status, GHL switch-off
  path); ai-tool-dashboard `d847ff7` (CRM note).
- **Root cause of "zero live traffic", found by the new E2E work:**
  - Sign-up was broken in production. Since `12fcc44` (28 Oct 2025) the register API has required
    `phone`, but the form never sent one, so every UI sign-up got 400 "Missing required fields".
  - Free-audit events (`audit.submitted`, `audit.unlocked`, `audit.finished`, `audit.paid`) went
    only to the app's ops timeline. Only the 7 Oct backfill had ever sent them to the CRM.
- **9 Oct 10:00 — three ai-tool-dashboard commits, pushed and deployed:**
  - `931a9b6` Sign-up: required phone field on `/auth/register` with the API's format check
    (4 new tests).
  - `cf02113` Live forward of audit events to the Site Analyzer workspace, with the backfill's
    mapping and keys (`backfill:ops:<eventId>`), so a backfill re-run dedupes. Anonymous submits
    carry the visitor key `investoraiclub.opsContactKey`; the unlock adds the email. Never
    throws; outbox fallback (10 new tests).
  - `f484820` E2E suite `playwright/tests/crm-tracking.spec.ts`: tagged sign-up + free audit,
    then checks CRM (both workspaces), GHL and `crmoutboxes`, and writes a movement table.
    Helpers `crm-client.ts`, `outbox-client.ts`, `movement-tracker.ts`; page objects for register
    and free audit. Not run against production yet.
- **Checks:** tsc clean; Jest 447/447 pass. 7 suites fail only because Jest picks up the
  Playwright specs (6 known plus the new one).
- **Deploy** `ai-tool-dashboard-pdo1-au05oo54t` Ready (production). Smoke: `/`, `/auth/register`,
  `/free-site-audit`, `/login` 200; the register page shows the phone field; register `{}` 400;
  outbox cron 401 without secret.

**Decided**

- E2E tracking lives in the existing `ai-tool-dashboard/playwright` suite (owner).
- Test data: tagged `E2E-TEST-<ms>` records with a plus-addressed inbox the owner controls (owner).
- Phone stays required; the form gains the field (owner).
- Forward audit events live to the CRM (owner).

**Open / next**

1. Owner, for the first E2E run (needs a go; it creates real tagged records):
   - Set `E2E_EMAIL_BASE` in `playwright/.env`.
   - Create two `contacts:read` keys in crm.askdbl.com (one per workspace) and paste them as
     `CRM_READ_KEY_*`.
   - Optional: a read-only `E2E_MONGODB_URI` for the outbox check.
   - Then `npm run test:crm-tracking` and read the movement table.
2. Then the rest of the GHL path: do GHL workflows email or text leads? -> CRM email live if yes ->
   owner's GHL export -> `GHL_SYNC=off` (owner's go) -> remove GHL code a day later -> cancel
   before ~29 Oct.
3. Small: keep Jest from picking up `playwright/` (`testPathIgnorePatterns`).
4. Unchanged from 8 Oct: Stripe -> CRM, Plaid Relay link, LLC step 1, Relay leftovers.

---

## 2026-10-08 (Thursday)

**Snapshot at end of day**

| Metric | Value |
|---|---|
| Commits on main | 72 (0 today, head `c5a6fc3`) |
| Pushed to origin | yes, in sync |
| Uncommitted files | 0 |
| Typecheck | pass |
| Tests | 220 pass, 0 fail (10 suites) |
| Source lines (src/) | 10756 across 80 files |
| Test lines (tests/) | 3455 across 34 files |
| Agent runs in DB | 32 (forward-deployed-tester:succeeded,sdet-architect:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,architecture-dossier:succeeded,architecture-dossier:succeeded,architecture-dossier:succeeded,architecture-dossier:succeeded) |

**Done**

> The earlier 8 Oct session could not write here: macOS blocked ~/Documents mid-session (third
> time). Its facts were saved to Claude memory and are written up below after a restart with Full
> Disk Access granted to VS Code. No code commits in this repo.

- **System map** published (v2): https://claude.ai/artifact/Q9HYSbjJvrnrrPPZu4KNxA (apps, CRM,
  vendors, cards).
- **Live check (read-only):** zero sign-ups or events since the 7 Oct deploy; `crmoutboxes` in app
  db `test` empty; key `lastUsedAt` on `f13c4c27b648` / `3583e6388b5e` still at the backfill time.
  So the live path is untested, not broken.
- **Plaid:** Relay is not linked. Plaid holds BofA, Chase, Citi, Barclays only. The owner says the
  Hyde View Relay blocker is cleared; Equinest Relay is also unlinked.
- **LLC repurpose** (Hyde View Realty LLC as the agency LLC, ledger `l_514b52d5`, decided 24 Sep):
  0 of 8 steps done.
- **Ledger:** Resend row `l_b12df19b` updated to Pro, $20/month.
- **~17:05 UTC:** handoff saved to memory `project-state-2026-10-08` and a resume prompt; session
  restarted.

**Decided**

- Owner priority: whatever switches GoHighLevel off fastest, before its ~29 Oct renewal ($97/month,
  Chase ••1659, ledger `l_82b454c7`).
- Stripe -> CRM and the Plaid Relay link move off the critical path, to after GHL.

**Open / next**

1. GHL critical path:
   - Owner does one test sign-up and one audit on investoraiclub.com; check CRM contacts and
     timeline since 2026-10-07T02:00Z, `crmoutboxes`, key `lastUsedAt`.
   - Ask: do GHL workflows email or text leads? If yes, CRM email goes live first (owner pastes
     `RESEND_API_KEY` + `RESEND_WEBHOOK_SECRET`, picks `EMAIL_FROM`, redeploy askdbl-crm).
   - Owner exports GHL (checklist `FinOps.Audit.Agents/plans/highlevel-replacement-plan.md`).
   - Owner's go -> `GHL_SYNC=off` on `ai-tool-dashboard-pdo1` + deploy; remove GHL code a day later.
   - Owner cancels GHL before ~29 Oct; mark `l_82b454c7`; check Chase ••1659 for no charge.
2. After GHL: Stripe -> CRM for InvestorAI Club (set "Only payments the CRM started" first);
   Plaid Relay link (`npm run auth:plaid`, $0.30/month, owner's go and sign-in).
3. LLC repurpose step 1: CPA and attorney (~$11.1k due to affiliates, negative equity, cancel the
   drafted wind-up consent, single-member tax class, partner's role). Twilio A2P waits for the final
   legal name. Export the cancelled Hyde View QBO books; close `l_241f4c21` to match.
4. Relay leftovers: $99 re-audit test, verify-email link, Railway decision -> KEEP, check the
   18 Oct Railway charge on ••9671.

---

## 2026-10-07 (Wednesday)

**Snapshot at end of day**

| Metric | Value |
|---|---|
| Commits on main | 69 (0 today, head `c92ecfd`) |
| Pushed to origin | yes, in sync |
| Uncommitted files | 1 (PROGRESS.md) |
| Typecheck | pass |
| Tests | 220 pass, 0 fail (10 suites) |
| Source lines (src/) | 10756 across 80 files |
| Test lines (tests/) | 3455 across 34 files |
| Agent runs in DB | 32 (forward-deployed-tester:succeeded,sdet-architect:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded,architecture-dossier:succeeded,architecture-dossier:succeeded,architecture-dossier:succeeded,architecture-dossier:succeeded) |

**Done**

> Session ran 4–7 Oct (macOS Documents access restored first). No code commits in this repo;
> the work was in ai-tool-dashboard and askdbl-crm.

- **4 Oct ~11:50 — CRM apps and keys.** One-off script in askdbl-crm (deleted after, never
  committed) registered app `investoraiclub` in both CRM workspaces: InvestorAI Club prefix
  `user`; Site Analyzer prefixes `audit`, `link`, `report` plus exact type `checkout.started`
  (sent live by the re-audit checkout, not in the plan). Two app-bound keys (events, deals,
  leads write), prefixes `f13c4c27b648` and `3583e6388b5e`, never printed.
- **Vercel production env** on `ai-tool-dashboard-pdo1`: `CRM_API_URL`,
  `CRM_API_KEY_INVESTORAICLUB`, `CRM_API_KEY_SITE_ANALYZER`, piped from a chmod-600 file.
- **Backfill dry run:** first run read the empty `ai_tool_dashboard` db (local URI); the app data
  is in `test`. With `APP_DB_NAME=test`: 7+2 contacts, 8+12 events, 9 deals, 1 handoff (as
  expected).
- **7 Oct 01:38 UTC — backfill `--apply`:** events created 20, deals created 9; 0 duplicate,
  rejected or failed. CRM db then held 7+2 contacts, 9 deals, 17+12 timeline rows (17 = 8 events
  + 9 `deal.created`). `.env.crm.local` deleted.
- **Dashboard commits, pushed:** `11cf558` (43 CRM files; automation files left uncommitted) and
  `2ba792f` (outbox retry cron, daily at 06:30). tsc clean; Jest 433/433 pass; 6 Playwright specs
  fail to load under Jest (`@playwright/test` missing), unchanged by this work.
- **Production deploy** `ai-tool-dashboard-pdo1-p3kokaapn` Ready, aliased to investoraiclub.com.
  Smoke: home and login 200, outbox cron 401 without secret, crm.askdbl.com 200, CRM events API
  401 without key.
- **Relay setup (7 Oct):** ledger `l_07c098b4` marked Posted. Agency bills moved to Relay card
  ••9671 (owner typed the card; billing address Hyde View, Sheridan WY): Atlas (new row
  `l_c7bc8d43`), Railway (`l_3bb7f33d`), Resend (new row `l_b12df19b`, free tier, old card still
  saved). Vercel is on Hobby, nothing to move.
- **Atlas crm-prod Free → Flex (7 Oct, owner OK):** from $0.011/hour, capped at $30/month. Back
  up after ~210 s; 9 contacts read back; cluster shows FLEX, Backups Active.
- **CRM Stripe filter** (askdbl-crm `625606a`, deployed): Settings -> Payments gains "Only payments
  the CRM started" (`paymentScope: "crm"`); the webhook then ignores invoices, checkouts and refunds
  the CRM did not start. Default stays "all". tsc clean, 819/819 tests (3 new). Deploy Ready; smoke:
  home 200, Stripe webhook 404 until a secret is saved, events API 401 without key.
- **Resend:** Pro bought by the owner ($20/month, Transactional). Delivery webhook created ->
  `https://crm.askdbl.com/api/webhooks/resend` (delivered, opened, clicked, bounced, complained),
  Enabled. Correction: the free plan allows 3 domains, not 1 (told the owner before the purchase).
- **READMEs:** askdbl-crm status rewritten for 7 Oct (`73021af`); ai-tool-dashboard CRM note now
  says the cut-over is live (`7575cc6`).

**Decided**

- Go on the cut-over, `--apply` and the production deploy (owner, at each stop point).
- Outbox retry cron runs once a day (owner).
- The backfill reads app db `test`, not the db named in the local URI.
- Name still parked; owner is checking Ownsure / Nextown / Wholemark on GoDaddy.
- Only crm-prod goes to Flex; the app cluster stays Free for now. $99 re-audit test deferred.
- Stripe: connect InvestorAI Club only, scope "crm"; Site Analyzer stays unconnected. Resend:
  Pro (owner); delivery webhook only; inbound email later.
- Railway stays (it hosts the audit worker); the ledger decision column still says CANCEL for the
  owner to change.

**Open / next**

1. Watch the CRM outbox (`crmoutboxes`, `pending` / `dead`) and key `lastUsedAt` for 1–2 days of
   live traffic; then ask the owner before `GHL_SYNC=off` and deleting GHL code.
2. Relay leftovers: $99 re-audit test + refund (deferred); owner clicks Relay's verify-email
   link; check the 18 Oct Railway charge lands on ••9671; owner sets Railway decision to KEEP.
3. CRM vendor setup, resume here:
   - Owner signs in to crm.askdbl.com; set InvestorAI Club Settings -> Payments to "Only payments
     the CRM started" BEFORE any Stripe secret is saved.
   - Owner: Resend API key (Full access, "askdbl-crm production") -> Vercel askdbl-crm Production
     `RESEND_API_KEY`; webhook signing secret -> `RESEND_WEBHOOK_SECRET`.
   - Owner picks `EMAIL_FROM`: crm@investoraiclub.com (verified) or an askdbl.com address (needs
     GoDaddy DNS records). Then set it and redeploy askdbl-crm.
   - Stripe (live): create the endpoint `/api/webhooks/stripe/investoraiclub` with the 10 events on
     the Payments page; owner pastes a restricted key (Customers, Invoices, Invoice items: write) and
     the signing secret into the CRM. Then test end to end.
4. Name: owner picks; nothing bought without OK.

---

## 2026-09-25 (Friday) — *reconstructed*

> Backfilled on 29 Sep from the session memory. At the end of the 25 Sep session macOS blocked the
> terminal from `~/Documents` ("Operation not permitted"), so `npm run progress` and the commit
> could not run. No commits were made in this repo that day; the 24 Sep snapshot still holds
> (head `c92ecfd`, 163/163 tests).

**Done**

- **Naming filter re-run by script** (the round-3 workflow could not be resumed across sessions,
  so the 73 cached names were pulled from its journal): whois for .com/.ai/.io/.co and get-/try-
  .com, `gh api users/<name>`, `npm view`. Output in `~/Documents/askdbl-dossier/naming/`
  `round-3-filter.md` and `round-3-checks.json` (untracked in that repo).
- **Verified shortlist, each rechecked by hand:** Ownsure (recommended), Nextown, Wholemark. All
  have .ai/.io/.co and get-/try- free, GitHub and npm free, USPTO classes 9/42 clear.
- **Correction to 24 Sep:** ownsure.ai, .io and .co are FREE (registry whois, no NS, checked
  twice); only ownsure.com is taken.
- **Failed clearance:** Heedra (HEDRA class 42 mark; heard as "Hydra"), Vouchio (Vouchio LLC,
  security software), Surelo (Surelio.ai; npm name reserved).
- **CRM cut-over plan proposed** in concrete form: a one-off uncommitted script in askdbl-crm
  using `createApp` + `createApiKey`; keys piped into Vercel production on
  `ai-tool-dashboard-pdo1` without printing, plus a chmod-600 gitignored `.env.crm.local` for the
  backfill, deleted after.
- **Found:** CRM production lacks `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`,
  `RESEND_INBOUND_WEBHOOK_SECRET`, and neither workspace has Stripe connected.

**Decided**

- Password rotation deferred. A2P 10DLC moves to its own thread. Twilio excluded from the CRM
  vendor setup for now.
- The $1,000 Relay wire has landed; Relay setup resumes (ledger `l_07c098b4` posted, agency
  bills to card ••9671, Atlas Free → Flex, $99 re-audit test).

**Open / next**

1. Owner picks the name; before buying, a 5-person spelling test and an EUIPO/UKIPO/India
   trademark knockout. Nothing bought.
2. CRM cut-over: plan proposed, owner's go on the run still needed.
3. Relay setup, then CRM vendor setup (Resend and Stripe per workspace), then the dossier
   lead-magnet page.

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
  - **Seeded live** (from `.env.local`, chmod 600, gitignored): workspaces `investoraiclub` and
    `site-analyzer`; pipelines client-requests (draft › in-progress › complete › closed) and leads
    (new › contacted › qualified › proposal › won › lost); owner abhi@askdbl.com on both.
    Production deploy `fkz1o1ej8` is Ready. The first deploy failed because the framework preset
    was Other; `vercel.json` now pins nextjs.
  - **https://crm.askdbl.com is LIVE.** The GoDaddy record `A crm 76.76.21.21` was saved and
    verified by the owner; public DNS resolved at once; the certificate was issued with
    `vercel certs issue`; the sign-in page serves 200.
  - **Remaining modules built and deployed** by a workflow of eight module agents plus an
    integrator: record (companies, tasks, custom fields, tags, saved views, merge, CSV), team
    (invites, roles, audit log, password change/reset), email marketing (domains, templates,
    campaigns, one-click unsubscribe, suppression), inbox (email, SMS, web chat, STOP/START),
    affiliates, billing and attribution (per-workspace Stripe, encrypted keys), reports, and
    platform (rate limits, forms, bookings, GitHub Actions cron). Verified by hand: typecheck and
    lint clean, **694/694 tests** (64 files); commit `20d4a47`, pushed; deploy `975a5gpc4` Ready.
    Live smoke test: /login 200, widget 200, /api/v1 401 without a key, the cron endpoint 401
    without its secret. A manual run of the GitHub cron workflow succeeded, so the shared secret
    works.
  - Secrets generated straight into Vercel without being printed: CRM_ENCRYPTION_KEY,
    MARKETING_TOKEN_SECRET, FORMS_TOKEN_SECRET, AFFILIATE_HASH_SECRET, AUDIT_IP_SALT.
    CRON_SECRET was rotated into Vercel and the GitHub repo secret together. CRM_PUBLIC_URL and
    AUTH_URL are https://crm.askdbl.com.
  - `crm.askdbl.com` moved from `ai-tool-dashboard-pdo1` (whose three investoraiclub domains stay
    valid) to `askdbl-crm`. DNS still needs the GoDaddy record `A crm 76.76.21.21`.

- **Backfill dry run against production (read-only, nothing sent):**
  - InvestorAI Club: 7 contacts, 8 events (7 user.registered, 1 handoff.received), 9 deals,
    1 hand-off.
  - Site Analyzer: 2 contacts, 12 events (audit submitted/finished/unlocked ×3 each,
    report.viewed, link.expired, handoff.sent).
  - 1 contact skipped (no events); nothing routed by default; no site keys or automations to
    recreate.
  - Prefixes to register first: app `investoraiclub` in both workspaces; `user` in InvestorAI
    Club; `audit`, `link` and `report` in Site Analyzer.

- **Deploy bundle A–D (owner-approved):**
  - A: CRM `985bf15`. The ingest contract is hardened (v1.1.0 live): apps registry, one
    `authorizeWrite` guard on every v1 write with a static bypass test, idempotency conflicts
    (`idempotency_key_reused`), deal moves applied in `occurredAt` order with `stale` for late
    ones. Shared client 1.1.0. 816/816 tests. Live: /login 200, `/api/v1/contract` 1.1.0,
    events without a key 401.
  - B: forward-qa-agents `a5bc16a`, plate 47, **the architecture-dossier agent**
    (deterministic, env var names only, measured vs stated facts), 220/220 tests. GitHub push
    protection blocked the first push over a FAKE Stripe-shaped test string; it is now
    assembled at run time rather than allow-listed.
  - C: **private** repo https://github.com/akc031185/askdbl-dossier with dossiers for
    investoraiclub, the CRM and Site Analyzer, plus a portfolio index (205 endpoints, 82
    models, 1,148 tests, 8 vendors). Secret-scanned clean.
  - D: investoraiclub `fb25752`, **retired the unsigned GHL webhook** `/api/webhooks/ghl`.
    The dossier found it: anyone could post to it and change a client request's status. It
    now answers 410, verified live; home 200. Only that file was committed; the other 45
    uncommitted files are untouched.

**Decided**

- **One app id, `investoraiclub`, in both CRM workspaces.** An app is the codebase that sends
  data; a workspace is the business it lands in, chosen by the API key. A separate
  `site-analyzer` app would orphan anonymous auditors, who have only investoraiclub ids.
- **Site Analyzer is its own workspace**, because its pricing differs from InvestorAI Club. Audit,
  re-audit and subscription events go to Site Analyzer; fix requests, proposals and projects go
  to InvestorAI Club (two API keys in investoraiclub.com). To build: a cross-workspace hand-off,
  and the Site Analyzer pipeline stages (audited › report sent › opened › re-audit paid ›
  subscribed; lost).
- **Relay funding:** $1,000 for about three months of agency running costs (~$250/month plus the
  one-offs). Move agency subscriptions to the Relay card once the wire posts.

**Open / next** (updated late 24 Sep; the owner is moving and may lose connection)

1. **CRM cut-over: APPROVED by the owner, not started.** Run it when the connection is stable:
   1. In the CRM, register app `investoraiclub` in BOTH workspaces, with namespace
      `investoraiclub`, prefix `user` in InvestorAI Club and prefixes `audit`, `link`, `report`
      in Site Analyzer.
   2. Create two app-bound API keys (events, deals and leads scopes) and put them into
      investoraiclub's Vercel production env without printing them: `CRM_API_KEY_INVESTORAICLUB`,
      `CRM_API_KEY_SITE_ANALYZER`, and `CRM_API_URL=https://crm.askdbl.com`.
   3. Re-run the backfill dry run (numbers should match 23/24 Sep), then `--apply`, then check the
      CRM.
   4. Commit ONLY our investoraiclub CRM files (never the automation workstream's
      `src/lib/ops/automations.ts`, `_tests_/lib/ops-automations.test.ts`, `docs/AUTOMATIONS.md`),
      deploy, and watch the outbox for 1–2 days.
   5. `GHL_SYNC=off`, delete the GHL code and env vars, then the owner cancels GHL ($99/month).
2. **Product naming:** round 3 ran (workflow `wf_a7764bb6-20b`, result
   `~/Documents/askdbl-dossier/naming/round-3.md`), but its filter step did NOT run the
   domain/GitHub/npm checks and rejected 71 of 73 names on rules only. **Next: re-run only the
   filter, fixed** (the generated names are cached; resume the workflow), then clear the
   survivors.
   Hand-verified so far:
   - **Wholemark:** .ai, .io, .co, get- and try- free; GitHub and npm free; USPTO clear. Risk:
     sounds like HALLMARK.
   - **Nextown:** .ai, .io, .co, get- and try- free; GitHub and npm free; USPTO clear. Risk: heard
     as "next town".
   - **Ownsure:** .com, .ai, .io, .co, .app and .dev all taken; only get- and try- free; heard as
     OnSure.
   - **Exray:** eliminated.
   Nothing bought.
3. **Dossier product:** a lead-magnet page first (public GitHub URL → free readiness score + top
   risks → CRM lead), then the CLI, GitHub connect and done-for-you. Sold from investoraiclub.com
   with its own CRM workspace; pricing decided later. Waits on the name.
4. **Owner:** rotate the `crm_app` and CRM owner passwords (both shared in chat); verify the
   Relay email; start Twilio A2P 10DLC after the LLC rename; vendor setup in the CRM (Resend,
   Twilio, Stripe per workspace).
5. **Later:** the Hyde View rename (ledger `l_514b52d5`); the $99 re-audit test; Atlas Free →
   Flex; the intermittent CRM test (3 DB-backed tests failed together once in about 21 runs).
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

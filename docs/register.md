# Implementation register

The running record of what exists, what has been tested and what is outstanding. Update it at the end of every stage. A feature is only marked **Complete and verified** after its tests pass.

Statuses follow the master plan: Complete and verified, Partially implemented, Implemented but defective, Missing, Requires security review, Requires performance or reliability improvements, Requires further investigation.

"Demo" means the feature works in the browser only demo. Planned tables are proposals until their migration is applied.

## Features

| Feature | Status | Main files | Tables (planned) | Tests | Notes |
|---|---|---|---|---|---|
| Public website | Complete and verified | root pages, `services/`, `css/site.css`, `js/site/layout.js` | none | links, text, layout | Live at alliedwithyou.com.au. No placeholders. About page awaiting the therapist's details |
| Website enquiry and referral forms | Partially implemented | `contact.html`, `referrals.html`, `supabase/functions/enquiry` | `form_limits` (rate limits only) | enquiry | The function is built and verified on the test project. The forms return to the pages in Part C |
| Sign in | Partially implemented | `supabase/migrations`, `supabase/config.toml`, `supabase/templates` | Supabase Auth, `profiles`, `signup_allowlist` | auth | Database rules, invitations and email verified on the test project. Sign in screens come in Part C |
| Roles and permissions | Partially implemented | `supabase/migrations`, `js/admin/access.js` | all, through Row Level Security | auth | Enforced in the database for every table that exists so far. Client and clinical tables come later |
| Client records | Implemented but defective | `clients.js`, `client.js` | `clients`, `client_health`, `contacts`, `client_access` | journey, screens | Hard delete, no duplicate check |
| Referrals and intake | Complete and verified (demo) | `referrals.js` | `referrals` | journey | |
| Appointments | Implemented but defective | `calendar.js`, `actions.js` | `appointments` | journey, screens | No time zone storage |
| Clinical notes and corrections | Requires security review | `notes.js`, `store.js` | `notes`, `note_amendments` | journey | Locking enforced only in the browser |
| Assessments, goals, progress | Complete and verified (demo) | `assessments.js`, `goals.js` | `assessments`, `goals`, `progress` | screens, dialogs | |
| Clinical reports | Complete and verified (demo) | `reports.js` | `reports` | screens | |
| Documents | Partially implemented | `documents.js` | `documents`, `document_versions`, storage bucket | screens | Details only, no files |
| Consent records | Complete and verified (demo) | `documents.js` | `consents` | journey | |
| Service agreements | Complete and verified (demo) | `agreements.js` | `agreements` | journey | |
| Funding plans, delivered services, prices | Complete and verified (demo) | `funding.js`, `rules.js` | `funding_plans`, `support_logs`, `support_items` | journey, data | |
| Invoices | Complete and verified (demo) | `invoices.js`, `rules.js` | `invoices`, `invoice_lines` | journey, data | Totals from lines |
| Automations | Complete and verified (demo) | `automations.js` | triggers and functions | journey, data | Move into the database in Stage 2 |
| Tasks | Complete and verified (demo) | `tasks.js`, `actions.js` | `tasks` | screens | |
| Incidents and complaints | Requires security review | `incidents.js` | `incidents` | screens | Restriction is interface only |
| Staff and access matrix | Partially implemented | `staff.js` | `staff` | screens | No accounts or offboarding |
| Business reports | Complete and verified (demo) | `statistics.js`, `rules.js` | reporting functions | screens | Worked out in the browser |
| Settings | Implemented but defective | `settings.js`, `js/data/business.js` | `settings` | screens | Website details stored twice |
| Audit trail | Requires security review | `store.js` | `audit_events` | journey | Editable in the browser. Erased when a client is deleted |
| Global search | Partially implemented | `shell.js` | search function | none | Browser only, no paging |
| Exports | Partially implemented | `settings.js` | export function | none | One unlogged download |
| Error handling and logging | Partially implemented | `supabase/migrations` | `error_events`, `log_error()` | auth | Storage and the rate limited logging function exist. The browser side comes in Part C |
| Developer tickets and dashboard | Missing | none | `dev_tickets`, `ticket_comments`, `ticket_events` | none | Stage 4 |
| Report an issue and staff feedback | Partially implemented | `supabase/migrations` | `feedback` | auth | Table and rules exist. Screens come in Part C |
| Backups and recovery | Missing | none | none | none | Stage 3 |
| System administration and monitoring | Missing | none | `monitoring_config`, `job_runs` | none | Stage 6 |
| Notifications and scheduled jobs | Missing | none | `notifications`, `job_runs` | none | Stage 6 |
| Privacy requests | Missing | none | `privacy_requests` | none | Stage 7 |
| Automated tests in the repository | Complete and verified | `tests/` | none | all seven pass | Added in Stage 0. Chromium only |

## Changes

| Date | Stage | Change | Commit |
|---|---|---|---|
| 13 Oct 2026 | Build | Website and browser demo dashboard built and published on GitHub Pages | `4e137ac` |
| 14 Oct 2026 | 0 | Audit (`docs/audit.md`), this register, automated tests moved into `tests/`, `.env` and `node_modules` ignored | `44ffb26` |
| 19 Oct 2026 | Hosting | Site moved to the custom domain alliedwithyou.com.au (`CNAME` file, 404 page paths from the domain root) | `80da9d9` |
| 19 Oct 2026 | Part A | Live website made ready for the public: testing notices, demo links and all 42 placeholders removed, contact shown as admin@ only, fees published, NDIS registration wording removed, `noindex` removed from public pages, forms replaced by email panels, `/admin/` replaced by a holding page, demo browser tests retired | `607e269` |
| 19 Oct 2026 | Part B | Supabase foundations on the test project: three migrations, sign in settings and email templates through noreply@, the enquiry Edge Function, `auth` and `enquiry` checks, `docs/operations.md`. Production is untouched until the release | this change |

## Database migrations

| Migration | What it does | Test project | Production |
|---|---|---|---|
| `20261019000000_foundation.sql` | Staff accounts, approvals, settings, fees, tasks, staff calendar, feedback, error events, audit trail, form rate limits, all with Row Level Security | 19 Oct 2026 | Not yet |
| `20261019010000_staffrefs.sql` | Lets links to a removed staff account clear instead of blocking the removal | 19 Oct 2026 | Not yet |
| `20261019020000_invites.sql` | Reserved addresses activate only after an accepted invitation | 19 Oct 2026 | Not yet |

## Security findings

| Date | Finding | Severity | Status |
|---|---|---|---|
| 14 Oct 2026 | Access control is enforced only in the interface | Critical for production | Fixed in the database for the foundation tables (verified on the test project 19 Oct 2026). Open for client and clinical tables, which don't exist yet |
| 14 Oct 2026 | Passwordless dashboard entry | Critical for production | Removed from the live site 19 Oct 2026 (holding page). Real sign in arrives in Part C |
| 14 Oct 2026 | Clinical note locking and audit records can be edited in the browser | High for production | Open, Stages 1 and 2 |
| 14 Oct 2026 | No Content Security Policy or security headers | Medium | Open, Stage 2 (meta policy), host choice later |
| 14 Oct 2026 | Website forms have no rate limiting | Low now | Fixed in the enquiry function: five an hour per visitor, spam trap, website only (verified 19 Oct 2026) |
| 14 Oct 2026 | No secrets committed | None | Verified |
| 19 Oct 2026 | Reserved administrator addresses could be registered by a stranger before the real owner | High | Fixed: they activate only after an accepted invitation (verified on the test project) |
| 19 Oct 2026 | The noreply@ mailbox password was shared in a chat message | Low (send only mailbox) | Open: change it in cPanel and update `.env` and the Supabase secrets if wanted |

## Known limitations

* The live dashboard is a holding page until the CRM release. The demo data layer remains in the repository only, unused by any live page.
* Browser tests run in Chromium only, not Safari or Firefox.
* Seeded dates are set relative to the day the demo data was first loaded, so they drift until the data is reset.

## Outstanding work

See `docs/audit.md` for the full stage list. Next is Part C: the CRM sign in, the locked sections and the working sections on the test project, then the production release.

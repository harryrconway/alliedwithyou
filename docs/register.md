# Implementation register

The running record of what exists, what has been tested and what is outstanding. Update it at the end of every stage. A feature is only marked **Complete and verified** after its tests pass.

Statuses follow the master plan: Complete and verified, Partially implemented, Implemented but defective, Missing, Requires security review, Requires performance or reliability improvements, Requires further investigation.

"Demo" means the feature works in the browser only demo. Planned tables are proposals until their migration is applied.

## Features

| Feature | Status | Main files | Tables (planned) | Tests | Notes |
|---|---|---|---|---|---|
| Public website | Complete and verified | root pages, `services/`, `css/site.css`, `js/site/layout.js` | none | links, text, layout | Contact details still placeholders |
| Website enquiry and referral forms | Partially implemented | `js/site/forms.js` | `referrals` via `submit_enquiry` | journey | Saves only to the browser demo |
| Sign in | Partially implemented | `js/admin/app.js` | Supabase Auth, `staff` | none yet | Passwordless person picker, no expiry |
| Roles and permissions | Requires security review | `js/admin/access.js` | all, through Row Level Security | screens (interface only) | Interface only. No database enforcement |
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
| Error handling and logging | Missing | none | `error_events` | none | Stage 4 |
| Developer tickets and dashboard | Missing | none | `dev_tickets`, `ticket_comments`, `ticket_events` | none | Stage 4 |
| Report an issue and staff feedback | Missing | none | `feedback` | none | Stage 4 |
| Backups and recovery | Missing | none | none | none | Stage 3 |
| System administration and monitoring | Missing | none | `monitoring_config`, `job_runs` | none | Stage 6 |
| Notifications and scheduled jobs | Missing | none | `notifications`, `job_runs` | none | Stage 6 |
| Privacy requests | Missing | none | `privacy_requests` | none | Stage 7 |
| Automated tests in the repository | Complete and verified | `tests/` | none | all seven pass | Added in Stage 0. Chromium only |

## Changes

| Date | Stage | Change | Commit |
|---|---|---|---|
| 13 Oct 2026 | Build | Website and browser demo dashboard built and published on GitHub Pages | `4e137ac` |
| 14 Oct 2026 | 0 | Audit (`docs/audit.md`), this register, automated tests moved into `tests/`, `.env` and `node_modules` ignored | this stage |

## Database migrations

None yet. Migrations will live in `supabase/migrations/` and be listed here with the date applied to staging.

## Security findings

| Date | Finding | Severity | Status |
|---|---|---|---|
| 14 Oct 2026 | Access control is enforced only in the interface | Critical for production | Open, Stage 1 |
| 14 Oct 2026 | Passwordless dashboard entry | Critical for production | Open, Stage 2 |
| 14 Oct 2026 | Clinical note locking and audit records can be edited in the browser | High for production | Open, Stages 1 and 2 |
| 14 Oct 2026 | No Content Security Policy or security headers | Medium | Open, Stage 2 (meta policy), host choice later |
| 14 Oct 2026 | Website forms have no rate limiting | Low now | Open, Stage 1 |
| 14 Oct 2026 | No secrets committed | None | Verified |

## Known limitations

* All data is fictional and held per browser until Stage 2.
* Browser tests run in Chromium only, not Safari or Firefox.
* Seeded dates are set relative to the day the demo data was first loaded, so they drift until the data is reset.

## Outstanding work

See the stages in `docs/audit.md`. The next stage is Stage 1, which needs the Supabase staging project and Harry's command line login.

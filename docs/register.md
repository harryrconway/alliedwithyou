# Implementation register

The running record of what exists, what has been tested and what is outstanding. Update it at the end of every stage. A feature is only marked **Complete and verified** after its tests pass.

Statuses follow the master plan: Complete and verified, Partially implemented, Implemented but defective, Missing, Requires security review, Requires performance or reliability improvements, Requires further investigation.

"Locked" means the section is listed in the dashboard menu, greyed out and can't be opened. Its tables don't exist yet, so nothing can be stored in it.

## Features

| Feature | Status | Main files | Tables | Tests | Notes |
|---|---|---|---|---|---|
| Public website | Complete and verified | root pages, `services/`, `css/site.css`, `js/site/layout.js` | none | links, text, layout | Live at alliedwithyou.com.au. About page awaiting the therapist's details |
| Website enquiry and referral forms | Complete and verified on the test project | `contact.html`, `referrals.html`, `js/site/forms.js`, `supabase/functions/enquiry` | `form_limits` (rate limits only) | enquiry, site | Emailed to the practice, nothing stored. Goes live at the release |
| Sign in, create account, password reset, invitations | Complete and verified on the test project | `js/admin/app.js`, `js/data/remote.js`, `supabase/config.toml`, `supabase/templates` | Supabase Auth, `profiles`, `signup_allowlist` | auth, crm | Email or username, 12 character minimum, signed out after 30 minutes without activity. Multi factor sign in is switched on in Supabase but not offered on screen yet |
| Account approvals and team | Complete and verified on the test project | `js/admin/views/staff.js` | `profiles` | auth, crm | Approval needs a confirmed email. Reserved addresses only through an invitation. Staff are switched off, not deleted |
| Roles and permissions | Complete and verified on the test project | `supabase/migrations`, `js/admin/access.js` | all, through Row Level Security | auth, crm | Administrator, therapist, reception, support and developer. The database enforces the same rules as the screens |
| Locked sections | Complete and verified on the test project | `js/admin/access.js`, `js/admin/shell.js` | none | crm | Client records, enquiries, notes, assessments, goals, reports, documents, agreements, funding, invoices, incidents and business reports |
| Dashboard | Complete and verified on the test project | `js/admin/views/dashboard.js` | read only | crm | Your tasks, your week, accounts waiting, recent feedback |
| Tasks | Complete and verified on the test project | `js/admin/views/tasks.js`, `js/admin/actions.js` | `tasks` | auth, crm | No client details. Retries can't create duplicates |
| Staff calendar | Complete and verified on the test project | `js/admin/views/calendar.js`, `js/admin/actions.js` | `calendar_blocks` | auth, crm | Labels such as Booked and Leave only. Stored as exact moments with a NSW or QLD time zone. The database refuses double bookings |
| Settings and fees | Complete and verified on the test project | `js/admin/views/settings.js` | `settings`, `price_items` | auth, crm | Administrators change them, everyone else reads. Fees have start dates. The website's fees page is updated separately |
| Report an issue and staff feedback | Complete and verified on the test project | `js/admin/views/feedback.js`, `js/admin/actions.js` | `feedback` | auth, crm | Each report gets a six character reference. Administrators and developers review and reply |
| Error handling and logging | Complete and verified on the test project | `js/core/errors.js`, `js/admin/components.js` | `error_events`, `log_error()` | auth, crm | Every failure shows a reference and a plain message. Diagnostics are scrubbed of personal details. Kept and sent later if logging is down |
| Audit trail | Complete and verified on the test project | `supabase/migrations` | `audit_events` | auth | Written by the database, can't be changed or deleted. Not shown on screen yet |
| Global search | Partially implemented | `js/admin/shell.js` | none | none | Tasks and the team only, from data already loaded |
| Client records, intake, appointments, notes, assessments, goals, reports, documents, consent, agreements, funding, invoices, incidents, business reports | Locked | none | none yet | crm (locked) | The demo versions were removed and are recoverable from commit `80da9d9`. Each returns with its own tables, rules and tests when the practice is ready |
| Developer tickets and dashboard | Missing | none | `dev_tickets`, `ticket_comments`, `ticket_events` | none | Stage 4. Feedback and error reports cover the first part |
| Backups and recovery | Missing | none | none | none | Stage 3. Needed before any client information goes in |
| System administration and monitoring | Missing | none | `monitoring_config`, `job_runs` | none | Stage 6 |
| Notifications and scheduled jobs | Missing | none | `notifications`, `job_runs` | none | Stage 6. For example, an email when someone is waiting for approval |
| Privacy requests | Missing | none | `privacy_requests` | none | Stage 7 |
| Automated tests in the repository | Complete and verified | `tests/` | none | all eight pass | Chromium only |

## Changes

| Date | Stage | Change | Commit |
|---|---|---|---|
| 13 Oct 2026 | Build | Website and browser demo dashboard built and published on GitHub Pages | `4e137ac` |
| 14 Oct 2026 | 0 | Audit (`docs/audit.md`), this register, automated tests moved into `tests/`, `.env` and `node_modules` ignored | `44ffb26` |
| 19 Oct 2026 | Hosting | Site moved to the custom domain alliedwithyou.com.au | `80da9d9` |
| 19 Oct 2026 | Part A | Live website made ready for the public: testing notices, demo links and all 42 placeholders removed, fees published, NDIS registration wording removed, forms replaced by email panels, `/admin/` replaced by a holding page | `607e269` |
| 19 Oct 2026 | Part B | Supabase foundations on the test project: migrations, sign in settings and email templates through noreply@, the enquiry Edge Function, `auth` and `enquiry` checks, `docs/operations.md` | `a2184d6` |
| 19 Oct 2026 | Parts C and D | The real staff dashboard on Supabase: sign in, create account, invitations and password reset, approvals, locked sections, dashboard, tasks, staff calendar, settings and fees, feedback and error reports, shared error handling. Website forms back, sending by email. Approvals migration. Demo data layer and locked screens removed. New `crm`, `site` and `env` test files, `data` check retired | `477926c` |
| 19 Oct 2026 | Release | Production: the four migrations applied (each in one transaction, matching the test project table for table), sign in settings and email templates pushed, enquiry function deployed with its own secrets and no local access. `crm` merged into `main` | this change |

## Database migrations

| Migration | What it does | Test project | Production |
|---|---|---|---|
| `20261019000000_foundation.sql` | Staff accounts, approvals, settings, fees, tasks, staff calendar, feedback, error events, audit trail, form rate limits, all with Row Level Security | 19 Oct 2026 | 19 Oct 2026 |
| `20261019010000_staffrefs.sql` | Lets links to a removed staff account clear instead of blocking the removal | 19 Oct 2026 | 19 Oct 2026 |
| `20261019020000_invites.sql` | Reserved addresses activate only after an accepted invitation | 19 Oct 2026 | 19 Oct 2026 |
| `20261019030000_approvals.sql` | Copies the email confirmation time onto the profile. Approval needs it, and reserved addresses can't be approved by hand | 19 Oct 2026 | 19 Oct 2026 |

## Security findings

| Date | Finding | Severity | Status |
|---|---|---|---|
| 14 Oct 2026 | Access control is enforced only in the interface | Critical for production | Fixed in the database for every table that exists (verified on the test project). Client and clinical tables will need the same before they open |
| 14 Oct 2026 | Passwordless dashboard entry | Critical for production | Fixed: replaced by Supabase sign in (verified on the test project) |
| 14 Oct 2026 | Clinical note locking and audit records can be edited in the browser | High for production | The audit trail is now in the database and can't be changed (verified). Note locking returns with the notes tables |
| 14 Oct 2026 | No Content Security Policy or security headers | Medium | Partly fixed: the dashboard has a Content Security Policy limiting scripts to the site and connections to Supabase. The public pages and server headers remain open, as GitHub Pages can't set headers |
| 14 Oct 2026 | Website forms have no rate limiting | Low now | Fixed in the enquiry function: five an hour per visitor, spam trap, website only (verified) |
| 14 Oct 2026 | No secrets committed | None | Verified again 19 Oct 2026 |
| 19 Oct 2026 | Reserved administrator addresses could be registered by a stranger before the real owner | High | Fixed: they activate only after an accepted invitation, and can't be approved by hand (verified on the test project) |
| 19 Oct 2026 | Accounts could be approved before the person confirmed they own the email address | Medium | Fixed by the approvals migration (verified on the test project) |
| 19 Oct 2026 | The noreply@ mailbox password was shared in a chat message | Low (send only mailbox) | Open: change it in cPanel and update `.env` and the Supabase secrets if wanted |

## Known limitations

* Multi factor sign in is available in Supabase but has no screens yet. It must be required before any sensitive section opens.
* Nobody is told when a new account is waiting for approval. Administrators see it on the dashboard.
* The calendar loads a window of about four months either side of what's on screen, and tasks completed more than 90 days ago aren't shown.
* Browser tests run in Chromium only, not Safari or Firefox.
* The Supabase free plan has no backups. Acceptable for staff accounts, settings, tasks and availability, not for client information.

## Outstanding work

* Release checks: a test enquiry from the live site reaching admin@, then the three invitations when the practice is ready, and a live sign in confirming the locked sections.
* Later stages, as in `docs/audit.md`: backups, multi factor screens, the developer dashboard, documents and storage, notifications, privacy requests, and each locked section in turn.

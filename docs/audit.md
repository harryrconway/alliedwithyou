# Audit of the Allied With You website and dashboard

Date: 14 October 2026. Audited at commit `4e137ac` on `main`.

This is a record of the system as it was on that date. For what has changed since, see `docs/register.md`.

This audit was requested by the master development plan before any further work. Each finding is marked **verified** (seen by running the system or reading the code) or **assumed** (reasoned but not yet checked against a running system).

How it was done:

* Read the source in this repository.
* Ran the browser and data checks again from the build session in Chromium through Playwright: the full journey from website referral to paid invoice, every screen for every role, every record dialog, text, links, layout widths and keyboard use.
* Checked the repository and this Mac for any Supabase configuration, keys, migrations or command line tools.

## Summary

The master plan assumes a Supabase backend already exists. **It does not (verified).** There is no Supabase project, configuration, SQL, environment file or key anywhere in the repository or on this machine, and the Supabase command line tool is not installed. The dashboard is a complete interactive demo that keeps its data in each person's browser.

The screens are in good shape and were built so their data layer can be swapped for a database without rewriting them. The work ahead is to connect them to a new Supabase backend, enforce security in the database, and add error handling, ticketing, backups, monitoring and the other operational features the plan requires.

## Current architecture

| Part | What exists now | Basis |
|---|---|---|
| Hosting | GitHub Pages, served from `main` of the public repository `harryrconway/alliedwithyou` at https://harryrconway.github.io/alliedwithyou/ | Verified |
| Frontend | Static HTML, CSS and JavaScript with no build step and no framework. Plain scripts share one `window.AWY` namespace so pages also work when opened from disk | Verified |
| Website | 19 pages at the root and in `services/`. Shared header and footer from `js/site/layout.js`. Contact details from `js/data/business.js` | Verified |
| Dashboard | `admin/index.html` with hash routing (`js/admin/router.js`), shell (`js/admin/shell.js`), shared components (`js/admin/components.js`), shared actions (`js/admin/actions.js`) and one file per screen in `js/admin/views/` | Verified |
| Data | `js/data/store.js` keeps every table in the browser's localStorage under the key `awy.demo`, seeded from `js/data/seed.js`. Its API is asynchronous: `list`, `get`, `create`, `update`, `remove`, `snapshot`, `on`, `amendNote`, `impact`, `reset` | Verified |
| Record definitions | `js/data/schema.js` defines 22 record types with fields, statuses and labels | Verified |
| Business rules | `js/data/rules.js` works out every derived value: invoice totals, overdue states, plan usage, dashboard figures, statistics | Verified |
| Automations | `js/data/automations.js` listens to store changes in the browser and creates tasks and delivered service records | Verified |
| Sign in | A person picker with no password. The choice is kept in localStorage under `awy.session` and never expires | Verified |
| Access control | `js/admin/access.js` hides sections and buttons by role. Nothing is enforced anywhere else | Verified |
| Backend, database, storage, functions | None | Verified |
| Integrations | None. Fonts and scripts are self hosted. No analytics. The only external address in the code is the SVG namespace | Verified |
| Automated tests in the repository | None. The checks from the build session were kept outside the repository | Verified |

## Complete and verified features (demo mode)

Verified by the browser checks on 13 and 14 October 2026. "Demo mode" means the feature works fully with the data in one browser. None of these is yet backed by a database or protected on a server.

| Feature | Where |
|---|---|
| Public website, mobile to desktop, single font, no hyphens or dashes in displayed text | root pages, `services/`, `css/site.css` |
| Referral and contact forms with accessible validation, saving into the demo data | `referrals.html`, `contact.html`, `js/site/forms.js`, `js/core/validate.js` |
| Dashboard overview with figures worked out from records | `js/admin/views/dashboard.js`, `js/data/rules.js` |
| Client records: search, filters, sorting, profile with tabs, contacts, history | `clients.js`, `client.js` |
| Referrals with stages, and conversion to a client that carries the details across | `referrals.js` |
| Calendar with week, month and list views, travel bands, reschedule, cancel, complete, clash detection | `calendar.js`, `actions.js` |
| Clinical notes: draft, finalise, locked after finalising, corrections kept beside the original | `notes.js`, `store.js` (`lockedWhen`, `amendNote`) |
| Assessments, goals with progress, clinical reports with review and delivery steps and a print view | `assessments.js`, `goals.js`, `reports.js` |
| Consent records, document details, service agreements with signature recording | `documents.js`, `agreements.js` |
| Funding plans, delivered services checked against plans, price items with effective dates | `funding.js` |
| Invoices totalled from their lines, issue, payment recording, cancellation | `invoices.js` |
| Tasks, incidents and complaints, staff and access matrix, business reports, settings | matching files in `js/admin/views/` |
| Automations: referral follow up, client setup, note reminders and closing, agreement follow up, delivered service recording | `automations.js` |
| Keyboard use: skip link, focus held inside dialogs, errors announced, Escape closes dialogs | `css/base.css`, `js/core/ui.js`, `js/core/validate.js` |

## Partially implemented

| Feature | What is missing | Basis |
|---|---|---|
| Sign in | No passwords, no accounts, no multi factor authentication, no password reset, no session expiry | Verified |
| Access control | Only hides things in the interface. Anyone can read or change any record through the browser console or localStorage | Verified |
| Audit trail | Recorded in the browser, so it can be edited or erased. Deleting a client also erases that client's history (`store.js` line 368) | Verified |
| Clinical note locking | Enforced only by browser code, so it can be bypassed by editing localStorage | Verified |
| Documents | Only names, sizes and details are stored. No files, versions, checksums or downloads | Verified |
| Exports | One unlogged download of the whole dataset in Settings | Verified |
| Search and reporting | Run in the browser over all loaded data, with no paging | Verified |
| Staff management | Profiles only, no accounts, onboarding or offboarding | Verified |
| Notifications | On screen messages only. No reminders or email | Verified |

## Broken or defective

| Defect | Effect | Basis |
|---|---|---|
| Data is held separately in each browser | Harry and the client can't see each other's test records | Verified |
| Website contact details are kept in two places | `js/data/business.js` drives the website, but Settings edits a separate copy, so changes in Settings don't reach the website | Verified |
| Deleting a client is a hard delete of everything linked to it | Clinical records and history are removed outright, which is wrong for health records that must be kept | Verified |
| No duplicate client check | The same person can be added twice without a warning | Verified |
| Appointment times have no time zone | Times are stored as plain local date and time. NSW has daylight saving and Queensland doesn't, so summer appointments across the border are ambiguous | Verified |
| Changes in two tabs at the same moment | Each tab writes the whole dataset. If two tabs save within moments of each other, one tab's change can be lost | Verified by reading `store.js`; narrow timing window |
| Record ids are made in the browser | Fine for one browser, but not guaranteed unique once several people write to the same database | Verified |

## Missing features

Compared with the master plan, none of these exist yet (all verified):

* Supabase database, Row Level Security, private storage, Edge Functions, migrations
* Real sign in with passwords, multi factor authentication, password reset, inactivity timeout and session revocation
* Separate staging and production environments
* Shared error handling with reference codes, automatic error logging and developer tickets
* A developer dashboard, a **Report an issue** form, and staff feedback and feature requests
* A tamper resistant audit trail on the server, including logging when sensitive records are opened
* Document upload, versioning, integrity checks, retention and recovery
* A system administration area covering health, errors, backups, users and configuration
* Backups and tested recovery
* Notifications, scheduled reminders and background job history
* Controlled, logged exports and privacy request handling
* Paged search and reporting on the server
* Automated tests kept in the repository

## Security findings

| Finding | Risk now | Action | Basis |
|---|---|---|---|
| No secrets in the repository or its history | None | Keep `.env` ignored (done in Stage 0) and keep the service role key out of the frontend | Verified |
| The repository is public | Low. The code holds only fictional data, and a live website exposes its files anyway | Commit nothing but public configuration. The Supabase anon key is designed to be public when Row Level Security is in place | Verified |
| Anyone with the link can open the dashboard without a password | Low today because all data is fictional. Must not exist in production | Replaced by real sign in in Stage 2 | Verified |
| Access control is interface only | Low today, critical in production | Row Level Security and storage policies in Stage 1 | Verified |
| Cross site scripting | Low. Every template value goes through the escaping `AWY.html` tag. Each `raw()` call was reviewed and takes only static or escaped values | Keep the pattern. Add a Content Security Policy | Verified |
| No security headers or Content Security Policy | Medium for production | GitHub Pages can't set headers. Add a meta Content Security Policy now, and choose a production host that supports headers | Verified |
| Website forms have no spam or rate protection | None today. Needed once forms send to a database | Rate limit in the `submit_enquiry` function, plus a hidden spam trap field | Verified |
| Records are stored unencrypted in the browser | None with fictional data. Production must not keep clinical records in browser storage | The Supabase adapter keeps data in memory only | Verified |

## Backup and recovery findings

* There are no backups. Each browser's data can be reset to the sample records or downloaded by hand from Settings (verified).
* There is no Supabase project, so there are no backup settings to inspect (verified).
* Supabase's free plan does not include managed backups, so production will need a paid plan, and point in time recovery should be considered (assumed from Supabase's published plans; to be confirmed on the account).
* Database backups do not include uploaded files, so documents need their own backup arrangement (assumed from Supabase's documentation; to be confirmed in Stage 3).

## Data integrity findings

* Required fields are checked in the browser and again in `store.js`, but nothing on a server does so (verified).
* Double clicks are blocked by busy buttons, but nothing stops a retry from creating a second record after a lost response (verified).
* Invoice totals always come from their lines, and each delivered service keeps the rate in effect on its date (verified).
* The lack of time zones, duplicate checks and the hard delete are listed under defects above.

## Recommended changes

1. **Keep the screens and their API.** Add `js/data/remote.js`, which offers the same functions as `store.js` but uses Supabase. Views keep calling `AWY.store`.
2. **Enforce everything important in the database:**
   * Row Level Security on every table
   * note locking with triggers
   * automations, invoices and the audit trail with triggers and database functions, each in a single transaction
   * privileged work, such as invites and download links, in Edge Functions
3. **Split sensitive data.** Put health details in `client_health`, corrections in `note_amendments`, document versions in `document_versions` and access grants in `client_access`, so each can be protected separately.
4. **Store appointment times properly.** Use `starts_at` with a time zone of `Australia/Sydney` or `Australia/Brisbane`, and show each appointment in the client's local time with a NSW or QLD marker.
5. **Prevent duplicates on retry.** Give every created record a unique request id.
6. **Make clients archive only** in production, and keep audit records when a client is archived.
7. **Retire the browser demo** once the Supabase version passes the same journey. The fictional records move to `supabase/seed.sql`.
8. **Read business details from one place.**

## Prioritised implementation order

1. **Stage 0:** this audit, the implementation register and the automated tests in the repository.
2. **Stage 1:**
   * the staging database, security rules and private storage
   * sign in settings
   * the fictional seed data and test staff accounts
   * permission tests for every role
3. **Stage 2:**
   * connect the dashboard and website to staging
   * real sign in, multi factor authentication and session timeouts
   * time zones
   * database automations
   * retire the browser demo
4. **Stage 3:** backup and recovery plan, and a restore test.
5. **Stage 4:** shared error handling, error logging, developer tickets, Report an issue and staff feedback.
6. **Stage 5:** documents, versions and integrity, archive only clients, and a wider audit trail.
7. **Stage 6:** system administration, monitoring, notifications and scheduled jobs.
8. **Stage 7:** search, reporting, exports and privacy requests on the server.
9. **Stage 8:** integrations and AI assessment, privacy documentation and the production readiness report.

## Testing plan

* `npm test` in `tests/` runs on every stage:
  * syntax checks
  * link checks
  * the writing check
  * data integrity checks
  * the browser journey
  * every screen and dialog for every role
  * layout at 360, 768 and 1366 pixels wide
  * keyboard checks
* From Stage 1, permission tests sign in as each role and try to read and change records they shouldn't, including by changing ids in requests and asking storage for another client's files.
* From Stage 4, failure tests force failed saves and uploads, network drops, expired sessions, permission errors, repeated clicks and a logging outage, and confirm that no sensitive details reach the diagnostics.
* All testing uses fictional data only.

## Decisions that need input

Already decided by Harry on 14 October 2026:
* a new staging project in Sydney
* shared staging data with real logins on the test link
* therapists see only their assigned clients, and the owner can grant others
* appointments are shown in the client's local time

Still to decide, not blocking yet:
* **The production Supabase plan and point in time recovery.** This affects cost, needed before real data.
* **An email provider** for invites, password resets beyond Supabase's basic sender, and reminders.
* **The production domain and host,** which should be one that supports security headers.
* **Retention periods** for clinical records, logs and documents, confirmed against legal and professional advice.

# Operations

How the live site, the database and the supporting services fit together, and how to change them safely.

## Environments

| Environment | What it is | Address |
|---|---|---|
| Website | GitHub Pages, served from `main` of `harryrconway/alliedwithyou` | https://alliedwithyou.com.au |
| Production database | Supabase project "Allied With You", ref `trqnpgawtuglrujifvcz`, Sydney | https://trqnpgawtuglrujifvcz.supabase.co |
| Test database | Supabase project "Allied With You staging", ref `nndtedqltzavzxfegdka`, Sydney | https://nndtedqltzavzxfegdka.supabase.co |
| Email | cPanel mail on the existing host. noreply@ sends sign in and enquiry emails | mail.alliedwithyou.com.au |

The test database only ever holds fictional records and throwaway test accounts. Real staff and practice information goes only into production.

## Domain records

The domain's records are in the cPanel Zone Editor. The website points at GitHub Pages:

| Name | Type | Value |
|---|---|---|
| alliedwithyou.com.au | A | 185.199.108.153, 185.199.109.153, 185.199.110.153 and 185.199.111.153 |
| alliedwithyou.com.au | AAAA | 2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153 and 2606:50c0:8003::153 |
| www.alliedwithyou.com.au | CNAME | harryrconway.github.io |

The AAAA records were added on 20 Oct 2026, after the VentraIP health check flagged them as missing. Leave the mail records (MX, SPF, DKIM, autodiscover and the `mail` record) as they are until email moves to Microsoft 365.

## Secrets

Secrets live in two places only, and never in the repository:

* `.env` in the project folder on Harry's Mac. It's ignored by git and readable only by Harry's account. It holds the test database password, both projects' publishable and secret keys, and the noreply@ mailbox details.
* Supabase function secrets on each project, set with `supabase secrets set`. These are `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `ENQUIRY_TO`, `FORM_SALT`, `NOTIFY_SECRET`, `DASHBOARD_URL` and, on the test project only, `ALLOW_LOCAL` and `NOTIFY_REDIRECT`.
* Supabase Vault on each project holds `notify_url` and `notify_secret` for the scheduled alerts. `.env` keeps a copy of each project's notify secret. When setting them from a file with `--env-file`, put each value in single quotes. Unquoted values with special characters are changed on the way in, which broke the production mail password on release day. `supabase secrets list` shows a fingerprint of each value, so a stored value can be checked against `.env` without revealing it.

The publishable keys are safe to include in the website, because Row Level Security decides what each signed in person can see. The secret keys bypass those rules, so they must never appear in website code.

## Database changes

Every change is a file in `supabase/migrations/`, named with a timestamp, and is never edited after it has been applied anywhere. To change something, add a new migration.

Order of work:

1. Write the migration.
2. Apply it to the test project: `SUPABASE_DB_PASSWORD=... npx supabase db push --project-ref nndtedqltzavzxfegdka`
3. Run `npm test` in `tests/`. The `auth` check signs in as each kind of account and confirms the security rules.
4. Apply it to production. Production's database password isn't stored on this Mac, so migrations go through the Supabase management API with `npx supabase db query --linked --project-ref trqnpgawtuglrujifvcz -f <file>`. Wrap the file in `begin;` and `commit;`, and add the row recording its version in `supabase_migrations.schema_migrations` inside the same transaction, so a failure changes nothing.
5. Record it in the migrations table in `docs/register.md`.

Reverting website code doesn't undo database changes or bring back deleted records. A migration that removes or rewrites data needs its own written recovery step first.

## Sign in settings

`supabase/config.toml` declares only the sign in settings and email templates the practice needs. Anything it doesn't declare keeps Supabase's own default.

* Preview: `npx supabase config diff --project-ref <ref>`
* Apply: `npx supabase config push --project-ref <ref>` (it needs `SMTP_PASSWORD` in the environment)

The `[remotes.staging]` block points the test project's links at localhost, so test emails never send people to the live site.

## Email alerts

`supabase/functions/notify` sends the dashboard's alerts from noreply@:

* to every active administrator, when someone has created an account, confirmed their email and is waiting for approval
* to a staff member, 60, 30 and 7 days before one of their checks expires and once after it has, and the same reminders to administrators as one list

The database runs it every 15 minutes, through the `pg_cron` job named `notify`. The job reads the function's address and a shared secret from Supabase Vault (`notify_url` and `notify_secret`), and the function checks the secret against its own `NOTIFY_SECRET`. Each alert is recorded in the `notifications` table before it's sent, so it never goes twice, and a failed send is cleared to be tried again. On the test project, the `NOTIFY_REDIRECT` secret sends every alert to noreply@ instead.

The same function sends a weekly summary to administrators on Monday mornings, from 8am Queensland time, and checks every 15 minutes that the website, staff sign in and the enquiry form are answering. After two failures in a row it emails administrators and developers, and again when it's working. Results show under **Feedback and issues**, then **Errors and service checks**. Because these checks run inside Supabase, they can't report Supabase itself being down. A free outside monitor, such as UptimeRobot watching https://alliedwithyou.com.au/admin/, would cover that.

To pause the alerts, run `select cron.unschedule('notify');` in the SQL editor. The migration shows how to schedule it again. Recent runs are in `cron.job_run_details` and the function's replies in `net._http_response`.

## Edge Functions

`supabase/functions/enquiry` emails website enquiries and referrals to the practice. On the test project they go to noreply@ instead, so testing never emails the practice. The website forms in `js/site/forms.js` call it, and visitors who can't get through are offered the admin@ address. Deploy with:

`npx supabase functions deploy enquiry --project-ref <ref> --use-api --no-verify-jwt`

## Accounts

* admin@, jake@ and chelsie@alliedwithyou.com.au are listed in `signup_allowlist`. They become administrators only after being invited and accepting the invitation, which proves they own the mailbox.
* Anyone else who creates an account confirms their email and then waits in **Team and access** until an administrator approves or declines them. The database won't approve an account whose email hasn't been confirmed.
* There must always be at least one active administrator. The database refuses any change that would leave none.
* Staff who leave are switched off rather than deleted, so the history of who did what is kept. Switching off takes effect on their next request.
* Staff with a practice address can sign in with just the first part, for example `jake`.

### Two step sign in

Administrators must set up an authenticator app the first time they sign in, and enter a code each time after that. In **Settings**, **Two step sign in** can require it for everyone. Anyone can also turn it on from **Your account**.

The database enforces this. Until the code is entered, an administrator's session counts as not active, so a stolen password alone gets nothing.

If someone loses their phone, remove their authenticator in Supabase so they can set it up again at their next sign in. In the production project's dashboard, open **Authentication**, then **Users**, choose the person and remove their MFA factor. If that option isn't there, run this in the SQL editor with their email address: `delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'name@alliedwithyou.com.au');`

### Sending an invitation

In the Supabase dashboard for the production project, open **Authentication**, then **Users**, then **Invite user**, and enter the address. The email comes from noreply@ and links to https://alliedwithyou.com.au/admin/, where the person chooses their name and password. The link works for an hour. If it expires, send the invitation again.

If a reserved address shows as **Reserved practice address** in the approvals list, someone created an account with it before the invitation was sent. Delete that user in **Authentication**, **Users**, then send the invitation.

## Reports and downloads

**Reports and downloads** in the dashboard is for administrators. Reports read every record for the chosen period straight from the database, so they aren't limited to what the dashboard has loaded. Calendar figures use the time zone of the device, or the practice's usual time zone on a device set outside Australia.

**Download everything** saves one zip file with a spreadsheet for each area, the practice settings and every version of every template. It's the practice's own copy while the free plan has no backups, so it's worth saving one regularly somewhere private, such as the practice's Microsoft 365 storage once that's set up. Each download, from here or from a Download button beside a list, is noted in Change history under Downloads.

Spreadsheet text that starts like a formula, for example with an equals sign, gets an apostrophe in front, so Excel never treats typing in a task or note as a formula.

## Stored files

Template files live in the private `templates` storage bucket. Nobody can open a file directly. The dashboard asks for a link that works for two minutes, and the database only gives one for an approved template, or to an administrator. Files that became a version can't be deleted, so the history stays complete.

Files aren't included in database backups, even on a paid plan. Before anything important is stored only in the dashboard, arrange a separate copy, for example a regular download of the current templates.

The nine starter templates were loaded as drafts on 20 October 2026. They were written for the practice and need reviewing before approval, with agreements and contracts checked by a lawyer.

## Errors and feedback

Every failure in the dashboard shows the person a six character reference and is logged in `error_events` with only safe details: where it happened, what kind of failure, and a scrubbed message. Administrators and developers see these under **Feedback and issues**, then **Error reports**. When someone uses **Report an issue** straight after an error, the reference is attached, so the two can be matched.

## Tests

`npm test` in `tests/` runs every check. `auth`, `enquiry`, `notify` and `crm` use the test project's keys from `.env`, create throwaway `@example.com` accounts and remove them afterwards. They refuse to run if the test address matches production. `site` stands in for the enquiry function, so no email is sent. The browser checks (`text`, `site`, `crm`, `layout`) run under Chromium by default; set `BROWSER=firefox` or `BROWSER=webkit` to run them under another engine instead.

## The earlier demo

The interactive demo with fictional data was removed from the live site on 19 October 2026, and its files were deleted when the real dashboard replaced them. They can be recovered from commit `80da9d9` with `git show 80da9d9:<path>`, for example `git show 80da9d9:js/data/seed.js` or `git show 80da9d9:js/admin/views/notes.js`.

## Backups

The Supabase free plan has no managed backups. That's acceptable while the database holds only staff accounts, settings, tasks and calendar availability. It is not acceptable once client or clinical information is added. Before any sensitive section is switched on, upgrade production to a paid plan with daily backups, consider point in time recovery, arrange separate copies of any uploaded documents, and test a restore. This is tracked as Stage 3 in `docs/register.md`.

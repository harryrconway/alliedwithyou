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

## Secrets

Secrets live in two places only, and never in the repository:

* `.env` in the project folder on Harry's Mac. It's ignored by git and readable only by Harry's account. It holds the test database password, both projects' publishable and secret keys, and the noreply@ mailbox details.
* Supabase function secrets on each project, set with `supabase secrets set`. These are `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `ENQUIRY_TO`, `FORM_SALT` and, on the test project only, `ALLOW_LOCAL`.

The publishable keys are safe to include in the website, because Row Level Security decides what each signed in person can see. The secret keys bypass those rules, so they must never appear in website code.

## Database changes

Every change is a file in `supabase/migrations/`, named with a timestamp, and is never edited after it has been applied anywhere. To change something, add a new migration.

Order of work:

1. Write the migration.
2. Apply it to the test project: `SUPABASE_DB_PASSWORD=... npx supabase db push --project-ref nndtedqltzavzxfegdka`
3. Run `npm test` in `tests/`. The `auth` check signs in as each kind of account and confirms the security rules.
4. Apply it to production. Production's database password isn't stored on this Mac, so migrations go through the Supabase management API with `npx supabase db query --linked --project-ref trqnpgawtuglrujifvcz -f <file>`, followed by a row in `supabase_migrations.schema_migrations` recording the version.
5. Record it in the migrations table in `docs/register.md`.

Reverting website code doesn't undo database changes or bring back deleted records. A migration that removes or rewrites data needs its own written recovery step first.

## Sign in settings

`supabase/config.toml` declares only the sign in settings and email templates the practice needs. Anything it doesn't declare keeps Supabase's own default.

* Preview: `npx supabase config diff --project-ref <ref>`
* Apply: `npx supabase config push --project-ref <ref>` (it needs `SMTP_PASSWORD` in the environment)

The `[remotes.staging]` block points the test project's links at localhost, so test emails never send people to the live site.

## Edge Functions

`supabase/functions/enquiry` emails website enquiries and referrals to the practice. On the test project they go to noreply@ instead, so testing never emails the practice. Deploy with:

`npx supabase functions deploy enquiry --project-ref <ref> --use-api --no-verify-jwt`

## Accounts

* admin@, jake@ and chelsie@alliedwithyou.com.au are listed in `signup_allowlist`. They become administrators only after being invited and accepting the invitation, which proves they own the mailbox.
* Anyone else who creates an account confirms their email and then waits in **Team and access** until an administrator approves or declines them.
* There must always be at least one active administrator. The database refuses any change that would leave none.
* Staff who leave are disabled rather than deleted, so the history of who did what is kept.

## The earlier demo

The interactive demo with fictional data was removed from the live site on 19 October 2026. It can be recovered from commit `80da9d9` with `git show 80da9d9:<path>`, for example `git show 80da9d9:js/data/seed.js`.

## Backups

The Supabase free plan has no managed backups. That's acceptable while the database holds only staff accounts, settings, tasks and calendar availability. It is not acceptable once client or clinical information is added. Before any sensitive section is switched on, upgrade production to a paid plan with daily backups, consider point in time recovery, arrange separate copies of any uploaded documents, and test a restore. This is tracked as Stage 3 in `docs/register.md`.

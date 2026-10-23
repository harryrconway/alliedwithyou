# Allied With You

> **Under construction since 22 October 2026.** The public website shows `construction.html` in place of every page, and the staff dashboard works as normal. `docs/operations.md` has the steps to go live again.

Website and staff dashboard for Allied With You, an occupational therapy practice working in person across the Northern Rivers and the Gold Coast, and by telehealth anywhere in Australia.

The website is live at https://alliedwithyou.com.au. The staff dashboard lives at `/admin/` and runs on Supabase, with only the less sensitive sections switched on for now.

## How it fits together

* **Website:** plain HTML, CSS and JavaScript on GitHub Pages, published whenever `main` changes. The `CNAME` file sets the domain. Email stays with the existing cPanel host.
* **Enquiry and referral forms:** sent to a Supabase Edge Function, which emails them to admin@ through the noreply@ mailbox. Nothing from a form is stored.
* **Staff dashboard:** signs in with Supabase Auth and reads and writes through `js/data/remote.js`. Every table has Row Level Security, so what each person can see or change is decided by the database, not the screens.
* **Two Supabase projects, both in Sydney:** production for the live site, and a test project for development and the automated checks. `js/config.js` picks one by the address the page is opened from.

`docs/operations.md` covers the projects, secrets, database changes, invitations and approvals.

## The dashboard

Open sections: dashboard, calendar, tasks, templates, team and access (including each person's checks and registrations), settings and fees, reports and downloads, change history, and feedback and issues. Every other section is listed in the menu but greyed out until the practice is ready to keep that information in the dashboard.

* Staff create an account and confirm their email, then an administrator approves them. admin@, jake@ and chelsie@ are set up by invitation instead.
* The calendar shows when people are booked or away, never who with. Entries can be in any state or territory, for telehealth anywhere in Australia. The calendar is laid out in the device's own time, and each entry shows its state and its time there.
* Tasks and calendar notes must not include client details until client records are switched on.
* Any failure shows a short reference, and **Report an issue** sends it to the administrators with that reference attached.
* Templates are versioned: administrators upload a new version with a note on what changed, and every earlier version stays available.
* Checks and registrations record details and expiry dates only, never copies of documents.
* Administrators get an email when someone is waiting for approval, a weekly summary on Monday mornings, and an alert if the website, sign in or the enquiry form stops working. Staff get reminders before their checks expire.
* Feedback and reported issues are tracked as tickets, and administrators can see every change in Change history.
* Administrators have reports for any period and can download spreadsheets or one zip file of everything. Each download is noted in Change history.

## Running it locally

Run `python3 -m http.server` in this folder and open http://localhost:8000. Pages opened this way use the test project, never production.

## Tests

The checks live in `tests/`. The first time, run `npm install` and `npm run setup` there. After that, `npm test` runs everything:

* every script parses, and every link points at a real file
* the writing rules hold everywhere, including on screen, and no placeholder or demo wording appears on the website
* the database security rules hold for every role, using throwaway accounts on the test project
* the enquiry function refuses other websites, incomplete forms and spam
* the website forms send readable details and explain failures
* the dashboard works end to end in a browser: sign in, invitations, password reset, locked sections, tasks, calendar, approvals, fees, feedback and dropped connections
* the website search finds and opens sections and questions, from the keyboard too, and its index matches the pages
* email suggestions, forms that keep what's typed, the preferred therapist and how did you hear questions, the funding helper, words explained where they appear, and the text size and contrast choices all work
* every public page has a canonical address, share details, a sensible title and description, and the sitemap and structured data match the pages
* pages fit 360, 768 and 1366 pixel widths, the mobile menu fits on screen at every size and holds the page still, and the keyboard checks pass

After changing any public page, run `npm run build` there to rebuild the search index, the glossary list, the sitemap and the questions page's structured data. Run a single check with `npm test -- crm`. The database checks need the test project's keys in `.env`. The browser checks run under Chromium by default; set `BROWSER=firefox` or `BROWSER=webkit` to run them under another engine instead.

## Project documents

* `docs/audit.md`: the audit from 14 October 2026 of what existed and what the master plan needs.
* `docs/register.md`: the implementation register, updated at the end of every stage.
* `docs/operations.md`: how to run, change and recover the system.

## Folder map

```
index.html and the other public pages    the website
services/                                individual service pages
admin/index.html                         the staff dashboard
css/tokens.css                           colours, font, spacing and other design settings
css/base.css, components.css             shared styles
css/site.css, admin.css                  website and dashboard layouts
js/config.js                             which Supabase project to use, and public settings
js/vendor/                               supabase-js, copied unchanged
js/core/                                 icons, formatting, form checking, dialogs, error handling
js/data/                                 field definitions, business rules and the Supabase data layer
js/site/                                 website header, footer, menu, search, forms, funding helper and word explanations
js/admin/                                dashboard sign in, frame, routing and shared actions
js/admin/views/                          one file per dashboard screen
supabase/                                migrations, sign in settings, email templates, Edge Function
fonts/                                   Nunito Sans, the only font used
docs/                                    audit, register and operations notes
tests/                                   automated checks (npm test)
images/                                  logo, logomark, touch icon, share image for link previews
sitemap.xml, robots.txt                  for search engines (rebuilt by npm run seo)
```

## Where to change things

* Colours and the font: `css/tokens.css`
* Contact details shown on the website: `js/data/business.js`
* Website navigation, mobile menu and footer: `js/site/layout.js`
* Website search, and the everyday words that lead to each page: `js/site/search.js`
* Explanations of words like plan managed: `glossary.html`, then `npm run build`
* Email providers suggested in forms: `DOMAINS` in `js/site/forms.js`
* Fields, options and statuses in the dashboard: `js/data/schema.js`
* Which sections are switched on, and what each role can do: `js/admin/access.js`, plus the matching rules in a new migration
* Practice details, services and fees: the dashboard's Settings screen

## Still to come

* Jake's and Chelsie's qualifications, photos and Ahpra registration numbers on the About page.
* Before any client information goes in: backups on a paid Supabase plan with a tested restore, multi factor sign in required for everyone, private document storage, and a review against the Privacy Act 1988, the Health Records and Information Privacy Act 2002 (NSW), Queensland requirements and NDIS obligations.
* The remaining stages are listed in `docs/audit.md` and tracked in `docs/register.md`.

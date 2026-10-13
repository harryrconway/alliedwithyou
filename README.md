# Allied With You

Website and practice dashboard for Allied With You, an occupational therapy practice working across the Northern Rivers and the Gold Coast.

This is the testing version. Everything in the dashboard is fictional, nothing is sent anywhere, and there is no backend yet.

## Opening it

* Double click `index.html` to open the website. The dashboard is `admin/index.html`, or use **Practice login** in the website footer.
* To see a test enquiry travel from the website into the dashboard, serve the folder instead of double clicking. Use the Live Server extension in VS Code, or run `python3 -m http.server` in this folder and open http://localhost:8000.
* The live testing site is published with GitHub Pages at https://harryrconway.github.io/alliedwithyou/ and updates whenever changes are pushed to `main`. Every page has `noindex` set while it's in testing.
* `404.html` uses paths starting with `/alliedwithyou/` because of where GitHub Pages serves the site. If the site moves to its own domain, change those paths to start with `/`.

## Demo data

* The dashboard starts with fictional clients, appointments, notes, invoices and so on. Dates are worked out from the day the data is first loaded, so the calendar always has recent and upcoming sessions.
* Changes are saved in the browser only. **Reset demo data** (top of the dashboard, or in Settings) puts everything back.
* Choose who to sign in as on the entry screen, or switch person from the top bar, to see the different access levels.
* Phone numbers come from the ranges the ACMA reserves for fiction, and email addresses use example domains.

## Folder map

```
index.html and the other public pages    the website
services/                                individual service pages
admin/index.html                         the practice dashboard
css/tokens.css                           colours, font, spacing and other design settings
css/base.css, components.css             shared styles
css/site.css, admin.css                  website and dashboard layouts
js/core/                                 icons, formatting, form checking, dialogs
js/data/                                 the demo data layer
js/site/                                 website header, footer and forms
js/admin/                                dashboard frame, routing and shared actions
js/admin/views/                          one file per dashboard screen
fonts/                                   Nunito Sans, the only font used
images/                                  logo, logomark, hero photo
```

## Where to change things

* Colours and the font: `css/tokens.css`
* Contact details shown on the website: `js/data/business.js`
* Website navigation and footer: `js/site/layout.js`
* Fields, statuses and labels for every record type: `js/data/schema.js`
* Dashboard figures, totals and overdue rules: `js/data/rules.js`
* Automations: `js/data/automations.js` (each one can also be switched off in Settings)
* Sample records: `js/data/seed.js`
* What each role can see: `js/admin/access.js`

## To confirm with the business

Anything shown with a **To confirm** tag on the website is a placeholder. Before launch, confirm:

* Therapist name, photo, qualifications, experience, AHPRA registration, Occupational Therapy Australia membership and Medicare provider number
* Phone, email, hours, ABN, postal address, exact service area and reply times
* NDIS registration status, and the wording on the NDIS page, fees page and FAQs that depends on it
* Which services are offered, and which age groups are seen
* Fees, cancellation terms, payment methods, bank details and invoice timing
* Whether there is a clinic space, and its access details
* Acknowledgement of Country wording
* Privacy policy, complaints process and contact details for the external bodies listed
* Clinical note, assessment and report templates, reviewed and approved by the therapist
* Service agreement templates
* NDIS support item codes and price limits, checked against the current NDIS Pricing Arrangements and Price Limits

## Before going live

The dashboard is built so its data layer can be swapped for a real database without rebuilding the screens. `js/data/store.js` exposes `list`, `get`, `create`, `update`, `remove` and `snapshot`, and each table in `js/data/schema.js` maps to a table in the planned Supabase database. Before any real client information goes in:

* Replace the passwordless demo entry with proper sign in, secure account recovery and multi factor authentication
* Enforce access on the server with row level security and server side checks. `js/admin/access.js` only hides things in the interface
* Store documents privately, with controlled and logged downloads
* Keep the change history on the server where it can't be edited, and lock finalised notes at the database level
* Choose an Australian hosting region, set up backups and test restoring them, and write a data breach plan
* Keep identifiable information out of analytics, logs and ordinary email
* Review privacy, consent, retention and incident processes against the Privacy Act 1988, the Health Records and Information Privacy Act 2002 (NSW), Queensland requirements, professional obligations and NDIS requirements
* Remove the testing notices and `noindex` tags, and replace every placeholder

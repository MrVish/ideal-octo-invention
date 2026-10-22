# Employee Lifecycle

An HR tool for employees placed at client companies. It covers the **onboarding checklist**, **client entry and exit communication** (billing start and stop dates, client ID deactivation) and **client-issued asset tracking**. It supports multiple clients, and **Intuit** is set up as the baseline.

## What it does

| Area | Who | What |
|---|---|---|
| **HR dashboard** (`/`) | HR | Every open action item across clients, ranked by severity, plus upcoming exits |
| **Placements** (`/placements`) | HR | One record per employee per client: BGC status, checklist, entry and exit emails, client ID, dates |
| **Employee portal** (`/portal`) | Employee | Tick off acknowledgements and trainings, log assets received from the client, enter LWD, see the asset SPOC |
| **Asset tracker** (`/assets`) | HR | Every client asset, who holds it, LWD, SPOC, returned or not |
| **Clients** (`/clients`) | HR | Per-client checklist, locations and asset SPOCs, client contacts, escalation list, reminder rules |
| **Reminders** (`/reminders`, `/api/cron/reminders`) | Automated | Nudges whoever has to act, with the client's escalation list (e.g. Veena, Honey, Raveen) in copy |

### Lifecycle rules (`src/lib/lifecycle.ts`)

- **Onboarding is complete** when every required onboarding step is done, the **BGC is green** and the **entry email** (onboarding + billing start date) has been sent.
- **Assets:** if the client tracks assets, the employee must log them within the grace period after starting (default 3 days). Each location must have a named SPOC.
- **Offboarding** starts when an LWD is entered (by the employee or HR). The billing stop date defaults to the LWD. The **exit email** is due N days before the LWD (default 7). After the LWD, **client ID deactivation** must be confirmed, and all assets must be marked returned before the placement can be closed.
- Reminders are sent for warning and critical items only, at most once per issue per reminder interval (default 2 days).

### Intuit baseline

The baseline checklist (`src/lib/baseline.ts`):
- Onboarding (employee): WFH acknowledgement, Exhibit A telecommuter policy, Exhibit A remote access policy, Infosec training
- Onboarding (tracked field): BGC must be green
- Offboarding: return client assets (employee), asset return confirmed by SPOC (HR)

A new client can copy Intuit's checklist (or any other client's) and then change it. Existing placements keep their own copy of the checklist, so later template edits don't rewrite history.

## Running locally

```bash
cp .env.example .env
npm install
npm run setup     # create the SQLite DB and seed Intuit + sample data
npm run dev       # http://localhost:3000
npm test          # unit tests for lifecycle rules, reminders, email drafts
```

Use **"Viewing as"** in the header to switch between the HR view and an employee's portal.

## Not production-ready yet

- **Sign-in:** the "Viewing as" switcher is a demo stand-in. Replace it with company SSO (e.g. Microsoft Entra ID) before real use.
- **Email delivery:** entry and exit emails are drafted, then opened in the mail app and marked sent. Reminders are only logged (`logOnlyMailer` in `src/lib/reminders.ts`). Plug in Microsoft Graph or SMTP to send them.
- **Database:** SQLite for development. For production, set `provider = "postgresql"` in `prisma/schema.prisma` and point `DATABASE_URL` at Postgres.
- **Scheduling:** call `GET /api/cron/reminders` daily with `Authorization: Bearer $CRON_SECRET`.
- Seeded contacts are placeholders. The Bangalore SPOC for Intuit is still to be provided by Honey.

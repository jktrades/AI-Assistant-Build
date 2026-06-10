# Personal OS

Your own AI-native operating system — a personal dashboard with a voice-capture
pipeline, an AI-ranked CRM, habit / nutrition / goals / calendar cards, a
finance card that reads a messy Google Sheet, and a semantic "brain" you can ask
questions of in natural language.

Built from the **Personal OS Build Cheat Sheet** (Miles Deutscher / AI Edge),
using the guide's default stack:

| Layer        | Choice                                   |
| ------------ | ---------------------------------------- |
| Framework    | Next.js 15 (App Router, TypeScript)      |
| Database     | Supabase (Postgres + pgvector)           |
| LLM          | Anthropic Claude (primary) + OpenAI (fallback / Whisper / embeddings) |
| Hosting      | Vercel (+ cron)                          |
| Capture      | Telegram bot + web capture box           |

## What's in the box

- **Capture pipeline** (`/api/capture`, `/api/telegram/webhook`) — voice →
  Whisper → Claude classifier → routed to the right table → embedded to memory →
  audited. Identical pipeline for the Telegram bot and the floating web box.
- **Seven home cards** — Operator, Session, Finance Pulse, Key Blockers, Habit
  Tracker, Priorities, Nutrition — plus Calendar and Goals.
- **CRM** (`/crm`) — four urgency tiers, Kanban / Smart (NL search) / Category
  views, drag-drop between tiers, click-to-edit drawer.
- **Brain** (`/brain`) — semantic search over `memory_chunks` + an "ask my OS"
  RAG endpoint that streams a cited answer.
- **Finance Pulse** — Google service-account → XLSX export → Claude extracts net
  worth + categories. Page loads never trigger the AI; only the ↻ button or the
  daily cron do.
- **Health** (`/health`) — 30-day calorie log. **Journal** (`/journal`) — daily
  entries (voice journal routes here automatically).
- **Demo mode** — top-rail toggle swaps every card to fake-but-realistic data.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in the values (see Appendix B in the guide)
npm run dev                  # http://localhost:3000
```

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Database → Extensions → enable **vector**.
3. Run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   in the SQL editor (creates tables, the ivfflat index, RLS deny-all, and the
   `match_memory_chunks` RPC).
4. Copy the Project URL, anon key, and service-role key into `.env.local`.

### 2. Keys

- `ANTHROPIC_API_KEY` from console.anthropic.com
- `OPENAI_API_KEY` from platform.openai.com (Whisper + embeddings + fallback)
- `AUTH_SECRET` = `openssl rand -hex 32`, `DASHBOARD_PASSWORD` = anything memorable
- `API_SECRET` / `CRON_SECRET` = `openssl rand -hex 32`

### 3. Telegram (optional but recommended)

1. `@BotFather` → `/newbot` → save the token into `TELEGRAM_BOT_TOKEN`.
2. `TELEGRAM_WEBHOOK_SECRET` = `openssl rand -hex 16`.
3. `@userinfobot` → numeric id into `TELEGRAM_USER_ID` (bot only listens to you).
4. After deploying, register the webhook:
   ```bash
   APP_URL=https://your-app.vercel.app \
   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... \
   ./scripts/register-telegram-webhook.sh
   ```

### 4. Calendar & Finance (optional)

- **Calendar**: paste your Google Calendar *secret iCal URL* into
  `GOOGLE_CALENDAR_ICAL_URL` (no OAuth needed).
- **Finance**: create a Google Cloud service account, enable the Drive + Sheets
  APIs, share your finance sheet with the service-account email (Viewer), and set
  `GOOGLE_SHEETS_FINANCE_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`,
  `GOOGLE_SERVICE_ACCOUNT_KEY` (the `private_key` field). Never use "publish to
  web" — the service account keeps the sheet fully private.

## Deploy

```bash
npm i -g vercel
vercel link
vercel --prod
# push every env var from .env.example (see the guide's Appendix B), then:
./scripts/register-telegram-webhook.sh
```

`vercel.json` registers the daily 5am UTC finance-snapshot cron. The cron route
verifies the `Authorization: Bearer ${CRON_SECRET}` header Vercel sends.

## Personalise

Edit [`src/lib/config.ts`](src/lib/config.ts): your operator details, the six
habit names, urgency tiers. Set `USER_TIMEZONE` so daily rollovers happen at
*your* midnight, not UTC (Part 8, bug #2).

## Architecture notes (from the guide's bug list)

- **iCal** uses `ical.js`, never `node-ical` (avoids the Vercel BigInt crash).
- **Daily rollover** uses `localDateKey()` — the user's clock on the client, the
  configured timezone on the server.
- **Optimistic writes** keep a `dirtyRef` so a slow mount-time GET can't clobber
  a fresh local edit.
- **Stale PostgREST reads** are busted with a per-request unique `.limit(...)`.
- **Finance** page loads read the cached snapshot only — the AI pipeline runs
  exclusively on manual refresh or cron, so page views never burn API budget.

## Scripts

- `npm run dev` / `build` / `start`
- `npm run typecheck` — `tsc --noEmit`

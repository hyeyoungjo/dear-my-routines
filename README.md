# Dear My Routines

A personal time-tracking web app for measuring **estimated vs. actual** time — built to correct the chronic habit of under-predicting how long things take.

Plan your day in the morning → record what actually happened → get a daily AI review that spots your patterns over time.

> **Status:** the hosted version has been shut down. The code is open source (MIT), so you can run your own copy with a free Supabase project. See [Run it yourself](#run-it-yourself).

---

## Screenshots

### Desktop — Plan · Act · Review (light mode)

![Desktop overview, light mode](public/screenshots/main-light.png)

### Desktop — dark mode

![Desktop overview, dark mode](public/screenshots/main-dark.png)

### Mobile — Act tab

![Mobile Act view](public/screenshots/mobile-act.png)

---

## How it works

The day is divided into three moments:

| Column | When | What you do |
|--------|------|-------------|
| **Plan** | Morning | Brain-dump tasks, assign them to time slots, enter your *estimated* duration |
| **Act** | During the day | Drag blocks to reorder, resize to adjust time, add new tasks as they appear |
| **Review** | Evening | Write a short journal → hit **Analyze with AI** for a daily pattern report |

**Plan and Act share the same time axis**, so over-runs are immediately visible — a block that was planned for 1 h but took 1.5 h is taller on the right side than the left.

### Key features

- **Estimated vs. actual comparison** — plan blocks and action blocks sit side-by-side on a shared vertical time scale, making time debt visible at a glance.
- **Ghost blocks** — an unacted plan appears as a faint dashed outline in the Act column. Click to confirm it, or dismiss to carry it to the next day.
- **Carry-over tracking** — tasks that get pushed repeatedly earn a quiet badge (·2, ·3 …) that turns amber at 4+ carries, signaling it might be a project in disguise.
- **Continue tomorrow** — hit the ↻ button on an Act block to mark it partial: the block gets a dashed bottom edge and tomorrow's plan is created automatically at the same time slot.
- **Ongoing highlight** — the block currently spanning *now* gets a colored ring so you always know what you're supposed to be doing.
- **Daily AI review** — your journal + today's and past time data feed into a structured AI analysis: pattern summary, est → actual ratios per task with **continues tomorrow** and **deferred** badges, and concrete suggestions.
- **Task detail modal** — double-click any block to open its detail card: edit title, notes, category, project, move the Originally / Done dates, and see today's planned vs. actual times at a glance.
- **Multi-line task titles** — press Enter while editing a block title to add a line break; Shift+Enter saves and exits.
- **Project color coding** — tasks inherit their project's color. The legend at the top lets you quickly read which project each block belongs to.
- **Dark / light / system themes + font choice** — switchable from the settings panel (⚙).
- **Mobile-responsive** — three tabs (Plan · Act · Review) replace the side-by-side layout on small screens.

---

## Stack

- **Next.js 15** (App Router) + **TypeScript** (strict)
- **Tailwind CSS** + shadcn/ui
- **dnd-kit** + Framer Motion for block interactions
- **TanStack Query** with optimistic updates (the UI never waits on the server)
- **Supabase** — Postgres + magic-link auth + RLS
- **Drizzle ORM**
- **Vercel AI SDK** — model-agnostic (OpenAI / Gemini swappable)
- **Railway** (hosting), **Vitest** (tests)

---

## Run it yourself

1. Create a [Supabase](https://supabase.com) project and enable email auth (Google OAuth is optional).
2. Copy `.env.example` to `.env` and fill in the Supabase URL, publishable key, database password, and a Gemini API key. `RESEND_API_KEY` is only needed for feedback and announcement emails.
3. Apply the database schema (tables and RLS policies):

   ```bash
   npm install
   npx drizzle-kit migrate
   ```

   `drizzle.config.ts` points at the Supabase `us-west-2` session pooler. Change `host` if your project is in another region.
4. Sign-up is invite-only. Add your email to the allowlist in the Supabase SQL editor:

   ```sql
   insert into allowed_emails (email, role) values ('you@example.com', 'admin');
   ```

5. Run it:

   ```bash
   npm run dev     # development server  →  http://localhost:3000
   npm run build   # production build
   npm run test    # Vitest unit tests
   npm run lint    # ESLint
   ```

`railway.toml` is kept for reference if you want to deploy to Railway.

---

## Architecture notes

- All AI calls go through the Vercel AI SDK — never call provider SDKs directly (keeps the model swappable).
- Every DB table has a `user_id` with RLS enabled — safe for direct client queries.
- Business logic (time math, statistics, carry-over, AI prompt construction) lives in `src/core/` as pure functions, separate from UI.
- Server Components by default; `'use client'` only where interaction is needed.

See [`docs/ADR.md`](docs/ADR.md) for architectural decisions and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full structure.

---

## License

[MIT](LICENSE)

---

## Korean version

[한국어 README →](README.ko.md)

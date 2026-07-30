# TrainingTrack

SaaS platform for running coaches and independent athletes.

<p align="center">
  <img src="./public/img/logo_192.png" alt="TrainingTrack Logo" width="120" />
</p>

<p align="center">
  <a href="https://reactjs.org/"><img src="https://img.shields.io/badge/React-19-blue.svg" alt="React" /></a>
  <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite-7-646CFF.svg" alt="Vite" /></a>
  <a href="https://supabase.com/"><img src="https://img.shields.io/badge/Supabase-Latest-3ECF8E.svg" alt="Supabase" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg" alt="Tailwind CSS" /></a>
  <a href="https://vercel.com/"><img src="https://img.shields.io/badge/Vercel-Deployed-black.svg" alt="Vercel" /></a>
  <img src="https://img.shields.io/badge/License-Proprietary-red.svg" alt="License" />
</p>

<p align="center">
  <a href="https://trainingtrack.es">Live App</a> · <a href="https://github.com/aam9063/trainingtrack/issues">Report a Bug</a>
</p>

---

## Table of Contents

- [What is TrainingTrack](#what-is-trainingtrack)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Edge Functions](#edge-functions)
- [Database Overview](#database-overview)
- [Deployment](#deployment)
- [Development Notes](#development-notes)
- [License](#license)

---

## What is TrainingTrack

TrainingTrack has two audiences:

- **Coaches** — a dashboard to manage a roster of athletes: assign weekly trainings, build
  multi-phase plans, track competitions, message athletes, review Strava activity, and read
  AI-generated performance reports.
- **Independent athletes** — a self-service mode (no coach required) with an AI-generated
  training plan, an AI training assistant, competition tracking, and gamification.

Both roles share the same authenticated app; role and plan (`free` / `premium`) are resolved at
login and gate which routes and features are available.

---

## Features

### Coach Dashboard
- Weekly agenda: sessions grouped by title/type across all athletes, with per-athlete drill-down
- Calendar with drag-and-drop (`@dnd-kit`); sessions and competitions shown as grouped pills
- Athlete roster management, athlete profile and metrics views
- Competition creation for multiple athletes in a single operation
- Team health overview (`TeamHealthTable`, `useTeamHealth`)
- AI performance reports per athlete, generated on demand or on a weekly schedule

### Planning
- Multi-phase training plans with mesocycles (base, build, peak, taper, recovery) and weekly
  microcycles
- Weekly plan editor: 7-day grid, free-text per day, auto-calculated weekly volume
- Plan assignment to multiple athletes from a start date, generating `training_sessions` rows
- Periodization manager and reusable week/mesocycle templates
- Gym file uploads (PDF, 10 MB max, 14-day auto-expiry) shared with assigned athletes

### Exercise Library
- Shared running and gym exercise banks, browsable by both coach and athlete (`/library` routes)

### Metrics & Testing
- Interactive charts (Chart.js) for pace, volume, and training load
- Conconi and VAM field-test modals with CSV/XLSX import (`exceljs` + `papaparse`) to derive
  pace/heart-rate series
- RPE logging, readiness score, PMC (performance management chart), HR zone breakdown, race
  time predictions
- AI-assisted metric chart analysis (`analyze-metric-chart` Edge Function)

### AI Features
All AI features call Google's Gemini API (`gemini-2.5-flash`) from Supabase Edge Functions —
not DeepSeek, despite what older internal notes may say:
- **AI training plan generation**: onboarding wizard collects athlete profile data, an Edge
  Function generates a structured plan, the coach (or independent athlete) reviews before saving
- **AI weekly/on-demand reports** per athlete
- **AI chat**: an assistant with access to the athlete's training context (coach-managed and
  independent-athlete variants)

### Independent Athlete Mode
- Self-service AI training plan (`MyPlan`) with no coach relationship required
- Own competitions list, AI training assistant, gamification elements

### Strava Integration
- OAuth-linked devices; a proxy Edge Function fetches Strava data server-side so access tokens
  never reach the browser
- Activity stream fetch (GPS/HR/pace series) and a webhook that auto-completes matching
  `training_sessions`
- Route maps rendered from Strava polylines via **Mapbox GL** (`useMapbox` hook) on activity
  detail pages

### Billing (Stripe)
- Plan selection, hosted Checkout, and Customer Portal via `stripe-checkout` / `stripe-portal`
  Edge Functions
- Subscription state surfaced in the coach's account settings (`useSubscription`,
  `subscriptionService.js`)
- Account deletion (GDPR-style) cancels any active subscription, purges storage objects, and
  logs an audit row before removing the user

### Messaging & Notifications
- Real-time coach-athlete chat via Supabase Realtime
- PWA with a custom service worker (`src/sw.js`, Workbox `injectManifest`) and Web Push
  notifications (VAPID); DB triggers on sessions/messages/competitions fire pushes automatically
- Transactional email (password reset, notifications) via Resend, sent from the `send-email`
  Edge Function using shared templates

### PDF & Data Export
- Themed PDF documents (weekly plans, AI reports) built with the **pdfx** component library
  (`src/components/pdfx/`, `@react-pdf/renderer`) — see `pdfx.json` and `CLAUDE.md` at the repo
  root for the component reference
- Ad-hoc report exports via `jspdf` + `jspdf-autotable` (`src/lib/reportPdfExport.js`)

### Other
- Public marketing site: landing page, pricing, use cases, blog, legal pages
- Admin panel: user management, subscription/plan overrides, waitlist review
- Dark/light mode (`ThemeContext`), error tracking (Sentry), toast notifications (`sileo`)

---

## Tech Stack

### Frontend

| Library | Purpose |
| --- | --- |
| [React](https://reactjs.org/) 19 | UI — functional components and hooks |
| [Vite](https://vitejs.dev/) 7 | Build tool with HMR |
| [React Router](https://reactrouter.com/) 7 | Client-side routing, lazy-loaded routes |
| [Tailwind CSS](https://tailwindcss.com/) 3.4 | Utility-first styling |
| [Framer Motion](https://www.framer.com/motion/) / [GSAP](https://gsap.com/) | Animations (Framer Motion is the default; GSAP powers a few effect components) |
| [Chart.js](https://www.chartjs.org/) + react-chartjs-2 | Metric and performance charts |
| [Mapbox GL](https://docs.mapbox.com/mapbox-gl-js/) + Leaflet/react-leaflet | Route maps from Strava polylines |
| [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) | Form state and validation (auth flows) |
| [@dnd-kit](https://dndkit.com/) | Drag-and-drop calendar |
| [@react-pdf/renderer](https://react-pdf.org/) (via `pdfx`) + jsPDF/jspdf-autotable | PDF generation |
| exceljs + papaparse | XLSX/CSV parsing for field-test imports |
| react-easy-crop | Profile image cropping |
| sileo | Toast notifications |
| [Sentry](https://sentry.io/) | Error tracking |
| Workbox / vite-plugin-pwa | PWA / service worker |

### Backend

| Service | Purpose |
| --- | --- |
| [Supabase](https://supabase.com/) | PostgreSQL, Auth, Storage, Realtime, Edge Functions |
| [Supabase Edge Functions](https://supabase.com/docs/guides/functions) | Serverless Deno functions |
| [Google Gemini API](https://ai.google.dev/) | LLM for AI plan generation, reports, chat, and metric analysis |
| [Strava API](https://developers.strava.com/) | Activity data, OAuth, webhook |
| [Stripe](https://stripe.com/) | Checkout, billing portal, subscription webhooks |
| [Resend](https://resend.com/) | Transactional email |

---

## Project Structure

```
Frontend/
├── public/                     # Static assets, manifest.json, robots.txt, sitemap.xml
├── src/
│   ├── components/
│   │   ├── landing/             # Public marketing site components
│   │   ├── dashboard/           # Coach dashboard components (modals, planning wizard, tests)
│   │   ├── athlete/             # Athlete area components (charts, onboarding, reports)
│   │   ├── admin/                # Admin panel components
│   │   ├── calendar/             # Drag-and-drop weekly calendar view
│   │   ├── library/               # Exercise library modals/components (shared coach+athlete)
│   │   ├── auth/ · register/      # Auth and signup flow components
│   │   ├── shared/                 # Small components shared across areas (e.g. ACWRGauge)
│   │   ├── common/                # Cross-app components (image crop, PWA prompt, Strava map)
│   │   └── pdfx/                  # PDF component library (React components → @react-pdf/renderer)
│   │
│   ├── contexts/
│   │   ├── AuthContext.jsx        # Auth session, profile, role/plan resolution
│   │   ├── ThemeContext.jsx       # Dark / light mode
│   │   └── NotificationContext.jsx # Push state, active chat partner
│   │
│   ├── hooks/                    # One hook per data/UI concern (dashboard, calendar, metrics,
│   │                              Strava, AI quota, forms, Mapbox, subscription, etc.)
│   │
│   ├── layouts/
│   │   ├── DashboardLayout.jsx        # Coach route guard + shell
│   │   ├── AthleteDashboardLayout.jsx # Athlete route guard + shell
│   │   └── AdminLayout.jsx            # Admin route guard + shell
│   │
│   ├── pages/
│   │   ├── Landing.jsx, PricingPage.jsx, UseCases.jsx, PrivacyPolicy.jsx, ...
│   │   ├── blog/                # Public blog (list + article pages)
│   │   ├── dashboard/           # Coach pages (Dashboard, Athletes, Planning, Library, ...)
│   │   ├── athlete/             # Athlete pages (Training, MyPlan, Competitions, ...)
│   │   └── admin/               # Admin pages (Users, Waitlist, ...)
│   │
│   ├── services/                # All Supabase queries — one file per domain
│   │                              (athlete, coach, planning, gamification, Strava, Stripe
│   │                               subscriptions, conconi tests, exercise library, ...)
│   │
│   ├── lib/
│   │   ├── supabase.js          # Supabase client
│   │   ├── dateUtils.js         # toLocalDateStr() and other date helpers
│   │   ├── pdfExport.js / reportPdfExport.js # PDF generation entry points
│   │   ├── pdfx-theme.ts        # Theme consumed by src/components/pdfx
│   │   ├── pdf/                 # Standalone @react-pdf/renderer documents (plans, reports)
│   │   ├── pushNotifications.js # Web Push subscribe/unsubscribe
│   │   └── toast.js             # Toast helpers (sileo)
│   │
│   ├── utils/                   # (reserved; currently empty)
│   ├── sw.js                    # Custom service worker (Workbox injectManifest)
│   ├── App.jsx                  # Router and lazy-loaded routes
│   └── main.jsx                 # React entry point
│
├── supabase/                    # SQL migrations, RLS policies, seeds, Edge Functions
├── react-email-starter/         # Standalone project for authoring Resend email templates
├── .env.example                 # Environment variable template
├── vite.config.js, tailwind.config.js, eslint.config.js, tsconfig.json
├── components.json, pdfx.json   # Registries for shadcn-style and pdfx component CLIs
└── package.json
```

> Note: this is a mostly-JS(X) codebase; TypeScript is used only for the `pdfx` component
> library and the standalone documents in `src/lib/pdf/`.

### Route Map

```
/                                — Landing page (public)
/login · /register
/forgot-password · /reset-password
/casos-de-uso · /privacidad · /terminos-y-condiciones
/blog · /blog/:slug
/pricing · /select-plan · /checkout/success
/auth/callback

/dashboard                       — Coach area (protected)
/dashboard/athletes
/dashboard/athletes/:athleteId
/dashboard/athletes/:athleteId/metrics
/dashboard/athletes/:athleteId/activity/:activityId
/dashboard/planning
/dashboard/library
/dashboard/metrics
/dashboard/calendar
/dashboard/profile
/dashboard/messages
/dashboard/ai-reports

/athlete/dashboard               — Athlete area (protected)
/athlete/training · /athlete/calendar · /athlete/metrics
/athlete/devices · /athlete/messages · /athlete/gym-files
/athlete/library · /athlete/my-reports · /athlete/analysis-history
/athlete/activity/:activityId
/athlete/my-plan · /athlete/my-plan/activity/:activityId       — independent athlete only
/athlete/competitions · /athlete/ai-assistant                  — independent athlete only

/admin/login                     — Admin login (public)
/admin                           — Admin panel (protected)
/admin/users · /admin/users/:userId
/admin/waitlist
```

---

## Getting Started

### Prerequisites

- **Node.js** >= 18, **npm** >= 9
- A [Supabase](https://supabase.com/) project (free tier is sufficient for development)
- (Optional) Google Gemini API key, Strava API credentials, Stripe test keys, Resend API key —
  needed only if you're working on those specific features

### Install

```bash
git clone <repo-url>
cd TrainingTrack/Frontend
npm install
```

### Run in Development

```bash
npm run dev
```

The app is available at `http://localhost:5173`.

### Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start development server with HMR |
| `npm run build` | Production build to `/dist` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

---

## Environment Variables

Create a `.env` file in `Frontend/` based on `.env.example`:

```env
# Supabase (required)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Optional: Google OAuth Client ID (if using Google login)
# VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

The client code also reads these variables (not currently listed in `.env.example` — add them if
you're working on the corresponding feature):

```env
VITE_VAPID_PUBLIC_KEY=...     # required for Web Push subscriptions
VITE_GA_TRACKING_ID=G-XXXXXXXXXX   # optional, Google Analytics
VITE_SENTRY_DSN=https://...        # optional, error tracking
```

Do not commit `.env` to version control — it is listed in `.gitignore`.

### Supabase Edge Function Secrets

Set these via the Supabase Dashboard (Settings → Edge Functions → Secrets) or the CLI:

```bash
supabase secrets set GEMMA4_API_KEY=...          # Gemini API key (AI features)
supabase secrets set STRAVA_CLIENT_ID=...
supabase secrets set STRAVA_CLIENT_SECRET=...
supabase secrets set STRIPE_SECRET_KEY=...
supabase secrets set STRIPE_WEBHOOK_SECRET=...
supabase secrets set RESEND_API_KEY=...
supabase secrets set VAPID_PUBLIC_KEY=...
supabase secrets set VAPID_PRIVATE_KEY=...
supabase secrets set VAPID_SUBJECT=mailto:...
```

---

## Edge Functions

Edge Functions live in `supabase/functions/` and are written in Deno, deployed to the Supabase
project (`lusirdkixfliydimemre`).

| Function | Purpose |
| --- | --- |
| `admin-api` | Admin operations, protected by the service role |
| `generate-ai-plan` | Generates a training plan from athlete profile data (Gemini) |
| `generate-ai-report` | Generates a single-athlete performance report (Gemini) |
| `weekly-ai-reports` | Scheduled job that runs reports for all athletes weekly (Gemini) |
| `list-ai-reports` | Lists previously generated AI reports |
| `athlete-ai-chat` | AI assistant chat endpoint with training context (Gemini) |
| `analyze-metric-chart` | AI-assisted analysis of a metric chart (Gemini) |
| `strava-proxy` | Proxies Strava API calls so access tokens stay server-side |
| `strava-fetch-streams` | Fetches GPS/HR/pace streams for a Strava activity |
| `strava-webhook` | Receives Strava activity events, auto-completes matching sessions |
| `stripe-checkout` | Creates a Stripe Checkout session for plan purchase |
| `stripe-portal` | Creates a Stripe Customer Portal session |
| `stripe-webhook` | Handles Stripe subscription lifecycle events |
| `send-email` | Sends transactional email via Resend |
| `delete-account` | GDPR account deletion: cancels subscription, purges storage, audit-logs, deletes the user |
| `cleanup-gym-files` | Deletes expired gym file records and storage objects |
| `_shared` | Shared helpers (CORS, etc.) — not an invokable function |

---

## Database Overview

Key tables in the Supabase PostgreSQL database:

| Table | Description |
| --- | --- |
| `users` | Base user accounts (id, email, role, is_admin, is_active) |
| `coaches` / `athletes` | Role-specific profiles |
| `athlete_profile` | Onboarding data used for AI plan generation |
| `coach_athlete_relationship` | Many-to-many between coaches and athletes |
| `training_sessions` / `training_session_exercises` | Assigned sessions and their exercises |
| `training_plans` / `mesocycles` / `microcycles` / `plan_assignments` | Long-term planning |
| `competitions` | Races and events (one row per athlete) |
| `chat_messages` | Coach-athlete messages |
| `push_subscriptions` | Web Push subscription objects per user/device |
| `strava_activities` / `devices` | Cached Strava activity data and OAuth tokens |
| `gym_files` | PDF metadata for gym strength files (14-day expiry) |
| `running_exercises_bank` / `gym_exercises_bank` | Shared exercise libraries |
| `waitlist` | Pre-launch email signups |

All tables use Row Level Security (RLS). Policies use `(select auth.uid())` for performance. The
coach-athlete access pattern is always resolved through `coach_athlete_relationship`, not a
direct `coach_id` foreign key on athletes.

### Authentication Flow

1. User signs in via Supabase Auth (email/password)
2. `AuthContext` loads the user's profile and resolves role, plan, and `is_active`/`is_admin`
3. Layout guards (`DashboardLayout`, `AthleteDashboardLayout`, `AdminLayout`) enforce role-based
   access; an additional `IndependentRoute` guard gates independent-athlete-only routes
4. RLS policies enforce data isolation at the database level on every query

---

## Deployment

The application is deployed on **Vercel** at [trainingtrack.es](https://trainingtrack.es).

- `master` branch is production; auto-deployed on every push
- `dev` branch is the integration branch; feature branches are merged here first
- DNS is managed on Hostinger (A record and CNAME pointing to Vercel)

> A `netlify.toml` still exists in the repo from before the migration to Vercel — it is not used
> for the current deployment.

### Vercel Build Settings

| Setting | Value |
| --- | --- |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |
| Root Directory | `Frontend` |

Set the environment variables listed above in the Vercel project settings.

---

## Development Notes

### Date Formatting (Critical)

Never use `date.toISOString().split('T')[0]` to format dates for database queries.
`toISOString()` converts to UTC and shifts the date back by one day in UTC+ timezones (e.g.,
Spain CET/CEST).

Always use `toLocalDateStr()` from `src/lib/dateUtils.js`:

```js
import { toLocalDateStr } from '../lib/dateUtils';

const formatted = toLocalDateStr(new Date()); // "2026-03-24" in local timezone
```

### Code Conventions

This project enforces conventions via a pre-commit hook. See `AGENTS.md` for the full list,
including:

- `const` by default, `let` only when reassignment is needed, never `var`
- Functional components with hooks only; no class components
- Tailwind CSS utilities only — no inline styles or CSS-in-JS
- `async/await` over `.then()` chains
- No `console.log` in production code
- Business logic in services or hooks, not in components
- Lazy loading for all page components
- UI language is Spanish (es-ES)

`AGENTS.md` also indexes a set of project skills (SDD workflow, issue/PR creation) used by
AI coding agents working in this repo — load the relevant skill before starting a task.

### Supabase Migrations

Supabase does not support automatic rollbacks. Migrations are one-way SQL. When a branch touches
the database schema, prepare both an "up" and a "down" migration SQL file before applying.

---

## License

Proprietary — All rights reserved © 2026 TrainingTrack

This software is private property. Reproduction, distribution, or commercial use without
explicit written permission from the owner is prohibited.

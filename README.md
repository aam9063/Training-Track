# TrainingTrack

SaaS platform for running coaches and athletes.

<p align="center">
  <img src="./public/img/logo_192.png" alt="TrainingTrack Logo" width="120" />
</p>

<p align="center">
  <a href="https://reactjs.org/"><img src="https://img.shields.io/badge/React-19-blue.svg" alt="React" /></a>
  <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite-6-646CFF.svg" alt="Vite" /></a>
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

## Features

### Coach Dashboard

- **Weekly Agenda**: training sessions grouped by title and type across all athletes, with athlete counts and drill-down modals
- **Upcoming Events**: upcoming competitions listed below the weekly agenda
- **Calendar with drag-and-drop**: sessions and competitions displayed as grouped pills; week starts on Monday
- **Athlete Management**: full CRUD for athlete profiles and coach-athlete relationships
- **Competition Management**: create competitions for multiple athletes in a single operation via `CreateCompetitionModal`
- **Exercise Banks**: customizable running and gym exercise libraries
- **Metrics and Charts**: interactive performance charts per athlete using Chart.js
- **PDF Export**: export weekly training plans to PDF, with free-text descriptions for planner-style sessions

### Planning Section (`/dashboard/planning`)

- **Training Plans**: create multi-phase plans with mesocycles (base, build, peak, taper, recovery)
- **Weekly Plan Editor**: 7-day grid with free-text per day; volume is auto-calculated from km references in text
- **Plan Assignment**: assign a plan to multiple athletes from a start date, which generates `training_sessions` rows automatically
- **Gym Files**: upload PDF strength materials (max 10 MB, 14-day auto-expiry); athletes see files under "Material de Fuerza"

### AI Features

- **AI Training Planner**: onboarding wizard collects athlete profile data; DeepSeek generates a structured training plan; coach reviews and approves before saving
- **AI Reports**: automated weekly performance reports per athlete (`generate-ai-report`, `weekly-ai-reports` Edge Functions)
- **AI Chat**: athletes can query an AI assistant that has access to their training context (`athlete-ai-chat` Edge Function)

### Athlete Area

- **Athlete Dashboard**: overview of the current week's sessions, upcoming competitions, and recent metrics
- **Training View**: compact list on mobile, 7-column grid on desktop; coach notes shown only when they differ from the description
- **Metrics**: personal progress charts (pace, volume, etc.)
- **Messaging**: real-time chat with the coach

### Strava Integration

- OAuth flow via `strava-token-exchange` Edge Function; tokens stored in `devices` table
- Activity cache in `strava_activities` table, synced via `stravaSyncService.js`
- `strava-webhook` Edge Function: automatically marks `training_sessions` as completed when a matching activity is recorded
- Athlete dashboard cards display real Strava data (distance, time, pace) when available

### PWA and Push Notifications

- Progressive Web App with custom service worker (`src/sw.js`) using Workbox `injectManifest` strategy
- Web Push notifications via VAPID keys; `send-push` Edge Function handles signing and encryption without external libraries
- Database triggers on `training_sessions`, `chat_messages`, and `competitions` fire push notifications automatically
- Notification deduplication: batch session assignments produce a single notification per athlete
- Push banner shown only in PWA standalone mode when permission has not yet been granted

### Messaging

- Real-time coach-athlete chat using Supabase Realtime
- Toast notifications suppressed when the recipient's conversation is already open

### Admin Panel

- User management: list, search, activate/deactivate coaches and athletes
- Subscription management: change plan and athlete limits per coach
- Waitlist viewer: review pre-launch email signups

### Other

- **Dark/Light mode** via `ThemeContext`
- **Error tracking** with Sentry
- **Waitlist**: landing page email signup with `waitlist` table (anon INSERT via RLS)

---

## Tech Stack

### Frontend

| Library | Version | Purpose |
| --- | --- | --- |
| [React](https://reactjs.org/) | 19 | UI — functional components and hooks |
| [Vite](https://vitejs.dev/) | 6 | Build tool with HMR |
| [React Router](https://reactrouter.com/) | 7 | Client-side routing |
| [Tailwind CSS](https://tailwindcss.com/) | 3.4 | Utility-first styling |
| [Framer Motion](https://www.framer.com/motion/) | 12 | Declarative animations |
| [Chart.js](https://www.chartjs.org/) + react-chartjs-2 | 5 | Interactive charts |
| [React Icons](https://react-icons.github.io/react-icons/) | — | Icon set (Feather Icons) |
| [React Toastify](https://fkhadra.github.io/react-toastify/) | — | Toast notifications |
| [Sentry](https://sentry.io/) | — | Error tracking |
| [Workbox](https://developer.chrome.com/docs/workbox/) | — | PWA / service worker |

### Backend

| Service | Purpose |
| --- | --- |
| [Supabase](https://supabase.com/) | PostgreSQL, Auth, Storage, Realtime, Edge Functions |
| [Supabase Edge Functions](https://supabase.com/docs/guides/functions) | Serverless Deno functions |
| [DeepSeek API](https://www.deepseek.com/) | LLM for AI plan generation, reports, and chat |
| [Strava API](https://developers.strava.com/) | Activity OAuth and webhook |

---

## Project Structure

```
Frontend/
├── public/
│   └── img/                    # Static images (logo, OG image)
│
├── src/
│   ├── components/
│   │   ├── landing/            # Public landing page components
│   │   ├── dashboard/          # Coach dashboard components
│   │   │   ├── Sidebar.jsx
│   │   │   ├── WeeklyTrainingModal.jsx
│   │   │   ├── WeeklyPlanEditor.jsx
│   │   │   ├── PlanAssignmentModal.jsx
│   │   │   └── CreateCompetitionModal.jsx
│   │   ├── athlete/            # Athlete area components
│   │   └── admin/              # Admin panel components
│   │
│   ├── contexts/
│   │   ├── AuthContext.jsx     # Auth session and user profile
│   │   ├── ThemeContext.jsx    # Dark / light mode
│   │   └── NotificationContext.jsx  # Push state, active chat partner
│   │
│   ├── hooks/
│   │   ├── useCoachDashboard.js
│   │   ├── useCalendarData.js
│   │   ├── useWeeklyTrainings.js
│   │   └── usePlanningData.js
│   │
│   ├── layouts/
│   │   ├── CoachLayout.jsx     # Route guard for coaches
│   │   ├── AthleteLayout.jsx   # Route guard for athletes
│   │   └── AdminLayout.jsx     # Route guard for admins
│   │
│   ├── pages/
│   │   ├── Landing.jsx
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── dashboard/          # Coach pages (Calendar, Athletes, Metrics, Messages, Planning)
│   │   ├── athlete/            # Athlete pages (Dashboard, Training, Metrics, Messages)
│   │   └── admin/              # Admin pages
│   │
│   ├── services/               # All Supabase queries — one file per domain
│   │   ├── athleteService.js
│   │   ├── coachService.js
│   │   ├── dashboardService.js
│   │   ├── trainingService.js
│   │   ├── competitionService.js
│   │   ├── messageService.js
│   │   ├── exerciseBankService.js
│   │   ├── gymFilesService.js
│   │   ├── stravaSyncService.js
│   │   ├── adminService.js
│   │   └── aiReportService.js
│   │
│   ├── lib/
│   │   ├── supabase.js         # Supabase client
│   │   ├── dateUtils.js        # toLocalDateStr() and other date helpers
│   │   ├── pdfExport.js        # PDF generation
│   │   ├── pushNotifications.js # Web Push subscribe/unsubscribe
│   │   └── toast.js            # Toast helpers
│   │
│   ├── sw.js                   # Custom service worker (Workbox injectManifest)
│   ├── App.jsx                 # Router and lazy-loaded routes
│   ├── main.jsx                # React entry point
│   └── index.css               # Global styles and Tailwind imports
│
├── .env.example                # Environment variable template
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── eslint.config.js
└── package.json
```

### Route Map

```
/ — Landing page (public)
/login
/register
/forgot-password

/dashboard                      — Coach area (protected)
/dashboard/atletas
/dashboard/atletas/:id
/dashboard/metricas
/dashboard/mensajes
/dashboard/planning

/athlete/dashboard              — Athlete area (protected)
/athlete/training
/athlete/metrics
/athlete/messages

/admin                          — Admin panel (protected, is_admin = true)
/admin/users
/admin/users/:id
/admin/login
```

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- A [Supabase](https://supabase.com/) project (free tier is sufficient for development)
- (Optional) DeepSeek API key for AI features
- (Optional) Strava API credentials for the Strava integration

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
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Push Notifications (required for PWA push)
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key

# Analytics (optional)
VITE_GA_TRACKING_ID=G-XXXXXXXXXX

# Sentry (optional)
VITE_SENTRY_DSN=https://...
```

Do not commit `.env` to version control. It is listed in `.gitignore`.

### Supabase Edge Function Secrets

Set these in Supabase Dashboard > Settings > Edge Functions > Secrets, or via the CLI:

```bash
supabase secrets set DEEPSEEK_API_KEY=sk-...
supabase secrets set VAPID_PUBLIC_KEY=...
supabase secrets set VAPID_PRIVATE_KEY=...
supabase secrets set VAPID_SUBJECT=mailto:...
```

---

## Edge Functions

All Edge Functions are deployed to the Supabase project (`lusirdkixfliydimemre`) and written in Deno.

| Function | Purpose |
| --- | --- |
| `admin-api` | Admin operations protected by service role |
| `generate-ai-plan` | Generates a training plan from athlete profile data via DeepSeek |
| `generate-ai-report` | Generates a performance report for a single athlete via DeepSeek |
| `weekly-ai-reports` | Scheduled function that runs reports for all athletes weekly |
| `athlete-ai-chat` | AI assistant chat endpoint with training context for athletes |
| `strava-token-exchange` | Handles Strava OAuth code exchange and stores tokens |
| `strava-webhook` | Receives Strava activity events and auto-completes training sessions |
| `send-push` | Sends Web Push notifications using VAPID; no external libraries |
| `cleanup-gym-files` | Deletes expired gym file records and storage objects |

---

## Database Overview

Key tables in the Supabase PostgreSQL database:

| Table | Description |
| --- | --- |
| `users` | Base user accounts (id, email, role, is_admin, is_active) |
| `coaches` | Coach profiles and subscription plan |
| `athletes` | Athlete profiles |
| `athlete_profile` | Onboarding data used for AI plan generation |
| `coach_athlete_relationship` | Many-to-many between coaches and athletes |
| `training_sessions` | Weekly training sessions assigned to athletes |
| `training_session_exercises` | Exercises within a session |
| `training_plans` | Long-term training plans with mesocycles |
| `mesocycles` | Plan phases (base, build, peak, taper, recovery) |
| `microcycles` | Weekly blocks within a mesocycle |
| `plan_assignments` | Links a plan to an athlete with a start date |
| `competitions` | Races and events (one row per athlete) |
| `chat_messages` | Coach-athlete messages (sender_id, receiver_id) |
| `push_subscriptions` | Web Push subscription objects per user/device |
| `strava_activities` | Cached Strava activity data |
| `devices` | Strava OAuth tokens and strava_athlete_id |
| `gym_files` | PDF metadata for gym strength files (14-day expiry) |
| `running_exercises_bank` | Coach's running exercise library |
| `gym_exercises_bank` | Coach's gym exercise library |
| `waitlist` | Pre-launch email signups |

All tables use Row Level Security (RLS). Policies use `(select auth.uid())` for performance. The coach-athlete access pattern is always resolved through `coach_athlete_relationship`, not a direct `coach_id` foreign key on athletes.

### Authentication Flow

1. User signs in via Supabase Auth (email/password)
2. `AuthContext` loads the user's profile and validates `is_active` and `is_admin`
3. Layout guards (`CoachLayout`, `AthleteLayout`, `AdminLayout`) enforce role-based access
4. RLS policies enforce data isolation at the database level on every query

---

## Deployment

The application is deployed on **Vercel** at [trainingtrack.es](https://trainingtrack.es).

- `master` branch is production; auto-deployed on every push
- `dev` branch is the integration branch; feature branches are merged here first
- DNS is managed on Hostinger (A record and CNAME pointing to Vercel)

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

Never use `date.toISOString().split('T')[0]` to format dates for database queries. `toISOString()` converts to UTC and shifts the date back by one day in UTC+ timezones (e.g., Spain CET/CEST).

Always use `toLocalDateStr()` from `src/lib/dateUtils.js`:

```js
import { toLocalDateStr } from '../lib/dateUtils';

const formatted = toLocalDateStr(new Date()); // "2026-03-24" in local timezone
```

### Code Conventions

This project enforces conventions via a pre-commit hook (GGA). All code must comply before delivery. See `AGENTS.md` for the full list of rules, including:

- `const` by default, `let` only when reassignment is needed
- Functional components with hooks only; no class components
- Tailwind CSS utilities only — no inline styles
- `async/await` over `.then()` chains
- No `console.log` in production code
- Business logic in services or hooks, not in components
- Lazy loading for all page components

### Supabase Migrations

Supabase does not support automatic rollbacks. Migrations are one-way SQL. When a branch touches the database schema, prepare both an "up" and a "down" migration SQL file before applying.

---

## License

Proprietary — All rights reserved © 2026 TrainingTrack

This software is private property. Reproduction, distribution, or commercial use without explicit written permission from the owner is prohibited.

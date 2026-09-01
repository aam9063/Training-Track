# Supabase Setup Instructions for TrackPro v2.0

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Fill in:
   - **Name:** TrackPro
   - **Database Password:** Generate a strong password (SAVE IT!)
   - **Region:** Choose closest to your users (e.g., `eu-west-1` for Spain)
4. Click **"Create new project"** and wait ~2 minutes

---

## Step 2: Get API Keys

1. Go to **Settings** (gear icon) → **API**
2. Copy these values to your `.env` file:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Step 3: Run Database Schema

1. Go to **SQL Editor** in Supabase Dashboard
2. Click **"New query"**
3. Copy the entire contents of `schema.sql` and paste it
4. Click **"Run"**
5. You should see: `TrackPro schema v2.0 created successfully!`

---

## Step 4: Run RLS Policies

1. In **SQL Editor**, create another **"New query"**
2. Copy the entire contents of `rls_policies.sql` and paste it
3. Click **"Run"**
4. You should see: `RLS Policies v2.0 created successfully!`

---

## Step 5: Load Exercise Seeds (Optional but Recommended)

1. In **SQL Editor**, create another **"New query"**
2. Copy the entire contents of `seeds.sql` and paste it
3. Click **"Run"**
4. You should see the count of exercises loaded (130+ total)

---

## Step 6: Configure Authentication

### Enable Email Auth (already enabled by default)

1. Go to **Authentication** → **Providers**
2. Ensure **Email** is enabled

### Enable Google OAuth (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Go to **APIs & Services** → **Credentials**
4. Click **"Create Credentials"** → **"OAuth client ID"**
5. Choose **"Web application"**
6. Add **Authorized redirect URIs:**
   ```
   https://xxxxxxxxxxxxx.supabase.co/auth/v1/callback
   ```
   (Replace with your Supabase URL)
7. Copy **Client ID** and **Client Secret**
8. Back in Supabase: **Authentication** → **Providers** → **Google**
9. Enable and paste your Client ID and Secret

---

## Step 7: Configure Email Templates (Optional)

1. Go to **Authentication** → **Email Templates**
2. Customize:
   - **Confirm signup** - Email verification
   - **Reset password** - Password reset
   - **Magic link** - Passwordless login

---

## Step 8: Test Your Setup

Run your app:
```bash
npm run dev
```

Try creating an account:
1. Go to `/register`
2. Select Coach or Athlete
3. Fill in the form
4. Check Supabase **Authentication** → **Users** to see the new user
5. Check **Table Editor** → **users** to see the user record
6. Check **Table Editor** → **coaches** or **athletes** to see the role-specific record

---

## Database Tables Overview

### Core Tables

| Table | Description |
|-------|-------------|
| `users` | Base user info (extends auth.users) |
| `coaches` | Coach-specific data (bio, subscription) |
| `athletes` | Athlete data (physiological, paces) |
| `coach_athlete_relationship` | Coach-athlete connections |

### Training Tables

| Table | Description |
|-------|-------------|
| `training_plans` | Training plan definitions |
| `training_sessions` | Individual training sessions |
| `training_session_exercises` | Exercises in each session |
| `fartlek_segments` | Complex fartlek structure |
| `training_metrics` | Session results and metrics |

### Exercise Banks

| Table | Description |
|-------|-------------|
| `running_exercises_bank` | 75+ running exercises |
| `gym_exercises_bank` | 60+ gym exercises |

### Performance & Analytics

| Table | Description |
|-------|-------------|
| `athlete_paces` | R1-R10 pace zones |
| `conconi_tests` | Conconi test data |
| `personal_bests` | Personal records |
| `analytics_weekly_summary` | Weekly training load |
| `race_predictions` | VDOT-based predictions |

### Communication

| Table | Description |
|-------|-------------|
| `messages` | Coach-athlete messaging |
| `comments` | Comments on sessions |
| `notifications` | System notifications |

### Devices

| Table | Description |
|-------|-------------|
| `devices` | Connected devices (Garmin, etc.) |

---

## Row Level Security (RLS)

RLS ensures complete data isolation:

- Coaches can ONLY see their own athletes
- Athletes can ONLY see their own data + their coach
- No cross-team data access possible
- Even with direct database access, users can't see others' data

### Performance Optimizations

The RLS policies use:
- `(select auth.uid())` pattern for query-level caching
- `STABLE` function markers
- `SECURITY DEFINER` for safe subqueries

---

## Exercise Categories

### Running Categories

| Category | Description | Examples |
|----------|-------------|----------|
| `series_short` | 80m-150m | Sprints, rectas |
| `series_medium` | 200m-1000m | Track intervals |
| `series_long` | 1500m-5000m | Long intervals |
| `warmup_run` | 3-5km | Calentamiento |
| `easy_run` | 4-12km | Rodaje suave |
| `long_run` | 14-32km | Tirada larga |
| `tempo_run` | Threshold pace | Ritmo controlado |
| `fartlek_time` | By time | Fartlek por tiempo |
| `fartlek_distance` | By distance | Fartlek por distancia |
| `hill_repeats` | Hills | Cuestas |
| `recovery_run` | Easy | Regenerativo |
| `race` | Competition | Competiciones |
| `test` | Tests | Conconi, Cooper |

### Gym Categories

| Category | Description |
|----------|-------------|
| `max_strength` | Heavy compound lifts |
| `general_strength` | General conditioning |
| `core` | Core exercises |
| `mobility` | Flexibility/mobility |
| `plyometrics` | Explosive movements |

---

## Athlete Paces (R1-R10 System)

| Pace Code | Description | Use |
|-----------|-------------|-----|
| RR | Regenerativo | Recovery |
| R1-R3 | Aerobico suave | Easy runs |
| R4-R5 | Umbral | Threshold |
| R6-R7 | VO2max | Intervals |
| R8-R9 | Velocidad | Speed work |
| R10 | Maximo | All-out |

Paces are calculated from Conconi tests and stored per athlete.

---

## Troubleshooting

### "relation does not exist" error
- Run `schema.sql` first, then `rls_policies.sql`, then `seeds.sql`

### "permission denied" error
- Check RLS policies are applied
- Verify user is authenticated

### Google login not working
- Check redirect URI matches exactly
- Verify Client ID/Secret are correct

### Users not appearing in users table
- Check the `handle_new_user()` trigger exists
- Look for errors in Supabase logs

### Exercise bank is empty
- Run `seeds.sql` after schema and RLS

---

## Next Steps

After setup is complete:
1. Test user registration (both Coach and Athlete)
2. Test login functionality
3. Verify profiles are created automatically
4. Build the dashboard UI
5. Implement training session CRUD
6. Add Conconi test interface
7. Build analytics dashboard

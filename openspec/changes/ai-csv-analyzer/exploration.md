## Exploration: AI CSV Analyzer

### Current State

#### AI Infrastructure
The project already has a mature AI pipeline:

1. **Edge Functions** (Supabase, Deno):
   - `generate-ai-report` — generates per-athlete performance reports using DeepSeek API (`deepseek-chat`). Receives aggregated athlete data (Strava metrics, load, VDOT, PMC, periodization), sends to DeepSeek, saves to `ai_reports` table.
   - `weekly-ai-reports` — automated weekly summaries per athlete for the coach feed. Also uses DeepSeek.
   - `athlete-ai-chat` — conversational AI for coaches to ask questions about an athlete's data. Uses DeepSeek with rate limiting (40 msg/hr) and session persistence in `ai_chat_sessions`.

2. **Frontend Services**:
   - `src/services/aiReportService.js` — aggregates all athlete data client-side (`aggregateReportData`), calls the Edge Function, handles report CRUD.
   - `src/services/aiChatService.js` — thin wrapper around the `athlete-ai-chat` Edge Function.

3. **AI Provider**: Currently **DeepSeek only** (API key stored as Supabase secret `DEEPSEEK_API_KEY`). No fallback chain exists. The new feature wants to use Groq (Llama 4 Maverick), Google AI Studio (Gemini 2.5 Flash), and DeepSeek V3 as fallback.

4. **Data Flow Pattern**: Client aggregates data → sends to Edge Function → Edge Function calls AI API → saves result to DB → returns to client.

#### Existing Data Model (Activity/Training)

- **`strava_activities`** — cached Strava data per athlete. Fields: `athlete_id`, `strava_id`, `name`, `sport_type`, `type`, `start_date_local`, `distance` (meters), `moving_time` (seconds), `elapsed_time`, `total_elevation_gain`, `average_speed`, `max_speed`, `average_heartrate`, `max_heartrate`, `average_cadence`, `calories`, `suffer_score`, `has_heartrate`, `map_summary_polyline`, `best_efforts`.
- **`daily_training_load`** — TSS/CTL/ATL/TSB per day per athlete. Derived from strava_activities.
- **`training_sessions`** — coach-planned sessions. Fields include `scheduled_date`, `title`, `description`, `training_type`, `status`, `rpe_score`, `strava_activity_id`.
- **`athletes`** — profile: `date_of_birth`, `gender`, `specialties`, `race_distances`, `vo2_max`, `resting_heart_rate`, `max_heart_rate`, `vam_kmh`, `lactate_threshold_pace`, `lactate_threshold_hr`, `vdot`.
- **`athlete_paces`** — Conconi-derived pace zones (R1-R10, RR) per athlete.
- **`personal_bests`** — athlete's PBs by distance.
- **`weekly_ai_reports`** — weekly analysis per athlete (ACWR, TSB, alert level, AI analysis).

#### Planning Feature
- Plans → Mesocycles → Microcycles (weeks) with JSONB `content` (days array with description text).
- `assignPlanToAthletes()` generates `training_sessions` from plan microcycles.
- Plans are templates created by coaches, then assigned to athletes with a start date.

### Affected Areas

- `supabase/functions/` — new Edge Function(s) for CSV parsing + AI analysis
- `src/services/` — new service for CSV upload, parsing, and AI analysis requests
- `src/pages/dashboard/` — new page or tab for coach CSV upload + results
- `src/pages/athlete/` — possible athlete-facing upload page
- `src/lib/` — CSV parsing utilities (deterministic, no AI needed)
- Supabase DB — new tables for imported activities + analysis results
- Supabase Storage — bucket for raw CSV files (optional, for audit trail)

### Approaches

#### A. CSV Parsing Strategy

**1. Deterministic Parser (Client-Side)**
Parse CSV entirely in the browser using column-name mapping tables per platform.

- Pros: No API cost, instant, predictable, testable, works offline
- Cons: Must maintain mapping tables per platform; new/unknown formats need manual updates
- Effort: Medium

**2. AI-Assisted Parser (Edge Function)**
Send raw CSV headers + sample rows to an AI model, which returns a normalized schema mapping.

- Pros: Handles unknown formats gracefully, self-adapting
- Cons: Slow (API call per upload), costs money, non-deterministic (could mismap fields), overkill for well-known formats
- Effort: Medium-High

**3. Hybrid Parser (Recommended)**
Deterministic parser tries first with a known-formats registry (Garmin, Polar, COROS, Suunto, Apple Watch, Wahoo). If no match found, falls back to AI-assisted column mapping.

- Pros: Fast for 95% of cases (known platforms), graceful degradation for unknown formats, testable core logic
- Cons: Slightly more code to maintain both paths
- Effort: Medium

#### B. AI Provider Integration

**1. Single Provider per Function**
Each Edge Function hardcodes one provider (like current DeepSeek setup).

- Pros: Simple, works today
- Cons: No resilience, tied to one provider's availability and pricing
- Effort: Low

**2. Fallback Chain with Provider Abstraction**
Create a shared `ai-provider` module used by all Edge Functions. Tries providers in order: Groq (free) → Google AI Studio (free) → DeepSeek V3 (paid fallback).

- Pros: Resilient, cost-optimized (free tiers first), reusable across all AI features
- Cons: More initial setup, need to handle different API formats, rate limits vary by provider
- Effort: Medium

**3. Router Based on Task Complexity**
Use cheaper/faster models for simple tasks (CSV column mapping) and more capable models for complex analysis (90-day training insight generation).

- Pros: Cost-optimized per task type, best quality where it matters
- Cons: More configuration, must benchmark which model handles which task well
- Effort: Medium-High

#### C. UI Approach

**1. Dedicated Page (New Route)**
New `/dashboard/csv-analyzer` page with upload zone, preview, and results.

- Pros: Clean separation, doesn't bloat existing pages, room to grow
- Cons: Another sidebar entry
- Effort: Low-Medium

**2. Tab in Planning Page**
Add as a third tab in Planning (alongside Planes and Archivos Gym).

- Pros: Contextually related to planning, no new route
- Cons: Planning page already has two tabs; adding a third with complex functionality could feel cramped
- Effort: Low

**3. Modal from Athlete Profile**
Upload CSV from the athlete detail view, results shown inline or in a modal.

- Pros: Contextual (tied to specific athlete), natural workflow
- Cons: Limited screen space for rich results, less discoverable for bulk analysis
- Effort: Low

#### D. Data Storage Strategy

**1. Normalize into `strava_activities`-compatible format**
Map CSV data into the same schema as `strava_activities`, with a `source` column to distinguish.

- Pros: All existing analysis code (load calc, metrics, reports) works immediately with imported data; single source of truth for activities
- Cons: Schema may not capture platform-specific fields; risk of duplicates with Strava-synced data
- Effort: Medium

**2. Separate `imported_activities` table**
New table with its own schema, referenced by a unified view or adapter layer.

- Pros: Clean separation, no risk of polluting Strava data, can store raw platform-specific fields
- Cons: Existing analysis code needs adaptation to also query this table; two sources of truth
- Effort: Medium-High

**3. Hybrid: Normalize + Raw Storage**
Store normalized data in a unified activities table (extending `strava_activities` or a new `activities` table) AND keep raw CSV in Storage for audit.

- Pros: Best of both worlds — existing code works, raw data preserved
- Cons: Most complex, storage cost for raw files
- Effort: High

### Garmin CSV Format (Reference)

Garmin Connect exports a CSV with these typical columns:
```
Activity Type, Date, Favorite, Title, Distance, Calories, Time, Avg HR, Max HR,
Aerobic TE, Avg Run Cadence, Max Run Cadence, Avg Pace, Best Pace, Total Ascent,
Total Descent, Avg Stride Length, Avg Vertical Ratio, Avg Vertical Oscillation,
Avg Ground Contact Time, Training Stress Score, Avg Power, Max Power,
Normalized Power, Best Lap Time, Number of Laps, Moving Time, Elapsed Time,
Min Elevation, Max Elevation
```
- Distance in km with comma decimal separator (locale-dependent)
- Time/Pace in `HH:MM:SS` or `MM:SS` format
- Dates in locale-dependent format
- Units vary by user settings (km/mi, m/ft)

Other platforms (Polar, COROS, Suunto) have similar but not identical column layouts. Key fields are always present: date, distance, duration, sport type. HR and pace/speed are common but optional.

### Proposed DB Schema

```sql
-- Imported activities (normalized from any CSV source)
CREATE TABLE csv_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  athlete_id UUID REFERENCES athletes(id),  -- NULL for self-uploads
  filename TEXT NOT NULL,
  platform TEXT,  -- 'garmin', 'polar', 'coros', 'suunto', 'unknown'
  row_count INTEGER,
  status TEXT DEFAULT 'pending',  -- pending, parsed, analyzed, error
  raw_storage_path TEXT,  -- optional: path in Supabase Storage
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Normalized activities from CSV imports
CREATE TABLE imported_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID REFERENCES csv_imports(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES athletes(id),
  activity_date DATE NOT NULL,
  activity_type TEXT DEFAULT 'Run',
  title TEXT,
  distance_meters NUMERIC,
  moving_time_seconds INTEGER,
  elapsed_time_seconds INTEGER,
  avg_heartrate NUMERIC,
  max_heartrate NUMERIC,
  avg_pace_sec_per_km NUMERIC,
  best_pace_sec_per_km NUMERIC,
  total_ascent_meters NUMERIC,
  total_descent_meters NUMERIC,
  calories INTEGER,
  avg_cadence NUMERIC,
  avg_power NUMERIC,
  tss NUMERIC,
  source_row JSONB,  -- raw CSV row for debugging
  created_at TIMESTAMPTZ DEFAULT now()
);

-- AI analysis results for a CSV import
CREATE TABLE csv_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID REFERENCES csv_imports(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES athletes(id),
  analysis_type TEXT DEFAULT 'full',  -- 'full', 'plan_suggestion'
  ai_provider TEXT,  -- 'groq', 'google', 'deepseek'
  ai_model TEXT,
  ai_analysis JSONB NOT NULL,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Recommendation

**Recommended approach: Hybrid Parser + Provider Abstraction + Dedicated Page + Separate imported_activities table**

1. **CSV Parsing**: Hybrid approach (deterministic for known platforms, AI fallback for unknown). The deterministic parser handles ~95% of cases at zero cost and instant speed. All parsing runs client-side in a Web Worker to avoid blocking the UI.

2. **AI Provider**: Build a reusable provider abstraction in a shared Supabase Edge Function module (`_shared/ai-provider.ts`). Fallback chain: Groq → Google AI Studio → DeepSeek. This benefits ALL existing AI features (reports, chat, weekly reports), not just CSV analysis.

3. **UI**: New dedicated page at `/dashboard/csv-analyzer`. For athletes: add an upload option in `/athlete/training` or `/athlete/metrics`. The page has three phases: (1) Upload + platform detection + preview, (2) AI analysis with loading state, (3) Results dashboard with charts and insights.

4. **Data**: Separate `imported_activities` table to avoid polluting `strava_activities`. A service adapter can merge both sources when needed for analysis. Raw CSVs stored in a `csv-imports` Storage bucket (14-day expiry like gym-files).

5. **Plan Generation**: This is a Phase 2 feature. The AI analysis output includes structured training recommendations. A "Generate Plan" button takes the AI's suggestions and creates a `training_plan` with mesocycles/microcycles using the existing planning infrastructure.

### Risks

- **CSV format fragmentation**: Garmin alone has changed its export format multiple times. Need a flexible parser architecture that's easy to update.
- **Large file handling**: A 90-day export could have 100-500 rows, which is fine. But if users upload years of data (5000+ rows), the AI prompt could exceed token limits. Need chunking or summarization strategy.
- **AI cost creep**: Even with free tiers (Groq, Google AI Studio), rate limits are tight. Groq: 30 RPM / 6000 tokens/min on free tier. Google: 15 RPM. Need queuing and rate-limit handling.
- **Duplicate detection**: If an athlete has Strava connected AND uploads a Garmin CSV, the same activities appear in both sources. Need deduplication logic (match by date + distance + duration within tolerance).
- **Locale-dependent CSV formats**: Garmin exports use the user's locale for decimal separators (comma vs dot) and date formats. The parser must handle both `3,5` and `3.5` for distance, and multiple date formats.
- **Free-tier API instability**: Groq and Google AI Studio free tiers have no SLA. If both are down, the paid DeepSeek fallback activates — need to monitor costs.
- **Privacy**: CSV files may contain location data. Need clear data handling policies and consider not storing raw files long-term.

### Ready for Proposal

Yes. The exploration covers all key dimensions: parsing strategy, AI provider chain, UI placement, data model, and risks. The orchestrator can proceed to `sdd-propose` with the hybrid parser + provider abstraction + dedicated page approach. Key decision point for the user: whether to start with coach-only upload or include athlete self-upload from day one.

# Design — AI Analysis Panel Redesign

## Overview
Replace `AiAnalysisModal` with `AiAnalysisPanel`, a right-side sliding panel that mirrors the coach Hermes IA chat pattern in `src/pages/dashboard/AthleteProfile.jsx` (lines ~2020–2066). Same functional states (loading, success, error, quota). Same component API. Different chrome + animation.

## Component API

```jsx
<AiAnalysisPanel
  open={boolean}                                       // controlled
  onClose={() => void}                                 // required
  chartType="tsb | time_in_zone | ... | general"      // drives prompt selection
  data={object}                                        // chart data payload sent to AI
  athleteContext={{ nivel, objetivo, vam }}            // personalization context
  title="Análisis con IA"                              // optional override
  onSuccess={(result) => void}                         // optional callback
/>
```

Identical to `AiAnalysisModal`. Drop-in replacement.

## Structure

```jsx
<AnimatePresence>
  {open && (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed top-[62px] bottom-[88px] left-0 right-0 lg:inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />
      {/* Panel */}
      <motion.aside
        ref={panelRef}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed right-0 top-[62px] bottom-[88px] lg:top-0 lg:bottom-0 z-50 w-full max-w-md lg:max-w-xl flex flex-col bg-white dark:bg-slate-950 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-panel-title"
      >
        {/* Header (fixed) */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <HermesIcon className="h-6 w-6 shrink-0" />
            <div className="min-w-0">
              <h2 id="ai-panel-title" className="text-base font-semibold truncate">
                {title || 'Análisis con IA'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                {labelForChartType(chartType)}
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel"
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {state === 'loading' && <LoadingState />}
          {state === 'success' && <ReportMarkdown text={report} />}
          {state === 'error' && <ErrorState onRetry={retry} />}
          {state === 'quota-exhausted' && <QuotaExhaustedState />}
        </div>
      </motion.aside>
    </>
  )}
</AnimatePresence>
```

## Interaction details

### Backdrop click guard
```js
const handleBackdropClick = () => {
  if (state === 'loading') return;   // REQ-4.1
  onClose();
};
```

### ESC key listener
```js
useEffect(() => {
  if (!open) return;
  const onKey = (e) => {
    if (e.key === 'Escape' && state !== 'loading') onClose();
  };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}, [open, state, onClose]);
```

### Focus management
```js
useEffect(() => {
  if (open) closeButtonRef.current?.focus();
}, [open]);
```
Return-focus-on-close is best-effort: callers may pass `triggerRef` later if needed, but MVP skips it.

### Analysis request lifecycle
The request fires when `open` transitions `false → true` AND quota is available. It also fires on "Reintentar". It does **not** fire on unrelated parent re-renders (REQ-14.2) — guarded by a `useEffect` dependent on `open` + a `requestId` counter bumped by retry.

```js
useEffect(() => {
  if (!open) return;
  if (quota.exhausted) { setState('quota-exhausted'); return; }
  runAnalysis();
}, [open, requestId]);
```

### Switching analysis while open (REQ-15)
Parent keeps one `<AiAnalysisPanel open>` instance and updates `chartType` + `data` props; the panel re-fires analysis when either changes (added to effect deps). Only one panel instance exists at a time.

### Body scroll (underlying page)
We do NOT lock body scroll. On mobile, backdrop fills the content area between header and bottom nav, so taps on the backdrop close the panel without affecting native scroll behavior. On desktop, the user can still scroll the metrics page behind the translucent backdrop (accepted trade-off).

## Responsive widths

| Breakpoint | Width class | Max width |
|------------|-------------|-----------|
| `<640px`   | `w-full`    | none (full) |
| `640–1023px` | `w-full max-w-md` | 28 rem |
| `≥1024px`  | `w-full max-w-md lg:max-w-xl` | 36 rem |

## Vertical layout

| Breakpoint | Top | Bottom |
|------------|-----|--------|
| `<1024px`  | `62px` (below mobile header) | `88px` (above mobile bottom nav) |
| `≥1024px`  | `0` | `0` |

Backdrop follows the same rules with `lg:inset-0`.

## Z-index map

| Layer | Z | Notes |
|-------|---|-------|
| Mobile top header | 30 | existing |
| Sidebar | 40 | existing |
| **Panel backdrop** | **40** | new |
| **Panel** | **50** | new |
| Toasts | 60+ | existing — panel does not block these |

## States + transitions

```
         ┌─────────────┐
open→T ─►│   loading   │──success──► success  ──(close)──► exit
         └─────────────┘                 ▲
                │                         │
                ├──error────► error ──(retry)──► loading (via requestId++)
                │                         │
                └──quota-exhausted ───────┘
                            │
                        (close)
                            ▼
                          exit
```

Crossfade between loading and success uses Framer Motion `AnimatePresence mode="wait"` inside the body, or simple CSS opacity transition (preferred — less animation overhead since parent already has spring).

## Architecture Decision Records

### ADR 1 — Slide from the right
**Context**: The coach Hermes IA chat slides from the right. Athletes use a similar Hermes concept for metric analysis.
**Decision**: Use the same slide-from-right pattern (identical classNames, identical transition values).
**Rationale**: Consistency across roles, reduces cognitive load, reuses a well-tested layout.
**Alternatives considered**: Slide from left (would fight the sidebar), bottom sheet (poor fit for long reports on desktop), keep modal (problem statement).

### ADR 2 — `max-w-xl` on desktop (wider than coach chat's `max-w-md`)
**Context**: Coach Hermes is a chat (short messages). Athlete AI analysis is a structured report with paragraphs and occasional inline data.
**Decision**: `max-w-md` on tablet, `max-w-xl` on desktop.
**Rationale**: Better line length for reading multi-paragraph reports; still leaves the chart visible behind the panel at 1440px width.
**Alternatives**: `max-w-md` everywhere (cramped), `max-w-2xl` (hides too much of the chart).

### ADR 3 — Keep backdrop-click-to-close, guarded during loading
**Context**: The old modal had the same guard; removing it would be a regression. But backdrop-to-close is useful UX (fast dismissal after reading).
**Decision**: Keep backdrop-to-close. Guard with `state !== 'loading'`.
**Rationale**: Prevents accidentally cancelling a 5–10 s request; preserves familiar dismissal once the request is complete.

### ADR 4 — Delete `AiAnalysisModal` with no deprecation window
**Context**: `AiAnalysisModal` was introduced very recently (`ai-analysis-reports` change) and has only 2 call sites. No external consumers.
**Decision**: Remove in the same change that introduces the panel.
**Rationale**: Avoids keeping dead code around. Two-file migration is trivial.
**Alternatives**: Keep both for a release cycle (unnecessary; increases surface area).

### ADR 5 — Single panel instance, update props instead of remount
**Context**: REQ-15 requires switching between chart analyses without close/reopen.
**Decision**: Parent owns one `<AiAnalysisPanel open>` instance; changing `chartType` + `data` re-fires analysis inside the panel.
**Rationale**: Smooth UX; no animation restart; cleaner state management.
**Alternative**: Remount on chart change (would force an exit/re-enter animation).

### ADR 6 — Do not lock body scroll
**Context**: Locking scroll is common for modals but adds complexity (iOS rubber-band bugs, overflow hidden side effects).
**Decision**: Don't lock. On mobile the backdrop already covers the content area; on desktop scrolling behind the panel is acceptable.
**Rationale**: Keeps component self-contained, avoids global side effects.

## Deployment order

1. Create `src/components/athlete/AiAnalysisPanel.jsx` (copy modal body, swap chrome + animation).
2. Update `src/components/athlete/MetricAIAnalyzer.jsx` (import + JSX tag).
3. Update `src/components/athlete/GeneralAnalysisCTA.jsx` (import + JSX tag).
4. Delete `src/components/athlete/AiAnalysisModal.jsx`.
5. Run `npm run lint` (GGA pre-commit hook will also check).
6. Run `npm run build` to confirm no stale imports.
7. Manual smoke test on `/athlete/metrics`: each analyzer button opens the panel, report loads, close via X / backdrop / ESC works.

## Testing checklist

- Open, load, render report, close via X — works.
- Open, click backdrop during loading — panel stays open.
- Open, click backdrop after report arrives — panel closes.
- Open, press ESC — panel closes.
- Quota exhausted — opens directly in exhausted state, no API call.
- Network error — error state + retry works.
- Mobile (390 × 844): full width, top 62px, bottom 88px.
- Desktop (1440 × 900): right-aligned, `max-w-xl`, chart visible behind backdrop.
- Switch chart analyzer while open: content updates in place.
- `prefers-reduced-motion`: fades instead of slides.
- `npm run lint` + `npm run build` pass.

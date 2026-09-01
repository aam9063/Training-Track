# Proposal — AI Analysis Panel Redesign

## Intent
Replace the current centered modal (`AiAnalysisModal`) used for AI-powered metric analysis with a right-side sliding panel (`AiAnalysisPanel`), matching the exact Hermes IA coach pattern used in `AthleteProfile.jsx`. The side panel lets the athlete read the analysis while keeping the underlying chart visible, provides a consistent UX with the coach side of the app, and behaves better for long reports (natural internal scroll).

## Why

- **Chart visibility**: the modal covers the whole screen on desktop, so the athlete cannot compare the AI analysis with the chart it refers to. A right-aligned panel leaves the chart visible to the left.
- **UX consistency**: the coach Hermes IA chat already uses the exact slide-in-from-right pattern (`fixed right-0 top-[62px] bottom-[72px] lg:top-0 lg:bottom-0 z-50 w-full max-w-md`). Athletes benefit from the same mental model.
- **Avoid modal stacking**: the metrics page may already open secondary modals (filters, tooltips); removing the full-screen modal eliminates z-index conflicts and scroll lock issues.
- **Long-report ergonomics**: AI reports can be 600–1500 tokens long. A panel with `overflow-y-auto` feels more natural than a modal whose inner height is computed dynamically.
- **Mobile parity**: on phones the panel is full-width anyway, so visual impact is similar to a modal while preserving the top header (`62px`) and bottom nav (`88px`).

## What changes

### New
- `src/components/athlete/AiAnalysisPanel.jsx` — new side panel component. Same API surface as the modal it replaces (`open`, `onClose`, `chartType`, `data`, `athleteContext`, `title`, `onSuccess`). Internally uses Framer Motion `AnimatePresence` + spring transition (`damping: 28, stiffness: 300`) matching the coach pattern.

### Updated (2 call sites)
- `src/components/athlete/MetricAIAnalyzer.jsx` — swap `<AiAnalysisModal>` for `<AiAnalysisPanel>`. No other logic change.
- `src/components/athlete/GeneralAnalysisCTA.jsx` — swap `<AiAnalysisModal>` for `<AiAnalysisPanel>`. No other logic change.

### Removed
- `src/components/athlete/AiAnalysisModal.jsx` — deleted after migration. No backwards compatibility needed: this component was just introduced in `ai-analysis-reports` and has no external consumers.

## Affected files

| File | Action |
|------|--------|
| `src/components/athlete/AiAnalysisPanel.jsx` | NEW — based on old modal body + new slide animation |
| `src/components/athlete/AiAnalysisModal.jsx` | DELETE |
| `src/components/athlete/MetricAIAnalyzer.jsx` | UPDATE — import + JSX tag only |
| `src/components/athlete/GeneralAnalysisCTA.jsx` | UPDATE — import + JSX tag only |

## Out of scope
- AI analysis service logic (`src/services/metricAnalysisService.js`) — unchanged.
- Quota hook (`src/hooks/useAiAnalysisQuota.js`) — unchanged.
- Edge Functions, DB tables, RLS — unchanged.
- Coach-side Hermes chat — unchanged (this is the source pattern, not the target).
- Markdown rendering library choice — unchanged.

## Risks

- **Low — visual only**: no backend/DB impact, no edge function impact, no RLS changes.
- **Mobile vs desktop difference**: the backdrop uses `top-[62px] bottom-[88px]` on mobile and `lg:inset-0` on desktop. If the mobile top header or bottom nav heights change in the future, these constants must be updated in lockstep with the coach Hermes panel (both should read from the same values).
- **Z-index conflicts**: panel at `z-50`, backdrop at `z-40`. Mobile top header is `z-30`, sidebar `z-40`. Panel sits above both — verified against existing layout.
- **Focus management**: moving from modal to panel changes focus semantics. We preserve `role="dialog"` and `aria-modal="true"`, add ESC-to-close listener, and return focus to the trigger button on close.
- **Parent re-render safety**: the modal was sometimes seen to auto-close on parent re-render because `open` was derived from a memoized prop. Panel uses the same open/onClose API but consumer pattern remains identical; regression risk is present and covered by manual test.

## Approach (high-level)

1. Copy the body of `AiAnalysisModal.jsx` (loading/success/error/quota states, `useAiAnalysisQuota` wiring, DeepSeek call) into `AiAnalysisPanel.jsx`, keeping state shape identical.
2. Replace the outer `fixed inset-0` container + centered card with the two-node Framer Motion structure (backdrop + `motion.aside`) using the exact classNames and transition values from the coach Hermes pattern.
3. Adjust responsive width: `w-full max-w-md` on mobile/tablet, `lg:max-w-xl` on desktop (wider than coach chat `max-w-md` because reports include more dense text).
4. Add ESC keydown listener and guarded backdrop click (skip when loading).
5. Update two call sites to swap the tag name + import path.
6. Delete the old modal file.
7. Run lint + build to verify no stale imports.

## Next phase
Run `sdd-spec` and `sdd-design` in parallel, then `sdd-tasks`.

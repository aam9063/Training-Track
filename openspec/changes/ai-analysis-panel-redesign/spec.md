# Spec — AI Analysis Panel Redesign

## Capability
Athletes can request an AI-generated analysis of a metric chart (or a general analysis) and view it in a right-side sliding panel that appears over the metrics page. The panel loads the report in place, displays loading/error/quota-exhausted states, and can be closed via an X button, a backdrop click (when not loading), or the ESC key. The panel does not block visibility of the chart on desktop.

## Delta vs. `ai-analysis-reports`
The previous change (`ai-analysis-reports`) introduced `AiAnalysisModal` as a centered full-screen modal. This change **replaces** that modal with `AiAnalysisPanel` (same props, same states, different chrome + animation).

## Requirements

### REQ-1 — Panel entry animation
- REQ-1.1 When `open` transitions from `false` to `true`, the panel slides in from the right edge.
- REQ-1.2 The animation uses Framer Motion spring physics with `damping: 28, stiffness: 300`.
- REQ-1.3 A backdrop fades in simultaneously with `opacity 0 → 1`.

### REQ-2 — Panel exit animation
- REQ-2.1 When `open` transitions from `true` to `false`, the panel slides out to the right (`x: 0 → 100%`).
- REQ-2.2 The backdrop fades out simultaneously with `opacity 1 → 0`.
- REQ-2.3 After exit animation, `AnimatePresence` removes the panel from the DOM.

### REQ-3 — Close via X button
- REQ-3.1 The panel header contains a close button (X icon, `aria-label="Cerrar panel"`).
- REQ-3.2 Clicking the X button calls `onClose()` regardless of current state (loading, success, error, quota).

### REQ-4 — Close via backdrop click
- REQ-4.1 Clicking the backdrop calls `onClose()` **only if** the analysis is **not currently loading**.
- REQ-4.2 If a request is in flight, backdrop clicks are ignored silently (no visual feedback needed).

### REQ-5 — Close via ESC key
- REQ-5.1 Pressing `Escape` while the panel is open calls `onClose()` (subject to REQ-4.1 loading guard).
- REQ-5.2 The keydown listener is attached on mount (when `open === true`) and cleaned up on unmount or close.

### REQ-6 — Loading state
- REQ-6.1 While the DeepSeek request is in flight, the body displays a spinner and the text "Analizando…" (Spanish UI).
- REQ-6.2 During loading, the panel stays open regardless of backdrop clicks (see REQ-4.1).

### REQ-7 — Success state
- REQ-7.1 On successful response, the body renders the report (markdown-formatted text) in a scroll container (`overflow-y-auto`).
- REQ-7.2 The transition from loading to success is smooth (opacity/crossfade, no full-panel flicker).
- REQ-7.3 `onSuccess(result)` is invoked once per successful response.

### REQ-8 — Error state
- REQ-8.1 On failure (network, 5xx, parse error), the body shows an error message and a "Reintentar" button.
- REQ-8.2 Clicking "Reintentar" re-invokes the analysis with the same `chartType` + `data` + `athleteContext` inputs.

### REQ-9 — Quota-exhausted state
- REQ-9.1 When `useAiAnalysisQuota` reports the monthly quota is consumed, the body displays a dedicated "Cuota agotada" message.
- REQ-9.2 The message includes a CTA to upgrade (link to pricing or the existing `UpgradeCTA`-equivalent used by the modal today).
- REQ-9.3 The analysis request is **not** fired when quota is exhausted.

### REQ-10 — Responsive width
- REQ-10.1 On viewports `<640px` (mobile), the panel takes the full width (`w-full`).
- REQ-10.2 On viewports `640–1023px` (tablet), the panel is right-aligned and capped at `max-w-md`.
- REQ-10.3 On viewports `≥1024px` (desktop), the panel is right-aligned and capped at `max-w-xl`.

### REQ-11 — Vertical placement
- REQ-11.1 On viewports `<1024px`, the panel's top edge is `62px` (clears mobile top header) and bottom edge is `88px` (clears mobile bottom nav).
- REQ-11.2 On viewports `≥1024px`, the panel occupies the full viewport height (`top-0 bottom-0`).
- REQ-11.3 The backdrop follows the same vertical constraints (`top-[62px] bottom-[88px]` on mobile, `lg:inset-0` on desktop).

### REQ-12 — Header content
- REQ-12.1 The header displays, left to right: the Hermes icon, the title "Análisis con IA", and a small chart-type label (e.g., "TSB", "Tiempo en zonas", "General").
- REQ-12.2 The header has a bottom border (`border-b border-gray-200 dark:border-slate-800`) separating it from the body.
- REQ-12.3 The X close button is right-aligned in the header.

### REQ-13 — Body scroll behavior
- REQ-13.1 The body has `flex-1 overflow-y-auto`, so long reports scroll inside the panel without scrolling the underlying page.
- REQ-13.2 The header stays pinned (no scroll) while the body scrolls.

### REQ-14 — Panel persistence across parent re-renders
- REQ-14.1 If the parent re-renders while the panel is open, the panel remains open and preserves its internal state (loading/success/error/quota + report content).
- REQ-14.2 The panel does not re-fire the analysis request on unrelated parent re-renders (it fires only when `open` goes `false → true` or when the user clicks "Reintentar").

### REQ-15 — Opening a second analysis
- REQ-15.1 If the panel is open on chart A and the user triggers chart B's analyzer, the panel updates its `chartType` + `data` props and fires a new analysis, replacing the previous content.
- REQ-15.2 The panel does not close and reopen — the animation runs only for the initial open.

### REQ-16 — Prefers-reduced-motion
- REQ-16.1 When the OS reports `prefers-reduced-motion: reduce`, the slide animation is disabled or shortened to a fade. Framer Motion respects `useReducedMotion()` or global `MotionConfig reducedMotion="user"`.

### REQ-17 — Z-index layering
- REQ-17.1 The backdrop is at `z-40`.
- REQ-17.2 The panel is at `z-50`.
- REQ-17.3 The panel sits above the mobile top header (`z-30`) and sidebar (`z-40`) but **below** toasts/notifications if their container uses `z-[60]` or higher.

### REQ-18 — Accessibility
- REQ-18.1 The panel has `role="dialog"` and `aria-modal="true"`.
- REQ-18.2 The panel has `aria-labelledby` pointing at the header title element (`id="ai-panel-title"`).
- REQ-18.3 On open, focus moves to the first focusable element inside the panel (the X button).
- REQ-18.4 On close, focus returns to the element that triggered the opening (best-effort via the calling component's `ref`; acceptable to skip if not trivially available).

### REQ-19 — Call-site migration
- REQ-19.1 `MetricAIAnalyzer.jsx` imports `AiAnalysisPanel` and uses it in place of `AiAnalysisModal` with identical props.
- REQ-19.2 `GeneralAnalysisCTA.jsx` imports `AiAnalysisPanel` and uses it in place of `AiAnalysisModal` with identical props.
- REQ-19.3 No other file imports `AiAnalysisModal` after the migration.

### REQ-20 — Clean removal
- REQ-20.1 `src/components/athlete/AiAnalysisModal.jsx` is deleted.
- REQ-20.2 `npm run lint` and `npm run build` pass with no unresolved import errors.

## Scenarios

### Scenario A — Open, load, read, close via X
1. Athlete clicks "Analizar con IA" on the TSB chart card.
2. Panel slides in from the right, backdrop fades in.
3. Body shows "Analizando…" spinner.
4. ~2–10 s later, the report replaces the spinner with a fade.
5. Athlete reads; report scrolls internally.
6. Athlete clicks X. Panel slides out right; backdrop fades out.

### Scenario B — Try to close while loading
1. Athlete triggers analysis.
2. Backdrop is visible, body shows spinner.
3. Athlete clicks the backdrop.
4. Nothing happens — panel stays open.
5. Report arrives; athlete can now close normally.

### Scenario C — Quota exhausted
1. Athlete (free tier) has already used their monthly analysis.
2. Athlete clicks "Analizar con IA".
3. Panel opens; body immediately shows "Cuota agotada" + upgrade CTA (no API call).
4. Athlete clicks X to close.

### Scenario D — Network error + retry
1. Athlete triggers analysis.
2. DeepSeek call fails (simulated offline).
3. Body shows error message + "Reintentar" button.
4. Athlete clicks "Reintentar". Spinner returns.
5. Second attempt succeeds; report renders.

### Scenario E — Switch analysis while panel open
1. Athlete opens panel on TSB. Report loads.
2. While panel is open, athlete clicks analyzer on "Tiempo en zonas" chart.
3. Panel does not close; header chart-type label updates to "Tiempo en zonas"; body returns to "Analizando…"; new report replaces previous one when ready.

### Scenario F — Mobile layout
1. On a 390 × 844 viewport, panel opens.
2. Panel takes full width.
3. Top header (62px) remains visible above the backdrop; bottom nav (88px) remains visible below.
4. Panel body scrolls without pulling the underlying metrics page.

### Scenario G — Desktop layout
1. On a 1440 × 900 viewport, panel opens.
2. Panel is right-aligned with max width ~`max-w-xl` (~576px).
3. The TSB chart remains visible to the left of the panel behind the translucent backdrop.

### Scenario H — ESC key
1. Panel open with report loaded.
2. Athlete presses ESC.
3. Panel closes (same animation as X button).

### Scenario I — Prefers-reduced-motion
1. Athlete has enabled "Reduce motion" in OS.
2. Athlete triggers analysis.
3. Panel fades in (no slide); exit also fades.

### Scenario J — Parent re-render
1. Panel open with report loaded.
2. Parent component re-renders (e.g., a chart tooltip updates state).
3. Panel stays open; report content unchanged; no re-fetch.

# Tasks — AI Analysis Panel Redesign

Implementation checklist. Each task maps to requirements in `spec.md` and decisions in `design.md`.

## Phase 1 — Create `AiAnalysisPanel`

- [ ] **T1.1** Create `src/components/athlete/AiAnalysisPanel.jsx` with the component skeleton: `AnimatePresence` + backdrop `motion.div` + `motion.aside` panel. Copy the existing state machine (loading / success / error / quota-exhausted) from `AiAnalysisModal.jsx` into the new component unchanged. (REQ-1, REQ-2, REQ-6–REQ-9)

- [ ] **T1.2** Apply the exact coach Hermes pattern classNames:
  - Backdrop: `fixed top-[62px] bottom-[88px] left-0 right-0 lg:inset-0 z-40 bg-black/40 backdrop-blur-sm`
  - Panel: `fixed right-0 top-[62px] bottom-[88px] lg:top-0 lg:bottom-0 z-50 w-full max-w-md lg:max-w-xl flex flex-col bg-white dark:bg-slate-950 shadow-2xl`
  - Transition: `{ type: 'spring', damping: 28, stiffness: 300 }`
  (REQ-1.2, REQ-10, REQ-11, REQ-17)

- [ ] **T1.3** Build the header: Hermes icon + title ("Análisis con IA") + chart-type label + X close button with `aria-label="Cerrar panel"`. Assign `id="ai-panel-title"` to the title element; set `aria-labelledby="ai-panel-title"` on the panel. (REQ-12, REQ-18.1–18.2)

- [ ] **T1.4** Build the scrollable body container: `flex-1 min-h-0 overflow-y-auto p-4`. Render each state (loading / success / error / quota) inside. (REQ-13, REQ-6–REQ-9)

- [ ] **T1.5** Implement `handleBackdropClick` guarded by `state !== 'loading'`. Implement ESC keydown listener in a `useEffect` scoped to `open`, also guarded. (REQ-4, REQ-5)

- [ ] **T1.6** Focus the X close button on open via `closeButtonRef` + `useEffect([open])`. (REQ-18.3)

- [ ] **T1.7** Wire the analysis request lifecycle: fire on `open` transition to `true`, on `requestId` bump (retry), and on `chartType` / `data` change (switch analysis). Do NOT re-fire on unrelated parent re-renders. (REQ-14, REQ-15)

- [ ] **T1.8** Respect `prefers-reduced-motion` via Framer Motion's `useReducedMotion()` — when reduced, swap the slide animation for a simple fade (`initial/animate/exit` use `opacity` only). (REQ-16)

## Phase 2 — Migrate call sites

- [ ] **T2.1** Update `src/components/athlete/MetricAIAnalyzer.jsx`: replace `import AiAnalysisModal from './AiAnalysisModal'` with `import AiAnalysisPanel from './AiAnalysisPanel'`, and swap the JSX tag. No other logic change. (REQ-19.1)

- [ ] **T2.2** Update `src/components/athlete/GeneralAnalysisCTA.jsx`: same import swap + tag swap. (REQ-19.2)

- [ ] **T2.3** Grep for any other references to `AiAnalysisModal` in `src/` and update them. Expect zero additional references. (REQ-19.3)

## Phase 3 — Remove legacy modal

- [ ] **T3.1** Delete `src/components/athlete/AiAnalysisModal.jsx`. (REQ-20.1)

- [ ] **T3.2** Verify no stale imports: run `grep -r "AiAnalysisModal" src/` and confirm zero hits.

## Phase 4 — Verify

- [ ] **T4.1** Run `npm run lint`. Resolve any warnings/errors introduced. GGA pre-commit hook must pass.

- [ ] **T4.2** Run `npm run build`. Confirm clean build with no unresolved imports. (REQ-20.2)

- [ ] **T4.3** Manual smoke test on `/athlete/metrics` against a Supabase dev project:
  - [ ] Open TSB analyzer → panel slides in from right, loads, renders report.
  - [ ] Close via X → slides out cleanly.
  - [ ] Reopen, click backdrop during loading → panel stays open.
  - [ ] After report arrives, click backdrop → closes.
  - [ ] Reopen, press ESC → closes.
  - [ ] Trigger "Retry" on a simulated error.
  - [ ] Open "Análisis general" CTA → same panel renders with general mode.
  - [ ] With panel open, click another chart's analyzer → content updates in place (no close/reopen animation).
  - [ ] Mobile viewport (390 × 844): panel is full-width, respects `top-[62px] bottom-[88px]`.
  - [ ] Desktop viewport (1440 × 900): panel is right-aligned at `max-w-xl`, chart still visible behind backdrop.
  - [ ] With OS "Reduce motion" enabled: panel fades instead of sliding.
  - [ ] Quota-exhausted user: panel opens directly in exhausted state (verify no API call in Network tab).

- [ ] **T4.4** Commit with message following repo conventions. Ensure no emojis; ensure AGENTS.md conventions are respected (GGA pre-commit hook will enforce).

## Task count
**14 tasks across 4 phases.**

# Tasks: metrics-deep-views

Total: ~20 tasks across 5 phases.

## Phase 1: Service layer (analytics)

- [ ] 1.1 Create `src/services/metricsAnalyticsService.js` with exports: `getBestEffortsEvolution`, `getTimeInZone`, `getIntensityDistribution`, `getShoes`, `getCardiacDrift`, `getGradeAdjustedPace`, `getActivityStreams`, `getActivitySplits`, `getActivityLaps`
- [ ] 1.2 Add `downsampleStream`, `bucketByZone`, `classifyIntensity` utilities to `src/lib/trainingMetrics.js`
- [ ] 1.3 Manually test each function against real athlete data in dev (verify shapes and sample outputs)

## Phase 2: New chart components

- [ ] 2.1 `src/components/athlete/charts/BestEffortsChart.jsx` (with distance filter toggle, PR highlight markers)
- [ ] 2.2 `src/components/athlete/charts/TimeInZoneChart.jsx` (stacked bar, weeks selector)
- [ ] 2.3 `src/components/athlete/charts/IntensityDistributionChart.jsx` (auto-label polarized / pyramidal / threshold)
- [ ] 2.4 `src/components/athlete/charts/ShoesWidget.jsx` (progress bars, 600 km yellow / 800 km red alerts)
- [ ] 2.5 Extend existing TSB chart to consume `suffer_score` when available (fallback to current volume-based calc when not)

## Phase 3: Integrate in Metrics page

- [ ] 3.1 Wire all new chart components into `src/pages/athlete/Metrics.jsx`
- [ ] 3.2 Implement loading + empty + error states per chart (per spec copy table)
- [ ] 3.3 Spanish copy review for all labels, tooltips, alerts

## Phase 4: Activity detail view

- [ ] 4.1 Create `src/pages/athlete/ActivityDetail.jsx` skeleton (layout, header, data fetch)
- [ ] 4.2 HR + pace dual-axis chart component
- [ ] 4.3 Splits table with HR zone color coding
- [ ] 4.4 Laps table component
- [ ] 4.5 Cardiac drift widget with Pa:HR interpretation (good / medium / bad)
- [ ] 4.6 GAP chart (grade-adjusted pace line)
- [ ] 4.7 Add routes in `src/App.jsx`: `/athlete/activity/:activityId` and `/dashboard/athletes/:athleteId/activities/:activityId` (lazy-loaded)
- [ ] 4.8 Link from activity cards on athlete dashboard and Metrics page to detail view

## Phase 5: Testing & polish

- [ ] 5.1 Verify all empty states render correctly (test with athletes missing streams / zones / gear / suffer_score)
- [ ] 5.2 Cross-check derived metrics against Strava UI (time in zone, splits, laps) for 2–3 sample activities
- [ ] 5.3 Performance check: Metrics page loads < 2s with 20 recent activities of streams; activity detail renders smoothly with downsampled data

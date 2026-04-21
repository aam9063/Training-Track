/**
 * Independent athlete flavor of the activity detail page.
 *
 * The data loading path is identical to `ActivityDetailPage` (same
 * athlete-scoped Strava cache + API proxy, same athlete profile.id).
 * Kept as a thin re-export so the route `/athlete/my-plan/activity/:id`
 * has its own stable entry point should we need to diverge later
 * (e.g. add MyPlan-specific breadcrumb / linking back to the plan).
 */
export { default } from './ActivityDetailPage';

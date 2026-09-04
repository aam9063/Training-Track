/**
 * weekly-ai-reports — pure alert-tier arithmetic.
 *
 * Kept free of Deno/Supabase I/O so it runs unmodified under `node --test`,
 * exactly like training-load-monitor/logic.js and engagement-monitor/logic.js.
 * `index.ts` performs all I/O and prompt assembly.
 */

// The report's display tiers, weakest first. Index = severity rank.
export const TIER_ORDER = ['ok', 'attention', 'critical'];

/**
 * Bridge Agent 2's severity vocabulary into this report's.
 * athlete_engagement_alerts.severity is CHECK'd to ('warning','danger');
 * training_load_alerts.severity is CHECK'd to ('warning','critical').
 * Same bridge alertFeedService.mapEngagementAlert already performs client-side.
 *
 * @param {string} severity - 'warning' | 'danger'
 * @returns {string} 'warning' | 'critical' (or the input unchanged if neither)
 */
export function normalizeEngagementSeverity(severity) {
  return severity === 'danger' ? 'critical' : severity;
}

/**
 * Derive the report's 3-tier display level from every agent's open findings.
 * Recomputes NO threshold — each source's rulebook already classified its own
 * row; this only maps and maxes.
 *
 * Vocabulary bridge summary:
 *   - training_load_alerts.severity: 'warning' | 'critical' (used as-is)
 *   - athlete_engagement_alerts.severity: 'warning' | 'danger'
 *     ('danger' -> 'critical', 'warning' -> 'warning', via
 *     normalizeEngagementSeverity)
 *   - plan_adjustment_suggestions.status: no severity column. A 'pending'
 *     row contributes 'warning' (an outstanding coach decision — real, but
 *     not independent evidence of risk, since it is downstream of a
 *     training_load_alerts row already counted above). Every other status
 *     ('approved'/'rejected'/'expired'/'superseded') contributes nothing —
 *     those rows are narrative context only.
 *
 * Called with a single argument (loadAlerts only), the two new parameters
 * default to `[]` and this returns exactly today's pre-widening value — the
 * byte-identity guarantee that keeps WIDE_CONTEXT_ENABLED=false unchanged.
 *
 * @param {Array<{severity:string}>} loadAlerts        open training_load_alerts
 * @param {Array<{severity:string}>} engagementAlerts  open athlete_engagement_alerts
 * @param {Array<{status:string}>}   planSuggestions   plan_adjustment_suggestions
 * @returns {'critical'|'attention'|'ok'}
 */
export function alertLevelFromOpenAlerts(loadAlerts, engagementAlerts = [], planSuggestions = []) {
  const severities = [
    ...(loadAlerts || []).map((a) => a.severity),
    ...(engagementAlerts || []).map((a) => normalizeEngagementSeverity(a.severity)),
    // A pending suggestion is an unmet coach decision, never independent
    // evidence: it is downstream of a training_load_alerts row already
    // counted above. Decided rows (approved/rejected/expired/superseded)
    // are narrative context only and contribute no tier.
    ...(planSuggestions || []).filter((s) => s.status === 'pending').map(() => 'warning'),
  ];
  if (severities.includes('critical')) return 'critical';
  if (severities.includes('warning')) return 'attention';
  return 'ok';
}

/**
 * Max of two report tiers. The LLM's nivel_alerta may raise the deterministic
 * level but never lower it (see design.md, "the deterministic alert level
 * becomes a floor"). Unknown/absent values fall back to the floor.
 *
 * @param {string} floorTier     - the deterministic alertLevelFromOpenAlerts result
 * @param {string} candidateTier - the model's nivel_alerta
 * @returns {'critical'|'attention'|'ok'}
 */
export function higherTier(floorTier, candidateTier) {
  const f = TIER_ORDER.indexOf(floorTier);
  const c = TIER_ORDER.indexOf(candidateTier);
  if (f < 0) return TIER_ORDER.includes(candidateTier) ? candidateTier : 'ok';
  return c > f ? candidateTier : floorTier;
}

/**
 * Build the narrow (pre-widening) weekData view for the athlete-safe Gemini
 * call (communication-agent D8, amended post-Phase-5).
 *
 * The security boundary this fix relies on is WHAT DATA WAS EVER SENT to
 * Gemini for the athlete-safe output — never a prompt instruction, never a
 * post-hoc redaction of the wide call's output. Shallow-copies `weekData`
 * with `wide_context` forced `false` and the two wide-context arrays
 * emptied; every other key is passed through unchanged. This is exactly the
 * shape `callDeepSeek` already produces byte-identically for a
 * WIDE_CONTEXT_ENABLED=false sweep run (the byte-identity guarantee
 * `alertLevelFromOpenAlerts`'s single-argument tests already cover) — this
 * function makes that same narrow shape available for a SECOND call's input
 * without a second prompt template.
 *
 * Does NOT mutate `weekData`: the wide-context call still needs the
 * original object intact.
 *
 * @param {Record<string, unknown>} weekData
 * @returns {Record<string, unknown>}
 */
export function buildNarrowWeekData(weekData) {
  return {
    ...weekData,
    wide_context: false,
    engagement_alerts: [],
    plan_adjustments: [],
  };
}

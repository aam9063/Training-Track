-- =========================================================================
-- Rollback: metrics-ai-analysis (DOWN)
-- Reverses 20260410151000_metrics_ai_analysis.sql
-- =========================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.get_ai_analysis_limit(uuid);
DROP TABLE IF EXISTS public.ai_analysis_cache;
DROP TABLE IF EXISTS public.ai_analysis_usage;

COMMIT;

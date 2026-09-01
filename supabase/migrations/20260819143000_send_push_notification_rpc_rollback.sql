-- =========================================================================
-- Rollback: send_push_notification_rpc (DOWN)
-- Reverses 20260819143000_send_push_notification_rpc.sql.
--
-- This does NOT drop public.send_push_notification — that function
-- predates this migration (it is the already-deployed, already-relied-upon
-- RPC being versioned here, called from src/services/... via
-- supabase.rpc(...) and from trigger functions in
-- supabase/independent_athlete_push_notifications.sql). Dropping it would
-- break those live call sites. Rolling back this migration means reverting
-- to "not tracked in git", not "does not exist in the database" — there is
-- nothing safe to DROP here without also breaking currently-working
-- features outside this change's scope.
-- =========================================================================

BEGIN;

-- Intentionally a no-op. See header comment above.
SELECT 1;

COMMIT;

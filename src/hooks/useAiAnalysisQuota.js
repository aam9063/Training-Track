import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Returns the current user's AI analysis quota state for the running month.
 *
 * Shape:
 * {
 *   loading: boolean,
 *   limit: number,        // -1 = unlimited
 *   used: number,
 *   remaining: number,    // -1 when unlimited
 *   canUse: boolean,
 *   source: string,       // 'free' | 'trial' | 'exempt' | 'admin' | 'coach' | plan_key
 *   coachId: string|null, // set when source === 'coach'
 *   error: string|null,
 *   refetch: () => Promise<void>,
 * }
 */
export default function useAiAnalysisQuota() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState({
    loading: true,
    limit: 0,
    used: 0,
    remaining: 0,
    canUse: false,
    source: 'free',
    coachId: null,
    error: null,
  });

  const load = useCallback(async (targetUserId) => {
    if (!targetUserId) {
      setState({
        loading: false,
        limit: 0,
        used: 0,
        remaining: 0,
        canUse: false,
        source: 'free',
        coachId: null,
        error: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const { data: limitData, error: limitError } = await supabase.rpc('get_ai_analysis_limit', {
      p_athlete_id: targetUserId,
    });

    if (limitError) {
      setState({
        loading: false,
        limit: 0,
        used: 0,
        remaining: 0,
        canUse: false,
        source: 'free',
        coachId: null,
        error: limitError.message,
      });
      return;
    }

    const limit = typeof limitData?.limit === 'number' ? limitData.limit : 1;
    const source = limitData?.source ?? 'free';
    const coachId = limitData?.coach_id ?? null;
    const usageOwner = source === 'coach' && coachId ? coachId : targetUserId;

    const now = new Date();
    const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    const { data: usageRow, error: usageError } = await supabase
      .from('ai_analysis_usage')
      .select('usage_count')
      .eq('athlete_id', usageOwner)
      .eq('year_month', ym)
      .maybeSingle();

    if (usageError) {
      setState({
        loading: false,
        limit,
        used: 0,
        remaining: limit === -1 ? -1 : limit,
        canUse: limit === -1 || limit > 0,
        source,
        coachId,
        error: usageError.message,
      });
      return;
    }

    const used = usageRow?.usage_count ?? 0;
    const canUse = limit === -1 || used < limit;
    const remaining = limit === -1 ? -1 : Math.max(0, limit - used);

    setState({
      loading: false,
      limit,
      used,
      remaining,
      canUse,
      source,
      coachId,
      error: null,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) {
        await load(userId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, load]);

  const refetch = useCallback(() => load(userId), [userId, load]);

  return { ...state, refetch };
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toLocalDateStr } from '../lib/dateUtils';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase automatically handles the OAuth code exchange via onAuthStateChange.
        // We just need to wait for the session to be available.
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;
        if (!session) {
          // Session not ready yet — onAuthStateChange will handle it.
          // Wait briefly then retry.
          await new Promise(r => setTimeout(r, 1000));
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (!retrySession) {
            navigate('/login');
            return;
          }
          await completeOAuthRegistration(retrySession);
          return;
        }

        await completeOAuthRegistration(session);
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError(err.message);
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    const completeOAuthRegistration = async (session) => {
      const user = session.user;

      // Check if there's registration metadata stored from the register page
      const storedMeta = localStorage.getItem('google_oauth_metadata');
      localStorage.removeItem('google_oauth_metadata');

      if (storedMeta) {
        // This is a NEW registration via Google — apply role + coach link
        const meta = JSON.parse(storedMeta);
        const fullName = user.user_metadata?.full_name || user.user_metadata?.name || '';
        const [firstName, ...lastParts] = fullName.split(' ');
        const lastName = lastParts.join(' ');

        // Update user metadata with role info so handle_new_user trigger can use it
        // (the trigger fires on INSERT, but for Google OAuth the user may already exist)
        await supabase.auth.updateUser({
          data: {
            role: meta.role,
            first_name: firstName || 'Usuario',
            last_name: lastName || '',
            coach_id: meta.coachId || null,
            coach_email: meta.coachEmail || null,
            auth_provider: 'google',
          },
        });

        // Check if public.users row exists (handle_new_user may have created it with defaults)
        const { data: existingUser } = await supabase
          .from('users')
          .select('id, role')
          .eq('id', user.id)
          .maybeSingle();

        if (existingUser) {
          // Update the users row with correct data
          await supabase
            .from('users')
            .update({
              role: meta.role,
              first_name: firstName || 'Usuario',
              last_name: lastName || '',
              auth_provider: 'google',
            })
            .eq('id', user.id);

          // Ensure role-specific table exists
          if (meta.role === 'athlete') {
            await supabase
              .from('athletes')
              .upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true });

            // Create coach-athlete relationship if coachId provided
            if (meta.coachId) {
              await supabase
                .from('coach_athlete_relationship')
                .upsert({
                  coach_id: meta.coachId,
                  athlete_id: user.id,
                  status: 'active',
                  start_date: toLocalDateStr(new Date()),
                }, { onConflict: 'coach_id,athlete_id', ignoreDuplicates: true });
            }
          } else if (meta.role === 'coach') {
            await supabase
              .from('coaches')
              .upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true });
          }
        }
        // If no existingUser, the handle_new_user trigger should create it
        // with the metadata we just set via updateUser.

        const redirectPath = meta.role === 'athlete' ? '/athlete/dashboard' : '/dashboard';
        navigate(redirectPath, { replace: true });
      } else {
        // This is a LOGIN via Google — just redirect based on existing role
        // Set auth_provider on users table if not already set
        await supabase
          .from('users')
          .update({ auth_provider: 'google' })
          .eq('id', user.id)
          .is('auth_provider', null);

        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        const role = userData?.role || user.user_metadata?.role || 'coach';
        const redirectPath = role === 'athlete' ? '/athlete/dashboard' : '/dashboard';
        navigate(redirectPath, { replace: true });
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-500 mb-2">Error al procesar el inicio de sesión</p>
          <p className="text-sm text-gray-500">{error}</p>
          <p className="text-sm text-gray-400 mt-2">Redirigiendo al login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Completando inicio de sesión...</p>
      </div>
    </div>
  );
}

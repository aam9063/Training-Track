import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiAlertTriangle, FiX } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { showError, showSuccess } from '../../lib/toast';
import { deleteAccount } from '../../services/accountService';

/**
 * DeleteAccountModal
 * ------------------
 * Confirmation modal for permanent account deletion. Requires the user to:
 *   - type "ELIMINAR" (exact match, enables the button)
 *   - check the "I understand" checkbox
 * then invokes the `delete-account` Edge Function and signs the user out.
 *
 * Props:
 *   - open: boolean
 *   - onClose: () => void
 */
export default function DeleteAccountModal({ open, onClose }) {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState('');
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeAthletesCount, setActiveAthletesCount] = useState(null);

  const role = profile?.role || user?.user_metadata?.role || 'athlete';

  // For coaches: show how many active athletes will be unlinked.
  useEffect(() => {
    if (!open || role !== 'coach' || !user?.id) return;
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from('coach_athlete_relationship')
        .select('athlete_id', { count: 'exact', head: true })
        .eq('coach_id', user.id)
        .eq('status', 'active');
      if (!cancelled) setActiveAthletesCount(count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, role, user?.id]);

  // Reset form state whenever the modal closes.
  useEffect(() => {
    if (!open) {
      setConfirmText('');
      setChecked(false);
    }
  }, [open]);

  const canDelete = confirmText === 'ELIMINAR' && checked && !loading;

  const handleClose = () => {
    if (loading) return;
    onClose?.();
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    setLoading(true);
    try {
      const res = await deleteAccount();
      if (res.error) {
        showError(`No se pudo eliminar la cuenta: ${res.error}`);
        setLoading(false);
        return;
      }
      showSuccess('Cuenta eliminada. Adiós.');
      // Best-effort sign out; ignore errors (the session is already invalid
      // server-side since auth.users row is gone).
      try {
        await signOut();
      } catch {
        await supabase.auth.signOut().catch(() => {});
      }
      navigate('/', { replace: true });
    } catch (err) {
      showError(`Error inesperado: ${String(err)}`);
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-coach-surface rounded-2xl shadow-2xl overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-coach-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                  <FiAlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <h2
                  id="delete-account-title"
                  className="text-xl font-bold text-gray-900 dark:text-white"
                >
                  ¿Estás seguro?
                </h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                aria-label="Cerrar"
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-coach-elevated disabled:opacity-50"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Esta acción es <strong>irreversible</strong>. Se borrarán de
                forma permanente:
              </p>
              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1.5 list-disc pl-5">
                <li>Tu perfil y datos personales</li>
                <li>Tus entrenamientos y actividades de Strava</li>
                <li>Tus análisis IA y reportes</li>
                <li>Tus conversaciones y notificaciones</li>
                <li>
                  Tu suscripción (si la tienes) — se cancela de inmediato, sin
                  reembolso
                </li>
                {role === 'coach' && (
                  <li>
                    Se desvinculará tu relación con{' '}
                    <strong>
                      {activeAthletesCount === null
                        ? '...'
                        : activeAthletesCount}
                    </strong>{' '}
                    {activeAthletesCount === 1 ? 'atleta' : 'atletas'} (sus
                    cuentas permanecen)
                  </li>
                )}
                {role === 'athlete' && (
                  <li>
                    Se desvinculará tu relación con tu entrenador (si tienes
                    uno)
                  </li>
                )}
              </ul>

              <div className="pt-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Escribe <span className="font-mono font-bold">ELIMINAR</span>{' '}
                  para confirmar
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={loading}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-coach-border rounded-lg bg-white dark:bg-coach-elevated text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="ELIMINAR"
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  disabled={loading}
                  className="mt-1 w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Entiendo que esta acción es irreversible y que perderé
                  acceso a todos mis datos.
                </span>
              </label>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-coach-border bg-gray-50 dark:bg-coach-elevated/30">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 dark:border-coach-border text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-coach-elevated rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!canDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Eliminando...' : 'Eliminar definitivamente'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

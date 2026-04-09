import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HiMail, HiLockClosed, HiEye, HiEyeOff } from 'react-icons/hi';
import { FcGoogle } from 'react-icons/fc';
import { useAuth } from '../contexts/AuthContext';
import useLoginForm from '../hooks/useLoginForm';

export default function Login() {
  const { user, loading } = useAuth();
  const { form, isLoading, error, onSubmit, handleGoogleLogin } = useLoginForm();
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // Redirigir si ya está logueado
  useEffect(() => {
    if (user) {
      const userRole = user.user_metadata?.role || 'coach';
      const redirectPath = userRole === 'athlete' ? '/athlete/dashboard' : '/dashboard';
      navigate(redirectPath, { replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-white dark:bg-[#0A0A0A]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full space-y-8"
        >
          {/* Logo */}
          <div className="text-center">
            <Link to="/" className="inline-flex items-center space-x-2">
              <img src="/img/logo.png" alt="TrainingTrack" className="w-12 h-12 object-contain" />
              <span className="text-3xl font-bold text-sky-600 dark:text-sky-400">
                Training Track
              </span>
            </Link>
          </div>

          {/* Header */}
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              Bienvenido de nuevo
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Inicia sesión para acceder a tu cuenta
            </p>
          </div>

          {/* Google Login */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-200 dark:border-[#2A2A2A] rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200"
          >
            <FcGoogle className="w-6 h-6" />
            <span className="font-medium text-gray-700 dark:text-gray-300">
              Continuar con Google
            </span>
          </motion.button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-[#2A2A2A]" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white dark:bg-[#0A0A0A] text-gray-500">
                o continúa con email
              </span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
            >
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <div className="relative">
                <HiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  {...form.register('email')}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 dark:border-[#2A2A2A] rounded-xl bg-white dark:bg-[#141414] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 transition-colors"
                  placeholder="tu@email.com"
                />
              </div>
              {form.formState.errors.email && (
                <p className="mt-1 text-sm text-red-500">{form.formState.errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <HiLockClosed className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...form.register('password')}
                  className="w-full pl-10 pr-12 py-3 border-2 border-gray-200 dark:border-[#2A2A2A] rounded-xl bg-white dark:bg-[#141414] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? <HiEyeOff className="w-5 h-5" /> : <HiEye className="w-5 h-5" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="mt-1 text-sm text-red-500">{form.formState.errors.password.message}</p>
              )}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...form.register('rememberMe')}
                  className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
                />
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                  Recordarme
                </span>
              </label>
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-sky-600 hover:text-sky-500 dark:text-sky-400"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Iniciando sesión...
                </span>
              ) : (
                'Iniciar Sesión'
              )}
            </motion.button>
          </form>

          {/* Register Link */}
          <p className="text-center text-gray-600 dark:text-gray-400">
            ¿No tienes cuenta?{' '}
            <Link
              to="/register"
              className="font-semibold text-sky-600 hover:text-sky-500 dark:text-sky-400"
            >
              Regístrate gratis
            </Link>
          </p>
        </motion.div>
      </div>

      {/* Right Side - Image/Branding */}
      <div className="hidden lg:flex lg:flex-1 bg-sky-600 relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-sky-400/20 rounded-full blur-3xl" />
        </div>

        <div className="relative flex flex-col items-center justify-center p-12 text-white">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-left max-w-lg"
          >
            <h2 className="text-4xl font-bold mb-5">
              Tu rendimiento, controlado al detalle
            </h2>
            <p className="text-lg text-sky-100 mb-10">
              Planes de entrenamiento, seguimiento Strava, análisis de carga y comunicación directa entre entrenador y atleta — todo en un solo lugar.
            </p>

            {/* Features */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-4 bg-white/10 rounded-2xl px-5 py-4">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172H17.44l-2.053 4.116zm-7.008-7.27H3.62l2.332 4.667 2.427-4.667zm4.943 0h-3.817l1.908 3.817 1.909-3.817zm3.414 0h-2.427l-1.909 3.817 1.91 3.815 2.426-7.632zM3.62 10.5h5.157L6.345 5.838 3.62 10.5zm4.943 0h3.817L10.47 5.838 8.563 10.5zm4.943 0h2.332L13.413 5.838 13.506 10.5z"/></svg>
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">Sincronización con Strava</p>
                  <p className="text-sky-200 text-xs mt-0.5">Completa entrenamientos automáticamente al subir tu actividad</p>
                </div>
              </div>
              <div className="flex items-center gap-4 bg-white/10 rounded-2xl px-5 py-4">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">Informes semanales con IA</p>
                  <p className="text-sky-200 text-xs mt-0.5">Análisis automático de carga, fatiga y progresión por atleta</p>
                </div>
              </div>
              <div className="flex items-center gap-4 bg-white/10 rounded-2xl px-5 py-4">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">Planificación y material compartido</p>
                  <p className="text-sky-200 text-xs mt-0.5">Mesociclos, microciclos y PDFs de gym accesibles para tus atletas</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

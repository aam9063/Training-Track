import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HiMail, HiLockClosed, HiEye, HiEyeOff } from 'react-icons/hi';
import { FcGoogle } from 'react-icons/fc';
import { useAuth } from '../contexts/AuthContext';
import useLoginForm from '../hooks/useLoginForm';

export default function Login() {
  const { user, loading } = useAuth();
  const { form, isLoading, error, onSubmit, handleGoogleLogin } = useLoginForm();
  const [showPassword, setShowPassword] = useState(false);

  // Redirigir si ya está logueado
  useEffect(() => {
    if (user) {
      const userRole = user.user_metadata?.role || 'coach';
      const redirectPath = userRole === 'athlete' ? '/athlete/dashboard' : '/dashboard';
      window.location.replace(redirectPath);
    }
  }, [user, loading]);

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-900">
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
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200"
          >
            <FcGoogle className="w-6 h-6" />
            <span className="font-medium text-gray-700 dark:text-gray-300">
              Continuar con Google
            </span>
          </motion.button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white dark:bg-gray-900 text-gray-500">
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
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 transition-colors"
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
                  className="w-full pl-10 pr-12 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 transition-colors"
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
            className="text-center max-w-lg"
          >
            <h2 className="text-4xl font-bold mb-6">
              Gestiona tus entrenamientos como un profesional
            </h2>
            <p className="text-xl text-sky-100 mb-8">
              Únete a cientos de entrenadores y atletas que ya confían en Training Track para alcanzar sus metas.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 mt-12">
              <div className="text-center">
                <div className="text-3xl font-bold">500+</div>
                <div className="text-sky-200 text-sm">Entrenadores</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">5000+</div>
                <div className="text-sky-200 text-sm">Atletas</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">98%</div>
                <div className="text-sky-200 text-sm">Satisfacción</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HiUser, HiMail, HiLockClosed, HiEye, HiEyeOff, HiUserGroup, HiAcademicCap, HiArrowLeft, HiLockOpen, HiShieldCheck } from 'react-icons/hi';
import { FcGoogle } from 'react-icons/fc';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// Toggle: set to false to require invite link for registration
const OPEN_REGISTRATION = false;

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp, signInWithGoogle } = useAuth();
  const [step, setStep] = useState(1); // 1: role selection, 2: form
  const [role, setRole] = useState(null); // 'coach' or 'athlete'
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [inviteCoachId, setInviteCoachId] = useState(null);
  const [inviteCoachName, setInviteCoachName] = useState(null);
  const [loadingInvite, setLoadingInvite] = useState(false);

  // Detect invite link and fetch coach info
  useEffect(() => {
    const inviteId = searchParams.get('invite');
    if (inviteId) {
      setLoadingInvite(true);
      supabase.rpc('get_coach_public_info', { coach_uuid: inviteId })
        .then(({ data, error }) => {
          if (!error && data?.length > 0) {
            setInviteCoachId(inviteId);
            setInviteCoachName(`${data[0].first_name} ${data[0].last_name}`);
            setRole('athlete');
            setStep(2);
          }
          setLoadingInvite(false);
        });
    }
  }, [searchParams]);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    coachEmail: '', // Only for athletes
    acceptTerms: false,
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'El nombre es requerido';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'El apellido es requerido';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'El email es requerido';
    } else if (!/^[^\s@]+@[^\s@]+/.test(formData.email)) {
      // Validación más permisiva para desarrollo - solo requiere algo@algo
      newErrors.email = 'El email debe contener @';
    }

    if (!formData.password) {
      newErrors.password = 'La contraseña es requerida';
    } else if (formData.password.length < 8) {
      newErrors.password = 'La contraseña debe tener al menos 8 caracteres';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }

    if (role === 'athlete' && !inviteCoachId && !formData.coachEmail.trim()) {
      newErrors.coachEmail = 'El email de tu entrenador es requerido';
    } else if (role === 'athlete' && !inviteCoachId && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.coachEmail)) {
      newErrors.coachEmail = 'Email del entrenador inválido';
    }

    if (!formData.acceptTerms) {
      newErrors.acceptTerms = 'Debes aceptar los términos y condiciones';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const { error } = await signUp({
        email: formData.email,
        password: formData.password,
        role: role,
        firstName: formData.firstName,
        lastName: formData.lastName,
        coachEmail: role === 'athlete' && !inviteCoachId ? formData.coachEmail : null,
        coachId: inviteCoachId || null,
      });

      if (error) throw error;

      // Show success message
      setSuccessMessage('¡Cuenta creada exitosamente! Redirigiendo al login...');

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      console.error('Registration error:', error);
      setErrors({
        general: error.message || 'Error al crear la cuenta. Intenta de nuevo.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    if (!role) {
      setErrors({ general: 'Por favor selecciona tu rol primero' });
      return;
    }

    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
    } catch (error) {
      console.error('Google register error:', error);
      setErrors({ general: 'Error al registrar con Google' });
    }
  };

  const selectRole = (selectedRole) => {
    setRole(selectedRole);
    setStep(2);
  };

  const goBack = () => {
    setStep(1);
    setRole(null);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-900 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full space-y-6"
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

          {loadingInvite && (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-sky-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          )}

          <AnimatePresence mode="wait">
            {!loadingInvite && step === 1 && !OPEN_REGISTRATION && !inviteCoachId ? (
              /* Invite-only gate */
              <motion.div
                key="invite-only"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                    <HiShieldCheck className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Acceso por invitación
                  </h2>
                  <p className="mt-3 text-gray-600 dark:text-gray-400 leading-relaxed">
                    Training Track se encuentra actualmente en fase de desarrollo.
                    El registro está disponible únicamente mediante enlace de invitación de tu entrenador.
                  </p>
                </div>

                <div className="p-4 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl">
                  <div className="flex items-start gap-3">
                    <HiLockOpen className="w-5 h-5 text-sky-600 dark:text-sky-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-sky-700 dark:text-sky-300">
                      <p className="font-medium">¿Cómo registrarte?</p>
                      <p className="mt-1">Solicita a tu entrenador que te envíe un enlace de invitación. Con ese enlace podrás crear tu cuenta directamente.</p>
                    </div>
                  </div>
                </div>

                <p className="text-center text-gray-600 dark:text-gray-400">
                  ¿Ya tienes cuenta?{' '}
                  <Link
                    to="/login"
                    className="font-semibold text-sky-600 hover:text-sky-500 dark:text-sky-400"
                  >
                    Inicia sesión
                  </Link>
                </p>
              </motion.div>
            ) : !loadingInvite && step === 1 ? (
              /* Step 1: Role Selection (only when OPEN_REGISTRATION = true) */
              <motion.div
                key="role-selection"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Crear cuenta
                  </h2>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    ¿Cómo quieres usar Training Track?
                  </p>
                </div>

                {/* Role Cards */}
                <div className="space-y-4">
                  {/* Coach Card */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => selectRole('coach')}
                    className="w-full p-6 border-2 border-gray-200 dark:border-gray-700 rounded-2xl hover:border-sky-500 dark:hover:border-sky-400 transition-all duration-200 text-left group"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="w-14 h-14 bg-sky-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <HiAcademicCap className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                          Soy Entrenador
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                          Gestiona atletas, crea planes de entrenamiento y analiza el rendimiento de tu equipo.
                        </p>
                      </div>
                    </div>
                  </motion.button>

                  {/* Athlete Card */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => selectRole('athlete')}
                    className="w-full p-6 border-2 border-gray-200 dark:border-gray-700 rounded-2xl hover:border-sky-500 dark:hover:border-sky-400 transition-all duration-200 text-left group"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="w-14 h-14 bg-sky-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <HiUserGroup className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                          Soy Atleta
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                          Accede a tus entrenamientos, visualiza tu progreso y comunícate con tu entrenador.
                        </p>
                      </div>
                    </div>
                  </motion.button>
                </div>

                {/* Login Link */}
                <p className="text-center text-gray-600 dark:text-gray-400">
                  ¿Ya tienes cuenta?{' '}
                  <Link
                    to="/login"
                    className="font-semibold text-sky-600 hover:text-sky-500 dark:text-sky-400"
                  >
                    Inicia sesión
                  </Link>
                </p>
              </motion.div>
            ) : (
              /* Step 2: Registration Form */
              <motion.div
                key="registration-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Back Button */}
                {!inviteCoachId && (
                  <button
                    onClick={goBack}
                    className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    <HiArrowLeft className="w-5 h-5 mr-2" />
                    Volver
                  </button>
                )}

                {/* Header */}
                <div className="text-center">
                  <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 bg-sky-600`}>
                    {role === 'coach' ? (
                      <HiAcademicCap className="w-8 h-8 text-white" />
                    ) : (
                      <HiUserGroup className="w-8 h-8 text-white" />
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Registro como {role === 'coach' ? 'Entrenador' : 'Atleta'}
                  </h2>
                </div>

                {/* Google Register */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleGoogleRegister}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200"
                >
                  <FcGoogle className="w-6 h-6" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Registrarse con Google
                  </span>
                </motion.button>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white dark:bg-gray-900 text-gray-500">
                      o completa el formulario
                    </span>
                  </div>
                </div>

                {/* Success Message */}
                {successMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl"
                  >
                    <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>
                  </motion.div>
                )}

                {/* Error Message */}
                {errors.general && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
                  >
                    <p className="text-sm text-red-600 dark:text-red-400">{errors.general}</p>
                  </motion.div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Name Fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Nombre
                      </label>
                      <div className="relative">
                        <HiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          id="firstName"
                          name="firstName"
                          type="text"
                          value={formData.firstName}
                          onChange={handleChange}
                          className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none transition-colors ${errors.firstName
                              ? 'border-red-500 focus:border-red-500'
                              : 'border-gray-200 dark:border-gray-700 focus:border-sky-500 dark:focus:border-sky-400'
                            }`}
                          placeholder="Juan"
                        />
                      </div>
                      {errors.firstName && (
                        <p className="mt-1 text-sm text-red-500">{errors.firstName}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Apellido
                      </label>
                      <input
                        id="lastName"
                        name="lastName"
                        type="text"
                        value={formData.lastName}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none transition-colors ${errors.lastName
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-gray-200 dark:border-gray-700 focus:border-sky-500 dark:focus:border-sky-400'
                          }`}
                        placeholder="Pérez"
                      />
                      {errors.lastName && (
                        <p className="mt-1 text-sm text-red-500">{errors.lastName}</p>
                      )}
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email
                    </label>
                    <div className="relative">
                      <HiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none transition-colors ${errors.email
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-gray-200 dark:border-gray-700 focus:border-sky-500 dark:focus:border-sky-400'
                          }`}
                        placeholder="tu@email.com"
                      />
                    </div>
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                    )}
                  </div>

                  {/* Invite Banner */}
                  {inviteCoachId && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <HiUserGroup className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            Invitación de {inviteCoachName}
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-300">
                            Te registrarás como atleta de este entrenador
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Coach Email (Only for Athletes without invite) */}
                  {role === 'athlete' && !inviteCoachId && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ duration: 0.3 }}
                    >
                      <label htmlFor="coachEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Email de tu Entrenador
                      </label>
                      <div className="relative">
                        <HiAcademicCap className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          id="coachEmail"
                          name="coachEmail"
                          type="email"
                          value={formData.coachEmail}
                          onChange={handleChange}
                          className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none transition-colors ${errors.coachEmail
                              ? 'border-red-500 focus:border-red-500'
                              : 'border-gray-200 dark:border-gray-700 focus:border-sky-500 dark:focus:border-sky-400'
                            }`}
                          placeholder="entrenador@email.com"
                        />
                      </div>
                      {errors.coachEmail && (
                        <p className="mt-1 text-sm text-red-500">{errors.coachEmail}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Tu entrenador recibirá una notificación para aceptarte en su equipo
                      </p>
                    </motion.div>
                  )}

                  {/* Password */}
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Contraseña
                    </label>
                    <div className="relative">
                      <HiLockClosed className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={handleChange}
                        className={`w-full pl-10 pr-12 py-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none transition-colors ${errors.password
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-gray-200 dark:border-gray-700 focus:border-sky-500 dark:focus:border-sky-400'
                          }`}
                        placeholder="Mínimo 8 caracteres"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {showPassword ? <HiEyeOff className="w-5 h-5" /> : <HiEye className="w-5 h-5" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="mt-1 text-sm text-red-500">{errors.password}</p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Confirmar Contraseña
                    </label>
                    <div className="relative">
                      <HiLockClosed className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className={`w-full pl-10 pr-12 py-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none transition-colors ${errors.confirmPassword
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-gray-200 dark:border-gray-700 focus:border-sky-500 dark:focus:border-sky-400'
                          }`}
                        placeholder="Repite tu contraseña"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {showConfirmPassword ? <HiEyeOff className="w-5 h-5" /> : <HiEye className="w-5 h-5" />}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>
                    )}
                  </div>

                  {/* Terms Checkbox */}
                  <div>
                    <label className="flex items-start">
                      <input
                        type="checkbox"
                        name="acceptTerms"
                        checked={formData.acceptTerms}
                        onChange={handleChange}
                        className="w-4 h-4 mt-1 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
                      />
                      <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                        Acepto los{' '}
                        <Link to="/terms" className="text-sky-600 hover:text-sky-500 dark:text-sky-400">
                          Términos y Condiciones
                        </Link>{' '}
                        y la{' '}
                        <Link to="/privacy" className="text-sky-600 hover:text-sky-500 dark:text-sky-400">
                          Política de Privacidad
                        </Link>
                      </span>
                    </label>
                    {errors.acceptTerms && (
                      <p className="mt-1 text-sm text-red-500">{errors.acceptTerms}</p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-sky-600 hover:bg-sky-700"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creando cuenta...
                      </span>
                    ) : (
                      `Crear cuenta como ${role === 'coach' ? 'Entrenador' : 'Atleta'}`
                    )}
                  </motion.button>
                </form>

                {/* Login Link */}
                <p className="text-center text-gray-600 dark:text-gray-400">
                  ¿Ya tienes cuenta?{' '}
                  <Link
                    to="/login"
                    className="font-semibold text-sky-600 hover:text-sky-500 dark:text-sky-400"
                  >
                    Inicia sesión
                  </Link>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
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
              Únete a la comunidad Training Track
            </h2>
            <p className="text-xl text-sky-100 mb-8">
              La plataforma líder en gestión de entrenamientos para medio fondo y fondo. Desde 400m hasta maratón.
            </p>

            {/* Features */}
            <div className="space-y-4 text-left">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <HiAcademicCap className="w-5 h-5" />
                </div>
                <span>Planes de entrenamiento personalizados</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <HiUserGroup className="w-5 h-5" />
                </div>
                <span>Comunicación directa con tu equipo</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span>Análisis de rendimiento detallado</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

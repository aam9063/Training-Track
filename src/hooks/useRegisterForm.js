import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const registerSchema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido'),
  lastName: z.string().min(1, 'El apellido es requerido'),
  email: z
    .string()
    .min(1, 'El email es requerido')
    .regex(/^[^\s@]+@[^\s@]+/, 'El email debe contener @'),
  password: z
    .string()
    .min(1, 'La contraseña es requerida')
    .min(8, 'La contraseña debe tener al menos 8 caracteres'),
  confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
  coachEmail: z.string().optional(),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'Debes aceptar los términos y condiciones' }),
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

export default function useRegisterForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp, signInWithGoogle } = useAuth();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [inviteCoachId, setInviteCoachId] = useState(null);
  const [inviteCoachName, setInviteCoachName] = useState(null);
  const [loadingInvite, setLoadingInvite] = useState(false);

  const form = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      coachEmail: '',
      acceptTerms: false,
    },
  });

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

  const onSubmit = async (data) => {
    const isIndependentAthlete = role === 'independent_athlete';

    // Validate coachEmail for coached athletes without invite
    if (role === 'athlete' && !inviteCoachId && !data.coachEmail?.trim()) {
      form.setError('coachEmail', { message: 'El email de tu entrenador es requerido' });
      return;
    }
    if (role === 'athlete' && !inviteCoachId && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.coachEmail)) {
      form.setError('coachEmail', { message: 'Email del entrenador inválido' });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await signUp({
        email: data.email,
        password: data.password,
        role: isIndependentAthlete ? 'athlete' : role,
        firstName: data.firstName,
        lastName: data.lastName,
        coachEmail: role === 'athlete' && !inviteCoachId ? data.coachEmail : null,
        coachId: inviteCoachId || null,
        isIndependent: isIndependentAthlete,
      });

      if (error) throw error;

      setSuccessMessage('¡Cuenta creada exitosamente! Redirigiendo al login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      form.setError('root', {
        message: err.message || 'Error al crear la cuenta. Intenta de nuevo.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    if (!role) {
      form.setError('root', { message: 'Por favor selecciona tu rol primero' });
      return;
    }

    try {
      const { error } = await signInWithGoogle({
        role,
        coachId: inviteCoachId || null,
        coachEmail: role === 'athlete' && !inviteCoachId ? form.getValues('coachEmail') : null,
      });
      if (error) throw error;
    } catch (err) {
      form.setError('root', { message: 'Error al registrar con Google' });
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

  return {
    form,
    step,
    role,
    isLoading,
    successMessage,
    inviteCoachId,
    inviteCoachName,
    loadingInvite,
    onSubmit: form.handleSubmit(onSubmit),
    handleGoogleRegister,
    selectRole,
    goBack,
  };
}

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'El email es requerido')
    .email('Email inválido'),
  password: z
    .string()
    .min(1, 'La contraseña es requerida'),
  rememberMe: z.boolean().optional(),
});

export default function useLoginForm() {
  const { signIn, signInWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    setError('');

    try {
      // Check if user registered with Google before attempting password login
      const { data: provider } = await supabase.rpc('check_auth_provider', { p_email: data.email });

      if (provider === 'google') {
        setError('Esta cuenta está vinculada a Google. Usa el botón "Iniciar sesión con Google".');
        setIsLoading(false);
        return;
      }

      const result = await signIn({
        email: data.email,
        password: data.password,
      });

      if (result.error) throw result.error;

      const userRole = result.data?.user?.user_metadata?.role || 'coach';
      const redirectPath = userRole === 'athlete' ? '/athlete/dashboard' : '/dashboard';

      setTimeout(() => {
        window.location.replace(redirectPath);
      }, 100);
    } catch (err) {
      let errorMessage = 'Error al iniciar sesión.';

      if (err.message?.includes('Email not confirmed')) {
        errorMessage = 'Debes confirmar tu email antes de iniciar sesión. Revisa tu bandeja de entrada.';
      } else if (err.message?.includes('Invalid login credentials')) {
        errorMessage = 'Email o contraseña incorrectos.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
    } catch (err) {
      setError('Error al iniciar sesión con Google', err);
    }
  };

  return {
    form,
    isLoading,
    error,
    onSubmit: form.handleSubmit(onSubmit),
    handleGoogleLogin,
  };
}

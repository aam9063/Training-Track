-- ============================================
-- CONFIGURACIÓN MODO DESARROLLO
-- Desactivar confirmación de email
-- ============================================

-- NOTA: Este script NO cambia la configuración de Supabase Auth
-- Debes cambiar la configuración manualmente en:
-- Dashboard > Authentication > Settings > Email Auth
-- 
-- 1. Desactiva "Confirm email"
-- 2. Activa "Enable email autoconfirm" (opcional)
--
-- ALTERNATIVA: Usar este SQL para autoconfirmar usuarios existentes

-- Confirmar TODOS los usuarios no confirmados (solo para desarrollo)
UPDATE auth.users 
SET 
  email_confirmed_at = NOW(),
  confirmed_at = NOW()
WHERE 
  email_confirmed_at IS NULL 
  OR confirmed_at IS NULL;

-- Verificar usuarios confirmados
SELECT 
  id,
  email,
  email_confirmed_at,
  confirmed_at,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- ============================================
-- IMPORTANTE: 
-- Esta configuración es SOLO PARA DESARROLLO
-- En producción SIEMPRE debes:
-- - Activar confirmación de email
-- - Usar emails válidos
-- - Validar emails correctamente
-- ============================================

-- ============================================
-- CONFIRMAR USUARIO MANUALMENTE
-- Para poder iniciar sesión sin verificar email
-- ============================================

-- Confirmar tu usuario específico
UPDATE auth.users 
SET email_confirmed_at = NOW(),
    confirmed_at = NOW()
WHERE email = 'albert9063@gmail.com';

-- Verificar que se confirmó
SELECT 
  id,
  email,
  email_confirmed_at,
  confirmed_at,
  created_at
FROM auth.users
WHERE email = 'albert9063@gmail.com';

-- Si ves email_confirmed_at con una fecha, está confirmado ✅

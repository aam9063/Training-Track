# Supabase Auth Email Templates — TrainingTrack

Esta carpeta contiene las 6 plantillas HTML con el branding de TrainingTrack para los emails de autenticación de Supabase Auth.

## Contenido

| Archivo | Tipo de email (Supabase) | Subject |
|---|---|---|
| `confirm-signup.html` | Confirm signup | `Confirma tu cuenta en TrainingTrack` |
| `invite-user.html` | Invite user | `Te invitan a TrainingTrack` |
| `magic-link.html` | Magic Link | `Tu enlace de acceso a TrainingTrack` |
| `change-email.html` | Change Email Address | `Confirma tu nuevo email` |
| `reset-password.html` | Reset Password | `Restablece tu contraseña de TrainingTrack` |
| `reauthentication.html` | Reauthentication | `Código de verificación TrainingTrack` |

## Importante

**Estas plantillas NO se suben automáticamente a Supabase.** Supabase Auth usa su propio motor de plantillas basado en Go templates (variables `{{ .Variable }}`). No existe una CLI oficial para sincronizar estas plantillas: hay que copiarlas manualmente en el Dashboard de Supabase.

Este repo las mantiene como fuente de verdad (source of truth) para poder versionarlas y re-aplicarlas si fuera necesario.

## Cómo aplicarlas en Supabase

1. Abre el Dashboard de Supabase del proyecto `lusirdkixfliydimemre`.
2. Ve a **Authentication → Emails → Templates**.
3. Por cada una de las 6 plantillas:
   - Haz clic en la plantilla correspondiente (ej. "Confirm signup").
   - Copia el **Subject** de la tabla de arriba en el campo "Subject heading".
   - Abre el archivo `.html` local, copia todo su contenido y pégalo en el editor de HTML de Supabase (sobrescribiendo lo existente).
   - Haz clic en **Save**.
4. Repite para las 6 plantillas.

## Subjects a configurar

Lista rápida para copiar/pegar en el campo Subject de cada plantilla:

- **Confirm signup**: `Confirma tu cuenta en TrainingTrack`
- **Invite user**: `Te invitan a TrainingTrack`
- **Magic Link**: `Tu enlace de acceso a TrainingTrack`
- **Change Email Address**: `Confirma tu nuevo email`
- **Reset Password**: `Restablece tu contraseña de TrainingTrack`
- **Reauthentication**: `Código de verificación TrainingTrack`

## Variables disponibles

Cada plantilla usa variables del motor Go de Supabase Auth:

- `{{ .ConfirmationURL }}` — enlace de acción (todos menos Reauthentication)
- `{{ .Email }}` — email actual del usuario
- `{{ .NewEmail }}` — solo en Change Email
- `{{ .SiteURL }}` — solo en Invite user
- `{{ .Token }}` — código OTP, solo en Reauthentication

## Branding

- Logo: `https://lusirdkixfliydimemre.supabase.co/storage/v1/object/public/site-assets/email-logo.png`
- Color acento: `#1A6BFF`
- Fondo página: `#F7F7F8`
- Container: `#FFFFFF` con radius 12px
- Tipografía: system font stack (Apple/Segoe UI/Roboto)

## Pruebas

Tras aplicar una plantilla, prueba desde la app:

1. **Confirm signup** — registra un usuario nuevo.
2. **Magic link** — usa `signInWithOtp()` con un email.
3. **Reset password** — pulsa "Olvidé contraseña" en login.
4. **Change email** — desde perfil, cambia el email.
5. **Invite user** — desde Dashboard → Authentication → Users → Invite user.
6. **Reauthentication** — acciones sensibles que requieren reautenticar.

Verifica que el email llega en español, con logo visible y botones/código renderizados correctamente.

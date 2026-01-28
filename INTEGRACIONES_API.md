# 🔗 Guía de Integración de APIs - TrackPro

Esta guía explica cómo configurar las integraciones con dispositivos deportivos y plataformas de entrenamiento.

## 📋 Tabla de Contenidos

1. [Garmin Connect](#garmin-connect)
2. [COROS](#coros)
3. [Suunto](#suunto)
4. [Strava](#strava)
5. [Polar Flow](#polar-flow)
6. [Configuración del Proyecto](#configuración-del-proyecto)

---

## 🏃 Garmin Connect

### Paso 1: Crear una aplicación en Garmin Developer

1. Ve a [Garmin Developer](https://developer.garmin.com/)
2. Inicia sesión con tu cuenta de Garmin
3. Ve a **"Manage Apps"** → **"Create App"**
4. Completa los datos:
   - **App Name**: TrackPro
   - **App Type**: Web App
   - **OAuth Redirect URL**: `http://localhost:5174/auth/garmin/callback`
5. Guarda y obtén tu **Client ID** y **Client Secret**

### Paso 2: Configurar variables de entorno

Agrega a tu archivo `.env`:

```env
VITE_GARMIN_CLIENT_ID=tu_client_id_aqui
VITE_GARMIN_CLIENT_SECRET=tu_client_secret_aqui
VITE_GARMIN_REDIRECT_URI=http://localhost:5174/auth/garmin/callback
```

### Paso 3: Implementación OAuth 2.0

```javascript
// services/garminService.js
const GARMIN_AUTH_URL = 'https://connect.garmin.com/oauthConfirm';
const GARMIN_TOKEN_URL = 'https://connectapi.garmin.com/oauth-service/oauth/request_token';

export const connectGarmin = () => {
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_GARMIN_CLIENT_ID,
    redirect_uri: import.meta.env.VITE_GARMIN_REDIRECT_URI,
    response_type: 'code',
    scope: 'ACTIVITY_READ',
  });
  
  window.location.href = `${GARMIN_AUTH_URL}?${params}`;
};
```

### Documentación oficial:
- [Garmin Connect API Documentation](https://developer.garmin.com/connect-api/overview/)

---

## 🏔️ COROS

### Paso 1: Solicitar acceso a la API

1. Ve a [COROS Developer Portal](https://www.coros.com/developers)
2. Contacta con el equipo de COROS para solicitar acceso API
3. Proporciona información sobre tu aplicación
4. Espera la aprobación y recibe tu API Key

### Paso 2: Configurar variables de entorno

```env
VITE_COROS_API_KEY=tu_api_key_aqui
VITE_COROS_API_URL=https://open.coros.com/api/v1
```

### Paso 3: Implementación

```javascript
// services/corosService.js
import axios from 'axios';

const corosAPI = axios.create({
  baseURL: import.meta.env.VITE_COROS_API_URL,
  headers: {
    'Authorization': `Bearer ${import.meta.env.VITE_COROS_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

export const getCorosActivities = async (userId) => {
  const response = await corosAPI.get(`/activities/${userId}`);
  return response.data;
};
```

### Documentación oficial:
- [COROS Open API](https://www.coros.com/developers) (Contactar para acceso)

---

## ⌚ Suunto

### Paso 1: Registrar aplicación

1. Ve a [Suunto Developer Portal](https://apizone.suunto.com/)
2. Regístrate o inicia sesión
3. Crea una nueva aplicación
4. Configura los scopes: `workout`, `user:read`
5. Obtén tu **App Key** y **App Secret**

### Paso 2: Configurar variables de entorno

```env
VITE_SUUNTO_APP_KEY=tu_app_key_aqui
VITE_SUUNTO_APP_SECRET=tu_app_secret_aqui
VITE_SUUNTO_REDIRECT_URI=http://localhost:5174/auth/suunto/callback
```

### Paso 3: Implementación OAuth

```javascript
// services/suuntoService.js
const SUUNTO_AUTH_URL = 'https://cloudapi-oauth.suunto.com/oauth/authorize';
const SUUNTO_API_URL = 'https://cloudapi.suunto.com/v2';

export const connectSuunto = () => {
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_SUUNTO_APP_KEY,
    redirect_uri: import.meta.env.VITE_SUUNTO_REDIRECT_URI,
    response_type: 'code',
    scope: 'workout',
  });
  
  window.location.href = `${SUUNTO_AUTH_URL}?${params}`;
};
```

### Documentación oficial:
- [Suunto API Documentation](https://apizone.suunto.com/docs/)

---

## 🔶 Strava

### Paso 1: Crear aplicación en Strava

1. Ve a [Strava API Settings](https://www.strava.com/settings/api)
2. Crea una nueva aplicación:
   - **Application Name**: TrackPro
   - **Category**: Training
   - **Authorization Callback Domain**: `localhost`
3. Obtén tu **Client ID** y **Client Secret**

### Paso 2: Configurar variables de entorno

```env
VITE_STRAVA_CLIENT_ID=tu_client_id_aqui
VITE_STRAVA_CLIENT_SECRET=tu_client_secret_aqui
VITE_STRAVA_REDIRECT_URI=http://localhost:5174/auth/strava/callback
```

### Paso 3: Implementación OAuth 2.0

```javascript
// services/stravaService.js
const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

export const connectStrava = () => {
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_STRAVA_CLIENT_ID,
    redirect_uri: import.meta.env.VITE_STRAVA_REDIRECT_URI,
    response_type: 'code',
    scope: 'read,activity:read_all',
  });
  
  window.location.href = `${STRAVA_AUTH_URL}?${params}`;
};

export const exchangeToken = async (code) => {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: import.meta.env.VITE_STRAVA_CLIENT_ID,
      client_secret: import.meta.env.VITE_STRAVA_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
    }),
  });
  
  return response.json();
};
```

### Documentación oficial:
- [Strava API Documentation](https://developers.strava.com/docs/)
- [OAuth 2.0 Guide](https://developers.strava.com/docs/authentication/)

---

## ❄️ Polar Flow

### Paso 1: Registrar aplicación

1. Ve a [Polar AccessLink](https://www.polar.com/accesslink-api)
2. Regístrate como desarrollador
3. Crea una nueva aplicación OAuth2
4. Obtén tu **Client ID** y **Client Secret**

### Paso 2: Configurar variables de entorno

```env
VITE_POLAR_CLIENT_ID=tu_client_id_aqui
VITE_POLAR_CLIENT_SECRET=tu_client_secret_aqui
VITE_POLAR_REDIRECT_URI=http://localhost:5174/auth/polar/callback
```

### Paso 3: Implementación

```javascript
// services/polarService.js
const POLAR_AUTH_URL = 'https://flow.polar.com/oauth2/authorization';
const POLAR_API_URL = 'https://www.polaraccesslink.com/v3';

export const connectPolar = () => {
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_POLAR_CLIENT_ID,
    redirect_uri: import.meta.env.VITE_POLAR_REDIRECT_URI,
    response_type: 'code',
  });
  
  window.location.href = `${POLAR_AUTH_URL}?${params}`;
};
```

### Documentación oficial:
- [Polar AccessLink API](https://www.polar.com/accesslink-api)
- [API Reference](https://www.polar.com/accesslink-api/v3/)

---

## ⚙️ Configuración del Proyecto

### 1. Archivo `.env`

Crea o actualiza tu archivo `.env` en la raíz del proyecto Frontend:

```env
# Supabase
VITE_SUPABASE_URL=tu_supabase_url
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key

# Garmin Connect
VITE_GARMIN_CLIENT_ID=
VITE_GARMIN_CLIENT_SECRET=
VITE_GARMIN_REDIRECT_URI=http://localhost:5174/auth/garmin/callback

# COROS
VITE_COROS_API_KEY=
VITE_COROS_API_URL=https://open.coros.com/api/v1

# Suunto
VITE_SUUNTO_APP_KEY=
VITE_SUUNTO_APP_SECRET=
VITE_SUUNTO_REDIRECT_URI=http://localhost:5174/auth/suunto/callback

# Strava
VITE_STRAVA_CLIENT_ID=
VITE_STRAVA_CLIENT_SECRET=
VITE_STRAVA_REDIRECT_URI=http://localhost:5174/auth/strava/callback

# Polar Flow
VITE_POLAR_CLIENT_ID=
VITE_POLAR_CLIENT_SECRET=
VITE_POLAR_REDIRECT_URI=http://localhost:5174/auth/polar/callback
```

### 2. Crear servicios de integración

Crea una carpeta `src/services/integrations/` con un archivo para cada servicio:

```
src/
├── services/
│   ├── integrations/
│   │   ├── garminService.js
│   │   ├── corosService.js
│   │   ├── suuntoService.js
│   │   ├── stravaService.js
│   │   └── polarService.js
```

### 3. Implementar callbacks

Crea componentes para manejar los callbacks OAuth:

```javascript
// pages/auth/GarminCallback.jsx
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exchangeGarminToken } from '../../services/integrations/garminService';

const GarminCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      exchangeGarminToken(code)
        .then(() => {
          navigate('/athlete/devices?success=garmin');
        })
        .catch((error) => {
          console.error('Error:', error);
          navigate('/athlete/devices?error=garmin');
        });
    }
  }, [searchParams, navigate]);

  return <div>Conectando con Garmin...</div>;
};

export default GarminCallback;
```

### 4. Guardar tokens en Supabase

Crea una tabla en Supabase para almacenar los tokens:

```sql
CREATE TABLE device_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_type TEXT NOT NULL, -- 'garmin', 'coros', 'suunto', 'strava', 'polar'
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_type)
);

-- RLS policies
ALTER TABLE device_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own connections"
  ON device_connections
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## 🔒 Seguridad

### Buenas prácticas:

1. **Nunca expongas las API keys en el código frontend**
   - Usa variables de entorno con prefijo `VITE_`
   - Las claves secretas deben manejarse en el backend

2. **Implementa refresh tokens**
   - Guarda refresh tokens en Supabase
   - Renueva access tokens automáticamente

3. **Usa HTTPS en producción**
   - Configura URLs de callback con HTTPS
   - Actualiza las redirect URIs en cada plataforma

4. **Valida tokens en el backend**
   - Crea funciones Edge de Supabase para intercambiar códigos
   - Nunca expongas Client Secrets en el frontend

---

## 📚 Recursos adicionales

- [OAuth 2.0 Explained](https://www.oauth.com/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [React Query for API calls](https://tanstack.com/query/latest)

---

## 🆘 Soporte

Si tienes problemas con alguna integración:

1. Verifica que las credenciales sean correctas
2. Comprueba que las URLs de callback estén configuradas
3. Revisa los logs de la consola del navegador
4. Consulta la documentación oficial de cada plataforma

---

**TrackPro** - Sistema de gestión de entrenamiento deportivo

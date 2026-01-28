# 🏃 Dashboard de Atleta - TrackPro

## ✅ Implementación Completada

Se ha creado un dashboard completo y funcional para atletas con las siguientes características:

---

## 📁 Estructura de Archivos Creados

### Layouts
- `src/layouts/AthleteDashboardLayout.jsx` - Layout principal del dashboard de atleta

### Componentes
- `src/components/athlete/AthleteSidebar.jsx` - Sidebar específico para atletas (color verde)

### Páginas
1. `src/pages/athlete/Dashboard.jsx` - Dashboard principal
2. `src/pages/athlete/Training.jsx` - Cuadrante semanal de entrenamientos
3. `src/pages/athlete/Metrics.jsx` - Métricas y análisis de rendimiento
4. `src/pages/athlete/Devices.jsx` - Integración con dispositivos deportivos

### Documentación
- `INTEGRACIONES_API.md` - Guía completa de integración con APIs externas

---

## 🎨 Características Implementadas

### 1. Dashboard Principal (`/athlete/dashboard`)
- ✅ Tarjetas de estadísticas semanales
  - Kilómetros totales
  - Tiempo de entrenamiento
  - Ritmo promedio
  - Total histórico acumulado
- ✅ Lista de próximos entrenamientos
- ✅ Visualización con animaciones (Framer Motion)
- ✅ Tema oscuro/claro

### 2. Mis Entrenamientos (`/athlete/training`)
- ✅ **Cuadrante semanal Lunes-Domingo** (estilo Excel)
- ✅ Navegación entre semanas (anterior/siguiente)
- ✅ **Descarga en PDF** con jsPDF
- ✅ Información detallada por día:
  - Título del entrenamiento
  - Distancia
  - Ritmo objetivo
  - Duración
  - Notas del entrenador
- ✅ Diferenciación visual:
  - Entrenamientos de carrera
  - Entrenamientos de gimnasio
  - Días de descanso
- ✅ Destacado del día actual

### 3. Mis Métricas (`/athlete/metrics`)
- ✅ Métricas físicas:
  - VO₂ Max
  - FC Reposo
  - FC Máxima
  - Peso
  - % Grasa corporal
- ✅ **Gráficos interactivos** (Chart.js):
  - Progresión semanal de kilómetros (línea)
  - Distribución de ritmos por distancia (barras)
- ✅ **Marcas personales**:
  - 5K, 10K, 21K, 42K
  - Tiempo, ritmo y fecha
- ✅ Cards con gradientes de colores

### 4. Dispositivos (`/athlete/devices`)
- ✅ Integración preparada para:
  - **Garmin Connect** ⌚
  - **COROS** 🏃
  - **Suunto** ⌚
  - **Strava** 🔶
  - **Polar Flow** ❄️
- ✅ UI completa con:
  - Estado de conexión
  - Botones de conectar/desconectar
  - Indicadores visuales
  - Sincronización manual
- ✅ **Guía de integración** incluida
- ✅ Banner informativo con instrucciones
- ✅ Preparado para OAuth 2.0

---

## 🔄 Sistema de Rutas y Redirección

### Rutas implementadas:
```
/athlete/dashboard  - Dashboard principal
/athlete/training   - Entrenamientos semanales
/athlete/metrics    - Métricas y análisis
/athlete/devices    - Dispositivos conectados
/athlete/profile    - Perfil del atleta
```

### Lógica de redirección:
- ✅ **Login detecta rol automáticamente**:
  - Coach → `/dashboard`
  - Atleta → `/athlete/dashboard`
- ✅ **Protección de rutas**:
  - Coaches no pueden acceder a `/athlete/*`
  - Atletas no pueden acceder a `/dashboard` (coach)
- ✅ **Fallback con user metadata** si profile no carga

---

## 📦 Dependencias Instaladas

```json
{
  "jspdf": "^2.x",
  "jspdf-autotable": "^3.x"
}
```

---

## 🎯 Cómo Usar

### 1. Registro como Atleta
```
1. Ve a /register
2. Selecciona rol "Atleta"
3. Completa el formulario
4. Automáticamente redirige a /athlete/dashboard
```

### 2. Login como Atleta
```
1. Ve a /login
2. Inicia sesión
3. Detecta rol automáticamente
4. Redirige a /athlete/dashboard
```

### 3. Descargar Plan Semanal
```
1. Ve a /athlete/training
2. Click en "Descargar PDF"
3. Se genera un PDF con:
   - Título y fechas
   - Tabla con todos los entrenamientos
   - Notas y detalles
```

---

## 🔧 Configuración de APIs (Opcional)

Para activar las integraciones con dispositivos:

### 1. Obtén credenciales OAuth de cada plataforma
- Garmin Developer
- COROS Developer (solicitar acceso)
- Suunto API Zone
- Strava API Settings
- Polar AccessLink

### 2. Configura el archivo `.env`

```env
# Garmin
VITE_GARMIN_CLIENT_ID=tu_client_id
VITE_GARMIN_CLIENT_SECRET=tu_secret

# COROS
VITE_COROS_API_KEY=tu_api_key

# Suunto
VITE_SUUNTO_APP_KEY=tu_app_key
VITE_SUUNTO_APP_SECRET=tu_secret

# Strava
VITE_STRAVA_CLIENT_ID=tu_client_id
VITE_STRAVA_CLIENT_SECRET=tu_secret

# Polar
VITE_POLAR_CLIENT_ID=tu_client_id
VITE_POLAR_CLIENT_SECRET=tu_secret
```

### 3. Implementa los servicios OAuth

Consulta el archivo `INTEGRACIONES_API.md` para guías detalladas de cada integración.

---

## 🎨 Diseño y UX

### Paleta de colores (Atleta)
- **Principal**: Verde (`from-green-500 to-green-600`)
- **Acento**: Azul, Naranja, Púrpura (según tipo)
- **Fondo**: Gris claro / Gris oscuro (tema)

### Diferenciación con Coach Dashboard
- **Coach**: Logo y acentos en azul/púrpura
- **Atleta**: Logo y acentos en verde
- **Sidebar**: Diferente estructura de menú

### Animaciones
- Todas las tarjetas tienen animación de entrada
- Transiciones suaves en hover
- Feedback visual en interacciones

---

## 📊 Datos de Ejemplo

Actualmente usa datos estáticos de ejemplo. Para conectar con Supabase:

1. Crear tablas en Supabase:
   - `athlete_sessions` (entrenamientos programados)
   - `athlete_metrics` (métricas de rendimiento)
   - `personal_bests` (marcas personales)
   - `device_connections` (tokens OAuth)

2. Crear servicios en `src/services/athlete/`:
   - `athleteTrainingService.js`
   - `athleteMetricsService.js`
   - `deviceConnectionService.js`

3. Reemplazar datos estáticos con llamadas a Supabase

---

## 🚀 Próximos Pasos Recomendados

### Base de datos:
1. Crear schema SQL para atletas
2. Implementar RLS policies
3. Crear funciones para cálculos automáticos

### Backend:
1. Crear Edge Functions para OAuth callbacks
2. Implementar sincronización automática de dispositivos
3. Sistema de notificaciones push

### Frontend:
1. Conectar con APIs reales de Supabase
2. Implementar sincronización en tiempo real
3. Agregar PWA support para uso offline

---

## 📝 Notas Importantes

- ✅ El dashboard de atleta es completamente independiente del de coach
- ✅ Todas las rutas están protegidas con verificación de rol
- ✅ El PDF se genera completamente en el cliente (sin backend)
- ✅ Las integraciones están preparadas pero requieren configuración
- ✅ El diseño es responsive y funciona en móviles
- ✅ Soporta tema oscuro/claro

---

## 🐛 Testing

Para probar el dashboard de atleta:

```bash
# 1. Inicia el servidor
npm run dev

# 2. Registra un usuario con rol "Atleta"
# Ve a: http://localhost:5174/register

# 3. Inicia sesión
# Ve a: http://localhost:5174/login

# 4. Explora las secciones:
# - Dashboard principal
# - Mis Entrenamientos (prueba descargar PDF)
# - Mis Métricas (ve los gráficos)
# - Dispositivos (lee la guía de integración)
```

---

**¡Dashboard de Atleta listo para usar! 🎉**

Todas las vistas son funcionales y están preparadas para conectarse con datos reales cuando implementes la lógica de backend.

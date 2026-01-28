# 📊 Dashboard de TrackPro - Guía Completa

## 🎯 Estructura del Dashboard

### Sidebar Extensible
- **Posición**: Fija a la izquierda
- **Funcionalidad**: Se puede colapsar/expandir con el botón de chevron
- **Estado colapsado**: Solo muestra iconos
- **Estado expandido**: Muestra iconos + texto
- **Secciones**:
  - 🏠 Dashboard (Vista principal)
  - 👥 Mis Atletas
  - 📊 Métricas
  - 📅 Calendario
  - 👤 Perfil de usuario (abajo)

### 1. Dashboard Principal (`/dashboard`)
**Características:**
- 4 tarjetas de estadísticas generales:
  - Total de atletas activos
  - Sesiones de esta semana
  - Sesiones completadas
  - Tasa de finalización
- Agenda del día actual con sesiones programadas
- Acceso rápido a los 5 atletas más recientes
- Animaciones suaves con Framer Motion

**Servicios utilizados:**
- `getCoachStats()` - Obtiene estadísticas del coach
- `getTodaySessions()` - Obtiene sesiones de hoy
- `getRecentAthletes()` - Obtiene atletas recientes

### 2. Mis Atletas (`/dashboard/athletes`)
**Características:**
- Tabla completa de atletas con:
  - Avatar, nombre y apellidos
  - Email de contacto
  - Especialidades (badges)
  - VO2 Max
- **Filtros**:
  - Búsqueda por nombre o email
  - Filtro por modalidad/especialidad
- **Acciones por atleta**:
  - 📊 Ver métricas individuales
  - 👤 Ver perfil completo
  - ✏️ Editar información
  - 🗑️ Eliminar atleta (con confirmación)
- Modal de confirmación para eliminaciones
- Animaciones de entrada escalonadas

**Servicios utilizados:**
- `getAthletes()` - Lista todos los atletas del coach
- `removeAthlete()` - Elimina relación coach-atleta

### 3. Métricas (`/dashboard/metrics`)
**Características:**
- 4 tarjetas de métricas clave:
  - Ritmo promedio
  - Carga acumulada
  - Tasa de finalización
  - Nuevas marcas personales
- **Filtros**:
  - Selector de atleta (individual o todos)
  - Rango de fechas (7, 30, 90, 180 días)
- **Gráficos** (Chart.js):
  - Progresión de ritmo (Line Chart)
  - Carga de entrenamiento semanal (Bar Chart)
  - Distribución de tipos de entrenamiento (Doughnut)
  - Lista de mejores rendimientos
- Modo oscuro/claro totalmente compatible

**Servicios utilizados:**
- `getAllAthletesPerformance()` - Métricas de todos los atletas
- `getAthletePerformance()` - Métricas individuales

### 4. Calendario (`/dashboard/calendar`)
**Características:**
- Vista mensual completa
- Navegación entre meses (anterior/siguiente)
- Botón "Hoy" para volver al mes actual
- Día actual resaltado con borde azul
- **Sesiones visuales**:
  - Cada día muestra hasta 2 sesiones
  - Indicador "+X más" si hay más sesiones
  - Colores por tipo de entrenamiento:
    - 🔵 Azul: Carrera
    - 🟣 Morado: Gimnasio
    - 🟢 Verde: Descanso
    - 🟠 Naranja: Cross training
- **Modal de creación de eventos**:
  - Título del evento
  - Selección de atleta
  - Tipo de entrenamiento
  - Hora (opcional)
  - Descripción (opcional)
- Leyenda de colores
- Click en cualquier día para crear evento

**Servicios utilizados:**
- `getMonthSessions()` - Obtiene sesiones del mes
- `createSession()` - Crea nueva sesión
- `getAthletes()` - Lista atletas para selector

### 5. Perfil (`/dashboard/profile`)
**Características:**
- Vista/edición de información personal:
  - Nombre y apellidos
  - Email (no editable)
  - Teléfono
- Información profesional (coach):
  - Biografía
  - Años de experiencia
  - Especialidades
- Avatar con iniciales si no hay foto
- Modo edición/vista separados
- Guardado con validación

## 🎨 Características de Diseño

### Modo Oscuro/Claro
- Totalmente compatible con ambos modos
- Cambio automático según preferencias del sistema
- Colores optimizados para cada modo

### Responsive Design
- **Desktop**: Sidebar expandido por defecto
- **Tablet/Mobile**: Sidebar colapsado automáticamente
- Todas las tablas y grids son responsive
- Scroll horizontal en tablas cuando es necesario

### Animaciones
- Entrada de componentes con Framer Motion
- Transiciones suaves en hover
- Loading states en todas las peticiones
- Animaciones escalonadas en listas

### Accesibilidad
- Tooltips en botones cuando el sidebar está colapsado
- Títulos descriptivos en iconos
- Contraste de color adecuado
- Navegación por teclado

## 🔧 Servicios API

### athleteService.js
```javascript
- getAthletes(coachId)           // Lista atletas del coach
- getAthleteDetails(athleteId)   // Detalles de un atleta
- updateAthlete(athleteId, data) // Actualiza datos
- removeAthlete(relationshipId)  // Elimina relación
- getAthleteMetrics(...)         // Métricas del atleta
```

### dashboardService.js
```javascript
- getCoachStats(coachId)         // Estadísticas generales
- getTodaySessions(coachId)      // Sesiones de hoy
- getRecentAthletes(coachId)     // Últimos atletas
- getWeeklySummary(coachId)      // Resumen semanal
```

### metricsService.js
```javascript
- getAthletePerformance(...)     // Rendimiento individual
- getAllAthletesPerformance(...) // Rendimiento de todos
- getWeeklyAnalytics(...)        // Analytics semanales
- calculatePaceImprovement(...)  // Cálculo de mejora
- calculateLoadTrend(...)        // Tendencia de carga
```

### calendarService.js
```javascript
- getMonthSessions(...)          // Sesiones del mes
- createSession(data)            // Crea sesión
- updateSession(id, data)        // Actualiza sesión
- deleteSession(id)              // Elimina sesión
- getConconiTests(...)           // Tests de Conconi
```

## 🚀 Cómo Usar

### Inicio de Sesión
1. Inicia sesión como coach en `/login`
2. Serás redirigido automáticamente a `/dashboard`

### Navegación
- Usa el sidebar para cambiar entre secciones
- Click en el botón de colapsar para más espacio
- Los atletas se añaden automáticamente cuando se registran con tu email

### Crear Sesiones
1. Ve a Calendario
2. Click en "Crear Evento" o en cualquier día
3. Completa el formulario
4. La sesión aparecerá en el calendario y en la agenda

### Ver Métricas
1. Ve a Métricas
2. Selecciona un atleta o "Todos"
3. Ajusta el rango de fechas
4. Los gráficos se actualizan automáticamente

## 📦 Dependencias Principales

- **react-router-dom**: Navegación
- **framer-motion**: Animaciones
- **react-icons**: Iconos
- **chart.js + react-chartjs-2**: Gráficos
- **@supabase/supabase-js**: Backend
- **tailwindcss**: Estilos

## 🔐 Seguridad

- Rutas protegidas con `DashboardLayout`
- Solo coaches pueden acceder
- RLS policies en Supabase
- Tokens JWT automáticos

## 🎯 Próximas Funcionalidades

- [ ] Vista detallada de atleta individual
- [ ] Edición de sesiones en el calendario
- [ ] Planes de entrenamiento
- [ ] Exportación de métricas
- [ ] Notificaciones en tiempo real
- [ ] Chat coach-atleta
- [ ] Tests de Conconi desde la UI

## 🐛 Troubleshooting

### "No se cargan los datos"
- Verifica que las credenciales de Supabase sean correctas en `.env`
- Asegúrate de que los scripts SQL se ejecutaron correctamente
- Revisa la consola del navegador para errores

### "Pantalla en blanco"
- Verifica que `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` tengan el prefijo `VITE_`
- Reinicia el servidor con `npm run dev`

### "No aparecen los atletas"
- Los atletas deben registrarse con el email del coach
- Verifica que la relación esté activa en la base de datos

---

**¡Dashboard listo para usar! 🎉**

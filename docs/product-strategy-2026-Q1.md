# TrainingTrack - Analisis Estrategico Completo
## Marzo 2026 | Solo-Founder Edition

---

## 1. CONTEXTO DE MERCADO

### Tamano del mercado (estimaciones)

| Metrica | Valor | Fuente / Razon |
|---------|-------|-----------------|
| Corredores activos en Espana | ~4 millones | Statista, CSD encuestas deportivas |
| Carreras populares/ano | 3.500 | ClubRunning, Infobae |
| Entrenadores de running (estimacion) | 2.000 - 5.000 | Federados + no federados, clubs, independientes |
| % que usan software especializado | ~10-15% | La mayoria usa Excel, WhatsApp, PDFs |
| SAM (entrenadores que pagarian por SaaS) | 500 - 1.500 | Los que tienen >5 atletas y cobran por ello |
| Precio medio SaaS/mes | 15-25 EUR | Rango GoToGoal/TrainingForever |
| SAM en euros/ano | 90K - 450K EUR | 500-1500 coaches x 15-25 EUR x 12 meses |

**Conclusion**: mercado nicho pero con alta densidad en Espana. No es un mercado de venture scale, pero es perfectamente viable para un solo-founder que aspire a 5-15K EUR/mes de ingresos recurrentes.

### Panorama competitivo completo

| Plataforma | Origen | Precio | Fortaleza | Debilidad vs TT |
|------------|--------|--------|-----------|-----------------|
| **GoToGoal** | Espana (Lanzadera) | 20-29 EUR/mes | 200 usuarios, app nativa, aceleradora backing | Sin Strava, sin IA, sin ACWR |
| **TrainingForever** | Espana | Freemium + premium | Multi-deporte, sesiones multi-parte | Generico, no running-first |
| **Train2Go** | Espana | ? | Sencillo, web | Limitado en funcionalidades |
| **TrueCoach** | EEUU | $19-49 USD/mes | Establecido, UX pulida | En ingles, fitness generico, sin running |
| **TrainerPlan** | Internacional | Freemium | Endurance-focused | No espanol nativo, sin IA |
| **Harbiz** | Espana | ~29 EUR/mes | Pagos integrados, multi-sector | Fitness generico, no running-specific |
| **Excel/WhatsApp** | N/A | Gratis | Cero curva de aprendizaje | Cero automatizacion, cero insights |

### Dato clave sobre GoToGoal

GoToGoal esta en **Lanzadera** (la aceleradora de Juan Roig). Esto significa:
- Tienen mentoria y red de contactos
- Probablemente tengan algo de funding (o lo tendran)
- Van a moverse rapido en los proximos 12 meses
- **PERO**: Lanzadera no es garantia de exito, y estar en una aceleradora a veces distrae del producto

La ventana de oportunidad para TrainingTrack es **ahora**: GoToGoal aun no tiene Strava ni IA. Cuando lo tengan, la diferenciacion se reduce.

---

## 2. POSICIONAMIENTO GANADOR

### Posicion actual (implicita)
"Una app web gratuita para entrenadores de running" -- esto es debil, suena a side-project.

### Posicion propuesta

**Claim central:**

> "TrainingTrack es la plataforma inteligente para entrenadores de running que automatiza el analisis de carga, conecta con Strava en tiempo real, y genera informes de IA -- para que dediques tu tiempo a entrenar, no a hacer Excel."

### Desglose del posicionamiento

| Elemento | TrainingTrack | GoToGoal |
|----------|---------------|----------|
| **Categoria** | Plataforma inteligente de entrenamiento running | Plataforma de gestion deportiva |
| **Para quien** | Entrenadores de running/trail con 5-30 atletas | Entrenadores multi-deporte |
| **Problema que resuelve** | "Paso mas tiempo en Excel y WhatsApp que entrenando" | "Necesito organizar mis atletas" |
| **Diferenciador clave** | IA + Strava real + ACWR automatico | Planificador visual + app nativa |
| **Razon para creer** | Strava webhook funcionando hoy, informes IA cada lunes | 200 usuarios activos |

### Tagline candidatos (para landing page)

1. "Entrena con datos. No con hojas de calculo."
2. "Tu asistente inteligente de entrenamiento running."
3. "Strava + IA + planificacion. Todo en un sitio."

**Recomendacion**: opcion 1 como headline principal, opcion 3 como subtitulo.

### Jobs-to-be-Done del entrenador de running

| Job | Tipo | Como TT lo resuelve | GoToGoal |
|-----|------|---------------------|----------|
| Planificar la semana para 15 atletas sin volverme loco | Funcional | Planificador con copy/template + mesociclos | Si, bien |
| Saber si un atleta esta en riesgo de lesion | Funcional | ACWR + TSB automatico desde Strava | No |
| Que mis atletas vean el entreno facil en el movil | Funcional | PWA responsive | App nativa |
| Parecer profesional ante mis atletas | Social | Informes IA semanales, dashboard bonito | PDF exportable |
| No perder tiempo en tareas administrativas | Emocional | Auto-complete Strava, IA que resume | Manual |
| Justificar mi precio como entrenador | Social | Datos, graficas, informes = valor percibido | Basico |

**Insight estrategico**: el job mas diferenciador NO es "planificar" (todos lo hacen). Es **"hacer que el entrenador parezca mas profesional y ahorre tiempo en analisis"**. La IA y Strava son las armas para esto.

---

## 3. BLUE OCEAN: Lo que GoToGoal no puede copiar en 6 meses

### Analisis de las 4 acciones

| Accion | Que hacer |
|--------|-----------|
| **ELIMINAR** | La complejidad de configuracion. TT debe ser "signup -> conecta Strava -> empieza" en <5 min |
| **REDUCIR** | Features de gestion generica (multi-deporte, grupos complejos). Ser running-first, no todo-deporte |
| **ELEVAR** | Inteligencia automatica: ACWR, TSB, informes IA, alertas de riesgo |
| **CREAR** | (1) IA conversacional sobre datos del atleta. (2) Resumen semanal automatico al coach. (3) Alertas proactivas de carga |

### Ventajas defensibles (moats)

1. **Strava webhook + auto-complete ya funcionando**: GoToGoal dice "en desarrollo" para Strava/Garmin. Implementar OAuth + webhooks + matching de sesiones es 2-4 meses de trabajo. TT ya lo tiene.

2. **IA integrada con datos reales**: No es solo "meter un LLM". Es que la IA tiene acceso a ACWR, TSB, historial de sesiones, RPE, tests fisiologicos. Replicar esto requiere primero tener los datos (ver punto 1) y luego construir el pipeline. Son 4-6 meses de trabajo para GoToGoal.

3. **Efecto de red de datos**: Cada atleta que usa Strava con TT genera datos que mejoran las recomendaciones de IA. GoToGoal empieza de cero en datos.

4. **PWA con push notifications**: Ya funciona. GoToGoal tiene app nativa, pero TT tiene notificaciones push sin pasar por App Store.

### Lo que GoToGoal SI puede copiar rapido (no apostar aqui)
- Planificador visual (lo tienen mejor)
- Multi-grupo (lo tienen)
- PDF export (lo tienen)

**Estrategia**: NO competir en features de gestion basica. Competir en inteligencia y automatizacion.

---

## 4. FEATURE PRIORITIZATION MATRIX

### Criterios de puntuacion (1-10)

- **Impacto en cliente** (peso 0.3): cuanto mejora la vida del entrenador
- **Impacto en negocio** (peso 0.3): cuanto ayuda a conversion/retencion/diferenciacion
- **Esfuerzo** (peso 0.2): invertido -- 10 = poco esfuerzo, 1 = mucho esfuerzo
- **Alineamiento estrategico** (peso 0.2): cuanto refuerza el posicionamiento "inteligente"

### NOW (0-3 meses) -- Marzo a Mayo 2026

| Feature | Cli | Biz | Esf | Ali | Score | Justificacion |
|---------|-----|-----|-----|-----|-------|---------------|
| **Landing page con posicionamiento claro** | 5 | 10 | 9 | 8 | 7.7 | Sin esto, nada de GTM funciona |
| **Onboarding guiado (coach signup -> primer atleta -> Strava)** | 8 | 9 | 7 | 7 | 7.9 | Reducir time-to-value es critico |
| **Plantillas de sesion / copiar semana** | 9 | 7 | 7 | 5 | 7.2 | El pain #1 del entrenador es la repeticion |
| **Alerta de ACWR alto (>1.3) por push/email** | 7 | 8 | 8 | 10 | 8.0 | Diferenciador puro, bajo esfuerzo |
| **Dashboard de metricas mejorado (graficas ACWR/TSB)** | 7 | 7 | 6 | 9 | 7.2 | Hace tangible el valor de "inteligente" |
| **Pricing page + sistema de pago (Stripe)** | 3 | 10 | 5 | 5 | 5.9 | Necesario para monetizar, pero puede esperar a mes 2-3 |

**Prioridad absoluta NOW**: Landing page + Onboarding + Alertas ACWR. Estas 3 cosas juntas crean el loop "el entrenador llega, entiende el valor, lo experimenta rapido".

### NEXT (3-6 meses) -- Junio a Agosto 2026

| Feature | Cli | Biz | Esf | Ali | Score | Justificacion |
|---------|-----|-----|-----|-----|-------|---------------|
| **IA conversacional (chat con datos del atleta)** | 8 | 9 | 4 | 10 | 7.7 | El moonshot diferenciador -- ninguna plataforma lo tiene |
| **Multi-grupo (etiquetas/grupos de atletas)** | 8 | 6 | 7 | 4 | 6.4 | Table stakes para coaches con >10 atletas |
| **Garmin Connect integracion** | 7 | 7 | 4 | 7 | 6.3 | Ampliar TAM (muchos runners usan Garmin sin Strava) |
| **Resumen mensual automatico IA (PDF branded)** | 7 | 8 | 6 | 9 | 7.4 | El atleta recibe un PDF bonito -> percibe valor -> retiene al coach |
| **Vista de atleta mejorada (mobile-first)** | 8 | 7 | 6 | 5 | 6.7 | Los atletas son los que usan el movil, no los coaches |

### LATER (6-12 meses) -- Sep 2026 a Feb 2027

| Feature | Notas |
|---------|-------|
| **App nativa (React Native / Capacitor)** | Solo si hay >100 coaches pagando. Antes, la PWA es suficiente |
| **Marketplace de planes** | Los coaches venden planes en TT, TT cobra comision. Requiere volumen |
| **API publica para integraciones** | Solo si hay demanda de terceros |
| **White-label para clubs** | Precio premium, customizacion de marca. Requiere traccion |
| **Prediccion de rendimiento IA** | "Con tu carga actual, puedes correr 42:00 en 10K". Requiere muchos datos |

---

## 5. GO-TO-MARKET: Los primeros 50 entrenadores de pago

### Modelo de pricing recomendado

| Tier | Precio | Incluye | Target |
|------|--------|---------|--------|
| **Gratis** | 0 EUR | Hasta 3 atletas, funciones basicas, sin IA | Entrenadores que empiezan, trial |
| **Pro** | 14.99 EUR/mes | Hasta 20 atletas, Strava, ACWR, IA semanal, chat | Core target |
| **Team** | 24.99 EUR/mes | Atletas ilimitados, IA conversacional, PDF branded, prioridad soporte | Coaches establecidos |

**Logica del pricing**:
- Gratis es imprescindible para un solo-founder sin presupuesto de marketing. El freemium ES tu marketing.
- 14.99 EUR undercuts GoToGoal (20 EUR) con MAS features (IA, Strava). Esto es deliberado.
- 24.99 EUR sigue debajo de GoToGoal ilimitado (28.99 EUR) con MAS valor.
- Facturacion anual con descuento: 12.99/mes y 21.99/mes (2 meses gratis).

### Canal strategy: como llegar a 50 coaches

#### Canal 1: Contenido SEO running-coach (esfuerzo: medio, impacto: alto a largo plazo)

Crear 5-10 articulos en blog.trainingtrack.es:
- "Como calcular el ACWR de tus atletas (y por que importa)"
- "Strava para entrenadores: como usar los datos de tus atletas"
- "Excel vs software de entrenamiento: que necesitas realmente"
- "Como hacer un informe semanal para tus atletas en 5 minutos"
- "TSB y fatiga: la metrica que previene lesiones"

Estos articulos capturan busquedas de cola larga de entrenadores que buscan mejorar su workflow. El CTA es "prueba TrainingTrack gratis".

#### Canal 2: Comunidades de entrenadores (esfuerzo: bajo, impacto: medio)

| Comunidad | Accion |
|-----------|--------|
| Grupos Facebook entrenadores running Espana | Participar genuinamente, compartir tips, mencionar TT cuando sea relevante |
| Foros RFEA / federaciones autonomicas | Contacto directo con coordinadores |
| Telegram/WhatsApp de clubs de atletismo | Pedir a atletas beta que recomienden a sus coaches |
| Reddit r/running, r/AdvancedRunning | Para posicionamiento internacional futuro |

#### Canal 3: Outreach directo a entrenadores (esfuerzo: alto, impacto: alto a corto plazo)

1. Buscar en Instagram/Twitter entrenadores de running espanoles (hashtags: #entrenadorrunning, #coachrunning, #entrenadorpersonal)
2. Hacer una lista de 100 entrenadores con >500 seguidores
3. DM personalizado: "Hola [nombre], he visto que entrenas a [tipo de atletas]. He construido una plataforma que conecta con Strava y genera informes de IA automaticos para tus atletas. Es gratis durante la beta. Te gustaria probarla?"
4. Objetivo: 100 DMs -> 20 respuestas -> 10 signups -> 5 activos

**Este es el canal mas importante en los primeros 60 dias.**

#### Canal 4: Partnerships con clubs (esfuerzo: medio, impacto: alto)

- Contactar 10 clubs de atletismo medianos en ciudades principales (Madrid, Barcelona, Valencia, Sevilla, Bilbao)
- Ofrecer acceso gratuito a todos los entrenadores del club durante 6 meses
- A cambio: logo en su web, mencion en redes, feedback activo
- 1 club = 3-5 entrenadores = 30-75 atletas = datos + testimonios

#### Canal 5: Eventos running (esfuerzo: medio, impacto: bajo-medio)

- Asistir a expos de carreras populares (Madrid, Valencia, Barcelona tienen las grandes)
- No con stand (caro), sino con flyers/tarjetas dirigidos a entrenadores
- QR code a landing page especifica: trainingtrack.es/entrenadores

### Funnel y metricas objetivo (primeros 6 meses)

```
Mes 1-2: Landing + onboarding + outreach directo
  -> 30 coaches registrados, 10 activos (>1 atleta)

Mes 3: Activar Stripe, pasar a freemium
  -> 50 coaches registrados, 15 activos, 5 pagando

Mes 4-5: SEO empieza a dar frutos + word of mouth
  -> 80 coaches registrados, 25 activos, 12 pagando

Mes 6: Primer hito significativo
  -> 120 coaches registrados, 40 activos, 20 pagando
  -> MRR: 20 x 15 EUR = 300 EUR/mes
```

Si. 300 EUR/mes en 6 meses es realista y honesto para un solo-founder sin presupuesto de marketing. El objetivo es llegar a 50 coaches pagando en 12 meses (~750 EUR/mes MRR).

---

## 6. QUICK WINS: 5 acciones para esta semana

### 1. Reescribir la landing page con el nuevo posicionamiento (2-3 horas)

**Antes**: probablemente algo generico sobre gestion de entrenamientos.
**Despues**:
- Hero: "Entrena con datos. No con hojas de calculo."
- Sub: "La plataforma con Strava, IA y control de carga para entrenadores de running."
- 3 bloques: (1) Strava en tiempo real, (2) Informes IA cada lunes, (3) ACWR y TSB automatico
- CTA: "Empieza gratis" (boton verde grande)
- Social proof: screenshots del dashboard, metricas reales (si hay)
- Seccion "vs la competencia" sutil: tabla comparativa sin nombrar a GoToGoal directamente

### 2. Crear la alerta de ACWR alto (3-4 horas)

Ya tienes ACWR calculado. Anadir:
- Si ACWR > 1.3 para algun atleta, enviar push notification al coach
- Texto: "[Atleta] tiene un ACWR de 1.45 esta semana. Considera reducir carga."
- Esto es el feature que hace tangible "inteligente" desde el dia 1

### 3. Hacer 20 DMs a entrenadores en Instagram (1-2 horas)

- Buscar #entrenadorrunning #coachrunning en Instagram
- Seleccionar 20 perfiles de entrenadores activos con >500 seguidores
- Enviar DM personalizado (ver template en Canal 3 arriba)
- Trackear respuestas en una hoja simple

### 4. Publicar un post en LinkedIn/Twitter sobre ACWR (1 hora)

Escribir un post educativo:
- "El 70% de las lesiones en running se pueden predecir con una metrica: el ACWR. Asi es como funciona: [explicacion simple]. En TrainingTrack lo calculamos automaticamente desde Strava. Link en bio."
- Este tipo de contenido posiciona al founder como experto y al producto como inteligente

### 5. Configurar Google Search Console y optimizar SEO basico (1 hora)

- Verificar que trainingtrack.es esta indexado correctamente
- Anadir meta descriptions con keywords: "software entrenador running", "plataforma entrenamiento atletismo", "ACWR running"
- Crear pagina /blog vacia lista para empezar a publicar la semana siguiente
- Verificar que el schema markup basico esta en la landing

---

## 7. RIESGOS Y MITIGACION

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|-------------|---------|------------|
| GoToGoal saca Strava en 3 meses | Media | Alto | Acelerar IA conversacional como siguiente moat |
| Entrenadores prefieren app nativa | Alta | Medio | PWA con "Instalar app" prominente + mejorar UX mobile |
| Solo-founder burnout | Alta | Critico | Priorizar brutalmente. No hacer NEXT hasta que NOW este hecho |
| Mercado demasiado pequeno | Baja | Alto | Expandir a trail running, triatlon si running puro no escala |
| Supabase free tier limita | Media | Medio | Plan Pro de Supabase es 25 USD/mes, asumible con 10 coaches pagando |

---

## 8. VISION A 12 MESES

**Diciembre 2026 - Estado objetivo:**

- 50 coaches pagando (MRR ~750 EUR)
- 500+ atletas activos en la plataforma
- IA conversacional funcionando (diferenciador unico en el mercado espanol)
- 2-3 integraciones de wearables (Strava + Garmin + COROS)
- Blog con 15+ articulos posicionando en SEO
- 1-2 partnerships con clubs de atletismo
- Testimonio de al menos 5 coaches reconocidos

**Esto no es un cohete, es un negocio sostenible.** Para un solo-founder, 750 EUR/mes MRR con tendencia ascendente y un producto con moats reales (IA + datos + integraciones) es una posicion envidiable desde la que decidir si escalar o mantener como lifestyle business.

---

## RESUMEN EJECUTIVO

1. **Posicionamiento**: "La plataforma INTELIGENTE para entrenadores de running". No competir en gestion basica (GoToGoal lo hace bien). Competir en IA, automatizacion y datos.

2. **Moat principal**: La combinacion Strava real + ACWR/TSB automatico + IA con contexto del atleta. GoToGoal necesita 6+ meses para replicar esto.

3. **GTM**: Outreach directo a entrenadores (corto plazo) + SEO educativo (largo plazo) + partnerships con clubs (medio plazo). Freemium a 14.99 EUR/mes undercutting GoToGoal.

4. **Quick wins esta semana**: (1) Landing page nueva, (2) Alerta ACWR, (3) 20 DMs a entrenadores, (4) Post educativo, (5) SEO basico.

5. **Mantra**: "Inteligencia > Gestion. Automatizacion > Features. 10 coaches felices > 100 registros muertos."

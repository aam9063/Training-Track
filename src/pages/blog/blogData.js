import { lazy } from 'react';

/**
 * Blog articles data.
 * To add a new article:
 * 1. Create a JSX component in ./articles/
 * 2. Add an entry here with a lazy() import pointing to it.
 *
 * Images are served from Supabase Storage bucket "site-assets/blog/".
 */

const STORAGE_BASE =
  'https://lusirdkixfliydimemre.supabase.co/storage/v1/object/public/blog';

const blogArticles = [
  {
    slug: 'periodizacion-entrenamiento-medio-fondo',
    title: 'Periodización del entrenamiento en medio fondo: guía completa',
    excerpt:
      'Descubre cómo estructurar mesociclos y microciclos para optimizar el rendimiento de tus atletas de 800m a 5000m. Estrategias probadas de base aeróbica, fuerza específica y competición.',
    image: `${STORAGE_BASE}/portada-periodizacion.png`,
    date: '2026-02-15',
    author: 'Training Track',
    category: 'Entrenamiento',
    readTime: '8 min',
    Component: lazy(() => import('./articles/periodizacion-entrenamiento-medio-fondo')),
  },
  {
    slug: 'test-conconi-ritmos-entrenamiento',
    title: 'Test de Conconi: cómo determinar los ritmos de entrenamiento',
    excerpt:
      'El test de Conconi es una herramienta fundamental para establecer zonas de entrenamiento basadas en frecuencia cardíaca. Aprende a realizarlo e interpretarlo correctamente.',
    image: `${STORAGE_BASE}/portada-conconi.png`,
    date: '2026-02-10',
    author: 'Training Track',
    category: 'Fisiología',
    readTime: '6 min',
    Component: lazy(() => import('./articles/test-conconi-ritmos-entrenamiento')),
  },
  {
    slug: 'importancia-fuerza-corredores-fondo',
    title: 'La importancia del trabajo de fuerza en corredores de fondo',
    excerpt:
      'El entrenamiento de fuerza no es solo para velocistas. Descubre por qué los fondistas necesitan incluir sesiones de gimnasio y cómo programarlas sin interferir con el volumen de carrera.',
    image: `${STORAGE_BASE}/portada-fuerza.png`,
    date: '2026-02-05',
    author: 'Training Track',
    category: 'Fuerza',
    readTime: '7 min',
    Component: lazy(() => import('./articles/importancia-fuerza-corredores-fondo')),
  },
  {
    slug: 'zonas-entrenamiento-running',
    title: 'Zonas de entrenamiento en running: guía completa para entrenadores',
    excerpt:
      'Aprende a definir las 5 zonas de entrenamiento por frecuencia cardíaca, ritmo y RPE. Descubre cómo calcularlas, evitar la zona gris y aplicar el modelo polarizado para maximizar el rendimiento.',
    image: `${STORAGE_BASE}/portada-zonas.png`,
    date: '2026-03-01',
    author: 'Training Track',
    category: 'Fisiología',
    readTime: '9 min',
    Component: lazy(() => import('./articles/zonas-entrenamiento-running')),
  },
  {
    slug: 'plan-entrenamiento-media-maraton',
    title: 'Plan de entrenamiento para media maratón: 12 semanas paso a paso',
    excerpt:
      'Guía completa para preparar una media maratón con un plan de 12 semanas estructurado en fases de base, específico y tapering. Sesiones clave, errores comunes y estrategia de carrera.',
    image: `${STORAGE_BASE}/portada-media-maraton.png`,
    date: '2026-03-03',
    author: 'Training Track',
    category: 'Entrenamiento',
    readTime: '10 min',
    Component: lazy(() => import('./articles/plan-entrenamiento-media-maraton')),
  },
  {
    slug: 'como-interpretar-acwr-carga-entrenamiento',
    title: 'ACWR y TSB: cómo interpretar la carga de entrenamiento en running',
    excerpt:
      'Guía práctica para entender el ACWR (Acute:Chronic Workload Ratio) y el TSB (Training Stress Balance). Aprende a monitorizar la carga, prevenir lesiones y optimizar el tapering pre-competición.',
    image: `${STORAGE_BASE}/portada-acwr.png`,
    date: '2026-03-05',
    author: 'Training Track',
    category: 'Métricas',
    readTime: '8 min',
    Component: lazy(() => import('./articles/como-interpretar-acwr-carga-entrenamiento')),
  },
  {
    slug: 'prevenir-lesiones-corredores-fondo',
    title: 'Prevenir lesiones en corredores de fondo: las 5 claves imprescindibles',
    excerpt:
      'El 50-75% de los corredores se lesionan cada año. Descubre las 5 estrategias clave para prevenir lesiones: progresión de carga, fuerza, movilidad, RPE y nutrición.',
    image: `${STORAGE_BASE}/portada-lesiones.png`,
    date: '2026-03-07',
    author: 'Training Track',
    category: 'Salud',
    readTime: '9 min',
    Component: lazy(() => import('./articles/prevenir-lesiones-corredores-fondo')),
  },
  {
    slug: 'strava-entrenador-atletismo',
    title: 'Strava para entrenadores de atletismo: cómo aprovechar la integración',
    excerpt:
      'Strava registra los datos, pero el entrenador necesita más. Descubre cómo la integración Strava + Training Track automatiza el seguimiento, cruza datos con la planificación y genera informes IA.',
    image: `${STORAGE_BASE}/portada-strava.png`,
    date: '2026-03-09',
    author: 'Training Track',
    category: 'Tecnología',
    readTime: '8 min',
    Component: lazy(() => import('./articles/strava-entrenador-atletismo')),
  },
];

export default blogArticles;

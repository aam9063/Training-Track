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
    author: 'TrainingTrack Pro',
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
    author: 'TrainingTrack Pro',
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
    author: 'TrainingTrack Pro',
    category: 'Fuerza',
    readTime: '7 min',
    Component: lazy(() => import('./articles/importancia-fuerza-corredores-fondo')),
  },
];

export default blogArticles;

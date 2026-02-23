import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => ({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['img/logo.png', 'img/logo_192.png', 'img/logo_512.png'],
      manifest: false, // usamos nuestro propio manifest.json en /public
      workbox: {
        // Precachea todos los assets estáticos generados por Vite
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Rutas de la SPA: siempre devuelve index.html
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/auth/],
        // Supabase: network-first (datos en tiempo real)
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60, // 1 hora
              },
            },
          },
          // Google Fonts / external assets
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 año
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // no actives el SW en dev para evitar conflictos
      },
    }),
  ],
  esbuild: {
    // Strip console.log, console.warn, console.error, and debugger in production
    drop: command === 'build' ? ['console', 'debugger'] : [],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Heavy vendor libraries split into separate chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['chart.js', 'react-chartjs-2'],
          'vendor-maps': ['mapbox-gl', '@mapbox/polyline'],
          'vendor-motion': ['framer-motion'],
        },
      },
    },
  },
}))

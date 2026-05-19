import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => ({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer'],
      globals: { Buffer: true },
    }),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      includeAssets: ['img/logo.png', 'img/logo_192.png', 'img/logo_512.png'],
      manifest: false, // usamos nuestro propio manifest.json en /public
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
      },
      devOptions: {
        enabled: false,
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

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Gestor de Obras',
        short_name: 'Obras',
        description: 'Expediente de obras de construcción — personal',
        // Matches the dark neutral that every section's gradient now converges
        // to at the bottom edge. With this, the area iOS standalone leaves below
        // the web viewport (the home-indicator zone) blends seamlessly with the
        // gradient — no white band. NOTE: requires re-installing the PWA icon.
        theme_color: '#2a2a30',
        background_color: '#2a2a30',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Do NOT let the SPA navigation fallback intercept server routes.
        // Without this, requests to /api/* (Google OAuth start + callback) were
        // served the cached index.html, dropping the user back on the home page.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    strictPort: false,
    allowedHosts: ['obscurity-request-justly.ngrok-free.dev', 'localhost', '127.0.0.1', '.loca.lt'],
  },
})

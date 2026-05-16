import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',

      // Explicitly list assets the SW should precache (includes hashed JS/CSS bundles automatically)
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],

      manifest: {
        name: 'Regirl QC',
        short_name: 'Regirl QC',
        description: 'Wig quality control inspection app',
        theme_color: '#3B0F0D',
        background_color: '#FFFCF2',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      workbox: {
        // Precache everything vite builds — JS, CSS, HTML, images
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],

        // Cache navigation requests (React Router client-side routes)
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],

        runtimeCaching: [
          {
            // Any future API calls — network first so data is always fresh,
            // falls back to cache if offline
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
            },
          },
        ],
      },
    }),
  ],
})

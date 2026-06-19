import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'Folio',
        short_name: 'Folio',
        description: 'Your personal digital library',
        theme_color: '#2D6A5E',
        background_color: '#F7F5F0',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/gutendex\.com\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'gutendex-cache', expiration: { maxEntries: 100, maxAgeSeconds: 86400 } }
          },
          {
            urlPattern: /^https:\/\/www\.gutenberg\.org\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'book-content-cache', expiration: { maxEntries: 50, maxAgeSeconds: 2592000 } }
          },
        ]
      }
    })
  ],
})

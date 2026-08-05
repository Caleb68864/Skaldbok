import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    basicSsl(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'],
      manifest: {
        name: "Skaldbok: The Adventurer's Ledger",
        short_name: 'Skaldbok',
        description: 'Local-first tabletop character sheet PWA',
        theme_color: '#111a17',
        background_color: '#111a17',
        display: 'standalone',
        start_url: '/',
        // Without `id`, an install's identity falls back to `start_url`, which
        // makes it hostage to whichever origin/path the app was served from —
        // this app is installed from a LAN IP that can change. A fixed id keeps
        // a reinstall replacing the existing app rather than minting a new one.
        id: '/',
        // Absolute, not relative. These resolve against the manifest URL, which
        // is at the root today, so both forms work — but a relative src silently
        // breaks the moment the manifest is emitted anywhere but `/`.
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});

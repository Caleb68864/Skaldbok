import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
/**
 * The policy the built app runs under.
 *
 * @remarks
 * Defence in depth for a local-first app that makes no network requests of its
 * own: `connect-src 'self'` means an imported character or note cannot phone
 * home, and `img-src` without a scheme wildcard blocks a tracking pixel smuggled
 * in as a portrait URL — the same hole `importablePortraitUri` closes on the
 * import path, closed again at the browser.
 *
 * `'unsafe-inline'` is present for styles only: Tailwind and Tiptap both write
 * inline style attributes. Scripts are bundled files, so `script-src 'self'`
 * needs no exception. `object-src 'none'` and `base-uri 'none'` remove two
 * injection surfaces the app never uses.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "worker-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  // `frame-ancestors` is deliberately absent: it is ignored when the policy is
  // delivered in a <meta> element, and including it only logs an error on every
  // load. Framing protection needs an HTTP header, which a static bundle served
  // off a LAN address has no way to set.
].join('; ');

/**
 * Injects the CSP into the built `index.html`.
 *
 * @remarks
 * Build only. Applying it in dev would break Vite's HMR client, which injects
 * inline scripts — and a policy that has to be loosened for the dev server is
 * not the policy that ships.
 */
function contentSecurityPolicy(): import('vite').Plugin {
  return {
    name: 'skaldbok-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html: string) =>
        html.replace(
          '<head>',
          `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`,
        ),
    },
  };
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    basicSsl(),
    contentSecurityPolicy(),
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
        // Workbox's default ceiling is 2 MiB per file, and a file over it is
        // dropped from the precache with only a build-time warning — the app
        // then silently stops working offline. Screens are code-split so no
        // chunk is near this, but the shared chunk was at 89% of the default
        // before splitting; the explicit margin keeps a dependency bump from
        // taking offline mode with it.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  /**
   * Vitest's settings, stated rather than inherited.
   *
   * @remarks
   * There was no `test:` block and no `vitest.config.*` anywhere, so both of
   * these matched CLAUDE.md **by omission**. They are not incidental defaults:
   *
   * - `environment: 'node'` is what keeps the ~100 pure test files fast. The DOM
   *   is opted into per file with a `// @vitest-environment jsdom` pragma;
   *   flipping this to `'jsdom'` globally would silently slow every one of them.
   * - `globals: false` is load-bearing in a way that is easy to miss. Testing
   *   Library's automatic cleanup only registers when Vitest globals are on, so
   *   with globals off every DOM test file must call `cleanup()` in its own
   *   `afterEach` or renders stack up in one document. Turning globals *on*
   *   would not break anything visibly — it would quietly make those manual
   *   `cleanup()` calls redundant, and the next DOM test written without one
   *   would pass here and fail the day someone turned globals back off.
   *
   * `jsdomBoundary.test.ts` enforces the per-file half of this.
   */
  test: {
    globals: false,
    environment: 'node',
  },
});

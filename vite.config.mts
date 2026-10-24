import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'
import { fileURLToPath } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // `yarn dev:web` runs in "web" mode: plain dev server in the browser, no Electron (window.api is undefined there)
  const web = mode === 'web'

  return {
    plugins: [
      react(),
      tailwindcss(),
      // Builds electron/ into dist-electron/ and launches Electron once the dev server is up
      !web && electron({
        main: { entry: 'electron/main.ts' },
        preload: { input: 'electron/preload.ts' },
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    base: './',
    build: {
      outDir: 'dist',
    },
    server: {
      port: 3000,
      open: web,
    },
    assetsInclude: ['**/*.ttf'],
  }
})

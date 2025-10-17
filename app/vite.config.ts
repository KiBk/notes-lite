import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  console.log('[vite] mode:', mode, 'cwd:', process.cwd())
  console.log('[vite] env VITE_API_BASE_URL:', env.VITE_API_BASE_URL)
  return {
    plugins: [
      react(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src/pwa',
        filename: 'sw.ts',
        registerType: 'prompt',
        manifest: false,
        injectManifest: {
          swSrc: 'src/pwa/sw.ts',
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './tests/setup/vitest.setup.ts',
      css: true,
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      exclude: ['tests/**/*.spec.ts'],
    },
  }
})

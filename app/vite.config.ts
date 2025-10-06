import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  console.log('[vite] mode:', mode, 'cwd:', process.cwd())
  console.log('[vite] env VITE_API_BASE_URL:', env.VITE_API_BASE_URL)
  return {
    plugins: [react()],
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

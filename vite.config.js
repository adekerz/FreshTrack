import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // base: '/FreshTrack/', // Removed for Vercel deployment
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})

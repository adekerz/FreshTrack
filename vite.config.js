import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
  ],
  // base: '/FreshTrack/', // Removed for Vercel deployment
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    // Target modern browsers for better bundle size
    target: 'esnext',
    // Enable source maps for debugging
    sourcemap: false,
    // Minification settings
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    // Chunk splitting for better caching and lazy loading
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk for React
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Utility libraries
          'utils-vendor': ['date-fns', 'clsx'],
          // Icons - separate chunk for tree-shaking
          'icons-vendor': ['lucide-react'],
        },
      },
    },
    // Asset size warnings
    chunkSizeWarningLimit: 500,
  },
  // Performance optimizations
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'date-fns', 'lucide-react'],
  },
  // PWA & Mobile optimizations
  server: {
    // Enable HTTPS for PWA testing locally
    // https: true,
  },
})

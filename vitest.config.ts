/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  
  test: {
    // Окружение для тестов
    environment: 'happy-dom',
    
    // Глобальные функции (describe, it, expect)
    globals: true,
    
    // Setup файл
    setupFiles: ['./src/test/setup.ts'],
    
    // Включить CSS
    css: true,
    
    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'src/test/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts',
        '**/types/**'
      ],
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50
      }
    },
    
    // Включить файлы
    include: [
      'src/**/*.{test,spec}.{js,jsx,ts,tsx}',
      'src/**/__tests__/**/*.{js,jsx,ts,tsx}'
    ],
    
    // Исключить
    exclude: [
      'node_modules',
      'dist',
      'server'
    ],
    
    // Таймаут для тестов
    testTimeout: 10000,
    
    // Параллельное выполнение
    pool: 'forks',
    
    // Репортеры
    reporters: ['verbose'],
    
    // Watch mode исключения
    watchExclude: [
      'node_modules/**',
      'dist/**'
    ]
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@features': path.resolve(__dirname, './src/features'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@context': path.resolve(__dirname, './src/context'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@config': path.resolve(__dirname, './src/config'),
      '@services': path.resolve(__dirname, './src/services'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@types': path.resolve(__dirname, './src/types'),
      '@test': path.resolve(__dirname, './src/test')
    }
  }
})

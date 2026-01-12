/// <reference types="vitest" />
import { defineConfig } from 'vite'

/**
 * Vitest Configuration for Server Tests
 * 
 * Запуск: npm run test:server
 */
export default defineConfig({
  test: {
    // Node.js окружение для серверных тестов
    environment: 'node',
    
    // Глобальные функции (describe, it, expect)
    globals: true,
    
    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage/server',
      exclude: [
        'node_modules/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.js',
        'server/db/migrations/**'
      ],
      thresholds: {
        statements: 40,
        branches: 40,
        functions: 40,
        lines: 40
      }
    },
    
    // Включить только серверные тесты (исключая node_modules)
    include: [
      'server/modules/**/*.test.{js,ts}',
      'server/tests/**/*.test.{js,ts}',
      'server/services/**/*.test.{js,ts}'
    ],
    
    // Исключить
    exclude: [
      '**/node_modules/**',
      'node_modules/**',
      'server/node_modules/**',
      'dist/**',
      'src/**'
    ],
    
    // Таймаут для тестов
    testTimeout: 15000,
    
    // Параллельное выполнение
    pool: 'forks',
    
    // Репортеры
    reporters: ['verbose'],
    
    // Setup для серверных тестов
    setupFiles: ['./server/test/setup.ts']
  }
})

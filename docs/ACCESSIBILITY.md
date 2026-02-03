# Lighthouse & Axe Accessibility Guide

> Обновлено: 3 февраля 2026

Это руководство описывает интеграцию Lighthouse и Axe для тестирования производительности и доступности FreshTrack.

## 📦 Установленные инструменты

- **@axe-core/react** - Автоматическое тестирование a11y в React
- **eslint-plugin-jsx-a11y** - ESLint правила для доступности
- **lighthouse** - Аудит производительности и SEO

## 🚀 Использование

### Автоматическая проверка Axe (Development)

В режиме разработки Axe автоматически запускается и выводит проблемы доступности в консоль браузера.

```bash
npm run dev
# Откройте консоль браузера (F12) для просмотра отчётов Axe
```

### Ручная проверка Axe

В консоли браузера:

```javascript
// Запустить полную проверку Axe
window.runAxeCheck()

// Запустить быстрый аудит a11y
window.runA11yAudit()
```

### ESLint проверка a11y

```bash
# Проверить код на проблемы доступности
npm run lint:a11y
```

### Lighthouse аудит

```bash
# Запустить dev сервер
npm run dev

# В другом терминале запустить Lighthouse
npm run lighthouse
```

Отчёт будет сохранён в `./reports/lighthouse.html`

## 📋 WCAG 2.1 AA Checklist

### Уже реализовано ✅

1. **Perceivable (Воспринимаемость)**
   - [x] Alt текст для изображений
   - [x] Контрастность цветов (4.5:1 минимум)
   - [x] Масштабирование страницы (viewport без user-scalable=no)
   - [x] Не только цвет для передачи информации

2. **Operable (Управляемость)**
   - [x] Навигация с клавиатуры
   - [x] Skip-to-content ссылка
   - [x] Видимые индикаторы фокуса
   - [x] Тач-таргеты 44x44px минимум
   - [x] Поддержка prefers-reduced-motion

3. **Understandable (Понятность)**
   - [x] lang атрибут на html
   - [x] Понятные ошибки форм
   - [x] Консистентная навигация

4. **Robust (Надёжность)**
   - [x] Валидный HTML
   - [x] Семантические элементы
   - [x] ARIA live регионы для динамического контента

## 🎯 Lighthouse бюджеты

Файл `lighthouse-budget.json` содержит бюджеты производительности:

| Метрика | Бюджет |
|---------|--------|
| First Contentful Paint | < 2s |
| Largest Contentful Paint | < 3s |
| Time to Interactive | < 4s |
| Cumulative Layout Shift | < 0.1 |
| Total Blocking Time | < 300ms |

## 🛠️ Оптимизации Vite

В `vite.config.js` настроено:

- **Code splitting** - Разделение vendor бандлов
- **Tree shaking** - Удаление неиспользуемого кода
- **Minification** - Terser с удалением console.log
- **Preloading** - Предзагрузка критических ресурсов

## 📊 CSS оптимизации

В `index.css` добавлено:

- **Focus visible** стили для клавиатурной навигации
- **High contrast mode** поддержка
- **Forced colors** поддержка (Windows)
- **Print styles** для печати
- **Reduced motion** для пользователей с вестибулярными нарушениями

## i18n и формы

- Все видимые строки проходят через ключи переводов (ru/en и др.) — нет сырого хардкода в UI.
- Формы (в т.ч. Scheduled Exports, настройки) должны иметь явные `<label>` или `aria-label` для полей ввода; при появлении «Form elements must have labels» в Axe — добавить подписи или скрытые лейблы.

## Полезные ресурсы

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Axe Core Rules](https://dequeuniversity.com/rules/axe/)
- [Lighthouse Scoring Guide](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring/)
- [A11Y Project Checklist](https://www.a11yproject.com/checklist/)

  # Accessibility Checklist - FreshTrack

## ✅ WCAG 2.1 AA Compliance Checklist

Этот документ содержит полный чеклист для проверки доступности приложения FreshTrack.

---

## 📋 1. Keyboard Navigation (Клавиатурная навигация)

### 1.1 Общая навигация
- [ ] Все интерактивные элементы доступны через Tab
- [ ] Порядок фокуса логичен и соответствует визуальной структуре
- [ ] Focus indicators видимы и контрастны (WCAG 2.4.7)
- [ ] Нет "keyboard traps" (фокус не застревает)
- [ ] Skip to content link работает (перейти к основному контенту)

### 1.2 Горячие клавиши
- [ ] `Esc` - закрывает модальные окна
- [ ] `Enter` - активирует кнопки и ссылки
- [ ] `Space` - активирует кнопки, чекбоксы
- [ ] `Arrow keys` - навигация в dropdown и списках
- [ ] `Ctrl/Cmd + K` - открывает поиск
- [ ] `Ctrl/Cmd + N` - создает новый элемент
- [ ] `Ctrl/Cmd + S` - сохраняет изменения
- [ ] `Ctrl/Cmd + E` - экспорт данных
- [ ] `?` - открывает центр помощи

### 1.3 Модальные окна
- [ ] Focus trap работает (фокус не выходит за пределы модалки)
- [ ] При открытии фокус перемещается на первый элемент
- [ ] При закрытии фокус возвращается на trigger element
- [ ] Tab циклически перемещается внутри модалки
- [ ] Shift+Tab работает в обратном направлении

---

## 🔊 2. Screen Readers (Скрин-ридеры)

### 2.1 Семантика HTML
- [ ] Используются правильные HTML5 landmarks (`<header>`, `<main>`, `<nav>`, `<footer>`)
- [ ] Заголовки используются иерархично (h1 → h2 → h3)
- [ ] Списки используют `<ul>`, `<ol>`, `<li>`
- [ ] Формы имеют правильную структуру (`<form>`, `<label>`, `<fieldset>`)

### 2.2 ARIA Attributes
- [ ] `role="button"` на кликабельных div/span
- [ ] `role="dialog"` на модальных окнах
- [ ] `role="status"` на status indicators
- [ ] `role="alert"` на важных уведомлениях
- [ ] `role="searchbox"` на поле поиска
- [ ] `role="navigation"` на навигационных меню

### 2.3 ARIA Labels
- [ ] Все кнопки без текста имеют `aria-label`
- [ ] Иконки имеют `aria-label` или `aria-hidden="true"`
- [ ] Модальные окна имеют `aria-modal="true"` и `aria-labelledby`
- [ ] Loading states используют `aria-busy="true"` и `aria-live="polite"`
- [ ] Ошибки форм имеют `aria-invalid` и `aria-describedby`

### 2.4 Dynamic Content
- [ ] `aria-live="polite"` для уведомлений
- [ ] `aria-live="assertive"` для критических сообщений
- [ ] Loading indicators анонсируются скрин-ридером
- [ ] Изменения контента объявляются (например, фильтрация списка)

---

## 👁️ 3. Visual Accessibility (Визуальная доступность)

### 3.1 Color Contrast (WCAG 1.4.3)
- [ ] Обычный текст: контраст >= 4.5:1
- [ ] Крупный текст (>18px): контраст >= 3:1
- [ ] UI компоненты: контраст >= 3:1
- [ ] Status colors проверены на контраст
- [ ] Focus indicators контрастны с фоном

### 3.2 Color Independence (WCAG 1.4.1)
- [ ] Информация не передается только цветом
- [ ] Status indicators имеют текст или иконки (не только цвет)
- [ ] Ошибки форм имеют текстовое описание (не только красная рамка)
- [ ] Ссылки отличимы не только цветом (подчеркивание)

### 3.3 Text Resizing (WCAG 1.4.4)
- [ ] Текст можно увеличить до 200% без потери функциональности
- [ ] Layout не ломается при зуме 200%
- [ ] Горизонтальный скролл не появляется при зуме
- [ ] Используются относительные единицы (rem, em, %)

### 3.4 Focus Indicators (WCAG 2.4.7)
- [ ] Все focusable элементы имеют видимый focus indicator
- [ ] Focus ring контрастен (не теряется на фоне)
- [ ] Focus indicator >= 2px толщиной
- [ ] Custom focus states соответствуют или превосходят браузерные

---

## 📝 4. Forms (Формы)

### 4.1 Labels
- [ ] Все input имеют связанные `<label>`
- [ ] Labels видимы (не только placeholder)
- [ ] `for` attribute связан с `id` input
- [ ] Required fields помечены визуально и в коде (`required`, `aria-required`)

### 4.2 Error Handling
- [ ] Ошибки валидации видимы и понятны
- [ ] Ошибки связаны с input через `aria-describedby`
- [ ] `aria-invalid="true"` на полях с ошибками
- [ ] Общие ошибки формы анонсируются через `aria-live`
- [ ] Сообщения об успехе также анонсируются

### 4.3 Input Types
- [ ] Используются правильные input types (`email`, `tel`, `date`, `number`)
- [ ] Autocomplete attributes для персональных данных
- [ ] `inputmode` для числовых полей на мобильных

---

## 🖼️ 5. Images & Media (Изображения и медиа)

### 5.1 Alternative Text
- [ ] Все `<img>` имеют `alt` attribute
- [ ] Декоративные изображения: `alt=""`
- [ ] Информативные изображения: описательный `alt`
- [ ] SVG иконки: `aria-hidden="true"` или `<title>`

### 5.2 Icons
- [ ] Иконки-кнопки имеют `aria-label`
- [ ] Декоративные иконки: `aria-hidden="true"`
- [ ] Icon fonts имеют текстовые alternatives

---

## ⌨️ 6. Touch Targets (Сенсорные цели)

### 6.1 Size (WCAG 2.5.5)
- [ ] Минимальный размер кнопок: 44x44px (iOS)
- [ ] Рекомендованный размер: 48x48px (Material Design)
- [ ] Важные действия: 56x56px
- [ ] Spacing между touch targets >= 8px

### 6.2 Mobile Optimization
- [ ] Все кнопки легко нажимаются пальцем
- [ ] Нет слишком маленьких кликабельных областей
- [ ] Input fields >= 44px высотой
- [ ] Checkbox/Radio >= 44x44px область клика

---

## 🏃 7. Motion & Animations (Движение и анимации)

### 7.1 Prefers Reduced Motion (WCAG 2.3.3)
- [ ] `@media (prefers-reduced-motion: reduce)` реализован
- [ ] Все анимации отключаются или упрощаются
- [ ] Transition duration сокращается до ~0.01ms
- [ ] Scroll behavior становится `auto`

### 7.2 Animation Safety
- [ ] Нет мигающего контента > 3 раз в секунду (WCAG 2.3.1)
- [ ] Анимации не вызывают дискомфорт
- [ ] Parallax effects отключаются с `prefers-reduced-motion`

---

## 📱 8. Responsive & Mobile (Адаптивность)

### 8.1 Mobile Layout
- [ ] Контент читаем без горизонтального скролла
- [ ] Вертикальный скролл работает нормально
- [ ] Нет content overflow на маленьких экранах
- [ ] Текст не обрезается на узких экранах

### 8.2 Orientation
- [ ] Приложение работает в portrait и landscape
- [ ] Контент не заблокирован в одной ориентации

### 8.3 Zoom
- [ ] Zoom не блокируется (`user-scalable=yes`)
- [ ] Minimum-scale позволяет zoom
- [ ] Layout адаптируется под зум

---

## 🔍 9. Content (Контент)

### 9.1 Readability
- [ ] Язык страницы указан: `<html lang="ru">`
- [ ] Размер шрифта >= 16px для основного текста
- [ ] Line-height >= 1.5 для читаемости
- [ ] Paragraph spacing >= 2em

### 9.2 Links
- [ ] Текст ссылок описательный (не "click here")
- [ ] Ссылки отличимы от обычного текста
- [ ] External links помечены (иконка или текст)
- [ ] `target="_blank"` использует `rel="noopener noreferrer"`

### 9.3 Headings
- [ ] Заголовки используются правильно (не для стилизации)
- [ ] Один h1 на странице
- [ ] Нет пропусков уровней (h1 → h2, не h1 → h3)

---

## 🧪 10. Testing (Тестирование)

### 10.1 Automated Testing Tools
- [ ] **Lighthouse Accessibility**: Score >= 95
- [ ] **axe DevTools**: 0 violations
- [ ] **WAVE**: 0 errors
- [ ] **Pa11y**: No issues

### 10.2 Manual Testing
- [ ] Keyboard-only navigation test (отключить мышь)
- [ ] Screen reader test (NVDA, JAWS, VoiceOver)
- [ ] Zoom test (200%, 400%)
- [ ] High contrast mode test
- [ ] Color blindness simulation (Deuteranopia, Protanopia, Tritanopia)

### 10.3 Assistive Technology
- [ ] **NVDA** (Windows) - полная навигация работает
- [ ] **JAWS** (Windows) - полная навигация работает
- [ ] **VoiceOver** (macOS/iOS) - полная навигация работает
- [ ] **TalkBack** (Android) - полная навигация работает

---

## 📚 11. Documentation (Документация)

- [ ] Accessibility statement опубликован
- [ ] Keyboard shortcuts документированы
- [ ] Known issues перечислены
- [ ] Feedback mechanism доступен

---

## 🎯 12. Implementation Status

### Реализовано ✅
- [x] Keyboard navigation hooks (`useKeyboardNav`, `useEscapeKey`, `useArrowKeys`)
- [x] Focus trap for modals (`useFocusTrap`)
- [x] Tooltip component с поддержкой keyboard
- [x] Help center modal с keyboard shortcuts
- [x] Skip to content link (в `index.css`)
- [x] Screen reader only utility class (`.sr-only`)
- [x] Prefers reduced motion support (в `index.css`)
- [x] Touch target sizes (44px-56px)
- [x] Focus indicators (ring-2 ring-accent)
- [x] ARIA labels на ключевых компонентах
- [x] Color contrast проверка (WCAG AA)

### В процессе 🔄
- [x] Добавить `aria-label` и tooltips на все icon buttons (Header, Modal, AuditLogs, NotificationBell, Sidebar, ProductModal, Inventory и др.)
- [x] FormField: связь label с полем через `htmlFor`/`id` (useId при отсутствии id)
- [x] Добавить `aria-live` на toast notifications (контейнер + скрытая область для скринридеров)
- [x] Добавить `alt` text на все изображения (fallback для пустых alt)

### Планируется 📋
- [ ] Automated accessibility tests (Pa11y CI)
- [x] Accessibility statement page (`/accessibility`, ссылка в HelpCenter)
- [x] Keyboard shortcuts / Help (?) — открывает HelpCenter в layout
- [x] High contrast theme support (переключатель в Header, сохранение в localStorage)

---

## 🔍 Финальная проверка: Lighthouse и axe DevTools

1. **Lighthouse (Chrome DevTools или CLI)**
   - **В браузере:** DevTools → вкладка Lighthouse → категория **Accessibility** → Analyze page load. Цель: ≥ 90.
   - **Из терминала (нужен запущенный dev-сервер на порту 5173):**
     ```bash
     npm run dev
     # в другом терминале:
     npm run lighthouse:a11y
     ```
     Отчёт: `reports/lighthouse-a11y.html`. JSON: `npm run lighthouse:a11y-json` → `reports/lighthouse-a11y.json`.

2. **axe DevTools (расширение или встроенный в DevTools)**
   - Установить [axe DevTools](https://www.deque.com/axe/devtools/) или использовать встроенную проверку в Chrome (Lighthouse включает axe).
   - Запустить сканирование страницы; исправить критические и серьёзные замечания.
   - В development уже подключён `initAxe()` из `utils/axeAccessibility` — смотреть консоль и отчёты.
   - Ручная проверка из консоли: `window.runAxeCheck()` (результаты в консоли).
   - **Примечание:** В режиме development React Query DevTools добавляет в DOM панель с переключателем "Queries/Mutations". Axe может сообщать о **недостаточном контрасте** (Serious) для подписи "Mutations" — это элемент сторонней библиотеки, в production DevTools нет. Для «чистой» проверки запускайте axe на сборке без DevTools (`npm run build` + `npm run preview`) или временно отключите `<ReactQueryDevtools />` в `main.jsx`.

3. **Ручная проверка**
   - Tab-навигация по всему интерфейсу (в т.ч. модалки, сайдбар).
   - Skip to content по первому Tab на странице.
   - Озвучивание toast через скринридер (aria-live).
   - Формы: у каждого поля видимый или скрытый label / aria-label.

---

## 🚀 Quick Start Guide

### Для разработчиков

1. **Keyboard Navigation:**
   ```jsx
   import { useKeyboardNav } from '../hooks/useKeyboardNav'

   useKeyboardNav({
     onEscape: () => closeModal(),
     onSearch: () => focusSearch(),
     onCreate: () => navigate('/new'),
     onHelp: () => setShowHelp(true)
   })
   ```

2. **Tooltips:**
   ```jsx
   import Tooltip from '../components/Tooltip'

   <Tooltip content="Экспортировать данные (Ctrl+E)">
     <Button>Export</Button>
   </Tooltip>
   ```

3. **Focus Trap:**
   ```jsx
   import { useFocusTrap } from '../hooks/useFocusTrap'

   const modalRef = useFocusTrap(isOpen, {
     autoFocus: true,
     returnFocus: true
   })
   ```

4. **ARIA Labels:**
   ```jsx
   <button aria-label="Закрыть модальное окно">
     <X />
   </button>
   ```

---

## 📞 Support & Feedback

Если вы обнаружили проблемы с доступностью, пожалуйста:
- Создайте issue в репозитории
- Отправьте email: accessibility@freshtrack.com
- Telegram: @freshtrack_support

---

**Last Updated:** 2025-02-05
**WCAG Version:** 2.1 Level AA
**Target Compliance Date:** Q1 2025

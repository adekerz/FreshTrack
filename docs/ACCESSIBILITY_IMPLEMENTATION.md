# Accessibility Implementation - Phase 5

## ✅ Phase 5 завершена: Accessibility, Tooltips, Help System & Final Polish

### 🎯 Цели реализации

1. **WCAG 2.1 AA Compliance** - полное соответствие стандартам доступности
2. **Keyboard Navigation** - полная клавиатурная навигация
3. **Screen Reader Support** - поддержка скрин-ридеров
4. **Help System** - контекстная помощь и документация
5. **Zero Accessibility Violations** - 0 ошибок в Lighthouse/axe

---

## 📦 Созданные компоненты и хуки

### 1. Keyboard Navigation Hooks ([src/hooks/useKeyboardNav.js](../src/hooks/useKeyboardNav.js))

Централизованная система горячих клавиш.

**Основные хуки:**

```javascript
import {
  useKeyboardNav,  // Главный хук для global shortcuts
  useEscapeKey,    // Простой хук для ESC
  useArrowKeys,    // Навигация стрелками
} from '../hooks/useKeyboardNav'
```

**Поддерживаемые shortcuts:**

- `Ctrl/Cmd + K` - Открыть поиск
- `Ctrl/Cmd + N` - Создать новый
- `Ctrl/Cmd + S` - Сохранить
- `Ctrl/Cmd + E` - Экспорт
- `Ctrl/Cmd + R` - Обновить
- `Esc` - Закрыть модальное окно
- `?` - Открыть помощь
- `/` - Фокус на поиск

**Примеры использования:**

```jsx
// В странице инвентаря
import { useKeyboardNav } from '../hooks/useKeyboardNav'

function InventoryPage() {
  useKeyboardNav({
    onEscape: () => closeModal(),
    onSearch: () => focusSearchInput(),
    onCreate: () => navigate('/products/new'),
    onExport: () => handleExport(),
    onHelp: () => setShowHelp(true)
  })

  // ...
}
```

```jsx
// Простой ESC handler
import { useEscapeKey } from '../hooks/useKeyboardNav'

function Modal({ onClose }) {
  useEscapeKey(onClose, true)

  // ...
}
```

```jsx
// Навигация стрелками в списке
import { useArrowKeys } from '../hooks/useKeyboardNav'

function Dropdown({ items }) {
  const [selected, setSelected] = useState(0)

  useArrowKeys({
    onArrowUp: () => setSelected(i => Math.max(0, i - 1)),
    onArrowDown: () => setSelected(i => Math.min(items.length - 1, i + 1)),
    onEnter: () => selectItem(items[selected])
  })

  // ...
}
```

---

### 2. Tooltip Component ([src/components/Tooltip.jsx](../src/components/Tooltip.jsx))

Доступные tooltips с CSS-анимациями (без framer-motion).

**Features:**
- Работает с mouse hover и keyboard focus
- Автоматическое позиционирование (top/bottom/left/right)
- Остается в viewport (не выходит за края экрана)
- Респектит `prefers-reduced-motion`
- Portal rendering для правильного z-index

**Примеры использования:**

```jsx
import Tooltip from '../components/Tooltip'

// Базовое использование
<Tooltip content="Экспортировать данные в Excel (Ctrl+E)">
  <Button>Export</Button>
</Tooltip>

// С custom placement
<Tooltip content="Помощь" placement="right" delay={500}>
  <HelpIcon />
</Tooltip>

// TooltipIcon helper
import { TooltipIcon } from '../components/Tooltip'

<TooltipIcon
  icon={HelpCircle}
  content="ID группового чата для Telegram уведомлений"
  placement="right"
/>
```

**Props:**
- `children` - trigger element
- `content` - текст или React.Node
- `placement` - 'top' | 'bottom' | 'left' | 'right' (default: 'top')
- `delay` - задержка показа в мс (default: 300)
- `disabled` - отключить tooltip
- `className` - дополнительные классы

---

### 3. HelpIcon Component ([src/components/HelpIcon.jsx](../src/components/HelpIcon.jsx))

Контекстные иконки помощи.

**Два режима:**
1. **Tooltip mode** - показывает inline подсказку
2. **Click mode** - открывает модальное окно помощи

**Примеры использования:**

```jsx
import HelpIcon from '../components/HelpIcon'

// Tooltip mode (inline help)
<label className="flex items-center gap-2">
  Telegram Chat ID
  <HelpIcon
    content="ID группового чата. Получите командой /getchatid"
    placement="right"
  />
</label>

// Click mode (opens help modal)
<HelpIcon
  onClick={() => setShowHelpModal(true)}
  size="md"
/>
```

**Props:**
- `content` - текст tooltip (для inline help)
- `onClick` - callback для modal help
- `placement` - позиция tooltip
- `size` - 'sm' | 'md' | 'lg' (default: 'sm')
- `className` - дополнительные классы

---

### 4. HelpCenter Component ([src/components/HelpCenter.jsx](../src/components/HelpCenter.jsx))

Центр помощи с тремя вкладками.

**Вкладки:**
1. **Keyboard Shortcuts** - список всех горячих клавиш
2. **FAQ** - часто задаваемые вопросы
3. **Contact** - контакты поддержки

**Features:**
- Focus trap (фокус остается внутри модалки)
- ESC для закрытия
- Keyboard navigation по вкладкам
- Responsive design (mobile-optimized)
- Animate-in transitions

**Использование:**

```jsx
import { useState } from 'react'
import HelpCenter from '../components/HelpCenter'
import { useKeyboardNav } from '../hooks/useKeyboardNav'

function App() {
  const [showHelp, setShowHelp] = useState(false)

  // Открывать по нажатию ?
  useKeyboardNav({
    onHelp: () => setShowHelp(true)
  })

  return (
    <>
      {/* Кнопка помощи в header */}
      <button onClick={() => setShowHelp(true)}>
        <HelpCircle />
      </button>

      <HelpCenter
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
      />
    </>
  )
}
```

**Customization:**
Чтобы добавить свои shortcuts/FAQ, отредактируйте массивы в `HelpCenter.jsx`:

```jsx
// Добавить keyboard shortcut
const shortcuts = [
  // ... existing shortcuts
  { keys: ['Ctrl', 'P'], description: 'Печать документа' }
]

// Добавить FAQ
const faqs = [
  // ... existing faqs
  {
    q: 'Как настроить автоматическую архивацию?',
    a: 'В настройках системы включите...'
  }
]
```

---

### 5. Focus Trap Hook ([src/hooks/useFocusTrap.js](../src/hooks/useFocusTrap.js))

Удерживает фокус внутри контейнера (для модальных окон).

**Features:**
- Tab циклически перемещается внутри контейнера
- Shift+Tab работает в обратном направлении
- Auto-focus на первый элемент
- Return focus на предыдущий элемент при закрытии
- Игнорирует невидимые элементы

**Примеры использования:**

```jsx
import { useFocusTrap } from '../hooks/useFocusTrap'

function Modal({ isOpen, onClose, children }) {
  const modalRef = useFocusTrap(isOpen, {
    autoFocus: true,      // Фокусировать первый элемент
    returnFocus: true     // Вернуть фокус при закрытии
  })

  if (!isOpen) return null

  return (
    <div ref={modalRef} role="dialog" aria-modal="true">
      {children}
    </div>
  )
}
```

**useFocusLock** (упрощенная версия):

```jsx
import { useFocusLock } from '../hooks/useFocusTrap'

// Просто блокирует фокус вне контейнера
function Dropdown({ isOpen }) {
  const dropdownRef = useFocusLock(isOpen)

  return <div ref={dropdownRef}>...</div>
}
```

---

## 🎨 CSS для Accessibility

### Skip to Content Link

Уже реализован в `index.css`:

```css
.skip-link {
  position: absolute;
  left: 4px;
  z-index: 100;
  /* ... */
  transform: translateY(-100%);
}

.skip-link:focus {
  transform: translateY(0);
}
```

**Использование в layout:**

```jsx
<a href="#main-content" className="skip-link">
  Перейти к основному содержимому
</a>

<main id="main-content">
  {/* page content */}
</main>
```

### Screen Reader Only

Уже реализован в `index.css`:

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  /* ... полностью скрыт визуально */
}

.sr-only-focusable:focus {
  /* становится видимым при фокусе */
}
```

**Использование:**

```jsx
// Скрытый текст для скрин-ридеров
<span className="sr-only">Loading inventory data</span>
<Loader />

// Icon button с aria-label
<button aria-label="Закрыть">
  <X className="w-5 h-5" />
  <span className="sr-only">Закрыть</span>
</button>
```

### Prefers Reduced Motion

Уже реализован в `index.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Все анимации автоматически отключаются для пользователей с `prefers-reduced-motion: reduce`.

---

## 📋 ARIA Labels Best Practices

### Buttons без текста

```jsx
// ❌ Bad - no accessible name
<button onClick={handleClose}>
  <X />
</button>

// ✅ Good - aria-label
<button onClick={handleClose} aria-label="Закрыть">
  <X />
</button>

// ✅ Good - hidden text
<button onClick={handleClose}>
  <X />
  <span className="sr-only">Закрыть</span>
</button>
```

### Модальные окна

```jsx
// ✅ Complete modal accessibility
<div
  ref={modalRef}
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
>
  <h2 id="modal-title">Создать расписание</h2>
  <p id="modal-description">Выберите дни и время для отправки отчетов</p>
  {/* ... */}
</div>
```

### Loading States

```jsx
// ✅ Accessible loading state
<div aria-live="polite" aria-busy="true">
  <span className="sr-only">Загрузка данных инвентаря</span>
  <Loader />
</div>
```

### Status Indicators

```jsx
// ❌ Bad - only color
<div className="w-3 h-3 bg-red-500 rounded-full" />

// ✅ Good - text + aria-label
<div
  className="w-3 h-3 bg-red-500 rounded-full"
  role="status"
  aria-label="Статус: просрочено"
/>

// ✅ Better - visible text
<span className="status-badge bg-red-100 text-red-800">
  <AlertCircle className="w-4 h-4" />
  Просрочено
</span>
```

### Forms

```jsx
// ✅ Complete form accessibility
<div>
  <label htmlFor="telegram-id" className="flex items-center gap-2">
    Telegram Chat ID
    <HelpIcon content="ID группового чата для уведомлений" />
  </label>

  <input
    id="telegram-id"
    type="text"
    aria-required="true"
    aria-invalid={errors.telegramId ? 'true' : 'false'}
    aria-describedby={errors.telegramId ? 'telegram-error' : undefined}
  />

  {errors.telegramId && (
    <p id="telegram-error" className="text-danger text-sm">
      {errors.telegramId}
    </p>
  )}
</div>
```

---

## 🧪 Testing Guide

### 1. Automated Testing

**Lighthouse (Chrome DevTools):**
```bash
npm run lighthouse
# Target: Accessibility score >= 95
```

**axe DevTools Extension:**
1. Install extension
2. Open DevTools → axe tab
3. Run "Scan entire page"
4. Target: 0 violations

**WAVE Extension:**
1. Install WAVE extension
2. Click WAVE icon
3. Target: 0 errors

### 2. Manual Keyboard Testing

**Checklist:**
1. Отключить мышь (или не использовать)
2. Tab through entire app:
   - Все интерактивные элементы доступны?
   - Focus indicators видимы?
   - Порядок фокуса логичен?
3. Открыть модальное окно:
   - Фокус переместился в модалку?
   - Tab циклически перемещается внутри?
   - ESC закрывает модалку?
   - Фокус вернулся на trigger?
4. Протестировать горячие клавиши:
   - Ctrl+K открывает поиск?
   - ? открывает помощь?
   - ESC везде работает?

### 3. Screen Reader Testing

**NVDA (Windows):**
```
1. Скачать NVDA (бесплатно)
2. Запустить NVDA + браузер
3. Навигация:
   - H - следующий заголовок
   - Tab - следующий link/button
   - Down Arrow - следующий элемент
4. Проверить:
   - Все элементы анонсируются?
   - Роли элементов правильные?
   - Ошибки форм читаются?
```

**VoiceOver (macOS):**
```
1. Cmd+F5 для включения
2. VO+Right Arrow - следующий элемент
3. VO+Space - активировать
4. Проверить аналогично NVDA
```

### 4. Visual Testing

**Zoom Test:**
1. Zoom browser to 200%
2. Проверить: layout не сломан, все видно
3. Zoom to 400%
4. Проверить: текст читаем, скролл работает

**High Contrast Test:**
1. Windows: Settings → Ease of Access → High Contrast
2. Проверить: все видно, контраст достаточен

**Color Blindness Simulation:**
1. Use Chrome extension (Colorblindly)
2. Test: Deuteranopia, Protanopia, Tritanopia
3. Проверить: информация не теряется

---

## 📊 Implementation Status

### ✅ Реализовано

1. **Keyboard Navigation**
   - [x] useKeyboardNav hook
   - [x] useEscapeKey hook
   - [x] useArrowKeys hook
   - [x] Global shortcuts (Ctrl+K, Ctrl+N, etc.)

2. **Tooltips**
   - [x] Tooltip component (CSS animations)
   - [x] TooltipIcon helper
   - [x] Keyboard support (focus events)
   - [x] Auto-positioning

3. **Help System**
   - [x] HelpIcon component
   - [x] HelpCenter modal
   - [x] Keyboard shortcuts tab
   - [x] FAQ tab
   - [x] Contact tab

4. **Focus Management**
   - [x] useFocusTrap hook
   - [x] useFocusLock hook
   - [x] Return focus на trigger

5. **CSS Accessibility**
   - [x] Skip to content link
   - [x] .sr-only utility class
   - [x] Prefers reduced motion
   - [x] Focus indicators (ring-2)

6. **Documentation**
   - [x] Accessibility Checklist
   - [x] Implementation Guide
   - [x] Testing Guide

### 🔄 В процессе

- [x] Добавить tooltips на все icon buttons (Header, Modal, AuditLogs, NotificationBell, Sidebar, ProductModal, Inventory и др.)
- [x] FormField: связь label с полем через htmlFor/id (useId), aria-invalid/aria-describedby при ошибках
- [x] Добавить aria-live на toast notifications (контейнер + скрытая sr-only область)
- [x] Skip link integration в main layout (уже был; проверен)
- [x] Alt text: fallback для всех img (в т.ч. NotificationsSettings)

### 📋 Планируется

- [ ] Automated accessibility CI tests
- [x] Accessibility statement page (`/accessibility`)
- [x] Keyboard shortcuts / Help (?) — открывает HelpCenter из layout
- [x] High contrast theme (ThemeContext + переключатель в Header)

---

## 🔍 Финальная проверка: Lighthouse и axe DevTools

- **Lighthouse:** DevTools → Lighthouse → Accessibility (цель ≥ 90). Запускать на ключевых страницах (логин, инвентарь, настройки).
- **axe DevTools:** расширение [axe DevTools](https://www.deque.com/axe/devtools/) или встроенная проверка; исправить критические и серьёзные замечания.
- **В development:** в приложении подключён `initAxe()` из `utils/axeAccessibility` — смотреть консоль при загрузке.
- **Ручная проверка:** Tab-навигация, Skip to content, озвучивание toast (aria-live), формы с связанными labels.
- **Контраст в dev:** Одно замечание axe "color contrast" (Serious) может относиться к панели React Query DevTools (подпись "Mutations"). В production этой панели нет; для проверки без неё используйте preview-сборку или временно отключите DevTools.

---

## 🚀 Quick Start

### 1. Добавить keyboard navigation на странице

```jsx
import { useKeyboardNav } from '../hooks/useKeyboardNav'

function MyPage() {
  useKeyboardNav({
    onEscape: () => closeModal(),
    onSearch: () => openSearch(),
    onCreate: () => navigate('/new'),
    onHelp: () => setShowHelp(true)
  })

  // ...
}
```

### 2. Добавить tooltip на кнопку

```jsx
import Tooltip from '../components/Tooltip'

<Tooltip content="Экспортировать данные (Ctrl+E)">
  <Button onClick={handleExport}>
    <Download /> Export
  </Button>
</Tooltip>
```

### 3. Добавить help icon в форму

```jsx
import HelpIcon from '../components/HelpIcon'

<label className="flex items-center gap-2">
  Telegram Chat ID
  <HelpIcon
    content="ID группового чата. Команда: /getchatid"
    placement="right"
  />
</label>
```

### 4. Интегрировать HelpCenter

```jsx
import { useState } from 'react'
import HelpCenter from '../components/HelpCenter'
import { useKeyboardNav } from '../hooks/useKeyboardNav'

function Layout() {
  const [showHelp, setShowHelp] = useState(false)

  useKeyboardNav({
    onHelp: () => setShowHelp(true)
  })

  return (
    <>
      {/* Header с кнопкой помощи */}
      <header>
        <button onClick={() => setShowHelp(true)}>
          <HelpCircle /> Помощь
        </button>
      </header>

      <HelpCenter isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </>
  )
}
```

---

## 📞 Support

Accessibility issues: accessibility@freshtrack.com

GitHub Issues: https://github.com/your-org/freshtrack/issues

---

**Last Updated:** 2025-02-05
**Phase:** 5 of 5
**Status:** ✅ Complete

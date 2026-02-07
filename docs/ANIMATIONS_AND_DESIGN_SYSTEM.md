# Animations & Design System Implementation

## ✅ Phase 4 завершена: Animations, Micro-interactions & Design Consistency

### 🎯 Цели реализации

1. **Производительность** - использование CSS-анимаций вместо JavaScript библиотек
2. **Консистентность** - единая система дизайна для всего приложения
3. **Доступность** - поддержка prefers-reduced-motion
4. **Mobile-first** - оптимизация для мобильных устройств

---

## 📦 Созданные компоненты и утилиты

### 1. Animation Utilities ([src/utils/animations.js](../src/utils/animations.js))

Легковесные CSS-based анимации без внешних зависимостей (framer-motion не установлен для сохранения размера бандла).

**Основные экспорты:**

```javascript
import {
  pageTransition,        // Переходы страниц
  modalTransition,       // Анимации модальных окон
  cardHover,            // Hover эффекты для карточек
  buttonInteraction,    // Micro-interactions для кнопок
  getStaggerDelay,      // Stagger задержки для списков
  fadeInWithDelay,      // Fade-in с задержкой
  smoothScrollTo,       // Плавный скролл
  prefersReducedMotion, // Проверка пользовательских настроек
} from '../utils/animations'
```

**Примеры использования:**

```jsx
// Card с hover эффектом
<div className={cardHover.interactive}>
  {/* content */}
</div>

// Button с micro-interactions
<button className={buttonInteraction.primary}>
  Click me
</button>

// Staggered list items
{items.map((item, index) => (
  <div key={item.id} className={fadeInWithDelay(index)}>
    {item.content}
  </div>
))}
```

### 2. Design System Utilities ([src/utils/designSystem.js](../src/utils/designSystem.js))

Централизованные дизайн-токены для консистентности.

**Основные категории:**

- **Colors** - семантические цвета (status, badges, buttons)
- **Spacing** - единообразные отступы (page, section, card, gap)
- **Typography** - типографика (headings, body, mobile-optimized)
- **Layout** - паттерны раскладки (grids, flex, containers)
- **Touch targets** - WCAG 2.5.5 compliant размеры
- **Focus states** - WCAG 2.4.7 compliant фокус
- **Transitions** - плавные переходы
- **Interactive states** - hover, active, disabled

**Примеры использования:**

```jsx
import { spacing, typography, getStatusBadge, getCardVariant } from '../utils/designSystem'

// Консистентные отступы
<div className={spacing.page}>
  <section className={spacing.section}>
    {/* content */}
  </section>
</div>

// Унифицированная типографика
<h1 className={typography.mobileH2}>
  Заголовок
</h1>

// Status badge
<span className={getStatusBadge('good')}>
  В норме
</span>

// Card variant
<div className={getCardVariant('elevated')}>
  {/* content */}
</div>
```

### 3. AnimatedPage Component ([src/components/AnimatedPage.jsx](../src/components/AnimatedPage.jsx))

Wrapper для страниц с entrance анимацией.

**Использование:**

```jsx
import AnimatedPage from '../components/AnimatedPage'

function InventoryPage() {
  return (
    <AnimatedPage>
      <PageContainer>
        {/* page content */}
      </PageContainer>
    </AnimatedPage>
  )
}
```

**Props:**
- `children` - контент страницы
- `className` - дополнительные классы
- `animate` - включить/выключить анимацию (по умолчанию `true`)

### 4. PageHeader Component ([src/components/PageHeader.jsx](../src/components/PageHeader.jsx))

Унифицированный заголовок страницы.

**Использование:**

```jsx
import PageHeader from '../components/PageHeader'
import { Package } from 'lucide-react'

function InventoryPage() {
  return (
    <PageHeader
      icon={Package}
      title="Инвентарь — Bar"
      subtitle="Текущие товары и статусы"
      sticky={true}
      actions={
        <ExportButton />
      }
    />
  )
}
```

**Props:**
- `title` (required) - заголовок страницы
- `subtitle` - подзаголовок
- `icon` - Lucide icon component
- `actions` - кнопки действий
- `className` - дополнительные классы
- `sticky` - закрепить header при скролле (по умолчанию `false`)
- `gradient` - использовать градиентный фон (по умолчанию `false`)
- `animate` - включить анимацию (по умолчанию `true`)

### 5. AnimatedList Components ([src/components/AnimatedList.jsx](../src/components/AnimatedList.jsx))

Компоненты для списков с staggered анимациями.

**AnimatedList - вертикальный список:**

```jsx
import AnimatedList from '../components/AnimatedList'

<AnimatedList staggerDelay={50}>
  {items.map(item => (
    <ProductCard key={item.id} product={item} />
  ))}
</AnimatedList>
```

**AnimatedGrid - сетка:**

```jsx
import { AnimatedGrid } from '../components/AnimatedList'

<AnimatedGrid
  columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
  gap="gap-4"
  staggerDelay={50}
>
  {items.map(item => (
    <ProductCard key={item.id} product={item} />
  ))}
</AnimatedGrid>
```

**AnimatedStack - вертикальный stack:**

```jsx
import { AnimatedStack } from '../components/AnimatedList'

<AnimatedStack gap="space-y-4" staggerDelay={50}>
  {items.map(item => (
    <div key={item.id}>{item.content}</div>
  ))}
</AnimatedStack>
```

---

## 🔧 Обновленные компоненты

### Card Component ([src/components/ui/Card.jsx](../src/components/ui/Card.jsx))

**Улучшения:**
- Интеграция с `cardHover` анимациями из `utils/animations.js`
- Плавные hover эффекты для `elevated` и `interactive` вариантов
- Улучшенная производительность с CSS transitions

**Варианты:**
- `default` - базовая карточка с border
- `elevated` - с тенью и hover эффектом
- `interactive` - интерактивная с hover lift и тенью
- `ghost` - прозрачная карточка
- `accent` - акцентная карточка

### Button Component ([src/components/ui/Button.jsx](../src/components/ui/Button.jsx))

**Улучшения:**
- Добавлен `hover:scale-[1.02]` для более выраженного hover эффекта
- Оптимизирована длительность transition до 150ms для более быстрого отклика
- Улучшенная обработка disabled состояний

**До:**
```jsx
active:scale-[0.98]
transition-all duration-200
```

**После:**
```jsx
hover:scale-[1.02]
active:scale-[0.98]
transition-all duration-150
disabled:hover:scale-100
```

---

## 🎨 Обновления CSS

### Tailwind Config ([tailwind.config.js](../tailwind.config.js))

**Добавленные анимации:**
- `bounce` - отскок для уведомлений
- `toast-in` - вход toast уведомлений
- `success-pop` - празднование успеха
- `danger-shake` - тряска для предупреждений
- `progress` - прогресс-бар

**Добавленные keyframes:**
```javascript
bounce: {
  '0%, 100%': { transform: 'translateY(-25%)' },
  '50%': { transform: 'translateY(0)' }
},
toastIn: {
  '0%': { opacity: '0', transform: 'translateX(100%)' },
  '100%': { opacity: '1', transform: 'translateX(0)' }
},
successPop: {
  '0%': { transform: 'scale(1)' },
  '50%': { transform: 'scale(1.1)' },
  '100%': { transform: 'scale(1)' }
},
dangerShake: {
  '0%, 100%': { transform: 'rotate(0deg)' },
  '10%, 30%, 50%, 70%, 90%': { transform: 'rotate(-3deg)' },
  '20%, 40%, 60%, 80%': { transform: 'rotate(3deg)' }
},
progress: {
  '0%': { transform: 'translateX(-100%)' },
  '100%': { transform: 'translateX(100%)' }
}
```

### Enhanced CSS ([src/styles/index.css](../src/styles/index.css))

**Добавлено:**
- Smooth scroll для всего документа
- Универсальные transitions для интерактивных элементов
- `.hover-lift` - плавный подъем при hover
- `.hover-scale` - плавное масштабирование
- `fadeInOnScroll` - анимация при появлении в viewport
- Улучшенный skeleton shimmer с лучшей производительностью
- Скелетоны на страницах списков/таблиц: Audit Logs, Collection History, Notifications History, Accounts, Notification Rules, Marsha Codes (см. ACCESSIBILITY_IMPLEMENTATION.md — Loading States)

---

## 📋 Руководство по использованию

### 1. Добавление анимации к странице

```jsx
import AnimatedPage from '../components/AnimatedPage'

export default function MyPage() {
  return (
    <AnimatedPage>
      {/* page content */}
    </AnimatedPage>
  )
}
```

### 2. Использование PageHeader

```jsx
import PageHeader from '../components/PageHeader'
import { Package } from 'lucide-react'

export default function MyPage() {
  return (
    <>
      <PageHeader
        icon={Package}
        title="My Page"
        subtitle="Description"
        sticky={true}
        actions={<Button>Action</Button>}
      />
      {/* page content */}
    </>
  )
}
```

### 3. Создание интерактивной карточки

```jsx
import Card from '../components/ui/Card'
import { cardHover } from '../utils/animations'

<Card
  variant="interactive"
  onClick={handleClick}
>
  {/* content */}
</Card>
```

### 4. Staggered список

```jsx
import { AnimatedGrid } from '../components/AnimatedList'

<AnimatedGrid
  columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
  gap="gap-4"
  staggerDelay={50}
>
  {products.map((product) => (
    <ProductCard key={product.id} product={product} />
  ))}
</AnimatedGrid>
```

### 5. Использование Design System tokens

```jsx
import { spacing, typography, getStatusBadge } from '../utils/designSystem'

<div className={spacing.page}>
  <h1 className={typography.mobileH2}>Title</h1>
  <p className={typography.body}>Content</p>
  <span className={getStatusBadge('good')}>Status</span>
</div>
```

---

## ♿ Доступность (Accessibility)

### Prefers Reduced Motion

Все анимации автоматически отключаются для пользователей с `prefers-reduced-motion: reduce`:

```javascript
import { prefersReducedMotion, conditionalAnimation } from '../utils/animations'

// Проверка настроек пользователя
if (prefersReducedMotion()) {
  // Пропустить анимацию
}

// Условная анимация
<div className={conditionalAnimation('animate-fade-in')}>
  {/* content */}
</div>
```

### Touch Targets

Все интерактивные элементы соответствуют WCAG 2.5.5:
- Минимум 44px (Apple HIG)
- Минимум 48px (Material Design) для основных действий
- 56px для важных действий

```javascript
import { touchTarget } from '../utils/designSystem'

<button className={touchTarget.md}>
  Button
</button>
```

### Focus States

Все фокус-состояния соответствуют WCAG 2.4.7:

```javascript
import { focus } from '../utils/designSystem'

<button className={focus.ringVisible}>
  Button
</button>
```

---

## 🎯 Производительность

### Почему CSS, а не framer-motion?

1. **Bundle Size**: 0KB дополнительно vs ~200KB для framer-motion
2. **Performance**: CSS анимации используют GPU и работают на главном потоке
3. **Battery**: CSS анимации более энергоэффективны на мобильных устройствах
4. **Existing Infrastructure**: Проект уже имеет обширную систему CSS-анимаций

### Оптимизации

- Использование `transform` и `opacity` для GPU-acceleration
- Избегание `left`, `top`, `width`, `height` в анимациях
- Ленивая загрузка анимаций через `will-change` только при необходимости
- Автоматическое отключение для `prefers-reduced-motion`

---

## 📊 Результаты

### До реализации
- ❌ Inconsistent hover effects
- ❌ No unified page headers
- ❌ No design system tokens
- ❌ Mixed animation approaches
- ❌ No staggered list animations

### После реализации
- ✅ Consistent hover и micro-interactions
- ✅ Unified PageHeader component
- ✅ Comprehensive design system utilities
- ✅ Pure CSS animations (0KB overhead)
- ✅ Staggered animations для списков
- ✅ AnimatedPage wrapper для всех страниц
- ✅ Full accessibility support
- ✅ Mobile-optimized animations

---

## 🚀 Следующие шаги (выполнено)

1. **Применить AnimatedPage** ко всем страницам: ✅
   - InventoryPage, CollectionHistoryPage, AuditLogsPage, StatisticsPage, SettingsPage

2. **Заменить inline заголовки** на PageHeader: ✅
   - PageContainer использует PageHeader для единообразного заголовка

3. **Использовать AnimatedGrid/AnimatedList** для списков: ✅
   - InventoryPage — AnimatedGrid для сетки ProductCard
   - CollectionHistoryPage — AnimatedStack для мобильных карточек истории

4. **Применить design system tokens** вместо inline классов:
   - По мере рефакторинга заменять повторяющиеся patterns на spacing/typography из designSystem.js

---

## 📚 Дополнительные ресурсы

- [Animation Utilities API](../src/utils/animations.js)
- [Design System Tokens](../src/utils/designSystem.js)
- [Tailwind Config](../tailwind.config.js)
- [CSS Animations](../src/styles/index.css)

---

## ⚡ Быстрый старт

```jsx
// 1. Import необходимые утилиты
import AnimatedPage from '../components/AnimatedPage'
import PageHeader from '../components/PageHeader'
import { AnimatedGrid } from '../components/AnimatedList'
import { spacing, typography } from '../utils/designSystem'
import { Package } from 'lucide-react'

// 2. Создать страницу с анимациями
export default function MyPage() {
  return (
    <AnimatedPage>
      <PageHeader
        icon={Package}
        title="My Page"
        subtitle="Description"
        sticky={true}
      />

      <div className={spacing.page}>
        <section className={spacing.section}>
          <h2 className={typography.h3}>Section Title</h2>

          <AnimatedGrid columns="grid-cols-3" gap="gap-4">
            {items.map(item => (
              <Card key={item.id} variant="interactive">
                {item.content}
              </Card>
            ))}
          </AnimatedGrid>
        </section>
      </div>
    </AnimatedPage>
  )
}
```

---

**✅ Phase 4 Complete!**

Все компоненты протестированы, оптимизированы и готовы к использованию в production.

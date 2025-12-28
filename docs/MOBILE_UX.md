# Mobile UI/UX Best Practices — FreshTrack

Этот документ описывает реализованные мобильные улучшения согласно Material Design 3, Apple HIG и web.dev рекомендациям.

## Реализованные компоненты

### 1. Touch Targets (48px minimum)

Все интерактивные элементы теперь имеют минимальный размер 48×48px согласно Material Design.

```jsx
// Использование TouchButton
import { TouchButton, IconButton } from '@/components/ui'

<TouchButton variant="primary" size="md" icon={Plus}>
  Добавить товар
</TouchButton>

<IconButton icon={Bell} badge={5} label="Уведомления" />
```

### 2. QuantityStepper

Touch-friendly ввод количества с +/- кнопками:

```jsx
import { QuantityStepper } from '@/components/ui'

<QuantityStepper
  value={quantity}
  onChange={setQuantity}
  min={0}
  max={999}
  size="md"
  label="Количество"
/>
```

### 3. ExpirationBadge

Цветовая индикация срока годности:

```jsx
import { ExpirationBadge, useExpirationColor } from '@/components/ui'

// Компонент
<ExpirationBadge date="2024-01-15" showDays />

// Хук для кастомной стилизации
const { status, bgClass, textClass } = useExpirationColor(daysUntil)
```

### 4. BottomSheet & FilterChips

Мобильные фильтры вместо dropdown:

```jsx
import { BottomSheet, FilterChips, BottomSheetActions } from '@/components/ui'

<BottomSheet isOpen={isOpen} onClose={onClose} title="Фильтры">
  <FilterChips
    options={[
      { value: 'expired', label: 'Истёк' },
      { value: 'fresh', label: 'Свежий' },
    ]}
    value={filter}
    onChange={setFilter}
  />
  <BottomSheetActions>
    <Button onClick={apply}>Применить</Button>
  </BottomSheetActions>
</BottomSheet>
```

### 5. SwipeableCard

Swipe-to-reveal actions:

```jsx
import { SwipeableCard } from '@/components/ui'

<SwipeableCard
  onEdit={() => handleEdit(item)}
  onDelete={() => handleDelete(item)}
>
  <ProductCard item={item} />
</SwipeableCard>
```

### 6. MobileInventoryCard

Responsive карточки для инвентаря:

```jsx
import { MobileInventoryCard, MobileInventoryList } from '@/components/ui'

// Одна карточка
<MobileInventoryCard
  item={product}
  onEdit={handleEdit}
  onDelete={handleDelete}
  onCollect={handleCollect}
/>

// Список карточек
<MobileInventoryList
  items={products}
  onEdit={handleEdit}
  onDelete={handleDelete}
/>
```

### 7. FAB (Floating Action Button)

Material Design FAB:

```jsx
import { FAB, SpeedDial } from '@/components/ui'

// Простой FAB
<FAB onClick={handleAdd} icon={Plus} label="Добавить" />

// SpeedDial с несколькими действиями
<SpeedDial
  actions={[
    { icon: Package, label: 'Товар', onClick: addProduct },
    { icon: Camera, label: 'Сканировать', onClick: openScanner },
  ]}
/>
```

### 8. PullToRefresh

Жест "потянуть для обновления":

```jsx
import { PullToRefresh } from '@/components/ui'

<PullToRefresh onRefresh={fetchData}>
  <ProductList items={products} />
</PullToRefresh>
```

### 9. OfflineIndicator

Индикатор offline-режима:

```jsx
import { OfflineIndicator, useOnlineStatus } from '@/components/ui'

// Автоматический компонент (уже добавлен в Layout)
<OfflineIndicator />

// Хук для проверки статуса
const isOnline = useOnlineStatus()
```

## CSS Utilities

Добавлены новые CSS классы:

```css
/* Touch targets */
.touch-target     /* min-h-48px min-w-48px */
.touch-target-lg  /* min-h-56px min-w-56px */
.touch-target-sm  /* min-h-44px min-w-44px */

/* Safe areas */
.safe-top         /* padding-top: env(safe-area-inset-top) */
.safe-bottom      /* padding-bottom: env(safe-area-inset-bottom) */
.safe-area-pb     /* то же, что safe-bottom */

/* Desktop vs Mobile */
.table-desktop    /* скрывается на mobile */
.cards-mobile     /* показывается только на mobile */
```

## IndexedDB для Offline

```jsx
import db from '@/utils/indexedDB'

// Сохранить данные
await db.put('items', product)

// Получить все
const items = await db.getAll('items')

// Получить истекающие товары
const expiring = await db.getExpiringItems(7) // за 7 дней

// Добавить в очередь синхронизации
await db.addPendingChange({ type: 'create', data: product })

// Синхронизировать при восстановлении сети
await db.syncPendingChanges(async (change) => {
  await api.sync(change)
})
```

## Чеклист внедрения

### Сделано ✅
- [x] Touch targets 48px minimum (CSS + Button component)
- [x] touch-action: manipulation глобально
- [x] Bottom Navigation улучшен
- [x] QuantityStepper для чисел
- [x] Card layout для mobile (MobileInventoryCard)
- [x] ExpirationBadge с цветовой индикацией
- [x] BottomSheet для фильтров
- [x] SwipeableCard с gestures
- [x] FAB для основного действия
- [x] PullToRefresh
- [x] OfflineIndicator
- [x] IndexedDB для offline storage
- [x] Service Worker с caching
- [x] Lazy loading страниц
- [x] Safe areas для iOS

### Рекомендации для страниц
- [ ] Заменить таблицы на MobileInventoryList в InventoryPage
- [ ] Добавить FilterBottomSheet в InventoryPage  
- [ ] Добавить FAB для добавления товаров
- [ ] Интегрировать PullToRefresh на списковых страницах

## Ссылки

- [Material Design 3](https://m3.material.io)
- [Apple HIG](https://developer.apple.com/design/human-interface-guidelines)
- [web.dev PWA](https://web.dev/progressive-web-apps/)
- [Tailwind Responsive](https://tailwindcss.com/docs/responsive-design)

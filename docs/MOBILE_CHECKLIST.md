# Итоговый чеклист — мобильная адаптация FreshTrack

## Критичные (обязательно)

| # | Элемент | Статус | Где |
|---|---------|--------|-----|
| 1 | **MobileSidebar** с hamburger menu | ✅ | `Layout` + `MobileSidebar`, `Sidebar` embedded |
| 2 | **TouchButton** (min 44px) | ✅ | `TouchButton.jsx`, замены по приложению |
| 3 | **ResponsiveTable** (карточки на mobile) | ✅ | `ResponsiveTable.jsx`, опционально в списках |
| 4 | **Адаптивные модалки** (full-screen на mobile) | ✅ | `Modal`, `FastIntakeModal`, `ProductModal`, и др. |
| 5 | **TouchInput** (высота 44px) | ✅ | `TouchInput.jsx`, формы (AddBatch, FilterBottomSheet) |
| 6 | **Bottom navigation bar** | ✅ | `MobileBottomNav` в `Layout` (< lg) |
| 7 | **Viewport meta tag** | ✅ | `index.html`: `width=device-width, initial-scale=1.0` |
| 8 | **Safe area insets** | ✅ | `index.css` `.safe-area-inset-*`, MobileBottomNav `env(safe-area-inset-bottom)` |

## Важные (сильно улучшают UX)

| # | Элемент | Статус | Где |
|---|---------|--------|-----|
| 1 | **Pull-to-refresh** | ✅ | `usePullToRefresh`, `InventoryPage` |
| 2 | **Swipe gestures** для sidebar | ✅ | `MobileSidebar` swipe-to-close |
| 3 | **LazyImage** | ✅ | `LazyImage.jsx`, экспорт в `ui` |
| 4 | **Code splitting** для routes | ✅ | `App.jsx`: `lazy()` для Dashboard, Inventory, Settings, и др. |
| 5 | **Responsive typography** | ✅ | `index.css` `--font-size-*`, media desktop |
| 6 | **Haptic feedback** | ✅ | `utils/haptics.js` (light, medium, heavy, success, error) |
| 7 | **Touch-friendly spacing** | ✅ | `touch-target`, `touch-spacing`, отступы в модалках/кнопках |

## Полировка (когда будет время)

| # | Элемент | Статус |
|---|---------|--------|
| 1 | Анимации (framer-motion) | ⬜ |
| 2 | Skeleton loaders | ⬜ (частично: `Skeleton*` в ui) |
| 3 | Optimistic updates | ⬜ |
| 4 | Offline mode (PWA) | ⬜ (есть `sw.js`, OfflineIndicator) |
| 5 | Push notifications | ⬜ (есть permission banner, нет push) |

---

## Дополнительно реализовано

- **Скрытие scrollbar на mobile** (Phase 6.1): `index.css` `@media (max-width: 768px)`
- **Safe area utility классы** (Phase 6.2): `.safe-area-inset-top/bottom/left/right`
- **TouchSelect**: мобильный-friendly `<select>`, используется в формах
- **MobileDebugHelper**: dev-only, отображает breakpoint/orientation/touch
- **Skip link**: `#main-content` для a11y

Ориентир по фазам: `MOBILE_UX.md`, `ACCESSIBILITY.md`.

# Dark mode: контраст (WCAG AA)

**Требования WCAG AA:** обычный текст ≥4.5:1, крупный текст ≥3:1.

## Основные пары (.dark)

| Передний план | Фон | Ratio | Статус |
|---------------|-----|-------|--------|
| `--foreground` #FAF8F5 | `--background` #121212 | ~14:1 | ✓ AA |
| `--muted-foreground` #A3A3A3 | `--background` #121212 | ~7.2:1 | ✓ AA |
| `--primary` #FFB499 | `--card` #1E1E1E | ~5.8:1 | ✓ AA (предпочтительно для кнопок/крупного текста) |
| `--primary-foreground` #1A1A1A | `--primary` #FFB499 | ~8:1 | ✓ AA |
| `--card-foreground` #FAF8F5 | `--card` #1E1E1E | ~14:1 | ✓ AA |
| `--secondary-foreground` #FAF8F5 | `--secondary` #2D2D2D | ~12:1 | ✓ AA |

## Рекомендации

- **Мелкий текст на карточке:** использовать `text-foreground` или `text-card-foreground`, не `text-primary`.
- **Кнопки и крупный акцентный текст:** `text-primary` на `bg-card` допустим (5.8:1).
- **Success/warning/danger:** проверить при изменении палитры (обычно на тёмном фоне достаточный контраст).

Переменные заданы в `src/styles/index.css` в блоке `.dark`. При добавлении новых цветов — проверить контраст (например, WebAIM Contrast Checker).

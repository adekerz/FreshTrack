# QA Testing — FreshTrack Mobile & Desktop

## Phase 7.1: Device viewport checklist

Проверь вручную в Chrome DevTools (**Device Toolbar** — `Ctrl+Shift+M` / `Cmd+Shift+M`) или в реальном устройстве:

| Устройство | Ширина × Высота | Описание |
|------------|-----------------|----------|
| **iPhone SE** | 375 × 667 | Smallest iOS |
| **iPhone 12/13/14** | 390 × 844 | Наиболее распространённый |
| **iPhone 14 Pro Max** | 430 × 932 | Крупный iPhone |
| **Android Small** (Pixel 4a) | 360 × 640 | Маленький Android |
| **Android Medium** (Pixel 5) | 412 × 915 | Средний Android |
| **Tablet Portrait** (iPad) | 768 × 1024 | Планшет портрет |
| **Tablet Landscape** (iPad) | 1024 × 768 | Планшет альбом |

### Что проверять на каждом viewport

- [ ] **Layout**: контент не обрезается, нет горизонтального скролла
- [ ] **Навигация**: hamburger → MobileSidebar на mobile; Bottom nav видна и кликабельна
- [ ] **Таблицы**: на &lt; md — карточки (ResponsiveTable), на ≥ md — таблица
- [ ] **Модалки**: full-screen slide-up на mobile, центрированные на desktop
- [ ] **Инпуты**: min-height 44px, удобный ввод
- [ ] **Safe area**: нижняя навбар не перекрыта вырезом/индикатором (iPhone)
- [ ] **Скролл**: скроллбар скрыт на mobile (Phase 6.1), скролл работает

### Быстрый тест в DevTools

1. Открой приложение (dev: `npm run dev:client`, затем `http://localhost:5173`).
2. `F12` → **Toggle device toolbar** (иконка с телефоном/планшетом).
3. Выбери пресет (например, iPhone 12 Pro) или задай размер вручную.
4. Пройди: Login → Dashboard → Inventory → Настройки. Проверь модалки, формы, нижнюю навбар.

---

## Phase 7.2: Lighthouse audit

### Обязательно перед запуском

**Сначала запусти приложение** — без этого Lighthouse получит `chrome-error://chromewebdata` и «Chrome prevented page load with an interstitial».

1. **Терминал 1** (оставь запущенным):
   ```bash
   npm run dev:client
   ```
   Дождись `ready` и `Local: http://localhost:5173` (или `http://localhost:5174`, если 5173 занят).

2. **Терминал 2**:
   ```bash
   npm run lighthouse
   ```

Если Vite запустился на **другом порту** (например 5174), укажи URL явно:

```bash
npx lighthouse http://localhost:5174 --output html --output-path ./reports/lighthouse.html --max-wait-for-load=60000 --chrome-flags="--headless --no-sandbox --disable-dev-shm-usage --disable-gpu"
```

### Запуск (кратко)

```bash
# 1) В одном терминале — dev-сервер (не закрывать):
npm run dev:client

# 2) В другом — Lighthouse (по умолчанию http://localhost:5173):
npm run lighthouse
```

Отчёт сохраняется в `./reports/lighthouse.html`. Открой в браузере.

### Известные особенности (headless)

При `npm run lighthouse` в headless Chrome иногда появляются предупреждения:

| Сообщение | Причина | Что делать |
|-----------|---------|------------|
| **RootCauses: `frame_sequence` undefined** | Известный баг Lighthouse/Chrome в headless | Отчёт всё равно создаётся. Для полной точности по Performance запускай аудит вручную в Chrome DevTools (Lighthouse вкладка, без headless). |
| **NO_LCP** в части аудитов | LH смотрит экран загрузки (Loader + «FreshTrack»); LCP может не определиться | Для осмысленного LCP открой в браузере `/login`, затем в DevTools → Lighthouse → Analyze page load. |
| **Caught exception: NO_LCP** в других аудитах | Следствие сбоя RootCauses / trace | Те же обходные пути, что выше. |

**Варианты запуска:**

- `npm run lighthouse` — mobile, headless (иногда RootCauses/NO_LCP).
- `npm run lighthouse:desktop` — desktop preset, headless; при необходимости меньше сбоев trace.
- **Chrome DevTools** (F12 → Lighthouse) — без headless; самые надёжные метрики.

### Performance: dev vs production (**важно**)

**Аудит на `npm run dev:client` (localhost:5173) даёт заведомо плохой Performance** (FCP/LCP 15–45 с, TBT >1000 ms, «Minify JS» 3+ MiB, «Reduce unused JS» 2+ MiB). Причина: dev-сборка — неминфицированный JS, `@vite/client`, `@react-refresh`, `react-dom.development`, все чанки и т.д.

**Для адекватных метрик Performance всегда проверяй production-сборку:**

1. **Терминал 1:**
   ```bash
   npm run build:client && npm run preview
   ```
   Дождись `Local: http://localhost:4173` (или другой порт).

2. **Терминал 2:**  
   `npm run lighthouse:preview`  
   Скрипт обращается к `http://localhost:4173`. Если preview на другом порту — укажи URL вручную в `npx lighthouse ...`.

   При headless-запуске в логе часто видны `RootCauses:error ... frame_sequence` и предупреждения по TraceElements — это известный баг Lighthouse. Отчёт создаётся, оценки Performance/A11y/SEO считаются. Для максимально точных метрик по Performance лучше прогонять Lighthouse вручную в Chrome DevTools (вкладка Lighthouse).

3. **Рекомендуется:** также отключить расширения Chrome (или окно инкогнито) при аудите — иначе «Unattributable» и расширения завышают TBT и искажают отчёт.

### Целевые показатели

| Категория | Цель |
|-----------|------|
| **Performance** | > 90 |
| **Accessibility** | > 95 |
| **Best Practices** | > 95 |
| **SEO** | > 90 |

### Типичные правки после аудита

- **Performance:** оценивать только на **production** (build + preview). Дополнительно: LazyImage, code splitting (есть), сжатие на сервере (gzip/brotli).
- **Accessibility:** контраст, размер тапов (44px), `aria-*`, `role`, skip link (есть).
- **Best Practices:** HTTPS, современные API, консоль без ошибок.
- **SEO:** `meta` description, семантика, `manifest` (есть).

Исправляй в первую очередь **critical** и **serious** замечания Lighthouse.

# FreshTrack — Frontend Rules

## Стек
- React 18.2 · Vite 5.x · TailwindCSS 3.4
- **TanStack Query v5** (`@tanstack/react-query`) — серверное состояние
- React Router 6.x · i18next 23.x (8 языков) · Chart.js 4.x · React Hot Toast
- **Не используем:** Next.js, Remix, Redux, MobX

---

## Главный принцип: Backend = Source of Truth

### ❌ Запрещено вычислять на фронте (ТОЛЬКО backend):
```javascript
// ❌ Бизнес-решения и permissions — только backend
if (user.role === 'ADMIN') { ... }
const canDelete = user.permissions.includes('delete')

// ❌ Пороговые бизнес-правила — hardcoded пороги ЗАПРЕЩЕНЫ
const isCritical = daysLeft < 3    // "3 дня" — это бизнес-правило отеля!
const isExpiring = daysLeft < 7    // НЕЛЬЗЯ hardcode, разные отели = разные пороги
```

### ✅ Допустимо на фронте (display-enrichment для UI):
```javascript
// ✅ UI-обогащение: вычисление daysLeft для отображения
// getBatchStatus — вычисляет daysLeft на основе дат с backend
function getBatchStatus(batch, hotelThresholds) {
  const expiryDate = new Date(batch.expiry_date)
  const daysLeft = Math.ceil((expiryDate - Date.now()) / (1000*60*60*24))
  
  // ✅ Пороговые значения ИЗ настроек отеля (переданы с backend)
  const { criticalDays = 3, warningDays = 7 } = hotelThresholds
  
  let status = 'active'
  if (daysLeft <= 0) status = 'expired'
  else if (daysLeft <= criticalDays) status = 'critical'
  else if (daysLeft <= warningDays) status = 'warning'
  
  return { status, daysLeft, statusText: t(`batch.status.${status}`) }
}

// Использование:
const { data } = useBatches(hotelId)
const { batches, hotelSettings } = data
const statusInfo = getBatchStatus(batch, hotelSettings.expiryThresholds)

// ✅ Форматирование дат, перевод, сортировка для UI
const formatted = new Intl.DateTimeFormat('ru').format(new Date(batch.expiry_date))
```

### **Ключевое правило:**
| Тип логики | Где | Примеры |
|---|---|---|
| **Бизнес-решения** | ТОЛЬКО backend | Permissions, может ли удалять, пороговые значения (3 дня = критично) |
| **Display-enrichment** | Допустимо на фронте | Вычисление daysLeft, форматирование дат, цвета бейджей |

**⚠️ ВАЖНО:** Если результат влияет на **действие пользователя** (can delete, can export) — только backend.  
Если только для **визуального отображения** (цвет бейджа, текст) — допустимо на фронте, НО пороги берутся с backend (settings отеля).

---

## Data Layer: TanStack Query

**Все серверные данные — только через хуки React Query. Никакого `useState` для серверных данных.**

### Query — чтение данных:
```javascript
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryKeys'
import { apiFetch } from '../services/api'

export function useBatches(hotelId, params = { page: 1, limit: 20 }) {
  return useQuery({
    queryKey: queryKeys.batches(hotelId, params),  // ключ из фабрики!
    queryFn: async () => {
      const sp = new URLSearchParams({ hotel_id: hotelId, ...params })
      const response = await apiFetch(`/batches?${sp}`)
      return {
        data: (response.batches || []).map(normalizeBatch),
        pagination: { total: response.total, page: response.page, ... }
      }
    },
    enabled: !!hotelId,
    staleTime: STALE_TIMES.batches,
    placeholderData: keepPreviousData  // убирает мигание при пагинации
  })
}
```

### Mutation — изменение данных:
```javascript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateInventoryQueries } from '../lib/queryClient'

export function useCreateBatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data) => apiFetch('/batches', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    onSuccess: (_, variables) => {
      // Инвалидируем связанные queries
      invalidateInventoryQueries(queryClient, variables.hotelId)
      toast.success(t('batches.created'))
    },
    onError: (error) => {
      toast.error(error.message || t('errors.generic'))
    }
  })
}
```

### queryKeys — ТОЛЬКО через фабрику:
```javascript
// ✅ Правильно
queryKeys.batches(hotelId, params)
queryKeys.products(hotelId)
queryKeys.auditLogs(hotelId, filters)

// ❌ Запрещено — строки вручную
['batches', hotelId]
'batches-list'
```

### Инвалидация после мутаций:
```javascript
// ✅ Инвалидировать связанные данные после любой мутации
queryClient.invalidateQueries({ queryKey: queryKeys.batches(hotelId) })
queryClient.invalidateQueries({ queryKey: queryKeys.batchesStats(hotelId) })

// Или хелпер для инвентаря
invalidateInventoryQueries(queryClient, hotelId)
```

---

## Permissions в UI

```jsx
// ✅ Из данных API — backend решает что показывать
{permissions?.canEdit && <EditButton />}
{permissions?.canDelete && <DeleteButton />}
{permissions?.canExport && <ExportButton />}

// ❌ Запрещено — role checks на фронте
{user.role === 'HOTEL_ADMIN' && <EditButton />}
```

---

## SUPER_ADMIN: переключатель отелей

SUPER_ADMIN имеет переключатель активного отеля на UI. При переключении:
```javascript
// Все запросы получат X-Hotel-Id header через apiFetch
// При смене отеля — инвалидировать ВСЕ данные
queryClient.clear()   // или
queryClient.invalidateQueries()
```

---

## Чеклист компонента

### States (все обязательны):
- [ ] **Loading** — skeleton или spinner (не текст "Загрузка...")
- [ ] **Error** — toast + inline сообщение (не `error.toString()`)
- [ ] **Empty** — `<EmptyState>` компонент с действием
- [ ] **Success** — toast 3 сек для мутаций
- [ ] **Disabled** — кнопки заблокированы во время `isPending`

### UX:
- [ ] Mobile-first — `flex flex-col md:flex-row` (не наоборот)
- [ ] Touch targets ≥ 48px — `min-h-[48px]` или `min-h-[44px]`
- [ ] Keyboard navigation — Tab, Enter, Escape
- [ ] Focus states — видимы

### Integration:
- [ ] Есть путь попасть (навигация)
- [ ] Есть путь вернуться (back / breadcrumbs)
- [ ] i18n keys — не hardcoded текст
- [ ] `{permissions?.canEdit && ...}` — скрываем недоступные действия
- [ ] После мутации → инвалидация queries

---

## Form Pattern

```jsx
function CreateBatchForm({ hotelId, onSuccess }) {
  const { t } = useTranslation()
  const createBatch = useCreateBatch()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const formData = Object.fromEntries(new FormData(e.target))

    createBatch.mutate({ ...formData, hotelId }, {
      onSuccess: () => {
        onSuccess?.()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* поля */}
      {createBatch.error && (
        <p className="text-red-600 text-sm">{createBatch.error.message}</p>
      )}
      <button
        type="submit"
        disabled={createBatch.isPending}
        className="min-h-[48px] px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
      >
        {createBatch.isPending ? t('common.saving') : t('common.save')}
      </button>
    </form>
  )
}
```

---

## List Pattern

```jsx
function BatchList({ hotelId }) {
  const { data, isLoading, error } = useBatches(hotelId)

  if (isLoading) return <SkeletonList rows={5} />
  if (error) return <ErrorMessage message={error.message} onRetry={refetch} />
  if (!data?.data?.length) return <EmptyState title={t('batches.empty')} />

  return (
    <div>
      {data.data.map(batch => (
        <BatchCard key={batch.id} batch={batch} />
      ))}
      <Pagination {...data.pagination} />
    </div>
  )
}
```

---

## Modal Pattern

```jsx
function ConfirmDeleteModal({ isOpen, onClose, onConfirm, itemName, isPending }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-md w-full shadow-xl">
        <h3 className="text-lg font-semibold">{t('common.deleteTitle', { name: itemName })}</h3>
        <p className="mt-2 text-sm text-gray-600">{t('common.deleteConfirm')}</p>
        <div className="flex gap-3 mt-6 justify-end">
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 border rounded-lg min-h-[44px]"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 bg-red-600 text-white rounded-lg min-h-[44px] disabled:opacity-50"
          >
            {isPending ? t('common.deleting') : t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## Error Handling через apiFetch

`apiFetch` сам обрабатывает 401 и 403 глобально (через CustomEvent `auth:unauthorized`, `auth:forbidden`). В компонентах обрабатываем остальное:

```javascript
// В useMutation onError или try/catch в queryFn
if (error.status === 429) {
  toast.error(t('errors.rateLimit'))
} else {
  toast.error(error.message || t('errors.generic'))
}
// 401/403 — уже обработаны глобально в apiFetch, не дублировать
```

---

## Auth & MFA Patterns

```jsx
// Protected routes
<Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
<Route path="/settings" element={<RequireAuth><RequireMFA><Settings /></RequireMFA></RequireAuth>} />

// Grace period banner — только для SUPER_ADMIN с req.user.mfa_required
{user?.mfaRequired && !user?.mfaEnabled && <MFAGracePeriodBanner />}

// Email verification
if (user && !user.emailVerified) navigate('/verify-email')
```

### MFA компоненты:
- `MFASetupPage` — QR код + ручной ввод + backup codes + подтверждение
- `MFALoginForm` — `CodeInput` (6 цифр, auto-focus, auto-tab, paste) + backup code toggle
- `MFAGracePeriodBanner` — countdown + ссылка на `/settings/security`

---

## i18n

```jsx
// ✅ Всегда через t()
const { t } = useTranslation()
<h1>{t('dashboard.title')}</h1>
<button>{t('common.save')}</button>

// ❌ Запрещено
<h1>Dashboard</h1>
<p>Сохранено успешно</p>
```

Языки: **ru** (default), en, kk, de, fr, es, it, ar (RTL).

---

## СТОП — не пиши код если:
- Данных нет в API — не имитируй на фронте
- Логика принадлежит backend — не дублируй
- UI без навигации к/от страницы
- Нет всех states (loading/error/empty/success)
- Нет i18n keys
- Мутация без инвалидации queries

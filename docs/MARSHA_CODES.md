# MARSHA Codes - Marriott Property Identification System

## Обзор

MARSHA (Marriott Automated Reservation System for Hotel Accommodations) — система идентификации отелей Marriott International. Каждый отель имеет уникальный 5-символьный код.

## Структура кода

```
TSEMC
│││││
│││└┴── Суффикс бренда (2 символа)
└┴┴──── IATA код аэропорта (3 символа)
```

### Суффиксы брендов

| Код | Бренд |
|-----|-------|
| RZ | The Ritz-Carlton |
| XR | St. Regis |
| WH | W Hotels |
| ED | EDITION |
| LC | The Luxury Collection |
| MC | Marriott Hotels |
| SI | Sheraton |
| WI | Westin |
| MD | Le Méridien |
| BR | Renaissance |
| AK | Autograph Collection |
| TX | Tribute Portfolio |
| DE | Design Hotels |
| CY | Courtyard |
| FN | Four Points |
| AR | Aloft |
| EL | Element |
| XY | Moxy |
| FP | Fairfield |
| RI | Residence Inn |
| TH | Marriott Executive Apartments |
| MV | Marriott Vacation Club |

## Установка

### 1. Запустить миграцию

```bash
cd server
npm run migrate
```

Миграция `018_marsha_codes.sql`:
- Создаёт таблицу `marsha_codes` с полями code, hotel_name, city, country, region, brand
- Добавляет trigram индекс для fuzzy search (pg_trgm)
- Добавляет поля `marsha_code` и `marsha_code_id` в таблицу `hotels`

### 2. Загрузить MARSHA коды

```bash
cd server/db
node seed-marsha-codes.js
```

Загружает 237 кодов отелей Marriott:
- Казахстан: 5 отелей
- Европа: 50+ отелей
- Ближний Восток: 30+ отелей
- Африка: 20+ отелей
- Тихоокеанский регион: 40+ отелей
- Северная Америка: 80+ отелей

## API Endpoints

### Поиск кодов

```
GET /api/marsha-codes/search?q=almaty&limit=10
```

Fuzzy search по названию отеля, городу или коду.

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": "uuid",
      "code": "ALARC",
      "hotel_name": "The Ritz-Carlton, Almaty",
      "city": "Almaty",
      "country": "Kazakhstan",
      "brand": "RZ",
      "is_assigned": false,
      "similarity": 0.85
    }
  ]
}
```

### Автоподсказки по названию отеля

```
GET /api/marsha-codes/suggest?hotelName=Ritz%20Carlton%20Almaty
```

Ищет коды, которые могут соответствовать названию отеля.

### Доступные коды

```
GET /api/marsha-codes/available?country=Kazakhstan&brand=MC
```

Фильтрует незанятые коды по стране, региону или бренду.

### Детали кода

```
GET /api/marsha-codes/TSEMC
```

### Назначение кода отелю

```
POST /api/marsha-codes/assign
Authorization: Bearer <token>

{
  "hotelId": "hotel-uuid",
  "marshaCodeId": "marsha-code-uuid"
}
```

Требует permission: `hotels:manage`

### Освобождение кода

```
DELETE /api/marsha-codes/release/:hotelId
Authorization: Bearer <token>
```

### Статистика

```
GET /api/marsha-codes/stats
```

Возвращает статистику по регионам и брендам.

### Фильтры

```
GET /api/marsha-codes/filters
```

Возвращает списки стран, регионов и брендов для UI.

## Использование в UI

### MarshaCodeSelector компонент

```jsx
import MarshaCodeSelector from '../components/MarshaCodeSelector'

<MarshaCodeSelector
  hotelName={hotelName}          // Для автоподсказок
  selectedCode={hotel.marsha_code}
  onSelect={(code, codeId) => {
    // code = "TSEMC"
    // codeId = "uuid"
  }}
  onClear={() => {}}
  disabled={false}
/>
```

### Автоподсказки

При вводе названия отеля (≥3 символов) компонент автоматически ищет подходящие MARSHA коды:

1. Извлекает ключевые слова из названия
2. Ищет совпадения через trigram similarity
3. Показывает подсказки под полем выбора

### Fuzzy matching

Система находит коды даже если название не точно совпадает:
- "Ритц Карлтон Алматы" → ALARC (The Ritz-Carlton, Almaty)
- "Marriott Астана" → TSEMC (Marriott Hotel, Astana)

## Казахстанские отели

| Код | Отель | Город | Бренд |
|-----|-------|-------|-------|
| TSEXR | The St. Regis Astana | Astana | St. Regis |
| TSEMC | Marriott Hotel, Astana | Astana | Marriott |
| TSESI | Sheraton Astana Hotel | Astana | Sheraton |
| TSERZ | The Ritz-Carlton, Astana | Astana | Ritz-Carlton |
| ALARC | The Ritz-Carlton, Almaty | Almaty | Ritz-Carlton |

## Безопасность

- Только пользователи с permission `hotels:manage` могут назначать/снимать коды
- Все операции логируются в audit log
- Один код может быть назначен только одному отелю

## База данных

### Схема marsha_codes

```sql
CREATE TABLE marsha_codes (
  id UUID PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  hotel_name VARCHAR(255) NOT NULL,
  city VARCHAR(100),
  country VARCHAR(100),
  region VARCHAR(100),
  brand VARCHAR(10),
  is_assigned BOOLEAN DEFAULT FALSE,
  assigned_to_hotel_id UUID REFERENCES hotels(id),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- Trigram index for fuzzy search
CREATE INDEX idx_marsha_codes_hotel_name_trgm 
ON marsha_codes USING gin (hotel_name gin_trgm_ops);
```

### Поля в hotels

```sql
ALTER TABLE hotels ADD COLUMN marsha_code VARCHAR(10);
ALTER TABLE hotels ADD COLUMN marsha_code_id UUID REFERENCES marsha_codes(id);
```

# Vercel + Porkbun - Быстрая настройка

## 🚀 Vercel (Фронтенд)

### Переменные окружения в Vercel

**Settings → Environment Variables:**

```bash
VITE_API_URL=https://api.freshtrack.systems/api
```

### Настройка домена

1. **Settings → Domains**
2. Добавьте: `freshtrack.systems`
3. Скопируйте DNS записи от Vercel

## 🌐 Porkbun (DNS записи)

### Для фронтенда (Vercel)

**Вариант 1: CNAME (если поддерживается)**
```
Type: CNAME
Name: @
Value: cname.vercel-dns.com
```

**Вариант 2: A записи (если CNAME не поддерживается)**
```
Type: A
Name: @
Value: [IP адрес от Vercel]
```
*(Повторите для всех IP адресов от Vercel)*

**Для www поддомена:**
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

### Для бэкенда API (Railway)

```
Type: CNAME
Name: api
Value: [CNAME значение от Railway]
```

## ✅ Чеклист

- [ ] Vercel: Добавлена переменная `VITE_API_URL`
- [ ] Vercel: Добавлен домен `freshtrack.systems`
- [ ] Porkbun: Добавлены DNS записи для Vercel
- [ ] Porkbun: Добавлена CNAME запись для `api` поддомена
- [ ] Railway: Добавлен кастомный домен `api.freshtrack.systems`
- [ ] Проверено: `https://freshtrack.systems` работает
- [ ] Проверено: `https://api.freshtrack.systems/api/health` работает

## ⏱️ Время ожидания

DNS изменения применяются в течение **5-60 минут** (максимум 48 часов).

## 🔍 Проверка DNS

```bash
dig freshtrack.systems A
dig api.freshtrack.systems CNAME
```

Или используйте: [whatsmydns.net](https://www.whatsmydns.net)

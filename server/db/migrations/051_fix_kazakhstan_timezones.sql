-- Обновить отели Казахстана на Asia/Qostanay (UTC+6)
-- Asia/Almaty с 2024 года в IANA = UTC+5; для отображения используем Asia/Qostanay (UTC+6)

UPDATE hotels
SET
  timezone = 'Asia/Qostanay',
  timezone_auto_detected = TRUE
WHERE
  country = 'Kazakhstan'
  AND timezone IN ('Asia/Almaty', 'Asia/Aqtobe', 'Asia/Atyrau', 'Asia/Oral');

-- Проверка (закомментировано; раскомментировать при отладке):
-- SELECT id, name, city, timezone FROM hotels WHERE country = 'Kazakhstan';

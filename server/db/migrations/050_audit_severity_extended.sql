-- Migration 050: Extended audit action severity mappings
-- Добавляет критичность для всех типов действий на сайте

-- Расширяем таблицу severity для всех действий
INSERT INTO audit_action_severity (action, severity, description) VALUES
-- Аутентификация и безопасность
('LOGIN', 'normal', 'Вход в систему'),
('LOGOUT', 'normal', 'Выход из системы'),
('LOGIN_FAILED', 'important', 'Неудачная попытка входа'),
('PASSWORD_CHANGE', 'critical', 'Смена пароля'),
('PASSWORD_RESET', 'critical', 'Сброс пароля'),
('RESEND_PASSWORD', 'important', 'Повторная отправка пароля'),
('EMAIL_CHANGED', 'important', 'Изменение email'),
('EMAIL_VERIFIED', 'normal', 'Email подтвержден'),

-- MFA
('MFA_ENABLED', 'important', 'Включение MFA'),
('MFA_DISABLED', 'critical', 'Отключение MFA'),
('MFA_SETUP', 'important', 'Настройка MFA'),
('MFA_RECOVERY', 'critical', 'Использование recovery кода MFA'),

-- Пользователи и роли
('CREATE_USER', 'important', 'Создание пользователя'),
('UPDATE_USER', 'normal', 'Обновление пользователя'),
('DELETE_USER', 'critical', 'Удаление пользователя'),
('ROLE_CHANGED', 'critical', 'Изменение роли'),
('TOGGLE', 'important', 'Переключение статуса'),
('TOGGLE_USER', 'important', 'Переключение статуса пользователя'),
('USER_ACTIVATED', 'important', 'Активация пользователя'),
('USER_DEACTIVATED', 'important', 'Деактивация пользователя'),

-- Отели
('CREATE_HOTEL', 'important', 'Создание отеля'),
('UPDATE_HOTEL', 'normal', 'Обновление отеля'),
('DELETE_HOTEL', 'critical', 'Удаление отеля'),

-- Отделы
('CREATE_DEPARTMENT', 'normal', 'Создание отдела'),
('UPDATE_DEPARTMENT', 'normal', 'Обновление отдела'),
('DELETE_DEPARTMENT', 'important', 'Удаление отдела'),

-- Продукты и партии
('CREATE', 'normal', 'Создание объекта'),
('UPDATE', 'normal', 'Обновление объекта'),
('DELETE', 'critical', 'Удаление объекта'),
('CREATE_PRODUCT', 'normal', 'Создание продукта'),
('UPDATE_PRODUCT', 'normal', 'Обновление продукта'),
('DELETE_PRODUCT', 'important', 'Удаление продукта'),
('CREATE_BATCH', 'normal', 'Создание партии'),
('UPDATE_BATCH', 'normal', 'Обновление партии'),
('DELETE_BATCH', 'important', 'Удаление партии'),

-- Категории
('CREATE_CATEGORY', 'normal', 'Создание категории'),
('UPDATE_CATEGORY', 'normal', 'Обновление категории'),
('DELETE_CATEGORY', 'important', 'Удаление категории'),

-- Сборы и списания
('COLLECT', 'normal', 'Сбор продукции'),
('WRITE_OFF', 'normal', 'Списание'),

-- MARSHA коды
('ASSIGN', 'important', 'Назначение'),
('RELEASE', 'important', 'Освобождение'),
('ASSIGN_MARSHA', 'important', 'Назначение MARSHA кода'),
('RELEASE_MARSHA', 'important', 'Освобождение MARSHA кода'),

-- Экспорт/Импорт
('EXPORT', 'important', 'Экспорт данных'),
('IMPORT', 'important', 'Импорт данных'),
('EXPORT_AUDIT', 'important', 'Экспорт журнала'),
('EXPORT_USERS', 'important', 'Экспорт пользователей'),
('EXPORT_PRODUCTS', 'important', 'Экспорт продуктов'),
('EXPORT_BATCHES', 'important', 'Экспорт партий'),

-- Настройки
('SETTINGS_UPDATE', 'normal', 'Изменение настроек'),
('CLEAR_CACHE', 'normal', 'Очистка кэша'),
('BRANDING_UPDATE', 'normal', 'Изменение брендинга'),

-- Уведомления
('CREATE_NOTIFICATION_RULE', 'normal', 'Создание правила уведомлений'),
('UPDATE_NOTIFICATION_RULE', 'normal', 'Изменение правила уведомлений'),
('DELETE_NOTIFICATION_RULE', 'important', 'Удаление правила уведомлений'),
('NOTIFICATION_SENT', 'normal', 'Отправлено уведомление'),
('TELEGRAM_CONNECT', 'normal', 'Подключение Telegram'),
('TELEGRAM_DISCONNECT', 'normal', 'Отключение Telegram'),

-- Шаблоны
('CREATE_TEMPLATE', 'normal', 'Создание шаблона'),
('UPDATE_TEMPLATE', 'normal', 'Изменение шаблона'),
('DELETE_TEMPLATE', 'important', 'Удаление шаблона'),

-- GDPR
('GDPR_EXPORT', 'important', 'GDPR экспорт данных'),
('GDPR_DELETE', 'critical', 'GDPR удаление данных'),

-- Заявки на вступление
('APPROVE_JOIN', 'important', 'Одобрение заявки'),
('REJECT_JOIN', 'important', 'Отклонение заявки')

ON CONFLICT (action) DO UPDATE SET 
  severity = EXCLUDED.severity,
  description = EXCLUDED.description;

-- Индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_action_severity_action ON audit_action_severity(action);

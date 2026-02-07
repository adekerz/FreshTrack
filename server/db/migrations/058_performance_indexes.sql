-- Migration: 058_performance_indexes.sql
-- Composite indexes для типичных фильтров (hotel_id + status/dept/expiry).
-- Без них при 10K+ записях PostgreSQL делает full table scan; с индексами — index scan (10–50x быстрее).
-- Date: 2026-02-06

-- Batches: фильтр по отелю и статусу (активные партии)
CREATE INDEX IF NOT EXISTS idx_batches_hotel_status
  ON batches(hotel_id, status) WHERE status = 'active';

-- Batches: hotel + dept + expiry уже покрыт миграцией 016 (idx_batches_active_expiry) — не дублируем.

-- Products: активные продукты по отелю (каталог, выборки без архивных)
CREATE INDEX IF NOT EXISTS idx_products_hotel_active
  ON products(hotel_id) WHERE is_active = true;

-- Audit logs: по отелю с сортировкой по дате (журнал, пагинация)
CREATE INDEX IF NOT EXISTS idx_audit_logs_hotel_created
  ON audit_logs(hotel_id, created_at DESC);

-- Notifications: непрочитанные по пользователю (список уведомлений)
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications(user_id, is_read) WHERE is_read = false;

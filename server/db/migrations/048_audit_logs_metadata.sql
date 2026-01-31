-- Migration 048: Audit logs metadata for human-readable journal
-- Does NOT modify audit_logs table (hash chain integrity preserved)

-- Table for additional metadata (read-only from audit_logs)
CREATE TABLE IF NOT EXISTS audit_logs_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_log_id UUID NOT NULL REFERENCES audit_logs(id) ON DELETE CASCADE,

  -- Human-readable description
  human_readable_description TEXT,
  human_readable_details TEXT,

  -- Severity
  severity VARCHAR(20) DEFAULT 'normal',

  -- Grouping
  group_id UUID,
  is_grouped BOOLEAN DEFAULT FALSE,
  group_count INTEGER DEFAULT 1,

  -- User agent / device
  user_agent TEXT,
  browser_name VARCHAR(100),
  os_name VARCHAR(100),
  device_type VARCHAR(50),

  -- Geo (optional)
  country_code VARCHAR(2),
  city VARCHAR(100),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(audit_log_id)
);

CREATE INDEX IF NOT EXISTS idx_audit_metadata_audit_id ON audit_logs_metadata(audit_log_id);
CREATE INDEX IF NOT EXISTS idx_audit_metadata_severity ON audit_logs_metadata(severity);
CREATE INDEX IF NOT EXISTS idx_audit_metadata_group_id ON audit_logs_metadata(group_id) WHERE group_id IS NOT NULL;

-- Severity by action type (uppercase to match various inputs)
CREATE TABLE IF NOT EXISTS audit_action_severity (
  action VARCHAR(50) PRIMARY KEY,
  severity VARCHAR(20) NOT NULL,
  description TEXT
);

INSERT INTO audit_action_severity (action, severity, description) VALUES
('LOGIN', 'normal', 'Вход в систему'),
('LOGOUT', 'normal', 'Выход из системы'),
('CREATE', 'normal', 'Создание объекта'),
('UPDATE', 'normal', 'Обновление объекта'),
('DELETE', 'critical', 'Удаление объекта'),
('PASSWORD_CHANGE', 'critical', 'Смена пароля'),
('ROLE_CHANGED', 'critical', 'Изменение роли'),
('EMAIL_CHANGED', 'important', 'Изменение email'),
('MFA_ENABLED', 'important', 'Включение MFA'),
('MFA_DISABLED', 'critical', 'Отключение MFA'),
('EXPORT', 'important', 'Экспорт данных'),
('COLLECT', 'normal', 'Сбор продукции'),
('WRITE_OFF', 'normal', 'Списание'),
('IMPORT', 'important', 'Импорт данных'),
('SETTINGS_UPDATE', 'normal', 'Изменение настроек')
ON CONFLICT (action) DO NOTHING;

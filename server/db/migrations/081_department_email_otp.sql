CREATE TABLE IF NOT EXISTS department_email_otps (
  id            SERIAL PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  otp           VARCHAR(6) NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  attempts      INTEGER NOT NULL DEFAULT 0,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_department_email_otps_dept
  ON department_email_otps(department_id);

-- Add description field to departments table
-- This field will store custom subtitle/description for each department
-- Example: "Minibar" for Honor Bar department, "Other" for mokki department

ALTER TABLE departments 
ADD COLUMN IF NOT EXISTS description VARCHAR(255);

-- Add index for better search performance
CREATE INDEX IF NOT EXISTS idx_departments_description ON departments(description);

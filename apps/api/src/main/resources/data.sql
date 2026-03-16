-- Fix null values in folders table before Hibernate applies constraints
UPDATE folders SET is_deleted = FALSE WHERE is_deleted IS NULL;
UPDATE folders SET created_at = NOW() WHERE created_at IS NULL;
UPDATE folders SET updated_at = NOW() WHERE updated_at IS NULL;

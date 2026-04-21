-- V12: Heal any users table that was baselined before V1 ran,
-- so it conforms to the current User entity contract.
--
-- Safe to run on a fresh schema (all IF NOT EXISTS / idempotent), and on an
-- existing schema that may be missing any of:
--   password_hash, tier, email_hash, encrypted_email, referral_code
--
-- Rows that cannot be backfilled (missing secret/encrypted fields) are
-- deleted because they would otherwise violate the new NOT NULL constraints
-- and block startup. In practice these are only orphaned dev/test rows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Add columns if missing (nullable for now so existing rows don't fail)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash     VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier              VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_hash        VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_email   VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code     VARCHAR(255);

-- 2. Backfill safe defaults
UPDATE users SET tier = 'starter' WHERE tier IS NULL;
UPDATE users
   SET referral_code = upper(substring(encode(digest(email, 'sha256'), 'hex') FROM 1 FOR 8))
 WHERE referral_code IS NULL
   AND email IS NOT NULL;

-- 3. Delete rows that still cannot satisfy the NOT NULL contract
--    (no password_hash, no encrypted_email, or no email_hash — unusable anyway).
DELETE FROM users
 WHERE password_hash   IS NULL
    OR encrypted_email IS NULL
    OR email_hash      IS NULL
    OR referral_code   IS NULL;

-- 4. Enforce NOT NULL
ALTER TABLE users ALTER COLUMN password_hash    SET NOT NULL;
ALTER TABLE users ALTER COLUMN tier             SET NOT NULL;
ALTER TABLE users ALTER COLUMN email_hash       SET NOT NULL;
ALTER TABLE users ALTER COLUMN encrypted_email  SET NOT NULL;
ALTER TABLE users ALTER COLUMN referral_code    SET NOT NULL;

-- 5. Ensure unique constraints (idempotent — skip if already present).
CREATE UNIQUE INDEX IF NOT EXISTS users_email_hash_key       ON users(email_hash);
CREATE UNIQUE INDEX IF NOT EXISTS users_encrypted_email_key  ON users(encrypted_email);
CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_key    ON users(referral_code);

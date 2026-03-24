-- Create pgcrypto extension if it does not exist to support digest() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add referral_code to users table
ALTER TABLE users ADD COLUMN referral_code VARCHAR(10) UNIQUE;

-- Generate unique codes for existing users (using a quick substring of their uuid or hash)
UPDATE users SET referral_code = upper(substring(encode(digest(email, 'sha256'), 'hex') from 1 for 8)) WHERE referral_code IS NULL;

-- Enforce NOT NULL after populating existing rows
ALTER TABLE users ALTER COLUMN referral_code SET NOT NULL;

-- Create referrals table
CREATE TABLE referrals (
    id BIGSERIAL PRIMARY KEY,
    referrer_id BIGINT NOT NULL,
    referred_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_referrals_referrer FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_referrals_referred FOREIGN KEY (referred_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_referrals_referred UNIQUE (referred_id)
);

CREATE INDEX idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX idx_referrals_referred_id ON referrals(referred_id);

-- V4 Migration: Add missing billing_interval to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_interval VARCHAR(255);

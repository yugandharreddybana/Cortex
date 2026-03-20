-- V5 Migration: Add current_period_end column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP(6) WITH TIME ZONE;

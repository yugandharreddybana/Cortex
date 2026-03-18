-- V2 Migration: Add subscription_status column to users table

ALTER TABLE users ADD COLUMN subscription_status VARCHAR(255);

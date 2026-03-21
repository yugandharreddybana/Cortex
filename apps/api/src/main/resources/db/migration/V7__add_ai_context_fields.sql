-- Add ai_context and ai_response columns for AI-generated highlights
ALTER TABLE highlights ADD COLUMN IF NOT EXISTS ai_context TEXT;
ALTER TABLE highlights ADD COLUMN IF NOT EXISTS ai_response TEXT;

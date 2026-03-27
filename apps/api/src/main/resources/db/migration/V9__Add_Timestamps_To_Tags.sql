-- V1.4__Add_Timestamps_To_Tags.sql
ALTER TABLE tags ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Optional: Update existing tags if they have null (though DEFAULT handles new ones)
UPDATE tags SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
UPDATE tags SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;

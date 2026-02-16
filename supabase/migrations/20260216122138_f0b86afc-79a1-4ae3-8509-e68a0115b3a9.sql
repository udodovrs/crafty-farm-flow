
-- No schema changes needed - we'll use existing stitch_tasks table with status='draft'
-- Just need to make photo fields and stitch_count optional for drafts (they already are nullable/have defaults)
-- This is a no-op migration to document the approach
SELECT 1;

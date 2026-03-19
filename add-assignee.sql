-- Run this in Supabase SQL Editor
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee text NOT NULL DEFAULT 'alex';

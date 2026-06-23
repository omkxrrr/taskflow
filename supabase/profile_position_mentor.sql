-- ============================================================
-- PROFILE POSITION + MENTOR FIELDS
-- Run this in Supabase SQL Editor.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS position TEXT,
  ADD COLUMN IF NOT EXISTS mentor_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_position_idx ON profiles(position);
CREATE INDEX IF NOT EXISTS profiles_mentor_id_idx ON profiles(mentor_id);

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- LEAVE / TIME-OFF REQUEST MODULE
-- Run this in Supabase SQL Editor after the base schema.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_request_status') THEN
    CREATE TYPE leave_request_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_request_type') THEN
    CREATE TYPE leave_request_type AS ENUM ('casual', 'sick', 'personal', 'emergency', 'other');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mentor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type leave_request_type NOT NULL DEFAULT 'casual',
  reason TEXT NOT NULL,
  status leave_request_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leave_requests_valid_dates CHECK (end_date >= start_date)
);

ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS mentor_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS leave_requests_user_id_idx ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS leave_requests_mentor_id_idx ON leave_requests(mentor_id);
CREATE INDEX IF NOT EXISTS leave_requests_status_idx ON leave_requests(status);
CREATE INDEX IF NOT EXISTS leave_requests_start_date_idx ON leave_requests(start_date);

DROP TRIGGER IF EXISTS leave_requests_updated_at ON leave_requests;
CREATE TRIGGER leave_requests_updated_at
  BEFORE UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON TYPE leave_request_status TO authenticated;
GRANT USAGE ON TYPE leave_request_type TO authenticated;
GRANT SELECT, INSERT, UPDATE ON leave_requests TO authenticated;

DROP POLICY IF EXISTS "Intern: view own leave requests" ON leave_requests;
CREATE POLICY "Intern: view own leave requests"
  ON leave_requests FOR SELECT
  USING (
    user_id = auth.uid()
    AND get_my_role() = 'intern'
  );

DROP POLICY IF EXISTS "Admins: view all leave requests" ON leave_requests;
CREATE POLICY "Admins: view assigned leave requests"
  ON leave_requests FOR SELECT
  USING (
    get_my_role() = 'super_admin'
    OR (
      get_my_role() = 'admin'
      AND mentor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Intern: create own leave requests" ON leave_requests;
CREATE POLICY "Intern: create own leave requests"
  ON leave_requests FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND get_my_role() = 'intern'
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "Intern: update pending own leave requests" ON leave_requests;
CREATE POLICY "Intern: update pending own leave requests"
  ON leave_requests FOR UPDATE
  USING (
    user_id = auth.uid()
    AND get_my_role() = 'intern'
    AND status = 'pending'
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "Admins: review leave requests" ON leave_requests;
CREATE POLICY "Admins: review leave requests"
  ON leave_requests FOR UPDATE
  USING (
    get_my_role() = 'super_admin'
    OR (
      get_my_role() = 'admin'
      AND mentor_id = auth.uid()
    )
  )
  WITH CHECK (
    get_my_role() = 'super_admin'
    OR (
      get_my_role() = 'admin'
      AND mentor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins: delete assigned leave requests" ON leave_requests;
CREATE POLICY "Admins: delete assigned leave requests"
  ON leave_requests FOR DELETE
  USING (
    get_my_role() = 'super_admin'
    OR (
      get_my_role() = 'admin'
      AND mentor_id = auth.uid()
    )
  );

-- Ask Supabase/PostgREST to refresh its schema cache immediately.
NOTIFY pgrst, 'reload schema';

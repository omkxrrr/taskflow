-- ============================================================
-- MEETING VISIBILITY / ATTENDEE ACCESS
-- Run this in Supabase SQL Editor.
-- Ensures invited interns can see meetings assigned to them.
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON meetings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meeting_attendees TO authenticated;

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins: manage all meetings" ON meetings;
CREATE POLICY "Admins: manage all meetings"
  ON meetings FOR ALL
  USING (get_my_role() IN ('admin', 'super_admin'))
  WITH CHECK (get_my_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "Intern: view assigned meetings" ON meetings;
CREATE POLICY "Intern: view assigned meetings"
  ON meetings FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM meeting_attendees ma
      WHERE ma.meeting_id = meetings.id
        AND ma.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins: manage meeting attendees" ON meeting_attendees;
CREATE POLICY "Admins: manage meeting attendees"
  ON meeting_attendees FOR ALL
  USING (get_my_role() IN ('admin', 'super_admin'))
  WITH CHECK (get_my_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "Intern: view own meeting attendees" ON meeting_attendees;
CREATE POLICY "Intern: view own meeting attendees"
  ON meeting_attendees FOR SELECT
  USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';

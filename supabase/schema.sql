-- ============================================================
-- TASK MANAGER MVP - SUPABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'intern');
CREATE TYPE task_status AS ENUM ('pending', 'submitted', 'approved', 'rejected');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');

-- ============================================================
-- PROFILES TABLE (extends Supabase auth.users)
-- ============================================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE,
  phone TEXT,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'intern',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TASKS TABLE
-- ============================================================
CREATE TABLE tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  priority task_priority NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'pending',
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  due_date DATE,
  submission_note TEXT,           -- intern's note when submitting
  submission_url TEXT,            -- optional link/attachment URL
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,               -- admin's approval/rejection note
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, phone, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
      NEW.phone,
      'TaskFlow User'
    ),
    CASE
      WHEN NEW.raw_user_meta_data->>'role' IN ('admin', 'intern') THEN (NEW.raw_user_meta_data->>'role')::user_role
      ELSE 'intern'::user_role
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---- PROFILES POLICIES ----

-- Users can view their own profile
CREATE POLICY "Users: view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Admins/super_admins can view all profiles
CREATE POLICY "Admins: view all profiles"
  ON profiles FOR SELECT
  USING (get_my_role() IN ('admin', 'super_admin'));

-- Users can update their own profile (limited fields)
CREATE POLICY "Users: update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Only super_admin can insert profiles directly (admin creation flow)
CREATE POLICY "Super admin: insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (get_my_role() = 'super_admin');

-- Admins can insert intern profiles
CREATE POLICY "Admin: insert intern profiles"
  ON profiles FOR INSERT
  WITH CHECK (
    get_my_role() IN ('admin', 'super_admin')
  );

-- ---- TASKS POLICIES ----

-- Interns can view only their assigned tasks
CREATE POLICY "Intern: view own tasks"
  ON tasks FOR SELECT
  USING (
    assigned_to = auth.uid()
    AND get_my_role() = 'intern'
  );

-- Admins/super_admins can view all tasks
CREATE POLICY "Admins: view all tasks"
  ON tasks FOR SELECT
  USING (get_my_role() IN ('admin', 'super_admin'));

-- Admins/super_admins can create tasks
CREATE POLICY "Admins: create tasks"
  ON tasks FOR INSERT
  WITH CHECK (get_my_role() IN ('admin', 'super_admin'));

-- Admins can update any task (for approval/rejection)
CREATE POLICY "Admins: update tasks"
  ON tasks FOR UPDATE
  USING (get_my_role() IN ('admin', 'super_admin'));

-- Interns can update only their own task (for submission)
CREATE POLICY "Intern: submit task"
  ON tasks FOR UPDATE
  USING (
    assigned_to = auth.uid()
    AND get_my_role() = 'intern'
    AND status = 'pending'
  )
  WITH CHECK (
    assigned_to = auth.uid()
    AND status = 'submitted'
  );

-- ============================================================
-- SEED: SUPER ADMIN
-- NOTE: Create this user in Supabase Auth first, then run this.
-- Replace the email with your super admin email.
-- ============================================================
-- UPDATE profiles SET role = 'super_admin' WHERE email = 'superadmin@yourdomain.com';

-- ============================================================
-- USEFUL VIEWS
-- ============================================================
CREATE VIEW task_details AS
SELECT
  t.*,
  p_assigned.full_name AS assigned_to_name,
  p_assigned.email AS assigned_to_email,
  p_created.full_name AS created_by_name,
  p_reviewed.full_name AS reviewed_by_name
FROM tasks t
LEFT JOIN profiles p_assigned ON t.assigned_to = p_assigned.id
LEFT JOIN profiles p_created ON t.created_by = p_created.id
LEFT JOIN profiles p_reviewed ON t.reviewed_by = p_reviewed.id;

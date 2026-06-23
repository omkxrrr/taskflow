-- ============================================================
-- INTERN ONBOARDING MODULE
-- Run this in Supabase SQL Editor.
-- ============================================================

create extension if not exists "uuid-ossp";

create table if not exists public.onboarding_templates (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  sort_order integer not null default 0,
  trigger_type text not null default 'manual'
    check (trigger_type in ('manual', 'first_daily_update', 'first_task_assigned')),
  department_id uuid references public.departments(id) on delete set null,
  due_days integer,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.onboarding_progress (
  id uuid primary key default uuid_generate_v4(),
  intern_id uuid not null references public.profiles(id) on delete cascade,
  template_id uuid not null references public.onboarding_templates(id) on delete cascade,
  completed_at timestamptz not null default now(),
  completed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(intern_id, template_id)
);

create table if not exists public.onboarding_forms (
  id uuid primary key default uuid_generate_v4(),
  intern_id uuid not null references public.profiles(id) on delete cascade unique,
  full_name text,
  contact_number text,
  phone text,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  college text,
  skills text,
  linkedin_url text,
  github_url text,
  bio text,
  status text not null default 'pending'
    check (status in ('draft', 'pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists onboarding_templates_active_idx on public.onboarding_templates(is_active);
create index if not exists onboarding_templates_department_idx on public.onboarding_templates(department_id);
create index if not exists onboarding_progress_intern_idx on public.onboarding_progress(intern_id);
create index if not exists onboarding_progress_template_idx on public.onboarding_progress(template_id);
create index if not exists onboarding_forms_intern_idx on public.onboarding_forms(intern_id);
create index if not exists onboarding_forms_status_idx on public.onboarding_forms(status);

alter table public.onboarding_forms add column if not exists full_name text;
alter table public.onboarding_forms add column if not exists contact_number text;
update public.onboarding_forms
set contact_number = coalesce(contact_number, phone)
where contact_number is null;

alter table public.onboarding_templates enable row level security;
alter table public.onboarding_progress enable row level security;
alter table public.onboarding_forms enable row level security;

drop policy if exists "Authenticated users can view onboarding templates" on public.onboarding_templates;
create policy "Authenticated users can view onboarding templates"
on public.onboarding_templates for select
using (auth.uid() is not null);

drop policy if exists "Admins can create onboarding templates" on public.onboarding_templates;
create policy "Admins can create onboarding templates"
on public.onboarding_templates for insert
with check (public.get_my_role() in ('admin', 'super_admin'));

drop policy if exists "Admins can update onboarding templates" on public.onboarding_templates;
create policy "Admins can update onboarding templates"
on public.onboarding_templates for update
using (public.get_my_role() in ('admin', 'super_admin'))
with check (public.get_my_role() in ('admin', 'super_admin'));

drop policy if exists "Admins can delete onboarding templates" on public.onboarding_templates;
create policy "Admins can delete onboarding templates"
on public.onboarding_templates for delete
using (public.get_my_role() in ('admin', 'super_admin'));

drop policy if exists "Users can view onboarding progress" on public.onboarding_progress;
create policy "Users can view onboarding progress"
on public.onboarding_progress for select
using (
  intern_id = auth.uid()
  or public.get_my_role() in ('admin', 'super_admin')
);

drop policy if exists "Users can complete onboarding items" on public.onboarding_progress;
create policy "Users can complete onboarding items"
on public.onboarding_progress for insert
with check (
  intern_id = auth.uid()
  or public.get_my_role() in ('admin', 'super_admin')
);

drop policy if exists "Users can update own onboarding progress" on public.onboarding_progress;
create policy "Users can update own onboarding progress"
on public.onboarding_progress for update
using (
  intern_id = auth.uid()
  or public.get_my_role() in ('admin', 'super_admin')
)
with check (
  intern_id = auth.uid()
  or public.get_my_role() in ('admin', 'super_admin')
);

drop policy if exists "Users can uncheck own onboarding progress" on public.onboarding_progress;
create policy "Users can uncheck own onboarding progress"
on public.onboarding_progress for delete
using (
  intern_id = auth.uid()
  or public.get_my_role() in ('admin', 'super_admin')
);

drop policy if exists "Users can view onboarding forms" on public.onboarding_forms;
create policy "Users can view onboarding forms"
on public.onboarding_forms for select
using (
  intern_id = auth.uid()
  or public.get_my_role() in ('admin', 'super_admin')
);

drop policy if exists "Interns can submit own onboarding form" on public.onboarding_forms;
create policy "Interns can submit own onboarding form"
on public.onboarding_forms for insert
with check (intern_id = auth.uid());

drop policy if exists "Interns and admins can update onboarding forms" on public.onboarding_forms;
drop policy if exists "Interns can update own onboarding form" on public.onboarding_forms;
create policy "Interns can update own onboarding form"
on public.onboarding_forms for update
using (intern_id = auth.uid())
with check (intern_id = auth.uid());

drop policy if exists "Admins can review onboarding forms" on public.onboarding_forms;
create policy "Admins can review onboarding forms"
on public.onboarding_forms for update
using (public.get_my_role() in ('admin', 'super_admin'))
with check (public.get_my_role() in ('admin', 'super_admin'));

insert into public.onboarding_templates
  (title, description, sort_order, trigger_type, due_days)
values
  ('Complete your profile', 'Add your phone number, bio, and basic details.', 1, 'manual', 1),
  ('Read company policies', 'Go through the company rules and working guidelines.', 2, 'manual', 1),
  ('Join team communication group', 'Join the official Slack/WhatsApp group shared by your mentor.', 3, 'manual', 1),
  ('Intro call with mentor', 'Schedule or attend your first introduction call.', 4, 'manual', 2),
  ('Set up required tools', 'Install and configure Git, VS Code, and project access tools.', 5, 'manual', 3),
  ('Submit first daily update', 'This item completes automatically after your first daily update.', 6, 'first_daily_update', 3),
  ('Complete first week feedback', 'Fill the feedback form after your first week.', 7, 'manual', 7)
on conflict do nothing;

notify pgrst, 'reload schema';

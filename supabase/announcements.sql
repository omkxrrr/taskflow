-- ============================================================
-- DASHBOARD ANNOUNCEMENTS
-- Run this in Supabase SQL Editor.
-- ============================================================

create extension if not exists "uuid-ossp";

create table if not exists public.announcements (
  id uuid primary key default uuid_generate_v4(),
  title text not null default 'Announcement',
  message text not null,
  author_name text,
  created_by uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists announcements_active_created_idx
on public.announcements(is_active, created_at desc);

alter table public.announcements enable row level security;

grant all on public.announcements to authenticated;

create or replace function public.is_admin_user()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'super_admin')
  );
$$;

drop policy if exists "Authenticated users can view announcements" on public.announcements;
create policy "Authenticated users can view announcements"
on public.announcements for select
using (auth.uid() is not null and is_active = true);

drop policy if exists "Admins can create announcements" on public.announcements;
create policy "Admins can create announcements"
on public.announcements for insert
with check (auth.uid() is not null);

drop policy if exists "Admins can update announcements" on public.announcements;
create policy "Admins can update announcements"
on public.announcements for update
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "Admins can delete announcements" on public.announcements;
create policy "Admins can delete announcements"
on public.announcements for delete
using (public.is_admin_user());

notify pgrst, 'reload schema';

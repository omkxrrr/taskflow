-- Internal chat module
-- Run this in Supabase SQL editor after the base schema.

create extension if not exists "uuid-ossp";

create table if not exists public.conversations (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('dm', 'group', 'department', 'announcements')),
  name text,
  department_id uuid references public.departments(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  is_admin_only_post boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  unique(conversation_id, user_id)
);

alter table public.conversation_members
add column if not exists hidden_at timestamptz;

create table if not exists public.chat_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  attachment_url text,
  attachment_name text,
  attachment_type text,
  attachment_size bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.chat_messages
add column if not exists attachment_url text,
add column if not exists attachment_name text,
add column if not exists attachment_type text,
add column if not exists attachment_size bigint;

create index if not exists conversations_created_by_idx on public.conversations(created_by);
create index if not exists conversation_members_user_id_idx on public.conversation_members(user_id);
create index if not exists conversation_members_conversation_id_idx on public.conversation_members(conversation_id);
create index if not exists chat_messages_conversation_id_created_at_idx on public.chat_messages(conversation_id, created_at desc);
create index if not exists chat_messages_sender_id_idx on public.chat_messages(sender_id);

create or replace function public.is_chat_member(target_conversation_id uuid)
returns boolean as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = target_conversation_id
      and cm.user_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.can_post_to_chat(target_conversation_id uuid)
returns boolean as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = target_conversation_id
      and (
        c.is_admin_only_post = false
        or public.get_my_role() in ('admin', 'super_admin')
      )
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.touch_conversation_updated_at()
returns trigger as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql security definer;

create or replace function public.prevent_chat_message_owner_change()
returns trigger as $$
begin
  if new.sender_id <> old.sender_id or new.conversation_id <> old.conversation_id then
    raise exception 'Cannot change message owner or conversation';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists chat_messages_touch_conversation on public.chat_messages;
create trigger chat_messages_touch_conversation
after insert on public.chat_messages
for each row execute function public.touch_conversation_updated_at();

drop trigger if exists chat_messages_prevent_owner_change on public.chat_messages;
create trigger chat_messages_prevent_owner_change
before update on public.chat_messages
for each row execute function public.prevent_chat_message_owner_change();

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "Members can view conversations" on public.conversations;
create policy "Members can view conversations"
on public.conversations for select
using (
  created_by = auth.uid()
  or public.is_chat_member(conversations.id)
);

drop policy if exists "Authenticated users can create conversations" on public.conversations;
create policy "Authenticated users can create conversations"
on public.conversations for insert
with check (
  auth.role() = 'authenticated'
  and (created_by is null or created_by = auth.uid())
);

drop policy if exists "Creators and admins can update conversations" on public.conversations;
create policy "Creators and admins can update conversations"
on public.conversations for update
using (
  created_by = auth.uid()
  or public.get_my_role() in ('admin', 'super_admin')
)
with check (
  created_by = auth.uid()
  or public.get_my_role() in ('admin', 'super_admin')
);

drop policy if exists "Creators and admins can delete conversations" on public.conversations;

drop policy if exists "Members can view conversation members" on public.conversation_members;
create policy "Members can view conversation members"
on public.conversation_members for select
using (
  user_id = auth.uid()
  or public.get_my_role() in ('admin', 'super_admin')
  or public.is_chat_member(conversation_members.conversation_id)
);

drop policy if exists "Conversation creators can add members" on public.conversation_members;
create policy "Conversation creators can add members"
on public.conversation_members for insert
with check (
  user_id = auth.uid()
  or public.get_my_role() in ('admin', 'super_admin')
  or exists (
    select 1 from public.conversations c
    where c.id = conversation_members.conversation_id
      and c.created_by = auth.uid()
  )
);

drop policy if exists "Users can update their own read state" on public.conversation_members;
create policy "Users can update their own read state"
on public.conversation_members for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Admins can remove members" on public.conversation_members;
create policy "Admins can remove members"
on public.conversation_members for delete
using (public.get_my_role() in ('admin', 'super_admin'));

drop policy if exists "Members can view chat messages" on public.chat_messages;
create policy "Members can view chat messages"
on public.chat_messages for select
using (
  deleted_at is null
  and public.is_chat_member(chat_messages.conversation_id)
);

drop policy if exists "Members can send chat messages" on public.chat_messages;
create policy "Members can send chat messages"
on public.chat_messages for insert
with check (
  sender_id = auth.uid()
  and public.is_chat_member(chat_messages.conversation_id)
  and public.can_post_to_chat(chat_messages.conversation_id)
);

drop policy if exists "Senders and admins can soft delete messages" on public.chat_messages;
create policy "Senders and admins can soft delete messages"
on public.chat_messages for update
using (sender_id = auth.uid())
with check (true);

drop policy if exists "Senders and admins can delete messages" on public.chat_messages;
create policy "Senders and admins can delete messages"
on public.chat_messages for delete
using (sender_id = auth.uid());

grant all on public.conversations to authenticated;
grant all on public.conversation_members to authenticated;
grant all on public.chat_messages to authenticated;

insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do update set public = true;

drop policy if exists "Authenticated users can view chat attachments" on storage.objects;
create policy "Authenticated users can view chat attachments"
on storage.objects for select
using (bucket_id = 'chat-attachments' and auth.role() = 'authenticated');

drop policy if exists "Authenticated users can upload chat attachments" on storage.objects;
create policy "Authenticated users can upload chat attachments"
on storage.objects for insert
with check (bucket_id = 'chat-attachments' and auth.role() = 'authenticated');

drop policy if exists "Users can update own chat attachments" on storage.objects;
create policy "Users can update own chat attachments"
on storage.objects for update
using (bucket_id = 'chat-attachments' and auth.uid()::text = (storage.foldername(name))[2])
with check (bucket_id = 'chat-attachments' and auth.uid()::text = (storage.foldername(name))[2]);

drop policy if exists "Users can delete own chat attachments" on storage.objects;
create policy "Users can delete own chat attachments"
on storage.objects for delete
using (bucket_id = 'chat-attachments' and auth.uid()::text = (storage.foldername(name))[2]);

notify pgrst, 'reload schema';

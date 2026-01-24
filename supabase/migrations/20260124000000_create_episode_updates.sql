-- Create episode updates table for cross-device notifications

create table if not exists public.episode_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  anime_id text not null,
  anime_title text not null,
  old_episode integer not null default 0,
  new_episode integer not null default 0,
  total_episodes integer,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists episode_updates_user_anime_unique
on public.episode_updates (user_id, anime_id);

alter table public.episode_updates enable row level security;

drop policy if exists "Users can view their episode updates" on public.episode_updates;
create policy "Users can view their episode updates"
  on public.episode_updates
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their episode updates" on public.episode_updates;
create policy "Users can insert their episode updates"
  on public.episode_updates
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their episode updates" on public.episode_updates;
create policy "Users can update their episode updates"
  on public.episode_updates
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their episode updates" on public.episode_updates;
create policy "Users can delete their episode updates"
  on public.episode_updates
  for delete
  using (auth.uid() = user_id);

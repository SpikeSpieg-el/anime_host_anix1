-- Create push_subscriptions table for web push notifications

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique(endpoint)
);

create index if not exists push_subscriptions_user_idx
on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users can view their push subscriptions" on public.push_subscriptions;
create policy "Users can view their push subscriptions"
  on public.push_subscriptions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their push subscriptions" on public.push_subscriptions;
create policy "Users can insert their push subscriptions"
  on public.push_subscriptions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their push subscriptions" on public.push_subscriptions;
create policy "Users can delete their push subscriptions"
  on public.push_subscriptions
  for delete
  using (auth.uid() = user_id);

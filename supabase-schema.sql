-- Folio database schema
-- Run this entire script once in your Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run)

-- 1. Table for each user's saved collection of books
create table if not exists collection_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  book_id text not null,
  title text not null,
  author text,
  cover text,
  source text,
  source_id text,
  epub_url text,
  text_url text,
  created_at timestamptz default now(),
  unique (user_id, book_id)
);

-- 2. Table for reading progress per book per user
create table if not exists reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  book_id text not null,
  location text,
  percentage numeric default 0,
  updated_at timestamptz default now(),
  unique (user_id, book_id)
);

-- 3. Enable Row Level Security so users can only see their own data
alter table collection_items enable row level security;
alter table reading_progress enable row level security;

-- 4. Policies: a user can only read/write their own rows
create policy "Users manage their own collection"
  on collection_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own progress"
  on reading_progress
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 5. Helpful indexes
create index if not exists idx_collection_items_user on collection_items(user_id);
create index if not exists idx_reading_progress_user on reading_progress(user_id);

-- 林苗 · PRIVATE SPACE 数据库
-- 在 Supabase SQL Editor 里整段执行

-- 1. 会话表
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null default '默认会话',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. 消息表
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_session on messages(session_id, created_at);

-- 3. 记忆摘要表
create table if not exists memories (
  id uuid primary key default gen_random_uuid(),
  session_id text not null default 'global',
  summary text not null,
  conversation_id uuid references sessions(id) on delete set null,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

-- 4. 全局设置表（单行）
create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  session_id text not null default 'global' unique,
  system_prompt text,
  temperature float default 0.85,
  max_context_rounds int default 30,
  max_context_tokens int default 80000,
  compress_threshold int default 60,
  compress_keep_rounds int default 10,
  max_reply_tokens int default 4096,
  updated_at timestamptz not null default now()
);

-- 插入默认设置
insert into settings (session_id) values ('global') on conflict do nothing;

-- 5. 表情包/贴纸表
create table if not exists stickers (
  id text primary key,
  description text not null,
  image_url text not null,
  category text default '默认',
  sort_order int default 0,
  created_at timestamptz not null default now()
);

-- 6. 小苗的空间（日记/碎碎念）
create table if not exists space_posts (
  id uuid primary key default gen_random_uuid(),
  author text not null default 'miao' check (author in ('miao', 'tong')),
  content text not null,
  mood text,
  image_url text,
  pinned boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_space_posts_time on space_posts(created_at desc);

-- 7. 空间评论/回复
create table if not exists space_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references space_posts(id) on delete cascade,
  author text not null check (author in ('miao', 'tong')),
  content text not null,
  created_at timestamptz not null default now()
);

-- 8. 头像设置
create table if not exists avatars (
  id text primary key default 'miao',
  image_url text,
  updated_at timestamptz not null default now()
);
insert into avatars (id) values ('miao') on conflict do nothing;
insert into avatars (id) values ('tong') on conflict do nothing;

-- RLS（行级安全）暂时关闭，私人项目不需要
-- 如果以后要公开访问再开
alter table sessions enable row level security;
alter table messages enable row level security;
alter table memories enable row level security;
alter table settings enable row level security;
alter table stickers enable row level security;
alter table space_posts enable row level security;
alter table space_comments enable row level security;
alter table avatars enable row level security;

-- 允许匿名访问（通过后端API Key鉴权，不走Supabase RLS）
create policy "Allow all" on sessions for all using (true) with check (true);
create policy "Allow all" on messages for all using (true) with check (true);
create policy "Allow all" on memories for all using (true) with check (true);
create policy "Allow all" on settings for all using (true) with check (true);
create policy "Allow all" on stickers for all using (true) with check (true);
create policy "Allow all" on space_posts for all using (true) with check (true);
create policy "Allow all" on space_comments for all using (true) with check (true);
create policy "Allow all" on avatars for all using (true) with check (true);

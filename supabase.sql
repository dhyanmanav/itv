-- Run this ONCE in Supabase -> SQL Editor (any project you choose)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  usn text not null unique,
  email text not null unique,
  pw text not null,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  uid uuid not null unique references users(id) on delete cascade,
  device_id text unique,
  ip text, ua text,
  exam_set int not null check (exam_set in (1, 2)),
  q_order jsonb not null,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'started',
  started_at bigint not null,
  deadline bigint not null,
  submitted_at bigint,
  reason text
);
create table if not exists settings (key text primary key, v boolean not null);

-- Lock everything: only the server (service_role key) can touch the data
alter table users enable row level security;
alter table attempts enable row level security;
alter table settings enable row level security;

create or replace function save_answer(p_uid uuid, p_qid int, p_ans text, p_now bigint)
returns void language sql as $$
  update attempts set answers = answers || jsonb_build_object(p_qid::text, p_ans)
  where uid = p_uid and status = 'started' and deadline > p_now;
$$;
revoke all on function save_answer(uuid, int, text, bigint) from public, anon, authenticated;
grant execute on function save_answer(uuid, int, text, bigint) to service_role;

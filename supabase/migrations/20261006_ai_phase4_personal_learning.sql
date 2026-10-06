create table if not exists public.ai_study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid null references public.courses(id) on delete set null,
  title text not null default 'My study plan',
  goal text not null check (char_length(goal) between 1 and 500),
  status text not null default 'active' check (status in ('active','completed','archived')),
  plan jsonb not null default '[]'::jsonb check (jsonb_typeof(plan) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_study_plans_user_updated_idx on public.ai_study_plans(user_id, updated_at desc);
alter table public.ai_study_plans enable row level security;
drop policy if exists "own study plans select" on public.ai_study_plans;
create policy "own study plans select" on public.ai_study_plans for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "own study plans insert" on public.ai_study_plans;
create policy "own study plans insert" on public.ai_study_plans for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "own study plans update" on public.ai_study_plans;
create policy "own study plans update" on public.ai_study_plans for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "own study plans delete" on public.ai_study_plans;
create policy "own study plans delete" on public.ai_study_plans for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.ai_study_plans from anon, authenticated;
grant select, insert, update, delete on public.ai_study_plans to authenticated;

create table if not exists public.ai_saved_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid null references public.ai_conversations(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  content text not null check (char_length(content) between 1 and 20000),
  created_at timestamptz not null default now()
);
create index if not exists ai_saved_answers_user_created_idx on public.ai_saved_answers(user_id, created_at desc);
alter table public.ai_saved_answers enable row level security;
drop policy if exists "own saved answers select" on public.ai_saved_answers;
create policy "own saved answers select" on public.ai_saved_answers for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "own saved answers insert" on public.ai_saved_answers;
create policy "own saved answers insert" on public.ai_saved_answers for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "own saved answers delete" on public.ai_saved_answers;
create policy "own saved answers delete" on public.ai_saved_answers for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.ai_saved_answers from anon, authenticated;
grant select, insert, delete on public.ai_saved_answers to authenticated;
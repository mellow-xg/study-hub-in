-- Security hardening applied to the Study Hub Supabase project on 2026-10-05.
-- Keep this migration in source control so the production security posture is reproducible.

begin;

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select, update on sequences from anon, authenticated, service_role;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

revoke all on table public.security_sessions from anon, authenticated;
revoke all on table public.security_rate_limits from anon, authenticated;
revoke all on table public.security_audit_logs from anon, authenticated;
revoke all on table public.resource_access_tokens from anon, authenticated;

drop policy if exists "own bookmarks" on public.bookmarks;

drop policy if exists "Users manage own AI conversations" on public.ai_conversations;
create policy "Users read own AI conversations" on public.ai_conversations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create own AI conversations" on public.ai_conversations
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own AI conversations" on public.ai_conversations
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users delete own AI conversations" on public.ai_conversations
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users manage own AI messages" on public.ai_messages;
create policy "Users read own AI messages" on public.ai_messages
  for select to authenticated using (
    (select auth.uid()) = user_id and exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id and c.user_id = (select auth.uid())
    )
  );
create policy "Users create own user AI messages" on public.ai_messages
  for insert to authenticated with check (
    (select auth.uid()) = user_id and role = 'user' and exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id and c.user_id = (select auth.uid())
    )
  );
create policy "Users delete own AI messages" on public.ai_messages
  for delete to authenticated using (
    (select auth.uid()) = user_id and exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id and c.user_id = (select auth.uid())
    )
  );
revoke update on table public.ai_messages from authenticated;

drop policy if exists "Authenticated users can view published quiz questions" on public.quiz_questions;
create policy "Authenticated users can view published quiz questions safely"
  on public.quiz_questions for select to authenticated using (
    exists (
      select 1 from public.quizzes q
      left join public.courses c on c.id = q.course_id
      where q.id = quiz_questions.quiz_id
        and q.status = 'published'::public.publish_status
        and (q.course_id is null or c.status = 'published'::public.publish_status)
    )
  );
revoke select on table public.quiz_questions from anon, authenticated;
grant select (id, quiz_id, question, options, position, created_at)
  on table public.quiz_questions to authenticated;

alter view public.quiz_questions_public set (security_invoker = true);
revoke all on table public.quiz_questions_public from anon, authenticated;
grant select on table public.quiz_questions_public to authenticated;

revoke execute on function public.check_quiz_answer(uuid, uuid, integer)
  from public, anon, authenticated;
revoke execute on function public.submit_quiz_attempt(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_quiz_attempt(uuid, jsonb) to authenticated;

alter function public.consume_security_rate_limit(text, integer, integer)
  set search_path = '';

drop policy if exists "No client access to security sessions" on public.security_sessions;
create policy "No client access to security sessions" on public.security_sessions
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "No client access to security rate limits" on public.security_rate_limits;
create policy "No client access to security rate limits" on public.security_rate_limits
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "No client access to security audit logs" on public.security_audit_logs;
create policy "No client access to security audit logs" on public.security_audit_logs
  for all to anon, authenticated using (false) with check (false);

commit;

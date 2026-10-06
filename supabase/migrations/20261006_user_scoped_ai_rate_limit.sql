create or replace function public.consume_user_security_rate_limit(p_bucket text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_limit integer;
begin
  if v_user is null then
    return false;
  end if;

  v_limit := case p_bucket
    when 'ai_analytics' then 30
    when 'ai_planner' then 10
    when 'ai_context' then 30
    when 'ai_personal_plan' then 5
    else null
  end;

  if v_limit is null then
    return false;
  end if;

  return public.consume_security_rate_limit(
    p_bucket || ':user:' || v_user::text,
    v_limit,
    600
  );
end;
$function$;

revoke all on function public.consume_user_security_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_user_security_rate_limit(text) to authenticated;


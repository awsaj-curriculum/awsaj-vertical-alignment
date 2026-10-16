-- Tim asked that "undo" simply takes a rating off: the standard goes straight back to "not done yet".
-- Teams can also remove any answer (clear_rating). A removal is logged with new_level = null, so the history keeps it.
alter table rating_events alter column new_level drop not null;

create or replace function clear_rating(p_framework text, p_code text, p_grade text, p_team text, p_device text default '')
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_old smallint;
begin
  if not exists (select 1 from teams where name = p_team) then raise exception 'unknown team'; end if;
  select level into v_old from ratings where framework = p_framework and code = p_code and grade = p_grade;
  if not found then return; end if;
  delete from ratings where framework = p_framework and code = p_code and grade = p_grade;
  insert into rating_events (framework, code, grade, old_level, new_level, team, device_id)
  values (p_framework, p_code, p_grade, v_old, null, p_team, left(coalesce(p_device, ''), 64));
end $$;

-- Undo (from the message after rating, or from Activity) now takes the rating off instead of restoring an older answer.
-- Undoing a removal puts the removed answer back.
create or replace function undo_my_rating(p_framework text, p_code text, p_grade text, p_device text)
returns smallint language plpgsql security definer set search_path = public, extensions as $$
declare e rating_events%rowtype;
begin
  if coalesce(p_device, '') = '' then raise exception 'cannot undo from this device'; end if;
  select * into e from rating_events where framework = p_framework and code = p_code and grade = p_grade
  order by created_at desc, id desc limit 1;
  if not found or e.undone or e.device_id <> p_device or e.created_at < now() - interval '15 minutes' then
    raise exception 'This change can no longer be undone here. Use Remove on the standard instead.';
  end if;
  delete from ratings where framework = e.framework and code = e.code and grade = e.grade;
  update rating_events set undone = true where id = e.id;
  return null;
end $$;

create or replace function undo_change(p_event_id bigint)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare e rating_events%rowtype; v_latest bigint;
begin
  select * into e from rating_events where id = p_event_id and undone = false;
  if not found then raise exception 'This change was already undone.'; end if;
  select id into v_latest from rating_events where framework = e.framework and code = e.code and grade = e.grade
  order by created_at desc, id desc limit 1;
  if v_latest <> e.id then raise exception 'A newer change to this standard exists. Undo that one first.'; end if;
  if e.new_level is null and e.old_level is not null then
    insert into ratings (framework, code, grade, level, team, updated_at) values (e.framework, e.code, e.grade, e.old_level, e.team, now())
    on conflict (framework, code, grade) do update set level = excluded.level, team = excluded.team, updated_at = now();
  else
    delete from ratings where framework = e.framework and code = e.code and grade = e.grade;
  end if;
  update rating_events set undone = true where id = e.id;
end $$;

revoke all on function clear_rating from public;
grant execute on function clear_rating to anon, authenticated;

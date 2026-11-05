-- Removed standards (cleanup, Nov 2026). Some standards were taken off the site (wrong placements and placeholders with
-- no real standard). Their ratings were deleted, but saved copies still hold them, and a laptop with an old page open
-- could still send one. This keeps them off for good:
--   removed_standards  the exact set + code + grade of every standard taken off, with the reason (public read).
--   rating_key_ok()    a rating may exist only if the standard is still on the site for that grade's division and the
--                      set + code + grade is not in removed_standards.
--   set_rating         refuses a rating that fails rating_key_ok (the page then shows the answer was not saved).
--   put_back           (used by Load and Undo) skips any saved rating that fails rating_key_ok.
--   undo_copy          a copy marked only_rows holds chosen standards only (not a whole grade or subject), so undoing it
--                      takes off and keeps only those standards' ratings, never the rest of the site.

create table if not exists removed_standards (
  framework text not null, code text not null, grade text not null,
  reason text not null,
  removed_at timestamptz not null default now(),
  primary key (framework, code, grade)
);
alter table removed_standards enable row level security;
drop policy if exists "public read" on removed_standards;
create policy "public read" on removed_standards for select using (true);

alter table rating_archives add column if not exists only_rows boolean not null default false;

create or replace function rating_key_ok(p_framework text, p_code text, p_grade text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from removed_standards x where x.framework = p_framework and x.code = p_code and x.grade = p_grade)
     and exists (select 1 from standards s where s.framework = p_framework and s.code = p_code
                 and s.division = case when p_grade in ('K', '1', '2', '3', '4', '5') then 'Elementary'
                                       when p_grade in ('6', '7', '8') then 'Middle' else 'High' end)
$$;
revoke all on function rating_key_ok(text, text, text) from public, anon, authenticated;

create or replace function set_rating(p_framework text, p_code text, p_grade text, p_level smallint,
                                      p_team text, p_device text default '')
returns smallint language plpgsql security definer set search_path = public, extensions as $$
declare v_old smallint;
begin
  if p_level not between 0 and 2 then raise exception 'level must be 0, 1 or 2'; end if;
  if not exists (select 1 from teams where name = p_team) then raise exception 'unknown team'; end if;
  if not rating_key_ok(p_framework, p_code, p_grade) then
    raise exception 'This standard is no longer on the site for this grade. Reload the page.'; end if;
  select level into v_old from ratings where framework = p_framework and code = p_code and grade = p_grade;
  insert into ratings (framework, code, grade, level, team, updated_at)
  values (p_framework, p_code, p_grade, p_level, p_team, now())
  on conflict (framework, code, grade) do update set level = excluded.level, team = excluded.team, updated_at = now();
  insert into rating_events (framework, code, grade, old_level, new_level, team, device_id)
  values (p_framework, p_code, p_grade, v_old, p_level, p_team, left(coalesce(p_device, ''), 64));
  return p_level;
end $$;

create or replace function put_back(p_archive_id bigint, p_grade text, p_subject text, p_device text)
returns int language plpgsql security definer set search_path = public, extensions as $$
declare v_n int;
begin
  insert into ratings (framework, code, grade, level, team, updated_at)
  select a.framework, a.code, a.grade, a.level, coalesce(a.team, 'Saved copy'), now() from rating_archive_rows a
  where a.archive_id = p_archive_id and (p_grade is null or a.grade = p_grade) and in_subject(a.framework, p_subject)
    and rating_key_ok(a.framework, a.code, a.grade)
  on conflict (framework, code, grade) do update set level = excluded.level, team = excluded.team, updated_at = now();
  get diagnostics v_n = row_count;
  insert into rating_events (framework, code, grade, old_level, new_level, team, device_id)
  select a.framework, a.code, a.grade, null, a.level, coalesce(a.team, 'Saved copy'), left(coalesce(p_device, ''), 64)
  from rating_archive_rows a
  where a.archive_id = p_archive_id and (p_grade is null or a.grade = p_grade) and in_subject(a.framework, p_subject)
    and rating_key_ok(a.framework, a.code, a.grade);
  return v_n;
end $$;

create or replace function undo_copy(p_pin text, p_archive_id bigint, p_grade text default null,
  p_subject text default null, p_device text default '')
returns int language plpgsql security definer set search_path = public, extensions as $$
declare a rating_archives%rowtype; g text; s text; v_n int; v_id bigint;
begin
  perform check_clear_pin(p_pin);
  select * into a from rating_archives where id = p_archive_id;
  if not found or a.kind = 'save' then raise exception 'Only a Clear, a Load or an Undo can be undone.'; end if;
  if a.grade is not null and p_grade is not null and p_grade <> a.grade then raise exception 'That grade is not part of this change.'; end if;
  if a.subject is not null and p_subject is not null and p_subject <> a.subject then raise exception 'That subject is not part of this change.'; end if;
  g := coalesce(a.grade, p_grade); s := coalesce(a.subject, p_subject);
  if a.only_rows then
    insert into rating_archives (name, kind, scope, grade, subject, only_rows)
    values ('Before undoing "' || a.name || '"', 'undo', a.scope, g, s, true) returning id into v_id;
    insert into rating_archive_rows (archive_id, framework, code, grade, level, team, updated_at)
    select v_id, r.framework, r.code, r.grade, r.level, r.team, r.updated_at
    from ratings r join rating_archive_rows x
      on x.archive_id = a.id and x.framework = r.framework and x.code = r.code and x.grade = r.grade
    where (g is null or r.grade = g) and in_subject(r.framework, s);
    update rating_archives set row_count = (select count(*) from rating_archive_rows where archive_id = v_id) where id = v_id;
    insert into rating_events (framework, code, grade, old_level, new_level, team, device_id)
    select x.framework, x.code, x.grade, x.level, null, coalesce(x.team, 'Saved copy'), left(coalesce(p_device, ''), 64)
    from rating_archive_rows x where x.archive_id = v_id;
    delete from ratings r using rating_archive_rows x
    where x.archive_id = v_id and r.framework = x.framework and r.code = x.code and r.grade = x.grade;
  else
    perform keep_copy('Before undoing "' || a.name || '"', 'undo', g, s, true, p_device);
  end if;
  v_n := put_back(p_archive_id, g, s, p_device);
  if g is not distinct from a.grade and s is not distinct from a.subject then
    update rating_archives set undone_at = now() where id = p_archive_id;
  end if;
  return v_n;
end $$;

revoke all on function put_back(bigint, text, text, text) from public, anon, authenticated;
revoke all on function set_rating(text, text, text, smallint, text, text) from public;
grant execute on function set_rating(text, text, text, smallint, text, text) to anon, authenticated;
revoke all on function undo_copy(text, bigint, text, text, text) from public;
grant execute on function undo_copy(text, bigint, text, text, text) to anon, authenticated;

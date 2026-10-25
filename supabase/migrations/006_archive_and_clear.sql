-- Saved copies of the ratings (Tim's request, Oct 2026). Copies have names, not years: it may happen twice a year.
--   Save   a named copy of the whole vertical alignment (every rating); nothing changes on the site.
--   Load   a saved copy of the whole vertical alignment: it replaces every rating on the site.
--   Clear  the ratings of one part (a team, grade, subject or course = a grade and/or subject); a copy is kept first.
--   Undo   a Clear, a Load or an earlier Undo: all of it, or one grade and/or subject of it.
--   Delete a saved copy.
-- Every one needs the PIN. Only a bcrypt hash of it is stored, in app_settings key 'clear_pin_hash' (set by hand with
-- crypt(..., gen_salt('bf'))); the PIN itself is never in this repo or on the site.
-- Clear, Load and Undo each keep the ratings they replace as a copy (kind 'clear', 'load', 'undo'), which is what
-- Undo puts back. Every rating they change is also logged in rating_events.

create table if not exists rating_archives (
  id bigserial primary key,
  name text not null,
  kind text not null check (kind in ('save', 'clear', 'load', 'undo')),
  scope text not null,              -- "Every grade, every subject", "Grade 9, Math", ...
  grade text,                       -- null = every grade
  subject text,                     -- null = every subject
  row_count int not null default 0,
  undone_at timestamptz,            -- set when the whole of a clear / load / undo has been undone
  created_at timestamptz not null default now()
);
create table if not exists rating_archive_rows (
  archive_id bigint not null references rating_archives(id) on delete cascade,
  framework text not null, code text not null, grade text not null,
  level smallint not null, team text, updated_at timestamptz,
  primary key (archive_id, framework, code, grade)
);
alter table rating_archives enable row level security;
alter table rating_archive_rows enable row level security;
drop policy if exists "public read" on rating_archives;
drop policy if exists "public read" on rating_archive_rows;
create policy "public read" on rating_archives for select using (true);
create policy "public read" on rating_archive_rows for select using (true);

create or replace function check_clear_pin(p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from app_settings where key = 'clear_pin_hash' and value = crypt(coalesce(p_pin, ''), value)) then
    perform pg_sleep(1);
    raise exception 'Wrong PIN.';
  end if;
end $$;

-- True when a rating's framework belongs to the subject (null subject = every subject).
create or replace function in_subject(p_framework text, p_subject text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_subject is null or exists (select 1 from standards where framework = p_framework and subject = p_subject)
$$;

-- Copy the ratings in a part into a new saved copy; with p_take_off, take them off the site too (logged).
create or replace function keep_copy(p_name text, p_kind text, p_grade text, p_subject text, p_take_off boolean, p_device text)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare v_id bigint; v_n int; v_scope text;
begin
  v_scope := coalesce(case when p_grade is null then null when p_grade = 'K' then 'Kindergarten' else 'Grade ' || p_grade end, 'Every grade')
             || ', ' || coalesce(p_subject, 'every subject');
  insert into rating_archives (name, kind, scope, grade, subject)
  values (coalesce(nullif(trim(p_name), ''), v_scope), p_kind, v_scope, p_grade, p_subject) returning id into v_id;
  insert into rating_archive_rows (archive_id, framework, code, grade, level, team, updated_at)
  select v_id, r.framework, r.code, r.grade, r.level, r.team, r.updated_at from ratings r
  where (p_grade is null or r.grade = p_grade) and in_subject(r.framework, p_subject);
  get diagnostics v_n = row_count;
  update rating_archives set row_count = v_n where id = v_id;
  if p_take_off then
    insert into rating_events (framework, code, grade, old_level, new_level, team, device_id)
    select a.framework, a.code, a.grade, a.level, null, coalesce(a.team, 'Saved copy'), left(coalesce(p_device, ''), 64)
    from rating_archive_rows a where a.archive_id = v_id;
    delete from ratings r using rating_archive_rows a
    where a.archive_id = v_id and r.framework = a.framework and r.code = a.code and r.grade = a.grade;
  end if;
  return v_id;
end $$;

-- Put a copy's ratings (in a part of it) back on the site, logged. The part must already be empty.
create or replace function put_back(p_archive_id bigint, p_grade text, p_subject text, p_device text)
returns int language plpgsql security definer set search_path = public, extensions as $$
declare v_n int;
begin
  insert into ratings (framework, code, grade, level, team, updated_at)
  select a.framework, a.code, a.grade, a.level, coalesce(a.team, 'Saved copy'), now() from rating_archive_rows a
  where a.archive_id = p_archive_id and (p_grade is null or a.grade = p_grade) and in_subject(a.framework, p_subject)
  on conflict (framework, code, grade) do update set level = excluded.level, team = excluded.team, updated_at = now();
  get diagnostics v_n = row_count;
  insert into rating_events (framework, code, grade, old_level, new_level, team, device_id)
  select a.framework, a.code, a.grade, null, a.level, coalesce(a.team, 'Saved copy'), left(coalesce(p_device, ''), 64)
  from rating_archive_rows a
  where a.archive_id = p_archive_id and (p_grade is null or a.grade = p_grade) and in_subject(a.framework, p_subject);
  return v_n;
end $$;

-- Save a named copy of the whole vertical alignment.
create or replace function save_copy(p_pin text, p_name text)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
begin
  perform check_clear_pin(p_pin);
  if coalesce(trim(p_name), '') = '' then raise exception 'Give the copy a name.'; end if;
  return keep_copy(p_name, 'save', null, null, false, '');
end $$;

-- Clear one part (null grade / subject = every one). The cleared ratings are kept as a copy that Undo puts back.
create or replace function clear_part(p_pin text, p_grade text, p_subject text, p_device text default '')
returns bigint language plpgsql security definer set search_path = public, extensions as $$
begin
  perform check_clear_pin(p_pin);
  return keep_copy('Cleared', 'clear', p_grade, p_subject, true, p_device);
end $$;

-- Load a saved copy of the whole vertical alignment: every rating on the site is replaced (kept first, for Undo).
create or replace function load_copy(p_pin text, p_archive_id bigint, p_device text default '')
returns int language plpgsql security definer set search_path = public, extensions as $$
declare a rating_archives%rowtype;
begin
  perform check_clear_pin(p_pin);
  select * into a from rating_archives where id = p_archive_id;
  if not found or a.kind <> 'save' then raise exception 'Only a saved copy of the whole vertical alignment can be loaded.'; end if;
  perform keep_copy('Before loading "' || a.name || '"', 'load', null, null, true, p_device);
  return put_back(p_archive_id, null, null, p_device);
end $$;

-- Undo a Clear, a Load or an Undo, all of it or one part (a grade and/or subject inside what it covered).
-- The ratings now in that part are kept as a copy first, so an Undo can itself be undone.
create or replace function undo_copy(p_pin text, p_archive_id bigint, p_grade text default null,
  p_subject text default null, p_device text default '')
returns int language plpgsql security definer set search_path = public, extensions as $$
declare a rating_archives%rowtype; g text; s text; v_n int;
begin
  perform check_clear_pin(p_pin);
  select * into a from rating_archives where id = p_archive_id;
  if not found or a.kind = 'save' then raise exception 'Only a Clear, a Load or an Undo can be undone.'; end if;
  if a.grade is not null and p_grade is not null and p_grade <> a.grade then raise exception 'That grade is not part of this change.'; end if;
  if a.subject is not null and p_subject is not null and p_subject <> a.subject then raise exception 'That subject is not part of this change.'; end if;
  g := coalesce(a.grade, p_grade); s := coalesce(a.subject, p_subject);
  perform keep_copy('Before undoing "' || a.name || '"', 'undo', g, s, true, p_device);
  v_n := put_back(p_archive_id, g, s, p_device);
  if g is not distinct from a.grade and s is not distinct from a.subject then
    update rating_archives set undone_at = now() where id = p_archive_id;
  end if;
  return v_n;
end $$;

-- Delete a saved copy for good. The ratings on the site are not touched.
create or replace function delete_copy(p_pin text, p_archive_id bigint)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform check_clear_pin(p_pin);
  delete from rating_archives where id = p_archive_id;
  if not found then raise exception 'That saved copy does not exist.'; end if;
end $$;

revoke all on function check_clear_pin(text) from public, anon, authenticated;
revoke all on function in_subject(text, text) from public, anon, authenticated;
revoke all on function keep_copy(text, text, text, text, boolean, text) from public, anon, authenticated;
revoke all on function put_back(bigint, text, text, text) from public, anon, authenticated;
revoke all on function save_copy(text, text) from public;
revoke all on function clear_part(text, text, text, text) from public;
revoke all on function load_copy(text, bigint, text) from public;
revoke all on function undo_copy(text, bigint, text, text, text) from public;
revoke all on function delete_copy(text, bigint) from public;
grant execute on function save_copy(text, text) to anon, authenticated;
grant execute on function clear_part(text, text, text, text) to anon, authenticated;
grant execute on function load_copy(text, bigint, text) to anon, authenticated;
grant execute on function undo_copy(text, bigint, text, text, text) to anon, authenticated;
grant execute on function delete_copy(text, bigint) to anon, authenticated;

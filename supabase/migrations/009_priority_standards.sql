-- Priority standards (Tim, Nov 2026; PD "From Standards to Student Success", Part 2 subject sessions).
-- Each grade (or high school course, one per grade) chooses the standards it wants taught in depth for the
-- SAT / US Diploma track, working from Grade 12 down. Read-only to the public key; every write goes through a
-- logged function. A grade's list is a draft until its team marks it ready; the group then reviews it against the
-- grade above and the leader approves it with the PIN (same bcrypt check as Clear / Load / Excel). Approved lists
-- are locked until the leader reopens them. No student or teacher names: teams are recorded by team name.

create table if not exists pd_picks (
  subject    text not null,
  grade      text not null,
  framework  text not null,
  code       text not null,
  note       text not null default '',
  team       text not null default '',
  updated_at timestamptz not null default now(),
  primary key (subject, grade, framework, code)
);

create table if not exists pd_status (
  subject     text not null,
  grade       text not null,
  status      text not null default 'draft' check (status in ('draft', 'ready', 'approved')),
  updated_at  timestamptz not null default now(),
  approved_at timestamptz,
  primary key (subject, grade)
);

create table if not exists pd_profile (
  subject     text primary key,
  knowledge   text not null default '',
  skills      text not null default '',
  application text not null default '',
  team        text not null default '',
  updated_at  timestamptz not null default now()
);

create table if not exists pd_events (
  id         bigserial primary key,
  kind       text not null,
  subject    text not null,
  grade      text not null default '',
  framework  text not null default '',
  code       text not null default '',
  detail     text not null default '',
  team       text not null default '',
  created_at timestamptz not null default now()
);

alter table pd_picks   enable row level security;
alter table pd_status  enable row level security;
alter table pd_profile enable row level security;
alter table pd_events  enable row level security;
drop policy if exists read_pd_picks on pd_picks;     create policy read_pd_picks   on pd_picks   for select using (true);
drop policy if exists read_pd_status on pd_status;   create policy read_pd_status  on pd_status  for select using (true);
drop policy if exists read_pd_profile on pd_profile; create policy read_pd_profile on pd_profile for select using (true);
drop policy if exists read_pd_events on pd_events;   create policy read_pd_events  on pd_events  for select using (true);

create or replace function pd_ok(p_subject text, p_grade text) returns void language plpgsql as $$
begin
  if p_subject not in ('Math', 'ELA', 'Science', 'Social Studies') then raise exception 'Unknown subject.'; end if;
  if p_grade not in ('K','1','2','3','4','5','6','7','8','9','10','11','12') then raise exception 'Unknown grade.'; end if;
end $$;

create or replace function pd_locked(p_subject text, p_grade text) returns boolean language sql stable as $$
  select coalesce((select status = 'approved' from pd_status where subject = p_subject and grade = p_grade), false);
$$;

-- tick or untick one standard (and keep its note)
create or replace function pd_set_pick(p_subject text, p_grade text, p_framework text, p_code text, p_on boolean,
                                       p_note text default '', p_team text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  perform pd_ok(p_subject, p_grade);
  if pd_locked(p_subject, p_grade) then raise exception 'This list is approved. Ask the leader to reopen it first.'; end if;
  if not exists (select 1 from standards where framework = p_framework and code = p_code) then raise exception 'Unknown standard.'; end if;
  if p_on then
    insert into pd_picks (subject, grade, framework, code, note, team)
      values (p_subject, p_grade, p_framework, p_code, left(coalesce(p_note, ''), 500), left(coalesce(p_team, ''), 80))
      on conflict (subject, grade, framework, code) do update set note = excluded.note, team = excluded.team, updated_at = now();
  else
    delete from pd_picks where subject = p_subject and grade = p_grade and framework = p_framework and code = p_code;
  end if;
  insert into pd_status (subject, grade) values (p_subject, p_grade) on conflict do nothing;
  insert into pd_events (kind, subject, grade, framework, code, detail, team)
    values (case when p_on then 'pick' else 'unpick' end, p_subject, p_grade, p_framework, p_code, left(coalesce(p_note, ''), 500), left(coalesce(p_team, ''), 80));
end $$;

-- a team marks its list ready for review, or back to draft
create or replace function pd_set_status(p_subject text, p_grade text, p_status text, p_team text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  perform pd_ok(p_subject, p_grade);
  if p_status not in ('draft', 'ready') then raise exception 'Teams can mark a list draft or ready.'; end if;
  if pd_locked(p_subject, p_grade) then raise exception 'This list is approved. Ask the leader to reopen it first.'; end if;
  insert into pd_status (subject, grade, status, updated_at) values (p_subject, p_grade, p_status, now())
    on conflict (subject, grade) do update set status = excluded.status, updated_at = now();
  insert into pd_events (kind, subject, grade, team) values (p_status, p_subject, p_grade, left(coalesce(p_team, ''), 80));
end $$;

-- the leader approves a list after the group review (PIN), or reopens it
create or replace function pd_approve(p_pin text, p_subject text, p_grade text, p_on boolean)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform check_clear_pin(p_pin);
  perform pd_ok(p_subject, p_grade);
  insert into pd_status (subject, grade, status, updated_at, approved_at)
    values (p_subject, p_grade, case when p_on then 'approved' else 'ready' end, now(), case when p_on then now() end)
    on conflict (subject, grade) do update set status = excluded.status, updated_at = now(), approved_at = excluded.approved_at;
  insert into pd_events (kind, subject, grade) values (case when p_on then 'approve' else 'reopen' end, p_subject, p_grade);
end $$;

-- the Grade 12 learner profile for a subject
create or replace function pd_set_profile(p_subject text, p_knowledge text, p_skills text, p_application text, p_team text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  perform pd_ok(p_subject, '12');
  insert into pd_profile (subject, knowledge, skills, application, team, updated_at)
    values (p_subject, left(coalesce(p_knowledge, ''), 2000), left(coalesce(p_skills, ''), 2000), left(coalesce(p_application, ''), 2000), left(coalesce(p_team, ''), 80), now())
    on conflict (subject) do update set knowledge = excluded.knowledge, skills = excluded.skills, application = excluded.application, team = excluded.team, updated_at = now();
  insert into pd_events (kind, subject, grade, team) values ('profile', p_subject, '12', left(coalesce(p_team, ''), 80));
end $$;

revoke all on function pd_set_pick(text, text, text, text, boolean, text, text) from public;
revoke all on function pd_set_status(text, text, text, text) from public;
revoke all on function pd_approve(text, text, text, boolean) from public;
revoke all on function pd_set_profile(text, text, text, text, text) from public;
grant execute on function pd_set_pick(text, text, text, text, boolean, text, text) to anon, authenticated;
grant execute on function pd_set_status(text, text, text, text) to anon, authenticated;
grant execute on function pd_approve(text, text, text, boolean) to anon, authenticated;
grant execute on function pd_set_profile(text, text, text, text, text) to anon, authenticated;

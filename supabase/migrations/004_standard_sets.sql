-- Standard sets: Essential Elements are now rated on their own (frameworks WI-EE-MATH, WI-EE-ELA, WI-EE-SCI, WI-EE-SS;
-- rows come from data/standards/essential_elements.json, built by scripts/build_ee_rows.py), and each team chooses
-- which sets it works through for each subject. The choice is shared by everyone on the team.
create table if not exists team_sets (
  team       text not null references teams(name) on update cascade,
  subject    text not null,
  frameworks text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (team, subject)
);
alter table team_sets enable row level security;
create policy read_team_sets on team_sets for select using (true);

create or replace function set_team_sets(p_team text, p_subject text, p_frameworks text[])
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from teams where name = p_team) then raise exception 'unknown team'; end if;
  if coalesce(array_length(p_frameworks, 1), 0) = 0 then raise exception 'choose at least one set of standards'; end if;
  if exists (select 1 from unnest(p_frameworks) f where not exists (select 1 from standards s where s.framework = f and s.subject = p_subject)) then
    raise exception 'unknown set of standards for this subject'; end if;
  insert into team_sets (team, subject, frameworks, updated_at) values (p_team, p_subject, p_frameworks, now())
  on conflict (team, subject) do update set frameworks = excluded.frameworks, updated_at = now();
end $$;

revoke all on function set_team_sets from public;
grant execute on function set_team_sets to anon, authenticated;

-- Essential Elements as their own rows, derived from the ee_code / ee_text already stored on each standard
-- (same rule as scripts/build_ee_rows.py: one row per EE code and grade, first linked row wins, crosswalk = linked codes).
with links as (
  select s.*, trim(x) as ee,
         case s.subject when 'Math' then 'WI-EE-MATH' when 'ELA' then 'WI-EE-ELA' when 'Science' then 'WI-EE-SCI' else 'WI-EE-SS' end as fw
  from standards s cross join lateral unnest(string_to_array(s.ee_code, ';')) x
  where s.ee_code <> '' and s.framework not like 'WI-EE-%' and trim(x) <> ''
), firsts as (
  select distinct on (fw, ee, grade) * from links order by fw, ee, grade, id
)
insert into standards (subject, framework, code, grade, grade_band, grade_is_suggested, division, course, strand, cluster,
                       text, crosswalk, source)
select f.subject, f.fw, f.ee, f.grade, f.grade_band, f.grade_is_suggested, f.division, f.course, f.strand, f.cluster,
       coalesce(nullif(f.ee_text, ''), f.ee),
       array(select l.framework || ':' || l.code from links l where l.fw = f.fw and l.ee = f.ee and l.grade = f.grade order by l.id),
       'Wisconsin Essential Elements (DPI), linked from ' || f.framework
from firsts f
on conflict (framework, code, grade) do nothing;

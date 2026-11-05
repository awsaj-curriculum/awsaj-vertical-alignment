-- Cleanup, Nov 2026 (Tim's request). Run once, as one transaction, after migration 007.
-- Removes standards that should not be on the site (with their ratings, history and comments), fixes wording and codes
-- on standards that stay, and clears Essential Element links that hold no real standard. Every rating deleted or moved
-- is first kept as the copy "Before cleanup Nov 2026" (kind clear, only_rows). Each step checks its expected count and
-- stops the whole transaction if it differs.
begin;

-- 1-5. Standards to remove (exact set + code + grade).
create temp table rm on commit drop as
select framework, code, grade, '1. Wisconsin Essential Elements for Social Studies are not used in K-5'::text as reason
  from standards where framework = 'WI-EE-SS' and grade in ('K', '1', '2', '3', '4', '5')
union all
select framework, code, grade, '2. Wisconsin Essential Elements for Science are not used in Grade 5'
  from standards where framework = 'WI-EE-SCI' and grade = '5'
union all
select framework, code, grade, '3. Extra placement from the school report-card sheet, not in the AERO Learning Progression'
  from standards where framework = 'AERO-SS' and (grade, code) in (('1', '3.2.b'), ('1', '5.2.b'), ('1', '6.2.b'), ('2', '4.2.c'),
    ('5', '1.5.c'), ('5', '3.5.c'), ('5', '4.5.c'), ('5', '6.5.c'), ('5', '7.5.c'), ('5', '8.5.c'))
union all
select framework, code, grade, '4. Placeholder "(Begins in grade 3)", not a standard'
  from standards where framework = 'WI-EE-ELA' and grade in ('K', '1', '2') and text ilike '%(Begins in grade 3)%'
union all
select framework, code, grade, '5. Placeholder "Not applicable", not a standard'
  from standards where framework in ('WI-EE-ELA', 'WI-EE-MATH') and trim(text) ~* '^\(?(n/?a|not applicable)\M';

-- 6e. Code renames.
create temp table rn (framework text, old text, new text, new_text text) on commit drop;
insert into rn values
 ('WI-EE-ELA', 'EE..W.3.7', 'EE.W.3.7', 'With guidance and support, identify information about a shared or independent inquiry topic.'),
 ('WI-EE-MATH', 'EE.4.OA.5', 'M.EE.4.OA.5', null),
 ('WI-EE-MATH', 'M.EE5.MD.5.a', 'M.EE.5.MD.5.a', null),
 ('WI-EE-MATH', 'M.EE.1.NBT.1a', 'M.EE.1.NBT.1.a', 'Know the count sequence and understand numbers and quantities. a. Count by ones to 30.'),
 ('WI-EE-MATH', 'M.EE.1.NBT.1b', 'M.EE.1.NBT.1.b', 'Know the count sequence and understand numbers and quantities. b. Count up to 10 objects and represent the quantity with the corresponding numeral.');

do $$
declare n int; v_id bigint;
begin
  -- expected counts
  select count(*) into n from rm; if n <> 285 then raise exception 'rm rows % (expected 285)', n; end if;
  select count(*) into n from (select distinct framework, code, grade from rm) x; if n <> 285 then raise exception 'rm not distinct'; end if;
  select count(*) into n from rm where reason like '1.%'; if n <> 130 then raise exception 'section 1: % (130)', n; end if;
  select count(*) into n from rm where reason like '2.%'; if n <> 9 then raise exception 'section 2: % (9)', n; end if;
  select count(*) into n from rm where reason like '3.%'; if n <> 10 then raise exception 'section 3: % (10)', n; end if;
  select count(*) into n from rm where reason like '4.%'; if n <> 3 then raise exception 'section 4: % (3)', n; end if;
  select count(*) into n from rm where reason like '5.%'; if n <> 133 then raise exception 'section 5: % (133)', n; end if;
  select count(*) into n from standards s join rn on s.framework = rn.framework and s.code = rn.old; if n <> 5 then raise exception 'renames found % (5)', n; end if;
  select count(*) into n from standards s join rn on s.framework = rn.framework and s.code = rn.new; if n <> 0 then raise exception 'new codes already in standards'; end if;
  select count(*) into n from ratings s join rn on s.framework = rn.framework and s.code = rn.new; if n <> 0 then raise exception 'new codes already in ratings'; end if;

  -- archive first: every rating to be deleted or moved
  insert into rating_archives (name, kind, scope, grade, subject, only_rows)
  values ('Before cleanup Nov 2026', 'clear', 'Standards removed or renamed in the Nov 2026 cleanup', null, null, true)
  returning id into v_id;
  insert into rating_archive_rows (archive_id, framework, code, grade, level, team, updated_at)
  select v_id, r.framework, r.code, r.grade, r.level, r.team, r.updated_at from ratings r
  where exists (select 1 from rm where rm.framework = r.framework and rm.code = r.code and rm.grade = r.grade)
     or exists (select 1 from rn where rn.framework = r.framework and rn.old = r.code);
  get diagnostics n = row_count;
  update rating_archives set row_count = n where id = v_id;
  if n <> 161 then raise exception 'archived % (expected 161)', n; end if;

  -- 2. Grade 5 science rows linked to the removed Science Essential Elements: clear the link
  update standards s set ee_code = '', ee_text = '', descriptors = s.descriptors - 'ee_at_target'
  where s.grade = '5' and s.framework in ('NGSS', 'AERO-SCI')
    and s.ee_code in (select code from rm where framework = 'WI-EE-SCI');
  get diagnostics n = row_count; if n <> 18 then raise exception 'section 2 links: % (18)', n; end if;

  -- 4, 5 and every other link that holds no real standard ("Not applicable", "N/A", "(Begins in grade 3)")
  update standards s set ee_code = '', ee_text = '', descriptors = s.descriptors - 'ee_at_target',
    descriptors_suggested = case when s.descriptors_suggested ? 'ee_at_target'
      and trim(s.descriptors_suggested->>'ee_at_target') ~* '^\W*(n/?a|not applicable)\M'
      then s.descriptors_suggested - 'ee_at_target' else s.descriptors_suggested end
  where s.framework not like 'WI-EE-%'
    and (trim(s.ee_text) ~* '^\W*(n/?a|not applicable)\M' or s.ee_text ilike '%(Begins in grade 3)%');
  get diagnostics n = row_count; if n <> 264 then raise exception 'placeholder links: % (264)', n; end if;
  select count(*) into n from standards where framework not like 'WI-EE-%' and descriptors_suggested->>'ee_at_target' ~* '^\W*(n/?a|not applicable)\M';
  if n <> 0 then raise exception 'suggested descriptors still hold placeholders: %', n; end if;

  -- 6a. AERO Social Studies wording
  update standards set text = 'Describe ways that the earth’s physical and human-made features have changed over time.'
  where framework = 'AERO-SS' and grade = '4' and code = '3.5.d' and text = 'Describe ways physical and human-made features have changed over time.';
  get diagnostics n = row_count; if n <> 1 then raise exception '6a 3.5.d: %', n; end if;
  update standards set text = 'Identify regional folk heroes, stories, or songs that have contributed to the development of a region’s cultural history.'
  where framework = 'AERO-SS' and grade = 'K' and code = '4.2.a' and text = 'Identify regional folk heroes, stories, or songs that have contributed to the development of a history.';
  get diagnostics n = row_count; if n <> 1 then raise exception '6a 4.2.a: %', n; end if;

  -- 6b. Grade 2 ELA: drop the leading "I can " and capitalise the next letter
  update standards set text = upper(substr(text, 7, 1)) || substr(text, 8)
  where framework = 'WI-CC-ELA' and grade = '2' and code in ('L.2.3.b', 'R.2.6', 'W.2.4', 'W.2.5', 'W.2.6', 'W.2.9') and text like 'I can %';
  get diagnostics n = row_count; if n <> 6 then raise exception '6b: % (6)', n; end if;

  -- 6c. Missing first letter (standard text, then the same text where linked rows repeat it)
  update standards set text = case when text like 'ith %' then 'W' when text like 'se %' then 'U'
                                   when text like 'hen %' then 'W' when text like 'ecognize %' then 'R' end || text
  where (framework, grade, code) in (('WI-CC-ELA', '3', 'R.3.9'), ('WI-CC-ELA', '3', 'W.3.4'), ('WI-CC-ELA', '3', 'W.3.5'), ('WI-CC-ELA', '3', 'W.3.6'),
    ('WI-EE-ELA', '2', 'EE.L.2.4'), ('WI-EE-ELA', '2', 'EE.R.2.1'), ('WI-EE-ELA', '3', 'EE.L.3.4'), ('WI-EE-ELA', '3', 'EE.RF.3.3.a'),
    ('WI-EE-ELA', '3', 'EE.R.3.5'), ('WI-EE-ELA', '3', 'EE.W.3.1'), ('WI-EE-ELA', '3', 'EE.W.3.4'), ('WI-EE-ELA', '3', 'EE.W.3.5'),
    ('WI-EE-ELA', '3', 'EE.W.3.6'), ('WI-EE-ELA', '3', 'EE.W.3.9'))
    and text ~ '^(ith|se|hen|ecognize) ';
  get diagnostics n = row_count; if n <> 14 then raise exception '6c: % (14)', n; end if;
  update standards set ee_text = case when ee_text like 'ith %' then 'W' when ee_text like 'se %' then 'U'
                                      when ee_text like 'hen %' then 'W' end || ee_text
  where framework = 'WI-CC-ELA' and (grade, code) in (('2', 'R.2.1'), ('2', 'L.2.4'), ('3', 'RF.3.3.a'), ('3', 'R.3.5'), ('3', 'W.3.1'),
    ('3', 'W.3.4'), ('3', 'W.3.5'), ('3', 'W.3.6'), ('3', 'W.3.9'), ('3', 'L.3.4.a'))
    and ee_text ~ '^(ith|se|hen) ';
  get diagnostics n = row_count; if n <> 10 then raise exception '6c linked: % (10)', n; end if;

  -- 6d. M.2.NBT.A.1: full text (from the school's Curriculum Hub Grade 2 list, data/source/hub/G2.csv)
  update standards set text = 'Understand that the three digits of a three-digit number represent amounts of hundreds, tens, and ones; e.g., 706 equals 7 hundreds, 0 tens, and 6 ones. Understand the following as special cases: a. 100 can be thought of as a bundle of ten tens — called a "hundred." b. The numbers 100, 200, 300, 400, 500, 600, 700, 800, 900 refer to one, two, three, four, five, six, seven, eight, or nine hundreds (and 0 tens and 0 ones).'
  where framework = 'WI-CC-MATH' and grade = '2' and code = 'M.2.NBT.A.1' and text like 'b The numbers 100, 200%';
  get diagnostics n = row_count; if n <> 1 then raise exception '6d: %', n; end if;

  -- 6e. Renames: standards, ratings, history, comments, the 11/3 saved copy, and the linked rows
  update standards s set code = rn.new, text = coalesce(rn.new_text, s.text) from rn where s.framework = rn.framework and s.code = rn.old;
  get diagnostics n = row_count; if n <> 5 then raise exception '6e standards: %', n; end if;
  update ratings r set code = rn.new from rn where r.framework = rn.framework and r.code = rn.old;
  get diagnostics n = row_count; if n <> 5 then raise exception '6e ratings: % (5)', n; end if;
  update rating_events r set code = rn.new from rn where r.framework = rn.framework and r.code = rn.old;
  update comments r set code = rn.new from rn where r.framework = rn.framework and r.code = rn.old;
  update rating_archive_rows r set code = rn.new from rn where r.framework = rn.framework and r.code = rn.old and r.archive_id <> v_id;
  update standards set ee_code = 'EE.W.3.7', ee_text = 'With guidance and support, identify information about a shared or independent inquiry topic.'
  where framework = 'WI-CC-ELA' and grade = '3' and code = 'W.3.7' and ee_code = 'EE..W.3.7';
  get diagnostics n = row_count; if n <> 1 then raise exception '6e W.3.7: %', n; end if;
  update standards set ee_code = 'M.EE.4.OA.5' where framework = 'WI-CC-MATH' and grade = '4' and code = 'M.4.OA.C.5' and ee_code = 'EE.4.OA.5';
  get diagnostics n = row_count; if n <> 1 then raise exception '6e M.4.OA.C.5: %', n; end if;
  update standards set ee_code = 'M.EE.5.MD.5.a' where framework = 'WI-CC-MATH' and grade = '5' and code = 'M.5.MD.C.5.a' and ee_code = 'M.EE5.MD.5.a';
  get diagnostics n = row_count; if n <> 1 then raise exception '6e M.5.MD.C.5.a: %', n; end if;
  update standards set ee_code = 'M.EE.1.NBT.1.a; M.EE.1.NBT.1.b' where framework = 'WI-CC-MATH' and grade = '1' and code = 'M.1.NBT.A.1.a' and ee_code = 'M.EE.1.NBT.1a; M.EE.1.NBT.1b';
  get diagnostics n = row_count; if n <> 1 then raise exception '6e M.1.NBT.A.1.a: %', n; end if;

  -- 1-5. Delete comments, history and ratings, record the removal, then delete the standards
  delete from comments c using rm where c.framework = rm.framework and c.code = rm.code and c.grade = rm.grade;
  delete from rating_events e using rm where e.framework = rm.framework and e.code = rm.code and e.grade = rm.grade;
  get diagnostics n = row_count; if n <> 214 then raise exception 'history deleted: % (214)', n; end if;
  delete from ratings r using rm where r.framework = rm.framework and r.code = rm.code and r.grade = rm.grade;
  get diagnostics n = row_count; if n <> 156 then raise exception 'ratings deleted: % (156)', n; end if;
  insert into removed_standards (framework, code, grade, reason) select framework, code, grade, reason from rm;
  delete from standards s using rm where s.framework = rm.framework and s.code = rm.code and s.grade = rm.grade;
  get diagnostics n = row_count; if n <> 285 then raise exception 'standards deleted: % (285)', n; end if;

  -- Standard sets chosen by the teams
  update team_sets set frameworks = array_remove(frameworks, 'WI-EE-SS'), updated_at = now()
  where subject = 'Social Studies' and team in ('Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5') and 'WI-EE-SS' = any(frameworks);
  get diagnostics n = row_count; if n <> 6 then raise exception 'team_sets SS: % (6)', n; end if;
  update team_sets set frameworks = array_remove(frameworks, 'WI-EE-SCI'), updated_at = now()
  where subject = 'Science' and team = 'Grade 5' and 'WI-EE-SCI' = any(frameworks);
  get diagnostics n = row_count; if n <> 1 then raise exception 'team_sets Science: % (1)', n; end if;
end $$;

commit;

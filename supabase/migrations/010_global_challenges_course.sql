-- Tim, 18 Nov 2026: a possible second Grade 12 Social Studies course, "Global Challenges and Interconnected Societies",
-- gets its own focus standards list in Part 2 (learningmaps.html). It is stored as grade '12G' (Social Studies only).
-- Part 1 ratings are not affected.
create or replace function pd_ok(p_subject text, p_grade text) returns void language plpgsql as $$
begin
  if p_subject not in ('Math', 'ELA', 'Science', 'Social Studies') then raise exception 'Unknown subject.'; end if;
  if p_grade = '12G' and p_subject = 'Social Studies' then return; end if;
  if p_grade not in ('K','1','2','3','4','5','6','7','8','9','10','11','12') then raise exception 'Unknown grade.'; end if;
end $$;

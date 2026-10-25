# Review C, round 2: Coverage map, Gaps & repetition, Vertical Alignment Audit, standard popup

Independent AI reviewer (did not build the site; new reviewer, not the round 1 reviewer). Method: review kit (all writes
blocked, synthetic ratings), Chromium at 1440 x 1000 and 390 x 844, scripts that recompute findings straight from
site/data/index_*.json and the synthetic ratings without the site's code (recompute.js, audit7.js, v3.js to v6.js,
sci.js). No page errors in any run. No repo files changed. (Saved by the lead session: the reviewer's environment
refused file writes, so it returned this report as text.)

## Scores

| Page | Usability | Visual hierarchy | Information and accuracy | Vertical progression | Interpretation |
|---|---|---|---|---|---|
| Coverage map | 7 | 7 | 7 | 6 | 6 |
| Gaps & repetition | 6 | 7 | 4 | 6 | 6 |
| Vertical Alignment Audit (grade chosen) | 6 | 6 | 6 | 4 | 6 |
| Standard popup | 8 | 7 | 6 | 8 | 7 |

Counts are arithmetically right everywhere checked. Two issues hold accuracy down: the Gaps page says "no grade
teaches it" when only one grade was asked, and with a grade chosen it reports zero progression problems.

## Critical issues

C1. With a grade chosen, Gaps shows "0 progression problems" even when that grade has several. ELA Grade 7: card 0,
section "None found", while the K-12 view lists six problems involving Grade 7 (breaks in Grade 7 for Reading 1,
Reading 4 and Writing 8; RI.8.1, RI.8.4, W.8.3 taught in depth in Grade 8 while the Grade 7 standard they build on is
not taught). The Grade 7 dashboard agrees with K-12. Same for Math (0 vs 4) and Science (0 vs LS2.B break and two
prerequisite gaps from MS-LS2-3). Cause: renderGaps passes only the chosen grade's standards to the progression check,
which removes the steps before and after.

C2. "Confirmed gaps: no grade teaches it" is stated as fact when other grades were never asked, including grades whose
own documents cite the standard. Same wording in the popup and in progression messages. 27 of 122 confirmed gaps have
an unasked grade whose plans cite it, or band grades that never rated it. Examples: Math 6.EE.B.6 ("In plans G5, G6",
Grade 5 never rated); ELA L.3.3 (part 3 of 3), in plans G3, G6, G7, G8; HSA-CED.A.3 rated by Grade 9 only while
Grades 10 to 12 of the same band were never asked (11 more high school Math and EE rows); Science 7 band standards;
Social Studies 6 (including AERO 6.5.b and 3.5.f, Grades 3-5 benchmarks rated by one grade only).

## Task results

1. Social Studies Grades 3-5 (about 12 minutes, medium-high confidence): mostly missing ratings in Grade 4, with real
weakness in Grade 3's power standards. 106 of 128 rated (G4 lowest, 73%); 15 power standards not rated (11 in G4);
10 standards nobody rated. Rated weak: G3 rates five power standards below in depth (2.5.a, 3.5.b, 4.5.c, 7.5.a
introduced; 6.5.b not taught, and in G3's plans); G4 rates 6.5.f introduced; G5 rates 3.5.f not taught. The two
"confirmed gaps" each rest on one rating of a 3-5 band standard (C2). Unknowns are separated well.
2. Math possible duplication 6.NS.B.3 (about 8 minutes, high confidence): in depth in G6 (suggested, priority, in plans)
and G7 (script confirms). G7 plans do not cite it. Popup shows it builds on 5.NBT.B.7. Likely review before 7.NS work;
the site rightly says "possible". The "continues in The number system" note in the popup is plain text, not a link.
Duplication, taught early and reinforcement are now correctly separated.
3. Grade 7 ELA Audit (about 10 minutes, high confidence): all counts match recomputation (84 in plans; 68 priority, 16
placed elsewhere, 52 rated by G7; 22 of 41 rated in depth, 19 below, 11 not rated; 35 of 40 planned taught; 5 in plans
not taught; 2 taught not cited). Caveats: 25 of the 52 are EE rows that inherit priority from their linked standard,
which the page does not say; Common Core alone is 9 of 21, and the Dashboard shows 9/21 while the Audit shows 22/41.
The note "(it can claim band standards on the Rate page)" is wrong for all 16 placed elsewhere.
4. Science weakest (about 12 minutes, medium confidence): map and Gaps point to different places. The fully magenta
Grade 4 Life Science tile (2 of 2 power standards not taught) is not in "Thinnest teaching" because tiles need 3+ rated,
which only the help says. Column percentages are percent rated with no label; no per-grade in-depth share.
5. Recomputed findings: Coverage map Math, Gaps Math and Audit G7 ELA all matched exactly (and for all subjects).
Inconsistencies: "priority not rated yet" is 64 on the Social Studies map and 96 on Gaps (Science 31 vs 41); Audit
22/41 vs Dashboard 9/21 for Grade 7 ELA priority.
6. Sources: automatic checks and documents are clear; Gaps and Dashboard state "builds on" links as fact though they
are inferred; EE "★ Priority" looks documented but is inherited; band structure ignored in gap verdicts.

## Other required improvements (ranked)

1. Label progression links on Gaps and Dashboard as inferred or official.
2. The Audit's K-12 grid is nearly empty outside the chosen grade; show neighbouring grades' steps or reword.
3. Audit priority: split Common Core from EE, disclose the EE inheritance, reconcile with the Dashboard, fix the band note.
4. Coverage map: label column percentages as rated, add each grade's in-depth share, include small fully not-taught
tiles in findings, show percentages beside "Thinnest" lines.
5. Make "priority not rated yet" mean the same on map and Gaps.
6. The Strand filter is an empty box on K-12 views until a grade is chosen.
7. Phone: Audit tables clip the Standard text; the map shows K to G2 with no cue to scroll; Gaps is about 26,000 px tall.
8. Desktop Gaps: "Priority below in depth" (100 items) open by default makes the page about 9,400 px.
9. Audit cards: "0 in the plans but marked not taught" should be n/a without plan data; the 35/40 card is coloured as an issue.
10. Popup: the in-plans bar is hidden under the suggested-grade outline; no off-grade dot though the legend promises
one; all check chips have the same weight.
11. "Back to Gaps" returns to the top of the page.
12. Contrast and colour: muted text 4.44:1 on white and 4.08:1 on the page background; magenta against blue weak for
protanopes in thin tile bands; ★ on nearly every Math tile stops being a signal; dashed edge on EE tiles inconsistent.
13. The Audit's "?" help describes Part 2, which has not run.

## Strengths to keep

Every recomputed count matched the raw data. Unknown is kept apart from problems almost everywhere (waiting tags,
rated-only counts, "No plan data yet"). Findings first with "What to do" lines and K-12 strips. Drill-down tile, list,
standard, progression works with Back and Escape; the committee's rating change asks for confirmation. The popup's
before/after box is the best vertical view on the site. The Social Studies map shows each AERO strand continuing into
its Wisconsin domain. Rating colours are colour-blind safe and paired with words. No sideways scroll at 390 px.

## Round 1 critical issues (round-1-A.md)

1. Confirmed gaps overclaim: partly resolved. Confirmation now needs every suggested and priority grade; the items A
named moved to "Possible gaps: waiting for ...". Not resolved: wording still says "no grade teaches it"; 27 of 122
confirmed gaps have unasked band grades or grades whose plans cite the standard (C2).
2. Audit reports missing plan data as findings: resolved ("No plan data yet", n/a). Leftover: the "in the plans but
marked not taught" card shows 0 instead of n/a.
3. Audit counts priority standards the grade cannot rate: resolved (listed apart, counts use the 52 G7 rates).
Leftover: the band note is wrong for those 16.
4. Map findings and Strand menu do not name the set: resolved (badges on findings, "Geometry (CC, EE)").

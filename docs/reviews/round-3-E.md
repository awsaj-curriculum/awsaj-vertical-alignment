# Review E, round 3: Coverage map, Gaps & repetition, Vertical Alignment Audit, standard popup

Independent AI reviewer (new; did not build the site and had not seen earlier rounds before scoring). Method: review kit
(writes blocked, synthetic ratings), Chromium 1440 x 1000 and 390 x 844, own scripts recomputing from
site/data/index_*.json and the synthetic ratings. No page errors; no repo files changed. Scores were written down
before reading round-2-C.md and not changed afterwards. (Saved by the lead session from the reviewer's final message.)

## Scores

| Page | Usability | Visual hierarchy | Information and accuracy | Vertical progression | Interpretation |
|---|---|---|---|---|---|
| Coverage map | 7 | 7 | 7 | 6 | 6 |
| Gaps & repetition | 7 | 7 | 6 | 7 | 7 |
| Vertical Alignment Audit (grade chosen) | 6 | 6 | 5 | 5 | 7 |
| Standard popup | 8 | 7 | 7 | 8 | 7 |

Every headline count recomputed was exactly right. Accuracy is held down by two misleading displays.

## Critical issues

CR1. The Audit's "Before and after" shows only the first grade's rating for a neighbour placed in several grades,
and marks it "not taught" (pink) even when a later grade teaches it in depth (ELA Grade 8, W.8.7 leads to W.9-10.7
"G9: Not taught" while G10 is in depth). 124 of 305 multi-grade neighbour appearances show a rating that is not the
standard's best; 15 show not taught while another grade teaches it (W.9-10.7, SL.11-12.4, L.11-12.1.c, HSA-CED.A.2,
SS.Hist4.a.m, SS.Inq1.b.h, SS.Hist2.c.h).

CR2. Gaps with a Show band (Grades 3-5) lists findings about grades outside the band: in Social Studies, 19 of 30
lines in "Not taught in the suggested grade, but taught elsewhere" are about K, G1, G2, G6, G8, G9 or G11, beside a
G3-G5 strip that cannot show them.

## Task results (summary)

1. Social Studies 3-5: no confirmed gap; 5 possible gaps (6.5.b, 6.5.c, 3.5.e, 3.5.f, 4.5.e) each waiting for other
band grades; real weakness in Grade 3 power standards; much still unrated (G4 73%). Answer reachable; CR2 inflates
one section.
2. Math 2.OA.B.2 duplication: in depth in G2 and G3; popup shows it builds on 1.OA.C.6b and the next step 3.NBT.A.2 is
not taught in G3; "possible" wording right. HSG-CO.B.8 (duplication) vs HSS-CP.A.1 (reinforcement) differ only by
whether the later grade's plans cite it.
3. Grade 7 ELA Audit: all counts right (9 of 21 priority in depth; EE 13 of 20; 35 of 40 planned taught). Caveat: the
planned card's "40 of 84 rated; 44 unknown" counts 27 standards placed in other grades (true figure 40 of 57).
4. Science weakest: Grade 4 Life Science and depth in K and G1; correct but needs combining pages; "Thinnest" order
reads oddly (45% tile above a 0% tile).
5. Recomputed map, Gaps and Audit findings: all match; priority below in depth agrees across pages.
6. Source labelling mostly clear; weak points: Audit labels part-to-part links "official anchor"; "Same wording" sits
under "automatic checks over the live ratings"; progression messages say "no grade teaches it".

## Other required improvements (ranked)

1. Audit planned card: count only standards the grade rates; list the others apart.
2. Audit link labels: "same anchor (official), part matched by wording (inferred)".
3. Duplication vs reinforcement: base the split on band membership; fix popup text "all grades of its band".
4. "Thinnest teaching" order looks unsorted: show the weak count that drives the ranking, or sort by share.
5. Progression messages: "no grade that rated it teaches it".
6. Audit length (7,867 px desktop, 13,032 px phone); Before/After table on phone hides "Leads to" without a cue; add
"show only weak rows".
7. Gaps: CSV ignores the Grade filter; "Priority / power first" has no visible effect on Gaps lists.
8. Map on phone: tiles show through left of the sticky strand column; strand column takes 170 of 356 px.
9. Tile star hard to see for colour-blind readers; tiles lack aria-label; tooltip mouse-only.
10. Wording and labels: garbled Audit sentence; "1 confirmed gaps"; "Priority / power G3" vs "Power G3"; K-5 Science
tiles labelled "NGSS + AERO"; Audit PNG file name; map vs Gaps percentage units never named.
11. Step-to-step prerequisite flags attach only to the first grade named (LS1.A shows for G6, not G7).

## Strengths to keep

Every count recomputed exactly and agrees across pages; unknown kept apart from problems; findings first with "What to
do" and K-12 strips; drill-down with Back, Escape and filters in the address; the popup's Builds on / Leads to box is the
best vertical view; colour-blind-safe fills; no sideways scroll at 390 px; no errors.

## Round 2 issues (round-2-C.md)

C1 (Gaps 0 progression problems with a grade): resolved (leftover: improvement 11). C2 ("no grade teaches it"):
mostly resolved (confirmed gaps 122 to 95; possible gaps tagged); progression messages still say "no grade teaches it".
Improvements 1 to 5 from round 2: resolved, with the new Audit label issue and the planned card leftover.

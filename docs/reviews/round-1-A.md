# Review A, round 1: Coverage map, Gaps & repetition, Vertical Alignment Audit, standard popup

Independent AI reviewer (did not build the site). Method: review kit (all writes blocked, synthetic ratings), 1440 px and 390 px. No page errors. No page reached the bar of 8 on any criterion.

## Scores

| Page | Usability | Visual hierarchy | Information and accuracy | Vertical progression | Interpretation |
|---|---|---|---|---|---|
| Coverage map | 6 | 6 | 5 | 4 | 5 |
| Gaps & repetition | 5 | 6 | 4 | 5 | 5 |
| Vertical Alignment Audit | 5 | 5 | 3 | 3 | 4 |
| Standard popup (from these pages) | 6 | 5 | 6 | 6 | 5 |

Strengths to keep: the Coverage map tile design (best with one set chosen); on Gaps the separate Unknown card, "Automatic check" tags and the "What to do" line; on the Audit the "In the documents" and "Team says" columns; in the popup the labelled K-12 strip and the progression box with "inferred" labels; tiles and codes are real buttons that work from the keyboard.

## Task results

1. Social Studies gap in Grades 3-5 or missing ratings: partly completed, low to medium confidence, about 11 steps (no Grades 3-5 option). "Thinnest teaching" leads with four Essential Elements strands out of five, not marked as EE. Real gaps: G3 6.5.b (power, in G3 plans) not taught; G5 3.5.f (G5 power) not taught. Missing ratings shown as confirmed gaps: 6.5.c (suggested G3 and G5, only G5 rated it); 3.5.e and 4.5.e (G4 power, only G5 rated).
2. Verify a Math "Possible duplication": not completed. About 6 steps; the card scrolls to a closed section. 2.OA.B.2: G2 and G3 both in depth; G2 power and in G2 plans; G3 plans do not cite it; next step 3.NBT.A.2 not taught in G3; no comments, no plan evidence; cannot see how the G3 expectation differs. Closing the popup collapses the section. The list mixes "taught before its suggested grade" (placement) with "taught again after it" (duplication): 9 of the 15 Math items are the "before" kind.
3. Grade 7 ELA on the Audit: completed in about 6 steps, medium confidence. 19 priority standards rated below in depth (not taught: R.7.1, W.7.2.c, EE.W.7.2.b; introduced: L.7.2.a/b, L.7.5.a/b, L.7.6.a, R.7.2, SL.7.4, W.7.2.a, W.7.3.b, W.7.5 and five EE rows), mixed in one table with 27 "Not rated" rows. 16 of those 27 are Grade 3, 5 and 6 standards Grade 7 is never given to rate. 19 "taught but not in the plans", 17 of them Essential Elements. "88% of planned standards are taught" uses 41 rated of 85 planned; 44 (52%) are unknown.
4. Weakest area in Science K-12: completed in about 12 steps by combining four lists by hand, medium confidence. Life Science: G4 rates 4-LS1-1 and 4-LS1-2 (power) not taught, causing prerequisite breaks at G6 (LS1.A, LS1.D); G7 rates MS-LS2-3 not taught although planned; G11 plans include HS-LS1-4, HS-LS1-5, HS-LS2-7 but rates them not taught. Second: ESS2 at G6. "Thinnest teaching" ranks 2-standard tiles first and misses G11 Life Science (24 standards: 3 not taught, 8 introduced). Life Science is split into AERO, NGSS and EE rows.
5. Confirmed gaps vs unrated: Coverage map workable (but Not rated is white in the legend, grey on tiles, "white, or pale green" in help). Gaps has a clear Unknown card but "Confirmed gaps" overclaims. Audit poor. Popup clear.

## Critical issues

1. "Confirmed gaps: not taught in any grade" overclaims: the rule is "every grade that rated it says not taught". 144 of 145 rest on a single grade's rating; 15 have a suggested or priority grade that has not rated (SS 6.5.c, 3.5.e, 4.5.e; Math M.SP.CP.A.2, M.F.TF.B.5; ELA L.11-12.1.b, W.11-12.2.a). Contradicts the help text. Fix: require every suggested and priority grade to have rated; word the heading as what it shows.
2. The Audit reports missing plan data as findings: when a grade's documents cite nothing, every taught standard is "Taught, but not in the plans" (G3 Math 47, G5 Social Studies 20; G4 Science and Social Studies too). The dashboard guards against this; the Audit does not.
3. The Audit lists priority standards the grade cannot rate as "Not rated" and counts them (G7 ELA: 16 of 27 from Grades 3, 5, 6), inflating "46 not yet taught in depth" and "27 not rated yet".
4. Coverage map findings and the Strand menu do not name the standard set: EE strands appear as "Grade 3 · Economics" with no badge; in Social Studies K-5 four of the top five thinnest tiles are EE.

## Other issues by impact

1. The same bold code for different standards: W.7.1 for Wisconsin W.7.1 and for W.7.2.a; five rows read "L.3.1" (Wisconsin L.3.5.a to e); L.K.1.a vs L.K.1.
2. Gaps sections collapse whenever the page redraws (popup close, the 20-second refresh).
3. The Audit's K-12 grid is not about the chosen grade (first 120 rows are K and G1 for G7); ELA rows each cover one grade so it cannot show repetition despite its caption.
4. Audit lists mix rated and unrated rows; percentages hide the unknown share.
5. "Priority / power only" on K-12 pages counts other grades' priority standards in each tile.
6. Coverage map ranking and the middle card mislead: small tiles first, large weak tiles missed; "7 not taught in the weakest tiles" uninterpretable; introduced-only tiles never flagged.
7. The same domain sits in separate rows (Science AERO K-5 / NGSS 6-12; Social Studies AERO K-5 / WI 6-12); tiles show nothing about plans or priority.
8. The committee can change any grade's rating with one click in the popup strip, no confirmation.
9. Inconsistent filters and navigation: Grade filter does nothing on Gaps; no Grades 3-5 option; "Progression breaks" ignores Strand and Standard set filters; opening a standard from a tile replaces the list with no Back; nothing in the URL.
10. Popup: "I can" levels push evidence down; no reason why the standard was flagged; "Nothing before it: the idea starts here" stated as fact though links are inferred; Gaps evidence strips unlabelled and hidden from screen readers.

Smaller: line styles mean different things on different pages (dashed = EE on the map, in plans on the Audit grid; the dark-green tile border is not in the key); summary card colours inconsistent; white on orange "+n" badges about 2.5:1 contrast; "How Part 2 works" sits above findings, three of six Audit panels are empty placeholders, "Standard" header twice; CSV omits finding categories, PNG differs from the grid on screen; on phones the map's strand names scroll away and Audit tables are cramped; Gaps cards scroll to a closed section.

Evidence: the reviewer's screenshots and scripts were kept with the review session, not in this repo.

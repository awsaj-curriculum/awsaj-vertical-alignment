# Review L, round 6: Progressions, Grade dashboard, popup boxes, "see the links", print

Independent AI reviewer (new; read round-5-J.md only after scoring). Method: review kit (synthetic ratings, writes
blocked), committee view, 1440 x 1000 and 390 x 844; verdicts recomputed in Python from CLAUDE.md's rules and the data.
No page errors, no horizontal scroll at 390. (Saved by the lead session from the reviewer's final message.)

## Scores

| Page | Usability | Visual hierarchy | Information and accuracy | Vertical progression | Interpretation |
|---|---|---|---|---|---|
| Progressions | 7 | 7 | 7 | 8 | 7 |
| Grade dashboard | 8 | 7 | 8 | 7 | 8 |
| Popup: Why flagged and Progressions boxes | 8 | 7 | 7 | 8 | 8 |
| "See the links" dialog | 8 | 7 | 8 | 8 | 7 |
| Print / A4 PDF | 7 | 6 | 7 | 6 | 7 |

## Task results

1. Math fractions: the row shows the build clearly; the problems its standards cause (5.NF.B.3 for 6.RP.A.2, 4.NF.C.6
   for three gaps) show only in other rows and the issue list.
2. ELA Reading 1: the rise is clear; same-wording pairs flagged fairly; G7 Break and G4 moved recomputed correct.
3. Grade 6 ratios: the check correctly reports 1 of 4 missing (split parts counted as one), but "Needs first (6)", the
   chip and a "Not taught where rated" flag on 5.NF.B.7b count parts one by one.
4. Science: 0 breaks; 17 possible gaps on AI links, all causes settled (17 of 17 recomputed).
5. Grade 4 dashboard: every count recomputed exactly; problems reaching other grades named.
6. Recomputation: Math 21/21, Science 17/17, Social Studies 4/4 prerequisite gaps match; ELA 24 of 29, the other 5
   dropped because a break explains them, as the rules say; 11 ELA breaks and 3 moved steps match.
7. Print: all findings with a dated header (Math 5 pages, dashboard 13).

## Critical issues

1. An opened row hides the problems its standards cause in other rows (5.NF.B.3, 4.NF.C.6, 1.NBT.C.6).
2. The Science list is headed "Where progression breaks down" while nothing breaks down.
3. Prerequisite counts in the popup disagree with the check for split standards.
4. Print (and 390 px) hide the progression lines behind the boxes.

## Other required improvements (ranked)

1. Cards count rows, the list counts problems; mark cross-row items or reconcile the counts.
2. Dashboard "progression problems in Grade 4" includes problems caused by Grade 3.
3. Check messages say "Wisconsin R.8.2" where cards show "RI.8.2 · RL.8.2".
4. Dashboard print still cuts lists ("and 3 more", 15 items).
5. Dashboard section headings print apart from their lists.
6. The whole-grade review names an EE strand as the worst strand.
7. Wording: "Within Grade 4: From another progression:"; "It needs 8 standards first: 8 prerequisites".
8. Weak AI links across many grades still drive checks (K-PS3-2 for MS-PS3-3).
9. Phone: progression boxes 19 px wide.

## Round 5 (J) issues

Resolved: split parts, parent link to all parts, chains follow the map, cross-row breaks, ranked review list, codes in
break messages, phone overflow, print date and filters. Partly: card units, wording noise. Not resolved: downstream
problems in the opened row.

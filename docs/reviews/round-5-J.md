# Review J, round 5: Progressions, Grade dashboard, popup boxes, "see the links", print

Independent AI reviewer (new). Method: review kit (synthetic ratings, writes blocked), committee view, 1440 x 1000 and
390 x 844; verdicts recomputed in Python from `site/data/*.json` and the synthetic ratings. No repo files changed; no page
errors. Round-4-H.md was read after testing but before the scores were written. (Saved by the lead session from the
reviewer's final message.)

## Scores

| Page | Usability | Visual hierarchy | Information and accuracy | Vertical progression | Interpretation |
|---|---|---|---|---|---|
| Progressions (cards, issue list, opened row) | 7 | 7 | 6 | 8 | 7 |
| Grade dashboard | 8 | 7 | 8 | 7 | 7 |
| Popup: progression box and Why flagged | 8 | 7 | 7 | 8 | 8 |
| "See the links" dialog | 7 | 7 | 6 | 7 | 7 |
| Print / A4 PDF | 7 | 7 | 8 | 7 | 7 |

## Task results

1. Math fractions: the build from 1.G.A.3 to 6.NS.A.1 is clear; Grade 5 rates 5.NF.B.3, 5.NF.B.4b and 5.NF.B.7b not
   taught; the issue list groups by cause. The opened Fractions row does not show the gaps its standards cause in other
   rows. Medium confidence (two causal links doubtful, C1 and C2).
2. ELA Reading 1: expectation rises K-3, then 8 and 9-12; same-wording pairs flagged honestly; G7 Break and G4 "Taught in
   another grade" recomputed correct. High confidence.
3. Grade 6 ratios: 6.RP.A.2 needs 4.OA.A.2, 5.NF.B.3, 5.NF.B.7, 6.RP.A.1; 5.NF.B.3 not taught and settled (confirmed). The
   link to 5.NF.B.7 reaches only part a, so 5.NF.B.7b (not taught) is missed.
4. Science: 0 breaks; 17 possible prerequisite gaps, all on AI links, all labelled, all causes settled. The card says
   13 (rows) while the list shows 17 (problems).
5. Grade 4 dashboard: counts recomputed exact (Math 30/34, ELA 43/55, Science 13/17, Social Studies 10/15); no ranked
   cross-subject "review first" list.
6. Recomputation: all 27 Math map-based gaps match; 6 rest on one part of a split Coherence Map standard whose sibling part
   is taught in depth (C1).
7. Print: Math PDF 5 A4 pages with all 25 findings; ELA 35 of 35. No date or filter context; "Change team" prints.

## Critical issues

1. Split parts create false official prerequisite gaps: a Coherence Map arrow from a whole standard (5.NF.B.4, 5.MD.C.3)
   is expanded to every part, and one missing prerequisite is enough (7.SP.B.3 flagged because 5.NF.B.4b is not taught
   while 5.NF.B.4a is taught in depth). 6 of 27 Math gaps.
2. A parent link resolves to part a only (M.5.NF.B.7 = stem + part a); 5.NF.B.7b and c are ignored.
3. The chain dialog follows a wording link over an official one (4.NF.B.3b to 5.NF.B.7b by wording, while the Coherence
   Map links 4.NF.B.3b to 5.NF.A.1, taught in depth).
4. "Breaks down" on a row can come from a prerequisite in another row, with no visible break in the row, and fires when 1
   of 6 to 9 prerequisites is missing.

## Other required improvements (ranked)

1. Card units: cards count rows, lists count problems; say "progressions with ...".
2. Opened row: show the gaps a not-taught standard causes downstream.
3. Wording noise remains ("shared: people, person, there, many").
4. Dashboard: a short ranked "Review first" list across subjects.
5. Break messages should name the standard codes.
6. Phone: ELA rows overflow (432 px at 390); grade header not sticky.
7. Print: add a "ratings as of" date and the active filters; hide header buttons.
8. Polish: stray "." after "Taught at every step:"; an EE "Not applicable. See ..." in a popup; odd card subtitle.

## Round 4 (H) issues

Resolved: breaks on unsettled steps, source labels, impact statements, root-cause grouping and clickable codes, issue
list filtering, unrated prerequisites on the chip. Partly: wording noise, matched-view sources (C3), what rises (dialog
only). Phone lines not re-verified.

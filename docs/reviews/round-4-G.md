# Review G, round 4: Coverage map, Gaps & repetition, Vertical Alignment Audit, standard popup

Independent AI reviewer (new; scores written before reading round-3-E.md and not changed afterwards). Method: review kit
(synthetic ratings, writes blocked), committee view, Chromium at 1440 x 1000 and 390 x 844; an independent Python model
of the site's rules recomputing findings from `site/data` and the synthetic ratings; Coherence Map links checked against
the downloaded source. No repo files changed; no page errors. (Saved by the lead session from the reviewer's final
message.)

## Scores

| Page | Usability | Visual hierarchy | Information and accuracy | Vertical progression | Interpretation |
|---|---|---|---|---|---|
| Coverage map (By strand, Matched across grades, band buttons) | 7 | 7 | 6 | 6 | 6 |
| Gaps & repetition | 7 | 7 | 5 | 7 | 7 |
| Vertical Alignment Audit (grade chosen, incl. Before and after) | 6 | 6 | 5 | 7 | 6 |
| Standard popup (incl. "What it needs first, and what it leads to") | 7 | 7 | 5 | 7 | 6 |

Every headline count recomputed was exactly right. Accuracy is held down by verdicts and labels that can lead to a wrong
curriculum conclusion (the two critical issues), plus Essential Elements mixed into the main counts.

## Task results

1. **Social Studies Grades 3-5: real gap or missing ratings?** (high confidence on counts, medium on the reading) No
   confirmed gap; 5 possible gaps (6.5.b, 6.5.c, 3.5.e, 3.5.f, 4.5.e), each waiting for a grade or not asked. The real,
   rated weakness is power standards: 7 rated below in depth (Grade 3: 2.5.a, 3.5.b, 4.5.c, 7.5.a introduced, 6.5.b not
   taught though in the plans; Grade 4: 6.5.f; Grade 5: 3.5.f). 8 power standards not rated, 10 unknown, Grade 4 only
   73% rated. In the way: "Thinnest teaching" leads with 4 Essential Elements tiles (11 of 16 "not taught" placements
   are EE); the K-12 Gaps page lists Breaks for Econ4.c (Grade 3) and Geog2.a (Grade 5) on unsettled standards while the
   3-5 view shows 0; the 6.5.b popup shows both "Break" and "Possible gap" (C1).
2. **Math 6.RP.A.3** (high confidence) Needs first: 5.G.A.2 (Grade 5 introduced), 6.RP.A.1 and 6.RP.A.2 (same grade, in
   depth). Leads to: 7.RP.A.3, 7.RP.A.2, HSN-Q.A.1. Coherence Map links faithful to the source. Friction: the matched
   row starts at 6.RP.A.3 so the map alone cannot answer "needs first"; the popup's "Progressions it belongs to" gives a
   second, different "Leads to" (wording based).
3. **Grade 7 ELA on the Audit** (high confidence) All counts right. Weakest: R.7.1 and W.7.2.c not taught while Grades
   6 and 8 teach the neighbours in depth (a real hole). Problems: "Documents cite 84 standards" includes 19 EE that only
   inherit the mark; the 40 rated planned standards include 15 EE; EE.W.7.2.b listed under "In the plans, but marked not
   taught"; several "official" links pair the wrong sub-parts (C2).
4. **Science K-12: where is teaching weakest?** (medium confidence) Numbers correct, but the answer needs the tile list
   and the footer combined (early elementary plus Grade 11 Life Science). Gaps page: 8 confirmed, 18 progression
   problems (17 possible prerequisite gaps on AI links); the only Break (LS2.B, Grade 7) is not settled. Every thinnest
   line carries "NGSS AERO" badges even for single-set tiles.
5. **Recomputed findings** All matched (map counts and thinnest scores for Science, Social Studies 3-5 and Math; Gaps
   cards for all four subjects; a confirmed gap K.CC.A.3; the Grade 7 ELA Audit; the prerequisite 5.NF.B.3 -> 6.RP.A.2).
   14 breaks recomputed; 3 rest on grades that are waiting or were not asked (C1).
6. **Are sources clear?** AI links carry "Suggested, check" and a reason everywhere; prerequisite gaps on AI links say
   "Possible"; wording links say "Closest wording (inferred)"; every finding section is tagged "Automatic check". Not
   clear: "Same anchor standard (official)" put on sub-part pairs chosen by wording (C2); "Break" reads as settled
   (C1); the Matched grid does not show which chains are AI or wording based, and Social Studies headers say "Official
   Wisconsin standard" above AI links; help p_ba and hm_rows describe only "official anchor or wording".

## Critical issues

**C1. The "Break" verdict treats grades that were not asked, or have not rated yet, as settled**, contradicting the same
standard's "Possible gap". `laneInfo()` decides a break with `taughtIn()` only. 3 of 14 breaks affected: Social Studies
Econ4.c (6.5.b, Grades 4 and 5 not asked), Geog2.a (3.5.e waiting for Grade 4, 3.5.f not asked of Grades 3 and 4),
Science LS2.B (MS-LS2-3, Grades 6 and 8 not asked). Counted in "progression problems" and shown as high-severity Break in
popups ("Break ... no grade that rated it teaches it" then "Possible gap ... Not settled yet").

**C2. "Same anchor standard (official)" / "Same skill, earlier" attached to wrongly paired sub-parts.**
`build_prereqs.py` takes each standard's highest-similarity link in the anchor lane; all sub-parts of L.x.1, L.x.2, L.x.6
and SL.x.1 tie at similarity 1.0, so sub-part "a" wins. 12 links point at a sub-part with almost no shared wording while
a sibling matches word for word (L.7.1.b -> L.6.1.a, yet L.6.1.b is identical and shown as "Suggested, check"; L.7.1.c ->
L.6.1.a while L.6.1.d reads the same; also L.7.2.b, L.7.6.b, SL.7.1.b, SL.7.1.d, L.6.1.c, SL.6.1.b, L.8.1.b, L.8.2.b,
L.8.6.c, SL.8.1.b). 42 of 505 anchor links fall below the site's own 0.12 threshold. They appear in the Audit's Before and
after and the popup, and feed the official prerequisite-gap check.

## Other required improvements (ranked)

1. Count Essential Elements apart on the Coverage map and Gaps page, as the Audit already does (Social Studies 3-5: 11 of
   16 "not taught" placements and 4 of 5 thinnest tiles are EE; K-12 all three "Strongest" tiles are EE; Math priority
   card "362 named" includes 136 EE; EE are 14 of 35 Math and 26 of 51 ELA confirmed gaps).
2. Show the grade on every neighbour rating pill (popup Needs first / Leads to, Audit Before and after): AERO codes read
   like grades (6.2.i is Grade 2) and high school NGSS gives no grade.
3. Audit: stop counting inherited plan marks on Essential Elements ("documents cite N", the planned card, "In the plans,
   but marked not taught").
4. Direction-aware link types: "Leads to" prints "same skill, earlier" beside later standards. List official links
   before AI links.
5. One consistent "Leads to" per standard (prerequisite box and Progressions box disagree for 6.RP.A.3).
6. Matched across grades: rows heavily duplicated (120 rows, 60 distinct starts); in a band view a row is labelled
   with a code from another grade.
7. Thinnest teaching: order follows a hidden score; Science lines show "NGSS AERO" for single-set tiles; no next step.
8. Audit Before and after: no "weak rows only" view (47 rows in Grade 7 ELA); priority findings do not link to their
   row; phone clips the rating pills.
9. Stale help and labels: hm_rows, hm_thin, p_ba; the PNG button title says "Audit grid" on the map; image heading.
10. Browser Back: the first change after opening a link replaces the history entry.
11. Duplication vs reinforcement still splits on placement, not band (HSG-CO.B.8).
12. Minor: "1 of them are placed"; "All sets (AERO, WI, EE)" in K-5 where WI is hidden; orange corner on lime weak for
    red-green colour blindness.

## Strengths to keep

Counts exact and consistent across map, Gaps and Audit; unknown kept apart with "waiting for G4" / "not asked" tags; the
popup is a strong vertical view (K-12 strip, severity-coloured checks, Needs first / Leads to with type, source and AI
reason; Coherence Map links faithful); Before and after shows every grade's rating and pinks only settled neighbours;
filters live in the address, popup Back stack, renders under 150 ms, no sideways scroll at 390 px; rating colours stay
distinguishable under simulated colour blindness.

## Round 3 issues (round-3-E.md)

| Round 3 issue | Status |
|---|---|
| CR1: Before and after shows only the first grade's rating, pinks wrongly | Resolved |
| CR2: a 3-5 Gaps view lists grades outside the band | Resolved |
| Improvement 1: Audit planned card | Resolved, leftover: inherited EE still counted |
| Improvement 2: anchor links labelled official though sub-part matched by wording | Not resolved (C2) |
| Improvement 3: duplication vs reinforcement by band | Partly |
| Improvement 4: thinnest order looks unsorted | Partly |
| Improvement 5: "no grade teaches it" | Resolved as wording; break verdict still ignores unasked grades (C1) |

# Review B, round 1: Progressions, Grade dashboard, standard popup (progression box)

Independent AI reviewer (did not build the site). Method: review kit (writes blocked, synthetic ratings), committee view, 1440 x 1000 and 390 x 844; the reviewer also re-ran the site's progression checks over the data in a script (lanes.py) to count problems. No page errors. None of the three pages passes. Layout and the trail to evidence are good; the automatic verdicts are often wrong or overstated.

## Scores

| Page | Usability | Visual hierarchy | Information and accuracy | Vertical progression | Interpretation |
|---|---|---|---|---|---|
| Progressions | 6 | 6 | 3 | 4 | 5 |
| Grade dashboard | 6 | 7 | 4 | 3 | 6 |
| Popup progression box | 6 | 6 | 4 | 5 | 4 |

## Task results

1a. Fractions K-8: completed, medium confidence, 4 steps. G1 to G6, in depth mainly G3 to G5; G5 has 3 not taught. No pointer to "The number system"; the 6.NS.A.1 popup wrongly says "the idea ends here"; links with 0.0 similarity still drawn; 6.NS.A.1 "builds on" 5.NF.B.6 rather than 5.NF.B.7.
1b. ELA Reading 1 K-12: completed, high confidence. Row name is the Grade 4 wording; R.4.1 = R.5.1 and R.6.1 = R.7.1 word for word, not said; G9-10 step "1 in depth, 1 introduced" but the line shows only Introduced.
2. Grade 6 ratios before Grade 7: partly answered, medium confidence. Row labelled "Builds steadily" although 6.RP.A.3 is unrated and 8.EE.B.6 not taught; the popup shows one prerequisite and hides 6.RP.A.1 and A.2; no weak-match note in the popup; Grade 8's in-depth rating of 7.RP.A.2 not reflected.
3. Science breaks: clicking a flag in "Where progression breaks down" does nothing visible (row opens about 2,300 px below, no scroll). ESS2.C flagged with 1 of 3 rated, ESS2.D 1 of 2. LS2.B flag supported, but MS placement is a site suggestion while the detail says "the standards themselves skip" Grades 8-10; the MS-LS2-3 popup does not show the flag.
4. Grade 4 review across subjects: completed, medium confidence, about 12 steps. No single cross-subject list; Social Studies card 29 of 40 rated vs panel 10 of 15; Essential Element copies double power counts and "Not Applicable" EE rows appear for review; Grade 4 is not told its "not taught" ratings cause Grade 6 prerequisite gaps; browser Back leaves the site.
5. Labels: basis and automatic checks labelled; but status chips not tagged automatic; "Official" on Science and Social Studies rows joined through suggested matches; the popup drops the weak-match note. Repetition shown as healthy: 138 ELA links join identical text; Speaking and Listening 1 and Language 1 promoted as building steadily; "Repeated in depth" only catches band standards.
390 px: no horizontal scroll; Progressions boxes shrink to about 28 px; filters take about 370 px before content.

## Critical issues

1. "Builds steadily" is wrong: edge steps never checked; a step counts as taught if any one standard is; 54 of 84 such rows have unrated standards and 45 not-taught ones; one-grade rows labelled too, and promoted at the top.
2. Flags raised from partly unrated steps, some naming the wrong grade (The number system G7, 1 of 3 rated; Science ESS2.C, ESS2.D; Social Studies PS3.a "Breaks in Grade 3" when Grade 3 never rated; PS1.b "Breaks in Grade 6"); the dashboard copies them onto the wrong grade.
3. Repetition shown as progression: nothing compares wording or complexity; 138 identical-text links.
4. Dashboard counts: card and panel disagree; EE copies inflate power counts; "Not Applicable" EE rows rateable and listed.
5. Popup overstates links: 0.0 links shown as "Builds on"; "Next step" lists the first four standards of the next grade whether related or not; "the idea ends/starts here" wrong for 6.NS.A.1 and 6.RP.A.3.
6. Breaks ignore teaching in other grades (R.4.1 taught in G5, W.4.5 in depth in G3, SL.4.5 in G5); Science middle school placements are site suggestions but described as gaps in the standards.
7. Clicking a flag in "Where progression breaks down" does not scroll to it.

## Other required improvements (ranked)

1. Prerequisite checks between linked standards; hide links below a similarity threshold; allow several prerequisites; use the Common Core progressions for Math links.
2. Put a prerequisite gap on both grades; show it on the causing grade's dashboard.
3. Judge steps per standard; partial gaps; only call a step broken when all its standards are rated.
4. Make Progressions filters work or hide them (Grade, Strand, Standards, Order ignored; highlight the chosen grade; Standard set should hide steps; fix the EE empty state).
5. Cross-row continuation (Fractions continues in The number system).
6. Visual weight: tint each box by state; draw long jumps across empty grades as a neutral connector.
7. Multi-grade standards in the detail (rating pill shows one grade; "2 not rated" counts grade slots; SL.K.1.a to d all show "SL.K.1").
8. Dashboard: one cross-subject review list; tag every item automatic and rank by consequence; list unrated priority standards; "No plan data yet" instead of 0/0; hedge "plans may need updating" until Part 2; show grades before and after; separate CC from EE counts.
9. Popup box: neighbour text, flags involving this standard, back link, ratings for every grade, move higher.
10. Exports on Progressions export the standards grid, not the rows and flags.
11. Labels: tag status chips automatic; "joined by suggested matches" on the row; ELA anchor links are official, so "inferred" undercuts trust; one name for band reinforcement.
12. Help: "Group" select has no "?"; strand bars help says "Click a strand name to rate that strand".
13. Navigation: Back leaves the site; add "Back to Grade 4 dashboard".

Evidence: the reviewer's screenshots and scripts (including lanes.py) were kept with the review session, not in this repo.

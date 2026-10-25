# Review H, round 4: Progressions, Grade dashboard, standard popup and "see the links" dialog

Independent AI reviewer (new; had not seen earlier rounds before scoring). Method: review kit (synthetic ratings, writes
blocked), committee view, 1440 x 1000 and 390 x 844; independent Python recomputation of verdicts from the raw data
(including the Coherence Map source). No repo files changed; no page errors. (Saved by the lead session from the
reviewer's final message.)

## Scores

| Page | Usability | Visual hierarchy | Information and accuracy | Vertical progression | Interpretation |
|---|---|---|---|---|---|
| Progressions (list and opened row) | 6 | 6 | 5 | 6 | 5 |
| Grade dashboard | 6 | 7 | 6 | 7 | 6 |
| Standard popup and "see the links" dialog | 7 | 6 | 5 | 7 | 6 |

Every recomputed count was right except one. Held down by verdicts that break the site's own "settled" rule, wrong or
missing source labels, incomplete impact statements, and noisy wording matches shown as "Builds on".

## Critical issues

1. "Break" asserted on steps the site itself calls unsettled (MS-LS2-3 popup shows Break and "Possible gap: not
settled" together; AERO 3.5.e Break while Grade 4 still to rate). Every Science and Social Studies "Breaks down" row
(LS2.B, Econ4.c, Geog2.a) rests on an unsettled step.
2. Source labels wrong or missing: the possible-prerequisite card says "inferred from wording" for AI-suggested links;
opened-row "Needs first" lines carry no source; AI-written reasons shown beside "Same anchor standard (official)"; the
Math row header says links are inferred from wording while most come from the Coherence Map; Science groups in
"Matched across grades" are headed "Official core idea" although the links are AI-suggested.
3. Impact statements wrong or incomplete: Grade 4 Science "4 standards rated not taught here" includes a Grade 1
standard (should be 3; grades listed unsorted); a root-cause standard's "Why flagged" lists only checks from its own
rows (5.NF.B.3 shows nothing of the Grade 6 gap it causes); gaps inside one grade are drawn between grades and make the
row "Breaks down" (5 of 15 Math rows rest only on same-grade gaps).

## Task results (summary)

1. Math fractions: start, build and continue clear; 5.NF.B.3 needs-first and leads-to match the Coherence Map exactly;
the "Progressions it belongs to" box gives a conflicting wording-based "Builds on" with noise words.
2. ELA Reading 1: honest same-wording notes, but what rises is not highlighted and Common Core text is not shown though
the note says to compare; AI reasons shown under official anchor tags.
3. Grade 6 ratios: cross-row prerequisite gap (6.RP.A.2 needs 5.NF.B.3) flagged everywhere; unrated prerequisites not
counted on the chip; 5.NF.B.3's own popup silent about the gap it causes.
4. Science: LS2.B break overclaimed (band grades not asked); 2-PS1-3 possible gap correctly hedged but the card calls
it "inferred from wording"; one weak AI link drives 3 of 13 possible gaps.
5. Grade 4 dashboard: problems reaching other grades first and named; Math and ELA counts right; Science count wrong
(includes a Grade 1 standard); no grouping by root cause; codes in messages not clickable.
6. Recomputed: row statuses, flags, Reading 1, Taught at every step, Grade 4 Math and ELA all match; Grade 4 Science
off by one; 3 of 14 breaks on unsettled steps; 5 of 15 Math Breaks down rows rest only on same-grade gaps; Matched
across grades links: Math 76 of 256 wording-only, Science 177 of 181 AI.

## Other required improvements (ranked)

1. Cut wording-match noise (stopwords such as example, understand, does, your; hide wording links where the map has a
link; fix "No close match by wording" followed by shared words).
2. Group by root cause on the dashboard and Progressions list; make codes in messages clickable.
3. Progressions issue list: show all, let the Grade filter narrow it, no repeats.
4. Show how the expectation rises: highlight new words; show Common Core text where the page says to compare.
5. Popup Needs first: show the grade for band-coded standards; count unrated prerequisites on the chip.
6. Phone: lines hidden behind boxes; dashed magenta has two meanings; help says solid where the line is dashed.
7. Matched across grades: mark each row's link source; repeated prefixes (K.NBT.A.1 seven times); 256 Math rows.
8. Polish: strand bar "1/3" unlabelled; "PS4.C Information Technologies and" cut; AERO Social Studies codes read like
grade codes; stale hm_rows help.

## Strengths to keep

Faithful arithmetic and Coherence Map data; settled, hedged prerequisite gaps; cross-row checks work; honest
same-wording notes; clean Needs first / Leads to box; dashboard puts cross-grade problems first; the ELA "see the
links" dialog reads well; address state, sticky header, no sideways scroll, no errors.

## Round 3 issues (round-3-F.md)

C1 false Geog2.b message: resolved. C2 breaks on unsettled standards: partly (breaks still unsettled; 3.5.e now on the
Grade 4 dashboard). C3 suggested link promoted to official: resolved as described (related labelling issue remains).
Improvements: repeated vs early resolved; root-cause grouping not resolved; colour-only lines partly; filter notice
resolved (Grade filter does not narrow the issue list); cross-row checks resolved, start/stop checks not.

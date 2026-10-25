# Review D, round 2: Progressions, Grade dashboard, popup progression and checks boxes

Independent AI reviewer (did not build the site; new reviewer, not the round 1 reviewer). Method: review kit
(synthetic ratings, writes blocked), committee view, 1440 x 1000 and 390 x 844; scripts recomputing every Progressions
verdict from progressions.json, the index files and the synthetic ratings (recompute.py, prereq_links.py,
dash_check.py, showlane.py, outputs out_*.txt). Nothing in the repo was edited. (Saved by the lead session: the
reviewer's environment refused file writes, so it returned this report as text.)

## Scores

| Page | Usability | Visual hierarchy | Information and accuracy | Vertical progression | Interpretation |
|---|---|---|---|---|---|
| Progressions (list and opened row) | 7 | 6 | 5 | 7 | 6 |
| Grade dashboard | 6 | 6 | 5 | 6 | 6 |
| Popup: progression and "Why flagged" boxes | 7 | 6 | 5 | 6 | 6 |

Every headline count recomputed matches the page exactly (Progressions totals for all four subjects, the 13 "Builds
steadily" rows, the LS2.B Grade 7 break, the Grade 4 dashboard cards). The problems are in what verdicts claim.

## Critical issues

C1. Every "Prerequisite gap" rests on an inferred word-overlap link but is stated as fact ("which it builds on", no
"inferred" on lists or dashboard). Math links are weak (0.14 to 0.39), and one link turns a row into "Breaks down".
Some are wrong: Probability is flagged although the real prerequisite 7.SP.C.8 is taught in depth in Grade 7;
Equations is flagged although stronger links into 7.EE.B.4 (6.EE.B.7, 6.EE.B.8) are taught; The number system is
flagged from a partly rated step whose stronger link (7.NS.A.2) is not rated. 5 of 8 Math flags fire from partly rated
steps, contradicting "Only fully rated steps are checked".

C2. "Same wording" is printed against Common Core codes but is only true of the Wisconsin 2020 text: "RI.7.1 · RL.7.1
has the same wording as RI.6.1 · RL.6.1" is false in Common Core (RL.7.1 adds "several pieces" of evidence).

C3. Grades that rate a standard because their plans cite it are left out of the progression rows: LS1.A says "No
standard for this idea is placed in Grade 7 ... 10" and shows an empty Grade 7 column, yet Grade 7 rates MS-LS1-1, 2
and 3 in depth (50 ratings hidden across 12 rows in the synthetic data).

C4. Dashboard "What to review" counts mix Essential Elements with the main set and contradict the tiles: Grade 4 Math
"11 power standards below in depth" (Common Core 5), "4 not rated" (1); ELA 13 (7). The Social Studies "Political
Science: 2 of 3 rated not taught" is an EE strand with its badge removed. Grade 7 Science says "2 standards leave a
prerequisite gap" but it is one standard (MS-LS2-3), which also fills three more of the seven review items.

## Task results

1. Math fractions (about 6 minutes, high confidence for structure, medium for links): G1 to G6 (1.G.A.3, 2.G.A.3,
3.G.A.2 and 3.NF, 4.NF, 5.NF, 6.NS.A.1), "continues in" Ratios and The number system. 7 of 8 Grade 3 standards say
"No close match in the step before". Decimals is a separate row Fractions never mentions. Grade 5 has 3 not taught.
2. ELA Reading 1 (about 5 minutes, high confidence): each step "same anchor standard, official"; G5 = G4 and G7 = G6
flagged as same wording with a fair Reading caveat, but against Common Core codes (C2). "Breaks in Grade 7" correct,
also listed again as a prerequisite gap for R.8.1.
3. Grade 6 ratios (about 8 minutes, low confidence): "Grows out of: Fractions", but the 6.RP.A.1 popup says "No earlier
step". Prerequisite checks never cross rows (5.NF.B.3 not taught had to be found by hand). 7.RP.A.1 and A.2 build on
6.RP.A.3, which is not rated; the page correctly calls this "Partly rated".
4. Science breaks (about 12 minutes, high confidence): LS2.B Grade 7 correct (and repeated as two prerequisite lines);
ESS1.B correct; ESS2.D not robust (half-rated G6 step, link 0.15); LS1.A hides Grade 7's teaching (C3).
5. Grade 4 dashboard (about 6 minutes, medium confidence): lists problems reaching other grades first; the later grade
is named only inside the subject; inferred links stated as fact (C1); counts inflated by EE (C4).
6. Recomputed: Progressions totals, Builds steadily rows, LS2.B, ESS1.B, G4 Math cards right; Probability prerequisite
gap wrong conclusion; Equations overclaim; Number system unknown shown as a gap; G4 Math review counts wrong set; G7
Science "2 standards" wrong count.

## Other required improvements (ranked)

1. Group findings by root cause (one not-taught standard becomes a Break, several prerequisite lines, a priority line
and a plans line); use one unit ("7 progressions break down" vs "8 progression problems").
2. Popup: show Break and "Taught in another grade" for the standards behind them; at the start of a row show the
"grows out of" row and its last step.
3. Check prerequisites across rows (Ratios needs Grade 5 fractions; Probability needs Data and statistics).
4. Split band reinforcement from duplication in "repeat in depth" (Social Studies 30 of 33 are 6-8 band reinforcement).
5. Rename or tighten "Builds steadily" (LS2.D is only G3 then G11; ESS3.C ends on introduced only).
6. Sort Breaks (official structure) above inferred prerequisite gaps.
7. Styling bugs: heavy black dashed outline on not-rated steps (class collision st-unrated); popup strip scrolls over
the sticky header; dashboard review-list grid broken; 6 px strand bars on phone.
8. Make row lines readable; show a prerequisite gap on the row's line.
9. Highlight what changes in wording from grade to grade.
10. ELA code confusion: "Language 5" row lists L.1.1 and L.K.1; "Language 1" lists L.4.3; a Grade 2 code shown as
"R.2.7 · R.3.7 · RI.2.7 +1"; row names cut at 70 characters.
11. Accessibility: row boxes not focusable or named; muted small text about 4.3:1 on white, 3.6:1 on an opened row;
active tab scrolls out of view on phone.
12. State: keep the status chip in the address; Back should close a row; fix the review-item open state.
13. Wording: "Grade 6 and Grade 7 and Grade 8 teaches"; magenta text for Same wording notes; "most room to grow" hides ties.

## Strengths to keep

Every verdict labelled automatic with the unknown share shown; every count matches its rule. Each row says how it was
built; links say official or inferred; weak matches hidden; "No close match" instead of invented links. "Taught in
another grade" and the Reading caveat are careful. K-12 rows, sticky grade header, grows out of / continues in links
and the dashboard round trip make the vertical story easy to follow. Most-consequential-first dashboard order is right.
Popup before/after columns with ratings in every grade are useful. No horizontal scroll on phone.

## Round 1 critical issues (round-1-B.md)

1. Builds steadily wrong: resolved for correctness (label still overclaims).
2. Flags from partly rated steps: partly resolved (Breaks need full steps; link-level prerequisite gaps still fire
from partly rated steps).
3. Repetition shown as progression: partly resolved (Same wording exists; C2 is new).
4. Dashboard counts disagreed: partly resolved (card and panel agree; review lists still count EE copies).
5. Popup overstated links: partly resolved (weak links hidden; start of row still "No earlier step"; weak links still
drive verdicts).
6. Breaks ignored teaching in other grades: partly resolved (C3 is new).
7. Clicking a flag did not scroll: resolved.

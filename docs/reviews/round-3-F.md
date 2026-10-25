# Review F, round 3: Progressions, Grade dashboard, popup progression and "Why flagged" boxes

Independent AI reviewer (new; did not build the site and had not seen earlier rounds before scoring). Method: review kit
(synthetic ratings, writes blocked), committee view, 1440 x 1000 and 390 x 844; independent Python scripts recomputing
every progression verdict and the Grade 4 dashboard counts. No repo files changed. (Saved by the lead session from the
reviewer's final message.)

## Scores

| Page | Usability | Visual hierarchy | Information and accuracy | Vertical progression | Interpretation |
|---|---|---|---|---|---|
| Progressions (list and opened row) | 7 | 6 | 5 | 7 | 6 |
| Grade dashboard | 7 | 7 | 6 | 7 | 6 |
| Popup progression and "Why flagged" boxes | 7 | 7 | 5 | 7 | 6 |

Arithmetic right everywhere checked (row statuses in all four subjects, breaks, prerequisite lists, "Taught at every
step", Grade 4 dashboard counts). Accuracy is held down by verdict wording that claims more than the data shows.

## Critical issues

1. A progression verdict states something false: Social Studies Geog2.b "Grade 6, Grade 7 and Grade 8 teach this idea in
depth" while the row shows G6 in depth, G7 not rated, G8 introduced (the step-level message names every grade in the step).
2. "Breaks down" and "no grade teaches it" are stated for standards the site itself calls not settled: the progression
check ignores band grades never asked and owner grades still to rate (every Social Studies "Breaks down" row, Science
LS2.B, ESS1.B and ELA L1 possible gaps). Worst case: AERO 3.5.e, a Grade 4 power standard Grade 4 has not rated, is blamed
on Grade 5 and never shown on the Grade 4 dashboard.
3. A suggested match is promoted to an "official" prerequisite: Geog2.b's step-level gap rests on AERO 3.5.e joined only by a
suggested match; Science LS1.A and LS1.D step-level gaps are labelled official while each link is inferred.

## Task results (summary)

1. Math fractions: start G1, build G2 to G6, continues in Ratios and The number system; row partly rated so no check;
Decimals is a separate row; 3.NF.A.3d flagged "Repeated in depth" while its popup says "Taught early".
2. ELA Reading 1: one standard per grade, official links, honest same-wording notes; Common Core text not shown; text cut
at 160 characters hides what rises in 9-10 and 11-12. "Breaks in Grade 7" and "Taught in another grade" (G4) correct.
3. Grade 6 ratios: grows out of Fractions; 5.NF.B.3 (needed for unit rate) not taught but not flagged (no cross-row checks).
4. Science: LS1.D correct for the data; LS2.B overclaimed (band grades not asked); ESS1.B similar.
5. Grade 4 dashboard: problems that reach other grades come first; counts right; 3.5.e (a Grade 4 power standard placed in
G5) missing; a mixed official / possible headline not hedged.
6. Recomputed: row statuses, breaks, prerequisite lists, "Taught at every step" and dashboard counts right; Geog2.b message
wrong; 6 of 24 verdicts rest on unsettled standards; 15 of 29 "Repeated in depth" standards are taught early, not repeated.

## Other required improvements (ranked)

1. "Repeated in depth" mixes early teaching with duplication.
2. One rating becomes many lines (group by root cause).
3. Colour-only line signals (magenta vs grey for deuteranopes; two grey dotted lines; dashed magenta with two meanings).
4. The Show filter silently changes verdicts: say checks use only the grades and standards shown, or keep K-12 checks.
5. No start or stop checks; no prerequisite checks across rows.
6. Text cut at 160 characters hides how the expectation rises.
7. Dashboard: hedge mixed headlines; list priority standards placed in another grade on the naming grade's dashboard;
"taught here" tile counts an Essential Element; cross-subject list is a dense paragraph.
8. Wording and codes: row names cut mid-phrase; one Wisconsin standard with several Common Core codes reads as several;
"Taught in depth in Grade 2, Grade 3, before its suggested grade (Grade 3)"; popup "Unknown" hides "Priority not rated";
no official / inferred tag and no "What to do" on the Progressions list.
9. Layout: popup "Grows out of" link wraps; Group select overflows on phone.

## Strengths to keep

Accurate arithmetic; unknown never counted as a gap; honest basis labels and "No close match"; strong vertical story
(K-12 rows, sticky header, grows out of / continues in, plan-added grades shown); solid navigation; dashboard structure.

## Round 2 issues (round-2-D.md)

C1 (weak inferred links stated as fact): partly resolved (step-level gaps still called official). C2 (same wording vs
Common Core codes): resolved. C3 (plan-added grades hidden): resolved. C4 (dashboard counts mixing EE): partly resolved.
Improvements: popup flags and grows out of resolved; band reinforcement split resolved; rename resolved; root-cause grouping
partly; cross-row prerequisites not resolved.

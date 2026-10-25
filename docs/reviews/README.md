# Independent reviews of the analysis pages

Tim asked for every K-12 analysis page (Coverage map, Gaps & repetition, Grade dashboard, Progressions, Vertical
Alignment Audit and the standard popup) to reach **at least 8/10 on every criterion**, with no unresolved critical
usability or interpretation issue, judged by a reviewer who did not design or build the pages, and for the scores,
task results, evidence and required improvements to be written down. This folder is that record.

**These are AI reviews, not human approval.** Each reviewer is a separate Claude agent that was not involved in
building the pages and is given only the working site, a testing kit and the criteria. Each round uses new reviewers,
so no reviewer checks its own earlier advice. The committee should still try the pages itself.

## How a round works

- The reviewer opens the local copy of the site through a kit that **blocks every database write** and serves a
  **synthetic set of ratings** (about 2,500 made-up ratings across all grades and subjects), so the pages have realistic
  data and no real teacher's answers are shown or changed.
- It works through realistic committee tasks: trace a skill across grades, investigate a suspected gap, check that
  prerequisites are taught, verify a flagged duplication, review one grade across subjects, and say whether each
  verdict is labelled as automatic or official.
- It scores each page from 1 to 10 on five criteria: **Usability**, **Visual hierarchy and impact**, **Information
  design and accuracy**, **Vertical progression and connections**, **Interpretation and practical value**. It checks
  desktop (1440 px) and phone (390 px) widths.
- It lists critical issues and other required improvements, with evidence.

## Round 1 (none passed)

| Page | Usability | Visual | Information | Progression | Interpretation | Report |
|---|---|---|---|---|---|---|
| Coverage map | 6 | 6 | 5 | 4 | 5 | [A](round-1-A.md) |
| Gaps & repetition | 5 | 6 | 4 | 5 | 5 | [A](round-1-A.md) |
| Vertical Alignment Audit | 5 | 5 | 3 | 3 | 4 | [A](round-1-A.md) |
| Standard popup (from those pages) | 6 | 5 | 6 | 6 | 5 | [A](round-1-A.md) |
| Progressions | 6 | 6 | 3 | 4 | 5 | [B](round-1-B.md) |
| Grade dashboard | 6 | 7 | 4 | 3 | 6 | [B](round-1-B.md) |
| Popup progression box | 6 | 6 | 4 | 5 | 4 | [B](round-1-B.md) |

### What changed after round 1

Critical issues (all addressed):

1. **"Confirmed gaps" overclaimed.** A gap is now confirmed only when every grade that should teach the standard (its
   suggested grades, and any grade that names it a priority or power standard and can rate it) has rated it and all
   say not taught. Otherwise it is a **possible gap, waiting for** the named grades.
2. **The Audit read missing plan data as findings.** When a grade's documents cite nothing for a subject, the Audit and
   dashboard say **No plan data yet** and skip "taught but not in the plans". That finding also leaves out Essential
   Elements (plans cite the main standard's code) and is worded as a question for Part 2.
3. **The Audit counted standards the grade cannot rate.** Priority standards placed in another grade are listed apart;
   rated and unrated rows are separate; every percentage shows how many are rated and how many are unknown.
4. **Standard sets were not named.** Map findings, rows, the tile popup and the Strand menu name their sets; Essential
   Elements have their own rows at the end and are counted apart on the dashboard.
5. **"Builds steadily" was wrong.** It now needs two or more grades with every standard rated and taught in its grade.
6. **Progression flags came from partly rated steps.** A step is only called broken when every standard in it is rated
   not taught **and no grade teaches them**; if another grade teaches them the page says so instead. Prerequisite gaps
   are checked standard by standard along close links, and shown on both grades' dashboards.
7. **Repetition looked like progression.** Standards with the same wording as the one before are marked "Same wording".
8. **Dashboard counts disagreed.** The subject card and the panel use the same standard sets; Essential Elements are
   counted on their own line; "Not applicable" Essential Elements are no longer offered for rating.
9. **The popup overstated links.** Weak word matches are never shown as "Builds on"; when there is no close match the
   popup shows the neighbouring step and says so ("and N more"); "the idea starts/ends here" became "no earlier/later
   step in this progression on this site".
10. **Clicking a progression problem did nothing visible.** It now opens and scrolls to the row.

Other improvements: shared codes are numbered ("L.3.1 (part 2 of 5)", "WI W.7.1" for new Wisconsin rows); Gaps
sections stay open across refreshes and the cards open them; Grades K-2 and 3-5 views; a Grade filter on Gaps and
Progressions; filters work on Progressions (or are hidden where they do nothing); the coverage map ranks weak tiles
by size and share and marks priority tiles; one colour for "not rated" (white) everywhere; in-plans is a bar under the
square, not a dashed ring; the committee confirms before changing a team's rating; the popup has Back, a "Why this
standard is flagged" box near the top, ratings for every grade, and plan evidence above the "I can" levels; the
address keeps the page and filters, so the browser's Back works; a "Back to ..." link after jumping to a progression;
CSV downloads include each standard's findings, and Progressions downloads its rows and checks; phone layouts no
longer scroll sideways.

## Round 2 (none passed yet)

New reviewers C and D. Every count they recomputed from the raw data matched the pages exactly; the remaining problems
were in what some verdicts claimed.

| Page | Usability | Visual | Information | Progression | Interpretation | Report |
|---|---|---|---|---|---|---|
| Coverage map | 7 | 7 | 7 | 6 | 6 | [C](round-2-C.md) |
| Gaps & repetition | 6 | 7 | 4 | 6 | 6 | [C](round-2-C.md) |
| Vertical Alignment Audit | 6 | 6 | 6 | 4 | 6 | [C](round-2-C.md) |
| Standard popup | 8 | 7 | 6 | 8 | 7 | [C](round-2-C.md) |
| Progressions | 7 | 6 | 5 | 7 | 6 | [D](round-2-D.md) |
| Grade dashboard | 6 | 6 | 5 | 6 | 6 | [D](round-2-D.md) |
| Popup progression and checks boxes | 7 | 6 | 5 | 6 | 6 | [D](round-2-D.md) |

Round 1 critical issues, as judged by round 2: 2 resolved, 9 partly resolved (the rest of each is in the list below).

### What changed after round 2

Critical issues (all addressed):

1. **With a grade chosen, Gaps showed no progression problems** (it dropped the grades before and after). It now
   checks every standard in view and keeps the problems in that grade or caused by it.
2. **"Confirmed gap" still overclaimed** when other grades were never asked. A gap is now confirmed only when every
   grade that could teach the standard has rated it not taught: its suggested grade(s), priority grades, grades whose
   plans cite it, and every grade of its band for standards whose grade is only a suggestion (for example high school
   Math). Otherwise it is a possible gap, tagged "waiting for", "not asked (same band)" or "plans cite it".
3. **Prerequisite gaps rested on weak, inferred links.** A prerequisite gap now needs every standard the later one
   builds on to be fully rated and not taught anywhere, and a gap a Break already explains is not repeated. Links
   inferred from wording must be close (0.25 or more) and are shown as **Possible prerequisite gap**, a question to
   check; only official links (the same ELA anchor standard) and Breaks make a row "Breaks down".
4. **"Same wording" named Common Core codes** whose text differs. It now names the Wisconsin codes it compared and
   says the Common Core versions can differ.
5. **Grades that rate a standard because their plans cite it were missing from progression rows.** They now appear
   in the boxes, counts and checks (marked "plans" in the ratings).
6. **Dashboard review counts mixed in Essential Elements** and counted one standard twice. Counts are now for the main
   standards with linked Essential Elements in brackets; problems that reach a later grade are counted by standard.

Other improvements: "Builds steadily" is now "Taught at every step" (it does not judge how well the expectation
rises); band reinforcement is separate from possible duplication; the Audit shows each standard of the grade with
what it builds on before and what builds on it after, with ratings (the K-12 grid is folded under it); priority
counts on the Audit and dashboard match and count Essential Elements apart, marked "(linked)"; the coverage map
labels its percentages, adds each grade's share taught in depth, includes small fully not-taught tiles and shows the
share in depth on each finding, and its ★ now means a priority standard rated below in depth; the popup shows a
dot for teaching outside the suggested grade, a visible in-plans bar, checks ordered and coloured by severity, Breaks
that involve the standard, and the row a progression grows out of; Gaps lists show 25 lines with "Show all";
"Back to ..." returns to the same place; prerequisite gaps show on the row's line; progression boxes open the row
(mouse or keyboard); the open tab stays in view on phones; small grey text is darker; the ELA crosswalk no longer
shows the non-existent 2010 codes "R.2.7" and similar; ELA Writing, Language and Speaking and Listening rows say
they use Wisconsin numbering.

## Round 3

Results are added below when the round finishes.

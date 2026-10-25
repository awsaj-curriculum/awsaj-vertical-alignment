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

## Round 3 (none passed yet)

New reviewers E and F. Every count they recomputed matched. Scores rose; the standard popup reached 8 on usability
and vertical progression.

| Page | Usability | Visual | Information | Progression | Interpretation | Report |
|---|---|---|---|---|---|---|
| Coverage map | 7 | 7 | 7 | 6 | 6 | [E](round-3-E.md) |
| Gaps & repetition | 7 | 7 | 6 | 7 | 7 | [E](round-3-E.md) |
| Vertical Alignment Audit | 6 | 6 | 5 | 5 | 7 | [E](round-3-E.md) |
| Standard popup | 8 | 7 | 7 | 8 | 7 | [E](round-3-E.md) |
| Progressions | 7 | 6 | 5 | 7 | 6 | [F](round-3-F.md) |
| Grade dashboard | 7 | 7 | 6 | 7 | 6 | [F](round-3-F.md) |
| Popup progression and checks boxes | 7 | 7 | 5 | 7 | 6 | [F](round-3-F.md) |

### What changed after round 3

Critical issues (all addressed):

1. **Verdicts on unsettled standards.** A standard now counts as not taught, for breaks and prerequisite gaps, only
   when that is settled: every grade that rated it says not taught and no grade that might teach it (owners still to
   rate, other grades of its band, grades whose plans cite it) is still to rate it.
2. **A step-level message named grades that do not teach in depth.** It now names only the grades that do.
3. **Suggested matches promoted to official.** Only ELA anchor links and the Math Coherence Map are official; every
   other prerequisite gap is "possible".
4. **The Audit's Before and after showed one grade's rating** for a neighbour placed in several grades. It now shows
   every grade's rating and marks a neighbour only when it is settled that no grade teaches it.
5. **Gaps narrowed to a band listed other grades' findings.** Findings about one grade now show only when that grade is
   in view.

New since round 3, at Tim's request:

- **Prerequisite map.** Every standard can list the standards it needs first, several from one grade if needed, with
  the kind of link (same skill earlier, a concept it relies on, a procedure it extends, a different skill needed
  first) and its source. Sources:
  - Math: the Coherence Map, from the Common Core progressions.
  - ELA: the same anchor standard (official).
  - ELA, Science and Social Studies: links suggested by an AI curriculum reviewer, each with a one-line reason and
    labelled "Suggested, check".

  The site shows "N prerequisites" chips (hover lists them with ratings), a "Needs first / Leads to" box in the popup,
  and the Audit's Before and after table. The prerequisite checks use it, so checks now cross progression rows.
- **Coverage map, "Matched across grades".** Each standard is followed into the standards that build on it, one row per
  chain within each progression (a standard in two progressions, or with two successors, has two rows). There are
  K-12 / K-5 / 6-8 / 9-12 buttons, and "see the links" shows each step with its link type, source, reason and shared
  wording.
- **Math codes.** Wisconsin 2021 renumbered a few Math standards, so their bold Common Core code was wrong. A checked
  crosswalk now fixes the code shown, the plan and priority reading, and the prerequisite links (for example, Wisconsin
  M.3.OA.B.4 is Common Core 3.OA.B.5). One school-data question is left open in the crosswalk notes.

Other improvements:

- "Repeated in depth" no longer includes standards only taught early.
- Progression lines differ in pattern as well as colour.
- A note appears when filters narrow the checks.
- Progressions has a "What to do" line and source tags.
- The dashboard hedges mixed headlines and lists priority standards placed in another grade.
- Full standard text appears in progression rows.
- Codes in messages name one standard each.
- Planned-standard counts on the Audit exclude standards the grade does not rate.
- Wording fixes, an easier-to-see priority star with labelled tiles, and the Gaps CSV follows the Grade filter.

## Round 4 (none passed yet)

New reviewers G and H. Every headline count G recomputed matched; H found one count off by one (Grade 4 Science on
the dashboard). Scores held at 5 to 7: accuracy was held down by verdicts and labels that could lead to a wrong
conclusion, not by arithmetic.

| Page | Usability | Visual | Information | Progression | Interpretation | Report |
|---|---|---|---|---|---|---|
| Coverage map | 7 | 7 | 6 | 6 | 6 | [G](round-4-G.md) |
| Gaps & repetition | 7 | 7 | 5 | 7 | 7 | [G](round-4-G.md) |
| Vertical Alignment Audit | 6 | 6 | 5 | 7 | 6 | [G](round-4-G.md) |
| Standard popup | 7 | 7 | 5 | 7 | 6 | [G](round-4-G.md) |
| Progressions | 6 | 6 | 5 | 6 | 5 | [H](round-4-H.md) |
| Grade dashboard | 6 | 7 | 6 | 7 | 6 | [H](round-4-H.md) |
| Popup progression box and "see the links" | 7 | 6 | 5 | 7 | 6 | [H](round-4-H.md) |

### What changed after round 4

Critical issues (all addressed):

1. **A "Break" on steps that were not settled** (G C1, H 1). A break now needs every standard in the step to be settled
   as not taught; otherwise it is not a break.
2. **ELA sub-parts paired with the wrong sub-part** (G C2). The index keeps only the start of each standard, and every
   part repeats its parent's stem, so all parts looked identical. Links now compare each part's own words in the full
   text. When the anchor has one standard in the grade before, or the parts are worded the same, the link stays
   official. Otherwise it is labelled "Same anchor standard, part matched by wording" and is not official. A part with
   no close match gets no link.
3. **Source labels wrong or missing** (H 2). Every link and gap names its source (Coherence Map, official anchor,
   anchor part by wording, AI suggestion, wording). AI-written reasons say so.
4. **Impact statements** (H 3). Dashboard causes count this grade's standards only, sorted by grade. A standard's
   "Why flagged" lists the problems it causes in other rows. Gaps inside one grade are labelled "within a grade" and do
   not make a row "Breaks down".

Other improvements:

- **Essential Elements are counted apart** on the Coverage map (cards, thinnest teaching, strongest) and the Gaps page
  (cards show the main count, "plus n Essential Elements"; each section lists them after a divider). Plan marks that
  Essential Elements only inherit are no longer counted as "in the plans" anywhere.
- **Every neighbour rating names its grade** (popup, Audit Before and after). "Leads to" uses later-direction labels
  ("Same skill, later"), and official links are listed first.
- **Thinnest teaching** is ranked by a rule each line shows: tiles where at least half the rated standards are below in
  depth, by how many, then by share. Badges show only the sets in that tile, and the list says what to do next.
- **Matched across grades** no longer repeats the same start: the strongest link continues a row and each other link
  starts a branch row. In a band view each row keeps only its standards in the band and says where it started.
- **Audit Before and after**: "Show only the ones that need a look" (rated below in depth, or a settled not-taught
  neighbour), a bar on those rows, "Before and after" links from the priority lists, and a stacked layout on phones.
- **Progressions and Gaps** list problems with one root cause together ("One cause, 3 problems"), and the codes in
  check messages open the standard.
- **Reinforcement vs duplication** uses the standard's band (a high school standard taught in depth in Grades 10 and 11
  is reinforcement).
- **Back** returns to the page before after opening a shared link.
- **Math 3.OA.C.7** (Tim's question): checked against the official Common Core and Wisconsin 2021 texts. Common Core
  3.OA.C.7 (Grade 3) is Wisconsin M.3.OA.C.6; Wisconsin M.4.OA.D.6 is new in 2021. The Hub's Grade 3 power standard
  now marks M.3.OA.C.6.
- Wording-match noise cut (more stop words), new words underlined in "see the links", help texts updated, the set
  filter names only the sets in view, the priority corner has an edge for colour-blind readers.

## Round 5 (none passed yet, several pages at 8 or 9)

New reviewers I and J. Every count I recomputed matched, for all four subjects. The Audit, the popup and printing reached
8 or more on every criterion except one (print visual hierarchy 7); the Gaps page and the coverage map's By strand view
reached 8 on most.

| Page | Usability | Visual | Information | Progression | Interpretation | Report |
|---|---|---|---|---|---|---|
| Coverage map: By strand | 8 | 8 | 8 | 6 | 7 | [I](round-5-I.md) |
| Coverage map: Matched across grades | 6 | 7 | 7 | 6 | 5 | [I](round-5-I.md) |
| Gaps & repetition | 8 | 8 | 8 | 7 | 7 | [I](round-5-I.md) |
| Vertical Alignment Audit | 8 | 8 | 9 | 8 | 8 | [I](round-5-I.md) |
| Standard popup | 8 | 8 | 9 | 9 | 8 | [I](round-5-I.md) |
| Printing / PDF | 8 | 7 | 9 | 8 | 8 | [I](round-5-I.md) |
| Progressions | 7 | 7 | 6 | 8 | 7 | [J](round-5-J.md) |
| Grade dashboard | 8 | 7 | 8 | 7 | 7 | [J](round-5-J.md) |
| Popup progression box and Why flagged | 8 | 7 | 7 | 8 | 8 | [J](round-5-J.md) |
| "See the links" dialog | 7 | 7 | 6 | 7 | 7 | [J](round-5-J.md) |

### What changed after round 5

Critical issues (all addressed):

1. **Possible gaps that could never settle** (I C1). A new state, "not taught where asked": every grade asked to rate the
   standard says not taught, and only grades never asked are open. It has its own card and section, and the Why
   flagged box says to ask those grades. "Waiting" now means only grades the standard is placed in.
2. **Red card for possible problems** (I C2). The progression problems card splits official from possible links.
3. **Split standards** (J C1, C2). A Coherence Map arrow that reaches several parts of one standard counts as one
   prerequisite, missing only when every part is; a parent code now reaches all its parts (5.NF.B.7 a, b and c).
4. **Chains followed wording over the map** (J C3). Wording only links a standard the map does not link on from.
5. **"Breaks down" from another row** (J C4). A gap whose missing standard sits in another progression is labelled
   "From another progression", is not drawn on the row's line, and leaves the row at "to check"; messages count
   prerequisites ("1 of the 6").

Other improvements: progression cards say "progressions with ..."; break messages name the codes; the dashboard has a
ranked "review first" list across subjects; the coverage map names the weakest grades and its matched view has its own
lede and explains empty band views; the popup's row box says the step before is the same idea, not a prerequisite; the
Audit jump highlights its row; printouts start with the page, filters and "ratings as of" date and hide the team button;
the phone Progressions page no longer scrolls sideways; more wording noise removed.

## Round 6

Results are added below when the round finishes.

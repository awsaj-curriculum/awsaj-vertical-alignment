# Awsaj K-12 Vertical Alignment

A website for Awsaj Academy (Qatar Foundation, Doha) where teacher teams record how each standard is taught in
their grade (Part 1), and where curriculum plans are compared with those ratings (Part 2). Owner: Tim Mills,
Elementary Curriculum Coordinator. Users: the K-12 Vertical Alignment Committee and grade/subject teams.
Committee meetings: Nov 3, Dec 15, Jan 19, Mar 23, Apr 20/27. **Part 1 must be live for all four subjects by Nov 3.**

Read `docs/HANDOFF.md` first (current status and next steps), then `docs/spec.md` (every decision so far).

## Hard rules
- The school Google Drive (account 2sk234@awsaj.qfschools.qa) is **read-only**. Never create, edit, move or delete
  anything there.
- **No student names or student data** anywhere: not in data files, the database, the site, or commits.
- Teacher names should not appear on the public site (plan file titles often contain them; strip them).
- This repo is **public** (GitHub Pages). Never commit downloaded school files (`data/source/` is git-ignored),
  the extended workbooks (`outputs/`), passwords, the admin passcode, or any service key. The Supabase
  *publishable* key in `site/config.js` is meant to be public.
- Writing style for anything people read: plain English for teachers, **no em dashes or en dashes** (use commas,
  colons, parentheses or separate sentences).
- Draft "I can" descriptors are labelled `draft`; school descriptors are never rewritten, only flagged
  (`descriptor_flag` + `descriptors_suggested`).
- Every part of the site needs a "?" explanation (`site/help.js`). Add one whenever you add a control or section.

## Layout
- `site/` static site, no build step: `index.html`, `styles.css`, `app.js`, `help.js`, `config.js`, `data/*.json`.
  Run locally: `cd site && python3 -m http.server 8765`.
- `data/standards/` one JSON per subject plus `all_standards.json` (2,557 rows, schema in
  `docs/standards_team_brief.md`). `data/teams.json` team list.
- `scripts/` parsers and builders. `standards_codes.py` reads standard codes in any style from plan text;
  `ela_crosswalk.py` builds `data/standards/ela_crosswalk_2010_2020.json` from DPI's official 2010/2020 ELA comparison;
  `audit/plan_marks.py` builds `data/standards/plan_marks.json` (in plans / priority per grade) from the school's
  documents in `data/source/ma3loomat/` (6-12) and `data/source/hub/` (K-5); `audit/audit_secondary.py` writes the
  secondary audit to `outputs/`. Rebuild order: ela_crosswalk, plan_marks, build_site_data, build_progressions,
  build_prereqs, build_sources. `build_sources.py` writes `site/data/sources.json` for the site's "Data sources" panel
  (Tim wants data sources transparent): standard sets and their documents, every curriculum document read (course
  names only, never file titles), Hub power lists with codes not found, prerequisite links by source, what is not read. `data/standards/math_ccss_crosswalk.json` lists the Wisconsin 2021 Math rows whose Common Core code
  differs (renumbered K.CC, 3.OA, HS G-C/GMD/MG; split parts); it feeds the `cw` field, plan-code reading and the
  prerequisite map. `M.`-prefixed codes in documents are read as Wisconsin codes. Multiply and divide within 100 (checked
  against official Common Core and Wisconsin 2021): Common Core 3.OA.C.7 (Grade 3) = Wisconsin M.3.OA.C.6 ("multiplicative
  thinking"); Wisconsin M.4.OA.D.6 ("Flexibly and efficiently ...", Grade 4) is new in 2021 with no Common Core code; the
  Hub's Grade 3 power standard "M.3.OA.C.7" (no such Wisconsin code) is read as Common Core 3.OA.C.7, so M.3.OA.C.6.
  Math: `parse_wi_math.py`, `parse_wi_ee_math.py`, `build_math_master.py`,
  `build_math_json.py`, `build_math_xlsx.py`. Other subjects: `scripts/ela|science|social_studies/`.
  `build_site_data.py` regenerates `site/data/` from `data/standards/`. `load_supabase.py` loads standards and
  teams. `part2/match_plans.py` (written, not yet run) finds standard codes in plan text.
- `supabase/` schema migrations and notes. `.github/workflows/` Pages publish + keep-alive ping.

## Database (Supabase)
Project `awsaj-vertical-alignment` (ref `mmcblwddwgwhtlhrqmfi`, region ap-south-1, Free plan) in Tim's
"mycurricula.app" organisation. No sign-in: tables are read-only to the public key through RLS; all writes go
through `set_rating`, `add_comment`, `undo_change`, `hide_comment` and `undo_my_rating`. There is **no passcode**:
Tim asked for undo and hide to be open to everyone (migration 003). `undo_change` only undoes the newest change to a
standard; every change and undo stays in `rating_events`. (The old `admin_*` functions and the passcode hash in
`app_settings` are unused.) Ratings are keyed by (framework, code, grade) so any
grade can claim a band standard suggested for another grade. `load_rows()` (bulk loader) exists but its EXECUTE is
revoked; re-grant temporarily with a fresh token when reloading standards, then revoke again.
Free projects pause after 7 days idle; `keepalive.yml` pings every 3 days.

## Rating scale and colours
Awsaj brand (from awsaj.qa logo and stylesheet): dark green #024638 (frame, headings, buttons), greys #56595A / #75787B,
and the four symbol ribbons: orange #ED8B00, blue #0092BC, magenta #D00070, lime #78BE21. Font: Barlow (free, DIN-like;
the school uses DIN Next and QF, which are licensed). Ratings: 0 Not taught (magenta #D00070), 1 Introduced / exposed
(blue #0092BC), 2 Taught in depth (lime #78BE21), unrated white. Orange is only for highlights (selection, focus,
celebrations): never make orange and lime two rating levels, colour-blind readers cannot tell them apart. Dark green
outline = suggested grade; dot = taught in a grade other than the suggested one; bar under a square = in that grade's plans;
orange corner = priority / power in that grade (★ on a coverage map tile = one of them rated below in depth). Not rated
is white everywhere. EE rows marked "★ Priority (linked)" take the mark from their linked standard and are counted apart. Part 2 uses the same scale: 1-2 weeks in
plans = Introduced, 3+ weeks = Taught in depth.

Teachers use the "flow" view: all standards for a subject on one page by default (Small / Medium / Large, with Find,
filter chips and a Finish button that lists anything unanswered), or One at a time (button toggle, remembered per device).
The question is "How is this generally taught in Grade X?"; "What do these mean?" opens the three answer definitions.
When a subject is complete the teacher sees a results page for it; confetti only when every subject on the link is done.
The committee and "Explore" get the full tabs.
Locked links: `?team=<name>` (optionally `&subject=`) for one team, `?grade=<K-12>` for every subject in a grade (each subject
is rated as that subject's own team). The committee's Team progress dialog lists both, by grade or by team.

## Standard sets
Each set is a framework: CC (WI-CC-MATH, WI-CC-ELA), EE (WI-EE-MATH, WI-EE-ELA, WI-EE-SCI, WI-EE-SS: Essential Elements
as their own rows, built by `scripts/build_ee_rows.py` into `data/standards/essential_elements.json`, `crosswalk`/`lk` =
linked standards), NGSS, AERO (AERO-SCI, AERO-SS) and WI (WI-SCI, WI-SS). Each team chooses its sets per subject
(`team_sets`, written by `set_team_sets`, migration 004); until it chooses, it gets the default (CC for Math/ELA, AERO-SCI K-5 /
NGSS 6-12 for Science (the client hides NGSS in K-5 and WI-SCI in every grade; the data is kept), AERO-SS K-5 (WI-SS hidden in K-5; its suggested matches show in italics under each AERO code from the `wi` index field) / WI-SS 6-12 for Social Studies; other sets stay selectable). The default also ticks the subject's Essential Elements set when the grade has any. Teachers rate chosen sets one at a time (CC first, EE last). Every set
has a badge with its own line style (CC solid green, EE dashed, NGSS solid grey, AERO dotted, WI double line); sets never
use the rating colours.
Prerequisite map: `scripts/build_prereqs.py` writes `site/data/prereqs.json` ({to: [[from, type, source, reason]]}).
Math = Coherence Map arrows (Student Achievement Partners; `data/source/coherence_map/data.js`, git-ignored, only codes
used); ELA = same anchor standard one grade earlier (official when the grade before has one standard for the anchor or
the part reads the same; otherwise source `anchorp`, "part matched by wording", not official; parts are compared on
their own words in the full text, `own_text()` in build_progressions.py); ELA, Science and Social Studies also get AI-suggested
prerequisites in `data/standards/prereqs_ai/*.json` (types same / concept / procedure / prereq, one-line reason), always
shown as "Suggested, check". The site shows "N prerequisites" chips (hover lists them with ratings), a popup "Needs first
/ Leads to" box, the Audit's Before and after table, and uses it for prerequisite-gap checks (official = Coherence Map or
anchor; otherwise "Possible prerequisite gap").
Codes: every standard everywhere (cards, lists, tables, popup, tips, CSV) shows the main code in bold with one small italic
line underneath (`codeHTML()` / `codeParts()` in app.js; never print `e.c` on its own). Math and ELA: Common Core code
first, Wisconsin code underneath (M.5.MD.A.1 -> 5.MD.A.1, M.A.APR.A.1 -> HSA-APR.A.1, SP -> S; ELA uses `cw`, the
Common Core 2010 code(s) from DPI's comparison: R.6.1 -> RL.6.1 · RI.6.1, W.6.2.a -> W.6.1, L.6.5.a -> L.6.1; Wisconsin
renumbered W/L/SL in 2020, they are NOT the same codes). Rows new in Wisconsin 2020 show their Wisconsin code with "new
in 2020". EE rows follow their linked standard (M.EE.6.NS.5 -> EE.6.NS.5, EE.W.6.2.a -> EE.W.6.1). NGSS, AERO Science and
AERO Social Studies show their Wisconsin matches underneath (`wi` field) or "No Wisconsin match"; Wisconsin Social
Studies 6-12 shows its set name.

## Plans and priority standards
`plan_marks.json` -> index fields `pn` (grades whose curriculum documents cite the standard), `pr` (grades that name it a
Priority standard, 6-12, from Ma3loomat curriculum maps and scope & sequence; or a Power standard, K-5, from the K-5 ELA
Power Standards PDF and the Curriculum Hub grade Standards lists) and `pa` (grades added to the placement because their
plans cite it: high school Math and middle school Science rate cited standards plus their current placement, as Tim
decided). Marks: "★ Priority" / "★ Power" pill (orange, a highlight) and "✓ In curriculum docs" pill (renamed from "In plans": only course maps, pacing, overviews and K weekly plans are read until Part 2; dark green outline); on the
K-12 grid an orange top-left corner and a bar under the square. Committee filters: Standards (all / priority / in plans / not in
plans) and Order (curriculum order / priority first / in plans first, within each strand). Teachers get Priority and In
plans tabs in their library. Gaps, Dashboard and the Audit page have priority / in-plans sections.

## Analysis pages and progressions
Every analysis page starts with findings computed live from the ratings (they fill in as teams rate), labels automatic
checks, and never counts "not rated" as a gap. Rules every page follows (from the independent reviews, `docs/reviews/`):
- A gap is **confirmed** only when every grade that could teach it has rated it not taught (`unknownFor()`: owners =
  suggested grades + priority grades that can rate it, still to rate = "waiting"; other grades of the band for `sg`
  standards = "not asked"; grades whose plans cite it = "plans cite it"); when every grade asked to rate it (its placed
  grades) says not taught and only never-asked grades are open (band, priority grades it is not placed in, plans) it is
  **not taught where asked**; when a placed grade is still to rate it, a **possible gap**.
- Counts use rated standards and show the unknown share; priority standards placed in another grade are listed apart
  (that grade does not rate them); "taught but not in the plans" is only shown when the grade's documents cite something
  ("No plan data yet" otherwise), excludes Essential Elements, and is hedged until Part 2.
- Essential Elements are counted apart from the main set (dashboard, overview cards, coverage map findings, Gaps
  cards and sections) and get their own map rows. Their inherited "in plans" marks are not counted anywhere.
  EE rows whose text is "Not applicable" are dropped at load. Shared Common Core codes get "(part n of m)"; Wisconsin
  2020 ELA rows with no Common Core code show "WI W.7.1".
- Printing (PDF button or browser print) is A4 portrait (`@page` in styles.css) with every finding: `S.printAll` opens
  every section and lifts every list cut-off while printing; with a popup open, only the popup prints.
- `checksFor(e)` lists every check for one standard (popup "Why this standard is flagged", CSV Findings column).
Coverage map: "By strand" tiles or "Matched across grades" (chains of matched standards per progression, one square per
grade; the strongest link continues a row, other links start branch rows; band views keep the band's standards; "see the links" opens each step with its link type, source, reason and shared wording), with K-12 / K-5 / 6-8 /
9-12 buttons. Tiles: rows by strand (same-named Science strands share a row; each K-5 AERO Social Studies strand sits above
the Wisconsin domain its matches fall in, `S.ssDomain`; EE rows last), thinnest = tiles with 3+ rated where at least half are below in depth, ranked by
that count then share (EE ranked apart). Gaps: confirmed /
possible / priority / progression problems / duplication (again later) / taught early / plans / only introduced /
reinforcement / unknown; a grade filter narrows to what that grade works with. Audit: findings first, then the chosen
grade's standards before and after it (`beforeAfter()`, K-12 grid folded below), Part 2 collapsed until it runs. Dashboard: whole grade + cross-subject review list,
then the subject. Progressions: `scripts/build_progressions.py` writes `site/data/progressions.json` (lanes: ELA
anchors, NGSS DCI components via WI-SCI codes, WI-SS standards with AERO K-5 via suggested matches = official; Math =
Common Core topics by cluster = inferred, with `next` topics; links = up to 3 closest standards in the step before,
`[a, b, similarity, same Wisconsin wording]`). Steps include grades added from plans (`pa`). The client hides links
below `MIN_SIM` (0.12). Checks only use fully rated standards: break (whole middle step not taught and taught nowhere),
moved (taught in another grade instead), prereq (in depth while every standard it links to is not taught anywhere;
official on ELA anchor links, otherwise "Possible prerequisite gap" and only with similarity >= `PRE_SIM` 0.25; a
gap a break explains is dropped; shown on both grades' dashboards), repeat (possible duplication) vs reinforce (in
depth in 2+ of its own grades: placed grades plus the rest of its band, `ownGrades()`), same wording. Row status is factual, by link source (Tim: present the facts; "Breaks down" is the only evaluative label allowed, never
weak/strong link or strongest/weakest): "Breaks down" (a settled break, last steps not taught, an official prerequisite not taught wherever it sits, or a row holding
one; a split standard's parts share a `grp` in prereqs.json and count as one) vs "Not taught on a suggested link"
(AI or wording links only); "Taught at
every step" = 2+ grades, every standard rated and at least introduced. Run it after build_site_data.py.
The committee's page and filters are kept in the address (`#view=gaps&subject=Math&grade=3`), so Back works and links
can be shared; the popup has its own Back for standards opened from a list.

## Testing
Use Playwright (Chromium) against the local server, and check every view (Rate, Heatmap, Gaps, Dashboard,
Progressions, Activity, Vertical Alignment Audit) plus a standard popup. Do not leave test ratings in the live database:
if you write one, undo it.

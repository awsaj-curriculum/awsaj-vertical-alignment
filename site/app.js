/* Awsaj K-12 Vertical Alignment: Part 1 (collaborative standards audit)
   Static site. Standards come from data/*.json; ratings, history and comments live in Supabase
   and are written only through logged database functions (set_rating, add_comment, undo_change, hide_comment, undo_my_rating). */
(() => {
  "use strict";
  const CFG = window.VA_CONFIG;
  const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  const DIV = { Elementary: ["K", "1", "2", "3", "4", "5"], Middle: ["6", "7", "8"], High: ["9", "10", "11", "12"] };
  // Extra "Show" choices for the committee: smaller bands inside elementary school (they are not divisions).
  const BAND = { "K-2": ["K", "1", "2"], "3-5": ["3", "4", "5"], "6-12": ["6", "7", "8", "9", "10", "11", "12"] };
  const divLabel = (d) => (d === "all" ? "K-12" : BAND[d] ? "Grades " + d : d + " school");
  const LEVEL = ["Not taught", "Introduced / exposed", "Taught in depth"];
  const LEVEL_SHORT = ["Not taught", "Introduced", "In depth"];
  const FW_NAME = { "WI-CC-MATH": "Wisconsin Math (CC)", "WI-CC-ELA": "Wisconsin ELA (CC)", "NGSS": "NGSS",
    "WI-SCI": "Wisconsin Science", "AERO-SCI": "AERO Science", "WI-SS": "Wisconsin Social Studies", "AERO-SS": "AERO Social Studies",
    "WI-EE-MATH": "Essential Elements (Math)", "WI-EE-ELA": "Essential Elements (ELA)", "WI-EE-SCI": "Essential Elements (Science)", "WI-EE-SS": "Essential Elements (Social Studies)" };
  // Standard sets: each has a short badge and its own badge style, so Common Core, EE, NGSS, AERO and Wisconsin never look
  // alike. Set styles use shape and line (solid, dashed, dotted, double), not the rating colours.
  const SET = (f) => (f.startsWith("WI-EE-") ? { abbr: "EE", name: "Essential Elements", style: "ee" }
    : f.startsWith("WI-CC-") ? { abbr: "CC", name: f === "WI-CC-MATH" ? "Wisconsin Math (CC)" : "Wisconsin ELA (CC)", style: "cc" }
    : f === "NGSS" ? { abbr: "NGSS", name: "NGSS", style: "ngss" }
    : f.startsWith("AERO-") ? { abbr: "AERO", name: "AERO", style: "aero" }
    : { abbr: "WI", name: f === "WI-SS" ? "Wisconsin Social Studies" : "Wisconsin Science", style: "wi" });
  const SET_ORDER = (f) => (f.startsWith("WI-EE-") ? 9 : f.startsWith("WI-CC-") ? 0 : f === "NGSS" ? 1 : f.startsWith("AERO-") ? 2 : 3);
  // Hover text for a set. The Wisconsin Math and ELA sets are Common Core based, so they carry (CC) and say so on hover.
  const CC_TIP = { "WI-CC-MATH": "Wisconsin Math (CC): the Wisconsin Standards for Mathematics (2021), built on the Common Core State Standards. The bold code is the Common Core code; the Wisconsin code is underneath.",
    "WI-CC-ELA": "Wisconsin ELA (CC): the Wisconsin Standards for English Language Arts (2020), built on the Common Core State Standards (2010). The bold code is the Common Core code; the Wisconsin code is underneath." };
  const setTip = (f) => CC_TIP[f] || FW_NAME[f] || SET(f).name;
  const badge = (f) => { const x = SET(f); return `<span class="setb set-${x.style}" title="${esc(setTip(f))}">${x.abbr}</span>`; };
  // Awsaj brand: ratings use three of the four symbol ribbons (orange is kept for highlights so it never sits next to lime).
  const COLORS = { none: "#FFFFFF", 0: "#D00070", placed: "#024638", 1: "#0092BC", 2: "#78BE21", maroon: "#024638", accent: "#ED8B00", line: "#D9E1E2", ink: "#1E2324" };

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const gl = (g) => (g === "K" ? "K" : "G" + g);
  const gname = (g) => (g === "K" ? "Kindergarten" : "Grade " + g);
  const divOf = (g) => Object.keys(DIV).find((d) => DIV[d].includes(g));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
  };

  const S = {
    meta: null, idx: {}, byKey: new Map(), detail: {}, ratings: new Map(), events: [], comments: [], teams: [],
    team: null, teamSets: {}, view: "rate", explore: false, flow: { subject: null, skipped: new Set(), back: null, history: [] }, lastSync: null, device: null, pending: null,
    f: { subject: "Math", framework: "", division: "all", grade: "", strand: "", search: "", mark: "", order: "" },
  };

  /* ---------------- data access ---------------- */
  const H = { apikey: CFG.supabaseKey, Authorization: "Bearer " + CFG.supabaseKey };
  async function getAll(path) {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const r = await fetch(`${CFG.supabaseUrl}/rest/v1/${path}`, { headers: { ...H, "Range-Unit": "items", Range: `${from}-${from + 999}` } });
      if (!r.ok) throw new Error(await r.text());
      const rows = await r.json();
      out.push(...rows);
      if (rows.length < 1000) return out;
    }
  }
  // The first database reads start at once, alongside the standards files, instead of waiting for them.
  const early = new Map();
  function prefetch(path) { const p = getAll(path); p.catch(() => {}); early.set(path, p); }
  function getAllOnce(path) { const p = early.get(path); early.delete(path); return p || getAll(path); }
  const Q = { ratings: "ratings?select=*", events: "rating_events?select=*&order=created_at.desc&limit=300", comments: "comments?select=*&order=created_at.desc", sets: "team_sets?select=*" };
  async function rpc(fn, body) {
    const r = await fetch(`${CFG.supabaseUrl}/rest/v1/rpc/${fn}`, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) { let m = await r.text(); try { m = JSON.parse(m).message || m; } catch (e) { /* keep text */ } throw new Error(m); }
    return r.status === 204 ? null : r.json();
  }
  const rkey = (f, c, g) => `${f}|${c}|${g}`;
  function rating(f, c, g) { return S.ratings.get(rkey(f, c, g)); }

  async function loadRatings(full) {
    const q = !full && S.lastSync ? `ratings?select=*&updated_at=gt.${encodeURIComponent(S.lastSync)}` : Q.ratings;
    const rows = await getAllOnce(q);
    if (full) S.ratings.clear();
    for (const r of rows) {
      S.ratings.set(rkey(r.framework, r.code, r.grade), r);
      if (!S.lastSync || r.updated_at > S.lastSync) S.lastSync = r.updated_at;
    }
    return rows.length;
  }
  async function loadEvents() { S.events = await getAllOnce(Q.events); }
  async function loadComments() { S.comments = await getAllOnce(Q.comments); }
  // Full text and "I can" levels, one file per subject. Kept as a promise so two callers never download it twice.
  const detailP = {};
  async function loadDetail(slug) {
    if (!detailP[slug]) detailP[slug] = fetch(`data/detail_${slug}.json`).then((r) => r.json()).then((d) => (S.detail[slug] = d)).catch((e) => { delete detailP[slug]; throw e; });
    return detailP[slug];
  }

  /* ---------------- helpers over standards ---------------- */
  const subj = () => S.meta.subjects.find((s) => s.name === S.f.subject);
  const items = () => S.idx[subj().slug];
  const visibleGrades = () => (S.f.division === "all" ? GRADES : DIV[S.f.division] || BAND[S.f.division] || GRADES);
  function filtered({ ignoreDivision = false, ignoreSearch = false } = {}) {
    const q = mode() === "full" && !ignoreSearch ? S.f.search.trim().toLowerCase() : "";
    const grades = visibleGrades();
    return items().filter((e) =>
      (!S.f.framework || e.f === S.f.framework) &&
      (!S.f.strand || e.s === S.f.strand) &&
      (ignoreDivision || S.f.division === "all" || e.pl.some((g) => grades.includes(g))) && markOk(e) &&
      (!q || e.c.toLowerCase().includes(q) || codeText(e).toLowerCase().includes(q) || e.t.toLowerCase().includes(q) || e.s.toLowerCase().includes(q)));
  }
  const levelsAcross = (e) => GRADES.map((g) => ({ g, r: rating(e.f, e.c, g) })).filter((x) => x.r);
  const canEdit = (g) => S.team && (S.team.name === "Vertical Alignment Committee" || S.team.grades.includes(g));
  function teamGrade() { return S.team && S.team.grades.length === 1 ? S.team.grades[0] : S.f.grade; }
  // The grade the Strand menu follows: the team's own grade on Rate, otherwise the Grade filter. "" = none chosen.
  const strandGrade = () => (S.view === "rate" ? teamGrade() : S.f.grade);
  // Standards a grade works with: those suggested for it, plus band standards it may claim (same set as the Rate page).
  const forGrade = (e, g) => e.pl.includes(g) || (e.sg && e.div.includes(divOf(g)));
  const pickGrade = (el, what) => { el.innerHTML = `<div class="panel empty">Choose a grade with the Grade filter above to see ${what}.</div>`; };

  const hb = (k) => `<button type="button" class="help" data-help="${k}" aria-label="What is this?">?</button>`;
  // action: optional [label, fn], or a list of them, shown as buttons in the toast (Change answer, Undo); it then stays up longer.
  function toast(msg, action) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    for (const a of action ? (Array.isArray(action[0]) ? action : [action]) : []) {
      const b = document.createElement("button"); b.type = "button"; b.textContent = a[0];
      b.addEventListener("click", () => { t.hidden = true; a[1](); }); t.append(" ", b);
    }
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), action ? 10000 : 2600);
  }
  function syncNote(msg) { $("#sync").textContent = msg; }

  async function setRating(e, g, level) {
    if (!S.team) { toast("Choose your team first (top right)."); $("#team").focus(); return; }
    if (!canEdit(g)) { toast(`Your team rates ${S.team.grades.map(gname).join(", ")}.`); return; }
    // Teams rate only their own grade's standards (Tim, Oct 2026); only the committee can rate a standard placed elsewhere.
    if (!isCommittee() && !e.pl.includes(g)) { toast(`Please rate only ${gname(g)}'s own standards. This one is for ${e.pl.map(gname).join(", ")}.`); return; }
    const k = rkey(e.f, e.c, g), before = S.ratings.get(k);
    const leftBefore = toRateLeft(g), strandBefore = strandLeft(e, g), allBefore = mode() === "teacher" ? teacherLeft(g) : 0;
    S.ratings.set(k, { framework: e.f, code: e.c, grade: g, level, team: S.team.name, updated_at: new Date().toISOString() });
    S.flash = k; rerender(); S.flash = null;
    const leftAfter = toRateLeft(g), undo = [["Change answer", () => reviseAnswer(e, g)], ["Undo", () => undoRating(e, g, before)]];
    const finished = Object.keys(leftAfter).find((sb) => leftBefore[sb] > 0 && leftAfter[sb] === 0);
    // Confetti only when the whole job is done (every subject on this team or grade link); a finished subject or strand just says so.
    const allDone = allBefore > 0 && teacherLeft(g) === 0;
    const party = allDone ? `Every standard for ${gname(g)} is rated. Thank you!` : "";
    const note = finished ? `Every ${finished} standard for ${gname(g)} is rated. Your results are ready.` : strandBefore > 0 && strandLeft(e, g) === 0 ? `${e.s}: every standard rated` : "";
    try {
      await rpc("set_rating", { p_framework: e.f, p_code: e.c, p_grade: g, p_level: level, p_team: S.team.name, p_device: S.device });
      syncNote("Saved " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      if (party) celebrate(party, undo); else toast(note || `${codeText(e)}, ${gname(g)}: ${LEVEL[level]}`, undo);
    } catch (err) {
      if (before) S.ratings.set(k, before); else S.ratings.delete(k);
      rerender(); toast("Could not save: " + err.message);
    }
  }

  // Undo takes the rating off straight away: the standard goes back to "Still to do".
  async function undoRating(e, g, before) {
    const k = rkey(e.f, e.c, g), now = S.ratings.get(k);
    // Until migration 005 is in the database, undo still restores the previous answer, so show that.
    if (!S.canClear && before) S.ratings.set(k, before); else S.ratings.delete(k);
    rerender();
    try {
      await rpc("undo_my_rating", { p_framework: e.f, p_code: e.c, p_grade: g, p_device: S.device });
      toast(S.canClear || !before ? `${e.c} taken off. It is back in Still to do.` : "Undone"); if (S.view === "activity") { await loadEvents(); rerender(); }
    } catch (err) {
      if (!S.canClear) { if (now) S.ratings.set(k, now); rerender(); toast("Could not undo: " + err.message); return; }
      // Too old to undo, or made on another device: remove it instead (same result, logged as a removal).
      try { await rpc("clear_rating", { p_framework: e.f, p_code: e.c, p_grade: g, p_team: S.team.name, p_device: S.device }); toast(`${e.c} taken off. It is back in Still to do.`); }
      catch (err2) { if (now) S.ratings.set(k, now); rerender(); toast("Could not take it off: " + err2.message); }
    }
  }
  // Remove any answer (not only the latest): the standard goes back to "Still to do".
  async function clearRating(e, g) {
    if (!S.team || !canEdit(g)) { toast(S.team ? `Your team rates ${S.team.grades.map(gname).join(", ")}.` : "Choose your team first."); return; }
    const k = rkey(e.f, e.c, g), now = S.ratings.get(k); if (!now) return;
    S.ratings.delete(k); rerender();
    try { await rpc("clear_rating", { p_framework: e.f, p_code: e.c, p_grade: g, p_team: S.team.name, p_device: S.device }); toast(`${e.c} removed. It is back in Still to do.`); }
    catch (err) { S.ratings.set(k, now); rerender(); toast("Could not remove: " + err.message); }
  }
  // Bring an answered standard back on screen with its answer showing, so it can be switched.
  function reviseAnswer(e, g) {
    if (mode() === "teacher") { S.flow.subject = S.meta.subjects.find((s) => S.idx[s.slug].includes(e)).name; S.flow.set = null; S.flow.back = rkey(e.f, e.c, g); showView("flow"); rerender(); }
    else openDetail(e.f + "|" + e.c);
  }

  /* ---------------- filters UI ---------------- */
  function fillSelect(sel, opts, value) {
    sel.innerHTML = opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("");
    if (value !== undefined && opts.some(([v]) => v === value)) sel.value = value;
  }
  function refreshFilterOptions() {
    const subs = S.team && S.team.name !== "Vertical Alignment Committee" ? S.team.subjects : S.meta.subjects.map((s) => s.name);
    if (!subs.includes(S.f.subject)) S.f.subject = subs[0];
    fillSelect($("#f-subject"), subs.map((s) => [s, s]), S.f.subject);
    const fws = subj().frameworks;
    if (S.f.framework && !fws.includes(S.f.framework)) S.f.framework = "";
    const sorted = fws.slice().sort((a, b) => SET_ORDER(a) - SET_ORDER(b));
    // "All sets" names only the sets that have standards in the grades in view (no WI in K-5 Social Studies).
    const gs = visibleGrades(), here = sorted.filter((f) => items().some((e) => e.f === f && e.pl.some((g) => gs.includes(g))));
    fillSelect($("#f-framework"), [["", "All sets (" + (here.length ? here : sorted).map((f) => SET(f).abbr).join(", ") + ")"], ...sorted.map((f) => [f, SET(f).abbr + ": " + (FW_NAME[f] || f)])], S.f.framework);
    if (!gs.includes(S.f.grade)) S.f.grade = "";
    fillSelect($("#f-grade"), [["", "Choose a grade"], ...gs.map((g) => [g, gradeCourse(g, S.f.subject)])], S.f.grade);
    const sg = strandGrade(), strandSel = $("#f-strand");
    const inGrade = sg ? items().filter((e) => (!S.f.framework || e.f === S.f.framework) && forGrade(e, sg) && e.s) : [];
    const strands = [...new Set(inGrade.map((e) => e.s))].sort();
    if (S.f.strand && !strands.includes(S.f.strand)) S.f.strand = "";
    // With several sets in view, each strand says which sets it comes from (EE strands share names with the main ones).
    const from = (s) => { const f = [...new Set(inGrade.filter((e) => e.s === s).map((e) => SET(e.f).abbr))]; return !S.f.framework && fws.length > 1 ? ` (${f.join(", ")})` : ""; };
    fillSelect(strandSel, sg ? [["", "All strands"], ...strands.map((s) => [s, s + from(s)])] : [["", "Choose a grade first"]], S.f.strand);
    strandSel.disabled = !sg;
    strandSel.title = sg ? "" : "Choose a grade first";
    if (!SHOW_PLANS) document.querySelectorAll(".pn-opt").forEach((o) => o.remove());
    $('#f-mark option[value="pr"]').textContent = `★ ${prName(markGrade())} only`; $('#f-order option[value="pr"]').textContent = `${prName(markGrade())} first`;
    $("#f-division").value = S.f.division; $("#f-mark").value = S.f.mark; $("#f-order").value = S.f.order;
    $("#filters").dataset.view = S.view; $("#filters").dataset.mapmode = S.view === "heatmap" ? mapMode() : "";
    $("#filters").dataset.committee = S.team && S.team.name === "Vertical Alignment Committee" ? "1" : "0";
  }

  /* ---------------- views ---------------- */
  // Teachers get one guided flow (view "flow"); the committee, or a teacher who chooses "Explore", gets the full tabs.
  const isCommittee = () => S.team && S.team.name === "Vertical Alignment Committee";
  const mode = () => (!S.team ? "welcome" : isCommittee() || S.explore ? "full" : "teacher");
  function showView(v) {
    S.view = v;
    $$(".tabs [data-view]").forEach((x) => x.setAttribute("aria-selected", x.dataset.view === v));
    $$(".view").forEach((x) => (x.hidden = x.id !== "view-" + v));
    document.body.dataset.mode = mode(); document.body.dataset.view = v;
    const t = $(`.tabs [data-view="${v}"]`); if (t && t.scrollIntoView && innerWidth < 760) t.scrollIntoView({ block: "nearest", inline: "center" });   // phones: keep the open tab in sight
    renderWho();
  }
  function renderWho() {
    const m = mode();
    if (S.lock && S.team) { $("#whoami").innerHTML = `<span class="who-team">${esc(S.lock.grade ? gname(S.lock.grade) : S.team.name)}${S.lock.subject ? " · " + esc(S.lock.subject) : ""}</span> ${hb("locked")}`; return; }
    $("#whoami").innerHTML = m === "welcome" ? "" : `<span class="who-team">${esc(S.team.name)}</span>
      ${m === "teacher" ? `<button type="button" class="ghost sm" data-act="explore">Explore the K-12 map</button>` : !isCommittee() ? `<button type="button" class="sm" data-act="back-to-flow">Back to rating</button>` : ""}
      ${isCommittee() ? `<button type="button" class="ghost sm" data-act="links">Team progress</button>` : ""}
      <button type="button" class="linkish" data-act="switch-team">Change team</button>`;
  }
  // Team progress (committee): every team and subject, how much is rated in the team's chosen sets, when it last rated,
  // and its locked link with a ready-made reminder. Unfinished first, so the committee knows who to remind.
  function teamProgressRows() {
    const base = location.origin + location.pathname, url = (t, s) => base + "?team=" + encodeURIComponent(t) + (s ? "&subject=" + encodeURIComponent(s) : "");
    const rows = [];
    for (const t of S.teams.filter((x) => x.name !== "Vertical Alignment Committee")) {
      const g = t.grades[0];
      for (const subject of t.subjects) {
        const sl = S.meta.subjects.find((x) => x.name === subject).slug, fws = setsFor(subject, g, t);
        const list = S.idx[sl].filter((e) => e.pl.includes(g) && fws.includes(e.f));
        let done = 0, last = "";
        for (const e of list) { const r = rating(e.f, e.c, g); if (r) { done++; if (r.updated_at > last) last = r.updated_at; } }
        const u = url(t.name, t.subjects.length > 1 ? subject : "");
        rows.push({ t, subject, g, fws, total: list.length, done, last, u, status: !done ? 0 : done < list.length ? 1 : 2 });
      }
    }
    return rows.sort((a, b) => a.status - b.status || GRADES.indexOf(a.g) - GRADES.indexOf(b.g) || a.t.name.localeCompare(b.t.name));
  }
  const reminderText = (x) => `Hello ${x.t.name} team. Please finish rating your ${x.subject} standards for the K-12 Vertical Alignment audit (${x.done} of ${x.total} done so far). Your team's link: ${x.u}`;
  // One row per grade: every subject in that grade added up, with the grade link (?grade=6) that opens all of them.
  function gradeProgressRows() {
    const base = location.origin + location.pathname;
    return GRADES.map((g) => {
      const parts = teamProgressRows().filter((x) => x.g === g).sort((a, b) => S.meta.subjects.findIndex((s) => s.name === a.subject) - S.meta.subjects.findIndex((s) => s.name === b.subject));
      const total = parts.reduce((n, x) => n + x.total, 0), done = parts.reduce((n, x) => n + x.done, 0), last = parts.reduce((m, x) => (x.last > m ? x.last : m), "");
      return { g, parts, total, done, last, u: base + "?grade=" + g, status: !done ? 0 : done < total ? 1 : 2 };
    }).filter((x) => x.parts.length);
  }
  const gradeReminder = (x) => `Hello ${gname(x.g)} teachers. Please finish rating your standards for the K-12 Vertical Alignment audit. Still to do: ${x.parts.filter((p) => p.done < p.total).map((p) => `${p.subject} ${p.total - p.done} of ${p.total}`).join(", ")}. You can stop and come back any time. Your grade's link (all subjects): ${x.u}`;
  function teamLinks() {
    const by = S.progBy || "grade", rows = by === "grade" ? gradeProgressRows() : teamProgressRows(), f = S.progFilter || "todo";
    const shown = rows.filter((x) => (f === "todo" ? x.status < 2 : f === "done" ? x.status === 2 : true));
    const counts = [0, 1, 2].map((k) => rows.filter((x) => x.status === k).length);
    const STATUS = ["Not started", "In progress", "Done"];
    const bar = (x) => `<td><div class="pbar"><i style="width:${x.total ? (x.done / x.total) * 100 : 0}%"></i></div><small>${x.done} of ${x.total}</small></td>
        <td><span class="stat s${x.status}">${STATUS[x.status]}</span></td><td class="muted">${x.last ? new Date(x.last).toLocaleDateString() : "Never"}</td>`;
    const copy = (x, msg) => `<td class="prog-act"><button type="button" class="ghost sm" data-act="copy" data-u="${esc(x.u)}">Copy link</button>${x.status < 2 ? ` <button type="button" class="ghost sm" data-act="copy" data-u="${esc(msg)}">Copy reminder</button>` : ""}${x.done ? ` <button type="button" class="ghost sm danger" data-act="clear-part" data-g="${x.g}" data-s="${by === "grade" ? "" : esc(x.subject)}" data-l="${esc(by === "grade" ? gname(x.g) : `${x.t.name}${x.t.subjects.length > 1 ? " " + x.subject : ""} (${gname(x.g)}, ${x.subject})`)}">Clear</button>` : ""}</td>`;
    const row = by === "grade"
      ? (x) => `<tr class="st${x.status}"><td><b>${esc(gname(x.g))}</b></td><td class="prog-subj">${x.parts.map((p) => `<span class="ps-s ${p.done === p.total ? "ok" : ""}" title="${esc(p.t.name)}">${esc(p.subject)} <b>${p.done === p.total ? "✓" : `${p.done}/${p.total}`}</b></span>`).join("")}</td>${bar(x)}${copy(x, gradeReminder(x))}</tr>`
      : (x) => `<tr class="st${x.status}"><td><b>${esc(x.t.name)}</b>${x.t.subjects.length > 1 ? ` · ${esc(x.subject)}` : ""}</td><td>${x.fws.map(badge).join(" ")}</td>${bar(x)}${copy(x, reminderText(x))}</tr>`;
    $("#d-eyebrow").textContent = "Committee"; $("#d-title").textContent = "Team progress and links";
    $("#d-body").innerHTML = `<p class="lede">Who has finished, and who needs a reminder. <b>By grade</b> adds up every subject in a grade and gives one link that opens all of them. <b>By team</b> shows each team and subject on its own. ${hb("links")}</p>
      <div class="lib-tabs prog-by">${[["grade", "By grade"], ["team", "By team"]].map(([k, l]) => `<button type="button" class="lib-t ${by === k ? "on" : ""}" data-act="prog-by" data-b="${k}">${l}</button>`).join("")}</div>
      <div class="prog-sum"><span class="ps ps0"><b>${counts[0]}</b> not started</span><span class="ps ps1"><b>${counts[1]}</b> in progress</span><span class="ps ps2"><b>${counts[2]}</b> done</span></div>
      <div class="prog-bar-row"><div class="lib-tabs">${[["todo", "Need a reminder"], ["done", "Done"], ["all", "All"]].map(([k, l]) => `<button type="button" class="lib-t ${f === k ? "on" : ""}" data-act="prog-filter" data-f="${k}">${l}</button>`).join("")}</div>
        ${counts[0] + counts[1] ? `<button type="button" class="sm" data-act="copy-all-reminders">Copy reminders for all ${counts[0] + counts[1]} unfinished</button>` : ""}</div>
      <table class="prog"><thead><tr><th>${by === "grade" ? "Grade" : "Team"}</th><th>${by === "grade" ? "Subjects" : "Sets"}</th><th>Progress</th><th>Status</th><th>Last rated</th><th></th></tr></thead><tbody>
      ${shown.map(row).join("") || `<tr><td colspan="6" class="muted">${f === "done" ? (by === "grade" ? "No grade has finished yet." : "No team has finished yet.") : "Everyone is done."}</td></tr>`}
      </tbody></table>
      <p class="muted" style="margin-top:10px">A grade link (for example ${esc(location.origin + location.pathname)}?grade=6) opens every subject in that grade. Teachers can do the subjects in any order, stop, and come back: each subject shows how many are left.</p>
      <div id="copies" class="copies"><p class="muted">Loading saved copies...</p></div>`;
    if (!$("#detail").open) $("#detail").showModal();
    renderCopies();
  }
  // Saved copies (committee): Save a copy of the whole vertical alignment, Load one back, Clear a part (a team, grade,
  // subject or course), Undo a Clear, a Load or an Undo (all of it or one part) and Delete a copy. Each asks for the PIN,
  // which only the database checks (migration 006); Clear, Load and Undo keep what they replace as a copy first.
  const COPY_KIND = { save: "Saved copy", clear: "Cleared", load: "Kept before a load", undo: "Kept before an undo" };
  const partLabel = (g, sub) => `${g ? gname(g) : "Every grade"}, ${sub || "every subject"}`;
  function fwSubject(f) { for (const x of S.meta.subjects) if ((S.idx[x.slug] || []).some((e) => e.f === f)) return x.name; return ""; }
  function ratingsIn(g, sub) { let n = 0; const fs = new Map(); for (const r of S.ratings.values()) { if (g && r.grade !== g) continue; if (sub) { if (!fs.has(r.framework)) fs.set(r.framework, fwSubject(r.framework)); if (fs.get(r.framework) !== sub) continue; } n++; } return n; }
  function askPin(title, text, part) {
    return new Promise((done) => {
      const d = document.createElement("dialog"); d.className = "pin-dlg";
      const opts = (vals, all) => `<option value="">${all}</option>` + vals.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("");
      d.innerHTML = `<form><h3>${esc(title)}</h3><p>${text}</p>
        ${part ? `<div class="pin-part"><b>Which part</b>${part.grade ? ` <span>${esc(gname(part.grade))}</span>` : `<label>Grade <select name="g">${opts(GRADES.map((g) => [g, gname(g)]), "Every grade")}</select></label>`}
          ${part.subject ? ` <span>${esc(part.subject)}</span>` : `<label>Subject <select name="s">${opts(S.meta.subjects.map((x) => [x.name, x.name]), "Every subject")}</select></label>`}</div>` : ""}
        <label class="pin-in">PIN <input name="pin" type="password" inputmode="numeric" autocomplete="off" required></label>
        <div class="pin-btns"><button type="button" class="ghost" data-x="cancel">Cancel</button> <button type="submit">Go ahead</button></div></form>`;
      document.body.appendChild(d);
      const f = d.querySelector("form"); let ok = false;
      d.querySelector('[data-x="cancel"]').onclick = () => d.close();
      f.onsubmit = (ev) => { ev.preventDefault(); ok = true; d.close(); };
      d.onclose = () => { const r = ok ? { pin: f.pin.value, grade: f.g ? f.g.value || null : part?.grade || null, subject: f.s ? f.s.value || null : part?.subject || null } : null; d.remove(); done(r); };
      d.showModal(); f.pin.focus();
    });
  }
  async function copyCall(fn, body, msg) {
    try { const r = await rpc(fn, body); await Promise.all([loadRatings(true), loadEvents()]); rerender(); toast(msg(r)); return true; }
    catch (err) { toast(/wrong pin/i.test(err.message) ? "Wrong PIN. Nothing was changed." : "That did not work: " + err.message); return false; }
    finally { if ($("#detail").open && $("#copies")) teamLinks(); }
  }
  async function renderCopies() {
    const box = $("#copies"); if (!box) return;
    let list = [];
    try { list = await getAll("rating_archives?select=*&order=created_at.desc"); } catch (err) { box.innerHTML = `<p class="muted">Saved copies could not be loaded (${esc(err.message)}).</p>`; return; }
    S.copies = list;
    const sel = (id, vals, all) => `<select id="${id}"><option value="">${all}</option>${vals.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("")}</select>`;
    const when = (t) => new Date(t).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    const what = (x) => x.kind === "save" ? "Saved copy of the whole vertical alignment" : x.kind === "clear" ? `Cleared: ${x.scope}` : x.kind === "load" ? `${x.name} (kept before the load)` : `${x.name} (${x.scope})`;
    const acts = (x) => [x.kind === "save" ? `<button type="button" class="ghost sm" data-act="copy-load" data-id="${x.id}">Load</button>` : "",
      x.kind !== "save" && !x.undone_at ? `<button type="button" class="ghost sm" data-act="copy-undo" data-id="${x.id}">Undo</button>` : "",
      `<button type="button" class="ghost sm danger" data-act="copy-delete" data-id="${x.id}">Delete</button>`].filter(Boolean).join(" ");
    box.innerHTML = `<h3>Saved copies ${hb("copies")}</h3>
      <p class="muted">Every button here asks for the PIN. Clear, Load and Undo first keep a copy of what they replace, listed below, so nothing is lost.</p>
      <div class="copy-row"><label>Name <input id="copy-name" type="text" maxlength="80" placeholder="for example 2026-27 first round"></label>
        <button type="button" class="sm" data-act="copy-save">Save a copy</button>
        <button type="button" class="ghost sm" data-act="copy-new">Save a copy and start a new one</button> ${hb("copy_new")}</div>
      <div class="copy-row"><b>Clear a part</b> <label>Grade ${sel("clr-g", GRADES.map((g) => [g, gname(g)]), "Every grade")}</label>
        <label>Subject ${sel("clr-s", S.meta.subjects.map((x) => [x.name, x.name]), "Every subject")}</label>
        <button type="button" class="ghost sm danger" data-act="clear-part" data-pick="1">Clear</button> ${hb("clear")}</div>
      <table class="prog copies-t"><thead><tr><th>Copy</th><th>Ratings</th><th>When</th><th></th></tr></thead><tbody>
      ${list.map((x) => `<tr><td><b>${esc(x.kind === "save" ? x.name : COPY_KIND[x.kind])}</b><br><small class="muted">${esc(what(x))}${x.undone_at ? ` · undone ${esc(when(x.undone_at))}` : ""}</small></td><td>${x.row_count}</td><td class="muted">${esc(when(x.created_at))}</td><td class="prog-act">${acts(x)}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">No saved copies yet.</td></tr>`}
      </tbody></table>`;
  }
  async function copyAct(act, b) {
    const dev = S.device || "", byId = (id) => (S.copies || []).find((x) => String(x.id) === String(id));
    if (act === "clear-part") {
      const g = b.dataset.pick ? $("#clr-g").value || null : b.dataset.g || null, sub = b.dataset.pick ? $("#clr-s").value || null : b.dataset.s || null;
      const label = b.dataset.l || partLabel(g, sub), n = ratingsIn(g, sub);
      if (!n) { toast(`${label}: nothing is rated, so there is nothing to clear.`); return; }
      const a = await askPin(`Clear ${label}`, `This takes off <b>${n}</b> rating${n > 1 ? "s" : ""} (${esc(partLabel(g, sub))}). A copy is kept first, so you can Undo it under Saved copies.`); if (!a) return;
      await copyCall("clear_part", { p_pin: a.pin, p_grade: g, p_subject: sub, p_device: dev }, () => `${label} cleared. Undo it under Saved copies.`);
    } else if (act === "copy-save" || act === "copy-new") {
      const name = $("#copy-name").value.trim(); if (!name) { toast("Give the copy a name first."); $("#copy-name").focus(); return; }
      const n = ratingsIn(null, null);
      const a = await askPin(act === "copy-save" ? `Save "${name}"` : `Save "${name}" and start a new one`, act === "copy-save" ? `Saves a copy of all <b>${n}</b> ratings. Nothing changes on the site.` : `Saves a copy of all <b>${n}</b> ratings, then takes every rating off so the teams can start again. You can Load the copy or Undo the clear later.`); if (!a) return;
      const saved = await copyCall("save_copy", { p_pin: a.pin, p_name: name }, () => `"${name}" saved.`);
      if (saved && act === "copy-new") await copyCall("clear_part", { p_pin: a.pin, p_grade: null, p_subject: null, p_device: dev }, () => `"${name}" saved and every rating cleared. A new vertical alignment can start.`);
    } else if (act === "copy-load") {
      const x = byId(b.dataset.id); if (!x) return;
      const a = await askPin(`Load "${x.name}"`, `Every rating on the site (<b>${ratingsIn(null, null)}</b> now) is replaced by the <b>${x.row_count}</b> in "${esc(x.name)}". The ratings on the site now are kept as a copy first, so you can Undo the load.`); if (!a) return;
      await copyCall("load_copy", { p_pin: a.pin, p_archive_id: x.id, p_device: dev }, () => `"${x.name}" loaded. Undo it under Saved copies.`);
    } else if (act === "copy-undo") {
      const x = byId(b.dataset.id); if (!x) return;
      const a = await askPin(`Undo: ${COPY_KIND[x.kind]}`, `Puts back the ratings this change replaced (${esc(x.scope)}, ${x.row_count} rating${x.row_count === 1 ? "" : "s"}): all of it, or choose one grade or subject. The ratings in that part now are kept as a copy first.`, { grade: x.grade, subject: x.subject }); if (!a) return;
      await copyCall("undo_copy", { p_pin: a.pin, p_archive_id: x.id, p_grade: a.grade, p_subject: a.subject, p_device: dev }, (r) => `Undone (${partLabel(a.grade, a.subject)}): ${r} rating${r === 1 ? "" : "s"} put back.`);
    } else if (act === "copy-delete") {
      const x = byId(b.dataset.id); if (!x) return;
      const a = await askPin(`Delete "${x.kind === "save" ? x.name : COPY_KIND[x.kind]}"`, `Deletes this copy for good${x.kind === "save" ? "" : ", so it can no longer be undone"}. The ratings on the site do not change.`); if (!a) return;
      await copyCall("delete_copy", { p_pin: a.pin, p_archive_id: x.id }, () => "Copy deleted.");
    }
  }
  function rerender() {
    const v = S.view; laneMemo.clear(); causeMemo.clear();
    if (v === "flow") renderFlow(); else if (v === "rate") renderRate(); else if (v === "heatmap") renderHeatmap(); else if (v === "gaps") renderGaps();
    else if (v === "dashboard") renderDashboard(); else if (v === "ladder") renderLadder(); else if (v === "plans") renderPlans(); else renderActivity();
    writeHash();
  }

  function segFor(e, g) {
    const r = rating(e.f, e.c, g);
    return `<div class="seg" role="group" aria-label="Rating for ${esc(e.c)} in ${esc(gname(g))}">` +
      [0, 1, 2].map((l) => `<button data-act="rate" data-k="${esc(e.f + "|" + e.c)}" data-g="${g}" data-l="${l}" aria-pressed="${r && r.level === l}">${LEVEL_SHORT[l]}</button>`).join("") + `</div>`;
  }
  // Every standard shows its main code in bold with one small italic line underneath, the same way in every subject,
  // grade and view (codeHTML). The main code is the one the school's plans use:
  //   Math and ELA: the Common Core code, with the Wisconsin code underneath. Math: M.5.MD.A.1 is 5.MD.A.1, M.A.APR.A.1
  //     is HSA-APR.A.1 (Wisconsin's SP is Common Core's S). ELA: Wisconsin 2020 renumbered the standards, so e.cw holds
  //     the Common Core 2010 code(s) from DPI's official comparison (R.6.1 is RL.6.1 · RI.6.1, W.6.2.a is W.6.1, L.6.5.a
  //     is L.6.1). A standard that is new in Wisconsin 2020 has no Common Core code and says so.
  //   Essential Elements follow their standard: M.EE.6.NS.5 is EE.6.NS.5, M.EE.A.CED.1 is EE.A-CED.1, and an ELA EE takes
  //     the Common Core code of the standard it links to (EE.R.6.1 is EE.RL.6.1 · EE.RI.6.1, EE.W.6.2.a is EE.W.6.1).
  //   NGSS, AERO Science and AERO Social Studies: their own code, with the matching Wisconsin codes (e.wi) underneath.
  //   Anything with no second code (Wisconsin Social Studies, other EEs): its own code, with its set or linked standard.
  function ccss(e) {
    if (e.cw) return e.cw.length ? e.cw : null;           // [] = new in Wisconsin, no Common Core code
    if (e.f === "WI-EE-MATH") {
      const k = e.c.match(/^M\.EE\.([K0-9]+)\.(.+)$/), h = e.c.match(/^M\.EE\.(N|A|F|G|SP|S)\.([A-Z]+)\.(.+)$/);
      return k ? [`EE.${k[1]}.${k[2]}`] : h ? [`EE.${h[1] === "SP" ? "S" : h[1]}-${h[2]}.${h[3]}`] : null;
    }
    if (e.f === "WI-EE-ELA" && e.lk) {
      const base = S.byKey.get(e.lk[0].replace(":", "|"));
      return base && base.cw ? base.cw.map((c) => "EE." + c) : null;
    }
    const m = e.f === "WI-CC-MATH" && e.c.match(/^M\.([K0-9]+|N|A|F|G|SP)\.([A-Z]{1,4})\.([A-D])\.(\d+)(?:\.([a-z]))?$/);
    if (!m) return null;
    const [, d, dom, clu, n, sub] = m, tail = `${clu}.${n}${sub || ""}`;
    return [/^[K0-9]+$/.test(d) ? `${d}.${dom}.${tail}` : `HS${d === "SP" ? "S" : d}-${dom}.${tail}`];
  }
  function codeParts(e) {
    const cc = ccss(e);
    if (cc) return { main: cc, alt: "Wisconsin " + e.c };
    if (e.wi) return { main: [e.c], alt: "Wisconsin " + e.wi.join(" · ") };
    // New in Wisconsin 2020: "WI" in front, so W.7.1 (Wisconsin, new) never looks like Common Core W.7.1 (Wisconsin W.7.2.a).
    if (e.f === "WI-CC-ELA") return { main: ["WI " + e.c], alt: "New in Wisconsin 2020 (no Common Core code)" };
    if (e.f === "WI-CC-MATH") return { main: ["WI " + e.c.replace(/^M\./, "")], alt: "New in Wisconsin 2021 (no Common Core code)" };
    const lk = e.lk && e.lk[0], base = lk && S.byKey.get(lk.replace(":", "|"));
    return { main: [e.c], alt: lk ? "Essential Element for " + (base ? codeText(base) : lk.split(":")[1])
      : e.f === "NGSS" || e.f.startsWith("AERO-") ? "No Wisconsin match" : FW_NAME[e.f] || e.f };
  }
  // A few Wisconsin 2020 ELA rows gather parts of several 2010 standards; show three codes and count the rest.
  // Several Wisconsin rows can come from one Common Core standard (Wisconsin L.3.5.a to e are all Common Core L.3.1);
  // e.part = [n, of] numbers them (set in start()) so no two standards show the same bold code.
  const codeText = (e) => { const m = codeParts(e).main, t = m.length > 3 ? m.slice(0, 3).join(" · ") + " +" + (m.length - 3) : m.join(" · "); return e.part ? `${t} (part ${e.part[0]} of ${e.part[1]})` : t; };
  const altText = (e) => codeParts(e).alt;
  // In sentences: one code per standard (a Wisconsin row that gathers several Common Core codes is named by its own code).
  const codeMsg = (e) => (codeParts(e).main.length > 1 ? `${codeText(e)} (Wisconsin ${e.c})` : e.f === "AERO-SS" ? "AERO " + e.c : codeText(e));
  // The main code (a button that opens the standard) and the italic line underneath it.
  const codeHTML = (e, q) => `<span class="cd"><button class="code" data-act="open" data-k="${esc(e.f + "|" + e.c)}" title="${esc(codeParts(e).main.join(" · "))}">${hl(codeText(e), q)}</button><span class="wi-code">${hl(altText(e), q)}</span></span>`;
  const searchQ = () => (mode() === "full" ? S.f.search : "");   // the committee's search words, highlighted where they match
  // The same two lines as plain text, for lists and tips that are buttons themselves.
  const codeLines = (e) => `<span class="cd"><b>${esc(codeText(e))}</b><i class="wi-code">${esc(altText(e))}</i></span>`;

  /* ---------------- plans and priority standards ---------------- */
  // From the school's own curriculum documents (scripts/audit/plan_marks.py): e.pn = grades whose plans cite the
  // standard; e.pr = grades that name it a priority standard (Grades 6-12, Ma3loomat curriculum maps and scope and
  // sequence) or a power standard (K-5, Curriculum Hub); e.pa = grades given the standard because their plans cite it
  // (high school Math and middle school Science rate the standards their documents cite plus their current placement).
  // Marks use a shape and a word as well as colour, and never the rating colours.
  // Tim (Oct 2026): the "In curriculum docs" mark is hidden everywhere on the site. The data stays in plan_marks.json
  // and the index (e.pn); set SHOW_PLANS to true to bring the mark, filters and checks back. Placement added from the
  // documents (e.pa) still applies.
  const SHOW_PLANS = false;
  // Grades 6-12 call them priority standards, K-5 power standards. With no grade, the grades in view decide.
  const prName = (g) => {
    if (g) return DIV.Elementary.includes(g) ? "Power" : "Priority";
    const vg = visibleGrades(), el = vg.filter((x) => DIV.Elementary.includes(x)).length;
    return el === vg.length ? "Power" : el === 0 ? "Priority" : "Priority (6-12) / Power (K-5)";
  };
  const prWords = (g) => { const n = prName(g); return n.includes("/") ? "priority (6-12) or power (K-5)" : n.toLowerCase(); };
  const inGrades = (arr, g) => !!arr && (g ? arr.includes(g) : arr.some((x) => visibleGrades().includes(x)));
  const isPr = (e, g) => inGrades(e.pr, g), isPn = (e, g) => SHOW_PLANS && inGrades(e.pn, g);
  const gList = (arr) => arr.filter((x) => visibleGrades().includes(x)).map(gl).join(", ");
  function marks(e, g) {
    const out = [];
    if (isPr(e, g)) out.push(`<span class="mk mk-pr" title="${isEE(e.f) ? "An Essential Element linked to a priority or power standard (it takes the mark from that standard)" : g ? `A ${prName(g).toLowerCase()} standard for ${esc(gname(g))} in the school's curriculum documents` : "Priority (6-12) or power (K-5) standard in " + esc(gList(e.pr))}">★ ${g ? prName(g) : e.pr.every((x) => DIV.Elementary.includes(x)) ? "Power" : e.pr.every((x) => !DIV.Elementary.includes(x)) ? "Priority" : "Priority / power"}${isEE(e.f) ? " (linked)" : ""}${g ? "" : " " + esc(gList(e.pr))}</span>`);
    if (isPn(e, g)) out.push(`<span class="mk mk-pn" title="${g ? `${esc(gname(g))}'s curriculum documents cite this standard (from course maps, scope and sequence, pacing guides, storyboards, grade overviews and maps, and Kindergarten weekly plans)` : "Cited in the curriculum documents of " + esc(gList(e.pn))}. Documents: course maps, scope and sequence, pacing guides, storyboards, grade overviews and maps, and Kindergarten weekly plans.">✓ In curriculum docs${g ? "" : " " + esc(gList(e.pn))}</span>`);
    if (g && e.pa && e.pa.includes(g)) out.push(`<span class="tag sg">${SHOW_PLANS ? `Added from ${esc(gname(g))} curriculum docs` : `Also rated in ${esc(gname(g))}`}</span>`);
    return out.join("");
  }
  // The Show filter (all, priority, in plans, not in plans) and the Order choice are committee and Explore tools.
  // On a grade's views they are about that grade; on K-12 views, about any grade in view.
  const markGrade = () => (S.view === "rate" ? teamGrade() : ["dashboard", "plans"].includes(S.view) ? S.f.grade : "");
  function markOk(e) {
    const m = mode() === "full" ? S.f.mark : "", g = markGrade();
    return !m || (m === "pr" ? isPr(e, g) : m === "pn" ? isPn(e, g) : !isPn(e, g));
  }
  // Order within each strand: priority first, or in plans first. Strands keep their curriculum order.
  function ordered(list, g) {
    const o = mode() === "full" ? S.f.order : ""; if (!o) return list;
    const first = new Map(); list.forEach((e, i) => { const k = e.f + "|" + e.s; if (!first.has(k)) first.set(k, i); });
    const rank = (e) => (o === "pr" ? (isPr(e, g) ? 0 : isPn(e, g) ? 1 : 2) : (isPn(e, g) ? 0 : isPr(e, g) ? 1 : 2));
    return list.map((e, i) => ({ e, i, s: first.get(e.f + "|" + e.s), r: rank(e) })).sort((a, b) => a.s - b.s || a.r - b.r || a.i - b.i).map((x) => x.e);
  }
  function stdRow(e, g, note) {
    const r = rating(e.f, e.c, g);
    const tags = [];
    tags.push(badge(e.f));
    if (e.lk && e.lk.length) tags.push(`<span class="tag">Linked to ${esc(e.lk[0].split(":")[1])}${e.lk.length > 1 ? " +" + (e.lk.length - 1) : ""}</span>`);
    if (e.ee) { const ee = e.ee.split(";")[0].trim(); tags.push(`<span class="tag">${/^(M\.)?EE/.test(ee) || ee.startsWith("SS.EE") ? "" : "EE "}${esc(ee)}</span>`); }
    if (note) tags.push(`<span class="tag sg">${esc(note)}</span>`);
    const mk = marks(e, g), k = rkey(e.f, e.c, g);
    return `<div class="std set-${SET(e.f).style} ${r ? "rated l" + r.level : ""} ${S.flash === k ? "flash" : ""}"><div>${codeHTML(e, searchQ())}${mk ? `<div class="mks">${mk}</div>` : ""}</div>
      <div><div class="txt">${hl(e.t, searchQ())}${e.t.length >= 220 ? "…" : ""}</div><div class="tags">${tags.join("")}</div></div>
      <div>${segFor(e, g)}</div>${r ? `<div class="who">${esc(r.team)} · ${new Date(r.updated_at).toLocaleDateString()} ${S.canClear ? `· <button type="button" class="linkish" data-act="clear" data-k="${esc(e.f + "|" + e.c)}" data-g="${g}">Remove</button>` : ""}</div>` : ""}</div>`;
  }
  function groupByStrand(list, g, noteFn) {
    let html = "", last = null;
    for (const e of list) {
      if (e.f + e.s !== last) {
        const inS = list.filter((x) => x.s === e.s && x.f === e.f), c = countLevels(inS, g), done = inS.length - c[3];
        html += `<div class="strand ${c[3] ? "" : "done"}"><span>${badge(e.f)} ${esc(e.s || "Standards")}</span>${miniBar(c, `${done} of ${inS.length} rated`)}<span class="strand-n">${c[3] ? `${done}/${inS.length}` : "✓ all rated"}</span></div>`;
        last = e.f + e.s;
      }
      html += stdRow(e, g, noteFn && noteFn(e));
    }
    return html;
  }
  // One line above a grade's list: how many are priority / power and in plans, and how many of those are rated.
  function markSummary(list, g) {
    const pr = list.filter((e) => isPr(e, g)), pn = list.filter((e) => isPn(e, g)), rated = (l) => l.filter((e) => rating(e.f, e.c, g)).length;
    if (!pr.length && !pn.length) return "";
    return `<p class="mk-sum"><span class="mk mk-pr">★ ${prName(g)}</span> ${pr.length} (${rated(pr)} rated) · ${SHOW_PLANS ? `<span class="mk mk-pn">✓ In curriculum docs</span> ${pn.length} (${rated(pn)} rated) · ` : ""}${list.length} in all ${hb("marks")}</p>`;
  }
  // c = [not taught, introduced, in depth, not rated] for a list of standards in grade g
  function countLevels(list, g) { const c = [0, 0, 0, 0]; for (const e of list) { const r = rating(e.f, e.c, g); c[r ? r.level : 3]++; } return c; }
  // Thin stacked bar: in depth, introduced, not taught, then unrated track. 2px gaps between fills.
  function miniBar(c, label) {
    const n = c[0] + c[1] + c[2] + c[3] || 1;
    return `<span class="mini" role="img" aria-label="${esc(label || "")}">${[2, 1, 0].map((i) => (c[i] ? `<i style="flex:${c[i] / n};background:${COLORS[i]}"></i>` : "")).join("")}${c[3] ? `<i class="rest" style="flex:${c[3] / n}"></i>` : ""}</span>`;
  }
  // Ring chart of a grade's progress with % rated in the middle.
  function donut(c, size = 84) {
    const n = c[0] + c[1] + c[2] + c[3] || 1, r = 15.9, C = 2 * Math.PI * r, gap = c[3] === n ? 0 : 0.6;
    let off = 0, arcs = "";
    for (const i of [2, 1, 0]) {
      if (!c[i]) continue;
      const len = (c[i] / n) * C;
      arcs += `<circle r="${r}" cx="20" cy="20" fill="none" stroke="${COLORS[i]}" stroke-width="4.2" stroke-dasharray="${Math.max(len - gap, 0.1)} ${C}" stroke-dashoffset="${-off}" class="arc"><title>${LEVEL[i]}: ${c[i]}</title></circle>`;
      off += len;
    }
    const pct = c[0] + c[1] + c[2] + c[3] ? Math.round(((n - c[3]) / n) * 100) : 0;
    return `<svg class="donut" width="${size}" height="${size}" viewBox="0 0 40 40" role="img" aria-label="${pct}% rated">
      <circle r="${r}" cx="20" cy="20" fill="none" stroke="var(--chip)" stroke-width="4.2"></circle><g transform="rotate(-90 20 20)">${arcs}</g>
      <text x="20" y="21.5" text-anchor="middle" class="donut-n">${pct}%</text><text x="20" y="27.5" text-anchor="middle" class="donut-l">rated</text></svg>`;
  }
  function celebrate(msg, action) {
    toast(msg, action);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = document.createElement("div"); box.className = "confetti"; box.setAttribute("aria-hidden", "true");
    const cols = [COLORS[2], COLORS[1], COLORS[0], COLORS.accent, COLORS.maroon];
    for (let i = 0; i < 70; i++) {
      const b = document.createElement("i");
      b.style.cssText = `left:${Math.random() * 100}vw;background:${cols[i % cols.length]};animation-delay:${Math.random() * 0.4}s;animation-duration:${1.4 + Math.random()}s;transform:rotate(${Math.random() * 360}deg)`;
      box.append(b);
    }
    document.body.append(box); setTimeout(() => box.remove(), 3000);
  }
  function progressBar(list, g) {
    const c = [0, 0, 0, 0];
    for (const e of list) { const r = rating(e.f, e.c, g); c[r ? r.level : 3]++; }
    const n = list.length || 1;
    const seg = (i, col) => (c[i] ? `<i style="width:${(c[i] / n) * 100}%;background:${col}"></i>` : "");
    return `<div class="progress"><div class="bar">${seg(2, COLORS[2])}${seg(1, COLORS[1])}${seg(0, COLORS[0])}</div>
      <span>${list.length - c[3]} of ${list.length} rated · ${c[2]} in depth</span></div>`;
  }

  // The default framework for a subject and grade, also the one each "still to rate" count uses so a standard
  // listed in two frameworks is not counted twice. Social Studies is AERO in K-5 (the only grades AERO covers) and
  // Wisconsin in 6-12; Science is AERO in K-5 (NGSS is not offered there) and NGSS in 6-12. Teams can still choose other sets.
  function countFramework(subject, g) {
    if (subject === "Science") return DIV.Elementary.includes(g) ? "AERO-SCI" : "NGSS";
    if (subject === "Social Studies") return DIV.Elementary.includes(g) ? "AERO-SS" : "WI-SS";
    return subject === "Math" ? "WI-CC-MATH" : subject === "ELA" ? "WI-CC-ELA" : null;
  }
  // The team that rates a subject in grade g, and the standard sets it chose (saved for the whole team in team_sets).
  // Until a team chooses, it works through the default set above plus its Essential Elements (ticked by default).
  // The course a secondary grade teaches in one subject (each course is one team and one grade: Algebra 1 = Grade 9 Math).
  const courseOf = (g, subject) => { if (!S.teams || DIV.Elementary.includes(g)) return ""; const t = teamOf(g, subject); return t ? t.name.replace(/^Grade \d+ /, "") : ""; };
  // A standard's own words: a lettered part (L.7.4.a) repeats its parent's stem, so show the part's text after it.
  function partText(e, n) {
    const t = fullText2(e), m = /\.([a-z])$/.exec(e.c), i = m ? t.search(new RegExp(`(^|\\s)${m[1]}[.)]\\s`)) : -1;
    const own = i > 0 ? "… " + t.slice(i).trim() : t; return own.length > n ? own.slice(0, n).replace(/\s+\S*$/, "") + "…" : own;
  }
  // A short grade label with the course for the subject in view (G9 Algebra 1), for lists.
  const glc = (g) => { const c = courseOf(g, S.f.subject); return c && c !== S.f.subject ? `${gl(g)} ${c}` : gl(g); };
  const gradeCourse = (g, subject) => { const c = courseOf(g, subject); return c ? `${gname(g)} · ${c}` : gname(g); };
  const teamOf = (g, subject) => S.teams.find((t) => t.name !== "Vertical Alignment Committee" && t.grades.includes(g) && t.subjects.includes(subject));
  function setsFor(subject, g, team) {
    const t = team || teamOf(g, subject), saved = t && S.teamSets[t.name] && S.teamSets[t.name][subject];
    const fws = S.meta.subjects.find((x) => x.name === subject).frameworks;
    // Default: the main set plus its Essential Elements, when the grade has any.
    const sl = S.meta.subjects.find((x) => x.name === subject).slug, ee = fws.find((f) => f.startsWith("WI-EE-"));
    const deflt = [countFramework(subject, g), ee && S.idx[sl].some((e) => e.f === ee && e.pl.includes(g)) ? ee : null];
    const list = (saved && saved.filter((f) => fws.includes(f)).length ? saved.filter((f) => fws.includes(f)) : deflt).filter(Boolean);
    return list.sort((a, b) => SET_ORDER(a) - SET_ORDER(b));
  }
  const chosen = (subject, team) => !!(team && S.teamSets[team.name] && S.teamSets[team.name][subject]);
  async function loadTeamSets() {
    const rows = await getAllOnce(Q.sets); S.teamSets = {};
    for (const r of rows) (S.teamSets[r.team] ||= {})[r.subject] = r.frameworks;
    S.setsLoaded = true;
  }
  const defaultFramework = (subject, g) => (subject === "Math" || subject === "ELA" || ((subject === "Social Studies" || subject === "Science") && !g) ? "" : countFramework(subject, g) || "");
  // Unrated grade-level standards per subject (counted framework only), and unrated standards left in e's strand.
  function toRateLeft(g) {
    const out = {};
    for (const s of S.meta.subjects) { const fws = setsFor(s.name, g); out[s.name] = S.idx[s.slug].filter((e) => e.pl.includes(g) && fws.includes(e.f) && !rating(e.f, e.c, g)).length; }
    return out;
  }
  const teacherLeft = (g) => flowSubjects().reduce((n, sb) => n + flowList(sb, g).filter((x) => !rating(x.f, x.c, g)).length, 0);
  const strandLeft = (e, g) => items().filter((x) => x.s === e.s && x.f === e.f && x.pl.includes(g) && !rating(x.f, x.c, g)).length;
  // Grade-level standards (suggested for grade g) that no one has marked yet, per subject. The goal is 0 everywhere.
  function toRateStrip(g) {
    const subs = S.team.name === "Vertical Alignment Committee" ? S.meta.subjects.map((s) => s.name) : S.team.subjects;
    const chips = subs.map((name) => {
      const sl = S.meta.subjects.find((s) => s.name === name).slug;
      const fws = setsFor(name, g);
      const list = S.idx[sl].filter((e) => e.pl.includes(g) && fws.includes(e.f));
      const left = list.filter((e) => !rating(e.f, e.c, g)).length;
      return `<button type="button" class="torate ${left ? "" : "done"} ${name === S.f.subject ? "on" : ""}" data-act="subject" data-s="${esc(name)}" data-fw=""
        title="${left} of ${list.length} ${esc(name)} standards for ${esc(gname(g))} not rated yet (${fws.map((f) => esc(FW_NAME[f] || f)).join(" + ")})"><b>${left}</b> ${esc(name)} ${fws.map(badge).join("")}${left ? "" : " ✓"}</button>`;
    }).join("");
    return `<div class="torate-row"><span class="muted">Still to rate in ${esc(gname(g))}:</span> ${chips} ${hb("torate")}</div>`;
  }

  /* ---------------- teacher flow: one standard at a time ---------------- */
  // A grade link (?grade=6) opens every subject in that grade. Each subject is rated as its own team (Grade 6 Math, ...).
  const flowSubjects = () => (S.lock && S.lock.grade ? S.meta.subjects.map((s) => s.name).filter((s) => teamOf(S.lock.grade, s)) : S.team.subjects);
  const subjTeam = (subject, g) => (S.team.subjects.includes(subject) ? S.team : teamOf(g, subject) || S.team);
  // The grade-level list a teacher works through for one subject, in document order (strand by strand).
  // Chosen sets are worked through one after another (all Common Core, then all Essential Elements, and so on).
  function flowList(subject, g, onlySet) {
    const sl = S.meta.subjects.find((s) => s.name === subject).slug, fws = setsFor(subject, g, subjTeam(subject, g));
    return fws.filter((f) => !onlySet || f === onlySet).flatMap((f) => S.idx[sl].filter((e) => e.f === f && e.pl.includes(g)));
  }
  // Set chooser: which standard sets the team works through for this subject (saved for everyone on the team).
  function setChooser(subject, g, first) {
    const sl = S.meta.subjects.find((s) => s.name === subject).slug, fws = S.meta.subjects.find((s) => s.name === subject).frameworks.slice().sort((a, b) => SET_ORDER(a) - SET_ORDER(b));
    const cur = setsFor(subject, g, S.team);
    const DESC = { cc: "The grade-level Common Core standards.", ee: "The alternate standards for students with significant cognitive disabilities, one for each linked standard.",
      ngss: "Next Generation Science Standards performance expectations.", aero: "The AERO framework the school uses now.", wi: "Wisconsin's own standards." };
    return `<div class="card set-card"><h2>${first ? "Which standards is your team working through?" : "Change your standard sets"} ${hb("sets")}</h2>
      <p class="lede">${esc(subject)} for ${esc(gname(g))}. Tick one or more. If you tick more than one, you rate them one set at a time, and every card shows which set it belongs to. This choice is shared by everyone on your team.</p>
      <div class="set-opts">${fws.map((f) => { const n = S.idx[sl].filter((e) => e.f === f && e.pl.includes(g)).length; const x = SET(f);
        return n ? `<label class="set-opt set-${x.style}"><input type="checkbox" value="${esc(f)}" ${cur.includes(f) ? "checked" : ""}> ${badge(f)} <span><b>${esc(FW_NAME[f] || x.name)}</b><small>${n} standards for ${esc(gname(g))}. ${DESC[x.style]}</small></span></label>` : ""; }).join("")}</div>
      <div class="done-actions" style="justify-content:flex-start"><button type="button" data-act="sets-save" data-s="${esc(subject)}">Save and start</button>
        ${first ? "" : `<button type="button" class="ghost" data-act="sets-cancel">Cancel</button>`}</div></div>`;
  }
  // Index rows trim long standards; the card shows the full text from the detail file once it has loaded.
  function fullText(e) {
    const sub = S.meta.subjects.find((s) => S.idx[s.slug].includes(e)), det = sub && S.detail[sub.slug];
    if (!det) { if (sub) loadDetail(sub.slug).then(() => S.view === "flow" && rerender()).catch(() => {}); return e.t + (e.t.length >= 220 ? "…" : ""); }
    return (det[`${e.f}|${e.c}|${e.pl[0]}`] || {}).text || e.t;
  }
  function flowCurrent(list, g) {
    const F = S.flow;
    if (F.back) { const b = list.find((e) => rkey(e.f, e.c, g) === F.back); if (b) return b; F.back = null; }
    const open = list.filter((e) => !rating(e.f, e.c, g));
    return open.find((e) => !F.skipped.has(rkey(e.f, e.c, g))) || open[0] || null;
  }
  function welcome(el) {
    const groups = { "Elementary": [], "Middle school": [], "High school": [] };
    S.teams.forEach((t) => { if (t.name !== "Vertical Alignment Committee") (DIV.Elementary.includes(t.grades[0]) ? groups.Elementary : DIV.Middle.includes(t.grades[0]) ? groups["Middle school"] : groups["High school"]).push(t); });
    el.innerHTML = `<div class="flow-wrap"><div class="hero"><h2>Which team are you?</h2>
      <p class="lede">You will see your grade's standards, all on one page or one at a time. For each one, say how it is generally taught in your grade. Every answer saves as you go, and this device remembers your team.</p></div>
      ${Object.entries(groups).map(([g, ts]) => `<h3 class="pick-h">${g}</h3><div class="pick">${ts.map((t) => `<button type="button" class="pick-b" data-act="team" data-t="${esc(t.name)}">${esc(t.name)}</button>`).join("")}</div>`).join("")}
      <p class="muted committee-link"><button type="button" class="linkish" data-act="team" data-t="Vertical Alignment Committee">I am on the Vertical Alignment Committee</button></p></div>`;
  }
  function renderFlow() {
    const el = $("#view-flow");
    if (!S.team) return welcome(el);
    const g = teamGrade(), F = S.flow, subs = flowSubjects();
    if (!F.subject || !subs.includes(F.subject)) F.subject = subs.find((s) => flowList(s, g).some((e) => !rating(e.f, e.c, g))) || subs[0];
    if (S.lock && S.lock.grade) S.team = teamOf(g, F.subject);
    const pills = subs.length > 1 ? `<div class="subj-pills" role="tablist" aria-label="Subjects">${subs.map((s) => {
      const l = flowList(s, g), n = l.filter((e) => !rating(e.f, e.c, g)).length;
      return `<button type="button" role="tab" aria-selected="${s === F.subject}" class="subj ${n ? "" : "done"}" data-act="flow-subject" data-s="${esc(s)}">${esc(s)} <span>${n ? n + " left" : "✓"}</span></button>`;
    }).join("")}</div>` : "";
    if (F.choose === F.subject || (S.setsLoaded && !chosen(F.subject, S.team))) {
      el.innerHTML = `<div class="flow-wrap">${pills}${setChooser(F.subject, g, !chosen(F.subject, S.team))}</div>`;
      return;
    }
    const list = flowList(F.subject, g), done = list.filter((e) => rating(e.f, e.c, g)).length, left = list.length - done;
    const fwsNow = setsFor(F.subject, g, S.team);
    const pct = list.length ? (done / list.length) * 100 : 100, view = tview();
    const results = F.results === F.subject || (!left && F.reviewing !== F.subject);
    const setPills = `<div class="set-pills"><span class="muted">Standards:</span> ${fwsNow.map((f) => { const l = flowList(F.subject, g, f), n = l.filter((e) => !rating(e.f, e.c, g)).length;
        return `<button type="button" class="setp ${F.set === f ? "on" : ""} ${n ? "" : "done"}" data-act="flow-set" data-f="${esc(f)}" title="${esc(setTip(f))}">${badge(f)} ${esc(SET(f).name)} <span>${n ? n + " left" : "✓"}</span></button>`; }).join("")}
      <button type="button" class="linkish" data-act="sets-change">Change ${hb("sets")}</button></div>`;
    const head = `<div class="flow-head">${pills}${setPills}
      <div class="flow-progress"><div class="fp-bar"><i style="width:${pct}%"></i></div>
      <span><b>${done}</b> of ${list.length} rated · <b>${left}</b> left ${hb("flow")}</span></div>
      <p class="saved-note muted">Every answer saves the moment you click it. You can stop and come back any time with the same link.</p></div>`;
    let body;
    if (results) body = resultsPage(F.subject, g, list, subs);
    else if (view === "all") body = viewBar(view) + levelKey() + allView(list, g);
    else {
      const e = flowCurrent(F.set ? flowList(F.subject, g, F.set) : list, g) || flowCurrent(list, g);
      const k = rkey(e.f, e.c, g), r = rating(e.f, e.c, g), inSet = list.filter((x) => x.f === e.f), pos = inSet.indexOf(e) + 1, sx = SET(e.f);
      const newSet = F.lastSet && F.lastSet !== e.f; F.lastSet = e.f;
      const links = (e.lk || []).map((x) => x.split(":")[1]);
      const ee = e.ee ? e.ee.split(";")[0].trim() : "";
      const fresh = S.flow.lastKey !== k; S.flow.lastKey = k;
      body = `${viewBar(view)}${levelKey()}${newSet && fresh ? `<div class="set-switch">${badge(e.f)} Now: <b>${esc(FW_NAME[e.f] || sx.name)}</b> (${inSet.length} standards)</div>` : ""}<article class="card std-card set-${sx.style} ${fresh ? "enter" : ""}" data-k="${esc(k)}">
        <div class="card-top"><span class="eyebrow">${badge(e.f)} ${esc(sx.name)} · ${esc(e.s || F.subject)}</span><span class="muted">${pos} of ${inSet.length}</span></div>
        <h2 class="card-code">${codeHTML(e)} ${hb(ccss(e) ? "ccss" : e.wi ? "aero_wi" : "codes")}</h2>
        ${marks(e, g) ? `<div class="mks card-mks">${marks(e, g)} ${hb("marks")}</div>` : ""}
        <p class="card-text">${esc(fullText(e))}</p>
        <p class="card-meta">${links.length ? `Linked to ${links.slice(0, 3).map(esc).join(", ")}${links.length > 3 ? " and " + (links.length - 3) + " more" : ""} · ` : ee ? `Essential Element ${esc(ee)} · ` : ""}<button type="button" class="linkish" data-act="open" data-k="${esc(e.f + "|" + e.c)}">Full standard and "I can" levels</button>${e.sg ? ` · <span class="tag sg">Suggested placement</span>` : ""}</p>
        <p class="card-q">${r ? `Your answer: <b>${LEVEL[r.level]}</b>. Choose another answer to switch it${S.canClear ? `, or <button type="button" class="linkish" data-act="clear" data-k="${esc(e.f + "|" + e.c)}">remove it</button>` : ""}.` : `How is this generally taught in ${esc(gname(g))}?`} <button type="button" class="linkish" data-act="levels">What do the answers mean?</button></p>
        <div class="choices">${[0, 1, 2].map((l) => `<button type="button" class="choice c${l} ${r && r.level === l ? "on" : ""}" data-act="flow-rate" data-k="${esc(e.f + "|" + e.c)}" data-l="${l}">
          <kbd>${l + 1}</kbd><b>${["Not taught", "Introduced / exposed", "Taught in depth"][l]}</b><small>${LEVEL_HINT[l]}</small></button>`).join("")}</div>
        <div class="card-foot">
          <button type="button" class="linkish" data-act="flow-back" ${F.history.length ? "" : "disabled"}>← Previous</button>
          <span class="muted keys">Keys: 1, 2, 3 to answer · S to skip ${hb("flow_keys")}</span>
          <button type="button" class="linkish" data-act="flow-skip">Skip for now →</button></div>
      </article>${library(list, g)}
      <p class="flow-more"><button type="button" data-act="finish">Finish ${esc(F.subject)}</button> <button type="button" class="ghost" data-act="results">See my results so far</button></p>`;
    }
    el.innerHTML = `<div class="flow-wrap ${view === "all" && !results ? "wide" : ""}">${head}${body}</div>`;
  }

  /* ---------------- teacher views: all at once (default) or one at a time ---------------- */
  // Saved on this device. Sizes: s = one line per standard, m = full text, l = large cards with the answer meanings.
  const tview = () => S.flow.view || store.get("va_tview") || "all";
  const tsize = () => S.flow.size || store.get("va_tsize") || "m";
  const LEVEL_HINT = ["We do not teach this in our grade", "Met or covered briefly, not a main focus or assessed", "Taught directly, practised and assessed"];
  const LEVEL_DEF = [
    ["Not taught", "We do not teach this standard in our grade. Students may meet it in another grade, but not in our classes."],
    ["Introduced / exposed", "Students meet it or it is covered briefly. We may mention it, model it or use it inside another lesson, but it is not a main focus, and we do not expect mastery or assess it on its own."],
    ["Taught in depth", "We teach it directly, students practise it over several lessons, and we assess it. We expect most students to reach the standard."],
  ];
  const levelKey = () => `<div class="lvl-key"><span class="muted">Answers:</span>${LEVEL_DEF.map(([n], l) => `<span class="lk"><i class="lv lv-${l}"></i>${n}</span>`).join("")}<button type="button" class="linkish" data-act="levels">What do these mean?</button></div>`;
  function levelsDialog() {
    $("#d-eyebrow").textContent = "How to answer"; $("#d-title").textContent = "What the three answers mean";
    $("#d-body").innerHTML = `<p class="lede">For each standard, choose how it is <b>generally</b> taught in your grade: what usually happens in your classes, not just this term.</p>
      <div class="lvl-defs">${LEVEL_DEF.map(([n, d], l) => `<div class="lvl-def l${l}"><h3><i class="lv lv-${l}"></i>${n}</h3><p>${d}</p><p class="muted">${["Example: it is not in any of our units, or another grade teaches it.", "Example: students use it in a project or warm-up, but we never teach a lesson on it or test it.", "Example: we have lessons on it, students practise it, and it is in our assessments."][l]}</p></div>`).join("")}</div>
      <p class="muted">Not sure? Choose the answer closest to what usually happens. You can change any answer later, and every answer is saved straight away.</p>`;
    if (!$("#detail").open) $("#detail").showModal();
  }
  // Where every part of the site's data comes from (site/data/sources.json, scripts/build_sources.py).
  async function sourcesDialog() {
    if (!S.sources) S.sources = await fetch("data/sources.json").then((r) => r.json()).catch(() => null);
    const d = S.sources; dlgShow("Data sources", sourcesDialog);
    $("#d-eyebrow").textContent = "Transparency"; $("#d-title").textContent = "Where the data comes from";
    if (!d) { $("#d-body").innerHTML = `<p class="muted">The list of sources could not be loaded.</p>`; if (!$("#detail").open) $("#detail").showModal(); return; }
    const tb = (head, rows) => `<div class="tbl-scroll"><table class="svs"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
    const sum = (a, k) => a.reduce((m, x) => m + (x[k] || 0), 0);
    const sec = d.documents.filter((x) => x.level === "6-12"), el = d.documents.filter((x) => x.level === "K-5");
    const byDoc = (a) => Object.entries(a.reduce((m, x) => ((m[x.doc.replace(/ S[12]$/, "")] = (m[x.doc.replace(/ S[12]$/, "")] || 0) + 1), m), {})).map(([k, n]) => `${n} ${esc(k)}`).join(", ");
    $("#d-body").innerHTML = `<p class="lede">Every rating, mark and finding on this site comes from one of the sources below. Lists built ${esc(d.built)}.</p>
      <div class="box"><h3>Ratings (Part 1)</h3><p>Each grade team rates how each standard is generally taught in its grade, on this site. Every change is kept, with the team and the time, on the Activity tab. Findings are computed live from these ratings; "not rated" is never counted as a gap.</p></div>
      <div class="box"><h3>Standards</h3>${(() => { const onSite = {}; for (const sl of Object.keys(S.idx)) for (const e of S.idx[sl]) onSite[e.f] = (onSite[e.f] || 0) + 1; const seen = new Set();
          return tb(["Set", "Read from", "Rows read (one per standard and grade)", "Standards on the site"], d.standards.map((x) => { const first = !seen.has(x.framework); seen.add(x.framework);
            return `<tr><td>${badge(x.framework)} ${esc(FW_NAME[x.framework] || x.framework)}</td><td>${esc(x.source)}</td><td>${x.rows}</td><td>${first ? (onSite[x.framework] ? onSite[x.framework] : "not shown on the site") : ""}</td></tr>`; })); })()}
        <p class="muted sm-note">Standards on the site: after the site's choices (Wisconsin Science is not shown; NGSS and Wisconsin Social Studies are not used in K-5; Essential Elements marked "Not applicable" are left out). Links between standards come from the prerequisite map below or, where it has none, from the closest wording in the same progression.</p>
        <p class="muted">Common Core codes for Wisconsin ELA come from DPI's official 2010 / 2020 comparison; for Wisconsin Math, from a checked crosswalk (most codes are the same). Wisconsin matches under NGSS and AERO codes come from the school's sheets.</p></div>
      <div class="box"><h3>${SHOW_PLANS ? "✓ In curriculum docs and " : ""}★ Priority (6-12) and Power (K-5)</h3>
        <p><b>Grades 6-12:</b> ${sec.length} Ma3loomat course documents (${byDoc(sec)}), which together ${SHOW_PLANS ? `give ✓ to ${d.distinct["6-12"].standards} different standards (${d.distinct["6-12"].pairs} standard and grade pairs) and ` : ""}name ${d.distinct["6-12"].priority_pairs} standard and grade pairs as priority (main standards; Essential Elements take the marks from their linked standard).</p>
        ${SHOW_PLANS ? "" : "<p><b>K-5:</b> ★ Power standards come from the K-5 ELA Power Standards PDF and the Curriculum Hub grade standards lists (below), " + d.distinct["K-5"].priority_pairs + " standard and grade pairs.</p>"}
        ${!SHOW_PLANS ? "" : `<p><b>K-5:</b> ${el.filter((x) => x.kind === "weekly plan").length} Kindergarten weekly plans, ${el.filter((x) => x.kind === "grade document").length} grade documents (overviews, maps, units, standards by week) which together give ✓ to ${d.distinct["K-5"].standards} different standards (${d.distinct["K-5"].pairs} standard and grade pairs). ★ Power (${d.distinct["K-5"].priority_pairs} standard and grade pairs) comes from the K-5 ELA Power Standards PDF and the Curriculum Hub grade standards lists (below).</p>`}
        <details class="sub"><summary>Every document (${(SHOW_PLANS ? d.documents : d.documents.filter((x) => x.priority)).length})</summary>${tb(["Grade", "Subject", "Course", "Document", ...(SHOW_PLANS ? ["Code mentions"] : []), "Priority / power mentions"], (SHOW_PLANS ? d.documents : d.documents.filter((x) => x.priority)).map((x) => `<tr><td>${esc(gl(x.grade))}</td><td>${esc(x.subject)}</td><td>${esc(x.course || "")}</td><td>${esc(x.doc)}</td>${SHOW_PLANS ? `<td>${x.codes}</td>` : ""}<td>${x.priority || ""}</td></tr>`))}</details>
        <details class="sub"><summary>Curriculum Hub grade standards lists (${d.hub.length})</summary>${tb(["Grade", "Subject", "Codes listed", "Found on the site", "Not found"], d.hub.map((x) => `<tr><td>${esc(gl(x.grade))}</td><td>${esc(x.subject)}</td><td>${x.listed}</td><td>${x.found}</td><td>${esc(x.not_found.join(", ") || "")}</td></tr>`))}</details></div>
      <div class="box"><h3>Prerequisite links</h3>${tb(["Source", "Links"], Object.entries(d.prereqs).map(([k, n]) => `<tr><td>${esc(PSRC[k] || k)}</td><td>${n}</td></tr>`))}
        <p class="muted">Coherence Map: Student Achievement Partners, after the Common Core progressions (only the codes of each arrow are used). Same anchor standard: the Wisconsin anchor standard one grade earlier. Suggested, check: proposed by an AI curriculum reviewer, each with a one-line reason; not an official source.</p></div>
      <div class="box"><h3>Progressions</h3><p>ELA rows follow the Wisconsin anchor standards; Science rows the NGSS core ideas (through Wisconsin codes); Social Studies rows the Wisconsin standards, with AERO K-5 joined by the school's suggested matches; Math rows are Common Core topics grouped by cluster (built for this site, not official).</p></div>`;
    if (!$("#detail").open) $("#detail").showModal();
  }
  function viewBar(view) {
    const size = tsize(), seg = (act, v, cur, label) => `<button type="button" data-act="${act}" data-v="${v}" aria-pressed="${v === cur}">${label}</button>`;
    return `<div class="view-bar"><div class="seg-t" role="group" aria-label="How to see the standards">${seg("tview", "all", view, "All at once")}${seg("tview", "one", view, "One at a time")}</div>
      ${view === "all" ? `<div class="seg-t" role="group" aria-label="Size">${seg("tsize", "s", size, "Small")}${seg("tsize", "m", size, "Medium")}${seg("tsize", "l", size, "Large")}</div>
      <label class="t-find"><span class="sr">Find a standard</span><input id="t-search" type="search" placeholder="Find a standard (code or words)" value="${esc(S.flow.q || "")}" autocomplete="off"></label>` : ""} ${hb("tview")}</div>`;
  }
  // Wrap each search word in <mark> (after escaping), so matches stand out in the code and the text.
  function hl(text, q) {
    const s = esc(text), words = String(q || "").trim().split(/\s+/).filter((w) => w.length > 1).map((w) => esc(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return words.length ? s.replace(new RegExp(`(${words.join("|")})`, "gi"), "<mark>$1</mark>") : s;
  }
  const matchQ = (e, q) => !q || q.split(/\s+/).every((w) => (e.c + " " + codeText(e) + " " + altText(e) + " " + e.t + " " + e.s).toLowerCase().includes(w));
  const rowId = (k) => "r-" + k.replace(/[^A-Za-z0-9]/g, "_");
  function allView(list, g) {
    const F = S.flow, f = F.lib || "", q = (F.q || "").trim().toLowerCase(), size = tsize();
    const sets = { "": list, todo: list.filter((e) => !rating(e.f, e.c, g)), done: list.filter((e) => rating(e.f, e.c, g)), pr: list.filter((e) => isPr(e, g)), pn: list.filter((e) => isPn(e, g)) };
    const shown = (sets[f] || list).filter((e) => (!F.set || e.f === F.set) && matchQ(e, q));
    const chip = (k, label) => (k && !sets[k].length ? "" : `<button type="button" class="lib-t ${f === k ? "on" : ""}" data-act="tfilter" data-t="${k}">${label} <span>${k === "pr" || k === "pn" ? `${sets[k].filter((e) => rating(e.f, e.c, g)).length}/${sets[k].length}` : sets[k].length}</span></button>`);
    let html = "", last = null;
    for (const e of shown) {
      if (e.f + e.s !== last) {
        const inS = list.filter((x) => x.s === e.s && x.f === e.f), c = countLevels(inS, g), dn = inS.length - c[3];
        html += `<div class="strand ${c[3] ? "" : "done"}"><span>${badge(e.f)} ${esc(e.s || "Standards")}</span>${miniBar(c, `${dn} of ${inS.length} rated`)}<span class="strand-n">${c[3] ? `${dn}/${inS.length}` : "✓ all rated"}</span></div>`;
        last = e.f + e.s;
      }
      html += trow(e, g, size, q);
    }
    return `<div class="tlist-head lib-tabs">${chip("", "All")}${chip("todo", "Still to do")}${chip("done", "Done")}${chip("pr", "★ " + prName(g))}${chip("pn", "✓ In curriculum docs")} ${hb("library")}</div>
      <div class="tlist size-${size}">${html || `<div class="empty">${q ? "No standard matches your search." : f === "todo" ? "Nothing left. Well done." : "Nothing here yet."}</div>`}</div>
      <p class="flow-more"><button type="button" data-act="finish">Finish ${esc(S.flow.subject)}</button> <button type="button" class="ghost" data-act="results">See my results so far</button>
</p>
      <p class="muted flow-note">You may also teach standards from other grades, for example prerequisites. Please rate only your own grade's standards. ${hb("review")}</p>`;
  }
  function trow(e, g, size, q) {
    const r = rating(e.f, e.c, g), k = rkey(e.f, e.c, g), mk = marks(e, g);
    const text = size === "s" ? e.t : fullText(e);
    const btn = (l) => `<button type="button" class="tb c${l} ${r && r.level === l ? "on" : ""}" data-act="rate" data-k="${esc(e.f + "|" + e.c)}" data-g="${g}" data-l="${l}" aria-pressed="${!!(r && r.level === l)}">${size === "l" ? `<b>${LEVEL[l]}</b><small>${LEVEL_HINT[l]}</small>` : LEVEL_SHORT[l]}</button>`;
    return `<div class="trow ${r ? "rated l" + r.level : ""} ${S.flash === k ? "flash" : ""}" id="${rowId(k)}">
      <div class="tr-code"><span class="cd"><button class="code" data-act="open" data-k="${esc(e.f + "|" + e.c)}" title="Open the full standard">${hl(codeText(e), q)}</button><span class="wi-code">${hl(altText(e), q)}</span></span>${mk ? `<div class="mks">${mk}</div>` : ""}</div>
      <div class="tr-text"${size === "s" ? ` data-full="${esc(fullText(e))}"` : ""}>${hl(text, q)}</div>
      <div class="tr-ans" role="group" aria-label="How is ${esc(codeText(e))} generally taught?">${btn(0)}${btn(1)}${btn(2)}</div></div>`;
  }
  // A popup listing every standard not answered yet, with a button to go straight to each one.
  function unfinished(list, g, why) {
    const todo = list.filter((e) => !rating(e.f, e.c, g));
    if (!todo.length) return false;
    $("#d-eyebrow").textContent = "Not finished yet"; $("#d-title").textContent = `${todo.length} standard${todo.length > 1 ? "s" : ""} still to answer`;
    $("#d-body").innerHTML = `<p class="lede">${why} Every answer you have given is already saved, so you can also stop now and finish later with the same link.</p>
      <ul class="unf">${todo.map((e) => `<li>${badge(e.f)} ${codeLines(e)} <span class="muted">${esc(partText(e, S.printAll ? 9999 : 160))}</span>${S.flow.skipped.has(rkey(e.f, e.c, g)) ? ` <span class="tag">Skipped</span>` : ""} <button type="button" class="sm" data-act="goto" data-k="${esc(e.f + "|" + e.c)}">Answer</button></li>`).join("")}</ul>`;
    if (!$("#detail").open) $("#detail").showModal();
    return true;
  }
  // Results for one subject, shown when it is finished (or on request): the answers, by strand, priority standards and
  // plans. When every subject is done it also shows the whole grade.
  function resultsPage(subject, g, list, subs) {
    const c = countLevels(list, g), n = list.length, left = c[3], F = S.flow;
    const strands = []; for (const e of list) { const key = e.f + "|" + (e.s || "Standards"); let x = strands.find((y) => y.key === key); if (!x) strands.push(x = { key, f: e.f, s: e.s || "Standards", arr: [] }); x.arr.push(e); }
    strands.forEach((x) => { x.c = countLevels(x.arr, g); x.score = (x.c[2] + 0.5 * x.c[1]) / Math.max(1, x.arr.length - x.c[3]); });
    const pr = list.filter((e) => isPr(e, g)), prLow = pr.filter((e) => (rating(e.f, e.c, g)?.level ?? -1) < 2);
    const pn = list.filter((e) => isPn(e, g)), planNot = pn.filter((e) => !isEE(e.f) && rating(e.f, e.c, g)?.level === 0);
    const rated = strands.filter((x) => x.arr.length - x.c[3]).sort((a, b) => b.score - a.score);
    const next = subs.find((s) => flowList(s, g).some((x) => !rating(x.f, x.c, g)));
    const allDone = !next && !left;
    const item = (e) => `<li>${codeLines(e)} <span class="muted">${esc(e.t.slice(0, 90))}${e.t.length > 90 ? "…" : ""}</span> <span class="pill"><i class="lv ${rating(e.f, e.c, g) ? "lv-" + rating(e.f, e.c, g).level : "lv-none"}"></i>${rating(e.f, e.c, g) ? LEVEL_SHORT[rating(e.f, e.c, g).level] : "Not rated"}</span></li>`;
    const insights = [
      `<b>${c[2]}</b> of ${n} standards are taught in depth, <b>${c[1]}</b> introduced and <b>${c[0]}</b> not taught${left ? `; <b>${left}</b> still to answer` : ""}.`,
      rated.length > 1 ? `Highest share in depth: <b>${esc(rated[0].s)}</b>. Lowest share in depth: <b>${esc(rated[rated.length - 1].s)}</b>.` : "",
      pr.length ? `<b>${pr.length - prLow.length} of ${pr.length}</b> ${prName(g).toLowerCase()} standards are taught in depth.` : "",
      planNot.length ? `<b>${planNot.length}</b> standard${planNot.length > 1 ? "s are" : " is"} in your plans but marked not taught. ` : "",
    ].filter(Boolean);
    return `${allDone ? gradeOverview(g, subs) : ""}<div class="card results">
      <div class="res-head"><div><span class="eyebrow">${left ? "Results so far" : "Finished"}</span><h2>${esc(gname(g))} ${esc(subject)}${courseOf(g, subject) && courseOf(g, subject) !== subject ? ` (${esc(courseOf(g, subject))})` : ""}: your results ${hb("t_results")}</h2></div>
        <div class="res-ring">${donut(c, 96)}<div class="ring-key"><span><i class="lv lv-2"></i>${c[2]} in depth</span><br><span><i class="lv lv-1"></i>${c[1]} introduced</span><br><span><i class="lv lv-0"></i>${c[0]} not taught</span></div></div></div>
      ${left ? `<div class="notice">${left} standard${left > 1 ? "s are" : " is"} still to answer. <button type="button" class="sm" data-act="finish">Show me which</button></div>` : ""}
      <ul class="res-insights">${insights.map((x) => `<li>${x}</li>`).join("")}</ul>
      <h3>By strand</h3><div class="strand-bars">${strands.map((x) => { const w = (i) => (x.c[i] / x.arr.length) * 100;
        return `<span class="sb-name">${badge(x.f)} ${esc(x.s)}</span><div class="sb" role="img" aria-label="${esc(x.s)}: ${x.c[2]} in depth, ${x.c[1]} introduced, ${x.c[0]} not taught">${[[2, COLORS[2]], [1, COLORS[1]], [0, COLORS[0]], [3, "#F2F4F6"]].map(([i, col]) => (x.c[i] ? `<i style="width:${w(i)}%;background:${col}"></i>` : "")).join("")}</div><div class="num">${x.c[2]}/${x.arr.length}</div>`; }).join("")}</div>
      ${prLow.length ? `<h3>${prName(g)} standards not taught in depth (${prLow.length})</h3><ul class="gap-list res-list">${prLow.slice(0, S.printAll ? Infinity : 12).map(item).join("")}</ul>` : ""}
      ${planNot.length ? `<h3>In your curriculum documents, but marked not taught (${planNot.length})</h3><ul class="gap-list res-list">${planNot.slice(0, S.printAll ? Infinity : 12).map(item).join("")}</ul>` : ""}
      <div class="done-actions">${next ? `<button type="button" data-act="flow-subject" data-s="${esc(next)}">Next: ${esc(next)} →</button>` : ""}
        <button type="button" class="ghost" data-act="review-answers">Review or change my answers</button>
        ${allDone && !S.lock ? `<button type="button" class="ghost" data-act="explore">See your grade on the K-12 map</button>` : ""}</div></div>`;
  }
  // Every subject in one grade side by side: how much is rated and how it is taught (main standards; Essential Elements
  // counted apart). Used by teachers when they finish and on the committee's Grade dashboard, where it also lists what to
  // review in each subject.
  function gradeOverview(g, subs, withReview) {
    const lists = subs.map((s) => [s, mode() === "teacher" ? flowList(s, g) : S.idx[S.meta.subjects.find((x) => x.name === s).slug].filter((e) => e.pl.includes(g) && setsFor(s, g).includes(e.f))]);
    const cards = lists.map(([s, list]) => {
      const main = list.filter((e) => !isEE(e.f)), ee = list.filter((e) => isEE(e.f)), c = countLevels(main, g), n = main.length, ce = countLevels(ee, g);
      const pr = main.filter((e) => isPr(e, g)), prDeep = pr.filter((e) => rating(e.f, e.c, g)?.level === 2).length, prRated = pr.filter((e) => rating(e.f, e.c, g)).length;
      return `<button type="button" class="go-card ${mode() !== "teacher" && s === S.f.subject ? "on" : ""}" data-act="${mode() === "teacher" ? "flow-subject" : "subject"}" data-s="${esc(s)}">${donut(c, 64)}<span class="go-txt"><b>${esc(s)}</b>${courseOf(g, s) && courseOf(g, s) !== s ? `<span class="go-course">${esc(courseOf(g, s))}</span>` : ""}
        <span>${n - c[3]} of ${n} rated</span><span><i class="lv lv-2"></i>${n - c[3] ? Math.round((c[2] / (n - c[3])) * 100) : 0}% of rated in depth</span>${pr.length ? `<span>★ ${prDeep}/${prRated} rated ${prName(g).toLowerCase()} in depth</span>` : ""}${ee.length ? `<span class="muted">EE: ${ee.length - ce[3]} of ${ee.length} rated</span>` : ""}</span></button>`;
    }).join("");
    let rev = "";
    if (withReview) {
      const rows = lists.map(([s, list]) => [s, gradeReview(g, s, list)]).filter(([, r]) => r.length);
      // Review first: the most consequential items across every subject, in one ranked list (official problems that
      // reach other grades, then problems here, priority standards, plans, the rest).
      const RANK = { caused: 0, here: 1, prlow: 2, plannot: 3, strand: 4, extra: 5 };
      const firsts = rows.flatMap(([sub, r]) => r.map(([t, , fl, id]) => ({ sub, t, id, k: (RANK[id] ?? 6) + (id === "caused" && fl && !fl.some(({ f }) => f.official && !f.within) ? 1.5 : 0) })))
        .sort((a, b) => a.k - b.k).slice(0, 5);
      rev = `<h3>To review across subjects ${hb("grade_review")}</h3>${firsts.length ? `<ol class="rev-first">${firsts.map((x) => `<li><button type="button" class="linkish" data-act="subject" data-s="${esc(x.sub)}"><b>${esc(x.sub)}</b></button>: ${x.t}</li>`).join("")}</ol><p class="muted sm-note">Review first: findings on official links that reach other grades, then problems in this grade, then priority standards and plans. By subject:</p>` : ""}${rows.length ? `<ul class="go-rev">${rows.map(([s, r]) => `<li><button type="button" class="linkish" data-act="subject" data-s="${esc(s)}"><b>${esc(s)}</b></button>: ${r.slice(0, S.printAll ? Infinity : 4).map(([t]) => t).join(" · ")}${r.length > 4 && !S.printAll ? ` · and ${r.length - 4} more` : ""}</li>`).join("")}</ul>` : `<p class="muted">Nothing stands out yet in any subject.</p>`}`;
    }
    return `<div class="card grade-ov"><h2>${esc(gname(g))}: every subject ${hb("grade_ov")}</h2><div class="go-grid">${cards}</div>${rev}</div>`;
  }
  // The library: every standard in this subject's chosen sets, split into "Still to do" and "Done". Click one to open it.
  function library(list, g) {
    const todo = list.filter((e) => !rating(e.f, e.c, g)), done = list.filter((e) => rating(e.f, e.c, g)), tab = S.flow.lib || "";
    const pr = list.filter((e) => isPr(e, g)), pn = list.filter((e) => isPn(e, g)), show = { todo, done, pr, pn }[tab] || [];
    const item = (e) => { const r = rating(e.f, e.c, g); return `<li><button type="button" class="lib-i" data-act="lib-open" data-k="${esc(e.f + "|" + e.c)}">${badge(e.f)} ${codeLines(e)} <span>${esc(e.t.slice(0, 90))}${e.t.length > 90 ? "…" : ""}</span>${isPr(e, g) ? `<i class="mk mk-pr" title="${prName(g)} standard">★</i>` : ""}${isPn(e, g) ? `<i class="mk mk-pn" title="In curriculum docs">✓</i>` : ""}${r ? `<i class="pill"><i class="lv lv-${r.level}"></i>${LEVEL_SHORT[r.level]}</i>` : ""}</button></li>`; };
    return `<div class="library"><div class="lib-tabs">
        <button type="button" class="lib-t ${tab === "todo" ? "on" : ""}" data-act="lib" data-t="todo">Still to do <span>${todo.length}</span></button>
        <button type="button" class="lib-t ${tab === "done" ? "on" : ""}" data-act="lib" data-t="done">Done <span>${done.length}</span></button>
        ${pr.length ? `<button type="button" class="lib-t ${tab === "pr" ? "on" : ""}" data-act="lib" data-t="pr">★ ${prName(g)} <span>${pr.filter((e) => rating(e.f, e.c, g)).length}/${pr.length}</span></button>` : ""}
        ${pn.length ? `<button type="button" class="lib-t ${tab === "pn" ? "on" : ""}" data-act="lib" data-t="pn">✓ In curriculum docs <span>${pn.filter((e) => rating(e.f, e.c, g)).length}/${pn.length}</span></button>` : ""} ${hb("library")}</div>
      ${tab ? `<ul class="lib-list">${show.map(item).join("") || `<li class="muted">${tab === "todo" ? "Nothing left. Well done." : "Nothing answered yet."}</li>`}</ul>` : ""}</div>`;
  }
  async function flowRate(k, level) {
    const g = teamGrade(), e = findItem(k); if (!e) return;
    const rk = rkey(e.f, e.c, g), cur = rating(e.f, e.c, g);
    S.flow.skipped.delete(rk);
    if (S.flow.back === rk) S.flow.back = null;
    if (!S.flow.history.includes(rk)) S.flow.history.push(rk);
    const card = $(".std-card"); if (card) card.classList.add("leaving");
    if (cur && cur.level === level) { rerender(); return; }
    await setRating(e, g, level);
  }

  function renderRate() {
    const el = $("#view-rate");
    if (!S.team) {
      el.innerHTML = `<div class="panel"><h2>Welcome ${hb("team")}</h2><p class="lede">Choose your team at the top right. You will see the standards for your grade, and you can mark each one as
        <b>Not taught</b>, <b>Introduced / exposed</b> or <b>Taught in depth</b>. Every change is saved straight away and recorded with your team name.</p></div>`;
      return;
    }
    const g = teamGrade();
    if (!g) return pickGrade(el, "its standards");
    let all = filtered({ ignoreDivision: true });
    if (mode() === "teacher") { const fws = setsFor(S.f.subject, g, S.team); all = all.filter((e) => fws.includes(e.f)).sort((a, b) => SET_ORDER(a.f) - SET_ORDER(b.f)); }
    const placed = ordered(all.filter((e) => e.pl.includes(g)), g);
    const band = ordered(all.filter((e) => !e.pl.includes(g) && e.sg && e.div.includes(divOf(g))), g);
    const committee = S.team.name === "Vertical Alignment Committee";
    el.innerHTML = (mode() === "teacher" ? `<div class="flow-wrap wide"><p><button type="button" class="ghost" data-act="back-to-flow">← Back to one at a time</button></p></div>` : "") + `<div class="panel">
      <div class="rate-head"><div><h2>${esc(S.f.subject)} · ${esc(gname(g))}${courseOf(g, S.f.subject) && courseOf(g, S.f.subject) !== S.f.subject ? ` (${esc(courseOf(g, S.f.subject))})` : ""} ${hb("rate")}</h2>
      <p class="lede">For each standard, choose how it is generally taught in ${esc(gname(g))}. Use what is really taught, even if the plans do not show it yet.</p></div>
      <div class="ring-box">${(() => { const lst = placed.concat(band.filter((e) => rating(e.f, e.c, g))), c = countLevels(lst, g); return donut(c) +
        `<div class="ring-key"><b>${lst.length - c[3]} of ${lst.length}</b> rated<br><span><i class="lv lv-2"></i>${c[2]} in depth</span><span><i class="lv lv-1"></i>${c[1]} introduced</span><span><i class="lv lv-0"></i>${c[0]} not taught</span></div>`; })()}${hb("progress")}</div></div>
      ${toRateStrip(g)}
      ${committee ? `<p class="muted">Committee view: pick a grade with the Grade filter above.</p>` : ""}
      <div class="group-title"><h3>Standards suggested for ${esc(gname(g))} (${placed.length}) ${hb("rate_placed")}</h3></div>
      ${markSummary(placed, g)}
      ${placed.length ? groupByStrand(placed, g, (e) => (e.sg && !(e.pa || []).includes(g) ? "Suggested placement" : "")) : `<div class="empty">No standards match these filters.</div>`}
      ${band.length ? `<div class="group-title"><h3>Other ${esc(divOf(g).toLowerCase())} school standards (${band.length}) ${hb("rate_band")}</h3>
        <span class="muted">Placement of these is a suggestion. Mark any that ${esc(gname(g))} actually teaches.</span></div>
        ${groupByStrand(band, g, (e) => "Suggested for " + e.pl.map(gname).join(", "))}` : ""}
    </div>`;
  }

  // Part 1 coverage map: strands down the side, grades across. Each tile summarises how that grade rated the
  // standards suggested for it in that strand (bottom-up: in depth, introduced, not taught, grey = not rated yet).
  // Coverage map rows. Strands with the same name in two main sets share a row (Science: AERO in K-5, NGSS in 6-12);
  // each K-5 AERO Social Studies strand sits just above the Wisconsin domain its suggested matches mostly fall in;
  // Essential Elements always get their own rows, at the end, so they are never mixed with the main standards.
  const isEE = (f) => f.startsWith("WI-EE-");
  function rowOf(e) {
    const s = e.s || "Standards";
    if (isEE(e.f)) return { key: "E|" + e.f + "|" + s, grp: s, ee: 1, sub: 0, label: s };
    if (e.f === "AERO-SS") { const d = S.ssDomain && S.ssDomain[s]; return { key: "A|" + s, grp: d || s, ee: 0, sub: 0, label: s, note: d ? `K-5 AERO; continues as Wisconsin ${d} (suggested matches)` : "K-5 AERO" }; }
    return { key: "M|" + s, grp: s, ee: 0, sub: 1, label: s };
  }
  // The Standards filter on a K-12 page, applied to one grade (a tile or a grade's count): priority for that grade, etc.
  const markOkG = (e, g) => { const m = mode() === "full" ? S.f.mark : ""; return !m || (m === "pr" ? isPr(e, g) : m === "pn" ? isPn(e, g) : !isPn(e, g)); };
  function mapRows(list) {
    const rows = new Map(), order = new Map();
    list.forEach((e, i) => { const r = rowOf(e); if (!rows.has(r.key)) rows.set(r.key, { ...r, arr: [] }); rows.get(r.key).arr.push(e); if (!order.has(r.grp)) order.set(r.grp, i); });
    return [...rows.values()].sort((a, b) => a.ee - b.ee || order.get(a.grp) - order.get(b.grp) || a.sub - b.sub || a.key.localeCompare(b.key));
  }
  const rowSets = (arr) => [...new Set(arr.map((e) => e.f))].sort((a, b) => SET_ORDER(a) - SET_ORDER(b));
  // Two ways to see a subject: tiles by strand (default), or corresponding standards matched across grades, one row per
  // chain (like the popup's "How each grade teaches it" strip). Quick buttons narrow either one to K-5, 6-8 or 9-12.
  const mapMode = () => (S.mapMode || store.get("va_mapmode") || "tiles");
  function mapBar() {
    const m = mapMode(), bands = [["all", "K-12"], ["Elementary", "K-5"], ["Middle", "6-8"], ["High", "9-12"], ["6-12", "6-12"]];
    const btn = (act, v, lab, on) => `<button type="button" class="${on ? "on" : ""}" data-act="${act}" data-v="${v}" aria-pressed="${on}">${lab}</button>`;
    return `<div class="map-bar"><span class="seg-t" role="group" aria-label="How to show the subject">${btn("map-mode", "tiles", "By strand", m === "tiles")}${btn("map-mode", "rows", "Matched across grades", m === "rows")}</span> ${hb("hm_mode")}
      <span class="seg-t" role="group" aria-label="Grades">${bands.map(([v, lab]) => btn("band", v, lab, S.f.division === v)).join("")}</span> ${hb("hm_band")}</div>`;
  }
  function renderHeatmap() {
    const el = $("#view-heatmap"), gs = visibleGrades(), list = filtered();
    if (!list.length) { el.innerHTML = mapBar() + `<div class="panel empty">No standards match these filters.</div>`; return; }
    const multi = subj().frameworks.length > 1, rows = mapRows(list);
    let done = 0, total = 0;
    const cellsInfo = [];                                    // every grade x row tile, for the findings at the top
    const tile = (row, g) => {
      const mine = row.arr.filter((e) => e.pl.includes(g) && markOkG(e, g));
      const extra = row.arr.filter((e) => !e.pl.includes(g) && (rating(e.f, e.c, g)?.level || 0) > 0).length;
      if (!mine.length) return `<td class="cm-td" data-gi="${g}">${extra ? `<span class="cm-none cm-extra" data-tip-text="${esc(gname(g))} also teaches ${extra} ${esc(row.label)} standard${extra > 1 ? "s" : ""} suggested for other grades.">+${extra}</span>` : `<span class="cm-none"></span>`}</td>`;
      const c = countLevels(mine, g), n = mine.length, pr = mine.filter((e) => isPr(e, g)).length, pn = mine.filter((e) => isPn(e, g)).length; total += n; done += n - c[3];
      // ★ on a tile = a priority or power standard here is rated below in depth (a signal, not just "has priority").
      const prLow = mine.filter((e) => isPr(e, g) && (rating(e.f, e.c, g)?.level ?? 2) < 2).length;
      cellsInfo.push({ g, row, n, c, pr });
      const h = (i) => (c[i] / n) * 100;
      return `<td class="cm-td" data-gi="${g}"><button type="button" class="cm-tile ${c[3] ? "" : "full"}" data-act="cm-open" data-g="${g}" data-row="${esc(row.key)}" aria-label="${esc(gname(g))} ${esc(row.label)}: ${n} standards, ${c[2]} in depth, ${c[1]} introduced, ${c[0]} not taught, ${c[3]} not rated${prLow ? `, ${prLow} priority below in depth` : ""}"
        data-tip-text="${esc(gname(g))} · ${esc(row.label)}: ${n} standard${n > 1 ? "s" : ""}. ${c[2]} in depth, ${c[1]} introduced, ${c[0]} not taught${c[3] ? ", " + c[3] + " not rated yet" : ""}.${pr ? ` ${pr} ${prName(g).toLowerCase()}${prLow ? `, ${prLow} of them rated below in depth` : ""}.` : ""}${pn ? ` ${pn} in ${gname(g)}'s plans.` : ""}${extra ? " Also teaches " + extra + " from other grades." : ""} Click to see these standards.">
        <span class="cm-fill"><i style="height:${h(2)}%;background:${COLORS[2]}"></i><i style="height:${h(1)}%;background:${COLORS[1]}"></i><i style="height:${h(0)}%;background:${COLORS[0]}"></i></span>
        <span class="cm-n">${n}</span>${extra ? `<span class="cm-plus">+${extra}</span>` : ""}${prLow ? `<span class="cm-pr" aria-hidden="true">★</span>` : ""}</button></td>`;
    };
    const body = rows.map((row) => {
      const fws = rowSets(row.arr);
      return `<tr class="${row.ee ? "set-ee" : ""}"><th class="cm-row" scope="row"><span>${multi ? fws.map(badge).join(" ") + " " : ""}${esc(row.label)}</span>${multi || row.note ? `<small>${esc(row.note || fws.map((f) => FW_NAME[f] || f).join(" + "))}</small>` : ""}</th>${gs.map((g) => tile(row, g)).join("")}</tr>`;
    }).join("");
    const head = gs.map((g) => {
      const mine = list.filter((e) => e.pl.includes(g) && markOkG(e, g)), c = countLevels(mine, g), pct = mine.length ? Math.round(((mine.length - c[3]) / mine.length) * 100) : 0;
      return `<th data-gi="${g}" data-course="${esc(courseOf(g, S.f.subject))}" class="${S.f.grade === g ? "sel" : ""}"><button type="button" class="colh" data-act="grade" data-g="${g}" data-tip-text="${esc(gradeCourse(g, S.f.subject))}: ${mine.length - c[3]} of ${mine.length} suggested standards rated. Click to choose this grade.">${gl(g)}${courseOf(g, S.f.subject) ? `<span class="colh-course">${esc(courseOf(g, S.f.subject))}</span>` : ""}<small>${mine.length ? pct + "%" : ""}</small></button></th>`;
    }).join("");
    const foot = gs.map((g) => { const mine = list.filter((e) => e.pl.includes(g) && markOkG(e, g)), c = countLevels(mine, g), r = mine.length - c[3];
      return `<td class="cm-foot" data-gi="${g}">${r ? `<b>${Math.round((c[2] / r) * 100)}%</b>` : "<span class='muted'>n/a</span>"}</td>`; }).join("");
    // Findings first: which grades still need rating, where teaching is thinnest, and where it is strongest.
    const byGrade = gs.map((g) => { const mine = list.filter((e) => e.pl.includes(g) && markOkG(e, g)), c = countLevels(mine, g); return { g, n: mine.length, r: mine.length - c[3] }; }).filter((x) => x.n);
    const least = byGrade.filter((x) => x.r < x.n).sort((a, b) => a.r / a.n - b.r / b.n).slice(0, 4);
    // Thinnest: tiles with at least 3 rated standards (or 2, both not taught); see thinOf below for the ranking.
    // Essential Elements are counted apart (they follow the standard they link to): the cards, thinnest and strongest
    // use the main standards; Essential Elements get their own line.
    const ratedCells = cellsInfo.filter((x) => x.n - x.c[3] >= 3 || (x.n - x.c[3] >= 2 && x.c[0] === x.n - x.c[3])).map((x) => { const r = x.n - x.c[3], low = x.c[0] + x.c[1]; return { ...x, r, low, share: low / r }; });
    // Tiles where at least half the rated standards are below in depth (if none, any below in depth), ranked by how many
    // are below in depth, then by share: the number each line starts with.
    const thinOf = (arr) => { const c = arr.filter((x) => x.low > 0), half = c.filter((x) => x.share >= 0.5);
      // Tiles where every rated standard is not taught come first, then by how many are below in depth, then share.
      const all0 = (x) => x.c[0] === x.r;
      const out = (half.length ? half : c).sort((a, b) => all0(b) - all0(a) || b.low - a.low || b.share - a.share || b.c[0] - a.c[0]); out.fallback = !half.length; return out; };
    const thinAll = thinOf(ratedCells.filter((x) => !x.row.ee)), thinFallback = thinAll.fallback;
    const thin = thinAll.slice(0, 5), thinEE = thinOf(ratedCells.filter((x) => x.row.ee)).slice(0, 3);
    const strong = ratedCells.filter((x) => x.c[2] && !x.row.ee && !thin.includes(x)).sort((a, b) => b.c[2] / b.r - a.c[2] / a.r || b.c[2] - a.c[2]).slice(0, 3);
    const sum = (ee, i) => cellsInfo.filter((x) => !!x.row.ee === ee).reduce((m, x) => m + x.c[i], 0);
    const notAll = sum(false, 0), introAll = sum(false, 1), ratedMain = cellsInfo.filter((x) => !x.row.ee).reduce((m, x) => m + x.n - x.c[3], 0);
    const notEE = sum(true, 0), introEE = sum(true, 1), ratedEE = done - ratedMain;
    const prOf = (ee) => list.filter((e) => isEE(e.f) === ee).flatMap((e) => (e.pr || []).filter((g) => gs.includes(g) && e.pl.includes(g) && markOkG(e, g)).map((g) => rating(e.f, e.c, g)));
    const prAll = prOf(false), prEE = prOf(true);
    const prDeep = prAll.filter((r) => r && r.level === 2).length, prRated = prAll.filter(Boolean).length;
    const tileSets = (x) => rowSets(x.row.arr.filter((e) => e.pl.includes(x.g) && markOkG(e, x.g)));
    const cellBtn = (x, txt) => `<button type="button" class="linkish" data-act="cm-open" data-g="${x.g}" data-row="${esc(x.row.key)}">${tileSets(x).map(badge).join(" ")} ${esc(gname(x.g))} · ${esc(x.row.label)}</button> <span class="muted">${txt}</span>`;
    const thinLine = (x) => `<li>${cellBtn(x, `<b>${x.low} of ${x.r} rated below in depth</b> (${Math.round(x.share * 100)}%: ${x.c[0]} not taught, ${x.c[1]} introduced)${x.c[3] ? `; ${x.c[3]} not rated` : ""}`)}</li>`;
    el.innerHTML = `<div class="panel insights"><h2>${esc(S.f.subject)} coverage map, ${esc(divLabel(S.f.division))} ${hb("heatmap")}</h2>
      <p class="lede">${mapMode() === "rows" ? "The cards sum up the ratings in view. Below them, each row follows one standard into the standards in later grades that build on it, one square per grade." : "Each tile is one grade and one strand: the number is how many standards that grade has there, and the colour fills from the bottom as the grade rates them."} <span class="muted">Updates as teams rate.</span></p>
      <div class="ins-grid">
        <div class="ins ins-data"><b>${total ? Math.round((done / total) * 100) : 0}%</b><span>of grade placements rated (${done} of ${total})</span><small>${least.length ? "Least rated: " + least.map((x) => `${gl(x.g)} ${Math.round((x.r / x.n) * 100)}%`).join(", ") : "Every grade has finished rating."}</small></div>
        <div class="ins ${notAll ? "ins-issue" : ""}"><b>${notAll}</b><span>grade placements rated not taught</span><small>and ${introAll} only introduced, out of ${ratedMain} placements rated in their suggested grade (a standard placed in two grades counts twice)${ratedEE ? `. Essential Elements apart: ${notEE} not taught, ${introEE} introduced of ${ratedEE} rated` : ""}</small></div>
        <div class="ins ${prRated && prDeep < prRated ? "ins-warn" : ""}"><b>${prDeep}<small>/${prRated}</small></b><span>rated ${prWords()} standards taught in depth</span><small>${prAll.length - prRated} more not rated yet (${prAll.length} named in their own grade)${prEE.length ? `. Not counted: ${prEE.length} Essential Elements that take the mark from their linked standard` : ""}</small></div>
      </div>
      ${mapMode() === "rows" ? "" : thin.length ? `<h3>${thinFallback ? "Most standards below in depth: no tile has half or more below in depth, so these are the tiles with any" : "Most standards below in depth"} <span class="tag auto">Automatic check</span> ${hb("hm_thin")}</h3><ul class="issues">${thin.map(thinLine).join("")}</ul>${thinEE.length ? `<p class="muted sm-note"><b>Essential Elements</b>, counted apart:</p><ul class="issues ee-thin">${thinEE.map(thinLine).join("")}</ul>` : ""}<p class="muted sm-note">Tiles where at least half the rated standards are below in depth (when there are none, any tile with one below in depth), listed with tiles where every rated standard is not taught first, then by how many are below in depth, then by share; only tiles with at least 3 rated standards, or 2 that are both not taught. <b>What to do:</b> open a tile to see its standards, then check Gaps &amp; repetition for whether another grade teaches them before treating them as gaps.</p>` : `<p class="muted">${done ? "No tile with three or more rated standards has any taught less than in depth yet." : "Nothing is rated yet in this view, so the map shows the standards only."}</p>`}
      ${(() => { const wk = gs.map((g) => { const m = list.filter((e) => e.pl.includes(g) && markOkG(e, g)), c = countLevels(m, g), r = m.length - c[3]; return { g, r, p: r ? c[2] / r : 1 }; }).filter((x) => x.r >= 5).sort((a, b) => a.p - b.p).slice(0, 3);
        return wk.length && mapMode() !== "rows" ? `<p class="muted">Lowest share taught in depth, by grade (every standard in view, as in the bottom row; 5+ rated): ${wk.map((x) => `<b>${gl(x.g)} ${Math.round(x.p * 100)}%</b>`).join(", ")}. The bottom row of the map shows every grade.</p>` : ""; })()}
      ${strong.length && mapMode() !== "rows" ? `<p class="muted">Highest share taught in depth (main standards): ${strong.map((x) => cellBtn(x, `${Math.round((x.c[2] / x.r) * 100)}% in depth (${x.c[2]} of ${x.r} rated)`)).join("; ")}.</p>` : ""}
      <div class="cm-key"${mapMode() === "rows" ? " hidden" : ""}><span><span class="cm-key-tile"><i style="height:40%;background:${COLORS[2]}"></i><i style="height:30%;background:${COLORS[1]}"></i><i style="height:10%;background:${COLORS[0]}"></i></span> Fill: lime in depth, blue introduced, magenta not taught, white not rated</span><span><b class="cm-key-n">5</b> standards suggested for that grade</span><span><span class="cm-key-full"></span> dark green border: every one rated</span><span><span class="cm-pr-k">★</span> a ${prWords()} standard here is rated below in depth</span><span><span class="cm-plus-k">+2</span> also teaches 2 suggested for other grades</span><span><span class="cm-none-k"></span> no standards in that grade</span>${multi ? `<span>${badge(subj().frameworks.find(isEE) || "WI-EE-MATH")} Essential Elements rows come last, with a dashed bar beside the name</span>` : ""}</div></div>
      ${mapBar()}
      <p class="scroll-hint muted">Scroll sideways to see every grade →</p>
      ${mapMode() === "rows" ? chainView(list, gs) : `<div class="cm-wrap"><table class="cm"><thead><tr><th class="cm-row">Strand <small>% under each grade: share rated</small> ${hb("hm_cols")}</th>${head}</tr></thead><tbody>${body}</tbody>
        <tfoot><tr><th class="cm-row" scope="row">Taught in depth <small>share of rated standards</small></th>${foot}</tr></tfoot></table></div>`}`;
  }
  // Matched across grades: each standard followed to the standard that matches it best in the next step of its
  // progression, and on through the grades (official for ELA anchor standards, inferred from wording elsewhere). Every
  // main standard sits in exactly one row, so each square is one grade's rating of its own standard in that chain.
  const chainMemo = {};
  function chains(subject) {
    if (chainMemo[subject]) return chainMemo[subject];
    const out = [];
    // Within each progression: every standard's best match in the step before (its link), then one row from each
    // standard with no earlier match, following its best-linked later standard; where a standard leads to several,
    // each other one starts a branch row (from: the standard it branches from). A standard in two progressions
    // appears in both.
    for (const l of S.prog.lanes.filter((x) => x.subject === subject)) {
      const inLane = l.steps.flatMap((st) => st.k).filter((k) => S.byKey.has(k)), has = new Set(inLane), pred = new Map(), kids = new Map();
      // Each standard's match in an earlier grade: from the prerequisite map (same skill first, then official links,
      // then the latest grade), else the closest wording link in this progression.
      const rank = (p) => (p.type === "same" ? 0 : p.src === "cm" || p.src === "anchor" ? 1 : p.src === "anchorp" ? 2 : 3), gi = (e) => GRADES.indexOf(e.pl[0]);
      for (const b of inLane) { const eb = S.byKey.get(b), ps = preOf(eb).filter((p) => has.has(p.k) && gi(p.e) < gi(eb)).sort((x, y) => rank(x) - rank(y) || gi(y.e) - gi(x.e));
        if (ps.length) pred.set(b, [ps[0].k, 1, 0, ps[0]]); }
      // Wording only fills in where the map has nothing: never for a standard the map already links on from (its
      // official successor is followed instead, in its own row if another standard took it).
      const mapNext = (a) => postOf(S.byKey.get(a)).some((p) => has.has(p.k) && gi(p.e) > gi(S.byKey.get(a)));
      for (const [a, b, sm, same] of l.links) if (sm >= MIN_SIM && has.has(a) && has.has(b) && !mapNext(a) && (!pred.has(b) || (!pred.get(b)[3] && pred.get(b)[1] < sm))) pred.set(b, [a, sm, same]);
      for (const [b, [a]] of pred) (kids.get(a) || kids.set(a, []).get(a)).push(b);
      const strength = (b) => { const [, sm, , p] = pred.get(b); return p ? rank(p) : 4 - sm; };
      for (const ks of kids.values()) ks.sort((x, y) => strength(x) - strength(y));
      const walk = (path, from) => { const end = path[path.length - 1], next = kids.get(end) || [];
        if (!next.length) { out.push({ ks: path, lane: l, from, same: path.slice(1).map((x) => pred.get(x)[2]) }); return; }
        walk([...path, next[0]], from); for (const b of next.slice(1)) walk([end, b], end); };
      for (const k of inLane) if (!pred.has(k)) walk([k], null);
    }
    return (chainMemo[subject] = out);
  }
  /* Wording shared between matched standards. Links are made from shared wording (scripts/build_progressions.py), so the
     words two standards share show the part of each standard (often one sub-standard) that carries the idea on. */
  const STOPW = new Set(("a an and are as at be by for from in into is it its of on or that the their them they this to use using with students student grade text texts including e g eg such other two one more than within each about how what when "
    + "people person there many example examples understand understanding does your lie may can could would should will also both only same different given make makes made find show shows explain describe identify determine apply create develop").split(" "));
  const stemW = (w) => w.toLowerCase().replace(/(?<=.{3})(ing|ed)$/, "").replace(/(?<=.{2}[^s])s$/, "");
  const wordsOf = (t) => (String(t).match(/[A-Za-z]+/g) || []).filter((w) => w.length > 2 && !STOPW.has(w.toLowerCase())).map(stemW);
  const idfMemo = {};
  function idfOf(subject) {
    if (idfMemo[subject]) return idfMemo[subject];
    const df = new Map(), list = S.idx[S.meta.subjects.find((x) => x.name === subject).slug];
    for (const e of list) for (const w of new Set(wordsOf(e.t))) df.set(w, (df.get(w) || 0) + 1);
    return (idfMemo[subject] = (w) => Math.log(list.length / (df.get(w) || 1)) + 1);
  }
  // The word stems b shares with a, most distinctive first (at most n).
  const sharedWords = (a, b, subject, n = 6) => { const sa = new Set(wordsOf(a)), f = idfOf(subject); return [...new Set(wordsOf(b))].filter((w) => sa.has(w)).sort((x, y) => f(y) - f(x)).slice(0, n); };
  // Text with the words of the given stems highlighted (escaped piece by piece).
  const markWords = (text, stems) => { const set = new Set(stems); return String(text).split(/([A-Za-z]+)/).map((p, i) => (i % 2 && p.length > 2 && set.has(stemW(p)) ? `<mark class="kw">${esc(p)}</mark>` : esc(p))).join(""); };
  const trunc = (t, n) => (t.length > n ? t.slice(0, n).replace(/\s+\S*$/, "") + "…" : t);
  // The words a standard shares with every standard it is closely linked to (before or after), for the popup.
  function linkedWords(e) {
    if (!S.prog) return [];
    const k = e.f + "|" + e.c, sub = S.subjOf.get(k), me = fullText2(e), out = new Set();
    for (const l of S.progLanes.get(k) || []) for (const [a, b, sm] of l.links) if (sm >= MIN_SIM && (a === k || b === k)) { const o = S.byKey.get(a === k ? b : a); if (o) for (const w of sharedWords(fullText2(o), me, sub, 4)) out.add(w); }
    // Only the most distinctive few, so the highlight points at something.
    const f = idfOf(sub); return [...out].sort((x, y) => f(y) - f(x)).slice(0, 6);
  }
  // Shared words highlighted, and words that are new since the standard before underlined (what rises).
  const markNew = (text, before, stems) => { const set = new Set(stems), old = new Set(wordsOf(before)); return String(text).split(/([A-Za-z]+)/).map((p, i) => (i % 2 && p.length > 2 && set.has(stemW(p)) ? `<mark class="kw">${esc(p)}</mark>` : i % 2 && p.length > 3 && !STOPW.has(p.toLowerCase()) && !old.has(stemW(p)) ? `<span class="kw-new">${esc(p)}</span>` : esc(p))).join(""); };
  const wordFor = (stem, text) => (String(text).match(/[A-Za-z]+/g) || []).find((w) => stemW(w) === stem) || stem;
  const fullText2 = (e) => { const sl = S.meta.subjects.find((x) => x.name === S.subjOf.get(e.f + "|" + e.c)).slug, d = S.detail[sl]; return (d && d[`${e.f}|${e.c}|${e.pl[0]}`] || {}).text || e.t; };
  // One chain in full: each grade's standard, its rating, and the wording it shares with the standards before and after.
  async function chainDialog(laneId, ks) {
    const l = laneById(laneId), ms = ks.map((k) => S.byKey.get(k)).filter(Boolean); if (!l || !ms.length) return;
    const sub = S.subjOf.get(ks[0]); await loadDetail(S.meta.subjects.find((x) => x.name === sub).slug).catch(() => null);
    dlgShow(`${codeText(ms[0])} across grades`, () => chainDialog(laneId, ks));
    $("#d-eyebrow").innerHTML = `${esc(l.subject)} · ${esc(l.name)} · <span class="basis b-${l.basis}">${esc(BASIS[l.basis])}</span>`;
    $("#d-title").textContent = `${codeText(ms[0])} followed across the grades`;
    const items2 = ms.map((e, i) => {
      const t = fullText2(e), prev = ms[i - 1], next = ms[i + 1];
      const wp = prev ? sharedWords(fullText2(prev), t, sub) : [], wn = next ? sharedWords(t, fullText2(next), sub) : [];
      const same = prev && wordsOf(fullText2(prev)).join(" ") === wordsOf(t).join(" ");
      return `<li class="ch-step"><div class="ch-g"><b>${e.pl.map(gl).join(", ")}</b><span class="pd-pills">${gradePills(e, GRADES)}</span></div>
        <div class="ch-c">${badge(e.f)} ${codeHTML(e)} <span class="mks">${marks(e, e.pl[0])}</span></div>
        <p class="ch-t">${prev ? markNew(t, fullText2(prev), [...wp, ...wn]) : markWords(t, wn)}</p>
        ${prev ? (() => { const p = preOf(e).find((x) => x.k === ks[i - 1]);
          return `<p class="muted ch-why">${p ? `<span class="tag pt">${esc(PTYPE[p.type] || p.type)}</span> <span class="tag src">${esc(PSRC[p.src] || p.src)}</span> ${p.why ? `${p.whySrc === "ai" && p.src !== "ai" ? "Reason suggested by AI: " : ""}${esc(p.why)}` : ""}` : "Closest wording in the step before (inferred)."} ${same ? "Same Wisconsin wording as the grade before: the standard itself does not show how the expectation rises." : wp.length ? `Shared words: ${wp.map((w) => `<mark class="kw">${esc(wordFor(w, t))}</mark>`).join(" ")}` : ""}</p>`; })() : ""}
        ${preOf(e).length > 1 ? `<p class="muted ch-why">What it needs first: ${preChip(e)}</p>` : ""}</li>`;
    });
    const others = (S.progLanes.get(ks[0]) || []).filter((y) => y !== l);
    $("#d-body").innerHTML = `${dlgBack()}<p class="lede">Each standard is matched to the standard it builds on in an earlier grade: from the prerequisite map (each link says what kind it is, where it comes from and why), or, where the map has nothing, the closest wording in the same progression. The link need not be the same words: it can be a concept, a procedure, or a different skill that is needed first. Highlighted words are wording two standards share; underlined words are new since the standard before (what rises).</p>
      <ol class="ch-list">${items2.join("")}</ol>
      ${others.length ? `<p class="muted">${esc(codeText(ms[0]))} is also in: ${others.map((y) => (mode() === "full" ? `<button type="button" class="linkish" data-act="goto-lane" data-id="${esc(y.id)}">${esc(y.name)}</button>` : esc(y.name))).join("; ")}.</p>` : ""}
      ${mode() === "full" ? `<p><button type="button" class="ghost sm" data-act="goto-lane" data-id="${esc(l.id)}">Open the whole progression</button></p>` : ""}`;
    if (!$("#detail").open) $("#detail").showModal();
  }
  // The rows in view: in a band view each row keeps only its standards placed in the band (vk), and rows that then
  // match are shown once.
  function chainRows(list, gs) {
    const keys = new Set(list.map((e) => e.f + "|" + e.c)), inView = (k) => S.byKey.get(k).pl.some((g) => gs.includes(g)), seen = new Set(), all = [];
    chains(S.f.subject).forEach((c, i) => { const vk = c.ks.filter(inView);
      if (!vk.length || !c.ks.some((k) => keys.has(k)) || seen.has(c.lane.id + vk.join())) return;
      seen.add(c.lane.id + vk.join()); all.push({ ...c, vk, i }); });
    const order = new Map(S.prog.lanes.map((l, i) => [l.id, i]));
    return all.sort((a, b) => order.get(a.lane.id) - order.get(b.lane.id) || a.i - b.i);
  }
  function chainView(list, gs) {
    if (!S.prog) return `<div class="panel empty">Progressions are loading…</div>`;
    const every = chainRows(list, gs), all = S.chainAll ? every : every.filter((c) => c.vk.length > 1);
    const multi = all.filter((c) => c.vk.length > 1).length, noneNote = !multi && all.length ? `<p class="notice sm-note">No progression has standards in two of the grades in view (${esc(gs.map(gl).join(", "))}), so nothing can be followed across grades here. Choose K-12 to follow these standards from the earlier grades into these.</p>` : "", shown = S.gridAll || S.printAll || all.length <= 200 ? all : all.slice(0, GRID_ROWS), eeN = list.filter((e) => isEE(e.f)).length;
    // Where each link in a chain comes from (the prerequisite map's source, or wording when the map has none).
    const srcOf = (c) => c.ks.slice(1).map((k, j) => { const p = preOf(S.byKey.get(k)).find((x) => x.k === c.ks[j]); return p ? p.src : "words"; });
    const tally = (cs) => { const t = {}; for (const c of cs) for (const x of srcOf(c)) t[x] = (t[x] || 0) + 1; return Object.entries(t).sort((a, b) => b[1] - a[1]).map(([x, n]) => `${n} ${PSHORT[x]}`).join(", "); };
    let rows = "", last = null, prevKs = [];
    for (const c of shown) {
      if (c.lane !== last) { const t = tally(all.filter((y) => y.lane === c.lane)); rows += `<tr class="strand-row"><td colspan="${gs.length + 1}">${esc(c.lane.name)} <span class="ch-basis">progression: ${esc(BASIS[c.lane.basis])}${t ? `; links: ${esc(t)}` : ""}</span></td></tr>`; last = c.lane; prevKs = []; }
      const ms = c.ks.map((k) => S.byKey.get(k)), ownG = (e) => { const h = e.pl.filter((x) => !(e.pa || []).includes(x)); return h.length ? h : e.pl; }, at = (g) => [...ms].reverse().find((e) => ownG(e).includes(g)) || [...ms].reverse().find((e) => e.pl.includes(g)), lead = S.byKey.get(c.from && c.vk.length > 1 && c.vk[0] === c.from ? c.vk[1] : c.vk[0]);
      const span = gs.map((g) => !!at(g)), lo = span.indexOf(true), hi = span.lastIndexOf(true), tail = ms[ms.length - 1];
      // After the last square: is a link expected? The progression either has standards in a later grade (none linked to
      // this one: a dashed "?") or ends here (a bar: nothing later is expected). The same before the first square.
      const laneG = (S.laneGrades || (S.laneGrades = new Map())).get(c.lane.id) || S.laneGrades.set(c.lane.id, new Set(c.lane.steps.flatMap((st) => st.k.flatMap((k) => (S.byKey.get(k) || { pl: [] }).pl)))).get(c.lane.id);
      const later = gs.slice(hi + 1).find((g) => laneG.has(g)), earlier = c.from ? null : gs.slice(0, Math.max(lo, 0)).reverse().find((g) => laneG.has(g));
      const endAt = hi + 1 < gs.length ? hi + 1 : -1, startAt = !c.from && lo > 0 ? lo - 1 : -1;
      // A linked standard in this progression shown in another row: an arrow, not "?".
      const inLaneSet = new Set(c.lane.steps.flatMap((st) => st.k)), gIdx = (x) => GRADES.indexOf(x.pl[0]);
      const nextIn = postOf(tail).filter((p) => gIdx(p.e) > gIdx(tail) && (inLaneSet.has(p.k) || p.src === "cm" || p.src === "anchor")), head = ms[0];
      const prevIn = c.from ? [] : preOf(head).filter((p) => gIdx(p.e) < gIdx(head) && (inLaneSet.has(p.k) || p.src === "cm" || p.src === "anchor"));
      const endMark = nextIn.length ? `<span class="ch-more" title="Linked to ${esc(nextIn.map((p) => codeText(p.e) + " (" + gl(p.e.pl[0]) + ")").join(", "))}, shown in another row${nextIn.some((p) => !inLaneSet.has(p.k)) ? " or progression" : " of this progression"}">→</span>` : later ? `<span class="ch-open" title="This progression has standards in ${esc(gname(later))}, but none is linked to this one">?</span>` : `<span class="ch-end" title="The progression has no standard after this grade: no later link is expected"></span>`;
      const startMark = prevIn.length ? `<span class="ch-more" title="Linked from ${esc(prevIn.map((p) => codeText(p.e) + " (" + gl(p.e.pl[0]) + ")").join(", "))}, shown in another row${prevIn.some((p) => !inLaneSet.has(p.k)) ? " or progression" : " of this progression"}">←</span>` : earlier ? `<span class="ch-open" title="This progression has standards in ${esc(gname(earlier))}, but none is linked to this one">?</span>` : "";
      const cells = gs.map((g, i) => {
        const e = at(g);
        if (!e) return `<td data-gi="${g}" class="${S.f.grade === g ? "sel" : ""}">${i > lo && i < hi ? `<span class="ch-skip" title="No standard for this idea in ${esc(gname(g))}"></span>` : i === endAt ? endMark : i === startAt ? startMark : ""}</td>`;
        const r = rating(e.f, e.c, g), inPlan = isPn(e, g), pr = isPr(e, g), j = ms.indexOf(e), same = j > 0 && c.same[j - 1], rep = prevKs.includes(e.f + "|" + e.c) || (j === 0 && !!c.from);
        return `<td data-gi="${g}" class="${S.f.grade === g ? "sel" : ""}"><button class="cell ${r ? "l" + r.level : ""} ${inPlan ? "inplan" : ""} ${pr ? "prio" : ""} ${same ? "same" : ""} ${rep ? "rep" : ""}" data-act="open" data-k="${esc(e.f + "|" + e.c)}" data-g="${g}" data-tip="1"
          aria-label="${esc(codeText(e))}, ${esc(gname(g))}: ${r ? LEVEL[r.level] : "not rated"}${inPlan ? ", in plans" : ""}${pr ? ", " + prName(g).toLowerCase() + " standard" : ""}${same ? ", same Wisconsin wording as the grade before" : ""}"></button><span class="cell-code">${esc(codeText(e).replace(/ \(part \d+ of \d+\)$/, ""))}</span></td>`;
      }).join("");
      prevKs = c.ks; const src = [...new Set(srcOf(c))];
      // Where the last standard leads on in another progression (official links only), so a row is not read as a dead end.
      const inRow = new Set((S.progLanes ? [...S.prog.lanes.filter((y) => y === c.lane)] : []).flatMap((y) => y.steps.flatMap((st) => st.k)));
      const onward = postOf(tail).filter((p) => (p.src === "cm" || p.src === "anchor") && !inRow.has(p.k) && GRADES.indexOf(p.e.pl[0]) > GRADES.indexOf(tail.pl[0]));
      const onLanes = [...new Map(onward.flatMap((p) => (S.progLanes.get(p.k) || []).map((y) => [y.id, [y, p]]))).values()].slice(0, 2);
      const contTxt = onLanes.length ? ` · continues in ${onLanes.map(([y, p]) => `${mode() === "full" ? `<button type="button" class="linkish" data-act="goto-lane" data-id="${esc(y.id)}">${esc(y.name)}</button>` : esc(y.name)}: <button type="button" class="linkish code-link" data-act="open" data-k="${esc(p.k)}">${esc(codeText(p.e))}</button> (${esc(gl(p.e.pl[0]))})`).join("; ")}` : "";
      rows += `<tr><td class="rowh">${codeHTML(lead)}<small class="ch-to">${c.from ? `branch from ${esc(codeText(S.byKey.get(c.from)))} · ` : lead !== ms[0] ? `chain starts at ${esc(codeText(ms[0]))} (${esc(gl(ms[0].pl[0]))}) · ` : ""}${src.length ? `<span class="tag src src-${src[0]}">${esc(src.map((x) => PSHORT[x]).join(" + "))}</span> ` : ""}${ms.length > 1 ? `<button type="button" class="linkish" data-act="chain" data-id="${esc(c.lane.id)}" data-ks="${esc(c.ks.join("~"))}">${tail !== lead ? `to ${esc(codeText(tail))} (${esc(gl(tail.pl[tail.pl.length - 1]))}): ` : ""}see the links</button>` : contTxt ? "no later standard in this progression" : "no match in another grade of this progression"}${contTxt}</small></td>${cells}</tr>`;
    }
    return `<div class="panel rows-view"><h3>${esc(S.f.subject)} standards matched across grades, ${esc(divLabel(S.f.division))} ${hb("hm_rows")}</h3>
      <p class="muted">Each row starts with a standard and follows it, within one progression, into the standard in a later grade that builds on it, so each square is that grade's rating of its own standard. A standard in more than one progression has a row in each; where one leads to several standards, each extra one starts a branch row (its first square faded). ${every.filter((c) => c.vk.length > 1).length} of ${every.length} rows reach two or more grades; the rest have no match in another grade of the same progression. <button type="button" class="ghost sm" data-act="chain-all">${S.chainAll ? "Show only rows that reach two or more grades" : `Also show the ${every.length - every.filter((c) => c.vk.length > 1).length} single-grade rows`}</button> Matches come from the prerequisite map (Coherence Map in Math, the same anchor standard in ELA, links suggested by an AI reviewer in other cases, labelled "check"), or else the closest wording. Click <b>see the links</b> to read each grade's standard, how it is linked to the one before, and why.${eeN ? " Essential Elements follow their linked standard, so they are not shown here." : ""}
        <ul class="rv-key"><li><span class="cell-k l2"></span> rating in that grade</li><li><span class="cell-k"></span> not rated yet</li><li><span class="ch-skip-k"></span> no standard for the idea in that grade</li><li><span class="ch-end-k"></span> the progression ends: no later link expected</li><li><span class="ch-more-k">→</span> linked on to a standard shown in another row or progression (← linked from one)</li><li><span class="ch-open-k">?</span> the progression has standards in a later (or earlier) grade but none is linked to this one</li><li><span class="prio-key"></span> ${prWords()} there</li>${SHOW_PLANS ? `<li><span class="plan-key"></span> in that grade's curriculum docs</li>` : ""}<li><span class="cell-k l2 same"></span> same Wisconsin wording as the grade before</li></ul>
        Point at a square for the standard; click it to open it.</p>
      ${noneNote}<div class="hm-wrap rows-wrap"><table class="hm hm-rows"><thead><tr><th class="rowh">Starts with</th>${gs.map((g) => `<th data-gi="${g}" class="${S.f.grade === g ? "sel" : ""}"><span class="colh">${gl(g)}${courseOf(g, S.f.subject) ? `<span class="colh-course">${esc(courseOf(g, S.f.subject))}</span>` : ""}</span></th>`).join("")}</tr></thead><tbody>${rows || `<tr><td colspan="${gs.length + 1}" class="muted">No standards in view.</td></tr>`}</tbody></table></div>
      ${all.length > shown.length ? `<p class="grid-more"><button type="button" class="ghost" data-act="grid-all">Show all ${all.length} rows</button> <span class="muted">Showing the first ${shown.length}.</span></p>` : ""}</div>`;
  }

  // The standards behind one coverage-map tile, with each grade's rating and where they sit in their progressions.
  function tileDialog(g, rowKey) {
    const list = filtered().filter((e) => rowOf(e).key === rowKey); if (!list.length) return;
    const row = rowOf(list[0]), mine = list.filter((e) => e.pl.includes(g) && markOkG(e, g)), extra = list.filter((e) => !e.pl.includes(g) && (rating(e.f, e.c, g)?.level || 0) > 0), gs = visibleGrades();
    const row1 = (e) => { const r = rating(e.f, e.c, g), lanes = S.progLanes ? S.progLanes.get(e.f + "|" + e.c) || [] : [];
      return `<li class="fi"><span class="fi-ev">${strip(e, gs)}</span><span class="fi-code">${badge(e.f)} ${codeHTML(e)}</span><span class="fi-body"><span class="fi-tags"><span class="pill"><i class="lv ${r ? "lv-" + r.level : "lv-none"}"></i>${esc(gl(g))}: ${r ? LEVEL[r.level] : "Not rated"}</span> ${marks(e, g)}${lanes[0] ? ` <button type="button" class="linkish sm-link" data-act="goto-lane" data-id="${esc(lanes[0].id)}">Progression: ${esc(lanes[0].name.slice(0, 40))}${lanes[0].name.length > 40 ? "…" : ""}</button>` : ""}</span><span class="muted">${esc(e.t.slice(0, 160))}${e.t.length > 160 ? "…" : ""}</span></span></li>`; };
    const c = countLevels(mine, g), sets = rowSets(mine.length ? mine : list);
    dlgShow(`${gname(g)} · ${row.label}`, () => tileDialog(g, rowKey));
    $("#d-eyebrow").innerHTML = `${sets.map(badge).join(" ")} ${esc(S.f.subject)} · ${esc(sets.map((f) => FW_NAME[f] || f).join(" + "))}`; $("#d-title").textContent = `${gname(g)} · ${row.label}`;
    $("#d-body").innerHTML = `${dlgBack()}<p class="lede">${mine.length} standard${mine.length === 1 ? "" : "s"} suggested for ${esc(gname(g))} here: ${c[2]} in depth, ${c[1]} introduced, ${c[0]} not taught${c[3] ? `, ${c[3]} not rated` : ""}. The strip before each one shows every grade's rating (suggested grade outlined).</p>
      <ul class="gap-list one">${mine.map(row1).join("") || "<li class='muted'>None.</li>"}</ul>
      ${extra.length ? `<h3>Also taught in ${esc(gname(g))} (suggested for other grades)</h3><ul class="gap-list one">${extra.map(row1).join("")}</ul>` : ""}`;
    if (!$("#detail").open) $("#detail").showModal();
  }

  // The popup keeps a short history, so a standard opened from a tile list (or from another standard) has a Back
  // button. dlgShow(label, redraw) is called by each popup page before it fills the popup.
  S.dlg = { cur: null, hist: [] };
  function dlgShow(label, redraw) {
    if ($("#detail").open && S.dlg.cur && S.dlg.cur.label !== label) S.dlg.hist.push(S.dlg.cur);
    if (!$("#detail").open) S.dlg.hist = [];
    S.dlg.cur = { label, redraw };
  }
  const dlgBack = () => { const p = S.dlg.hist[S.dlg.hist.length - 1]; return p ? `<p class="dlg-back"><button type="button" class="linkish" data-act="dlg-back">← Back to ${esc(p.label)}</button></p>` : ""; };

  // Standard by standard across K-12 (used by the Vertical Alignment Audit). Colour = what each grade said in Part 1;
  // a bar under a square marks a grade whose documents cite the standard, an orange corner a priority or power grade.
  // Drawing every standard x 13 grades at once is slow (tens of thousands of cells), so the grid starts with GRID_ROWS
  // rows and offers the rest on request.
  const GRID_ROWS = 120;
  function standardGrid(list, gs) {
    let rows = "", last = null;
    const all = list.length, shown = S.gridAll || S.printAll ? list : list.slice(0, GRID_ROWS);
    for (const e of shown) {
      const head = (subj().frameworks.length > 1 ? (FW_NAME[e.f] || e.f) + " · " : "") + (e.s || "");
      if (head !== last) { rows += `<tr class="strand-row"><td colspan="${gs.length + 1}">${badge(e.f)} ${esc(head)}</td></tr>`; last = head; }
      rows += `<tr><td class="rowh">${codeHTML(e)}</td>` +
        gs.map((g) => {
          const r = rating(e.f, e.c, g), placed = e.pl.includes(g), inPlan = !!ev(e.f, e.c, g) || isPn(e, g), pr = isPr(e, g);
          const cls = ["cell", r ? "l" + r.level : "", placed ? "placed" : "", r && r.level > 0 && !placed ? "off" : "", inPlan ? "inplan" : "", pr ? "prio" : ""].join(" ");
          return `<td data-gi="${g}" class="${S.f.grade === g ? "sel" : ""}"><button class="${cls}" data-act="open" data-k="${esc(e.f + "|" + e.c)}" data-g="${g}" data-tip="1"
            aria-label="${esc(codeText(e))}, ${esc(gname(g))}: ${r ? LEVEL[r.level] : "not rated"}${placed ? ", suggested grade" : ""}${inPlan ? ", in plans" : ""}${pr ? ", " + prName(g).toLowerCase() + " standard" : ""}"></button></td>`;
        }).join("") + `</tr>`;
    }
    return `<div class="hm-wrap"><table class="hm" data-sel="${esc(S.f.grade)}"><thead><tr><th class="rowh">Code</th>${gs.map((g) => `<th data-gi="${g}" class="${S.f.grade === g ? "sel" : ""}"><span class="colh">${gl(g)}</span></th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>${all > shown.length ? `<p class="grid-more"><button type="button" class="ghost" data-act="grid-all">Show all ${all} standards</button> <span class="muted">Showing the first ${shown.length}. Showing all can take a few seconds. ${hb("grid_more")}</span></p>` : ""}`;
  }

  // The grades whose rating a conclusion about the standard needs: its suggested grades, and any grade that names it a
  // priority or power standard and can rate it. A standard is only a confirmed gap once all of them have rated it.
  const owners = (e) => GRADES.filter((g) => e.pl.includes(g) || (isPr(e, g) && forGrade(e, g)));
  // A standard whose grade is only a suggestion (e.sg) belongs to a band (HS = 9-12, MS = 6-8, 3-5 ...): the other grades
  // of the band could teach it but were not asked. Grades whose own plans cite a standard could too.
  function bandOf(e) {
    if (!e.sg) return [];
    const b = e.band === "HS" ? "9-12" : e.band === "MS" ? "6-8" : e.band || "", m = b.match(/^(K|\d+)-(\d+)$/);
    return m ? GRADES.slice(GRADES.indexOf(m[1]), GRADES.indexOf(m[2]) + 1) : [];
  }
  // Grades that have not rated the standard but might teach it: owners still to rate ("waiting"), band grades and grades
  // whose plans cite it ("not asked"). A gap is confirmed only when this is empty.
  function unknownFor(e) {
    // waiting: grades it is placed in (they are asked to rate it). The rest are not asked: grades that name it a priority
    // without it being placed there (prio), the other grades of its band, grades whose plans cite it.
    const rated = (g) => !!rating(e.f, e.c, g), own = owners(e), prio = own.filter((g) => !e.pl.includes(g) && !rated(g));
    return { waiting: e.pl.filter((g) => !rated(g)), prio, band: bandOf(e).filter((g) => !own.includes(g) && !rated(g)), plans: GRADES.filter((g) => isPn(e, g) && !own.includes(g) && !rated(g)) };
  }
  // The grades a standard belongs to: where it is placed, and the rest of its band for a band standard (9-12 ...).
  const ownGrades = (e) => [...new Set([...e.pl, ...bandOf(e)])];
  const unknownTags = (u) => (u.waiting.length ? ` <span class="tag wait">waiting for ${u.waiting.map(gl).join(", ")}</span>` : "")
    + (u.prio.length ? ` <span class="tag wait">not asked: ${u.prio.map(gl).join(", ")} (names it a ${u.prio.every((g) => DIV.Elementary.includes(g)) ? "power" : "priority"} standard)</span>` : "")
    + (u.band.length ? ` <span class="tag wait">not asked: ${u.band.map(gl).join(", ")} (same band)</span>` : "")
    + (u.plans.length ? ` <span class="tag wait">${u.plans.map(gl).join(", ")} curriculum docs cite it, not rated there</span>` : "");
  const unknownAny = (u) => u.waiting.length + u.prio.length + u.band.length + u.plans.length > 0;
  // Sort every standard in view into findings. "Confirmed" needs every owner grade's rating; anything still waiting
  // for ratings is "possible" or unknown, never a gap. All of these are automatic checks over the live ratings.
  function analyse(list) {
    const out = { gap: [], asked: [], maybe: [], weak: [], unrated: [], placedNot: [], dup: [], early: [], reinforce: [], elsewhere: [] };
    for (const e of list) {
      const lv = levelsAcross(e);
      if (!lv.length) { out.unrated.push(e); continue; }
      const u = unknownFor(e);
      // Confirmed: nothing open. Asked: every grade asked to rate it says not taught; only grades never asked are open.
      if (lv.every((x) => x.r.level === 0)) (!unknownAny(u) ? out.gap : u.waiting.length ? out.maybe : out.asked).push({ e, u });
      else if (!lv.some((x) => x.r.level === 2)) out.weak.push({ e, u });
      // In depth in two or more grades: across its own band (reinforcement), again after its suggested grade
      // (possible duplication), or only before it (a placement question, not a duplicate).
      const deep = lv.filter((x) => x.r.level === 2), first = GRADES.indexOf(e.pl[0]);
      if (deep.length >= 2) {
        const own = ownGrades(e), other = deep.filter((x) => !own.includes(x.g));
        (!other.length ? out.reinforce : other.some((x) => GRADES.indexOf(x.g) > first) ? out.dup : out.early).push({ e, gs: deep.map((x) => x.g) });
      }
      for (const x of lv) {
        if (e.pl.includes(x.g) && x.r.level === 0 && lv.some((y) => y.r.level > 0)) out.placedNot.push({ e, g: x.g });
        if (!e.pl.includes(x.g) && x.r.level > 0) out.elsewhere.push({ e, g: x.g, l: x.r.level });
      }
    }
    return out;
  }
  // Every automatic check that applies to one standard, in plain words: the popup's "Why this standard is flagged" box
  // and the CSV's Findings column. Each item: [short label, sentence].
  const SEV = ["high", "mid", "wait", "info"];   // order: official findings, other findings, waiting for ratings, notes
  function checksFor(e) {
    const out = [], lv = levelsAcross(e), u = unknownFor(e), list = (gs) => gs.map(gname).join(", ");
    const open = [u.waiting.length ? `${list(u.waiting)} (should rate it) ${u.waiting.length > 1 ? "have" : "has"} not rated it yet` : "", u.prio.length ? `${list(u.prio)} ${u.prio.length > 1 ? "name" : "names"} it a priority but ${u.prio.length > 1 ? "were" : "was"} not asked to rate it` : "", u.band.length ? `${list(u.band)}, in the same band, ${u.band.length > 1 ? "were" : "was"} not asked` : "", u.plans.length ? `the curriculum docs of ${list(u.plans)} cite it (not rated there)` : ""].filter(Boolean).join("; ");
    if (!lv.length) out.push(["Unknown", "No grade has rated it yet, so nothing can be concluded.", "wait"]);
    else if (lv.every((x) => x.r.level === 0)) out.push(open && !u.waiting.length ? ["Not taught where asked", `Every grade asked to rate it (${list(lv.map((x) => x.g))}) says not taught. Only grades never asked are open: ${open}. Ask them, or decide where it belongs.`, "mid"] : open ? ["Possible gap", `Every grade that rated it (${list(lv.map((x) => x.g))}) says not taught. Not settled yet: ${open}.`, "wait"] : ["Confirmed gap", `Rated not taught by ${list(lv.map((x) => x.g))}: every grade it is suggested for, named priority by, or cited in the curriculum docs of.`, "high"]);
    else if (!lv.some((x) => x.r.level === 2)) out.push(["Only introduced", `No grade that rated it teaches it in depth${open ? `; ${open}` : ""}.`, "mid"]);
    for (const g of GRADES.filter((x) => isPr(e, x))) {
      const r = rating(e.f, e.c, g);
      if (!forGrade(e, g)) out.push([`${prName(g)} elsewhere`, `${gname(g)}'s documents name it a ${prName(g).toLowerCase()} standard, but it is placed in ${list(e.pl)}, so ${gname(g)} does not rate it.`, "info"]);
      else if (r && r.level < 2) out.push([`${prName(g)} below in depth`, `A ${prName(g).toLowerCase()} standard for ${gname(g)}${isEE(e.f) ? " (through the standard it links to)" : ""}, rated ${LEVEL[r.level].toLowerCase()} there.`, "high"]);
      else if (!r) out.push([`${prName(g)} not rated`, `A ${prName(g).toLowerCase()} standard for ${gname(g)}, not rated there yet.`, "wait"]);
    }
    if (!isEE(e.f)) for (const g of GRADES.filter((x) => isPn(e, x))) if (rating(e.f, e.c, g)?.level === 0) out.push(["In curriculum docs, not taught", `${gname(g)}'s documents cite it, but ${gname(g)} rates it not taught.`, "high"]);
    const og = ownGrades(e), deep = lv.filter((x) => x.r.level === 2).map((x) => x.g), other = deep.filter((g) => !og.includes(g));
    if (deep.length >= 2) out.push(!other.length ? ["Reinforcement", `Taught in depth in ${list(deep)}, ${deep.some((g) => !e.pl.includes(g)) ? "grades of its band" : "grades it is placed in"}${(e.pa || []).some((x) => deep.includes(x)) ? (SHOW_PLANS ? " (some because their curriculum docs cite it)" : " (some added to those grades)") : ""}.`, "info"]
      : other.some((g) => GRADES.indexOf(g) > GRADES.indexOf(e.pl[0])) ? ["Possible duplication", `Taught in depth in ${list(deep)}; it is suggested for ${list(e.pl)}.`, "mid"]
      : ["Taught early", `Taught in depth in ${list(other)} before its suggested grade (${list(e.pl)})${deep.some((g) => e.pl.includes(g)) ? `, and in ${list(deep.filter((g) => e.pl.includes(g)))}` : ""}.`, "mid"]);
    for (const x of lv) if (e.pl.includes(x.g) && x.r.level === 0 && lv.some((y) => y.r.level > 0)) out.push(["Not taught in its grade", `${gname(x.g)} says not taught, while ${list(lv.filter((y) => y.r.level > 0).map((y) => y.g))} ${lv.filter((y) => y.r.level > 0).length > 1 ? "teach" : "teaches"} it.`, "mid"]);
    // Progression problems that involve it, in any row of its subject (also the ones it causes in other rows).
    if (S.prog) { const k = e.f + "|" + e.c; for (const { x, f } of progFlags(S.subjOf.get(k), GRADES)) if (f.k === k || f.ka === k || (f.ks || []).includes(k) || (f.kas || []).includes(k)) out.push([flagName(f), `${x.l.name}: ${f.msg}`, f.official && !f.within ? "high" : "mid"]); }
    return out;
  }
  // A tiny K-12 strip: each grade's rating, with the suggested grade outlined and the chosen grade marked. The evidence
  // behind every finding. Screen readers get the same thing as a sentence.
  function strip(e, gs) {
    const say = gs.map((g) => { const r = rating(e.f, e.c, g); return `${gl(g)} ${r ? LEVEL_SHORT[r.level].toLowerCase() : "not rated"}${e.pl.includes(g) ? " (suggested)" : ""}`; }).join(", ");
    return `<span class="mstrip" role="img" aria-label="${esc("Ratings by grade: " + say)}"><b>${gl(gs[0])}</b>${gs.map((g) => { const r = rating(e.f, e.c, g); return `<i class="${r ? "l" + r.level : ""} ${e.pl.includes(g) ? "pl" : ""} ${S.f.grade === g ? "sel" : ""}" title="${esc(gname(g))}: ${r ? LEVEL[r.level] : "not rated"}${e.pl.includes(g) ? " (suggested grade)" : ""}"></i>`; }).join("")}<b>${gl(gs[gs.length - 1]).replace("G", "")}</b></span>`;
  }
  function li(e, extra, gs) { return `<li class="fi">${gs ? `<span class="fi-ev">${strip(e, gs)}</span>` : ""}<span class="fi-code">${badge(e.f)} ${codeHTML(e, searchQ())}</span><span class="fi-body"><span class="fi-tags">${extra || ""} ${marks(e, "")}</span><span class="muted">${hl(S.printAll ? e.t : e.t.slice(0, 140), searchQ())}${e.t.length > 140 && !S.printAll ? "…" : ""}</span></span></li>`; }
  // Which sections are open on the Gaps page, the Audit and the dashboard, kept across redraws (the page redraws when
  // ratings arrive or a popup closes). Unset means the section's default.
  S.open = {};
  // Printing (or saving as PDF) shows every section open and every list in full (S.printAll).
  const isOpen = (id, dflt) => (S.printAll ? true : id in S.open ? S.open[id] : !!dflt);
  // Long lists show their first 25 lines, with a button for the rest (S.more remembers which were opened).
  S.more = {};
  function renderGaps() {
    const el = $("#view-gaps"), gs = visibleGrades(), g = S.f.grade;
    // With a grade chosen: only the standards that grade works with (suggested for it, rated by it, or in its documents).
    let list = ordered(filtered(), "");
    if (g) list = list.filter((e) => forGrade(e, g) || rating(e.f, e.c, g) || isPr(e, g) || isPn(e, g));
    const a = analyse(list), n = list.length, inView = (x) => gs.includes(x.g) && (!g || x.g === g);
    // Findings about one grade only count when that grade is in view (a 3-5 page does not list Kindergarten's ratings).
    a.placedNot = a.placedNot.filter(inView); a.elsewhere = a.elsewhere.filter(inView);
    for (const k of ["dup", "early", "reinforce"]) a[k] = a[k].filter((x) => x.gs.some((y) => gs.includes(y)));
    const prGap = [], prUnrated = [], planNot = [];
    for (const e of list) {
      // Not rated: only in the grades a standard is placed in (the same count as the coverage map); rated: any grade that rates it.
      for (const pg of (e.pr || []).filter((x) => gs.includes(x) && (!g || x === g) && forGrade(e, x))) { const r = rating(e.f, e.c, pg); if (!r) { if (e.pl.includes(pg)) prUnrated.push({ e, g: pg }); } else if (r.level < 2) prGap.push({ e, g: pg, r }); }
      if (!isEE(e.f) && SHOW_PLANS) for (const pg of (e.pn || []).filter((x) => gs.includes(x) && (!g || x === g))) if (rating(e.f, e.c, pg)?.level === 0) planNot.push({ e, g: pg });
    }
    // Progression problems need the steps before and after, so they use every standard in view (not only the grade's).
    // Checked across every grade (a prerequisite can sit outside the band in view), then kept when it involves a grade in
    // view: the grade taught in depth, the grade of the missing standard, or a grade of the step.
    const keys = new Set(filtered({ ignoreDivision: true }).map((e) => e.f + "|" + e.c)), inGs = (x) => gs.includes(x);
    const breaks0 = progFlags(S.f.subject, GRADES, keys).filter(({ f }) => (inGs(f.g) || inGs(f.cause) || (f.gs || []).some(inGs)) && (!g || f.g === g || f.cause === g || (f.gs || []).includes(g)));
    const firstAt = new Map(); breaks0.forEach(({ f }, i) => { if (!firstAt.has(causeKey(f))) firstAt.set(causeKey(f), i); });
    const breaks = breaks0.map((x, i) => ({ ...x, i })).sort((a, b) => firstAt.get(causeKey(a.f)) - firstAt.get(causeKey(b.f)) || a.i - b.i);
    const rated = n - a.unrated.length, pct = (x) => (n ? Math.round((x / n) * 100) : 0), eeN = list.filter((e) => isEE(e.f)).length;
    // Essential Elements are counted apart: the cards count the main standards, each section lists them after the rest.
    const eeOf = (x) => { const e = typeof x.f === "string" ? x : x.e; return !!e && isEE(e.f); }, nEE = (arr) => arr.filter(eeOf).length;
    const eeNote = (arr) => { const k = nEE(arr); return k ? `. Plus ${k} Essential Element${k > 1 ? "s" : ""}, listed apart` : ""; };
    // Summary cards: coloured only when they count a problem; each one opens its section below.
    const card = (id, arr, label, sub, cls) => { const num = arr.length - nEE(arr);
      return `<button type="button" class="ins ${num ? cls || "" : ""}" data-act="open-sec" data-id="gap-${id}"><b>${num}</b><span>${num === 1 ? label.replace(/gaps\b/, "gap").replace(/problems\b/, "problem") : label}</span><small>${sub}${eeNote(arr)}</small></button>`; };
    const sec = (id, title, desc, todo, arr0, fn, open) => { const all = S.more["gap-" + id] || S.printAll, cut = S.printAll ? Infinity : all ? 300 : 25, k = nEE(arr0);
      const arr = k ? [...arr0.filter((x) => !eeOf(x)), ...arr0.filter(eeOf)] : arr0, first = arr.length - k;
      const lis = arr.slice(0, cut).map((x, i) => (k && i === first ? `<li class="ee-div muted">Essential Elements (${k}): they follow the standard they link to</li>` : "") + fn(x)).join("");
      return `<details class="gap" id="gap-${id}" data-sec="gap-${id}" ${isOpen("gap-" + id, open) ? "open" : ""}><summary><span class="count">${first}${k ? `<small> + ${k} EE</small>` : ""}</span>${title} <span class="tag auto">Automatic check</span></summary>
      <p class="muted">${desc}${todo ? ` <b>What to do:</b> ${todo}` : ""}</p><ul class="gap-list one">${lis || "<li class='muted'>None found.</li>"}</ul>${arr.length > cut ? (all ? `<p class="muted">Showing 300 of ${arr.length}. Narrow the view with the filters above.</p>` : `<p><button type="button" class="ghost sm" data-act="more" data-id="gap-${id}">Show all ${arr.length}</button></p>`) : ""}</details>`; };
    const flagLi = ({ x, f }) => `<li><span class="mk-flag f-${f.t}${f.t === "prereq" && !f.official ? " soft" : ""}">${flagName(f)}</span> <button type="button" class="linkish" data-act="goto-lane" data-id="${esc(x.l.id)}">${esc(x.l.name)}</button> <span class="muted">${msgHTML(f)}</span>${f.ka ? "" : ` <span class="tag">${esc(BASIS[x.l.basis])}</span>`}</li>`;
    el.innerHTML = `<div class="panel insights"><h2>Gaps and repetition: ${esc(S.f.subject)}, ${esc(g ? gname(g) : divLabel(S.f.division))} ${hb("gaps")}</h2>
      <p class="lede">${g ? `Standards ${esc(gname(g))} works with: suggested for it, rated by it, or named in its documents. ` : ""}${n} standards in view${eeN ? ` (${eeN} of them Essential Elements, counted apart)` : ""}; ${rated} (${pct(rated)}%) rated by at least one grade. A standard nobody has rated is <b>unknown</b>, and a gap is only <b>confirmed</b> once every grade that should teach it has rated it. <span class="muted">Updates as teams rate.</span></p>
      <div class="ins-grid">
        ${card("gap", a.gap, "confirmed gaps", `rated not taught by every grade it is suggested for${SHOW_PLANS ? ", named priority by, or cited in the curriculum docs of" : ` or that names it a ${prWords(g)} standard`}`, "ins-issue")}
        ${card("asked", a.asked, "not taught where asked", "every grade asked to rate it says not taught; other grades that might teach it were never asked", "ins-warn")}
        ${card("maybe", a.maybe, "possible gaps", "not taught where rated, but a grade asked to rate it has not yet", "ins-data")}
        ${card("prio", prGap, `${prWords(g)} below in depth`, `rated in their grade, not taught in depth${prUnrated.length - nEE(prUnrated) ? `; ${prUnrated.length - nEE(prUnrated)} more not rated yet` : ""}`, "ins-issue")}
        ${(() => { const off = breaks.filter(({ f }) => f.official && !f.within).length, inG = breaks.filter(({ f }) => f.t === "prereq" && f.official && f.within).length;
          return card("breaks", breaks, "progression findings", `in ${new Set(breaks.map(({ x }) => x.l.id)).size} progressions: ${off} between grades on official links (${S.f.subject === "Math" ? "Coherence Map" : S.f.subject === "ELA" ? "same anchor standard" : "official steps of the progression"})${inG ? `, ${inG} inside one grade on official links` : ""}, ${breaks.length - off - inG} possible (links suggested by AI or found by wording)`, off ? "ins-issue" : "ins-warn"); })()}
        ${card("dup", a.dup, "possible duplication", "taught in depth again in a later grade", "ins-warn")}
        ${card("unrated", a.unrated, "unknown", "no grade has rated these yet", "ins-data")}
      </div></div>
    <div class="panel">
      ${sec("gap", "Confirmed gaps: not taught in any grade that could teach it", "Rated not taught by its suggested grade(s), by any grade that names it a " + prWords(g) + " standard," + (SHOW_PLANS ? " by any grade whose curriculum docs cite it" : "") + " and, for a standard placed in a band (such as high school), by every grade of the band.", "decide which grade should teach it, or confirm it is intentionally left out.", a.gap, ({ e }) => li(e, `<span class="tag">suggested ${e.pl.map(glc).join(", ")}</span>`, gs), true)}
      ${sec("asked", "Not taught where asked: only grades never asked are open", "Every grade asked to rate the standard (the grades it is placed in) says not taught. Grades that might still teach it were never asked, so their ratings will not come in on their own: another grade of its band, a grade that names it a " + prWords(g) + " standard without it being placed there" + (SHOW_PLANS ? ", or a grade whose curriculum docs cite it." : "."), "ask those grades directly or check their plans, then decide where the standard belongs. ", a.asked, ({ e, u }) => li(e, `<span class="tag">suggested ${e.pl.map(glc).join(", ")}</span>${unknownTags(u)}`, gs), true)}
      ${sec("maybe", "Possible gaps: a grade asked to rate it has not yet", "Every grade that rated the standard says not taught, but a grade it is placed in has not rated it yet (waiting).", "wait for those ratings, or ask those grades.", a.maybe, ({ e, u }) => li(e, `<span class="tag">suggested ${e.pl.map(glc).join(", ")}</span>${unknownTags(u)}`, gs))}
      ${sec("prio", `★ ${prName(g)} standards not taught in depth`, "The school's documents name these as priority (6-12) or power (K-5) for a grade, and that grade rates them introduced or not taught. Essential Elements take the mark from the standard they link to.", "check whether the priority list or the teaching should change.", prGap, (x) => li(x.e, `<span class="tag">${glc(x.g)} · ${LEVEL_SHORT[x.r.level]}</span>`, gs))}
      ${sec("prio-un", `★ ${prName(g)} standards not rated yet`, `Named ${prWords(g)} standards, placed in the grade that names them, that it has not rated yet. Unknown, not a gap.`, "", prUnrated, (x) => li(x.e, `<span class="tag wait">${glc(x.g)} · not rated</span>`, gs))}
      ${sec("breaks", "Progression findings", `From the Progressions page${g ? `, involving ${esc(gname(g))} (in it, or caused by its ratings)` : ""}: a middle step where every standard is rated not taught and no grade that rated them teaches them, or a standard taught in depth while a standard it builds on is not taught where rated. Only fully rated steps are checked. Each line names the source of the link between the two standards: official (Coherence Map, same anchor standard), suggested by an AI reviewer, or found by wording.`, "open the progression to see every step.", breaks, flagLi)}
      ${sec("dup", "Possible duplication: taught in depth again later", "Taught in depth in a grade after its suggested grade (often its own grade too).", "agree which grade owns it; the later grade can review or extend it.", a.dup, (x) => li(x.e, `<span class="tag">in depth: ${x.gs.map(glc).join(", ")} (suggested ${x.e.pl.map(glc).join(", ")})</span>`, gs))}
      ${sec("early", "Taught in depth before its suggested grade", "An earlier grade teaches it in depth (sometimes as well as its own grade). This is a placement question, not a duplicate.", "decide whether the standard belongs in the earlier grade.", a.early, (x) => li(x.e, `<span class="tag">in depth: ${x.gs.map(glc).join(", ")} (suggested ${x.e.pl.map(glc).join(", ")})</span>`, gs))}
      ${SHOW_PLANS ? sec("plans", "In the curriculum documents, but marked not taught", "A grade's curriculum documents cite the standard, but the grade says it is not taught. Essential Elements are left out: curriculum docs cite the main standard's code.", "check the plan or the rating.", planNot, (x) => li(x.e, `<span class="tag">${glc(x.g)}</span>`, gs)) : ""}
      ${sec("weak", "Only introduced: no grade teaches it in depth", "Rated, but no grade that rated it reports teaching, practising and assessing it.", "decide where it should be taught in depth.", a.weak, ({ e, u }) => li(e, `<span class="tag">suggested ${e.pl.map(glc).join(", ")}</span>${unknownTags(u)}`, gs))}
      ${sec("placed", "Not taught in the suggested grade, but taught elsewhere", "The suggested grade says not taught while another grade teaches it.", "consider moving the standard to the grade that teaches it.", a.placedNot, (x) => li(x.e, `<span class="tag">${glc(x.g)} says not taught</span>`, gs))}
      ${sec("moves", "Taught in a grade other than the suggested one", "A grade teaches a standard that is suggested for another grade. It may be review or extension.", "use these when deciding where standards belong.", a.elsewhere, (x) => li(x.e, `<span class="tag sg">${glc(x.g)} · ${LEVEL_SHORT[x.l]} (suggested ${x.e.pl.map(glc).join(", ")})</span>`, gs))}
      ${sec("reinforce", "Reinforcement across its grades", "Taught in depth in two or more of the grades the standard belongs to: the grades it is placed in (a two-grade band such as 9-10, or a grade the standard was added to), or the other grades of its band (a high school standard taught in Grades 10 and 11). Taught in depth in a later grade outside these counts as possible duplication instead.", "check the expectation rises from one grade to the next.", a.reinforce, (x) => li(x.e, `<span class="tag">in depth: ${x.gs.map(glc).join(", ")}</span>`, gs))}
      ${sec("unrated", "Unknown: not rated yet", "No grade has rated these, so nothing can be concluded.", "", a.unrated, (e) => li(e, `<span class="tag">${e.pl.map(glc).join(", ")}</span>`, gs))}
      <p class="muted mstrip-key">Each line starts with a small strip, one square per grade from ${esc(gl(gs[0]))} to ${esc(gl(gs[gs.length - 1]))}, coloured by its rating (white = not rated); the suggested grade is outlined${g ? ` and ${esc(gname(g))} is underlined` : ""}. ${hb("legend")}</p>
    </div>`;
  }

  // What a grade's ratings say needs a look in one subject, most consequential first: problems that reach other grades,
  // then priority standards, plans, the weakest strand, possible moves. Each item: [title, standards, flags, id].
  // Used by the dashboard (one subject in full) and its cross-subject list (counts only).
  function gradeReview(g, subject, list) {
    const lv = (e) => rating(e.f, e.c, g)?.level, sl = S.meta.subjects.find((x) => x.name === subject).slug;
    const hasPlans = S.idx[sl].some((e) => isPn(e, g));
    // Counts are for the main standards; Essential Elements linked to them are added in brackets, never mixed in.
    const split = (arr) => [arr.filter((e) => !isEE(e.f)), arr.filter((e) => isEE(e.f))];
    const pr = list.filter((e) => isPr(e, g)), [prLow, prLowEE] = split(pr.filter((e) => lv(e) != null && lv(e) < 2)), [prUn, prUnEE] = split(pr.filter((e) => lv(e) == null));
    const planNot = list.filter((e) => isPn(e, g) && !isEE(e.f) && lv(e) === 0);       // plans cite main codes, not EE
    const notPlan = hasPlans ? list.filter((e) => !isEE(e.f) && !isPn(e, g) && lv(e) === 2) : [];
    const [extra, extraEE] = split(S.idx[sl].filter((e) => !e.pl.includes(g) && (lv(e) || 0) > 0 && (!S.f.framework || subject !== S.f.subject || e.f === S.f.framework)));
    const flags = progFlags(subject, GRADES);
    // Problems that reach a later grade, counted by the standards rated here that cause them; then problems in this grade
    // that are not the same thing seen from the other side.
    const caused = flags.filter(({ f }) => f.cause === g && f.g !== g), causeKeys = new Set(caused.flatMap(({ f }) => f.kas || (f.ka ? [f.ka] : f.ks || [])).filter((k) => S.byKey.get(k).pl.includes(g)));
    const causedF = new Set(caused.map(({ f }) => f)), here = flags.filter(({ f }) => (f.g === g || (f.gs || []).includes(g)) && !causedF.has(f));
    const strands = []; for (const e of list) { const key = e.f + "|" + (e.s || "Other"); let x = strands.find((y) => y.key === key); if (!x) strands.push(x = { key, f: e.f, s: e.s || "Other", arr: [] }); x.arr.push(e); }
    strands.forEach((x) => (x.c = countLevels(x.arr, g)));
    const worst = strands.filter((x) => !isEE(x.f) && x.arr.length - x.c[3] >= 3 && x.c[0] / (x.arr.length - x.c[3]) >= 0.4).sort((a, b) => b.c[0] / (b.arr.length - b.c[3]) - a.c[0] / (a.arr.length - a.c[3]))[0];
    const pl = (n, one, many) => `<b>${n}</b> ${n === 1 ? one : many}`, ee = (n) => (n ? ` (plus ${n} linked Essential Element${n > 1 ? "s" : ""})` : "");
    // "5 power standards are rated below in depth (plus 6 linked Essential Elements)", or only the Essential Elements.
    const both = (m, x, one, many, rest) => (m ? `${pl(m, one, many)} ${rest}${ee(x)}` : `${pl(x, "linked Essential Element is", "linked Essential Elements are")} ${rest}`);
    const P = prName(g).toLowerCase(), soft = caused.length && caused.every(({ f }) => f.t === "prereq" && !f.official), mixed = !soft && caused.some(({ f }) => f.t === "prereq" && !f.official);
    // Priority or power standards this grade's documents name but that are placed in another grade (it does not rate them).
    const prElse = S.idx[sl].filter((e) => isPr(e, g) && !isEE(e.f) && !e.pl.includes(g));
    return [
      caused.length ? (() => { const off = caused.filter(({ f }) => f.official).length, sug = caused.length - off;
        return [`${pl(causeKeys.size || caused.length, "standard rated not taught here is", "standards rated not taught here are")} needed first in ${gnames([...new Set(caused.map(({ f }) => f.g))].sort((a, b) => GRADES.indexOf(a) - GRADES.indexOf(b)))}: ${off ? `${off} finding${off > 1 ? "s" : ""} on official links` : ""}${off && sug ? ", " : ""}${sug ? `${sug} on suggested links` : ""}`, [...causeKeys].map((k) => S.byKey.get(k)), caused, "caused"]; })() : null,
      here.length ? (() => { const o = here.filter(({ f }) => f.official).length, sg = here.length - o; return [`${pl(here.length, "progression finding", "progression findings")} in ${esc(gname(g))}: ${[o ? `${o} on official links` : "", sg ? `${sg} on suggested links` : ""].filter(Boolean).join(", ")}`, null, here, "here"]; })() : null,
      prLow.length + prLowEE.length ? [both(prLow.length, prLowEE.length, `${P} standard is`, `${P} standards are`, "rated below in depth"), prLow.concat(prLowEE), null, "prlow"] : null,
      planNot.length ? [both(planNot.length, 0, "standard is", "standards are", "in the grade's curriculum documents but marked not taught"), planNot, null, "plannot"] : null,
      worst ? [`${badge(worst.f)} <b>${esc(worst.s)}</b>${isEE(worst.f) ? " (Essential Elements)" : ""}: ${worst.c[0]} of ${worst.arr.length - worst.c[3]} rated standards not taught`, worst.arr.filter((e) => lv(e) === 0), null, "strand"] : null,
      extra.length + extraEE.length ? [both(extra.length, extraEE.length, "standard is", "standards are", "suggested for another grade but taught here (possible moves)"), extra.concat(extraEE), null, "extra"] : null,
      prUn.length + prUnEE.length ? [both(prUn.length, prUnEE.length, `${P} standard is`, `${P} standards are`, "not rated yet"), prUn.concat(prUnEE), null, "prun"] : null,
      prElse.length ? [`${pl(prElse.length, `${P} standard named for this grade is`, `${P} standards named for this grade are`)} placed in another grade (${esc(gname(g))} rates only band standards it claims on the Rate page)`, prElse, null, "prelse"] : null,
      notPlan.length ? [`${pl(notPlan.length, "standard is", "standards are")} taught in depth but not cited in the curriculum documents (they may not list every standard taught)`, notPlan, null, "notplan"] : null,
    ].filter(Boolean);
  }
  // The standards a grade rates in one subject, in the sets its team chose (or the one set picked in the filter).
  function gradeList(g, subject) {
    const sl = S.meta.subjects.find((x) => x.name === subject).slug, fws = subject === S.f.subject && S.f.framework ? [S.f.framework] : setsFor(subject, g);
    return S.idx[sl].filter((e) => e.pl.includes(g) && fws.includes(e.f) && (subject !== S.f.subject || (!S.f.strand || e.s === S.f.strand) && markOkG(e, g)));
  }
  // The whole grade first (every subject side by side, and what to review in each), then the chosen subject in full.
  // Everything is worked out from the live ratings, so it fills in as teams rate.
  function renderDashboard() {
    const el = $("#view-dashboard"), g = S.f.grade;
    if (!g) return pickGrade(el, "its dashboard");
    const list = gradeList(g, S.f.subject), main = list.filter((e) => !isEE(e.f)), ee = list.filter((e) => isEE(e.f));
    const tot = countLevels(main, g), rated = main.length - tot[3], eeC = countLevels(ee, g);
    const strands = []; for (const e of list) { const key = e.f + "|" + (e.s || "Other"); let x = strands.find((y) => y.key === key); if (!x) strands.push(x = { key, f: e.f, s: e.s || "Other", arr: [] }); x.arr.push(e); }
    strands.forEach((x) => { x.c = countLevels(x.arr, g); x.score = x.c[2] / (x.arr.length - x.c[3] || 1); });
    const ratedStrands = strands.filter((x) => !isEE(x.f) && x.arr.length - x.c[3] >= 3).sort((a, b) => b.score - a.score);
    const hasPlans = items().some((e) => isPn(e, g));
    const pr = main.filter((e) => isPr(e, g)), pn = main.filter((e) => isPn(e, g)), deep = (l) => l.filter((e) => rating(e.f, e.c, g)?.level === 2).length, rt = (l) => l.filter((e) => rating(e.f, e.c, g)).length;
    const extra = S.idx[subj().slug].filter((e) => !e.pl.includes(g) && !isEE(e.f) && (rating(e.f, e.c, g)?.level || 0) > 0);
    const bars = strands.map((x) => {
      const w = (i) => (x.c[i] / x.arr.length) * 100;
      return `<button type="button" class="sb-name" data-act="strand" data-s="${esc(x.s)}" title="Open this strand on the Rate page">${badge(x.f)} ${esc(x.s)}</button><div class="sb" role="img" aria-label="${esc(x.s)}: ${x.c[2]} in depth, ${x.c[1]} introduced, ${x.c[0]} not taught, ${x.c[3]} not rated">
        ${[[2, COLORS[2]], [1, COLORS[1]], [0, COLORS[0]], [3, "#FFFFFF"]].map(([i, col]) => (x.c[i] ? `<i class="${i === 3 ? "sb-un" : ""}" style="width:${w(i)}%;background:${col}" data-tip-text="${esc(x.s)}: ${x.c[i]} ${i === 3 ? "not rated" : LEVEL[i].toLowerCase()}"></i>` : "")).join("")}</div>
        <div class="num">${x.c[2]}/${x.arr.length}</div>`;
    }).join("");
    const review = gradeReview(g, S.f.subject, list);
    const flagLi = ({ x, f }) => `<li><span class="mk-flag f-${f.t}${f.t === "prereq" && !f.official ? " soft" : ""}">${flagName(f)}</span> <button type="button" class="linkish" data-act="goto-lane" data-id="${esc(x.l.id)}">${esc(x.l.name)}</button> <span class="muted">${msgHTML(f)}</span></li>`;
    const revItem = ([title, arr, br, id], i) => `<details class="rev" data-sec="dash-${id}" ${isOpen("dash-" + id, i === 0 && !["prun", "notplan", "extra"].includes(id)) ? "open" : ""}><summary>${title} <span class="tag auto">Automatic check</span></summary>${arr ? `<ul class="gap-list rev-list">${arr.slice(0, S.printAll ? Infinity : 15).map((e) => { const r = rating(e.f, e.c, g); return `<li><span class="rv-code">${badge(e.f)} ${codeHTML(e)}</span> <span class="muted">${esc(S.printAll ? e.t : e.t.slice(0, 100))}${e.t.length > 100 && !S.printAll ? "…" : ""}</span> <span class="pill"><i class="lv ${r ? "lv-" + r.level : "lv-none"}"></i>${r ? LEVEL_SHORT[r.level] : "Not rated"}</span>${!e.pl.includes(g) ? ` <span class="tag sg">suggested ${esc(e.pl.map(gl).join(", "))}</span>` : ""}</li>`; }).join("")}</ul>${arr.length > 15 && !S.printAll ? `<p class="muted">and ${arr.length - 15} more.</p>` : ""}` : ""}
      ${br ? `<ul class="issues">${br.map(flagLi).join("")}</ul>` : ""}</details>`;
    const subs = S.meta.subjects.map((x) => x.name).filter((sb) => teamOf(g, sb));
    const gi = GRADES.indexOf(g), near = [GRADES[gi - 1], GRADES[gi + 1]];
    el.innerHTML = backBar() + `<p class="grade-nav">${near[0] ? `<button type="button" class="linkish" data-act="grade" data-g="${near[0]}">← ${esc(gname(near[0]))}</button>` : ""}${near[1] ? `<button type="button" class="linkish" data-act="grade" data-g="${near[1]}">${esc(gname(near[1]))} →</button>` : ""}</p>` + gradeOverview(g, subs, true) + `<div class="panel insights"><h2>${esc(gname(g))} · ${esc(S.f.subject)}${courseOf(g, S.f.subject) && courseOf(g, S.f.subject) !== S.f.subject ? ` (${esc(courseOf(g, S.f.subject))})` : ""} ${hb("dashboard")}</h2>
      <p class="lede">${rated ? `${rated} of ${main.length} main standards rated (${Math.round((rated / main.length) * 100)}%): ${tot[2]} taught in depth, ${tot[1]} introduced, ${tot[0]} not taught.${ee.length ? ` Essential Elements: ${ee.length - eeC[3]} of ${ee.length} rated.` : ""}${ratedStrands.length > 1 ? ` Highest share in depth: <b>${esc(ratedStrands[0].s)}</b>; lowest share in depth: <b>${ratedStrands.filter((x) => x.score === ratedStrands[ratedStrands.length - 1].score).map((x) => esc(x.s)).join("</b> and <b>")}</b>.` : ""}` : `No ratings yet for ${esc(gname(g))} ${esc(S.f.subject)}. This page fills in as the team rates.`} <span class="muted">Sets: ${setsFor(S.f.subject, g).map(badge).join(" ")} (the team's choice${S.f.framework ? "; the Standard set filter is narrowing it" : ""}). Updates as teams rate.</span></p>
      <h3>What to review ${hb("dash_review")}</h3>
      ${review.length ? review.map(revItem).join("") : `<p class="muted">${rated ? "Nothing stands out yet." : "Nothing to review until the team rates its standards."}</p>`}
      <div class="tiles">
        <div class="tile ring-tile">${donut(tot, 64)}<div class="l">${rated} of ${main.length} main standards rated ${hb("t_rated")}</div></div>
        <div class="tile t2"><div class="n">${tot[2]}</div><div class="l">taught in depth ${hb("t_depth")}</div></div>
        <div class="tile t1"><div class="n">${tot[1]}</div><div class="l">introduced or exposed ${hb("t_intro")}</div></div>
        <div class="tile t0"><div class="n">${tot[0]}</div><div class="l">not taught ${hb("t_not")}</div></div>
        <div class="tile t-pr"><div class="n">${deep(pr)}<small>/${rt(pr)}</small></div><div class="l">rated <span class="mk mk-pr">★ ${prName(g)}</span> standards taught in depth${pr.length - rt(pr) ? `; ${pr.length - rt(pr)} not rated` : ""} ${hb("t_prio")}</div></div>
        ${SHOW_PLANS ? `<div class="tile t-pn"><div class="n">${hasPlans ? `${deep(pn)}<small>/${rt(pn)}</small>` : "n/a"}</div><div class="l">${hasPlans ? `rated <span class="mk mk-pn">✓ In curriculum docs</span> standards taught in depth${pn.length - rt(pn) ? `; ${pn.length - rt(pn)} not rated` : ""}` : "No plan data yet for this grade and subject"} ${hb("t_plans")}</div></div>` : ""}
        <div class="tile"><div class="n">${extra.length}</div><div class="l">taught here but suggested for another grade ${hb("t_extra")}</div></div>
      </div>
      <h3 class="info-only">Coverage by strand ${hb("strandbars")}</h3><p class="muted sm-note info-only">The number on the right is how many are taught in depth, out of the strand's standards.</p><div class="strand-bars" id="dash-bars">${bars || "<div class='muted'>No standards.</div>"}</div></div>`;
  }

  /* ---------------- prerequisites (site/data/prereqs.json, scripts/build_prereqs.py) ---------------- */
  // For each standard, the standards it needs first, with the kind of link and where it comes from. Math: Coherence Map
  // arrows (Student Achievement Partners, after the Common Core progressions). ELA: the same anchor standard one grade
  // earlier (official). ELA, Science and Social Studies: prerequisites suggested by an AI reviewer, each with a reason,
  // always labelled "suggested, check". A standard can need several standards, from one grade or several.
  // anchorp: the same anchor standard, but which part of it (L.6.1.a ... d) is matched by wording, so it is not official.
  const PTYPE = { same: "Same skill, earlier", concept: "Concept it relies on", procedure: "Procedure it extends", prereq: "Prerequisite skill", build: "Builds on" };
  const PTYPE_POST = { same: "Same skill, later", concept: "Relies on this concept", procedure: "Extends this procedure", prereq: "Needs this skill first", build: "Builds on this" };
  const ptype = (p, later) => (later ? PTYPE_POST : PTYPE)[p.type] || p.type;
  const PSRC = { cm: "Coherence Map", anchor: "Same anchor standard (official)", anchorp: "Same anchor standard, part matched by wording", ai: "Suggested, check", words: "Closest wording (inferred)" };
  const PSHORT = { cm: "Coherence Map", anchor: "official anchor", anchorp: "anchor, part by wording", ai: "AI suggestion", words: "wording" };
  const SRC_RANK = { cm: 0, anchor: 0, anchorp: 1, ai: 2, words: 3 };
  // Official links first, then the nearest grade.
  const byTrust = (a, later) => a.slice().sort((x, y) => (SRC_RANK[x.src] ?? 4) - (SRC_RANK[y.src] ?? 4) || (later ? 1 : -1) * (GRADES.indexOf(x.e.pl[0]) - GRADES.indexOf(y.e.pl[0])));
  const preOf = (e) => (S.pre && S.pre.get(e.f + "|" + e.c)) || [];
  const postOf = (e) => (S.post && S.post.get(e.f + "|" + e.c)) || [];
  const ratingsText = (x) => x.pl.map((g) => { const r = rating(x.f, x.c, g); return `${gl(g)} ${r ? LEVEL_SHORT[r.level].toLowerCase() : "not rated"}`; }).join(", ");
  // "5 prerequisites" chip: pointing at it lists them with their ratings; clicking opens the standard.
  // Prerequisites grouped: the parts of one split standard (same grp) count as one, missing only when every part is.
  const preGroups = (e) => [...preOf(e).reduce((m, p) => { const id = p.grp || p.k; (m.get(id) || m.set(id, []).get(id)).push(p); return m; }, new Map()).values()];
  const groupNot = (ps) => ps.every((p) => fullyNot(p.e));
  function preChip(e) {
    const pre = preOf(e); if (!pre.length) return "";
    const gr = preGroups(e), bad = gr.filter(groupNot).length, un = gr.filter((ps) => ps.every((p) => !p.e.pl.some((g) => rating(p.e.f, p.e.c, g)))).length, k = e.f + "|" + e.c;
    return `<button type="button" class="pq ${bad ? "bad" : ""}" data-act="open" data-k="${esc(k)}" data-pq="${esc(k)}" aria-label="${gr.length} prerequisites: ${esc(pre.map((p) => codeText(p.e) + " (" + ratingsText(p.e) + ")").join("; "))}">${gr.length} prerequisite${gr.length > 1 ? "s" : ""}${bad ? ` · ${bad} not taught` : ""}${un ? ` · ${un} not rated` : ""}</button>`;
  }
  function preTip(e) {
    const pre = preOf(e);
    return `<b>${esc(codeText(e))} needs first</b>${byTrust(pre, false).map((p) => `<br>${esc(codeText(p.e))} <i>${esc(PTYPE[p.type] || p.type)}; ${esc(PSHORT[p.src] || p.src)}</i> · ${esc(ratingsText(p.e))}${fullyNot(p.e) ? " · NOT TAUGHT" : ""}`).join("")}<br><span style="opacity:.8">Click to open the standard.</span>`;
  }
  // The popup's "Needs first / Leads to" box.
  function preBox(e) {
    const pre = preOf(e), post = postOf(e), k = e.f + "|" + e.c, sub = S.subjOf.get(k), me = fullText2(e);
    if (!pre.length && !post.length) return `<p class="muted">${isEE(e.f) ? "Essential Elements follow the standard they link to." : "No prerequisites are recorded for this standard yet."}</p>`;
    const item = (p, before) => { const x = p.e, t = fullText2(x), lit = p.type === "same" || p.src === "anchor" || p.src === "anchorp", sw = lit ? sharedWords(before ? t : me, before ? me : t, sub) : [];
      return `<li>${codeHTML(x)} <span class="pd-pills">${gradePills(x, GRADES, true)}</span> <span class="tag pt">${esc(ptype(p, !before))}</span> <span class="tag src src-${p.src}">${esc(PSRC[p.src] || p.src)}</span>${before && p.grp ? ` <span class="tag">part of ${esc(p.grp)}: counted as one with its other parts${(() => { const t = pre.filter((q) => q.grp === p.grp && taughtIn(q.e).length); return t.length ? `; taught: ${t.map((q) => codeText(q.e)).join(", ")}` : groupNot(pre.filter((q) => q.grp === p.grp)) ? "; no part is taught" : ""; })()}</span>` : ""}${before && fullyNot(x) && (!p.grp || groupNot(pre.filter((q) => q.grp === p.grp))) ? ` <span class="mk-flag sev-high">Not taught where rated</span>` : ""}
        ${p.why ? `<small class="pb-why">${p.whySrc === "ai" && p.src !== "ai" ? "Reason suggested by AI: " : ""}${esc(p.why)}</small>` : ""}<span class="pb-t">${lit ? markWords(trunc(t, 180), sw) : esc(trunc(t, 180))}</span></li>`; };
    return `<div class="pb-cols"><div><h4>Needs first (${preGroups(e).length}${preGroups(e).length < pre.length ? `; ${pre.length} lines, split standards' parts counted as one` : ""})</h4><ul class="pb-list">${byTrust(pre, false).map((p) => item(p, true)).join("") || "<li class='muted'>None recorded.</li>"}</ul></div>
      <div><h4>Leads to (${post.length})</h4><ul class="pb-list">${byTrust(post, true).slice(0, S.printAll ? Infinity : 8).map((p) => item(p, false)).join("") || "<li class='muted'>None recorded.</li>"}${post.length > 8 ? `<li class="muted">and ${post.length - 8} more</li>` : ""}</ul></div></div>
      <p class="muted sm-note">Each link says what kind it is and where it comes from: Coherence Map (Math, after the Common Core progressions), the same anchor standard (ELA, official when the grade before has one standard for it or the parts read the same; "part matched by wording" when the part was chosen by its wording, which is not official), or suggested by an AI curriculum reviewer (check before relying on it). Official links are listed first. Each rating shows its grade. Highlighted words are wording the two standards share.</p>`;
  }

  /* ---------------- Progressions: each idea followed across the grades ---------------- */
  // Lanes come from data/progressions.json (scripts/build_progressions.py). A lane's steps are the standards for one idea
  // in each grade; links join each standard to the ones in the step before that it most clearly builds on (inferred from
  // shared wording; links weaker than MIN_SIM are never shown as "builds on"). The checks are automatic, use only rated
  // standards, and are labelled as such:
  //   break    a middle step where every standard is rated not taught in its grade and no grade teaches any of them
  //   moved    the same, but another grade does teach them (the idea may simply sit in a different grade)
  //   prereq   a standard taught in depth while a standard it builds on is rated not taught and taught nowhere
  //   repeat   a standard taught in depth in two or more grades (reinforcement across a band, or possible duplication)
  //   same     a standard with the same wording as the one it builds on (the standard itself does not rise)
  const MIN_SIM = 0.12, PRE_SIM = 0.25;   // links shown as "builds on"; links strong enough to support a prerequisite verdict
  const BASIS = { anchor: "Official anchor standard", dci: "Official core idea (NGSS), joined by matches", wiss: "Official Wisconsin standard, K-5 by suggested matches", topic: "Inferred topic" };
  const FLAG = { stop: "Last steps not taught", break: "Step not taught", moved: "Taught in another grade", prereq: "Prerequisite not taught (official link)", repeat: "Repeated in depth", reinforce: "Reinforced across grades", same: "Same wording" };
  // The standards that cause a break or prerequisite gap (rated not taught), so problems with one cause are listed together.
  const causeKs = (f) => (f.t === "prereq" ? (f.kas || [f.ka]).filter(Boolean) : []).concat(f.t !== "prereq" || !f.ka ? f.ks || [] : []);
  const causeKey = (f) => causeKs(f).join() || f.t + f.g;
  function causeLi(arr, fl) {
    if (arr.length < 2) return fl(arr[0]);
    const es = causeKs(arr[0].f).map((k) => S.byKey.get(k)).filter(Boolean);
    return `<li class="cause-grp"><span class="mk-flag f-cause">One cause, ${arr.length} findings</span> ${es.slice(0, 3).map((e) => `<button type="button" class="linkish code-link" data-act="open" data-k="${esc(e.f + "|" + e.c)}">${esc(codeMsg(e))}</button> (${esc(gl(e.pl[0]))})`).join(", ")}${es.length > 3 ? ` and ${es.length - 3} more` : ""} ${es.length > 1 ? "are" : "is"} rated not taught, and each finding below depends on ${es.length > 1 ? "them" : "it"}.<ul class="issues sub">${arr.map(fl).join("")}</ul></li>`;
  }
  // A row whose own standard is the missing official prerequisite of a finding in another row gets the same status.
  const withCauses = (x) => (x.status !== "issue" && x.steps.flatMap((st) => st.k).some((k) => causedBy(x.l.subject, k).some(({ f, x: y }) => f.official && y.l !== x.l)) ? { ...x, status: "issue" } : x);
  // Remembered per subject until the next redraw (laneMemo is cleared at the same time).
  const causeMemo = new Map();
  const causedBy = (subject, k) => { if (!causeMemo.has(subject)) { const m = new Map();
      for (const it of progFlags(subject, GRADES)) if (it.f.t === "prereq" && it.f.k) for (const c of it.f.kas || [it.f.ka]) if (c && c !== it.f.k) (m.get(c) || m.set(c, []).get(c)).push(it);
      causeMemo.set(subject, m); }
    return causeMemo.get(subject).get(k) || []; };
  // A check's message with the codes of the standards it names turned into buttons that open them.
  function msgHTML(f) {
    const ks = [f.k, f.ka, ...(f.kas || []), ...(f.ks || [])].filter((k) => k && S.byKey.has(k)), by = new Map();
    for (const k of ks) { const e = S.byKey.get(k); for (const v of [codeMsg(e), codeText(e)]) if (v && !by.has(esc(v))) by.set(esc(v), k); }
    const t = esc(f.msg); if (!by.size) return t;
    const re = new RegExp([...by.keys()].sort((a, b) => b.length - a.length).map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
    return t.replace(re, (m) => `<button type="button" class="linkish code-link" data-act="open" data-k="${esc(by.get(m))}">${m}</button>`);
  }
  const flagName = (f) => (f.t === "prereq" && !f.official ? "Prerequisite not taught (suggested link)" : f.t === "prereq" && f.within ? "Prerequisite not taught, same grade (official link)" : f.t === "prereq" && f.cross ? "Prerequisite not taught, in another row (official link)" : FLAG[f.t]);
  const linkBasis = (l, one) => (l.basis === "anchor" ? (one ? "same anchor standard, official" : "same anchor standard (official); matching part inferred from wording") : "link inferred from wording");
  const home = (e) => { const h = e.pl.filter((g) => !(e.pa || []).includes(g)); return h.length ? h : e.pl; };
  const taughtIn = (e) => GRADES.filter((g) => (rating(e.f, e.c, g)?.level || 0) > 0);
  const gnames = (gs) => (gs.length < 2 ? gs.map(gname).join("") : gs.slice(0, -1).map(gname).join(", ") + " and " + gname(gs[gs.length - 1]));
  const verb = (n, one, many) => (n > 1 ? many : one);
  // A standard is "fully not taught" when every grade it is placed in (its own grade and any grade whose plans cite it)
  // rated it not taught and no other grade says it teaches it.
  // Only when it is settled: no grade that rated it teaches it, and no grade that might teach it is still to rate
  // (owners waiting, other grades of its band, grades whose plans cite it; see unknownFor()).
  const fullyNot = (e) => e.pl.every((g) => rating(e.f, e.c, g)?.level === 0) && !taughtIn(e).length && !unknownAny(unknownFor(e));
  // One step: every standard in each grade it is placed in (including grades added because their plans cite it).
  function stepState(st) {
    let n = 0, rated = 0, deep = 0, intro = 0, not = 0;
    for (const k of st.k) {
      const e = S.byKey.get(k);
      for (const g of e.pl) { n++; const r = rating(e.f, e.c, g); if (!r) continue; rated++; if (r.level === 2) deep++; else if (r.level === 1) intro++; else not++; }
    }
    return { n, rated, deep, intro, not, full: n > 0 && rated === n,
      state: !rated ? "unrated" : !deep && !intro ? "not" : not ? "mixed" : deep >= intro ? "deep" : "intro" };
  }
  // laneInfo(lane, grades in view, keys): keys (optional) keeps only those standards, so the set, strand and Standards
  // filters narrow the steps. Remembered until the next redraw. Only fully rated standards and steps are judged.
  const laneMemo = new Map();
  function laneInfo(l, gs, keys) {
    const mk = keys ? null : l.id + "|" + gs.join(); if (mk && laneMemo.has(mk)) return laneMemo.get(mk);
    const steps = l.steps.map((st) => { const k = st.k.filter((x) => S.byKey.has(x) && (!keys || keys.has(x)));
        return { ...st, k, g: GRADES.filter((g) => k.some((x) => S.byKey.get(x).pl.includes(g))) }; })
      .filter((st) => st.k.length && st.g.some((g) => gs.includes(g))).map((st) => ({ ...st, s: stepState(st) }));
    const flags = [], inLane = new Set(steps.flatMap((st) => st.k)), stepOf = new Map(steps.flatMap((st, i) => st.k.map((k) => [k, i])));
    const vis = (st) => st.g.filter((g) => gs.includes(g)), taught = (st) => st.s.deep + st.s.intro > 0, broken = new Set();
    steps.forEach((st, i) => {
      if (!(i > 0 && i < steps.length - 1 && st.s.full && st.s.state === "not" && steps.slice(0, i).some(taught) && steps.slice(i + 1).some(taught))) return;
      const es = st.k.map((k) => S.byKey.get(k)), elsewhere = [...new Set(es.flatMap(taughtIn))].sort((a, b) => GRADES.indexOf(a) - GRADES.indexOf(b));
      if (!elsewhere.length && !es.every(fullyNot)) return;      // not settled: a grade that might teach it is still to rate
      if (!elsewhere.length) broken.add(i);
      flags.push(!elsewhere.length
        ? { t: "break", g: vis(st)[0], gs: vis(st), ks: st.k, official: l.basis !== "topic", msg: `Not taught in ${gnames(vis(st))} (${es.map(codeMsg).join(", ")}): every standard in this step is rated not taught there and no grade that rated ${verb(es.length, "it", "them")} teaches ${verb(es.length, "it", "them")}, although earlier and later grades teach the idea.` }
        : { t: "moved", g: vis(st)[0], gs: vis(st), ks: st.k, msg: `${gnames(vis(st))} ${verb(vis(st).length, "rates", "rate")} this step not taught, but ${gnames(elsewhere)} ${verb(elsewhere.length, "teaches", "teach")} ${es.filter((e) => taughtIn(e).length).map(codeText).join(", ")}. The idea may simply sit in another grade.` });
    });
    // Stops: the last steps of a row all rated not taught (settled) after earlier steps teach the idea.
    { let j = steps.length; while (j > 0 && steps[j - 1].s.full && steps[j - 1].s.state === "not") j--;
      const tail = steps.slice(j), ks = tail.flatMap((st) => st.k);
      if (tail.length && j > 0 && steps.slice(0, j).some(taught) && ks.every((k) => fullyNot(S.byKey.get(k)))) {
        const gs2 = tail.flatMap(vis); tail.forEach((st, i) => broken.add(j + i));
        flags.push({ t: "stop", g: gs2[0], gs: gs2, ks, official: l.basis !== "topic", msg: `Stops after ${gname(vis(steps[j - 1])[0] || steps[j - 1].g[0])}: ${gnames(gs2)} ${verb(gs2.length, "rates", "rate")} ${ks.map((k) => codeMsg(S.byKey.get(k))).slice(0, 4).join(", ")}${ks.length > 4 ? " and more" : ""} not taught, settled (every grade that could teach ${verb(ks.length, "it", "them")} has rated ${verb(ks.length, "it", "them")}).` });
      } }
    // Prerequisite gaps, standard by standard: a standard taught in depth while a standard it needs first (from the
    // prerequisite map; without one, the close links in this progression) is fully rated not taught and taught nowhere.
    // From the map one missing prerequisite is enough; from wording links every linked standard must be missing.
    const into = new Map(); for (const [a, b, sm] of l.links) if (sm >= MIN_SIM && inLane.has(a) && inLane.has(b)) (into.get(b) || into.set(b, []).get(b)).push([a, sm]);
    for (const st of steps) for (const b of st.k) {
      const eb = S.byKey.get(b), bDeep = eb.pl.filter((g) => gs.includes(g) && rating(eb.f, eb.c, g)?.level === 2); if (!bDeep.length) continue;
      let need = preOf(eb).filter((p) => p.e.pl.some((g) => gs.includes(g)) && GRADES.indexOf(p.e.pl[0]) <= GRADES.indexOf(eb.pl[0])), fromMap = need.length > 0;
      if (!fromMap) need = (into.get(b) || []).filter(([, sm]) => l.basis === "anchor" || sm >= PRE_SIM).map(([a]) => ({ k: a, e: S.byKey.get(a), type: "same", src: l.basis !== "anchor" ? "words" : steps[stepOf.get(a)].k.length === 1 ? "anchor" : "anchorp" }));
      // Parts of one split standard (same grp) count as one prerequisite: missing only when every part is.
      const miss = need.filter((p) => fullyNot(p.e) && !broken.has(stepOf.get(p.k)) && (!p.grp || need.every((q) => q.grp !== p.grp || fullyNot(q.e))));
      if (!miss.length || (!fromMap && miss.length < need.length)) continue;
      const official = miss.some((p) => p.src === "cm" || p.src === "anchor"), within = miss.every((p) => p.e.pl.includes(bDeep[0]));
      const cross = miss.every((p) => !inLane.has(p.k)), nNeed = new Set(need.map((p) => p.grp || p.k)).size;
      flags.push({ t: "prereq", g: bDeep[0], cause: miss[0].e.pl[0], k: b, ka: miss[0].k, kas: miss.map((p) => p.k), official, within, cross,
        msg: `${within ? `Within ${gname(bDeep[0])}: ` : ""}${codeMsg(eb)} is taught in depth in ${gname(bDeep[0])}, but ${nNeed > 1 ? `${miss.length} of the ${nNeed} standards` : "the standard"} it needs first ${verb(miss.length, "is", "are")} rated not taught, settled (every grade that could teach ${verb(miss.length, "it", "them")} has rated ${verb(miss.length, "it", "them")}): ${miss.map((p) => `${codeMsg(p.e)} (${gl(p.e.pl[0])}; ${PSRC[p.src] || p.src})`).join(", ")}${cross && !within ? `, which sit${miss.length > 1 ? "" : "s"} in another progression` : ""}.` });
    }
    // Without a close link, the same check step to step, in the official order of the progression.
    steps.forEach((st, i) => {
      const prev = steps[i - 1];
      if (!prev || !st.s.deep || !prev.s.full || prev.s.state !== "not" || broken.has(i - 1) || flags.some((f) => f.t === "prereq" && st.k.includes(f.k)) || st.k.some((k) => preOf(S.byKey.get(k)).length)) return;
      if (!prev.k.every((k) => fullyNot(S.byKey.get(k)))) return;
      const dg = vis(st).filter((g) => st.k.some((k) => { const e = S.byKey.get(k); return e.pl.includes(g) && rating(e.f, e.c, g)?.level === 2; }));
      flags.push({ t: "prereq", g: dg[0], cause: vis(prev)[0], ks: prev.k, official: l.basis === "anchor", gs: dg, msg: `${gnames(dg)} ${verb(dg.length, "teaches", "teach")} this idea in depth, but every standard in the step before (${gnames(vis(prev))}) is rated not taught and no grade that rated them teaches them (${l.basis === "anchor" ? "the same official anchor standard" : "the step before in this progression; the link is not official"}).` });
    });
    for (const st of steps) for (const k of st.k) {
      const e = S.byKey.get(k), deepIn = GRADES.filter((g) => gs.includes(g) && rating(e.f, e.c, g)?.level === 2);
      if (deepIn.length < 2) continue;
      const og = ownGrades(e), own = deepIn.every((g) => og.includes(g)), added = deepIn.filter((g) => (e.pa || []).includes(g));
      if (!own && !deepIn.some((g) => !og.includes(g) && GRADES.indexOf(g) > GRADES.indexOf(e.pl[0]))) continue;   // only taught early
      flags.push(own ? { t: "reinforce", g: deepIn[0], gs: deepIn, k, msg: `${codeText(e)} is taught in depth in ${gnames(deepIn)}${added.length ? ` (${gnames(added)} ${verb(added.length, "rates", "rate")} it because ${SHOW_PLANS ? `${verb(added.length, "its", "their")} curriculum docs cite it` : "it was added to " + verb(added.length, "that grade", "those grades")})` : deepIn.some((g) => !e.pl.includes(g)) ? `, grades of its ${bandOf(e)[0] === "9" ? "high school" : "grade"} band` : ", the grades it is placed in"}: reinforcement. Check the expectation rises.` }
        : { t: "repeat", g: deepIn[0], gs: deepIn, k, msg: `${codeText(e)} (suggested for ${gnames(e.pl)}) is taught in depth in ${gnames(deepIn)}: possible duplication. Agree which grade owns it.` });
    }
    // Same wording: compared in the Wisconsin 2020 text (what the site shows); Common Core versions can differ slightly.
    for (const [a, b, , same] of l.links) if (same && inLane.has(a) && inLane.has(b)) {
      const ea = S.byKey.get(a), eb = S.byKey.get(b);
      flags.push({ t: "same", g: home(eb)[0], k: b, ka: a, msg: `In the Wisconsin 2020 text, ${eb.c} (${gl(home(eb)[0])}) reads the same as ${ea.c} (${gl(home(ea)[0])}), so the Wisconsin standard does not say how the expectation rises${eb.s === "Reading" ? " (in Reading it rises through more complex texts)" : ""}. The Common Core versions the plans use (${codeText(eb)}, ${codeText(ea)}) can differ slightly.` });
    }
    const slots = steps.reduce((n, st) => n + st.s.n, 0), rated = steps.reduce((n, st) => n + st.s.rated, 0), not = steps.reduce((n, st) => n + st.s.not, 0);
    // Status by link source, not by judgement: a settled finding on an official link sets "issue" wherever the missing
    // standard sits; findings only on suggested or wording links set "check".
    // (A row holding a missing official prerequisite gets "issue" too, in renderLadder: see withCauses.)
    const hard = flags.some((f) => ((f.t === "break" || f.t === "stop") && f.official) || (f.t === "prereq" && f.official)), soft = flags.some((f) => f.t === "prereq" && !f.official);
    const status = !steps.length ? "none" : hard ? "issue" : soft ? "check" : steps.length < 2 ? "single" : !rated ? "unrated" : rated < slots ? "partial" : not ? "thin" : "ok";
    const span = steps.length ? [vis(steps[0])[0], vis(steps[steps.length - 1]).slice(-1)[0]] : [];
    const out = { steps, flags, status, slots, rated, unrated: steps.filter((st) => st.s.state === "unrated").length, span };
    if (mk) laneMemo.set(mk, out);
    return out;
  }
  // Breaks and prerequisite gaps for one subject, for the Gaps page and the dashboard: official structure first.
  const flagRank = (f) => (!f.official ? 2 : f.t === "break" || f.t === "stop" ? 0 : 1);
  // A prerequisite gap from the map can show in every progression the standard belongs to: list it once.
  const progFlags = (subject, gs, keys) => { if (!S.prog) return []; const seen = new Set();
    return S.prog.lanes.filter((l) => l.subject === subject).map((l) => ({ l, ...laneInfo(l, gs, keys) }))
      .flatMap((x) => x.flags.filter((f) => f.t === "break" || f.t === "stop" || f.t === "prereq").map((f) => ({ x, f })))
      .filter(({ f }) => { const id = f.t === "prereq" && f.k ? "p|" + f.k : null; if (!id) return true; if (seen.has(id)) return false; seen.add(id); return true; })
      .sort((a, b) => flagRank(a.f) - flagRank(b.f)); };
  const STATUS = { issue: ["Breaks down", "st-issue"], check: ["Not taught on a suggested link", "st-thin"], single: ["One grade only", "st-none"], unrated: ["Not rated yet", "st-none"], partial: ["Partly rated", "st-part"], thin: ["Some standards not taught", "st-thin"], ok: ["Taught at every step", "st-ok"] };
  const laneById = (id) => S.prog.lanes.find((l) => l.id === id);
  const laneMatch = (x, q) => !q || x.l.name.toLowerCase().includes(q) || x.steps.some((st) => st.k.some((k) => { const e = S.byKey.get(k); return e && matchQ(e, q); }));
  const backBar = () => (S.backTo ? `<p class="back-bar"><button type="button" class="linkish" data-act="back-view">← Back to ${esc(S.backTo.label)}</button></p>` : "");
  function renderLadder() {
    const el = $("#view-ladder"), gs = visibleGrades(), q = mode() === "full" ? S.f.search.trim().toLowerCase() : "", g = S.f.grade, fw = S.f.framework;
    if (!S.prog) { el.innerHTML = `<div class="panel empty">Progressions are loading…</div>`; return; }
    if (!S.detail[subj().slug]) loadDetail(subj().slug).then(() => { if (S.view === "ladder") rerender(); }).catch(() => {});   // full texts for opened rows
    if (fw && isEE(fw)) { el.innerHTML = backBar() + `<div class="panel empty"><b>Progressions follow the main standard sets</b> (Common Core, NGSS, AERO and Wisconsin Social Studies). Essential Elements are alternate versions of those standards, so each one follows the progression of the standard it links to: open an Essential Element and use its linked standard. Choose another standard set above to see progressions.</div>`; return; }
    // The filters narrow the steps: standard set, strand and Standards (priority / in plans) keep only matching standards.
    const keys = new Set(filtered({ ignoreSearch: true }).map((e) => e.f + "|" + e.c));
    const all = S.prog.lanes.filter((l) => l.subject === S.f.subject).map((l) => withCauses({ l, ...laneInfo(l, gs, keys) }))
      .filter((x) => x.steps.length && (!g || x.steps.some((st) => st.g.includes(g))));
    const groups = [...new Set(all.map((x) => x.l.group))];
    if (S.pgGroup && !groups.includes(S.pgGroup)) S.pgGroup = "";
    const inGroup = all.filter((x) => !S.pgGroup || x.l.group === S.pgGroup);
    const has = (x, t) => x.flags.some((f) => f.t === t);
    const pick = { repeat: (x) => has(x, "repeat"), reinforce: (x) => has(x, "reinforce"), same: (x) => has(x, "same") };
    const shown = inGroup.filter((x) => (!S.pgStatus || (pick[S.pgStatus] ? pick[S.pgStatus](x) : x.status === S.pgStatus)) && laneMatch(x, q));
    const cnt = (k) => inGroup.filter((x) => (pick[k] ? pick[k](x) : x.status === k)).length;
    const seenP = new Set();
    const issues = inGroup.flatMap((x) => x.flags.filter((f) => (f.t === "break" || f.t === "stop" || f.t === "prereq") && (!g || f.g === g || f.cause === g || (f.gs || []).includes(g))).map((f) => ({ x, f })))
      .filter(({ f }) => { const id = f.t === "prereq" && f.k ? f.k : null; if (!id) return true; if (seenP.has(id)) return false; seenP.add(id); return true; })
      .sort((a, b) => flagRank(a.f) - flagRank(b.f) || GRADES.indexOf(a.f.g) - GRADES.indexOf(b.f.g));
    // Grouped by root cause: one not-taught standard (or step) can explain several problems.
    const byCause = new Map(); for (const it of issues) { const ck = causeKey(it.f); (byCause.get(ck) || byCause.set(ck, []).get(ck)).push(it); }
    const causeGroups = [...byCause.values()].sort((a, b) => (b.some(({ f }) => f.official) ? 1 : 0) - (a.some(({ f }) => f.official) ? 1 : 0)), allIssues = S.more["pg-issues"] || S.printAll, shownGroups = allIssues ? causeGroups : causeGroups.slice(0, 8);
    const moved = inGroup.flatMap((x) => x.flags.filter((f) => f.t === "moved").map((f) => ({ x, f })));
    // Each standard and grade counted once, though a standard can sit in several rows.
    const place = new Map(); for (const x of inGroup) for (const st of x.steps) for (const k of st.k) { const e = S.byKey.get(k); for (const g2 of e.pl) if (gs.includes(g2)) place.set(k + "|" + g2, !!rating(e.f, e.c, g2)); }
    const slots = place.size, rated = [...place.values()].filter(Boolean).length;
    const strong = inGroup.filter((x) => x.status === "ok" && !has(x, "same")).sort((a, b) => b.steps.length - a.steps.length);
    const chip = (k, label) => `<button type="button" class="lib-t ${(S.pgStatus || "") === k ? "on" : ""}" data-act="pg-status" data-s="${k}">${label} <span>${k ? cnt(k) : inGroup.length}</span></button>`;
    const go = (x) => `<button type="button" class="linkish" data-act="lane-go" data-id="${esc(x.l.id)}">${esc(x.l.name)}</button>`;
    const fl = ({ x, f }) => `<li><span class="mk-flag f-${f.t}${f.t === "prereq" && !f.official ? " soft" : ""}">${flagName(f)}</span> ${go(x)} <span class="muted">${msgHTML(f)}</span>${f.kas ? "" : ` <span class="tag">${esc(BASIS[x.l.basis])}</span>`}</li>`;
    const narrowed = S.f.division !== "all" || S.f.framework || S.f.strand || S.f.mark;
    const card = (n, label, sub, cls, k) => `<button type="button" class="ins ${n ? cls : ""}" data-act="pg-status" data-s="${k}"><b>${n}</b><span>${label}</span><small>${sub}</small></button>`;
    el.innerHTML = backBar() + `<div class="panel insights"><h2>${esc(S.f.subject)} progressions, ${esc(divLabel(S.f.division))} ${hb("ladder")}</h2>
      <p class="lede">Each row follows one idea across the grades. Each box is one grade: how many standards, and a bar of how that grade rates them. The line shows how the idea builds from grade to grade.${g ? ` Showing the progressions with a step in ${esc(gname(g))} (its column is highlighted).` : ""} <span class="muted">Every verdict is an automatic check over the ratings so far.</span></p>
      <div class="ins-grid">
        ${card(cnt("issue"), "progressions break down", "on official links, with settled ratings: a step or the last steps rated not taught, or a standard taught in depth while a prerequisite on an official link (or held in this row) is rated not taught", "ins-issue", "issue")}
        ${card(cnt("check"), "progressions with a standard not taught on a suggested link", "the link was suggested by the AI reviewer or found by wording, not taken from an official source", "ins-warn", "check")}
        ${card(cnt("repeat"), "progressions repeat a standard in depth", "taught in depth again in a grade it is not placed in (possible duplication)", "ins-warn", "repeat")}
        ${card(cnt("same"), "progressions repeat the same wording", "a grade's Wisconsin standard reads the same as the one before it", "ins-warn", "same")}
        ${card(cnt("ok"), "taught at every step", "two or more grades; every standard rated and at least introduced", "ins-ok", "ok")}
        <div class="ins ins-data"><b>${slots ? Math.round((rated / slots) * 100) : 0}%</b><span>of standard and grade placements rated</span><small>${slots - rated} of ${slots} still to rate: unknown, not a gap</small></div>
      </div>
      ${narrowed ? `<p class="notice sm-note">The checks below use only the grades and standards the filters above show; a step or prerequisite outside them is not checked. Set Show to K-12 and clear the other filters to check everything.</p>` : ""}
      ${issues.length ? `<h3>${issues.some(({ f }) => f.official) ? "Where progression breaks down" : "Standards not taught on suggested links (no official link involved)"} <span class="muted sm">${(() => { const isOff = ({ f }) => f.official, o = issues.filter(isOff), sg = issues.filter((x) => !isOff(x)), rows = (a) => new Set(a.map(({ x }) => x.l.id)).size;
        return [o.length ? `${o.length} on official links in ${rows(o)} row${rows(o) > 1 ? "s" : ""}` : "", sg.length ? `${sg.length} on suggested links in ${rows(sg)} row${rows(sg) > 1 ? "s" : ""}` : ""].filter(Boolean).join("; ") + " (a standard in several rows is listed once)"; })()}${(() => { const causeSet = new Set(issues.flatMap(({ f }) => causeKs(f))), n = inGroup.filter((x) => x.status === "issue" && !issues.some(({ x: y }) => y.l.id === x.l.id) && x.steps.some((st) => st.k.some((k) => causeSet.has(k)))).length; return n ? `; ${n} more row${n > 1 ? "s" : ""} hold${n > 1 ? "" : "s"} a missing standard that a problem in another row needs` : ""; })()}</span> <span class="tag auto">Automatic check</span> ${hb("pl_breaks")}</h3><p class="muted sm-note"><b>What to do:</b> open the row, read the standards around the problem, and ask the grade concerned to confirm its rating before moving any standard.</p>${(() => { const offG = (arr) => arr.some(({ f }) => f.official), a = shownGroups.filter(offG), b = shownGroups.filter((arr) => !offG(arr));
        return `${a.length ? `<ul class="issues">${a.map((arr) => causeLi(arr, fl)).join("")}</ul>` : ""}${a.length && b.length ? `<h4 class="iss-sub">On suggested links (AI reviewer or wording): ${issues.filter(({ f }) => !f.official).length} findings, not taught where a suggested link says it is needed</h4>` : ""}${b.length ? `<ul class="issues">${b.map((arr) => causeLi(arr, fl)).join("")}</ul>` : ""}`; })()}${causeGroups.length > shownGroups.length ? `<p><button type="button" class="ghost sm" data-act="more" data-id="pg-issues">Show all ${issues.length}</button></p>` : ""}`
        : `<p class="muted">${rated ? "No breaks found in the fully rated steps so far." : "No ratings yet, so breaks cannot be checked. Rows show the standards only."}</p>`}
      ${moved.length ? `<details class="rev" data-sec="pg-moved" ${isOpen("pg-moved") ? "open" : ""}><summary><b>${moved.length}</b> step${moved.length > 1 ? "s" : ""} rated not taught in ${moved.length > 1 ? "their" : "its"} grade but taught in another grade <span class="tag auto">Automatic check</span></summary><ul class="issues">${moved.map(fl).join("")}</ul></details>` : ""}
      ${strong.length ? `<p class="muted">Taught at every step: ${strong.map(go).join(", ")}.</p>` : ""}
    </div>
    <div class="panel"><div class="pl-tools">
      <label><span>Group ${hb("pl_group")}</span><select id="pg-group"><option value="">All groups (${all.length})</option>${groups.map((gr) => `<option ${gr === S.pgGroup ? "selected" : ""} value="${esc(gr)}">${esc(gr)}</option>`).join("")}</select></label>
      <div class="lib-tabs">${chip("", "All")}${chip("issue", "Breaks down")}${chip("check", "Not taught, suggested link")}${chip("repeat", "Repeated in depth")}${chip("reinforce", "Reinforced")}${chip("same", "Same wording")}${chip("thin", "Some not taught")}${chip("partial", "Partly rated")}${chip("unrated", "Not rated")}${chip("ok", "Taught at every step")}${chip("single", "One grade only")} ${hb("pl_status")}</div></div>
      <div class="pl-key"><span><span class="pl-cell has key-cell"><span class="pc-n">3<i class="pc-star">★</i></span><span class="pc-bar"><i class="b2" style="flex:1"></i><i class="b1" style="flex:1"></i><i class="b3" style="flex:1"></i></span></span>Each box: how many standards in that grade, with a bar of their ratings (lime in depth, blue introduced, magenta not taught, grey not rated). ★ includes a ${prWords()} standard. A pink box has a standard rated not taught.</span>
        <span><svg width="34" height="8"><line x1="0" y1="4" x2="34" y2="4" class="seg-ok"/></svg>Rated and taught in both grades</span><span><svg width="34" height="8"><line x1="0" y1="4" x2="34" y2="4" class="seg-pre"/></svg>Prerequisite not taught (official link)</span><span><svg width="34" height="8"><line x1="0" y1="4" x2="34" y2="4" class="seg-maybe"/></svg>Prerequisite not taught (suggested link)</span><span><svg width="34" height="8"><line x1="0" y1="4" x2="34" y2="4" class="seg-break"/></svg>A step rated not taught</span><span><svg width="34" height="8"><line x1="0" y1="4" x2="34" y2="4" class="seg-un"/></svg>Not fully rated yet</span><span><svg width="34" height="8"><line x1="0" y1="4" x2="34" y2="4" class="seg-skip"/></svg>No standard in the grades between</span> ${hb("pl_key")}</div>
      <div class="pl-head"><div class="pl-name"><b>Progression</b></div><div class="pl-track" style="grid-template-columns:repeat(${gs.length},1fr)">${gs.map((x) => `<span data-gi="${x}" class="${g === x ? "sel" : ""}">${gl(x)}${courseOf(x, S.f.subject) ? `<span class="colh-course">${esc(courseOf(x, S.f.subject))}</span>` : ""}</span>`).join("")}</div></div>
      ${shown.map((x) => laneRow(x, gs, S.lane === x.l.id, q)).join("") || `<div class="empty">${q ? "No progression matches your search." : "No progressions in this view."}</div>`}</div>`;
    if (S.laneScroll) { const r = document.getElementById("lane-" + S.lane); if (r) r.scrollIntoView({ block: "start", behavior: "smooth" }); S.laneScroll = false; }
  }
  function laneRow(x, gs, open, q) {
    const l = x.l, n = gs.length, pos = x.steps.map((st) => gs.indexOf(st.g.find((g) => gs.includes(g))));
    let svg = "";
    for (let i = 0; i + 1 < x.steps.length; i++) {
      const a = x.steps[i].s, b = x.steps[i + 1].s;
      // A prerequisite gap into the later step shows on the line itself: solid magenta (official) or dashed (inferred).
      const pre = x.flags.filter((f) => f.t === "prereq" && !f.within && !f.cross && (x.steps[i + 1].k.includes(f.k) || (!f.k && x.steps[i + 1].g.includes(f.g))));
      const cls = pre.some((f) => f.official) ? "seg-pre" : pre.length ? "seg-maybe" : !a.full || !b.full ? "seg-un" : a.state === "not" || b.state === "not" ? "seg-break" : pos[i + 1] - pos[i] > 1 ? "seg-skip" : "seg-ok";
      svg += `<line x1="${pos[i] * 100 + 50}" y1="20" x2="${pos[i + 1] * 100 + 50}" y2="20" class="${cls}" vector-effect="non-scaling-stroke"/>`;
    }
    const cells = gs.map((g) => {
      const sel = S.f.grade === g ? " sel" : "", es = x.steps.flatMap((st) => st.k).map((k) => S.byKey.get(k)).filter((e) => e.pl.includes(g));
      if (!es.length) return `<div class="pl-cell${sel}" data-gl="${gl(g)}"></div>`;
      // One box per grade: how many standards, a bar of their ratings, and a star if any is a priority or power standard.
      const c = countLevels(es, g), pr = es.filter((e) => isPr(e, g)).length, r = es.length - c[3];
      const tint = !r ? "pc-un" : c[0] === r ? "pc-not" : c[0] ? "pc-mix" : c[3] ? "pc-part" : "pc-ok";
      const tip = `${gname(g)}: ${es.length} standard${es.length === 1 ? "" : "s"}. ${c[2]} in depth, ${c[1]} introduced, ${c[0]} not taught${c[3] ? `, ${c[3]} not rated` : ""}${pr ? `. ${pr} ${prName(g).toLowerCase()}` : ""}. ${es.map(codeText).join(", ")}`;
      return `<div class="pl-cell has ${tint}${sel}" data-gl="${gl(g)}" data-tip-text="${esc(tip)}" tabindex="0" role="button" aria-label="${esc(tip)}. Open this progression." data-act="lane-open" data-id="${esc(l.id)}"><span class="pc-n">${es.length}${pr ? `<i class="pc-star">★</i>` : ""}</span><span class="pc-bar">${[2, 1, 0, 3].map((i) => (c[i] ? `<i class="b${i}" style="flex:${c[i]}"></i>` : "")).join("")}</span></div>`;
    }).join("");
    const types = new Set(x.flags.map((f) => f.t)), [label0, cls] = STATUS[x.status] || ["", ""];
    // Status with its count: findings in this row, or missing standards it holds for other rows.
    const nF = x.flags.filter((f) => ["break", "stop", "prereq"].includes(f.t) && (x.status !== "issue" || f.t !== "prereq" || f.official)).length;
    const label = x.status === "issue" || x.status === "check" ? `${label0} · ${nF ? `${nF} finding${nF > 1 ? "s" : ""}` : "holds a missing standard"}` : label0;
    const next = (l.next || []).map(laneById).filter((y) => y && y.subject === l.subject);
    return `<div class="pl-row ${open ? "open" : ""}" id="lane-${esc(l.id)}"><div class="pl-name"><button type="button" class="pl-open" data-act="lane" data-id="${esc(l.id)}" aria-expanded="${open}">${hl(l.name, q)}</button>
        <small>${esc(l.group)} · <span class="basis b-${l.basis}">${BASIS[l.basis]}</span> · ${x.span[0] === x.span[1] ? esc(gl(x.span[0])) : `${esc(gl(x.span[0]))} to ${esc(gl(x.span[1]))}`}${next.length ? ` · continues in ${next.map((y) => `<button type="button" class="linkish" data-act="lane-go" data-id="${esc(y.id)}">${esc(y.name.split(" (")[0])}</button>`).join(", ")}` : ""}</small>
        <span class="pl-flags" title="Automatic checks over the ratings so far"><span class="st ${cls}">${label}</span>${types.has("repeat") ? `<span class="st st-repeat">Repeated in depth</span>` : ""}${types.has("same") ? `<span class="st st-repeat">Same wording</span>` : ""}${types.has("moved") ? `<span class="st st-part">Taught in another grade</span>` : ""}${(() => { const cs = x.steps.flatMap((st) => st.k).flatMap((k) => causedBy(l.subject, k).filter(({ x: y }) => y.l !== l)), n = cs.length, off = cs.filter(({ f }) => f.official).length; return n ? `<span class="st ${off ? "st-thin" : "st-part"}" title="Standards in this row are rated not taught (settled) and needed first by standards in other rows">Causes ${n} ${off ? "official " : ""}gap${n > 1 ? "s" : ""} in other rows</span>` : ""; })()}</span></div>
      <div class="pl-track" style="grid-template-columns:repeat(${n},1fr)"><svg class="pl-svg" viewBox="0 0 ${n * 100} 40" preserveAspectRatio="none" aria-hidden="true">${svg}</svg>${cells}</div></div>
      ${open ? laneDetail(x, gs) : ""}`;
  }
  // Rating pills for every grade a standard belongs to, plus any other grade that teaches it.
  // labels: always name the grade (neighbour lists, where AERO and high school codes do not say their grade).
  function gradePills(e, gs, labels) {
    const own = e.pl.filter((g) => gs.includes(g)), also = taughtIn(e).filter((g) => !own.includes(g)), pa = e.pa || [];
    return own.map((g) => { const r = rating(e.f, e.c, g); return `<span class="pill" title="${pa.includes(g) ? esc(gname(g)) + (SHOW_PLANS ? " rates it because its curriculum docs cite it" : " rates it too (added to this grade)") : ""}"><i class="lv ${r ? "lv-" + r.level : "lv-none"}"></i>${own.length > 1 || labels ? gl(g) + (pa.includes(g) ? (SHOW_PLANS ? " (curriculum docs)" : " (added)") : "") + ": " : ""}${r ? LEVEL_SHORT[r.level] : "Not rated"}</span>`; }).join("")
      + (also.length ? `<span class="tag sg">also taught in ${also.map(gl).join(", ")}</span>` : "");
  }
  function laneDetail(x, gs) {
    const l = x.l, before = new Map();
    for (const [a, b, sm, same] of l.links) if (sm >= MIN_SIM) (before.get(b) || before.set(b, []).get(b)).push([a, same]);
    const official = l.basis === "anchor";
    let html = "", lastIdx = -1;
    x.steps.forEach((st, si) => {
      const gi = gs.indexOf(st.g.find((g) => gs.includes(g)));
      if (lastIdx >= 0 && gi - lastIdx > 1) {
        const near = [...x.steps[si - 1].k, ...st.k].some((k) => S.byKey.get(k).sg);
        html += `<div class="pd-gap">No standard for this idea is placed in ${gs.slice(lastIdx + 1, gi).map(gname).join(", ")}. ${near ? "These standards are written for a grade band and their grade here is the site's suggestion, so this can change as teams rate." : `The standards themselves skip ${gi - lastIdx - 1 > 1 ? "these grades" : "this grade"}.`}</div>`;
      }
      lastIdx = Math.max(lastIdx, gs.indexOf([...st.g].reverse().find((g) => gs.includes(g))));
      const fl = x.flags.filter((f) => ["break", "moved"].includes(f.t) ? (f.ks || []).some((k) => st.k.includes(k)) : f.t === "prereq" && !f.k && st.g.includes(f.g));
      const ss = st.s, parts = [[ss.deep, "in depth", 2], [ss.intro, "introduced", 1], [ss.not, "not taught", 0], [ss.n - ss.rated, "not rated", null]].filter((p2) => p2[0]);
      html += `<div class="pd-step ps-${ss.state}"><div class="pd-g"><b>${st.g.filter((g) => gs.includes(g)).map(gl).join(", ")}</b>${parts.map(([n2, lab, lv]) => `<span class="pill"><i class="lv ${lv == null ? "lv-none" : "lv-" + lv}"></i>${n2} ${lab}</span>`).join("")}</div>
        <ul>${st.k.map((k) => S.byKey.get(k)).map((e) => { const k = e.f + "|" + e.c, p = (before.get(k) || []).map(([a, same]) => [S.byKey.get(a), same]).filter(([pe]) => pe);
          const own = x.flags.filter((f) => f.k === k && f.t !== "same");
          // Problems this standard causes, in this row or another (it is the prerequisite that is not taught).
          const causes = causedBy(x.l.subject, k);
          const flagChip = (f) => `<span class="mk-flag f-${f.t}${f.t === "prereq" && !f.official ? " soft" : ""}">${flagName(f)}</span>`;
          const sw = [...new Set(p.flatMap(([pe]) => sharedWords(fullText2(pe), fullText2(e), l.subject)))], pre = preOf(e);
          return `<li>${codeHTML(e)}<span class="pd-t">${markWords(fullText2(e), sw)}${pre.length ? `<small class="pd-link">Needs first: ${preGroups(e).slice(0, 3).map((ps) => { const q = ps[0]; return `${esc(codeText(q.e))}${ps.length > 1 ? ` with its other part${ps.length > 2 ? "s" : ""}` : ""} (${esc(gl(q.e.pl[0]))}, ${esc((PTYPE[q.type] || q.type).toLowerCase())}; ${esc(PSHORT[q.src] || q.src)})`; }).join("; ")}${preGroups(e).length > 3 ? ` and ${preGroups(e).length - 3} more` : ""} ${preChip(e)}</small>` : si > 0 ? `<small class="pd-link">${p.length ? `Builds on ${p.map(([pe, same]) => `${esc(codeText(pe))} (${esc(gl(home(pe)[0]))})${same ? ", same Wisconsin wording" : ""}`).join("; ")}${sw.length ? `, shared: ${sw.slice(0, 4).map((w) => esc(wordFor(w, e.t))).join(", ")}` : ""} · ${official && x.steps[si - 1].k.length === 1 ? "same anchor standard, official" : "closest match by wording, inferred"}` : "No close match in the step before (same progression)"}</small>` : ""}${own.map((f) => `<small class="pd-own">${flagChip(f)} ${msgHTML(f)}</small>`).join("")}${causes.length ? `<small class="pd-own pd-cause"><span class="mk-flag f-cause">Causes ${causes.length} problem${causes.length > 1 ? "s" : ""}</span> Rated not taught, and needed first by: ${causes.map(({ x: y, f }) => `<button type="button" class="linkish code-link" data-act="open" data-k="${esc(f.k)}">${esc(codeText(S.byKey.get(f.k)))}</button> (${esc(gl(f.g))}${y.l !== x.l ? `, ${esc(y.l.name)}` : ""}${f.official ? "" : ", possible"})`).join("; ")}</small>` : ""}</span><span class="mks">${marks(e, home(e)[0])}</span><span class="pd-pills">${gradePills(e, gs)}</span></li>`; }).join("")}</ul>
        ${fl.map((f) => `<p class="pd-flag f-${f.t}"><span class="tag auto">Automatic check</span> ${msgHTML(f)}</p>`).join("")}</div>`;
    });
    const reps = x.flags.filter((f) => f.t === "same");
    const next = (l.next || []).map(laneById).filter(Boolean), prev = S.prog.lanes.filter((y) => (y.next || []).includes(l.id));
    const link = (y) => `<button type="button" class="linkish" data-act="lane-go" data-id="${esc(y.id)}">${esc(y.name)}</button>`;
    // One line on top: why the row has its status, with the standards involved.
    const causedHere = x.steps.flatMap((st) => st.k).flatMap((k) => causedBy(l.subject, k).filter(({ x: y }) => y.l !== l).map((it) => [k, it]));
    const ownF = x.flags.filter((f) => ["break", "stop", "prereq"].includes(f.t));
    const why = [ownF.length ? `${ownF.length} finding${ownF.length > 1 ? "s" : ""} in this row (listed under the standards below)` : "",
      causedHere.length ? `holds ${[...new Set(causedHere.map(([k]) => k))].map((k) => `<button type="button" class="linkish code-link" data-act="open" data-k="${esc(k)}">${esc(codeText(S.byKey.get(k)))}</button>`).join(", ")}, rated not taught and needed first by ${causedHere.map(([, it]) => `<button type="button" class="linkish code-link" data-act="open" data-k="${esc(it.f.k)}">${esc(codeText(S.byKey.get(it.f.k)))}</button> (${esc(gl(it.f.g))}, ${esc(it.x.l.name)})`).join(", ")}` : ""].filter(Boolean);
    const summary = why.length ? `<p class="pl-why"><b>${esc((STATUS[x.status] || [""])[0])}:</b> ${why.join("; ")}.</p>` : "";
    return `${summary}<div class="pl-detail"><p class="muted"><b>How this row is built:</b> ${esc(S.prog.basis[l.basis] || "")} Under each standard, <b>Needs first</b> comes from the prerequisite map, with its source: Coherence Map (Math), same anchor standard (ELA, official), or suggested by an AI reviewer (check). Where the map has nothing, the closest wording in this row is shown and labelled inferred.</p>
      ${prev.length ? `<p class="muted">Grows out of: ${prev.map(link).join(", ")}.</p>` : ""}
      ${reps.length ? `<ul class="issues">${reps.map((f) => `<li><span class="mk-flag f-same">Same wording</span> <span class="muted">${msgHTML(f)}</span></li>`).join("")}</ul>` : ""}${html}
      ${next.length ? `<p class="pd-next">After this, the idea continues in ${next.map(link).join(" and ")}.</p>` : ""}</div>`;
  }
  // In the popup: the standards just before and after this one in each progression it belongs to, with their wording,
  // ratings in every grade, and any automatic check that involves this standard.
  function progBox(e) {
    if (!S.prog) return "";
    const k = e.f + "|" + e.c, lanes = S.progLanes.get(k) || [];
    if (!lanes.length) return `<p class="muted">${isEE(e.f) ? "Essential Elements follow the progression of the standard they link to (see Linked standards)." : "This standard is not in a progression yet."}</p>`;
    // The rows it belongs to, the checks that involve it, and the steps either side (no link claimed: the box above
    // says what it needs first and leads to).
    const laneBtn = (y) => (mode() === "full" ? `<button type="button" class="linkish" data-act="goto-lane" data-id="${esc(y.id)}">${esc(y.name)}</button>` : esc(y.name));
    const codes = (es) => es.slice(0, 4).map((x) => `<span class="pb-code">${codeHTML(x)} <span class="muted">(${esc(x.pl.map(gl).join(", "))})</span></span>`).join("; ") + (es.length > 4 ? ` <span class="muted">and ${es.length - 4} more</span>` : "");
    const mine = progFlags(S.subjOf.get(k), GRADES).filter(({ f }) => f.k === k || f.ka === k || (f.ks || []).includes(k) || (f.kas || []).includes(k));
    return lanes.slice(0, 4).map((l) => {
      const info = laneInfo(l, GRADES), i = info.steps.findIndex((st) => st.k.includes(k)), stepEs = (st) => (st ? st.k.map((x) => S.byKey.get(x)) : []);
      const pStep = stepEs(info.steps[i - 1]), nStep = stepEs(info.steps[i + 1]), next = (l.next || []).map(laneById).filter(Boolean), prevLane = S.prog.lanes.find((y) => (y.next || []).includes(l.id));
      const fl = mine.filter(({ x }) => x.l === l).map(({ f }) => f);
      return `<div class="pb">${laneBtn(l)} <span class="basis b-${l.basis}">${BASIS[l.basis]}</span>
        ${fl.map((f) => `<p class="pd-flag f-${f.t}"><span class="tag auto">Automatic check</span> <span class="mk-flag f-${f.t}${f.t === "prereq" && !f.official ? " soft" : ""}">${flagName(f)}</span> ${msgHTML(f)}</p>`).join("")}
        <p class="pb-steps"><b>Step before in this row</b> <span class="muted">(the same idea in an earlier grade; what it needs first is listed above)</span>: ${pStep.length ? codes(pStep) : prevLane && i === 0 ? `none; the row grows out of ${laneBtn(prevLane)}` : preOf(e).length ? "none in this row (its prerequisites above sit in other rows)" : "none on this site"}</p>
        <p class="pb-steps"><b>Step after in this row:</b> ${nStep.length ? codes(nStep) : next.length ? `none here; the idea continues in ${next.map(laneBtn).join(" and ")}` : "none on this site"}</p></div>`;
    }).join("") + (mine.some(({ x }) => !lanes.includes(x.l)) ? `<p class="pd-flag"><span class="tag auto">Automatic check</span> It is also involved in: ${mine.filter(({ x }) => !lanes.includes(x.l)).map(({ x, f }) => `<span class="mk-flag">${esc(flagName(f))}</span> ${msgHTML(f)}`).join(" ")}</p>` : "");
  }

  function renderActivity() {
    const el = $("#view-activity");
    const rows = S.events.slice(0, 200).map((ev) => `<tr class="${ev.undone ? "undone" : ""}"><td>${new Date(ev.created_at).toLocaleString()}</td><td>${esc(ev.team)}</td>
      <td>${badge(ev.framework)} ${S.byKey.get(ev.framework + "|" + ev.code) ? codeHTML(S.byKey.get(ev.framework + "|" + ev.code)) : `<button class="code" data-act="open" data-k="${esc(ev.framework + "|" + ev.code)}">${esc(ev.code)}</button>`}</td><td>${gl(ev.grade)}</td>
      <td>${ev.old_level == null ? "Not rated" : LEVEL_SHORT[ev.old_level]} → ${ev.new_level == null ? "Removed" : LEVEL_SHORT[ev.new_level]}</td>
      <td>${ev.undone ? "Undone" : `<button class="ghost" data-act="undo" data-id="${ev.id}">Undo</button>`}</td></tr>`).join("");
    const crow = S.comments.slice(0, 50).map((c) => `<tr><td>${new Date(c.created_at).toLocaleString()}</td><td>${esc(c.team)}${c.author ? " · " + esc(c.author) : ""}</td>
      <td>${S.byKey.get(c.framework + "|" + c.code) ? codeHTML(S.byKey.get(c.framework + "|" + c.code)) : `<button class="code" data-act="open" data-k="${esc(c.framework + "|" + c.code)}">${esc(c.code)}</button>`}</td><td colspan="2">${esc(c.body)}</td>
      <td><button class="ghost" data-act="hide" data-id="${c.id}">Hide</button></td></tr>`).join("");
    el.innerHTML = `<div class="panel"><h2>Recent changes ${hb("activity")}</h2><p class="lede">Every rating change, newest first. Anyone can undo a change made by mistake; the history keeps a record of it.</p>
      <table class="log"><thead><tr><th>When</th><th>Team</th><th>Standard</th><th>Grade</th><th>Change</th><th></th></tr></thead><tbody>${rows || "<tr><td colspan='6' class='muted'>No changes yet.</td></tr>"}</tbody></table></div>
      <div class="panel"><h2>Recent comments</h2><table class="log"><thead><tr><th>When</th><th>Team</th><th>Standard</th><th colspan="2">Comment</th><th></th></tr></thead><tbody>${crow || "<tr><td colspan='6' class='muted'>No comments yet.</td></tr>"}</tbody></table></div>`;
  }

  /* ---------------- Part 2: Vertical Alignment Audit (plans vs ratings) ---------------- */
  // data/evidence.json is written by scripts/part2/match_plans.py (not run yet). Until it exists the page shows
  // its layout with empty states, so the committee can see what Part 2 will report.
  const ev = (f, c, g) => S.evidence && S.evidence.items[`${f}|${c}|${g}`];
  function evidenceFor(e) {
    if (!S.evidence) return `<p class="muted">Part 2 has not run yet. When it does, this shows which 2025-26 and 2026-27 plans include this standard, in which weeks, and whether the code was cited or inferred.</p>`;
    const rows = GRADES.map((g) => ({ g, x: ev(e.f, e.c, g) })).filter((r) => r.x);
    if (!rows.length) return `<p class="muted">Not found in the plans.</p>`;
    return `<ul class="comments">${rows.map(({ g, x }) => `<li><b>${esc(gname(g))}</b>: ${x.weeks} week${x.weeks === 1 ? "" : "s"} (${LEVEL[x.level].toLowerCase()}, ${x.match})
      <div class="meta">${x.refs.map(([si, wk]) => { const s = S.evidence.sources[si]; return `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a> ${esc(s.year)}: ${esc(wk.join(", "))}`; }).join("<br>")}</div></li>`).join("")}</ul>`;
  }
  // What the curriculum documents say for one grade, next to the Part 1 ratings. Findings only count what can be known:
  // rated rows apart from unrated ones, priority standards the grade rates apart from those placed in other grades, and
  // nothing about "not in the plans" when the curriculum documents cite nothing for this grade and subject.
  function docsPanel(list, g) {
    const mine = list.filter((e) => forGrade(e, g) || isPn(e, g) || isPr(e, g)), lv = (e) => rating(e.f, e.c, g)?.level;
    const hasPlans = items().some((e) => isPn(e, g));
    // Priority counts are for the main standards; Essential Elements take the mark from the standard they link to, so
    // they are counted apart (the same way as the Grade dashboard).
    const pr = mine.filter((e) => isPr(e, g)), prEE = pr.filter((e) => isEE(e.f) && forGrade(e, g)), prMain = pr.filter((e) => !isEE(e.f));
    const prMine = prMain.filter((e) => forGrade(e, g)), prOther = prMain.filter((e) => !forGrade(e, g));
    const prLow = prMine.filter((e) => lv(e) != null && lv(e) < 2), prUn = prMine.filter((e) => lv(e) == null), prDeep = prMine.filter((e) => lv(e) === 2);
    const eeLow = prEE.filter((e) => lv(e) != null && lv(e) < 2), eeDeep = prEE.filter((e) => lv(e) === 2), eeRated = prEE.filter((e) => lv(e) != null);
    // Planned standards the grade rates (placed in it, or a band standard it can claim); the others are listed apart.
    // Essential Elements only inherit the mark from the standard they link to (plans cite main codes): not counted.
    const pnEE = mine.filter((e) => isPn(e, g) && isEE(e.f)).length;
    const pnAll = mine.filter((e) => isPn(e, g) && !isEE(e.f)), pn = pnAll.filter((e) => forGrade(e, g)), pnOther = pnAll.filter((e) => !forGrade(e, g));
    const pnRated = pn.filter((e) => lv(e) != null), pnTaught = pnRated.filter((e) => lv(e) > 0);
    const planNot = pn.filter((e) => lv(e) === 0);
    // Essential Elements are not cited by code in the plans, so they are left out of "taught but not in the plans".
    const notInPlans = hasPlans ? mine.filter((e) => e.pl.includes(g) && !isEE(e.f) && !isPn(e, g) && lv(e) > 0) : [];
    const row = (e) => { const r = rating(e.f, e.c, g); return `<tr><td>${badge(e.f)} ${codeHTML(e)}${e.pl.includes(g) && !isEE(e.f) ? `<br><button type="button" class="linkish sm" data-act="ba-go" data-id="${esc(baId(e))}">Before and after ↓</button>` : ""}</td><td>${marks(e, g) || "<span class='muted'>None</span>"}${!forGrade(e, g) ? ` <span class="tag">placed in ${esc(e.pl.map(gl).join(", "))}</span>` : ""}</td><td>${r ? `<span class="pill"><i class="lv lv-${r.level}"></i>${LEVEL_SHORT[r.level]}</span>` : `<span class="pill"><i class="lv lv-none"></i>Not rated</span>`}</td><td class="muted">${esc(partText(e, S.printAll ? 9999 : 160))}</td></tr>`; };
    const tbl = (arr, msg) => `<div class="tbl-scroll"><table class="svs"><thead><tr><th>Code</th><th>In the documents</th><th>Team says (Part 1)</th><th>Standard</th></tr></thead><tbody>${arr.slice(0, S.printAll ? Infinity : 200).map(row).join("") || `<tr class="placeholder"><td colspan="4">${msg}</td></tr>`}</tbody></table></div>`;
    const sec = (id, title, desc, arr, msg, open, auto = true) => `<details class="gap" data-sec="aud-${id}" ${isOpen("aud-" + id, open) ? "open" : ""}><summary><span class="count">${arr.filter((e) => !isEE(e.f)).length}${arr.some((e) => isEE(e.f)) ? `<small> + ${arr.filter((e) => isEE(e.f)).length} EE</small>` : ""}</span>${title}${auto ? ' <span class="tag auto">Automatic check</span>' : ""}</summary><p class="muted">${desc}</p>${tbl(arr, msg)}</details>`;
    const share = (a, b) => (b ? `${a}<small>/${b}</small>` : "n/a");
    return `<div class="panel insights"><h2>What the curriculum documents say ${hb("p_docs")}</h2>
      <p class="lede">${esc(gname(g))} · ${esc(S.f.subject)}: the school's documents ${SHOW_PLANS ? `cite <b>${pnAll.length}</b> standards for this grade (<span class="mk mk-pn">✓ In curriculum docs</span>)${pnOther.length ? `, ${pnOther.length} of them placed in other grades,` : ""} and ` : ""}name <b>${prMain.length}</b> as <span class="mk mk-pr">★ ${prName(g)}</span> standards${prOther.length ? ` (${prOther.length} of them ${prOther.length > 1 ? "are" : "is"} placed in other grades, so ${esc(gname(g))} does not rate ${prOther.length > 1 ? "them" : "it"})` : ""}.${prEE.length || pnEE ? ` Essential Elements take these marks from the standard they link to, so they are counted apart${prEE.length ? ` (${prEE.length} marked ${prName(g).toLowerCase()})` : ""}${pnEE ? ` or not counted (${pnEE} marked in plans)` : ""}.` : ""} Counts below use rated standards only; unrated ones are listed apart. <span class="muted">Updates as teams rate.</span></p>
      ${hasPlans || !SHOW_PLANS ? "" : `<div class="notice"><b>No plan data yet for ${esc(gname(g))} ${esc(S.f.subject)}.</b> The curriculum documents cite no ${esc(S.f.subject)} standards for this grade, so the site cannot say what is or is not in the plans. ${hb("p_docs")}</div>`}
      <div class="ins-grid">
        <div class="ins ${prLow.length ? "ins-issue" : ""}"><b>${share(prDeep.length, prDeep.length + prLow.length)}</b><span>rated ${prName(g).toLowerCase()} standards taught in depth</span><small>${prLow.length} rated below in depth; ${prUn.length} not rated yet${prEE.length ? `. Linked Essential Elements: ${eeDeep.length} of ${eeRated.length} rated in depth` : ""}</small></div>
        ${SHOW_PLANS ? `<div class="ins"><b>${hasPlans ? share(pnTaught.length, pnRated.length) : "n/a"}</b><span>rated standards in the curriculum docs taught</span><small>${hasPlans ? `${pnRated.length} of ${pn.length} standards in the curriculum docs that ${esc(gname(g))} rates are rated; ${pn.length - pnRated.length} unknown${pnOther.length ? `; ${pnOther.length} more are placed in other grades` : ""}` : "no plan data yet"}</small></div>
        <div class="ins ${planNot.length ? "ins-issue" : ""}"><b>${hasPlans ? planNot.length : "n/a"}</b><span>in the curriculum documents but marked not taught</span><small>${hasPlans ? "check the plan or the rating" : "needs plan data"}</small></div>
        <div class="ins"><b>${hasPlans ? notInPlans.length : "n/a"}</b><span>taught but not cited in the curriculum documents</span><small>${hasPlans ? "the curriculum documents may not list every standard taught" : "needs plan data"}</small></div>` : ""}
      </div>
      ${sec("prlow", `${prName(g)} standards rated below in depth`, `Named ${prName(g).toLowerCase()} standards for ${esc(gname(g))} that the team rates introduced or not taught${eeLow.length ? `, then the ${eeLow.length} linked Essential Elements rated below in depth` : ""}.`, prLow.concat(eeLow), prMine.length ? "None. Every rated one is taught in depth." : "The documents name none that this grade rates.", true)}
      ${SHOW_PLANS ? sec("plannot", "In the curriculum documents, but marked not taught", "The documents cite these, but the team says they are not taught. ", planNot, hasPlans ? "None." : "No plan data yet.", planNot.length > 0) : ""}
      ${sec("prun", `${prName(g)} standards not rated yet`, `Unknown, not a gap: ${esc(gname(g))} has not rated these yet.`, prUn, "None.", false, false)}
      ${hasPlans ? sec("notplan", "Taught, but not cited in the curriculum documents", "The team teaches these, but the curriculum documents listed under Data sources do not cite them. Essential Elements are left out because curriculum docs cite the main standard's code.", notInPlans, "None.") : ""}
      ${prOther.length ? sec("prother", `${prName(g)} for ${esc(gname(g))}, but placed in another grade`, `${esc(gname(g))}'s documents name these, but they are suggested for other grades, so ${esc(gname(g))} does not rate them. They may be standards the grade's plans revisit for review; the committee can decide whether the placement or the priority list should change.`, prOther, "None.", false, false) : ""}
      ${sec("prall", `All ${prName(g).toLowerCase()} standards ${esc(gname(g))} rates`, `Every standard the documents name as a ${prName(g).toLowerCase()} standard for this grade, with the team's rating, then the linked Essential Elements.`, prMine.concat(prEE), "The documents name none for this grade and subject.", false, false)}</div>`;
  }
  // Before and after one grade: each of its standards with what it builds on in an earlier grade and what builds on it
  // in a later grade (close links in the progressions), each with its own rating. A not-taught neighbour is marked.
  const baId = (e) => "ba-" + (e.f + "-" + e.c).replace(/[^A-Za-z0-9-]/g, "_");
  function beforeAfter(g, list) {
    const rows = list.filter((e) => e.pl.includes(g) && !isEE(e.f));
    // Neighbours: from the prerequisite map when it has them, else the close wording links of the progressions.
    const nb = (e, dir) => {
      const map = byTrust((dir < 0 ? preOf(e) : postOf(e)).filter((p) => !p.e.pl.includes(g)), dir > 0).map((p) => [p.e, PSRC[p.src] || p.src, ptype(p, dir > 0)]);
      if (map.length) return map;
      const k = e.f + "|" + e.c, out = new Map();
      for (const l of S.progLanes ? S.progLanes.get(k) || [] : []) for (const [a, b, sm] of l.links) if (sm >= MIN_SIM && (dir < 0 ? b === k : a === k)) { const x = S.byKey.get(dir < 0 ? a : b); if (x && !x.pl.includes(g)) out.set(x.f + "|" + x.c, [x, l.basis === "anchor" ? linkBasis(l, false) : PSRC.words, ""]); }
      return [...out.values()];
    };
    // Every grade a neighbour is placed in, with its rating; pink only when it is settled that no grade teaches it.
    const cellOf = (pairs) => pairs.length ? pairs.slice(0, S.printAll ? Infinity : 3).map(([x, src, type]) => `<span class="ba-n ${fullyNot(x) ? "ba-not" : ""}">${codeHTML(x)} <span class="pd-pills">${gradePills(x, GRADES, true)}</span> <small class="muted">${esc(type ? type.toLowerCase() + "; " : "")}${esc(src)}</small></span>`).join("") + (pairs.length > 3 && !S.printAll ? `<small class="muted">and ${pairs.length - 3} more</small>` : "")
      : `<span class="muted">None recorded</span>`;
    // A row needs a look when this grade rates it below in depth, or a neighbour is settled as not taught.
    const data = rows.map((e) => { const r = rating(e.f, e.c, g), pre = nb(e, -1), post = nb(e, 1);
      return { e, r, pre, post, weak: (r && r.level < 2) || pre.some(([x]) => fullyNot(x)) || post.some(([x]) => fullyNot(x)) }; });
    const nWeak = data.filter((d) => d.weak).length, only = nWeak > 0 && (S.printFindings || (S.baWeak && !S.printAll));
    let last = null, html = "";
    for (const { e, r, pre, post, weak } of data) {
      if (only && !weak) continue;
      if (e.f + e.s !== last) { html += `<tr class="strand-row"><td colspan="4">${badge(e.f)} ${esc(e.s || "")}</td></tr>`; last = e.f + e.s; }
      html += `<tr id="${esc(baId(e))}" class="${weak ? "ba-weak" : ""}"><td>${codeHTML(e)}<div class="mks">${marks(e, g)}</div></td><td data-l="${esc(gl(g))} says"><span class="pill"><i class="lv ${r ? "lv-" + r.level : "lv-none"}"></i>${r ? LEVEL_SHORT[r.level] : "Not rated"}</span></td><td data-l="Needs first">${cellOf(pre)}</td><td data-l="Leads to">${cellOf(post)}</td></tr>`;
    }
    return `<p class="ba-bar">${nWeak ? `<button type="button" class="ghost sm" data-act="ba-weak">${only ? `Show all ${rows.length} standards` : `Show only these ${nWeak}`}</button> ` : ""}<span class="muted">${nWeak} of ${rows.length}: ${esc(gname(g))} rates the standard below in depth, or a standard before or after it is settled as not taught (left bar).</span></p>
      <p class="scroll-hint muted">Scroll sideways for "Leads to" →</p><div class="tbl-scroll"><table class="svs ba"><thead><tr><th>${esc(gname(g))} standard</th><th>${esc(gl(g))} says</th><th>Needs first (earlier grades)</th><th>Leads to (later grades)</th></tr></thead><tbody>${html || `<tr class="placeholder"><td colspan="4">No standards in view.</td></tr>`}</tbody></table></div>`;
  }
  // The Audit's K-12 grid is about the chosen grade: the standards it works with, each followed across every grade.
  const auditGrid = (g) => filtered({ ignoreDivision: true }).filter((e) => forGrade(e, g) || isPn(e, g) || isPr(e, g) || rating(e.f, e.c, g));
  function renderPlans() {
    const el = $("#view-plans"), g = S.f.grade, ready = !!S.evidence;
    if (!g) return pickGrade(el, "its plans");
    const list = filtered({ ignoreDivision: true });
    const pill = (l, lab) => `<span class="pill"><i class="lv ${l == null ? "lv-none" : "lv-" + l}"></i>${lab}</span>`;
    let svsRows = "", off = [];
    if (ready) {
      for (const e of list) {
        const r = rating(e.f, e.c, g), x = ev(e.f, e.c, g);
        if (!r && !x) continue;
        const said = r ? r.level : null, shown = x ? x.level : 0;
        if (said === shown) continue;
        const note = said == null ? "Plans show it; the team has not rated it yet." : said > 0 && !x ? "Not yet recorded in plans." :
          said === 0 && x ? "Plans include it, but the team marked it not taught. " :
          said > shown ? "Taught more than the plans show." : "Plans show more time than the rating suggests.";
        svsRows += `<tr><td>${codeHTML(e)}</td>
          <td>${said == null ? pill(null, "Not rated") : pill(said, LEVEL_SHORT[said])}</td><td>${x ? pill(x.level, LEVEL_SHORT[x.level] + " · " + x.weeks + " wk") : pill(null, "Not in plans")}</td><td>${note}</td></tr>`;
      }
      off = Object.entries(S.evidence.items).filter(([k]) => k.endsWith("|" + g)).map(([k, x]) => { const [f, c] = k.split("|"); return { e: findItem(f + "|" + c), x }; })
        .filter((o) => o.e && !o.e.pl.includes(g) && o.e.f && (!S.f.framework || o.e.f === S.f.framework) && list.includes(o.e));
    }
    const empty = (cols, msg) => `<tr class="placeholder"><td colspan="${cols}">${msg}</td></tr>`;
    const gridList = ordered(auditGrid(g), g).map((e, i) => [e, i]).sort((a, b) => (forGrade(b[0], g) - forGrade(a[0], g)) || a[1] - b[1]).map(([e]) => e);
    const part2 = `<div class="tbl-scroll"><h3>Says vs shows ${hb("p_svs")}</h3><p class="muted">Standards where the team's rating and the plans differ for ${esc(gname(g))}.</p>
      <table class="svs"><thead><tr><th>Code</th><th>Team says (Part 1)</th><th>Plans show (Part 2)</th><th>Note</th></tr></thead>
      <tbody>${ready ? svsRows || empty(4, "No differences in this view.") : empty(4, "Fills in when Part 2 runs.")}</tbody></table>
      <h3>Below and above grade in the plans ${hb("p_offgrade")}</h3><p class="muted">Standards from other grades that appear in ${esc(gname(g))}'s plans.</p>
      <table class="svs"><thead><tr><th>Code</th><th>Suggested grade</th><th>Weeks in ${esc(gname(g))} plans</th><th>Below or above</th></tr></thead>
      <tbody>${ready ? off.map(({ e, x }) => `<tr><td>${codeHTML(e)}</td><td>${e.pl.map(gl).join(", ")}</td><td>${x.weeks} (${x.match})</td>
        <td>${GRADES.indexOf(e.pl[0]) < GRADES.indexOf(g) ? "Below grade (review or remediation)" : "Above grade (extension)"}</td></tr>`).join("") || empty(4, "None found.") : empty(4, "Fills in when Part 2 runs.")}</tbody></table>
      <h3>Plan sources ${hb("p_sources")}</h3>
      <table class="svs"><thead><tr><th>Plan</th><th>Year</th><th>Grade</th><th>Type</th><th>Notes</th></tr></thead>
      <tbody>${ready ? S.evidence.sources.filter((s) => s.grade === g).map((s) => `<tr><td><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></td><td>${esc(s.year)}</td><td>${esc(gname(s.grade))}</td><td>${esc(s.kind)}</td><td>${s.carried_forward ? "Copied forward from last year" : ""}</td></tr>`).join("") || empty(5, "No plans read for this grade yet.") :
        empty(5, "Elementary weekly and unit plans, Middle and High school unit and lesson plans (2026-27, with 2025-26 for weeks not yet planned).")}</tbody></table></div>`;
    el.innerHTML = `<div class="panel"><h2>Vertical Alignment Audit: ${esc(gname(g))} · ${esc(S.f.subject)}${courseOf(g, S.f.subject) && courseOf(g, S.f.subject) !== S.f.subject ? ` (${esc(courseOf(g, S.f.subject))})` : ""} ${hb("plans")}</h2>
      <p class="lede">What the school's curriculum documents say about ${esc(gname(g))}, side by side with what the team said in Part 1. ${ready ? `Plans last read ${esc(S.evidence.built)} · ${S.evidence.sources.length} plan files.` : `${SHOW_PLANS ? `The <span class="mk mk-pn">✓ In curriculum docs</span> and <span class="mk mk-pr">★ Priority / power</span> marks come` : `The <span class="mk mk-pr">★ Priority</span> (6-12) and <span class="mk mk-pr">★ Power</span> (K-5) marks come`} from the Ma3loomat course documents (Grades 6-12) and the Curriculum Hub (K-5). The week-by-week reading of plans (Part 2) has not run yet.`}</p></div>
    ${docsPanel(list, g)}
    <div class="panel"><h2>Before and after ${esc(gname(g))} ${hb("p_ba")}</h2>
      <p class="lede">Each ${esc(S.f.subject)} standard suggested for ${esc(gname(g))}${S.f.strand ? " in " + esc(S.f.strand) : ""}, with the standards it needs first from earlier grades and the standards that build on it in later grades, each with the rating of every grade it is placed in. A pink outline marks a neighbour that every grade rating it says is not taught (and no grade that might teach it is still to rate). Each link says what kind it is and where it comes from: Coherence Map (Math), same anchor standard (ELA, official; "part matched by wording" when the anchor has several parts), suggested (AI, check), or closest wording (inferred). Official links come first, and every rating shows its grade.</p>
      ${beforeAfter(g, gridList)}
      <details class="sub" data-sec="aud-grid" ${isOpen("aud-grid") ? "open" : ""}><summary><b>Every grade's rating of these standards (K-12 grid)</b> ${hb("p_heat")}</summary>
      <p class="muted">One row per standard ${esc(gname(g))} works with: first those suggested for it, then those from other grades that it rates or that its documents name. Most standards are rated only by their own grade, so most squares in other grades stay white; a coloured square elsewhere means another grade also teaches it. The ${esc(gl(g))} column is highlighted. A bar under a square <span class="plan-key"></span> marks a grade whose documents cite the standard, and an orange corner <span class="prio-key"></span> a grade that names it a priority or power standard.</p>
      ${standardGrid(gridList, GRADES)}</details></div>
    <details class="panel p2" data-sec="aud-part2" ${isOpen("aud-part2", ready) ? "open" : ""}><summary><h2>Part 2: week-by-week plans ${ready ? "" : '<span class="soon">not run yet</span>'}</h2></summary>
      <ol class="steps">
        <li><b>Read the plans ${hb("p_sources")}</b>2026-27 unit and weekly plans for every grade, with 2025-26 filling weeks not planned yet.</li>
        <li><b>Find the standards ${hb("p_match")}</b>Codes named in a plan are <i>cited</i>; content without a code is matched by AI and labelled <i>inferred</i>.</li>
        <li><b>Count the weeks ${hb("p_rule")}</b>1-2 weeks = Introduced; 3 or more = Taught in depth.</li>
        <li><b>Compare with Part 1 ${hb("p_svs")}</b>Where plans and ratings differ, the page says so gently, because plans do not always record everything taught.</li>
      </ol>${part2}</details>`;
  }

  /* ---------------- detail popup ---------------- */
  function findItem(k) { return S.byKey.get(k.split("|").slice(0, 2).join("|")); }
  async function openDetail(k) {
    const e = findItem(k); if (!e) return;
    const sub = S.meta.subjects.find((s) => S.idx[s.slug].includes(e));
    const det = await loadDetail(sub.slug);
    const d = det[`${e.f}|${e.c}|${e.pl[0]}`] || {};
    const desc = d.descriptors || {};
    const lvl = (o) => `<dl class="levels">${[["cc_advanced", "Advanced"], ["cc_at_target", "At target"], ["cc_approaching", "Approaching"], ["cc_emerging", "Emerging"]]
      .filter(([x]) => o[x]).map(([x, l]) => `<dt>${l}</dt><dd>${esc(o[x])}</dd>`).join("")}</dl>`;
    const strip = GRADES.map((g) => {
      const r = rating(e.f, e.c, g), placed = e.pl.includes(g);
      return `<div><button class="cell ${r ? "l" + r.level : ""} ${placed ? "placed" : ""} ${r && r.level > 0 && !placed ? "off" : ""} ${isPr(e, g) ? "prio" : ""} ${isPn(e, g) ? "inplan" : ""}" data-act="cycle" data-k="${esc(k)}" data-g="${g}"
        aria-label="${esc(gname(g))}: ${r ? LEVEL[r.level] : "not rated"}${placed ? ", suggested grade" : ""}${canEdit(g) ? ". Click to change" : ""}" title="${esc(gname(g))}: ${r ? LEVEL[r.level] + " (" + esc(r.team) + ")" : "not rated"}"></button>${gl(g)}</div>`;
    }).join("");
    const comments = S.comments.filter((c) => c.framework === e.f && c.code === e.c);
    const hist = S.events.filter((ev) => ev.framework === e.f && ev.code === e.c).slice(0, 12);
    const label = codeText(e);
    dlgShow(label, () => openDetail(k));
    $("#d-eyebrow").innerHTML = `${badge(e.f)} ${esc(FW_NAME[e.f] || e.f)} · ${esc(e.s || "")}`;
    const eeFw = "WI-EE-" + ({ Math: "MATH", ELA: "ELA", Science: "SCI", "Social Studies": "SS" })[sub.name];
    const eeItem = e.ee ? S.idx[sub.slug].find((x) => x.f === eeFw && x.c === e.ee.split(";")[0].trim()) : null;
    const linkBtn = (x) => { const [f, c] = x.split(":"), it = S.byKey.get(f + "|" + c); return `<span class="lk-b">${badge(f)} ${it ? codeHTML(it) : `<button class="code" data-act="open" data-k="${esc(f + "|" + c)}">${esc(c)}</button>`}</span>`; };
    $("#d-title").innerHTML = `<span class="cd"><span>${esc(codeParts(e).main.join(" · "))}${e.part ? ` <small>(part ${e.part[0]} of ${e.part[1]})</small>` : ""}</span><span class="wi-code">${esc(altText(e))}</span></span>`;
    // Why this standard shows up on the analysis pages: every automatic check that applies to it.
    const checks = checksFor(e);
    $("#d-body").innerHTML = `${dlgBack()}
      <p class="stdtext">${markWords(d.text || e.t, linkedWords(e))}</p>${linkedWords(e).length ? `<p class="muted sm-note"><mark class="kw">Highlighted</mark>: wording this standard shares with the standards it builds on or leads to (see Progression below).</p>` : ""}
      <p class="muted">Suggested for ${e.pl.map(gname).join(", ")}${e.sg ? " (a suggestion: teachers confirm the grade in Part 1)" : ""}${d.course ? " · " + esc(d.course) : ""}${d.cluster ? " · " + esc(d.cluster) : ""}</p>
      <div class="box"><h3>How each grade teaches it ${hb("d_strip")}</h3><div class="strip">${strip}</div>
        <p class="muted" style="margin:8px 0 0">${S.team ? (isCommittee() ? "The committee can change any grade's rating here; it asks first." : "Click your grade's square to change its rating.") : "Choose your team to rate."} Outline: suggested grade. Dot: taught outside the suggested grade. Orange corner: priority (6-12) or power (K-5) there.${SHOW_PLANS ? " Bar underneath: in that grade's curriculum docs." : ""}</p></div>
      <div class="box checks"><h3>Why this standard is flagged ${hb("d_checks")}</h3>${checks.length ? `<ul class="issues">${checks.sort((a, b) => SEV.indexOf(a[2]) - SEV.indexOf(b[2])).map(([t, m, sv]) => `<li><span class="mk-flag sev-${sv || "info"}">${esc(t)}</span> <span class="muted">${esc(m)}</span></li>`).join("")}</ul>` : `<p class="muted">Nothing flagged: no automatic check finds a problem with the ratings so far.</p>`}<p class="muted" style="margin:4px 0 0"><span class="tag auto">Automatic checks</span> over the live ratings.</p></div>
      <div class="box" style="margin-top:14px"><h3>In the school's curriculum documents ${hb("d_marks")}</h3>
        <p class="mks">${e.pr ? e.pr.map((g) => `<span class="mk mk-pr">★ ${prName(g)} ${gl(g)}</span>`).join(" ") : ""} ${(SHOW_PLANS && e.pn) ? (SHOW_PLANS && e.pn).map((g) => `<span class="mk mk-pn">✓ In ${gl(g)} curriculum docs</span>`).join(" ") : ""}</p>
        <p class="muted" style="margin:6px 0 0">${!e.pr && !(SHOW_PLANS && e.pn) ? "No grade's curriculum documents name this standard yet." : `${(SHOW_PLANS && e.pn) ? "Cited in the curriculum documents of " + (SHOW_PLANS && e.pn).map(gname).join(", ") + ". " : ""}${e.pr ? ["Priority", "Power"].map((k) => { const gs = e.pr.filter((x) => prName(x) === k); return gs.length ? `Named a ${k.toLowerCase()} standard for ${gs.map(gname).join(", ")}. ` : ""; }).join("") : ""}`}${e.pa ? ` ${e.pa.map(gname).join(", ")} ${e.pa.length > 1 ? "were" : "was"} given this standard to rate because ${e.pa.length > 1 ? "their" : "its"} curriculum docs cite it.` : ""}</p>
        <h3 style="margin-top:10px">Curriculum evidence (Part 2) ${hb("d_evidence")}</h3>${evidenceFor(e)}</div>
      <div class="box" style="margin-top:14px"><h3>What it needs first, and what it leads to ${hb("d_pre")}</h3>${preBox(e)}</div>
      <div class="box" style="margin-top:14px"><h3>Progressions it belongs to ${hb("d_prog")}</h3>${progBox(e)}</div>
      ${d.descriptor_flag ? `<div class="flagbox">${hb("d_flag")} <b>Committee review:</b> ${esc(d.descriptor_flag)}. A suggested version is shown beside the school descriptor.</div>` : ""}
      <div class="grid2" style="margin-top:14px">
        <div class="box"><h3>"I can" levels ${hb("d_levels")} ${d.descriptor_source === "draft" ? '<span class="tag flag">draft</span>' : '<span class="tag">school</span>'}</h3>${lvl(desc)}</div>
        ${e.lk ? `<div class="box"><h3>Linked standards ${hb("d_ee")}</h3><p>This Essential Element is the alternate version of:</p><p>${e.lk.map(linkBtn).join(" ")}</p></div>` :
        `<div class="box"><h3>Essential Element ${eeItem ? `<span class="lk-b">${badge(eeFw)} ${codeHTML(eeItem)}</span>` : esc(e.ee || "")} ${hb("d_ee")}</h3><p>${esc(d.ee_text && !/^Not applicable/i.test(d.ee_text) ? d.ee_text : d.ee_text ? "No alternate expectation for this standard (the Essential Elements mark it not applicable)." : "No Essential Element for this standard.")}</p>
          ${desc.ee_at_target && !String(desc.ee_at_target).startsWith("Not applicable") ? `<dl class="levels"><dt>EE at target</dt><dd>${esc(desc.ee_at_target)}</dd></dl>` : ""}</div>`}
      </div>
      ${d.descriptors_suggested ? `<div class="box" style="margin-top:14px"><h3>Suggested "I can" levels <span class="tag flag">draft</span></h3>${lvl(d.descriptors_suggested)}</div>` : ""}
      ${(d.crosswalk || []).length ? `<p class="muted" style="margin-top:12px">Related codes in other frameworks: ${d.crosswalk.map(esc).join(", ")}</p>` : ""}
      <div class="grid2" style="margin-top:14px">
        <div class="box"><h3>Comments ${hb("d_comments")}</h3><ul class="comments">${comments.map((c) => `<li>${esc(c.body)}<div class="meta">${esc(c.team)}${c.author ? " · " + esc(c.author) : ""} · ${new Date(c.created_at).toLocaleDateString()}</div></li>`).join("") || "<li class='muted'>No comments yet.</li>"}</ul>
          <label class="muted" for="c-body" style="display:block;margin-top:8px">Add a comment${S.team ? "" : " (choose your team first)"}</label>
          <textarea id="c-body" maxlength="2000" ${S.team ? "" : "disabled"}></textarea>
          <input id="c-author" placeholder="Your name (optional)" style="margin-top:6px;width:100%" ${S.team ? "" : "disabled"}>
          <div class="row-end"><button data-act="comment" data-k="${esc(k)}" ${S.team ? "" : "disabled"}>Post comment</button></div></div>
        <div class="box"><h3>History ${hb("d_history")}</h3><ul class="comments">${hist.map((ev) => `<li>${gl(ev.grade)}: ${ev.old_level == null ? "Not rated" : LEVEL_SHORT[ev.old_level]} → ${ev.new_level == null ? "Removed" : LEVEL_SHORT[ev.new_level]}<div class="meta">${esc(ev.team)} · ${new Date(ev.created_at).toLocaleString()}${ev.undone ? " · undone" : ""}</div></li>`).join("") || "<li class='muted'>No changes yet.</li>"}</ul></div>
      </div>
      <p class="muted" style="margin-top:12px;font-size:12px">Source: ${esc(d.source || "")}</p>`;
    $("#detail").dataset.k = k;
    if (!$("#detail").open) $("#detail").showModal();
  }

  /* ---------------- exports ---------------- */
  function download(name, blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  function csvCell(v) { v = String(v ?? ""); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }
  function exportCSV() {
    if ((S.view === "rate" && !teamGrade()) || ((S.view === "dashboard" || S.view === "plans") && !S.f.grade)) { toast("Choose a grade first."); return; }
    const gs = S.view === "rate" || S.view === "dashboard" ? [S.view === "rate" ? teamGrade() : S.f.grade] : S.view === "plans" ? GRADES : visibleGrades();
    let list = S.view === "activity" ? null : filtered({ ignoreDivision: S.view === "rate" || S.view === "dashboard" });
    const g0 = S.f.grade; if (list && S.view === "gaps" && g0) list = list.filter((e) => forGrade(e, g0) || rating(e.f, e.c, g0) || isPr(e, g0) || isPn(e, g0));   // the same rows as the page
    let rows;
    if (!list) rows = [["When", "Team", "Framework", "Code", "Grade", "From", "To", "Undone"], ...S.events.map((e) => [e.created_at, e.team, e.framework, e.code, e.grade, e.old_level == null ? "" : LEVEL[e.old_level], e.new_level == null ? "Removed" : LEVEL[e.new_level], e.undone])];
    else if (S.view === "ladder" && S.prog) {
      // Progressions: one line per step of each progression in view, with its counts and the checks on that row.
      const keys = new Set(filtered({ ignoreSearch: true }).map((e) => e.f + "|" + e.c));
      rows = [["Subject", "Progression", "Group", "Basis", "Status", "Grade(s)", "Codes", "In depth", "Introduced", "Not taught", "Not rated", "Automatic checks on this row"]];
      for (const l of S.prog.lanes.filter((x) => x.subject === S.f.subject)) {
        const x = laneInfo(l, gs, keys); if (!x.steps.length) continue;
        const checks = x.flags.map((f) => `${flagName(f)}: ${f.msg}`).join(" | ");
        for (const st of x.steps) rows.push([S.f.subject, l.name, l.group, BASIS[l.basis], (STATUS[x.status] || [""])[0], st.g.join(" "), st.k.map((k) => codeText(S.byKey.get(k))).join(", "), st.s.deep, st.s.intro, st.s.not, st.s.n - st.s.rated, checks]);
      }
    }
    else rows = [["Subject", "Framework", "Code", "Other code", "Site code", "Strand", "Suggested grade(s)", ...(SHOW_PLANS ? ["In curriculum docs (grades)"] : []), "Priority (6-12) / power (K-5) (grades)", "Standard", ...gs.map(gname), "Findings (automatic checks)"],
      ...ordered(S.view === "plans" ? auditGrid(S.f.grade) : list, S.view === "rate" ? teamGrade() : S.view === "dashboard" ? S.f.grade : "").map((e) => [S.f.subject, e.f, codeText(e), altText(e), e.c, e.s, e.pl.join(" "), ...(SHOW_PLANS ? [(e.pn || []).join(" ")] : []), (e.pr || []).join(" "), e.t, ...gs.map((g) => { const r = rating(e.f, e.c, g); return r ? LEVEL[r.level] : ""; }), checksFor(e).map(([t]) => t).join("; ")])];
    download(`awsaj-${S.view}-${S.f.subject.replace(/\s/g, "")}.csv`, new Blob(["﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv" }));
  }
  // The image is a grid: the coverage map's "Matched across grades" rows, or the Audit's K-12 grid for the chosen grade.
  function exportPNG() {
    const rowsMap = S.view === "heatmap" && mapMode() === "rows";
    if (!rowsMap && (S.view !== "plans" || !S.f.grade)) { toast("The image is a standard-by-grade grid: use the coverage map's Matched across grades view, or the Audit with a grade chosen."); return; }
    if (rowsMap && !S.prog) { toast("Progressions are still loading."); return; }
    const gs = rowsMap ? visibleGrades() : GRADES, cw = 26, ch = 16, gap = 2, left = 170, top = 70, pad = 20;
    // Rows: [label, grade -> standard]. On the map, one chain of matched standards per row; on the Audit, one standard.
    const list = rowsMap ? chainRows(filtered(), gs).map((c) => { const ms = c.ks.map((k) => S.byKey.get(k)); return [codeText(S.byKey.get(c.from && c.vk.length > 1 && c.vk[0] === c.from ? c.vk[1] : c.vk[0])), (g) => ms.find((e) => e.pl.includes(g))]; })
      : ordered(auditGrid(S.f.grade), S.f.grade).map((e) => [codeText(e), () => e]);
    const W = left + gs.length * (cw + gap) + pad, Hh = top + list.length * (ch + gap) + 50;
    if (list.length > 1500) { toast("Too many rows for one image. Narrow the filters first."); return; }
    const c = document.createElement("canvas"), dpr = 2; c.width = W * dpr; c.height = Hh * dpr;
    const x = c.getContext("2d"); x.scale(dpr, dpr); x.fillStyle = "#fff"; x.fillRect(0, 0, W, Hh);
    x.fillStyle = COLORS.maroon; x.fillRect(0, 0, W, 5);
    x.fillStyle = COLORS.ink; x.font = "600 16px Georgia"; x.fillText(rowsMap ? `Awsaj Academy · ${S.f.subject} standards matched across grades, ${divLabel(S.f.division)}` : `Awsaj Academy · ${gname(S.f.grade)} ${S.f.subject} standards across K-12`, pad, 30);
    x.font = "11px sans-serif"; x.fillStyle = "#4A5058"; x.fillText(new Date().toLocaleDateString(), pad, 48);
    gs.forEach((g, i) => x.fillText(gl(g), left + i * (cw + gap) + 6, top - 6));
    list.forEach(([label, at], r) => {
      const y = top + r * (ch + gap);
      x.fillStyle = COLORS.ink; x.fillText(label.slice(0, 28), pad, y + 12);
      gs.forEach((g, i) => {
        const e = at(g), X = left + i * (cw + gap); if (!e) return;
        const rt = rating(e.f, e.c, g), own = !rowsMap && e.pl.includes(g);
        x.fillStyle = rt ? COLORS[rt.level] : COLORS.none; x.strokeStyle = own ? COLORS.placed : COLORS.line; x.lineWidth = own ? 2 : 1;
        x.beginPath(); x.roundRect(X, y, cw, ch, 3); x.fill(); x.stroke();
      });
    });
    const ly = Hh - 26; [["Not rated", COLORS.none], ["Not taught", COLORS[0]], ["Introduced", COLORS[1]], ["In depth", COLORS[2]]].forEach(([l, col], i) => {
      x.fillStyle = col; x.strokeStyle = COLORS.line; x.fillRect(pad + i * 110, ly, 14, 14); x.strokeRect(pad + i * 110, ly, 14, 14); x.fillStyle = COLORS.ink; x.fillText(l, pad + i * 110 + 20, ly + 11);
    });
    c.toBlob((b) => download(`awsaj-${rowsMap ? "matched-" + S.f.division : "audit-" + gl(S.f.grade)}-${S.f.subject.replace(/\s/g, "")}.png`, b));
  }

  // Open one progression on the Progressions page, from any page or popup, with a way back. Filters that could hide the
  // row are cleared; the page the user came from (and its filters) is kept for "Back to ...".
  const VIEW_LABEL = { rate: "Rate", heatmap: "the coverage map", gaps: "Gaps & repetition", activity: "Activity", plans: "the Vertical Alignment Audit" };
  function gotoLane(id) {
    const l = S.prog && laneById(id); if (!l) return;
    if ($("#detail").open) $("#detail").close();
    if (S.view !== "ladder") S.backTo = { view: S.view, f: { ...S.f }, y: scrollY, open: { ...S.open }, label: S.view === "dashboard" ? `the ${gname(S.f.grade)} dashboard` : VIEW_LABEL[S.view] || "the last page" };
    S.f.subject = l.subject; S.f.framework = ""; S.f.strand = ""; S.f.search = ""; S.f.mark = ""; S.f.division = "all"; $("#f-search").value = "";
    if (S.f.grade && !l.steps.some((st) => st.g.includes(S.f.grade))) S.f.grade = "";
    S.lane = id; S.laneScroll = true; S.pgStatus = ""; S.pgGroup = "";
    showView("ladder"); store.set("va_view", "ladder"); refreshFilterOptions(); rerender();
  }
  // The committee's page and filters live in the address (#view=gaps&subject=Math&grade=3), so a link can be shared and
  // the browser's Back button steps back through pages and filters instead of leaving the site.
  const HASH_KEYS = ["subject", "framework", "division", "grade", "strand", "mark"];
  function writeHash() {
    if (mode() !== "full" || S.applyingHash || S.view === "flow") return;
    const p = new URLSearchParams(); p.set("view", S.view);
    for (const k of HASH_KEYS) if (S.f[k] && !(k === "division" && S.f[k] === "all")) p.set(k, S.f[k]);
    if (S.view === "ladder" && S.lane) p.set("lane", S.lane);
    if (S.view === "ladder" && S.pgStatus) p.set("check", S.pgStatus);
    if (S.view === "heatmap" && mapMode() === "rows") p.set("mode", "rows");
    // The first write only fills in the address (or finds it already right, for an opened link); every later change
    // is a new history entry, so Back returns to the page before it.
    const h = "#" + p.toString();
    if (location.hash !== h) { if (S.hashReady) history.pushState(null, "", h); else history.replaceState(null, "", h); }
    S.hashReady = true;
  }
  function applyHash() {
    const p = new URLSearchParams(location.hash.slice(1)), v = p.get("view");
    if (mode() !== "full" || !v || !$(`.tabs [data-view="${v}"]`)) return false;
    for (const k of HASH_KEYS) S.f[k] = p.get(k) || (k === "division" ? "all" : "");
    if (!S.meta.subjects.some((x) => x.name === S.f.subject)) S.f.subject = S.meta.subjects[0].name;
    if (!(S.f.division in DIV) && !(S.f.division in BAND)) S.f.division = "all";
    S.lane = p.get("lane") || null; S.pgStatus = p.get("check") || ""; S.backTo = null;
    if (v === "heatmap") S.mapMode = p.get("mode") === "rows" ? "rows" : "tiles";
    S.applyingHash = true; showView(v); refreshFilterOptions(); rerender(); S.applyingHash = false;
    return true;
  }
  window.addEventListener("popstate", () => { if ($("#detail").open) $("#detail").close(); applyHash(); });

  /* ---------------- events ---------------- */
  document.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-act]"); if (!b) return;
    const act = b.dataset.act;
    if (act === "rate") { const e = findItem(b.dataset.k); const l = +b.dataset.l; const cur = rating(e.f, e.c, b.dataset.g); if (cur && cur.level === l) return; setRating(e, b.dataset.g, l); }
    else if (act === "open") openDetail(b.dataset.k);
    else if (act === "grid-all") { S.gridAll = true; rerender(); }
    else if (act === "team") { setTeam(b.dataset.t); store.set("va_team", b.dataset.t); $("#team").value = b.dataset.t; }
    else if (act === "links") teamLinks();
    else if (act === "prog-filter") { S.progFilter = b.dataset.f; teamLinks(); }
    else if (act === "prog-by") { S.progBy = b.dataset.b; teamLinks(); }
    else if (["clear-part", "copy-save", "copy-new", "copy-load", "copy-undo", "copy-delete"].includes(act)) copyAct(act, b);
    else if (act === "copy-all-reminders") { const t = S.progBy === "team" ? teamProgressRows().filter((x) => x.status < 2).map(reminderText).join("\n\n") : gradeProgressRows().filter((x) => x.status < 2).map(gradeReminder).join("\n\n"); try { await navigator.clipboard.writeText(t); toast("Reminders copied"); } catch (err) { toast("Could not copy"); } }
    else if (act === "copy") { try { await navigator.clipboard.writeText(b.dataset.u); toast(b.dataset.u.startsWith("http") ? "Link copied" : "Reminder copied"); } catch (err) { toast("Select the link and copy it"); } }
    else if (act === "clear") { const e = findItem(b.dataset.k); if (e) clearRating(e, b.dataset.g || teamGrade()); }
    else if (act === "lib") { S.flow.lib = S.flow.lib === b.dataset.t ? "" : b.dataset.t; rerender(); }
    else if (act === "lib-open") { const e = findItem(b.dataset.k); if (e) { S.flow.back = rkey(e.f, e.c, teamGrade()); S.flow.set = null; rerender(); scrollTo({ top: 0, behavior: "smooth" }); } }
    else if (act === "switch-team") { S.explore = false; setTeam(""); store.set("va_team", ""); $("#team").value = ""; }
    else if (act === "explore" && S.lock) { /* locked links stay on the team's own standards */ }
    else if (act === "explore") { S.explore = true; showView("heatmap"); refreshFilterOptions(); rerender(); }
    else if (act === "back-to-flow") { S.explore = false; showView("flow"); rerender(); }
    else if (act === "review") { S.f.subject = S.flow.subject || S.f.subject; S.f.framework = ""; S.f.strand = ""; S.f.search = ""; $("#f-search").value = ""; showView("rate"); refreshFilterOptions(); rerender(); }
    else if (act === "lane") { S.lane = S.lane === b.dataset.id ? null : b.dataset.id; rerender(); }
    else if (act === "chain") chainDialog(b.dataset.id, b.dataset.ks.split("~"));
    else if (act === "map-mode") { S.mapMode = b.dataset.v; store.set("va_mapmode", b.dataset.v); S.gridAll = false; refreshFilterOptions(); rerender(); }
    else if (act === "band") { S.f.division = b.dataset.v; S.gridAll = false; refreshFilterOptions(); rerender(); }
    else if (act === "more") { S.more[b.dataset.id] = true; S.open[b.dataset.id] = true; rerender(); }
    else if (act === "chain-all") { S.chainAll = !S.chainAll; rerender(); }
    else if (act === "ba-weak") { S.baWeak = !S.baWeak; rerender(); }
    else if (act === "ba-go") { let r = document.getElementById(b.dataset.id); if (!r && S.baWeak) { S.baWeak = false; rerender(); r = document.getElementById(b.dataset.id); }
      if (r) { r.scrollIntoView({ block: "center", behavior: "smooth" }); r.classList.remove("flash"); void r.offsetWidth; r.classList.add("flash"); setTimeout(() => r.classList.remove("flash"), 2500); } else toast("This standard is not in the Before and after table (check the filters)."); }
    else if (act === "lane-open") { if (S.lane !== b.dataset.id) { S.lane = b.dataset.id; rerender(); } }
    else if (act === "lane-go") { S.lane = b.dataset.id; S.laneScroll = true; S.pgStatus = ""; rerender(); }
    else if (act === "goto-lane") gotoLane(b.dataset.id);
    else if (act === "back-view") {
      const bk = S.backTo; S.backTo = null; if (!bk) return;
      S.f = { ...bk.f }; $("#f-search").value = S.f.search; showView(bk.view); refreshFilterOptions(); rerender(); scrollTo({ top: bk.y || 0 });
    }
    else if (act === "dlg-back") { const pv = S.dlg.hist.pop(); S.dlg.cur = null; if (pv) pv.redraw(); }
    else if (act === "open-sec") { const d = document.getElementById(b.dataset.id); if (d) { d.open = true; S.open[b.dataset.id] = true; d.scrollIntoView({ block: "start", behavior: "smooth" }); } }
    else if (act === "pg-status") { S.pgStatus = b.dataset.s; rerender(); }
    else if (act === "tview") { S.flow.view = b.dataset.v; store.set("va_tview", b.dataset.v); rerender(); }
    else if (act === "tsize") { S.flow.size = b.dataset.v; store.set("va_tsize", b.dataset.v); rerender(); }
    else if (act === "tfilter") { S.flow.lib = b.dataset.t; rerender(); }
    else if (act === "levels") levelsDialog();
    else if (act === "sources") sourcesDialog();
    else if (act === "finish" || act === "results") {
      const g = teamGrade(), list = flowList(S.flow.subject, g);
      if (act === "finish" && unfinished(list, g, `Every standard needs an answer before ${S.flow.subject} is finished.`)) return;
      S.flow.results = S.flow.subject; S.flow.reviewing = null; rerender(); scrollTo({ top: 0, behavior: "smooth" });
    }
    else if (act === "review-answers") { S.flow.reviewing = S.flow.subject; S.flow.results = null; S.flow.view = "all"; S.flow.lib = ""; rerender(); scrollTo({ top: 0, behavior: "smooth" }); }
    else if (act === "goto") {
      const e = findItem(b.dataset.k), g = teamGrade(); if (!e) return; $("#detail").close();
      S.flow.results = null; S.flow.reviewing = S.flow.subject;
      if (tview() === "one") { S.flow.back = rkey(e.f, e.c, g); S.flow.set = null; rerender(); scrollTo({ top: 0, behavior: "smooth" }); }
      else {
        S.flow.lib = ""; S.flow.q = ""; S.flow.set = null; rerender();
        // Closing the popup redraws the page, so mark and scroll to the row just after that.
        setTimeout(() => { const row = document.getElementById(rowId(rkey(e.f, e.c, g))); if (row) { row.classList.add("flash"); row.scrollIntoView({ block: "center", behavior: "smooth" }); } }, 60);
      }
    }
    else if (act === "flow-set") { S.flow.set = S.flow.set === b.dataset.f ? null : b.dataset.f; S.flow.back = null; rerender(); }
    else if (act === "sets-change") { S.flow.choose = S.flow.subject; rerender(); }
    else if (act === "sets-cancel") { S.flow.choose = null; rerender(); }
    else if (act === "sets-save") {
      const fws = $$(".set-opt input:checked").map((x) => x.value), subject = b.dataset.s;
      if (!fws.length) { toast("Tick at least one set of standards."); return; }
      try { await rpc("set_team_sets", { p_team: S.team.name, p_subject: subject, p_frameworks: fws });
        (S.teamSets[S.team.name] ||= {})[subject] = fws; S.flow.choose = null; S.flow.set = null; S.flow.lastSet = null; rerender(); toast("Saved for your whole team"); }
      catch (err) { toast("Could not save: " + err.message); }
    }
    else if (act === "flow-subject") { S.flow.subject = b.dataset.s; S.flow.set = null; S.flow.choose = null; S.flow.back = null; S.flow.results = null; S.flow.reviewing = null; S.flow.lib = ""; S.flow.q = ""; S.flow.skipped.clear(); showView("flow"); rerender(); scrollTo({ top: 0 }); }
    else if (act === "flow-rate") flowRate(b.dataset.k, +b.dataset.l);
    else if (act === "flow-skip") flowSkip();
    else if (act === "flow-back") flowBack();
    else if (act === "cm-open") tileDialog(b.dataset.g, b.dataset.row);
    else if (act === "grade") { S.f.grade = b.dataset.g; refreshFilterOptions(); rerender(); }
    else if (act === "strand") { S.f.strand = b.dataset.s; $(`.tabs [data-view="rate"]`).click(); }
    else if (act === "subject") { S.f.subject = b.dataset.s; S.f.framework = b.dataset.fw || ""; S.f.strand = ""; refreshFilterOptions(); rerender(); }
    else if (act === "cycle") {
      const e = findItem(b.dataset.k), g = b.dataset.g, cur = rating(e.f, e.c, g);
      if (!canEdit(g)) { toast(S.team ? `Your team rates ${S.team.grades.map(gname).join(", ")}.` : "Choose your team first."); return; }
      const next = cur ? (cur.level + 1) % 3 : 1;
      // The committee can change any grade's rating, so it confirms first (a click on the strip should not change a team's answer).
      if (isCommittee() && !confirm(`Change ${gname(g)}'s rating of ${codeText(e)} from ${cur ? LEVEL[cur.level] : "not rated"} to ${LEVEL[next]}? This is recorded in the history under the committee's name.`)) return;
      await setRating(e, g, next); openDetail(b.dataset.k);
    } else if (act === "comment") {
      const body = $("#c-body").value.trim(); if (!body) return;
      if (!teamGrade()) { toast("Choose a grade first."); return; }
      const e = findItem(b.dataset.k);
      try { await rpc("add_comment", { p_framework: e.f, p_code: e.c, p_grade: teamGrade(), p_team: S.team.name, p_author: $("#c-author").value.trim(), p_body: body });
        await loadComments(); openDetail(b.dataset.k); toast("Comment posted"); } catch (err) { toast("Could not post: " + err.message); }
    } else if (act === "undo") {
      if (!confirm(S.canClear ? "Undo this change? The rating is taken off and the standard goes back to Still to do. The change stays in the history." : "Undo this change? The rating goes back to what it was before. The change stays in the history.")) return;
      try { await rpc("undo_change", { p_event_id: +b.dataset.id }); await Promise.all([loadRatings(true), loadEvents()]); rerender(); toast("Change undone"); }
      catch (err) { toast("Could not undo: " + err.message); }
    } else if (act === "hide") {
      if (!confirm("Hide this comment from the site?")) return;
      try { await rpc("hide_comment", { p_comment_id: +b.dataset.id }); await loadComments(); rerender(); toast("Comment hidden"); }
      catch (err) { toast("Could not hide: " + err.message); }
    }
  });
  // Boxes that act as buttons (progression boxes) open with Enter or Space too.
  document.addEventListener("keydown", (ev) => { const t = ev.target; if ((ev.key === "Enter" || ev.key === " ") && t.matches && t.matches('[role="button"][data-act]')) { ev.preventDefault(); t.click(); } });
  document.addEventListener("input", (ev) => {
    if (ev.target.id !== "t-search") return;
    const pos = ev.target.selectionStart; S.flow.q = ev.target.value; rerender();
    const i = $("#t-search"); if (i) { i.focus(); i.setSelectionRange(pos, pos); }
  });
  $$("dialog [data-close], #d-close").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
  $("#detail").addEventListener("close", () => { S.dlg = { cur: null, hist: [] }; rerender(); });
  // Remember which sections are open (Gaps, Audit, dashboard) so a redraw keeps them as the user left them.
  // Only the user's own clicks count (a redraw also fires "toggle" events, which would freeze the defaults).
  // Small view: a standard cut off at the end of its line shows the whole standard in a popup on hover.
  document.addEventListener("mouseover", (ev) => { const t = ev.target.closest && ev.target.closest(".tr-text[data-full]"); if (!t) return; t.title = t.scrollWidth > t.clientWidth + 1 ? t.dataset.full : ""; });
  document.addEventListener("click", (ev) => { const sm = ev.target.closest("details[data-sec] > summary"); if (sm && !ev.target.closest(".help")) { const d = sm.parentElement; S.open[d.dataset.sec] = !d.open; } }, true);

  // "?" explanations
  const pop = $("#pop");
  let popFor = null;
  function closePop() { pop.hidden = true; if (popFor) popFor.setAttribute("aria-expanded", "false"); popFor = null; }
  document.addEventListener("click", (ev) => {
    const h = ev.target.closest(".help");
    if (h) {
      ev.preventDefault(); ev.stopPropagation();
      if (popFor === h) { closePop(); return; }
      closePop();
      const [t, b] = (window.VA_HELP || {})[h.dataset.help] || ["Help", "No explanation yet."];
      $("#pop-t").textContent = t; $("#pop-b").innerHTML = /<(ul|p)/.test(b) ? b : `<p>${b}</p>`;
      const host = h.closest("dialog"); (host || document.body).appendChild(pop);
      pop.hidden = false; popFor = h; h.setAttribute("aria-expanded", "true");
      const r = h.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
      pop.style.left = Math.max(8, Math.min(r.left - 12, innerWidth - pw - 8)) + "px";
      pop.style.top = (r.bottom + ph + 8 < innerHeight ? r.bottom + 6 : Math.max(8, r.top - ph - 6)) + "px";
      return;
    }
    if (!ev.target.closest("#pop")) closePop();
  }, true);
  $("#pop-x").addEventListener("click", closePop);
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !pop.hidden) { closePop(); } });

  // heatmap crosshair: light up the row and grade column under the pointer
  let hmCol = null;
  document.addEventListener("mouseover", (ev) => {
    const td = ev.target.closest("table.hm td[data-gi], table.hm th[data-gi], table.cm td[data-gi], table.cm th[data-gi]");
    const col = td ? td.dataset.gi : null;
    if (col === hmCol) return;
    $$("table.hm .xcol, table.cm .xcol").forEach((x) => x.classList.remove("xcol"));
    hmCol = col; if (col) $$(`table.hm [data-gi="${col}"], table.cm [data-gi="${col}"]`).forEach((x) => x.classList.add("xcol"));
  });
  // tooltip for heatmap cells and bars
  const tip = $("#tip");
  document.addEventListener("mouseover", (ev) => {
    const c = ev.target.closest("[data-pq],[data-tip],[data-tip-text]"); if (!c) { tip.hidden = true; return; }
    if (c.dataset.pq) { const e = S.byKey.get(c.dataset.pq); if (e) tip.innerHTML = preTip(e); }
    else if (c.dataset.tipText) tip.innerHTML = esc(c.dataset.tipText);
    else { const e = findItem(c.dataset.k), g = c.dataset.g, r = rating(e.f, e.c, g);
      tip.innerHTML = `<b>${esc(codeText(e))}</b> <i>${esc(altText(e))}</i> · ${esc(gname(g))}<br>${r ? LEVEL[r.level] + " · " + esc(r.team) : "Not rated"}${e.pl.includes(g) ? "<br>Suggested grade" : ""}${isPr(e, g) ? `<br>★ ${prName(g)} standard` : ""}${isPn(e, g) ? "<br>✓ In this grade's plans" : ""}${preOf(e).length ? `<br>Needs first: ${preOf(e).length} standard${preOf(e).length > 1 ? "s" : ""}${preOf(e).some((p) => fullyNot(p.e)) ? `, ${preOf(e).filter((p) => fullyNot(p.e)).length} not taught` : ""}` : ""}<br><span style="opacity:.8">${esc(e.t.slice(0, 120))}…</span>`; }
    tip.hidden = false;
  });
  document.addEventListener("mousemove", (ev) => { if (!tip.hidden) { tip.style.left = Math.min(ev.clientX + 14, innerWidth - 360) + "px"; tip.style.top = ev.clientY + 14 + "px"; } });

  $$(".tabs [data-view]").forEach((b) => b.addEventListener("click", () => {
    S.backTo = null; showView(b.dataset.view);
    store.set("va_view", S.view); refreshFilterOptions(); rerender();
    if (S.view === "activity") Promise.all([loadEvents(), loadComments()]).then(rerender);
  }));
  const bindF = (id, key) => $(id).addEventListener(id === "#f-search" ? "input" : "change", (ev) => {
    S.f[key] = ev.target.value; S.gridAll = false; if (key === "mark" || key === "order") store.set("va_" + key, ev.target.value);
    if (key === "subject") S.f.framework = defaultFramework(S.f.subject, teamGrade());
    // A set the new grade does not use (NGSS or Wisconsin Social Studies in K-5) would leave the page empty.
    if (key === "grade" && S.f.framework && S.f.grade && !items().some((e) => e.f === S.f.framework && e.pl.includes(S.f.grade))) S.f.framework = defaultFramework(S.f.subject, S.f.grade);
    refreshFilterOptions(); rerender();
  });
  bindF("#f-subject", "subject"); bindF("#f-framework", "framework"); bindF("#f-division", "division"); bindF("#f-grade", "grade"); bindF("#f-strand", "strand"); bindF("#f-search", "search");
  bindF("#f-mark", "mark"); bindF("#f-order", "order");
  document.addEventListener("change", (ev) => { if (ev.target.id === "pg-group") { S.pgGroup = ev.target.value; rerender(); } });
  $("#team").addEventListener("change", (ev) => { setTeam(ev.target.value); store.set("va_team", ev.target.value); });
  $("#x-csv").addEventListener("click", exportCSV); $("#x-png").addEventListener("click", exportPNG); $("#x-pdf").addEventListener("click", () => window.print());
  // Findings only: the same print without the long informational lists (moves, reinforcement, unknown, full grids).
  $("#x-pdf-f").addEventListener("click", () => { document.body.classList.add("print-findings"); S.printFindings = true; window.print(); });
  addEventListener("afterprint", () => { if (S.printFindings) { S.printFindings = false; document.body.classList.remove("print-findings"); rerender(); } });
  // Print or PDF (A4): redraw with every section open and every list in full, then put the page back.
  let printOpen = [];
  addEventListener("beforeprint", () => { if (S.printAll) return; S.printAll = true; rerender();
    // A line at the top of the printout: what it shows and when (ratings change as teams rate).
    const pm = $("#print-meta") || document.querySelector("main").insertAdjacentElement("afterbegin", Object.assign(document.createElement("p"), { id: "print-meta" }));
    const on = [S.f.subject, S.f.division !== "all" ? divLabel(S.f.division) : "K-12", S.f.grade ? gname(S.f.grade) : "", S.f.framework ? SET(S.f.framework).abbr : "", S.f.strand, S.f.search ? `Find: ${S.f.search}` : ""].filter(Boolean);
    pm.textContent = `Awsaj K-12 Vertical Alignment · ${$(".tabs [aria-selected='true'], .tabs .on")?.textContent?.trim() || ""} · ${on.join(" · ")} · Ratings as of ${new Date().toLocaleString()}${document.body.classList.contains("print-findings") ? ". Findings only: the informational lists (taught in another grade or early, reinforcement, unknown, full K-12 grids, strand coverage) are left out; the PDF button prints everything." : ""}`; if ($("#detail").open && S.dlg.cur) S.dlg.cur.redraw();
    printOpen = [...document.querySelectorAll("details:not([open])")]; printOpen.forEach((d) => (d.open = true)); });
  addEventListener("afterprint", () => { if (!S.printAll) return; S.printAll = false; printOpen.forEach((d) => (d.open = false)); printOpen = []; rerender(); if ($("#detail").open && S.dlg.cur) S.dlg.cur.redraw(); });

  function setTeam(name) {
    S.team = S.teams.find((t) => t.name === name) || null;
    if (S.team && S.lock && S.lock.subject && S.team.subjects.includes(S.lock.subject)) S.team = { ...S.team, subjects: [S.lock.subject] };
    S.flow = { subject: null, skipped: new Set(), back: null, history: [] };
    $("#toast").hidden = true;
    if (S.team && !isCommittee()) {
      S.f.subject = S.team.subjects[0]; S.f.grade = S.team.grades[0]; S.f.division = "all"; S.f.strand = "";
      S.f.framework = defaultFramework(S.f.subject, S.f.grade);
    }
    showView(!S.team || !isCommittee() ? "flow" : S.view === "flow" ? "rate" : S.view);
    refreshFilterOptions(); rerender();
  }
  function flowSkip() {
    const g = teamGrade(), list = flowList(S.flow.subject, g), e = flowCurrent(list, g); if (!e) return;
    const k = rkey(e.f, e.c, g);
    if (S.flow.back === k) S.flow.back = null; else S.flow.skipped.add(k);
    const open = list.filter((x) => !rating(x.f, x.c, g));
    if (open.length && open.every((x) => S.flow.skipped.has(rkey(x.f, x.c, g)))) { S.flow.skipped.clear(); toast("Back to the ones you skipped."); }
    rerender();
  }
  function flowBack() {
    const h = S.flow.history; if (!h.length) return;
    const cur = S.flow.back, i = cur ? h.indexOf(cur) - 1 : h.length - 1;
    if (i < 0) return; S.flow.back = h[i]; rerender();
  }
  document.addEventListener("keydown", (ev) => {
    if (S.view !== "flow" || mode() !== "teacher" || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.target.closest("input, textarea, select, dialog") || $("#detail").open) return;
    const card = $(".std-card"); if (!card) return;
    const k = card.dataset.k.split("|").slice(0, 2).join("|");
    if (["1", "2", "3"].includes(ev.key)) { ev.preventDefault(); flowRate(k, +ev.key - 1); }
    else if (ev.key === "s" || ev.key === "S") { ev.preventDefault(); flowSkip(); }
    else if (ev.key === "ArrowLeft") { ev.preventDefault(); flowBack(); }
  });

  /* ---------------- start ---------------- */
  async function start() {
    $("#f-search").value = ""; S.applyingHash = true;     // keep the address as given until the page it names is open
    S.f.mark = (SHOW_PLANS ? ["", "pr", "pn", "npn"] : ["", "pr"]).includes(store.get("va_mark")) ? store.get("va_mark") : ""; S.f.order = (SHOW_PLANS ? ["", "pr", "pn"] : ["", "pr"]).includes(store.get("va_order")) ? store.get("va_order") : "";
    S.device = store.get("va_device") || Math.random().toString(36).slice(2, 12); store.set("va_device", S.device);
    Object.values(Q).forEach(prefetch);
    S.meta = await (await fetch("data/meta.json")).json();
    S.teams = S.meta.teams;
    await Promise.all(S.meta.subjects.map(async (s) => (S.idx[s.slug] = await (await fetch(`data/index_${s.slug}.json`)).json())));
    // Science sets: K-5 uses AERO (no NGSS), 6-12 uses NGSS. Wisconsin Science is not offered in any grade (the data is
    // kept). Drop those grades from the rows, rows left with no grade, and the Wisconsin Science set itself.
    const sciOff = { NGSS: (g) => DIV.Elementary.includes(g), "WI-SCI": () => true };
    S.idx.science = S.idx.science.filter((e) => !sciOff[e.f] || (e.pl = e.pl.filter((g) => !sciOff[e.f](g))).length);
    const sciMeta = S.meta.subjects.find((s) => s.slug === "science"); sciMeta.frameworks = sciMeta.frameworks.filter((f) => f !== "WI-SCI");
    // K-5 Social Studies uses AERO; Wisconsin is shown only as the italic match under each AERO code, not as a set.
    // Before the K-5 Wisconsin rows go, note which Wisconsin domain each AERO strand's suggested matches mostly fall in,
    // so the coverage map can put each AERO strand next to the Wisconsin domain it continues as.
    const wiS = new Map(S.idx.social_studies.filter((e) => e.f === "WI-SS").map((e) => [e.c, e.s])), tally = {};
    for (const e of S.idx.social_studies) if (e.f === "AERO-SS") for (const w of e.wi || []) { const d = wiS.get(w); if (d) { const t = (tally[e.s] ||= {}); t[d] = (t[d] || 0) + 1; } }
    S.ssDomain = Object.fromEntries(Object.entries(tally).map(([s, t]) => [s, Object.keys(t).sort((a, b) => t[b] - t[a])[0]]));
    S.idx.social_studies = S.idx.social_studies.filter((e) => e.f !== "WI-SS" || (e.pl = e.pl.filter((g) => !DIV.Elementary.includes(g))).length);
    // Essential Elements written as "Not applicable" (no alternate expectation for that standard) have nothing to rate.
    for (const s of S.meta.subjects) S.idx[s.slug] = S.idx[s.slug].filter((e) => !(e.f.startsWith("WI-EE-") && /^(\S+\s+)?not applicable/i.test(e.t.trim())));
    S.subjOf = new Map();
    for (const s of S.meta.subjects) for (const e of S.idx[s.slug]) { S.byKey.set(e.f + "|" + e.c, e); S.subjOf.set(e.f + "|" + e.c, s.name); }
    for (const s of S.meta.subjects) {
      const by = new Map();
      for (const e of S.idx[s.slug]) { const t = e.f + "|" + codeParts(e).main.join(" · "); (by.get(t) || by.set(t, []).get(t)).push(e); }
      for (const arr of by.values()) if (arr.length > 1) arr.forEach((e, i) => (e.part = [i + 1, arr.length]));
    }
    // Progression lanes (not needed for the first screen, so they load after it).
    fetch("data/progressions.json").then((r) => r.json()).then((d) => {
      S.prog = d; S.progLanes = new Map(); S.progPrev = new Map();
      for (const l of d.lanes) { for (const st of l.steps) for (const k of st.k) (S.progLanes.get(k) || S.progLanes.set(k, []).get(k)).push(l); for (const [a, b2] of l.links) (S.progPrev.get(b2) || S.progPrev.set(b2, []).get(b2)).push(a); }
      if (S.view === "ladder" || S.view === "heatmap") rerender();
      // The prerequisite map (scripts/build_prereqs.py): "to" -> standards it needs first; S.post is the reverse.
      return fetch("data/prereqs.json").then((r) => r.json()).then((pq) => {
        S.pre = new Map(); S.post = new Map();
        for (const [to, list] of Object.entries(pq)) {
          const eb = S.byKey.get(to); if (!eb) continue;
          for (const [k, type, src, why, whySrc, grp] of list) { const e = S.byKey.get(k); if (!e) continue;
            (S.pre.get(to) || S.pre.set(to, []).get(to)).push({ k, e, type, src, why, whySrc, grp });
            (S.post.get(k) || S.post.set(k, []).get(k)).push({ k: to, e: eb, type, src, why, whySrc, grp }); }
        }
        for (const m in chainMemo) delete chainMemo[m];
        if (mode() === "full") rerender();
      });
    }).catch(() => {});
    try { const r = await fetch("data/evidence.json"); S.evidence = r.ok ? await r.json() : null; } catch (e) { S.evidence = null; }
    const groups = { "Committee": [], "Elementary": [], "Middle school": [], "High school": [] };
    S.teams.forEach((t) => (t.name === "Vertical Alignment Committee" ? groups.Committee : DIV.Elementary.includes(t.grades[0]) ? groups.Elementary : DIV.Middle.includes(t.grades[0]) ? groups["Middle school"] : groups["High school"]).push(t));
    $("#team").innerHTML = `<option value="">Choose your team</option>` + Object.entries(groups).map(([g, ts]) => `<optgroup label="${g}">${ts.map((t) => `<option>${esc(t.name)}</option>`).join("")}</optgroup>`).join("");
    // A team link (?team=...&subject=...) locks the site to that team: no team picker, no other grades.
    // A grade link (?grade=6) locks it to one grade with every subject of that grade.
    const qp = new URLSearchParams(location.search), lt = S.teams.find((t) => t.name === qp.get("team") && t.name !== "Vertical Alignment Committee");
    const lg = (qp.get("grade") || "").toUpperCase(), lgTeam = !lt && GRADES.includes(lg) && S.meta.subjects.map((s) => teamOf(lg, s.name)).find(Boolean);
    if (lt) { const ls = qp.get("subject"); S.lock = { team: lt.name, subject: lt.subjects.includes(ls) ? ls : null }; document.body.dataset.lock = "1"; setTeam(lt.name); }
    else if (lgTeam) { S.lock = { grade: lg }; document.body.dataset.lock = "1"; setTeam(lgTeam.name); }
    else { const saved = store.get("va_team"); if (saved && S.teams.some((t) => t.name === saved)) { $("#team").value = saved; setTeam(saved); } }
    const v = store.get("va_view"); S.applyingHash = false;
    if (applyHash()) { /* the address named the page and filters */ }
    else if (mode() === "full" && v && v !== "flow" && $(`.tabs [data-view="${v}"]`)) $(`.tabs [data-view="${v}"]`).click();
    else { showView(mode() === "full" ? "rate" : "flow"); refreshFilterOptions(); rerender(); }
    // Remove needs clear_rating (migration 005). Probe it with a team that does not exist: nothing is written either way.
    rpc("clear_rating", { p_framework: "", p_code: "", p_grade: "", p_team: "", p_device: "" }).then(() => {}, (err) => { S.canClear = /unknown team/i.test(err.message); if (S.canClear) rerender(); });
    try { await Promise.all([loadRatings(true), loadEvents(), loadComments(), loadTeamSets()]); syncNote("Up to date"); rerender(); }
    catch (err) { syncNote("Offline: ratings could not load"); }
    // Once everything is showing, fetch the current subject's full text in the background so the first popup opens at once.
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1500));
    idle(() => { const sub = subj(); if (sub) loadDetail(sub.slug).catch(() => {}); });
    let n = 0;
    setInterval(async () => {
      if (document.hidden) return;
      try { n++; const got = await loadRatings(n % 15 === 0); if (got) { rerender(); } syncNote("Up to date " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })); }
      catch (e) { syncNote("Reconnecting…"); }
    }, CFG.refreshSeconds * 1000);
  }
  start();
})();

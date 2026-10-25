/* Awsaj K-12 Vertical Alignment: Part 1 (collaborative standards audit)
   Static site. Standards come from data/*.json; ratings, history and comments live in Supabase
   and are written only through logged database functions (set_rating, add_comment, undo_change, hide_comment, undo_my_rating). */
(() => {
  "use strict";
  const CFG = window.VA_CONFIG;
  const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  const DIV = { Elementary: ["K", "1", "2", "3", "4", "5"], Middle: ["6", "7", "8"], High: ["9", "10", "11", "12"] };
  // Extra "Show" choices for the committee: smaller bands inside elementary school (they are not divisions).
  const BAND = { "K-2": ["K", "1", "2"], "3-5": ["3", "4", "5"] };
  const divLabel = (d) => (d === "all" ? "K-12" : BAND[d] ? "Grades " + d : d + " school");
  const LEVEL = ["Not taught", "Introduced / exposed", "Taught in depth"];
  const LEVEL_SHORT = ["Not taught", "Introduced", "In depth"];
  const FW_NAME = { "WI-CC-MATH": "Wisconsin Math (CC)", "WI-CC-ELA": "Wisconsin ELA (CC)", "NGSS": "NGSS",
    "WI-SCI": "Wisconsin Science", "AERO-SCI": "AERO Science", "WI-SS": "Wisconsin Social Studies", "AERO-SS": "AERO Social Studies",
    "WI-EE-MATH": "Essential Elements (Math)", "WI-EE-ELA": "Essential Elements (ELA)", "WI-EE-SCI": "Essential Elements (Science)", "WI-EE-SS": "Essential Elements (Social Studies)" };
  // Standard sets: each has a short badge and its own badge style, so Common Core, EE, NGSS, AERO and Wisconsin never look
  // alike. Set styles use shape and line (solid, dashed, dotted, double), not the rating colours.
  const SET = (f) => (f.startsWith("WI-EE-") ? { abbr: "EE", name: "Essential Elements", style: "ee" }
    : f.startsWith("WI-CC-") ? { abbr: "CC", name: "Common Core", style: "cc" }
    : f === "NGSS" ? { abbr: "NGSS", name: "NGSS", style: "ngss" }
    : f.startsWith("AERO-") ? { abbr: "AERO", name: "AERO", style: "aero" }
    : { abbr: "WI", name: f === "WI-SS" ? "Wisconsin Social Studies" : "Wisconsin Science", style: "wi" });
  const SET_ORDER = (f) => (f.startsWith("WI-EE-") ? 9 : f.startsWith("WI-CC-") ? 0 : f === "NGSS" ? 1 : f.startsWith("AERO-") ? 2 : 3);
  const badge = (f) => { const x = SET(f); return `<span class="setb set-${x.style}" title="${esc(FW_NAME[f] || x.name)}">${x.abbr}</span>`; };
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
    fillSelect($("#f-framework"), [["", "All sets (" + sorted.map((f) => SET(f).abbr).join(", ") + ")"], ...sorted.map((f) => [f, SET(f).abbr + ": " + (FW_NAME[f] || f)])], S.f.framework);
    const gs = visibleGrades();
    if (!gs.includes(S.f.grade)) S.f.grade = "";
    fillSelect($("#f-grade"), [["", "Choose a grade"], ...gs.map((g) => [g, gname(g)])], S.f.grade);
    const sg = strandGrade(), strandSel = $("#f-strand");
    const inGrade = sg ? items().filter((e) => (!S.f.framework || e.f === S.f.framework) && forGrade(e, sg) && e.s) : [];
    const strands = [...new Set(inGrade.map((e) => e.s))].sort();
    if (S.f.strand && !strands.includes(S.f.strand)) S.f.strand = "";
    // With several sets in view, each strand says which sets it comes from (EE strands share names with the main ones).
    const from = (s) => { const f = [...new Set(inGrade.filter((e) => e.s === s).map((e) => SET(e.f).abbr))]; return !S.f.framework && fws.length > 1 ? ` (${f.join(", ")})` : ""; };
    fillSelect(strandSel, sg ? [["", "All strands"], ...strands.map((s) => [s, s + from(s)])] : [["", "Choose a grade first"]], S.f.strand);
    strandSel.disabled = !sg;
    strandSel.title = sg ? "" : "Choose a grade first";
    $("#f-division").value = S.f.division; $("#f-mark").value = S.f.mark; $("#f-order").value = S.f.order;
    $("#filters").dataset.view = S.view;
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
    const copy = (x, msg) => `<td class="prog-act"><button type="button" class="ghost sm" data-act="copy" data-u="${esc(x.u)}">Copy link</button>${x.status < 2 ? ` <button type="button" class="ghost sm" data-act="copy" data-u="${esc(msg)}">Copy reminder</button>` : ""}</td>`;
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
      <p class="muted" style="margin-top:10px">A grade link (for example ${esc(location.origin + location.pathname)}?grade=6) opens every subject in that grade. Teachers can do the subjects in any order, stop, and come back: each subject shows how many are left.</p>`;
    if (!$("#detail").open) $("#detail").showModal();
  }
  function rerender() {
    const v = S.view; laneMemo.clear();
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
    if (e.cw) return e.cw;
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
    const lk = e.lk && e.lk[0], base = lk && S.byKey.get(lk.replace(":", "|"));
    return { main: [e.c], alt: lk ? "Essential Element for " + (base ? codeText(base) : lk.split(":")[1])
      : e.f === "NGSS" || e.f.startsWith("AERO-") ? "No Wisconsin match" : FW_NAME[e.f] || e.f };
  }
  // A few Wisconsin 2020 ELA rows gather parts of several 2010 standards; show three codes and count the rest.
  // Several Wisconsin rows can come from one Common Core standard (Wisconsin L.3.5.a to e are all Common Core L.3.1);
  // e.part = [n, of] numbers them (set in start()) so no two standards show the same bold code.
  const codeText = (e) => { const m = codeParts(e).main, t = m.length > 3 ? m.slice(0, 3).join(" · ") + " +" + (m.length - 3) : m.join(" · "); return e.part ? `${t} (part ${e.part[0]} of ${e.part[1]})` : t; };
  const altText = (e) => codeParts(e).alt;
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
  const prName = (g) => (!g ? "Priority / power" : DIV.Elementary.includes(g) ? "Power" : "Priority");
  const inGrades = (arr, g) => !!arr && (g ? arr.includes(g) : arr.some((x) => visibleGrades().includes(x)));
  const isPr = (e, g) => inGrades(e.pr, g), isPn = (e, g) => inGrades(e.pn, g);
  const gList = (arr) => arr.filter((x) => visibleGrades().includes(x)).map(gl).join(", ");
  function marks(e, g) {
    const out = [];
    if (isPr(e, g)) out.push(`<span class="mk mk-pr" title="${isEE(e.f) ? "An Essential Element linked to a priority or power standard (it takes the mark from that standard)" : g ? `A ${prName(g).toLowerCase()} standard for ${esc(gname(g))} in the school's curriculum documents` : "Priority (6-12) or power (K-5) standard in " + esc(gList(e.pr))}">★ ${prName(g)}${isEE(e.f) ? " (linked)" : ""}${g ? "" : " " + esc(gList(e.pr))}</span>`);
    if (isPn(e, g)) out.push(`<span class="mk mk-pn" title="${g ? `${esc(gname(g))}'s curriculum documents cite this standard` : "Cited in the plans of " + esc(gList(e.pn))}">✓ In plans${g ? "" : " " + esc(gList(e.pn))}</span>`);
    if (g && e.pa && e.pa.includes(g)) out.push(`<span class="tag sg">Added from ${esc(gname(g))} plans</span>`);
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
    return `<p class="mk-sum"><span class="mk mk-pr">★ ${prName(g)}</span> ${pr.length} (${rated(pr)} rated) · <span class="mk mk-pn">✓ In plans</span> ${pn.length} (${rated(pn)} rated) · ${list.length} in all ${hb("marks")}</p>`;
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
        return `<button type="button" class="setp ${F.set === f ? "on" : ""} ${n ? "" : "done"}" data-act="flow-set" data-f="${esc(f)}" title="${esc(FW_NAME[f] || f)}">${badge(f)} ${esc(SET(f).name)} <span>${n ? n + " left" : "✓"}</span></button>`; }).join("")}
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
    return `<div class="tlist-head lib-tabs">${chip("", "All")}${chip("todo", "Still to do")}${chip("done", "Done")}${chip("pr", "★ " + prName(g))}${chip("pn", "✓ In plans")} ${hb("library")}</div>
      <div class="tlist size-${size}">${html || `<div class="empty">${q ? "No standard matches your search." : f === "todo" ? "Nothing left. Well done." : "Nothing here yet."}</div>`}</div>
      <p class="flow-more"><button type="button" data-act="finish">Finish ${esc(S.flow.subject)}</button> <button type="button" class="ghost" data-act="results">See my results so far</button>
        <button type="button" class="linkish" data-act="review">Also teach standards suggested for another grade?</button> ${hb("review")}</p>`;
  }
  function trow(e, g, size, q) {
    const r = rating(e.f, e.c, g), k = rkey(e.f, e.c, g), mk = marks(e, g);
    const text = size === "s" ? e.t : fullText(e);
    const btn = (l) => `<button type="button" class="tb c${l} ${r && r.level === l ? "on" : ""}" data-act="rate" data-k="${esc(e.f + "|" + e.c)}" data-g="${g}" data-l="${l}" aria-pressed="${!!(r && r.level === l)}">${size === "l" ? `<b>${LEVEL[l]}</b><small>${LEVEL_HINT[l]}</small>` : LEVEL_SHORT[l]}</button>`;
    return `<div class="trow ${r ? "rated l" + r.level : ""} ${S.flash === k ? "flash" : ""}" id="${rowId(k)}">
      <div class="tr-code"><span class="cd"><button class="code" data-act="open" data-k="${esc(e.f + "|" + e.c)}" title="Open the full standard">${hl(codeText(e), q)}</button><span class="wi-code">${hl(altText(e), q)}</span></span>${mk ? `<div class="mks">${mk}</div>` : ""}</div>
      <div class="tr-text">${hl(text, q)}</div>
      <div class="tr-ans" role="group" aria-label="How is ${esc(codeText(e))} generally taught?">${btn(0)}${btn(1)}${btn(2)}</div></div>`;
  }
  // A popup listing every standard not answered yet, with a button to go straight to each one.
  function unfinished(list, g, why) {
    const todo = list.filter((e) => !rating(e.f, e.c, g));
    if (!todo.length) return false;
    $("#d-eyebrow").textContent = "Not finished yet"; $("#d-title").textContent = `${todo.length} standard${todo.length > 1 ? "s" : ""} still to answer`;
    $("#d-body").innerHTML = `<p class="lede">${why} Every answer you have given is already saved, so you can also stop now and finish later with the same link.</p>
      <ul class="unf">${todo.map((e) => `<li>${badge(e.f)} ${codeLines(e)} <span class="muted">${esc(e.t.slice(0, 110))}${e.t.length > 110 ? "…" : ""}</span>${S.flow.skipped.has(rkey(e.f, e.c, g)) ? ` <span class="tag">Skipped</span>` : ""} <button type="button" class="sm" data-act="goto" data-k="${esc(e.f + "|" + e.c)}">Answer</button></li>`).join("")}</ul>`;
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
    const pn = list.filter((e) => isPn(e, g)), planNot = pn.filter((e) => rating(e.f, e.c, g)?.level === 0);
    const rated = strands.filter((x) => x.arr.length - x.c[3]).sort((a, b) => b.score - a.score);
    const next = subs.find((s) => flowList(s, g).some((x) => !rating(x.f, x.c, g)));
    const allDone = !next && !left;
    const item = (e) => `<li>${codeLines(e)} <span class="muted">${esc(e.t.slice(0, 90))}${e.t.length > 90 ? "…" : ""}</span> <span class="pill"><i class="lv ${rating(e.f, e.c, g) ? "lv-" + rating(e.f, e.c, g).level : "lv-none"}"></i>${rating(e.f, e.c, g) ? LEVEL_SHORT[rating(e.f, e.c, g).level] : "Not rated"}</span></li>`;
    const insights = [
      `<b>${c[2]}</b> of ${n} standards are taught in depth, <b>${c[1]}</b> introduced and <b>${c[0]}</b> not taught${left ? `; <b>${left}</b> still to answer` : ""}.`,
      rated.length > 1 ? `Strongest strand: <b>${esc(rated[0].s)}</b>. Most room to grow: <b>${esc(rated[rated.length - 1].s)}</b>.` : "",
      pr.length ? `<b>${pr.length - prLow.length} of ${pr.length}</b> ${prName(g).toLowerCase()} standards are taught in depth.` : "",
      planNot.length ? `<b>${planNot.length}</b> standard${planNot.length > 1 ? "s are" : " is"} in your plans but marked not taught. Worth a second look.` : "",
    ].filter(Boolean);
    return `${allDone ? gradeOverview(g, subs) : ""}<div class="card results">
      <div class="res-head"><div><span class="eyebrow">${left ? "Results so far" : "Finished"}</span><h2>${esc(gname(g))} ${esc(subject)}: your results ${hb("t_results")}</h2></div>
        <div class="res-ring">${donut(c, 96)}<div class="ring-key"><span><i class="lv lv-2"></i>${c[2]} in depth</span><br><span><i class="lv lv-1"></i>${c[1]} introduced</span><br><span><i class="lv lv-0"></i>${c[0]} not taught</span></div></div></div>
      ${left ? `<div class="notice">${left} standard${left > 1 ? "s are" : " is"} still to answer. <button type="button" class="sm" data-act="finish">Show me which</button></div>` : ""}
      <ul class="res-insights">${insights.map((x) => `<li>${x}</li>`).join("")}</ul>
      <h3>By strand</h3><div class="strand-bars">${strands.map((x) => { const w = (i) => (x.c[i] / x.arr.length) * 100;
        return `<span class="sb-name">${badge(x.f)} ${esc(x.s)}</span><div class="sb" role="img" aria-label="${esc(x.s)}: ${x.c[2]} in depth, ${x.c[1]} introduced, ${x.c[0]} not taught">${[[2, COLORS[2]], [1, COLORS[1]], [0, COLORS[0]], [3, "#F2F4F6"]].map(([i, col]) => (x.c[i] ? `<i style="width:${w(i)}%;background:${col}"></i>` : "")).join("")}</div><div class="num">${x.c[2]}/${x.arr.length}</div>`; }).join("")}</div>
      ${prLow.length ? `<h3>${prName(g)} standards not taught in depth (${prLow.length})</h3><ul class="gap-list res-list">${prLow.slice(0, 12).map(item).join("")}</ul>` : ""}
      ${planNot.length ? `<h3>In your plans, but marked not taught (${planNot.length})</h3><ul class="gap-list res-list">${planNot.slice(0, 12).map(item).join("")}</ul>` : ""}
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
      return `<button type="button" class="go-card ${mode() !== "teacher" && s === S.f.subject ? "on" : ""}" data-act="${mode() === "teacher" ? "flow-subject" : "subject"}" data-s="${esc(s)}">${donut(c, 64)}<span class="go-txt"><b>${esc(s)}</b>
        <span>${n - c[3]} of ${n} rated</span><span><i class="lv lv-2"></i>${n - c[3] ? Math.round((c[2] / (n - c[3])) * 100) : 0}% of rated in depth</span>${pr.length ? `<span>★ ${prDeep}/${prRated} rated ${prName(g).toLowerCase()} in depth</span>` : ""}${ee.length ? `<span class="muted">EE: ${ee.length - ce[3]} of ${ee.length} rated</span>` : ""}</span></button>`;
    }).join("");
    let rev = "";
    if (withReview) {
      const rows = lists.map(([s, list]) => [s, gradeReview(g, s, list)]).filter(([, r]) => r.length);
      rev = `<h3>To review across subjects ${hb("grade_review")}</h3>${rows.length ? `<ul class="go-rev">${rows.map(([s, r]) => `<li><button type="button" class="linkish" data-act="subject" data-s="${esc(s)}"><b>${esc(s)}</b></button>: ${r.slice(0, 4).map(([t]) => t).join(" · ")}${r.length > 4 ? ` · and ${r.length - 4} more` : ""}</li>`).join("")}</ul>` : `<p class="muted">Nothing stands out yet in any subject.</p>`}`;
    }
    return `<div class="card grade-ov"><h2>${esc(gname(g))}: every subject ${hb("grade_ov")}</h2><div class="go-grid">${cards}</div>${rev}</div>`;
  }
  // The library: every standard in this subject's chosen sets, split into "Still to do" and "Done". Click one to open it.
  function library(list, g) {
    const todo = list.filter((e) => !rating(e.f, e.c, g)), done = list.filter((e) => rating(e.f, e.c, g)), tab = S.flow.lib || "";
    const pr = list.filter((e) => isPr(e, g)), pn = list.filter((e) => isPn(e, g)), show = { todo, done, pr, pn }[tab] || [];
    const item = (e) => { const r = rating(e.f, e.c, g); return `<li><button type="button" class="lib-i" data-act="lib-open" data-k="${esc(e.f + "|" + e.c)}">${badge(e.f)} ${codeLines(e)} <span>${esc(e.t.slice(0, 90))}${e.t.length > 90 ? "…" : ""}</span>${isPr(e, g) ? `<i class="mk mk-pr" title="${prName(g)} standard">★</i>` : ""}${isPn(e, g) ? `<i class="mk mk-pn" title="In plans">✓</i>` : ""}${r ? `<i class="pill"><i class="lv lv-${r.level}"></i>${LEVEL_SHORT[r.level]}</i>` : ""}</button></li>`; };
    return `<div class="library"><div class="lib-tabs">
        <button type="button" class="lib-t ${tab === "todo" ? "on" : ""}" data-act="lib" data-t="todo">Still to do <span>${todo.length}</span></button>
        <button type="button" class="lib-t ${tab === "done" ? "on" : ""}" data-act="lib" data-t="done">Done <span>${done.length}</span></button>
        ${pr.length ? `<button type="button" class="lib-t ${tab === "pr" ? "on" : ""}" data-act="lib" data-t="pr">★ ${prName(g)} <span>${pr.filter((e) => rating(e.f, e.c, g)).length}/${pr.length}</span></button>` : ""}
        ${pn.length ? `<button type="button" class="lib-t ${tab === "pn" ? "on" : ""}" data-act="lib" data-t="pn">✓ In plans <span>${pn.filter((e) => rating(e.f, e.c, g)).length}/${pn.length}</span></button>` : ""} ${hb("library")}</div>
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
      <div class="rate-head"><div><h2>${esc(S.f.subject)} · ${esc(gname(g))} ${hb("rate")}</h2>
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
  function renderHeatmap() {
    const el = $("#view-heatmap"), gs = visibleGrades(), list = filtered();
    if (!list.length) { el.innerHTML = `<div class="panel empty">No standards match these filters.</div>`; return; }
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
      return `<td class="cm-td" data-gi="${g}"><button type="button" class="cm-tile ${c[3] ? "" : "full"}" data-act="cm-open" data-g="${g}" data-row="${esc(row.key)}"
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
      return `<th data-gi="${g}" class="${S.f.grade === g ? "sel" : ""}"><button type="button" class="colh" data-act="grade" data-g="${g}" data-tip-text="${esc(gname(g))}: ${mine.length - c[3]} of ${mine.length} suggested standards rated. Click to choose this grade.">${gl(g)}<small>${mine.length ? pct + "%" : ""}</small></button></th>`;
    }).join("");
    const foot = gs.map((g) => { const mine = list.filter((e) => e.pl.includes(g) && markOkG(e, g)), c = countLevels(mine, g), r = mine.length - c[3];
      return `<td class="cm-foot" data-gi="${g}">${r ? `<b>${Math.round((c[2] / r) * 100)}%</b>` : "<span class='muted'>n/a</span>"}</td>`; }).join("");
    // Findings first: which grades still need rating, where teaching is thinnest, and where it is strongest.
    const byGrade = gs.map((g) => { const mine = list.filter((e) => e.pl.includes(g) && markOkG(e, g)), c = countLevels(mine, g); return { g, n: mine.length, r: mine.length - c[3] }; }).filter((x) => x.n);
    const least = byGrade.filter((x) => x.r < x.n).sort((a, b) => a.r / a.n - b.r / b.n).slice(0, 4);
    // Thinnest: tiles with at least 3 rated standards, ranked by how much is not taught in depth (not taught counts
    // fully, introduced counts half) weighted by its share, so a big weak tile is not hidden behind a tiny one.
    // Small tiles count too when every rated standard in them is not taught.
    const ratedCells = cellsInfo.filter((x) => x.n - x.c[3] >= 3 || (x.n - x.c[3] >= 2 && x.c[0] === x.n - x.c[3])).map((x) => { const r = x.n - x.c[3], pts = x.c[0] + 0.5 * x.c[1]; return { ...x, r, pts, score: pts * (pts / r) }; });
    const thin = ratedCells.filter((x) => x.pts > 0).sort((a, b) => b.score - a.score || b.pts - a.pts).slice(0, 5);
    const strong = ratedCells.filter((x) => x.c[2]).sort((a, b) => b.c[2] / b.r - a.c[2] / a.r || b.c[2] - a.c[2]).slice(0, 3);
    const notAll = cellsInfo.reduce((m, x) => m + x.c[0], 0), introAll = cellsInfo.reduce((m, x) => m + x.c[1], 0);
    const prAll = list.flatMap((e) => (e.pr || []).filter((g) => gs.includes(g) && e.pl.includes(g) && markOkG(e, g)).map((g) => rating(e.f, e.c, g)));
    const prDeep = prAll.filter((r) => r && r.level === 2).length, prRated = prAll.filter(Boolean).length;
    const cellBtn = (x, txt) => `<button type="button" class="linkish" data-act="cm-open" data-g="${x.g}" data-row="${esc(x.row.key)}">${rowSets(x.row.arr).map(badge).join(" ")} ${esc(gname(x.g))} · ${esc(x.row.label)}</button> <span class="muted">${txt}</span>`;
    el.innerHTML = `<div class="panel insights"><h2>${esc(S.f.subject)} coverage map, ${esc(divLabel(S.f.division))} ${hb("heatmap")}</h2>
      <p class="lede">Each tile is one grade and one strand: the number is how many standards that grade has there, and the colour fills from the bottom as the grade rates them. <span class="muted">Updates as teams rate.</span></p>
      <div class="ins-grid">
        <div class="ins ins-data"><b>${total ? Math.round((done / total) * 100) : 0}%</b><span>rated (${done} of ${total})</span><small>${least.length ? "Least rated: " + least.map((x) => `${gl(x.g)} ${Math.round((x.r / x.n) * 100)}%`).join(", ") : "Every grade has finished rating."}</small></div>
        <div class="ins ${notAll ? "ins-issue" : ""}"><b>${notAll}</b><span>rated standards marked not taught</span><small>and ${introAll} only introduced, out of ${done} rated in their suggested grade</small></div>
        <div class="ins ${prRated && prDeep < prRated ? "ins-warn" : ""}"><b>${prDeep}<small>/${prRated}</small></b><span>rated priority or power standards taught in depth</span><small>${prAll.length - prRated} more not rated yet (${prAll.length} named in their own grade)</small></div>
      </div>
      ${thin.length ? `<h3>Thinnest teaching <span class="tag auto">Automatic check</span> ${hb("hm_thin")}</h3><ul class="issues">${thin.map((x) => `<li>${cellBtn(x, `<b>${Math.round((x.c[2] / x.r) * 100)}% in depth</b>: ${x.c[0]} not taught, ${x.c[1]} introduced, ${x.c[2]} in depth of ${x.r} rated${x.c[3] ? `; ${x.c[3]} not rated` : ""}`)}</li>`).join("")}</ul><p class="muted sm-note">Tiles with at least 3 rated standards, or 2 that are both not taught.</p>` : `<p class="muted">${done ? "No tile with three or more rated standards has any taught less than in depth yet." : "Nothing is rated yet in this view, so the map shows the standards only."}</p>`}
      ${strong.length ? `<p class="muted">Strongest: ${strong.map((x) => cellBtn(x, `${Math.round((x.c[2] / x.r) * 100)}% in depth (${x.c[2]} of ${x.r} rated)`)).join("; ")}.</p>` : ""}
      <div class="cm-key"><span><span class="cm-key-tile"><i style="height:40%;background:${COLORS[2]}"></i><i style="height:30%;background:${COLORS[1]}"></i><i style="height:10%;background:${COLORS[0]}"></i></span> Fill: lime in depth, blue introduced, magenta not taught, white not rated</span><span><b class="cm-key-n">5</b> standards suggested for that grade</span><span><span class="cm-key-full"></span> dark green border: every one rated</span><span><span class="cm-pr-k">★</span> a priority or power standard here is rated below in depth</span><span><span class="cm-plus-k">+2</span> also teaches 2 suggested for other grades</span><span><span class="cm-none-k"></span> no standards in that grade</span>${multi ? `<span>${badge(subj().frameworks.find(isEE) || "WI-EE-MATH")} Essential Elements rows come last, with a dashed bar beside the name</span>` : ""}</div></div>
      <p class="scroll-hint muted">Scroll sideways to see every grade →</p>
      <div class="cm-wrap"><table class="cm"><thead><tr><th class="cm-row">Strand <small>% under each grade: share rated</small> ${hb("hm_cols")}</th>${head}</tr></thead><tbody>${body}</tbody>
        <tfoot><tr><th class="cm-row" scope="row">Taught in depth <small>share of rated standards</small></th>${foot}</tr></tfoot></table></div>`;
  }

  // The standards behind one coverage-map tile, with each grade's rating and where they sit in their progressions.
  function tileDialog(g, rowKey) {
    const list = filtered().filter((e) => rowOf(e).key === rowKey); if (!list.length) return;
    const row = rowOf(list[0]), mine = list.filter((e) => e.pl.includes(g) && markOkG(e, g)), extra = list.filter((e) => !e.pl.includes(g) && (rating(e.f, e.c, g)?.level || 0) > 0), gs = visibleGrades();
    const row1 = (e) => { const r = rating(e.f, e.c, g), lanes = S.progLanes ? S.progLanes.get(e.f + "|" + e.c) || [] : [];
      return `<li class="fi"><span class="fi-ev">${strip(e, gs)}</span><span class="fi-code">${badge(e.f)} ${codeHTML(e)}</span><span class="fi-body"><span class="fi-tags"><span class="pill"><i class="lv ${r ? "lv-" + r.level : "lv-none"}"></i>${esc(gl(g))}: ${r ? LEVEL[r.level] : "Not rated"}</span> ${marks(e, g)}${lanes[0] ? ` <button type="button" class="linkish sm-link" data-act="goto-lane" data-id="${esc(lanes[0].id)}">Progression: ${esc(lanes[0].name.slice(0, 40))}${lanes[0].name.length > 40 ? "…" : ""}</button>` : ""}</span><span class="muted">${esc(e.t.slice(0, 160))}${e.t.length > 160 ? "…" : ""}</span></span></li>`; };
    const c = countLevels(mine, g), sets = rowSets(list);
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
    const all = list.length, shown = S.gridAll ? list : list.slice(0, GRID_ROWS);
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
    const rated = (g) => !!rating(e.f, e.c, g), own = owners(e);
    return { waiting: own.filter((g) => !rated(g)), band: bandOf(e).filter((g) => !own.includes(g) && !rated(g)), plans: GRADES.filter((g) => isPn(e, g) && !own.includes(g) && !rated(g)) };
  }
  const unknownTags = (u) => (u.waiting.length ? ` <span class="tag wait">waiting for ${u.waiting.map(gl).join(", ")}</span>` : "")
    + (u.band.length ? ` <span class="tag wait">not asked: ${u.band.map(gl).join(", ")} (same band)</span>` : "")
    + (u.plans.length ? ` <span class="tag wait">${u.plans.map(gl).join(", ")} plans cite it, not rated there</span>` : "");
  const unknownAny = (u) => u.waiting.length + u.band.length + u.plans.length > 0;
  // Sort every standard in view into findings. "Confirmed" needs every owner grade's rating; anything still waiting
  // for ratings is "possible" or unknown, never a gap. All of these are automatic checks over the live ratings.
  function analyse(list) {
    const out = { gap: [], maybe: [], weak: [], unrated: [], placedNot: [], dup: [], early: [], reinforce: [], elsewhere: [] };
    for (const e of list) {
      const lv = levelsAcross(e);
      if (!lv.length) { out.unrated.push(e); continue; }
      const u = unknownFor(e);
      if (lv.every((x) => x.r.level === 0)) (unknownAny(u) ? out.maybe : out.gap).push({ e, u });
      else if (!lv.some((x) => x.r.level === 2)) out.weak.push({ e, u });
      // In depth in two or more grades: across its own band (reinforcement), again after its suggested grade
      // (possible duplication), or only before it (a placement question, not a duplicate).
      const deep = lv.filter((x) => x.r.level === 2), first = GRADES.indexOf(e.pl[0]);
      if (deep.length >= 2) {
        const other = deep.filter((x) => !e.pl.includes(x.g));
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
  const SEV = ["high", "mid", "wait", "info"];   // most serious first: problems, things to check, waiting for ratings, notes
  function checksFor(e) {
    const out = [], lv = levelsAcross(e), u = unknownFor(e), list = (gs) => gs.map(gname).join(", ");
    const open = [u.waiting.length ? `${list(u.waiting)} (should rate it) ${u.waiting.length > 1 ? "have" : "has"} not rated it yet` : "", u.band.length ? `${list(u.band)}, in the same band, ${u.band.length > 1 ? "were" : "was"} not asked` : "", u.plans.length ? `the plans of ${list(u.plans)} cite it (not rated there)` : ""].filter(Boolean).join("; ");
    if (!lv.length) return [["Unknown", "No grade has rated it yet, so nothing can be concluded.", "wait"]];
    if (lv.every((x) => x.r.level === 0)) out.push(open ? ["Possible gap", `Every grade that rated it (${list(lv.map((x) => x.g))}) says not taught. Not settled yet: ${open}.`, "wait"] : ["Confirmed gap", `Rated not taught by ${list(lv.map((x) => x.g))}: every grade it is suggested for, named priority by, or cited in the plans of.`, "high"]);
    else if (!lv.some((x) => x.r.level === 2)) out.push(["Only introduced", `No grade that rated it teaches it in depth${open ? `; ${open}` : ""}.`, "mid"]);
    for (const g of GRADES.filter((x) => isPr(e, x))) {
      const r = rating(e.f, e.c, g);
      if (!forGrade(e, g)) out.push([`${prName(g)} elsewhere`, `${gname(g)}'s documents name it a ${prName(g).toLowerCase()} standard, but it is placed in ${list(e.pl)}, so ${gname(g)} does not rate it.`, "info"]);
      else if (r && r.level < 2) out.push([`${prName(g)} below in depth`, `A ${prName(g).toLowerCase()} standard for ${gname(g)}${isEE(e.f) ? " (through the standard it links to)" : ""}, rated ${LEVEL[r.level].toLowerCase()} there.`, "high"]);
      else if (!r) out.push([`${prName(g)} not rated`, `A ${prName(g).toLowerCase()} standard for ${gname(g)}, not rated there yet.`, "wait"]);
    }
    for (const g of GRADES.filter((x) => isPn(e, x))) if (rating(e.f, e.c, g)?.level === 0) out.push(["In plans, not taught", `${gname(g)}'s documents cite it, but ${gname(g)} rates it not taught.`, "high"]);
    const deep = lv.filter((x) => x.r.level === 2).map((x) => x.g), other = deep.filter((g) => !e.pl.includes(g));
    if (deep.length >= 2) out.push(!other.length ? ["Reinforcement", `Taught in depth in ${list(deep)}, all grades of its band.`, "info"]
      : other.some((g) => GRADES.indexOf(g) > GRADES.indexOf(e.pl[0])) ? ["Possible duplication", `Taught in depth in ${list(deep)}; it is suggested for ${list(e.pl)}.`, "mid"]
      : ["Taught early", `Taught in depth in ${list(deep)}, before its suggested grade (${list(e.pl)}).`, "mid"]);
    for (const x of lv) if (e.pl.includes(x.g) && x.r.level === 0 && lv.some((y) => y.r.level > 0)) out.push(["Not taught in its grade", `${gname(x.g)} says not taught, while ${list(lv.filter((y) => y.r.level > 0).map((y) => y.g))} ${lv.filter((y) => y.r.level > 0).length > 1 ? "teach" : "teaches"} it.`, "mid"]);
    if (S.prog) for (const l of S.progLanes.get(e.f + "|" + e.c) || []) for (const f of laneInfo(l, GRADES).flags) { const k = e.f + "|" + e.c; if (!["repeat", "reinforce"].includes(f.t) && (f.k === k || f.ka === k || (f.ks || []).includes(k))) out.push([flagName(f), `${l.name}: ${f.msg}`, f.t === "break" || (f.t === "prereq" && f.official) ? "high" : "mid"]); }
    return out;
  }
  // A tiny K-12 strip: each grade's rating, with the suggested grade outlined and the chosen grade marked. The evidence
  // behind every finding. Screen readers get the same thing as a sentence.
  function strip(e, gs) {
    const say = gs.map((g) => { const r = rating(e.f, e.c, g); return `${gl(g)} ${r ? LEVEL_SHORT[r.level].toLowerCase() : "not rated"}${e.pl.includes(g) ? " (suggested)" : ""}`; }).join(", ");
    return `<span class="mstrip" role="img" aria-label="${esc("Ratings by grade: " + say)}"><b>${gl(gs[0])}</b>${gs.map((g) => { const r = rating(e.f, e.c, g); return `<i class="${r ? "l" + r.level : ""} ${e.pl.includes(g) ? "pl" : ""} ${S.f.grade === g ? "sel" : ""}" title="${esc(gname(g))}: ${r ? LEVEL[r.level] : "not rated"}${e.pl.includes(g) ? " (suggested grade)" : ""}"></i>`; }).join("")}<b>${gl(gs[gs.length - 1]).replace("G", "")}</b></span>`;
  }
  function li(e, extra, gs) { return `<li class="fi">${gs ? `<span class="fi-ev">${strip(e, gs)}</span>` : ""}<span class="fi-code">${badge(e.f)} ${codeHTML(e, searchQ())}</span><span class="fi-body"><span class="fi-tags">${extra || ""} ${marks(e, "")}</span><span class="muted">${hl(e.t.slice(0, 140), searchQ())}${e.t.length > 140 ? "…" : ""}</span></span></li>`; }
  // Which sections are open on the Gaps page, the Audit and the dashboard, kept across redraws (the page redraws when
  // ratings arrive or a popup closes). Unset means the section's default.
  S.open = {};
  const isOpen = (id, dflt) => (id in S.open ? S.open[id] : !!dflt);
  // Long lists show their first 25 lines, with a button for the rest (S.more remembers which were opened).
  S.more = {};
  function renderGaps() {
    const el = $("#view-gaps"), gs = visibleGrades(), g = S.f.grade;
    // With a grade chosen: only the standards that grade works with (suggested for it, rated by it, or in its documents).
    let list = ordered(filtered(), "");
    if (g) list = list.filter((e) => forGrade(e, g) || rating(e.f, e.c, g) || isPr(e, g) || isPn(e, g));
    const a = analyse(list), n = list.length;
    const prGap = [], prUnrated = [], planNot = [];
    for (const e of list) {
      // Not rated: only in the grades a standard is placed in (the same count as the coverage map); rated: any grade that rates it.
      for (const pg of (e.pr || []).filter((x) => gs.includes(x) && (!g || x === g) && forGrade(e, x))) { const r = rating(e.f, e.c, pg); if (!r) { if (e.pl.includes(pg)) prUnrated.push({ e, g: pg }); } else if (r.level < 2) prGap.push({ e, g: pg, r }); }
      for (const pg of (e.pn || []).filter((x) => gs.includes(x) && (!g || x === g))) if (rating(e.f, e.c, pg)?.level === 0) planNot.push({ e, g: pg });
    }
    // Progression problems need the steps before and after, so they use every standard in view (not only the grade's).
    const keys = new Set(filtered().map((e) => e.f + "|" + e.c));
    const breaks = progFlags(S.f.subject, gs, keys).filter(({ f }) => !g || f.g === g || f.cause === g || (f.gs || []).includes(g));
    const rated = n - a.unrated.length, pct = (x) => (n ? Math.round((x / n) * 100) : 0);
    // Summary cards: coloured only when they count a problem; each one opens its section below.
    const card = (id, num, label, sub, cls) => `<button type="button" class="ins ${num ? cls || "" : ""}" data-act="open-sec" data-id="gap-${id}"><b>${num}</b><span>${label}</span><small>${sub}</small></button>`;
    const sec = (id, title, desc, todo, arr, fn, open) => { const all = S.more["gap-" + id], cut = all ? 300 : 25;
      return `<details class="gap" id="gap-${id}" data-sec="gap-${id}" ${isOpen("gap-" + id, open) ? "open" : ""}><summary><span class="count">${arr.length}</span>${title} <span class="tag auto">Automatic check</span></summary>
      <p class="muted">${desc}${todo ? ` <b>What to do:</b> ${todo}` : ""}</p><ul class="gap-list one">${arr.slice(0, cut).map(fn).join("") || "<li class='muted'>None found.</li>"}</ul>${arr.length > cut ? (all ? `<p class="muted">Showing 300 of ${arr.length}. Narrow the view with the filters above.</p>` : `<p><button type="button" class="ghost sm" data-act="more" data-id="gap-${id}">Show all ${arr.length}</button></p>`) : ""}</details>`; };
    const flagLi = ({ x, f }) => `<li><span class="mk-flag f-${f.t}">${FLAG[f.t]}</span> <button type="button" class="linkish" data-act="goto-lane" data-id="${esc(x.l.id)}">${esc(x.l.name)}</button> <span class="muted">${esc(f.msg)}</span> <span class="tag">${esc(f.ka ? linkBasis(x.l) : BASIS[x.l.basis])}</span></li>`;
    el.innerHTML = `<div class="panel insights"><h2>Gaps and repetition: ${esc(S.f.subject)}, ${esc(g ? gname(g) : divLabel(S.f.division))} ${hb("gaps")}</h2>
      <p class="lede">${g ? `Standards ${esc(gname(g))} works with: suggested for it, rated by it, or named in its documents. ` : ""}${n} standards in view; ${rated} (${pct(rated)}%) rated by at least one grade. A standard nobody has rated is <b>unknown</b>, and a gap is only <b>confirmed</b> once every grade that should teach it has rated it. <span class="muted">Updates as teams rate.</span></p>
      <div class="ins-grid">
        ${card("gap", a.gap.length, "confirmed gaps", "rated not taught by every grade it is suggested for, named priority by, or planned in", "ins-issue")}
        ${card("maybe", a.maybe.length, "possible gaps", "not taught where rated, but a grade that might teach it has not rated it", "ins-data")}
        ${card("prio", prGap.length, "priority or power below in depth", `rated in their grade, not taught in depth${prUnrated.length ? `; ${prUnrated.length} more not rated yet` : ""}`, "ins-issue")}
        ${card("breaks", breaks.length, "progression problems", `in ${new Set(breaks.map(({ x }) => x.l.id)).size} progressions: a whole step not taught, or a standard taught in depth without the one it builds on`, "ins-issue")}
        ${card("dup", a.dup.length, "possible duplication", "taught in depth again in a later grade", "ins-warn")}
        ${card("unrated", a.unrated.length, "unknown", "no grade has rated these yet", "ins-data")}
      </div></div>
    <div class="panel">
      ${sec("gap", "Confirmed gaps: not taught in any grade that could teach it", "Rated not taught by its suggested grade(s), by any grade that names it a priority or power standard, by any grade whose plans cite it and, for a standard placed in a band (such as high school), by every grade of the band.", "decide which grade should teach it, or confirm it is intentionally left out.", a.gap, ({ e }) => li(e, `<span class="tag">suggested ${e.pl.map(gl).join(", ")}</span>`, gs), true)}
      ${sec("maybe", "Possible gaps: not taught where rated, other grades not asked yet", "Every grade that rated the standard says not taught, but a grade that might teach it has not rated it: a suggested or priority grade still to rate (waiting), another grade of its band (not asked), or a grade whose plans cite it.", "ask those grades, or check their plans, before deciding.", a.maybe, ({ e, u }) => li(e, `<span class="tag">suggested ${e.pl.map(gl).join(", ")}</span>${unknownTags(u)}`, gs))}
      ${sec("prio", "★ Priority and power standards not taught in depth", "The school's documents name these as priority (6-12) or power (K-5) for a grade, and that grade rates them introduced or not taught. Essential Elements take the mark from the standard they link to.", "check whether the priority list or the teaching should change.", prGap, (x) => li(x.e, `<span class="tag">${gl(x.g)} · ${LEVEL_SHORT[x.r.level]}</span>`, gs))}
      ${sec("prio-un", "★ Priority and power standards not rated yet", "Named priority or power standards, placed in the grade that names them, that it has not rated yet. Unknown, not a gap.", "", prUnrated, (x) => li(x.e, `<span class="tag wait">${gl(x.g)} · not rated</span>`, gs))}
      ${sec("breaks", "Progression problems", `From the Progressions page${g ? `, involving ${esc(gname(g))} (in it, or caused by its ratings)` : ""}: a middle step where every standard is rated not taught and no grade that rated them teaches them, or a standard taught in depth while a standard it builds on is not taught where rated. Only fully rated steps are checked. The tag says whether the link between the two standards is official or inferred from wording.`, "open the progression to see every step.", breaks, flagLi)}
      ${sec("dup", "Possible duplication: taught in depth again later", "Taught in depth in a grade after its suggested grade (often its own grade too).", "agree which grade owns it; the later grade can review or extend it.", a.dup, (x) => li(x.e, `<span class="tag">in depth: ${x.gs.map(gl).join(", ")} (suggested ${x.e.pl.map(gl).join(", ")})</span>`, gs))}
      ${sec("early", "Taught in depth before its suggested grade", "An earlier grade teaches it in depth (sometimes as well as its own grade). This is a placement question, not a duplicate.", "decide whether the standard belongs in the earlier grade.", a.early, (x) => li(x.e, `<span class="tag">in depth: ${x.gs.map(gl).join(", ")} (suggested ${x.e.pl.map(gl).join(", ")})</span>`, gs))}
      ${sec("plans", "In the plans, but marked not taught", "A grade's curriculum documents cite the standard, but the grade says it is not taught.", "check the plan or the rating.", planNot, (x) => li(x.e, `<span class="tag">${gl(x.g)}</span>`, gs))}
      ${sec("weak", "Only introduced: no grade teaches it in depth", "Rated, but no grade that rated it reports teaching, practising and assessing it.", "decide where it should be taught in depth.", a.weak, ({ e, u }) => li(e, `<span class="tag">suggested ${e.pl.map(gl).join(", ")}</span>${unknownTags(u)}`, gs))}
      ${sec("placed", "Not taught in the suggested grade, but taught elsewhere", "The suggested grade says not taught while another grade teaches it.", "consider moving the standard to the grade that teaches it.", a.placedNot, (x) => li(x.e, `<span class="tag">${gl(x.g)} says not taught</span>`, gs))}
      ${sec("moves", "Taught in a grade other than the suggested one", "A grade teaches a standard that is suggested for another grade. This can be healthy review or extension.", "use these when deciding where standards belong.", a.elsewhere, (x) => li(x.e, `<span class="tag sg">${gl(x.g)} · ${LEVEL_SHORT[x.l]} (suggested ${x.e.pl.map(gl).join(", ")})</span>`, gs))}
      ${sec("reinforce", "Reinforcement across a band", "A standard written for several grades (for example 9-10) taught in depth in more than one of them. Usually healthy.", "check the expectation rises from one grade to the next.", a.reinforce, (x) => li(x.e, `<span class="tag">in depth: ${x.gs.map(gl).join(", ")}</span>`, gs))}
      ${sec("unrated", "Unknown: not rated yet", "No grade has rated these, so nothing can be concluded.", "", a.unrated, (e) => li(e, `<span class="tag">${e.pl.map(gl).join(", ")}</span>`, gs))}
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
    const [planNot, planNotEE] = split(list.filter((e) => isPn(e, g) && lv(e) === 0));
    const notPlan = hasPlans ? list.filter((e) => !isEE(e.f) && !isPn(e, g) && lv(e) === 2) : [];
    const [extra, extraEE] = split(S.idx[sl].filter((e) => !e.pl.includes(g) && (lv(e) || 0) > 0 && (!S.f.framework || subject !== S.f.subject || e.f === S.f.framework)));
    const flags = progFlags(subject, GRADES);
    // Problems that reach a later grade, counted by the standards rated here that cause them; then problems in this grade
    // that are not the same thing seen from the other side.
    const caused = flags.filter(({ f }) => f.cause === g && f.g !== g), causeKeys = new Set(caused.flatMap(({ f }) => f.ka ? [f.ka] : f.ks || []));
    const causedF = new Set(caused.map(({ f }) => f)), here = flags.filter(({ f }) => (f.g === g || (f.gs || []).includes(g)) && !causedF.has(f));
    const strands = []; for (const e of list) { const key = e.f + "|" + (e.s || "Other"); let x = strands.find((y) => y.key === key); if (!x) strands.push(x = { key, f: e.f, s: e.s || "Other", arr: [] }); x.arr.push(e); }
    strands.forEach((x) => (x.c = countLevels(x.arr, g)));
    const worst = strands.filter((x) => x.arr.length - x.c[3] >= 3 && x.c[0] / (x.arr.length - x.c[3]) >= 0.4).sort((a, b) => b.c[0] / (b.arr.length - b.c[3]) - a.c[0] / (a.arr.length - a.c[3]))[0];
    const pl = (n, one, many) => `<b>${n}</b> ${n === 1 ? one : many}`, ee = (n) => (n ? ` (plus ${n} linked Essential Element${n > 1 ? "s" : ""})` : "");
    // "5 power standards are rated below in depth (plus 6 linked Essential Elements)", or only the Essential Elements.
    const both = (m, x, one, many, rest) => (m ? `${pl(m, one, many)} ${rest}${ee(x)}` : `${pl(x, "linked Essential Element is", "linked Essential Elements are")} ${rest}`);
    const P = prName(g).toLowerCase(), soft = caused.length && caused.every(({ f }) => f.t === "prereq" && !f.official);
    return [
      caused.length ? [`${pl(causeKeys.size || caused.length, "standard rated not taught here leaves", "standards rated not taught here leave")} a ${soft ? "possible " : ""}prerequisite gap in ${gnames([...new Set(caused.map(({ f }) => f.g))])}`, null, caused, "caused"] : null,
      here.length ? [`${pl(here.length, "progression problem", "progression problems")} in ${esc(gname(g))}`, null, here, "here"] : null,
      prLow.length + prLowEE.length ? [both(prLow.length, prLowEE.length, `${P} standard is`, `${P} standards are`, "rated below in depth"), prLow.concat(prLowEE), null, "prlow"] : null,
      planNot.length + planNotEE.length ? [both(planNot.length, planNotEE.length, "standard is", "standards are", "in the grade's plans but marked not taught"), planNot.concat(planNotEE), null, "plannot"] : null,
      worst ? [`${badge(worst.f)} <b>${esc(worst.s)}</b>${isEE(worst.f) ? " (Essential Elements)" : ""}: ${worst.c[0]} of ${worst.arr.length - worst.c[3]} rated standards not taught`, worst.arr.filter((e) => lv(e) === 0), null, "strand"] : null,
      extra.length + extraEE.length ? [both(extra.length, extraEE.length, "standard is", "standards are", "suggested for another grade but taught here (possible moves)"), extra.concat(extraEE), null, "extra"] : null,
      prUn.length + prUnEE.length ? [both(prUn.length, prUnEE.length, `${P} standard is`, `${P} standards are`, "not rated yet"), prUn.concat(prUnEE), null, "prun"] : null,
      notPlan.length ? [`${pl(notPlan.length, "standard is", "standards are")} taught in depth but not cited in the documents read so far (the plans may not list ${notPlan.length === 1 ? "it" : "them"} yet; Part 2 will check)`, notPlan, null, "notplan"] : null,
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
    strands.forEach((x) => { x.c = countLevels(x.arr, g); x.score = (x.c[2] + 0.5 * x.c[1]) / (x.arr.length - x.c[3] || 1); });
    const ratedStrands = strands.filter((x) => !isEE(x.f) && x.arr.length - x.c[3] >= 3).sort((a, b) => b.score - a.score);
    const hasPlans = items().some((e) => isPn(e, g));
    const pr = main.filter((e) => isPr(e, g)), pn = main.filter((e) => isPn(e, g)), deep = (l) => l.filter((e) => rating(e.f, e.c, g)?.level === 2).length, rt = (l) => l.filter((e) => rating(e.f, e.c, g)).length;
    const extra = S.idx[subj().slug].filter((e) => !e.pl.includes(g) && (rating(e.f, e.c, g)?.level || 0) > 0);
    const bars = strands.map((x) => {
      const w = (i) => (x.c[i] / x.arr.length) * 100;
      return `<button type="button" class="sb-name" data-act="strand" data-s="${esc(x.s)}" title="Open this strand on the Rate page">${badge(x.f)} ${esc(x.s)}</button><div class="sb" role="img" aria-label="${esc(x.s)}: ${x.c[2]} in depth, ${x.c[1]} introduced, ${x.c[0]} not taught, ${x.c[3]} not rated">
        ${[[2, COLORS[2]], [1, COLORS[1]], [0, COLORS[0]], [3, "#FFFFFF"]].map(([i, col]) => (x.c[i] ? `<i class="${i === 3 ? "sb-un" : ""}" style="width:${w(i)}%;background:${col}" data-tip-text="${esc(x.s)}: ${x.c[i]} ${i === 3 ? "not rated" : LEVEL[i].toLowerCase()}"></i>` : "")).join("")}</div>
        <div class="num">${x.c[2]}/${x.arr.length}</div>`;
    }).join("");
    const review = gradeReview(g, S.f.subject, list);
    const flagLi = ({ x, f }) => `<li><span class="mk-flag f-${f.t}${f.t === "prereq" && !f.official ? " soft" : ""}">${flagName(f)}</span> <button type="button" class="linkish" data-act="goto-lane" data-id="${esc(x.l.id)}">${esc(x.l.name)}</button> <span class="muted">${esc(f.msg)}</span></li>`;
    const revItem = ([title, arr, br, id], i) => `<details class="rev" data-sec="dash-${id}" ${isOpen("dash-" + id, i === 0 && !["prun", "notplan", "extra"].includes(id)) ? "open" : ""}><summary>${title} <span class="tag auto">Automatic check</span></summary>${arr ? `<ul class="gap-list rev-list">${arr.slice(0, 15).map((e) => { const r = rating(e.f, e.c, g); return `<li><span class="rv-code">${badge(e.f)} ${codeHTML(e)}</span> <span class="muted">${esc(e.t.slice(0, 100))}${e.t.length > 100 ? "…" : ""}</span> <span class="pill"><i class="lv ${r ? "lv-" + r.level : "lv-none"}"></i>${r ? LEVEL_SHORT[r.level] : "Not rated"}</span>${!e.pl.includes(g) ? ` <span class="tag sg">suggested ${esc(e.pl.map(gl).join(", "))}</span>` : ""}</li>`; }).join("")}</ul>${arr.length > 15 ? `<p class="muted">and ${arr.length - 15} more.</p>` : ""}` : ""}
      ${br ? `<ul class="issues">${br.map(flagLi).join("")}</ul>` : ""}</details>`;
    const subs = S.meta.subjects.map((x) => x.name).filter((sb) => teamOf(g, sb));
    const gi = GRADES.indexOf(g), near = [GRADES[gi - 1], GRADES[gi + 1]];
    el.innerHTML = backBar() + `<p class="grade-nav">${near[0] ? `<button type="button" class="linkish" data-act="grade" data-g="${near[0]}">← ${esc(gname(near[0]))}</button>` : ""}${near[1] ? `<button type="button" class="linkish" data-act="grade" data-g="${near[1]}">${esc(gname(near[1]))} →</button>` : ""}</p>` + gradeOverview(g, subs, true) + `<div class="panel insights"><h2>${esc(gname(g))} · ${esc(S.f.subject)} ${hb("dashboard")}</h2>
      <p class="lede">${rated ? `${rated} of ${main.length} main standards rated (${Math.round((rated / main.length) * 100)}%): ${tot[2]} taught in depth, ${tot[1]} introduced, ${tot[0]} not taught.${ee.length ? ` Essential Elements: ${ee.length - eeC[3]} of ${ee.length} rated.` : ""}${ratedStrands.length > 1 ? ` Strongest strand: <b>${esc(ratedStrands[0].s)}</b>; most room to grow: <b>${ratedStrands.filter((x) => x.score === ratedStrands[ratedStrands.length - 1].score).map((x) => esc(x.s)).join("</b> and <b>")}</b>.` : ""}` : `No ratings yet for ${esc(gname(g))} ${esc(S.f.subject)}. This page fills in as the team rates.`} <span class="muted">Sets: ${setsFor(S.f.subject, g).map(badge).join(" ")} (the team's choice${S.f.framework ? "; the Standard set filter is narrowing it" : ""}). Updates as teams rate.</span></p>
      <h3>What to review ${hb("dash_review")}</h3>
      ${review.length ? review.map(revItem).join("") : `<p class="muted">${rated ? "Nothing stands out yet." : "Nothing to review until the team rates its standards."}</p>`}
      <div class="tiles">
        <div class="tile ring-tile">${donut(tot, 64)}<div class="l">${rated} of ${main.length} main standards rated ${hb("t_rated")}</div></div>
        <div class="tile t2"><div class="n">${tot[2]}</div><div class="l">taught in depth ${hb("t_depth")}</div></div>
        <div class="tile t1"><div class="n">${tot[1]}</div><div class="l">introduced or exposed ${hb("t_intro")}</div></div>
        <div class="tile t0"><div class="n">${tot[0]}</div><div class="l">not taught ${hb("t_not")}</div></div>
        <div class="tile t-pr"><div class="n">${deep(pr)}<small>/${rt(pr)}</small></div><div class="l">rated <span class="mk mk-pr">★ ${prName(g)}</span> standards taught in depth${pr.length - rt(pr) ? `; ${pr.length - rt(pr)} not rated` : ""} ${hb("t_prio")}</div></div>
        <div class="tile t-pn"><div class="n">${hasPlans ? `${deep(pn)}<small>/${rt(pn)}</small>` : "n/a"}</div><div class="l">${hasPlans ? `rated <span class="mk mk-pn">✓ In plans</span> standards taught in depth${pn.length - rt(pn) ? `; ${pn.length - rt(pn)} not rated` : ""}` : "No plan data yet for this grade and subject"} ${hb("t_plans")}</div></div>
        <div class="tile"><div class="n">${extra.length}</div><div class="l">taught here but suggested for another grade ${hb("t_extra")}</div></div>
      </div>
      <h3>Coverage by strand ${hb("strandbars")}</h3><div class="strand-bars" id="dash-bars">${bars || "<div class='muted'>No standards.</div>"}</div></div>`;
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
  const FLAG = { break: "Break", moved: "Taught in another grade", prereq: "Prerequisite gap", repeat: "Repeated in depth", reinforce: "Reinforced across grades", same: "Same wording" };
  const flagName = (f) => (f.t === "prereq" && !f.official ? "Possible prerequisite gap" : FLAG[f.t]);
  const linkBasis = (l, one) => (l.basis === "anchor" ? (one ? "same anchor standard, official" : "same anchor standard (official); matching part inferred from wording") : "link inferred from wording");
  const home = (e) => { const h = e.pl.filter((g) => !(e.pa || []).includes(g)); return h.length ? h : e.pl; };
  const taughtIn = (e) => GRADES.filter((g) => (rating(e.f, e.c, g)?.level || 0) > 0);
  const gnames = (gs) => (gs.length < 2 ? gs.map(gname).join("") : gs.slice(0, -1).map(gname).join(", ") + " and " + gname(gs[gs.length - 1]));
  const verb = (n, one, many) => (n > 1 ? many : one);
  // A standard is "fully not taught" when every grade it is placed in (its own grade and any grade whose plans cite it)
  // rated it not taught and no other grade says it teaches it.
  const fullyNot = (e) => e.pl.every((g) => rating(e.f, e.c, g)?.level === 0) && !taughtIn(e).length;
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
      if (!elsewhere.length) broken.add(i);
      flags.push(!elsewhere.length
        ? { t: "break", g: vis(st)[0], gs: vis(st), ks: st.k, official: l.basis !== "topic", msg: `Breaks in ${gnames(vis(st))}: every standard in this step is rated not taught there and no grade teaches ${verb(es.length, "it", "them")}, although earlier and later grades teach the idea.` }
        : { t: "moved", g: vis(st)[0], gs: vis(st), ks: st.k, msg: `${gnames(vis(st))} ${verb(vis(st).length, "rates", "rate")} this step not taught, but ${gnames(elsewhere)} ${verb(elsewhere.length, "teaches", "teach")} ${es.filter((e) => taughtIn(e).length).map(codeText).join(", ")}. The idea may simply sit in another grade.` });
    });
    // Prerequisite gaps, standard by standard: a standard taught in depth where every standard it builds on (by a close
    // link) is fully rated and not taught anywhere. A gap already explained by a Break is not repeated.
    const into = new Map(); for (const [a, b, sm] of l.links) if (sm >= MIN_SIM && inLane.has(a) && inLane.has(b)) (into.get(b) || into.set(b, []).get(b)).push([a, sm]);
    for (const [b, from] of into) {
      const eb = S.byKey.get(b), bDeep = eb.pl.filter((g) => gs.includes(g) && rating(eb.f, eb.c, g)?.level === 2), best = Math.max(...from.map((x) => x[1]));
      const prevStep = steps[stepOf.get(from[0][0])], one = prevStep && prevStep.k.length === 1;
      if (!bDeep.length || (l.basis !== "anchor" && best < PRE_SIM)) continue;
      const as = from.map(([a]) => S.byKey.get(a));
      if (!as.every(fullyNot) || as.some((ea) => broken.has(stepOf.get(ea.f + "|" + ea.c)))) continue;
      const ea = as[0], aG = ea.pl.filter((g) => gs.includes(g)), official = l.basis === "anchor" && one;
      flags.push({ t: "prereq", g: bDeep[0], cause: aG[0], k: b, ka: ea.f + "|" + ea.c, official, msg: `${codeText(eb)} is taught in depth in ${gname(bDeep[0])}, but ${as.map(codeText).join(" and ")}, which it builds on (${gnames(aG)}; ${linkBasis(l, one)}), ${verb(as.length, "is", "are")} rated not taught and no grade teaches ${verb(as.length, "it", "them")}.` });
    }
    // Without a close link, the same check step to step, in the official order of the progression.
    steps.forEach((st, i) => {
      const prev = steps[i - 1];
      if (!prev || !st.s.deep || !prev.s.full || prev.s.state !== "not" || broken.has(i - 1) || flags.some((f) => f.t === "prereq" && st.k.includes(f.k))) return;
      if (!prev.k.every((k) => fullyNot(S.byKey.get(k)))) return;
      flags.push({ t: "prereq", g: vis(st)[0], cause: vis(prev)[0], ks: prev.k, official: l.basis !== "topic", msg: `${gnames(vis(st))} ${verb(vis(st).length, "teaches", "teach")} this idea in depth, but every standard in the step before (${gnames(vis(prev))}) is rated not taught and no grade teaches them.` });
    });
    for (const st of steps) for (const k of st.k) {
      const e = S.byKey.get(k), deepIn = GRADES.filter((g) => gs.includes(g) && rating(e.f, e.c, g)?.level === 2);
      if (deepIn.length < 2) continue;
      const own = deepIn.every((g) => e.pl.includes(g)), added = deepIn.filter((g) => (e.pa || []).includes(g));
      flags.push(own ? { t: "reinforce", g: deepIn[0], gs: deepIn, k, msg: `${codeText(e)} is taught in depth in ${gnames(deepIn)}${added.length ? ` (${gnames(added)} ${verb(added.length, "rates", "rate")} it because ${verb(added.length, "its", "their")} plans cite it)` : ", the grades of its band"}: reinforcement. Check the expectation rises.` }
        : { t: "repeat", g: deepIn[0], gs: deepIn, k, msg: `${codeText(e)} (suggested for ${gnames(e.pl)}) is taught in depth in ${gnames(deepIn)}: possible duplication. Agree which grade owns it.` });
    }
    // Same wording: compared in the Wisconsin 2020 text (what the site shows); Common Core versions can differ slightly.
    for (const [a, b, , same] of l.links) if (same && inLane.has(a) && inLane.has(b)) {
      const ea = S.byKey.get(a), eb = S.byKey.get(b);
      flags.push({ t: "same", g: home(eb)[0], k: b, ka: a, msg: `In the Wisconsin 2020 text, ${eb.c} (${gl(home(eb)[0])}) reads the same as ${ea.c} (${gl(home(ea)[0])}), so the Wisconsin standard does not say how the expectation rises${eb.s === "Reading" ? " (in Reading it rises through more complex texts)" : ""}. The Common Core versions (${codeText(eb)}, ${codeText(ea)}) can differ slightly: compare them before deciding.` });
    }
    const slots = steps.reduce((n, st) => n + st.s.n, 0), rated = steps.reduce((n, st) => n + st.s.rated, 0), not = steps.reduce((n, st) => n + st.s.not, 0);
    const hard = flags.some((f) => f.t === "break" || (f.t === "prereq" && f.official)), soft = flags.some((f) => f.t === "prereq" && !f.official);
    const status = !steps.length ? "none" : hard ? "issue" : soft ? "check" : steps.length < 2 ? "single" : !rated ? "unrated" : rated < slots ? "partial" : not ? "thin" : "ok";
    const span = steps.length ? [vis(steps[0])[0], vis(steps[steps.length - 1]).slice(-1)[0]] : [];
    const out = { steps, flags, status, slots, rated, unrated: steps.filter((st) => st.s.state === "unrated").length, span };
    if (mk) laneMemo.set(mk, out);
    return out;
  }
  // Breaks and prerequisite gaps for one subject, for the Gaps page and the dashboard: official structure first.
  const flagRank = (f) => (f.t === "break" ? 0 : f.official ? 1 : 2);
  const progFlags = (subject, gs, keys) => (S.prog ? S.prog.lanes.filter((l) => l.subject === subject).map((l) => ({ l, ...laneInfo(l, gs, keys) }))
    .flatMap((x) => x.flags.filter((f) => f.t === "break" || f.t === "prereq").map((f) => ({ x, f }))).sort((a, b) => flagRank(a.f) - flagRank(b.f)) : []);
  const STATUS = { issue: ["Breaks down", "st-issue"], check: ["Possible prerequisite gap", "st-thin"], single: ["One grade only", "st-none"], unrated: ["Not rated yet", "st-none"], partial: ["Partly rated", "st-part"], thin: ["Some standards not taught", "st-thin"], ok: ["Taught at every step", "st-ok"] };
  const laneById = (id) => S.prog.lanes.find((l) => l.id === id);
  const laneMatch = (x, q) => !q || x.l.name.toLowerCase().includes(q) || x.steps.some((st) => st.k.some((k) => { const e = S.byKey.get(k); return e && matchQ(e, q); }));
  const backBar = () => (S.backTo ? `<p class="back-bar"><button type="button" class="linkish" data-act="back-view">← Back to ${esc(S.backTo.label)}</button></p>` : "");
  function renderLadder() {
    const el = $("#view-ladder"), gs = visibleGrades(), q = mode() === "full" ? S.f.search.trim().toLowerCase() : "", g = S.f.grade, fw = S.f.framework;
    if (!S.prog) { el.innerHTML = `<div class="panel empty">Progressions are loading…</div>`; return; }
    if (fw && isEE(fw)) { el.innerHTML = backBar() + `<div class="panel empty"><b>Progressions follow the main standard sets</b> (Common Core, NGSS, AERO and Wisconsin Social Studies). Essential Elements are alternate versions of those standards, so each one follows the progression of the standard it links to: open an Essential Element and use its linked standard. Choose another standard set above to see progressions.</div>`; return; }
    // The filters narrow the steps: standard set, strand and Standards (priority / in plans) keep only matching standards.
    const keys = new Set(filtered({ ignoreSearch: true }).map((e) => e.f + "|" + e.c));
    const all = S.prog.lanes.filter((l) => l.subject === S.f.subject).map((l) => ({ l, ...laneInfo(l, gs, keys) }))
      .filter((x) => x.steps.length && (!g || x.steps.some((st) => st.g.includes(g))));
    const groups = [...new Set(all.map((x) => x.l.group))];
    if (S.pgGroup && !groups.includes(S.pgGroup)) S.pgGroup = "";
    const inGroup = all.filter((x) => !S.pgGroup || x.l.group === S.pgGroup);
    const has = (x, t) => x.flags.some((f) => f.t === t);
    const pick = { repeat: (x) => has(x, "repeat"), reinforce: (x) => has(x, "reinforce"), same: (x) => has(x, "same") };
    const shown = inGroup.filter((x) => (!S.pgStatus || (pick[S.pgStatus] ? pick[S.pgStatus](x) : x.status === S.pgStatus)) && laneMatch(x, q));
    const cnt = (k) => inGroup.filter((x) => (pick[k] ? pick[k](x) : x.status === k)).length;
    const issues = inGroup.flatMap((x) => x.flags.filter((f) => f.t === "break" || f.t === "prereq").map((f) => ({ x, f }))).sort((a, b) => flagRank(a.f) - flagRank(b.f) || GRADES.indexOf(a.f.g) - GRADES.indexOf(b.f.g));
    const moved = inGroup.flatMap((x) => x.flags.filter((f) => f.t === "moved").map((f) => ({ x, f })));
    const slots = inGroup.reduce((n, x) => n + x.slots, 0), rated = inGroup.reduce((n, x) => n + x.rated, 0);
    const strong = inGroup.filter((x) => x.status === "ok" && !has(x, "same")).sort((a, b) => b.steps.length - a.steps.length).slice(0, 3);
    const chip = (k, label) => `<button type="button" class="lib-t ${(S.pgStatus || "") === k ? "on" : ""}" data-act="pg-status" data-s="${k}">${label} <span>${k ? cnt(k) : inGroup.length}</span></button>`;
    const go = (x) => `<button type="button" class="linkish" data-act="lane-go" data-id="${esc(x.l.id)}">${esc(x.l.name)}</button>`;
    const fl = ({ x, f }) => `<li><span class="mk-flag f-${f.t}${f.t === "prereq" && !f.official ? " soft" : ""}">${flagName(f)}</span> ${go(x)} <span class="muted">${esc(f.msg)}</span></li>`;
    const card = (n, label, sub, cls, k) => `<button type="button" class="ins ${n ? cls : ""}" data-act="pg-status" data-s="${k}"><b>${n}</b><span>${label}</span><small>${sub}</small></button>`;
    el.innerHTML = backBar() + `<div class="panel insights"><h2>${esc(S.f.subject)} progressions, ${esc(divLabel(S.f.division))} ${hb("ladder")}</h2>
      <p class="lede">Each row follows one idea across the grades. Each box is one grade: how many standards, and a bar of how that grade rates them. The line shows how the idea builds from grade to grade.${g ? ` Showing the progressions with a step in ${esc(gname(g))} (its column is highlighted).` : ""} <span class="muted">Every verdict is an automatic check over the ratings so far.</span></p>
      <div class="ins-grid">
        ${card(cnt("issue"), "progressions break down", "a whole step not taught where rated, or in depth without an official prerequisite", "ins-issue", "issue")}
        ${card(cnt("check"), "possible prerequisite gaps", "taught in depth while the standard it seems to build on (inferred from wording) is not taught: check", "ins-warn", "check")}
        ${card(cnt("repeat"), "repeat a standard in depth", "taught in depth again in a grade it is not placed in (possible duplication)", "ins-warn", "repeat")}
        ${card(cnt("same"), "repeat the same wording", "a grade's Wisconsin standard reads the same as the one before it", "ins-warn", "same")}
        ${card(cnt("ok"), "taught at every step", "two or more grades; every standard rated and at least introduced", "ins-ok", "ok")}
        <div class="ins ins-data"><b>${slots ? Math.round((rated / slots) * 100) : 0}%</b><span>of standards rated</span><small>${slots - rated} of ${slots} still to rate: unknown, not a gap</small></div>
      </div>
      ${issues.length ? `<h3>Where progression breaks down <span class="tag auto">Automatic check</span> ${hb("pl_breaks")}</h3><ul class="issues">${issues.slice(0, 8).map(fl).join("")}</ul>${issues.length > 8 ? `<p class="muted">${issues.length - 8} more: choose <b>Breaks down</b> or <b>Possible prerequisite gap</b> below.</p>` : ""}`
        : `<p class="muted">${rated ? "No breaks found in the fully rated steps so far." : "No ratings yet, so breaks cannot be checked. Rows show the standards only."}</p>`}
      ${moved.length ? `<details class="rev" data-sec="pg-moved" ${isOpen("pg-moved") ? "open" : ""}><summary><b>${moved.length}</b> step${moved.length > 1 ? "s" : ""} rated not taught in ${moved.length > 1 ? "their" : "its"} grade but taught in another grade <span class="tag auto">Automatic check</span></summary><ul class="issues">${moved.map(fl).join("")}</ul></details>` : ""}
      ${strong.length ? `<p class="muted">Taught at every step: ${strong.map(go).join(", ")}.</p>` : ""}
    </div>
    <div class="panel"><div class="pl-tools">
      <label><span>Group ${hb("pl_group")}</span><select id="pg-group"><option value="">All groups (${all.length})</option>${groups.map((gr) => `<option ${gr === S.pgGroup ? "selected" : ""} value="${esc(gr)}">${esc(gr)}</option>`).join("")}</select></label>
      <div class="lib-tabs">${chip("", "All")}${chip("issue", "Breaks down")}${chip("check", "Possible prerequisite gap")}${chip("repeat", "Repeated in depth")}${chip("reinforce", "Reinforced")}${chip("same", "Same wording")}${chip("thin", "Some not taught")}${chip("partial", "Partly rated")}${chip("unrated", "Not rated")}${chip("ok", "Taught at every step")}${chip("single", "One grade only")} ${hb("pl_status")}</div></div>
      <div class="pl-key"><span><span class="pl-cell has key-cell"><span class="pc-n">3<i class="pc-star">★</i></span><span class="pc-bar"><i class="b2" style="flex:1"></i><i class="b1" style="flex:1"></i><i class="b3" style="flex:1"></i></span></span>Each box: how many standards in that grade, with a bar of their ratings (lime in depth, blue introduced, magenta not taught, grey not rated). ★ includes a priority or power standard. A pink box has a standard rated not taught.</span>
        <span><svg width="34" height="8"><line x1="0" y1="4" x2="34" y2="4" class="seg-ok"/></svg>Rated and taught in both grades</span><span><svg width="34" height="8"><line x1="0" y1="4" x2="34" y2="4" class="seg-pre"/></svg>Prerequisite gap (official link)</span><span><svg width="34" height="8"><line x1="0" y1="4" x2="34" y2="4" class="seg-break"/></svg>A step rated not taught, or a possible prerequisite gap</span><span><svg width="34" height="8"><line x1="0" y1="4" x2="34" y2="4" class="seg-un"/></svg>Not fully rated yet</span><span><svg width="34" height="8"><line x1="0" y1="4" x2="34" y2="4" class="seg-skip"/></svg>No standard in the grades between</span> ${hb("pl_key")}</div>
      <div class="pl-head"><div class="pl-name"><b>Progression</b></div><div class="pl-track" style="grid-template-columns:repeat(${gs.length},1fr)">${gs.map((x) => `<span data-gi="${x}" class="${g === x ? "sel" : ""}">${gl(x)}</span>`).join("")}</div></div>
      ${shown.map((x) => laneRow(x, gs, S.lane === x.l.id, q)).join("") || `<div class="empty">${q ? "No progression matches your search." : "No progressions in this view."}</div>`}</div>`;
    if (S.laneScroll) { const r = document.getElementById("lane-" + S.lane); if (r) r.scrollIntoView({ block: "start", behavior: "smooth" }); S.laneScroll = false; }
  }
  function laneRow(x, gs, open, q) {
    const l = x.l, n = gs.length, pos = x.steps.map((st) => gs.indexOf(st.g.find((g) => gs.includes(g))));
    let svg = "";
    for (let i = 0; i + 1 < x.steps.length; i++) {
      const a = x.steps[i].s, b = x.steps[i + 1].s;
      // A prerequisite gap into the later step shows on the line itself: solid magenta (official) or dashed (inferred).
      const pre = x.flags.filter((f) => f.t === "prereq" && (x.steps[i + 1].k.includes(f.k) || (!f.k && x.steps[i + 1].g.includes(f.g))));
      const cls = pre.some((f) => f.official) ? "seg-pre" : pre.length ? "seg-break" : !a.full || !b.full ? "seg-un" : a.state === "not" || b.state === "not" ? "seg-break" : pos[i + 1] - pos[i] > 1 ? "seg-skip" : "seg-ok";
      svg += `<line x1="${pos[i] * 100 + 50}" y1="20" x2="${pos[i + 1] * 100 + 50}" y2="20" class="${cls}" vector-effect="non-scaling-stroke"/>`;
    }
    const cells = gs.map((g) => {
      const sel = S.f.grade === g ? " sel" : "", es = x.steps.flatMap((st) => st.k).map((k) => S.byKey.get(k)).filter((e) => e.pl.includes(g));
      if (!es.length) return `<div class="pl-cell${sel}"></div>`;
      // One box per grade: how many standards, a bar of their ratings, and a star if any is a priority or power standard.
      const c = countLevels(es, g), pr = es.filter((e) => isPr(e, g)).length, r = es.length - c[3];
      const tint = !r ? "pc-un" : c[0] === r ? "pc-not" : c[0] ? "pc-mix" : c[3] ? "pc-part" : "pc-ok";
      const tip = `${gname(g)}: ${es.length} standard${es.length === 1 ? "" : "s"}. ${c[2]} in depth, ${c[1]} introduced, ${c[0]} not taught${c[3] ? `, ${c[3]} not rated` : ""}${pr ? `. ${pr} ${prName(g).toLowerCase()}` : ""}. ${es.map(codeText).join(", ")}`;
      return `<div class="pl-cell has ${tint}${sel}" data-tip-text="${esc(tip)}" tabindex="0" role="button" aria-label="${esc(tip)}. Open this progression." data-act="lane-open" data-id="${esc(l.id)}"><span class="pc-n">${es.length}${pr ? `<i class="pc-star">★</i>` : ""}</span><span class="pc-bar">${[2, 1, 0, 3].map((i) => (c[i] ? `<i class="b${i}" style="flex:${c[i]}"></i>` : "")).join("")}</span></div>`;
    }).join("");
    const types = new Set(x.flags.map((f) => f.t)), [label, cls] = STATUS[x.status] || ["", ""];
    const next = (l.next || []).map(laneById).filter((y) => y && y.subject === l.subject);
    return `<div class="pl-row ${open ? "open" : ""}" id="lane-${esc(l.id)}"><div class="pl-name"><button type="button" class="pl-open" data-act="lane" data-id="${esc(l.id)}" aria-expanded="${open}">${hl(l.name, q)}</button>
        <small>${esc(l.group)} · <span class="basis b-${l.basis}">${BASIS[l.basis]}</span> · ${x.span[0] === x.span[1] ? esc(gl(x.span[0])) : `${esc(gl(x.span[0]))} to ${esc(gl(x.span[1]))}`}${next.length ? ` · continues in ${next.map((y) => `<button type="button" class="linkish" data-act="lane-go" data-id="${esc(y.id)}">${esc(y.name.split(" (")[0])}</button>`).join(", ")}` : ""}</small>
        <span class="pl-flags" title="Automatic checks over the ratings so far"><span class="st ${cls}">${label}</span>${types.has("repeat") ? `<span class="st st-repeat">Repeated in depth</span>` : ""}${types.has("same") ? `<span class="st st-repeat">Same wording</span>` : ""}${types.has("moved") ? `<span class="st st-part">Taught in another grade</span>` : ""}</span></div>
      <div class="pl-track" style="grid-template-columns:repeat(${n},1fr)"><svg class="pl-svg" viewBox="0 0 ${n * 100} 40" preserveAspectRatio="none" aria-hidden="true">${svg}</svg>${cells}</div></div>
      ${open ? laneDetail(x, gs) : ""}`;
  }
  // Rating pills for every grade a standard belongs to, plus any other grade that teaches it.
  function gradePills(e, gs) {
    const own = e.pl.filter((g) => gs.includes(g)), also = taughtIn(e).filter((g) => !own.includes(g)), pa = e.pa || [];
    return own.map((g) => { const r = rating(e.f, e.c, g); return `<span class="pill" title="${pa.includes(g) ? esc(gname(g)) + " rates it because its plans cite it" : ""}"><i class="lv ${r ? "lv-" + r.level : "lv-none"}"></i>${own.length > 1 ? gl(g) + (pa.includes(g) ? " (plans)" : "") + ": " : ""}${r ? LEVEL_SHORT[r.level] : "Not rated"}</span>`; }).join("")
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
          const flagChip = (f) => `<span class="mk-flag f-${f.t}${f.t === "prereq" && !f.official ? " soft" : ""}">${flagName(f)}</span>`;
          return `<li>${codeHTML(e)}<span class="pd-t">${esc(e.t.slice(0, 160))}${e.t.length > 160 ? "…" : ""}${si > 0 ? `<small class="pd-link">${p.length ? `Builds on ${p.map(([pe, same]) => `${esc(codeText(pe))} (${esc(gl(home(pe)[0]))})${same ? ", same Wisconsin wording" : ""}`).join("; ")} · ${official && x.steps[si - 1].k.length === 1 ? "same anchor standard, official" : "closest match by wording, inferred"}` : "No close match in the step before (same progression)"}</small>` : ""}${own.map((f) => `<small class="pd-own">${flagChip(f)} ${esc(f.msg)}</small>`).join("")}</span><span class="mks">${marks(e, home(e)[0])}</span><span class="pd-pills">${gradePills(e, gs)}</span></li>`; }).join("")}</ul>
        ${fl.map((f) => `<p class="pd-flag f-${f.t}"><span class="tag auto">Automatic check</span> ${esc(f.msg)}</p>`).join("")}</div>`;
    });
    const reps = x.flags.filter((f) => f.t === "same");
    const next = (l.next || []).map(laneById).filter(Boolean), prev = S.prog.lanes.filter((y) => (y.next || []).includes(l.id));
    const link = (y) => `<button type="button" class="linkish" data-act="lane-go" data-id="${esc(y.id)}">${esc(y.name)}</button>`;
    return `<div class="pl-detail"><p class="muted"><b>How this row is built:</b> ${esc(S.prog.basis[l.basis] || "")} ${official ? "Where a grade has several parts of the anchor standard, the closest part is matched by shared wording (inferred)." : "Links between single standards are inferred from shared wording; weak matches are not shown."}</p>
      ${prev.length ? `<p class="muted">Grows out of: ${prev.map(link).join(", ")}.</p>` : ""}
      ${reps.length ? `<ul class="issues">${reps.map((f) => `<li><span class="mk-flag f-same">Same wording</span> <span class="muted">${esc(f.msg)}</span></li>`).join("")}</ul>` : ""}${html}
      ${next.length ? `<p class="pd-next">After this, the idea continues in ${next.map(link).join(" and ")}.</p>` : ""}</div>`;
  }
  // In the popup: the standards just before and after this one in each progression it belongs to, with their wording,
  // ratings in every grade, and any automatic check that involves this standard.
  function progBox(e) {
    if (!S.prog) return "";
    const k = e.f + "|" + e.c, lanes = S.progLanes.get(k) || [];
    if (!lanes.length) return `<p class="muted">${isEE(e.f) ? "Essential Elements follow the progression of the standard they link to (see Linked standards)." : "This standard is not in a progression yet."}</p>`;
    const one = (x, same) => `<li>${codeHTML(x)} <span class="muted">${esc(home(x).map(gl).join(", "))}</span> ${gradePills(x, GRADES)}${same ? ` <span class="tag">same wording</span>` : ""}<span class="pb-t">${esc(x.t.slice(0, 120))}${x.t.length > 120 ? "…" : ""}</span></li>`;
    const more = (arr, n) => (arr.length > n ? `<li class="muted">and ${arr.length - n} more in that step</li>` : "");
    return lanes.slice(0, 3).map((l) => {
      const info = laneInfo(l, GRADES), i = info.steps.findIndex((st) => st.k.includes(k)), stepEs = (st) => (st ? st.k.map((x) => S.byKey.get(x)) : []);
      const strong = (x) => x[2] >= MIN_SIM;
      const lb = l.links.filter((x) => x[1] === k && strong(x)).map((x) => [S.byKey.get(x[0]), x[3]]).filter(([x]) => x);
      const la = l.links.filter((x) => x[0] === k && strong(x)).map((x) => [S.byKey.get(x[1]), x[3]]).filter(([x]) => x);
      const pStep = stepEs(info.steps[i - 1]), nStep = stepEs(info.steps[i + 1]), next = (l.next || []).map(laneById).filter(Boolean);
      // At the start of a row, the row it grows out of (Ratios grows out of Fractions) and that row's last step.
      const prevLane = !pStep.length && i === 0 ? S.prog.lanes.find((y) => (y.next || []).includes(l.id)) : null, pInfo = prevLane && laneInfo(prevLane, GRADES);
      // ... its latest step before this grade (Expressions grows into Equations around Grade 6, not at Grade 12).
      const g0 = GRADES.indexOf(info.steps[0] ? info.steps[0].g[0] : e.pl[0]), before = pInfo ? pInfo.steps.filter((st) => GRADES.indexOf(st.g[st.g.length - 1]) < g0) : [];
      const fromPrev = before.length ? before[before.length - 1].k.map((x) => S.byKey.get(x)) : [];
      const laneBtn = (y) => (mode() === "full" ? `<button type="button" class="linkish" data-act="goto-lane" data-id="${esc(y.id)}">${esc(y.name)}</button>` : esc(y.name));
      const col = (title, linked, step, none) => `<div><h4>${linked.length ? title[0] : step.length ? title[1] : title[0]}</h4><ul class="pb-list">${linked.length ? linked.slice(0, 4).map(([x, same]) => one(x, same)).join("") + more(linked, 4)
        : step.length ? `<li class="muted">No close match by wording; the ${title === BEFORE ? "earlier" : "later"} step of this progression is:</li>` + step.slice(0, 3).map((x) => one(x)).join("") + more(step, 3) : `<li class="muted">${none}</li>`}</ul></div>`;
      const BEFORE = ["Builds on", "Step before"], AFTER = ["Leads to", "Next step"];
      const fl = info.flags.filter((f) => !["repeat", "reinforce"].includes(f.t) && (f.k === k || f.ka === k || (f.ks || []).includes(k)));
      return `<div class="pb">${mode() === "full" ? `<button type="button" class="linkish" data-act="goto-lane" data-id="${esc(l.id)}" title="Open this progression"><b>${esc(l.name)}</b></button>` : `<b>${esc(l.name)}</b>`} <span class="basis b-${l.basis}">${BASIS[l.basis]}</span>
        ${fl.map((f) => `<p class="pd-flag f-${f.t}"><span class="tag auto">Automatic check</span> <span class="mk-flag f-${f.t}${f.t === "prereq" && !f.official ? " soft" : ""}">${flagName(f)}</span> ${esc(f.msg)}</p>`).join("")}
        <div class="pb-cols">${fromPrev.length ? `<div><h4>Grows out of</h4><ul class="pb-list"><li class="muted">This progression grows out of ${laneBtn(prevLane)}; its step just before this grade is:</li>${fromPrev.slice(0, 3).map((x) => one(x)).join("")}${more(fromPrev, 3)}</ul></div>` : col(BEFORE, lb, pStep, "No earlier step in this progression on this site.")}${col(AFTER, la, nStep, next.length ? `No later step here; the idea continues in ${next.map(laneBtn).join(" and ")}.` : "No later step in this progression on this site.")}</div></div>`;
    }).join("") + `<p class="muted" style="margin:6px 0 0">${lanes[0].basis === "anchor" ? "Same anchor standard (official); the closest part is matched by wording." : "Links between single standards are inferred from shared wording."}</p>`;
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
    if (!rows.length) return `<p class="muted">Not found in any plan read so far.</p>`;
    return `<ul class="comments">${rows.map(({ g, x }) => `<li><b>${esc(gname(g))}</b>: ${x.weeks} week${x.weeks === 1 ? "" : "s"} (${LEVEL[x.level].toLowerCase()}, ${x.match})
      <div class="meta">${x.refs.map(([si, wk]) => { const s = S.evidence.sources[si]; return `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a> ${esc(s.year)}: ${esc(wk.join(", "))}`; }).join("<br>")}</div></li>`).join("")}</ul>`;
  }
  // What the curriculum documents say for one grade, next to the Part 1 ratings. Findings only count what can be known:
  // rated rows apart from unrated ones, priority standards the grade rates apart from those placed in other grades, and
  // nothing about "not in the plans" when the documents read so far cite nothing for this grade and subject.
  function docsPanel(list, g) {
    const mine = list.filter((e) => forGrade(e, g) || isPn(e, g) || isPr(e, g)), lv = (e) => rating(e.f, e.c, g)?.level;
    const hasPlans = items().some((e) => isPn(e, g));
    // Priority counts are for the main standards; Essential Elements take the mark from the standard they link to, so
    // they are counted apart (the same way as the Grade dashboard).
    const pr = mine.filter((e) => isPr(e, g)), prEE = pr.filter((e) => isEE(e.f) && forGrade(e, g)), prMain = pr.filter((e) => !isEE(e.f));
    const prMine = prMain.filter((e) => forGrade(e, g)), prOther = prMain.filter((e) => !forGrade(e, g));
    const prLow = prMine.filter((e) => lv(e) != null && lv(e) < 2), prUn = prMine.filter((e) => lv(e) == null), prDeep = prMine.filter((e) => lv(e) === 2);
    const eeLow = prEE.filter((e) => lv(e) != null && lv(e) < 2), eeDeep = prEE.filter((e) => lv(e) === 2), eeRated = prEE.filter((e) => lv(e) != null);
    const pn = mine.filter((e) => isPn(e, g)), pnRated = pn.filter((e) => lv(e) != null), pnTaught = pnRated.filter((e) => lv(e) > 0);
    const planNot = pn.filter((e) => lv(e) === 0);
    // Essential Elements are not cited by code in the plans, so they are left out of "taught but not in the plans".
    const notInPlans = hasPlans ? mine.filter((e) => e.pl.includes(g) && !isEE(e.f) && !isPn(e, g) && lv(e) > 0) : [];
    const row = (e) => { const r = rating(e.f, e.c, g); return `<tr><td>${badge(e.f)} ${codeHTML(e)}</td><td>${marks(e, g) || "<span class='muted'>None</span>"}${!forGrade(e, g) ? ` <span class="tag">placed in ${esc(e.pl.map(gl).join(", "))}</span>` : ""}</td><td>${r ? `<span class="pill"><i class="lv lv-${r.level}"></i>${LEVEL_SHORT[r.level]}</span>` : `<span class="pill"><i class="lv lv-none"></i>Not rated</span>`}</td><td class="muted">${esc(e.t.slice(0, 110))}${e.t.length > 110 ? "…" : ""}</td></tr>`; };
    const tbl = (arr, msg) => `<div class="tbl-scroll"><table class="svs"><thead><tr><th>Code</th><th>In the documents</th><th>Team says (Part 1)</th><th>Standard</th></tr></thead><tbody>${arr.slice(0, 200).map(row).join("") || `<tr class="placeholder"><td colspan="4">${msg}</td></tr>`}</tbody></table></div>`;
    const sec = (id, title, desc, arr, msg, open, auto = true) => `<details class="gap" data-sec="aud-${id}" ${isOpen("aud-" + id, open) ? "open" : ""}><summary><span class="count">${arr.length}</span>${title}${auto ? ' <span class="tag auto">Automatic check</span>' : ""}</summary><p class="muted">${desc}</p>${tbl(arr, msg)}</details>`;
    const share = (a, b) => (b ? `${a}<small>/${b}</small>` : "n/a");
    return `<div class="panel insights"><h2>What the curriculum documents say ${hb("p_docs")}</h2>
      <p class="lede">${esc(gname(g))} · ${esc(S.f.subject)}: the school's documents cite <b>${pn.length}</b> standards for this grade (<span class="mk mk-pn">✓ In plans</span>) and name <b>${prMain.length}</b> as <span class="mk mk-pr">★ ${prName(g)}</span> standards${prOther.length ? ` (${prOther.length} of them are placed in other grades, so ${esc(gname(g))} does not rate them)` : ""}.${prEE.length ? ` ${prEE.length} Essential Elements linked to them carry the mark too; they are counted apart.` : ""} Counts below use rated standards only; unrated ones are listed apart. <span class="muted">Updates as teams rate.</span></p>
      ${hasPlans ? "" : `<div class="notice"><b>No plan data yet for ${esc(gname(g))} ${esc(S.f.subject)}.</b> The documents read so far cite no ${esc(S.f.subject)} standards for this grade, so the site cannot say what is or is not in the plans. ${hb("p_docs")}</div>`}
      <div class="ins-grid">
        <div class="ins ${prLow.length ? "ins-issue" : ""}"><b>${share(prDeep.length, prDeep.length + prLow.length)}</b><span>rated ${prName(g).toLowerCase()} standards taught in depth</span><small>${prLow.length} rated below in depth; ${prUn.length} not rated yet${prEE.length ? `. Linked Essential Elements: ${eeDeep.length} of ${eeRated.length} rated in depth` : ""}</small></div>
        <div class="ins"><b>${hasPlans ? share(pnTaught.length, pnRated.length) : "n/a"}</b><span>rated planned standards taught</span><small>${hasPlans ? `${pnRated.length} of ${pn.length} planned standards rated; ${pn.length - pnRated.length} unknown` : "no plan data yet"}</small></div>
        <div class="ins ${planNot.length ? "ins-issue" : ""}"><b>${hasPlans ? planNot.length : "n/a"}</b><span>in the plans but marked not taught</span><small>${hasPlans ? "check the plan or the rating" : "needs plan data"}</small></div>
        <div class="ins"><b>${hasPlans ? notInPlans.length : "n/a"}</b><span>taught but not cited in the plans</span><small>${hasPlans ? "the plans may not list it yet; Part 2 will check" : "needs plan data"}</small></div>
      </div>
      ${sec("prlow", `${prName(g)} standards rated below in depth`, `Named ${prName(g).toLowerCase()} standards for ${esc(gname(g))} that the team rates introduced or not taught${eeLow.length ? `, then the ${eeLow.length} linked Essential Elements rated below in depth` : ""}.`, prLow.concat(eeLow), prMine.length ? "None. Every rated one is taught in depth." : "The documents name none that this grade rates.", true)}
      ${sec("plannot", "In the plans, but marked not taught", "The documents cite these, but the team says they are not taught. Worth a quick check.", planNot, hasPlans ? "None." : "No plan data yet.", planNot.length > 0)}
      ${sec("prun", `${prName(g)} standards not rated yet`, `Unknown, not a gap: ${esc(gname(g))} has not rated these yet.`, prUn, "None.", false, false)}
      ${hasPlans ? sec("notplan", "Taught, but not cited in the plans", "The team teaches these, but the curriculum documents read so far do not cite them. The documents may simply not list them yet; Part 2 will read the week-by-week plans. Essential Elements are left out because plans cite the main standard's code.", notInPlans, "None.") : ""}
      ${prOther.length ? sec("prother", `${prName(g)} for ${esc(gname(g))}, but placed in another grade`, `${esc(gname(g))}'s documents name these, but they are suggested for other grades, so ${esc(gname(g))} does not rate them. They may be review the grade's plans revisit; the committee can decide whether the placement or the priority list should change.`, prOther, "None.", false, false) : ""}
      ${sec("prall", `All ${prName(g).toLowerCase()} standards ${esc(gname(g))} rates`, "Every standard the documents name as a priority or power standard for this grade, with the team's rating, then the linked Essential Elements.", prMine.concat(prEE), "The documents name none for this grade and subject.", false, false)}</div>`;
  }
  // Before and after one grade: each of its standards with what it builds on in an earlier grade and what builds on it
  // in a later grade (close links in the progressions), each with its own rating. A not-taught neighbour is marked.
  function beforeAfter(g, list) {
    const rows = list.filter((e) => e.pl.includes(g) && !isEE(e.f));
    const nb = (e, dir) => { const k = e.f + "|" + e.c, out = new Map();
      for (const l of S.progLanes ? S.progLanes.get(k) || [] : []) for (const [a, b, sm] of l.links) if (sm >= MIN_SIM && (dir < 0 ? b === k : a === k)) { const x = S.byKey.get(dir < 0 ? a : b); if (x && !x.pl.includes(g)) out.set(x.f + "|" + x.c, [x, l]); }
      return [...out.values()]; };
    const cellOf = (pairs) => pairs.length ? pairs.slice(0, 3).map(([x, l]) => { const gx = x.pl[0], r = rating(x.f, x.c, gx);
      return `<span class="ba-n ${r && r.level === 0 ? "ba-not" : ""}">${codeHTML(x)} <span class="pill"><i class="lv ${r ? "lv-" + r.level : "lv-none"}"></i>${esc(gl(gx))}: ${r ? LEVEL_SHORT[r.level] : "Not rated"}</span> <small class="muted">${l.basis === "anchor" ? "official anchor" : "inferred"}</small></span>`; }).join("") + (pairs.length > 3 ? `<small class="muted">and ${pairs.length - 3} more</small>` : "")
      : `<span class="muted">No close match</span>`;
    let last = null, html = "";
    for (const e of rows) {
      if (e.f + e.s !== last) { html += `<tr class="strand-row"><td colspan="4">${badge(e.f)} ${esc(e.s || "")}</td></tr>`; last = e.f + e.s; }
      const r = rating(e.f, e.c, g), pre = nb(e, -1), post = nb(e, 1);
      html += `<tr><td>${codeHTML(e)}<div class="mks">${marks(e, g)}</div></td><td><span class="pill"><i class="lv ${r ? "lv-" + r.level : "lv-none"}"></i>${r ? LEVEL_SHORT[r.level] : "Not rated"}</span></td><td>${cellOf(pre)}</td><td>${cellOf(post)}</td></tr>`;
    }
    return `<div class="tbl-scroll"><table class="svs ba"><thead><tr><th>${esc(gname(g))} standard</th><th>${esc(gl(g))} says</th><th>Builds on (earlier grade)</th><th>Leads to (later grade)</th></tr></thead><tbody>${html || `<tr class="placeholder"><td colspan="4">No standards in view.</td></tr>`}</tbody></table></div>`;
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
          said === 0 && x ? "Plans include it, but the team marked it not taught. Worth a quick check." :
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
    el.innerHTML = `<div class="panel"><h2>Vertical Alignment Audit: ${esc(gname(g))} · ${esc(S.f.subject)} ${hb("plans")}</h2>
      <p class="lede">What the school's curriculum documents say about ${esc(gname(g))}, side by side with what the team said in Part 1. ${ready ? `Plans last read ${esc(S.evidence.built)} · ${S.evidence.sources.length} plan files.` : `The <span class="mk mk-pn">✓ In plans</span> and <span class="mk mk-pr">★ Priority / power</span> marks come from the Ma3loomat course documents (Grades 6-12) and the Curriculum Hub (K-5). The week-by-week reading of plans (Part 2) has not run yet.`}</p></div>
    ${docsPanel(list, g)}
    <div class="panel"><h2>Before and after ${esc(gname(g))} ${hb("p_ba")}</h2>
      <p class="lede">Each ${esc(S.f.subject)} standard suggested for ${esc(gname(g))}${S.f.strand ? " in " + esc(S.f.strand) : ""}, with the standard it builds on in an earlier grade and the one that builds on it in a later grade, each with that grade's rating. A pink outline marks a neighbour rated not taught. Links come from the Progressions page: official for ELA anchor standards, otherwise the closest match by wording (inferred).</p>
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
      <p class="stdtext">${esc(d.text || e.t)}</p>
      <p class="muted">Suggested for ${e.pl.map(gname).join(", ")}${e.sg ? " (a suggestion: teachers confirm the grade in Part 1)" : ""}${d.course ? " · " + esc(d.course) : ""}${d.cluster ? " · " + esc(d.cluster) : ""}</p>
      <div class="box"><h3>How each grade teaches it ${hb("d_strip")}</h3><div class="strip">${strip}</div>
        <p class="muted" style="margin:8px 0 0">${S.team ? (isCommittee() ? "The committee can change any grade's rating here; it asks first." : "Click your grade's square to change its rating.") : "Choose your team to rate."} Outline: suggested grade. Dot: taught outside the suggested grade. Orange corner: priority or power there. Bar underneath: in that grade's plans.</p></div>
      <div class="box checks"><h3>Why this standard is flagged ${hb("d_checks")}</h3>${checks.length ? `<ul class="issues">${checks.sort((a, b) => SEV.indexOf(a[2]) - SEV.indexOf(b[2])).map(([t, m, sv]) => `<li><span class="mk-flag sev-${sv || "info"}">${esc(t)}</span> <span class="muted">${esc(m)}</span></li>`).join("")}</ul>` : `<p class="muted">Nothing flagged: no automatic check finds a problem with the ratings so far.</p>`}<p class="muted" style="margin:4px 0 0"><span class="tag auto">Automatic checks</span> over the live ratings.</p></div>
      <div class="box" style="margin-top:14px"><h3>In the school's curriculum documents ${hb("d_marks")}</h3>
        <p class="mks">${e.pr ? e.pr.map((g) => `<span class="mk mk-pr">★ ${prName(g)} ${gl(g)}</span>`).join(" ") : ""} ${e.pn ? e.pn.map((g) => `<span class="mk mk-pn">✓ In ${gl(g)} plans</span>`).join(" ") : ""}</p>
        <p class="muted" style="margin:6px 0 0">${!e.pr && !e.pn ? "No grade's curriculum documents name this standard yet." : `${e.pn ? "Cited in the plans of " + e.pn.map(gname).join(", ") + ". " : ""}${e.pr ? "Named a priority (6-12) or power (K-5) standard for " + e.pr.map(gname).join(", ") + "." : ""}`}${e.pa ? ` ${e.pa.map(gname).join(", ")} ${e.pa.length > 1 ? "were" : "was"} given this standard to rate because ${e.pa.length > 1 ? "their" : "its"} plans cite it.` : ""}</p>
        <h3 style="margin-top:10px">Curriculum evidence (Part 2) ${hb("d_evidence")}</h3>${evidenceFor(e)}</div>
      <div class="box" style="margin-top:14px"><h3>Progression: what comes before and after ${hb("d_prog")}</h3>${progBox(e)}</div>
      ${d.descriptor_flag ? `<div class="flagbox">${hb("d_flag")} <b>Committee review:</b> ${esc(d.descriptor_flag)}. A suggested version is shown beside the school descriptor.</div>` : ""}
      <div class="grid2" style="margin-top:14px">
        <div class="box"><h3>"I can" levels ${hb("d_levels")} ${d.descriptor_source === "draft" ? '<span class="tag flag">draft</span>' : '<span class="tag">school</span>'}</h3>${lvl(desc)}</div>
        ${e.lk ? `<div class="box"><h3>Linked standards ${hb("d_ee")}</h3><p>This Essential Element is the alternate version of:</p><p>${e.lk.map(linkBtn).join(" ")}</p></div>` :
        `<div class="box"><h3>Essential Element ${eeItem ? `<span class="lk-b">${badge(eeFw)} ${codeHTML(eeItem)}</span>` : esc(e.ee || "")} ${hb("d_ee")}</h3><p>${esc(d.ee_text || "No Essential Element for this standard.")}</p>
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
    const list = S.view === "activity" ? null : filtered({ ignoreDivision: S.view === "rate" || S.view === "dashboard" });
    let rows;
    if (!list) rows = [["When", "Team", "Framework", "Code", "Grade", "From", "To", "Undone"], ...S.events.map((e) => [e.created_at, e.team, e.framework, e.code, e.grade, e.old_level == null ? "" : LEVEL[e.old_level], e.new_level == null ? "Removed" : LEVEL[e.new_level], e.undone])];
    else if (S.view === "ladder" && S.prog) {
      // Progressions: one line per step of each progression in view, with its counts and the checks on that row.
      const keys = new Set(filtered({ ignoreSearch: true }).map((e) => e.f + "|" + e.c));
      rows = [["Subject", "Progression", "Group", "Basis", "Status", "Grade(s)", "Codes", "In depth", "Introduced", "Not taught", "Not rated", "Automatic checks on this row"]];
      for (const l of S.prog.lanes.filter((x) => x.subject === S.f.subject)) {
        const x = laneInfo(l, gs, keys); if (!x.steps.length) continue;
        const checks = x.flags.map((f) => `${FLAG[f.t]}: ${f.msg}`).join(" | ");
        for (const st of x.steps) rows.push([S.f.subject, l.name, l.group, BASIS[l.basis], (STATUS[x.status] || [""])[0], st.g.join(" "), st.k.map((k) => codeText(S.byKey.get(k))).join(", "), st.s.deep, st.s.intro, st.s.not, st.s.n - st.s.rated, checks]);
      }
    }
    else rows = [["Subject", "Framework", "Code", "Other code", "Site code", "Strand", "Suggested grade(s)", "In plans (grades)", "Priority / power (grades)", "Standard", ...gs.map(gname), "Findings (automatic checks)"],
      ...ordered(S.view === "plans" ? auditGrid(S.f.grade) : list, S.view === "rate" ? teamGrade() : S.view === "dashboard" ? S.f.grade : "").map((e) => [S.f.subject, e.f, codeText(e), altText(e), e.c, e.s, e.pl.join(" "), (e.pn || []).join(" "), (e.pr || []).join(" "), e.t, ...gs.map((g) => { const r = rating(e.f, e.c, g); return r ? LEVEL[r.level] : ""; }), checksFor(e).map(([t]) => t).join("; ")])];
    download(`awsaj-${S.view}-${S.f.subject.replace(/\s/g, "")}.csv`, new Blob(["﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv" }));
  }
  // The image is the Audit's grid (the chosen grade's standards across K-12), the same rows as on the page.
  function exportPNG() {
    if (S.view !== "plans" || !S.f.grade) { toast("The image is the Vertical Alignment Audit grid: open that page and choose a grade."); return; }
    const gs = GRADES, list = ordered(auditGrid(S.f.grade), S.f.grade), cw = 26, ch = 16, gap = 2, left = 170, top = 70, pad = 20;
    const W = left + gs.length * (cw + gap) + pad, Hh = top + list.length * (ch + gap) + 50;
    if (list.length > 1500) { toast("Too many rows for one image. Narrow the filters first."); return; }
    const c = document.createElement("canvas"), dpr = 2; c.width = W * dpr; c.height = Hh * dpr;
    const x = c.getContext("2d"); x.scale(dpr, dpr); x.fillStyle = "#fff"; x.fillRect(0, 0, W, Hh);
    x.fillStyle = COLORS.maroon; x.fillRect(0, 0, W, 5);
    x.fillStyle = COLORS.ink; x.font = "600 16px Georgia"; x.fillText(`Awsaj Academy · ${gname(S.f.grade)} ${S.f.subject} standards across K-12`, pad, 30);
    x.font = "11px sans-serif"; x.fillStyle = "#4A5058"; x.fillText(new Date().toLocaleDateString(), pad, 48);
    gs.forEach((g, i) => x.fillText(gl(g), left + i * (cw + gap) + 6, top - 6));
    list.forEach((e, r) => {
      const y = top + r * (ch + gap);
      x.fillStyle = COLORS.ink; x.fillText(codeText(e).slice(0, 28), pad, y + 12);
      gs.forEach((g, i) => {
        const rt = rating(e.f, e.c, g), X = left + i * (cw + gap);
        x.fillStyle = rt ? COLORS[rt.level] : COLORS.none; x.strokeStyle = e.pl.includes(g) ? COLORS.placed : COLORS.line; x.lineWidth = e.pl.includes(g) ? 2 : 1;
        x.beginPath(); x.roundRect(X, y, cw, ch, 3); x.fill(); x.stroke();
      });
    });
    const ly = Hh - 26; [["Not rated", COLORS.none], ["Not taught", COLORS[0]], ["Introduced", COLORS[1]], ["In depth", COLORS[2]]].forEach(([l, col], i) => {
      x.fillStyle = col; x.strokeStyle = COLORS.line; x.fillRect(pad + i * 110, ly, 14, 14); x.strokeRect(pad + i * 110, ly, 14, 14); x.fillStyle = COLORS.ink; x.fillText(l, pad + i * 110 + 20, ly + 11);
    });
    c.toBlob((b) => download(`awsaj-heatmap-${S.f.subject.replace(/\s/g, "")}.png`, b));
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
    const h = "#" + p.toString();
    if (location.hash === h) return;
    if (S.hashReady) history.pushState(null, "", h); else history.replaceState(null, "", h);
    S.hashReady = true;
  }
  function applyHash() {
    const p = new URLSearchParams(location.hash.slice(1)), v = p.get("view");
    if (mode() !== "full" || !v || !$(`.tabs [data-view="${v}"]`)) return false;
    for (const k of HASH_KEYS) S.f[k] = p.get(k) || (k === "division" ? "all" : "");
    if (!S.meta.subjects.some((x) => x.name === S.f.subject)) S.f.subject = S.meta.subjects[0].name;
    if (!(S.f.division in DIV) && !(S.f.division in BAND)) S.f.division = "all";
    S.lane = p.get("lane") || null; S.pgStatus = p.get("check") || ""; S.backTo = null;
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
    else if (act === "more") { S.more[b.dataset.id] = true; S.open[b.dataset.id] = true; rerender(); }
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
    const c = ev.target.closest("[data-tip],[data-tip-text]"); if (!c) { tip.hidden = true; return; }
    if (c.dataset.tipText) tip.innerHTML = esc(c.dataset.tipText);
    else { const e = findItem(c.dataset.k), g = c.dataset.g, r = rating(e.f, e.c, g);
      tip.innerHTML = `<b>${esc(codeText(e))}</b> <i>${esc(altText(e))}</i> · ${esc(gname(g))}<br>${r ? LEVEL[r.level] + " · " + esc(r.team) : "Not rated"}${e.pl.includes(g) ? "<br>Suggested grade" : ""}${isPr(e, g) ? `<br>★ ${prName(g)} standard` : ""}${isPn(e, g) ? "<br>✓ In this grade's plans" : ""}<br><span style="opacity:.8">${esc(e.t.slice(0, 120))}…</span>`; }
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
    S.f.mark = ["", "pr", "pn", "npn"].includes(store.get("va_mark")) ? store.get("va_mark") : ""; S.f.order = ["", "pr", "pn"].includes(store.get("va_order")) ? store.get("va_order") : "";
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
    for (const s of S.meta.subjects) S.idx[s.slug] = S.idx[s.slug].filter((e) => !(e.f.startsWith("WI-EE-") && /^not applicable/i.test(e.t)));
    for (const s of S.meta.subjects) for (const e of S.idx[s.slug]) S.byKey.set(e.f + "|" + e.c, e);
    for (const s of S.meta.subjects) {
      const by = new Map();
      for (const e of S.idx[s.slug]) { const t = e.f + "|" + codeParts(e).main.join(" · "); (by.get(t) || by.set(t, []).get(t)).push(e); }
      for (const arr of by.values()) if (arr.length > 1) arr.forEach((e, i) => (e.part = [i + 1, arr.length]));
    }
    // Progression lanes (not needed for the first screen, so they load after it).
    fetch("data/progressions.json").then((r) => r.json()).then((d) => {
      S.prog = d; S.progLanes = new Map(); S.progPrev = new Map();
      for (const l of d.lanes) { for (const st of l.steps) for (const k of st.k) (S.progLanes.get(k) || S.progLanes.set(k, []).get(k)).push(l); for (const [a, b2] of l.links) (S.progPrev.get(b2) || S.progPrev.set(b2, []).get(b2)).push(a); }
      if (S.view === "ladder") rerender();
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

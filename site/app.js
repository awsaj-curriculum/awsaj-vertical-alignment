/* Awsaj K-12 Vertical Alignment: Part 1 (collaborative standards audit)
   Static site. Standards come from data/*.json; ratings, history and comments live in Supabase
   and are written only through logged database functions (set_rating, add_comment, undo_change, hide_comment, undo_my_rating). */
(() => {
  "use strict";
  const CFG = window.VA_CONFIG;
  const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  const DIV = { Elementary: ["K", "1", "2", "3", "4", "5"], Middle: ["6", "7", "8"], High: ["9", "10", "11", "12"] };
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
    meta: null, idx: {}, detail: {}, ratings: new Map(), events: [], comments: [], teams: [],
    team: null, teamSets: {}, view: "rate", explore: false, flow: { subject: null, skipped: new Set(), back: null, history: [] }, lastSync: null, device: null, pending: null,
    f: { subject: "Math", framework: "", division: "all", grade: "", strand: "", search: "" },
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
  async function rpc(fn, body) {
    const r = await fetch(`${CFG.supabaseUrl}/rest/v1/rpc/${fn}`, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) { let m = await r.text(); try { m = JSON.parse(m).message || m; } catch (e) { /* keep text */ } throw new Error(m); }
    return r.status === 204 ? null : r.json();
  }
  const rkey = (f, c, g) => `${f}|${c}|${g}`;
  function rating(f, c, g) { return S.ratings.get(rkey(f, c, g)); }

  async function loadRatings(full) {
    const q = !full && S.lastSync ? `ratings?select=*&updated_at=gt.${encodeURIComponent(S.lastSync)}` : "ratings?select=*";
    const rows = await getAll(q);
    if (full) S.ratings.clear();
    for (const r of rows) {
      S.ratings.set(rkey(r.framework, r.code, r.grade), r);
      if (!S.lastSync || r.updated_at > S.lastSync) S.lastSync = r.updated_at;
    }
    return rows.length;
  }
  async function loadEvents() { S.events = await getAll("rating_events?select=*&order=created_at.desc&limit=300"); }
  async function loadComments() { S.comments = await getAll("comments?select=*&order=created_at.desc"); }
  async function loadDetail(slug) {
    if (!S.detail[slug]) S.detail[slug] = await (await fetch(`data/detail_${slug}.json`)).json();
    return S.detail[slug];
  }

  /* ---------------- helpers over standards ---------------- */
  const subj = () => S.meta.subjects.find((s) => s.name === S.f.subject);
  const items = () => S.idx[subj().slug];
  const visibleGrades = () => (S.f.division === "all" ? GRADES : DIV[S.f.division]);
  function filtered({ ignoreDivision = false } = {}) {
    const q = mode() === "full" ? S.f.search.trim().toLowerCase() : "";
    const grades = visibleGrades();
    return items().filter((e) =>
      (!S.f.framework || e.f === S.f.framework) &&
      (!S.f.strand || e.s === S.f.strand) &&
      (ignoreDivision || S.f.division === "all" || e.pl.some((g) => grades.includes(g))) &&
      (!q || e.c.toLowerCase().includes(q) || e.t.toLowerCase().includes(q) || e.s.toLowerCase().includes(q)));
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
    const leftBefore = toRateLeft(g), strandBefore = strandLeft(e, g);
    S.ratings.set(k, { framework: e.f, code: e.c, grade: g, level, team: S.team.name, updated_at: new Date().toISOString() });
    S.flash = k; rerender(); S.flash = null;
    const leftAfter = toRateLeft(g), undo = [["Change answer", () => reviseAnswer(e, g)], ["Undo", () => undoRating(e, g, before)]];
    const finished = Object.keys(leftAfter).find((sb) => leftBefore[sb] > 0 && leftAfter[sb] === 0);
    const party = finished ? `Every ${finished} standard for ${gname(g)} is rated!` : strandBefore > 0 && strandLeft(e, g) === 0 ? `${e.s}: every standard rated` : "";
    try {
      await rpc("set_rating", { p_framework: e.f, p_code: e.c, p_grade: g, p_level: level, p_team: S.team.name, p_device: S.device });
      syncNote("Saved " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      if (party) celebrate(party, undo); else toast(`${e.c}, ${gname(g)}: ${LEVEL[level]}`, undo);
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
    const strands = sg ? [...new Set(items().filter((e) => (!S.f.framework || e.f === S.f.framework) && forGrade(e, sg)).map((e) => e.s).filter(Boolean))].sort() : [];
    if (S.f.strand && !strands.includes(S.f.strand)) S.f.strand = "";
    fillSelect(strandSel, sg ? [["", "All strands"], ...strands.map((s) => [s, s])] : [["", ""]], S.f.strand);
    strandSel.disabled = !sg;
    strandSel.title = sg ? "" : "Choose a grade first";
    $("#f-division").value = S.f.division;
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
    const v = S.view;
    if (v === "flow") renderFlow(); else if (v === "rate") renderRate(); else if (v === "heatmap") renderHeatmap(); else if (v === "gaps") renderGaps();
    else if (v === "dashboard") renderDashboard(); else if (v === "ladder") renderLadder(); else if (v === "plans") renderPlans(); else renderActivity();
  }

  function segFor(e, g) {
    const r = rating(e.f, e.c, g);
    return `<div class="seg" role="group" aria-label="Rating for ${esc(e.c)} in ${esc(gname(g))}">` +
      [0, 1, 2].map((l) => `<button data-act="rate" data-k="${esc(e.f + "|" + e.c)}" data-g="${g}" data-l="${l}" aria-pressed="${r && r.level === l}">${LEVEL_SHORT[l]}</button>`).join("") + `</div>`;
  }
  function stdRow(e, g, note) {
    const r = rating(e.f, e.c, g);
    const tags = [];
    tags.push(badge(e.f));
    if (e.lk && e.lk.length) tags.push(`<span class="tag">Linked to ${esc(e.lk[0].split(":")[1])}${e.lk.length > 1 ? " +" + (e.lk.length - 1) : ""}</span>`);
    if (e.ee) { const ee = e.ee.split(";")[0].trim(); tags.push(`<span class="tag">${/^(M\.)?EE/.test(ee) || ee.startsWith("SS.EE") ? "" : "EE "}${esc(ee)}</span>`); }
    if (note) tags.push(`<span class="tag sg">${esc(note)}</span>`);
    const k = rkey(e.f, e.c, g);
    return `<div class="std set-${SET(e.f).style} ${r ? "rated l" + r.level : ""} ${S.flash === k ? "flash" : ""}"><div><button class="code" data-act="open" data-k="${esc(e.f + "|" + e.c)}">${esc(e.c)}</button></div>
      <div><div class="txt">${esc(e.t)}${e.t.length >= 220 ? "…" : ""}</div><div class="tags">${tags.join("")}</div></div>
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
  // listed in two frameworks is not counted twice. Social Studies is Wisconsin (with EEs) in every grade;
  // Science is NGSS in every grade (teams can still choose AERO).
  function countFramework(subject, g) {
    if (subject === "Science") return "NGSS";
    if (subject === "Social Studies") return "WI-SS";
    return subject === "Math" ? "WI-CC-MATH" : subject === "ELA" ? "WI-CC-ELA" : null;
  }
  // The team that rates a subject in grade g, and the standard sets it chose (saved for the whole team in team_sets).
  // Until a team chooses, it works through the default set above.
  const teamOf = (g, subject) => S.teams.find((t) => t.name !== "Vertical Alignment Committee" && t.grades.includes(g) && t.subjects.includes(subject));
  function setsFor(subject, g, team) {
    const t = team || teamOf(g, subject), saved = t && S.teamSets[t.name] && S.teamSets[t.name][subject];
    const fws = S.meta.subjects.find((x) => x.name === subject).frameworks;
    const list = (saved && saved.filter((f) => fws.includes(f)).length ? saved.filter((f) => fws.includes(f)) : [countFramework(subject, g)]).filter(Boolean);
    return list.sort((a, b) => SET_ORDER(a) - SET_ORDER(b));
  }
  const chosen = (subject, team) => !!(team && S.teamSets[team.name] && S.teamSets[team.name][subject]);
  async function loadTeamSets() {
    const rows = await getAll("team_sets?select=*"); S.teamSets = {};
    for (const r of rows) (S.teamSets[r.team] ||= {})[r.subject] = r.frameworks;
    S.setsLoaded = true;
  }
  const defaultFramework = (subject, g) => (subject === "Math" || subject === "ELA" ? "" : countFramework(subject, g) || "");
  // Unrated grade-level standards per subject (counted framework only), and unrated standards left in e's strand.
  function toRateLeft(g) {
    const out = {};
    for (const s of S.meta.subjects) { const fws = setsFor(s.name, g); out[s.name] = S.idx[s.slug].filter((e) => e.pl.includes(g) && fws.includes(e.f) && !rating(e.f, e.c, g)).length; }
    return out;
  }
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
      <p class="lede">You will see your grade's standards one at a time. For each one, say how it is really taught this year. It saves as you go, and this device remembers your team.</p></div>
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
    const pct = list.length ? (done / list.length) * 100 : 100;
    const setPills = `<div class="set-pills"><span class="muted">Standards:</span> ${fwsNow.map((f) => { const l = flowList(F.subject, g, f), n = l.filter((e) => !rating(e.f, e.c, g)).length;
        return `<button type="button" class="setp ${F.set === f ? "on" : ""} ${n ? "" : "done"}" data-act="flow-set" data-f="${esc(f)}" title="${esc(FW_NAME[f] || f)}">${badge(f)} ${esc(SET(f).name)} <span>${n ? n + " left" : "✓"}</span></button>`; }).join("")}
      <button type="button" class="linkish" data-act="sets-change">Change ${hb("sets")}</button></div>`;
    const head = `<div class="flow-head">${pills}${setPills}
      <div class="flow-progress"><div class="fp-bar"><i style="width:${pct}%"></i></div>
      <span><b>${done}</b> of ${list.length} rated · <b>${left}</b> left ${hb("flow")}</span></div></div>`;
    const e = flowCurrent(F.set ? flowList(F.subject, g, F.set) : list, g) || flowCurrent(list, g);
    let body;
    if (!e) {
      const next = subs.find((s) => flowList(s, g).some((x) => !rating(x.f, x.c, g)));
      const all = !next && subs.length > 1;
      const total = subs.reduce((n, s) => n + flowList(s, g).length, 0);
      body = `<div class="card done-card"><div class="big-tick">✓</div><h2>${all ? `${esc(gname(g))} is done` : `${esc(F.subject)} is done`}</h2>
        <p class="lede">${all ? `All ${total} standards in ${subs.map(esc).join(", ")} are rated. The committee can now see your grade on the map. Thank you.` : `All ${list.length} ${esc(F.subject)} standards for ${esc(gname(g))} are rated. Thank you.`}</p>
        <div class="done-actions">${next ? `<button type="button" data-act="flow-subject" data-s="${esc(next)}">Next: ${esc(next)} →</button>` : `<button type="button" data-act="explore">See your grade on the K-12 map</button>`}
        <button type="button" class="ghost" data-act="review">Review my answers</button></div></div>`;
    } else {
      const k = rkey(e.f, e.c, g), r = rating(e.f, e.c, g), inSet = list.filter((x) => x.f === e.f), pos = inSet.indexOf(e) + 1, sx = SET(e.f);
      const newSet = F.lastSet && F.lastSet !== e.f; F.lastSet = e.f;
      const links = (e.lk || []).map((x) => x.split(":")[1]);
      const ee = e.ee ? e.ee.split(";")[0].trim() : "";
      const fresh = S.flow.lastKey !== k; S.flow.lastKey = k;
      body = `${newSet && fresh ? `<div class="set-switch">${badge(e.f)} Now: <b>${esc(FW_NAME[e.f] || sx.name)}</b> (${inSet.length} standards)</div>` : ""}<article class="card std-card set-${sx.style} ${fresh ? "enter" : ""}" data-k="${esc(k)}">
        <div class="card-top"><span class="eyebrow">${badge(e.f)} ${esc(sx.name)} · ${esc(e.s || F.subject)}</span><span class="muted">${pos} of ${inSet.length}</span></div>
        <h2 class="card-code"><button class="code" data-act="open" data-k="${esc(e.f + "|" + e.c)}" title="Open the full standard">${esc(e.c)}</button></h2>
        <p class="card-text">${esc(fullText(e))}</p>
        <p class="card-meta">${links.length ? `Linked to ${links.slice(0, 3).map(esc).join(", ")}${links.length > 3 ? " and " + (links.length - 3) + " more" : ""} · ` : ee ? `Essential Element ${esc(ee)} · ` : ""}<button type="button" class="linkish" data-act="open" data-k="${esc(e.f + "|" + e.c)}">Full standard and "I can" levels</button>${e.sg ? ` · <span class="tag sg">Suggested placement</span>` : ""}</p>
        <p class="card-q">${r ? `Your answer: <b>${LEVEL[r.level]}</b>. Choose another answer to switch it${S.canClear ? `, or <button type="button" class="linkish" data-act="clear" data-k="${esc(e.f + "|" + e.c)}">remove it</button>` : ""}.` : `How is this taught in ${esc(gname(g))} this year?`}</p>
        <div class="choices">${[0, 1, 2].map((l) => `<button type="button" class="choice c${l} ${r && r.level === l ? "on" : ""}" data-act="flow-rate" data-k="${esc(e.f + "|" + e.c)}" data-l="${l}">
          <kbd>${l + 1}</kbd><b>${["Not taught", "Introduced", "Taught in depth"][l]}</b><small>${["We do not teach this", "Touched on, not a main focus", "Taught, practised and assessed"][l]}</small></button>`).join("")}</div>
        <div class="card-foot">
          <button type="button" class="linkish" data-act="flow-back" ${F.history.length ? "" : "disabled"}>← Previous</button>
          <span class="muted keys">Keys: 1, 2, 3 to answer · S to skip ${hb("flow_keys")}</span>
          <button type="button" class="linkish" data-act="flow-skip">Skip for now →</button></div>
      </article>`;
    }
    el.innerHTML = `<div class="flow-wrap">${head}${body}
      ${library(list, g)}
      <p class="flow-more"><button type="button" class="linkish" data-act="review">See the whole list</button> ${hb("review")}</p></div>`;
  }
  // The library: every standard in this subject's chosen sets, split into "Still to do" and "Done". Click one to open it.
  function library(list, g) {
    const todo = list.filter((e) => !rating(e.f, e.c, g)), done = list.filter((e) => rating(e.f, e.c, g)), tab = S.flow.lib || "";
    const item = (e) => { const r = rating(e.f, e.c, g); return `<li><button type="button" class="lib-i" data-act="lib-open" data-k="${esc(e.f + "|" + e.c)}">${badge(e.f)} <b>${esc(e.c)}</b> <span>${esc(e.t.slice(0, 90))}${e.t.length > 90 ? "…" : ""}</span>${r ? `<i class="pill"><i class="lv lv-${r.level}"></i>${LEVEL_SHORT[r.level]}</i>` : ""}</button></li>`; };
    return `<div class="library"><div class="lib-tabs">
        <button type="button" class="lib-t ${tab === "todo" ? "on" : ""}" data-act="lib" data-t="todo">Still to do <span>${todo.length}</span></button>
        <button type="button" class="lib-t ${tab === "done" ? "on" : ""}" data-act="lib" data-t="done">Done <span>${done.length}</span></button> ${hb("library")}</div>
      ${tab ? `<ul class="lib-list">${(tab === "todo" ? todo : done).map(item).join("") || `<li class="muted">${tab === "todo" ? "Nothing left. Well done." : "Nothing answered yet."}</li>`}</ul>` : ""}</div>`;
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
    const placed = all.filter((e) => e.pl.includes(g));
    const band = all.filter((e) => !e.pl.includes(g) && e.sg && e.div.includes(divOf(g)));
    const committee = S.team.name === "Vertical Alignment Committee";
    el.innerHTML = (mode() === "teacher" ? `<div class="flow-wrap wide"><p><button type="button" class="ghost" data-act="back-to-flow">← Back to one at a time</button></p></div>` : "") + `<div class="panel">
      <div class="rate-head"><div><h2>${esc(S.f.subject)} · ${esc(gname(g))} ${hb("rate")}</h2>
      <p class="lede">For each standard, choose how it is taught in ${esc(gname(g))} this year. Use what is really taught, even if the plans do not show it yet.</p></div>
      <div class="ring-box">${(() => { const lst = placed.concat(band.filter((e) => rating(e.f, e.c, g))), c = countLevels(lst, g); return donut(c) +
        `<div class="ring-key"><b>${lst.length - c[3]} of ${lst.length}</b> rated<br><span><i class="lv lv-2"></i>${c[2]} in depth</span><span><i class="lv lv-1"></i>${c[1]} introduced</span><span><i class="lv lv-0"></i>${c[0]} not taught</span></div>`; })()}${hb("progress")}</div></div>
      ${toRateStrip(g)}
      ${committee ? `<p class="muted">Committee view: pick a grade with the Grade filter above.</p>` : ""}
      <div class="group-title"><h3>Standards suggested for ${esc(gname(g))} (${placed.length}) ${hb("rate_placed")}</h3></div>
      ${placed.length ? groupByStrand(placed, g, (e) => (e.sg ? "Suggested placement" : "")) : `<div class="empty">No standards match these filters.</div>`}
      ${band.length ? `<div class="group-title"><h3>Other ${esc(divOf(g).toLowerCase())} school standards (${band.length}) ${hb("rate_band")}</h3>
        <span class="muted">Placement of these is a suggestion. Mark any that ${esc(gname(g))} actually teaches.</span></div>
        ${groupByStrand(band, g, (e) => "Suggested for " + e.pl.map(gname).join(", "))}` : ""}
    </div>`;
  }

  // Part 1 coverage map: strands down the side, grades across. Each tile summarises how that grade rated the
  // standards suggested for it in that strand (bottom-up: in depth, introduced, not taught, grey = not rated yet).
  function renderHeatmap() {
    const el = $("#view-heatmap"), gs = visibleGrades(), list = filtered();
    if (!list.length) { el.innerHTML = `<div class="panel empty">No standards match these filters.</div>`; return; }
    const multi = subj().frameworks.length > 1;
    const rowsKey = [...new Set(list.map((e) => (multi ? e.f + "\u0001" : "") + (e.s || "Standards")))];
    let done = 0, total = 0;
    const tile = (inS, g, strandName) => {
      const mine = inS.filter((e) => e.pl.includes(g));
      const extra = inS.filter((e) => !e.pl.includes(g) && (rating(e.f, e.c, g)?.level || 0) > 0).length;
      if (!mine.length) return `<td class="cm-td" data-gi="${g}">${extra ? `<span class="cm-none cm-extra" data-tip-text="${esc(gname(g))} also teaches ${extra} ${esc(strandName)} standard${extra > 1 ? "s" : ""} suggested for other grades.">+${extra}</span>` : `<span class="cm-none"></span>`}</td>`;
      const c = countLevels(mine, g), n = mine.length; total += n; done += n - c[3];
      const h = (i) => (c[i] / n) * 100;
      return `<td class="cm-td" data-gi="${g}"><button type="button" class="cm-tile ${c[3] ? "" : "full"}" data-act="cm-open" data-g="${g}" data-s="${esc(strandName)}"
        data-tip-text="${esc(gname(g))} · ${esc(strandName)}: ${n} standard${n > 1 ? "s" : ""}. ${c[2]} in depth, ${c[1]} introduced, ${c[0]} not taught${c[3] ? ", " + c[3] + " not rated yet" : ""}.${extra ? " Also teaches " + extra + " from other grades." : ""} Click to see the strand across grades.">
        <span class="cm-fill"><i style="height:${h(2)}%;background:${COLORS[2]}"></i><i style="height:${h(1)}%;background:${COLORS[1]}"></i><i style="height:${h(0)}%;background:${COLORS[0]}"></i></span>
        <span class="cm-n">${n}</span>${extra ? `<span class="cm-plus">+${extra}</span>` : ""}</button></td>`;
    };
    const body = rowsKey.map((key) => {
      const [fw, sname] = multi ? key.split("\u0001") : [null, key];
      const inS = list.filter((e) => (e.s || "Standards") === sname && (!fw || e.f === fw));
      const cells = gs.map((g) => tile(inS, g, sname)).join("");
      return `<tr class="${multi ? "set-" + SET(fw).style : ""}"><th class="cm-row" scope="row"><span>${multi ? badge(fw) + " " : ""}${esc(sname)}</span>${multi ? `<small>${esc(FW_NAME[fw] || fw)}</small>` : ""}</th>${cells}</tr>`;
    }).join("");
    const head = gs.map((g) => {
      const mine = list.filter((e) => e.pl.includes(g)), c = countLevels(mine, g), pct = mine.length ? Math.round(((mine.length - c[3]) / mine.length) * 100) : 0;
      return `<th data-gi="${g}" class="${S.f.grade === g ? "sel" : ""}"><button type="button" class="colh" data-act="grade" data-g="${g}" data-tip-text="${esc(gname(g))}: ${mine.length - c[3]} of ${mine.length} suggested standards rated. Click to choose this grade.">${gl(g)}<small>${mine.length ? pct + "%" : ""}</small></button></th>`;
    }).join("");
    el.innerHTML = `<div class="panel"><h2>${esc(S.f.subject)} coverage map, ${S.f.division === "all" ? "K-12" : esc(S.f.division) + " school"} ${hb("heatmap")}</h2>
      <p class="lede">Each tile is one grade and one strand. The number is how many standards that grade has in the strand; the colour fills up as the team rates them: lime in depth, blue introduced, magenta not taught, grey not rated yet. <b>${done} of ${total}</b> rated so far. Click a tile to follow the strand across grades.</p></div>
      <div class="cm-wrap"><table class="cm"><thead><tr><th class="cm-row">Strand ${hb("hm_cols")}</th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  // Standard by standard across K-12 (used by the Vertical Alignment Audit). Colour = what each grade said in Part 1;
  // a blue ring marks a grade whose plans include the standard (Part 2).
  function standardGrid(list, gs) {
    let rows = "", last = null;
    for (const e of list) {
      const head = (subj().frameworks.length > 1 ? (FW_NAME[e.f] || e.f) + " · " : "") + (e.s || "");
      if (head !== last) { rows += `<tr class="strand-row"><td colspan="${gs.length + 1}">${badge(e.f)} ${esc(head)}</td></tr>`; last = head; }
      rows += `<tr><td class="rowh"><button class="code" data-act="open" data-k="${esc(e.f + "|" + e.c)}" title="${esc(e.t)}">${esc(e.c)}</button></td>` +
        gs.map((g) => {
          const r = rating(e.f, e.c, g), placed = e.pl.includes(g), inPlan = !!ev(e.f, e.c, g);
          const cls = ["cell", r ? "l" + r.level : "", placed ? "placed" : "", r && r.level > 0 && !placed ? "off" : "", inPlan ? "inplan" : ""].join(" ");
          return `<td data-gi="${g}"><button class="${cls}" data-act="open" data-k="${esc(e.f + "|" + e.c)}" data-g="${g}" data-tip="1"
            aria-label="${esc(e.c)}, ${esc(gname(g))}: ${r ? LEVEL[r.level] : "not rated"}${placed ? ", suggested grade" : ""}${inPlan ? ", in plans" : ""}"></button></td>`;
        }).join("") + `</tr>`;
    }
    return `<div class="hm-wrap"><table class="hm" data-sel="${esc(S.f.grade)}"><thead><tr><th class="rowh">Standard</th>${gs.map((g) => `<th data-gi="${g}" class="${S.f.grade === g ? "sel" : ""}"><span class="colh">${gl(g)}</span></th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function analyse(list) {
    const out = { noDepth: [], unrated: [], placedNot: [], repeat: [], elsewhere: [] };
    for (const e of list) {
      const lv = levelsAcross(e);
      if (!lv.length) { out.unrated.push(e); continue; }
      if (!lv.some((x) => x.r.level === 2)) out.noDepth.push(e);
      const deep = lv.filter((x) => x.r.level === 2);
      if (deep.length >= 2) out.repeat.push({ e, gs: deep.map((x) => x.g) });
      for (const x of lv) {
        if (e.pl.includes(x.g) && x.r.level === 0) out.placedNot.push({ e, g: x.g });
        if (!e.pl.includes(x.g) && x.r.level > 0) out.elsewhere.push({ e, g: x.g, l: x.r.level });
      }
    }
    return out;
  }
  function li(e, extra) { return `<li>${badge(e.f)} <button class="code" data-act="open" data-k="${esc(e.f + "|" + e.c)}">${esc(e.c)}</button> ${extra || ""} <span class="muted">${esc(e.t.slice(0, 90))}${e.t.length > 90 ? "…" : ""}</span></li>`; }
  function renderGaps() {
    const el = $("#view-gaps"), list = filtered(), a = analyse(list), n = list.length;
    const pct = (x) => (n ? Math.round((x / n) * 100) : 0);
    const sec = (title, desc, arr, fn, open) => `<details class="gap" ${open ? "open" : ""}><summary><span class="count">${arr.length}</span>${title}</summary>
      <p class="muted">${desc}</p><ul class="gap-list">${arr.slice(0, 400).map(fn).join("") || "<li class='muted'>None.</li>"}</ul></details>`;
    el.innerHTML = `<div class="panel"><h2>Gaps and repetition: ${esc(S.f.subject)}${S.f.division === "all" ? "" : ", " + esc(S.f.division) + " school"} ${hb("gaps")}</h2>
      <div class="summary"><p>${hb("summary")} ${n} standards in view. ${n - a.unrated.length} (${pct(n - a.unrated.length)}%) have been rated by at least one grade.</p>
      <p>${a.noDepth.length} rated standards are not yet taught in depth in any grade${a.noDepth.length ? ", which makes them the clearest gaps" : ""}.
      ${a.repeat.length} are taught in depth in two or more grades: check that each grade builds on the one before rather than repeating it.</p>
      <p>${a.elsewhere.length} reports come from a grade other than the suggested one. These are the standards the committee may want to move.</p></div>
      ${sec("Not yet taught in depth anywhere", "Rated, but no grade reports teaching it in depth.", a.noDepth, (e) => li(e, `<span class="tag">${e.pl.map(gl).join(", ")}</span>`), true)}
      ${sec("Marked “not taught” in the suggested grade", "The grade the standard is suggested for says it is not taught there.", a.placedNot, (x) => li(x.e, `<span class="tag">${gl(x.g)}</span>`))}
      ${sec("Taught in a different grade", "A grade reports teaching a standard that is suggested for another grade.", a.elsewhere, (x) => li(x.e, `<span class="tag sg">${gl(x.g)} · ${LEVEL_SHORT[x.l]} (suggested ${x.e.pl.map(gl).join(", ")})</span>`), true)}
      ${sec("Taught in depth in more than one grade", "Possible repetition. Make sure the expectation rises each year.", a.repeat, (x) => li(x.e, `<span class="tag">${x.gs.map(gl).join(", ")}</span>`))}
      ${sec("Not rated yet", "No grade has rated these standards.", a.unrated, (e) => li(e, `<span class="tag">${e.pl.map(gl).join(", ")}</span>`))}
    </div>`;
  }

  function renderDashboard() {
    const el = $("#view-dashboard"), g = S.f.grade;
    if (!g) return pickGrade(el, "its dashboard");
    const list = filtered({ ignoreDivision: true }).filter((e) => e.pl.includes(g));
    const counts = (arr) => { const c = [0, 0, 0, 0]; arr.forEach((e) => { const r = rating(e.f, e.c, g); c[r ? r.level : 3]++; }); return c; };
    const tot = counts(list), n = list.length || 1;
    const byStrand = {};
    list.forEach((e) => (byStrand[e.s || "Other"] ||= []).push(e));
    const strands = Object.entries(byStrand).map(([s, arr]) => ({ s, arr, c: counts(arr) }));
    strands.forEach((x) => (x.score = (x.c[2] + 0.5 * x.c[1]) / (x.arr.length - x.c[3] || 1)));
    const ratedStrands = strands.filter((x) => x.arr.length - x.c[3] > 0).sort((a, b) => b.score - a.score);
    const extra = filtered({ ignoreDivision: true }).filter((e) => !e.pl.includes(g) && (rating(e.f, e.c, g)?.level || 0) > 0);
    const bars = strands.map((x) => {
      const w = (i) => (x.c[i] / x.arr.length) * 100;
      return `<button type="button" class="sb-name" data-act="strand" data-s="${esc(x.s)}" title="Rate this strand">${esc(x.s)}</button><div class="sb" role="img" aria-label="${esc(x.s)}: ${x.c[2]} in depth, ${x.c[1]} introduced, ${x.c[0]} not taught, ${x.c[3]} not rated">
        ${[[2, COLORS[2]], [1, COLORS[1]], [0, COLORS[0]], [3, "#F2F4F6"]].map(([i, col]) => (x.c[i] ? `<i style="width:${w(i)}%;background:${col}" data-tip-text="${esc(x.s)}: ${x.c[i]} ${i === 3 ? "not rated" : LEVEL[i].toLowerCase()}"></i>` : "")).join("")}</div>
        <div class="num">${x.c[2]}/${x.arr.length}</div>`;
    }).join("");
    const strong = ratedStrands[0], weak = ratedStrands[ratedStrands.length - 1];
    el.innerHTML = `<div class="panel"><h2>${esc(gname(g))} · ${esc(S.f.subject)} ${hb("dashboard")}</h2>
      <div class="tiles">
        <div class="tile"><div class="n">${list.length}</div><div class="l">standards suggested for this grade ${hb("t_total")}</div></div>
        <div class="tile ring-tile">${donut(tot, 64)}<div class="l">rated so far ${hb("t_rated")}</div></div>
        <div class="tile t2"><div class="n">${tot[2]}</div><div class="l">taught in depth ${hb("t_depth")}</div></div>
        <div class="tile t1"><div class="n">${tot[1]}</div><div class="l">introduced or exposed ${hb("t_intro")}</div></div>
        <div class="tile t0"><div class="n">${tot[0]}</div><div class="l">not taught ${hb("t_not")}</div></div>
        <div class="tile"><div class="n">${extra.length}</div><div class="l">taught here but suggested for another grade ${hb("t_extra")}</div></div>
      </div>
      <div class="summary">${hb("summary")}${list.length - tot[3] === 0 ? `<p>No ratings yet for ${esc(gname(g))}. Once the team rates its standards, this summary fills in.</p>` :
        `<p>${esc(gname(g))} has rated ${list.length - tot[3]} of ${list.length} ${esc(S.f.subject)} standards. ${tot[2]} ${tot[2] === 1 ? "is" : "are"} taught in depth and ${tot[1]} ${tot[1] === 1 ? "is" : "are"} introduced; ${tot[0]} ${tot[0] === 1 ? "is" : "are"} not taught this year.</p>
        ${strong && weak && strong !== weak ? `<p>Strongest coverage: <b>${esc(strong.s)}</b>. Most room to grow: <b>${esc(weak.s)}</b>.</p>` : ""}
        ${extra.length ? `<p>The team also teaches ${extra.length} standard${extra.length > 1 ? "s" : ""} suggested for other grades (see Gaps &amp; repetition).</p>` : ""}`}</div>
      <h3>Coverage by strand ${hb("strandbars")}</h3><div class="strand-bars" id="dash-bars">${bars || "<div class='muted'>No standards.</div>"}</div></div>`;
  }

  function renderLadder() {
    const el = $("#view-ladder"), gs = visibleGrades();
    const g0 = S.f.grade;
    if (!g0) return pickGrade(el, "a progression");
    const inG = filtered().filter((e) => forGrade(e, g0));
    const strand = S.f.strand || (inG[0] && inG[0].s);
    if (!strand) { el.innerHTML = `<div class="panel empty">No standards match these filters.</div>`; return; }
    const list = filtered().filter((e) => e.s === strand);
    const rungs = gs.map((g) => {
      const here = list.filter((e) => e.pl.includes(g));
      const moved = list.filter((e) => !e.pl.includes(g) && (rating(e.f, e.c, g)?.level || 0) > 0);
      const chip = (e, m) => { const r = rating(e.f, e.c, g); return `<button class="chip ${r ? "l" + r.level : ""}" data-act="open" data-k="${esc(e.f + "|" + e.c)}" style="${m ? "border-style:dashed" : ""}">${badge(e.f)} ${esc(e.c)}<small>${esc(e.t.slice(0, 60))}${e.t.length > 60 ? "…" : ""}</small></button>`; };
      const c = countLevels(here, g);
      return `<div class="rung div-${divOf(g)} ${g === g0 ? "sel" : ""}"><h4>${esc(gname(g))} <span class="muted">(${here.length})</span></h4>${here.length ? miniBar(c, `${here.length - c[3]} of ${here.length} rated`) : ""}${here.map((e) => chip(e)).join("")}${moved.length ? `<div class="muted" style="font-size:11px;margin:6px 0 4px">Also taught here</div>${moved.map((e) => chip(e, true)).join("")}` : ""}</div>`;
    }).join("");
    el.innerHTML = `<div class="panel"><h2>Progression: ${esc(strand || "")} ${hb("ladder")}</h2>
      <p class="lede">How one strand builds from grade to grade. Colour shows how each grade rates the standard. Pick another strand with the Strand filter.</p></div>
      <div class="ladder">${rungs}</div>`;
  }

  function renderActivity() {
    const el = $("#view-activity");
    const rows = S.events.slice(0, 200).map((ev) => `<tr class="${ev.undone ? "undone" : ""}"><td>${new Date(ev.created_at).toLocaleString()}</td><td>${esc(ev.team)}</td>
      <td>${badge(ev.framework)} <button class="code" data-act="open" data-k="${esc(ev.framework + "|" + ev.code)}">${esc(ev.code)}</button></td><td>${gl(ev.grade)}</td>
      <td>${ev.old_level == null ? "Not rated" : LEVEL_SHORT[ev.old_level]} → ${ev.new_level == null ? "Removed" : LEVEL_SHORT[ev.new_level]}</td>
      <td>${ev.undone ? "Undone" : `<button class="ghost" data-act="undo" data-id="${ev.id}">Undo</button>`}</td></tr>`).join("");
    const crow = S.comments.slice(0, 50).map((c) => `<tr><td>${new Date(c.created_at).toLocaleString()}</td><td>${esc(c.team)}${c.author ? " · " + esc(c.author) : ""}</td>
      <td><button class="code" data-act="open" data-k="${esc(c.framework + "|" + c.code)}">${esc(c.code)}</button></td><td colspan="2">${esc(c.body)}</td>
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
        svsRows += `<tr><td><button class="code" data-act="open" data-k="${esc(e.f + "|" + e.c)}">${esc(e.c)}</button></td>
          <td>${said == null ? pill(null, "Not rated") : pill(said, LEVEL_SHORT[said])}</td><td>${x ? pill(x.level, LEVEL_SHORT[x.level] + " · " + x.weeks + " wk") : pill(null, "Not in plans")}</td><td>${note}</td></tr>`;
      }
      off = Object.entries(S.evidence.items).filter(([k]) => k.endsWith("|" + g)).map(([k, x]) => { const [f, c] = k.split("|"); return { e: findItem(f + "|" + c), x }; })
        .filter((o) => o.e && !o.e.pl.includes(g) && o.e.f && (!S.f.framework || o.e.f === S.f.framework) && list.includes(o.e));
    }
    const empty = (cols, msg) => `<tr class="placeholder"><td colspan="${cols}">${msg}</td></tr>`;
    el.innerHTML = `<div class="panel"><h2>Vertical Alignment Audit: ${esc(gname(g))} · ${esc(S.f.subject)} ${hb("plans")}</h2>
      <p class="lede">What the curriculum plans show, side by side with what teams said in Part 1.</p>
      ${ready ? `<p class="muted">Plans last read ${esc(S.evidence.built)} · ${S.evidence.sources.length} plan files.</p>` :
      `<div class="notice"><b>Part 2 has not run yet.</b> This page shows what it will report. When the plans are read, every section below fills in, and each standard's popup shows the plans and weeks where it appears.</div>`}
      <h3>How Part 2 works</h3>
      <ol class="steps">
        <li><b>Read the plans ${hb("p_sources")}</b>2026-27 unit and weekly plans for every grade, with 2025-26 filling weeks not planned yet.</li>
        <li><b>Find the standards ${hb("p_match")}</b>Codes named in a plan are <i>cited</i>; content without a code is matched by AI and labelled <i>inferred</i>.</li>
        <li><b>Count the weeks ${hb("p_rule")}</b>1-2 weeks = Introduced; 3 or more = Taught in depth.</li>
        <li><b>Compare with Part 1 ${hb("p_svs")}</b>Where plans and ratings differ, the page says so gently, because plans do not always record everything taught.</li>
      </ol></div>
    <div class="panel"><h2>Says vs shows ${hb("p_svs")}</h2><p class="lede">Standards where the team's rating and the plans differ for ${esc(gname(g))}.</p>
      <table class="svs"><thead><tr><th>Standard</th><th>Team says (Part 1)</th><th>Plans show (Part 2)</th><th>Note</th></tr></thead>
      <tbody>${ready ? svsRows || empty(4, "No differences in this view.") : empty(4, "Fills in when Part 2 runs.")}</tbody></table></div>
    <div class="panel"><h2>Below and above grade in the plans ${hb("p_offgrade")}</h2><p class="lede">Standards from other grades that appear in ${esc(gname(g))}'s plans.</p>
      <table class="svs"><thead><tr><th>Standard</th><th>Suggested grade</th><th>Weeks in ${esc(gname(g))} plans</th><th>Below or above</th></tr></thead>
      <tbody>${ready ? off.map(({ e, x }) => `<tr><td><button class="code" data-act="open" data-k="${esc(e.f + "|" + e.c)}">${esc(e.c)}</button></td><td>${e.pl.map(gl).join(", ")}</td><td>${x.weeks} (${x.match})</td>
        <td>${GRADES.indexOf(e.pl[0]) < GRADES.indexOf(g) ? "Below grade (review or remediation)" : "Above grade (extension)"}</td></tr>`).join("") || empty(4, "None found.") : empty(4, "Fills in when Part 2 runs.")}</tbody></table></div>
    <div class="panel"><h2>Each standard across K-12 ${hb("p_heat")}</h2>
      <p class="lede">One row per ${esc(S.f.subject)} standard${S.f.strand ? " in " + esc(S.f.strand) : ""}. Colour is what each grade said in Part 1; a <span class="ring-key"></span> ring marks a grade whose plans include it${ready ? "" : " (rings appear when the audit runs)"}. This is where repetition and gaps between grades show up.</p>
      ${standardGrid(filtered(), visibleGrades())}</div>
    <div class="panel"><h2>Plan sources ${hb("p_sources")}</h2>
      <table class="svs"><thead><tr><th>Plan</th><th>Year</th><th>Grade</th><th>Type</th><th>Notes</th></tr></thead>
      <tbody>${ready ? S.evidence.sources.filter((s) => s.grade === g).map((s) => `<tr><td><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></td><td>${esc(s.year)}</td><td>${esc(gname(s.grade))}</td><td>${esc(s.kind)}</td><td>${s.carried_forward ? "Copied forward from last year" : ""}</td></tr>`).join("") || empty(5, "No plans read for this grade yet.") :
        empty(5, "Elementary weekly and unit plans, Middle and High school unit and lesson plans (2026-27, with 2025-26 for weeks not yet planned).")}</tbody></table></div>`;
  }

  /* ---------------- detail popup ---------------- */
  function findItem(k) { const [f, c] = k.split("|"); return items().find((e) => e.f === f && e.c === c) || Object.values(S.idx).flat().find((e) => e.f === f && e.c === c); }
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
      return `<div><button class="cell ${r ? "l" + r.level : ""} ${placed ? "placed" : ""}" data-act="cycle" data-k="${esc(k)}" data-g="${g}"
        aria-label="${esc(gname(g))}: ${r ? LEVEL[r.level] : "not rated"}${canEdit(g) ? ". Click to change" : ""}" title="${esc(gname(g))}: ${r ? LEVEL[r.level] + " (" + esc(r.team) + ")" : "not rated"}"></button>${gl(g)}</div>`;
    }).join("");
    const pg = GRADES.indexOf(e.pl[0]);
    const rel = (g) => (g ? items().filter((x) => x.f === e.f && x.s === e.s && x.pl.includes(g)).slice(0, 6) : []);
    const relList = (g) => { const r = rel(g); return r.length ? r.map((x) => `<li><button class="code" data-act="open" data-k="${esc(x.f + "|" + x.c)}">${esc(x.c)}</button> <span class="muted">${esc(x.t.slice(0, 80))}…</span></li>`).join("") : "<li class='muted'>None in this strand.</li>"; };
    const comments = S.comments.filter((c) => c.framework === e.f && c.code === e.c);
    const hist = S.events.filter((ev) => ev.framework === e.f && ev.code === e.c).slice(0, 12);
    $("#d-eyebrow").innerHTML = `${badge(e.f)} ${esc(FW_NAME[e.f] || e.f)} · ${esc(e.s || "")}`;
    const eeFw = "WI-EE-" + ({ Math: "MATH", ELA: "ELA", Science: "SCI", "Social Studies": "SS" })[sub.name];
    const eeItem = e.ee ? S.idx[sub.slug].find((x) => x.f === eeFw && x.c === e.ee.split(";")[0].trim()) : null;
    const linkBtn = (x) => { const [f, c] = x.split(":"); return `<button class="code" data-act="open" data-k="${esc(f + "|" + c)}">${badge(f)} ${esc(c)}</button>`; };
    $("#d-title").textContent = e.c;
    $("#d-body").innerHTML = `
      <p class="stdtext">${esc(d.text || e.t)}</p>
      <p class="muted">Suggested for ${e.pl.map(gname).join(", ")}${e.sg ? " (a suggestion: teachers confirm the grade in Part 1)" : ""}${d.course ? " · " + esc(d.course) : ""}${d.cluster ? " · " + esc(d.cluster) : ""}</p>
      <div class="box"><h3>How each grade teaches it ${hb("d_strip")}</h3><div class="strip">${strip}</div>
        <p class="muted" style="margin:8px 0 0">${S.team ? "Click your grade's square to change its rating." : "Choose your team to rate."}</p></div>
      ${d.descriptor_flag ? `<div class="flagbox">${hb("d_flag")} <b>Committee review:</b> ${esc(d.descriptor_flag)}. A suggested version is shown beside the school descriptor.</div>` : ""}
      <div class="grid2" style="margin-top:14px">
        <div class="box"><h3>"I can" levels ${hb("d_levels")} ${d.descriptor_source === "draft" ? '<span class="tag flag">draft</span>' : '<span class="tag">school</span>'}</h3>${lvl(desc)}</div>
        ${e.lk ? `<div class="box"><h3>Linked standards ${hb("d_ee")}</h3><p>This Essential Element is the alternate version of:</p><p>${e.lk.map(linkBtn).join(" ")}</p></div>` :
        `<div class="box"><h3>Essential Element ${eeItem ? `<button class="code" data-act="open" data-k="${esc(eeFw + "|" + eeItem.c)}">${badge(eeFw)} ${esc(e.ee)}</button>` : esc(e.ee || "")} ${hb("d_ee")}</h3><p>${esc(d.ee_text || "No Essential Element for this standard.")}</p>
          ${desc.ee_at_target && !String(desc.ee_at_target).startsWith("Not applicable") ? `<dl class="levels"><dt>EE at target</dt><dd>${esc(desc.ee_at_target)}</dd></dl>` : ""}</div>`}
      </div>
      ${d.descriptors_suggested ? `<div class="box" style="margin-top:14px"><h3>Suggested "I can" levels <span class="tag flag">draft</span></h3>${lvl(d.descriptors_suggested)}</div>` : ""}
      <div class="grid2 related" style="margin-top:14px">
        <div class="box"><h3>Same strand, grade before ${hb("d_related")}</h3><ul class="gap-list" style="columns:1">${relList(GRADES[pg - 1])}</ul></div>
        <div class="box"><h3>Same strand, grade after</h3><ul class="gap-list" style="columns:1">${relList(GRADES[pg + 1])}</ul></div>
      </div>
      ${(d.crosswalk || []).length ? `<p class="muted" style="margin-top:12px">Related codes in other frameworks: ${d.crosswalk.map(esc).join(", ")}</p>` : ""}
      <div class="grid2" style="margin-top:14px">
        <div class="box"><h3>Comments ${hb("d_comments")}</h3><ul class="comments">${comments.map((c) => `<li>${esc(c.body)}<div class="meta">${esc(c.team)}${c.author ? " · " + esc(c.author) : ""} · ${new Date(c.created_at).toLocaleDateString()}</div></li>`).join("") || "<li class='muted'>No comments yet.</li>"}</ul>
          <label class="muted" for="c-body" style="display:block;margin-top:8px">Add a comment${S.team ? "" : " (choose your team first)"}</label>
          <textarea id="c-body" maxlength="2000" ${S.team ? "" : "disabled"}></textarea>
          <input id="c-author" placeholder="Your name (optional)" style="margin-top:6px;width:100%" ${S.team ? "" : "disabled"}>
          <div class="row-end"><button data-act="comment" data-k="${esc(k)}" ${S.team ? "" : "disabled"}>Post comment</button></div></div>
        <div class="box"><h3>History ${hb("d_history")}</h3><ul class="comments">${hist.map((ev) => `<li>${gl(ev.grade)}: ${ev.old_level == null ? "Not rated" : LEVEL_SHORT[ev.old_level]} → ${ev.new_level == null ? "Removed" : LEVEL_SHORT[ev.new_level]}<div class="meta">${esc(ev.team)} · ${new Date(ev.created_at).toLocaleString()}${ev.undone ? " · undone" : ""}</div></li>`).join("") || "<li class='muted'>No changes yet.</li>"}</ul>
          <h3 style="margin-top:12px">Curriculum evidence ${hb("d_evidence")}</h3>${evidenceFor(e)}</div>
      </div>
      <p class="muted" style="margin-top:12px;font-size:12px">Source: ${esc(d.source || "")}</p>`;
    $("#detail").dataset.k = k;
    if (!$("#detail").open) $("#detail").showModal();
  }

  /* ---------------- exports ---------------- */
  function download(name, blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  function csvCell(v) { v = String(v ?? ""); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }
  function exportCSV() {
    if ((S.view === "rate" && !teamGrade()) || (S.view === "dashboard" && !S.f.grade)) { toast("Choose a grade first."); return; }
    const gs = S.view === "rate" || S.view === "dashboard" ? [S.view === "rate" ? teamGrade() : S.f.grade] : visibleGrades();
    const list = S.view === "activity" ? null : filtered({ ignoreDivision: S.view === "rate" || S.view === "dashboard" });
    let rows;
    if (!list) rows = [["When", "Team", "Framework", "Code", "Grade", "From", "To", "Undone"], ...S.events.map((e) => [e.created_at, e.team, e.framework, e.code, e.grade, e.old_level == null ? "" : LEVEL[e.old_level], e.new_level == null ? "Removed" : LEVEL[e.new_level], e.undone])];
    else rows = [["Subject", "Framework", "Code", "Strand", "Suggested grade(s)", "Standard", ...gs.map(gname)],
      ...list.map((e) => [S.f.subject, e.f, e.c, e.s, e.pl.join(" "), e.t, ...gs.map((g) => { const r = rating(e.f, e.c, g); return r ? LEVEL[r.level] : ""; })])];
    download(`awsaj-${S.view}-${S.f.subject.replace(/\s/g, "")}.csv`, new Blob(["﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv" }));
  }
  function exportPNG() {
    const gs = visibleGrades(), list = filtered(), cw = 26, ch = 16, gap = 2, left = 150, top = 70, pad = 20;
    const W = left + gs.length * (cw + gap) + pad, Hh = top + list.length * (ch + gap) + 50;
    if (list.length > 1500) { toast("Too many rows for one image. Narrow the filters first."); return; }
    const c = document.createElement("canvas"), dpr = 2; c.width = W * dpr; c.height = Hh * dpr;
    const x = c.getContext("2d"); x.scale(dpr, dpr); x.fillStyle = "#fff"; x.fillRect(0, 0, W, Hh);
    x.fillStyle = COLORS.maroon; x.fillRect(0, 0, W, 5);
    x.fillStyle = COLORS.ink; x.font = "600 16px Georgia"; x.fillText(`Awsaj Academy · ${S.f.subject} coverage ${S.f.division === "all" ? "K-12" : S.f.division}`, pad, 30);
    x.font = "11px sans-serif"; x.fillStyle = "#4A5058"; x.fillText(new Date().toLocaleDateString(), pad, 48);
    gs.forEach((g, i) => x.fillText(gl(g), left + i * (cw + gap) + 6, top - 6));
    list.forEach((e, r) => {
      const y = top + r * (ch + gap);
      x.fillStyle = COLORS.ink; x.fillText(e.c.slice(0, 22), pad, y + 12);
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

  /* ---------------- events ---------------- */
  document.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-act]"); if (!b) return;
    const act = b.dataset.act;
    if (act === "rate") { const e = findItem(b.dataset.k); const l = +b.dataset.l; const cur = rating(e.f, e.c, b.dataset.g); if (cur && cur.level === l) return; setRating(e, b.dataset.g, l); }
    else if (act === "open") openDetail(b.dataset.k);
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
    else if (act === "flow-subject") { S.flow.subject = b.dataset.s; S.flow.set = null; S.flow.choose = null; S.flow.back = null; S.flow.skipped.clear(); showView("flow"); rerender(); }
    else if (act === "flow-rate") flowRate(b.dataset.k, +b.dataset.l);
    else if (act === "flow-skip") flowSkip();
    else if (act === "flow-back") flowBack();
    else if (act === "cm-open") { S.f.grade = b.dataset.g; S.f.strand = b.dataset.s; showView("ladder"); refreshFilterOptions(); rerender(); }
    else if (act === "grade") { S.f.grade = b.dataset.g; refreshFilterOptions(); rerender(); }
    else if (act === "strand") { S.f.strand = b.dataset.s; $(`.tabs [data-view="rate"]`).click(); }
    else if (act === "subject") { S.f.subject = b.dataset.s; S.f.framework = b.dataset.fw || ""; S.f.strand = ""; refreshFilterOptions(); rerender(); }
    else if (act === "cycle") {
      const e = findItem(b.dataset.k), g = b.dataset.g, cur = rating(e.f, e.c, g);
      if (!canEdit(g)) { toast(S.team ? `Your team rates ${S.team.grades.map(gname).join(", ")}.` : "Choose your team first."); return; }
      await setRating(e, g, cur ? (cur.level + 1) % 3 : 1); openDetail(b.dataset.k);
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
  $$("dialog [data-close], #d-close").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
  $("#detail").addEventListener("close", () => rerender());

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
      tip.innerHTML = `<b>${esc(e.c)}</b> · ${esc(gname(g))}<br>${r ? LEVEL[r.level] + " · " + esc(r.team) : "Not rated"}${e.pl.includes(g) ? "<br>Suggested grade" : ""}<br><span style="opacity:.8">${esc(e.t.slice(0, 120))}…</span>`; }
    tip.hidden = false;
  });
  document.addEventListener("mousemove", (ev) => { if (!tip.hidden) { tip.style.left = Math.min(ev.clientX + 14, innerWidth - 360) + "px"; tip.style.top = ev.clientY + 14 + "px"; } });

  $$(".tabs [data-view]").forEach((b) => b.addEventListener("click", () => {
    showView(b.dataset.view);
    store.set("va_view", S.view); refreshFilterOptions(); rerender();
    if (S.view === "activity") Promise.all([loadEvents(), loadComments()]).then(rerender);
  }));
  const bindF = (id, key) => $(id).addEventListener(id === "#f-search" ? "input" : "change", (ev) => {
    S.f[key] = ev.target.value;
    if (key === "subject") S.f.framework = defaultFramework(S.f.subject, teamGrade());
    refreshFilterOptions(); rerender();
  });
  bindF("#f-subject", "subject"); bindF("#f-framework", "framework"); bindF("#f-division", "division"); bindF("#f-grade", "grade"); bindF("#f-strand", "strand"); bindF("#f-search", "search");
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
    $("#f-search").value = "";
    S.device = store.get("va_device") || Math.random().toString(36).slice(2, 12); store.set("va_device", S.device);
    S.meta = await (await fetch("data/meta.json")).json();
    S.teams = S.meta.teams;
    await Promise.all(S.meta.subjects.map(async (s) => (S.idx[s.slug] = await (await fetch(`data/index_${s.slug}.json`)).json())));
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
    const v = store.get("va_view");
    if (mode() === "full" && v && v !== "flow" && $(`.tabs [data-view="${v}"]`)) $(`.tabs [data-view="${v}"]`).click();
    else { showView(mode() === "full" ? "rate" : "flow"); refreshFilterOptions(); rerender(); }
    // Remove needs clear_rating (migration 005). Probe it with a team that does not exist: nothing is written either way.
    rpc("clear_rating", { p_framework: "", p_code: "", p_grade: "", p_team: "", p_device: "" }).then(() => {}, (err) => { S.canClear = /unknown team/i.test(err.message); if (S.canClear) rerender(); });
    try { await Promise.all([loadRatings(true), loadEvents(), loadComments(), loadTeamSets()]); syncNote("Up to date"); rerender(); }
    catch (err) { syncNote("Offline: ratings could not load"); }
    let n = 0;
    setInterval(async () => {
      if (document.hidden) return;
      try { n++; const got = await loadRatings(n % 15 === 0); if (got) { rerender(); } syncNote("Up to date " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })); }
      catch (e) { syncNote("Reconnecting…"); }
    }, CFG.refreshSeconds * 1000);
  }
  start();
})();

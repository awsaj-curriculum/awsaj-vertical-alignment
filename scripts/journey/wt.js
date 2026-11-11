/* ================= The analytical walkthrough as site content: every part editable, deletable and restorable ================= */
const WT_DEFAULT = /*WT*/;
const WT = JSON.parse(JSON.stringify(WT_DEFAULT));      // what the page shows: default, overridden part by part from the database
const WT_SAVED = {};                                     // parts that have a saved (edited) version in the database
const SUBC = { Math: "#80BC00", ELA: "#3099BE", Science: "#CB0068", "Social Studies": "#ED9200" };
const B = D.band, SUBJ = D.subjects, C = D.cells, S = D.school;
const BANDKEY = { "k-5": "K-5", "g6-8": "6-8", "g9-12": "9-12" };
const SUBKEY = { math: "Math", ela: "ELA", science: "Science", "social-studies": "Social Studies" };
const DIVN = { "K-5": "Elementary", "6-8": "Middle", "9-12": "High" };
const SECNAME = { data: ["What the numbers say", "Key data"], patterns: ["What we notice", "Patterns, trends and comparisons"], questions: ["Questions and our part in the story", "Questions to ponder"], ourpart: ["Questions and our part in the story", "Options to discuss and act on"] };
const CHUNK = { data: 4, patterns: 3, questions: 4, ourpart: 4 };
const STOPS = ["whole", "k-5", "g6-8", "g9-12", "math", "ela", "science", "social-studies"];
const NAV = { whole: "Whole school", "k-5": "K-5", "g6-8": "6-8", "g9-12": "9-12", math: "Math", ela: "ELA", science: "Science", "social-studies": "Social Studies", next: "Where we go next", about: "About the data" };
const SUBTITLE = { whole: "Kindergarten to Grade 12, all four subjects", "k-5": "Elementary, Kindergarten to Grade 5", "g6-8": "Middle school, Grades 6 to 8", "g9-12": "High school, Grades 9 to 12", math: "Math, Kindergarten to Grade 12", ela: "ELA, Kindergarten to Grade 12", science: "Science, Kindergarten to Grade 12", "social-studies": "Social Studies, Kindergarten to Grade 12" };
let CURSEC = "", EDITING = false;

/* ---------- a small, safe markdown renderer for intros (paragraphs, bold, italics, bullets, tables, links) ---------- */
function inl(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>").replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1 ↗</a>'); }
function md(src) {
  const out = []; const blocks = String(src || "").replace(/\r/g, "").split(/\n\s*\n/);
  for (const b of blocks) {
    const lines = b.split("\n").filter((l) => l.trim());
    if (!lines.length) continue;
    if (lines.every((l) => l.trim().startsWith("|"))) {
      const rows = lines.filter((l) => !/^\|\s*-/.test(l.trim())).map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
      out.push(`<div class="scrollx"><table class="plainT"><thead><tr>${rows[0].map((c) => `<th>${inl(c)}</th>`).join("")}</tr></thead><tbody>${rows.slice(1).map((r) => `<tr>${r.map((c, i) => `<td${i && /^[\d,.%\s]+$/.test(c) ? ' class="num"' : ""}>${inl(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
    } else if (lines.every((l) => /^\s*[-*]\s/.test(l))) out.push(`<ul class="mdl">${lines.map((l) => `<li>${inl(l.replace(/^\s*[-*]\s/, ""))}</li>`).join("")}</ul>`);
    else out.push(`<p>${inl(lines.join(" "))}</p>`);
  }
  return out.join("");
}
const firstPara = (s) => String(s || "").split(/\n\s*\n/)[0];
const restMd = (s) => String(s || "").split(/\n\s*\n/).slice(1).join("\n\n");

/* ---------- links back to the Vertical Alignment site for each item ---------- */
function ctxOf(stop) { if (BANDKEY[stop]) return { subject: "All subjects", division: DIVN[BANDKEY[stop]] }; if (SUBKEY[stop]) return { subject: SUBKEY[stop] }; return { subject: "All subjects" }; }
function linkFor(stop, text) {
  const t = String(text || ""), c = ctxOf(stop), lc = t.toLowerCase();
  const gm = t.match(/\bGrade (\d{1,2})\b|\b(Kindergarten)\b/g);
  if (/priority|power standard/.test(lc)) return [link("plans", { subject: c.subject === "All subjects" ? "Math" : c.subject, grade: gm && gm.length === 1 ? (gm[0] === "Kindergarten" ? "K" : gm[0].split(" ")[1]) : "5" }), "Priority and power (Audit)"];
  if (/progression|hand-over|build on|builds on|needs first/.test(lc)) return [link("ladder", c), "Progressions"];
  if (/no grade teaches|not taught where|gap|never in depth|not owned|introduced and never|introduced only|met but/.test(lc)) return [link("gaps", c), "Gaps and repetition"];
  if (gm && gm.length === 1) { const g = gm[0] === "Kindergarten" ? "K" : gm[0].split(" ")[1]; return [link("dashboard", { subject: c.subject, grade: g }), `${gm[0]} dashboard`]; }
  return [link("heatmap", c), "Coverage map"];
}

/* ---------- charts for each stop (rating colours only inside charts) ---------- */
function glanceChart(stop) {
  if (stop === "whole") return hbars([["All subjects, K-12", S.main], ...SUBJ.map((s) => [s, S.bySubject[s]])], "Share of rated standards taught in depth, introduced and not taught, all subjects and each subject, K-12");
  if (BANDKEY[stop]) { const b = BANDKEY[stop]; return hbars([[`All subjects, ${b}`, B[b].all], ...SUBJ.map((s) => [s, B[b].subjects[s].main])], `${b}: share taught in depth, introduced and not taught, by subject`); }
  const s = SUBKEY[stop]; return hbars([...Object.keys(B).map((b) => [b, B[b].subjects[s].main]), [`${s}, K-12`, S.bySubject[s]]], `${s}: share taught in depth, introduced and not taught, by grade band`);
}
function gradeChart(stop) {
  if (stop === "whole") return `${LEGEND}${cols(D.grades, (g) => S.byGrade[g], "Share of rated standards in depth, introduced and not taught in each grade, all subjects", true)}<p class="howto">How to read this: one column per grade, all four subjects together. The number on top is the share taught in depth.</p>`;
  if (BANDKEY[stop]) { const gs = D.bands[BANDKEY[stop]]; return `${LEGEND}<div class="subjgrid sm">${SUBJ.map((s) => `<div class="subjcard" style="--c:${SUBC[s]}"><h3>${s}</h3>${cols(gs, (g) => C[s][g].main, s + " by grade")}</div>`).join("")}</div><p class="howto">How to read this: for each subject, one column per grade, with the share taught in depth on top.</p>`; }
  const s = SUBKEY[stop]; return `${LEGEND}${cols(D.grades, (g) => C[s][g].main, s + " by grade, K-12", true)}<p class="howto">How to read this: one column per grade. The number on top is the share taught in depth.</p><details class="more"><summary>Strands by grade</summary><div>${heat(D.subject[s]["K-12"].strands, D.grades, s + " strands by grade")}</div></details>`;
}

/* ---------- rendering ---------- */
const btnE = (attrs, label) => `<button type="button" class="ebtn" ${attrs}>${label}</button>`;

/* footnotes: each "data" note links to the place on this page that shows that figure (a key data or pattern item, or a chart) */
const numTok = (s) => new Set(((s || "").match(/\d[\d,]*%?/g) || []).filter((t) => t.length > 1 || /%/.test(t)));
function fnTarget(stop, it) {
  const want = numTok(it.data); if (!want.size) return null; const P = WT[stop]; let best = null, bs = 0;
  (P?.sections || []).forEach((sec, si) => { if (!["data", "patterns"].includes(sec.key)) return; sec.items.forEach((x, ii) => { if (x === it) return;
    const have = numTok(`${x.title || ""} ${x.text}`); let sc = 0; want.forEach((t) => { if (have.has(t)) sc += /%/.test(t) ? 1.5 : 1; });
    if (sc > bs) { bs = sc; best = { id: `it-${stop}-${si}-${ii}`, label: `${sec.key === "data" ? "Key data" : "Pattern"} ${ii + 1}` }; } }); });
  if (best && bs >= 1) return best;
  return /\bGrade|\bG\d|\bKindergarten/.test(it.data) ? { id: "p-grades", label: "Grade by grade chart" } : { id: "p-glance", label: "At a glance chart" };
}
function fnHTML(stop, it) { const t = it.data && fnTarget(stop, it); return t ? `<sup class="fn"><a href="#${t.id}" data-fn="${t.id}" data-fnstop="${stop}" title="Where this figure is shown on the page">see ${t.label}</a></sup>` : ""; }

/* plain explanation on every slide: what you are seeing, and what it adds to our story */
const EXPH = (see, adds) => see ? `<div class="explain"><p><b>What you are seeing.</b> ${esc(see)}</p><p><b>What it adds to our story.</b> ${esc(adds)}</p></div>` : "";
const EXP = (stop, key) => { const X = WT.EXPLAIN; if (!X) return ""; if (key === "ourpart") return EXPH(X.see.ourpart, X.ourpart); return EXPH(X.see[key], X.adds[stop]?.[key] || ""); };
const EXPX = (k) => { const X = WT.EXPLAIN?.extra?.[k]; return X ? EXPH(X[0], X[1]) : ""; };
function itemHTML(stop, si, ii, it, sec) {
  const [href, label] = linkFor(stop, `${it.title || ""} ${it.text || ""} ${it.data || ""}`);
  const body = sec === "questions" ? `${inl(it.text)}${it.data ? ` <span class="dnote">(Data: ${inl(it.data)})${fnHTML(stop, it)}</span>` : ""}` : `${it.title ? `<b>${inl(it.title)}</b> ` : ""}${inl(it.text)}${it.data ? ` <span class="dnote">(Data: ${inl(it.data)})${fnHTML(stop, it)}</span>` : ""}`;
  return `<li id="it-${stop}-${si}-${ii}" data-si="${si}" data-ii="${ii}"><div class="itxt">${it.cat ? `<span class="catchip">${esc(it.cat)}</span>` : ""}${body} <a class="ilink" href="${href}" target="_blank" rel="noopener">${label} ↗</a></div>${EDITING ? `<div class="eacts">${btnE(`data-edit-item="${si}:${ii}"`, "Edit")}${btnE(`data-del-item="${si}:${ii}"`, "Delete")}</div>` : ""}</li>`;
}
function sectionParts(stop, P, si) {
  const sec = P.sections[si], [eb, h] = SECNAME[sec.key] || [sec.title, sec.title], n = CHUNK[sec.key] || 5, items = sec.items, chunks = [];
  if (sec.key === "ourpart") {
    return `<section class="part joined" id="p-${sec.key}"><span class="eyebrow">${eb}</span><h2>Our part in the story</h2>${EXP(stop, "ourpart")}<div class="ourpart"><div class="ophead"><p>Options to discuss and act on. Pick what fits your team, change it, or add your own.</p></div><div class="opgrid">${items.map((it, ii) => { const [href, label] = linkFor(stop, `${it.text} ${it.data || ""}`); return `<div data-si="${si}" data-ii="${ii}"><h3>${inl(it.title || "")}</h3><p>${inl(it.text)}</p>${it.data ? `<p class="dnote">(Data: ${inl(it.data)})${fnHTML(stop, it)}</p>` : ""}<p><a class="ilink" href="${href}" target="_blank" rel="noopener">${label} ↗</a></p>${EDITING ? `<div class="eacts">${btnE(`data-edit-item="${si}:${ii}"`, "Edit")}${btnE(`data-del-item="${si}:${ii}"`, "Delete")}</div>` : ""}</div>`; }).join("")}</div></div>${EDITING ? `<div class="eacts sec">${btnE(`data-add-item="${si}"`, "+ Add an option")}${btnE(`data-del-sec="${si}"`, "Delete this section")}</div>` : ""}<div class="partacts"><button class="btn cta" type="button" data-reflect="${stop}">Reflection questions on screen</button></div></section>`;
  }
  for (let i = 0; i < items.length; i += n) chunks.push(i);
  if (EDITING || !chunks.length) chunks.splice(0, chunks.length, 0);
  return chunks.map((start, ci) => { const part = EDITING ? items : items.slice(start, start + n), more = !EDITING && chunks.length > 1 ? ` <span class="pof">${ci + 1} of ${chunks.length}</span>` : "";
    return `<section class="part${ci ? " cont" : ""}" id="p-${sec.key}-${ci}"><span class="eyebrow">${eb}</span><h2>${sec.key === "questions" ? "Questions and our part in the story" : esc(sec.title === h ? h : sec.title)}${more}</h2>${EXP(stop, sec.key)}${part.some((x) => x.cat) ? `<p class="cats"><span>Themes:</span> ${[...new Set(part.map((x) => x.cat).filter(Boolean))].map(esc).join(" · ")}</p>` : ""}${part.length ? `<ol class="${sec.key === "questions" ? "qs" : "wl"}" start="${start + 1}">${part.map((it, k) => itemHTML(stop, si, start + k, it, sec.key)).join("")}</ol>` : `<p class="note">No items in this section.</p>`}${EDITING ? `<div class="eacts sec">${btnE(`data-add-item="${si}"`, "+ Add an item")}${btnE(`data-del-sec="${si}"`, "Delete this section")}</div>` : ""}</section>`; }).join("");
}
function stopParts(stop) {
  const P = WT[stop]; if (!P) return "";
  const ctx = ctxOf(stop), glance = restMd(P.intro);
  return `<section class="part" id="p-glance"><span class="eyebrow">The picture</span><h2>At a glance</h2>${EXP(stop, "glance")}${EDITING ? `<div class="eacts">${btnE('data-edit-intro="1"', "Edit the introduction and table")}</div>` : ""}<div class="panel">${LEGEND}${glanceChart(stop)}<p class="howto">How to read this: each bar is 100% of the grade-level ratings. Green is taught in depth, blue is introduced or exposed, pink is not taught. Essential Elements are counted apart.</p></div><div class="partacts"><a class="btn" href="${link("heatmap", ctx)}" target="_blank" rel="noopener">Open the coverage map on the site ↗</a></div></section>${glance ? `<section class="part cont" id="p-glance-t"><span class="eyebrow">The picture</span><h2>At a glance <span class="pof">2 of 2</span></h2>${EXP(stop, "table")}<div class="mdx">${md(glance)}</div></section>` : ""}
    <section class="part" id="p-grades"><span class="eyebrow">The picture</span><h2>Grade by grade</h2>${EXP(stop, "grades")}<div class="panel">${gradeChart(stop)}</div><div class="partacts"><a class="btn" href="${link("dashboard", { subject: ctx.subject, grade: BANDKEY[stop] ? D.bands[BANDKEY[stop]][0] : "3" })}" target="_blank" rel="noopener">Open the grade dashboards ↗</a><a class="btn" href="${link("gaps", ctx)}" target="_blank" rel="noopener">Gaps and repetition ↗</a><a class="btn" href="${link("ladder", ctx)}" target="_blank" rel="noopener">Progressions ↗</a></div></section>
    ${P.sections.map((_, si) => sectionParts(stop, P, si)).join("")}`;
}
function nextParts() {   // Where we go next: every part's "Our part in the story", gathered by heading
  const H = ["Improving the curriculum", "Working across grade levels", "Knowing the bands above and below", "A concrete action we could take"];
  return H.map((h, hi) => { const lis = STOPS.map((st) => { const sec = (WT[st]?.sections || []).find((x) => x.key === "ourpart"); const it = sec && sec.items.find((x) => x.title === h); if (!it) return ""; const [href, label] = linkFor(st, `${it.text} ${it.data || ""}`); return `<li><div class="itxt"><b>${NAV[st]}.</b> ${inl(it.text)} <span class="dnote">(Data: ${inl(it.data || "")})${fnHTML(st, it)}</span> <a class="ilink" href="${href}" target="_blank" rel="noopener">${label} ↗</a></div></li>`; }).filter(Boolean); const out = []; for (let c = 0; c < lis.length; c += 3) out.push(`<section class="part${c ? " cont" : ""}" id="p-next-${hi}-${c}"><span class="eyebrow">Where we go next</span><h2>${h}${lis.length > 3 ? ` <span class="pof">${c / 3 + 1} of ${Math.ceil(lis.length / 3)}</span>` : ""}</h2>${EXPX("next")}<ol class="wl" start="${c + 1}">${lis.slice(c, c + 3).join("")}</ol>${c + 3 >= lis.length ? `` : ""}</section>`); return out.join(""); }).join("") +
    `<section class="part" id="p-next-q"><span class="eyebrow">Where we go next</span><h2>One question from every part</h2>${EXPX("next")}<ol class="qs">${STOPS.map((st) => { const q = (WT[st]?.sections || []).find((x) => x.key === "questions"); return q && q.items[0] ? `<li><b>${NAV[st]}.</b> ${inl(q.items[0].text)}</li>` : ""; }).join("")}</ol><div class="partacts"><a class="btn" href="${link("report", { report: "all", band: "K-12" })}" target="_blank" rel="noopener">Open the full report on the site ↗</a></div></section>`;
}
function mdChunks(src, max = 900) {   // splits markdown into screen-sized pieces; lists split every 5 items, tables kept whole
  const blocks = []; src.split(/\n\s*\n/).forEach((b) => { const ls = b.split("\n"); if (ls.every((l) => /^\s*[-*] /.test(l) || /^\s{2,}/.test(l)) && ls.length > 5) { for (let i = 0; i < ls.length; i += 5) blocks.push(ls.slice(i, i + 5).join("\n")); } else blocks.push(b); });
  const out = []; let cur = ""; blocks.forEach((b) => { if (cur && cur.length + b.length > max) { out.push(cur); cur = b; } else cur = cur ? cur + "\n\n" + b : b; }); if (cur) out.push(cur); return out;
}

/* PDF downloads (survey-free copies on the Vertical Alignment site) */
const PDFS = [["whole", "The whole walkthrough, K-12", "Part2_Whole_walkthrough_K-12.pdf"], ["k-5", "Elementary, K-5", "Part2_K-5.pdf"], ["g6-8", "Middle school, Grades 6-8", "Part2_Grades_6-8.pdf"], ["g9-12", "High school, Grades 9-12", "Part2_Grades_9-12.pdf"],
  ["math", "Math, K-12", "Part2_Math_K-12.pdf"], ["ela", "ELA, K-12", "Part2_ELA_K-12.pdf"], ["science", "Science, K-12", "Part2_Science_K-12.pdf"], ["social-studies", "Social Studies, K-12", "Part2_Social_Studies_K-12.pdf"]];
const pdfHref = (f) => SITE + "pdf/part2/" + f;
const pdfFor = (id) => { const x = PDFS.find((r) => r[0] === id) || (id === "next" || id === "about" ? PDFS[0] : null); return x ? pdfHref(x[2]) : ""; };
function pdfPart() { return `<section class="part" id="p-pdfs"><span class="eyebrow">About the data</span><h2>Download as PDF</h2>${EXPH("Printable A4 copies of this walkthrough: the whole thing, each grade band and each subject. Each one starts with How to read the data.", "Teams can take their own band or subject into a meeting, print it, and write on it.")}<ol class="wl">${PDFS.map(([, t, f]) => `<li><div class="itxt"><b>${t}</b> <a class="ilink" href="${pdfHref(f)}" target="_blank" rel="noopener" download>Download PDF &darr;</a></div></li>`).join("")}</ol></section>`; }
function aboutParts() {
  return ["howto", "method"].map((k) => { if (!WT[k]) return ""; const ch = mdChunks(WT[k].intro || ""); return ch.map((c, ci) => `<section class="part${ci ? " cont" : ""}" id="p-${k}-${ci}"><span class="eyebrow">About the data</span><h2>${esc(WT[k].title)}${ch.length > 1 ? ` <span class="pof">${ci + 1} of ${ch.length}</span>` : ""}</h2>${EXPX("about")}${EDITING && !ci ? `<div class="eacts">${btnE(`data-edit-intro="${k}"`, "Edit this text")}</div>` : ""}<div class="mdx">${md(c)}</div></section>`).join(""); }).join("") +
    pdfPart() + `<section class="part" id="p-links"><span class="eyebrow">About the data</span><h2>The data on the Vertical Alignment site</h2><div class="partacts">${[["heatmap", "Coverage map"], ["gaps", "Gaps and repetition"], ["ladder", "Progressions"], ["dashboard", "Grade dashboards"], ["plans", "Priority and power (Audit)"], ["report", "Reports and Excel downloads"]].map(([v, l]) => `<a class="btn" href="${link(v, v === "report" ? { report: "all", band: "K-12" } : v === "dashboard" || v === "plans" ? { subject: "Math", grade: "5" } : { subject: "All subjects" })}" target="_blank" rel="noopener">${l} ↗</a>`).join("")}</div></section>`;
}

/* ---------- SECTIONS: the interface the page shell uses ---------- */
const SECTIONS = {};
function buildSections() {
  for (const st of STOPS) SECTIONS[st] = { nav: NAV[st], title: (WT[st]?.title || NAV[st]).replace(/^Part \d+\.\s*/, ""), sub: SUBTITLE[st], lead: () => inl(firstPara(WT[st]?.intro)), parts: () => stopParts(st),
    get qs() { const q = (WT[st]?.sections || []).find((x) => x.key === "questions"); return q ? q.items.map((it) => inl(it.text)) : []; } };
  SECTIONS.next = { nav: NAV.next, title: "Where we go next", sub: "Every part's options, side by side", lead: () => "The options from each part of the story, gathered under the same four headings, so teams can see where their ideas meet. We cannot teach every standard equally, so these options are about choosing, on purpose, what we teach in depth, what we introduce and what we leave out.", parts: nextParts,
    get qs() { return STOPS.map((st) => { const q = (WT[st]?.sections || []).find((x) => x.key === "questions"); return q && q.items[0] ? inl(q.items[0].text) : ""; }).filter(Boolean); } };
  SECTIONS.about = { nav: NAV.about, title: "About the data", sub: "Where the numbers come from and how to read them", lead: () => inl(firstPara(WT.howto?.intro)), parts: aboutParts, qs: [] };
}
buildSections();
const SOON = {};
const ORDER = ["whole", "k-5", "g6-8", "g9-12", "math", "ela", "science", "social-studies", "next", "about"];
const navName = (id) => NAV[id];

/* ---------- editing (Editors and the owner only; saved to the page's database, so everyone sees the same content) ---------- */
let DBX = null, CAN_EDIT = false;
const toast = (m) => { let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); } t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 3500); };
async function initContent() {
  CAN_EDIT = false; DBX = null;
  if (!DBX) return;
  DBX.collection("content").onSnapshot((snap) => {
    let changed = false;
    snap.docChanges().forEach((ch) => { const id = ch.doc.id; if (ch.type === "removed") { WT[id] = JSON.parse(JSON.stringify(WT_DEFAULT[id])); delete WT_SAVED[id]; changed = true; } else { const v = ch.doc.data(); if (v && v.part) { WT[id] = v.part; WT_SAVED[id] = v.updatedAt || true; changed = true; } } });
    if (changed && !$(".eform")) rerenderStory();
  }, () => {});
  if (CAN_EDIT) rerenderStory();
}
function rerenderStory() { const id = parse().id; if (id === "map") return; const st = $("#story"); if (!st) return; const y = scrollY; st.innerHTML = storyHTML(id, parse().grade); if (presenting) showStep(Math.min(step, slides().length - 1), true); else window.scrollTo(0, y); }
async function savePart(id) {
  if (!DBX) { toast("Saving is not available here. Open the page in claude.ai to edit."); return false; }
  try { await DBX.collection("content").doc(id).set({ part: WT[id], updatedAt: new Date().toISOString() }); WT_SAVED[id] = true; toast("Saved. Everyone opening this page now sees the change."); return true; }
  catch (e) { toast(e && e.code === "not_granted" ? "Only Editors of this page can save changes." : "That change was not saved. Try again."); return false; }
}
async function restorePart(id) {
  if (!DBX) return; try { await DBX.collection("content").doc(id).delete(); WT[id] = JSON.parse(JSON.stringify(WT_DEFAULT[id])); delete WT_SAVED[id]; rerenderStory(); toast("Restored to the original text."); } catch (e) { toast("Could not restore. Try again."); }
}
function editForm(fields, onSave) {   // fields: [[key, label, value, rows]]
  const f = document.createElement("form"); f.className = "eform";
  f.innerHTML = fields.map(([k, l, v, r]) => `<label>${l}<textarea name="${k}" rows="${r || 3}">${esc(v || "")}</textarea></label>`).join("") + `<div class="eacts"><button class="btn cta" type="submit">Save</button><button class="btn" type="button" data-cancel="1">Cancel</button></div>`;
  f.addEventListener("submit", async (e) => { e.preventDefault(); const vals = Object.fromEntries(fields.map(([k]) => [k, f.elements[k].value.trim()])); onSave(vals); });
  f.querySelector("[data-cancel]").addEventListener("click", () => rerenderStory());
  return f;
}
document.addEventListener("click", async (e) => {
  const id = parse().id, P = WT[id];
  if (e.target.closest("#editToggle")) { EDITING = !EDITING; document.body.classList.toggle("editing", EDITING); if (EDITING) { allMode = true; setPresent(false); } rerenderStory(); return; }
  if (e.target.closest("#restorePart")) { if (id === "about") { restorePart("howto"); restorePart("method"); } else restorePart(id); return; }
  if (!EDITING || !P) return;
  const ei = e.target.closest("[data-edit-item]"), di = e.target.closest("[data-del-item]"), ai = e.target.closest("[data-add-item]"), ds = e.target.closest("[data-del-sec]"), et = e.target.closest("[data-edit-intro]");
  if (ei) { const [si, ii] = ei.dataset.editItem.split(":").map(Number), it = P.sections[si].items[ii], host = ei.closest("[data-si]");
    host.replaceWith(editForm([["title", "Heading (optional)", it.title, 1], ["text", "Text", it.text, 4], ["data", "The data behind it", it.data, 2]], async (v) => { P.sections[si].items[ii] = Object.fromEntries(Object.entries(v).filter(([, x]) => x)); if (await savePart(id)) rerenderStory(); })); return; }
  if (di) { const [si, ii] = di.dataset.delItem.split(":").map(Number); const it = P.sections[si].items[ii]; const host = di.closest("[data-si]");
    const bar = document.createElement("div"); bar.className = "econfirm"; bar.innerHTML = `Delete "${esc((it.title || it.text).slice(0, 60))}..."? <button class="btn cta" type="button">Delete</button> <button class="btn" type="button">Keep</button>`;
    host.appendChild(bar); const [yes, no] = bar.querySelectorAll("button"); no.onclick = () => bar.remove(); yes.onclick = async () => { P.sections[si].items.splice(ii, 1); if (await savePart(id)) rerenderStory(); }; return; }
  if (ai) { const si = Number(ai.dataset.addItem); ai.closest(".eacts").replaceWith(editForm([["title", "Heading (optional)", "", 1], ["text", "Text", "", 4], ["data", "The data behind it", "", 2]], async (v) => { if (!v.text) return; P.sections[si].items.push(Object.fromEntries(Object.entries(v).filter(([, x]) => x))); if (await savePart(id)) rerenderStory(); })); return; }
  if (ds) { const si = Number(ds.dataset.delSec); const bar = document.createElement("div"); bar.className = "econfirm"; bar.innerHTML = `Delete the whole section "${esc(P.sections[si].title)}"? You can bring it back with "Restore the original". <button class="btn cta" type="button">Delete section</button> <button class="btn" type="button">Keep</button>`;
    ds.closest(".eacts").after(bar); const [yes, no] = bar.querySelectorAll("button"); no.onclick = () => bar.remove(); yes.onclick = async () => { P.sections.splice(si, 1); if (await savePart(id)) rerenderStory(); }; return; }
  if (et) { const k = et.dataset.editIntro === "1" ? id : et.dataset.editIntro, Q = WT[k];
    et.closest(".eacts").replaceWith(editForm([["intro", "Introduction (first paragraph is the lead; tables use | columns |)", Q.intro, 12]], async (v) => { Q.intro = v.intro; if (await savePart(k)) rerenderStory(); })); return; }
});
/* editing is switched off: content is edited at the source and republished */

/* footnote click: go to the figure (switching part or step if needed), highlight it */
function jumpTo(id) { const el = document.getElementById(id); if (!el) return;
  if (presenting) { const i = slides().findIndex((x) => x.el.contains(el)); if (i >= 0 && i !== step) showStep(i); }
  requestAnimationFrame(() => { el.scrollIntoView({ behavior: REDUCED.matches ? "auto" : "smooth", block: "center" }); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }); }
document.addEventListener("click", (e) => { const a = e.target.closest("a[data-fn]"); if (!a) return; e.preventDefault();
  const st = a.dataset.fnstop, id = a.dataset.fn, cur = parse().id;
  if (st && st !== cur) { location.hash = st; setTimeout(() => jumpTo(id.startsWith("p-") ? id : id), 700); } else jumpTo(id); });

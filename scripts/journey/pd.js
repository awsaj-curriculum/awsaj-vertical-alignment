/* ================= Part 1: All-staff session (Tim, Nov 2026: "From Standards to Student Success") =================
   Full-screen slides in the same look as the rest of the page. Elements with class "frag" appear one at a time
   (each press of Next shows the next one before moving to the next slide). About 20 minutes in all. */
const PD_SECS = [["data", "Introduction and data"], ["goal", "Our goal"], ["how", "How we get there"]];   // Tim, 17 Nov 2026: three parts of about the same length, 25 minutes in all
function pdMap(key) { const at = PD_SECS.findIndex((x) => x[0] === key);
  return `<div class="pdmap" aria-label="Where we are in the session">${PD_SECS.map(([k, t], i) => `<span class="pdm${i < at ? " done" : i === at ? " now" : ""}"><i>${i < at ? "&#10003;" : i + 1}</i>${t}</span>`).join('<span class="pdl" aria-hidden="true"></span>')}</div>`; }
const pdSlide = (id, sec, h, body, cls = "", bridge = "") => `<section class="part pd ${cls}" id="pd-${id}">${pdMap(sec)}${h ? `<h2>${h}</h2>` : ""}${body}${bridge ? `<p class="bridge frag"><span aria-hidden="true">&rarr;</span><span class="bt">${bridge.replace(/([.?!]) (?=[A-Z])/g, "$1<br>")}</span></p>` : ""}</section>`;
const fmt = (n) => Number(n).toLocaleString("en-US");

/* the K-12 road to the Awsaj Graduate, drawn as it appears */
function pdRoad() {
  const G = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], x0 = 60, dx = 66, y0 = 330, band = (i) => (i < 6 ? "#80BC00" : i < 9 ? "#3099BE" : "#CB0068");
  const pts = G.map((g, i) => [x0 + i * dx, y0 - i * 17 - (i >= 6 ? 26 : 0) - (i >= 9 ? 26 : 0)]);
  const end = [x0 + 13 * dx + 40, pts[12][1] - 40];
  const d = "M" + pts.map((p) => p.join(" ")).join(" L") + ` L${end[0]} ${end[1]}`;
  return `<svg class="pdroad" viewBox="0 0 1060 380" role="img" aria-label="The road from Kindergarten to Grade 12, ending at an Awsaj Graduate in the SAT / US Diploma pathway">
    <path class="road" d="${d}" pathLength="1"/>
    ${pts.map((p, i) => `<g class="cp2" style="--d:${0.15 + i * 0.11}s"><circle cx="${p[0]}" cy="${p[1]}" r="15" fill="${i ? "#fff" : "#ED9200"}" stroke="${band(i)}" stroke-width="3.5"/><text x="${p[0]}" y="${p[1] + 5}" text-anchor="middle">${G[i]}</text></g>`).join("")}
    <g class="goal2"><circle cx="${end[0]}" cy="${end[1]}" r="30" fill="#B5DF00" stroke="#101846" stroke-width="3"/><path d="M${end[0] - 18} ${end[1] - 2} l18 -9 l18 9 l-18 9 z M${end[0] - 10} ${end[1] + 3} v8 q10 6 20 0 v-8" fill="#101846"/>
    <text class="gl" x="${end[0] - 40}" y="${end[1] - 44}" text-anchor="end">An Awsaj Graduate</text><text class="gs" x="${end[0] - 40}" y="${end[1] - 22}" text-anchor="end">SAT / US Diploma pathway</text></g>
    <g class="bands">${[["K-5", 2, 3, "#5d8a00"], ["6-8", 7, 7, "#1f7898"], ["9-12", 10, 11, "#a80056"]].map(([t, a, b, c]) => `<text x="${(pts[a][0] + pts[b][0]) / 2}" y="${(pts[a][1] + pts[b][1]) / 2 + 40}" text-anchor="middle" fill="${c}">${t}</text>`).join("")}</g></svg>`;
}

/* Today's work: a staircase from Grade 12 down */
function pdStairs() {
  const G = ["12", "11", "10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "K"];
  return `<div class="stairs" aria-label="We start at Grade 12 and work down">${G.map((g, i) => `<div class="stair${i === 0 ? " top" : ""}" style="--i:${i}"><b>${g === "K" ? "K" : "Grade " + g}</b>${i === 0 ? "<span>Start here</span>" : ""}</div>`).join("")}</div>`;
}

/* "How we get there" as a click-by-click walkthrough (Tim, 17 Nov 2026): one picture per step, a ring that moves (and zooms on
   small things) and a caption in a dark panel, like the Part 1 rating walk-through. Pictures: img/pd/walk/ (practice mode,
   private builder); ring boxes in % of the picture: WALKBOX. Each click is one step; the slide counter counts the slide. */
const WALKBOX = /*WALK*/;
const WALKS = {
  open: ["Step 1: Open your grade and subject", [
    ["landing", "p2", "On the site's front page, choose <b>Part 2</b>."],
    ["journey", "p2", "Then choose <b>Part 2: Vertical Alignment Learning Maps</b>."],
    ["home", null, "This is the Learning Maps home page. (Your grade's link from your email opens your grade straight away.)"],
    ["home", "k5", "<b>Elementary (K-5):</b> choose your grade."],
    ["home", "sec", "<b>Secondary (6-12):</b> choose your grade."],
    ["grade", "cards", "Your grade has four subjects. In high school, each shows your course."],
    ["grade", "math", "Choose a subject to start. Each subject has its own list."]]],
  pick: ["Step 2: Pick your focus standards", [
    ["choose", null, "Your subject's standards on the left. Your choices on the right."],
    ["choose", "tick", "<b>Tick</b> each standard that every class must teach in depth."],
    ["choose", "tools", "Search, filter by strand, or show the school's power standards (priority standards in 6-12)."],
    ["choose", "hints", "Hints: how your grade rated it in the survey, and whether it is a school power or priority standard."],
    ["choose", "showall", "<b>Show all</b> reads the whole standard."],
    ["choose", "panel", "Your choices appear on the right, by strand. The cross takes one off."]]],
  select: ["Step 3: Select, then copy by strand", [
    ["gate", "btn", "When your list is complete, press <b>We selected our focus standards</b>."],
    ["gate", "msg", "Too few? The site asks you to pick more."],
    ["strand", "status", "Your list is marked <b>Selected</b>."],
    ["strand", "show", "See them by strand: codes, short text or full text."],
    ["selected", "open", "<b>Open our Learning Map</b> opens your grade and subject's own Google Doc. Keep this page open too."],
    ["strand", "copyone", "Copy <b>one strand at a time</b>: press <b>Copy codes</b> beside a strand. Its codes go into one row of your Learning Map."]]],
  map: ["Step 4: Complete your Learning Map", [
    ["doc-top", "title", "Your grade and subject's own Learning Map, in our shared Drive."],
    ["doc-top", "head", "Fill in the top: grade or course, subject, team and date."],
    ["doc-top", "prereq", "<b>Prerequisite skills:</b> what students need to arrive with, from any earlier grade."],
    ["doc-paste", "codes", "<b>Paste</b> your codes: one standard per row, or several standards in one row, grouped by strand or by a topic you choose (like the Pre-Calculus example). Whatever makes sense in your subject."],
    ["doc-paste", "strand", "Write the strand or topic beside them."],
    ["doc-paste", "ksve", "Then, for each row: <b>Knowledge, Skills, Vocabulary</b> and <b>Evidence of learning</b>."],
    ["doc-example", null, "Check your work against the filled example: Grade 12 Pre-Calculus."]]],
  help: ["Where to find help", [
    ["selected", "help", "<b>Step-by-step help (PDF)</b> is at the top of every page."],
    ["strand", "q", "Every part of the page has a <b>?</b> that explains it."],
    ["help-sheet", null, "The one-page help sheet shows every step with pictures. There is one for K-5 and one for 6-12."],
    ["grade", "folder", "Every Learning Map is also in our shared Drive folder, <b>Awsaj Learning Maps</b>, by grade."]]],
};
/* where the ring sits, how far the picture zooms, and where the black step popup goes (beside the ring, on the picture) */
function walkView(img, ring) {
  const b = ring && WALKBOX[img] && WALKBOX[img][ring];
  if (!b) return { ring: "opacity:0", zoom: "--tx:0%;--ty:0%;--z:1", pop: "left:50%;bottom:4%;transform:translateX(-50%)" };
  const [x, y, w, h] = b, z = Math.min(2.1, Math.max(1, 0.5 / Math.max(w / 100, h / 100))), cl = (v) => Math.min(0, Math.max(100 - 100 * z, v));
  const tx = cl(50 - (x + w / 2) * z), ty = cl(50 - (y + h / 2) * z), sx = x * z + tx, sy = y * z + ty, sw = w * z, sh = h * z;
  const left = Math.min(62, Math.max(2, sx)), pop = sy + sh < 64 ? `left:${left.toFixed(1)}%;top:${(sy + sh + 3).toFixed(1)}%` : sy > 34 ? `left:${left.toFixed(1)}%;bottom:${(100 - sy + 3).toFixed(1)}%` : sx + sw < 62 ? `left:${(sx + sw + 2).toFixed(1)}%;top:${Math.max(3, sy).toFixed(1)}%` : `right:3%;bottom:4%`;
  return { ring: `left:${x}%;top:${y}%;width:${w}%;height:${h}%`, zoom: `--tx:${tx.toFixed(2)}%;--ty:${ty.toFixed(2)}%;--z:${z.toFixed(3)}`, pop };
}
function pdWalk(key) {
  const [title, steps] = WALKS[key], imgs = [...new Set(steps.map((x) => x[0]))], v = walkView(steps[0][0], steps[0][1]);
  return pdSlide("w-" + key, "how", title, `<div class="wk"><div class="wkf"><div class="wkz" style="${v.zoom}">${imgs.map((n) => `<img class="wki${n === steps[0][0] ? " cur" : ""}" data-n="${n}" src="img/pd/walk/${n}.jpg" alt="">`).join("")}<span class="wkr" style="${v.ring}"></span></div>
    <div class="wkp" style="${v.pop}" aria-live="polite"><p class="wkn">${esc(title.split(":")[0])} · click 1 of ${steps.length}</p><p class="wkc">${steps[0][2]}</p><div class="wkd">${steps.map((_, i) => `<i class="${i ? "" : "cur"}"></i>`).join("")}</div></div></div></div>
    <ol class="wkl">${steps.map((x) => `<li>${x[2]}</li>`).join("")}</ol>`, "walk").replace('class="part pd walk"', `class="part pd walk" data-walk="${key}"`);
}
function walkShow(el, k) {
  const steps = WALKS[el.dataset.walk][1], st = steps[Math.max(0, Math.min(steps.length - 1, k))], v = walkView(st[0], st[1]), p = el.querySelector(".wkp");
  el.querySelectorAll(".wki").forEach((im) => im.classList.toggle("cur", im.dataset.n === st[0]));
  el.querySelector(".wkz").setAttribute("style", v.zoom); el.querySelector(".wkr").setAttribute("style", v.ring);
  p.classList.remove("pop"); void p.offsetWidth; p.setAttribute("style", v.pop); p.classList.add("pop");
  el.querySelector(".wkn").textContent = `${WALKS[el.dataset.walk][0].split(":")[0]} · click ${k + 1} of ${steps.length}`; el.querySelector(".wkc").innerHTML = st[2];
  el.querySelectorAll(".wkd i").forEach((d, i) => d.classList.toggle("cur", i === k));
}
/* "Breaking down a standard" as a mock Learning Map row that fills in one column per click (Tim, 17 Nov 2026) */
const FILL = [["Knowledge", "What students know and understand", ["Literary nonfiction", "How complex texts communicate information and ideas"]],
  ["Skills", "What students learn to do (start with a verb)", ["Read and comprehend complex texts independently", "Make sense of a whole text, not just parts of it"]],
  ["Vocabulary", "Words from the standards, academic and subject terms", ["literary nonfiction", "text complexity", "comprehension", "independently, proficiently"]],
  ["Evidence of learning", "Tasks and products that show it", ["Independently read a complex literary nonfiction text and show understanding"]]];
function pdFill() {
  const cell = (k, items) => `<td class="fc" data-s="${k}"><ul>${items.map((x) => `<li>${x}</li>`).join("")}</ul></td>`;
  return pdSlide("unpack", "goal", "Breaking down a standard", `<div class="stdcard mini"><span class="code">RI.11-12.10</span><span class="strand">Reading Informational Text</span><p>By the end of Grade 12, read and comprehend literary nonfiction at the high end of the Grades 11-CCR text complexity band independently and proficiently.</p></div>
    <div class="mkdoc"><p class="mkh">What key skills/knowledge do students need to learn to have succeeded this year?</p><table class="mkt"><thead><tr><th>Selected focus standards<small>The chosen focus standard numbers</small></th><th>Topic or domains</th>${FILL.map(([h, sub], i) => `<th data-s="${i + 1}" class="fh">${h}<small>${sub}</small></th>`).join("")}</tr></thead>
    <tbody><tr><td class="code">RI.11-12.10</td><td><b>Reading Informational Text</b></td>${FILL.map(([, , it], i) => cell(i + 1, it)).join("")}</tr></tbody></table></div>
    <p class="pdnote fnote" data-s="4">We describe what students learn, not the activities we use to teach it.</p>`, "").replace('class="part pd "', 'class="part pd fill" data-steps="5"');
}
function fillShow(el, k) { el.querySelectorAll("[data-s]").forEach((x) => { x.classList.toggle("shown", +x.dataset.s <= k); x.classList.toggle("now", +x.dataset.s === k); }); }

function pdParts() {
  const S0 = D.school.main, B = D.band, sec = (k) => (WT.whole?.sections || []).find((x) => x.key === k)?.items || [];
  const cards = (items, q) => `<ol class="pdcards">${items.slice(0, 3).map((it, i) => `<li class="frag" style="--i:${i}"><span class="n">${i + 1}</span>${it.cat ? `<span class="catchip">${esc(it.cat)}</span>` : ""}${q ? `<b>${inl(it.text)}</b>` : `<b>${inl(it.title || "")}</b><span>${inl(it.text).replace(/\n/g, "<br>")}</span>`}</li>`).join("")}</ol>`;
  const atLeast = S0.deep + S0.intro;
  const tiles = [[fmt(D.nRatings), "ratings entered"], ["Every", "team rated every standard it was asked about"], [fmt(S0.deep), "times a grade said: all our classes teach this in depth"], [fmt(atLeast), "times a grade said: we teach this, at least as an introduction"]];
  const bands = Object.keys(B), lo = (k) => Math.min(...bands.map((b) => B[b].all[k])), hi = (k) => Math.max(...bands.map((b) => B[b].all[k]));
  const PRI = SITE + "priorities.html";
  return [
    pdSlide("today", "data", "Where we are headed today", `<ol class="pdgoal3">${[["Introduction and data", "What our vertical alignment survey tells us about what we teach.", "var(--lime)", "About 8 minutes"], ["Our goal: a unified Vertical Alignment Learning Map", "One Learning Map for each grade and subject, in one place, and what a standard is.", "var(--blue)", "About 8 minutes"], ["How we get there", "Step by step: choose our focus standards, copy them by strand, complete the Learning Map, and where to find help.", "var(--magenta)", "About 10 minutes"]].map(([b, s, c, t], i) => `<li class="frag" style="--i:${i};border-top-color:${c}"><span class="n">${i + 1}</span><b>${b}</b><span>${s}</span><em class="mins">${t}</em></li>`).join("")}</ol><p class="pdnote frag" style="margin-top:22px">About 25 minutes together, then we work in our groups.</p>`),
    pdSlide("thanks", "data", "", `<div class="pdhero"><p class="eyebrow">All-staff session</p><h2 class="big">Thank you.</h2><p class="pdlead">You rated how every standard is taught, Kindergarten to Grade 12.</p></div>
      <div class="pdtiles">${tiles.map(([n, t], i) => `<div class="pdtile frag" style="--i:${i}"><b>${n}</b><span>${t}</span></div>`).join("")}</div>`, "center", "Your ratings show what we teach. Why does that matter?"),
    pdSlide("why", "data", "Why we are doing this", `<p class="pdlead">Every standard we teach is a step on the road to a student's success.</p>${pdRoad()}<p class="pdnote frag">Our work will focus on the <b>SAT / US Diploma pathway</b>: making sure each step builds to the next.</p>`, ""),
    pdSlide("learn", "data", "", `<div class="pdhero pddiv"><p class="eyebrow">Part 1: Introduction and data</p><h2 class="big">So what did we learn?</h2></div>`, "center"),
    pdSlide("pattern", "data", "We rated in a similar pattern across the school", `<p class="pdlead">In each grade band (Elementary, Middle and High):</p><p class="pdthree"><span><i class="d"></i><b>${lo("pDeep")}% to ${hi("pDeep")}%</b> taught in depth</span><span><i class="i"></i><b>${lo("pIntro")}% to ${hi("pIntro")}%</b> introduced</span><span><i class="n"></i><b>${lo("pNot")}% to ${hi("pNot")}%</b> not taught</span></p><div class="panel">${capChart("whole", 1).replace(/Average K-5 grade/g, "Average Elementary (K-5) grade").replace(/Average 6-8 grade/g, "Average Middle (6-8) grade").replace(/Average 9-12 grade/g, "Average High (9-12) grade")}</div><p class="howto">Each bar is an average grade in a year, all four subjects. Grade-level standards only.</p>`, "", "About a quarter of our standards are taught in depth. Which ones should they be?"),
    pdSlide("facts", "data", "Three facts from our data", cards(sec("data")) + `<p class="pdgap frag"><b>What is a progression, and what is a gap?</b> A progression is one skill growing from grade to grade. In our Math measurement progression (time and units), the grades before and after reported teaching it, but a grade in the middle reported not teaching it. That missing step is a gap.</p>`, ""),
    pdSlide("headed", "goal", "", `<div class="pdhero pddiv"><p class="eyebrow">Part 2: Our goal</p><h2 class="big">So where are we headed?</h2></div>`, "center"),
    pdSlide("goal", "goal", "Our goal: a unified Vertical Alignment Learning Map", `<p class="pdbig">A unified <b>Vertical Alignment Learning Map</b> for each grade and subject, in one place.</p><p class="pdsub">It sits alongside our curriculum maps: the curriculum map says when we teach it; the Learning Map is a whole-school overview of what students learn, to serve our vertical alignment, not a detailed plan.</p><p class="pdlead" style="margin-top:4px">It brings together:</p><ol class="pdgoal3" style="margin-top:8px">${[["Our focus standards", "All the standards that need to be taught in depth to succeed in the subject, chosen as a team."], ["Organized by strand", "Our focus standards grouped by strand or domain, ready to print and to copy."], ["What students learn", "What students bring, then the knowledge, skills, vocabulary and evidence of learning for our focus standards."]].map(([b, s], i) => `<li class="frag" style="--i:${i}"><span class="n">${i + 1}</span><b>${b}</b><span>${s}</span></li>`).join("")}</ol><p class="pddef frag"><b>Focus standards:</b> the standards required for success toward graduation and success in the subject.</p>`, "", "What does the Vertical Alignment Learning Map look like?"),
    pdSlide("profile", "goal", "The Vertical Alignment Learning Map", `<p class="pdlead">From our focus standards, we build a comprehensive vision of what students should know and be able to do, the words they use, and how they show it.</p><div class="pdimgs"><figure class="frag" style="--i:0"><img src="img/pd/example-precalc-prereq.jpg" alt="The top of the Grade 12 Pre-Calculus Learning Map: grade, subject, team, date, and its prerequisite skills"><figcaption><b>Prerequisite skills:</b> what students need to arrive with, from any earlier grade.</figcaption></figure><figure class="frag" style="--i:1"><img src="img/pd/example-precalc.jpg" alt="The Grade 12 Pre-Calculus Learning Map: focus standards grouped by topic, with knowledge, skills, vocabulary and evidence of learning"><figcaption><b>Our focus standards, by topic or strand:</b> Knowledge, Skills, Vocabulary and Evidence of learning.</figcaption></figure></div><p class="pdsmall frag">Shown: the filled Grade 12 Pre-Calculus example. This is our first draft: we will keep working on it and polish it in the future.</p>`, "", "To fill it in well, we need a shared picture of what a standard is."),
    pdSlide("standard", "goal", "What is a standard?", `<p class="pdlead">A standard says what students should <b>know and be able to do</b> by the end of a grade or course. It guides our teaching and sets clear expectations.</p>
      <div class="flow">${[["Standard", "The goal for the year"], ["Lesson objective", "Today's step towards it"], ["Instruction", "How we teach it"], ["Assessment", "How students show they have learned it"]].map(([t, s], i) => `<div class="fstep frag" style="--i:${i}"><b>${t}</b><span>${s}</span></div>`).join('<span class="farr" aria-hidden="true">&rarr;</span>')}</div>`, "", "Let us break down one standard from the end of the road: Grade 12."),
    pdFill(),
    pdSlide("there", "how", "", `<div class="pdhero pddiv"><p class="eyebrow">Part 3: How we get there</p><h2 class="big">So how do we get there?</h2></div>`, "center"),
    ...Object.keys(WALKS).map((k) => pdWalk(k)),
    pdSlide("go", "how", "", `<div class="pdhero"><h2 class="big">Thank you.</h2><p class="pdlead">Please go to your groups to begin.</p></div><div class="pdgo"><div><p class="howq">Elementary (K-5): your grade</p><div class="pdgr">${["K", "1", "2", "3", "4", "5"].map((g, i) => `<a class="frag" style="--i:${i}" href="${PRI}#g=${g}">${g === "K" ? "K" : "Grade " + g}</a>`).join("")}</div></div><div><p class="howq">Secondary (6-12): your grade</p><div class="pdgr sec">${["6", "7", "8", "9", "10", "11", "12"].map((g, i) => `<a class="frag" style="--i:${i}" href="${PRI}#g=${g}">Grade ${g}</a>`).join("")}</div></div></div><p class="pdnote frag" style="margin:22px auto 0">We probably will not finish today, and that is expected. This is our first draft: we will keep working on it and polish it in the future.</p>`, "center")
  ].join("");
}

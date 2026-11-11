/* ---------- charts ---------- */
const LEGEND = `<div class="legend"><span><i style="background:var(--deep)"></i>Taught in depth</span><span><i style="background:var(--intro)"></i>Introduced / exposed</span><span><i style="background:var(--not)"></i>Not taught</span></div>`;
const tipFor = (label, v) => `<b>${label}</b><br>${v.rated} rated standards<br>Taught in depth: ${v.deep} (${v.pDeep}%)<br>Introduced: ${v.intro} (${v.pIntro}%)<br>Not taught: ${v.not} (${v.pNot}%)`;
function hbars(rows, alt) {   // rows: [label, v, note]
  return `<div class="hb" role="img" aria-label="${esc(alt)}">${rows.map(([lab, v, note]) => `<div class="lab">${esc(lab)}</div>
    <div class="bar"${tip(tipFor(lab, v))}>${[["d", v.deep, v.pDeep], ["i", v.intro, v.pIntro], ["n", v.not, v.pNot]].filter((x) => x[1]).map(([k, n, p]) => `<span class="${k}" style="flex:${n}">${p >= 9 ? p + "%" : ""}</span>`).join("")}</div>
    <div class="val">${v.pDeep}%<small>${note || "in depth"}</small></div>`).join("")}</div>`;
}
function cols(grades, get, alt, bands) {
  const vs = grades.map((g) => get(g));
  return `<div role="img" aria-label="${esc(alt)}"><div class="colchart">${grades.map((g, i) => { const v = vs[i]; return `<div class="c"${tip(tipFor(gname(g), v))}><div class="top">${v.pDeep}%</div>${[["n", v.not], ["i", v.intro], ["d", v.deep]].filter((x) => x[1]).map(([k, n]) => `<span class="${k}" style="flex:${n}"></span>`).join("")}</div>`; }).join("")}</div>
    <div class="colx">${grades.map((g) => `<span>${gl(g)}</span>`).join("")}</div>${bands ? `<div class="colx" style="border:0;grid-auto-columns:auto;grid-template-columns:6fr 3fr 4fr"><span class="band">Elementary</span><span class="band">Middle</span><span class="band">High</span></div>` : ""}</div>`;
}
const shade = (p) => `background:color-mix(in srgb, var(--deep) ${Math.round(12 + p * 0.88)}%, white);color:var(--navy)`;
function heat(strands, grades, alt) {
  const rows = strands.filter((s) => grades.some((g) => s.byGrade[g]));
  return `<div class="scrollx"><table class="heat" aria-label="${esc(alt)}"><thead><tr><th class="s">Strand</th>${grades.map((g) => `<th>${gl(g)}</th>`).join("")}</tr></thead><tbody>${rows.map((s) => `<tr><th class="s">${esc(s.name.replace(/^Standard \d: /, ""))}</th>${grades.map((g) => { const v = s.byGrade[g]; return v ? `<td style="${shade(v.pDeep)}"${tip(tipFor(s.name + ", " + gname(g), v))}>${v.pDeep}%</td>` : `<td class="e"></td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
  <p class="howto">How to read this: each square is the share of that strand's rated standards taught in depth in that grade. Darker green means more in depth. A blank square means the grade has no standards in that strand.</p>`;
}
function whoCard(title, fig, text, n) { return `<aside class="who"><span class="eyebrow">Context from our teachers</span><div class="fig">${fig}</div><div>${text}</div><small>${title}. Teachers' estimates, ${n} responses. Context only, not a cause.</small></aside>`; }

/* ================= Motion layer: transform and opacity only; everything off for reduced motion ================= */
(() => {
  const RM = () => REDUCED.matches, G = () => window.gsap;
  if (window.gsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  if (!RM() && G()) document.documentElement.classList.add("js-motion");
  REDUCED.addEventListener?.("change", () => document.documentElement.classList.toggle("js-motion", !RM() && !!G()));

  /* count-up for the key figures in a stop header */
  function countUp(root) {
    $$(".kpi b[data-n]", root).forEach((el) => {
      const n = +el.dataset.n, suf = el.dataset.s || "";
      if (RM() || !G()) { el.textContent = n.toLocaleString() + suf; return; }
      const o = { v: 0 }; gsap.to(o, { v: n, duration: 1.1, ease: "power2.out", onUpdate: () => (el.textContent = Math.round(o.v).toLocaleString() + suf) });
    });
  }
  /* charts grow from their baseline */
  function grow(root) {
    if (RM() || !G()) return;
    const bars = $$(".bar span", root), colsEls = $$(".colchart .c span", root), heat = $$("table.heat td:not(.e)", root);
    if (bars.length) gsap.fromTo(bars, { scaleX: 0 }, { scaleX: 1, transformOrigin: "0 50%", duration: 0.6, ease: "power3.out", stagger: 0.02, clearProps: "transform" });
    if (colsEls.length) gsap.fromTo(colsEls, { scaleY: 0 }, { scaleY: 1, transformOrigin: "50% 100%", duration: 0.55, ease: "power3.out", stagger: 0.012, clearProps: "transform" });
    if (heat.length) gsap.fromTo(heat, { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.004, clearProps: "opacity" });
  }
  /* a step enters: direction-aware slide, then its contents stagger in */
  let lastStep = 0;
  function enterStep(el, dir) {
    if (!el) return; countUp(el);
    if (RM() || !G()) return;
    gsap.killTweensOf(el);
    gsap.fromTo(el, { y: 70 * dir, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: "power3.out", clearProps: "transform" });
    const kids = $$(":scope > .eyebrow, :scope > h2, :scope > h1, :scope > p, :scope > .panel, :scope > .kpis, :scope > .mdx, :scope > .partacts, ol > li, .opgrid > div, .hyp > div, .subjgrid > div", el);
    gsap.killTweensOf(kids); gsap.fromTo(kids, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.42, ease: "power2.out", stagger: 0.05, delay: 0.08, clearProps: "transform,opacity" });
    $$(".eyebrow", el).forEach((e) => e.classList.remove("drawn")); requestAnimationFrame(() => $$(".eyebrow", el).forEach((e) => e.classList.add("drawn")));
    grow(el);
  }
  const _showStep = showStep;
  showStep = function (n, keepScroll) { const dir = n >= lastStep ? 1 : -1; _showStep(n, keepScroll); lastStep = step; const s = slides()[step]; if (s) enterStep(s.el, dir); };

  /* one-page mode: reveal parts as they scroll in */
  function scrollReveals() {
    if (RM() || !G() || !window.ScrollTrigger || presenting) return;
    ScrollTrigger.getAll().forEach((t) => t.kill());
    $$(".story > .part, .story > .gradecard").forEach((el) => {
      ScrollTrigger.create({ trigger: el, start: "top 88%", once: true, onEnter: () => {
        const k = $$(":scope > .eyebrow, :scope > h2, :scope > .panel, :scope > .mdx, ol > li, .opgrid > div", el); gsap.killTweensOf(k); gsap.fromTo(k, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "power2.out", stagger: 0.04, clearProps: "transform,opacity" });
        $$(".eyebrow", el).forEach((e) => e.classList.add("drawn")); grow(el); } });
    });
  }
  /* the stop header: figures count up, blobs float */
  function enterHeader() { const h = $(".shead"); if (!h) return; countUp(h); $$(".eyebrow", h).forEach((e) => e.classList.add("drawn"));
    if (!RM() && G() && !presenting) { const k = $$(".shead > *"); gsap.killTweensOf(k); gsap.fromTo(k, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power2.out", stagger: 0.06, clearProps: "transform,opacity" }); } }

  /* sliding nav indicator under the active link */
  function moveIndicator(instant) {
    const nav = $("#navLinks"), a = $("#navLinks a[aria-current]"); let ind = $("#navInd");
    if (!nav) return; if (!ind) { ind = document.createElement("span"); ind.id = "navInd"; nav.appendChild(ind); }
    if (!a || getComputedStyle(nav).flexDirection === "column") { ind.style.opacity = 0; return; }
    const nb = nav.getBoundingClientRect(), r = a.getBoundingClientRect(), x = r.left - nb.left, w = r.width, y = r.bottom - nb.top - 3;
    ind.style.opacity = 1;
    if (instant || RM() || !G()) { ind.style.transform = `translate(${x}px, ${y}px)`; ind.style.width = w + "px"; return; }
    gsap.to(ind, { x, y, width: w, duration: 0.45, ease: "power3.out" });
  }

  /* hook into the shell's render: after each story fill, run header, reveals and indicator */
  const story = $("#story");
  new MutationObserver(() => { if (!story.firstElementChild) { moveIndicator(); return; } enterHeader(); if (!presenting) { scrollReveals(); } moveIndicator(); }).observe(story, { childList: true });
  addEventListener("hashchange", () => setTimeout(() => moveIndicator(), 30));
  addEventListener("resize", () => moveIndicator(true));
  setTimeout(() => { moveIndicator(true); if (story.firstElementChild) { enterHeader(); scrollReveals(); } }, 60);

  /* leaving presenter mode: the one-page view gets its reveals; anything already passed is drawn at once */
  const _setPresent = setPresent;
  setPresent = function (on) { _setPresent(on); if (!presenting) { $$(".story .eyebrow").forEach((e) => e.classList.add("drawn")); setTimeout(scrollReveals, 30); } moveIndicator(true); };
  /* reflection questions arrive one by one */
  const _open = openReflect;
  openReflect = function (id) { _open(id); if (!RM() && G()) gsap.fromTo($$("#reflect li"), { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "power2.out", stagger: 0.12, clearProps: "transform,opacity" }); };
})();

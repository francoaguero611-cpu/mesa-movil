/* Liquid glass (02/11, Lorenzo): las partes que el CSS solo no puede.
   1) Fondo: auroras de color y grano (las anima glass.css).
   2) Indicador líquido: una píldora lima que se desliza y se estira hasta la opción activa de cada grupo
      (secciones, períodos, pestañas de Reportes/ATC). Sobrevive a los repintados: recuerda dónde estaba y sale desde ahí.
   3) Brillo especular: las tarjetas y botones reflejan la luz donde está el puntero (--mx/--my).
   Todo es decorativo: si algo falla, la app sigue igual. */
"use strict";
(() => {
const reducido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- 1) fondo ----------
function fondo() {
  if (document.querySelector(".aurora")) return;
  const a = document.createElement("div"); a.className = "aurora"; a.setAttribute("aria-hidden", "true"); a.innerHTML = "<i></i><i></i><i></i><i></i>";
  const g = document.createElement("div"); g.className = "grano"; g.setAttribute("aria-hidden", "true");
  document.body.prepend(g); document.body.prepend(a);
}

// ---------- 2) indicador líquido ----------
const GRUPOS = [
  { sel: ".sec-pista", activo: '.seccion[aria-pressed="true"]' },
  { sel: ".periodos", activo: '.btn[aria-pressed="true"]' },
  { sel: ".rp-tabs", activo: '[aria-selected="true"]' },
  { sel: ".rp-segs", activo: '[aria-pressed="true"]', cian: true },
  { sel: ".atc-tabs", activo: '[aria-selected="true"]' },
];
const ultima = new Map(); // clave del grupo → {x, y, w, h} (para salir desde ahí después de un repintado)
function claveDe(g, def) { return def.sel + "|" + [...document.querySelectorAll(def.sel)].indexOf(g); }
function ubicar(g, def) {
  const act = g.querySelector(def.activo);
  let liq = g.querySelector(":scope > .liq");
  if (!act) { if (liq) liq.classList.remove("listo"); return; }
  if (!liq) {
    liq = document.createElement("span"); liq.className = "liq"; liq.setAttribute("aria-hidden", "true");
    g.prepend(liq); g.classList.add("liq-grupo"); if (def.cian) g.classList.add("liq-cian");
    const prev = ultima.get(claveDe(g, def));
    if (prev && !reducido()) { liq.style.transition = "none"; pintar(liq, prev); liq.classList.add("listo"); void liq.offsetWidth; liq.style.transition = ""; }
  }
  const p = { x: act.offsetLeft, y: act.offsetTop, w: act.offsetWidth, h: act.offsetHeight };
  const ant = liq._p;
  if (ant && ant.x === p.x && ant.y === p.y && ant.w === p.w && ant.h === p.h) return;
  const salto = ant && Math.abs(ant.x - p.x) + Math.abs(ant.y - p.y) > 4;
  if (!ant && !liq.classList.contains("listo")) { liq.style.transition = "none"; pintar(liq, p); void liq.offsetWidth; liq.style.transition = ""; }
  else pintar(liq, p);
  liq.classList.add("listo");
  if (salto && !reducido()) { liq.classList.remove("estira"); void liq.offsetWidth; liq.classList.add("estira"); }
  ultima.set(claveDe(g, def), p);
}
function pintar(liq, p) { liq._p = p; liq.style.width = p.w + "px"; liq.style.height = p.h + "px"; liq.style.transform = `translate(${p.x}px, ${p.y}px)`; }
let pend = false;
function todos() { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; for (const def of GRUPOS) document.querySelectorAll(def.sel).forEach((g) => { try { ubicar(g, def); } catch { /* decorativo */ } }); }); }

// ---------- 3) brillo especular ----------
const BRILLO = ".btn, .met, .rp-card, .rp-tile, .atc-tile, .atc-item, .opcion";
let obj = null, ev = null, raf = 0;
function mover(e) {
  ev = e; if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0; const t = ev.target instanceof Element ? ev.target.closest(BRILLO) : null;
    if (obj && obj !== t) { obj.style.removeProperty("--mx"); obj.style.removeProperty("--my"); }
    obj = t; if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty("--mx", `${ev.clientX - r.left}px`); t.style.setProperty("--my", `${ev.clientY - r.top}px`);
  });
}

function arrancar() {
  fondo();
  todos();
  new MutationObserver(todos).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-pressed", "aria-selected", "hidden", "class"] });
  addEventListener("resize", todos, { passive: true });
  document.addEventListener("load", todos, true);
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) document.addEventListener("pointermove", mover, { passive: true });
  if (document.fonts?.ready) document.fonts.ready.then(todos);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
})();

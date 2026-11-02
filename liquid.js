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
  const a = document.createElement("div"); a.className = "aurora"; a.setAttribute("aria-hidden", "true"); // luces fijas (glass.css)
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

// ---------- 4) barra lateral (compu): botón para dejarla abierta con los nombres ----------
const RAIL_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9.5 5.5 C 12 8, 14 10.5, 15.5 12.2 C 13.6 14, 11.6 16.4, 9.2 18.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function rail() {
  const n = document.getElementById("secciones"); if (!n || n.querySelector(".rail-toggle")) return;
  let abierta = false; try { abierta = localStorage.getItem("dash_rail") === "1"; } catch {}
  document.documentElement.classList.toggle("rail-abierta", abierta);
  const b = document.createElement("button"); b.type = "button"; b.className = "rail-toggle"; b.innerHTML = RAIL_SVG;
  const pinta = () => { const a = document.documentElement.classList.contains("rail-abierta"); b.setAttribute("aria-label", a ? "Achicar la barra de secciones" : "Abrir la barra de secciones con los nombres"); b.setAttribute("aria-expanded", a); };
  b.onclick = () => { const a = !document.documentElement.classList.contains("rail-abierta"); document.documentElement.classList.toggle("rail-abierta", a); try { localStorage.setItem("dash_rail", a ? "1" : "0"); } catch {} pinta(); };
  pinta(); n.prepend(b);
}

// ---------- 5) cambio de sección: fundido corto del contenido (solo al cambiar de sección, no al filtrar) ----------
let seccionAnt = null;
function fundido() {
  const act = document.querySelector('.seccion[aria-pressed="true"]')?.dataset.sec; if (!act) return;
  if (seccionAnt && act !== seccionAnt && !reducido()) { const m = document.getElementById("main"); if (m) { m.classList.remove("cambio"); void m.offsetWidth; m.classList.add("cambio"); m.addEventListener("animationend", () => m.classList.remove("cambio"), { once: true }); } }
  seccionAnt = act;
}

function arrancar() {
  fondo();
  todos();
  new MutationObserver(() => { rail(); fundido(); todos(); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-pressed", "aria-selected"] });
  addEventListener("resize", todos, { passive: true });
  // la barra lateral cambia de ancho al abrirse: el indicador la acompaña
  if ("ResizeObserver" in window) { const ro = new ResizeObserver(todos); const mirar = () => { const p = document.querySelector(".sec-pista"); if (p && !p._ro) { p._ro = 1; ro.observe(p); } }; mirar(); new MutationObserver(mirar).observe(document.body, { childList: true, subtree: true }); }
  document.addEventListener("load", todos, true);
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) document.addEventListener("pointermove", mover, { passive: true });
  if (document.fonts?.ready) document.fonts.ready.then(todos);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
})();

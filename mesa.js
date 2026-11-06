/* Mesa (06/11, Lorenzo) — la parte del diseño nuevo que necesita JS. Todo es decorativo: si algo falla, la app sigue igual.
   1) Eclipse de fondo que se mueve muy poco y lento con el scroll (queda siempre atrás).
   2) Deslizado suave con inercia (Lenis) solo con rueda / trackpad; el táctil queda nativo.
   3) Menú lateral agrupado: logo, saludo y grupos (Resumen, Campañas, Producción, Ayuda).
   4) Capa naranja neón con 2 reflejos sobre cada campaña seleccionada (una sola capa por fila: liviano).
   5) Círculo con el número en la isla de selección.
   6) Entradas al deslizar (tarjetas por oferta alternan izquierda / derecha) y métricas secundarias centradas al abrirlas.
   7) Shift + clic sin pintar texto. */
"use strict";
(() => {
const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ---------- 1) eclipse ----------
const ec = document.createElement("div");
ec.className = "ms-eclipse"; ec.setAttribute("aria-hidden", "true");
ec.innerHTML = `<div class="ms-bruma"></div><div class="ms-sol"><div class="ms-corona"></div><div class="ms-aro"></div><div class="ms-luna"></div></div>`;
document.body.prepend(ec);
const sol = $(".ms-sol", ec), luna = $(".ms-luna", ec), corona = $(".ms-corona", ec);

// ---------- 2) deslizado suave ----------
let lenis = null;
function iniciarLenis() {
  if (quieto || !window.Lenis || matchMedia("(hover: none)").matches) return;
  try {
    lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true,
      prevent: (n) => !!(n.closest && n.closest(".jv-panel, .dialogo, .menu, .modal, .ad-ver, [data-lenis-prevent], textarea, select")) });
    window.MesaLenis = lenis;
  } catch { lenis = null; }
}
if (!quieto) {
  const sc = document.createElement("script");
  sc.src = "https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js"; sc.async = true; sc.onload = iniciarLenis;
  document.head.append(sc);
}
let suave = 0;
function cuadro(t) {
  if (lenis) lenis.raf(t);
  const max = Math.max(1, document.documentElement.scrollHeight - innerHeight), p = scrollY / max;
  suave += (p - suave) * 0.025;                         // muy lento y corto: acompaña sin distraer
  sol.style.transform = `translate(-50%, -50%) translate3d(${(18 + Math.sin(suave * Math.PI) * 4).toFixed(2)}vw, ${(-6 + suave * 10).toFixed(2)}vh, 0) scale(${(0.92 + suave * 0.06).toFixed(3)})`;
  luna.style.transform = `translate3d(${(-6 + suave * 12).toFixed(2)}%, ${(Math.cos(suave * Math.PI) * 2).toFixed(2)}%, 0)`;
  corona.style.transform = `rotate(${(t / 600 + suave * 40).toFixed(1)}deg)`;
  requestAnimationFrame(cuadro);
}
if (!quieto) requestAnimationFrame(cuadro);
else sol.style.transform = "translate(-50%, -50%) translate3d(18vw, -6vh, 0) scale(.92)";

// ---------- 3) menú lateral agrupado ----------
const GRUPOS = { dash: "Resumen", reportes: "Campañas", cazador: "Producción", atc: "Ayuda" };
function armarMenu() {
  const n = $("#secciones"), pista = $("#sec-pista"); if (!n || !pista) return;
  const quien = (document.querySelector(".hola")?.textContent || "").replace(/^(hola|bienvenid[oa])[,!]?\s*/i, "").trim();
  if (n.dataset.mesa) { const b = $(".ms-hola b", n); if (b && quien && b.textContent !== quien) b.textContent = quien; return; }
  n.dataset.mesa = "1";
  const cab = document.createElement("div");
  cab.innerHTML = `<div class="ms-marca"><img src="icons/icon-192.png?v=27" alt=""><div><b>Mesa Leiva</b><small>Lorenzo y Franco</small></div></div><div class="ms-hola"><h2>Hola de nuevo,<br><b>${quien || "equipo"}</b></h2></div>`;
  n.insertBefore(cab, pista);
  for (const [id, t] of Object.entries(GRUPOS)) { const b = $(`[data-sec="${id}"]`, pista); if (b) { const g = document.createElement("div"); g.className = "ms-grupo"; g.textContent = t; pista.insertBefore(g, b); } }
}

// ---------- 4) capa de selección ----------
let capaPend = 0;
function capas() { cancelAnimationFrame(capaPend); capaPend = requestAnimationFrame(capasYa); }
function capasYa() {
  {
    const caja = $(".tabla-caja"), sc = $("#tabla-scroll"); if (!caja || !sc) return;
    let capa = $(".ms-capas", caja); if (!capa) { capa = document.createElement("div"); capa.className = "ms-capas"; capa.setAttribute("aria-hidden", "true"); caja.append(capa); }
    const rc = caja.getBoundingClientRect(), rs = sc.getBoundingClientRect(), antes = new Set($$("i", capa).map((x) => x.dataset.k));
    const filas = $$("tbody tr.fila.sel", sc);
    const html = filas.map((tr) => { const r = tr.getBoundingClientRect(), k = tr.dataset.k || "";
      return `<i data-k="${k.replace(/"/g, "")}" class="${antes.has(k) ? "ya" : ""}" style="top:${(r.top - rc.top).toFixed(1)}px;height:${r.height.toFixed(1)}px;left:${(rs.left - rc.left + 2).toFixed(1)}px;width:${(rs.width - 4).toFixed(1)}px"></i>`; }).join("");
    if (capa.innerHTML !== html) capa.innerHTML = html;
  }
}
addEventListener("resize", capas);

// ---------- 5) isla: círculo con el número ----------
function isla() {
  const b = $("#barra"); if (!b || b.hidden) return;
  const tx = $(".cuenta", b)?.textContent || "", n = (tx.match(/\d+/) || [""])[0];
  let c = $(".ms-n", b);
  if (!c) { c = document.createElement("span"); c.className = "ms-n num"; b.prepend(c); }
  c.textContent = n;
}

// ---------- 6) entradas al deslizar ----------
let io = null;
const vistos = new Set();
function revelar() {
  if (quieto || !("IntersectionObserver" in window)) return;
  io ??= new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("ms-dentro"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px", threshold: 0.1 });
  $$(".mesa-of-t").forEach((el, i) => {
    const k = "of" + (el.dataset.irOf || i); if (vistos.has(k) || el.classList.contains("ms-rv")) return; vistos.add(k);
    el.classList.add("ms-rv", i % 2 ? "der" : "izq"); el.style.setProperty("--ms-d", Math.min(i, 6) * 70 + "ms"); io.observe(el);
  });
  $$(".seccion-camp, .rp-card, .atc-item, .umb-fila, .cr-carpeta").forEach((el, i) => {
    const k = (el.className.split(" ")[0] || "") + i; if (vistos.has(k) || el.classList.contains("ms-rv")) return; vistos.add(k);
    el.classList.add("ms-rv", "sube"); el.style.setProperty("--ms-d", Math.min(i, 6) * 50 + "ms"); io.observe(el);
  });
}
// métricas secundarias: al abrirlas, la pantalla las deja en el medio
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-sec]"); if (!b) return;
  setTimeout(() => {
    const g = $(".carr .sec-grid"); if (!g) return;
    const r = g.getBoundingClientRect(), destino = scrollY + r.top - (r.height < innerHeight * 0.8 ? (innerHeight - r.height) / 2 : 90);
    if (lenis) lenis.scrollTo(destino, { duration: 1.3 }); else window.scrollTo({ top: destino, behavior: quieto ? "auto" : "smooth" });
  }, 120);
});

// ---------- 7) Shift + clic sin pintar texto ----------
document.addEventListener("mousedown", (e) => { if (e.shiftKey && e.target.closest && e.target.closest("#tabla-scroll tr.fila")) e.preventDefault(); });

// ---------- todo lo que depende de lo que la app repinta ----------
let pend = false;
const OPC = { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] };
const obs = new MutationObserver(() => { if (pend) return; pend = true; requestAnimationFrame(() => {
  pend = false; obs.disconnect();                       // lo que cambiamos acá no vuelve a disparar el observador
  try { armarMenu(); isla(); revelar(); capasYa(); } catch { /* decorativo */ }
  obs.takeRecords(); obs.observe(document.body, OPC); }); });
obs.observe(document.body, OPC);
if ("ResizeObserver" in window) { const ro = new ResizeObserver(capas); const mirar = () => { const sc = $("#tabla-scroll"); if (sc && !sc.dataset.msRo) { sc.dataset.msRo = "1"; ro.observe(sc); } }; setInterval(mirar, 1500); }
armarMenu(); isla(); revelar();
})();

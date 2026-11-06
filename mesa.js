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
try { if (localStorage.getItem("ms_menu_chico") === "1") document.documentElement.classList.add("ms-menu-chico"); } catch {}
const GRUPOS = { dash: "Resumen", reportes: "Campañas", cazador: "Producción", atc: "Ayuda" };
function armarMenu() {
  const n = $("#secciones"), pista = $("#sec-pista"); if (!n || !pista) return;
  const quien = (document.querySelector(".hola")?.textContent || "").replace(/^(hola|bienvenid[oa])[,!]?\s*/i, "").trim();
  if (n.dataset.mesa) { const b = $(".ms-hola b", n); if (b && quien && b.textContent !== quien) b.textContent = quien; return; }
  n.dataset.mesa = "1";
  const cab = document.createElement("div");
  cab.innerHTML = `<div class="ms-hola"><h2>Hola de nuevo,<br><b>${quien || "equipo"}</b></h2></div>`;
  n.insertBefore(cab, pista);
  const pl = document.createElement("button");
  pl.type = "button"; pl.className = "ms-plegar"; pl.setAttribute("aria-label", "Achicar o agrandar el menú");
  pl.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  pl.onclick = () => { const chico = !document.documentElement.classList.contains("ms-menu-chico"); document.documentElement.classList.toggle("ms-menu-chico", chico); try { localStorage.setItem("ms_menu_chico", chico ? "1" : "0"); } catch {} setTimeout(capas, 520); };
  document.body.append(pl);
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
    const html = filas.map((tr) => { const r = tr.getBoundingClientRect(), k = tr.dataset.k || "", bt = parseFloat(getComputedStyle(tr.cells[0] || tr).borderTopWidth) || 0;
      return `<i data-k="${k.replace(/"/g, "")}" class="${antes.has(k) ? "ya" : ""}" style="top:${(r.top - rc.top + bt).toFixed(1)}px;height:${(r.height - bt).toFixed(1)}px;left:${(rs.left - rc.left + 2).toFixed(1)}px;width:${(rs.width - 4).toFixed(1)}px"></i>`; }).join("");
    if (capa.innerHTML !== html) capa.innerHTML = html;
  }
}
addEventListener("resize", capas);

// ---------- 5) isla: círculo con el número; al cambiar la selección solo rueda el número ----------
let islaN = 0, islaVisible = false;
function isla() {
  const b = $("#barra"); if (!b) return;
  if (b.hidden) { islaVisible = false; islaN = 0; return; }
  const tx = $(".cuenta", b)?.textContent || "", n = +((tx.match(/\d+/) || ["0"])[0]);
  let entra = false;
  if (!islaVisible) { islaVisible = true; entra = !quieto; }
  let c = $(".ms-n", b);
  if (!c) { c = document.createElement("span"); c.className = "ms-n num"; b.prepend(c); }
  if (entra) {
    const fin = getComputedStyle(b).maxWidth;
    b.animate([{ maxWidth: "60px", transform: "translateX(-50%) scale(.3)", opacity: 0 }, { offset: .32, maxWidth: "60px", transform: "translateX(-50%) scale(1)", opacity: 1 }, { maxWidth: fin === "none" ? "980px" : fin, transform: "translateX(-50%) scale(1)", opacity: 1 }],
      { duration: 950, easing: "cubic-bezier(.16, 1, .3, 1)" });
    [...b.children].filter((x) => x !== c).forEach((x, i) => x.animate([{ opacity: 0, transform: "translateX(-12px)", filter: "blur(4px)" }, { opacity: 1, transform: "none", filter: "none" }],
      { duration: 600, delay: 380 + i * 40, easing: "cubic-bezier(.16, 1, .3, 1)", fill: "backwards" }));
  }
  if (c.dataset.n === String(n)) return;
  const antes = islaN; islaN = n; c.dataset.n = String(n);
  if (!antes || antes === n || quieto) { c.innerHTML = `<span class="ms-rueda">${n}</span>`; return; }
  const sube = n > antes;   // más seleccionadas: el número viejo sube y el nuevo entra de abajo; menos: al revés
  c.innerHTML = `<span class="ms-rueda ${sube ? "sale-arriba" : "sale-abajo"}">${antes}</span><span class="ms-rueda ${sube ? "entra-abajo" : "entra-arriba"}">${n}</span>`;
  setTimeout(() => { if (c.dataset.n === String(n)) c.innerHTML = `<span class="ms-rueda">${n}</span>`; }, 480);
}
// la app vuelve a armar la isla en cada cambio: la acomodamos en el mismo instante (antes de que se pinte) para que nada parpadee
const OPC_ISLA = { childList: true, attributes: true, attributeFilter: ["hidden"] };
const obsIsla = new MutationObserver(() => { obsIsla.disconnect(); try { isla(); } catch {} const b = $("#barra"); if (b) obsIsla.observe(b, OPC_ISLA); });
function mirarIsla() { const b = $("#barra"); if (b && !b.dataset.msObs) { b.dataset.msObs = "1"; obsIsla.observe(b, OPC_ISLA); } }

// ---------- encabezado como la maqueta ----------
const GRUPO_DE = { dash: "Resumen", reportes: "Campañas", umbrales: "Campañas", ranking: "Campañas", cazador: "Producción", creativos: "Producción", atc: "Ayuda" };
function encabezado() {
  const h1 = $(".top .marca h1"), act = $('#secciones [data-sec][aria-pressed="true"]');
  if (h1) { const g = GRUPO_DE[act?.dataset.sec] || "Resumen"; if (h1.dataset.grupo !== g) h1.dataset.grupo = g; }
  // el saldo de Whop va arriba a la derecha (la app lo vuelve a crear al entrar al Dashboard: dejamos uno solo)
  const nuevo = $(".controles #whop-barra"), arriba = $(".acciones-top");
  if (nuevo && arriba) { $$(".acciones-top #whop-barra").forEach((x) => x.remove()); arriba.prepend(nuevo); }
  // «Última lectura» + «Resultados en vivo»
  const ctl = $("#main .controles");
  if (ctl && $("#carr")) {
    let cab = $(".ms-cab", ctl);
    if (!cab) { cab = document.createElement("div"); cab.className = "ms-cab"; cab.innerHTML = `<div class="vivo"><i></i><span>Última lectura: <b class="num"></b></span></div><h3>Resultados<br><b>en vivo</b></h3>`; ctl.prepend(cab); }
    const t = ($("#hora", ctl)?.textContent || "").trim(), hh = (t.match(/\d{1,2}:\d{2}/) || [""])[0];
    const tx = /sin conexi/i.test(t) ? `sin conexión · ${hh}` : hh || "…";
    const bb = $(".vivo b", cab); if (bb && bb.textContent !== tx) bb.textContent = tx;
  }
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


// ---------- (06/11 c) saldo EtherFi arriba (en lugar del de Whop) ----------
function etherfi() {
  const arriba = $(".acciones-top"); if (!arriba || $(".ms-ether", arriba)) return;
  const b = document.createElement("button");
  b.type = "button"; b.className = "ms-ether"; b.title = "Saldo de la tarjeta EtherFi *0934";
  b.innerHTML = `<span class="pt" aria-hidden="true"></span><span class="tx"><small>Saldo EtherFi *0934</small><b class="num">${window.MESA_ETHERFI ? "US$ " + window.MESA_ETHERFI : "falta conectar"}</b></span>`;
  b.onclick = () => { if (typeof toast === "function") toast(window.MESA_ETHERFI ? "Saldo leído de la cuenta EtherFi" : "Para ver el saldo en vivo falta conectar la cuenta EtherFi (la dirección 0x de la app)."); };
  arriba.prepend(b);
}

// ---------- (06/11 c) fila de filtros en una línea: Cuenta · Oferta · Buscar · Comparar días · Solo seleccionadas · Ver apagadas · Columnas ----------
function filtros() {
  const f = $(".filtro-camp"); if (!f || f.dataset.ms) return;
  f.dataset.ms = "1";
  const sg = $("#sel-grupo"), cuenta = $("#f-cuenta");
  if (sg) {
    const lab = document.createElement("label"); lab.className = "sr"; lab.htmlFor = "ms-oferta"; lab.textContent = "Oferta";
    const sel = document.createElement("select"); sel.id = "ms-oferta"; sel.className = "campo ms-oferta";
    const copiar = () => { sel.innerHTML = sg.innerHTML; sel.value = sg.value; };
    copiar(); new MutationObserver(copiar).observe(sg, { childList: true, subtree: true, attributes: true });
    sel.onchange = () => { sg.value = sel.value; sg.dispatchEvent(new Event("change", { bubbles: true })); };
    (cuenta ? cuenta.after.bind(cuenta) : f.append.bind(f))(lab, sel);
  }
  for (const id of ["b-cmp", "t-solosel", "t-apagadas", "b-cols"]) { const x = document.getElementById(id); if (x) f.append(x); }
}

// ---------- (06/11 c) métricas secundarias: se esconden con animación ----------
let cerrandoSec = false;
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-sec]"); if (!b || cerrandoSec || quieto || b.getAttribute("aria-expanded") !== "true") return;
  const g = $(".carr .sec-grid"); if (!g) return;
  e.stopImmediatePropagation(); e.preventDefault();
  const h = g.getBoundingClientRect().height;
  const an = g.animate([{ height: h + "px", opacity: 1, marginTop: getComputedStyle(g).marginTop }, { height: "0px", opacity: 0, marginTop: "0px" }], { duration: 520, easing: "cubic-bezier(.65, 0, .35, 1)", fill: "forwards" });
  g.style.overflow = "hidden";
  an.onfinish = () => { cerrandoSec = true; b.click(); cerrandoSec = false; };
}, true);

// ---------- (06/11 c) tendencias: gráfico de los últimos 7 días en las tarjetas de arriba ----------
// Sale de los mismos datos por día que usa «Comparar días» (se guardan en este navegador para no volver a pedirlos).
const DIAS = {};
let diasPidiendo = false, diasListos = false;
async function cargarDias() {
  if (diasPidiendo || diasListos || typeof S === "undefined" || typeof api !== "function" || typeof cmpPer !== "function") return;
  if (!S.datos || !Object.keys(S.datos).length) return;
  diasPidiendo = true;
  const hoy = isoAR(new Date());
  for (let n = 7; n >= 1; n--) {
    const iso = isoMenos(hoy, n), per = cmpPer(iso);
    if (DIAS[iso]) continue;
    let guard = null; try { guard = JSON.parse(localStorage.getItem("ms_dia_" + iso) || "null"); } catch {}
    const viejo = guard && n === 1 && Date.now() - guard.t > 6 * 3600e3;   // ayer se vuelve a leer cada 6 h
    if (guard && !viejo) { DIAS[iso] = guard.g; continue; }
    try {
      const d = S.datos[per] || await api("dash", { q: `&periodo=${per}` });
      S.datos[per] ||= d;
      const g = Object.fromEntries((d?.grupos || []).map((x) => [x.clave, { ganancia: x.metricas?.ganancia, facturacion: x.metricas?.facturacion, roas: x.metricas?.roas, margen: x.metricas?.margen, gasto: x.metricas?.gasto }]));
      DIAS[iso] = g; try { localStorage.setItem("ms_dia_" + iso, JSON.stringify({ t: Date.now(), g })); } catch {}
    } catch { /* sin ese día: el gráfico sale con los que haya */ }
  }
  diasPidiendo = false; diasListos = true;
  try { pintarCarrusel(); } catch {}
}
function serieDe(clave, campo) {
  const hoy = isoAR(new Date()), xs = [];
  for (let n = 7; n >= 1; n--) { const v = DIAS[isoMenos(hoy, n)]?.[clave]?.[campo]; if (v != null && isFinite(v)) xs.push(+v); }
  return xs.length >= 3 ? xs : null;
}
window.MesaTend = (g, campo, valor, neutro) => {
  const ys = serieDe(g.clave, campo); if (!ys) return "";
  const ult = ys[ys.length - 1], prev = ys.slice(0, -1), prom = prev.reduce((a, b) => a + b, 0) / prev.length;
  const sube = ult >= prom, pct = prom ? Math.abs((ult - prom) / prom) * 100 : 0;
  if (neutro) return `<span class="ms-tend neutro num">${pct.toLocaleString("es-AR", { maximumFractionDigits: 1 })} % ${sube ? "más" : "menos"} que el promedio de la semana (ayer)</span>`;
  const w = 300, h = 80, min = Math.min(...ys), max = Math.max(...ys), rango = max - min || 1, n = ys.length;
  const x = (i) => (i / (n - 1)) * w, y = (v) => h - 6 - ((v - min) / rango) * (h - 26);
  const pts = ys.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const id = "mg" + campo + Math.random().toString(36).slice(2, 6);
  return `<svg class="ms-graf ${sube ? "sube" : "baja"}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="${sube ? "Viene subiendo" : "Viene bajando"} en los últimos 7 días" role="img">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".34"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
    <polygon points="0,${h} ${pts} ${w},${h}" fill="url(#${id})"/>
    <polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
};

// ---------- (06/11 c) Jarvis: estrella en lugar del átomo ----------
const ESTRELLA = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 2.8l2.1 6.1 6.1 2.1-6.1 2.1L12 19.2l-2.1-6.1L3.8 11l6.1-2.1z" fill="currentColor"/></svg>`;
function jarvis() {
  $$(".jv-fab .jv-orbe, .jv-cab .jv-orbe").forEach((o) => { if (!o.dataset.ms) { o.dataset.ms = "1"; o.innerHTML = ESTRELLA; } });
}

// ---------- todo lo que depende de lo que la app repinta ----------
let pend = false;
const OPC = { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] };
const obs = new MutationObserver(() => { if (pend) return; pend = true; requestAnimationFrame(() => {
  pend = false; obs.disconnect();                       // lo que cambiamos acá no vuelve a disparar el observador
  try { armarMenu(); encabezado(); etherfi(); filtros(); jarvis(); mirarIsla(); isla(); revelar(); capasYa(); cargarDias(); } catch { /* decorativo */ }
  obs.takeRecords(); obs.observe(document.body, OPC); }); });
obs.observe(document.body, OPC);
if ("ResizeObserver" in window) { const ro = new ResizeObserver(capas); const mirar = () => { const sc = $("#tabla-scroll"); if (sc && !sc.dataset.msRo) { sc.dataset.msRo = "1"; ro.observe(sc); } }; setInterval(mirar, 1500); }
armarMenu(); encabezado(); etherfi(); filtros(); jarvis(); mirarIsla(); isla(); revelar();
setInterval(cargarDias, 3000);
})();

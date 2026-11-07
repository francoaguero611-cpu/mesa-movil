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
    lenis = new Lenis({ lerp: 0.075, smoothWheel: true, wheelMultiplier: 1, // (06/11) modo continuo: con la rueda rápida no pega saltos (antes cada empujón reiniciaba la animación)
      prevent: (n) => !!(n.closest && n.closest(".jv-panel, .dialogo, .menu, .modal, .ad-ver, [data-lenis-prevent], textarea, select")) });
    window.MesaLenis = lenis;
    // (06/11) el encabezado flotante de la tabla se acomoda en el MISMO cuadro en que Lenis mueve la página (antes llegaba
    // un cuadro tarde con el evento scroll y al deslizar rápido titilaba o se veía corrido)
    lenis.on("scroll", () => { try { if (typeof ubicarCabFlotante === "function") ubicarCabFlotante(); } catch {} });
  } catch { lenis = null; }
}
// (07/11, Lorenzo) «deslizar rápido está roto: sube, se traba y rebota»: el deslizado suave (Lenis) peleaba con la inercia del
// trackpad. Se saca: queda el deslizado nativo de la Mac/celular, que ya es suave y no se rompe. (iniciarLenis queda sin usar.)
if (false) {
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
const GRUPOS = { dash: "Resumen", umbrales: "Campañas", cazador: "Producción", atc: "Ayuda" };
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
  if (entra && document.documentElement.classList.contains("ms-cel")) { // celular: panel que sube desde abajo
    b.animate([{ transform: "translateY(calc(100% + 90px))", opacity: .4 }, { transform: "none", opacity: 1 }], { duration: 520, easing: "cubic-bezier(.16, 1, .3, 1)" });
  } else if (entra) {
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
  $$(".rp-card, .atc-item, .umb-fila, .cr-carpeta").forEach((el, i) => {
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
let efSaldo = null, efHora = null, efPidiendo = false, efUlt = 0;
async function leerEtherfi() {
  if (efPidiendo || Date.now() - efUlt < 60e3 || typeof clave !== "function") return;
  if (typeof DEMO !== "undefined" && DEMO) { efSaldo = 3407.17; efHora = new Date(); efCash = { pct: 3, gastado: { hoy: 539.26, d7: 6020.17, total: 6020.17 }, cashback: { hoy: 16.18, d7: 180.61, total: 804.23 }, previo: 623.62 }; pintarEther(); return; }
  if (!clave()) return;
  efPidiendo = true; efUlt = Date.now();
  try {
    const r = await fetch("https://tppcpnfzcxxusdhrlmdx.supabase.co/functions/v1/etherfi-saldo", { headers: { "x-app-clave": clave() }, cache: "no-store" });
    const j = await r.json(); if (r.ok && j && j.saldo != null) { efSaldo = j.saldo; efHora = new Date(j.leido_en || Date.now()); if (j.cashback?.cashback) efCash = j.cashback; }
  } catch { /* se reintenta en 1 min */ }
  efPidiendo = false; pintarEther();
}
// (07/11, Lorenzo) cashback de EtherFi (3 % de lo gastado con la tarjeta) debajo del saldo: Hoy · 7 días · Total
let efCash = null, efPer = (() => { try { return localStorage.getItem("ms_cash_per") || "d7"; } catch { return "d7"; } })();
const usd2 = (n) => "US$ " + Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function pintarCash() {
  const c = $(".ms-cash"); if (!c) return;
  $$("[data-cash]", c).forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.cash === efPer)));
  const v = $(".ms-cash-v", c); if (!v) return;
  if (!efCash?.cashback) { v.textContent = "…"; return; }
  v.textContent = usd2(efCash.cashback[efPer]);
  c.title = `Cashback ${efCash.pct ?? 3} % de ${usd2(efCash.gastado?.[efPer])} gastados con la tarjeta (${efPer === "hoy" ? "hoy" : efPer === "d7" ? "últimos 7 días" : "desde el 05/11"}${efPer === "total" && efCash.previo ? ` + ${usd2(efCash.previo)} de antes del 05/11` : ""}). Es un cálculo: las compras que la tarjeta todavía no asentó entran después.`;
}
function pintarEther() {
  pintarCash();
  const b = $(".ms-ether .ms-ef-s"), h = $(".ms-ether .hace"); if (!b) return;
  b.textContent = efSaldo == null ? "leyendo…" : "US$ " + efSaldo.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (h && efHora) { const m = Math.max(0, Math.round((Date.now() - efHora) / 60e3)); h.textContent = m < 1 ? "recién" : `hace ${m} min`; }
}
function etherfi() {
  // (07/11, Lorenzo) el saldo EtherFi + cashback va en el Dashboard, ARRIBA de «Hoy · Ayer · Últimos 3 días · Personalizado»,
  // no en el encabezado (ahí dejaba los botones del menú corridos y anchos). Solo en el Dashboard.
  $$(".acciones-top .ms-ether").forEach((x) => x.parentNode.removeChild(x));
  const ctl = $("#main .controles"), per = ctl && $(".periodos", ctl); if (!ctl || !per) return;
  let der = $(".ms-der", ctl);
  if (!der) { der = document.createElement("div"); der.className = "ms-der"; ctl.insertBefore(der, per); der.append(per); }
  const arriba = der;
  if (!$(".ms-ether", arriba)) {
    const w = document.createElement("div"); w.className = "ms-ether";
    w.innerHTML = `<button type="button" class="ms-ef-saldo" title="Saldo de la tarjeta EtherFi *0934 (se lee de OP Mainnet cada minuto)"><span class="pt" aria-hidden="true"></span><span class="tx"><small>Saldo EtherFi *0934</small><b class="num ms-ef-s">leyendo…</b></span><span class="hace"></span></button>
      <div class="ms-cash"><span class="ms-cash-l">Cashback 3 %</span><span class="ms-cash-seg" role="group" aria-label="Período del cashback">${[["hoy", "Hoy"], ["d7", "7 días"], ["total", "Total"]].map(([k, t]) => `<button type="button" data-cash="${k}" aria-pressed="false">${t}</button>`).join("")}</span><b class="num ms-cash-v">…</b></div>`;
    $(".ms-ef-saldo", w).onclick = () => { efUlt = 0; leerEtherfi(); };
    $$("[data-cash]", w).forEach((x) => x.onclick = () => { efPer = x.dataset.cash; try { localStorage.setItem("ms_cash_per", efPer); } catch {} pintarCash(); });
    arriba.prepend(w);
  }
  pintarEther(); leerEtherfi();
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
  for (let n = 7; n >= 1; n--) { const iso = isoMenos(hoy, n), v = DIAS[iso]?.[clave]?.[campo]; if (v != null && isFinite(v)) xs.push({ iso, v: +v }); }
  return xs.length >= 3 ? xs : null;
}
// curva suave que pasa por todos los puntos (Catmull-Rom → Bézier)
function curva(P) {
  let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
window.MesaTend = (g, campo, valor, neutro) => {
  const se = serieDe(g.clave, campo); if (!se) return "";
  const ys = se.map((x) => x.v);
  const ult = ys[ys.length - 1], prev = ys.slice(0, -1), prom = prev.reduce((a, b) => a + b, 0) / prev.length;
  const sube = ult >= prom, pct = prom ? Math.abs((ult - prom) / prom) * 100 : 0;
  if (neutro) return `<span class="ms-tend neutro num">${pct.toLocaleString("es-AR", { maximumFractionDigits: 1 })} % ${sube ? "más" : "menos"} que el promedio de la semana (ayer)</span>`;
  const w = 300, h = 80, min = Math.min(...ys), max = Math.max(...ys), rango = max - min || 1, n = ys.length;
  const x = (i) => (i / (n - 1)) * w, y = (v) => h - 6 - ((v - min) / rango) * (h - 26);
  const P = ys.map((v, i) => [x(i), y(v)]), d = curva(P);
  const id = "mg" + campo + Math.random().toString(36).slice(2, 6);
  const datos = encodeURIComponent(JSON.stringify({ c: campo, a: valor, p: se.map((s2, i) => [s2.iso, s2.v, +(P[i][1] / h).toFixed(4)]) }));
  return `<svg class="ms-graf ${sube ? "sube" : "baja"}" data-ms="${datos}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="${sube ? "Viene subiendo" : "Viene bajando"} en los últimos 7 días" role="img">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".34"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
    <path d="${d} L${w},${h} L0,${h} Z" fill="url(#${id})"/>
    <path d="${d}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
};
// pasar el mouse por el gráfico: círculo en el punto + fecha, número de ese día y % contra ahora
const DSEM = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
function fmtCampo(c, v) {
  if (v == null || !isFinite(v)) return "—";
  if (c === "roas") return v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (c === "margen") return Math.round(v * 100).toLocaleString("es-AR") + " %";
  return "US$ " + v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
// altura de la curva (0 arriba, 1 abajo) en una posición horizontal (0 a 1): se muestrea el trazo una vez por gráfico
const MUESTRAS = new WeakMap();
function yCurva(svg, rx) {
  if (rx < 0 || rx > 1) return null;
  let m = MUESTRAS.get(svg);
  if (!m) {
    const tr = svg.querySelector("path[fill='none']"); if (!tr || !tr.getTotalLength) return null;
    const vb = svg.viewBox.baseVal, L = tr.getTotalLength(); m = [];
    for (let k = 0; k <= 120; k++) { const pt = tr.getPointAtLength((L * k) / 120); m.push([pt.x / vb.width, pt.y / vb.height]); }
    MUESTRAS.set(svg, m);
  }
  for (let k = 1; k < m.length; k++) if (m[k][0] >= rx) { const [x0, y0] = m[k - 1], [x1, y1] = m[k]; return x1 === x0 ? y1 : y0 + ((rx - x0) / (x1 - x0)) * (y1 - y0); }
  return m[m.length - 1][1];
}
document.addEventListener("pointermove", (e) => {
  const card = e.target.closest && e.target.closest(".mesa-fila1 .met");
  $$(".mesa-fila1 .met.ms-hover").forEach((c) => { if (c !== card) { c.classList.remove("ms-hover"); } });
  if (!card || e.pointerType === "touch") return;
  const svg = $(".ms-graf", card); if (!svg) return;
  let info; try { info = JSON.parse(decodeURIComponent(svg.dataset.ms)); } catch { return; }
  const rc = card.getBoundingClientRect(), rs = svg.getBoundingClientRect(), n = info.p.length;
  // (06/11, Lorenzo) solo si el mouse está cerca de la línea (no en toda la tarjeta)
  const yLinea = yCurva(svg, (e.clientX - rs.left) / rs.width);
  if (yLinea == null || Math.abs(e.clientY - (rs.top + yLinea * rs.height)) > 16) { card.classList.remove("ms-hover"); return; }
  const rel = Math.max(0, Math.min(1, (e.clientX - rs.left) / rs.width)), i = Math.round(rel * (n - 1)), [iso, v, yN] = info.p[i];
  let punto = $(".ms-punto", card), tip = $(".ms-tip", card), guia = $(".ms-guia", card);
  if (!punto) { punto = document.createElement("span"); punto.className = "ms-punto"; guia = document.createElement("span"); guia.className = "ms-guia"; tip = document.createElement("span"); tip.className = "ms-tip"; card.append(guia, punto, tip); }
  const px = rs.left - rc.left + (i / (n - 1)) * rs.width, py = rs.top - rc.top + yN * rs.height;
  punto.style.left = px + "px"; punto.style.top = py + "px"; guia.style.left = px + "px"; guia.style.top = py + "px";
  punto.style.color = getComputedStyle(svg).color;
  const ahora = info.a, dif = v ? ((ahora - v) / Math.abs(v)) * 100 : null;
  const f = new Date(iso + "T12:00:00Z"), fecha = `${DSEM[f.getUTCDay()]} ${f.getUTCDate()}/${f.getUTCMonth() + 1}`;
  tip.innerHTML = `<small>${fecha}</small><b class="num">${fmtCampo(info.c, v)}</b>${dif == null || !isFinite(dif) ? "" : `<em class="num ${dif >= 0 ? "sube" : "baja"}">ahora ${dif >= 0 ? "+" : "−"}${Math.abs(dif).toLocaleString("es-AR", { maximumFractionDigits: 1 })} %</em>`}`;
  const tw = tip.offsetWidth || 120;
  tip.style.left = Math.max(8, Math.min(rc.width - tw - 8, px - tw / 2)) + "px";
  tip.style.top = Math.max(6, py - (tip.offsetHeight || 54) - 12) + "px";
  card.classList.add("ms-hover");
}, { passive: true });
document.addEventListener("pointerleave", () => $$(".mesa-fila1 .met.ms-hover").forEach((c) => c.classList.remove("ms-hover")), true);

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
setInterval(() => { try { leerEtherfi(); pintarEther(); } catch {} }, 20000);
})();

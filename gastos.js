/* Gastos (11/11, Lorenzo: «una sección de gastos que me mida todos los gastos que tenemos a diario: APIMart, ElevenLabs, RunPod
   y todo lo que usamos día a día»).
   (11/11 b, Lorenzo: «más simple y más fachero»): «Gastado hoy» con el degradé tornasol (como Ganancia) y gráfico de LÍNEAS curvas,
   una por herramienta con su color, que se cruzan según lo gastado cada día. El gráfico es el «Line Chart» de 21st.dev
   (kuratlielia, id 35057) pasado a JS sin React: curvas monótonas que no se pasan de los datos, se dibujan de izquierda a derecha,
   se transforman al cambiar de período, cruz + puntitos + cartel al pasar el mouse (o flechas del teclado), leyenda que prende/apaga.
   Respaldo de la versión con barras: gastos.js.bak-barras.
   Backend: Edge Function «gastos» (?accion=ver · fijo). Lo sube cada Mac cada hora (scripts/gastos/medir.py). */
"use strict";
(() => {
const API = "https://tppcpnfzcxxusdhrlmdx.supabase.co/functions/v1/gastos";
const $ = (s, r = document) => r.querySelector(s);
const ls = { get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const clave = () => ls.get("dash_clave", "");
const isoAR = (ms = Date.now()) => new Date(ms - 3 * 3600e3).toISOString().slice(0, 10);
const sumar = (d, n) => new Date(Date.parse(d + "T12:00:00Z") + n * 86400e3).toISOString().slice(0, 10);
const numTx = (v, d) => Number(v || 0).toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
const usd = (n, dec) => { const v = Number(n || 0); return "US$ " + numTx(v, dec ?? (Math.abs(v) < 100 ? 2 : 0)); };
const ent = (n) => Number(n || 0).toLocaleString("es-AR");
const diaCorto = (f) => { const [, m, d] = f.split("-"); return `${+d}/${+m}`; };
const DSEM = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const dsem = (f) => DSEM[new Date(f + "T12:00:00Z").getUTCDay()];
function hace(f) { const s = (Date.now() - Date.parse(f)) / 1000; if (!isFinite(s)) return "—"; if (s < 90) return "recién"; if (s < 3600) return `hace ${Math.round(s / 60)} min`; if (s < 86400) return `hace ${Math.round(s / 3600)} h`; return `hace ${Math.round(s / 86400)} d`; }
const reducido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// un color por herramienta (bien distintos entre sí para que se lean las líneas que se cruzan)
const COL = { runpod: "#a78bfa", apimart: "#d9f99d", elevenlabs: "#5eead4", gemini: "#fbbf24", aws: "#f9a8d4" };
const COL_FIJO = ["#60a5fa", "#fb923c", "#f87171", "#86efac", "#e5e7eb", "#c084fc"];
function colorDe(id) {
  if (COL[id]) return COL[id];
  const i = (G.datos?.fijos || []).findIndex((f) => `fijo:${f.id}` === id);
  return COL_FIJO[(i < 0 ? 0 : i) % COL_FIJO.length];
}

// (11/11 d, Lorenzo) «si quiero ver los gastos de hoy, veo lo de hoy, después 7 días, después 30 días y después personalizado»
const PERIODOS = [["hoy", "Hoy"], ["7", "7 días"], ["30", "30 días"], ["pers", "Personalizado"]];
const G = { raiz: null, per: ls.get("gst_per3", "hoy"), datos: null, cargando: false, toast: null, login: null, editando: null, ocultas: new Set(),
  desde: ls.get("gst_desde", sumar(isoAR(), -13)), hasta: ls.get("gst_hasta", isoAR()) };
if (!PERIODOS.some(([k]) => k === G.per)) G.per = "hoy";

function rango() {
  const hoy = isoAR();
  if (G.per === "hoy") return [hoy, hoy];
  if (G.per === "pers") return [G.desde, G.hasta > hoy ? hoy : G.hasta];
  return [sumar(hoy, -(+G.per - 1)), hoy];
}
// el gráfico necesita varios días: con «Hoy» muestra los últimos 7 (hoy al final, para comparar)
function rangoGraf() { const [d, h] = rango(); return G.per === "hoy" ? [sumar(h, -6), h] : [d, h]; }

async function pedir(accion, q = "", body) {
  const r = await fetch(`${API}?accion=${accion}${q}`, { method: body ? "POST" : "GET", cache: "no-store",
    headers: { "x-app-clave": clave(), ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401) { G.login?.("Tu sesión venció: volvé a entrar."); throw new Error("sesión vencida"); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(d.error || `error ${r.status}`);
  return d;
}

async function cargar() {
  if (!G.raiz) return;
  G.cargando = true; G.raiz.classList.add("cargando");
  const h = isoAR(), m1 = h.slice(0, 8) + "01", d30 = sumar(h, -29);
  let desde = m1 < d30 ? m1 : d30; if (G.per === "pers" && G.desde < desde) desde = G.desde;
  try { G.datos = await pedir("ver", `&desde=${desde}&hasta=${h}`); G.error = null; }
  catch (e) { G.error = e.message; }
  G.cargando = false; G.raiz.classList.remove("cargando"); pintar();
}

function recortar() {
  const [d, h] = rango();
  const dias = G.datos.dias.filter((x) => x.fecha >= d && x.fecha <= h);
  const tot = {}; let total = 0;
  for (const x of dias) for (const [s, v] of Object.entries(x.servicios)) { tot[s] = (tot[s] || 0) + v; total += v; }
  const sv = G.datos.servicios.map((s) => ({ ...s, per: tot[s.id] || 0 })).sort((a, b) => b.per - a.per || b.total - a.total);
  return { dias, sv, total, d, h };
}

const perHTML = () => `<div class="gst-per-w"><div class="gst-per" role="tablist">${PERIODOS.map(([k, t]) => `<button type="button" role="tab" data-per="${k}" aria-selected="${G.per === k}">${t}</button>`).join("")}</div>${G.per === "pers" ? `<span class="gst-fechas"><label>Desde<input type="date" name="gst-desde" value="${G.desde}" max="${isoAR()}"></label><label>Hasta<input type="date" name="gst-hasta" value="${G.hasta}" max="${isoAR()}"></label></span>` : ""}</div>`;
const textoPer = () => { const [d, h] = rango(); return G.per === "hoy" ? "Hoy" : G.per === "pers" ? `Del ${diaCorto(d)} al ${diaCorto(h)}` : `Últimos ${G.per} días`; };
// ---------- tarjetas de arriba ----------
const plata = (v, dec) => { const n = Number(v || 0); return `<span class="mon">US$</span>${numTx(n, dec ?? (Math.abs(n) < 100 ? 2 : 0))}`; };
function kpis() {
  const D = G.datos, hoy = D.hoy;
  const porDia = Object.fromEntries(D.dias.map((x) => [x.fecha, x]));
  const tHoy = porDia[hoy]?.total || 0, tAyer = porDia[sumar(hoy, -1)]?.total || 0;
  const ult = (n) => D.dias.filter((x) => x.fecha > sumar(hoy, -n) && x.fecha <= hoy);
  const s7 = ult(7).reduce((t, x) => t + x.total, 0), s30 = ult(30).reduce((t, x) => t + x.total, 0);
  const mes = hoy.slice(0, 8), [y, m] = hoy.split("-").map(Number), dm = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const vaMes = D.dias.filter((x) => x.fecha.startsWith(mes)).reduce((t, x) => t + x.total, 0);
  const completos = D.dias.filter((x) => x.fecha < hoy && x.fecha >= sumar(hoy, -7));
  const prom = completos.length ? completos.reduce((t, x) => t + x.total, 0) / completos.length : 0;
  const proy = vaMes + prom * (dm - +hoy.slice(8));
  const dif = tHoy - tAyer;
  const top = Object.entries(porDia[hoy]?.servicios || {}).sort((a, b) => b[1] - a[1])[0];
  const nom = (id) => D.servicios.find((s) => s.id === id)?.nombre || id;
  return `<div class="gst-kpis">
    <div class="gst-k heroe"><span class="gst-kt">Gastado hoy</span><b class="gst-val">${plata(tHoy)}</b>
      ${tAyer ? `<span class="gst-tend ${dif > 0 ? "sube" : "baja"}">${dif > 0 ? "▲" : "▼"} ${usd(Math.abs(dif))} ${dif > 0 ? "más" : "menos"} que ayer</span>` : ""}
      ${top ? `<small>lo que más: ${esc(nom(top[0]))} · ${usd(top[1])}</small>` : ""}</div>
    <div class="gst-k"><span class="gst-kt">Últimos 7 días</span><b class="gst-val">${plata(s7, 0)}</b><small>${usd(s7 / 7)} por día</small></div>
    <div class="gst-k"><span class="gst-kt">Últimos 30 días</span><b class="gst-val">${plata(s30, 0)}</b><small>${usd(s30 / 30)} por día</small></div>
    <div class="gst-k"><span class="gst-kt">Proyección del mes</span><b class="gst-val">${plata(proy, 0)}</b><small>van ${usd(vaMes, 0)}</small></div>
  </div>`;
}

// ---------- gráfico de líneas (21st.dev «Line Chart», pasado a JS) ----------
const TOP = 14, GAP = 14, H = 260;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const limpio = (v) => Number(v.toPrecision(12));
function escala(lo0, hi0) { // grilla prolija: paso de 1, 2, 2,5 o 5 que entre en 4 filas, desde 0
  const lo = Math.min(0, lo0), hi = Math.max(hi0, lo + 1), mag = 10 ** Math.floor(Math.log10((hi - lo) / 4));
  for (const f of [1, 2, 2.5, 5, 10]) {
    const p = f * mag, b = Math.floor(lo / p) * p, t = Math.ceil(hi / p) * p;
    if ((t - b) / p <= 4 + 1e-9) { const ticks = []; for (let v = b; v <= t + p / 2; v += p) ticks.push(limpio(v)); return { min: limpio(b), max: limpio(t), ticks }; }
  }
  return { min: lo, max: hi, ticks: [lo, hi] };
}
// (11/11 d, Lorenzo: «redondas, bien redondas, que suba y baje haciendo curvas prolijas»): curva monótona (21st.dev), armada en la
// escala de raíz: puntas redondeadas, nunca se pasa de los datos (sin rulitos) y sin temblar cerca de 0.
function curva(vals) {
  if (!vals.length) return [];
  if (vals.length === 1) return [[0, vals[0]], [1, vals[0]]];
  const ult = vals.length - 1, paso = 1 / ult;
  const pend = vals.slice(1).map((v, i) => (v - vals[i]) / paso);
  const tan = vals.map((_, i) => i === 0 || i === ult ? 0 : (Math.sign(pend[i - 1]) + Math.sign(pend[i])) * Math.min(Math.abs(pend[i - 1]), Math.abs(pend[i]), Math.abs(pend[i - 1] + pend[i]) / 4) || 0);
  if (ult > 1) { tan[0] = (3 * pend[0] - tan[1]) / 2; tan[ult] = (3 * pend[ult - 1] - tan[ult - 1]) / 2; } else { tan[0] = tan[1] = pend[0]; }
  const n = Math.max(1, Math.min(40, Math.round(480 / ult))), pts = [];
  for (let i = 0; i < ult; i++) {
    const lo = Math.min(vals[i], vals[i + 1]), hi = Math.max(vals[i], vals[i + 1]);
    for (let s = 0; s < n; s++) {
      const t = s / n, t2 = t * t, t3 = t2 * t;
      const v = (2 * t3 - 3 * t2 + 1) * vals[i] + (t3 - 2 * t2 + t) * paso * tan[i] + (3 * t2 - 2 * t3) * vals[i + 1] + (t3 - t2) * paso * tan[i + 1];
      pts.push([(i + t) * paso, clamp(v, lo, hi)]);
    }
  }
  pts.push([1, vals[ult]]);
  return pts;
}
function valorEn(sh, x) {
  if (!sh.length) return 0;
  let a = 0, b = sh.length - 1;
  if (x <= sh[a][0]) return sh[a][1]; if (x >= sh[b][0]) return sh[b][1];
  while (b - a > 1) { const m = (a + b) >> 1; if (sh[m][0] < x) a = m; else b = m; }
  const [x0, y0] = sh[a], [x1, y1] = sh[b];
  return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}
const GRILLA = Array.from({ length: 241 }, (_, i) => i / 240);
const easeOut = (t) => 1 - Math.pow(1 - t, 3), easeInOut = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function tween(dur, ease, fn, fin) {
  if (reducido()) { fn(1); fin?.(); return { stop() {} }; }
  let vivo = true; const t0 = performance.now();
  const paso = (t) => { if (!vivo) return; const p = Math.min(1, (t - t0) / dur); fn(ease(p)); if (p < 1) requestAnimationFrame(paso); else fin?.(); };
  requestAnimationFrame(paso);
  return { stop() { vivo = false; } };
}

// estado del gráfico: vive entre repintados para poder transformar las líneas de un período al otro
const CH = { pistas: new Map(), min: 0, max: 100, w: 0, dibujado: 0, cursor: 1, activo: null, dias: [], series: [], morf: null, esc: null, cur: null, ro: null };

function graficoHTML() {
  return `<div class="gst-card gst-graf-card">
    <div class="gst-cab"><h3>Día por día <small class="gst-graf-sub"></small></h3></div>
    <div class="gst-ley" role="group" aria-label="Herramientas"></div>
    <div class="gst-chart">
      <div class="gst-gutter" aria-hidden="true"></div>
      <div class="gst-plot" tabindex="0" role="slider" aria-label="Gasto por día, recorré los días con las flechas" style="height:${H}px">
        <svg class="gst-svg" width="100%" height="${H}" aria-hidden="true" focusable="false">
          <defs><clipPath id="gst-dib" clipPathUnits="userSpaceOnUse"><rect x="-8" y="-16" width="0" height="${H + 32}"/></clipPath></defs>
          <g class="gst-grid"></g>
          <line class="gst-base" x1="0" x2="100%" y1="${H - .5}" y2="${H - .5}"/>
          <line class="gst-cruz" y1="${TOP - 4}" y2="${H}"/>
          <g class="gst-lineas" clip-path="url(#gst-dib)"></g>
          <g class="gst-puntos"></g>
        </svg>
        <div class="gst-tip" aria-hidden="true"></div>
      </div>
      <div class="gst-eje" aria-hidden="true"></div>
    </div></div>`;
}

function montarGrafico(R) {
  const card = $(".gst-graf-card", G.raiz); if (!card) return;
  const plot = $(".gst-plot", card);
  const [gd, gh] = rangoGraf();
  CH.dias = G.datos.dias.filter((x) => x.fecha >= gd && x.fecha <= gh);
  $(".gst-graf-sub", card).textContent = G.per === "hoy" ? "últimos 7 días, hoy al final" : textoPer().toLowerCase();
  CH.series = R.sv.filter((s) => CH.dias.some((x) => x.servicios[s.id] > 0)).map((s) => ({ key: s.id, label: s.nombre, color: colorDe(s.id) }));
  // leyenda (prende / apaga cada herramienta)
  $(".gst-ley", card).innerHTML = CH.series.map((s) => `<button type="button" class="gst-tog" data-serie="${esc(s.key)}" aria-pressed="${!G.ocultas.has(s.key)}" style="--serie:${s.color}"><i></i>${esc(s.label)}</button>`).join("");
  // líneas y puntos (se recrean; la forma vieja queda en CH.pistas para transformarla)
  $(".gst-lineas", card).innerHTML = CH.series.map((s) => `<g data-k="${esc(s.key)}" style="--serie:${s.color}"><path class="gst-area"/><path class="gst-linea"/></g>`).join("");
  $(".gst-puntos", card).innerHTML = CH.series.map((s) => `<circle r="4" data-k="${esc(s.key)}" style="--serie:${s.color}"/>`).join("");
  // eje de días
  const ult = CH.dias.length - 1, cada = Math.max(1, Math.ceil(CH.dias.length / Math.max(2, Math.floor((plot.clientWidth || 600) / 76))));
  $(".gst-eje", card).innerHTML = CH.dias.map((x, i) => (ult - i) % cada === 0 ? `<span style="left:${ult ? i / ult * 100 : 50}%;transform:translateX(-${ult ? i / ult * 100 : 50}%)">${dsem(x.fecha)} ${diaCorto(x.fecha)}</span>` : "").join("");
  // formas nuevas y transformación desde las de antes
  // (11/11 d) la curva se arma ya en la escala de raíz (si no, cerca de 0 la raíz agrandaba cada vaivén y «temblaba»)
  const metas = new Map(CH.series.map((s) => [s.key, curva(CH.dias.map((x) => raiz(x.servicios[s.key] || 0)))]));
  const movs = [];
  for (const [k, meta] of metas) {
    const p = CH.pistas.get(k);
    if (!p) { CH.pistas.set(k, { forma: meta, pres: G.ocultas.has(k) ? 0 : 1 }); continue; }
    const xs = [...new Set([...GRILLA, ...meta.map(([x]) => x)])].sort((a, b) => a - b);
    movs.push({ p, xs, de: xs.map((x) => valorEn(p.forma, x)), a: xs.map((x) => valorEn(meta, x)), meta });
  }
  for (const k of [...CH.pistas.keys()]) if (!metas.has(k)) CH.pistas.delete(k);
  CH.morf?.stop();
  if (movs.length) CH.morf = tween(650, easeOut, (t) => { for (const m of movs) m.p.forma = m.xs.map((x, i) => [x, m.de[i] + (m.a[i] - m.de[i]) * t]); pintarGraf(); }, () => { for (const m of movs) m.p.forma = m.meta; pintarGraf(); });
  reescalar(false);
  medir();
  if (CH.dibujado < 1) tween(1100, easeInOut, (t) => { CH.dibujado = t; pintarGraf(); });
  CH.activo = null; card.querySelector(".gst-chart").removeAttribute("data-mirando");
  pintarGraf();
  if (!CH.ro && window.ResizeObserver) { CH.ro = new ResizeObserver(() => medir()); }
  CH.ro?.disconnect(); CH.ro?.observe(plot);
}

// (11/11) escala de raíz cuadrada: RunPod gasta 10 veces más que el resto y aplastaba las otras líneas contra el piso.
// Así los montos chicos se separan y las líneas se cruzan; el cartel siempre muestra el monto real.
const raiz = (v) => Math.sqrt(Math.max(0, v));
function reescalar(animar = true) {
  let hi = 0;
  for (const s of CH.series) if (!G.ocultas.has(s.key)) for (const x of CH.dias) hi = Math.max(hi, x.servicios[s.key] || 0);
  const max = escala(0, hi || 10).max;
  const ticks = [0, 1 / 16, 1 / 4, 9 / 16, 1].map((k) => max * k);
  const card = $(".gst-graf-card", G.raiz); if (!card) return;
  const y = (v) => Math.round(TOP + (1 - raiz(v) / raiz(max)) * (H - TOP)) + .5;
  const tx = (v) => v >= 1000 ? numTx(v / 1000, 1) + " k" : "US$ " + numTx(v, v > 0 && v < 10 && v % 1 ? 1 : 0);
  $(".gst-grid", card).innerHTML = ticks.slice(1).map((v) => `<line x1="0" x2="100%" y1="${y(v)}" y2="${y(v)}"/>`).join("");
  $(".gst-gutter", card).innerHTML = ticks.map((v) => `<span style="top:${y(v)}px">${tx(v)}</span>`).join("");
  const M0 = CH.max;
  CH.esc?.stop(); CH.min = 0;
  if (!animar) { CH.max = max; return; }
  CH.esc = tween(550, easeOut, (t) => { CH.max = M0 + (max - M0) * t; pintarGraf(); });
}

function medir() { const p = $(".gst-plot", G.raiz); if (!p) return; CH.w = p.clientWidth; pintarGraf(); }

function pintarGraf() {
  const card = $(".gst-graf-card", G.raiz), w = CH.w; if (!card || !w) return;
  const rm = raiz(CH.max) || 1;
  const aY = (u) => TOP + (1 - u / rm) * (H - TOP);   // u = raíz del monto (la forma ya viene en esa escala)
  const at = CH.cursor, ys = [];
  for (const s of CH.series) {
    const p = CH.pistas.get(s.key); if (!p) continue;
    const y = (v) => aY(v * p.pres);
    const d = p.forma.length ? "M" + p.forma.map(([x, v]) => `${(x * w).toFixed(1)},${y(v).toFixed(1)}`).join("L") : "";
    const g = card.querySelector(`.gst-lineas g[data-k="${CSS.escape(s.key)}"]`);
    if (g) { g.style.opacity = String(p.pres); g.children[1].setAttribute("d", d); g.children[0].setAttribute("d", d ? `${d}L${w},${H}L0,${H}Z` : ""); }
    const c = card.querySelector(`.gst-puntos circle[data-k="${CSS.escape(s.key)}"]`);
    if (c && p.forma.length) { const cy = y(valorEn(p.forma, at)); c.setAttribute("cx", (at * w).toFixed(1)); c.setAttribute("cy", cy.toFixed(1)); c.style.opacity = p.pres > .5 ? "" : "0"; if (p.pres > .5) ys.push(cy); }
  }
  $("#gst-dib rect", card)?.setAttribute("width", String(CH.dibujado * (w + 16)));
  const cx = Math.round(at * w) + .5, cruz = $(".gst-cruz", card);
  cruz.setAttribute("x1", cx); cruz.setAttribute("x2", cx);
  const tip = $(".gst-tip", card);
  if (CH.activo != null && tip) {
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = cx + GAP; if (x + tw > w) x = cx - GAP - tw;
    const mid = ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : H / 2;
    tip.style.transform = `translate(${clamp(x, 0, Math.max(0, w - tw))}px, ${clamp(mid - th / 2, 0, Math.max(0, H - th))}px)`;
  }
}

function mirar(i) { // mueve la cruz al día i (null = suelta)
  const card = $(".gst-graf-card", G.raiz); if (!card) return;
  const ch = $(".gst-chart", card), ult = CH.dias.length - 1;
  if (i == null || ult < 0) { CH.activo = null; ch.removeAttribute("data-mirando"); return; }
  i = clamp(i, 0, ult);
  const primero = CH.activo == null; if (CH.activo === i) return;
  CH.activo = i; ch.setAttribute("data-mirando", "");
  const x = CH.dias[i];
  const filas = CH.series.filter((s) => !G.ocultas.has(s.key)).map((s) => ({ ...s, v: x.servicios[s.key] || 0 })).sort((a, b) => b.v - a.v);
  $(".gst-tip", card).innerHTML = `<p class="gst-tt">${dsem(x.fecha)} ${diaCorto(x.fecha)} <b>${usd(x.total)}</b></p>${filas.map((s) => `<p class="gst-tr" style="--serie:${s.color}"><i></i><span>${esc(s.label)}</span><em>${usd(s.v)}</em></p>`).join("")}`;
  const to = ult > 0 ? i / ult : .5;
  CH.cur?.stop();
  if (primero) { CH.cursor = to; pintarGraf(); return; }
  const de = CH.cursor; CH.cur = tween(220, easeOut, (t) => { CH.cursor = de + (to - de) * t; pintarGraf(); });
}

function alternar(k) {
  if (G.ocultas.has(k)) G.ocultas.delete(k); else G.ocultas.add(k);
  if (CH.series.every((s) => G.ocultas.has(s.key))) G.ocultas.delete(k); // siempre queda al menos una
  const b = $(`.gst-tog[data-serie="${CSS.escape(k)}"]`, G.raiz); if (b) b.setAttribute("aria-pressed", !G.ocultas.has(k));
  for (const s of CH.series) {
    const p = CH.pistas.get(s.key); if (!p) continue; const to = G.ocultas.has(s.key) ? 0 : 1; if (p.pres === to) continue;
    const de = p.pres; p.fade?.stop(); p.fade = tween(500, easeOut, (t) => { p.pres = de + (to - de) * t; pintarGraf(); });
  }
  reescalar(true);
  if (CH.activo != null) { const i = CH.activo; CH.activo = null; mirar(i); }
}

// ---------- lista y suscripciones ----------
function detalle(s) {
  const d = s.detalle_hoy || {}, out = [];
  if (s.id === "runpod") {
    if (d.gastando_por_hora > 0) out.push(`<span class="gst-alerta">● gastando ${usd(d.gastando_por_hora)}/h ahora</span>`);
    if (d.pods) out.push(`hoy ${d.pods} pods · ${numTx(d.horas, 1)} h`);
    if (d.saldo != null) out.push(`saldo ${usd(d.saldo)}`);
  }
  if (s.id === "elevenlabs") { if (d.creditos != null) out.push(`hoy ${ent(d.creditos)} créditos`); if (d.creditos_libres != null) out.push(`quedan ${ent(d.creditos_libres)}`); if (d.plan_usd_mes) out.push(`plan ${usd(d.plan_usd_mes, 0)}/mes`); }
  if (s.id === "gemini" && d.consultas) out.push(`hoy ${ent(d.consultas)} consultas`);
  if (s.id === "apimart" && s.saldo != null) out.push(`saldo ${usd(s.saldo)}`);
  if (s.fijo) { const f = G.datos.fijos.find((x) => `fijo:${x.id}` === s.id); if (f) out.push(`suscripción · ${usd(f.usd_mes, 0)}/mes`); }
  return out.join(" · ");
}
function lista(R) {
  return `<div class="gst-card"><div class="gst-cab"><h3>Cuánto se fue en cada herramienta</h3>${perHTML()}</div><div class="gst-subtot"><span>${textoPer()}</span><b>${usd(R.total)}</b></div>
    ${R.sv.map((s) => `<div class="gst-fila"><i style="background:${colorDe(s.id)}"></i><div class="gst-nom"><b>${esc(s.nombre)}</b><small>${detalle(s)}</small></div>
      <div class="gst-num"><b>${usd(s.per)}</b><small>${R.total ? Math.round(s.per / R.total * 100) : 0} %</small></div></div>`).join("") || `<p class="gst-vacio">Todavía no hay gastos medidos.</p>`}</div>`;
}
function fijos() {
  const F = G.datos.fijos || [], mes = F.filter((f) => f.activo).reduce((t, f) => t + Number(f.usd_mes), 0);
  return `<div class="gst-card"><div class="gst-cab"><h3>Suscripciones fijas <small>se reparten por día</small></h3><span class="gst-tot">${usd(mes, 0)}/mes</span></div>
    ${F.map((f) => G.editando === f.id ? formFijo(f) : `<div class="gst-fijo${f.activo ? "" : " off"}"><i style="background:${colorDe("fijo:" + f.id)}"></i><b>${esc(f.nombre)}${f.activo ? "" : " <small>pausada</small>"}</b><span>${usd(f.usd_mes, f.usd_mes % 1 ? 2 : 0)}/mes</span>
      <span class="gst-acc"><button type="button" class="btn chico" data-editar="${f.id}">Editar</button><button type="button" class="btn chico" data-pausar="${f.id}">${f.activo ? "Pausar" : "Reactivar"}</button></span></div>`).join("")}
    ${G.editando === "nuevo" ? formFijo(null) : `<button type="button" class="btn chico gst-nuevo" data-editar="nuevo">+ Agregar suscripción</button>`}</div>`;
}
function formFijo(f) {
  return `<form class="gst-form" data-id="${f ? f.id : ""}">
    <label>Nombre<input name="nombre" required maxlength="80" value="${esc(f?.nombre || "")}" placeholder="Ej.: Claude Max"></label>
    <label>US$ por mes<input name="usd_mes" required inputmode="decimal" value="${f ? String(f.usd_mes).replace(".", ",") : ""}" placeholder="0"></label>
    <label>Desde<input name="desde" type="date" value="${f?.desde || isoAR()}"></label>
    <span class="gst-acc"><button type="submit" class="btn chico pri">Guardar</button><button type="button" class="btn chico" data-cancelar>Cancelar</button>
    ${f ? `<button type="button" class="btn chico peligro" data-borrar="${f.id}">Borrar</button>` : ""}</span></form>`;
}

function pintar() {
  const r = G.raiz; if (!r) return;
  const cab = `<div class="gst-top"><h2>Gastos de la empresa</h2>${G.datos ? `<span class="gst-med">medido ${hace(G.datos.medido)} · se mide solo cada hora</span>` : ""}</div>`;
  if (!G.datos) {
    r.innerHTML = cab + (G.cargando || !G.error ? `<p class="vacio"><span class="cargador"></span>Midiendo los gastos…</p>`
      : `<div class="err-box" role="alert"><b>No se pudieron leer los gastos.</b> ${esc(G.error)}<div><button type="button" class="btn chico" data-reintentar>Reintentar</button></div></div>`);
    return;
  }
  const R = recortar();
  const ya = $(".gst-graf-card", r);
  if (ya) { // solo cambia lo que depende del período: el gráfico se transforma en su lugar
    r.querySelectorAll("[data-per]").forEach((b) => b.setAttribute("aria-selected", b.dataset.per === G.per));
    $(".gst-kpis", r).outerHTML = kpis();
    $(".gst-lista", r).innerHTML = lista(R);
    $(".gst-fijos", r).innerHTML = fijos();
  } else {
    r.innerHTML = `${cab}${G.error ? `<p class="gst-aviso">No se pudo actualizar: ${esc(G.error)}</p>` : ""}${kpis()}<div class="gst-lista">${lista(R)}</div>${graficoHTML()}<div class="gst-fijos">${fijos()}</div>`;
  }
  montarGrafico(R);
}

// ---------- eventos ----------
function eventos(r) {
  r.addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.per) { const antes = G.per; G.per = b.dataset.per; ls.set("gst_per3", G.per); if (G.per === "pers" || antes === "pers") { pintar(); cargar(); } else pintar(); return; }
    if (b.dataset.serie) return alternar(b.dataset.serie);
    if (b.hasAttribute("data-reintentar")) return cargar();
    if (b.dataset.editar) { G.editando = b.dataset.editar === "nuevo" ? "nuevo" : +b.dataset.editar; pintar(); $(".gst-form input", r)?.focus(); return; }
    if (b.hasAttribute("data-cancelar")) { G.editando = null; pintar(); return; }
    if (b.dataset.pausar) { const f = G.datos.fijos.find((x) => x.id === +b.dataset.pausar); if (f) await guardar({ ...f, activo: !f.activo }); return; }
    if (b.dataset.borrar) {
      if (b.dataset.seguro !== "1") { b.dataset.seguro = "1"; b.textContent = "¿Seguro? Tocá de nuevo"; return; }
      await guardar({ id: +b.dataset.borrar, borrar: true });
    }
  });
  r.addEventListener("change", (e) => {
    const n = e.target.name; if (n !== "gst-desde" && n !== "gst-hasta") return;
    if (n === "gst-desde") G.desde = e.target.value || G.desde; else G.hasta = e.target.value || G.hasta;
    if (G.desde > G.hasta) [G.desde, G.hasta] = [G.hasta, G.desde];
    ls.set("gst_desde", G.desde); ls.set("gst_hasta", G.hasta); cargar();
  });
  r.addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.target, fd = new FormData(f);
    const monto = Number(String(fd.get("usd_mes") || "").replace(/\./g, "").replace(",", "."));
    if (!isFinite(monto) || monto < 0) { G.toast?.("El monto tiene que ser un número (US$ por mes).", "error"); return; }
    await guardar({ id: f.dataset.id ? +f.dataset.id : undefined, nombre: fd.get("nombre"), usd_mes: monto, desde: fd.get("desde"), activo: true });
  });
  const idx = (e) => { const p = e.target.closest(".gst-plot"), rc = p.getBoundingClientRect(), ult = CH.dias.length - 1; return ult < 1 ? 0 : clamp(Math.round((e.clientX - rc.left) / rc.width * ult), 0, ult); };
  r.addEventListener("pointermove", (e) => { if (e.target.closest(".gst-plot") && (e.pointerType === "mouse" || e.buttons)) mirar(idx(e)); });
  r.addEventListener("pointerdown", (e) => { if (e.target.closest(".gst-plot")) mirar(idx(e)); });
  r.addEventListener("pointerout", (e) => { if (e.pointerType === "mouse" && e.target.closest(".gst-plot") && !e.relatedTarget?.closest?.(".gst-plot")) mirar(null); });
  r.addEventListener("keydown", (e) => {
    if (!e.target.closest?.(".gst-plot")) return;
    const ult = CH.dias.length - 1, de = CH.activo ?? ult + 1;
    const k = { ArrowLeft: de - 1, ArrowRight: CH.activo == null ? ult : de + 1, Home: 0, End: ult }[e.key];
    if (e.key === "Escape") { mirar(null); return; }
    if (k === undefined) return; e.preventDefault(); mirar(k);
  });
}

async function guardar(body) {
  try { await pedir("fijo", "", body); G.editando = null; G.toast?.(body.borrar ? "Suscripción borrada." : "Guardado.", "ok"); await cargar(); }
  catch (e) { G.toast?.("No se pudo guardar: " + e.message, "error", 6000); }
}

let reloj = 0;
window.Gastos = {
  montar(raiz, { login, toast } = {}) {
    G.raiz = raiz; G.login = login; G.toast = toast; G.editando = null;
    CH.pistas.clear(); CH.dibujado = 0; CH.activo = null;
    eventos(raiz); pintar(); cargar();
    clearInterval(reloj); reloj = setInterval(() => { if (!document.body.contains(G.raiz)) return clearInterval(reloj); if (!document.hidden) cargar(); }, 5 * 60e3);
  },
};
})();

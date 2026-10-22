/* Workspace (nació como «Taller» el 22/10 y ese mismo día reemplazó al Workspace viejo de etapas) — sección del Dashboard (pedido de Lorenzo: «ver la creación de los creativos y VSL sin preguntarte
   cómo venís»). Un tablero tipo Miro de fondo negro: cuadrícula infinita con zoom, un marco por oferta, cada creativo/VSL
   como tarjeta con su checklist propio, flechas hacia los servicios que está usando (RunPod, Atlas, ElevenLabs…),
   saldos, tiempo que falta, vista previa para aprobar o pedir corrección y la terminal de cada pieza.
   app.js lo carga la primera vez y lo monta con window.Taller.montar(raiz, ctx).
   Backend: Edge Function ws-evento (acciones taller*). Claude lo alimenta con Segundo-cerebro-business/scripts/taller.py. */
"use strict";
(() => {
let CTX = { login: () => {}, toast: () => {} };

const API = "https://tppcpnfzcxxusdhrlmdx.supabase.co/functions/v1/ws-evento";
const TZ_AR = "America/Argentina/Buenos_Aires";
const POLL_MS = 5000, POLL_LOG_MS = 3000;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ls = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const url = (u) => /^https?:\/\//i.test(String(u || "")) ? String(u) : "";
const clave = () => ls.get("dash_clave", "");
const reducido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const hora = (iso, seg = true) => { try { return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", ...(seg ? { second: "2-digit" } : {}), hour12: false, timeZone: TZ_AR }); } catch { return ""; } };
const num = (n, d = 0) => Number(n).toLocaleString("es-AR", { maximumFractionDigits: d, minimumFractionDigits: d });
const hace = (iso) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  return s < 60 ? "recién" : s < 3600 ? `hace ${Math.round(s / 60)} min` : s < 86400 ? `hace ${Math.round(s / 3600)} h` : `hace ${Math.round(s / 86400)} d`;
};
const minTxt = (m) => m < 1 ? "menos de 1 min" : m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, "0")}`;

// ---------- catálogo ----------
const ESTADO = {
  en_cola: ["En cola", "c-gris"],
  trabajando: ["Trabajando", "c-amb"],
  esperando: ["Esperando", "c-gris"],
  para_revisar: ["Para revisar", "c-cian"],
  corrigiendo: ["Corrigiendo", "c-vio"],
  aprobado: ["Aprobado", "c-ok"],
  listo: ["Listo", "c-ok"],
  error: ["Error", "c-err"],
  pausado: ["Pausado", "c-gris"],
};
const TIPO = { creativo: "ANUNCIO", anuncio: "ANUNCIO", vsl: "VSL", reno: "RENO", iteracion: "ITERACIÓN", traduccion: "TRADUCCIÓN", ugc: "UGC", oto: "VSL OTO", avatar: "AVATAR", imagen: "IMAGEN",
  landing: "LANDING", tienda: "TIENDA", checkout: "CHECKOUT", entregable: "ENTREGABLE", postventa: "POST-VENTA", campana: "CAMPAÑA", tracking: "TRACKING", investigacion: "INVESTIGACIÓN", quiz: "QUIZ" };
const PASO_ICO = { pend: "○", curso: "●", ok: "✓", error: "✕", salto: "–" };
// servicio → [nombre, qué hace, color, clave del saldo]
const SERV = {
  claude: ["Claude", "el que coordina", "#d97757", null],
  elevenlabs: ["ElevenLabs", "voces y transcripción", "#b8a6ff", "elevenlabs"],
  atlas: ["Atlas Cloud", "clips IA (Seedance)", "#4cc9f0", "atlas"],
  runpod: ["RunPod", "GPUs: lip sync y H3", "#a3e635", "runpod"],
  apimart: ["API Mart · Grok", "clips de 15 s", "#f472b6", null],
  grok: ["Grok", "clips con diálogo", "#f472b6", null],
  higgsfield: ["Higgsfield", "avatares Soul", "#facc15", null],
  heygen: ["HeyGen", "avatares que hablan", "#fb923c", "heygen"],
  vmake: ["VMake", "borrar subtítulos", "#38bdf8", "vmake"],
  gpt: ["GPT Image", "imágenes y portadas", "#34d399", null],
  gemini: ["Gemini", "ver videos / QA", "#60a5fa", null],
  lambda: ["AWS Lambda", "render en la nube", "#ff9900", "aws"],
  aws: ["AWS", "render y entrega", "#ff9900", "aws"],
  remotion: ["Remotion", "edición y subtítulos", "#818cf8", null],
  ffmpeg: ["ffmpeg (Mac)", "cortes, música, unión", "#94a3b8", "disco"],
  mac: ["Mac", "trabajo local", "#94a3b8", "disco"],
  drive: ["Drive", "entrega", "#22c55e", null],
  panda: ["Panda Video", "hosting del VSL", "#fbbf24", null],
  meta: ["Meta", "anuncios y campañas", "#3b82f6", null],
  impultienda: ["Impultienda", "tienda, landing, checkout", "#a78bfa", null],
  shopify: ["Shopify", "tienda", "#95bf47", null],
  stripe: ["Stripe", "cobros", "#635bff", null],
  utmify: ["UTMify", "tracking", "#22d3ee", null],
  canva: ["Canva", "diseño de entregables", "#00c4cc", null],
};
const servDe = (k) => SERV[k] || [k.charAt(0).toUpperCase() + k.slice(1), "", "#9ca3af", null];
// mínimo para avisar «falta saldo» (en la unidad que mide saldos.py)
const MIN_SALDO = { elevenlabs: 20000, atlas: 2, runpod: 5, heygen: 1, disco: 10 };

// ---------- estado ----------
const T = {
  raiz: null, d: null, error: null, cargando: false, timer: null, timerLog: null,
  cam: { x: 40, y: 90, z: 0.7 }, marcos: [], firma: "",
  sel: null, log: [], logUlt: 0, logDe: null,
  filtro: ls.get("tl_filtro", "todo"), persona: ls.get("tl_persona", "todos"),
  term: false, demo: new URLSearchParams(location.search).get("demo") === "1",
  anim: 0, primeraVez: true,
};

// ---------- API ----------
async function api(accion, q = "", body = null) {
  let r;
  try {
    r = await fetch(`${API}?accion=${accion}${q}`, body ? { method: "POST", headers: { "x-app-clave": clave(), "content-type": "application/json" }, body: JSON.stringify(body) }
      : { headers: { "x-app-clave": clave() }, cache: "no-store" });
  } catch { const e = new Error("Sin conexión con el servidor"); e.code = 0; throw e; }
  if (r.status === 401) { const e = new Error("Clave incorrecta"); e.code = 401; throw e; }
  let j = null; try { j = await r.json(); } catch {}
  if (!r.ok || j?.error) { const e = new Error(j?.error || `Error ${r.status}`); e.code = r.status; throw e; }
  return j;
}
async function cargar() {
  if (T.cargando) return;
  T.cargando = true;
  try {
    T.d = T.demo ? demo() : await api("taller", "&dias=7");
    T.error = null;
  } catch (e) {
    if (e.code === 401) { desmontar(); CTX.login("Entrá de nuevo para ver el Workspace."); return; }
    T.error = e.message;
  } finally { T.cargando = false; }
  pintar();
}

// ---------- cálculos ----------
function progreso(it) {
  if (it.progreso != null) return Math.max(0, Math.min(100, Number(it.progreso)));
  if (["aprobado", "listo"].includes(it.estado)) return 100;
  const ps = it.pasos || [];
  if (!ps.length) return it.estado === "para_revisar" ? 100 : 0;
  const v = ps.reduce((a, p) => a + (p.estado === "ok" || p.estado === "salto" ? 1 : p.estado === "curso" ? (p.n != null && p.de ? 0.15 + 0.8 * p.n / p.de : 0.5) : 0), 0);
  return Math.round(100 * v / ps.length);
}
function faltaMin(it) {
  if (["aprobado", "listo", "para_revisar", "error", "pausado"].includes(it.estado)) return null;
  if (it.eta) { const m = (new Date(it.eta).getTime() - Date.now()) / 60000; return Math.max(0, m); }
  const p = progreso(it);
  if (p < 4 || !it.inicio) return null;
  const pas = (Date.now() - new Date(it.inicio).getTime()) / 60000;
  return pas * (100 - p) / p;
}
function serviciosDe(it) {
  const m = new Map();
  const ponga = (k, est) => { k = String(k || "").toLowerCase(); if (!k) return; const prev = m.get(k); const rango = { activo: 4, error: 3, espera: 2, ok: 1, pend: 0 }; if (!prev || rango[est] > rango[prev]) m.set(k, est); };
  for (const p of it.pasos || []) if (p.serv) ponga(p.serv, p.estado === "curso" ? "activo" : p.estado === "ok" ? "ok" : p.estado === "error" ? "error" : "pend");
  for (const [k, v] of Object.entries(it.servicios || {})) ponga(k, v.estado);
  // si el ítem ya terminó, nada queda «activo»
  if (["aprobado", "listo", "para_revisar"].includes(it.estado)) for (const [k, v] of m) if (v === "activo") m.set(k, "ok");
  return m;
}
function saldoDe(k) {
  const sk = servDe(k)[3]; if (!sk || !T.d) return null;
  const s = (T.d.saldos || []).filter((x) => x.servicio === sk).sort((a, b) => String(b.medido).localeCompare(String(a.medido)))[0];
  if (!s) return null;
  const bajo = s.ok === false || (MIN_SALDO[sk] != null && s.valor != null && Number(s.valor) < MIN_SALDO[sk]);
  return { ...s, bajo };
}
function itemsVisibles() {
  let xs = T.d?.items || [];
  if (T.persona !== "todos") xs = xs.filter((x) => x.dueno === T.persona);
  if (T.filtro === "marcha") xs = xs.filter((x) => ["en_cola", "trabajando", "esperando", "corrigiendo", "error"].includes(x.estado));
  if (T.filtro === "revisar") xs = xs.filter((x) => x.estado === "para_revisar");
  return xs;
}

// ---------- layout del mundo ----------
const L = { FW: 1260, HUB_X: 40, HUB_W: 280, IT_X: 400, IT_W: 420, IT_H: 286, GAP: 40, SV_X: 990, SV_W: 230, SV_H: 104, SV_GAP: 26, TOP: 150, SEP: 240 };
function armarMarcos() {
  const por = new Map();
  for (const it of itemsVisibles()) { const k = it.oferta || "Sin oferta"; if (!por.has(k)) por.set(k, []); por.get(k).push(it); }
  const marcos = []; let x = 0;
  for (const [oferta, items] of por) {
    const servs = new Map();
    for (const it of items) for (const [k, est] of serviciosDe(it)) { const r = { activo: 4, error: 3, espera: 2, ok: 1, pend: 0 }; if (!servs.has(k) || r[est] > r[servs.get(k)]) servs.set(k, est); }
    const altoIt = items.length * L.IT_H + (items.length - 1) * L.GAP;
    const sl = [...servs.keys()];
    const altoSv = sl.length * L.SV_H + Math.max(0, sl.length - 1) * L.SV_GAP;
    const alto = Math.max(altoIt, altoSv, 260);
    const h = L.TOP + alto + 90;
    const svY0 = L.TOP + (alto - altoSv) / 2;
    marcos.push({ oferta, items, x, y: 0, w: L.FW, h, alto,
      servs: sl.map((k, i) => ({ k, est: servs.get(k), x: L.SV_X, y: svY0 + i * (L.SV_H + L.SV_GAP) })),
      pos: items.map((it, i) => ({ it, x: L.IT_X, y: L.TOP + i * (L.IT_H + L.GAP) })),
      hub: { x: L.HUB_X, y: L.TOP + Math.min(alto / 2 - 130, 40) } });
    x += L.FW + L.SEP;
  }
  return marcos;
}

// ---------- pintar ----------
function pintar() {
  const r = T.raiz; if (!r) return;
  if (!$(".tl-vista", r)) armarEsqueleto();
  pintarBarraSup(); pintarSaldos(); pintarTerminal();
  const vacio = $(".tl-vacio", r);
  if (T.error && !T.d) { vacio.hidden = false; vacio.innerHTML = `<b>No se pudo leer el Workspace.</b><span>${esc(T.error)}</span><button type="button" class="tl-btn" data-acc="reintentar">Reintentar</button>`; return; }
  if (!T.d) { vacio.hidden = false; vacio.innerHTML = `<span class="tl-cursor">cargando el workspace</span>`; return; }
  const marcos = armarMarcos();
  const firma = JSON.stringify([marcos.map((m) => [m.oferta, m.items.map((i) => [i.id, i.actualizado, i.estado, i.ultimo?.id])]), T.d.saldos?.map((s) => s.medido), Math.floor(Date.now() / 30000)]);
  T.marcos = marcos;
  if (!marcos.length) {
    vacio.hidden = false;
    vacio.innerHTML = (T.d.items || []).length
      ? `<b>Nada con este filtro.</b><button type="button" class="tl-btn" data-acc="filtro" data-v="todo">Ver todo</button>`
      : `<b>No hay creativos en producción.</b><span>Cuando Claude arranque un creativo o un VSL aparece acá solo, con su checklist, los servicios que usa y la vista previa.</span><button type="button" class="tl-btn" data-acc="ejemplo">Ver un ejemplo</button>`;
    $(".tl-mundo", r).innerHTML = ""; pintarMini(); return;
  }
  vacio.hidden = true;
  if (firma !== T.firma) { T.firma = firma; $(".tl-mundo", r).innerHTML = mundoHTML(marcos); }
  if (T.primeraVez) {
    T.primeraVez = false;
    // (#taller/<id>) entrar directo a un creativo: para los avisos «lista para revisar»
    const pide = T.abrirId && marcos.findIndex((m) => m.items.some((x) => x.id === T.abrirId));
    const i = pide >= 0 ? pide : Number(ls.get("tl_marco", 0)) || 0;
    volarA(marcos[Math.min(i, marcos.length - 1)], false);
    if (pide >= 0) { const id = T.abrirId; T.abrirId = null; setTimeout(() => abrir(id), 50); }
  }
  aplicarCam(); pintarMini();
  if (T.sel) pintarPanel();
}

function armarEsqueleto() {
  T.raiz.innerHTML = `
  <div class="tl-vista" tabindex="0" aria-label="Tablero del Workspace: arrastrá para moverte, rueda o pellizco para el zoom">
    <div class="tl-mundo"></div>
    <div class="tl-vacio" hidden></div>
  </div>
  <div class="tl-sup">
    <div class="tl-marca"><span class="tl-prompt">~/workspace</span><span class="tl-cursor"></span></div>
    <div class="tl-nav">
      <button type="button" class="tl-btn ico" data-acc="ant" aria-label="Oferta anterior">‹</button>
      <div class="tl-chips" id="tl-chips"></div>
      <button type="button" class="tl-btn ico" data-acc="sig" aria-label="Oferta siguiente">›</button>
    </div>
    <div class="tl-ctrl">
      <div class="tl-seg tl-quien" id="tl-persona" aria-label="De quién es el panel"></div>
      <div class="tl-seg" id="tl-filtro"></div>
      <div class="tl-zoom"><button type="button" class="tl-btn ico" data-acc="zm" aria-label="Alejar">−</button><button type="button" class="tl-btn zv" data-acc="todo" title="Ver todo">70%</button><button type="button" class="tl-btn ico" data-acc="zp" aria-label="Acercar">+</button></div>
    </div>
  </div>
  <div class="tl-saldos" id="tl-saldos"></div>
  <canvas class="tl-mini" id="tl-mini" width="200" height="120" aria-label="Mapa chico: tocá para ir"></canvas>
  <button type="button" class="tl-btn tl-vivo" data-acc="term"><span class="pt"></span>Claude en vivo</button>
  <section class="tl-term" id="tl-term" hidden aria-label="Terminal de Claude en vivo"></section>
  <aside class="tl-panel" id="tl-panel" hidden aria-label="Detalle del creativo"></aside>`;
  enganchar();
}

function pintarBarraSup() {
  const r = T.raiz, ch = $("#tl-chips", r); if (!ch) return;
  const marcos = T.d ? armarMarcos() : [];
  const act = marcoActual();
  ch.innerHTML = marcos.map((m, i) => {
    const p = Math.round(m.items.reduce((a, it) => a + progreso(it), 0) / m.items.length);
    const rev = m.items.filter((x) => x.estado === "para_revisar").length;
    const err = m.items.some((x) => x.estado === "error");
    return `<button type="button" class="tl-chip${act === i ? " on" : ""}${err ? " err" : ""}" data-acc="ir" data-i="${i}"><span class="anillo" style="--p:${p}"></span>${esc(m.oferta)}${rev ? `<b class="rev">${rev}</b>` : ""}</button>`;
  }).join("") || `<span class="tl-tenue">sin ofertas</span>`;
  $("#tl-filtro", r).innerHTML = [["todo", "Todo"], ["marcha", "En marcha"], ["revisar", "Para revisar"]].map(([k, t]) => `<button type="button" aria-pressed="${T.filtro === k}" data-acc="filtro" data-v="${k}">${t}</button>`).join("");
  const yo = CTX.yo || "lorenzo", otro = yo === "lorenzo" ? "franco" : "lorenzo";
  $("#tl-persona", r).innerHTML = [[yo, "Mi panel"], [otro, otro === "franco" ? "Franco" : "Lorenzo"], ["todos", "Los dos"]].map(([k, t]) => `<button type="button" aria-pressed="${T.persona === k}" data-acc="persona" data-v="${k}">${t}</button>`).join("");
}

function pintarSaldos() {
  const n = $("#tl-saldos", T.raiz); if (!n) return;
  const ss = (T.d?.saldos || []).filter((s) => T.persona === "todos" || s.dueno === T.persona);
  if (!ss.length) { n.innerHTML = `<span class="tl-tenue">saldos: sin medir (Claude corre <code>taller.py saldos</code>)</span>`; return; }
  const nom = { elevenlabs: "ElevenLabs", atlas: "Atlas", runpod: "RunPod", heygen: "HeyGen", aws: "AWS", vmake: "VMake", disco: "Disco" };
  const bajos = ss.filter((s) => s.ok === false || (MIN_SALDO[s.servicio] != null && s.valor != null && Number(s.valor) < MIN_SALDO[s.servicio]));
  n.innerHTML = (bajos.length ? `<div class="tl-alerta">⚠ Falta saldo: ${bajos.map((s) => `<b>${esc(nom[s.servicio] || s.servicio)}${T.persona === "todos" ? ` (${esc(s.dueno)})` : ""}</b>`).join(", ")}</div>` : "")
    + `<div class="tl-sfila">${ss.map((s) => {
      const bajo = bajos.includes(s);
      const v = s.valor == null ? (s.ok ? "OK" : "?") : s.unidad === "USD" ? `US$ ${num(s.valor, 2)}` : s.unidad === "créditos" ? num(s.valor) : s.unidad === "GB" ? `${num(s.valor, 1)} GB` : num(s.valor, 2);
      return `<span class="tl-saldo${bajo ? " bajo" : ""}" title="${esc(s.texto || "")} · medido ${hace(s.medido)}"><i></i>${esc(nom[s.servicio] || s.servicio)}${T.persona === "todos" ? `<small>${esc(s.dueno[0].toUpperCase())}</small>` : ""} <b>${esc(v)}</b></span>`;
    }).join("")}<span class="tl-tenue">${hace(ss.map((s) => s.medido).sort().pop())}</span></div>`;
}

function mundoHTML(marcos) {
  let svg = "", html = "";
  const W = marcos.reduce((a, m) => Math.max(a, m.x + m.w), 0) + 200, H = marcos.reduce((a, m) => Math.max(a, m.h), 0) + 200;
  for (const m of marcos) {
    const ox = m.x, oy = m.y;
    const prog = Math.round(m.items.reduce((a, it) => a + progreso(it), 0) / m.items.length);
    const cuenta = (f) => m.items.filter(f).length;
    const falta = Math.max(0, ...m.items.map((it) => faltaMin(it) ?? 0));
    const costo = m.items.reduce((a, it) => a + (Number(it.costo_usd) || 0), 0);
    const merc = [...new Set(m.items.map((x) => x.mercado).filter(Boolean))].join(" · ");
    html += `<div class="tl-marco" style="left:${ox}px;top:${oy}px;width:${m.w}px;height:${m.h}px">
      <div class="tl-mtit"><span class="tl-hash">#</span>${esc(m.oferta)}${merc ? `<span class="tl-merc">${esc(merc)}</span>` : ""}</div>
      <div class="tl-msub">${m.items.length} pieza${m.items.length > 1 ? "s" : ""} · ${prog}% · ${falta > 0 ? `faltan ≈ ${minTxt(falta)}` : cuenta((x) => ["trabajando", "corrigiendo"].includes(x.estado)) ? "calculando cuánto falta" : "sin trabajo en marcha"}${costo ? ` · gastado US$ ${num(costo, 2)}` : ""}</div>
    </div>`;
    // nodo central de la oferta
    const hb = m.hub;
    html += `<div class="tl-hub" style="left:${ox + hb.x}px;top:${oy + hb.y}px;width:${L.HUB_W}px">
      <div class="tl-hk">oferta</div><div class="tl-hn">${esc(m.oferta)}</div>
      <div class="tl-barra"><i style="width:${prog}%"></i></div>
      <div class="tl-hstats">
        <span><b>${cuenta((x) => ["aprobado", "listo"].includes(x.estado))}</b>listas</span>
        <span class="c-cian"><b>${cuenta((x) => x.estado === "para_revisar")}</b>revisar</span>
        <span class="c-amb"><b>${cuenta((x) => ["trabajando", "corrigiendo", "en_cola", "esperando"].includes(x.estado))}</b>en marcha</span>
        <span class="c-err"><b>${cuenta((x) => x.estado === "error")}</b>error</span>
      </div>
    </div>`;
    const hx = ox + hb.x + L.HUB_W, hy = oy + hb.y + 130;
    for (const p of m.pos) {
      const it = p.it, x = ox + p.x, y = oy + p.y;
      const est = ESTADO[it.estado] || [it.estado, "c-gris"];
      const activo = ["trabajando", "corrigiendo"].includes(it.estado);
      svg += cable(hx, hy, x, y + 46, activo ? "activo" : it.estado === "error" ? "error" : ["aprobado", "listo"].includes(it.estado) ? "ok" : "pend", "#e5e7eb");
      html += tarjetaHTML(it, x, y, est);
      // tarjeta → servicios
      for (const [k, e] of serviciosDe(it)) {
        const s = m.servs.find((q) => q.k === k); if (!s) continue;
        svg += cable(x + L.IT_W, y + L.IT_H / 2, ox + s.x, oy + s.y + L.SV_H / 2, e, servDe(k)[2]);
      }
    }
    for (const s of m.servs) {
      const [nom, que, col] = servDe(s.k), sal = saldoDe(s.k);
      const usando = m.items.filter((it) => serviciosDe(it).get(s.k) === "activo");
      const det = usando.map((it) => it.servicios?.[s.k]?.det || (it.pasos || []).find((p) => p.serv === s.k && p.estado === "curso")?.det).filter(Boolean)[0];
      html += `<div class="tl-serv e-${s.est}${sal?.bajo ? " bajo" : ""}" style="left:${ox + s.x}px;top:${oy + s.y}px;width:${L.SV_W}px;height:${L.SV_H}px;--sc:${col}">
        <div class="tl-sn"><i></i>${esc(nom)}</div>
        <div class="tl-sq">${esc(det || (usando.length ? `trabajando para ${usando.length}` : s.est === "ok" ? "terminado" : s.est === "error" ? "con error" : que))}</div>
        ${sal ? `<div class="tl-ss${sal.bajo ? " bajo" : ""}">${sal.bajo ? "⚠ falta saldo · " : "saldo "}${esc(sal.texto || "")}</div>` : ""}
      </div>`;
    }
  }
  return `<svg class="tl-cables" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${svg}</svg>${html}`;
}

function cable(x1, y1, x2, y2, est, col) {
  const dx = Math.max(60, (x2 - x1) * 0.5);
  const d = `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
  return `<path class="tl-c c-${est}" d="${d}" style="--cc:${col}"/>` + (est === "activo" ? `<circle class="tl-pulso" r="5" style="--cc:${col}"><animateMotion dur="1.8s" repeatCount="indefinite" path="${d}"/></circle>` : "")
    + `<path class="tl-flecha c-${est}" d="M${x2 - 9},${y2 - 6} L${x2},${y2} L${x2 - 9},${y2 + 6}" style="--cc:${col}"/>`;
}

function tarjetaHTML(it, x, y, est) {
  const p = progreso(it), f = faltaMin(it);
  const ps = it.pasos || [];
  // mostrar el paso en curso y sus vecinos: lo que importa está a la vista
  const ic = Math.max(0, ps.findIndex((q) => q.estado === "curso" || q.estado === "error"));
  const desde = Math.max(0, Math.min(ic - 2, ps.length - 6));
  const vis = ps.slice(desde, desde + 6);
  const hechos = ps.filter((q) => q.estado === "ok" || q.estado === "salto").length;
  const prev = (it.previews || [])[0];
  const corr = (it.correcciones || []).filter((c) => c.estado !== "hecha" && c.estado !== "descartada").length;
  return `<div role="button" tabindex="0" aria-label="${esc(it.nombre)}: ${esc(est[0])}" class="tl-card ${est[1]}${T.sel === it.id ? " sel" : ""}" data-item="${esc(it.id)}" style="left:${x}px;top:${y}px;width:${L.IT_W}px;height:${L.IT_H}px">
    <div class="tl-ch"><span class="tl-tipo">${esc(TIPO[it.tipo] || String(it.tipo || "").toUpperCase())}</span><span class="tl-est">${esc(est[0])}</span>${it.dueno ? `<span class="tl-dueno">${esc(it.dueno)}</span>` : ""}</div>
    <div class="tl-cn">${esc(it.nombre)}</div>
    <div class="tl-cp"><div class="tl-barra"><i style="width:${p}%"></i></div><span>${p}%</span></div>
    <div class="tl-ceta">${it.estado === "para_revisar" ? "▶ lista para que la mires" : it.estado === "aprobado" ? "✔ aprobada" : f != null ? `faltan ≈ ${minTxt(f)}` : it.estado === "error" ? "frenada por un error" : "—"}${ps.length ? ` · ${hechos}/${ps.length} pasos` : ""}${corr ? ` · <b class="c-vio">${corr} corrección${corr > 1 ? "es" : ""}</b>` : ""}</div>
    <ul class="tl-chk">${vis.map((q) => `<li class="p-${q.estado}"><i>${PASO_ICO[q.estado] || "○"}</i><span>${esc(q.t)}${q.n != null && q.de ? ` <em>${num(q.n)}/${num(q.de)}</em>` : ""}</span>${q.serv ? `<small style="--sc:${servDe(q.serv)[2]}">${esc(servDe(q.serv)[0])}</small>` : ""}</li>`).join("") || `<li class="p-pend"><i>○</i><span>sin checklist todavía</span></li>`}${ps.length > vis.length ? `<li class="tl-mas">+${ps.length - vis.length} pasos más</li>` : ""}</ul>
    <div class="tl-cpie">${it.ultimo ? `<code>&gt; ${esc(it.ultimo.texto).slice(0, 90)}</code>` : `<code class="tl-tenue">&gt; sin actividad</code>`}${prev ? `<span class="tl-ver">▶ vista previa</span>` : ""}</div>
  </div>`;
}

// ---------- cámara ----------
function aplicarCam() {
  const v = $(".tl-vista", T.raiz), m = $(".tl-mundo", T.raiz); if (!v || !m) return;
  const { x, y, z } = T.cam;
  m.style.transform = `translate(${x}px,${y}px) scale(${z})`;
  const g = 32 * z, G = g * 5;
  v.style.backgroundSize = `${G}px ${G}px, ${G}px ${G}px, ${g}px ${g}px, ${g}px ${g}px`;
  v.style.backgroundPosition = `${x}px ${y}px`;
  v.classList.toggle("lejos", z < 0.42);
  const zv = $(".zv", T.raiz); if (zv) zv.textContent = `${Math.round(z * 100)}%`;
  pintarMini();
}
const limZ = (z) => Math.max(0.12, Math.min(2.2, z));
function zoomEn(px, py, f) {
  const z2 = limZ(T.cam.z * f), k = z2 / T.cam.z;
  T.cam.x = px - (px - T.cam.x) * k; T.cam.y = py - (py - T.cam.y) * k; T.cam.z = z2;
  aplicarCam(); marcarChip();
}
function animarCam(dest, ms = 480) {
  cancelAnimationFrame(T.anim);
  if (reducido() || ms === 0) { T.cam = dest; aplicarCam(); marcarChip(); return; }
  const o = { ...T.cam }, t0 = performance.now();
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    T.cam = { x: o.x + (dest.x - o.x) * e, y: o.y + (dest.y - o.y) * e, z: o.z + (dest.z - o.z) * e };
    aplicarCam();
    if (k < 1) T.anim = requestAnimationFrame(paso); else marcarChip();
  };
  T.anim = requestAnimationFrame(paso);
}
// Una oferta se encuadra legible (zoom mínimo ~62 %): si no entra a lo alto, arriba de todo y se desliza.
function encuadre(x, y, w, h, todo = false) {
  const v = $(".tl-vista", T.raiz), W = v.clientWidth, H = v.clientHeight;
  const arriba = W < 700 ? 130 : 96, abajo = 70;
  const fit = Math.min((W - 48) / w, (H - arriba - abajo) / h, 1.1);
  const z = limZ(todo ? fit : Math.max(fit, Math.min(0.62, (W - 24) / (L.IT_W + L.HUB_W + 120))));
  const xx = w * z <= W - 24 ? (W - w * z) / 2 - x * z : 12 - (x + (todo ? 0 : L.HUB_X)) * z;
  const yy = h * z <= H - arriba - abajo ? arriba + (H - arriba - abajo - h * z) / 2 - y * z : arriba + 8 - y * z;
  return { x: xx, y: yy, z };
}
function volarA(m, anim = true) { if (!m) return; animarCam(encuadre(m.x, m.y, m.w, m.h), anim ? 480 : 0); ls.set("tl_marco", T.marcos.indexOf(m)); }
function verTodo() {
  if (!T.marcos.length) return;
  const w = T.marcos.reduce((a, m) => Math.max(a, m.x + m.w), 0), h = T.marcos.reduce((a, m) => Math.max(a, m.h), 0);
  animarCam(encuadre(0, 0, w, h, true));
}
function marcoActual() {
  const v = $(".tl-vista", T.raiz); if (!v || !T.marcos.length) return -1;
  const cx = (v.clientWidth / 2 - T.cam.x) / T.cam.z;
  let mejor = 0, dist = Infinity;
  T.marcos.forEach((m, i) => { const d = Math.abs(m.x + m.w / 2 - cx); if (d < dist) { dist = d; mejor = i; } });
  return mejor;
}
function marcarChip() {
  const i = marcoActual();
  $$(".tl-chip", T.raiz).forEach((b) => b.classList.toggle("on", Number(b.dataset.i) === i));
  const on = $(".tl-chip.on", T.raiz); if (on) { const p = on.parentElement; if (on.offsetLeft < p.scrollLeft || on.offsetLeft + on.offsetWidth > p.scrollLeft + p.clientWidth) p.scrollTo({ left: on.offsetLeft - 20, behavior: "smooth" }); }
}

function pintarMini() {
  const c = $("#tl-mini", T.raiz), v = $(".tl-vista", T.raiz); if (!c || !v) return;
  const g = c.getContext("2d"), W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  if (!T.marcos.length) return;
  const mw = T.marcos.reduce((a, m) => Math.max(a, m.x + m.w), 0), mh = T.marcos.reduce((a, m) => Math.max(a, m.h), 0);
  const k = Math.min((W - 12) / mw, (H - 12) / mh), ox = (W - mw * k) / 2, oy = (H - mh * k) / 2;
  T.mini = { k, ox, oy };
  for (const m of T.marcos) {
    g.fillStyle = "rgba(255,255,255,.06)"; g.strokeStyle = "rgba(255,255,255,.25)"; g.lineWidth = 1;
    g.fillRect(ox + m.x * k, oy + m.y * k, m.w * k, m.h * k); g.strokeRect(ox + m.x * k + .5, oy + m.y * k + .5, m.w * k - 1, m.h * k - 1);
    for (const p of m.pos) {
      const cl = { para_revisar: "#4cc9f0", aprobado: "#3ddc84", listo: "#3ddc84", error: "#ff5c5c", trabajando: "#ffb020", corrigiendo: "#c084fc" }[p.it.estado] || "#6b7280";
      g.fillStyle = cl; g.fillRect(ox + (m.x + p.x) * k, oy + (m.y + p.y) * k, L.IT_W * k, Math.max(2, L.IT_H * k));
    }
  }
  const vx = -T.cam.x / T.cam.z, vy = -T.cam.y / T.cam.z, vw = v.clientWidth / T.cam.z, vh = v.clientHeight / T.cam.z;
  g.strokeStyle = "#f5f5f5"; g.lineWidth = 1.5; g.strokeRect(ox + vx * k, oy + vy * k, vw * k, vh * k);
}

// ---------- interacción ----------
function enganchar() {
  const r = T.raiz, v = $(".tl-vista", r);
  const pts = new Map(); let arr = null, pinza = null, movio = false;
  v.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    v.setPointerCapture(e.pointerId);
    cancelAnimationFrame(T.anim);
    if (pts.size === 1) { arr = { x: e.clientX, y: e.clientY, cx: T.cam.x, cy: T.cam.y }; movio = false; }
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinza = { d: Math.hypot(a.x - b.x, a.y - b.y), z: T.cam.z, cx: T.cam.x, cy: T.cam.y, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      arr = null; movio = true;
    }
  });
  v.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const rc = v.getBoundingClientRect();
    if (pinza && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const z2 = limZ(pinza.z * Math.hypot(a.x - b.x, a.y - b.y) / pinza.d), k = z2 / pinza.z;
      const mx = (a.x + b.x) / 2 - rc.left, my = (a.y + b.y) / 2 - rc.top, m0x = pinza.mx - rc.left, m0y = pinza.my - rc.top;
      T.cam = { z: z2, x: mx - (m0x - pinza.cx) * k, y: my - (m0y - pinza.cy) * k };
      aplicarCam(); return;
    }
    if (arr) {
      const dx = e.clientX - arr.x, dy = e.clientY - arr.y;
      if (!movio && Math.hypot(dx, dy) > 5) { movio = true; v.classList.add("arrastrando"); }
      if (movio) { T.cam.x = arr.cx + dx; T.cam.y = arr.cy + dy; aplicarCam(); }
    }
  });
  const soltar = (e) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinza = null;
    if (!pts.size) {
      v.classList.remove("arrastrando");
      if (arr && !movio && e.type === "pointerup") {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const card = el?.closest?.(".tl-card");
        if (card) abrir(card.dataset.item);
        else if (el?.closest?.(".tl-hub, .tl-mtit")) { const i = marcoEn(e); if (i >= 0) volarA(T.marcos[i]); }
      }
      arr = null; marcarChip();
    }
  };
  v.addEventListener("pointerup", soltar); v.addEventListener("pointercancel", soltar);
  v.addEventListener("wheel", (e) => {
    e.preventDefault(); cancelAnimationFrame(T.anim);
    const rc = v.getBoundingClientRect();
    const mouse = e.deltaMode === 1 || (Math.abs(e.deltaY) >= 40 && e.deltaX === 0 && Number.isInteger(e.deltaY));
    if (e.ctrlKey || e.metaKey || mouse) zoomEn(e.clientX - rc.left, e.clientY - rc.top, Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0022)));
    else { T.cam.x -= e.deltaX; T.cam.y -= e.deltaY; aplicarCam(); clearTimeout(T.chipT); T.chipT = setTimeout(marcarChip, 150); }
  }, { passive: false });
  v.addEventListener("keydown", (e) => {
    const cd = e.target.closest?.(".tl-card");
    if (cd && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); abrir(cd.dataset.item); return; }
    if (e.target !== v) return;
    const i = marcoActual();
    if (e.key === "ArrowRight") { e.preventDefault(); volarA(T.marcos[Math.min(T.marcos.length - 1, i + 1)]); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); volarA(T.marcos[Math.max(0, i - 1)]); }
    else if (e.key === "+" || e.key === "=") zoomEn(v.clientWidth / 2, v.clientHeight / 2, 1.2);
    else if (e.key === "-") zoomEn(v.clientWidth / 2, v.clientHeight / 2, 1 / 1.2);
    else if (e.key === "0") verTodo();
  });
  const mini = $("#tl-mini", r);
  mini.addEventListener("click", (e) => {
    if (!T.mini) return;
    const rc = mini.getBoundingClientRect(), sx = mini.width / rc.width;
    const wx = ((e.clientX - rc.left) * sx - T.mini.ox) / T.mini.k, wy = ((e.clientY - rc.top) * sx - T.mini.oy) / T.mini.k;
    animarCam({ z: T.cam.z, x: v.clientWidth / 2 - wx * T.cam.z, y: v.clientHeight / 2 - wy * T.cam.z }, 300);
  });
  r.addEventListener("click", (e) => {
    const b = e.target.closest("[data-acc]"); if (!b || !r.contains(b)) return;
    const a = b.dataset.acc, vv = $(".tl-vista", r);
    if (a === "ir") volarA(T.marcos[Number(b.dataset.i)]);
    else if (a === "ant") volarA(T.marcos[Math.max(0, marcoActual() - 1)]);
    else if (a === "sig") volarA(T.marcos[Math.min(T.marcos.length - 1, marcoActual() + 1)]);
    else if (a === "zp") zoomEn(vv.clientWidth / 2, vv.clientHeight / 2, 1.25);
    else if (a === "zm") zoomEn(vv.clientWidth / 2, vv.clientHeight / 2, 1 / 1.25);
    else if (a === "todo") verTodo();
    else if (a === "filtro") { T.filtro = b.dataset.v; ls.set("tl_filtro", T.filtro); T.firma = ""; T.primeraVez = true; pintar(); }
    else if (a === "persona") { T.persona = b.dataset.v; ls.set("tl_persona", T.persona); T.firma = ""; T.primeraVez = true; pintar(); }
    else if (a === "term") { T.term = !T.term; pintarTerminal(); }
    else if (a === "reintentar") cargar();
    else if (a === "ejemplo") { T.demo = true; T.primeraVez = true; cargar(); }
    else if (a === "cerrar") cerrarPanel();
    else if (a === "aprobar") revisar("aprobar");
    else if (a === "corregir") revisar("corregir");
    else if (a === "reabrir") revisar("reabrir");
    else if (a === "archivar") revisar("archivar");
    else if (a === "prev") { T.prevI = Number(b.dataset.i); pintarPanel(true); }
    else if (a === "camp" || a === "pres" || a === "pres-monto") accionCampana(a, b);
  });
  addEventListener("resize", T.onResize = () => { ubicar(); aplicarCam(); });
  addEventListener("keydown", T.onKey = (e) => { if (e.key === "Escape" && T.sel) cerrarPanel(); });
}
function marcoEn(e) {
  const v = $(".tl-vista", T.raiz), rc = v.getBoundingClientRect();
  const wx = (e.clientX - rc.left - T.cam.x) / T.cam.z;
  return T.marcos.findIndex((m) => wx >= m.x && wx <= m.x + m.w);
}

// ---------- terminal general (hooks de Claude Code → ws_eventos) ----------
function pintarTerminal() {
  const n = $("#tl-term", T.raiz), b = $(".tl-vivo", T.raiz); if (!n) return;
  n.hidden = !T.term; b?.classList.toggle("on", T.term);
  if (!T.term) return;
  const ev = (T.d?.eventos || []).filter((x) => T.persona === "todos" || x.dueno === T.persona);
  const abajo = n.scrollTop + n.clientHeight >= n.scrollHeight - 30;
  n.innerHTML = `<div class="tl-tbar"><span>claude@mac — en vivo (últimas 6 h)</span><button type="button" class="tl-btn ico" data-acc="term" aria-label="Cerrar terminal">×</button></div>
    <div class="tl-tlog">${ev.map((x) => `<div class="ln t-${esc(x.tipo)}"><time>${hora(x.ts)}</time><b>${esc(x.dueno?.[0]?.toUpperCase() || "")}</b><span>${x.tipo === "herramienta" ? `<em>${esc(x.herramienta || "")}</em> ` : x.tipo === "usuario" ? "<em>vos</em> " : ""}${esc(x.texto || "")}</span></div>`).join("") || `<div class="ln"><span class="tl-tenue">sin actividad en las últimas 6 h</span></div>`}</div>`;
  const tl = $(".tl-tlog", n); if (abajo || !n.dataset.vista) { tl.scrollTop = tl.scrollHeight; n.dataset.vista = "1"; }
}

// ---------- panel de detalle ----------
function abrir(id) {
  T.sel = id; T.log = []; T.logUlt = 0; T.logDe = id; T.prevI = 0;
  $$(".tl-card.sel", T.raiz).forEach((c) => c.classList.remove("sel"));
  $(`.tl-card[data-item="${CSS.escape(id)}"]`, T.raiz)?.classList.add("sel");
  pintarPanel(true); cargarLog();
  clearInterval(T.timerLog); T.timerLog = setInterval(() => { if (!document.hidden) cargarLog(); }, POLL_LOG_MS);
}
function cerrarPanel() {
  T.sel = null; clearInterval(T.timerLog); T.timerLog = null;
  const p = $("#tl-panel", T.raiz); if (p) { p.hidden = true; p.innerHTML = ""; }
  $$(".tl-card.sel", T.raiz).forEach((c) => c.classList.remove("sel"));
  $(".tl-vista", T.raiz)?.focus({ preventScroll: true });
}
async function cargarLog() {
  const id = T.sel; if (!id) return;
  try {
    const r = T.demo ? { log: demoLog(id) } : await api("taller_log", `&id=${encodeURIComponent(id)}${T.logUlt ? `&desde=${T.logUlt}` : ""}`);
    if (T.sel !== id) return;
    const nuevos = T.demo ? r.log : r.log;
    if (T.demo) T.log = nuevos; else T.log.push(...nuevos);
    if (T.log.length) T.logUlt = T.log[T.log.length - 1].id;
    pintarLog();
  } catch {}
}
function pintarLog() {
  const n = $("#tl-plog", T.raiz); if (!n) return;
  const abajo = n.scrollTop + n.clientHeight >= n.scrollHeight - 30 || !n.dataset.vista;
  n.innerHTML = T.log.map((l) => `<div class="ln n-${esc(l.nivel)}"><time>${hora(l.ts)}</time>${l.serv ? `<b style="--sc:${servDe(l.serv)[2]}">[${esc(l.serv)}]</b>` : ""}<span>${esc(l.texto)}</span></div>`).join("") || `<div class="ln"><span class="tl-tenue">$ esperando actividad…</span></div>`;
  n.insertAdjacentHTML("beforeend", `<div class="ln"><span class="tl-cursor"></span></div>`);
  if (abajo) { n.scrollTop = n.scrollHeight; n.dataset.vista = "1"; }
}
function pintarPanel(entero = false) {
  const p = $("#tl-panel", T.raiz); if (!p) return;
  const it = (T.d?.items || []).find((x) => x.id === T.sel);
  if (!it) { cerrarPanel(); return; }
  const firma = JSON.stringify([it.actualizado, it.estado, T.prevI]);
  if (!entero && p.dataset.firma === firma) return;
  const conVideo = $("video", p); // el video no se reinicia si no cambió la vista previa
  const txt = $("#tl-com", p), borrador = txt?.value || "", conFoco = document.activeElement === txt;
  const est = ESTADO[it.estado] || [it.estado, "c-gris"];
  const prog = progreso(it), f = faltaMin(it);
  const prevs = it.previews || [], pv = prevs[Math.min(T.prevI || 0, prevs.length - 1)];
  const pvFirma = pv?.u || "";
  const servs = [...serviciosDe(it)];
  const corr = it.correcciones || [];
  const rv = it.revision;
  const mantenerVideo = !entero && p.dataset.pv === pvFirma && conVideo;
  const viejoVideo = mantenerVideo ? conVideo : null;
  p.hidden = false; p.dataset.firma = firma; p.dataset.pv = pvFirma;
  p.innerHTML = `
    <div class="tl-ph">
      <div><div class="tl-pk">${esc(it.oferta)}${it.mercado ? ` · ${esc(it.mercado)}` : ""} · <span class="tl-tipo">${esc(TIPO[it.tipo] || it.tipo)}</span></div><h3>${esc(it.nombre)}</h3></div>
      <button type="button" class="tl-btn ico" data-acc="cerrar" aria-label="Cerrar">×</button>
    </div>
    <div class="tl-pest ${est[1]}"><span class="tl-est">${esc(est[0])}</span><span>${prog}%</span><span>${it.estado === "para_revisar" ? "esperando tu OK" : f != null ? `faltan ≈ ${minTxt(f)}${it.eta ? ` (≈ ${hora(it.eta, false)})` : ""}` : ""}</span>${it.costo_usd != null ? `<span>US$ ${num(it.costo_usd, 2)}</span>` : ""}<span class="tl-tenue">act. ${hace(it.actualizado)}</span></div>
    <div class="tl-barra grande"><i style="width:${prog}%"></i></div>
    ${it.nota ? `<p class="tl-nota">${esc(it.nota)}</p>` : ""}
    <div class="tl-pbloque">
      <h4>Vista previa</h4>
      ${pv ? `${prevs.length > 1 ? `<div class="tl-ptabs">${prevs.map((x, i) => `<button type="button" data-acc="prev" data-i="${i}" aria-pressed="${x === pv}">${esc(x.t)}</button>`).join("")}</div>` : ""}
        <div class="tl-pmedia${pv.tipo === "web" ? " web" : ""}" id="tl-pmedia">${pv.tipo === "video" ? `<video controls playsinline preload="metadata" src="${esc(url(pv.u))}"></video>`
          : pv.tipo === "imagen" ? `<img src="${esc(url(pv.u))}" alt="${esc(pv.t)}">`
          : pv.tipo === "audio" ? `<audio controls preload="metadata" src="${esc(url(pv.u))}"></audio>`
          : pv.tipo === "web" ? `<div class="tl-cel"><div class="tl-cel-notch"></div><iframe src="${esc(url(pv.u))}" title="${esc(pv.t)} en el celular" loading="lazy" referrerpolicy="no-referrer"></iframe></div>`
          : `<a class="tl-btn" href="${esc(url(pv.u))}" target="_blank" rel="noopener">Abrir «${esc(pv.t)}» ↗</a>`}</div>
        <div class="tl-tenue">${esc(pv.t)} · ${hace(pv.ts)}${pv.tipo !== "link" ? ` · <a href="${esc(url(pv.u))}" target="_blank" rel="noopener">abrir aparte ↗</a>` : ""}</div>`
      : `<p class="tl-tenue">Todavía no hay vista previa. Aparece acá apenas Claude la suba.</p>`}
      ${it.carpeta ? `<a class="tl-btn ancho" href="${esc(url(it.carpeta))}" target="_blank" rel="noopener">📁 Abrir la carpeta</a>` : ""}
      ${(it.links || []).length ? `<div class="tl-links">${it.links.map((l) => `<a class="tl-btn" href="${esc(url(l.u))}" target="_blank" rel="noopener">${esc(l.t)} ↗</a>`).join("")}</div>` : ""}
    </div>
    ${campanaHTML(it)}
    <div class="tl-pbloque tl-rev">
      ${rv ? `<p class="tl-rv ${rv.decision === "aprobado" ? "c-ok" : "c-vio"}">${rv.decision === "aprobado" ? "✔ Aprobado" : "✎ Corrección pedida"} por ${esc(rv.por)} · ${hace(rv.ts)}${rv.comentario ? `<br><q>${esc(rv.comentario)}</q>` : ""}</p>` : ""}
      <label for="tl-com">¿Qué hay que corregir?</label>
      <textarea id="tl-com" rows="3" placeholder="Ej.: en 0:12 el subtítulo tapa la cara · la música más baja · cambiá el hook"></textarea>
      <div class="tl-pacc">
        <button type="button" class="tl-btn ok" data-acc="aprobar"${["aprobado"].includes(it.estado) ? " disabled" : ""}>✔ Aprobar</button>
        <button type="button" class="tl-btn vio" data-acc="corregir">✎ Pedir corrección</button>
        ${["aprobado", "listo", "corrigiendo"].includes(it.estado) ? `<button type="button" class="tl-btn" data-acc="reabrir">Volver a revisar</button>` : ""}
        <button type="button" class="tl-btn tenue" data-acc="archivar" title="Sacarlo del tablero">Archivar</button>
      </div>
    </div>
    <div class="tl-pbloque">
      <h4>Checklist <span class="tl-tenue">${(it.pasos || []).filter((q) => q.estado === "ok" || q.estado === "salto").length}/${(it.pasos || []).length}</span></h4>
      <ul class="tl-chk largo">${(it.pasos || []).map((q) => `<li class="p-${q.estado}"><i>${PASO_ICO[q.estado] || "○"}</i><span>${esc(q.t)}${q.n != null && q.de ? ` <em>${num(q.n)}/${num(q.de)}</em>` : ""}${q.det ? `<br><small class="tl-det">${esc(q.det)}</small>` : ""}</span>${q.serv ? `<small style="--sc:${servDe(q.serv)[2]}">${esc(servDe(q.serv)[0])}</small>` : ""}${q.ini && q.estado === "curso" ? `<time>${hace(q.ini)}</time>` : q.fin ? `<time>${hora(q.fin, false)}</time>` : ""}</li>`).join("") || `<li class="p-pend"><i>○</i><span>sin checklist</span></li>`}</ul>
    </div>
    ${servs.length ? `<div class="tl-pbloque"><h4>Servicios</h4><div class="tl-pserv">${servs.map(([k, e]) => { const s = saldoDe(k), d = it.servicios?.[k]?.det; return `<span class="e-${e}${s?.bajo ? " bajo" : ""}" style="--sc:${servDe(k)[2]}"><i></i><b>${esc(servDe(k)[0])}</b>${d ? ` · ${esc(d)}` : ""}${s ? `<small>${s.bajo ? "⚠ " : ""}${esc(s.texto || "")}</small>` : ""}</span>`; }).join("")}</div></div>` : ""}
    ${corr.length ? `<div class="tl-pbloque"><h4>Correcciones</h4><ol class="tl-corr">${corr.map((c) => `<li class="k-${esc(c.estado)}"><span>${esc(c.texto)}</span><small>${esc(c.por || "")} · ${hace(c.ts)} · <b>${esc({ pedida: "pedida", en_curso: "en curso", hecha: "hecha", descartada: "descartada" }[c.estado] || c.estado)}</b></small></li>`).join("")}</ol></div>` : ""}
    <div class="tl-pbloque tl-pterm"><h4>Terminal <span class="tl-tenue">${esc(it.id)}</span></h4><div class="tl-plog" id="tl-plog"></div></div>`;
  if (viejoVideo) $("#tl-pmedia", p)?.replaceChildren(viejoVideo);
  const cel = $(".tl-cel", p); if (cel) requestAnimationFrame(() => cel.style.setProperty("--k", String(cel.clientWidth / 390)));
  if (borrador) { const t2 = $("#tl-com", p); t2.value = borrador; if (conFoco) t2.focus({ preventScroll: true }); }
  pintarLog();
}
// ---------- campaña de Meta como pieza (meta: campana_id, act, estado, presupuesto, moneda) ----------
function campanaHTML(it) {
  const m = it.meta; if (!m?.campana_id || !m.act) return "";
  const on = m.estado === "ACTIVE";
  const pres = m.presupuesto != null ? `${m.moneda && m.moneda !== "USD" ? m.moneda + " " : "US$ "}${num(m.presupuesto, 2)} por día` : "presupuesto sin leer";
  return `<div class="tl-pbloque tl-camp">
    <h4>Campaña en Meta</h4>
    <div class="tl-cest"><span class="tl-pill ${on ? "on" : "off"}">${on ? "● Prendida" : "○ Apagada"}</span><span>${esc(pres)}</span></div>
    <div class="tl-pacc">
      ${on ? `<button type="button" class="tl-btn" data-acc="camp" data-v="PAUSED">⏸ Apagar</button>` : `<button type="button" class="tl-btn ok" data-acc="camp" data-v="ACTIVE">▶ Prender</button>`}
      <button type="button" class="tl-btn" data-acc="pres" data-v="10">+10 %</button>
      <button type="button" class="tl-btn" data-acc="pres" data-v="30">+30 %</button>
      <button type="button" class="tl-btn" data-acc="pres" data-v="-10">−10 %</button>
    </div>
    <div class="tl-monto"><input type="number" inputmode="decimal" min="1" step="0.01" id="tl-monto" placeholder="Nuevo presupuesto diario" aria-label="Nuevo presupuesto diario"><button type="button" class="tl-btn" data-acc="pres-monto">Cambiar</button></div>
    <p class="tl-tenue">Termina siempre en ,55. Se toca de verdad en Meta: hay que tocar dos veces para confirmar.</p>
  </div>`;
}
async function accionCampana(a, b) {
  const it = (T.d?.items || []).find((x) => x.id === T.sel); const m = it?.meta; if (!m) return;
  if (T.demo) { CTX.toast("Es el ejemplo: no se toca Meta."); return; }
  if (!CTX.appApi) { CTX.toast("Abrí el Workspace desde la app para manejar campañas.", "error"); return; }
  const monto = a === "pres-monto" ? Number(String($("#tl-monto", T.raiz)?.value || "").replace(",", ".")) : null;
  if (a === "pres-monto" && !(monto >= 1)) { CTX.toast("Poné un monto válido.", "error"); return; }
  if (b.dataset.seguro !== "1") { b.dataset.seguro = "1"; b.dataset.txt = b.textContent; b.textContent = "¿Seguro? Tocá de nuevo"; setTimeout(() => { if (b.isConnected && b.dataset.seguro === "1") { b.dataset.seguro = ""; b.textContent = b.dataset.txt; } }, 5000); return; }
  b.disabled = true; b.textContent = "Cambiando en Meta…";
  const item = { id: m.campana_id, act: m.act, nivel: "campana", nombre: it.nombre };
  try {
    if (a === "camp") {
      const r = await CTX.appApi("estado", { body: { estado: b.dataset.v, items: [item] }, escritura: true });
      const res = r?.resultados?.[0]; if (!res?.ok) throw new Error(res?.error || "Meta no respondió");
      if (!r.dry) await api("taller_meta", "", { id: it.id, meta: { estado: b.dataset.v }, log: b.dataset.v === "ACTIVE" ? "▶ Campaña prendida desde el Workspace" : "⏸ Campaña apagada desde el Workspace" });
      CTX.toast(r.dry ? "Modo prueba: no se cambió de verdad." : b.dataset.v === "ACTIVE" ? "Campaña prendida ▶" : "Campaña apagada ⏸");
    } else {
      const body = a === "pres" ? { pct: Number(b.dataset.v), items: [item] } : { items: [{ ...item, monto }] };
      const r = await CTX.appApi("presupuesto", { body, escritura: true });
      const res = r?.resultados?.[0]; if (!res?.ok) throw new Error(res?.error || "Meta no respondió");
      if (!r.dry) await api("taller_meta", "", { id: it.id, meta: { presupuesto: res.despues, ...(res.moneda ? { moneda: res.moneda } : {}) }, log: `Presupuesto → ${res.despues} ${res.moneda || ""} desde el Workspace` });
      CTX.toast(r.dry ? "Modo prueba: no se cambió de verdad." : `Presupuesto nuevo: ${num(res.despues, 2)} ${res.moneda || ""}`);
    }
    await cargar(); pintarPanel(true);
  } catch (e) { CTX.toast(`No se pudo: ${e.message}`, "error", 8000); b.disabled = false; b.dataset.seguro = ""; b.textContent = b.dataset.txt || "Reintentar"; }
}

async function revisar(decision) {
  const it = (T.d?.items || []).find((x) => x.id === T.sel); if (!it) return;
  const com = ($("#tl-com", T.raiz)?.value || "").trim();
  if (decision === "corregir" && !com) { CTX.toast("Escribí qué hay que corregir.", "error"); $("#tl-com", T.raiz)?.focus(); return; }
  if (T.demo) { CTX.toast("Es el ejemplo: no se guarda nada."); return; }
  $$(".tl-pacc button", T.raiz).forEach((b) => b.disabled = true);
  try {
    await api("taller_revision", "", { id: it.id, decision, comentario: com });
    CTX.toast(decision === "aprobar" ? "Aprobado ✔" : decision === "corregir" ? "Corrección enviada: Claude la ve en el Workspace." : decision === "archivar" ? "Archivado." : "Listo.");
    if (decision === "archivar") cerrarPanel();
    await cargar();
    if (T.sel) { T.logUlt = 0; T.log = []; cargarLog(); pintarPanel(true); }
  } catch (e) { CTX.toast(`No se pudo: ${e.message}`, "error"); $$(".tl-pacc button", T.raiz).forEach((b) => b.disabled = false); }
}

// ---------- montaje ----------
function ubicar() {
  const r = T.raiz; if (!r) return;
  const nav = document.getElementById("secciones");
  const top = Math.max(0, Math.round(nav && !nav.hidden ? nav.getBoundingClientRect().bottom + 6 : r.getBoundingClientRect().top));
  r.style.setProperty("--tl-top", `${top}px`);
}
function montar(raiz, ctx = {}) {
  desmontar();
  CTX = { ...CTX, ...ctx };
  T.raiz = raiz; T.firma = ""; T.primeraVez = true; T.d = null;
  T.persona = CTX.yo || "lorenzo"; // (22/10) siempre arranca en «Mi panel»; el selector muestra el del otro
  T.abrirId = decodeURIComponent(location.hash.split("/")[1] || "") || null;
  raiz.classList.add("tl");
  document.documentElement.classList.add("tl-activo");
  window.scrollTo(0, 0);
  ubicar(); requestAnimationFrame(ubicar); setTimeout(() => { ubicar(); aplicarCam(); }, 400);
  pintar();
  cargar();
  T.timer = setInterval(() => { if (!document.hidden && !T.demo) cargar(); }, POLL_MS);
  T.onVis = () => { if (!document.hidden && !T.demo) cargar(); };
  document.addEventListener("visibilitychange", T.onVis);
}
function desmontar() {
  clearInterval(T.timer); clearInterval(T.timerLog); T.timer = T.timerLog = null;
  cancelAnimationFrame(T.anim);
  if (T.onResize) removeEventListener("resize", T.onResize);
  if (T.onKey) removeEventListener("keydown", T.onKey);
  if (T.onVis) document.removeEventListener("visibilitychange", T.onVis);
  T.onResize = T.onKey = T.onVis = null;
  document.documentElement.classList.remove("tl-activo");
  T.raiz = null; T.sel = null;
}

// ---------- ejemplo (?demo=1 o «Ver un ejemplo») ----------
function demo() {
  const ahora = Date.now(), m = (x) => new Date(ahora + x * 60000).toISOString();
  const P = (k, t, estado, extra = {}) => ({ k, t, estado, ...extra });
  return {
    ts: m(0),
    saldos: [
      { dueno: "lorenzo", servicio: "elevenlabs", ok: true, valor: 137729, unidad: "créditos", texto: "137.729 créditos libres (plan pro)", medido: m(-3) },
      { dueno: "lorenzo", servicio: "atlas", ok: true, valor: 0.67, unidad: "USD", texto: "US$ 0.67", medido: m(-3) },
      { dueno: "lorenzo", servicio: "runpod", ok: true, valor: 23.83, unidad: "USD", texto: "US$ 23.83 · gastando US$ 2.76/h ahora", medido: m(-3) },
      { dueno: "lorenzo", servicio: "heygen", ok: true, valor: 6, unidad: "créditos", texto: "6 de cuota", medido: m(-3) },
      { dueno: "lorenzo", servicio: "disco", ok: true, valor: 20.3, unidad: "GB", texto: "20.3 GB libres", medido: m(-3) },
    ],
    eventos: [
      { id: 1, ts: m(-4), dueno: "lorenzo", tipo: "usuario", texto: "dale, terminá el A4 y pasame la vista previa" },
      { id: 2, ts: m(-3), dueno: "lorenzo", tipo: "herramienta", herramienta: "Bash", texto: "Bajar tramos t1 y t6 del pod" },
      { id: 3, ts: m(-2), dueno: "lorenzo", tipo: "herramienta", herramienta: "Bash", texto: "Armar A4 con subtítulos y música" },
      { id: 4, ts: m(-1), dueno: "lorenzo", tipo: "mensaje", texto: "A4 armado, subo la vista previa al Workspace." },
    ],
    items: [
      { id: "demo-yogur-vsl", dueno: "lorenzo", oferta: "Yogur Bariátrico AR", mercado: "AR", tipo: "vsl", nombre: "VSL v1 · 20 min", estado: "para_revisar", inicio: m(-300), actualizado: m(-20), costo_usd: 14.2,
        pasos: [P("guion", "Guion", "ok"), P("voz", "Voz clonada", "ok", { serv: "elevenlabs" }), P("avatar", "Avatar presentadora", "ok", { serv: "higgsfield" }), P("clips", "Clips 15 s", "ok", { serv: "apimart", n: 82, de: 82 }), P("lipsync", "Sincronía labial", "ok", { serv: "runpod" }), P("upscale", "Subir a 1080p", "ok", { serv: "runpod" }), P("edicion", "Edición karaoke + listas", "ok", { serv: "remotion" }), P("musica", "Música y SFX", "ok", { serv: "ffmpeg" }), P("qa", "Control de calidad", "ok", { serv: "gemini" })],
        previews: [{ t: "VSL v1", u: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", tipo: "video", ts: m(-20) }], ultimo: { id: 9, texto: "VSL v1 listo: 20:04, sin congelados" } },
      { id: "demo-yogur-a4", dueno: "lorenzo", oferta: "Yogur Bariátrico AR", mercado: "AR", tipo: "creativo", nombre: "A4 · «Mujer, olvidate de la cinta»", estado: "trabajando", inicio: m(-38), eta: m(9), actualizado: m(-1), costo_usd: 1.1,
        servicios: { runpod: { estado: "activo", det: "2 pods · tramos 5/7" } },
        pasos: [P("trans", "Transcribir original PT", "ok", { serv: "elevenlabs" }), P("guion", "Traducir y adaptar guion", "ok"), P("voz", "Dos voces (testimonio + doctora)", "ok", { serv: "elevenlabs" }), P("vmake", "Borrar subtítulos originales", "ok", { serv: "vmake" }), P("remap", "Reajustar tiempos (30 piezas)", "ok"), P("lipsync", "Lip sync", "curso", { serv: "runpod", n: 5, de: 7, det: "4 pods, 2 ya apagados" }), P("subs", "Subtítulos simples", "pend", { serv: "remotion" }), P("musica", "Música de fondo 0.05", "pend", { serv: "ffmpeg" }), P("qa", "Comparativo con el original", "pend")],
        ultimo: { id: 8, texto: "Bajando tramo t6 del pod 3…" } },
      { id: "demo-yogur-a5", dueno: "lorenzo", oferta: "Yogur Bariátrico AR", mercado: "AR", tipo: "creativo", nombre: "A5 · Testimonio cocina", estado: "corrigiendo", inicio: m(-90), actualizado: m(-6),
        correcciones: [{ texto: "En 0:58 se congela la imagen", por: "lorenzo", ts: m(-12), estado: "en_curso" }],
        pasos: [P("voz", "Voz", "ok", { serv: "elevenlabs" }), P("lipsync", "Lip sync", "ok", { serv: "runpod" }), P("subs", "Subtítulos (400)", "ok"), P("fix", "Corregir congelado 0:58", "curso", { serv: "ffmpeg" }), P("qa", "Revisar de nuevo", "pend", { serv: "gemini" })],
        ultimo: { id: 7, texto: "Rehaciendo el corte en 0:58" } },
      { id: "demo-yogur-a7", dueno: "lorenzo", oferta: "Yogur Bariátrico AR", mercado: "AR", tipo: "creativo", nombre: "A7 · B-roll recetas", estado: "error", inicio: m(-50), actualizado: m(-15),
        servicios: { atlas: { estado: "error", det: "saldo insuficiente" } },
        pasos: [P("guion", "Guion", "ok"), P("broll", "B-roll 9 clips", "error", { serv: "atlas", n: 4, de: 9, det: "Atlas se quedó sin saldo" }), P("render", "Render", "pend", { serv: "lambda" })],
        ultimo: { id: 6, texto: "Atlas: saldo insuficiente (US$ 0,67)" } },
      { id: "demo-yogur-landing", dueno: "lorenzo", oferta: "Yogur Bariátrico AR", mercado: "AR", tipo: "landing", nombre: "Landing + checkout", estado: "para_revisar", inicio: m(-120), actualizado: m(-30),
        pasos: [P("estructura", "Estructura de la landing ganadora", "ok"), P("textos", "Textos en argentino", "ok"), P("fotos", "Fotos y reseñas reales", "ok", { serv: "gpt" }), P("checkout", "Checkout Cuoio", "ok", { serv: "impultienda" }), P("pixel", "Pixel y CAPI", "ok", { serv: "meta" })],
        previews: [{ t: "Landing en el celular", u: "https://example.com/", tipo: "web", ts: m(-30) }], links: [{ t: "Landing", u: "https://example.com/" }, { t: "Checkout", u: "https://example.com/" }], ultimo: { id: 3, texto: "Landing publicada" } },
      { id: "demo-yogur-camp", dueno: "lorenzo", oferta: "Yogur Bariátrico AR", mercado: "AR", tipo: "campana", nombre: "🇦🇷 23.10 CBO Yogur (LATAM)", estado: "esperando", inicio: m(-15), actualizado: m(-5),
        meta: { campana_id: "1", act: "1", estado: "PAUSED", presupuesto: 30.55, moneda: "USD" }, links: [{ t: "Ads Manager", u: "https://adsmanager.facebook.com/" }],
        pasos: [P("campana", "Campaña CBO", "ok", { serv: "meta" }), P("conjunto", "Conjunto con anunciante verificado", "ok", { serv: "meta" }), P("anuncios", "6 anuncios en pausa", "ok", { serv: "meta", n: 6, de: 6 }), P("prender", "Prender (lo hacés vos)", "pend")], ultimo: { id: 2, texto: "Campaña armada en pausa" } },
      { id: "demo-cuero-r1", dueno: "franco", oferta: "Cuero & Oficio JA", mercado: "JA", tipo: "reno", nombre: "Reno JPK-2 · hook nuevo", estado: "aprobado", inicio: m(-600), actualizado: m(-200),
        revision: { decision: "aprobado", por: "lorenzo", ts: m(-200) },
        pasos: [P("hook", "Hook visual 3 s", "ok"), P("voz", "Voz JPK-2", "ok", { serv: "elevenlabs" }), P("render", "Render", "ok", { serv: "lambda" }), P("drive", "Subir a Drive", "ok", { serv: "drive" })], ultimo: { id: 5, texto: "Entregado en Drive" } },
      { id: "demo-cuero-r2", dueno: "franco", oferta: "Cuero & Oficio JA", mercado: "JA", tipo: "reno", nombre: "Reno JPK-3 · H3", estado: "en_cola", inicio: m(-5), actualizado: m(-5),
        pasos: [P("prompts", "Prompts de tomas", "pend"), P("h3", "Clips H3", "pend", { serv: "runpod" }), P("voz", "Voz", "pend", { serv: "elevenlabs" }), P("render", "Render", "pend", { serv: "lambda" })] },
    ],
  };
}
function demoLog(id) {
  const t = (x) => new Date(Date.now() + x * 60000).toISOString();
  return [
    { id: 1, ts: t(-30), nivel: "cmd", serv: "claude", texto: `▶ Nuevo: ${id}` },
    { id: 2, ts: t(-25), nivel: "ok", serv: "elevenlabs", texto: "✓ Voz generada (1:49)" },
    { id: 3, ts: t(-20), nivel: "cmd", serv: "runpod", texto: "runpod: 4 pods prendidos (RTX 4090)" },
    { id: 4, ts: t(-8), nivel: "info", serv: "runpod", texto: "● Lip sync (3/7) · tramo t2 bajado, pod 2 apagado" },
    { id: 5, ts: t(-2), nivel: "warn", serv: "runpod", texto: "tramo t6 tarda más de lo esperado, lo vigilo" },
  ];
}

window.Taller = { montar, desmontar, abrir: (id) => { if (T.raiz) { const m = T.marcos.find((x) => x.items.some((i) => i.id === id)); if (m) volarA(m); abrir(id); } } };
})();

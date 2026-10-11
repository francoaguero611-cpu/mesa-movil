/* Dashboard Lorenzo — sin build. Backend: Edge Function app-movil (Codicia). */
"use strict";

const API = "https://tppcpnfzcxxusdhrlmdx.supabase.co/functions/v1/app-movil";
const URLP = new URLSearchParams(location.search);
const DEMO = URLP.get("demo") === "1";
const DRY_URL = URLP.get("dry") === "1";

// ---------- utilidades ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ls = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const NF2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NF0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const usd = (n) => (n == null || isNaN(n)) ? "—" : (n < 0 ? "−" : "") + "US$ " + NF2.format(Math.abs(n));
const usdG = (n) => (n == null || isNaN(n)) ? "—" : `${n < 0 ? "−" : ""}<span class="mon">US$</span>${NF2.format(Math.abs(n))}`;
const usd0 = (n) => (n == null || isNaN(n)) ? "—" : "US$ " + NF0.format(n);
const roasTx = (n) => (n == null || isNaN(n)) ? "—" : NF2.format(n);
const pct = (n) => (n == null || isNaN(n)) ? "—" : NF0.format(Math.round(n * 100)) + " %";
const ent = (n) => NF0.format(n || 0);
const hhmm = (iso) => { try { return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }); } catch { return "—"; } };
const reducido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function colorRoas(r) {
  if (r == null || isNaN(r)) return "gris";
  if (r < 1.3) return "rojo";
  if (r < 1.5) return "naranja";
  if (r < 2) return "amarillo";
  if (r <= 2.5) return "verde";
  return "verde-fuerte";
}
const chipRoas = (r) => `<span class="roas ${colorRoas(r)} num">${roasTx(r)}</span>`;
// (10/10, Lorenzo) Hoy · Ayer · Últimos 3 días (con hoy) · Elegir fechas (calendario). 7 y 30 días casi no se usan.
const PERIODOS = [["hoy", "Hoy"], ["ayer", "Ayer"], ["3d", "Últimos 3 días"], ["rango", "Personalizado"]];
const esRango = (p) => /^r:\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2}$/.test(p || "");
const periodoValido = (p) => ["hoy", "ayer", "3d"].includes(p) || esRango(p);
const dm = (iso) => { const [, m, d] = iso.split("-"); return `${+d}/${+m}`; };
const etiquetaPer = (k, t, actual) => k === "rango" && esRango(actual) ? (() => { const [, a, b] = actual.split(":"); return a === b ? dm(a) : `${dm(a)}–${dm(b)}`; })() : t;
const botonesPer = (attr, actual) => PERIODOS.map(([k, t]) => `<button type="button" class="btn chico${k === "rango" ? " per-rango" : ""}" ${attr}="${k}" aria-pressed="${k === actual || (k === "rango" && esRango(actual))}">${k === "rango" ? `<svg class="cal-ico" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M4.5 6.5 C 9 6, 15 6.3, 19.5 6.2 L 19.6 19 C 14 19.4, 9 19.2, 4.4 19.3 Z M4.6 10.4 C 10 10.2, 14 10.3, 19.4 10.2 M8.4 4 L 8.5 8 M15.6 4 L 15.5 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ""}${esc(etiquetaPer(k, t, actual))}</button>`).join("");

// Calendario de rango, con la estética de la app. Devuelve «r:desde:hasta» o null.
const isoAR = (d) => new Date(d.getTime() - 3 * 3600e3).toISOString().slice(0, 10);
function elegirRango(actual) {
  return new Promise((ok) => {
    const hoy = isoAR(new Date());
    let [a, b] = esRango(actual) ? actual.split(":").slice(1) : [null, null];
    let mes = (b || hoy).slice(0, 7);
    let listo = false;
    const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const m = abrirModal("", { alCerrar: () => { if (!listo) ok(null); } });
    const dias = (x, y) => Math.round((Date.parse(y + "T12:00:00Z") - Date.parse(x + "T12:00:00Z")) / 86400e3) + 1;
    const pintar = () => {
      const [Y, M] = mes.split("-").map(Number);
      const primero = new Date(Date.UTC(Y, M - 1, 1)), n = new Date(Date.UTC(Y, M, 0)).getUTCDate();
      const off = (primero.getUTCDay() + 6) % 7; // lunes primero
      let celdas = "";
      for (let i = 0; i < off; i++) celdas += `<span class="cal-v"></span>`;
      for (let d = 1; d <= n; d++) {
        const iso = `${mes}-${String(d).padStart(2, "0")}`, fut = iso > hoy;
        const ini = iso === a, fin = iso === (b || a), dentro = a && b && iso > a && iso < b;
        celdas += `<button type="button" class="cal-d${ini || fin ? " sel" : ""}${dentro ? " en" : ""}${iso === hoy ? " hoy" : ""}" data-d="${iso}" ${fut ? "disabled" : ""} aria-pressed="${!!(ini || fin || dentro)}">${d}</button>`;
      }
      const largo = a ? dias(a, b || a) : 0, mucho = largo > 92;
      const prevOk = true, nextOk = mes < hoy.slice(0, 7);
      m.set(`<h3>Elegí las fechas</h3>
        <p class="mut cal-ayuda">${!a ? "Tocá el primer día." : !b ? "Ahora tocá el último día (o el mismo, para un solo día)." : `${dm(a)} → ${dm(b)} · ${largo} día${largo === 1 ? "" : "s"}${mucho ? " · máximo 92" : ""}`}</p>
        <div class="cal boceto">
          <div class="cal-cab"><button type="button" class="btn icono cal-nav" data-mes="-1" aria-label="Mes anterior" ${prevOk ? "" : "disabled"}>‹</button><b>${MESES[M - 1]} ${Y}</b><button type="button" class="btn icono cal-nav" data-mes="1" aria-label="Mes siguiente" ${nextOk ? "" : "disabled"}>›</button></div>
          <div class="cal-sem">${["lu", "ma", "mi", "ju", "vi", "sá", "do"].map((x) => `<span>${x}</span>`).join("")}</div>
          <div class="cal-grilla">${celdas}</div>
          <svg class="cal-garabato" viewBox="0 0 160 12" aria-hidden="true"><path d="M2 8 C 30 3, 52 11, 80 6 S 130 3, 158 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
        </div>
        <div class="cal-atajos"><button type="button" class="btn chico" data-ult="7">Últimos 7</button><button type="button" class="btn chico" data-ult="14">Últimos 14</button><button type="button" class="btn chico" data-ult="30">Últimos 30</button></div>
        <div class="botones"><button type="button" class="btn" data-x>Cancelar</button><button type="button" class="btn pri" data-ok ${a && !mucho ? "" : "disabled"}>Ver estas fechas</button></div>`);
      const dlg = m.dlg;
      $$("[data-d]", dlg).forEach((x) => x.onclick = () => { const d = x.dataset.d; if (!a || b) { a = d; b = null; } else if (d < a) { b = a; a = d; } else b = d; pintar(); });
      $$("[data-mes]", dlg).forEach((x) => x.onclick = () => { const [y, mm] = mes.split("-").map(Number); const t = new Date(Date.UTC(y, mm - 1 + Number(x.dataset.mes), 1)); mes = t.toISOString().slice(0, 7); pintar(); });
      $$("[data-ult]", dlg).forEach((x) => x.onclick = () => { b = hoy; a = isoAR(new Date(Date.now() - (Number(x.dataset.ult) - 1) * 86400e3)); mes = hoy.slice(0, 7); pintar(); });
      $("[data-x]", dlg).onclick = m.cerrar;
      $("[data-ok]", dlg).onclick = () => { listo = true; m.cerrar(); ok(`r:${a}:${b || a}`); };
    };
    pintar();
  });
}
const NIVEL = { campana: ["campaña", "campañas"], conjunto: ["conjunto", "conjuntos"], anuncio: ["anuncio", "anuncios"] };
const plural = (n, nivel) => `${n} ${NIVEL[nivel][n === 1 ? 0 : 1]}`;

// ---------- estado ----------
const S = {
  periodo: "hoy",
  idx: 0,
  datos: {},                 // periodo -> respuesta de dash
  cargando: false,
  error: null,
  det: new Map(),            // `${periodo}|${campId}` -> {st:'cargando'|'ok'|'error', data, error}
  open: new Set(),           // "c:id" | "s:id"
  sel: new Map(),            // "nivel:id" -> {id, act, nivel, nombre, estado}
  verApagadas: ls.get("dash_ver_apagadas") === "1",
  dir: 0,
  vista: "dash",             // "dash" | "reglas" | "ranking" | "login"
};
const dryOn = () => DRY_URL || ls.get("dash_dry") === "1";
const clave = () => ls.get("dash_clave", "");

// ---------- API ----------
async function api(accion, { q = "", body = null, escritura = false } = {}) {
  if (escritura && dryOn()) q += "&dry=1";
  if (DEMO) { await cargarDemo(); return window.DemoAPI.handle(accion, q, body); }
  let r;
  try {
    r = await fetch(`${API}?accion=${accion}${q}`, {
      method: body ? "POST" : "GET",
      headers: { "x-app-clave": clave(), ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (e) {
    const err = new Error("Sin conexión con el servidor"); err.code = 0; throw err;
  }
  if (r.status === 401) { const e = new Error("Clave incorrecta"); e.code = 401; throw e; }
  let j = null;
  try { j = await r.json(); } catch { /* vacío */ }
  if (!r.ok || (j && j.error && !Array.isArray(j))) {
    const e = new Error((j && j.error) || `Error ${r.status}`); e.code = r.status; e.data = j; throw e;
  }
  if (j && r.headers.get("x-sw-cache") === "1") j.__offline = r.headers.get("x-sw-fecha") || true;
  return j;
}
let demoP = null;
function cargarDemo() {
  if (window.DemoAPI) return Promise.resolve();
  if (!demoP) demoP = new Promise((ok, no) => { const s = document.createElement("script"); s.src = "demo.js?v=23"; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  return demoP;
}

// ---------- toasts ----------
function toast(msg, tipo = "ok", ms = 5200) {
  const t = document.createElement("div");
  t.className = "toast" + (tipo === "error" ? " error" : "");
  t.setAttribute("role", tipo === "error" ? "alert" : "status");
  t.innerHTML = `<div>${msg}</div><button class="x" type="button" aria-label="Cerrar aviso">✕</button>`;
  $(".x", t).onclick = () => t.remove();
  $("#toasts").appendChild(t);
  setTimeout(() => t.remove(), ms);
}

// ---------- modal ----------
let modalActual = null;
function abrirModal(html, { ancho = false, bloqueado = () => false, alCerrar = null } = {}) {
  cerrarModal();
  const previo = document.activeElement;
  const velo = document.createElement("div");
  velo.className = "velo";
  velo.innerHTML = `<div class="dialogo boceto${ancho ? " ancho" : ""}" role="dialog" aria-modal="true" tabindex="-1">${html}</div>`;
  const dlg = $(".dialogo", velo);
  const cerrar = () => { if (bloqueado()) return; velo.remove(); modalActual = null; document.removeEventListener("keydown", tecla, true); alCerrar && alCerrar(); try { previo && previo.focus(); } catch {} };
  const tecla = (e) => {
    if (e.key === "Escape") { e.preventDefault(); cerrar(); }
    if (e.key === "Tab") {
      const f = $$('button:not([disabled]), input, a[href], [tabindex="0"]', dlg);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  };
  velo.addEventListener("pointerdown", (e) => { if (e.target === velo) cerrar(); });
  document.addEventListener("keydown", tecla, true);
  $("#modal-raiz").appendChild(velo);
  modalActual = { velo, dlg, cerrar, set(h) { dlg.innerHTML = h; enfocar(); } };
  const enfocar = () => { const f = $("[data-foco]", dlg) || $("button.pri, button", dlg) || dlg; f.focus({ preventScroll: true }); };
  enfocar();
  return modalActual;
}
function cerrarModal() { if (modalActual) { modalActual.velo.remove(); modalActual = null; } }

// ---------- tema ----------
function temaEfectivo() {
  const t = document.documentElement.getAttribute("data-theme");
  if (t) return t;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function pintarTema() {
  const osc = temaEfectivo() === "dark";
  $$('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", osc ? "#1b1a17" : "#f4efe2"));
}
function alternarTema() {
  const nuevo = temaEfectivo() === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", nuevo);
  ls.set("dash_tema", nuevo);
  pintarTema();
}
function temaSistema() {
  document.documentElement.removeAttribute("data-theme");
  ls.del("dash_tema");
  pintarTema();
}

// ---------- badges + menú ----------
function pintarBadges() {
  $("#badges").innerHTML = (DEMO ? `<span class="badge demo" title="Datos falsos, nada toca Meta">DEMO</span>` : "") +
    (dryOn() ? `<span class="badge" title="Todas las escrituras van con dry=1: Meta no se toca">MODO PRUEBA</span>` : "");
}
function pintarMenu() {
  const m = $("#menu");
  const dry = dryOn();
  m.innerHTML = `
    <button class="item" role="menuitemcheckbox" aria-checked="${dry}" id="mi-dry" ${DRY_URL ? "disabled" : ""}>
      <span>Modo prueba<br><small>${DRY_URL ? "forzado por ?dry=1 en la dirección" : "las escrituras no tocan Meta"}</small></span>
      <span class="toggle-chico" aria-hidden="true" ${dry ? 'aria-checked="true"' : ""}><span class="mini"></span></span>
    </button>
    <button class="item" role="menuitemcheckbox" aria-checked="${temaEfectivo() === "dark"}" id="mi-oscuro">
      <span>Modo oscuro<br><small>${document.documentElement.getAttribute("data-theme") ? "elegido a mano" : "sigue al sistema"}</small></span>
      <span class="toggle-chico" aria-hidden="true" ${temaEfectivo() === "dark" ? 'aria-checked="true"' : ""}><span class="mini"></span></span>
    </button>
    <button class="item" role="menuitem" id="mi-reglas"><span>Reglas<br><small>ver y editar las automáticas</small></span><span aria-hidden="true">⚙</span></button>
    <button class="item" role="menuitem" id="mi-log"><span>Registro de acciones<br><small>últimas 50</small></span><span aria-hidden="true">📜</span></button>
    <button class="item" role="menuitem" id="mi-avisos"><span>Activar avisos<br><small id="mi-avisos-tx">…</small></span><span aria-hidden="true">🔔</span></button>
    <button class="item" role="menuitem" id="mi-probar"><span>Probar aviso<br><small>${DEMO ? "muestra uno de ejemplo" : "manda uno a tus equipos"}</small></span><span aria-hidden="true">✉</span></button>
    ${DEMO ? `<button class="item" role="menuitem" id="mi-ejemplos"><span>Avisos de ejemplo<br><small>uno de cada tipo</small></span><span aria-hidden="true">✦</span></button>` : ""}
    <button class="item" role="menuitem" id="mi-sistema"><span>Tema del sistema<br><small>volver a claro/oscuro automático</small></span><span aria-hidden="true">◐</span></button>
    <hr>
    ${DEMO ? `<a class="item" role="menuitem" href="${location.pathname}"><span>Salir del demo</span><span aria-hidden="true">↩</span></a>` : `<button class="item" role="menuitem" id="mi-salir"><span>Salir</span><span aria-hidden="true">↩</span></button>`}`;
  $("#mi-dry").onclick = () => { if (DRY_URL) return; ls.set("dash_dry", dryOn() ? "0" : "1"); pintarBadges(); pintarMenu(); toast(dryOn() ? "Modo prueba prendido: las escrituras van con dry=1." : "Modo prueba apagado: las escrituras tocan Meta de verdad."); };
  $("#mi-log").onclick = () => { cerrarMenu(); verRegistro(); };
  $("#mi-reglas").onclick = () => { cerrarMenu(); verReglas(); };
  $("#mi-sistema").onclick = () => { temaSistema(); cerrarMenu(); };
  $("#mi-oscuro").onclick = () => { alternarTema(); pintarMenu(); $("#mi-oscuro").focus(); };
  $("#mi-avisos").onclick = () => { cerrarMenu(); activarAvisos(); };
  $("#mi-probar").onclick = () => { cerrarMenu(); probarAviso(); };
  if ($("#mi-ejemplos")) $("#mi-ejemplos").onclick = () => { cerrarMenu(); avisosEjemplo(); };
  pintarEstadoAvisos();
  const s = $("#mi-salir");
  if (s) s.onclick = () => { ls.del("dash_clave"); S.datos = {}; S.det.clear(); S.sel.clear(); RK.datos = {}; RK.sel.clear(); RK.fab = null; cerrarMenu(); pintarBarra(); login(); };
}
function abrirMenu() { pintarMenu(); $("#menu").hidden = false; $("#b-menu").setAttribute("aria-expanded", "true"); ($("#menu .item:not([disabled])") || $("#menu")).focus(); }
function cerrarMenu() { $("#menu").hidden = true; $("#b-menu").setAttribute("aria-expanded", "false"); }

async function verRegistro() {
  const m = abrirModal(`<h3>Registro de acciones</h3><p class="mut"><span class="cargador"></span>Cargando…</p>`, { ancho: true });
  try {
    const r = await api("dash_log");
    const xs = Array.isArray(r) ? r : (r.log || r.acciones || r.items || []);
    const fila = (x) => {
      const f = x.creado || x.created_at || x.fecha || x.ts;
      const quien = x.accion || x.tipo || "";
      const dry = x.dry ? ' <span class="estado-tx">prueba</span>' : "";
      const det = x.resumen || x.detalle || x.texto || "";
      return `<li><b>${esc(quien)}</b>${dry} <span class="mut">${f ? esc(new Date(f).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })) : ""}</span>${det ? `<div>${esc(typeof det === "string" ? det : JSON.stringify(det))}</div>` : ""}${!det ? `<div class="pre">${esc(JSON.stringify(x).slice(0, 400))}</div>` : ""}</li>`;
    };
    m.set(`<h3>Registro de acciones</h3>${xs.length ? `<ul class="lista-nombres registro">${xs.map(fila).join("")}</ul>` : `<p class="mut">Todavía no hay acciones registradas.</p>`}<div class="botones"><button class="btn pri" data-cerrar>Cerrar</button></div>`);
  } catch (e) {
    m.set(`<h3>Registro de acciones</h3><div class="err-box">${esc(e.message)}</div><div class="botones"><button class="btn pri" data-cerrar>Cerrar</button></div>`);
  }
  const b = $("[data-cerrar]", m.dlg); if (b) b.onclick = m.cerrar;
}

// ---------- login ----------
function login(msg = "") {
  pararRanking(); S.vista = "login";
  const nav = $("#secciones"); if (nav) nav.hidden = true;
  pintarBarra();
  $("#main").innerHTML = `
    <form class="login boceto" id="f-login" autocomplete="on">
      <h2>Entrar</h2>
      <p>Poné la clave del dashboard.</p>
      <label class="sr" for="clave">Clave</label>
      <input class="campo" id="clave" name="password" type="password" autocomplete="current-password" placeholder="Clave" required data-foco>
      <button class="btn pri" type="submit" id="b-entrar">Entrar</button>
      <div class="error" id="login-err" role="alert">${esc(msg)}</div>
    </form>`;
  $("#clave").focus();
  $("#f-login").onsubmit = async (e) => {
    e.preventDefault();
    const v = $("#clave").value.trim();
    if (!v) return;
    const b = $("#b-entrar"); b.classList.add("cargando"); b.innerHTML = `<span class="gira">↻</span> Entrando…`;
    ls.set("dash_clave", v);
    try {
      const d = await api("dash", { q: "&periodo=hoy" });
      S.datos.hoy = d; S.periodo = "hoy"; S.idx = 0;
      abrirInicial();
      eventoPendiente();
    } catch (err) {
      if (err.code === 401) { ls.del("dash_clave"); login("Clave incorrecta"); }
      else { login(err.message || "No se pudo conectar"); ls.set("dash_clave", v); }
    }
  };
}

// ---------- carga de datos ----------
async function cargar(forzar = false) {
  const per = S.periodo;
  S.cargando = true; S.error = null; pintarControles();
  if (!S.datos[per]) pintarTodo();
  try {
    const d = await api("dash", { q: `&periodo=${per}${forzar ? "&forzar=1" : ""}` });
    S.datos[per] = d;
    if (forzar) { for (const k of [...S.det.keys()]) if (k.startsWith(per + "|")) S.det.delete(k); }
  } catch (e) {
    if (e.code === 401) { ls.del("dash_clave"); return login("Clave incorrecta"); }
    S.error = e.message;
    toast(esc(e.message), "error");
  }
  S.cargando = false;
  if (per !== S.periodo) return;
  ajustarIdx();
  pintarTodo();
  // recargar detalles abiertos
  for (const k of S.open) if (k.startsWith("c:")) { const c = campanaPorId(k.slice(2)); if (c) cargarDetalle(c); }
}
function grupos() {
  const d = S.datos[S.periodo];
  if (!d?.grupos?.length) return [{ clave: "todas", etiqueta: "Todas", metricas: {} }];
  // (Lorenzo 09/10) «Todas» primero; después de mayor a menor ROAS; sin ROAS al final
  const r = (g) => (g.metricas?.roas == null || isNaN(g.metricas.roas)) ? -Infinity : g.metricas.roas;
  const todas = d.grupos.filter((g) => g.clave === "todas"), resto = d.grupos.filter((g) => g.clave !== "todas");
  return [...todas, ...resto.slice().sort((a, b) => r(b) - r(a))];
}
function grupoActual() { return grupos()[S.idx] || grupos()[0]; }
function ajustarIdx() {
  const g = grupos();
  const i = g.findIndex((x) => x.clave === S.grupoClave);
  S.idx = i >= 0 ? i : 0;
  S.grupoClave = g[S.idx].clave;
}
function campanaPorId(id) { return (S.datos[S.periodo]?.campanas || []).find((c) => c.id === id); }

async function cargarDetalle(c, forzar = false) {
  const k = `${S.periodo}|${c.id}`;
  const prev = S.det.get(k);
  if (prev && !forzar && prev.st !== "error") return;
  S.det.set(k, { st: "cargando" });
  pintarTabla();
  try {
    const d = await api("dash_detalle", { q: `&id=${encodeURIComponent(c.id)}&act=${encodeURIComponent(c.act)}&periodo=${S.periodo}` });
    S.det.set(k, { st: "ok", data: d });
  } catch (e) {
    if (e.code === 401) { ls.del("dash_clave"); return login("Clave incorrecta"); }
    S.det.set(k, { st: "error", error: e.message });
  }
  pintarTabla();
}

// ---------- montaje ----------
function montar() {
  pararRanking(); S.vista = "dash"; ls.set("dash_seccion", "dash");
  if (location.hash === "#ranking") { try { history.replaceState(null, "", location.pathname + location.search); } catch {} }
  pintarNav();
  $("#main").innerHTML = `
    <div class="sel-grupo-caja boceto"><label class="sr" for="sel-grupo">Oferta y mercado</label><select id="sel-grupo" class="sel-grupo"></select><span class="sel-flecha" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M5.5 9.5 C 8 12, 10.5 14, 12.2 15.5 C 14 13.6, 16.4 11.6, 18.6 9.2" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>
    <div class="controles">
      <div class="periodos" role="group" aria-label="Período">${botonesPer("data-per", S.periodo)}</div>
      <div class="hora" id="hora"></div>
    </div>
    <div id="avisos"></div>
    <section class="carr" id="carr" aria-roledescription="carrusel" aria-label="Métricas por grupo">
      <button type="button" class="btn flecha prev" id="b-prev" aria-label="Grupo anterior"><span class="izq"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9.5 5.5 C 12 8, 14 10.5, 15.5 12.2 C 13.6 14, 11.6 16.4, 9.2 18.6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>
      <div class="etiqueta" id="etiqueta" aria-live="polite"></div>
      <div class="tarjetas" id="tarjetas"></div>
      <button type="button" class="btn flecha next" id="b-next" aria-label="Grupo siguiente"><span class="der"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9.5 5.5 C 12 8, 14 10.5, 15.5 12.2 C 13.6 14, 11.6 16.4, 9.2 18.6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>
      <div class="pos" id="pos"></div>
    </section>
    <section class="seccion-camp" aria-labelledby="t-camp">
      <div class="cab-tabla">
        <h2 id="t-camp">Campañas <small id="n-camp"></small></h2>
        <span class="cab-der"><button type="button" class="btn chico" id="b-cols" aria-haspopup="dialog">Columnas</button><button type="button" class="toggle-chico" role="switch" id="t-apagadas" aria-checked="${S.verApagadas}"><span class="mini" aria-hidden="true"></span><span id="t-apagadas-tx">ver apagadas</span></button></span>
      </div>
      <div class="tabla-caja boceto"><div class="tabla-scroll" id="tabla-scroll"></div></div>
    </section>`;
  $$("[data-per]").forEach((b) => b.onclick = () => cambiarPeriodo(b.dataset.per));
  $("#sel-grupo").onchange = (e) => irA(+e.target.value);
  $("#b-prev").onclick = () => paso(-1);
  $("#b-next").onclick = () => paso(1);
  $("#b-cols").onclick = elegirColumnas; pintarBotonCols();
  $("#t-apagadas").onclick = () => { S.verApagadas = !S.verApagadas; ls.set("dash_ver_apagadas", S.verApagadas ? "1" : "0"); $("#t-apagadas").setAttribute("aria-checked", S.verApagadas); pintarTabla(); };
  gestosCarrusel($("#carr"));
  $("#tabla-scroll").addEventListener("click", clickTabla);
  $("#tabla-scroll").addEventListener("keydown", teclaTabla);
  pintarTodo();
  if (!S.datos[S.periodo]) cargar();
}
function pintarTodo() { pintarControles(); pintarAvisos(); pintarCarrusel(); pintarTabla(); pintarBarra(); }

function pintarControles() {
  const h = $("#hora"); if (!h) return;
  const pp = $(".controles .periodos"); if (pp) { pp.innerHTML = botonesPer("data-per", S.periodo); $$("[data-per]", pp).forEach((b) => b.onclick = () => cambiarPeriodo(b.dataset.per)); }
  const d = S.datos[S.periodo];
  const hora = d ? hhmm(d.cache?.hora || d.generado) : null;
  let tx = "";
  if (d?.__offline) tx = `<span class="aviso">Sin conexión: datos guardados de las ${hora}</span>`;
  else if (d?.cache?.de_cache) tx = `<span class="aviso" title="${esc(d.cache.aviso || "")}">Datos de las ${hora} (Meta sin cupo)</span>`;
  else if (d) tx = `<span>Datos de las <b class="num">${hora}</b></span>`;
  else tx = `<span>${S.cargando ? "Cargando…" : ""}</span>`;
  h.innerHTML = tx;
  const br = $("#b-ref"); if (br) br.classList.toggle("cargando", !!S.cargando);
}
function pintarAvisos() {
  const a = $("#avisos"); if (!a) return;
  const d = S.datos[S.periodo];
  let h = "";
  if (S.error && !d) h += `<div class="hint error boceto">No se pudieron traer los datos: ${esc(S.error)}. Tocá ↻ para reintentar.</div>`;
  if (d?.errores?.length) h += `<div class="hint boceto">⚠ Faltan datos: ${esc(d.errores.join(" · "))}</div>`;
  a.innerHTML = h;
}

// ---------- carrusel ----------
function metricasHTML(g) {
  const m = g.metricas || {};
  const gan = m.ganancia;
  return `
    <div class="met boceto"><div class="lbl">Facturación bruta</div><div class="val num">${usdG(m.facturacion)}</div><div class="sub num">${m.ventas != null ? `${ent(m.ventas)} ventas` : "&nbsp;"}</div></div>
    <div class="met boceto"><div class="lbl">Margen</div><div class="val num ${m.margen != null && m.margen < 0 ? "neg" : ""}">${pct(m.margen)}</div><div class="sub">ganancia ÷ facturación</div></div>
    <div class="met boceto"><div class="lbl">ROAS</div><div class="val num"><span class="roas ${colorRoas(m.roas)} chip-roas">${roasTx(m.roas)}</span></div><div class="sub">facturación ÷ gasto</div></div>
    <div class="met boceto"><div class="lbl">Importe gastado</div><div class="val num">${usdG(m.gasto)}</div><div class="sub">en Meta</div></div>
    <div class="met boceto"><div class="lbl">Ganancia</div><div class="val num ${gan == null ? "" : gan < 0 ? "neg" : "positivo"}">${usdG(gan)}</div><div class="sub">neto real − gasto</div></div>
    <div class="met boceto"><div class="lbl">Ventas</div><div class="val num">${m.ventas != null ? ent(m.ventas) : "—"}</div><div class="sub">compras reales</div></div>
    <div class="met boceto"><div class="lbl">CPA</div><div class="val num">${m.ventas ? usdG(m.gasto / m.ventas) : "—"}</div><div class="sub">gasto ÷ ventas</div></div>
    <div class="met boceto"><div class="lbl">Ticket promedio</div><div class="val num">${m.ventas ? usdG(m.facturacion / m.ventas) : "—"}</div><div class="sub">facturación ÷ ventas</div></div>
    <div class="met boceto"><div class="lbl">% Order bump</div><div class="val num">${m.pct_bump != null ? pct(m.pct_bump) : "—"}</div><div class="sub num">${m.con_bump != null ? `${ent(m.con_bump)} de ${ent(m.ventas_principales ?? m.ventas)} ventas` : "&nbsp;"}</div></div>
    <div class="met boceto"><div class="lbl">% Post-compra</div><div class="val num">${m.pct_post != null ? pct(m.pct_post) : "—"}</div><div class="sub num">${m.con_post != null ? `${ent(m.con_post)} de ${ent(m.ventas_principales ?? m.ventas)} ventas` : "&nbsp;"}</div></div>`;
}
function pintarCarrusel() {
  const t = $("#tarjetas"); if (!t) return;
  const gs = grupos(); const g = grupoActual(); const n = gs.length;
  const d = S.datos[S.periodo];
  $("#etiqueta").innerHTML = `${g.bandera ? `<span class="ban" aria-hidden="true">${esc(g.bandera)}</span>` : ""}<h2>${esc(g.etiqueta || g.oferta || "Todas")}</h2>${g.clave === "todas" ? `<small>general</small>` : ""}`;
  if (!d) t.innerHTML = `<div class="met boceto esqueleto" style="grid-column:1/-1"></div>`;
  else t.innerHTML = metricasHTML(g);
  if (S.dir && !reducido()) { t.classList.remove("entra-der", "entra-izq"); void t.offsetWidth; t.classList.add(S.dir > 0 ? "entra-der" : "entra-izq"); }
  S.dir = 0;
  $("#b-prev").disabled = S.idx <= 0;
  $("#b-next").disabled = S.idx >= n - 1;
  $("#pos").innerHTML = (n > 1 && n <= 16 ? `<div class="puntos">${gs.map((x, i) => `<button type="button" class="punto" data-ir="${i}" aria-label="Ir a ${esc(x.etiqueta)}" ${i === S.idx ? 'aria-current="true"' : ""}></button>`).join("")}</div>` : "") + `<span class="contador num">${S.idx + 1} / ${n}</span>`;
  $$("[data-ir]").forEach((b) => b.onclick = () => irA(+b.dataset.ir));
  const sg = $("#sel-grupo");
  if (sg) sg.innerHTML = gs.map((x, i) => `<option value="${i}"${i === S.idx ? " selected" : ""}>${esc((x.bandera ? x.bandera + " " : "") + (x.etiqueta || x.oferta || "Todas"))}</option>`).join("");
}
function irA(i) {
  const n = grupos().length;
  i = Math.max(0, Math.min(n - 1, i));
  if (i === S.idx) return false;
  S.dir = i > S.idx ? 1 : -1;
  S.idx = i; S.grupoClave = grupos()[i].clave;
  pintarCarrusel(); pintarTabla();
  return true;
}
const paso = (d) => irA(S.idx + d);

function gestosCarrusel(el) {
  // Trackpad: deslizamiento horizontal con dos dedos (wheel con deltaX dominante).
  let acum = 0, bloqueado = false, finTimer = null;
  el.addEventListener("wheel", (e) => {
    const ax = Math.abs(e.deltaX), ay = Math.abs(e.deltaY);
    if (ax <= ay * 1.2 || ax < 1) return;          // vertical: dejar pasar el scroll
    e.preventDefault();                               // evita el «atrás» del navegador
    clearTimeout(finTimer);
    finTimer = setTimeout(() => { bloqueado = false; acum = 0; }, 180);   // fin del gesto (incluye inercia)
    if (bloqueado) return;
    acum += e.deltaMode === 1 ? e.deltaX * 16 : e.deltaX;
    if (Math.abs(acum) >= 55) { paso(acum > 0 ? 1 : -1); bloqueado = true; acum = 0; }
  }, { passive: false });
  // Swipe táctil / lápiz / arrastre con mouse.
  let x0 = null, y0 = 0, t0 = 0, id = null;
  el.addEventListener("pointerdown", (e) => {
    if (e.button > 0 || e.target.closest("button")) return;
    x0 = e.clientX; y0 = e.clientY; t0 = Date.now(); id = e.pointerId;
  });
  const fin = (e) => {
    if (x0 == null || e.pointerId !== id) return;
    const dx = e.clientX - x0, dy = e.clientY - y0, dt = Date.now() - t0;
    x0 = null;
    if (e.type === "pointercancel") return;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 900) paso(dx < 0 ? 1 : -1);
  };
  el.addEventListener("pointerup", fin);
  el.addEventListener("pointercancel", fin);
}
document.addEventListener("keydown", (e) => {
  if (modalActual || !$("#carr")) return;
  if (e.key === "Escape" && !$("#menu").hidden) { cerrarMenu(); $("#b-menu").focus(); return; }
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || e.target.isContentEditable || e.altKey || e.metaKey || e.ctrlKey) return;
  if (e.target.closest && e.target.closest(".tabla-scroll")) return;   // en la tabla las flechas no mueven el carrusel
  if (e.key === "ArrowLeft") { e.preventDefault(); paso(-1); }
  if (e.key === "ArrowRight") { e.preventDefault(); paso(1); }
});

async function cambiarPeriodo(p) {
  if (p === "rango") { const r = await elegirRango(S.periodo); if (!r) return; p = r; }
  if (p === S.periodo) return;
  S.periodo = p; S.sel.clear();
  if (S.datos[p]) { ajustarIdx(); pintarTodo(); }
  else { pintarTodo(); cargar(); }
  for (const k of S.open) if (k.startsWith("c:") && S.datos[p]) { const c = campanaPorId(k.slice(2)); if (c) cargarDetalle(c); }
}

// ---------- tabla ----------
const ordenRoas = (a, b) => (b.roas ?? -1) - (a.roas ?? -1) || (b.gasto || 0) - (a.gasto || 0);
const prendido = (e) => e === "ACTIVE";
const ESTRAT = { COST_CAP: "CostCap", LOWEST_COST_WITH_BID_CAP: "BidCap", BID_CAP: "BidCap", LOWEST_COST_WITHOUT_CAP: "menor costo", LOWEST_COST_WITH_MIN_ROAS: "ROAS mín." };
const estrat = (e) => esc(ESTRAT[e] || String(e).replace(/_/g, " ").toLowerCase());
const ESTADOS = { PAUSED: "apagado", CAMPAIGN_PAUSED: "campaña apagada", ADSET_PAUSED: "conjunto apagado", WITH_ISSUES: "con problemas", DISAPPROVED: "rechazado", PENDING_REVIEW: "en revisión", IN_PROCESS: "procesando", ARCHIVED: "archivado", DELETED: "borrado" };
function dotEstado(e) {
  const on = prendido(e);
  const cls = on ? "on" : (e === "PAUSED" || e === "CAMPAIGN_PAUSED" || e === "ADSET_PAUSED" || e === "ARCHIVED") ? "off" : "raro";
  return `<span class="dot ${cls}" role="img" aria-label="${on ? "prendido" : esc(ESTADOS[e] || String(e || "").toLowerCase())}" title="${on ? "Prendido" : esc(ESTADOS[e] || e)}"></span>`;
}
function campanasVisibles() {
  const d = S.datos[S.periodo]; if (!d) return { xs: [], ocultas: 0 };
  const g = grupoActual();
  const delGrupo = (d.campanas || []).filter((c) => g.clave === "todas" || c.grupo === g.clave);
  const xs = delGrupo.filter((c) => S.verApagadas || prendido(c.estado)).sort(ordenRoas);
  return { xs, ocultas: delGrupo.length - delGrupo.filter((c) => prendido(c.estado)).length };
}
const NF1 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nulo = (n) => n == null || (typeof n === "number" && isNaN(n));
const entN = (n) => nulo(n) ? "—" : NF0.format(n);
const pctN = (n) => nulo(n) ? "—" : NF0.format(Math.round(n * 100)) + " %";
const pct1 = (n) => nulo(n) ? "—" : NF1.format(n * 100) + " %";
const dec2 = (n) => nulo(n) ? "—" : NF2.format(n);
const signo = (n) => nulo(n) || n === 0 ? "" : n < 0 ? "neg pierde" : "gana";
const cpaDe = (x) => x.cpa !== undefined ? x.cpa : (x.ventas ? x.gasto / x.ventas : null);
const aovDe = (x) => x.ticket_promedio !== undefined ? x.ticket_promedio : (x.ventas ? x.facturacion / x.ventas : null);
// [clave, título, formato(x) -> html, clase extra(x)]
const COLS = [
  ["ganancia", "Ganancia / pérdida", (x) => usdG(x.ganancia), (x) => signo(x.ganancia)],
  ["margen", "Margen %", (x) => pctN(x.margen), (x) => signo(x.margen ?? x.ganancia)],
  ["roas", "ROAS", (x) => chipRoas(x.roas)],
  ["ventas", "Ventas", (x) => entN(x.ventas)],
  ["ticket_promedio", "AOV", (x) => usdG(aovDe(x))],
  ["gasto", "Importe gastado", (x) => usdG(x.gasto)],
  ["presupuesto", "Presupuesto", (x) => `${usdG(x.presupuesto)}${x.tipo_presupuesto ? ` <span class="chip-tp">${esc(x.tipo_presupuesto)}</span>` : ""}`],
  ["cpa", "CPA", (x) => usdG(cpaDe(x))],
  ["costo_pago_iniciado", "Costo x pago iniciado", (x) => usdG(x.costo_pago_iniciado)],
  ["costo_carrito", "Costo x carrito", (x) => usdG(x.costo_carrito)],
  ["pagos_iniciados", "Pagos iniciados", (x) => entN(x.pagos_iniciados)],
  ["carritos", "Carritos", (x) => entN(x.carritos)],
  ["visitas", "Visitas", (x) => entN(x.visitas)],
  ["conv_visitas", "Conv. visitas→venta", (x) => pct1(x.conv_visitas)],
  ["clics", "Clics", (x) => entN(x.clics)],
  ["ctr", "CTR", (x) => pct1(x.ctr)],
  ["cpc", "CPC", (x) => usdG(x.cpc)],
  ["cpm", "CPM", (x) => usdG(x.cpm)],
  ["impresiones", "Impresiones", (x) => entN(x.impresiones)],
  ["frecuencia", "Frecuencia", (x) => dec2(x.frecuencia)],
];
const colsOcultas = (() => { try { return new Set(JSON.parse(ls.get("dash_cols_ocultas", "[]"))); } catch { return new Set(); } })();
const colsVisibles = () => COLS.filter((c) => !colsOcultas.has(c[0]));
const nCols = () => 1 + colsVisibles().length;
function celdas(x) {
  return colsVisibles().map(([k, , f, cl]) => `<td class="num c-${k} ${cl ? cl(x) : ""}">${f(x)}</td>`).join("");
}
function elegirColumnas() {
  const pinta = () => `<h3>Columnas</h3><p class="mut">Se recuerda en este dispositivo. La de nombre queda siempre.</p>
    <div class="cols-lista">${COLS.map(([k, t]) => `<label class="col-op"><input type="checkbox" data-col="${k}" ${colsOcultas.has(k) ? "" : "checked"}> ${esc(t)}</label>`).join("")}</div>
    <div class="botones"><button type="button" class="btn chico" data-todas>Mostrar todas</button><button type="button" class="btn pri" data-x>Listo</button></div>`;
  const m = abrirModal(pinta());
  const guardar = () => { ls.set("dash_cols_ocultas", JSON.stringify([...colsOcultas])); pintarTabla(); pintarBotonCols(); };
  const enlazar = () => {
    $$("[data-col]", m.dlg).forEach((c) => c.onchange = () => { c.checked ? colsOcultas.delete(c.dataset.col) : colsOcultas.add(c.dataset.col); guardar(); });
    $("[data-todas]", m.dlg).onclick = () => { colsOcultas.clear(); guardar(); m.set(pinta()); enlazar(); };
    $("[data-x]", m.dlg).onclick = m.cerrar;
  };
  enlazar();
}
function pintarBotonCols() { const b = $("#b-cols"); if (b) b.textContent = colsOcultas.size ? `Columnas (${COLS.length - colsOcultas.size}/${COLS.length})` : "Columnas"; }
function fila({ nivel, n, x, act, sub, abrible, abierto, extraEstado }) {
  const k = `${nivel}:${x.id}`;
  const sel = S.sel.has(k);
  const etiquetaTg = nivel === "campana" ? "conjuntos" : "anuncios";
  const raro = !prendido(x.estado) && x.estado !== "PAUSED" ? `<span class="estado-tx">${esc(ESTADOS[x.estado] || String(x.estado || "").toLowerCase())}</span>` : "";
  return `<tr class="fila nivel-${n}${abierto ? " abierta" : ""}${sel ? " sel" : ""}" data-k="${esc(k)}" data-act="${esc(act)}" tabindex="0" aria-selected="${sel}">
    <td class="nom"><div class="nomwrap">
      ${abrible ? `<button type="button" class="tg" data-tg="${esc((nivel === "campana" ? "c:" : "s:") + x.id)}" aria-expanded="${abierto}" aria-label="${abierto ? "Ocultar" : "Ver"} ${etiquetaTg} de ${esc(x.nombre)}"><span aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9.5 5.5 C 12 8, 14 10.5, 15.5 12.2 C 13.6 14, 11.6 16.4, 9.2 18.6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>` : `<span class="tg-hueco" aria-hidden="true"></span>`}
      ${dotEstado(x.estado)}
      <div class="txt"><span class="niv-tag niv-${nivel}">${NIVEL[nivel][0]}</span><div class="n">${esc(x.nombre)}${raro}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>
    </div></td>${celdas(x)}</tr>`;
}
function subCampana(c) {
  const p = [];
  if (c.cuenta) p.push(esc(c.cuenta));
  if (c.estrategia) p.push(estrat(c.estrategia));
  return p.join(" · ");
}
function subConjunto(s) {
  const p = [];
  if (s.bid) p.push(`bid ${usd0(s.bid)}`);
  if (s.estrategia) p.push(estrat(s.estrategia));
  return p.join(" · ");
}
// (10/10, Lorenzo) Encabezado de columnas pegado arriba al bajar por las campañas (y vuelve a su lugar al subir).
// Es una copia del <thead> en un div fijo: mismos anchos que la tabla real y se mueve con su scroll horizontal.
function armarCabFlotante() {
  const sc = $("#tabla-scroll"), tb = $("table.camp", sc || document);
  let f = $("#cab-flotante");
  if (!sc || !tb) { if (f) f.hidden = true; return; }
  if (!f) { f = document.createElement("div"); f.id = "cab-flotante"; f.className = "cab-flotante"; f.setAttribute("aria-hidden", "true"); document.body.appendChild(f); }
  const th = $$("thead th", tb);
  f.innerHTML = `<table class="camp"><thead><tr>${th.map((x) => `<th class="${x.className}">${x.innerHTML}</th>`).join("")}</tr></thead></table>`;
  if (!sc.dataset.cabFlot) {
    sc.dataset.cabFlot = "1";
    sc.addEventListener("scroll", ubicarCabFlotante, { passive: true });
  }
  ubicarCabFlotante();
}
function ubicarCabFlotante() {
  const f = $("#cab-flotante"), sc = $("#tabla-scroll"), tb = sc && $("table.camp", sc);
  if (!f || !tb || S.vista !== "dash") { if (f) f.hidden = true; return; }
  const th = $$("thead th", tb), tr = $("thead", tb).getBoundingClientRect(), r = sc.getBoundingClientRect();
  const top = parseFloat(getComputedStyle(document.documentElement).paddingTop) || 0; // zona segura del iPhone
  const visible = tr.top < top && tb.getBoundingClientRect().bottom > top + tr.height + 40;
  f.hidden = !visible; if (!visible) return;
  f.style.top = top + "px"; f.style.left = r.left + "px"; f.style.width = sc.clientWidth + "px";
  const ft = $("table", f), fth = $$("th", f);
  ft.style.width = tb.getBoundingClientRect().width + "px";
  th.forEach((x, i) => { if (fth[i]) { const w = x.getBoundingClientRect().width + "px"; fth[i].style.width = w; fth[i].style.minWidth = w; fth[i].style.maxWidth = w; } });
  ft.style.transform = `translateX(${-sc.scrollLeft}px)`;
  if (fth[0]) fth[0].style.transform = `translateX(${sc.scrollLeft}px)`; // la columna «Campaña» queda fija a la izquierda
}
window.addEventListener("scroll", () => ubicarCabFlotante(), { passive: true });
window.addEventListener("resize", () => ubicarCabFlotante());
function pintarTabla() {
  const cont = $("#tabla-scroll"); if (!cont) return;
  const d = S.datos[S.periodo];
  const { xs, ocultas } = campanasVisibles();
  $("#n-camp").textContent = d ? `${xs.length} ${S.verApagadas ? "" : "prendida" + (xs.length === 1 ? "" : "s")}`.trim() : "";
  $("#t-apagadas-tx").textContent = `ver apagadas${ocultas ? ` (${ocultas})` : ""}`;
  if (!d) { cont.innerHTML = `<div class="vacio">${S.cargando ? `<span class="cargador"></span>Cargando campañas…` : "Sin datos."}</div>`; return; }
  if (!xs.length) { cont.innerHTML = `<div class="vacio">${ocultas ? `No hay campañas prendidas en este grupo. <button class="link" type="button" id="b-ver-ap">Ver las ${ocultas} apagadas</button>` : "No hay campañas en este grupo para este período."}</div>`; const b = $("#b-ver-ap"); if (b) b.onclick = () => $("#t-apagadas").click(); return; }
  let h = `<table class="camp"><thead><tr><th class="nom" scope="col">Campaña</th>${colsVisibles().map(([k, t]) => `<th scope="col" class="c-${k}">${esc(t)}</th>`).join("")}</tr></thead><tbody>`;
  for (const c of xs) {
    const ab = S.open.has("c:" + c.id);
    h += fila({ nivel: "campana", n: 0, x: c, act: c.act, sub: subCampana(c), abrible: true, abierto: ab });
    if (!ab) continue;
    const det = S.det.get(`${S.periodo}|${c.id}`);
    if (!det || det.st === "cargando") { h += `<tr class="fila-info"><td colspan="${nCols()}"><div class="nomwrap"><span class="cargador"></span>Cargando conjuntos…</div></td></tr>`; continue; }
    if (det.st === "error") { const lim = /limit|cupo|too many|request limit/i.test(det.error || ""); h += `<tr class="fila-info"><td colspan="${nCols()}"><div class="nomwrap"><span class="neg">${lim ? "Meta está sin cupo de consultas en esta cuenta. Probá en unos minutos." : "No se pudo cargar: " + esc(det.error)}</span> <button class="link" type="button" data-reint="${esc(c.id)}">Reintentar</button></div></td></tr>`; continue; }
    if (det.data?.aviso) h += `<tr class="fila-info"><td colspan="${nCols()}"><div class="nomwrap"><span class="mut">⚠ ${esc(det.data.aviso)}${det.data.cache?.hora && !/datos de las/i.test(det.data.aviso) ? ` · datos de las ${esc(String(det.data.cache.hora))}` : ""}</span> <button class="link" type="button" data-reint="${esc(c.id)}">Reintentar</button></div></td></tr>`;
    const cjs = [...(det.data.conjuntos || [])].sort(ordenRoas);
    if (!cjs.length) h += `<tr class="fila-info"><td colspan="${nCols()}"><div class="nomwrap">Sin conjuntos con datos en este período.</div></td></tr>`;
    for (const s of cjs) {
      const abS = S.open.has("s:" + s.id);
      h += fila({ nivel: "conjunto", n: 1, x: s, act: c.act, sub: subConjunto(s), abrible: true, abierto: abS });
      if (!abS) continue;
      const ads = [...(s.anuncios || [])].sort(ordenRoas);
      if (!ads.length) h += `<tr class="fila-info"><td colspan="${nCols()}"><div class="nomwrap">Sin anuncios con datos.</div></td></tr>`;
      for (const a of ads) {
        const sub = a.post ? `<a href="https://www.facebook.com/${esc(a.post)}" target="_blank" rel="noopener" data-nosel>ver post ↗</a>` : "";
        h += fila({ nivel: "anuncio", n: 2, x: a, act: c.act, sub, abrible: false });
      }
    }
  }
  cont.innerHTML = h + `</tbody></table>`;
  armarCabFlotante();
}
function buscarItem(k) {
  const [nivel, id] = [k.slice(0, k.indexOf(":")), k.slice(k.indexOf(":") + 1)];
  const d = S.datos[S.periodo];
  if (nivel === "campana") { const c = campanaPorId(id); return c && { nivel, id, act: c.act, nombre: c.nombre, estado: c.estado, ref: c }; }
  for (const c of d?.campanas || []) {
    const det = S.det.get(`${S.periodo}|${c.id}`);
    for (const s of det?.data?.conjuntos || []) {
      if (nivel === "conjunto" && s.id === id) return { nivel, id, act: c.act, nombre: s.nombre, estado: s.estado, ref: s };
      if (nivel === "anuncio") { const a = (s.anuncios || []).find((y) => y.id === id); if (a) return { nivel, id, act: c.act, nombre: a.nombre, estado: a.estado, ref: a }; }
    }
  }
  return null;
}
function alternarSel(tr) {
  const k = tr.dataset.k;
  if (S.sel.has(k)) S.sel.delete(k);
  else { const it = buscarItem(k); if (it) S.sel.set(k, { id: it.id, act: it.act, nivel: it.nivel, nombre: it.nombre, estado: it.estado }); }
  const sel = S.sel.has(k);
  tr.classList.toggle("sel", sel); tr.setAttribute("aria-selected", sel);
  pintarBarra();
}
function clickTabla(e) {
  const reint = e.target.closest("[data-reint]");
  if (reint) { const c = campanaPorId(reint.dataset.reint); if (c) cargarDetalle(c, true); return; }
  const tg = e.target.closest("[data-tg]");
  if (tg) {
    const k = tg.dataset.tg;
    if (S.open.has(k)) S.open.delete(k);
    else { S.open.add(k); if (k.startsWith("c:")) { const c = campanaPorId(k.slice(2)); if (c) { cargarDetalle(c); } } }
    pintarTabla();
    const nuevo = $(`[data-tg="${CSS.escape(k)}"]`); if (nuevo) nuevo.focus({ preventScroll: true });
    return;
  }
  if (e.target.closest("a, [data-nosel], button")) return;
  const tr = e.target.closest("tr.fila");
  if (tr) { if (window.getSelection && String(window.getSelection()).length > 2) return; alternarSel(tr); }
}
function teclaTabla(e) {
  const tr = e.target.closest && e.target.closest("tr.fila");
  if (!tr || e.target !== tr) return;
  if (e.key === " " || e.key === "Enter") { e.preventDefault(); alternarSel(tr); }
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") { const b = $(".tg", tr); if (b && (b.getAttribute("aria-expanded") === "true") !== (e.key === "ArrowRight")) { e.preventDefault(); b.click(); } }
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const fs = $$("tr.fila", $("#tabla-scroll")); const i = fs.indexOf(tr) + (e.key === "ArrowDown" ? 1 : -1); if (fs[i]) fs[i].focus(); }
}

// ---------- barra flotante ----------
function estadoSel() {
  const its = [...S.sel.values()];
  const on = its.filter((i) => prendido(i.estado)).length;
  return on === its.length ? "true" : on === 0 ? "false" : "mixed";
}
function resumenNiveles(its) {
  const c = { campana: 0, conjunto: 0, anuncio: 0 };
  its.forEach((i) => c[i.nivel]++);
  return Object.entries(c).filter(([, n]) => n).map(([k, n]) => plural(n, k)).join(" · ");
}
function pintarBarra() {
  if (S.vista === "ranking" && $("#rk")) return pintarBarraRanking();
  const b = $("#barra");
  const its = [...S.sel.values()];
  if (!its.length || !$("#carr")) { b.hidden = true; b.innerHTML = ""; return; }
  const est = estadoSel();
  const soloAds = its.every((i) => i.nivel === "anuncio");
  const lbl = est === "true" ? "Prendido" : est === "false" ? "Apagado" : "Mixto";
  const yaVisible = !b.hidden;
  b.hidden = false;
  b.className = "barra boceto";
  if (yaVisible) b.style.animation = "none";
  b.innerHTML = `
    <div class="cuenta">${its.length} seleccionado${its.length === 1 ? "" : "s"}<small>${resumenNiveles(its)}</small></div>
    <button type="button" class="btn chico" id="b-limpiar">limpiar</button>
    <span class="sp"></span>
    <div class="acciones-sel">
    ${soloAds ? `<span class="caps">${its.length === 1 ? `<button type="button" class="btn chico" id="b-aislada">Aislada</button>` : ""}<button type="button" class="btn chico" id="b-bidcap">BidCap</button><button type="button" class="btn chico" id="b-costcap">CostCap</button></span>` : ""}
    <div class="grupo-sw"><span class="sw-lbl" id="sw-lbl">${lbl}</span>
      <button type="button" class="switch" role="switch" id="sw" aria-checked="${est}" aria-labelledby="sw-lbl" aria-describedby="sw-ayuda"><span class="perilla" aria-hidden="true"></span></button>
      <span class="sr" id="sw-ayuda">Deslizá o tocá para ${est === "true" ? "apagar" : est === "false" ? "prender" : "prender o apagar"} lo seleccionado en Meta. Pide confirmación.</span>
    </div></div>`;
  $("#b-limpiar").onclick = () => { S.sel.clear(); pintarTabla(); pintarBarra(); };
  if (soloAds) { $("#b-bidcap").onclick = () => quizCap("bidcap"); $("#b-costcap").onclick = () => quizCap("costcap"); const ba = $("#b-aislada"); if (ba) ba.onclick = () => quizCap("aislada"); }
  switchArrastrable($("#sw"), est);
}
function switchArrastrable(sw, est) {
  const per = $(".perilla", sw);
  const base = est === "true" ? 36 : est === "mixed" ? 18 : 0;
  let x0 = null, dx = 0, movio = false;
  sw.addEventListener("pointerdown", (e) => { x0 = e.clientX; dx = 0; movio = false; sw.setPointerCapture(e.pointerId); sw.classList.add("arrastrando"); });
  sw.addEventListener("pointermove", (e) => {
    if (x0 == null) return;
    dx = e.clientX - x0; if (Math.abs(dx) > 4) movio = true;
    per.style.transform = `translateX(${Math.max(0, Math.min(36, base + dx))}px)`;
  });
  const soltar = (e) => {
    if (x0 == null) return;
    x0 = null; sw.classList.remove("arrastrando");
    const fin = Math.max(0, Math.min(36, base + dx));
    per.style.transform = "";
    if (e.type === "pointercancel") return;
    let destino = null;
    if (!movio) destino = est === "true" ? "PAUSED" : est === "false" ? "ACTIVE" : null;
    else if (fin >= 26 && est !== "true") destino = "ACTIVE";
    else if (fin <= 10 && est !== "false") destino = "PAUSED";
    else return;
    pedirEstado(destino, sw, fin);
  };
  sw.addEventListener("pointerup", soltar);
  sw.addEventListener("pointercancel", soltar);
  sw.addEventListener("click", (e) => { if (e.detail === 0) pedirEstado(est === "true" ? "PAUSED" : est === "false" ? "ACTIVE" : null, sw); }); // teclado
}
function pedirEstado(destino, sw, fin) {
  const its = [...S.sel.values()];
  if (sw && fin != null && destino) $(".perilla", sw).style.transform = `translateX(${destino === "ACTIVE" ? 36 : 0}px)`;
  const lista = `<ul class="lista-nombres">${its.map((i) => `<li><span class="niv">${NIVEL[i.nivel][0]}</span><span>${dotEstado(i.estado)} ${esc(i.nombre)}</span></li>`).join("")}</ul>`;
  const modoTx = DEMO ? `<p class="mut">Demo: se simula en el navegador, no toca Meta.</p>` : dryOn() ? `<p class="mut"><b>Modo prueba:</b> se manda con dry=1, Meta no se toca.</p>` : "";
  const reset = () => { if (sw) $(".perilla", sw).style.transform = ""; };
  if (!destino) {
    const m = abrirModal(`<h3>¿Qué hago con ${its.length} seleccionado${its.length === 1 ? "" : "s"}?</h3><p class="mut">Hay prendidos y apagados mezclados.</p>${lista}${modoTx}
      <div class="botones"><button class="btn" data-x>Cancelar</button><button class="btn" data-e="PAUSED">Apagar todos</button><button class="btn pri" data-e="ACTIVE">Prender todos</button></div>`, { alCerrar: reset });
    $("[data-x]", m.dlg).onclick = m.cerrar;
    $$("[data-e]", m.dlg).forEach((b) => b.onclick = () => { m.cerrar(); pedirEstado(b.dataset.e, sw); });
    return;
  }
  const afectados = its.filter((i) => prendido(i.estado) !== (destino === "ACTIVE"));
  const verbo = destino === "ACTIVE" ? "Prender" : "Apagar";
  const objetivo = afectados.length ? afectados : its;
  const m = abrirModal(`<h3>¿${verbo} ${resumenNiveles(objetivo).replace(/ · /g, " y ")} en Meta?</h3>
    ${afectados.length < its.length ? `<p class="mut">${its.length - afectados.length} ya ${destino === "ACTIVE" ? "estaban prendidos" : "estaban apagados"}: no se tocan.</p>` : ""}
    <ul class="lista-nombres">${objetivo.map((i) => `<li><span class="niv">${NIVEL[i.nivel][0]}</span><span>${esc(i.nombre)}</span></li>`).join("")}</ul>${modoTx}
    <div class="botones"><button class="btn" data-x>Cancelar</button><button class="btn ${destino === "PAUSED" ? "peligro" : "pri"}" data-ok data-foco>${verbo}</button></div>`, { alCerrar: reset, bloqueado: () => enviando });
  let enviando = false;
  $("[data-x]", m.dlg).onclick = m.cerrar;
  $("[data-ok]", m.dlg).onclick = async (e) => {
    enviando = true;
    const b = e.currentTarget; b.classList.add("cargando"); b.innerHTML = `<span class="gira">↻</span> ${verbo === "Apagar" ? "Apagando" : "Prendiendo"}…`;
    await aplicarEstado(destino, objetivo);
    enviando = false; m.cerrar();
  };
}
async function aplicarEstado(estado, items) {
  try {
    const r = await api("estado", { body: { estado, items: items.map(({ id, act, nivel, nombre }) => ({ id, act, nivel, nombre })) }, escritura: true });
    const res = r.resultados || [];
    const ok = res.filter((x) => x.ok), mal = res.filter((x) => !x.ok);
    const simulado = r.dry || res.some((x) => x.simulado);
    const v = estado === "ACTIVE" ? "prendid" : "apagad";
    if (simulado) {
      toast(`<b>Modo prueba${DEMO ? " (demo)" : ""}:</b> Meta no se tocó. Se habrían ${estado === "ACTIVE" ? "prendido" : "apagado"} ${ok.length}${mal.length ? `; ${mal.length} con error: ${esc(mal.map((x) => x.error).join(" · "))}` : ""}.`, mal.length ? "error" : "ok", 7000);
    } else {
      for (const x of ok) actualizarEstadoLocal(x.id, x.estado || estado);
      toast(mal.length ? `${ok.length} ${v}os. Fallaron ${mal.length}: ${esc(mal.map((x) => x.error).join(" · "))}` : `✓ ${ok.length} ${v}o${ok.length === 1 ? "" : "s"} en Meta${DEMO ? " (demo)" : ""}.`, mal.length ? "error" : "ok", 7000);
    }
    S.sel.clear();
  } catch (e) {
    if (e.code === 401) { ls.del("dash_clave"); return login("Clave incorrecta"); }
    toast(`No se pudo: ${esc(e.message)}`, "error", 8000);
  }
  pintarCarrusel(); pintarTabla(); pintarBarra();
}
function actualizarEstadoLocal(id, estado) {
  for (const per of Object.keys(S.datos)) for (const c of S.datos[per].campanas || []) if (c.id === id) c.estado = estado;
  for (const v of S.det.values()) for (const s of v.data?.conjuntos || []) {
    if (s.id === id) s.estado = estado;
    for (const a of s.anuncios || []) if (a.id === id) a.estado = estado;
  }
}

// ---------- quiz BidCap / CostCap ----------
function quizCap(tipo) {
  const ads = [...S.sel.values()].filter((i) => i.nivel === "anuncio");
  const acts = [...new Set(ads.map((a) => a.act))];
  const T = tipo === "bidcap" ? "BidCap" : tipo === "aislada" ? "CBO aislada" : "CostCap";
  const AIS = tipo === "aislada";
  const nomEsc = (e) => AIS ? "1 anuncio por Post ID" : e === "cpa5" ? (tipo === "bidcap" ? "CPA promedio × 2 +5" : "CPA promedio +5") : "Doble ticket −5";
  let presupuesto = 30.55;
  if (acts.length > 1) {
    const m = abrirModal(`<h3>Son de cuentas distintas</h3><p>Para armar una ${T} los anuncios tienen que ser de la misma cuenta publicitaria. Elegiste de ${acts.length} cuentas:</p>
      <ul class="lista-nombres">${ads.map((a) => `<li><span class="niv">${esc(a.act)}</span><span>${esc(a.nombre)}</span></li>`).join("")}</ul>
      <div class="botones"><button class="btn pri" data-x>Entendido</button></div>`);
    $("[data-x]", m.dlg).onclick = m.cerrar;
    return;
  }
  const act = acts[0];
  const body = { tipo, act, ads: ads.map((a) => a.id) };
  let ocupado = false;
  const m = abrirModal("", { ancho: true, bloqueado: () => ocupado });
  const paso1 = () => {
    if (AIS) return paso2(null);
    m.set(`<h3>${T} con ${plural(ads.length, "anuncio")}</h3>
      <p class="mut">¿Cómo armo la escalera de pujas? Un conjunto por puja, US$ 50,55 cada uno. Los anuncios van por Post ID.</p>
      <div class="opciones">
        ${tipo === "bidcap"
          ? `<button type="button" class="opcion" data-esc="cpa5" data-foco><b>CPA promedio × 2 +5</b><span>CPA × 2, subiendo de a US$ 1 hasta CPA × 2 + 5 (CPA 10 → 20…25).</span></button>`
          : `<button type="button" class="opcion" data-esc="cpa5" data-foco><b>CPA promedio +5</b><span>Desde el CPA promedio real de estos anuncios (sin decimales) subiendo de a US$ 1 hasta CPA + 5.</span></button>`}
        <button type="button" class="opcion" data-esc="doble"><b>Doble ticket −5</b><span>Desde 2× el ticket bajando de a US$ 1, 6 escalones (ticket 10 → 20, 19, 18, 17, 16, 15).</span></button>
      </div>
      <div class="botones"><button type="button" class="btn" data-x>Cancelar</button></div>`);
    $("[data-x]", m.dlg).onclick = m.cerrar;
    $$("[data-esc]", m.dlg).forEach((b) => b.onclick = () => paso2(b.dataset.esc));
  };
  const paso2 = async (escalera) => {
    ocupado = true;
    m.set(`<h3>${T} · ${nomEsc(escalera)}</h3><p class="mut"><span class="cargador"></span>Calculando el plan con los datos reales…</p>`);
    let plan;
    try { plan = await api("cap_plan", { body: AIS ? { ...body, presupuesto } : { ...body, escalera } }); }
    catch (e) {
      ocupado = false;
      if (e.code === 401) { m.cerrar(); ls.del("dash_clave"); return login("Clave incorrecta"); }
      m.set(`<h3>No se pudo calcular</h3><div class="err-box">${esc(e.message)}</div><div class="botones"><button class="btn" data-v>Volver</button><button class="btn pri" data-x>Cerrar</button></div>`);
      $("[data-v]", m.dlg).onclick = AIS ? m.cerrar : paso1; $("[data-x]", m.dlg).onclick = m.cerrar; return;
    }
    ocupado = false;
    mostrarPlan(escalera, plan);
  };
  const mostrarPlan = (escalera, p) => {
    const real = !DEMO && !dryOn();
    const c = p.calculo || {};
    const ini = p.inicio || {};
    const o = p.origen || {};
    const posts = o.posts || [];
    const formula = c.texto || (AIS ? "" : escalera === "cpa5"
      ? `CPA = ${NF2.format(c.gasto ?? 0)} ÷ ${c.compras ?? "?"} = ${NF2.format(c.cpa_promedio ?? 0)}${tipo === "bidcap" ? " × 2" : ""} → ${c.cpa_base ?? (p.bids || [])[0] ?? "?"}`
      : `Ticket ${NF2.format(c.ticket ?? 0)} × 2 → ${(p.bids || [])[0] ?? "?"}`);
    const nConj = p.conjuntos ?? 3;
    const bloqueCalc = AIS ? `<div class="calculo">
        <div class="formula">CBO con ${ent(nConj)} conjuntos, el mismo anuncio por Post ID en cada uno</div>
        ${formula ? `<div class="mut num">${esc(formula)}</div>` : ""}
        ${c.gasto != null ? `<div class="mut num">Gasto ${usd(c.gasto)} · ${ent(c.compras)} compras · CPA prom. ${usd(c.cpa_promedio)}${c.ventana ? ` · ${esc(c.ventana)}` : ""}</div>` : ""}
        <div class="pres-ais"><label for="pres-ais">Presupuesto de la campaña (US$/día)</label>
          <input class="campo num" id="pres-ais" inputmode="decimal" value="${NF2.format(p.presupuesto_campana ?? p.presupuesto ?? presupuesto)}"></div>
        <div class="mut" id="pres-err" role="alert"></div>
      </div>` : null;
    m.set(`<h3>${T} · ${nomEsc(escalera)}</h3>
      ${bloqueCalc ?? `<div class="calculo">
        <div class="formula num">${esc(formula)}</div>
        <div class="mut num">Gasto ${usd(c.gasto)} · ${ent(c.compras)} compras · CPA prom. ${usd(c.cpa_promedio)}${c.ticket ? ` · ticket ${usd(c.ticket)}` : ""}${c.ventana ? ` · ${esc(c.ventana)}` : ""}</div>
        ${c.ticket_fuente ? `<div class="mut">Ticket: ${esc(c.ticket_fuente)}</div>` : ""}
        <div class="chips" aria-label="Pujas">${(p.bids || []).map((b) => `<span class="chip num">US$ ${esc(b)}</span>`).join("")}</div>
        <div class="num"><b>${ent(p.conjuntos)} conjuntos × ${usd(p.presupuesto_conjunto)} = ${usd(p.presupuesto_total)} por día</b></div>
      </div>`}
      <dl class="datos">
        <dt>Campaña</dt><dd><b>${esc(p.nombre_campana)}</b>${(p.nombres_conjuntos || []).length ? `<div class="mut">${esc(p.nombres_conjuntos.join(" · "))}</div>` : ""}</dd>
        <dt>Inicio</dt><dd>${esc(ini.ar || ini.iso || "—")}${(ini.locales || []).length ? `<div class="mut">${ini.locales.map((l) => `${esc(l.pais)} ${esc(l.hora)}`).join(" · ")}</div>` : ""}${ini.regla ? `<div class="mut">${esc(ini.regla)}</div>` : ""}</dd>
        <dt>Países</dt><dd>${esc((o.paises || []).join(", ") || "—")}</dd>
        <dt>Página</dt><dd>${esc(o.pagina || "—")}</dd>
        ${o.pixel ? `<dt>Pixel</dt><dd class="num">${esc(o.pixel)}</dd>` : ""}
        ${o.campana ? `<dt>Origen</dt><dd>${esc(o.campana)}</dd>` : ""}
        <dt>Posts</dt><dd>${posts.length ? posts.map((x) => `<div>${esc(x.nombre || x.ad_id)} <span class="mut num">${esc(x.post || "sin post")}</span></div>`).join("") : "—"}</dd>
      </dl>
      ${(p.avisos || []).length ? `<ul class="avisos">${p.avisos.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : ""}
      ${DEMO ? `<p class="mut">Demo: «Crear» se simula, no toca Meta.</p>` : dryOn() ? `<p class="mut"><b>Modo prueba:</b> «Crear» manda dry=1 y solo muestra los pasos.</p>` : ""}
      ${real ? `<div class="confirmar-escrito"><label for="conf-crear">Esto crea y activa una campaña real. Escribí <b>crear</b> para confirmar:</label><input class="campo" id="conf-crear" autocomplete="off" autocapitalize="off" spellcheck="false" data-foco></div>` : ""}
      <div class="botones"><button type="button" class="btn" data-v>${AIS ? "Cancelar" : "Volver"}</button><button type="button" class="btn pri" data-crear ${real ? "disabled" : ""}>Crear campaña</button></div>`);
    $("[data-v]", m.dlg).onclick = AIS ? m.cerrar : paso1;
    const bc = $("[data-crear]", m.dlg);
    if (real) $("#conf-crear").oninput = (e) => { bc.disabled = e.target.value.trim().toLowerCase() !== "crear"; };
    bc.onclick = () => {
      if (AIS) {
        const v = Number(String($("#pres-ais").value).trim().replace(/\./g, "").replace(",", "."));
        if (!(v >= 1)) { $("#pres-err").textContent = "Poné un presupuesto válido (ej. 30,55)."; $("#pres-ais").focus(); return; }
        presupuesto = Math.round(v * 100) / 100;
      }
      crear(escalera);
    };
  };
  const crear = async (escalera) => {
    ocupado = true;
    const bc = $("[data-crear]", m.dlg); bc.classList.add("cargando"); bc.innerHTML = `<span class="gira">↻</span> Creando…`;
    $("[data-v]", m.dlg).disabled = true;
    let r;
    try { r = await api("cap_crear", { body: AIS ? { ...body, presupuesto, confirmar: true } : { ...body, escalera, confirmar: true }, escritura: true }); }
    catch (e) {
      ocupado = false;
      if (e.code === 401) { m.cerrar(); ls.del("dash_clave"); return login("Clave incorrecta"); }
      toast(`No se pudo crear: ${esc(e.message)}`, "error", 9000);
      m.set(`<h3>No se pudo crear</h3><div class="err-box">${esc(e.message)}</div>${e.data?.log ? `<details class="log" open><summary>Log</summary><pre>${esc(e.data.log.join("\n"))}</pre></details>` : ""}<div class="botones"><button class="btn pri" data-x>Cerrar</button></div>`);
      $("[data-x]", m.dlg).onclick = m.cerrar; return;
    }
    ocupado = false;
    const pasos = r.pasos || [];
    const log = r.log || [];
    if (r.dry) {
      m.set(`<h3>Modo prueba: no se creó nada</h3><div class="ok-box">El backend validó el plan. Esto es lo que haría:</div>
        ${pasos.length ? `<ol class="lista-nombres" style="list-style:decimal;padding-left:22px">${pasos.map((x) => `<li>${esc(typeof x === "string" ? x : JSON.stringify(x))}</li>`).join("")}</ol>` : ""}
        ${log.length ? `<details class="log"><summary>Log</summary><pre>${esc(log.join("\n"))}</pre></details>` : ""}
        <div class="botones"><button class="btn pri" data-x data-foco>Listo</button></div>`);
      toast(`<b>Modo prueba:</b> ${T} validada, no se creó nada.`);
    } else {
      m.set(`<h3>${r.ok ? "Campaña creada" : "Terminó con problemas"}</h3>
        <div class="${r.ok ? "ok-box" : "err-box"}">${r.ok ? "✓" : "⚠"} ${esc(r.campaign_id ? `Campaña ${r.campaign_id}` : "")} · ${plural((r.adsets || []).length, "conjunto")} · ${plural((r.ads || []).length, "anuncio")}${DEMO ? " (demo)" : ""}</div>
        ${r.falta_ciclo_de_vida ? `<ul class="avisos"><li>Falta «todos los públicos» (ciclo de vida): lo aplica el proceso local.</li></ul>` : ""}
        ${r.link_ads_manager ? `<p><a class="link" href="${esc(r.link_ads_manager)}" target="_blank" rel="noopener">Abrir en el Administrador de anuncios ↗</a></p>` : ""}
        ${log.length ? `<details class="log"><summary>Log (${log.length})</summary><pre>${esc(log.map((x) => typeof x === "string" ? x : JSON.stringify(x)).join("\n"))}</pre></details>` : ""}
        <div class="botones"><button class="btn pri" data-x data-foco>Listo</button></div>`);
      toast(r.ok ? `✓ ${T} creada${DEMO ? " (demo)" : ""}: ${plural((r.adsets || []).length, "conjunto")}.${r.falta_ciclo_de_vida ? " Falta ciclo de vida." : ""}` : `La ${T} terminó con problemas: mirá el log.`, r.ok ? "ok" : "error", 8000);
      if (r.ok) { S.sel.clear(); pintarTabla(); pintarBarra(); }
    }
    $("[data-x]", m.dlg).onclick = m.cerrar;
  };
  paso1();
}

// ---------- reglas (ver y editar las automáticas) ----------
const RG = { datos: null, cargando: false, error: null, draft: new Map(), msg: new Map(), campoMal: new Map() };
const GRUPOS_REGLAS = [["cortes_testeos", "Cortes de testeos"], ["cortes_caps", "Cortes de CostCap/BidCap"], ["revivir", "Revivir"], ["surfeo", "Surfeo"], ["madres", "Madres"], ["escalado", "Escalado"], ["mis_reglas", "Mis reglas"]];
const METRICAS_R = {
  gasto: ["Gasto", "USD"], ventas: ["Ventas", ""], ventas_reales: ["Ventas reales", ""], ventas_pixel: ["Ventas pixel", ""],
  roas: ["ROAS", ""], roas_real: ["ROAS real", ""], roas_pixel: ["ROAS pixel", ""], cpa: ["CPA", "USD"],
  pagos_iniciados: ["Pagos iniciados", ""], costo_pago_iniciado: ["Costo x pago iniciado", "USD"],
  dias_desde_inicio: ["Días desde el inicio", "días"], presupuesto: ["Presupuesto", "USD"],
  tipo_campana: ["Tipo de campaña", ""], nombre: ["Nombre", ""], hora: ["Hora (AR)", "h"],
};
const METS_NUEVA = ["gasto", "ventas_reales", "ventas_pixel", "roas_real", "roas_pixel", "cpa", "pagos_iniciados", "costo_pago_iniciado", "dias_desde_inicio", "presupuesto", "tipo_campana", "nombre", "hora"];
const OPS_NUM = [">", ">=", "<", "<=", "=", "!="];
const OPS_R = { ">": ">", ">=": "≥", "<": "<", "<=": "≤", "=": "=", "!=": "≠", es: "es", contiene: "contiene", no_contiene: "no contiene" };
const ENTEROS_R = new Set(["ventas", "ventas_reales", "ventas_pixel", "pagos_iniciados", "dias_desde_inicio", "hora"]);
const MODOS_R = [["auto", "Auto"], ["avisar", "Solo avisar"], ["simular", "Simular"]];
const MODO_TX = { auto: "Auto (actúa sola)", avisar: "Solo avisar", simular: "Simular" };
const ACC_R = { apagar: "Apagar", prender: "Prender", subir_presupuesto: "Subir presupuesto", bajar_presupuesto: "Bajar presupuesto", fijar_presupuesto: "Fijar presupuesto", avisar: "Avisar", crear: "Crear", otro: "Otro" };
const NIV_R = { anuncio: "anuncio", conjunto: "conjunto", campana: "campaña" };
const CAMP_R = { testeos: "testeos", costcap_bidcap: "CostCap/BidCap", madres: "madres", cbo_surfeo: "CBO de surfeo", todas: "todas" };
const VENT_R = { hoy: "hoy", "3d": "últimos 3 días", "4d": "últimos 4 días", "7d": "últimos 7 días" };
const CANAL_R = { discord: "Discord", push: "el celular", ambos: "Discord y el celular" };
const NFR = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const clon = (x) => x == null ? x : JSON.parse(JSON.stringify(x));
const delNivel = (n) => n === "campana" ? "de la campaña" : `del ${NIV_R[n] || n}`;
const siNo = (b) => b == null ? "—" : b ? "activa" : "inactiva";
const fechaAR = (iso) => { try { return new Date(iso).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return "—"; } };

function metR(k) {
  const x = (RG.datos?.metricas || []).find((m) => (m && m.id) === k);
  if (x) return [x.nombre || x.etiqueta || METRICAS_R[k]?.[0] || k, x.unidad ?? METRICAS_R[k]?.[1] ?? ""];
  return METRICAS_R[k] || [String(k || "").replace(/_/g, " "), ""];
}
function valTx(def) {
  if (!def || def.valor == null || def.valor === "") return "—";
  const v = def.valor;
  if (Array.isArray(v)) return v.join(", ");
  if (def.tipo === "pct") return `${NFR.format(v)} %`;
  if (def.tipo === "hora") return typeof v === "string" ? v : `${v} h`;
  if (typeof v === "number") return `${NFR.format(v)}${def.unidad ? " " + def.unidad : ""}`;
  return String(v);
}
function fijoTx(v, metrica) {
  if (v == null) return "—";
  if (Array.isArray(v)) return v.join(" / ");
  if (typeof v === "number") { const u = metR(metrica)[1]; return `${NFR.format(v)}${u ? " " + u : ""}`; }
  return metrica === "nombre" ? `«${v}»` : String(v);
}
const esTexto = (c) => c.metrica === "texto" || (!c.metrica && c.texto != null);
function condTexto(r, c) {
  if (esTexto(c)) return c.texto || "";
  const op = OPS_R[c.op] || c.op || "";
  const v = c.var ? valTx((r.variables || {})[c.var]) : fijoTx(c.valor, c.metrica);
  return `${metR(c.metrica)[0]} ${op} ${v}`;
}
function accionBase(a) {
  if (!a) return "?";
  if (a.texto) return a.texto;
  const t = ACC_R[a.tipo] || a.tipo || "?";
  if (a.tipo === "apagar" || a.tipo === "prender") return `${t} ${NIV_R[a.nivel] || a.nivel || ""}`.trim();
  if (/presupuesto/.test(a.tipo || "")) return `${t}${a.nivel ? " " + delNivel(a.nivel) : ""}`;
  if (a.tipo === "avisar") return `Avisar${a.canal ? " por " + (CANAL_R[a.canal] || a.canal) : ""}`;
  return t;
}
const accionTexto = (r) => { const a = r.accion || {}; return accionBase(a) + (a.var ? " " + valTx((r.variables || {})[a.var]) : ""); };
const fraseTexto = (r) => `Si ${(r.condiciones || []).map((c) => condTexto(r, c)).join(" y ") || "…"} → ${accionTexto(r)}`;
function alcanceTx(r) {
  const a = r?.alcance || {};
  if (a.texto && r.origen !== "lorenzo") return a.texto;
  const p = [];
  if (a.nivel) p.push(`por ${NIV_R[a.nivel] || a.nivel}`);
  if (a.campanas) p.push(`campañas: ${CAMP_R[a.campanas] || a.campanas}`);
  if (a.tipo_campana?.length) p.push(a.tipo_campana.join("/"));
  if (a.nombre_contiene) p.push(`nombre contiene «${a.nombre_contiene}»`);
  if (a.ventana) p.push(`ventana: ${VENT_R[a.ventana] || a.ventana}`);
  return p.join(" · ") || a.texto || "—";
}
function diffRegla(a, b) {
  a = a || {}; b = b || {};
  const out = [];
  const va = a.variables || {}, vb = b.variables || {};
  for (const k of new Set([...Object.keys(va), ...Object.keys(vb)])) {
    if (JSON.stringify(va[k]?.valor) === JSON.stringify(vb[k]?.valor)) continue;
    const def = vb[k] || va[k];
    out.push([def.etiqueta || k, valTx(va[k]), valTx(vb[k])]);
  }
  if (("activa" in a || "activa" in b) && a.activa !== b.activa) out.push(["Estado", siNo(a.activa), siNo(b.activa)]);
  if ((a.modo || b.modo) && a.modo !== b.modo) out.push(["Modo", MODO_TX[a.modo] || a.modo || "—", MODO_TX[b.modo] || b.modo || "—"]);
  for (const [k, t] of [["nombre", "Nombre"], ["descripcion", "Descripción"]]) if ((k in a || k in b) && (a[k] || "") !== (b[k] || "")) out.push([t, a[k] || "—", b[k] || "—"]);
  if ((a.condiciones || b.condiciones) && (JSON.stringify(a.condiciones || null) !== JSON.stringify(b.condiciones || null) || JSON.stringify(a.accion || null) !== JSON.stringify(b.accion || null))) {
    const fa = a.condiciones ? fraseTexto(a) : "—", fb = b.condiciones ? fraseTexto(b) : "—";
    if (fa !== fb) out.push(["Regla", fa, fb]);
  }
  if ((a.alcance || b.alcance) && JSON.stringify(a.alcance || null) !== JSON.stringify(b.alcance || null)) out.push(["Alcance", a.alcance ? alcanceTx(a) : "—", b.alcance ? alcanceTx(b) : "—"]);
  return out;
}
const tablaDiff = (filas) => `<table class="r-diff"><thead><tr><th scope="col">Qué</th><th scope="col">Antes</th><th scope="col">Después</th></tr></thead><tbody>${filas.map(([q, x, y]) => `<tr><th scope="row">${esc(q)}</th><td class="antes">${esc(x)}</td><td class="desp">→ ${esc(y)}</td></tr>`).join("")}</tbody></table>`;

const reglaOrig = (id) => (RG.datos?.reglas || []).find((r) => r.id === id);
const reglaVista = (id) => RG.draft.get(id) || reglaOrig(id);
function getDraft(id) { if (!RG.draft.has(id)) RG.draft.set(id, clon(reglaOrig(id))); return RG.draft.get(id); }
function limpiarDraft(id) { const d = RG.draft.get(id), o = reglaOrig(id); if (d && o && !diffRegla(o, d).length) RG.draft.delete(id); }
const esSucia = (o) => RG.draft.has(o.id) && diffRegla(o, RG.draft.get(o.id)).length > 0;
const cardEl = (id) => $(`.regla[data-id="${CSS.escape(id)}"]`);

function vchip(r, o, k, maloK) {
  const def = (r.variables || {})[k];
  if (!def) return `<span class="vchip roto" title="La variable ${esc(k)} no está definida">${esc(k)}?</span>`;
  const cambio = o && JSON.stringify(o.variables?.[k]?.valor) !== JSON.stringify(def.valor);
  const rango = def.min != null || def.max != null ? ` (entre ${def.min ?? "—"} y ${def.max ?? "—"})` : "";
  return `<button type="button" class="vchip num${cambio ? " cambio" : ""}${maloK === k ? " mal" : ""}" data-var="${esc(k)}" aria-label="${esc(def.etiqueta || k)}: ${esc(valTx(def))}${esc(rango)}. Tocá para cambiarlo" title="${esc((def.etiqueta || k) + rango)}">${esc(valTx(def))}</button>`;
}
function tarjetaRegla(o) {
  const r = reglaVista(o.id) || o;
  const sis = o.origen !== "lorenzo";
  const usadas = new Set();
  const mal = RG.campoMal.get(o.id);
  const conds = (r.condiciones || []).map((c) => {
    if (esTexto(c)) return `<span class="cond-tx">${esc(c.texto || "")}</span>`;
    const lbl = `${esc(metR(c.metrica)[0])} ${esc(OPS_R[c.op] || c.op || "")}`;
    if (c.var) { usadas.add(c.var); return `<span class="cond">${lbl} ${vchip(r, o, c.var, mal)}</span>`; }
    return `<span class="cond fija" title="Valor fijo${sis ? " (es parte de la lógica)" : ""}">${lbl} <b class="num">${esc(fijoTx(c.valor, c.metrica))}</b></span>`;
  }).join(`<span class="y">y</span>`);
  const a = r.accion || {};
  if (a.var) usadas.add(a.var);
  const acc = `<span class="acc">${esc(accionBase(a))}${a.var ? " " + vchip(r, o, a.var, mal) : ""}</span>`;
  const libres = Object.keys(r.variables || {}).filter((k) => !usadas.has(k));
  const sucia = esSucia(o);
  const msg = RG.msg.get(o.id) || ""; RG.msg.delete(o.id);
  const meta = [alcanceTx(r), r.horario].filter(Boolean).map(esc).join(" · ");
  return `<article class="regla boceto${r.activa === false ? " inactiva" : ""}${sucia ? " sucia" : ""}" data-id="${esc(o.id)}" aria-labelledby="rt-${esc(o.id)}">
    <div class="r-cab">
      <div class="r-tit"><h4 id="rt-${esc(o.id)}">${esc(r.nombre || o.id)}</h4><span class="r-id">${esc(o.id)}</span>${sis ? "" : `<span class="r-tag">mía</span>`}</div>
      <button type="button" class="toggle-chico r-activa" role="switch" aria-checked="${r.activa !== false}" data-act aria-label="Regla ${esc(r.nombre || o.id)} ${r.activa !== false ? "activa" : "inactiva"}"><span class="mini" aria-hidden="true"></span><span aria-hidden="true">${r.activa !== false ? "activa" : "inactiva"}</span></button>
    </div>
    ${r.descripcion ? `<p class="r-desc">${esc(r.descripcion)}</p>` : ""}
    <p class="r-frase"><span class="si">Si</span>${conds || `<span class="cond-tx">(sin condiciones)</span>`}<span class="flecha-r" aria-label="entonces">→</span>${acc}</p>
    ${libres.length ? `<div class="r-vars"><span class="r-lbl">Variables</span>${libres.map((k) => `<span class="vpar">${esc(r.variables[k].etiqueta || k)} ${vchip(r, o, k, mal)}</span>`).join("")}</div>` : ""}
    ${meta ? `<div class="r-meta">${meta}</div>` : ""}
    ${o.notas ? `<details class="r-notas"><summary>Notas</summary><p>${esc(o.notas)}</p></details>` : ""}
    <div class="r-pie">
      <div class="modos" role="group" aria-label="Modo">${MODOS_R.map(([k, t]) => `<button type="button" class="modo m-${k}" data-modo="${k}" aria-pressed="${r.modo === k}">${t}</button>`).join("")}</div>
      <span class="sp"></span>
      <button type="button" class="btn chico" data-probar>Probar con datos de hoy</button>
      <button type="button" class="btn chico" data-hist>Historial</button>
      ${sis ? "" : `<button type="button" class="btn chico" data-editar>Editar</button><button type="button" class="btn chico" data-borrar aria-label="Borrar regla ${esc(r.nombre || o.id)}">Borrar</button>`}
    </div>
    ${sucia ? `<div class="r-guardar"><span>Cambios sin guardar</span><button type="button" class="btn chico" data-desc>Descartar</button><button type="button" class="btn chico pri" data-guardar>Guardar cambios</button></div>` : ""}
    <div class="r-msg" role="alert">${esc(msg)}</div>
  </article>`;
}
function repintarRegla(id, foco) {
  const el = cardEl(id), o = reglaOrig(id);
  if (!el || !o) return;
  el.outerHTML = tarjetaRegla(o);
  if (foco) { const f = $(foco, cardEl(id)); if (f) f.focus({ preventScroll: true }); }
}
function setMsgRegla(id, t) { const m = $(".r-msg", cardEl(id)); if (m) m.textContent = t; }

function gruposReglas() {
  const g = RG.datos?.grupos;
  const base = Array.isArray(g) && g.length ? g.map((x) => [x.id, x.nombre || x.id]) : GRUPOS_REGLAS.slice();
  for (const r of RG.datos?.reglas || []) if (!base.some(([k]) => k === r.grupo)) base.push([r.grupo, r.grupo]);
  if (!base.some(([k]) => k === "mis_reglas")) base.push(["mis_reglas", "Mis reglas"]);
  return base;
}
function pintarReglas() {
  const L = $("#r-lista"); if (!L) return;
  const I = $("#r-indice");
  if (!RG.datos) {
    I.innerHTML = "";
    L.innerHTML = RG.error ? `<div class="hint error boceto">No se pudieron traer las reglas: ${esc(RG.error)} <button type="button" class="link" data-recargar>Reintentar</button></div>`
      : `<div class="vacio"><span class="cargador"></span>Cargando reglas…</div>`;
    return;
  }
  const reglas = (RG.datos.reglas || []).slice().sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
  const gs = gruposReglas();
  I.innerHTML = gs.map(([k, n]) => { const c = reglas.filter((r) => r.grupo === k).length; return `<button type="button" class="btn chico" data-ir-g="${esc(k)}">${esc(n)} <span class="cuenta-g num">${c}</span></button>`; }).join("");
  L.innerHTML = gs.map(([k, n]) => {
    const xs = reglas.filter((r) => r.grupo === k);
    const vacio = k === "mis_reglas" ? `<div class="vacio chico">Todavía no armaste ninguna. <button type="button" class="link" data-nueva>+ Nueva regla</button></div>` : `<div class="vacio chico">Sin reglas en este grupo.</div>`;
    return `<section class="r-grupo" id="g-${esc(k)}" aria-labelledby="gh-${esc(k)}"><h3 id="gh-${esc(k)}">${esc(n)} <small>${xs.length} regla${xs.length === 1 ? "" : "s"}${xs.length ? ` · ${xs.filter((r) => r.activa !== false).length} activa${xs.filter((r) => r.activa !== false).length === 1 ? "" : "s"}` : ""}</small></h3>
      ${xs.length ? `<div class="r-lista-g">${xs.map(tarjetaRegla).join("")}</div>` : vacio}</section>`;
  }).join("");
}
async function cargarReglas() {
  RG.cargando = true; RG.error = null;
  if (!RG.datos) pintarReglas();
  try { RG.datos = await api("reglas_list"); }
  catch (e) {
    if (e.code === 401) { ls.del("dash_clave"); S.vista = "dash"; return login("Clave incorrecta"); }
    RG.error = e.message;
    if (RG.datos) toast(`No se pudieron actualizar las reglas: ${esc(e.message)}`, "error");
  }
  RG.cargando = false;
  if (S.vista === "reglas") pintarReglas();
}
function verReglas() {
  cerrarMenu(); pararRanking();
  S.vista = "reglas"; pintarNav();
  try { history.replaceState(null, "", location.pathname + location.search + "#reglas"); } catch {}
  $("#main").innerHTML = `
    <section class="reglas-vista" aria-labelledby="t-reglas">
      <div class="r-top">
        <button type="button" class="btn chico" id="r-volver">← Volver</button>
        <h2 id="t-reglas">Reglas</h2>
        <span class="sp"></span>
        <button type="button" class="btn pri" id="r-nueva">+ Nueva regla</button>
      </div>
      <p class="r-intro">Las automáticas que cuidan las campañas. En las del sistema cambiás los números (tocá el valor resaltado), las prendés o apagás y elegís si actúan solas, solo avisan o simulan. Las tuyas se editan enteras.</p>
      <nav class="r-indice" id="r-indice" aria-label="Grupos de reglas"></nav>
      <div id="r-lista"></div>
    </section>`;
  pintarBarra();
  $("#r-volver").onclick = volverDeReglas;
  $("#r-nueva").onclick = () => armador(null);
  $(".reglas-vista").addEventListener("click", clickReglas);
  window.scrollTo(0, 0);
  pintarReglas();
  cargarReglas();
  $("#r-volver").focus({ preventScroll: true });
}
function volverDeReglas() {
  const sucias = (RG.datos?.reglas || []).filter(esSucia);
  const salir = () => { RG.draft.clear(); RG.campoMal.clear(); S.vista = "dash"; try { history.replaceState(null, "", location.pathname + location.search); } catch {} montar(); window.scrollTo(0, 0); };
  if (!sucias.length) return salir();
  const m = abrirModal(`<h3>Tenés cambios sin guardar</h3><p>En ${sucias.length === 1 ? "la regla" : `${sucias.length} reglas`}: ${sucias.map((r) => `<b>${esc(r.nombre || r.id)}</b>`).join(", ")}. Si salís, se pierden.</p>
    <div class="botones"><button type="button" class="btn" data-x data-foco>Quedarme</button><button type="button" class="btn peligro" data-ok>Salir sin guardar</button></div>`);
  $("[data-x]", m.dlg).onclick = m.cerrar;
  $("[data-ok]", m.dlg).onclick = () => { m.cerrar(); salir(); };
}
document.addEventListener("keydown", (e) => {
  if (S.vista !== "reglas" || modalActual || e.key !== "Escape") return;
  if (!$("#menu").hidden) { cerrarMenu(); $("#b-menu").focus(); return; }
  if (e.target.closest && e.target.closest(".vedit")) return;
  volverDeReglas();
});

function clickReglas(e) {
  const t = e.target;
  if (t.closest("[data-recargar]")) return cargarReglas();
  if (t.closest("[data-nueva]")) return armador(null);
  const ir = t.closest("[data-ir-g]");
  if (ir) { const s = $(`#g-${CSS.escape(ir.dataset.irG)}`); if (s) { s.scrollIntoView({ behavior: reducido() ? "auto" : "smooth", block: "start" }); const h = $("h3", s); h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); } return; }
  const card = t.closest(".regla"); if (!card) return;
  const id = card.dataset.id, o = reglaOrig(id); if (!o) return;
  const v = t.closest("[data-var]");
  if (v) return editarVar(id, v);
  if (t.closest("[data-act]")) { const d = getDraft(id); d.activa = d.activa === false; limpiarDraft(id); return repintarRegla(id, "[data-act]"); }
  const mo = t.closest("[data-modo]");
  if (mo) { const d = getDraft(id); d.modo = mo.dataset.modo; limpiarDraft(id); return repintarRegla(id, `[data-modo="${mo.dataset.modo}"]`); }
  if (t.closest("[data-desc]")) { RG.draft.delete(id); RG.campoMal.delete(id); return repintarRegla(id, "[data-probar]"); }
  if (t.closest("[data-guardar]")) return confirmarGuardar(id);
  if (t.closest("[data-probar]")) return probarModal(reglaVista(id));
  if (t.closest("[data-hist]")) return historialRegla(o);
  if (t.closest("[data-editar]")) return armador(reglaVista(id));
  if (t.closest("[data-borrar]")) return borrarRegla(o);
}

function validarVar(def, raw) {
  const s = String(raw ?? "").trim();
  const t = def.tipo || (typeof def.valor === "number" ? "numero" : "texto");
  if (t === "texto") return s ? { ok: true, valor: s } : { ok: false, msg: "no puede quedar vacío" };
  if (t === "lista") { const xs = s.split(",").map((x) => x.trim()).filter(Boolean); return xs.length ? { ok: true, valor: xs } : { ok: false, msg: "poné al menos un valor" }; }
  if (t === "hora" && typeof def.valor === "string") {
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (!m || +m[1] > 23 || +m[2] > 59) return { ok: false, msg: "poné una hora tipo 23:20" };
    return { ok: true, valor: `${m[1].padStart(2, "0")}:${m[2]}` };
  }
  if (!s) return { ok: false, msg: "no puede quedar vacío" };
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  if (!isFinite(n)) return { ok: false, msg: "tiene que ser un número" };
  if ((t === "entero" || t === "hora") && !Number.isInteger(n)) return { ok: false, msg: "tiene que ser un número entero" };
  const min = def.min ?? (t === "hora" ? 0 : null), max = def.max ?? (t === "hora" ? 23 : null);
  if (min != null && n < min) return { ok: false, msg: `el mínimo es ${NFR.format(min)}` };
  if (max != null && n > max) return { ok: false, msg: `el máximo es ${NFR.format(max)}` };
  return { ok: true, valor: n };
}
function editarVar(id, btn) {
  const k = btn.dataset.var;
  const r = reglaVista(id), def = (r.variables || {})[k];
  if (!def) return;
  const esHora = def.tipo === "hora" && typeof def.valor === "string";
  const numerico = ["numero", "entero", "pct"].includes(def.tipo) || (def.tipo === "hora" && !esHora) || (!def.tipo && typeof def.valor === "number");
  const raw = def.valor == null ? "" : Array.isArray(def.valor) ? def.valor.join(", ") : typeof def.valor === "number" ? String(def.valor).replace(".", ",") : String(def.valor);
  const uni = def.tipo === "pct" ? "%" : def.tipo === "hora" && !esHora ? "h" : def.unidad || "";
  const rango = def.min != null || def.max != null ? `entre ${def.min ?? "—"} y ${def.max ?? "—"}` : "";
  const span = document.createElement("span");
  span.className = "vedit";
  span.innerHTML = `<input class="vin num" type="${esHora ? "time" : "text"}" ${numerico ? `inputmode="${def.tipo === "entero" || def.tipo === "hora" ? "numeric" : "decimal"}"` : ""} value="${esc(raw)}" size="${Math.max(3, Math.min(18, raw.length + 1))}" aria-label="${esc(def.etiqueta || k)}${rango ? ", " + rango : ""}. Enter guarda, Escape cancela" title="${esc(rango)}" autocomplete="off" spellcheck="false">${uni ? `<span class="uni">${esc(uni)}</span>` : ""}`;
  btn.replaceWith(span);
  const inp = $("input", span);
  inp.focus(); try { inp.select(); } catch {}
  let hecho = false;
  const fin = (commit, desdeEnter) => {
    if (hecho) return;
    if (!commit) { hecho = true; return repintarRegla(id, `[data-var="${CSS.escape(k)}"]`); }
    const v = validarVar(def, inp.value);
    if (!v.ok) {
      if (desdeEnter) { inp.setAttribute("aria-invalid", "true"); setMsgRegla(id, `${def.etiqueta || k}: ${v.msg}.`); return; }
      hecho = true; RG.msg.set(id, `${def.etiqueta || k}: ${v.msg}. Quedó el valor anterior.`); return repintarRegla(id);
    }
    hecho = true;
    const d = getDraft(id);
    d.variables[k] = { ...d.variables[k], valor: v.valor };
    if (RG.campoMal.get(id) === k) RG.campoMal.delete(id);
    limpiarDraft(id);
    repintarRegla(id, `[data-var="${CSS.escape(k)}"]`);
  };
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); fin(true, true); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fin(false); }
  });
  inp.addEventListener("blur", () => setTimeout(() => fin(true, false), 0));
}

function payloadRegla(o, d) {
  if (o && o.origen !== "lorenzo") return { id: o.id, variables: d.variables, activa: d.activa, modo: d.modo };
  const { actualizado, actualizado_por, ...resto } = d;
  return resto;
}
function campoDeError(e) { const c = e?.data?.campo; return c ? String(c).split(".").pop() : null; }
function confirmarGuardar(id) {
  const o = reglaOrig(id), d = RG.draft.get(id);
  if (!o || !d) return;
  const filas = diffRegla(o, d);
  const aAuto = d.modo === "auto" && o.modo !== "auto";
  let enviando = false;
  const m = abrirModal(`<h3>¿Guardar cambios?</h3><p class="mut">${esc(o.nombre || id)} · <span class="r-id">${esc(id)}</span></p>
    ${tablaDiff(filas)}
    ${aAuto ? `<div class="alerta-auto" role="alert"><b>Esta regla va a tocar Meta sola.</b>Desde que guardes, ${esc(accionTexto(d).toLowerCase())} sin preguntarte cada vez que se cumpla. Si no la probaste, tocá «Probar con datos de hoy» antes.</div>` : ""}
    <div class="err-box" id="r-g-err" role="alert" hidden></div>
    <div class="botones"><button type="button" class="btn" data-x>Cancelar</button><button type="button" class="btn ${aAuto ? "peligro" : "pri"}" data-ok data-foco>${aAuto ? "Sí, que actúe sola" : "Guardar"}</button></div>`, { bloqueado: () => enviando });
  $("[data-x]", m.dlg).onclick = m.cerrar;
  $("[data-ok]", m.dlg).onclick = async (ev) => {
    const b = ev.currentTarget;
    enviando = true; b.classList.add("cargando"); b.innerHTML = `<span class="gira">↻</span> Guardando…`;
    try {
      const r = await api("reglas_guardar", { body: { regla: payloadRegla(o, d), confirmar: d.modo === "auto", por: "lorenzo" } });
      const nueva = r?.regla ? r.regla : { ...o, ...d, actualizado: new Date().toISOString(), actualizado_por: "lorenzo" };
      const xs = RG.datos.reglas; xs[xs.findIndex((x) => x.id === id)] = nueva;
      RG.draft.delete(id); RG.campoMal.delete(id);
      enviando = false; m.cerrar();
      repintarRegla(id, "[data-probar]");
      toast(`✓ Guardada: ${esc(nueva.nombre || id)}${DEMO ? " (demo)" : ""}.`);
    } catch (e) {
      enviando = false;
      if (e.code === 401) { m.cerrar(); ls.del("dash_clave"); S.vista = "dash"; return login("Clave incorrecta"); }
      const campo = campoDeError(e);
      if (campo) RG.campoMal.set(id, campo);
      const box = $("#r-g-err", m.dlg); box.hidden = false;
      box.textContent = `No se guardó: ${e.message}${campo ? ` (campo: ${(d.variables?.[campo]?.etiqueta) || campo})` : ""}`;
      b.classList.remove("cargando"); b.textContent = "Reintentar";
      repintarRegla(id);
    }
  };
}

function pruebaHTML(r) {
  const xs = r?.afectaria || [];
  const ev = r?.evaluados != null ? `Evaluados: ${ent(r.evaluados)}` : "";
  const nota = [ev, r?.nota].filter(Boolean).map(esc).join(" · ");
  if (!xs.length) return `<div class="ok-box">Con los datos de hoy no afectaría nada.</div>${nota ? `<p class="mut">${nota}</p>` : ""}`;
  const fmtMet = (k, v) => {
    if (v == null) return "—";
    if (typeof v !== "number") return esc(String(v));
    if (/roas/.test(k)) return roasTx(v);
    return metR(k)[1] === "USD" ? usd(v) : NFR.format(v);
  };
  return `<p><b>Afectaría ${xs.length === 1 ? "a 1" : `a ${xs.length}`}:</b> <span class="mut">${nota}</span></p>
    <ul class="r-afecta">${xs.map((x) => `<li>
      <div class="r-af-cab"><span class="niv">${esc(NIV_R[x.nivel] || x.nivel || "")}</span><b>${esc(x.nombre || x.id)}</b></div>
      ${x.campana || x.cuenta ? `<div class="mut">${esc([x.campana, x.cuenta].filter(Boolean).join(" · "))}</div>` : ""}
      ${x.metricas ? `<div class="r-mets">${Object.entries(x.metricas).map(([k, v]) => `<span class="mchip num">${esc(metR(k)[0])}: <b>${fmtMet(k, v)}</b></span>`).join("")}</div>` : ""}
      <div class="r-af-acc">→ ${esc(x.accion || "")}</div></li>`).join("")}</ul>`;
}
async function pintarPrueba(cont, regla) {
  cont.innerHTML = `<p class="mut"><span class="cargador"></span>Probando con los datos de hoy… (no toca Meta)</p>`;
  try { const r = await api("reglas_probar", { body: { regla } }); cont.innerHTML = pruebaHTML(r); }
  catch (e) {
    if (e.code === 401) { cerrarModal(); ls.del("dash_clave"); S.vista = "dash"; return login("Clave incorrecta"); }
    cont.innerHTML = `<div class="err-box">No se pudo probar: ${esc(e.message)}</div>`;
  }
}
function probarModal(regla) {
  const m = abrirModal(`<h3>Probar: ${esc(regla.nombre || regla.id)}</h3><p class="mut">${esc(fraseTexto(regla))}</p><p class="mut">${esc(alcanceTx(regla))}</p><div id="r-prueba"></div>
    <div class="botones"><button type="button" class="btn pri" data-x>Cerrar</button></div>`, { ancho: true });
  $("[data-x]", m.dlg).onclick = m.cerrar;
  pintarPrueba($("#r-prueba", m.dlg), regla);
}
async function historialRegla(o) {
  const m = abrirModal(`<h3>Historial: ${esc(o.nombre || o.id)}</h3><p class="mut"><span class="cargador"></span>Cargando…</p>`, { ancho: true });
  let html;
  try {
    const r = await api("reglas_historial", { q: `&id=${encodeURIComponent(o.id)}` });
    const xs = r?.historial || [];
    html = xs.length ? `<ul class="lista-nombres r-hist">${xs.map((h) => {
      const filas = h.antes ? diffRegla(h.antes, h.despues) : [["Regla", "—", "creada"]];
      return `<li><div><b>${esc(fechaAR(h.fecha))}</b> <span class="mut">· ${esc(h.cambiado_por || "?")}</span></div>
        ${filas.length ? filas.map(([q, a, b]) => `<div class="r-h-fila"><span class="mut">${esc(q)}:</span> <span class="antes">${esc(a)}</span> → <b>${esc(b)}</b></div>`).join("") : `<div class="mut">Sin cambios visibles.</div>`}</li>`;
    }).join("")}</ul>` : `<p class="mut">Todavía no hay cambios registrados para esta regla.</p>`;
  } catch (e) {
    if (e.code === 401) { m.cerrar(); ls.del("dash_clave"); S.vista = "dash"; return login("Clave incorrecta"); }
    html = `<div class="err-box">${esc(e.message)}</div>`;
  }
  m.set(`<h3>Historial: ${esc(o.nombre || o.id)}</h3><p class="mut"><span class="r-id">${esc(o.id)}</span></p>${html}<div class="botones"><button type="button" class="btn pri" data-x>Cerrar</button></div>`);
  $("[data-x]", m.dlg).onclick = m.cerrar;
}
function borrarRegla(o) {
  let enviando = false;
  const m = abrirModal(`<h3>¿Borrar «${esc(o.nombre || o.id)}»?</h3><p>${esc(fraseTexto(o))}</p><p class="mut">No se puede deshacer. Si solo querés que no actúe, apagala con el interruptor.</p>
    <div class="err-box" id="r-b-err" role="alert" hidden></div>
    <div class="botones"><button type="button" class="btn" data-x data-foco>Cancelar</button><button type="button" class="btn peligro" data-ok>Borrar</button></div>`, { bloqueado: () => enviando });
  $("[data-x]", m.dlg).onclick = m.cerrar;
  $("[data-ok]", m.dlg).onclick = async (ev) => {
    const b = ev.currentTarget; enviando = true; b.classList.add("cargando"); b.innerHTML = `<span class="gira">↻</span> Borrando…`;
    try {
      await api("reglas_borrar", { body: { id: o.id } });
      RG.datos.reglas = RG.datos.reglas.filter((x) => x.id !== o.id); RG.draft.delete(o.id);
      enviando = false; m.cerrar(); pintarReglas(); toast(`Regla borrada: ${esc(o.nombre || o.id)}.`);
    } catch (e) {
      enviando = false;
      if (e.code === 401) { m.cerrar(); ls.del("dash_clave"); S.vista = "dash"; return login("Clave incorrecta"); }
      const box = $("#r-b-err", m.dlg); box.hidden = false; box.textContent = `No se pudo borrar: ${e.message}`;
      b.classList.remove("cargando"); b.textContent = "Reintentar";
    }
  };
}

// ----- armador de reglas nuevas (y edición completa de las mías) -----
function metsNueva() { const m = RG.datos?.metricas; return Array.isArray(m) && m.length ? m.map((x) => (x && x.id) || x) : METS_NUEVA; }
function opsPara(met) {
  if (met === "tipo_campana") return ["es"];
  if (met === "nombre") return ["contiene", "no_contiene"];
  const desde = (RG.datos?.operadores || []).map((o) => (o && o.id) || o).filter((o) => OPS_NUM.includes(o));
  return desde.length ? desde : OPS_NUM;
}
function wDesde(o) {
  if (!o) return { id: null, nombre: "", descripcion: "", modo: "avisar", activa: true, horario: "",
    alcance: { nivel: "anuncio", campanas: "testeos", tipo_campana: [], nombre_contiene: "", ventana: "hoy" },
    filas: [{ metrica: "gasto", op: ">=", valor: "" }], accion: { tipo: "apagar", pct: 30, canal: "discord" } };
  const al = o.alcance || {};
  return { id: o.id, nombre: o.nombre || "", descripcion: o.descripcion || "", modo: o.modo || "avisar", activa: o.activa !== false, horario: o.horario || "",
    alcance: { nivel: al.nivel || o.accion?.nivel || "anuncio", campanas: al.campanas || "todas", tipo_campana: al.tipo_campana || [], nombre_contiene: al.nombre_contiene || "", ventana: al.ventana || "hoy" },
    filas: (o.condiciones || []).filter((c) => !esTexto(c)).map((c) => ({ metrica: c.metrica, op: c.op, valor: c.var ? o.variables?.[c.var]?.valor : c.valor })),
    accion: { tipo: o.accion?.tipo || "apagar", pct: o.accion?.var ? o.variables?.[o.accion.var]?.valor : 30, canal: o.accion?.canal || "discord" } };
}
function wARegla(w) {
  const variables = {};
  const condiciones = w.filas.map((f, i) => {
    if (f.metrica === "tipo_campana" || f.metrica === "nombre") return { metrica: f.metrica, op: f.op, valor: f.valor };
    const k = `c${i + 1}`, [lbl, u] = metR(f.metrica);
    variables[k] = { valor: f.valor, tipo: ENTEROS_R.has(f.metrica) ? "entero" : "numero", unidad: u, min: 0, max: f.metrica === "hora" ? 23 : 100000, etiqueta: lbl };
    return { metrica: f.metrica, op: f.op, var: k };
  });
  const t = w.accion.tipo;
  const accion = { tipo: t, nivel: w.alcance.nivel };
  if (t === "subir_presupuesto" || t === "bajar_presupuesto") { accion.var = "pct"; variables.pct = { valor: w.accion.pct, tipo: "pct", unidad: "%", min: 1, max: 500, etiqueta: t === "subir_presupuesto" ? "Cuánto sube" : "Cuánto baja" }; }
  if (t === "avisar") accion.canal = w.accion.canal;
  accion.texto = accionBase(accion);
  const al = { nivel: w.alcance.nivel, campanas: w.alcance.campanas, ventana: w.alcance.ventana };
  if (w.alcance.tipo_campana.length) al.tipo_campana = w.alcance.tipo_campana.slice();
  if (w.alcance.nombre_contiene.trim()) al.nombre_contiene = w.alcance.nombre_contiene.trim();
  return { ...(w.id ? { id: w.id } : {}), grupo: "mis_reglas", origen: "lorenzo", funcion: "motor", nombre: w.nombre.trim(), descripcion: w.descripcion.trim(),
    condiciones, accion, alcance: al, horario: w.horario || "lo evalúa el motor de reglas", variables, activa: w.activa, modo: w.modo };
}
function armador(base) {
  const orig = base ? reglaOrig(base.id) : null;
  const w = wDesde(base);
  let paso = 1, guardando = false;
  const PASOS = ["Alcance", "Condiciones", "Acción", "Modo y nombre", "Resumen"];
  const m = abrirModal("", { ancho: true, bloqueado: () => guardando });
  const segs = (name, opts, val, tipo = "radio") => `<div class="segs">${opts.map(([k, t]) => `<label class="seg"><input type="${tipo}" name="${name}" value="${esc(k)}" ${tipo === "radio" ? (val === k ? "checked" : "") : (val.includes(k) ? "checked" : "")}><span>${t}</span></label>`).join("")}</div>`;
  const valorCtl = (f, i) => {
    if (f.metrica === "tipo_campana") return `<select class="campo c-val" id="w-v-${i}" data-i="${i}" data-c="valor">${["CBO", "ABO", "CostCap", "BidCap"].map((x) => `<option ${f.valor === x ? "selected" : ""}>${x}</option>`).join("")}</select>`;
    if (f.metrica === "nombre") return `<input class="campo c-val" id="w-v-${i}" data-i="${i}" data-c="valor" value="${esc(f.valor ?? "")}" placeholder="texto" autocomplete="off">`;
    const u = metR(f.metrica)[1];
    return `<span class="c-val-wrap"><input class="campo c-val num" id="w-v-${i}" data-i="${i}" data-c="valor" inputmode="${ENTEROS_R.has(f.metrica) ? "numeric" : "decimal"}" value="${esc(f.valor == null ? "" : String(f.valor).replace(".", ","))}" placeholder="valor" autocomplete="off">${u ? `<span class="uni">${esc(u)}</span>` : ""}</span>`;
  };
  const cuerpo = () => {
    const A = w.alcance;
    if (paso === 1) return `
      <fieldset class="w-campo"><legend>¿Sobre qué actúa?</legend>${segs("w-nivel", [["anuncio", "Anuncio"], ["conjunto", "Conjunto"], ["campana", "Campaña"]], A.nivel)}</fieldset>
      <fieldset class="w-campo"><legend>¿Qué campañas mira?</legend>${segs("w-camp", [["testeos", "Testeos"], ["costcap_bidcap", "CostCap/BidCap"], ["madres", "Madres"], ["todas", "Todas"]], A.campanas)}</fieldset>
      <fieldset class="w-campo"><legend>Tipo de campaña <span class="w-ayuda">(opcional; ninguno = cualquiera)</span></legend>${segs("w-tipo", [["CBO", "CBO"], ["ABO", "ABO"], ["CostCap", "CostCap"], ["BidCap", "BidCap"]], A.tipo_campana, "checkbox")}</fieldset>
      <div class="w-campo"><label class="w-lbl" for="w-nom-c">El nombre de la campaña contiene <span class="w-ayuda">(opcional)</span></label><input class="campo" id="w-nom-c" value="${esc(A.nombre_contiene)}" placeholder="ej. GLP-1" autocomplete="off"></div>
      <fieldset class="w-campo"><legend>Con los datos de</legend>${segs("w-vent", Object.entries(VENT_R).map(([k, t]) => [k, t[0].toUpperCase() + t.slice(1)]), A.ventana)}</fieldset>`;
    if (paso === 2) return `<p class="mut">Se tienen que cumplir todas (se leen unidas por «y»). Ventana: ${esc(VENT_R[A.ventana])}.</p>
      <div class="w-conds">${w.filas.map((f, i) => `${i ? `<div class="y-fila" aria-hidden="true">y</div>` : ""}<div class="cond-fila">
        <label class="sr" for="w-m-${i}">Métrica de la condición ${i + 1}</label>
        <select class="campo c-met" id="w-m-${i}" data-i="${i}" data-c="metrica">${metsNueva().map((k) => `<option value="${esc(k)}" ${f.metrica === k ? "selected" : ""}>${esc(metR(k)[0])}</option>`).join("")}</select>
        <label class="sr" for="w-o-${i}">Operador de la condición ${i + 1}</label>
        <select class="campo c-op" id="w-o-${i}" data-i="${i}" data-c="op">${opsPara(f.metrica).map((o) => `<option value="${esc(o)}" ${f.op === o ? "selected" : ""}>${esc(OPS_R[o] || o)}</option>`).join("")}</select>
        <label class="sr" for="w-v-${i}">Valor de la condición ${i + 1}</label>
        ${valorCtl(f, i)}
        <button type="button" class="btn chico w-quitar" data-quitar="${i}" aria-label="Quitar condición ${i + 1}" ${w.filas.length === 1 ? "disabled" : ""}>✕</button>
      </div>`).join("")}</div>
      <button type="button" class="btn chico" id="w-mas">+ agregar condición</button>`;
    if (paso === 3) {
      const t = w.accion.tipo, pres = t === "subir_presupuesto" || t === "bajar_presupuesto";
      return `<fieldset class="w-campo"><legend>Entonces…</legend>${segs("w-acc", [["apagar", `Apagar ${NIV_R[A.nivel]}`], ["prender", `Prender ${NIV_R[A.nivel]}`], ["subir_presupuesto", "Subir presupuesto %"], ["bajar_presupuesto", "Bajar presupuesto %"], ["avisar", "Solo avisar"]], t)}</fieldset>
        ${t === "prender" ? `<p class="mut">«Prender» mira lo que está apagado.</p>` : ""}
        ${pres ? `<div class="w-campo"><label class="w-lbl" for="w-pct">¿Cuánto? (%)</label><span class="c-val-wrap"><input class="campo num w-pct" id="w-pct" inputmode="decimal" value="${esc(w.accion.pct ?? "")}" autocomplete="off"><span class="uni">%</span></span><div class="w-ayuda">Entre 1 y 500. ${A.nivel === "anuncio" ? "Ojo: el presupuesto vive en el conjunto o la campaña." : ""}</div></div>` : ""}
        ${t === "avisar" ? `<fieldset class="w-campo"><legend>¿Por dónde aviso?</legend>${segs("w-canal", [["discord", "Discord"], ["push", "Celular"], ["ambos", "Los dos"]], w.accion.canal)}</fieldset>` : ""}`;
    }
    if (paso === 4) return `
      <fieldset class="w-campo"><legend>Modo</legend>${segs("w-modo", [["avisar", "Solo avisar"], ["simular", "Simular"], ["auto", "Auto"]], w.modo)}
        <div class="w-ayuda">Solo avisar: te manda el aviso y no toca nada. Simular: anota qué hubiera hecho. Auto: actúa en Meta sola.</div></fieldset>
      ${w.modo === "auto" ? `<div class="alerta-auto" role="alert"><b>Esta regla va a tocar Meta sola.</b>Lo recomendable es que nazca en «Solo avisar» y la pases a Auto cuando veas que acierta.</div>` : ""}
      <div class="w-campo"><label class="w-lbl" for="w-nombre">Nombre</label><input class="campo" id="w-nombre" value="${esc(w.nombre)}" placeholder="ej. Aviso CPA alto en GLP-1" autocomplete="off" required></div>
      <div class="w-campo"><label class="w-lbl" for="w-desc">Descripción <span class="w-ayuda">(opcional)</span></label><textarea class="campo" id="w-desc" rows="2" placeholder="Para qué sirve, en una frase">${esc(w.descripcion)}</textarea></div>`;
    const r = wARegla(w);
    const dif = orig ? diffRegla(orig, r) : [];
    return `<div class="calculo"><div class="formula">${esc(fraseTexto(r))}</div><div class="mut">${esc(alcanceTx(r))}</div><div class="mut">Modo: ${esc(MODO_TX[r.modo])} · ${r.activa ? "activa" : "inactiva"}</div></div>
      ${orig ? (dif.length ? tablaDiff(dif) : `<p class="mut">No cambiaste nada todavía.</p>`) : ""}
      ${r.modo === "auto" && (!orig || orig.modo !== "auto") ? `<div class="alerta-auto" role="alert"><b>Esta regla va a tocar Meta sola.</b>Desde que la guardes, ${esc(accionTexto(r).toLowerCase())} sin preguntarte.</div>` : ""}
      <div id="w-prueba" class="w-prueba"></div>`;
  };
  const leer = () => {
    const d = m.dlg, val = (n) => $(`input[name="${n}"]:checked`, d)?.value;
    if (paso === 1) { w.alcance.nivel = val("w-nivel"); w.alcance.campanas = val("w-camp"); w.alcance.ventana = val("w-vent"); w.alcance.tipo_campana = $$('input[name="w-tipo"]:checked', d).map((x) => x.value); w.alcance.nombre_contiene = $("#w-nom-c", d).value; }
    if (paso === 2) $$("[data-c]", d).forEach((el) => { w.filas[+el.dataset.i][el.dataset.c] = el.value; });
    if (paso === 3) { w.accion.tipo = val("w-acc"); const p = $("#w-pct", d); if (p) w.accion.pct = p.value; const c = val("w-canal"); if (c) w.accion.canal = c; }
    if (paso === 4) { w.modo = val("w-modo"); w.nombre = $("#w-nombre", d).value; w.descripcion = $("#w-desc", d).value; }
  };
  const validar = () => {
    if (paso === 2) {
      if (!w.filas.length) return ["Agregá al menos una condición.", null];
      for (let i = 0; i < w.filas.length; i++) {
        const f = w.filas[i];
        if (f.metrica === "tipo_campana") continue;
        if (f.metrica === "nombre") { if (!String(f.valor || "").trim()) return [`Condición ${i + 1}: poné el texto.`, `#w-v-${i}`]; f.valor = String(f.valor).trim(); continue; }
        const v = validarVar({ tipo: ENTEROS_R.has(f.metrica) ? "entero" : "numero", min: 0, max: f.metrica === "hora" ? 23 : 100000 }, f.valor);
        if (!v.ok) return [`Condición ${i + 1} (${metR(f.metrica)[0]}): ${v.msg}.`, `#w-v-${i}`];
        f.valor = v.valor;
      }
    }
    if (paso === 3) {
      if (/presupuesto/.test(w.accion.tipo)) { const v = validarVar({ tipo: "pct", min: 1, max: 500 }, w.accion.pct); if (!v.ok) return [`Porcentaje: ${v.msg}.`, "#w-pct"]; w.accion.pct = v.valor; }
    }
    if (paso === 4 && !w.nombre.trim()) return ["Ponele un nombre.", "#w-nombre"];
    return null;
  };
  const pintar = (foco) => {
    m.set(`<h3>${orig ? `Editar: ${esc(orig.nombre || orig.id)}` : "Nueva regla"}</h3>
      <ol class="pasos-w" aria-label="Pasos">${PASOS.map((t, i) => `<li ${i + 1 === paso ? 'aria-current="step"' : ""} class="${i + 1 < paso ? "hecho" : ""}">${i + 1}. ${t}</li>`).join("")}</ol>
      <div class="w-cuerpo">${cuerpo()}</div>
      <div class="r-msg" id="w-msg" role="alert"></div>
      <div class="botones">
        ${paso > 1 ? `<button type="button" class="btn" data-atras>Volver</button>` : `<button type="button" class="btn" data-x>Cancelar</button>`}
        ${paso < 5 ? `<button type="button" class="btn pri" data-sig>Siguiente</button>` : `<button type="button" class="btn" data-probar-w>Probar con datos de hoy</button><button type="button" class="btn ${w.modo === "auto" && (!orig || orig.modo !== "auto") ? "peligro" : "pri"}" data-guardar-w>${orig ? "Guardar cambios" : "Guardar regla"}</button>`}
      </div>`);
    const d = m.dlg;
    const f = foco && $(foco, d);
    if (f) f.focus({ preventScroll: true });
    else { const pri = $(".w-cuerpo input:not([type=radio]):not([type=checkbox]), .w-cuerpo input:checked, .w-cuerpo select", d); if (pri) pri.focus({ preventScroll: true }); }
    const x = $("[data-x]", d); if (x) x.onclick = m.cerrar;
    const at = $("[data-atras]", d); if (at) at.onclick = () => { leer(); paso--; pintar(); };
    const sig = $("[data-sig]", d); if (sig) sig.onclick = () => { leer(); const e = validar(); if (e) { $("#w-msg", d).textContent = e[0]; if (e[1]) $(e[1], d)?.focus(); return; } paso++; pintar(); };
    if (paso === 2) {
      $$(".c-met", d).forEach((s) => s.onchange = () => { leer(); const f = w.filas[+s.dataset.i]; const ops = opsPara(f.metrica); if (!ops.includes(f.op)) f.op = ops[0]; if (f.metrica === "tipo_campana") f.valor = "CostCap"; else if (f.metrica === "nombre" || typeof f.valor !== "number") f.valor = f.metrica === "nombre" ? "" : f.valor; pintar(`#w-m-${s.dataset.i}`); });
      $$("[data-quitar]", d).forEach((b) => b.onclick = () => { leer(); w.filas.splice(+b.dataset.quitar, 1); pintar("#w-mas"); });
      $("#w-mas", d).onclick = () => { leer(); w.filas.push({ metrica: "ventas_reales", op: "=", valor: 0 }); pintar(`#w-m-${w.filas.length - 1}`); };
    }
    if (paso === 3) $$('input[name="w-acc"]', d).forEach((r) => r.onchange = () => { leer(); pintar(`input[name="w-acc"][value="${r.value}"]`); });
    if (paso === 4) $$('input[name="w-modo"]', d).forEach((r) => r.onchange = () => { leer(); pintar(`input[name="w-modo"][value="${r.value}"]`); });
    if (paso === 5) {
      $("[data-probar-w]", d).onclick = () => { const c = $("#w-prueba", d); pintarPrueba(c, wARegla(w)); };
      $("[data-guardar-w]", d).onclick = (ev) => guardarArmado(ev.currentTarget);
    }
  };
  const guardarArmado = async (b) => {
    const regla = wARegla(w);
    guardando = true; b.classList.add("cargando"); b.innerHTML = `<span class="gira">↻</span> Guardando…`;
    try {
      const r = await api("reglas_guardar", { body: { regla, confirmar: regla.modo === "auto", por: "lorenzo" } });
      const nueva = r?.regla || { ...regla, id: regla.id || "L-" + Date.now() };
      const xs = RG.datos.reglas, i = xs.findIndex((x) => x.id === nueva.id);
      if (i >= 0) xs[i] = nueva; else xs.push(nueva);
      RG.draft.delete(nueva.id); RG.campoMal.delete(nueva.id);
      guardando = false; m.cerrar();
      pintarReglas();
      const el = cardEl(nueva.id);
      if (el) { el.scrollIntoView({ behavior: reducido() ? "auto" : "smooth", block: "center" }); const p = $("[data-probar]", el); if (p) p.focus({ preventScroll: true }); }
      toast(`✓ ${orig ? "Guardada" : "Creada"}: ${esc(nueva.nombre)}${nueva.modo === "avisar" ? " (solo avisa)" : ""}${DEMO ? " (demo)" : ""}.`);
    } catch (e) {
      guardando = false;
      if (e.code === 401) { m.cerrar(); ls.del("dash_clave"); S.vista = "dash"; return login("Clave incorrecta"); }
      const campo = campoDeError(e);
      $("#w-msg", m.dlg).textContent = `No se guardó: ${e.message}${campo ? ` (campo: ${campo})` : ""}`;
      b.classList.remove("cargando"); b.textContent = "Reintentar";
    }
  };
  pintar();
}

// ---------- avisos push: suscripción ----------
const esIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const esInstalada = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const pushSoportado = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && window.isSecureContext;
async function estadoAvisos() {
  if (!pushSoportado()) return esIOS() && !esInstalada() ? "instalar" : "no";
  if (Notification.permission === "denied") return "bloqueados";
  if (Notification.permission !== "granted") return "apagados";
  try { const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription(); return sub ? "activados" : "apagados"; } catch { return "apagados"; }
}
const AVISO_TX = {
  activados: "✓ activados en este equipo",
  apagados: "pide permiso y te suscribe",
  bloqueados: "bloqueados: habilitalos en Ajustes",
  instalar: "en iPhone: primero agregá la app a inicio",
  no: "este navegador no los soporta",
};
async function pintarEstadoAvisos() {
  const s = $("#mi-avisos-tx"); if (!s) return;
  const e = await estadoAvisos();
  if (!$("#mi-avisos-tx")) return;
  s.textContent = AVISO_TX[e];
  const b = $("#mi-avisos"); if (b) b.dataset.estado = e;
}
function claveVapid(k) {
  const b = k.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (k.length % 4)) % 4);
  return Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
}
async function activarAvisos() {
  if (DEMO) return toast("Demo: los avisos no se activan de verdad. Probá «Avisos de ejemplo».");
  const e = await estadoAvisos();
  if (e === "instalar") return toast("En iPhone los avisos solo andan con la app en la pantalla de inicio: en Safari tocá <b>Compartir → Agregar a inicio</b> y abrila desde el ícono (iOS 16.4 o más).", "error", 11000);
  if (e === "no") return toast("Este navegador no soporta avisos push.", "error");
  if (e === "bloqueados") return toast("Los avisos están bloqueados para esta app. Habilitalos en los ajustes del navegador / del celular y volvé a tocar.", "error", 9000);
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { toast("No diste permiso para avisos.", "error"); return pintarEstadoAvisos(); }
    const reg = await navigator.serviceWorker.ready;
    const { clave: k } = await api("vapid");
    if (!k) throw new Error("el servidor no devolvió la clave de avisos");
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveVapid(k) }));
    await api("suscribir", { body: { suscripcion: sub.toJSON(), quien: ls.get("dash_quien", "Lorenzo") } });
    toast("✓ Avisos activados. Este equipo va a recibir los avisos de las reglas.");
  } catch (err) {
    if (err.code === 401) { ls.del("dash_clave"); return login("Clave incorrecta"); }
    toast(`No se pudieron activar los avisos: ${esc(err.message)}`, "error", 8000);
  }
  pintarEstadoAvisos();
}
async function probarAviso() {
  if (DEMO) { await cargarDemo(); return mostrarEvento(window.DemoAPI.ejemplo("surf_sube")); }
  try {
    const r = await api("probar", { body: {} });
    const n = r?.enviados ?? 0;
    toast(n ? `Aviso de prueba enviado a ${n} equipo${n === 1 ? "" : "s"}.` : "No hay equipos suscriptos todavía: tocá «Activar avisos».", n ? "ok" : "error");
  } catch (err) {
    if (err.code === 401) { ls.del("dash_clave"); return login("Clave incorrecta"); }
    toast(`No se pudo mandar la prueba: ${esc(err.message)}`, "error");
  }
}
async function avisosEjemplo() {
  await cargarDemo();
  const tipos = ["apagar", "varios", "campana_apagada", ...Object.keys(EV_TIPOS).filter((t) => t !== "apagar")];
  const m = abrirModal(`<h3>Avisos de ejemplo</h3><p class="mut">Tocá uno para ver cómo llega: primero el pop-up, después la tabla con lo que tocó la regla.</p>
    <div class="ev-ejemplos">${tipos.map((t) => `<button type="button" class="btn chico" data-ej="${t}">${({ varios: "apagar · varios", campana_apagada: "apagar · campaña" })[t] || esc(t)}</button>`).join("")}</div>
    <div class="botones"><button type="button" class="btn pri" data-x>Cerrar</button></div>`);
  $("[data-x]", m.dlg).onclick = m.cerrar;
  $$("[data-ej]", m.dlg).forEach((b) => b.onclick = () => { m.cerrar(); mostrarEvento(window.DemoAPI.ejemplo(b.dataset.ej)); });
}

// ---------- avisos: el pop-up al abrir uno ----------
// Trazos a mano (viewBox 64): cada string es un path; se dibujan en orden.
const EV_ICO = {
  x: ["M33 7 C 48 6, 58 17, 57 32 C 57 47, 46 57, 31 57 C 16 57, 7 46, 7 31 C 8 18, 18 8, 35 8", "M21 20 C 28 28, 36 37, 44 45", "M44 19 C 37 27, 29 36, 20 46"],
  sube: ["M4 58 C 22 57, 42 58, 60 57", "M7 57 V48 H19 V39 H31 V30 H43 V21 H57 V57", "M9 36 C 19 28, 31 18, 46 8", "M35 8 C 39 8, 43 7, 47 7 C 47 11, 46 15, 46 19"],
  baja: ["M4 58 C 22 57, 42 58, 60 57", "M7 57 V21 H21 V30 H33 V39 H45 V48 H57 V57", "M24 7 C 34 15, 45 25, 56 33", "M56 21 C 56 25, 57 29, 57 34 C 53 34, 49 35, 45 35"],
  balanza: ["M32 11 C 32 25, 33 40, 32 53", "M20 56 C 27 54, 37 54, 44 56", "M9 18 C 22 15, 42 15, 55 18", "M12 18 L6 34 M12 18 L18 34", "M3 34 C 7 41, 16 41, 21 34", "M52 18 L46 34 M52 18 L58 34", "M43 34 C 47 41, 56 41, 61 34", "M29 8 C 30 5, 35 5, 35 8 C 35 11, 30 12, 29 8"],
  vuelve: ["M17 19 C 25 9, 42 8, 51 19 C 59 30, 55 47, 42 54 C 30 60, 15 54, 10 42", "M7 10 C 10 14, 13 17, 17 20 C 20 16, 22 12, 24 8"],
  latido: ["M32 54 C 18 44, 6 34, 7 22 C 8 12, 20 7, 28 14 C 30 16, 31 18, 32 20 C 34 15, 40 9, 48 10 C 58 12, 60 24, 55 33 C 50 42, 42 48, 32 54", "M3 33 H17 L22 23 L29 43 L35 26 L39 34 H61"],
  salvavidas: ["M32 7 C 46 7, 57 18, 57 32 C 57 46, 46 57, 32 57 C 18 57, 7 46, 7 32 C 7 18, 18 7, 34 8", "M32 21 C 38 21, 43 26, 43 32 C 43 38, 38 43, 32 43 C 26 43, 21 38, 21 32 C 21 26, 26 21, 33 21", "M24 24 L14 14 M40 24 L50 14", "M40 40 L50 50 M24 40 L14 50"],
  estrella: ["M32 9 L38 25 C 44 25, 50 24, 55 25 L42 35 L47 52 L32 42 L17 52 L22 35 L9 25 C 14 24, 20 25, 26 25 Z", "M54 4 V14 M49 9 H59", "M9 46 V56 M4 51 H14"],
  trofeo: ["M18 9 C 27 8, 37 8, 46 9 C 47 26, 42 36, 32 38 C 22 36, 17 26, 18 9", "M18 14 C 8 13, 7 26, 20 28", "M46 14 C 56 13, 57 26, 44 28", "M32 38 V47", "M22 47 C 29 46, 35 46, 42 47 L45 56 C 36 55, 28 55, 19 56 Z", "M25 20 L30 26 L40 15"],
  copa: ["M18 9 C 27 8, 37 8, 46 9 C 47 26, 42 36, 32 38 C 22 36, 17 26, 18 9", "M18 14 C 8 13, 7 26, 20 28", "M46 14 C 56 13, 57 26, 44 28", "M32 38 V47", "M22 47 C 29 46, 35 46, 42 47 L45 56 C 36 55, 28 55, 19 56 Z", "M32 15 L34 21 L40 21 L35 25 L37 31 L32 27 L27 31 L29 25 L24 21 L30 21 Z", "M56 4 V12 M52 8 H60", "M7 4 V10 M4 7 H10"],
  cohete: ["M32 5 C 43 13, 45 28, 40 43 C 35 42, 29 42, 24 43 C 19 28, 21 13, 32 5", "M28 21 C 28 17, 36 17, 36 21 C 36 25, 28 26, 28 21", "M24 33 L15 45 L24 44 M40 33 L49 45 L40 44", "M28 47 C 28 52, 30 56, 32 61 C 34 56, 36 52, 36 47"],
  etiqueta: ["M34 7 C 41 7, 48 7, 55 8 C 56 15, 56 23, 56 30 L31 56 L8 33 Z", "M43 18 C 43 15, 48 15, 48 18 C 48 21, 43 22, 43 18", "M22 33 L32 43"],
  triangulo: ["M32 6 C 41 22, 50 38, 59 54 C 41 55, 23 55, 5 54 C 14 38, 23 22, 33 7", "M32 23 C 32 28, 32 33, 32 38", "M32 46 L32 47.5"],
  reloj: ["M32 6 C 47 6, 58 17, 58 32 C 58 47, 47 58, 32 58 C 17 58, 6 47, 6 32 C 6 17, 17 6, 34 7", "M32 15 C 32 21, 32 27, 32 32 L43 39", "M32 9 V11 M55 32 H53 M32 55 V53 M9 32 H11"],
  grafico: ["M6 57 C 24 56, 42 57, 60 56", "M14 54 V40 M26 54 V30 M38 54 V36 M50 54 V20", "M10 32 L25 19 L37 25 L54 8", "M45 8 L55 7 L54 17"],
  tilde: ["M32 7 C 47 7, 57 18, 57 32 C 57 46, 46 57, 32 57 C 18 57, 7 46, 7 32 C 7 18, 18 7, 34 8", "M18 33 C 22 37, 25 40, 28 44 C 34 35, 41 26, 48 19"],
  fabrica: ["M4 57 C 22 56, 42 56, 60 57", "M8 56 V31 C 12 33, 16 36, 20 39 V31 C 24 33, 28 36, 32 39 V31 C 36 33, 40 36, 44 39 V13 C 47 13, 50 13, 54 13 V56", "M48 9 C 45 6, 49 3, 52 4 C 55 1, 60 3, 58 7", "M14 47 H20 M26 47 H32 M38 47 H44", "M49 22 V26 M49 31 V35"],
  fiesta: ["M7 58 C 11 48, 15 38, 20 28 C 26 34, 31 40, 37 45 C 27 50, 17 54, 7 58 Z", "M24 25 C 22 18, 30 16, 28 9", "M40 41 C 47 39, 49 47, 57 43", "M31 33 C 37 26, 43 23, 52 20", "M40 8 V14 M37 11 H43", "M54 30 V34 M52 32 H56", "M14 18 C 15 17, 17 17, 17 19 C 17 21, 14 20, 14 18"],
  campana: ["M19 44 C 20 32, 17 15, 32 14 C 47 15, 44 32, 45 44", "M13 45 C 25 44, 39 44, 51 45", "M27 51 C 28 56, 36 56, 37 51", "M32 8 V13"],
};
// tipo -> [ícono, color, rótulo]
const EV_TIPOS = {
  apagar: ["x", "peligro", "Cortes"],
  surf_sube: ["sube", "ok", "Surfeo"],
  surf_baja: ["baja", "naranja", "Surfeo"],
  base: ["balanza", "acento", "Base de madres"],
  reset: ["vuelve", "acento", "Reset a la base"],
  revivir: ["latido", "ok", "Revivir"],
  rescate: ["salvavidas", "ok", "Rescate"],
  venta: ["estrella", "ok", "Primera venta"],
  validacion: ["trofeo", "ok", "Validación"],
  winner: ["copa", "ok", "Winner"],
  escala: ["cohete", "ok", "Escala"],
  categoria: ["etiqueta", "acento", "Categoría de testeo"],
  alerta: ["triangulo", "peligro", "Alerta"],
  cola: ["reloj", "naranja", "Cola"],
  reporte: ["grafico", "acento", "Reporte"],
  prueba: ["tilde", "ok", "Prueba"],
  fabrica: ["fabrica", "acento", "Fábrica de creativos"],
  fabrica_lista: ["fiesta", "ok", "Fábrica de creativos"],
  fabrica_lanzada: ["cohete", "ok", "Fábrica de creativos"],
};
function icoEvento(nombre) {
  const ps = EV_ICO[nombre] || EV_ICO.campana;
  return `<svg class="ev-svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">${ps.map((d, i) => `<path d="${d}" pathLength="1" style="--i:${i}"/>`).join("")}</svg>`;
}
const ART = { campana: "la campaña", conjunto: "el conjunto", anuncio: "el anuncio" };
const NIV_DE = { campana: "de la campaña", conjunto: "del conjunto", anuncio: "del anuncio" };
const numOk = (n) => typeof n === "number" && isFinite(n);
function cambioTx(it, sube) {
  if (!it || !numOk(it.antes) || !numOk(it.despues) || !it.antes) return "";
  const f = it.despues / it.antes;
  if (sube && Math.abs(f - Math.round(f)) < 0.04 && Math.round(f) >= 2) return `×${Math.round(f)}`;
  const p = Math.round((f - 1) * 100);
  return p ? `${p > 0 ? "+" : "−"}${Math.abs(p)} %` : "";
}
function cuantas(its) {
  const nivs = new Set(its.map((i) => i.n));
  return nivs.size === 1 && NIVEL[its[0].n] ? plural(its.length, its[0].n) : `${its.length} cosas`;
}
function tituloEvento(ev) {
  const its = ev.items, n = its.length, i0 = its[0] || {}, art = ART[i0.n] || "eso";
  const varios = n > 1 ? cuantas(its) : null;
  switch (ev.t) {
    case "apagar": return n ? `Apagué ${varios || art}` : "Apagué cosas";
    case "revivir": return n ? `Reviví ${varios || art}` : "Reviví cosas";
    case "rescate": {
      const salva = its.find((i) => i.n === "campana") || its.find((i) => i.n === "conjunto");
      const malos = its.filter((i) => i.n === "anuncio").length;
      return salva ? `Salvé ${ART[salva.n]}${malos ? ` y apagué ${plural(malos, "anuncio")}` : ""}` : `Apagué ${malos ? plural(malos, "anuncio") : "los malos"} y la campaña sigue`;
    }
    case "surf_sube": { const c = cambioTx(i0, true); return n > 1 ? `Surfeé ${varios}${c ? " " + c : ""}` : `Surfeé ${art}${c ? " " + c : ""}`; }
    case "surf_baja": { const c = cambioTx(i0, false) || "−30 %"; return n > 1 ? `Bajé el presupuesto de ${varios} ${c}` : `Bajé el presupuesto ${NIV_DE[i0.n] || ""} ${c}`.replace(/\s+/g, " "); }
    case "base": {
      const c = cambioTx(i0, false);
      const v = c.startsWith("+") ? "Subí" : c.startsWith("−") ? "Bajé" : "Cambié";
      return n > 1 ? `${v} la base de ${varios}${c ? " " + c : ""}` : `${v} la base ${NIV_DE[i0.n] || ""}${c ? " " + c : ""}`.replace(/\s+/g, " ");
    }
    case "reset": return n > 1 ? `Volví ${varios} a su base` : `Volví ${art} a su base`;
    case "venta": return "¡Primera venta!";
    case "validacion": return n > 1 ? `Validé ${varios}` : "Testeo validado";
    case "winner": return n > 1 ? `${varios} winners` : "¡Hay winner!";
    case "escala": return n ? `${cuantas(its)} ${n === 1 ? "listo" : "listos"} para escalar` : "Hay para escalar";
    case "categoria": return "Nueva categoría de testeo";
    case "alerta": return "Ojo con esto";
    case "cola": return "Quedó en cola / se aplicó tarde";
    case "reporte": return "Reporte";
    case "prueba": return "Aviso de prueba";
    case "fabrica": return ev.titulo || "La fábrica avanzó";
    case "fabrica_lista": return "¡Se terminó todo!";
    case "fabrica_lanzada": return ev.titulo && !/^dashboard$/i.test(ev.titulo) ? ev.titulo : "¡Ya está en Meta!";
    default: return "Aviso";
  }
}
function itemEventoHTML(it) {
  const nv = NIVEL[it.n] ? it.n : null;
  const datos = [];
  if (numOk(it.antes) || numOk(it.despues)) datos.push(`<span class="ev-presu num">${numOk(it.antes) ? usd(it.antes) : "—"} <span class="ev-flecha" aria-label="pasó a">→</span> <b>${numOk(it.despues) ? usd(it.despues) : "—"}</b></span>`);
  if (numOk(it.roas)) datos.push(`<span class="ev-dato">ROAS ${chipRoas(it.roas)}</span>`);
  if (numOk(it.ventas)) datos.push(`<span class="ev-dato num">${ent(it.ventas)} venta${it.ventas === 1 ? "" : "s"}</span>`);
  if (numOk(it.gasto)) datos.push(`<span class="ev-dato num">gastó ${usd(it.gasto)}</span>`);
  return `<li>
    <div class="ev-it-cab">${nv ? `<span class="niv-tag niv-${nv}">${NIVEL[nv][0]}</span>` : ""}<span class="ev-it-nom">${esc(it.nom || it.id || "—")}</span></div>
    ${it.cn && it.n !== "campana" ? `<div class="ev-it-cn">en <b>${esc(it.cn)}</b></div>` : ""}
    ${datos.length ? `<div class="ev-it-datos">${datos.join("")}</div>` : ""}
    ${it.r ? `<div class="ev-it-r">${esc(it.r)}</div>` : ""}
  </li>`;
}
function normalizarEvento(ev) {
  if (!ev || typeof ev !== "object") return null;
  const items = (Array.isArray(ev.items) ? ev.items : []).filter((i) => i && typeof i === "object" && i.id).map((i) => ({ ...i, id: String(i.id), c: i.c != null ? String(i.c) : undefined, s: i.s != null ? String(i.s) : undefined }));
  return { ...ev, t: String(ev.t || ""), r: ev.r ? String(ev.r) : "", items };
}
let eventoAbierto = false;
function mostrarEvento(evRaw) {
  const ev = normalizarEvento(evRaw);
  if (!ev) return;
  const [ico, color, rotulo] = EV_TIPOS[ev.t] || ["campana", "acento", "Aviso"];
  if (/^fabrica/.test(ev.t)) return mostrarEventoFabrica(ev, ico, color, rotulo);
  const navegables = ev.items.filter((i) => NIVEL[i.n] && (i.n === "campana" || i.c || i.s));
  // en segundo plano, mientras se lee el pop-up: traer «hoy» y abrir lo necesario
  const prep = navegables.length ? prepararEvento(ev, navegables) : null;
  const html = `<div class="ev ev-${color}">
      <div class="ev-ico boceto">${icoEvento(ico)}</div>
      <div class="ev-rotulo">${esc(rotulo)}</div>
      <h3 class="ev-titulo">${esc(tituloEvento(ev))}</h3>
      <svg class="ev-garabato" viewBox="0 0 160 12" aria-hidden="true"><path d="M2 8 C 30 3, 52 11, 80 6 S 130 3, 158 7" pathLength="1"/></svg>
      ${ev.r ? `<div class="ev-por"><span class="ev-por-lbl">por qué</span><p>${esc(ev.r)}</p></div>` : ""}
      ${ev.items.length ? `<ul class="ev-items">${ev.items.map(itemEventoHTML).join("")}</ul>` : ""}
    </div>
    <div class="botones"><button type="button" class="btn pri" data-ver data-foco>${navegables.length ? "Ver en la tabla" : "Listo"}</button></div>`;
  eventoAbierto = true;
  const m = abrirModal(html, { alCerrar: () => { eventoAbierto = false; if (prep) mostrarEnTabla(prep); else irAlDash(); } });
  m.dlg.classList.add("dialogo-ev");
  m.dlg.setAttribute("aria-labelledby", "ev-t"); $(".ev-titulo", m.dlg).id = "ev-t";
  const x = document.createElement("button");
  x.type = "button"; x.className = "ev-cerrar"; x.setAttribute("aria-label", "Cerrar y ver en la tabla"); x.textContent = "✕";
  x.onclick = m.cerrar; m.dlg.prepend(x);
  $("[data-ver]", m.dlg).onclick = m.cerrar;
}
function mostrarEventoFabrica(ev, ico, color, rotulo) {
  const ped = ev.pedido != null && ev.pedido !== "" ? String(ev.pedido) : null;
  const lista = ev.t === "fabrica_lista", lanzada = ev.t === "fabrica_lanzada";
  let despues = null;
  const html = `<div class="ev ev-${color} ev-${esc(ev.t)}">
      ${lista ? fiestaHTML() : ""}
      <div class="ev-ico boceto">${icoEvento(ico)}</div>
      <div class="ev-rotulo">${esc(rotulo)}${ped ? ` · pedido #${esc(ped)}` : ""}</div>
      <h3 class="ev-titulo">${esc(tituloEvento(ev))}</h3>
      <svg class="ev-garabato" viewBox="0 0 160 12" aria-hidden="true"><path d="M2 8 C 30 3, 52 11, 80 6 S 130 3, 158 7" pathLength="1"/></svg>
      ${ev.r ? `<div class="ev-por"><span class="ev-por-lbl">${lista ? "qué hay" : lanzada ? "qué pasó" : "en qué va"}</span><p>${esc(ev.r)}</p></div>` : ""}
      ${lista ? `<p class="ev-sig">Mirá los videos y, si están bien, tocá <b>Publicar</b>: se suben a Meta y a los 10 minutos se chequea solo.</p>` : ""}
    </div>
    <div class="botones">${lista
      ? `<a class="btn" data-drive target="_blank" rel="noopener" ${ev.drive_url ? `href="${esc(ev.drive_url)}"` : `aria-disabled="true"`}>Revisar videos ↗</a><button type="button" class="btn pri" data-publicar data-foco>Publicar</button>`
      : `<button type="button" class="btn pri" data-ver data-foco>${lanzada ? "Ir al dashboard" : ped ? "Ver el pedido" : "Listo"}</button>`}</div>`;
  eventoAbierto = true;
  const m = abrirModal(html, { alCerrar: () => {
    eventoAbierto = false;
    if (lanzada) { irAlDash(); return; }
    if (!irASeccion("ranking", { pedido: ped })) return;
    if (despues === "publicar" && ped) confirmarPublicar(ped);
  } });
  m.dlg.classList.add("dialogo-ev");
  m.dlg.setAttribute("aria-labelledby", "ev-t"); $(".ev-titulo", m.dlg).id = "ev-t";
  const x = document.createElement("button");
  x.type = "button"; x.className = "ev-cerrar"; x.setAttribute("aria-label", lanzada ? "Cerrar" : "Cerrar y ver el pedido"); x.textContent = "✕";
  x.onclick = m.cerrar; m.dlg.prepend(x);
  const v = $("[data-ver]", m.dlg); if (v) v.onclick = m.cerrar;
  const pu = $("[data-publicar]", m.dlg); if (pu) pu.onclick = () => { despues = "publicar"; m.cerrar(); };
  const dr = $("[data-drive]", m.dlg);
  if (dr) {
    dr.addEventListener("click", (e) => { if (!dr.getAttribute("href")) { e.preventDefault(); toast("Todavía no tengo el link de Drive de este pedido.", "error"); } });
    if (!ev.drive_url && ped) cargarFabrica().then(() => {
      const p = pedidoPorId(ped);
      if (p?.drive_url && dr.isConnected) { dr.href = p.drive_url; dr.removeAttribute("aria-disabled"); }
      else if (dr.isConnected) dr.textContent = "Sin link de Drive todavía";
    });
  }
}
function reglasSucias() { return S.vista === "reglas" && (RG.datos?.reglas || []).some(esSucia); }
function irAlDash() {
  if (S.vista === "dash" && $("#carr")) return true;
  if (reglasSucias()) { toast("Tenés cambios sin guardar en Reglas: guardalos o descartalos y después mirá la tabla.", "error", 8000); return false; }
  RG.draft.clear(); RG.campoMal.clear();
  try { history.replaceState(null, "", location.pathname + location.search); } catch {}
  montar(); window.scrollTo(0, 0);
  return true;
}
async function esperarDetalle(c) {
  cargarDetalle(c);
  const k = `${S.periodo}|${c.id}`;
  for (let i = 0; i < 200 && S.det.get(k)?.st === "cargando"; i++) await new Promise((ok) => setTimeout(ok, 120));
  return S.det.get(k);
}
async function prepararEvento(ev, its) {
  if (!irAlDash()) return { fallo: true };
  if (S.periodo !== "hoy") { S.periodo = "hoy"; S.sel.clear(); ajustarIdx(); pintarTodo(); }
  await cargar();   // siempre fresco: el aviso es más nuevo que lo que hubiera en pantalla
  if (!S.datos.hoy) return { fallo: true, msg: "No pude traer los datos de hoy." };
  // campañas
  const cid = (i) => i.n === "campana" ? i.id : i.c;
  const camps = new Map();
  for (const i of its) { const c = cid(i) && campanaPorId(cid(i)); if (c) camps.set(c.id, c); }
  // el grupo que las contiene (si son de grupos distintos, «Todas»)
  const gs = new Set([...camps.values()].map((c) => c.grupo));
  S.grupoClave = gs.size === 1 ? [...gs][0] : "todas";
  ajustarIdx();
  if ([...camps.values()].some((c) => !prendido(c.estado)) && !S.verApagadas) {
    S.verApagadas = true;
    const t = $("#t-apagadas"); if (t) t.setAttribute("aria-checked", "true");
  }
  for (const c of camps.values()) { S.open.add("c:" + c.id); S.det.delete(`hoy|${c.id}`); }
  pintarTodo();
  await Promise.all([...camps.values()].map(esperarDetalle));
  // conjuntos y anuncios
  S.sel.clear();
  const faltan = [], claves = [];
  for (const i of its) {
    const c = camps.get(cid(i));
    if (!c) { faltan.push(i); continue; }
    if (i.n === "campana") { claves.push("campana:" + c.id); continue; }
    const cjs = S.det.get(`hoy|${c.id}`)?.data?.conjuntos || [];
    let sid = i.n === "conjunto" ? i.id : i.s;
    if (i.n === "anuncio" && !cjs.some((s) => s.id === sid)) sid = (cjs.find((s) => (s.anuncios || []).some((a) => a.id === i.id)) || {}).id;
    if (!sid || !cjs.some((s) => s.id === sid)) { faltan.push(i); continue; }
    S.open.add("s:" + sid);
    claves.push(i.n === "conjunto" ? "conjunto:" + sid : "anuncio:" + i.id);
  }
  for (const k of claves) { const it = buscarItem(k); if (it) S.sel.set(k, { id: it.id, act: it.act, nivel: it.nivel, nombre: it.nombre, estado: it.estado }); else faltan.push({ nom: k }); }
  if (!eventoAbierto) pintarTodo(); else { pintarCarrusel(); pintarTabla(); }
  return { claves: claves.filter((k) => S.sel.has(k)), faltan };
}
async function mostrarEnTabla(prep) {
  const r = await prep;
  if (!r || r.fallo) { if (r?.msg) toast(r.msg, "error"); return; }
  if (S.vista !== "dash") return;
  pintarTodo();
  if (r.faltan.length) {
    const ns = r.faltan.map((i) => `<b>${esc(i.nom || i.id)}</b>`).join(", ");
    toast(`No encontré ${ns} en la tabla de hoy. Puede ser de otra cuenta, estar borrado o no tener datos hoy.`, "error", 9000);
  }
  const trs = r.claves.map((k) => $(`tr.fila[data-k="${CSS.escape(k)}"]`)).filter(Boolean);
  if (!trs.length) return;
  trs[0].scrollIntoView({ behavior: reducido() ? "auto" : "smooth", block: "center", inline: "nearest" });
  const sc = $("#tabla-scroll"); if (sc) sc.scrollLeft = 0;
  trs.forEach((tr) => { tr.classList.remove("destello"); void tr.offsetWidth; tr.classList.add("destello"); });
  setTimeout(() => trs.forEach((tr) => tr.classList.remove("destello")), 2600);
  trs[0].focus({ preventScroll: true });
}
// #ev=<json> en la dirección (lo arma el service worker al tocar el aviso)
function leerHashEv() {
  const h = location.hash || "";
  if (!h.startsWith("#ev=")) return null;
  try { history.replaceState(null, "", location.pathname + location.search); } catch {}
  const crudo = decodeURIComponent(h.slice(4));
  if (DEMO && /^demo:/.test(crudo)) return { demo: crudo.slice(5) };
  try { return JSON.parse(crudo); } catch { toast("El aviso llegó roto: no lo pude leer.", "error"); return null; }
}
async function recibirEvento(ev) {
  if (!ev) return;
  if (ev.demo) { await cargarDemo(); ev = window.DemoAPI.ejemplo(ev.demo); }
  if (!DEMO && !clave()) { ls.set("dash_ev_pend", JSON.stringify(ev)); return; }
  mostrarEvento(ev);
}
function eventoPendiente() {
  const p = ls.get("dash_ev_pend"); if (!p) return;
  ls.del("dash_ev_pend");
  try { mostrarEvento(JSON.parse(p)); } catch {}
}

// ---------- secciones: Dashboard / Ranking (10/10) ----------
function pintarNav() {
  const n = $("#secciones"); if (!n) return;
  n.hidden = false;
  const sec = S.vista === "ranking" ? "ranking" : "dash";
  $$("[data-sec]", n).forEach((b) => b.setAttribute("aria-pressed", b.dataset.sec === sec));
}
function abrirInicial() {
  if (location.hash === "#ranking" || (location.hash !== "#dash" && ls.get("dash_seccion") === "ranking")) montarRanking();
  else montar();
}
function irASeccion(sec, opts = {}) {
  cerrarMenu();
  if (sec === "ranking") {
    if (reglasSucias()) { toast("Tenés cambios sin guardar en Reglas: guardalos o descartalos antes de cambiar de sección.", "error", 8000); return false; }
    RG.draft.clear(); RG.campoMal.clear();
    if (S.vista === "ranking" && $("#rk")) { if (opts.pedido != null) abrirPedido(opts.pedido); return true; }
    montarRanking(opts);
    return true;
  }
  if (S.vista === "reglas") { volverDeReglas(); return true; }
  if (S.vista === "dash" && $("#carr")) { window.scrollTo({ top: 0, behavior: reducido() ? "auto" : "smooth" }); return true; }
  return irAlDash();
}

// ---------- Ranking ----------
const RK = {
  periodo: periodoValido(ls.get("rk_periodo")) ? ls.get("rk_periodo") : "3d",
  datos: {}, cargando: false, error: null,
  sel: new Map(),              // `${grupo}|${post}` -> { g: {clave, etiqueta, bandera}, a }
  fab: null, fabErr: null, fabCargando: false, timer: null,
  panel: ls.get("rk_panel", "0") === "1", abiertos: new Set(), foco: null,
};
const ETAPAS_FAB = [["winners", "Winners"], ["guiones", "Guiones"], ["iteraciones", "Iteraciones"], ["renovaciones", "Renovaciones"], ["drive", "Drive"], ["lista", "Lista"], ["lanzada", "En Meta"]];
const ETAPA_TX = { inicio: "Arrancó", winners: "Winners", guiones: "Guiones", iteraciones: "Iteraciones", renovaciones: "Renovaciones", drive: "Drive", lista: "Lista para revisar", lanzando: "Lanzando", lanzada: "Lanzada", chequeo_10min: "Chequeo de los 10 min", error: "Error" };
const ESTADO_FAB = { pendiente: ["en cola", "gris"], trabajando: ["trabajando", "amarillo"], listo_revisar: ["listo para revisar", "verde-fuerte"], lanzar: ["lanzando", "acento"], lanzando: ["lanzando", "acento"], lanzado: ["lanzado", "verde"], error: ["error", "rojo"], cancelado: ["cancelado", "gris"] };
const MEZCLAS = [["70/30", "70/30 · lo de siempre", "70 % pegado a lo que ya funciona (mismo formato, hook parecido) y 30 % de prueba con hooks y ángulos nuevos."],
  ["90/10", "90/10 · conservador", "Casi todo pegado al winner. Menos riesgo, pero menos chance de encontrar algo nuevo."],
  ["50/50", "50/50 · arriesgado", "Mitad pegado al winner, mitad prueba. Más chance de otro winner, más gasto en lo que no anda."]];
const DESTINOS = [["original", "En la CBO madre del winner", "Conjunto nuevo «fecha Iteraciones y Renos» dentro de la CBO madre de donde salió el winner. Aunque lo elijas de una CostCap, BidCap o aislada, sale en la madre de donde se escaló, nunca adentro de la CostCap. Lo de siempre."],
  ["cbo_propia", "En una CBO propia", "Una campaña CBO nueva solo para esta tanda, separada de la original."]];
const destinoTx = (d) => d === "cbo_propia" ? "en una CBO propia" : "en la CBO madre del winner (conjunto nuevo)";
const PATH_FLECHA = "M9.5 5.5 C 12 8, 14 10.5, 15.5 12.2 C 13.6 14, 11.6 16.4, 9.2 18.6";
const svgFlecha = (s = 20) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path d="${PATH_FLECHA}" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const SVG_PLAY = `<svg viewBox="0 0 48 48" aria-hidden="true"><path class="pl-c" d="M24 4 C 36 4, 44 12, 44 24 C 44 36, 36 44, 24 44 C 12 44, 4 36, 4 24 C 4 13, 12 4, 26 5"/><path class="pl-t" d="M19 15 C 19 21, 19 27, 19.5 33 C 25 30, 30 27, 34 24 C 29 21, 24 18, 19 15 Z"/></svg>`;
const SVG_TILDE_C = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 17 C 10 19, 12 21, 14 23.5 C 17 18, 21 13, 25 9"/></svg>`;
const SVG_CHISPA = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 3 C 11.6 8, 13 9.6, 18.5 10.5 C 13 11.4, 11.6 13, 11 19 C 10.4 13, 9 11.4, 3.5 10.5 C 9 9.6, 10.4 8, 11 3 Z" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/><path d="M19 3 V7 M17 5 H21 M19.5 16.5 V20.5 M17.5 18.5 H21.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const SVG_COMPU_ON = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3 C 24 3, 29 9, 29 16 C 29 24, 23 29, 16 29 C 8 29, 3 23, 3 16 C 3 9, 9 3, 17 3.5"/><path d="M9.5 16.5 C 11.5 18.5, 13 20, 14.5 22 C 17.5 17, 20 13.5, 23 10"/></svg>`;
const SVG_COMPU_OFF = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 8 C 13 7.6, 19 7.7, 26 8 C 26.3 13, 26.2 17, 26 21 C 19 21.3, 13 21.2, 6 21 C 5.8 16, 5.8 12, 6 8 Z"/><path d="M3 25 C 12 24.5, 20 24.5, 29 25"/><path d="M12.5 11.5 H17 L12.5 17 H17.5"/></svg>`;
function svgTend(t) {
  if (!t) return "";
  const d = t === "sube" ? "M3 13 L12.5 3.5 M6 3.4 C 8.5 3.4, 10.5 3.3, 12.6 3.3 C 12.7 5.5, 12.7 7.6, 12.6 10" : t === "baja" ? "M3 3 L12.5 12.5 M6 12.6 C 8.5 12.6, 10.5 12.7, 12.6 12.7 C 12.7 10.5, 12.7 8.4, 12.6 6" : "M2 8 C 6 7.8, 9 7.9, 13 8 M9.5 4.5 L13 8 L9.5 11.5";
  const tx = t === "sube" ? "subiendo" : t === "baja" ? "bajando" : "parejo";
  return `<span class="tend tend-${esc(t)}" role="img" aria-label="ROAS de los últimos 3 días: ${tx}" title="ROAS de los últimos 3 días: ${tx}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="${d}"/></svg></span>`;
}
function hace(iso) {
  const t = new Date(iso).getTime(); if (!isFinite(t)) return "—";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "recién";
  const m = Math.round(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24); return `hace ${d} día${d === 1 ? "" : "s"}`;
}
const pl = (n, s, p) => `${n} ${n === 1 ? s : (p || s + "s")}`;
const claveAd = (g, a) => `${g.clave}|${a.post || a.ad_id}`;
const gruposRk = () => (RK.datos[RK.periodo]?.grupos || []).filter((g) => g.clave !== "todas");
const compuOn = () => !!RK.fab?.compu?.prendida;
function buscarRk(k) {
  for (const g of gruposRk()) for (const a of g.anuncios || []) if (claveAd(g, a) === k) return { g: { clave: g.clave, etiqueta: g.etiqueta || g.oferta || g.clave, bandera: g.bandera || "" }, a };
  return RK.sel.get(k) || null;
}
function pararRanking() { clearInterval(RK.timer); RK.timer = null; }

function montarRanking({ pedido = null } = {}) {
  cerrarMenu(); pararRanking();
  S.vista = "ranking"; ls.set("dash_seccion", "ranking");
  try { history.replaceState(null, "", location.pathname + location.search + "#ranking"); } catch {}
  if (pedido != null) { RK.panel = true; RK.abiertos.add(String(pedido)); RK.foco = String(pedido); }
  $("#main").innerHTML = `
    <section class="rk" id="rk" aria-labelledby="rk-t">
      <h2 class="sr" id="rk-t">Ranking de creativos</h2>
      <div class="rk-estado">
        <div id="rk-compu" class="compu" role="status"></div>
        <div class="hora" id="rk-hora"></div>
      </div>
      <div class="controles rk-controles">
        <div class="periodos rk-per" role="group" aria-label="Período">${botonesPer("data-rkper", RK.periodo)}</div>
        <div class="sel-grupo-caja boceto rk-salto"><label class="sr" for="rk-salto">Ir a una oferta</label><select id="rk-salto" class="sel-grupo"></select><span class="sel-flecha" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M5.5 9.5 C 8 12, 10.5 14, 12.2 15.5 C 14 13.6, 16.4 11.6, 18.6 9.2" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>
      </div>
      <div id="rk-pedidos"></div>
      <div id="rk-ofertas"></div>
    </section>`;
  $$("[data-rkper]").forEach((b) => b.onclick = () => cambiarPeriodoRk(b.dataset.rkper));
  $("#rk-salto").onchange = (e) => { const s = $(`#rk-g-${e.target.value}`); if (s) { s.scrollIntoView({ behavior: reducido() ? "auto" : "smooth", block: "start" }); const h = $("h3", s); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); } } };
  const of = $("#rk-ofertas");
  of.addEventListener("click", clickOfertas);
  of.addEventListener("scroll", (e) => { if (e.target.classList?.contains("rk-slider")) flechasSlider(e.target); }, true);
  $("#rk-pedidos").addEventListener("click", clickPedidos);
  pintarNav(); pintarRanking(); pintarCompu(); pintarPedidos(); pintarBarra();
  window.scrollTo(0, 0);
  if (!RK.datos[RK.periodo]) cargarRanking();
  cargarFabrica();
  RK.timer = setInterval(() => { if (!document.hidden && S.vista === "ranking") cargarFabrica(); }, 60000);
  // (10/10) mientras algo se está publicando: cada 15 s y un reloj que corre cada segundo
  clearInterval(RK.timerSub); RK.timerSub = setInterval(() => {
    if (document.hidden || S.vista !== "ranking") return;
    const enMeta = (RK.fab?.pedidos || []).some((p) => ["lanzar", "lanzando"].includes(p.estado) || (p.estado === "lanzado" && !chequeoDe(p)));
    if (enMeta && Date.now() - (RK.subT || 0) > 15000) { RK.subT = Date.now(); cargarFabrica(); }
    $$("[data-reloj]").forEach((el) => { el.textContent = relojTx(+el.dataset.reloj); });
  }, 1000);
}
async function cambiarPeriodoRk(p) {
  if (p === "rango") { const r = await elegirRango(RK.periodo); if (!r) return; p = r; }
  if (p === RK.periodo) return;
  RK.periodo = p; ls.set("rk_periodo", p);
  pintarRanking();
  if (!RK.datos[p]) cargarRanking();
}
async function cargarRanking(forzar = false) {
  const per = RK.periodo;
  RK.cargando = true; RK.error = null; pintarRkHora();
  if (!RK.datos[per]) pintarOfertas();
  try { RK.datos[per] = await api("ranking", { q: `&periodo=${per}${forzar ? "&forzar=1" : ""}` }); }
  catch (e) {
    if (e.code === 401) { ls.del("dash_clave"); return login("Clave incorrecta"); }
    RK.error = e.message;
    if (S.vista === "ranking") toast(`No se pudo traer el ranking: ${esc(e.message)}`, "error");
  }
  RK.cargando = false;
  if (per !== RK.periodo || S.vista !== "ranking") return;
  pintarRanking();
}
async function cargarFabrica() {
  if (RK.fabCargando) return RK.fab;
  RK.fabCargando = true;
  try { RK.fab = await api("fabrica_estado"); RK.fabErr = null; }
  catch (e) {
    if (e.code === 401) { RK.fabCargando = false; ls.del("dash_clave"); login("Clave incorrecta"); return null; }
    RK.fabErr = e.message;
  }
  RK.fabCargando = false;
  if (S.vista === "ranking") { pintarCompu(); pintarPedidos(); pintarBarra(); }
  avisarChequeos();
  return RK.fab;
}
function pintarRanking() {
  const rp = $(".rk-per"); if (rp) { rp.innerHTML = botonesPer("data-rkper", RK.periodo); $$("[data-rkper]", rp).forEach((b) => b.onclick = () => cambiarPeriodoRk(b.dataset.rkper)); }
  pintarRkHora();
  const sg = $("#rk-salto");
  if (sg) {
    const gs = gruposRk();
    sg.innerHTML = `<option value="" disabled selected>${gs.length ? "Ir a una oferta…" : "Ofertas"}</option>` + gs.map((g, i) => `<option value="${i}">${esc((g.bandera ? g.bandera + " " : "") + (g.etiqueta || g.oferta || g.clave))}</option>`).join("");
  }
  pintarOfertas();
}
function pintarRkHora() {
  const h = $("#rk-hora"); if (!h) return;
  const d = RK.datos[RK.periodo];
  h.innerHTML = d?.__offline ? `<span class="aviso">Sin conexión: datos guardados</span>`
    : d ? `<span>Ranking de las <b class="num">${hhmm(d.generado)}</b></span>` : `<span>${RK.cargando ? "Cargando…" : ""}</span>`;
  const br = $("#b-ref"); if (br) br.classList.toggle("cargando", !!RK.cargando);
}
function pintarCompu() {
  const el = $("#rk-compu"); if (!el) return;
  if (!RK.fab) {
    el.className = "compu " + (RK.fabErr ? "off" : "");
    el.innerHTML = RK.fabErr ? `<span class="compu-ico">${SVG_COMPU_OFF}</span><span class="compu-tx"><b>No sé si la compu está prendida</b><small>${esc(RK.fabErr)}</small></span>`
      : `<span class="cargador"></span><span class="compu-tx"><b>Mirando la compu…</b></span>`;
    return;
  }
  const c = RK.fab.compu || {};
  const on = !!c.prendida;
  const trab = c.info?.trabajando;
  el.className = "compu " + (on ? "on" : "off");
  el.innerHTML = `<span class="compu-ico">${on ? SVG_COMPU_ON : SVG_COMPU_OFF}</span>
    <span class="compu-tx"><b>${on ? "Compu prendida" : "Compu apagada"}</b><small>${c.visto ? `visto ${hace(c.visto)}` : "todavía no dio señales"}${on && trab ? ` · trabajando en el pedido #${esc(trab)}` : ""}${!on ? " · sin compu no se pueden empezar renovaciones" : ""}</small></span>`;
}

function pintarOfertas() {
  const cont = $("#rk-ofertas"); if (!cont) return;
  const d = RK.datos[RK.periodo];
  if (!d) {
    cont.innerHTML = RK.error ? `<div class="hint error boceto">No se pudo traer el ranking: ${esc(RK.error)} <button type="button" class="link" data-rk-reint>Reintentar</button></div>`
      : [0, 1].map(() => `<section class="rk-oferta" aria-hidden="true"><div class="rk-cab"><div class="esqueleto rk-esq-t"></div></div><div class="rk-slider">${[0, 1, 2, 3, 4].map(() => `<div class="rk-card esq"><div class="esqueleto rk-esq-th"></div><div class="esqueleto rk-esq-tx"></div></div>`).join("")}</div></section>`).join("");
    return;
  }
  const gs = gruposRk();
  if (!gs.some((g) => (g.anuncios || []).length)) { cont.innerHTML = `<div class="vacio">No hay videos con gasto en este período.</div>`; return; }
  cont.innerHTML = gs.map(ofertaHTML).join("");
  $$(".rk-slider", cont).forEach(flechasSlider);
}
function subOferta(g) {
  const xs = g.anuncios || [];
  const rec = xs.filter((a) => a.recomendado).length;
  const n = xs.filter((a) => RK.sel.has(claveAd(g, a))).length;
  return `${pl(xs.length, "video")}${rec ? ` · ${pl(rec, "recomendado")}` : ""}${n ? ` · <b>${pl(n, "elegido")}</b>` : ""}`;
}
function ofertaHTML(g, gi) {
  const xs = g.anuncios || [];
  const et = g.etiqueta || g.oferta || g.clave;
  return `<section class="rk-oferta" id="rk-g-${gi}" data-g="${esc(g.clave)}" aria-labelledby="rk-h-${gi}">
    <div class="rk-cab">
      <div class="rk-tit">${g.bandera ? `<span class="ban" aria-hidden="true">${esc(g.bandera)}</span>` : ""}<h3 id="rk-h-${gi}">${esc(et)}</h3></div>
      <small class="rk-sub" data-sub="${esc(g.clave)}">${subOferta(g)}</small>
      <span class="rk-flechas"><button type="button" class="btn chico flecha-rk izq" data-desl="-1" aria-label="Videos anteriores de ${esc(et)}">${svgFlecha(18)}</button><button type="button" class="btn chico flecha-rk" data-desl="1" aria-label="Más videos de ${esc(et)}">${svgFlecha(18)}</button></span>
    </div>
    <svg class="rk-garabato" viewBox="0 0 160 12" aria-hidden="true"><path d="M2 8 C 30 3, 52 11, 80 6 S 130 3, 158 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
    ${g.sugerencia ? `<div class="rk-sug">✦ <b>Más renovaciones que iteraciones</b> — ${esc(g.sugerencia.motivo)}</div>` : ""}
    ${g.no_renovar ? `<div class="rk-norenovar"><span class="rk-nr-ico ev-ico-chico peligro">${icoEvento("x")}</span><div><b>NO RENOVARÍA</b><span>${esc(g.no_renovar)}</span></div></div>` : ""}
    ${xs.length ? `<div class="rk-slider" role="list" aria-label="Videos de ${esc(et)}, de mejor a peor">${xs.map((a, i) => tarjetaRk(g, a, i)).join("")}</div>` : `<div class="vacio chico">Sin videos con gasto en este período.</div>`}
  </section>`;
}
function tarjetaRk(g, a, i) {
  const k = claveAd(g, a);
  const sel = RK.sel.has(k);
  const camps = a.campanas || [];
  const campTx = camps.length > 1
    ? `<details class="rk-camps"><summary>en ${camps.length} campañas</summary><ul>${camps.map((c) => `<li>${esc(c.nombre || c.id)}</li>`).join("")}</ul></details>`
    : camps.length ? `<div class="rk-camp" title="${esc(camps[0].nombre || camps[0].id)}">en ${esc(camps[0].nombre || camps[0].id)}</div>` : "";
  const cpa = a.cpa !== undefined ? a.cpa : (a.ventas ? a.gasto / a.ventas : null);
  return `<article class="rk-card${sel ? " sel" : ""}${i < 3 ? " top" + (i + 1) : ""}" role="listitem" data-k="${esc(k)}">
    <button type="button" class="rk-selbtn" data-selk="${esc(k)}" aria-pressed="${sel}" aria-label="Elegir para renovar: puesto ${i + 1}, ${esc(a.nombre)}"></button>
    <div class="rk-thumb">
      ${a.thumb ? `<img src="${esc(a.thumb)}" alt="" loading="lazy" decoding="async">` : `<div class="rk-sinthumb">sin miniatura</div>`}
      <span class="rk-pos num">#${i + 1}</span>
      <span class="rk-sellos">${a.winner ? `<span class="sello winner">WINNER</span>` : ""}${a.recomendado ? `<span class="sello rec">RECOMENDADO</span>` : ""}</span>
      <button type="button" class="rk-play" data-play="${esc(k)}" aria-label="Ver el video ${esc(a.nombre)}">${SVG_PLAY}</button>
      <span class="rk-tilde" aria-hidden="true">${SVG_TILDE_C}</span>
    </div>
    <div class="rk-info">
      <div class="rk-nom" title="${esc(a.nombre)}">${esc(a.nombre)}</div>
      ${campTx}
      ${a.cuenta ? `<div class="rk-cuenta">${esc(a.cuenta)}</div>` : ""}
      <dl class="rk-mets">
        <div><dt>Ventas</dt><dd class="num">${entN(a.ventas)}</dd></div>
        <div><dt>Gasto</dt><dd class="num">${usdG(a.gasto)}</dd></div>
        <div><dt>ROAS</dt><dd class="rk-roas">${chipRoas(a.roas)}${svgTend(a.tendencia)}</dd></div>
        <div><dt>CPA</dt><dd class="num">${usdG(cpa)}</dd></div>
      </dl>
      ${a.motivo ? `<p class="rk-motivo">${esc(a.motivo)}</p>` : ""}
    </div>
  </article>`;
}
function flechasSlider(sl) {
  const sec = sl.closest(".rk-oferta"); if (!sec) return;
  const [p, n] = $$("[data-desl]", sec);
  if (!p) return;
  const max = sl.scrollWidth - sl.clientWidth;
  p.disabled = sl.scrollLeft <= 4;
  n.disabled = sl.scrollLeft >= max - 4;
  $(".rk-flechas", sec).classList.toggle("nada", max <= 4);
}
function sincronizarSel() {
  $$(".rk-card[data-k]").forEach((c) => {
    const s = RK.sel.has(c.dataset.k);
    c.classList.toggle("sel", s);
    const b = $(".rk-selbtn", c); if (b) b.setAttribute("aria-pressed", s);
  });
  for (const g of gruposRk()) { const e = $(`[data-sub="${CSS.escape(g.clave)}"]`); if (e) e.innerHTML = subOferta(g); }
  pintarBarra();
}
function clickOfertas(e) {
  const t = e.target;
  if (t.closest("[data-rk-reint]")) return cargarRanking(true);
  const pl_ = t.closest("[data-play]"); if (pl_) return verVideo(pl_.dataset.play);
  const ds = t.closest("[data-desl]");
  if (ds) { const sl = $(".rk-slider", ds.closest(".rk-oferta")); if (sl) sl.scrollBy({ left: +ds.dataset.desl * Math.max(180, sl.clientWidth * 0.85), behavior: reducido() ? "auto" : "smooth" }); return; }
  const sb = t.closest("[data-selk]");
  if (sb) {
    const k = sb.dataset.selk;
    if (RK.sel.has(k)) RK.sel.delete(k); else { const it = buscarRk(k); if (it) RK.sel.set(k, it); }
    sincronizarSel();
  }
}
function recomendar() {
  if (!RK.datos[RK.periodo]) return toast("Esperá que cargue el ranking.", "error");
  let n = 0; const ofs = new Set();
  for (const g of gruposRk()) for (const a of g.anuncios || []) {
    if (!a.recomendado) continue;
    const k = claveAd(g, a); n++; ofs.add(g.clave);
    if (!RK.sel.has(k)) RK.sel.set(k, buscarRk(k));
  }
  sincronizarSel();
  // (10/10) las ofertas que no renovaría, con el porqué, en un pop-up
  const no = gruposRk().filter((g) => g.no_renovar);
  if (!no.length) { if (!n) return toast("No hay nada para recomendar en los últimos 3 días.", "error", 7000); return toast(`Te marqué ${pl(n, "creativo")} de ${pl(ofs.size, "oferta")}. Tocá un video para sacarlo o sumar otro.`); }
  const m = abrirModal(`<div class="ev-cab"><span class="ev-ico ${n ? "ok" : "peligro"}">${icoEvento(n ? "tilde" : "x")}</span></div>
    <h3>${n ? `Te marqué ${pl(n, "creativo")} de ${pl(ofs.size, "oferta")}` : "No marqué nada"}</h3>
    <p class="mut">Winners de los últimos 3 días (los más masivos, hasta 3 por oferta) o, si no hay, los mejores de los conjuntos que dejan ganancia.</p>
    <ul class="rk-nr-lista">${no.map((g) => `<li><span class="rk-nr-ico ev-ico-chico peligro">${icoEvento("x")}</span><div><b>NO RENOVARÍA ${esc((g.bandera ? g.bandera + " " : "") + (g.etiqueta || g.oferta))}</b><span>${esc(g.no_renovar)}</span></div></li>`).join("")}</ul>
    <div class="botones"><button type="button" class="btn pri" data-ok>Entendido</button></div>`, { ancho: true });
  $("[data-ok]", m.dlg).onclick = m.cerrar;
}
function pintarBarraRanking() {
  const b = $("#barra");
  const its = [...RK.sel.values()];
  const n = its.length;
  const ofs = new Set(its.map((x) => x.g.clave)).size;
  const on = compuOn();
  const motivo = !n ? "Elegí al menos un video" : !RK.fab ? (RK.fabErr ? "No sé si la compu está prendida" : "Mirando si la compu está prendida…") : !on ? "La compu está apagada" : `${pl(n, "video")} de ${pl(ofs, "oferta")}`;
  const ok = n && on;
  const yaVisible = !b.hidden && b.classList.contains("rk-barra");
  b.hidden = false;
  b.className = "barra boceto rk-barra";
  if (yaVisible) b.style.animation = "none"; else b.style.animation = "";
  b.innerHTML = `
    <button type="button" class="btn chico rk-rec" id="rk-recomendar">${SVG_CHISPA}Recomendar</button>
    <div class="cuenta"><span class="num">${n}</span> seleccionado${n === 1 ? "" : "s"}<small>${n ? `de ${pl(ofs, "oferta")}` : "tocá un video para elegirlo"}</small></div>
    ${n ? `<button type="button" class="btn chico rk-limpiar" id="rk-limpiar" aria-label="Limpiar la selección">✕ limpiar</button>` : ""}
    <span class="sp"></span>
    <div class="rk-go"><button type="button" class="btn pri" id="rk-empezar" ${ok ? "" : "disabled"} aria-describedby="rk-motivo">Empezar renovaciones</button><small id="rk-motivo" class="${n && !on && RK.fab ? "mal" : ""}">${esc(motivo)}</small></div>`;
  $("#rk-recomendar").onclick = recomendar;
  const l = $("#rk-limpiar"); if (l) l.onclick = () => { RK.sel.clear(); sincronizarSel(); $("#rk-recomendar").focus(); };
  $("#rk-empezar").onclick = quizRenos;
}

// --- video ---
async function verVideo(k) {
  const it = buscarRk(k); if (!it) return;
  const a = it.a;
  const m = abrirModal(`<h3 class="rk-v-tit">${esc(a.nombre)}</h3>
    <p class="mut">${it.g.bandera ? esc(it.g.bandera) + " " : ""}${esc(it.g.etiqueta)} · ${entN(a.ventas)} ventas · ROAS ${roasTx(a.roas)} · gasto ${usd(a.gasto)}</p>
    <div class="rk-video" id="rk-video">${a.thumb ? `<img src="${esc(a.thumb)}" alt="">` : ""}<div class="rk-v-msg"><span class="cargador"></span>Buscando el video en Meta…</div></div>
    ${a.motivo ? `<p class="rk-v-motivo">${esc(a.motivo)}</p>` : ""}
    <div class="botones"><button type="button" class="btn" data-elegir>${RK.sel.has(k) ? "Sacar de la selección" : "Elegir para renovar"}</button><button type="button" class="btn pri" data-x data-foco>Cerrar</button></div>`);
  m.dlg.classList.add("dialogo-video");
  $("[data-x]", m.dlg).onclick = m.cerrar;
  $("[data-elegir]", m.dlg).onclick = () => { if (RK.sel.has(k)) RK.sel.delete(k); else RK.sel.set(k, it); sincronizarSel(); m.cerrar(); };
  const box = $("#rk-video", m.dlg);
  const fallo = (msg) => { if (modalActual !== m) return; box.innerHTML = `${a.thumb ? `<img src="${esc(a.thumb)}" alt="Miniatura de ${esc(a.nombre)}">` : ""}<div class="rk-v-msg mal">No se pudo cargar el video: ${esc(msg)}</div>`; };
  try {
    const r = await api("video", { q: `&ad=${encodeURIComponent(a.ad_id || "")}&act=${encodeURIComponent(a.act || "")}` });
    if (modalActual !== m) return;
    if (!r?.src) return fallo(r?.error || "Meta no devolvió el video");
    box.innerHTML = `<video controls playsinline autoplay preload="metadata" ${r.poster || a.thumb ? `poster="${esc(r.poster || a.thumb)}"` : ""} src="${esc(r.src)}"></video>`;
    const v = $("video", box);
    v.addEventListener("error", () => fallo("el navegador no lo pudo reproducir"));
    try { const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); } catch {}
  } catch (e) {
    if (e.code === 401) { m.cerrar(); ls.del("dash_clave"); return login("Clave incorrecta"); }
    fallo(e.message);
  }
}

// --- quiz «Empezar renovaciones» ---
function ofertasSeleccionadas() {
  const map = new Map();
  for (const [k, it] of RK.sel) {
    const fresco = buscarRk(k) || it;
    if (!map.has(fresco.g.clave)) map.set(fresco.g.clave, { ...fresco.g, items: [] });
    map.get(fresco.g.clave).items.push(fresco.a);
  }
  // mismo orden que en pantalla
  const orden = gruposRk().map((g) => g.clave);
  return [...map.values()].sort((x, y) => (orden.indexOf(x.clave) + 1 || 999) - (orden.indexOf(y.clave) + 1 || 999));
}
function armarParams(P, ofertas) {
  return { iteraciones: P.iteraciones, renovaciones: P.renovaciones, mezcla: P.mezcla, destino: P.destino,
    ofertas: ofertas.map((o) => ({ grupo: o.clave, etiqueta: o.etiqueta, bandera: o.bandera || "", ...(o.sugerencia ? { sugerencia: o.sugerencia } : {}),
      posts: o.items.map((a) => ({ post: a.post || null, ad_id: a.ad_id || null, act: a.act || null, campaign_id: (a.campanas || [])[0]?.id || null, nombre: a.nombre, ventas: a.ventas ?? 0, roas: a.roas ?? null, gasto: a.gasto ?? 0 })) })) };
}
function quizRenos() {
  if (!RK.sel.size) return;
  if (!compuOn()) return toast("La compu está apagada: prendela (o abrí la fábrica) y volvé a tocar.", "error", 7000);
  const ofertas = ofertasSeleccionadas();
  const P = { iteraciones: 5, renovaciones: 5, mezcla: "70/30", destino: "original", cant: "5-5" };
  let enviando = false;
  const m = abrirModal("", { ancho: true, bloqueado: () => enviando });
  const PASOS = ["Cuántos", "Mezcla", "Dónde", "Resumen"];
  const cab = (n, t) => `<h3>${t}</h3><ol class="pasos-w" aria-label="Pasos">${PASOS.map((x, i) => `<li ${i + 1 === n ? 'aria-current="step"' : ""} class="${i + 1 < n ? "hecho" : ""}">${i + 1}. ${x}</li>`).join("")}</ol>`;
  const op = (attr, val, actual, titulo, tx, tag = "") => `<button type="button" class="opcion" ${attr}="${esc(val)}" aria-pressed="${val === actual}"${val === actual ? " data-foco" : ""}><b>${titulo}${tag ? ` <span class="op-tag">${tag}</span>` : ""}</b><span>${tx}</span></button>`;
  const p1 = () => {
    m.set(`${cab(1, "¿Cuántos videos por oferta?")}
      <p class="mut">Vale para cada una de las ${pl(ofertas.length, "oferta")} que elegiste.</p>
      <div class="opciones">
        ${op("data-cant", "5-5", P.cant, "5 iteraciones + 5 renovaciones", "Iteraciones: el mismo video del winner con otro hook o arranque. Renovaciones: videos nuevos con el ángulo que funciona.", "lo de siempre")}
        ${op("data-cant", "10-0", P.cant, "10 iteraciones", "Solo variaciones de los videos elegidos.")}
        ${op("data-cant", "0-10", P.cant, "10 renovaciones", "Solo videos nuevos sobre los ángulos que venden.")}
        ${op("data-cant", "mano", P.cant, "A mano", "Elegís cuántas iteraciones y cuántas renovaciones.")}
      </div>
      <div class="rk-mano" ${P.cant === "mano" ? "" : "hidden"}>
        <label>Iteraciones<input class="campo num" id="q-it" inputmode="numeric" value="${P.iteraciones}"></label>
        <label>Renovaciones<input class="campo num" id="q-ren" inputmode="numeric" value="${P.renovaciones}"></label>
        <button type="button" class="btn pri" data-mano-ok>Seguir</button>
        <div class="mut rk-mano-err" role="alert"></div>
      </div>
      <div class="botones"><button type="button" class="btn" data-x>Cancelar</button></div>`);
    $("[data-x]", m.dlg).onclick = m.cerrar;
    $$("[data-cant]", m.dlg).forEach((b) => b.onclick = () => {
      const v = b.dataset.cant; P.cant = v;
      if (v === "mano") { $$("[data-cant]", m.dlg).forEach((x) => x.setAttribute("aria-pressed", x === b)); const mn = $(".rk-mano", m.dlg); mn.hidden = false; mn.scrollIntoView({ block: "nearest", behavior: reducido() ? "auto" : "smooth" }); $("#q-it", m.dlg).focus({ preventScroll: true }); return; }
      const [i, r] = v.split("-").map(Number); P.iteraciones = i; P.renovaciones = r; p2();
    });
    $("[data-mano-ok]", m.dlg).onclick = () => {
      const i = Number($("#q-it", m.dlg).value.trim()), r = Number($("#q-ren", m.dlg).value.trim());
      const err = $(".rk-mano-err", m.dlg);
      if (![i, r].every((x) => Number.isInteger(x) && x >= 0 && x <= 30)) { err.textContent = "Poné números enteros entre 0 y 30."; return; }
      if (i + r < 1) { err.textContent = "Tiene que haber al menos un video."; return; }
      P.iteraciones = i; P.renovaciones = r; p2();
    };
  };
  const p2 = () => {
    m.set(`${cab(2, "¿Qué mezcla?")}
      <p class="mut">Cuánto se pega a lo que ya funciona y cuánto se arriesga.</p>
      <div class="opciones">${MEZCLAS.map(([k, t, tx]) => op("data-mez", k, P.mezcla, t, tx)).join("")}</div>
      <div class="botones"><button type="button" class="btn" data-v>Volver</button></div>`);
    $("[data-v]", m.dlg).onclick = p1;
    $$("[data-mez]", m.dlg).forEach((b) => b.onclick = () => { P.mezcla = b.dataset.mez; p3(); });
  };
  const p3 = () => {
    m.set(`${cab(3, "¿Dónde salen?")}
      <div class="opciones">${DESTINOS.map(([k, t, tx]) => op("data-dest", k, P.destino, t, tx, k === "original" ? "lo de siempre" : "")).join("")}</div>
      <div class="botones"><button type="button" class="btn" data-v>Volver</button></div>`);
    $("[data-v]", m.dlg).onclick = p2;
    $$("[data-dest]", m.dlg).forEach((b) => b.onclick = () => { P.destino = b.dataset.dest; p4(); });
  };
  const p4 = () => {
    const porOf = P.iteraciones + P.renovaciones;
    const total = porOf * ofertas.length;
    const cant = [P.iteraciones ? pl(P.iteraciones, "iteración", "iteraciones") : "", P.renovaciones ? pl(P.renovaciones, "renovación", "renovaciones") : ""].filter(Boolean).join(" + ");
    m.set(`${cab(4, "Resumen")}
      <div class="rk-res-params"><span class="chip">${esc(cant)} por oferta</span><span class="chip">mezcla ${esc(P.mezcla)}</span><span class="chip">${esc(destinoTx(P.destino))}</span></div>
      <ul class="rk-res">${ofertas.map((o) => `<li>
        <div class="rk-res-cab">${o.bandera ? `<span class="ban" aria-hidden="true">${esc(o.bandera)}</span>` : ""}<b>${esc(o.etiqueta)}</b><small class="num">${pl(o.items.length, "creativo")} → ${o.sugerencia ? `${o.sugerencia.iteraciones} IT + ${o.sugerencia.renovaciones} RE` : pl(porOf, "video")}</small></div>
        ${o.sugerencia ? `<div class="rk-sug">✦ ${esc(o.sugerencia.motivo)}</div>` : ""}
        <div class="rk-minis">${o.items.map((a) => `<span class="rk-mini" title="${esc(a.nombre)}">${a.thumb ? `<img src="${esc(a.thumb)}" alt="">` : ""}<span class="sr">${esc(a.nombre)}</span></span>`).join("")}</div>
      </li>`).join("")}</ul>
      <p class="rk-res-total"><b class="num">${pl(total, "video nuevo", "videos nuevos")}</b> en total. La compu arma guiones, iteraciones y renovaciones, los sube a Drive y te manda un aviso por cada etapa. <b>Nada se publica en Meta</b> hasta que revises y toques «Publicar».</p>
      ${DEMO ? `<p class="mut">Demo: el pedido se simula, no va a ninguna compu.</p>` : dryOn() ? `<p class="mut"><b>Modo prueba:</b> no se manda nada; te muestro lo que se mandaría.</p>` : ""}
      <div class="err-box" id="q-err" role="alert" hidden></div>
      <div class="botones"><button type="button" class="btn" data-v>Volver</button><button type="button" class="btn pri" data-ok data-foco>Empezar</button></div>`);
    $("[data-v]", m.dlg).onclick = p3;
    $("[data-ok]", m.dlg).onclick = (ev) => enviar(ev.currentTarget);
  };
  const enviar = async (b) => {
    const params = armarParams(P, ofertas);
    if (dryOn() && !DEMO) {
      m.set(`<h3>Modo prueba: no se mandó nada</h3><p class="mut">Esto es lo que recibiría la compu (fabrica_pedido):</p><pre class="rk-pre">${esc(JSON.stringify(params, null, 2))}</pre><div class="botones"><button type="button" class="btn pri" data-x data-foco>Listo</button></div>`);
      $("[data-x]", m.dlg).onclick = m.cerrar;
      return;
    }
    enviando = true; b.classList.add("cargando"); b.innerHTML = `<span class="gira">↻</span> Mandando…`;
    $("[data-v]", m.dlg).disabled = true;
    let r;
    try { r = await api("fabrica_pedido", { body: params }); }
    catch (e) {
      enviando = false;
      if (e.code === 401) { m.cerrar(); ls.del("dash_clave"); return login("Clave incorrecta"); }
      b.classList.remove("cargando"); b.textContent = "Reintentar"; $("[data-v]", m.dlg).disabled = false;
      const box = $("#q-err", m.dlg); box.hidden = false;
      box.textContent = e.code === 409 ? "La compu está apagada: el pedido no se mandó. Prendela y volvé a tocar." : `No se mandó: ${e.message}`;
      if (e.code === 409) { b.disabled = true; cargarFabrica(); }
      return;
    }
    enviando = false;
    const id = r?.id != null ? String(r.id) : null;
    RK.sel.clear(); sincronizarSel();
    if (id) { RK.panel = true; ls.set("rk_panel", "1"); RK.abiertos.add(id); RK.foco = id; }
    // (10/10, Lorenzo) antes de arrancar, la compu estima los créditos con lo que costaron las últimas tandas.
    // Si alcanzan, arranca sin decir nada; si no, cartel «Te faltan créditos» y no arranca.
    if (id) {
      m.set(`<div class="rk-ok">${icoEvento("cola")}<h3>Revisando los créditos…</h3><p class="mut">La compu calcula cuánto va a gastar esta tanda (con lo que costaron las anteriores) y mira el saldo de cada app. Tarda hasta un minuto.</p></div>`);
      m.dlg.classList.add("dialogo-ev");
      let ped = null;
      for (let i = 0; i < 30; i++) {
        await new Promise((ok) => setTimeout(ok, 5000));
        if (!modalActual || modalActual.dlg !== m.dlg) break;
        try { const f = await api("fabrica_estado"); RK.fab = f; ped = (f.pedidos || []).find((x) => String(x.id) === id); } catch { /* reintenta */ }
        if (ped && ped.estado !== "pendiente") break;
      }
      if (ped && ped.estado === "error") {
        const ult = (ped.progreso || []).slice(-1)[0];
        const det = String(ult?.texto || ped.error || "").replace(/^No arranqué: te faltan créditos para hacer todas las renovaciones\.\s*/, "").replace(/^Pedido rechazado por la compu:\s*/, "Motivo: ");
        const falta = (ped.error || "") === "falta saldo"; // solo el chequeo de créditos usa este código; lo demás muestra su motivo real
        m.set(`<div class="rk-ok">${icoEvento("x")}<h3>${falta ? "Te faltan créditos para hacer todas las renovaciones" : "La compu no pudo arrancar"}</h3>
          <ul class="rk-nr-lista">${det.split(/;\s*/).filter(Boolean).map((t) => `<li><span class="rk-nr-ico ev-ico-chico peligro">${icoEvento("x")}</span><div><span>${esc(t)}</span></div></li>`).join("")}</ul>
          <p class="mut">${falta ? "No arranqué nada. Cargá crédito y volvé a tocar «Empezar renovaciones»." : "No arranqué nada. No es un problema de créditos: corregí eso y volvé a tocar «Empezar renovaciones»."}</p></div>
          <div class="botones"><button type="button" class="btn pri" data-x data-foco>Entendido</button></div>`);
        $("[data-x]", m.dlg).onclick = m.cerrar; cargarFabrica(); return;
      }
    }
    m.set(`<div class="rk-ok">${icoEvento("tilde")}<h3>${id ? `Pedido #${esc(id)} en camino` : "Pedido mandado"}</h3>
      <p>La compu ya lo tiene. Te va a llegar <b>un aviso al celular por cada etapa</b> (guiones, iteraciones y renovaciones de cada oferta) y uno al final cuando esté todo para revisar.</p></div>
      <div class="botones"><button type="button" class="btn pri" data-x data-foco>Ver el pedido</button></div>`);
    m.dlg.classList.add("dialogo-ev");
    $("[data-x]", m.dlg).onclick = () => { m.cerrar(); if (id) abrirPedido(id); };
    toast(`${id ? `Pedido #${esc(id)}` : "Pedido"} mandado a la compu. Te aviso por cada etapa.`);
    cargarFabrica();
  };
  p1();
}

// --- pedidos ---
const pedidoPorId = (id) => (RK.fab?.pedidos || []).find((p) => String(p.id) === String(id));
function etapasHechas(p) {
  const hechas = new Set((p.progreso || []).map((x) => x.etapa));
  const orden = ETAPAS_FAB.map(([k]) => k);
  const hasta = (k) => orden.slice(0, orden.indexOf(k) + 1).forEach((x) => hechas.add(x));
  if (p.estado === "listo_revisar" || p.estado === "lanzar" || p.estado === "lanzando") hasta("lista");
  if (p.estado === "lanzado") hasta("lanzada");
  if (hechas.has("lanzando") || hechas.has("chequeo_10min")) hasta(hechas.has("chequeo_10min") ? "lanzada" : "lista");
  return hechas;
}
function pintarPedidos() {
  const el = $("#rk-pedidos"); if (!el) return;
  const ps = RK.fab?.pedidos || [];
  if (!ps.length) { el.innerHTML = ""; return; }
  const activos = ps.filter((p) => ["pendiente", "trabajando", "lanzar", "lanzando"].includes(p.estado)).length;
  const listos = ps.filter((p) => p.estado === "listo_revisar").length;
  const ult = ps[0];
  const res = [activos ? `${activos} en marcha` : "", RK.panel || !ult ? pl(ps.length, "pedido") : `último #${ult.id}: ${(ESTADO_FAB[ult.estado] || [ult.estado])[0]}`].filter(Boolean).join(" · ");
  el.innerHTML = `<div class="rk-ped boceto">
    <button type="button" class="rk-ped-tg" id="rk-ped-tg" aria-expanded="${RK.panel}" aria-controls="rk-ped-lista">
      <span class="rk-ped-t">Pedidos</span><span class="rk-ped-res">${res}</span>${listos ? `<span class="fchip verde-fuerte">${listos} para revisar</span>` : ""}
      <span class="rk-ped-fl" aria-hidden="true">${svgFlecha(18)}</span>
    </button>
    <div class="rk-ped-lista" id="rk-ped-lista" ${RK.panel ? "" : "hidden"}>${ps.map(pedidoHTML).join("")}</div>
  </div>`;
  if (RK.foco && RK.panel) {
    const f = RK.foco; RK.foco = null;
    const c = $(`#ped-${CSS.escape(f)}`);
    if (c) { requestAnimationFrame(() => { c.scrollIntoView({ behavior: reducido() ? "auto" : "smooth", block: "start" }); c.classList.add("destello"); setTimeout(() => c.classList.remove("destello"), 2400); }); }
  }
}
// (10/10, Lorenzo) Subida a Meta: una barra por oferta, ✓ y ↗ a Ads Manager al terminar, reloj de 10 min y cartel final.
const amLink = (act, ids) => `https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${encodeURIComponent(act)}&filter_set=${encodeURIComponent("SEARCH_BY_CAMPAIGN_IDS-STRING_SET\u001eANY\u001e" + JSON.stringify(ids))}`;
const chequeoDe = (p) => (p.progreso || []).filter((x) => x.etapa === "chequeo_10min").slice(-1)[0] || null;
const lanzadaDe = (p) => (p.progreso || []).filter((x) => x.etapa === "lanzada").slice(-1)[0] || null;
const relojTx = (hasta) => { const ms = hasta - Date.now(); if (ms <= 0) return "revisando…"; const m = Math.floor(ms / 60000), s2 = Math.floor(ms / 1000) % 60; return `${m}:${String(s2).padStart(2, "0")}`; };
const FLECHA_AM = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 17 C 10 14, 13 11, 16.5 7.5 M9 7.2 C 11.5 7, 14 7, 16.8 7.2 C 17 10, 17 12.5, 16.8 15" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function subidaHTML(p) {
  const sb = p.subida; const pr = p.params || {};
  const ofs = pr.ofertas || [];
  const filas = ofs.map((o) => { const x = sb?.ofertas?.[o.etiqueta] || {}; const sg = o.sugerencia || {};
    const total = x.total || (+(sg.iteraciones ?? pr.iteraciones ?? 5) + +(sg.renovaciones ?? pr.renovaciones ?? 5)); return { o, x, total, n: Math.min(x.subidos || 0, total) }; });
  const T = filas.reduce((a, f) => a + f.total, 0), N = filas.reduce((a, f) => a + f.n, 0);
  const ids = sb?.adsets || [], act = sb?.act || "1950162628858779";
  const lz = lanzadaDe(p), ch = chequeoDe(p);
  const reloj = lz && !ch ? `<div class="sub-reloj">⏱ Chequeo de los 10 minutos en <b class="num" data-reloj="${Date.parse(lz.t) + 600000}">${relojTx(Date.parse(lz.t) + 600000)}</b></div>`
    : ch ? `<div class="sub-reloj ${/problem|error|rechaz|issue|mal/i.test(ch.texto || "") ? "mal" : "ok"}">${/problem|error|rechaz|issue|mal/i.test(ch.texto || "") ? "⚠" : "✅"} ${esc(ch.texto || "Chequeo de los 10 minutos hecho")}</div>` : "";
  return `<div class="sub">
    <div class="pack-bar"><div class="pack-fill azul" style="width:${T ? Math.round(100 * N / T) : 0}%"></div></div>
    <div class="pack-num"><b class="num">${N} / ${T}</b> anuncios en Meta · ${filas.filter((f) => f.n >= f.total).length} de ${filas.length} ofertas subidas</div>
    ${reloj}
    <ul class="pack-ofs sub-ofs">${filas.map((f) => { const ok = f.n >= f.total && f.total;
      return `<li class="${ok ? "lista" : ""}"><span class="pk-of">${f.o.bandera ? esc(f.o.bandera) + " " : ""}${esc(f.o.etiqueta)}${f.x.campana ? `<small class="mut"> · ${esc(f.x.campana)}</small>` : ""}</span>
        <span class="sub-der"><span class="sub-bar"><span style="width:${f.total ? Math.round(100 * f.n / f.total) : 0}%"></span></span><span class="num sub-n">${f.n}/${f.total}</span>
        ${ok && f.x.adset_id ? `<a class="sub-ir" href="${esc(amLink(f.x.act || act, [f.x.adset_id]))}" target="_blank" rel="noopener" aria-label="Ver ${esc(f.o.etiqueta)} en el Administrador de anuncios">✓ ${FLECHA_AM}</a>` : ok ? `<span class="sub-ir">✓</span>` : ""}</span></li>`; }).join("")}</ul>
    ${ids.length ? `<a class="btn chico pri sub-todos" href="${esc(amLink(act, ids))}" target="_blank" rel="noopener">Ver los ${ids.length} conjuntos nuevos en Ads Manager ${FLECHA_AM}</a>` : ""}
  </div>`;
}
function avisarChequeos() {
  let vistos = []; try { vistos = JSON.parse(ls.get("chequeos_vistos", "[]")) || []; } catch {}
  for (const p of RK.fab?.pedidos || []) {
    const ch = chequeoDe(p); if (!ch) continue;
    const k = `${p.id}|${ch.t}`; if (vistos.includes(k)) continue;
    vistos.push(k); ls.set("chequeos_vistos", JSON.stringify(vistos.slice(-30)));
    if (Date.now() - Date.parse(ch.t) > 6 * 3600e3 || modalActual) continue;
    const mal = /problem|error|rechaz|issue|mal/i.test(ch.texto || "");
    const ids = p.subida?.adsets || [], act = p.subida?.act || "1950162628858779";
    const m = abrirModal(`<div class="rk-ok">${icoEvento(mal ? "triangulo" : "fiesta")}<h3>${mal ? "Hay algo para revisar en Meta" : "¡Salió todo bien! Está todo en orden"}</h3>
      <p>${esc(ch.texto || "")}</p></div>
      <div class="botones">${ids.length ? `<a class="btn pri" href="${esc(amLink(act, ids))}" target="_blank" rel="noopener">Ver en Ads Manager ↗</a>` : ""}<button type="button" class="btn" data-x data-foco>Listo</button></div>`);
    m.dlg.classList.add("dialogo-ev"); $("[data-x]", m.dlg).onclick = m.cerrar;
    break;
  }
}
// (10/10, Lorenzo) El pedido es UN pack: barra con el total de creativos hechos y una fila por oferta.
const HECHO_RE = /empez|arranc|planead|render de|leyendo|diseñando|armando/i;
function packDe(p) {
  const pr = p.params || {}, ofs = pr.ofertas || [], prog = p.progreso || [];
  const fin = ["listo_revisar", "lanzar", "lanzando", "lanzado"].includes(p.estado);
  let total = 0, hechos = 0, listas = 0;
  const filas = ofs.map((o) => {
    const sg = o.sugerencia || {}; const nIT = +(sg.iteraciones ?? pr.iteraciones ?? 5), nRE = +(sg.renovaciones ?? pr.renovaciones ?? 5);
    const de = prog.filter((x) => x.oferta === o.etiqueta);
    const ok = (et) => fin || de.some((x) => x.etapa === et && !HECHO_RE.test(x.texto || ""));
    const drive = ok("drive"), err = !drive && de.some((x) => x.etapa === "error") && !de.some((x) => x.etapa !== "error" && Date.parse(x.t) > Date.parse(de.filter((y) => y.etapa === "error").slice(-1)[0].t));
    const it = drive || ok("iteraciones"), re = drive || ok("renovaciones"), gu = it || re || ok("guiones");
    total += nIT + nRE; hechos += (it ? nIT : 0) + (re ? nRE : 0); if (drive) listas++;
    return { o, nIT, nRE, gu, it, re, drive, err };
  });
  return { filas, total, hechos: fin ? total : hechos, listas: fin ? ofs.length : listas, fin };
}
function pedidoHTML(p) {
  const id = String(p.id);
  const ab = RK.abiertos.has(id);
  const [tx, col] = ESTADO_FAB[p.estado] || [p.estado, "gris"];
  const ofs = p.params?.ofertas || [];
  const nVid = ((+p.params?.iteraciones || 0) + (+p.params?.renovaciones || 0)) * ofs.length;
  const prog = p.progreso || [];
  const ult = prog[prog.length - 1];
  const hechas = etapasHechas(p);
  return `<article class="ped ped-${esc(p.estado)}${ab ? " abierto" : ""}" id="ped-${esc(id)}">
    <button type="button" class="ped-cab" data-pedtg="${esc(id)}" aria-expanded="${ab}">
      <span class="ped-id num">#${esc(id)}</span>
      <span class="ped-txt"><b>${ofs.map((o) => `${o.bandera ? esc(o.bandera) + " " : ""}${esc(o.etiqueta || o.grupo)}`).join(" · ") || "—"}</b>
        <small>${nVid ? pl(nVid, "video") + " · " : ""}${hace(p.creado)}${ult?.texto ? ` · ${esc(ult.texto)}` : ""}</small></span>
      <span class="fchip ${col}">${p.estado === "trabajando" || p.estado === "lanzando" ? `<span class="cargador mini" aria-hidden="true"></span>` : ""}${esc(tx)}</span>
    </button>
    ${p.estado !== "cancelado" && p.estado !== "error" ? (() => { const k = packDe(p); const pct = k.total ? Math.round(100 * k.hechos / k.total) : 0;
      return `<div class="pack-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${k.total}" aria-valuenow="${k.hechos}" aria-label="Creativos hechos">
        <div class="pack-fill" style="width:${pct}%"></div></div>
        <div class="pack-num"><b class="num">${k.hechos} / ${k.total}</b> creativos · ${k.listas} de ${k.filas.length} ofertas listas${["lanzando", "lanzado"].includes(p.estado) ? "" : k.fin ? " · <b>¡Todo listo para revisar!</b>" : ""}</div>`; })() : ""}
    ${ab ? detallePedido(p) : ""}
  </article>`;
}
function detallePedido(p) {
  const id = String(p.id);
  const pr = p.params || {};
  const prog = p.progreso || [];
  const cancelable = ["pendiente", "trabajando", "listo_revisar", "lanzar"].includes(p.estado);
  const eliminable = p.estado !== "lanzando";
  return `<div class="ped-det">
    ${p.error ? `<div class="err-box">${esc(p.error)}</div>` : ""}
    <div class="ped-params">${pl(+pr.iteraciones || 0, "iteración", "iteraciones")} + ${pl(+pr.renovaciones || 0, "renovación", "renovaciones")} por oferta · mezcla ${esc(pr.mezcla || "70/30")} · ${esc(destinoTx(pr.destino))}${p.quien ? ` · pidió ${esc(p.quien)}` : ""}</div>
    ${["lanzar", "lanzando", "lanzado"].includes(p.estado) ? subidaHTML(p) : ""}
    ${["lanzar", "lanzando", "lanzado"].includes(p.estado) ? "" : (() => { const k = packDe(p); if (!k.filas.length) return "";
      const chip = (ok, t) => `<span class="pk ${ok ? "ok" : ""}">${ok ? "✓" : "·"} ${t}</span>`;
      return `<ul class="pack-ofs">${k.filas.map((f) => `<li class="${f.drive ? "lista" : f.err ? "mal" : ""}"><span class="pk-of">${f.o.bandera ? esc(f.o.bandera) + " " : ""}${esc(f.o.etiqueta || f.o.grupo)}</span>
        <span class="pk-chips">${f.err ? `<span class="pk mal">✕ con error</span>` : chip(f.gu, "Guiones") + chip(f.it, `${f.nIT} IT`) + chip(f.re, `${f.nRE} RE`) + chip(f.drive, "Drive")}</span></li>`).join("")}</ul>`; })()}
    ${prog.length ? `<details class="ped-detalle"><summary>Ver el paso a paso</summary><ol class="ped-tl">${prog.map((x) => `<li class="tl-${esc(x.etapa)}"><span class="ped-h num">${esc(hhmm(x.t))}</span><div><b>${esc(ETAPA_TX[x.etapa] || x.etapa)}</b>${x.oferta ? ` <span class="mut">· ${esc(x.oferta)}</span>` : ""}${x.texto ? `<div class="tl-tx">${esc(x.texto)}</div>` : ""}</div></li>`).join("")}</ol></details>` : `<p class="mut">Todavía sin novedades: la compu lo agarra en el próximo latido (menos de 1 min).</p>`}
    ${p.resultado ? `<details class="log"><summary>Resultado</summary><pre>${esc(typeof p.resultado === "string" ? p.resultado : JSON.stringify(p.resultado, null, 2))}</pre></details>` : ""}
    <div class="ped-acc">
      ${p.drive_url && ["listo_revisar", "lanzar", "lanzando", "lanzado"].includes(p.estado) ? `<a class="btn chico" href="${esc(p.drive_url)}" target="_blank" rel="noopener">Revisar todos los videos ↗</a>` : ""}
      ${p.estado === "listo_revisar" ? `<button type="button" class="btn chico pri" data-publicar="${esc(id)}">Publicar en Meta</button>` : ""}
      ${cancelable ? `<button type="button" class="btn chico" data-cancelar="${esc(id)}">Cancelar</button>` : ""}
      ${eliminable ? `<button type="button" class="btn chico peligro" data-eliminar="${esc(id)}">${cancelable ? "Cancelar y eliminar" : "Eliminar"}</button>` : ""}
    </div>
  </div>`;
}
function abrirPedido(id) {
  id = String(id);
  RK.panel = true; ls.set("rk_panel", "1"); RK.abiertos.add(id); RK.foco = id;
  pintarPedidos();
  if (!pedidoPorId(id)) cargarFabrica();
}
function clickPedidos(e) {
  const t = e.target;
  if (t.closest("#rk-ped-tg")) { RK.panel = !RK.panel; ls.set("rk_panel", RK.panel ? "1" : "0"); pintarPedidos(); $("#rk-ped-tg").focus(); return; }
  const tg = t.closest("[data-pedtg]");
  if (tg) { const id = tg.dataset.pedtg; RK.abiertos.has(id) ? RK.abiertos.delete(id) : RK.abiertos.add(id); pintarPedidos(); const n = $(`[data-pedtg="${CSS.escape(id)}"]`); if (n) n.focus({ preventScroll: true }); return; }
  const pu = t.closest("[data-publicar]"); if (pu) return confirmarPublicar(pu.dataset.publicar);
  const ca = t.closest("[data-cancelar]"); if (ca) return confirmarCancelar(ca.dataset.cancelar);
  const el = t.closest("[data-eliminar]"); if (el) return confirmarEliminar(el.dataset.eliminar);
}
async function confirmarPublicar(id) {
  if (!pedidoPorId(id)) await cargarFabrica();
  const p = pedidoPorId(id);
  if (!p) return toast(`No encontré el pedido #${esc(id)}.`, "error");
  if (p.estado !== "listo_revisar") return toast(`El pedido #${esc(id)} está «${esc((ESTADO_FAB[p.estado] || [p.estado])[0])}»: solo se publica cuando está listo para revisar.`, "error", 7000);
  const ofs = p.params?.ofertas || [];
  let enviando = false;
  const m = abrirModal(`<h3>¿Publicar el pedido #${esc(id)} en Meta?</h3>
    <p>Se suben los videos ${esc(destinoTx(p.params?.destino))}, como siempre, y <b>a los 10 minutos se chequea solo</b> que hayan salido bien.</p>
    ${p.drive_url ? `<p><a class="link" href="${esc(p.drive_url)}" target="_blank" rel="noopener">Mirar los videos antes ↗</a></p>` : ""}
    <ul class="lista-nombres">${ofs.map((o) => `<li><span class="niv">${esc(o.bandera || "")}</span><span>${esc(o.etiqueta || o.grupo)} · ${pl((o.posts || []).length, "creativo")}</span></li>`).join("")}</ul>
    ${DEMO ? `<p class="mut">Demo: se simula, no toca Meta.</p>` : dryOn() ? `<p class="mut"><b>Modo prueba:</b> no se manda nada.</p>` : ""}
    <div class="err-box" id="pub-err" role="alert" hidden></div>
    <div class="botones"><button type="button" class="btn" data-x>Todavía no</button><button type="button" class="btn pri" data-ok data-foco>Sí, publicar</button></div>`, { bloqueado: () => enviando });
  $("[data-x]", m.dlg).onclick = m.cerrar;
  $("[data-ok]", m.dlg).onclick = async (ev) => {
    if (dryOn() && !DEMO) { m.cerrar(); return toast(`<b>Modo prueba:</b> el pedido #${esc(id)} no se publicó.`); }
    const b = ev.currentTarget;
    enviando = true; b.classList.add("cargando"); b.innerHTML = `<span class="gira">↻</span> Mandando…`;
    try { await api("fabrica_lanzar", { body: { id: p.id } }); }
    catch (e) {
      enviando = false;
      if (e.code === 401) { m.cerrar(); ls.del("dash_clave"); return login("Clave incorrecta"); }
      b.classList.remove("cargando"); b.textContent = "Reintentar";
      const box = $("#pub-err", m.dlg); box.hidden = false; box.textContent = `No se pudo: ${e.message}`;
      return;
    }
    enviando = false; m.cerrar();
    toast(`Listo: la compu publica el pedido #${esc(id)} en su próximo latido (menos de 1 min). Te aviso cuando esté en Meta.`, "ok", 8000);
    abrirPedido(id); cargarFabrica();
  };
}
function confirmarCancelar(id) {
  const p = pedidoPorId(id); if (!p) return;
  let enviando = false;
  const m = abrirModal(`<h3>¿Cancelar el pedido #${esc(id)}?</h3>
    <p class="mut">${p.estado === "trabajando" ? "La compu deja de trabajar en él; lo que ya hizo queda en Drive." : p.estado === "listo_revisar" ? "Los videos quedan en Drive, pero no se publican." : "No se va a hacer."}</p>
    <div class="err-box" id="can-err" role="alert" hidden></div>
    <div class="botones"><button type="button" class="btn" data-x data-foco>No, dejarlo</button><button type="button" class="btn peligro" data-ok>Sí, cancelar</button></div>`, { bloqueado: () => enviando });
  $("[data-x]", m.dlg).onclick = m.cerrar;
  $("[data-ok]", m.dlg).onclick = async (ev) => {
    const b = ev.currentTarget;
    enviando = true; b.classList.add("cargando"); b.innerHTML = `<span class="gira">↻</span> Cancelando…`;
    try { await api("fabrica_cancelar", { body: { id: p.id } }); }
    catch (e) {
      enviando = false;
      if (e.code === 401) { m.cerrar(); ls.del("dash_clave"); return login("Clave incorrecta"); }
      b.classList.remove("cargando"); b.textContent = "Reintentar";
      const box = $("#can-err", m.dlg); box.hidden = false; box.textContent = `No se pudo: ${e.message}`;
      return;
    }
    enviando = false; m.cerrar();
    toast(`Pedido #${esc(id)} cancelado.`);
    cargarFabrica();
  };
}
// (10/10, Lorenzo) «Eliminar» / «Cancelar y eliminar»: lo saca de la pantalla (y si estaba en marcha, lo cancela)
function confirmarEliminar(id) {
  const p = pedidoPorId(id); if (!p) return;
  const activo = ["pendiente", "trabajando", "listo_revisar", "lanzar"].includes(p.estado);
  let enviando = false;
  const m = abrirModal(`<h3>¿${activo ? "Cancelar y eliminar" : "Eliminar"} el pedido #${esc(id)}?</h3>
    <p class="mut">${activo ? "Se cancela (la compu deja de trabajar en él) y desaparece de la lista. Lo que ya esté en Drive queda ahí." : "Desaparece de la lista de pedidos."}</p>
    <div class="err-box" id="el-err" role="alert" hidden></div>
    <div class="botones"><button type="button" class="btn" data-x data-foco>No</button><button type="button" class="btn peligro" data-ok>Sí, ${activo ? "cancelar y eliminar" : "eliminar"}</button></div>`, { bloqueado: () => enviando });
  $("[data-x]", m.dlg).onclick = m.cerrar;
  $("[data-ok]", m.dlg).onclick = async (ev) => {
    const b = ev.currentTarget;
    enviando = true; b.classList.add("cargando"); b.innerHTML = `<span class="gira">↻</span> Eliminando…`;
    try { await api("fabrica_eliminar", { body: { id: p.id } }); }
    catch (e) {
      enviando = false;
      if (e.code === 401) { m.cerrar(); ls.del("dash_clave"); return login("Clave incorrecta"); }
      b.classList.remove("cargando"); b.textContent = "Reintentar";
      const box = $("#el-err", m.dlg); box.hidden = false; box.textContent = `No se pudo: ${e.message}`;
      return;
    }
    enviando = false; m.cerrar();
    if (RK.fab?.pedidos) RK.fab.pedidos = RK.fab.pedidos.filter((x) => String(x.id) !== String(id));
    RK.abiertos.delete(String(id)); pintarPedidos();
    toast(`Pedido #${esc(id)} eliminado.`);
    cargarFabrica();
  };
}
document.addEventListener("keydown", (e) => {
  if (S.vista !== "ranking" || modalActual || e.key !== "Escape") return;
  if (!$("#menu").hidden) { cerrarMenu(); $("#b-menu").focus(); }
});

// --- fiesta del pop-up «¡Se terminó todo!» ---
function fiestaHTML() {
  const cols = ["var(--acento)", "var(--marca-borde)", "var(--peligro)", "var(--ok)", "var(--r-nar-tx)", "var(--c-ad, #c27a1a)"];
  const R = (i, s) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };
  const piezas = Array.from({ length: 30 }, (_, i) => {
    const forma = i % 3;
    const st = `--x:${(R(i, 1) * 96 + 2).toFixed(1)}%;--d:${(R(i, 2) * 1.6).toFixed(2)}s;--t:${(2.4 + R(i, 3) * 1.8).toFixed(2)}s;--r:${Math.round(R(i, 4) * 720 - 360)}deg;--c:${cols[i % cols.length]};--y0:${(R(i, 5) * 40).toFixed(0)}%`;
    if (forma === 0) return `<i class="cf cf-r" style="${st}"></i>`;
    if (forma === 1) return `<i class="cf cf-c" style="${st}"></i>`;
    return `<svg class="cf cf-s" style="${st}" viewBox="0 0 12 20"><path d="M6 1 C 1 5, 11 8, 6 11 C 1 14, 11 16, 6 19"/></svg>`;
  }).join("");
  const fuego = (cl, c) => `<svg class="fw ${cl}" style="--c:${c}" viewBox="0 0 80 80">${Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2, x1 = 40 + Math.cos(a) * 12, y1 = 40 + Math.sin(a) * 12, x2 = 40 + Math.cos(a) * 34, y2 = 40 + Math.sin(a) * 34; return `<path pathLength="1" d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}"/>`; }).join("")}</svg>`;
  return `<div class="ev-fiesta" aria-hidden="true">${fuego("fw1", "var(--r-nar-tx)")}${fuego("fw2", "var(--acento)")}${fuego("fw3", "var(--peligro)")}${piezas}</div>`;
}

// ---------- arranque ----------
function iniciar() {
  pintarTema();
  pintarBadges();
  $("#b-ref").onclick = () => { if (S.vista === "ranking" && $("#rk")) { cargarRanking(true); cargarFabrica(); } else if ($("#carr")) cargar(true); };
  $("#secciones").addEventListener("click", (e) => { const b = e.target.closest("[data-sec]"); if (b) irASeccion(b.dataset.sec); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", pintarTema);
  $("#b-menu").onclick = (e) => { e.stopPropagation(); $("#menu").hidden ? abrirMenu() : cerrarMenu(); };
  document.addEventListener("click", (e) => { if (!$("#menu").hidden && !e.target.closest(".menu-wrap")) cerrarMenu(); });
  if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
    // aviso tocado con la app ya abierta: el service worker manda el evento acá
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (e.data?.tipo !== "ev") return;
      try { e.ports?.[0]?.postMessage("ok"); } catch {}
      recibirEvento(e.data.ev);
    });
    try { navigator.serviceWorker.startMessages(); } catch {}
  }
  window.addEventListener("hashchange", () => {
    if (location.hash === "#ranking") { if (S.vista !== "ranking" && (DEMO || clave())) irASeccion("ranking"); return; }
    const ev = leerHashEv(); if (ev) recibirEvento(ev);
  });
  document.addEventListener("visibilitychange", () => {
    const d = S.datos[S.periodo];
    if (!document.hidden && d && $("#carr") && Date.now() - new Date(d.generado || 0) > 5 * 60000) cargar();
    if (!document.hidden && S.vista === "ranking" && $("#rk")) {
      cargarFabrica();
      const r = RK.datos[RK.periodo];
      if (r && Date.now() - new Date(r.generado || 0) > 15 * 60000) cargarRanking();
    }
  });
  const ev = leerHashEv();
  if (ev && !DEMO && !clave()) ls.set("dash_ev_pend", JSON.stringify(ev));
  if (DEMO || clave()) {
    if (location.hash === "#reglas") verReglas(); else abrirInicial();
    if (ev) recibirEvento(ev); else eventoPendiente();
  } else login();
}
iniciar();

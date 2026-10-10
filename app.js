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
const PERIODOS = [["hoy", "Hoy"], ["ayer", "Ayer"], ["7d", "7 días"], ["30d", "30 días"]];
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
  vista: "dash",             // "dash" | "reglas"
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
  if (!demoP) demoP = new Promise((ok, no) => { const s = document.createElement("script"); s.src = "demo.js?v=7"; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
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
  const b = $("#b-tema");
  b.textContent = osc ? "☀" : "☾";
  b.setAttribute("aria-label", osc ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
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
    <button class="item" role="menuitem" id="mi-reglas"><span>Reglas<br><small>ver y editar las automáticas</small></span><span aria-hidden="true">⚙</span></button>
    <button class="item" role="menuitem" id="mi-log"><span>Registro de acciones<br><small>últimas 50</small></span><span aria-hidden="true">📜</span></button>
    <button class="item" role="menuitem" id="mi-sistema"><span>Tema del sistema<br><small>volver a claro/oscuro automático</small></span><span aria-hidden="true">◐</span></button>
    <hr>
    ${DEMO ? `<a class="item" role="menuitem" href="${location.pathname}"><span>Salir del demo</span><span aria-hidden="true">↩</span></a>` : `<button class="item" role="menuitem" id="mi-salir"><span>Salir</span><span aria-hidden="true">↩</span></button>`}`;
  $("#mi-dry").onclick = () => { if (DRY_URL) return; ls.set("dash_dry", dryOn() ? "0" : "1"); pintarBadges(); pintarMenu(); toast(dryOn() ? "Modo prueba prendido: las escrituras van con dry=1." : "Modo prueba apagado: las escrituras tocan Meta de verdad."); };
  $("#mi-log").onclick = () => { cerrarMenu(); verRegistro(); };
  $("#mi-reglas").onclick = () => { cerrarMenu(); verReglas(); };
  $("#mi-sistema").onclick = () => { temaSistema(); cerrarMenu(); };
  const s = $("#mi-salir");
  if (s) s.onclick = () => { ls.del("dash_clave"); S.datos = {}; S.det.clear(); S.sel.clear(); cerrarMenu(); pintarBarra(); login(); };
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
      montar();
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
  $("#main").innerHTML = `
    <div class="controles">
      <div class="periodos" role="group" aria-label="Período">${PERIODOS.map(([k, t]) => `<button type="button" class="btn chico" data-per="${k}" aria-pressed="${k === S.periodo}">${t}</button>`).join("")}</div>
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
  $$("[data-per]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.per === S.periodo));
  const d = S.datos[S.periodo];
  const hora = d ? hhmm(d.cache?.hora || d.generado) : null;
  let tx = "";
  if (d?.__offline) tx = `<span class="aviso">Sin conexión: datos guardados de las ${hora}</span>`;
  else if (d?.cache?.de_cache) tx = `<span class="aviso" title="${esc(d.cache.aviso || "")}">Datos de las ${hora} (Meta sin cupo)</span>`;
  else if (d) tx = `<span>Datos de las <b class="num">${hora}</b></span>`;
  else tx = `<span>${S.cargando ? "Cargando…" : ""}</span>`;
  h.innerHTML = `${tx}<button type="button" class="btn icono${S.cargando ? " cargando" : ""}" id="b-ref" aria-label="Refrescar datos (pide datos nuevos a Meta)"><span class="gira">↻</span></button>`;
  $("#b-ref").onclick = () => cargar(true);
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

function cambiarPeriodo(p) {
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
  cerrarMenu();
  S.vista = "reglas";
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

// ---------- arranque ----------
function iniciar() {
  pintarTema();
  pintarBadges();
  $("#b-tema").onclick = alternarTema;
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", pintarTema);
  $("#b-menu").onclick = (e) => { e.stopPropagation(); $("#menu").hidden ? abrirMenu() : cerrarMenu(); };
  document.addEventListener("click", (e) => { if (!$("#menu").hidden && !e.target.closest(".menu-wrap")) cerrarMenu(); });
  if ("serviceWorker" in navigator && window.isSecureContext) navigator.serviceWorker.register("sw.js").catch(() => {});
  document.addEventListener("visibilitychange", () => {
    const d = S.datos[S.periodo];
    if (!document.hidden && d && $("#carr") && Date.now() - new Date(d.generado || 0) > 5 * 60000) cargar();
  });
  if (DEMO || clave()) { if (location.hash === "#reglas") verReglas(); else montar(); } else login();
}
iniciar();

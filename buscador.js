/* Buscador de ofertas — página aparte del Dashboard. Sin build ni dependencias.
   Backend: Edge Function buscador-ofertas (Codicia). Contrato: scratchpad/spy/CONTRATO-FRONT.md (11/10). */
"use strict";

const API = "https://tppcpnfzcxxusdhrlmdx.supabase.co/functions/v1/buscador-ofertas";
const URLP = new URLSearchParams(location.search);
const DEMO = URLP.get("demo") === "1";
const TZ_AR = "America/Argentina/Buenos_Aires";

// ---------- utilidades (copiadas de app.js) ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ls = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const NF0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const ent = (n) => NF0.format(n || 0);
const pl = (n, s, p = s + "s") => `${ent(n)} ${n === 1 ? s : p}`;
const clave = () => ls.get("dash_clave", "");
const dryOn = () => ls.get("dash_dry") === "1";
const reducido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
// Solo URLs http(s) en href/src (los datos vienen de afuera).
const url = (u) => /^https?:\/\//i.test(String(u || "")) || /^data:image\//i.test(String(u || "")) ? String(u) : "";
const dmy = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ""); return m ? `${+m[3]}/${+m[2]}` : "—"; };
const fechaHora = (iso) => { try { return new Date(iso).toLocaleString("es-AR", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ_AR }); } catch { return "—"; } };

// ---------- constantes de mercado ----------
const MERCADOS_FILTRO = [["todos", "Todos"], ["anglo", "Anglo"], ["br", "BR"], ["ar", "AR"], ["eu", "EU"]];
const CORTO = { anglo: "Anglo", br: "BR", ar: "AR", eu: "EU", latam: "LATAM" };
const FORMATOS = [["todos", "Todos"], ["landing", "Landing"], ["quiz", "Quiz"], ["vsl", "VSL"]];
const FORMATO_TX = { landing: "Landing", quiz: "Quiz", vsl: "VSL", whatsapp: "WhatsApp" };
const TIPOS = [["tal_cual", "Modelar tal cual"], ["landing", "Landing page"], ["quiz", "Quiz"], ["vsl", "VSL funnel"]];
const MERCADOS_MOD = [
  ["anglo", "Anglo", ["US", "GB", "CA", "AU", "NZ", "IE"], "en"],
  ["br", "Brasil", ["BR"], "pt"],
  ["ar", "Argentina", ["AR"], "es"],
  ["latam", "LATAM", ["AR", "MX", "CO", "CL", "PE", "EC", "UY", "PY", "BO", "CR", "DO", "GT", "HN", "NI", "PA", "SV", "VE", "ES", "US"], "es"],
  ["fr", "Francia", ["FR"], "fr"],
  ["it", "Italia", ["IT"], "it"],
  ["de", "Alemania", ["DE"], "de"],
  ["es", "España", ["ES"], "es"],
];
const IDIOMAS = [["en", "Inglés"], ["es", "Español"], ["pt", "Portugués"], ["fr", "Francés"], ["it", "Italiano"], ["de", "Alemán"]];
const ZONA = {
  US: "America/New_York", GB: "Europe/London", CA: "America/Toronto", AU: "Australia/Sydney", NZ: "Pacific/Auckland", IE: "Europe/Dublin",
  BR: "America/Sao_Paulo", AR: TZ_AR, MX: "America/Mexico_City", CO: "America/Bogota", CL: "America/Santiago", PE: "America/Lima",
  EC: "America/Guayaquil", UY: "America/Montevideo", PY: "America/Asuncion", BO: "America/La_Paz", CR: "America/Costa_Rica",
  DO: "America/Santo_Domingo", GT: "America/Guatemala", HN: "America/Tegucigalpa", NI: "America/Managua", PA: "America/Panama",
  SV: "America/El_Salvador", VE: "America/Caracas", ES: "Europe/Madrid", FR: "Europe/Paris", IT: "Europe/Rome", DE: "Europe/Berlin",
  PT: "Europe/Lisbon", NL: "Europe/Amsterdam", BE: "Europe/Brussels", AT: "Europe/Vienna", CH: "Europe/Zurich",
};
const ESTADOS = {
  pendiente: ["En cola", ""], trabajando: ["Trabajando", "acento"], listo_revisar: ["Listo para revisar", "verde"],
  lanzar: ["Por lanzar", "amarillo"], lanzando: ["Lanzando", "amarillo"], lanzado: ["Lanzado (en pausa)", "verde-fuerte"],
  error: ["Error", "rojo"], cancelado: ["Cancelado", ""],
};

// ---------- horas (Intl, sin librerías) ----------
const partes = (tz, d) => {
  const o = {};
  for (const p of new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(d)) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second };
};
// minutos que la zona va adelantada respecto de UTC en ese instante
const offsetMin = (tz, d) => { const p = partes(tz, d); return Math.round((Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(d.getTime() / 1000) * 1000) / 60000); };
// hora de pared en la zona -> instante
function instanteDe(tz, y, m, d, h, mi) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let t = guess - offsetMin(tz, new Date(guess)) * 60000;
  t = guess - offsetMin(tz, new Date(t)) * 60000;
  return new Date(t);
}
const pad = (n) => String(n).padStart(2, "0");
const localISO = (tz, d) => { const p = partes(tz, d); return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`; };
const legible = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(iso || ""); return m ? `${+m[3]}/${+m[2]} ${m[4]}` : "—"; };
// País más adelantado (mayor offset ahora mismo) de la lista.
function masAdelantado(paises) {
  const ahora = new Date();
  let mejor = null;
  for (const c of paises) {
    const tz = ZONA[c]; if (!tz) continue;
    const off = offsetMin(tz, ahora);
    if (!mejor || off > mejor.off) mejor = { pais: c, tz, off };
  }
  return mejor || { pais: "AR", tz: TZ_AR, off: offsetMin(TZ_AR, ahora) };
}
// 05:00 local del país más adelantado, del día siguiente (calendario de Argentina). Si ya pasó, al otro día.
function horaPorDefecto(paises) {
  const z = masAdelantado(paises);
  const hoyAR = partes(TZ_AR, new Date());
  const base = new Date(Date.UTC(hoyAR.y, hoyAR.m - 1, hoyAR.d + 1));
  let t = instanteDe(z.tz, base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), 5, 0);
  while (t.getTime() < Date.now() + 30 * 60000) {
    const p = partes(z.tz, t);
    const sig = new Date(Date.UTC(p.y, p.m - 1, p.d + 1));
    t = instanteDe(z.tz, sig.getUTCFullYear(), sig.getUTCMonth() + 1, sig.getUTCDate(), 5, 0);
  }
  return { ...z, local: localISO(z.tz, t), ar: localISO(TZ_AR, t), instante: t };
}
function aAR(tz, local) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local || "");
  if (!m) return null;
  const t = instanteDe(tz, +m[1], +m[2], +m[3], +m[4], +m[5]);
  return { ar: localISO(TZ_AR, t), instante: t };
}

// ---------- estado ----------
const B = {
  vista: "ganadoras",
  datos: null,
  cargando: false,
  error: null,
  sel: new Set(),
  filtro: { mercado: "todos", formato: "todos", q: "", min: 50 },
  pedidos: null,
  compu: null,
  pedErr: null,
  ultimoPedido: null,
  timer: null,
};
try { const v = JSON.parse(ls.get("buscador_sel", "[]")); if (Array.isArray(v)) v.forEach((x) => B.sel.add(String(x))); } catch {}
const guardarSel = () => ls.set("buscador_sel", JSON.stringify([...B.sel]));
const ancho = () => matchMedia("(min-width: 900px)").matches;

// ---------- API ----------
async function api(accion, { body = null } = {}) {
  if (DEMO) return demoApi(accion, body);
  let r;
  try {
    r = await fetch(`${API}?accion=${accion}`, {
      method: body ? "POST" : "GET",
      headers: { "x-app-clave": clave(), ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch { const e = new Error("Sin conexión con el servidor"); e.code = 0; throw e; }
  if (r.status === 401) { const e = new Error("Clave incorrecta"); e.code = 401; throw e; }
  let j = null;
  try { j = await r.json(); } catch {}
  if (!r.ok || (j && j.error)) { const e = new Error((j && j.error) || `Error ${r.status}`); e.code = r.status; e.data = j; throw e; }
  return j;
}

// ---------- demo ----------
let demoDatos = null;
const DEMO_PED = [];
async function demoApi(accion, body) {
  await new Promise((ok) => setTimeout(ok, 350));
  if (!demoDatos) {
    const r = await fetch("buscador-demo.json?v=1", { cache: "no-store" });
    if (!r.ok) throw new Error("No encontré buscador-demo.json");
    demoDatos = await r.json();
    DEMO_PED.push({ id: 7, estado: "trabajando", creado: new Date(Date.now() - 50 * 60000).toISOString(),
      params: { ofertas: [demoDatos.ofertas[0].id], tipo: "quiz", mercado: "br", paises: ["BR"], idioma: "pt", prueba: false, quien: "Lorenzo" },
      progreso: [
        { t: new Date(Date.now() - 49 * 60000).toISOString(), etapa: "inicio", texto: "Pedido tomado por la compu" },
        { t: new Date(Date.now() - 31 * 60000).toISOString(), etapa: "landing", texto: "Quiz copiado y traducido al portugués" },
        { t: new Date(Date.now() - 8 * 60000).toISOString(), etapa: "creativos", texto: "Armando 5 creativos con los videos más duplicados" },
      ] });
  }
  if (accion === "ofertas") return demoDatos;
  if (accion === "pedidos") return { pedidos: DEMO_PED.slice().sort((a, b) => b.id - a.id), compu: { prendida: true, visto: new Date(Date.now() - 40000).toISOString() } };
  if (accion === "modelar") {
    const id = Math.max(0, ...DEMO_PED.map((p) => p.id)) + 1;
    DEMO_PED.push({ id, estado: "pendiente", creado: new Date().toISOString(), params: body, progreso: [{ t: new Date().toISOString(), etapa: "inicio", texto: body.prueba ? "Pedido de prueba recibido (demo)" : "Pedido recibido (demo)" }] });
    return { id };
  }
  throw new Error("Acción desconocida en el demo");
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

// ---------- modal (igual que app.js) ----------
let modalActual = null;
function abrirModal(html, { ancho: an = false, bloqueado = () => false, alCerrar = null } = {}) {
  cerrarModal();
  const previo = document.activeElement;
  const velo = document.createElement("div");
  velo.className = "velo";
  velo.innerHTML = `<div class="dialogo boceto${an ? " ancho" : ""}" role="dialog" aria-modal="true" tabindex="-1">${html}</div>`;
  const dlg = $(".dialogo", velo);
  const cerrar = () => { if (bloqueado()) return; velo.remove(); modalActual = null; document.removeEventListener("keydown", tecla, true); alCerrar && alCerrar(); try { previo && previo.focus(); } catch {} };
  const tecla = (e) => {
    if (e.key === "Escape") { e.preventDefault(); cerrar(); }
    if (e.key === "Tab") {
      const f = $$('button:not([disabled]), input:not([disabled]), select, a[href], [tabindex="0"]', dlg);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  };
  velo.addEventListener("pointerdown", (e) => { if (e.target === velo) cerrar(); });
  document.addEventListener("keydown", tecla, true);
  $("#modal-raiz").appendChild(velo);
  const enfocar = () => { const f = $("[data-foco]", dlg) || $("button.pri, button", dlg) || dlg; f.focus({ preventScroll: true }); };
  modalActual = { velo, dlg, cerrar, set(h) { dlg.innerHTML = h; enfocar(); } };
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

// ---------- login (mismo que el dashboard: guarda dash_clave) ----------
function login(msg = "") {
  pararRefresco();
  $("#tabs").hidden = true;
  $("#barra").hidden = true;
  $("#main").innerHTML = `
    <form class="login boceto" id="f-login" autocomplete="on">
      <h2>Entrar</h2>
      <p>Poné la clave del dashboard.</p>
      <label class="sr" for="clave">Clave</label>
      <input class="campo" id="clave" name="password" type="password" autocomplete="current-password" placeholder="Clave" required>
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
    await cargar();
  };
}

// ---------- carga ----------
async function cargar() {
  B.cargando = true; B.error = null;
  $("#b-ref").classList.add("cargando");
  if (!B.datos) pintar();
  try {
    const d = await api("ofertas");
    B.datos = { ...d, ofertas: Array.isArray(d?.ofertas) ? d.ofertas : [] };
  } catch (e) {
    if (e.code === 401) { B.cargando = false; $("#b-ref").classList.remove("cargando"); const habia = !!clave(); ls.del("dash_clave"); return login(habia ? "Clave incorrecta" : ""); }
    B.error = e.message || "No se pudo cargar";
  }
  B.cargando = false;
  $("#b-ref").classList.remove("cargando");
  $("#tabs").hidden = false;
  pintar();
  cargarPedidos();
}
async function cargarPedidos() {
  try {
    const r = await api("pedidos");
    B.pedidos = Array.isArray(r?.pedidos) ? r.pedidos : [];
    B.compu = r?.compu || null;
    B.pedErr = null;
  } catch (e) {
    if (e.code === 401) { ls.del("dash_clave"); return login("Clave incorrecta"); }
    B.pedErr = e.message || "No se pudieron leer los pedidos";
  }
  if (B.vista === "seleccionadas") pintarPedidos();
}
function arrancarRefresco() {
  pararRefresco();
  B.timer = setInterval(() => { if (!document.hidden && B.vista === "seleccionadas") cargarPedidos(); }, 30000);
}
function pararRefresco() { if (B.timer) { clearInterval(B.timer); B.timer = null; } }

// ---------- helpers de oferta ----------
const ofertas = () => B.datos?.ofertas || [];
const porId = (id) => ofertas().find((o) => String(o.id) === String(id));
const NOMBRE_MK = { anglo: "Anglo", br: "Brasil", ar: "Argentina", eu: "Europa", latam: "LATAM" };
const nombreMercado = (k) => NOMBRE_MK[k] || (B.datos?.mercados || {})[k] || k;
const corto = (k) => CORTO[k] || String(k).toUpperCase();

function chipsMercado(o) {
  const a = o.activos || {};
  const ks = Object.keys(B.datos?.mercados || {}).length ? Object.keys(B.datos.mercados) : ["anglo", "br", "ar", "eu"];
  return `<ul class="bo-mk" aria-label="Anuncios activos por mercado">${ks.map((k) => {
    const v = a[k];
    const nulo = v == null;
    return `<li class="bo-mk-i${nulo ? " nulo" : v === 0 ? " cero" : ""}" ${nulo ? 'title="No medido"' : ""}><span>${esc(corto(k))}</span> <b class="num">${nulo ? "—" : ent(v)}</b>${nulo ? '<span class="sr"> (no medido)</span>' : ""}</li>`;
  }).join("")}</ul>`;
}
const chipFormato = (o) => o.formato ? `<span class="fchip acento">${esc(FORMATO_TX[o.formato] || o.formato)}</span>` : "";
const desde = (o) => o.activo_desde ? `activa desde ${dmy(o.activo_desde)}${o.dias_activa != null ? ` (${pl(o.dias_activa, "día")})` : ""}` : "";
function video(o, chico = false) {
  const v = o.video;
  const poster = url(v?.poster);
  const src = url(v?.src);
  const usos = v?.collation_count ? `<small class="bo-uso num">usado en ${pl(v.collation_count, "anuncio")}</small>` : "";
  if (!v || (!src && !poster)) return `<div class="bo-vid${chico ? " chico" : ""}"><div class="bo-sinvid">Sin video</div></div>`;
  const media = src
    ? `<video controls playsinline preload="none" ${poster ? `poster="${esc(poster)}"` : ""} src="${esc(src)}" aria-label="Video más escalado de ${esc(o.page_name)}"></video>`
    : `<img src="${esc(poster)}" alt="Creativo más escalado de ${esc(o.page_name)} (imagen)" loading="lazy"><span class="bo-img-tag">imagen</span>`;
  return `<div class="bo-vid${chico ? " chico" : ""}">${media}</div>${usos}`;
}
function links(o) {
  const xs = [];
  if (url(o.biblioteca_url)) xs.push(`<a class="link" href="${esc(url(o.biblioteca_url))}" target="_blank" rel="noopener">Ver en la Biblioteca ↗</a>`);
  if (url(o.biblioteca_dominio_url)) xs.push(`<a class="link" href="${esc(url(o.biblioteca_dominio_url))}" target="_blank" rel="noopener">por dominio ↗</a>`);
  if (url(o.landing_url)) xs.push(`<a class="link" href="${esc(url(o.landing_url))}" target="_blank" rel="noopener">landing${o.dominio ? ` (${esc(o.dominio)})` : ""} ↗</a>`);
  return `<div class="bo-links">${xs.join("")}</div>`;
}
const caja = (o) => `<label class="bo-check"><input type="checkbox" data-sel="${esc(o.id)}" ${B.sel.has(String(o.id)) ? "checked" : ""}><span class="bo-caja" aria-hidden="true"></span><span class="sr">Seleccionar ${esc(o.page_name)}</span></label>`;
const avatar = (o) => url(o.page_pic) ? `<img class="bo-pic" src="${esc(url(o.page_pic))}" alt="" loading="lazy">` : `<span class="bo-pic vacio-pic" aria-hidden="true">${esc((o.page_name || "?").trim().charAt(0).toUpperCase())}</span>`;

// ---------- pintar ----------
function pintar() {
  $$("#tabs [data-vista]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.vista === B.vista)));
  $("#tab-n").textContent = `(${B.sel.size})`;
  $("#badges").innerHTML = (DEMO ? `<span class="badge demo" title="Datos de ejemplo, nada va a la compu">DEMO</span>` : "") +
    (dryOn() ? `<span class="badge" title="El modo prueba del dashboard está prendido">MODO PRUEBA</span>` : "");
  const main = $("#main");
  if (!B.datos) {
    if (B.cargando) main.innerHTML = `<p class="vacio"><span class="cargador"></span>Buscando las ofertas…</p><div class="esqueleto boceto bo-esq"></div><div class="esqueleto boceto bo-esq"></div>`;
    else if (B.error) main.innerHTML = errorBox(B.error);
    bindError();
    pintarBarra();
    return;
  }
  if (B.vista === "ganadoras") pintarGanadoras();
  else if (B.vista === "oportunidades") pintarOportunidades();
  else pintarSeleccionadas();
  pintarBarra();
}
const errorBox = (m) => `<div class="err-box bo-err" role="alert"><b>No se pudo cargar.</b> ${esc(m)}<div><button type="button" class="btn chico" id="b-reintentar">Reintentar</button></div></div>`;
function bindError() { const b = $("#b-reintentar"); if (b) b.onclick = cargar; }
const cabDatos = () => B.datos?.generado ? `<p class="bo-gen mut">Datos del ${esc(fechaHora(B.datos.generado))} (hora AR)${B.error ? ` · <span class="bo-mal">no se pudo actualizar: ${esc(B.error)}</span>` : ""}</p>` : "";

function filtradas() {
  const f = B.filtro;
  const q = f.q.trim().toLowerCase();
  return ofertas().filter((o) => {
    const n = f.mercado === "todos" ? (o.activos_total || 0) : (o.activos || {})[f.mercado];
    if (f.mercado !== "todos" && !(n > 0)) return false;
    if ((n || 0) < (Number(f.min) || 0)) return false;
    if (f.formato !== "todos" && o.formato !== f.formato) return false;
    if (q && ![o.page_name, o.producto, o.angulo, o.nicho, o.dominio, o.tipo_producto].some((x) => String(x || "").toLowerCase().includes(q))) return false;
    return true;
  }).sort((a, b) => (b.activos_total || 0) - (a.activos_total || 0));
}
const segBtns = (attr, xs, actual) => xs.map(([k, t]) => `<button type="button" class="btn chico" ${attr}="${k}" aria-pressed="${k === actual}">${esc(t)}</button>`).join("");

function pintarGanadoras() {
  const f = B.filtro;
  const main = $("#main");
  const yaFiltros = $("#bo-filtros");
  const foco = document.activeElement && document.activeElement.id;
  main.innerHTML = `${cabDatos()}
    <section class="bo-filtros boceto" id="bo-filtros" aria-label="Filtros">
      <div class="bo-f"><span class="bo-f-l" id="fl-mk">Mercado</span><div class="periodos" role="group" aria-labelledby="fl-mk">${segBtns("data-fmk", MERCADOS_FILTRO, f.mercado)}</div></div>
      <div class="bo-f"><span class="bo-f-l" id="fl-fo">Formato</span><div class="periodos" role="group" aria-labelledby="fl-fo">${segBtns("data-ffo", FORMATOS, f.formato)}</div></div>
      <div class="bo-f bo-f-fila">
        <label class="bo-f-q"><span class="bo-f-l">Buscar</span><input class="campo" id="f-q" type="search" placeholder="página, producto, nicho, dominio…" value="${esc(f.q)}" autocomplete="off"></label>
        <label class="bo-f-min"><span class="bo-f-l" aria-hidden="true">Mín. anuncios</span><input class="campo num" id="f-min" aria-label="Mínimo de anuncios activos" type="number" inputmode="numeric" min="0" step="10" value="${esc(f.min)}"></label>
      </div>
    </section>
    <div id="bo-lista"></div>`;
  $$("[data-fmk]").forEach((b) => b.onclick = () => { f.mercado = b.dataset.fmk; pintarGanadoras(); $(`[data-fmk="${f.mercado}"]`).focus(); });
  $$("[data-ffo]").forEach((b) => b.onclick = () => { f.formato = b.dataset.ffo; pintarGanadoras(); $(`[data-ffo="${f.formato}"]`).focus(); });
  $("#f-q").oninput = (e) => { f.q = e.target.value; pintarListaGanadoras(); };
  $("#f-min").oninput = (e) => { const v = Number(e.target.value); f.min = isNaN(v) || v < 0 ? 0 : v; pintarListaGanadoras(); };
  if (yaFiltros && foco && $("#" + foco)) $("#" + foco).focus();
  pintarListaGanadoras();
}
function pintarListaGanadoras() {
  const xs = filtradas();
  const box = $("#bo-lista");
  if (!box) return;
  const tot = ofertas().length;
  const res = `<p class="bo-res mut num">${xs.length === tot ? pl(tot, "oferta") : `${ent(xs.length)} de ${pl(tot, "oferta")}`}${B.filtro.mercado !== "todos" ? ` con anuncios en ${esc(nombreMercado(B.filtro.mercado))}` : ""}</p>`;
  if (!xs.length) {
    box.innerHTML = res + `<div class="vacio boceto bo-vacio">${tot ? "Ninguna oferta pasa los filtros. Probá bajar el mínimo de anuncios o elegir «Todos»." : "Todavía no hay ofertas cargadas."}</div>`;
    return;
  }
  box.innerHTML = res + (ancho() ? tablaGanadoras(xs) : `<div class="bo-cards">${xs.map(tarjeta).join("")}</div>`);
  bindSel(box);
}
function tablaGanadoras(xs) {
  return `<div class="tabla-caja boceto bo-tabla-caja"><table class="bo-tabla">
    <caption class="sr">Ofertas ganadoras ordenadas por anuncios activos</caption>
    <thead><tr><th scope="col"><span class="sr">Elegir</span></th><th scope="col">Oferta</th><th scope="col">Anuncios</th><th scope="col">Por mercado</th><th scope="col">Video más escalado</th></tr></thead>
    <tbody>${xs.map((o) => `<tr class="${B.sel.has(String(o.id)) ? "sel" : ""}" data-fila="${esc(o.id)}">
      <td class="bo-td-chk">${caja(o)}</td>
      <td class="bo-td-of"><div class="bo-of-cab">${avatar(o)}<div class="bo-of-tx"><b>${esc(o.page_name)}</b><span>${esc(o.producto)}</span></div></div>
        ${o.angulo ? `<p class="bo-angulo">${esc(o.angulo)}</p>` : ""}
        <div class="bo-meta">${chipFormato(o)}${o.nicho ? `<span class="fchip">${esc(o.nicho)}</span>` : ""}${o.idioma ? `<span class="fchip">${esc(o.idioma)}</span>` : ""}${(o.oportunidades || []).length ? `<span class="fchip amarillo">✦ ${pl(o.oportunidades.length, "oportunidad", "oportunidades")}</span>` : ""}</div>
        ${links(o)}</td>
      <td class="bo-td-n"><b class="bo-n num">${ent(o.activos_total)}</b><small>anuncios activos</small><small>${esc(desde(o))}</small></td>
      <td class="bo-td-mk">${chipsMercado(o)}</td>
      <td class="bo-td-v">${video(o, true)}</td>
    </tr>`).join("")}</tbody></table></div>`;
}
function tarjeta(o) {
  return `<article class="bo-card${B.sel.has(String(o.id)) ? " sel" : ""}" data-fila="${esc(o.id)}">
    <div class="bo-card-cab">${avatar(o)}<div class="bo-of-tx"><b>${esc(o.page_name)}</b><span>${esc(o.producto)}</span></div>${caja(o)}</div>
    <div class="bo-meta">${chipFormato(o)}<span class="bo-n-l"><b class="num">${ent(o.activos_total)}</b> anuncios activos</span></div>
    ${desde(o) ? `<p class="bo-desde mut">${esc(desde(o))}</p>` : ""}
    ${chipsMercado(o)}
    ${o.angulo ? `<p class="bo-angulo">${esc(o.angulo)}</p>` : ""}
    ${video(o)}
    ${(o.oportunidades || []).length ? `<p class="bo-op-mini">✦ ${o.oportunidades.map((x) => esc(x.texto || `Oportunidad en ${nombreMercado(x.mercado)}`)).join(" · ")}</p>` : ""}
    ${links(o)}
  </article>`;
}
function bindSel(raiz) {
  $$("[data-sel]", raiz).forEach((c) => c.onchange = () => {
    const id = c.dataset.sel;
    if (c.checked) B.sel.add(id); else B.sel.delete(id);
    guardarSel();
    $$(`[data-sel="${CSS.escape(id)}"]`).forEach((x) => { x.checked = c.checked; });
    $$(`[data-fila="${CSS.escape(id)}"]`).forEach((x) => x.classList.toggle("sel", c.checked));
    $("#tab-n").textContent = `(${B.sel.size})`;
    pintarBarra();
  });
}

// --- oportunidades ---
function pintarOportunidades() {
  const grupos = new Map();
  for (const o of ofertas()) for (const x of o.oportunidades || []) {
    if (!grupos.has(x.mercado)) grupos.set(x.mercado, []);
    grupos.get(x.mercado).push({ o, x });
  }
  const NIV = { alta: 0, media: 1, baja: 2 };
  const gs = [...grupos.entries()].map(([m, its]) => [m, its.sort((a, b) => (NIV[a.x.nivel] ?? 3) - (NIV[b.x.nivel] ?? 3) || (b.x.activos_fuerte || 0) - (a.x.activos_fuerte || 0))]).sort((a, b) => b[1].length - a[1].length);
  const main = $("#main");
  if (!gs.length) { main.innerHTML = cabDatos() + `<div class="vacio boceto bo-vacio">No hay oportunidades detectadas: todas las ofertas ya compiten en sus mercados.</div>`; return; }
  main.innerHTML = cabDatos() + `<p class="bo-intro mut">Ofertas que escalan fuerte en un mercado y casi no tienen competencia en otro.</p>` + gs.map(([m, its]) => `
    <section class="bo-grupo" aria-labelledby="op-${esc(m)}">
      <h2 id="op-${esc(m)}">Oportunidad en ${esc(nombreMercado(m))}: <span>poca competencia</span></h2>
      <svg class="rk-garabato" viewBox="0 0 160 12" aria-hidden="true"><path d="M2 8 C 30 3, 52 11, 80 6 S 130 3, 158 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
      <div class="bo-ops">${its.map(({ o, x }) => `<article class="bo-op${B.sel.has(String(o.id)) ? " sel" : ""}" data-fila="${esc(o.id)}">
        <div class="bo-op-th">${url(o.video?.poster) ? `<img src="${esc(url(o.video.poster))}" alt="" loading="lazy">` : `<span class="bo-sinvid">Sin video</span>`}</div>
        <div class="bo-op-tx">
          <div class="bo-card-cab"><div class="bo-of-tx"><b>${esc(o.page_name)}</b><span>${esc(o.producto)}</span></div>${caja(o)}</div>
          <p class="bo-op-dato">fuerte en <b>${esc(corto(x.fuerte_en))}</b> con <b class="num">${pl(x.activos_fuerte, "anuncio")}</b> · acá <b class="num">${ent(x.activos_aca)}</b></p>
          <div class="bo-meta">${x.nivel ? `<span class="fchip ${x.nivel === "alta" ? "verde-fuerte" : x.nivel === "media" ? "amarillo" : ""}">nivel ${esc(x.nivel)}</span>` : ""}${chipFormato(o)}</div>
          ${links(o)}
        </div>
      </article>`).join("")}</div>
    </section>`).join("");
  bindSel(main);
}

// --- seleccionadas + pedidos ---
function pintarSeleccionadas() {
  const ids = [...B.sel];
  const xs = ids.map(porId).filter(Boolean);
  const faltan = ids.length - xs.length;
  $("#main").innerHTML = `${cabDatos()}
    <section class="bo-selec" aria-labelledby="sel-t">
      <div class="bo-sec-cab"><h2 id="sel-t">Seleccionadas <span class="num">(${ids.length})</span></h2>
        ${ids.length ? `<button type="button" class="btn chico" id="b-sel-limpiar">✕ limpiar</button><button type="button" class="btn pri chico" id="b-sel-modelar" ${xs.length ? "" : "disabled"}>Modelar</button>` : ""}</div>
      ${faltan ? `<p class="hint">${pl(faltan, "oferta elegida ya no aparece", "ofertas elegidas ya no aparecen")} en la lista de hoy. <button type="button" class="link" id="b-sel-purga">Sacarlas</button></p>` : ""}
      ${xs.length ? `<ul class="bo-sel-lista">${xs.map((o) => `<li>${avatar(o)}<div class="bo-of-tx"><b>${esc(o.page_name)}</b><span>${esc(o.producto)} · <span class="num">${ent(o.activos_total)}</span> anuncios</span></div><button type="button" class="btn chico icono-chico" data-quitar="${esc(o.id)}" aria-label="Sacar ${esc(o.page_name)} de la selección">✕</button></li>`).join("")}</ul>`
        : `<div class="vacio boceto bo-vacio">No elegiste ofertas. Marcalas en <button type="button" class="link" data-ir="ganadoras">Ganadoras</button> u <button type="button" class="link" data-ir="oportunidades">Oportunidades</button>.</div>`}
    </section>
    <section class="bo-peds" aria-labelledby="ped-t">
      <div class="bo-sec-cab"><h2 id="ped-t">Pedidos de modelado</h2><span id="bo-compu"></span></div>
      <div id="bo-ped-lista" aria-live="polite"></div>
    </section>`;
  const l = $("#b-sel-limpiar"); if (l) l.onclick = () => { B.sel.clear(); guardarSel(); pintar(); };
  const mo = $("#b-sel-modelar"); if (mo) mo.onclick = modelar;
  const pu = $("#b-sel-purga"); if (pu) pu.onclick = () => { for (const id of [...B.sel]) if (!porId(id)) B.sel.delete(id); guardarSel(); pintar(); };
  $$("[data-quitar]").forEach((b) => b.onclick = () => { B.sel.delete(b.dataset.quitar); guardarSel(); pintar(); });
  $$("[data-ir]").forEach((b) => b.onclick = () => irA(b.dataset.ir));
  pintarPedidos();
}
const TIPO_TX = Object.fromEntries(TIPOS);
const MERC_TX = Object.fromEntries(MERCADOS_MOD.map(([k, t]) => [k, t]));
function pintarPedidos() {
  const box = $("#bo-ped-lista"); if (!box) return;
  const c = B.compu;
  const cp = $("#bo-compu");
  if (cp) cp.innerHTML = c ? `<span class="fchip ${c.prendida ? "verde" : "rojo"}">${c.prendida ? "compu prendida" : "compu apagada"}${c.visto ? ` · ${esc(fechaHora(c.visto))}` : ""}</span>` : "";
  if (B.pedidos == null) { box.innerHTML = B.pedErr ? `<div class="err-box">${esc(B.pedErr)}</div>` : `<p class="mut"><span class="cargador"></span>Cargando pedidos…</p>`; return; }
  const err = B.pedErr ? `<p class="hint error">No se pudo actualizar: ${esc(B.pedErr)}</p>` : "";
  if (!B.pedidos.length) { box.innerHTML = err + `<p class="mut bo-sinped">Todavía no hay pedidos. Elegí ofertas y tocá «Modelar».</p>`; return; }
  box.innerHTML = err + `<div class="rk-ped-lista bo-ped-lista">${B.pedidos.map((p) => {
    const [et, col] = ESTADOS[p.estado] || [p.estado, ""];
    const pr = p.params || {};
    const nOf = (pr.ofertas || []).length;
    const nombres = (pr.ofertas || []).map((o) => (o && typeof o === "object") ? (o.page_name || o.etiqueta || o.id) : (porId(o)?.page_name || o)).slice(0, 3).join(", ");
    const prog = (p.progreso || []).slice().sort((a, b) => String(b.t).localeCompare(String(a.t)));
    const trab = ["pendiente", "trabajando", "lanzando"].includes(p.estado);
    return `<article class="ped${p.id === B.ultimoPedido ? " destello abierto" : ""} ped-${esc(p.estado)}" id="ped-${esc(p.id)}">
      <div class="ped-cab"><span class="ped-id num">#${esc(p.id)}</span>
        <span class="ped-txt"><b>${esc(TIPO_TX[pr.modo || pr.tipo] || pr.modo || "Modelar")} · ${esc(MERC_TX[pr.mercado] || pr.mercado || "")}${pr.prueba ? " · prueba" : ""}</b><small>${pl(nOf, "oferta")}${nombres ? `: ${esc(nombres)}${nOf > 3 ? "…" : ""}` : ""} · ${esc(fechaHora(p.creado))}${pr.quien ? ` · ${esc(pr.quien)}` : ""}</small></span>
        <span class="fchip ${col}">${trab ? '<span class="cargador mini" aria-hidden="true"></span>' : ""}${esc(et)}</span></div>
      ${prog.length ? `<div class="ped-det"><ol class="ped-tl">${prog.slice(0, 4).map((x) => `<li class="tl-${esc(x.etapa)}"><span class="ped-h num">${esc(hora(x.t))}</span><span class="tl-tx">${esc(x.texto || x.etapa)}</span></li>`).join("")}</ol>
        ${prog.length > 4 ? `<details class="log"><summary>${pl(prog.length - 4, "paso anterior", "pasos anteriores")}</summary><ol class="ped-tl">${prog.slice(4).map((x) => `<li class="tl-${esc(x.etapa)}"><span class="ped-h num">${esc(hora(x.t))}</span><span class="tl-tx">${esc(x.texto || x.etapa)}</span></li>`).join("")}</ol></details>` : ""}
        ${p.estado === "listo_revisar" ? `<div class="botones"><button type="button" class="btn pri chico" data-dale="${esc(p.id)}">Dar el dale (activar)${pr.prueba ? " · prueba" : ""}</button></div>` : ""}
        ${pr.hora_inicio ? `<p class="ped-params">Inicio ${esc(legible(pr.hora_inicio))} ${esc(pr.hora_inicio_tz || "")}${pr.hora_inicio_ar ? ` · ${esc(legible(pr.hora_inicio_ar))} AR` : ""} · ${esc((pr.paises || []).join(", "))}</p>` : ""}</div>` : ""}
    </article>`;
  }).join("")}</div>`;
  $$("[data-dale]", box).forEach((b) => b.onclick = () => darDale(b.dataset.dale, b));
}
// (11/10) «Dar el dale»: pasa el pedido a «lanzar» (misma acción que «Publicar» del Ranking). La Mac activa SOLO lo de ese pedido.
async function darDale(id, btn) {
  if (!confirmarDale(id)) return;
  btn.disabled = true;
  try {
    if (DEMO) { toast(`Demo: el pedido #${esc(id)} pasaría a activarse.`, "ok"); return; }
    const r = await fetch(`https://tppcpnfzcxxusdhrlmdx.supabase.co/functions/v1/app-movil?accion=fabrica_lanzar`, { method: "POST", headers: { "x-app-clave": clave(), "content-type": "application/json" }, body: JSON.stringify({ id: Number(id) }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || `Error ${r.status}`);
    toast(`✓ Dale enviado: la compu activa los testeos del pedido #${esc(id)}.`, "ok", 7000);
    cargarPedidos();
  } catch (e) { toast(`No se pudo: ${esc(e.message)}`, "error", 7000); btn.disabled = false; }
}
function confirmarDale(id) { try { return window.confirm(`¿Activar en Meta los testeos del pedido #${id}? (es tu dale)`); } catch { return true; } }
const hora = (iso) => { try { return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ_AR }); } catch { return "—"; } };

// ---------- barra flotante ----------
function pintarBarra() {
  const b = $("#barra");
  const n = B.sel.size;
  if (!n || !B.datos) { b.hidden = true; b.innerHTML = ""; return; }
  const ya = !b.hidden;
  b.hidden = false;
  b.className = "barra boceto bo-barra";
  b.style.animation = ya ? "none" : "";
  b.innerHTML = `<div class="cuenta"><span class="num">${n}</span> seleccionada${n === 1 ? "" : "s"}<small>${B.vista === "seleccionadas" ? "listas para modelar" : `<button type="button" class="link bo-ver-sel" id="bo-ver-sel">ver</button>`}</small></div>
    <button type="button" class="btn chico" id="bo-limpiar" aria-label="Limpiar la selección">✕ limpiar</button>
    <span class="sp"></span>
    <button type="button" class="btn pri" id="bo-modelar">Modelar</button>`;
  $("#bo-limpiar").onclick = () => { B.sel.clear(); guardarSel(); pintar(); };
  $("#bo-modelar").onclick = modelar;
  const v = $("#bo-ver-sel"); if (v) v.onclick = () => irA("seleccionadas");
}

// ---------- pop-up Modelar ----------
function modelar() {
  const elegidas = [...B.sel].map(porId).filter(Boolean);
  if (!elegidas.length) return toast("Elegí al menos una oferta.", "error");
  const P = { tipo: "tal_cual", mercado: "anglo", paises: [...MERCADOS_MOD[0][2]], idioma: "en", prueba: dryOn() || DEMO, manual: false, hora: null };
  const recalcular = () => { if (!P.manual || !P.hora) P.hora = horaPorDefecto(P.paises); else { const z = masAdelantado(P.paises); const r = aAR(z.tz, P.hora.local); P.hora = { ...z, local: P.hora.local, ar: r ? r.ar : "", instante: r?.instante }; } };
  recalcular();
  let enviando = false;
  const m = abrirModal("", { ancho: true, bloqueado: () => enviando });
  const segs = (attr, xs, actual, label) => `<div class="segs" role="group" aria-labelledby="${label}">${xs.map(([k, t]) => `<button type="button" class="seg-b" ${attr}="${k}" aria-pressed="${k === actual}">${esc(t)}</button>`).join("")}</div>`;
  const restantes = () => Object.keys(ZONA).filter((c) => !P.paises.includes(c)).sort();
  const pintarM = () => {
    const h = P.hora;
    const pasado = h.instante && h.instante.getTime() < Date.now();
    m.set(`<h3>Modelar ${pl(elegidas.length, "oferta")}</h3>
      <ul class="bo-m-ofs">${elegidas.map((o) => `<li><b>${esc(o.page_name)}</b> <span class="mut">${esc(o.producto)}</span></li>`).join("")}</ul>
      <fieldset class="w-campo"><legend id="lg-tipo">Qué armar</legend>${segs("data-tipo", TIPOS, P.tipo, "lg-tipo")}</fieldset>
      <fieldset class="w-campo"><legend id="lg-mk">Mercado</legend>${segs("data-mk", MERCADOS_MOD.map(([k, t]) => [k, t]), P.mercado, "lg-mk")}</fieldset>
      <fieldset class="w-campo"><legend id="lg-pa">Países <span class="w-ayuda">tocá ✕ para sacar uno</span></legend>
        <ul class="bo-paises" aria-labelledby="lg-pa">${P.paises.map((c) => `<li class="bo-pais"><span class="num">${esc(c)}</span><button type="button" data-qp="${esc(c)}" aria-label="Sacar ${esc(c)}" ${P.paises.length === 1 ? "disabled" : ""}>✕</button></li>`).join("")}
          <li class="bo-pais-add"><label class="sr" for="m-add">Agregar país</label><select class="campo" id="m-add"><option value="">+ país</option>${restantes().map((c) => `<option value="${c}">${c}</option>`).join("")}</select></li></ul>
      </fieldset>
      <fieldset class="w-campo"><legend id="lg-id">Idioma</legend>${segs("data-id", IDIOMAS, P.idioma, "lg-id")}</fieldset>
      <div class="w-campo"><label class="w-lbl" for="m-hora">Hora de inicio <span class="w-ayuda">hora local de ${esc(h.pais)} (${esc(h.tz)}), el país más adelantado</span></label>
        <input class="campo num bo-hora" id="m-hora" type="datetime-local" value="${esc(h.local)}" step="60">
        <p class="bo-ar num" id="m-ar">${h.ar ? `= <b>${esc(legible(h.ar))}</b> en Argentina` : "Hora inválida"}${P.manual ? ` · <button type="button" class="link" id="m-reset">volver a 05:00</button>` : ""}</p>
        ${pasado ? `<p class="bo-mal" role="alert">Esa hora ya pasó.</p>` : ""}
      </div>
      <label class="bo-prueba"><input type="checkbox" id="m-prueba" ${P.prueba ? "checked" : ""}><span>Pedido de prueba (no lanza nada)</span></label>
      <p class="bo-pausa"><b>La campaña queda programada y EN PAUSA hasta tu dale. El pedido no activa nada solo.</b></p>
      ${DEMO ? `<p class="mut">Demo: el pedido se simula, no va a ninguna compu.</p>` : ""}
      ${B.compu && !B.compu.prendida ? `<p class="hint error">La compu figura apagada: el pedido puede rebotar.</p>` : ""}
      <div class="err-box" id="m-err" role="alert" hidden></div>
      <div class="botones"><button type="button" class="btn" data-x>Cancelar</button><button type="button" class="btn pri" data-ok data-foco>Confirmar</button></div>`);
    const d = m.dlg;
    $("[data-x]", d).onclick = m.cerrar;
    $$("[data-tipo]", d).forEach((b) => b.onclick = () => { P.tipo = b.dataset.tipo; pintarM(); $(`[data-tipo="${P.tipo}"]`, d).focus(); });
    $$("[data-mk]", d).forEach((b) => b.onclick = () => {
      const mk = MERCADOS_MOD.find((x) => x[0] === b.dataset.mk);
      P.mercado = mk[0]; P.paises = [...mk[2]]; P.idioma = mk[3]; recalcular(); pintarM(); $(`[data-mk="${P.mercado}"]`, d).focus();
    });
    $$("[data-qp]", d).forEach((b) => b.onclick = () => { if (P.paises.length < 2) return; P.paises = P.paises.filter((c) => c !== b.dataset.qp); recalcular(); pintarM(); ($("#m-add", d)).focus(); });
    $("#m-add", d).onchange = (e) => { const c = e.target.value; if (!c) return; P.paises.push(c); recalcular(); pintarM(); $("#m-add", d).focus(); };
    $$("[data-id]", d).forEach((b) => b.onclick = () => { P.idioma = b.dataset.id; pintarM(); $(`[data-id="${P.idioma}"]`, d).focus(); });
    $("#m-hora", d).onchange = (e) => {
      const v = e.target.value;
      const r = aAR(P.hora.tz, v);
      P.manual = true;
      P.hora = { ...P.hora, local: v, ar: r ? r.ar : "", instante: r?.instante };
      pintarM(); $("#m-hora", d).focus();
    };
    const rs = $("#m-reset", d); if (rs) rs.onclick = () => { P.manual = false; recalcular(); pintarM(); $("#m-hora", d).focus(); };
    $("#m-prueba", d).onchange = (e) => { P.prueba = e.target.checked; };
    $("[data-ok]", d).onclick = (ev) => enviar(ev.currentTarget);
  };
  const enviar = async (btn) => {
    const err = $("#m-err", m.dlg);
    const mostrarErr = (t) => { err.hidden = false; err.textContent = t; err.scrollIntoView({ block: "nearest", behavior: reducido() ? "auto" : "smooth" }); };
    if (!P.hora.local || !P.hora.ar) return mostrarErr("Poné una hora de inicio válida.");
    if (P.hora.instante && P.hora.instante.getTime() < Date.now()) return mostrarErr("La hora de inicio ya pasó: elegí una futura.");
    if (!P.paises.length) return mostrarErr("Elegí al menos un país.");
    const body = {
      ofertas: elegidas.map((o) => String(o.id)), tipo: P.tipo, mercado: P.mercado, paises: P.paises, idioma: P.idioma,
      hora_inicio: P.hora.local, hora_inicio_tz: P.hora.tz, hora_inicio_ar: P.hora.ar,
      prueba: !!P.prueba, quien: ls.get("dash_quien") || "Lorenzo",
    };
    enviando = true;
    btn.classList.add("cargando"); btn.innerHTML = `<span class="gira">↻</span> Enviando…`;
    $("[data-x]", m.dlg).disabled = true;
    try {
      const r = await api("modelar", { body });
      enviando = false;
      m.cerrar();
      B.ultimoPedido = r?.id ?? null;
      toast(`✓ Pedido <b>#${esc(r?.id ?? "?")}</b> enviado${body.prueba ? " (de prueba)" : ""}. Queda en pausa hasta tu dale.`, "ok", 7000);
      B.sel.clear(); guardarSel();
      irA("seleccionadas");
      await cargarPedidos();
      const el = r?.id != null && $(`#ped-${CSS.escape(String(r.id))}`);
      if (el) el.scrollIntoView({ block: "center", behavior: reducido() ? "auto" : "smooth" });
    } catch (e) {
      enviando = false;
      btn.classList.remove("cargando"); btn.textContent = "Confirmar";
      $("[data-x]", m.dlg).disabled = false;
      if (e.code === 401) { m.cerrar(); ls.del("dash_clave"); return login("Clave incorrecta"); }
      mostrarErr(e.code === 409 ? `La compu está apagada: prendela y volvé a confirmar.${e.message && e.message !== "Error 409" ? ` (${e.message})` : ""}` : `No se pudo mandar el pedido: ${e.message}`);
    }
  };
  pintarM();
}

// ---------- navegación ----------
function irA(v) {
  B.vista = v;
  try { history.replaceState(null, "", `${location.pathname}${location.search}#${v}`); } catch {}
  pintar();
  if (v === "seleccionadas") { cargarPedidos(); arrancarRefresco(); } else pararRefresco();
  window.scrollTo({ top: 0, behavior: "auto" });
}

// ---------- arranque ----------
function iniciar() {
  pintarTema();
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", pintarTema);
  $("#b-tema").onclick = alternarTema;
  $("#b-ref").onclick = () => { if (!B.cargando) cargar(); };
  $$("#tabs [data-vista]").forEach((b) => b.onclick = () => irA(b.dataset.vista));
  const h = location.hash.slice(1);
  if (["ganadoras", "oportunidades", "seleccionadas"].includes(h)) B.vista = h;
  let eraAncho = ancho();
  addEventListener("resize", () => { const a = ancho(); if (a !== eraAncho) { eraAncho = a; if (B.vista === "ganadoras" && B.datos) pintarListaGanadoras(); } });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && B.vista === "seleccionadas" && B.datos) cargarPedidos(); });
  addEventListener("storage", (e) => { if (e.key === "buscador_sel") { B.sel.clear(); try { (JSON.parse(e.newValue || "[]") || []).forEach((x) => B.sel.add(String(x))); } catch {} pintar(); } });
  if (!DEMO && !clave()) return login();
  cargar();
  if (B.vista === "seleccionadas") arrancarRefresco();
}
iniciar();

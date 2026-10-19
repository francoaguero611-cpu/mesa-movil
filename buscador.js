/* Cazador (antes «Buscador de ofertas») — sección del Dashboard desde el 11/10. Sin build ni dependencias.
   app.js lo carga la primera vez que se entra a la sección y lo monta con window.Cazador.montar(raiz, ctx).
   Ofertas: Edge Function buscador-ofertas (la mantiene otro agente; contrato en scripts/buscador-ofertas/CONTRATO.md).
   Pedidos de testeo, dale, cancelar: Edge Function app-movil (testeo_pedidos, testeo_pedido, fabrica_lanzar/cancelar/eliminar).
   Etapas que reporta la fábrica: ~/Trabajo/VSL Funnel Local/fabrica/pedidos/ETAPAS-TESTEO.md.
   (11/10 tarde, v2) grilla de 4/2 columnas con video arriba, filtros, selección por mercado, Modelar con estructura y
   presupuesto, y paso a paso en vivo del pedido. Backup del anterior: buscador.js.bak-cazador2. */
"use strict";
(() => {
// (13/10) Búsqueda sin importar tildes ni mayúsculas, y con 1 letra de error en palabras de 4+ letras («40 dais» encuentra «40 Días»)
const sinTilde = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function casi(a, b) { // a lo sumo 1 cambio: letra distinta, de más, de menos o dos letras cruzadas
  if (a === b) return true;
  const la = a.length, lb = b.length; if (Math.abs(la - lb) > 1) return false;
  let i = 0; while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}
function coincide(q, ...textos) {
  const t = sinTilde(textos.join(" ")), pals = t.split(/[^a-z0-9]+/).filter(Boolean);
  return sinTilde(q).split(/\s+/).filter(Boolean).every((w) => t.includes(w)
    || (w.length >= 4 && pals.some((p) => casi(w, p) || (p.length > w.length && casi(w, p.slice(0, w.length))))));
}
let CTX = { login: () => {} };     // lo pasa app.js al montar

const API = "https://tppcpnfzcxxusdhrlmdx.supabase.co/functions/v1/buscador-ofertas";
const API_MOVIL = "https://tppcpnfzcxxusdhrlmdx.supabase.co/functions/v1/app-movil";
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
const NF2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ent = (n) => NF0.format(n || 0);
const pl = (n, s, p = s + "s") => `${ent(n)} ${n === 1 ? s : p}`;
const clave = () => ls.get("dash_clave", "");
const dryOn = () => ls.get("dash_dry") === "1";
const reducido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const num = (x) => { const n = Number(x); return x === null || x === undefined || x === "" || !Number.isFinite(n) ? null : n; };
// Solo URLs http(s) en href/src (los datos vienen de afuera).
const url = (u) => /^https?:\/\//i.test(String(u || "")) || /^data:image\//i.test(String(u || "")) ? String(u) : "";
const dmy = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ""); return m ? `${+m[3]}/${+m[2]}` : "sin fecha"; };
const fechaHora = (iso) => { try { return new Date(iso).toLocaleString("es-AR", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ_AR }); } catch { return ""; } };
const hora = (iso) => { try { return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ_AR }); } catch { return ""; } };
function hace(iso) {
  const t = new Date(iso).getTime(); if (!isFinite(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "recién";
  const m = Math.round(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24); return `hace ${d} día${d === 1 ? "" : "s"}`;
}
// presupuesto: siempre terminado en ,55 (memoria reglas-fijas-campanas-meta)
const a55 = (v) => { const n = Number(String(v ?? "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) && n >= 1 ? Math.floor(n) + 0.55 : null; };
const plata = (n, mon = "USD") => mon === "EUR" ? `${NF2.format(n)} €` : `US$ ${NF2.format(n)}`;
const FLECHA = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 17 C 10 14, 13 11, 16.5 7.5 M9 7.2 C 11.5 7, 14 7, 16.8 7.2 C 17 10, 17 12.5, 16.8 15" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const SVG_PLAY = `<svg viewBox="0 0 48 48" aria-hidden="true"><path class="pl-c" d="M24 4 C 36 4, 44 12, 44 24 C 44 36, 36 44, 24 44 C 12 44, 4 36, 4 24 C 4 13, 12 4, 26 5"/><path class="pl-t" d="M19 15 C 19 21, 19 27, 19.5 33 C 25 30, 30 27, 34 24 C 29 21, 24 18, 19 15 Z"/></svg>`;

// ---------- formatos y mercados ----------
// formato lo trae el backend (Lorenzo no lo marca): vsl | vsl_tsl | tsl | quiz | quiz_vsl | desconocido
const FORMATO_TX = { vsl: "VSL", vsl_tsl: "VSL + TSL", tsl: "TSL", quiz: "Quiz", quiz_vsl: "Quiz + VSL", desconocido: "Sin dato" };
const FORMATO_VIEJO = { landing: "tsl", whatsapp: "desconocido" };        // datos de antes del contrato nuevo
const ORDEN_MK = ["anglo", "latam", "br", "ar", "eu", "es", "fr", "it", "de", "mx", "us"];
const NOMBRE_MK = { anglo: "Anglo", latam: "LATAM", br: "Brasil", ar: "Argentina", eu: "Europa", es: "España", fr: "Francia", it: "Italia", de: "Alemania", mx: "México", us: "EE. UU." };
const CORTO = { anglo: "Anglo", latam: "LATAM", br: "BR", ar: "AR", eu: "EU", es: "ES", fr: "FR", it: "IT", de: "DE", mx: "MX", us: "US" };
// destinos para modelar: [clave, nombre, países, idioma, moneda, precio] (precio: memoria precio-principal-por-poder-adquisitivo)
const MERCADOS_MOD = [
  ["anglo", "Anglo", ["US", "GB", "CA", "AU", "NZ", "IE"], "en", "USD", 24.99],
  ["latam", "LATAM", ["AR", "MX", "CO", "CL", "PE", "EC", "UY", "PY", "BO", "CR", "DO", "GT", "HN", "NI", "PA", "SV", "VE", "ES", "US"], "es", "USD", 19.99],
  ["br", "Brasil", ["BR"], "pt", "USD", 19.99],
  ["ar", "Argentina", ["AR"], "es", "USD", 19.99],
  ["es", "España", ["ES"], "es", "EUR", 24.99],
  ["fr", "Francia", ["FR"], "fr", "EUR", 24.99],
  ["it", "Italia", ["IT"], "it", "EUR", 24.99],
  ["de", "Alemania", ["DE"], "de", "EUR", 24.99],
];
const MOD = Object.fromEntries(MERCADOS_MOD.map((m) => [m[0], m]));
const PAIS_MK = { US: "anglo", GB: "anglo", CA: "anglo", AU: "anglo", NZ: "anglo", IE: "anglo", BR: "br", AR: "ar", FR: "fr", IT: "it", DE: "de", AT: "de", CH: "de", ES: "es" };
const BANDERA = { anglo: "🌎", latam: "🌎", eu: "🇪🇺", br: "🇧🇷", ar: "🇦🇷", es: "🇪🇸", fr: "🇫🇷", it: "🇮🇹", de: "🇩🇪", mx: "🇲🇽", us: "🇺🇸", gb: "🇬🇧", pt: "🇵🇹" };
const bandera = (k) => BANDERA[k] || (/^[a-z]{2}$/.test(k) ? String.fromCodePoint(...[...k.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "");
const IDIOMAS = [["en", "Inglés"], ["es", "Español"], ["pt", "Portugués"], ["fr", "Francés"], ["it", "Italiano"], ["de", "Alemán"]];
const ESTRUCTURAS = [
  ["cbo_115", "CBO madre 1-1-5", "1 campaña CBO, 1 conjunto con todos los creativos. Lo de hoy para cada testeo.", true],
  ["cbo_madre", "CBO madre", "1 campaña CBO con un conjunto por creativo: Meta reparte el presupuesto entre conjuntos.", false],
  ["abo_151", "ABO 1-5-1", "1 campaña ABO, un conjunto por creativo con 1 anuncio cada uno. El presupuesto va por conjunto.", false],
];
const PRES_DEF = { cbo_115: 30.55, cbo_madre: 30.55, abo_151: 10.55 };
const CUENTAS = [["testeos", "TESTEOS"], ["galileo", "Galileo"]];
const ZONA = {
  US: "America/New_York", GB: "Europe/London", CA: "America/Toronto", AU: "Australia/Sydney", NZ: "Pacific/Auckland", IE: "Europe/Dublin",
  BR: "America/Sao_Paulo", AR: TZ_AR, MX: "America/Mexico_City", CO: "America/Bogota", CL: "America/Santiago", PE: "America/Lima",
  EC: "America/Guayaquil", UY: "America/Montevideo", PY: "America/Asuncion", BO: "America/La_Paz", CR: "America/Costa_Rica",
  DO: "America/Santo_Domingo", GT: "America/Guatemala", HN: "America/Tegucigalpa", NI: "America/Managua", PA: "America/Panama",
  SV: "America/El_Salvador", VE: "America/Caracas", ES: "Europe/Madrid", FR: "Europe/Paris", IT: "Europe/Rome", DE: "Europe/Berlin",
  PT: "Europe/Lisbon", NL: "Europe/Amsterdam", BE: "Europe/Brussels", AT: "Europe/Vienna", CH: "Europe/Zurich",
};
const ESTADOS = {
  pendiente: ["En cola", ""], trabajando: ["Trabajando", "amarillo"], listo_revisar: ["Esperando tu dale", "verde-fuerte"],
  lanzar: ["Activando", "acento"], lanzando: ["Activando", "acento"], lanzado: ["Lanzado", "verde"],
  error: ["Error", "rojo"], cancelado: ["Cancelado", ""],
};
const ACTIVOS = ["pendiente", "trabajando", "lanzar", "lanzando"];
// Etapas del testeo (iguales a ETAPAS_TESTEO de app-movil)
const PASOS = [
  ["oferta", "Oferta modelada"], ["landing", "Landing creada"], ["pixel", "Pixel"], ["tracking", "Tracking y CAPI"], ["dominio", "Dominio verificado"],
  ["guiones", "Guiones"], ["videos", "Videos"], ["drive", "Anuncios en Drive"], ["campana", "Campaña armada"], ["lista", "Lista para el dale"], ["lanzada", "Lanzada"],
];
const IDX = Object.fromEntries(PASOS.map(([k], i) => [k, i]));
const ALIAS = { tienda: "landing", creativos: "videos", iteraciones: "videos", renovaciones: "videos", capi: "tracking", utmify: "tracking", lanzando: "lanzada", chequeo_10min: "lanzada" };
const EN_CURSO_RE = /empez|arranc|armando|leyendo|diseñando|haciendo|subiendo|esperando|creando|bajando|render(?!izad)/i;

// ---------- horas (Intl, sin librerías) ----------
const partes = (tz, d) => {
  const o = {};
  for (const p of new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(d)) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second };
};
const offsetMin = (tz, d) => { const p = partes(tz, d); return Math.round((Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(d.getTime() / 1000) * 1000) / 60000); };
function instanteDe(tz, y, m, d, h, mi) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let t = guess - offsetMin(tz, new Date(guess)) * 60000;
  t = guess - offsetMin(tz, new Date(t)) * 60000;
  return new Date(t);
}
const pad = (n) => String(n).padStart(2, "0");
const localISO = (tz, d) => { const p = partes(tz, d); return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`; };
const legible = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(iso || ""); return m ? `${+m[3]}/${+m[2]} ${m[4]}` : ""; };
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
// 05:00 local del país más adelantado, del día siguiente (calendario de Argentina). Si ya pasó, al otro día. (hora-inicio-multipais)
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
// (12/10, v3) filtros como dice Santi: solo winners (≥ 45 anuncios, ≥ 7 días, mismo funnel), solo digitales y libros físicos,
// sin marcas personales, ordenadas por nicho (plata extra > prosperidad > salud > peso > relaciones > …) y adentro de mejor a peor.
const CLASES = [["digital", "Digital"], ["libro_fisico", "Libro físico"], ["app", "App"], ["suplemento", "Suplemento"], ["fisico", "Físico"],
  ["servicio", "Servicio"], ["captacion", "Webinar / captación"], ["desconocido", "Sin clasificar"]];
const CLASE_TX = Object.fromEntries(CLASES);
const ORIGENES = ["br", "latam", "ar", "mx", "es"];
const DESTINOS = ["anglo", "fr", "it", "de", "ro", "pl", "eu"];   // los que pidió Lorenzo (12/10); nórdicos, NL y PT no suman
const CLASES_DEF = ["digital", "libro_fisico"];
// Orden de Santi (criterios_santi.py VERTICALES)
const VERTICALES = [["plata_extra", "Plata extra"], ["prosperidad", "Prosperidad y manifestación"], ["salud", "Salud"], ["peso", "Bajar de peso"],
  ["relaciones", "Relaciones, maternidad y TDAH"], ["educacion", "Educación"], ["fitness", "Fitness"], ["religion", "Religión"], ["psicologia", "Psicología"], ["otro", "Otros nichos"]];
const VERT_TX = Object.fromEntries(VERTICALES);
const vertIdx = (k) => { const i = VERTICALES.findIndex(([x]) => x === k); return i < 0 ? VERTICALES.length : i; };
// (12/10 noche, v4, Lorenzo: «no tan filtrado, con más cantidad»): sin el preset estricto; 30–800 anuncios (más de 1.000 = marca
// muy explotada), todos los anuncios a la misma landing, digital/libro físico, sin marcas personales; por nicho y adentro lo mejor para EXPORTAR.
// (19/10) listas armadas por Claude: con la lista activa se ven SOLO esas ofertas (los demás filtros no cuentan). Link directo: ?lista=<clave>
const LISTAS = { "br-1910": { nombre: "Brasil digitales 19/10 (+40 anuncios, web, sin WhatsApp)", ids: ["wvltrack.com", "calisteniaasiaticavslbr.lovable.app", "floripacalistenia.com.br", "desafiodrrenanbotelho.com.br", "vkdigital.com.br", "girrecroche.com.br", "app-helenaastrologia.online", "pagarfy.pages.dev", "caseirinhossaudaveis.com", "inlead.digital", "mvkiids.com.br", "oracaodosorixas.netlify.app", "lucianofernandesif.com.br", "trocadefaixajudo.com.br", "trocadefaixajudo.netlify.app", "jejumreset.online", "menovida.com.br", "institutosaudeancestral.com.br", "minhafase.com", "desafiodajessicaoliveira.com.br", "lancamentosdigital.com", "skeap.com.br", "divinalstudio.com.br", "metodocolunasaudavel.com", "pedagogiacomcristo.com", "institutocdt.com.br", "codigometabolico.pro", "mulheresgerandovalor.com.br", "lkrausche.com", "ingleselisato.com.br", "bonecasfofas.online", "maletadafonoinfantil.site", "receitasok.shop", "biancahonoriosda.com", "vivasemprecomdinheiro.com.br", "sopinha-julianasouza.lovable.app", "louvores-sem-parar.vercel.app", "metodolucrativo.online", "smarthealthhub.online", "protocolobarrigafechada.com.br", "kinusaigastudio.online", "chagratis.shop", "pilates-em-casa-one.vercel.app", "rdf-5-motivos.lovable.app", "gamma.app", "panetonesmagicos.com.br", "secajejumturbo21.vercel.app", "natalbrilhante.online", "milenaxaviernutri.com.br"] } };
const FILTRO_DEF = { q: "", min: 30, max: 800, mercado: "todos", formatos: [], dmin: null, dmax: null, orden: "nicho", v: 4,
  santi: false, funnel: true, clases: [...CLASES_DEF, "desconocido"], marcas: false, verticales: [] };
const B = {
  vista: "ofertas",               // ofertas (una sola grilla, con las oportunidades adentro) | testeos («Seleccionadas»)
  datos: null, cargando: false, error: null,
  sel: new Map(),                 // id -> clave de mercado destino («2 de Anglo, 3 de LATAM»)
  filtro: { ...FILTRO_DEF },
  filtrosAbiertos: false,
  pedidos: null, compu: null, pedErr: null, pedT: 0,
  abierto: null,                  // id del pedido que se está mirando (paso a paso)
  timer: null,
};
try {
  const v = JSON.parse(ls.get("buscador_sel", "[]"));
  if (Array.isArray(v)) v.forEach((x) => Array.isArray(x) ? B.sel.set(String(x[0]), x[1] || null) : B.sel.set(String(x), null));
} catch {}
try {
  const f = JSON.parse(ls.get("caz_filtro", "null"));
  if (f && typeof f === "object") {
    B.filtro = { ...FILTRO_DEF, ...f, formatos: Array.isArray(f.formatos) ? f.formatos : [] };
    if (f.v !== FILTRO_DEF.v) B.filtro = { ...FILTRO_DEF };  // filtros guardados de antes de la v4: arrancan de cero
    if (!Array.isArray(B.filtro.clases)) B.filtro.clases = CLASES_DEF;
    if (!Array.isArray(B.filtro.verticales)) B.filtro.verticales = [];
  }
} catch {}
if (LISTAS[URLP.get("lista")]) { B.filtro.lista = URLP.get("lista"); B.filtro.orden = "anuncios"; }
const guardarSel = () => ls.set("buscador_sel", JSON.stringify([...B.sel.entries()]));
const guardarFiltro = () => ls.set("caz_filtro", JSON.stringify(B.filtro));

// ---------- API ----------
async function llamar(base, accion, body) {
  let r;
  try {
    r = await fetch(`${base}?accion=${accion}`, {
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
const api = (accion, { body = null } = {}) => DEMO ? demoApi(accion, body) : llamar(API, accion, body);
const apiMovil = (accion, { body = null } = {}) => DEMO ? demoApi(accion, body) : llamar(API_MOVIL, accion, body);

// ---------- normalización: campos del contrato nuevo, con lo de hoy como respaldo ----------
const cacheNorm = new WeakMap();
function norm(o) {
  if (cacheNorm.has(o)) return cacheNorm.get(o);
  const act = o.activos && typeof o.activos === "object" ? o.activos : {};
  const porMk = o.anuncios_por_mercado && typeof o.anuncios_por_mercado === "object" ? o.anuncios_por_mercado : act;
  const mkKey = (k) => String(k || "").toLowerCase();
  let mercados = Array.isArray(o.mercados) ? o.mercados.map((m) => mkKey(typeof m === "object" ? (m.clave || m.id || m.mercado) : m)).filter(Boolean)
    : Object.keys(porMk).filter((k) => num(porMk[k]) > 0).map(mkKey);
  mercados = [...new Set(mercados)].sort((a, b) => (ORDEN_MK.indexOf(a) + 99) % 99 - (ORDEN_MK.indexOf(b) + 99) % 99);
  // paises[]: strings ISO («MX») o, si el backend los manda con conteo, objetos {pais|cc|codigo, anuncios|n}
  const paisesN = {};
  const paises = (Array.isArray(o.paises) ? o.paises : []).map((p) => {
    if (p && typeof p === "object") { const c = String(p.pais || p.cc || p.codigo || p.code || p.country || "").toUpperCase(); const k = num(p.anuncios ?? p.n ?? p.activos ?? p.count); if (c && k != null) paisesN[c] = k; return c; }
    return String(p).toUpperCase();
  }).filter((p) => /^[A-Z]{2}$/.test(p));
  // (11/10) mercados_detalle: {MERCADO: {CC: n}} (anuncios por país dentro de cada mercado)
  const detalle = {};
  if (o.mercados_detalle && typeof o.mercados_detalle === "object") for (const [mk, xs] of Object.entries(o.mercados_detalle)) {
    if (!xs || typeof xs !== "object") continue;
    const lista = Object.entries(xs).map(([c, k]) => [String(c).toUpperCase(), num(k)]).filter(([c]) => /^[A-Z]{2}$/.test(c));
    if (lista.length) detalle[mkKey(mk)] = lista;
  }
  const paginas = Array.isArray(o.paginas) && o.paginas.length
    ? o.paginas.map((p) => typeof p === "string" ? { nombre: p } : { id: p.id ?? p.page_id, nombre: p.nombre ?? p.name ?? p.page_name, pic: p.pic ?? p.page_pic ?? p.foto })
    : (o.page_name || o.page_id ? [{ id: o.page_id, nombre: o.page_name, pic: o.page_pic }] : []);
  const desde = o.activa_desde || o.activo_desde || null;
  let dias = num(o.dias_corriendo) ?? num(o.dias_activa);
  if (dias == null && desde) { const t = Date.parse(String(desde).slice(0, 10) + "T12:00:00Z"); if (isFinite(t)) dias = Math.max(0, Math.round((Date.now() - t) / 86400e3)); }
  const v = o.video_top || o.video || (Array.isArray(o.videos_top) ? o.videos_top[0] : null) || null;
  const video = v ? { src: url(v.url || v.src || v.s3), poster: url(v.miniatura || v.poster || v.thumbnail), usos: num(v.collation_count ?? v.usos ?? v.anuncios) } : null;
  const f = String(o.formato || "").toLowerCase();
  const formato = FORMATO_TX[f] ? f : (FORMATO_VIEJO[f] || "desconocido");
  const anuncios = num(o.anuncios_activos) ?? num(o.activos_total) ?? 0;
  // mercado principal: el de más anuncios (o el primero)
  let principal = mercados[0] || null, mx = -1;
  for (const k of mercados) { const n = num(porMk[k]); if (n != null && n > mx) { mx = n; principal = k; } }
  const n = {
    id: String(o.id), nombre: o.nombre || o.producto || o.page_name || o.dominio || String(o.id),
    marca: o.page_name || paginas[0]?.nombre || "", pic: url(o.page_pic || paginas[0]?.pic),
    angulo: o.angulo || "", nicho: o.nicho || "", idioma: o.idioma || "",
    precio: o.precio ?? null, moneda: o.moneda || null,
    anuncios, porMk, mercados, paises, paisesN, detalle, paginas, desde, dias, video, formato, principal,
    landing: url(o.landing_url || o.landing), dominio: o.dominio || "",
    biblioteca: url(o.biblioteca_url), bibliotecaDom: url(o.biblioteca_dominio_url),
    oportunidades: [], puntaje: null, recomendado: null,
    // (12/10) tipo de producto (clasificar.py) y criterios de Santi (criterios_santi.py)
    clase: CLASE_TX[o.clase] ? o.clase : "desconocido", claseMotivo: o.clase_motivo || "", marcaPersonal: !!o.marca_personal,
    winner: !!(o.santi_winner ?? o.santi?.winner), vertical: VERT_TX[o.santi?.vertical] ? o.santi.vertical : "otro",
    puntajeSanti: num(o.puntaje_santi), funnel: o.santi?.cumple?.mismo_funnel !== false, funnelPct: num(o.santi?.mismo_funnel_pct), banderas: Array.isArray(o.santi?.banderas) ? o.santi.banderas : [], saludNota: o.santi?.salud_peso_nota || "",
  };
  // (11/10) oportunidades por mercado: {mercado, paises, paginas_competencia, anuncios_competencia, keywords_usadas, puntaje 0-100, motivo}.
  // Respaldo con el formato viejo {mercado, fuerte_en, activos_fuerte, activos_aca, nivel, texto}.
  const NIVEL = { alta: 80, media: 55, baja: 30 };
  n.oportunidades = (Array.isArray(o.oportunidades) ? o.oportunidades : []).filter((x) => x && x.mercado).map((x) => {
    const k = mkKey(x.mercado);
    const paginas = num(x.paginas_competencia), anuncios = num(x.anuncios_competencia) ?? num(x.activos_aca);
    const motivo = x.motivo || x.texto || [paginas != null ? `hay ${pl(paginas, "página")} vendiendo esto` : anuncios != null ? `hay ${pl(anuncios, "anuncio")} de este nicho` : "",
      x.fuerte_en ? `y la oferta escala fuerte en ${corto(mkKey(x.fuerte_en))}${num(x.activos_fuerte) != null ? ` (${pl(num(x.activos_fuerte), "anuncio")})` : ""}` : ""].filter(Boolean).join(" ");
    return { mercado: k, paises: Array.isArray(x.paises) ? x.paises : [], paginas, anuncios, keywords: Array.isArray(x.keywords_usadas) ? x.keywords_usadas : [],
      puntaje: num(x.puntaje) ?? NIVEL[x.nivel] ?? null, motivo, mismo: !!x.mismo_mercado };
  }).sort((a, b) => (b.puntaje ?? -1) - (a.puntaje ?? -1));
  n.puntaje = num(o.puntaje_oportunidad) ?? n.oportunidades[0]?.puntaje ?? null;
  // (12/10 noche) EXPORTAR (Lorenzo): ofertas de BR / LATAM / AR que no salieron de ahí, llevadas a anglo, Francia, Italia, Alemania,
  // Rumania, Polonia… donde la marca no pauta y hay poca competencia. Puntaje = mejor destino (competencia medida) + origen + pocos mercados.
  const dest = n.oportunidades.filter((x) => !x.mismo && DESTINOS.includes(x.mercado)).sort((a, b) => (b.puntaje ?? -1) - (a.puntaje ?? -1));
  const americano = n.mercados.length > 0 && n.mercados.every((k) => ORIGENES.includes(k));
  let ex = dest[0]?.puntaje ?? 0;
  if (americano) ex += 15;
  if (n.mercados.length === 1) ex += 10; else if (n.mercados.length === 2) ex += 5; else if (n.mercados.length >= 6) ex -= 15;
  if (n.anuncios >= 50 && n.anuncios <= 500) ex += 5;
  n.exportar = dest.length ? Math.max(0, Math.min(100, Math.round(ex))) : null;
  n.destino = dest[0] || null; n.americano = americano;
  n.recomendado = o.mercado_recomendado ? mkKey(o.mercado_recomendado) : n.oportunidades[0]?.mercado || null;
  cacheNorm.set(o, n);
  return n;
}
const ofertas = () => (B.datos?.ofertas || []).map(norm);
const porId = (id) => ofertas().find((o) => o.id === String(id));
const nombreMercado = (k) => NOMBRE_MK[k] || String((B.datos?.mercados || {})[k] || k).replace(/\s*\(.*\)$/, "");
const corto = (k) => CORTO[k] || String(k).toUpperCase();
// mercado de presencia -> mercado destino para modelar
function destinoDe(o, preferido = null) {
  const k = preferido || o.principal;
  if (MOD[k]) return k;
  if (k === "eu") { for (const p of o.paises) if (["FR", "IT", "DE", "ES"].includes(p)) return PAIS_MK[p]; return "es"; }
  if (k === "mx" || ["co", "cl", "pe", "ec", "uy", "py", "bo", "cr", "do", "gt", "hn", "ni", "pa", "sv", "ve"].includes(k)) return "latam";
  if (["gb", "ca", "au", "nz", "ie"].includes(k)) return "anglo";
  if (k === "at" || k === "ch") return "de";
  if (k === "us") return "anglo";
  for (const p of o.paises) if (PAIS_MK[p]) return PAIS_MK[p];
  return o.idioma && /^(es|espa)/i.test(o.idioma) ? "latam" : /^(pt|portu)/i.test(o.idioma) ? "br" : "anglo";
}

const nombreDestino = (k) => MOD[k]?.[1] || nombreMercado(k);
// «Te recomiendo Italia: hay solo 5 páginas vendiendo esto y la oferta no está ahí»
function recomendacion(o) {
  if (!o.recomendado) return null;
  const op = o.oportunidades.find((x) => x.mercado === o.recomendado);
  const mk = destinoDe(o, o.recomendado);
  return { mk, nombre: MOD[o.recomendado] ? nombreDestino(mk) : nombreMercado(o.recomendado), motivo: op?.motivo || "", puntaje: op?.puntaje ?? o.puntaje };
}

// ---------- demo ----------
let demoDatos = null;
const DEMO_PED = [];
const ahoraISO = (ms = 0) => new Date(Date.now() + ms).toISOString();
function demoPedidos() {
  if (DEMO_PED.length) return;
  const o = demoDatos.ofertas.map(norm);
  const mk = (of, mercado, extra = {}) => ({ id: of.id, etiqueta: of.marca || of.nombre, nombre: of.nombre, formato: of.formato, landing_url: of.landing,
    destino: { mercado, paises: MOD[mercado][2], idioma: MOD[mercado][3], precio: MOD[mercado][5], moneda: MOD[mercado][4], hora_inicio: "2026-10-12T05:00", hora_inicio_tz: "America/New_York", hora_inicio_ar: "2026-10-12T06:00" }, ...extra });
  const it = (min, etapa, texto, extra = {}) => ({ t: ahoraISO(-min * 60000), etapa, texto, ...extra });
  const A = mk(o[0], "anglo"), Bb = mk(o[2], "latam"), C = mk(o[1], "br"), D = mk(o[4], "anglo");
  const lnk = { landing: "https://walking-yoga-en.impultienda.com", drive: "https://drive.google.com/drive/folders/demo-walking", campana: "https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1950162628858779" };
  DEMO_PED.push(
    { id: 14, estado: "trabajando", creado: ahoraISO(-52 * 60000), quien: "Lorenzo",
      params: { tipo: "modelar", pedido: "testeo", estructura: "cbo_115", presupuesto: 30.55, creativos: 5, cuenta: "testeos", prueba: false, ofertas: [A, Bb] },
      progreso: [
        it(52, "inicio", "Pedido recibido desde el Cazador"), it(51, "inicio", "Arranqué a modelar 2 ofertas. Las campañas van a quedar EN PAUSA."),
        it(50, "oferta", "Leí la oferta: quiz de 12 preguntas que termina en plan + 5 videos top", { oferta: A.etiqueta, paso: "listo" }),
        it(41, "landing", "Tienda walking-yoga-en, US$ 24,99, checkout «Acceder ahora»", { oferta: A.etiqueta, paso: "listo", links: { landing: lnk.landing } }),
        it(37, "pixel", "Pixel 1126243803161942 nuevo, solo en la tienda", { oferta: A.etiqueta, paso: "listo" }),
        it(35, "tracking", "CAPI y UTMify conectados", { oferta: A.etiqueta, paso: "listo" }),
        it(33, "dominio", "walking-yoga-en.impultienda.com verificado", { oferta: A.etiqueta, paso: "listo" }),
        it(30, "oferta", "VSL de 14 min + 5 videos top", { oferta: Bb.etiqueta, paso: "listo" }),
        it(24, "guiones", "5 guiones apegados a los originales (hook con voz desde el cuadro 0)", { oferta: A.etiqueta, paso: "listo" }),
        it(20, "landing", "Tienda mente-millonaria-latam, US$ 19,99", { oferta: Bb.etiqueta, paso: "listo", links: { landing: "https://mente-millonaria.impultienda.com" } }),
        it(9, "pixel", "Meta frenó la creación del pixel (límite del Business). Reintento en 5 min.", { oferta: Bb.etiqueta, paso: "error" }),
        it(6, "videos", "Render en Lambda: 3 de 5 listos", { oferta: A.etiqueta, paso: "en_curso" }),
      ] },
    { id: 13, estado: "listo_revisar", creado: ahoraISO(-5 * 3600e3), quien: "Lorenzo", drive_url: lnk.drive,
      params: { tipo: "modelar", pedido: "testeo", estructura: "abo_151", presupuesto: 10.55, creativos: 5, cuenta: "testeos", prueba: false, ofertas: [C] },
      progreso: [it(300, "inicio", "Pedido recibido desde el Cazador"), ...PASOS.slice(0, 9).map(([k, t], i) => it(290 - i * 20, k, `${t}: hecho`, { oferta: C.etiqueta, paso: "listo",
        ...(k === "landing" ? { links: { landing: "https://receitas-vovo.impultienda.com" } } : k === "drive" ? { links: { drive: lnk.drive } } : k === "campana" ? { links: { campana: lnk.campana } } : {}) })),
        it(100, "lista", "Todo armado y EN PAUSA. Inicio 12/10 05:00 BR (05:00 AR).")] },
    { id: 11, estado: "lanzado", creado: ahoraISO(-30 * 3600e3), quien: "Franco",
      params: { tipo: "modelar", pedido: "testeo", estructura: "cbo_115", presupuesto: 30.55, creativos: 5, cuenta: "testeos", prueba: false, ofertas: [D] },
      progreso: [...PASOS.slice(0, 9).map(([k, t], i) => it(1800 - i * 30, k, `${t}: hecho`, { oferta: D.etiqueta, paso: "listo" })),
        it(1500, "lista", "Todo listo y EN PAUSA"), it(1300, "lanzada", "Activa y verificada", { oferta: D.etiqueta, paso: "listo", links: { campana: lnk.campana, landing: "https://bible-kids-3d.impultienda.com" } }),
        it(1290, "chequeo_10min", "Chequeo de los 10 min: todo ok")] },
  );
}
// pedido nuevo del demo: avanza solo, una etapa cada ~2,5 s por oferta
function demoAvanzar(p) {
  if (!p.sim) return;
  const pasos = PASOS.slice(0, 9);
  const ofs = p.params.ofertas;
  const total = ofs.length * pasos.length;
  const n = Math.floor((Date.now() - p.sim) / 1300);
  if (p.estado === "pendiente" && n > 1) p.estado = "trabajando";
  const hechos = p.progreso.filter((x) => x.sim).length;
  for (let i = hechos; i < Math.min(n, total * 2); i++) {
    const k = Math.floor(i / 2), en = i % 2 === 0;
    const of = ofs[k % ofs.length], [et, tx] = pasos[Math.floor(k / ofs.length)];
    const links = !en && et === "landing" ? { landing: "https://demo.impultienda.com" } : !en && et === "drive" ? { drive: "https://drive.google.com/drive/folders/demo" } : !en && et === "campana" ? { campana: "https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1950162628858779" } : null;
    p.progreso.push({ t: new Date().toISOString(), etapa: et, oferta: of.etiqueta, paso: en ? "en_curso" : "listo", texto: `${en ? "Haciendo" : "Listo"}: ${tx.toLowerCase()} (demo)`, sim: 1, ...(links ? { links } : {}) });
  }
  if (n >= total * 2 && p.estado === "trabajando") { p.estado = "listo_revisar"; p.progreso.push({ t: new Date().toISOString(), etapa: "lista", texto: "Todo armado y EN PAUSA hasta tu dale (demo)" }); p.sim = null; }
}
async function demoApi(accion, body) {
  await new Promise((ok) => setTimeout(ok, 300));
  if (!demoDatos) {
    const r = await fetch("buscador-demo.json?v=2", { cache: "no-store" });
    if (!r.ok) throw new Error("No encontré buscador-demo.json");
    demoDatos = await r.json();
  }
  if (accion === "ofertas") return demoDatos;
  demoPedidos();
  if (accion === "testeo_pedidos") {
    DEMO_PED.forEach(demoAvanzar);
    for (const p of DEMO_PED) if (p.estado === "lanzando" && Date.now() - p.lanzT > 5000) {
      p.estado = "lanzado";
      for (const o of p.params.ofertas) p.progreso.push({ t: new Date().toISOString(), etapa: "lanzada", oferta: o.etiqueta, paso: "listo", texto: "Activa y verificada (demo)", links: { campana: "https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1950162628858779" } });
    }
    return { pedidos: DEMO_PED.filter((p) => !p.oculto).slice().sort((a, b) => b.id - a.id), compu: { prendida: true, visto: new Date(Date.now() - 40000).toISOString() } };
  }
  if (accion === "testeo_pedido") {
    const id = Math.max(0, ...DEMO_PED.map((p) => p.id)) + 1;
    const ofs = body.ofertas.map((d) => { const o = porId(d.id); return { id: d.id, etiqueta: o?.marca || o?.nombre || d.id, nombre: o?.nombre, formato: o?.formato, destino: d }; });
    DEMO_PED.push({ id, estado: "pendiente", creado: new Date().toISOString(), quien: body.quien, sim: Date.now(),
      params: { tipo: "modelar", pedido: "testeo", estructura: body.estructura, presupuesto: body.presupuesto, creativos: body.creativos, cuenta: body.cuenta, prueba: body.prueba, ofertas: ofs },
      progreso: [{ t: new Date().toISOString(), etapa: "inicio", texto: `${body.prueba ? "🧪 PRUEBA · " : ""}Pedido recibido (demo). Queda EN PAUSA hasta tu dale.` }] });
    return { id };
  }
  const p = DEMO_PED.find((x) => x.id === Number(body?.id));
  if (accion === "fabrica_lanzar") { if (!p || p.estado !== "listo_revisar") throw new Error("no está listo para el dale"); p.estado = "lanzando"; p.lanzT = Date.now(); p.progreso.push({ t: new Date().toISOString(), etapa: "lanzar", texto: "Lorenzo dio el dale (demo)" }); return { ok: true }; }
  if (accion === "fabrica_cancelar") { if (p) p.estado = "cancelado"; return { ok: true }; }
  if (accion === "fabrica_eliminar") { if (p) p.oculto = true; return { ok: true }; }
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
  modalActual = { velo, dlg, cerrar, set(h) { const st = dlg.scrollTop; dlg.innerHTML = h; dlg.scrollTop = st; } };
  enfocar();
  return modalActual;
}
function cerrarModal() { if (modalActual) { modalActual.velo.remove(); modalActual = null; } }

// ---------- login: lo hace el dashboard (misma clave dash_clave) ----------
function login(msg = "") { pararRefresco(); B.montado = false; CTX.login(msg); }

// ---------- carga ----------
async function cargar() {
  if (B.cargando) return;
  B.cargando = true; B.error = null;
  if (B.montado) $("#b-ref")?.classList.add("cargando");
  if (!B.datos) pintar();
  try {
    const d = await api("ofertas");
    B.datos = { ...d, ofertas: Array.isArray(d?.ofertas) ? d.ofertas : [] };
  } catch (e) {
    if (e.code === 401) { B.cargando = false; $("#b-ref")?.classList.remove("cargando"); const habia = !!clave(); ls.del("dash_clave"); return login(habia ? "Clave incorrecta" : ""); }
    B.error = e.message || "No se pudo cargar";
  }
  B.cargando = false;
  B.cargado = Date.now();
  if (!B.montado) return;
  $("#b-ref")?.classList.remove("cargando");
  pintar();
  cargarPedidos();
}
async function cargarPedidos() {
  if (B.pedCargando) return;
  B.pedCargando = true;
  try {
    const r = await apiMovil("testeo_pedidos");
    B.pedidos = Array.isArray(r?.pedidos) ? r.pedidos : [];
    B.compu = r?.compu || null;
    B.pedErr = null;
  } catch (e) {
    B.pedCargando = false;
    if (e.code === 401) { ls.del("dash_clave"); return login("Clave incorrecta"); }
    B.pedErr = e.message || "No se pudieron leer los pedidos";
  }
  B.pedCargando = false;
  B.pedT = Date.now();
  if (!B.montado) return;
  pintarTabs();
  if (B.vista === "testeos") { if (B.abierto != null) pintarPedidoAbierto(); else pintarPedidos(); }
}
// En vivo: con un pedido abierto en marcha, cada 6 s; si no, cada 25 s mientras se mira «Testeos».
function arrancarRefresco() {
  pararRefresco();
  B.timer = setInterval(() => {
    if (!B.montado || document.hidden || B.vista !== "testeos") return;
    const p = B.abierto != null ? pedidoPorId(B.abierto) : null;
    const vivo = p && (ACTIVOS.includes(p.estado) || (p.estado === "lanzado" && Date.now() - Date.parse(p.actualizado || p.creado) < 15 * 60000));
    if (Date.now() - B.pedT > (vivo ? 6000 : 25000)) cargarPedidos();
  }, 2000);
}
function pararRefresco() { if (B.timer) { clearInterval(B.timer); B.timer = null; } }
const pedidoPorId = (id) => (B.pedidos || []).find((p) => String(p.id) === String(id));

// ---------- pintar ----------
const VISTAS = [["ofertas", "Ofertas"], ["testeos", "Seleccionadas"]];
function pintarTabs() {
  $$("#bo-tabs [data-vista]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.vista === B.vista)));
  // como antes: cuántas hay elegidas (y un punto si hay testeos en marcha o esperando el dale)
  const vivos = (B.pedidos || []).filter((p) => ACTIVOS.includes(p.estado) || p.estado === "listo_revisar").length;
  const t = $("#tab-n"); if (t) t.innerHTML = `(${B.sel.size})${vivos ? `<span class="bo-tab-punto" title="${vivos} testeo${vivos === 1 ? "" : "s"} en marcha o esperando tu dale"></span>` : ""}`;
}
function pintar() {
  if (!B.montado || !$("#bo-main")) return;
  pintarTabs();
  const main = $("#bo-main");
  if (B.vista === "testeos") { pintarTesteos(); pintarBarra(); return; }
  if (!B.datos) {
    if (B.cargando) main.innerHTML = `<p class="vacio"><span class="cargador"></span>Buscando las ofertas…</p><div class="bo-grid">${'<div class="esqueleto boceto bo-esq"></div>'.repeat(4)}</div>`;
    else if (B.error) main.innerHTML = errorBox(B.error);
    bindError();
    pintarBarra();
    return;
  }
  pintarOfertas();
  pintarBarra();
}
const errorBox = (m) => `<div class="err-box bo-err" role="alert"><b>No se pudo cargar.</b> ${esc(m)}<div><button type="button" class="btn chico" id="b-reintentar">Reintentar</button></div></div>`;
function bindError() { const b = $("#b-reintentar"); if (b) b.onclick = cargar; }
const cabDatos = () => B.datos?.generado ? `<p class="bo-gen mut">Datos del ${esc(fechaHora(B.datos.generado))} (hora AR)${B.error ? ` · <span class="bo-mal">no se pudo actualizar: ${esc(B.error)}</span>` : ""}</p>` : "";

// --- filtros ---
const RANGOS_DIAS = [["todos", "Todos", null, null], ["0-7", "Menos de 7", null, 7], ["7-30", "7 a 30", 7, 30], ["30-90", "30 a 90", 30, 90], ["90-", "Más de 90", 90, null]];
const ORDENES = [["nicho", "Por nicho, mejor para exportar"], ["exportar", "Mejor para exportar"], ["santi", "Mejor según Santi"], ["oportunidad", "Mejor oportunidad"], ["anuncios", "Más anuncios activos"], ["viejas", "Más días corriendo"]];
// marca personal confirmada por clasificar.py (dominio con el nombre o Dr./Dra.); la bandera de Santi por regex queda solo como aviso
const esMarca = (o) => o.marcaPersonal;
// mejor a peor: puntaje de Santi (0 si no es winner), después oportunidad y anuncios
const paraExportar = (a, b) => (b.exportar ?? -1) - (a.exportar ?? -1) || (b.puntaje ?? -1) - (a.puntaje ?? -1) || b.anuncios - a.anuncios;
const mejor = (a, b) => (b.puntajeSanti ?? -1) - (a.puntajeSanti ?? -1) || (b.puntaje ?? -1) - (a.puntaje ?? -1) || b.anuncios - a.anuncios;
function filtradas() {
  const f = B.filtro;
  const q = f.q.trim().toLowerCase();
  const lista = LISTAS[f.lista];
  const xs = ofertas().filter((o) => {
    if (lista) return lista.ids.includes(o.id) || (o.ids_previos || []).some((x) => lista.ids.includes(x));
    if (o.anuncios < (Number(f.min) || 0)) return false;
    if (f.santi && !o.winner) return false;
    if (f.funnel && !o.funnel) return false;
    if (Number(f.max) > 0 && o.anuncios > Number(f.max)) return false;
    if (f.clases.length && !f.clases.includes(o.clase)) return false;
    if (!f.marcas && esMarca(o)) return false;
    if (f.verticales.length && !f.verticales.includes(o.vertical)) return false;
    if (f.mercado !== "todos" && !o.mercados.includes(f.mercado)) return false;
    if (f.formatos.length && !f.formatos.includes(o.formato)) return false;
    if (f.dmin != null && !(o.dias != null && o.dias >= f.dmin)) return false;
    if (f.dmax != null && !(o.dias != null && o.dias <= f.dmax)) return false;
    if (q && !coincide(q, ...[o.nombre, o.marca, o.angulo, o.nicho, o.dominio, o.idioma, FORMATO_TX[o.formato], ...o.paginas.map((p) => p.nombre), ...o.paises].map((x) => String(x || "")))) return false;
    return true;
  });
  const dias = (o) => o.dias ?? -1;
  if (f.orden === "nicho") xs.sort((a, b) => vertIdx(a.vertical) - vertIdx(b.vertical) || paraExportar(a, b));
  else if (f.orden === "exportar") xs.sort(paraExportar);
  else if (f.orden === "santi") xs.sort(mejor);
  else if (f.orden === "oportunidad") xs.sort((a, b) => (b.puntaje ?? -1) - (a.puntaje ?? -1) || b.anuncios - a.anuncios);
  else if (f.orden === "viejas") xs.sort((a, b) => dias(b) - dias(a) || b.anuncios - a.anuncios);
  else xs.sort((a, b) => b.anuncios - a.anuncios);
  return xs;
}
function nFiltros() {
  const f = B.filtro;
  const mismas = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  return (f.santi ? 1 : 0) + (f.funnel ? 0 : 1) + (mismas(f.clases, FILTRO_DEF.clases) ? 0 : 1) + (f.marcas ? 1 : 0) + (f.verticales.length ? 1 : 0) + (f.q.trim() ? 1 : 0)
    + (Number(f.min) !== FILTRO_DEF.min || Number(f.max) !== FILTRO_DEF.max ? 1 : 0) + (f.mercado !== "todos" ? 1 : 0) + (f.formatos.length ? 1 : 0) + (f.dmin != null || f.dmax != null ? 1 : 0);
}
const maxAnuncios = () => { const m = Math.max(0, ...ofertas().map((o) => o.anuncios)); return Math.max(50, Math.ceil(m / 50) * 50); };
const mercadosData = () => { const s = new Set(); ofertas().forEach((o) => o.mercados.forEach((k) => s.add(k))); return [...s].sort((a, b) => (ORDEN_MK.indexOf(a) + 99) % 99 - (ORDEN_MK.indexOf(b) + 99) % 99); };
const formatosData = () => { const s = new Set(ofertas().map((o) => o.formato)); return Object.keys(FORMATO_TX).filter((k) => s.has(k)); };
const cuentaClase = (k) => { const n = ofertas().filter((o) => o.clase === k).length; return n ? `(${n})` : ""; };
const chip = (attr, k, t, on) => `<button type="button" class="seg-b" ${attr}="${esc(k)}" aria-pressed="${on}">${esc(t)}</button>`;

function filtrosHTML() {
  const f = B.filtro;
  const mx = maxAnuncios();
  const rango = RANGOS_DIAS.find(([, , a, b]) => a === f.dmin && b === f.dmax)?.[0] || null;
  const n = nFiltros();
  return `<div class="bo-fil-cab">
      <button type="button" class="btn chico bo-fil-tg" id="f-tg" aria-expanded="${B.filtrosAbiertos}" aria-controls="bo-filtros">Filtros${n ? ` <span class="bo-fil-n num">${n}</span>` : ""}</button>
      <label class="bo-q"><span class="sr">Buscar</span><input class="campo" id="f-q" type="search" placeholder="Buscar nombre, página, nicho, dominio…" value="${esc(f.q)}" autocomplete="off"></label>
      <label class="bo-orden"><span class="sr">Ordenar</span><select class="campo" id="f-orden">${ORDENES.map(([k, t]) => `<option value="${k}" ${k === f.orden ? "selected" : ""}>${t}</option>`).join("")}</select></label>
    </div>
    ${LISTAS[f.lista] ? `<div class="bo-santi" role="group" aria-label="Lista"><button type="button" class="seg-b" aria-pressed="true" id="f-lista">📋 ${esc(LISTAS[f.lista].nombre)} ✕</button></div>` : `<div class="bo-santi" role="group" aria-label="Listas">${Object.entries(LISTAS).map(([k, l]) => `<button type="button" class="seg-b" aria-pressed="false" data-flista="${esc(k)}">📋 ${esc(l.nombre)}</button>`).join("")}</div>`}
    <div class="bo-santi" role="group" aria-label="Criterios de Santi">
      ${chip("data-ffun", "1", "Todos los anuncios a la misma landing", f.funnel)}
      ${chip("data-fsanti", "1", "Solo winners Santi (45+ anuncios, 7+ días)", f.santi)}
      ${chip("data-fmarca", "1", "Mostrar marcas personales", f.marcas)}
    </div>
    <section class="bo-filtros boceto${B.filtrosAbiertos ? " abierto" : ""}" id="bo-filtros" aria-label="Filtros">
      <div class="bo-f"><span class="bo-f-l" id="fl-cl">Tipo de producto</span><div class="segs" role="group" aria-labelledby="fl-cl">${CLASES.map(([k, t]) => chip("data-fcl", k, `${t} ${cuentaClase(k)}`, f.clases.includes(k))).join("")}</div></div>
      <div class="bo-f"><span class="bo-f-l" id="fl-ve">Nicho (orden de Santi)</span><div class="segs" role="group" aria-labelledby="fl-ve">${chip("data-fve", "todos", "Todos", !f.verticales.length)}${VERTICALES.map(([k, t]) => chip("data-fve", k, t, f.verticales.includes(k))).join("")}</div></div>
      <div class="bo-f bo-f-min"><span class="bo-f-l" id="fl-min">Anuncios activos (mínimo)</span>
        <div class="bo-rango"><input type="range" id="f-min-r" min="0" max="${mx}" step="${mx > 500 ? 25 : 10}" value="${Math.min(Number(f.min) || 0, mx)}" aria-labelledby="fl-min">
        <input class="campo num bo-min-n" id="f-min" type="number" inputmode="numeric" min="0" step="10" value="${esc(f.min)}" aria-label="Mínimo de anuncios activos"></div>
        <div class="bo-dias"><label>hasta <input class="campo num" id="f-max" type="number" inputmode="numeric" min="0" step="50" value="${f.max || ""}" placeholder="sin tope" aria-label="Máximo de anuncios activos"></label> anuncios <span class="mut">(más de 1.000 suele ser marca muy explotada)</span></div></div>
      <div class="bo-f"><span class="bo-f-l" id="fl-mk">Corre en (presencia mínima)</span><div class="segs" role="group" aria-labelledby="fl-mk">${chip("data-fmk", "todos", "Todos", f.mercado === "todos")}${mercadosData().map((k) => chip("data-fmk", k, nombreMercado(k), f.mercado === k)).join("")}</div></div>
      <div class="bo-f"><span class="bo-f-l" id="fl-fo">Formato</span><div class="segs" role="group" aria-labelledby="fl-fo">${chip("data-ffo", "todos", "Todos", !f.formatos.length)}${formatosData().map((k) => chip("data-ffo", k, FORMATO_TX[k], f.formatos.includes(k))).join("")}</div></div>
      <div class="bo-f"><span class="bo-f-l" id="fl-di">Tiempo corriendo (días)</span><div class="segs" role="group" aria-labelledby="fl-di">${RANGOS_DIAS.map(([k, t]) => chip("data-fdi", k, t, rango === k)).join("")}</div>
        <div class="bo-dias"><label>de <input class="campo num" id="f-dmin" type="number" inputmode="numeric" min="0" value="${f.dmin ?? ""}" placeholder="0" aria-label="Días mínimos"></label>
        <label>a <input class="campo num" id="f-dmax" type="number" inputmode="numeric" min="0" value="${f.dmax ?? ""}" placeholder="∞" aria-label="Días máximos"></label> días</div></div>
      ${n ? `<div class="bo-f bo-f-limpiar"><button type="button" class="link" id="f-limpiar">Volver a los filtros de siempre</button></div>` : ""}
    </section>`;
}
function pintarOfertas() {
  const main = $("#bo-main");
  const foco = document.activeElement?.id;
  main.innerHTML = `${cabDatos()}<div id="bo-fil">${filtrosHTML()}</div><div id="bo-lista"></div>`;
  bindFiltros();
  if (foco && $("#" + foco)) $("#" + foco).focus({ preventScroll: true });
  pintarLista();
}
function repintarFiltros() {
  const foco = document.activeElement?.id;
  $("#bo-fil").innerHTML = filtrosHTML();
  bindFiltros();
  if (foco && $("#" + foco)) $("#" + foco).focus({ preventScroll: true });
}
function cambiar(fn, repintar = true) { fn(B.filtro); guardarFiltro(); if (repintar) repintarFiltros(); else { const t = $("#f-tg"); const n = nFiltros(); if (t) t.innerHTML = `Filtros${n ? ` <span class="bo-fil-n num">${n}</span>` : ""}`; } pintarLista(); }
function bindFiltros() {
  $("#f-tg").onclick = () => { B.filtrosAbiertos = !B.filtrosAbiertos; $("#bo-filtros").classList.toggle("abierto", B.filtrosAbiertos); $("#f-tg").setAttribute("aria-expanded", B.filtrosAbiertos); };
  $("#f-q").oninput = (e) => cambiar((f) => { f.q = e.target.value; }, false);
  $("#f-orden").onchange = (e) => cambiar((f) => { f.orden = e.target.value; }, false);
  $("#f-min-r").oninput = (e) => { const v = Number(e.target.value) || 0; $("#f-min").value = v; cambiar((f) => { f.min = v; }, false); };
  $("#f-min").onchange = (e) => { const v = Math.max(0, Number(e.target.value) || 0); cambiar((f) => { f.min = v; }); };
  $$("[data-ffun]").forEach((b) => b.onclick = () => cambiar((f) => { f.funnel = !f.funnel; }));
  $("#f-max").onchange = (e) => { const v = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0); cambiar((f) => { f.max = v; }); };
  $$("[data-fsanti]").forEach((b) => b.onclick = () => cambiar((f) => { f.santi = !f.santi; }));
  $$("[data-fmarca]").forEach((b) => b.onclick = () => cambiar((f) => { f.marcas = !f.marcas; }));
  $$("[data-fcl]").forEach((b) => b.onclick = () => cambiar((f) => { const k = b.dataset.fcl; f.clases = f.clases.includes(k) ? f.clases.filter((x) => x !== k) : [...f.clases, k]; }));
  $$("[data-fve]").forEach((b) => b.onclick = () => cambiar((f) => {
    const k = b.dataset.fve;
    if (k === "todos") f.verticales = []; else f.verticales = f.verticales.includes(k) ? f.verticales.filter((x) => x !== k) : [...f.verticales, k];
  }));
  $$("[data-fmk]").forEach((b) => b.onclick = () => cambiar((f) => { f.mercado = b.dataset.fmk; }));
  $$("[data-ffo]").forEach((b) => b.onclick = () => cambiar((f) => {
    const k = b.dataset.ffo;
    if (k === "todos") f.formatos = []; else f.formatos = f.formatos.includes(k) ? f.formatos.filter((x) => x !== k) : [...f.formatos, k];
  }));
  $$("[data-fdi]").forEach((b) => b.onclick = () => cambiar((f) => { const r = RANGOS_DIAS.find((x) => x[0] === b.dataset.fdi); f.dmin = r[2]; f.dmax = r[3]; }));
  const dias = (id, k) => { $(id).onchange = (e) => { const v = e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value))); cambiar((f) => { f[k] = Number.isFinite(v) ? v : null; }); }; };
  dias("#f-dmin", "dmin"); dias("#f-dmax", "dmax");
  const fl = $("#f-lista"); if (fl) fl.onclick = () => cambiar((f) => { f.lista = null; });
  $$("[data-flista]").forEach((b) => b.onclick = () => cambiar((f) => { f.lista = b.dataset.flista; f.orden = "anuncios"; }));
  const l = $("#f-limpiar"); if (l) l.onclick = () => cambiar((f) => Object.assign(f, { ...FILTRO_DEF, orden: f.orden }));
  if (!ORDENES.some(([k]) => k === B.filtro.orden)) { B.filtro.orden = "nicho"; $("#f-orden").value = "nicho"; }
}
function pintarLista() {
  const xs = filtradas();
  const box = $("#bo-lista");
  if (!box) return;
  const tot = ofertas().length;
  const res = `<p class="bo-res mut num" aria-live="polite">${xs.length === tot ? pl(tot, "oferta") : `${ent(xs.length)} de ${pl(tot, "oferta")}`}${B.filtro.mercado !== "todos" ? ` que corren en ${esc(nombreMercado(B.filtro.mercado))}` : ""}</p>`;
  if (!xs.length) {
    box.innerHTML = res + `<div class="vacio boceto bo-vacio">${tot ? "Ninguna oferta pasa los filtros. Probá «Volver a los filtros de siempre», sumar tipos de producto o cambiar el rango de anuncios." : "Todavía no hay ofertas cargadas."}</div>`;
    return;
  }
  if (B.filtro.orden === "nicho") {
    const grupos = [];
    for (const o of xs) { const g = grupos[grupos.length - 1]; if (g && g.k === o.vertical) g.xs.push(o); else grupos.push({ k: o.vertical, xs: [o] }); }
    box.innerHTML = res + grupos.map((g) => `<section class="bo-nicho" aria-label="${esc(VERT_TX[g.k])}">
      <h3 class="bo-nicho-t"><span class="bo-nicho-n num">${vertIdx(g.k) + 1}</span>${esc(VERT_TX[g.k])} <small class="mut num">${pl(g.xs.length, "oferta")}</small></h3>
      <div class="bo-grid">${g.xs.map(tarjeta).join("")}</div></section>`).join("");
  } else box.innerHTML = res + `<div class="bo-grid">${xs.map(tarjeta).join("")}</div>`;
  bindTarjetas(box);
}

// --- tarjeta ---
const caja = (o) => `<label class="bo-check"><input type="checkbox" data-sel="${esc(o.id)}" ${B.sel.has(o.id) ? "checked" : ""}><span class="bo-caja" aria-hidden="true"></span><span class="sr">Elegir ${esc(o.nombre)} para modelar</span></label>`;
function videoHTML(o) {
  const v = o.video;
  const usos = v?.usos ? `<span class="bo-uso num" title="Anuncios que usan este video">×${ent(v.usos)}</span>` : "";
  const fo = `<span class="bo-fo fo-${esc(o.formato)}">${esc(FORMATO_TX[o.formato])}</span>`;
  if (!v || (!v.src && !v.poster)) return `<div class="bo-vid">${fo}<div class="bo-sinvid">Sin video</div>${caja(o)}</div>`;
  // sin miniatura: el primer cuadro del video, cargado recién cuando la tarjeta entra en pantalla (ver mirarCuadros)
  const media = v.poster ? `<img src="${esc(v.poster)}" alt="" loading="lazy" decoding="async">`
    : v.src ? `<video class="bo-cuadro" muted playsinline preload="none" data-cuadro="${esc(v.src)}" aria-hidden="true" tabindex="-1"></video>` : `<div class="bo-sinvid">Sin video</div>`;
  const play = v.src ? `<button type="button" class="bo-play" data-play="${esc(o.id)}" aria-label="Reproducir el video más escalado de ${esc(o.nombre)}">${SVG_PLAY}</button>` : `<span class="bo-img-tag">imagen</span>`;
  return `<div class="bo-vid" data-vid="${esc(o.id)}">${media}${play}${fo}${usos}${caja(o)}</div>`;
}
// (11/10) países de cada mercado: mercados_detalle si viene; si no, paises[] (con o sin conteo) repartidos por mercado
const MK_PAISES = {
  anglo: ["US", "GB", "CA", "AU", "NZ", "IE"], latam: MOD.latam[2],
  eu: ["FR", "IT", "DE", "ES", "PT", "NL", "BE", "AT", "CH", "SE", "NO", "DK", "FI", "PL", "IE", "GR", "CZ", "RO", "HU", "LU"],
  fr: ["FR", "BE"], de: ["DE", "AT", "CH"], nordicos: ["SE", "NO", "DK", "FI"],
};
let NOMBRE_PAIS = null;
try { NOMBRE_PAIS = new Intl.DisplayNames(["es"], { type: "region" }); } catch {}
const nombrePais = (c) => { try { return NOMBRE_PAIS?.of(c) || c; } catch { return c; } };
const paisEnMk = (c, k) => { const mp = B.datos?.mercados_paises?.[k]; const xs = Array.isArray(mp) && mp.length ? mp : MK_PAISES[k]; return xs ? xs.includes(c) : c.toLowerCase() === k; };
function paisesDe(o, k) {
  const xs = o.detalle[k] || o.paises.filter((c) => paisEnMk(c, k)).map((c) => [c, o.paisesN[c] ?? null]);
  return [...xs].sort((a, b) => (b[1] ?? -1) - (a[1] ?? -1));
}
function mercadosHTML(o) {
  if (!o.mercados.length) return `<p class="bo-mks mut">Mercados sin dato</p>`;
  return `<ul class="bo-mks" aria-label="Mercados donde corre">${o.mercados.map((k) => { const n = num(o.porMk[k]);
    const tx = `${esc(corto(k))}${n != null ? ` <b class="num">${ent(n)}</b>` : ""}`;
    const on = B.filtro.mercado === k ? ' class="on"' : "";
    if (!paisesDe(o, k).length) return `<li${on}><span class="bo-mk">${tx}</span></li>`;
    return `<li${on}><button type="button" class="bo-mk" data-mkp="${esc(k)}" aria-expanded="false" aria-controls="mkp-${esc(o.id)}" title="Ver países de ${esc(nombreMercado(k))}">${tx}<span class="bo-mk-fl" aria-hidden="true"></span></button></li>`; }).join("")}</ul>
    <div class="bo-mkp" id="mkp-${esc(o.id)}" role="region" aria-live="polite" hidden></div>`;
}
function paisesPanel(o, k) {
  const xs = paisesDe(o, k);
  const con = xs.some(([, n]) => n != null);
  return `<p class="bo-mkp-t">${bandera(k)} ${esc(nombreMercado(k))}: ${pl(xs.length, "país", "países")}</p>
    <ul class="bo-mkp-l">${xs.map(([c, n]) => `<li><span class="bo-mkp-b" aria-hidden="true">${bandera(c.toLowerCase())}</span><span class="bo-mkp-n">${esc(nombrePais(c))}</span>${n != null ? `<b class="num">${ent(n)}</b>` : ""}</li>`).join("")}</ul>
    ${con ? "" : `<p class="bo-mkp-sin mut">Sin conteo por país todavía</p>`}`;
}
function bindMercados(raiz) {
  $$("[data-mkp]", raiz).forEach((b) => b.onclick = () => {
    const card = b.closest("[data-fila]"); const o = porId(card?.dataset.fila); if (!o) return;
    const panel = $(".bo-mkp", card); const k = b.dataset.mkp;
    const abierto = b.getAttribute("aria-expanded") === "true";
    $$("[data-mkp]", card).forEach((x) => x.setAttribute("aria-expanded", "false"));
    if (abierto) { panel.hidden = true; panel.innerHTML = ""; return; }
    b.setAttribute("aria-expanded", "true");
    panel.innerHTML = paisesPanel(o, k); panel.setAttribute("aria-label", `Países de ${nombreMercado(k)}`); panel.hidden = false;
  });
  $$("[data-mkp]", raiz).forEach((b) => b.onkeydown = (e) => { if (e.key === "Escape" && b.getAttribute("aria-expanded") === "true") { e.stopPropagation(); b.click(); } });
}
function paisesTx(o) {
  if (!o.paises.length) return "";
  const xs = o.paises.slice(0, 6);
  return `<p class="bo-paises-tx mut" title="${esc(o.paises.join(", "))}">${esc(xs.join(" · "))}${o.paises.length > 6 ? ` +${o.paises.length - 6}` : ""}</p>`;
}
function tarjeta(o) {
  const sel = B.sel.has(o.id);
  const sub = [o.marca && o.marca !== o.nombre ? o.marca : "", o.nicho, o.precio != null ? (typeof o.precio === "number" ? plata(o.precio, o.moneda || "USD") : String(o.precio)) : ""].filter(Boolean);
  const pags = o.paginas.length > 1 ? ` · ${pl(o.paginas.length, "página")}` : "";
  return `<article class="bo-of${sel ? " sel" : ""}" data-fila="${esc(o.id)}">
    ${videoHTML(o)}
    <div class="bo-of-cu">
      <h3 class="bo-of-nom"><button type="button" class="bo-of-ab" data-det="${esc(o.id)}" title="${esc(o.nombre)}">${esc(o.nombre)}</button></h3>
      ${sub.length ? `<p class="bo-of-sub">${esc(sub.join(" · "))}${esc(pags)}</p>` : ""}
      <p class="bo-of-nums"><b class="num">${ent(o.anuncios)}</b> anuncios activos${o.dias != null ? ` · <span class="num">${pl(o.dias, "día")}</span>` : ""}</p>
      ${santiHTML(o)}
      ${o.desde ? `<p class="bo-of-desde mut">corre desde el ${esc(dmy(o.desde))}</p>` : ""}
      ${mercadosHTML(o)}
      ${paisesTx(o)}
      ${oportunidadesHTML(o)}
      <div class="bo-of-links">
        ${o.landing ? `<a class="bo-lk" href="${esc(o.landing)}" target="_blank" rel="noopener">Landing ${FLECHA}</a>` : `<span class="bo-lk off">Sin landing</span>`}
        ${o.biblioteca ? `<a class="bo-lk" href="${esc(o.biblioteca)}" target="_blank" rel="noopener">Biblioteca ${FLECHA}</a>` : ""}
        <button type="button" class="bo-lk" data-det="${esc(o.id)}">Detalle</button>
      </div>
    </div>
  </article>`;
}
// (12/10) Santi: puntaje, tipo de producto, nicho y banderas para revisar a mano
function santiHTML(o) {
  const ch = [];
  if (o.exportar != null) ch.push(`<span class="fchip ${o.exportar >= 75 ? "verde-fuerte" : o.exportar >= 55 ? "verde" : "amarillo"}" title="${esc(o.destino?.motivo || "")}">Exportar <span class="num">${ent(o.exportar)}</span> → ${bandera(o.destino.mercado)} ${esc(corto(o.destino.mercado))}</span>`);
  if (o.americano) ch.push(`<span class="fchip acento" title="Corre solo en Brasil / LATAM / Argentina">Solo ${esc(o.mercados.map(corto).join(" · "))}</span>`);
  if (o.winner && o.puntajeSanti != null) ch.push(`<span class="fchip ${o.puntajeSanti >= 70 ? "verde-fuerte" : o.puntajeSanti >= 50 ? "verde" : "amarillo"}" title="Puntaje de Santi: nicho, mercado y banderas">Santi <span class="num">${ent(o.puntajeSanti)}</span></span>`);
  ch.push(`<span class="fchip ${["digital", "libro_fisico"].includes(o.clase) ? "acento" : "rojo"}" title="${esc(o.claseMotivo)}">${esc(CLASE_TX[o.clase])}</span>`);
  ch.push(`<span class="fchip">${esc(VERT_TX[o.vertical])}</span>`);
  if (esMarca(o)) ch.push(`<span class="fchip rojo">Marca personal</span>`);
  const ban = o.banderas.filter((b) => b.clave !== "marca_personal" || !esMarca(o));
  return `<p class="bo-santi-ch">${ch.join("")}</p>${ban.length || o.saludNota ? `<ul class="bo-ban">${ban.map((b) => `<li>⚠ ${esc(b.texto)}</li>`).join("")}${o.saludNota ? `<li>⚠ ${esc(o.saludNota)}</li>` : ""}</ul>` : ""}`;
}
// Chips con los 2 o 3 mejores mercados: «Oportunidad: 🇫🇷 Francia · 5 páginas compitiendo»
function oportunidadesHTML(o) {
  const xs = [...o.oportunidades].sort((a, b) => a.mismo - b.mismo || DESTINOS.includes(b.mercado) - DESTINOS.includes(a.mercado) || (b.puntaje ?? -1) - (a.puntaje ?? -1)).slice(0, 3);
  if (!xs.length) return "";
  return `<ul class="bo-opts" aria-label="Oportunidades">${xs.map((x, i) => `<li class="${x.mercado === o.recomendado ? "rec" : ""}"><span class="bo-opt-l">${i === 0 ? "Oportunidad:" : ""}</span> ${bandera(x.mercado)} ${esc(nombreMercado(x.mercado))}${x.paginas != null ? ` · <span class="num">${pl(x.paginas, "página")}</span> compitiendo` : x.anuncios != null ? ` · <span class="num">${pl(x.anuncios, "anuncio")}</span>` : ""}</li>`).join("")}</ul>`;
}
// Detalle de la oferta: por mercado, páginas y anuncios del nicho, keywords, puntaje y motivo.
function detalleOferta(id) {
  const o = porId(id); if (!o) return;
  const rec = recomendacion(o);
  const m = abrirModal(`<h3>${esc(o.nombre)}</h3>
    <p class="mut">${esc([o.marca, FORMATO_TX[o.formato], pl(o.anuncios, "anuncio") + " activos", o.dias != null ? pl(o.dias, "día") + " corriendo" : "", o.nicho].filter(Boolean).join(" · "))}</p>
    ${o.paginas.length > 1 ? `<p class="mut">Páginas: ${esc(o.paginas.map((p) => p.nombre).filter(Boolean).join(", "))}</p>` : ""}
    ${o.mercados.length ? `<p>Corre en: ${o.mercados.map((k) => `${bandera(k)} ${esc(nombreMercado(k))}${num(o.porMk[k]) != null ? ` (<span class="num">${ent(o.porMk[k])}</span>)` : ""}`).join(" · ")}${o.paises.length ? `<br><span class="mut">${esc(o.paises.join(" · "))}</span>` : ""}</p>` : ""}
    ${rec ? `<p class="bo-rec"><b>Te recomiendo ${esc(rec.nombre)}</b>${rec.motivo ? `: ${esc(rec.motivo)}` : ""}.</p>` : ""}
    <h4 class="bo-mod-sub">Oportunidades por mercado</h4>
    ${o.oportunidades.length ? `<ul class="bo-opd">${o.oportunidades.map((x) => `<li>
      <div class="bo-opd-cab"><b>${bandera(x.mercado)} ${esc(nombreMercado(x.mercado))}</b>${x.puntaje != null ? `<span class="fchip ${x.puntaje >= 70 ? "verde-fuerte" : x.puntaje >= 45 ? "amarillo" : ""}"><span class="num">${ent(x.puntaje)}</span>/100</span>` : ""}</div>
      <p class="bo-opd-n">${x.paginas != null ? `<b class="num">${ent(x.paginas)}</b> ${x.paginas === 1 ? "página" : "páginas"}` : ""}${x.paginas != null && x.anuncios != null ? " · " : ""}${x.anuncios != null ? `<b class="num">${ent(x.anuncios)}</b> ${x.anuncios === 1 ? "anuncio" : "anuncios"} de este nicho` : ""}${x.paises.length ? ` · ${esc(x.paises.join(", "))}` : ""}</p>
      ${x.motivo ? `<p class="bo-opd-m">${esc(x.motivo)}</p>` : ""}
      ${x.keywords.length ? `<p class="mut bo-opd-k">Buscado con: ${esc(x.keywords.join(", "))}</p>` : ""}
      <button type="button" class="btn chico" data-elegir-mk="${esc(x.mercado)}">Elegir para ${esc(nombreDestino(destinoDe(o, x.mercado)))}</button>
    </li>`).join("")}</ul>` : `<p class="mut">Todavía no hay oportunidades medidas para esta oferta.</p>`}
    <div class="botones">${o.landing ? `<a class="btn" href="${esc(o.landing)}" target="_blank" rel="noopener">Landing ${FLECHA}</a>` : ""}${o.biblioteca ? `<a class="btn" href="${esc(o.biblioteca)}" target="_blank" rel="noopener">Biblioteca ${FLECHA}</a>` : ""}<button type="button" class="btn pri" data-x data-foco>Listo</button></div>`, { ancho: true });
  $("[data-x]", m.dlg).onclick = m.cerrar;
  $$("[data-elegir-mk]", m.dlg).forEach((b) => b.onclick = () => { elegir(o.id, true, destinoDe(o, b.dataset.elegirMk)); m.cerrar(); toast(`${esc(o.nombre)}: elegida para ${esc(nombreDestino(B.sel.get(o.id)))}.`); });
}
let obsCuadros = null;
function mirarCuadros(raiz) {
  const vs = $$("video[data-cuadro]", raiz);
  if (!vs.length) return;
  const cargar = (v) => { v.preload = "metadata"; v.src = v.dataset.cuadro + "#t=0.5"; v.removeAttribute("data-cuadro"); };
  if (!("IntersectionObserver" in window)) return vs.forEach(cargar);
  if (!obsCuadros) obsCuadros = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { obsCuadros.unobserve(e.target); cargar(e.target); } }), { rootMargin: "300px" });
  vs.forEach((v) => obsCuadros.observe(v));
}
function bindTarjetas(raiz) {
  mirarCuadros(raiz);
  bindMercados(raiz);
  $$("[data-sel]", raiz).forEach((c) => c.onchange = () => elegir(c.dataset.sel, c.checked));
  $$("[data-det]", raiz).forEach((b) => b.onclick = () => detalleOferta(b.dataset.det));
  $$("[data-play]", raiz).forEach((b) => b.onclick = () => {
    const o = porId(b.dataset.play); if (!o?.video?.src) return;
    const box = b.closest(".bo-vid");
    const v = document.createElement("video");
    v.src = o.video.src; v.controls = true; v.playsInline = true; v.setAttribute("playsinline", ""); v.autoplay = true;
    if (o.video.poster) v.poster = o.video.poster;
    v.setAttribute("aria-label", `Video más escalado de ${o.nombre}`);
    $$("img, .bo-sinvid, .bo-play, .bo-cuadro", box).forEach((x) => x.remove());
    box.prepend(v); box.classList.add("jugando");
    v.play().catch(() => {});
  });
}
// elegir: el mercado destino es el del filtro (si la oferta corre ahí) o su mercado principal
function elegir(id, on, mercado = null) {
  const o = porId(id);
  // mercado destino: el que se eligió, o el recomendado por el backend, o el del filtro, o su principal
  if (on) B.sel.set(String(id), mercado || (o ? destinoDe(o, o.recomendado || (B.filtro.mercado !== "todos" && o.mercados.includes(B.filtro.mercado) ? B.filtro.mercado : null)) : null));
  else B.sel.delete(String(id));
  guardarSel();
  $$(`[data-sel="${CSS.escape(String(id))}"]`).forEach((x) => { x.checked = on; });
  $$(`[data-fila="${CSS.escape(String(id))}"]`).forEach((x) => x.classList.toggle("sel", on));
  pintarBarra(); pintarTabs();
}

// --- testeos: elegidas + pedidos ---
function pintarTesteos() {
  if (B.abierto != null) return pintarPedidoAbierto();
  const ids = [...B.sel.keys()];
  const xs = B.datos ? ids.map(porId).filter(Boolean) : [];
  $("#bo-main").innerHTML = `
    ${ids.length ? `<section class="bo-selec" aria-labelledby="sel-t">
      <div class="bo-sec-cab"><h2 id="sel-t">Elegidas <span class="num">(${ids.length})</span></h2>
        <button type="button" class="btn chico" id="b-sel-limpiar">✕ limpiar</button><button type="button" class="btn pri chico" id="b-sel-modelar" ${xs.length ? "" : "disabled"}>Modelar</button></div>
      ${B.datos && xs.length < ids.length ? `<p class="hint">${pl(ids.length - xs.length, "oferta elegida ya no aparece", "ofertas elegidas ya no aparecen")} en la lista de hoy. <button type="button" class="link" id="b-sel-purga">Sacarlas</button></p>` : ""}
      <ul class="bo-sel-lista">${xs.map((o) => `<li><span class="bo-sel-mk">${esc(corto(B.sel.get(o.id) || destinoDe(o)))}</span><div class="bo-of-tx"><b>${esc(o.nombre)}</b><span>${esc(FORMATO_TX[o.formato])} · <span class="num">${ent(o.anuncios)}</span> anuncios</span></div><button type="button" class="btn chico icono-chico" data-quitar="${esc(o.id)}" aria-label="Sacar ${esc(o.nombre)}">✕</button></li>`).join("")}</ul>
    </section>` : ""}
    <section class="bo-peds" aria-labelledby="ped-t">
      <div class="bo-sec-cab"><h2 id="ped-t">Pedidos de testeo</h2><span id="bo-compu"></span></div>
      <div id="bo-ped-lista" aria-live="polite"></div>
    </section>`;
  const l = $("#b-sel-limpiar"); if (l) l.onclick = () => { B.sel.clear(); guardarSel(); pintar(); };
  const mo = $("#b-sel-modelar"); if (mo) mo.onclick = modelar;
  const pu = $("#b-sel-purga"); if (pu) pu.onclick = () => { for (const id of [...B.sel.keys()]) if (!porId(id)) B.sel.delete(id); guardarSel(); pintar(); };
  $$("[data-quitar]").forEach((b) => b.onclick = () => { B.sel.delete(b.dataset.quitar); guardarSel(); pintar(); });
  pintarPedidos();
}
const compuChip = () => { const c = B.compu; return c ? `<span class="fchip ${c.prendida ? "verde" : "rojo"}">${c.prendida ? "compu prendida" : "compu apagada"}${c.visto ? ` · ${esc(hace(c.visto))}` : ""}</span>` : ""; };
const ESTR_TX = Object.fromEntries(ESTRUCTURAS.map(([k, t]) => [k, t]));
function resumenParams(pr) {
  const xs = [];
  if (pr.estructura) xs.push(ESTR_TX[pr.estructura] || pr.estructura);
  if (pr.presupuesto != null) xs.push(`${NF2.format(pr.presupuesto)} por día${pr.estructura === "abo_151" ? " por conjunto" : ""}`);
  if (pr.creativos) xs.push(pl(pr.creativos, "creativo"));
  if (pr.cuenta) xs.push(`cuenta ${(CUENTAS.find((c) => c[0] === pr.cuenta) || [0, pr.cuenta])[1]}`);
  if (pr.prueba) xs.push("PRUEBA");
  return xs.join(" · ");
}
function pintarPedidos() {
  const box = $("#bo-ped-lista"); if (!box) return;
  const cp = $("#bo-compu"); if (cp) cp.innerHTML = compuChip();
  if (B.pedidos == null) { box.innerHTML = B.pedErr ? `<div class="err-box">${esc(B.pedErr)}</div>` : `<p class="mut"><span class="cargador"></span>Cargando pedidos…</p>`; return; }
  const err = B.pedErr ? `<p class="hint error">No se pudo actualizar: ${esc(B.pedErr)}</p>` : "";
  if (!B.pedidos.length) { box.innerHTML = err + `<p class="mut bo-sinped">Todavía no hay pedidos. Marcá ofertas en «Ofertas» y tocá «Modelar».</p>`; return; }
  box.innerHTML = err + `<div class="bo-ped-grid">${B.pedidos.map((p) => {
    const [et, col] = ESTADOS[p.estado] || [p.estado, ""];
    const pr = p.params || {};
    const ofs = pr.ofertas || [];
    const ests = ofs.map((o) => estadoOferta(p, o));
    const hechos = ests.reduce((a, e) => a + e.listos, 0), total = ests.length * PASOS.length;
    const pct = total ? Math.round(100 * hechos / total) : 0;
    const ult = (p.progreso || []).slice(-1)[0];
    return `<button type="button" class="bo-ped ped-${esc(p.estado)}" data-abrir="${esc(p.id)}">
      <span class="bo-ped-cab"><span class="num bo-ped-id">#${esc(p.id)}</span><span class="fchip ${col}">${ACTIVOS.includes(p.estado) ? '<span class="cargador mini" aria-hidden="true"></span>' : ""}${esc(et)}</span></span>
      <b class="bo-ped-nom">${esc(ofs.map((o) => o.nombre || o.etiqueta || o.id).slice(0, 3).join(" · ") || "Modelar")}${ofs.length > 3 ? "…" : ""}</b>
      <small class="mut">${esc([ofs.map((o) => corto(o.destino?.mercado || pr.mercado || "")).filter(Boolean).join(", "), resumenParams(pr), hace(p.creado)].filter(Boolean).join(" · "))}</small>
      ${total ? `<span class="bo-ped-bar" aria-hidden="true"><span style="width:${pct}%"></span></span><small class="num">${hechos} de ${total} pasos</small>` : ""}
      ${ult?.texto ? `<small class="bo-ped-ult">${esc(ult.texto)}</small>` : ""}
    </button>`;
  }).join("")}</div>`;
  $$("[data-abrir]", box).forEach((b) => b.onclick = () => abrirPedido(b.dataset.abrir));
}

// --- paso a paso de un pedido ---
// Estado de cada paso para una oferta del pedido, con lo que reportó el worker (último aviso de cada etapa manda).
function estadoOferta(p, o) {
  const et = o.etiqueta || o.nombre || o.id;
  const prog = p.progreso || [];
  const mio = (x) => x.oferta && (x.oferta === et || x.oferta === o.id || x.oferta === o.nombre);
  const pasos = PASOS.map(([k, t]) => ({ k, t, st: "pendiente", tx: "", h: null, links: {} }));
  const links = {};
  let errOf = null;
  for (const x of prog) {
    const global = !x.oferta;
    if (!global && !mio(x)) continue;
    if (x.links) Object.assign(links, x.links);
    let k = ALIAS[x.etapa] || x.etapa;
    if (x.etapa === "error") { if (!global) errOf = x; continue; }
    if (k === "inicio") continue;
    if (global && !["lista", "lanzada"].includes(k)) continue;
    const i = IDX[k]; if (i == null) continue;
    const st = x.paso && x.paso !== "pendiente" ? x.paso : (x.etapa === "lanzando" ? "en_curso" : EN_CURSO_RE.test(x.texto || "") && !/listo|hecho|ok\b|verificad/i.test(x.texto || "") ? "en_curso" : "listo");
    pasos[i] = { ...pasos[i], st, tx: x.etapa === "chequeo_10min" ? `${pasos[i].tx ? pasos[i].tx + " · " : ""}${x.texto}` : (x.texto || ""), h: x.t, links: { ...pasos[i].links, ...(x.links || {}) } };
    if (x.etapa === "chequeo_10min") pasos[i].st = "listo";
  }
  // las anteriores a la última lista se dan por hechas
  let ultLista = -1; pasos.forEach((s, i) => { if (s.st === "listo") ultLista = i; });
  for (let i = 0; i < ultLista; i++) if (pasos[i].st === "pendiente" || pasos[i].st === "en_curso") pasos[i].st = "listo";
  // el estado del pedido manda al final
  const e = p.estado;
  const hasta = (n) => { for (let i = 0; i <= n; i++) if (pasos[i].st !== "error") pasos[i].st = "listo"; };
  if (["listo_revisar", "lanzar", "lanzando", "lanzado"].includes(e)) hasta(IDX.lista);
  if (e === "lanzar" || e === "lanzando") { if (pasos[IDX.lanzada].st !== "listo") pasos[IDX.lanzada].st = "en_curso"; }
  if (e === "lanzado") hasta(IDX.lanzada);
  const prox = pasos.findIndex((s) => s.st !== "listo");
  if (errOf && prox >= 0 && Date.parse(errOf.t) >= Math.max(0, ...pasos.filter((s) => s.h).map((s) => Date.parse(s.h)))) { pasos[prox].st = "error"; pasos[prox].tx = errOf.texto || "Error"; pasos[prox].h = errOf.t; }
  if (prox >= 0 && !pasos.some((s) => s.st === "en_curso" || s.st === "error")) {
    if (e === "trabajando" && prox < IDX.lista) pasos[prox].st = "en_curso";
    if (e === "error") { pasos[prox].st = "error"; pasos[prox].tx = p.error || "La fábrica cortó acá"; }
  }
  // links finales: avisos, resultado de la fábrica y Drive del pedido
  const res = (p.resultado?.ofertas || []).find((r) => r.etiqueta === et || r.id === o.id) || {};
  if (!links.landing && url(res.tienda_url)) links.landing = res.tienda_url;
  if (!links.drive && url(res.drive_url)) links.drive = res.drive_url;
  if (!links.drive && url(p.drive_url)) links.drive = p.drive_url;
  if (!links.campana && res.campaign_id && /^\d+$/.test(String(res.campaign_id))) {
    const act = String(res.act || "1950162628858779").replace(/^act_/, "");
    links.campana = `https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${encodeURIComponent(act)}&filter_set=${encodeURIComponent("SEARCH_BY_CAMPAIGN_IDS-STRING_SET\u001eANY\u001e" + JSON.stringify([String(res.campaign_id)]))}`;
  }
  return { pasos, links, listos: pasos.filter((s) => s.st === "listo").length, error: pasos.some((s) => s.st === "error") };
}
const ICONO = {
  listo: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5 C 7.5 14.5, 9 16, 10.2 17.6 C 12.8 13, 15.6 9.6, 19 6.2"/></svg>`,
  error: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7 C 10 10, 14 14, 17 17 M17 7 C 14 10, 10 14, 7 17"/></svg>`,
  en_curso: `<span class="cargador mini" aria-hidden="true"></span>`,
  pendiente: "",
};
const ST_TX = { listo: "listo", error: "error", en_curso: "en curso", pendiente: "pendiente" };
const LINKS_FIN = [["landing", "La landing"], ["drive", "Los anuncios en Drive"], ["campana", "La campaña en el Administrador"]];
function ofertaPasosHTML(p, o, i) {
  const e = estadoOferta(p, o);
  const d = o.destino || {};
  const pct = Math.round(100 * e.listos / PASOS.length);
  const mk = d.mercado || p.params?.mercado;
  return `<section class="bo-tst boceto${e.error ? " mal" : ""}" aria-labelledby="tst-${i}">
    <div class="bo-tst-cab">
      <div class="bo-tst-tx"><h3 id="tst-${i}">${esc(o.nombre || o.etiqueta || o.id)}</h3>
        <p class="mut">${esc([mk ? nombreMercado(mk) : "", (d.paises || []).slice(0, 8).join(" · ") + ((d.paises || []).length > 8 ? " +" + (d.paises.length - 8) : ""), d.idioma ? (IDIOMAS.find((x) => x[0] === d.idioma) || [0, d.idioma])[1] : "", d.precio ? plata(d.precio, d.moneda) : "", d.hora_inicio ? `inicio ${legible(d.hora_inicio)} local${d.hora_inicio_ar ? ` (${legible(d.hora_inicio_ar)} AR)` : ""}` : "", o.formato ? FORMATO_TX[o.formato] || o.formato : ""].filter(Boolean).join(" · "))}</p></div>
      <span class="bo-tst-pct num" aria-label="${e.listos} de ${PASOS.length} pasos listos">${e.listos}/${PASOS.length}</span>
    </div>
    <div class="bo-tst-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${PASOS.length}" aria-valuenow="${e.listos}" aria-label="Pasos listos de ${esc(o.nombre || o.etiqueta)}"><span style="width:${pct}%"></span></div>
    <ol class="bo-pasos">${e.pasos.map((s) => `<li class="ps-${s.st}">
      <span class="ps-ico">${ICONO[s.st]}</span>
      <div class="ps-tx"><span class="ps-t">${esc(s.t)} <span class="sr">(${ST_TX[s.st]})</span>${s.h ? `<span class="ps-h num">${esc(hora(s.h))}</span>` : ""}</span>
        ${s.tx && s.st !== "pendiente" ? `<span class="ps-d">${esc(s.tx)}</span>` : s.st === "en_curso" ? `<span class="ps-d">en curso…</span>` : ""}
        ${Object.entries(s.links).filter(([, u]) => url(u)).map(([k, u]) => `<a class="bo-lk" href="${esc(u)}" target="_blank" rel="noopener">${esc({ landing: "Ver landing", drive: "Abrir Drive", campana: "Ver campaña", tienda: "Ver tienda", pixel: "Ver pixel" }[k] || k)} ${FLECHA}</a>`).join("")}</div>
    </li>`).join("")}</ol>
    <div class="bo-fin">${LINKS_FIN.map(([k, t]) => url(e.links[k]) ? `<a class="btn chico" href="${esc(e.links[k])}" target="_blank" rel="noopener">${esc(t)} ${FLECHA}</a>` : `<span class="btn chico bo-fin-off" aria-disabled="true">${esc(t)}<small>todavía no</small></span>`).join("")}</div>
  </section>`;
}
function abrirPedido(id) {
  B.abierto = String(id);
  if (B.vista !== "testeos") { B.vista = "testeos"; ls.set("caz_vista", "testeos"); arrancarRefresco(); }
  pintar();
  window.scrollTo({ top: 0, behavior: "auto" });
  cargarPedidos();
}
function pintarPedidoAbierto() {
  const main = $("#bo-main"); if (!main) return;
  const p = pedidoPorId(B.abierto);
  const volver = `<button type="button" class="link bo-volver" id="b-volver">← Todos los testeos</button>`;
  if (!p) {
    main.innerHTML = volver + (B.pedidos == null || B.pedCargando ? `<p class="vacio"><span class="cargador"></span>Buscando el pedido #${esc(B.abierto)}…</p>` : `<div class="vacio boceto bo-vacio">No encontré el pedido #${esc(B.abierto)}.</div>`);
    $("#b-volver").onclick = cerrarPedido;
    return;
  }
  const [et, col] = ESTADOS[p.estado] || [p.estado, ""];
  const pr = p.params || {};
  const ofs = pr.ofertas || [];
  const cancelable = ["pendiente", "trabajando", "listo_revisar", "lanzar"].includes(p.estado);
  const y = window.scrollY;
  const abiertoLog = $("#bo-log")?.open;
  main.innerHTML = `${volver}
    <header class="bo-pa-cab">
      <div><h2>Testeo #${esc(p.id)} <span class="fchip ${col}">${ACTIVOS.includes(p.estado) ? '<span class="cargador mini" aria-hidden="true"></span>' : ""}${esc(et)}</span></h2>
        <p class="mut">${esc([resumenParams(pr), p.quien || pr.quien ? `pidió ${p.quien || pr.quien}` : "", fechaHora(p.creado)].filter(Boolean).join(" · "))}</p></div>
      <span>${compuChip()}</span>
    </header>
    ${p.estado === "listo_revisar" ? `<div class="bo-dale boceto"><p><b>Todo armado y EN PAUSA.</b> Revisá la landing, los anuncios y la campaña. Cuando des el dale, la compu activa SOLO lo de este pedido y a los 10 minutos chequea que haya salido bien.</p><button type="button" class="btn pri" id="b-dale">Dar el dale${pr.prueba ? " (prueba)" : ""}</button></div>` : ""}
    ${p.estado === "error" && p.error ? `<div class="err-box" role="alert"><b>La fábrica cortó:</b> ${esc(p.error)}</div>` : ""}
    ${pr.prueba ? `<p class="bo-pausa">Pedido de PRUEBA: la fábrica recorre los pasos sin crear nada ni gastar.</p>` : ""}
    <div class="bo-tsts">${ofs.length ? ofs.map((o, i) => ofertaPasosHTML(p, o, i)).join("") : `<div class="vacio boceto bo-vacio">Este pedido no tiene ofertas.</div>`}</div>
    <details class="log bo-log" id="bo-log" ${abiertoLog ? "open" : ""}><summary>Registro completo (${(p.progreso || []).length})</summary>
      <ol class="ped-tl">${(p.progreso || []).slice().reverse().map((x) => `<li><span class="ped-h num">${esc(hora(x.t))}</span><span class="tl-tx">${x.oferta ? `<b>${esc(x.oferta)}</b> · ` : ""}${esc((PASOS.find(([k]) => k === (ALIAS[x.etapa] || x.etapa)) || [0, x.etapa])[1])}${x.paso ? ` (${esc(ST_TX[x.paso] || x.paso)})` : ""}: ${esc(x.texto || "")}</span></li>`).join("")}</ol></details>
    <div class="bo-pa-acc">
      ${cancelable ? `<button type="button" class="btn chico" id="b-cancelar">Cancelar</button>` : ""}
      ${p.estado !== "lanzando" ? `<button type="button" class="btn chico peligro" id="b-eliminar">${cancelable ? "Cancelar y eliminar" : "Eliminar"}</button>` : ""}
    </div>`;
  window.scrollTo({ top: y, behavior: "auto" });
  $("#b-volver").onclick = cerrarPedido;
  const d = $("#b-dale"); if (d) d.onclick = () => darDale(p.id);
  const c = $("#b-cancelar"); if (c) c.onclick = () => accionPedido(p, "fabrica_cancelar", "¿Cancelar este testeo?", p.estado === "trabajando" ? "La compu deja de trabajar en él. Lo que ya armó queda creado (en pausa)." : "No se va a hacer.", "Sí, cancelar", `Pedido #${p.id} cancelado.`);
  const el = $("#b-eliminar"); if (el) el.onclick = () => accionPedido(p, "fabrica_eliminar", cancelable ? "¿Cancelar y eliminar este testeo?" : "¿Eliminar este testeo de la lista?", cancelable ? "Se cancela y desaparece de la lista. Lo que ya armó queda creado (en pausa)." : "Desaparece de la lista. No toca nada en Meta.", "Sí, " + (cancelable ? "cancelar y eliminar" : "eliminar"), `Pedido #${p.id} eliminado.`, true);
}
function cerrarPedido() { B.abierto = null; pintar(); window.scrollTo({ top: 0, behavior: "auto" }); }
// (11/10) «Dar el dale»: pasa el pedido a «lanzar» (fabrica_lanzar). La Mac activa SOLO lo de ese pedido.
function darDale(id) {
  const p = pedidoPorId(id); if (!p) return;
  const ofs = p.params?.ofertas || [];
  let enviando = false;
  const m = abrirModal(`<h3>¿Dar el dale al testeo #${esc(id)}?</h3>
    <p>La compu activa en Meta SOLO lo de este pedido, con la hora de inicio programada, y a los 10 minutos chequea que haya salido bien.</p>
    <ul class="bo-m-ofs">${ofs.map((o) => `<li><b>${esc(o.nombre || o.etiqueta)}</b> <span class="mut">${esc(nombreMercado(o.destino?.mercado || ""))}</span></li>`).join("")}</ul>
    ${DEMO ? `<p class="mut">Demo: se simula, no toca Meta.</p>` : dryOn() ? `<p class="mut"><b>Modo prueba:</b> no se manda nada.</p>` : ""}
    <div class="err-box" id="dale-err" role="alert" hidden></div>
    <div class="botones"><button type="button" class="btn" data-x>Todavía no</button><button type="button" class="btn pri" data-ok data-foco>Sí, dale</button></div>`, { bloqueado: () => enviando });
  $("[data-x]", m.dlg).onclick = m.cerrar;
  $("[data-ok]", m.dlg).onclick = async (ev) => {
    if (dryOn() && !DEMO) { m.cerrar(); return toast(`<b>Modo prueba:</b> el pedido #${esc(id)} no se activó.`); }
    const b = ev.currentTarget;
    enviando = true; b.classList.add("cargando"); b.innerHTML = `<span class="gira">↻</span> Mandando…`;
    try { await apiMovil("fabrica_lanzar", { body: { id: Number(id) } }); }
    catch (e) {
      enviando = false;
      if (e.code === 401) { m.cerrar(); ls.del("dash_clave"); return login("Clave incorrecta"); }
      b.classList.remove("cargando"); b.textContent = "Reintentar";
      const box = $("#dale-err", m.dlg); box.hidden = false; box.textContent = `No se pudo: ${e.message}`;
      return;
    }
    enviando = false; m.cerrar();
    toast(`✓ Dale enviado: la compu activa el testeo #${esc(id)} en su próximo latido (menos de 1 min).`, "ok", 7000);
    cargarPedidos();
  };
}
function accionPedido(p, accion, titulo, texto, ok, listo, sacar = false) {
  let enviando = false;
  const m = abrirModal(`<h3>${esc(titulo)}</h3><p class="mut">${esc(texto)}</p>
    <div class="err-box" id="ac-err" role="alert" hidden></div>
    <div class="botones"><button type="button" class="btn" data-x data-foco>No</button><button type="button" class="btn peligro" data-ok>${esc(ok)}</button></div>`, { bloqueado: () => enviando });
  $("[data-x]", m.dlg).onclick = m.cerrar;
  $("[data-ok]", m.dlg).onclick = async (ev) => {
    const b = ev.currentTarget;
    enviando = true; b.classList.add("cargando"); b.innerHTML = `<span class="gira">↻</span> Un momento…`;
    try { await apiMovil(accion, { body: { id: Number(p.id) } }); }
    catch (e) {
      enviando = false;
      if (e.code === 401) { m.cerrar(); ls.del("dash_clave"); return login("Clave incorrecta"); }
      b.classList.remove("cargando"); b.textContent = "Reintentar";
      const box = $("#ac-err", m.dlg); box.hidden = false; box.textContent = `No se pudo: ${e.message}`;
      return;
    }
    enviando = false; m.cerrar();
    toast(esc(listo));
    if (sacar) { B.pedidos = (B.pedidos || []).filter((x) => String(x.id) !== String(p.id)); B.abierto = null; pintar(); }
    cargarPedidos();
  };
}

// ---------- barra flotante ----------
function resumenSel() {
  const c = {};
  for (const [id, mk] of B.sel) { const k = mk || (porId(id) ? destinoDe(porId(id)) : "otro"); c[k] = (c[k] || 0) + 1; }
  return Object.entries(c).map(([k, n]) => `${n} ${corto(k)}`).join(" · ");
}
function pintarBarra() {
  if (!B.montado) return;
  const b = $("#barra");
  const n = B.sel.size;
  if (!n || !B.datos || B.abierto != null) { b.hidden = true; b.innerHTML = ""; return; }
  const ya = !b.hidden;
  b.hidden = false;
  b.className = "barra boceto bo-barra";
  b.style.animation = ya ? "none" : "";
  b.innerHTML = `<div class="cuenta"><span class="num">${n}</span> elegida${n === 1 ? "" : "s"}<small>${esc(resumenSel())}</small></div>
    <button type="button" class="btn chico" id="bo-limpiar" aria-label="Limpiar la selección">✕</button>
    <span class="sp"></span>
    <button type="button" class="btn pri" id="bo-modelar">Modelar</button>`;
  $("#bo-limpiar").onclick = () => { B.sel.clear(); guardarSel(); pintar(); };
  $("#bo-modelar").onclick = modelar;
}

// ---------- pop-up Modelar ----------
function modelar() {
  const elegidas = [...B.sel.keys()].map(porId).filter(Boolean);
  if (!elegidas.length) return toast("Elegí al menos una oferta.", "error");
  const G = { estructura: "cbo_115", presupuesto: PRES_DEF.cbo_115, presTocado: false, creativos: 5, cuenta: "testeos", modo: "tal_cual", prueba: dryOn() || DEMO };
  const OF = new Map();
  const destino = (o, mk) => {
    const m = MOD[mk];
    const d = { mercado: mk, paises: [...m[2]], idioma: m[3], moneda: m[4], precio: m[5], manual: false, hora: null };
    // presencia de la oferta: si corre en países concretos de ese mercado, se prellenan esos (mínimo los del mercado)
    const suyos = o.paises.filter((p) => PAIS_MK[p] === mk || (mk === "latam" && m[2].includes(p)));
    if (suyos.length && mk !== "latam") d.paises = [...new Set([...suyos, ...m[2]])].filter((p) => m[2].includes(p) || suyos.includes(p));
    d.hora = horaPorDefecto(d.paises);
    return d;
  };
  for (const o of elegidas) OF.set(o.id, destino(o, B.sel.get(o.id) || destinoDe(o, o.recomendado)));
  const recalcular = (d) => { if (!d.manual) d.hora = horaPorDefecto(d.paises); else { const z = masAdelantado(d.paises); const r = aAR(z.tz, d.hora.local); d.hora = { ...z, local: d.hora.local, ar: r ? r.ar : "", instante: r?.instante }; } };
  let enviando = false;
  const m = abrirModal("", { ancho: true, bloqueado: () => enviando });
  m.dlg.classList.add("bo-mod");
  const restantes = (d) => Object.keys(ZONA).filter((c) => !d.paises.includes(c)).sort();
  const lista = () => [...OF.keys()].map(porId).filter(Boolean);
  const porMkTx = () => { const c = {}; for (const d of OF.values()) c[d.mercado] = (c[d.mercado] || 0) + 1; return Object.entries(c).map(([k, n]) => `${n} ${MOD[k][1]}`).join(", "); };
  const totalDia = () => (G.estructura === "abo_151" ? G.presupuesto * G.creativos : G.presupuesto) * OF.size;
  const ofHTML = (o) => {
    const d = OF.get(o.id), h = d.hora;
    const pasado = h?.instante && h.instante.getTime() < Date.now();
    return `<li class="bo-mo" data-of="${esc(o.id)}">
      <div class="bo-mo-cab"><div class="bo-of-tx"><b>${esc(o.nombre)}</b><span>${esc(FORMATO_TX[o.formato])} · ${pl(o.anuncios, "anuncio")}${o.mercados.length ? ` · corre en ${esc(o.mercados.map(corto).join(", "))}` : ""}</span></div>
        <button type="button" class="btn chico icono-chico" data-k="q-${esc(o.id)}" data-quitarm="${esc(o.id)}" aria-label="Sacar ${esc(o.nombre)} del pedido" ${OF.size === 1 ? "disabled" : ""}>✕</button></div>
      ${(() => { const r = recomendacion(o); if (!r) return ""; const es = r.mk === d.mercado;
        return `<p class="bo-rec">${es ? "" : "Recomendado: "}<b>${es ? "Te recomiendo " : ""}${esc(r.nombre)}</b>${r.motivo ? `: ${esc(r.motivo)}` : ""}.${es ? "" : ` <button type="button" class="link" data-k="rec-${esc(o.id)}" data-rec="${esc(o.id)}">usar ${esc(r.nombre)}</button>`}</p>`; })()}
      <div class="bo-mo-grid">
        <label><span class="bo-mo-l">Mercado</span><select class="campo" data-k="mk-${esc(o.id)}" data-omk="${esc(o.id)}">${MERCADOS_MOD.map(([k, t]) => `<option value="${k}" ${k === d.mercado ? "selected" : ""}>${esc(t)}${o.mercados.some((x) => destinoDe(o, x) === k) ? " · corre acá" : ""}</option>`).join("")}</select></label>
        <label><span class="bo-mo-l">Idioma</span><select class="campo" data-k="id-${esc(o.id)}" data-oid="${esc(o.id)}">${IDIOMAS.map(([k, t]) => `<option value="${k}" ${k === d.idioma ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <label><span class="bo-mo-l">Precio (${d.moneda === "EUR" ? "€" : "US$"})</span><input class="campo num" data-k="pr-${esc(o.id)}" data-opr="${esc(o.id)}" type="text" inputmode="decimal" value="${esc(NF2.format(d.precio))}"></label>
      </div>
      <div class="bo-mo-pa"><span class="bo-mo-l" id="pa-${esc(o.id)}">Países</span>
        <ul class="bo-paises" aria-labelledby="pa-${esc(o.id)}">${d.paises.map((c) => `<li class="bo-pais"><span class="num">${esc(c)}</span><button type="button" data-k="qp-${esc(o.id)}-${esc(c)}" data-qp="${esc(o.id)}|${esc(c)}" aria-label="Sacar ${esc(c)}" ${d.paises.length === 1 ? "disabled" : ""}>✕</button></li>`).join("")}
          <li class="bo-pais-add"><label class="sr" for="add-${esc(o.id)}">Agregar país</label><select class="campo" id="add-${esc(o.id)}" data-k="ad-${esc(o.id)}" data-add="${esc(o.id)}"><option value="">+ país</option>${restantes(d).map((c) => `<option value="${c}">${c}</option>`).join("")}</select></li></ul></div>
      <div class="bo-mo-hora"><label><span class="bo-mo-l">Inicio <span class="w-ayuda">05:00 de ${esc(h.pais)}, el país más adelantado</span></span>
        <input class="campo num bo-hora" type="datetime-local" step="60" data-k="h-${esc(o.id)}" data-oh="${esc(o.id)}" value="${esc(h.local)}"></label>
        <span class="bo-ar num">${h.ar ? `= <b>${esc(legible(h.ar))}</b> en Argentina` : "Hora inválida"}${d.manual ? ` · <button type="button" class="link" data-k="r-${esc(o.id)}" data-reset="${esc(o.id)}">volver a 05:00</button>` : ""}</span>
        ${pasado ? `<span class="bo-mal" role="alert">Esa hora ya pasó.</span>` : ""}</div>
    </li>`;
  };
  const pintarM = () => {
    const foco = document.activeElement?.dataset?.k || document.activeElement?.id;
    const xs = lista();
    const abo = G.estructura === "abo_151";
    m.set(`<h3>Modelar ${pl(xs.length, "oferta")}</h3>
      <p class="mut">Un testeo por oferta: ${esc(porMkTx())}. Todo queda programado y EN PAUSA hasta tu dale.</p>
      <fieldset class="w-campo"><legend id="lg-es">Estructura</legend>
        <div class="bo-estr" role="group" aria-labelledby="lg-es">${ESTRUCTURAS.map(([k, t, ay, rec]) => `<button type="button" class="bo-estr-b" data-k="es-${k}" data-estr="${k}" aria-pressed="${k === G.estructura}"><b>${esc(t)}${rec ? ` <span class="fchip verde">recomendada</span>` : ""}</b><small>${esc(ay)}</small></button>`).join("")}</div></fieldset>
      <div class="bo-mod-fila">
        <label class="w-campo"><span class="w-lbl">Presupuesto por día ${abo ? "por conjunto" : "por campaña"}</span>
          <input class="campo num bo-pres" id="m-pres" data-k="m-pres" type="text" inputmode="decimal" value="${esc(NF2.format(G.presupuesto))}">
          <span class="w-ayuda">Siempre termina en ,55.${abo ? ` ${G.creativos} conjuntos = ${esc(NF2.format(G.presupuesto * G.creativos))} por testeo.` : ""}</span></label>
        <div class="w-campo"><span class="w-lbl" id="lg-cr">Creativos por testeo</span>
          <div class="bo-step" role="group" aria-labelledby="lg-cr"><button type="button" class="btn chico" data-k="cr-m" data-cr="-1" aria-label="Uno menos" ${G.creativos <= 1 ? "disabled" : ""}>−</button><b class="num" aria-live="polite">${G.creativos}</b><button type="button" class="btn chico" data-k="cr-p" data-cr="1" aria-label="Uno más" ${G.creativos >= 10 ? "disabled" : ""}>+</button></div>
          <span class="w-ayuda">Los más escalados de la competencia, rehechos. 5 es lo de siempre.</span></div>
        <div class="w-campo"><span class="w-lbl" id="lg-cu">Cuenta</span><div class="segs" role="group" aria-labelledby="lg-cu">${CUENTAS.map(([k, t]) => `<button type="button" class="seg-b" data-k="cu-${k}" data-cu="${k}" aria-pressed="${k === G.cuenta}">${t}</button>`).join("")}</div></div>
      </div>
      <h4 class="bo-mod-sub">Cada testeo</h4>
      <ul class="bo-mos">${xs.map(ofHTML).join("")}</ul>
      <p class="bo-mod-tot">Cuando des el dale: <b class="num">${esc(NF2.format(totalDia()))}</b> por día en total entre los ${pl(xs.length, "testeo")} (${esc(ESTR_TX[G.estructura])}, ${pl(G.creativos, "creativo")} cada uno). Página, pixel nuevo, CAPI y dominio los arma la fábrica según las reglas.</p>
      <label class="bo-prueba"><input type="checkbox" id="m-prueba" ${G.prueba ? "checked" : ""}><span>Pedido de prueba (recorre los pasos sin crear nada)</span></label>
      <p class="bo-pausa"><b>Las campañas quedan programadas y EN PAUSA hasta tu dale. El pedido no activa nada solo.</b></p>
      ${DEMO ? `<p class="mut">Demo: el pedido se simula, no va a ninguna compu.</p>` : ""}
      ${B.compu && !B.compu.prendida ? `<p class="hint error">La compu figura apagada: el pedido puede rebotar.</p>` : ""}
      <div class="err-box" id="m-err" role="alert" hidden></div>
      <div class="botones"><button type="button" class="btn" data-x>Cancelar</button><button type="button" class="btn pri" data-ok data-foco>Confirmar ${pl(xs.length, "testeo")}</button></div>`);
    const d = m.dlg;
    $("[data-x]", d).onclick = m.cerrar;
    $$("[data-estr]", d).forEach((b) => b.onclick = () => { G.estructura = b.dataset.estr; if (!G.presTocado) G.presupuesto = PRES_DEF[G.estructura]; pintarM(); });
    $("#m-pres", d).onchange = (e) => { const v = a55(e.target.value); if (v) { G.presupuesto = v; G.presTocado = true; } pintarM(); };
    $$("[data-cr]", d).forEach((b) => b.onclick = () => { G.creativos = Math.min(10, Math.max(1, G.creativos + Number(b.dataset.cr))); pintarM(); });
    $$("[data-cu]", d).forEach((b) => b.onclick = () => { G.cuenta = b.dataset.cu; pintarM(); });
    $$("[data-quitarm]", d).forEach((b) => b.onclick = () => { if (OF.size < 2) return; OF.delete(b.dataset.quitarm); B.sel.delete(b.dataset.quitarm); guardarSel(); pintarBarra(); pintarM(); });
    $$("[data-omk]", d).forEach((s) => s.onchange = () => { const o = porId(s.dataset.omk); OF.set(o.id, destino(o, s.value)); B.sel.set(o.id, s.value); guardarSel(); pintarBarra(); pintarM(); });
    $$("[data-rec]", d).forEach((b) => b.onclick = () => { const o = porId(b.dataset.rec); const r = recomendacion(o); OF.set(o.id, destino(o, r.mk)); B.sel.set(o.id, r.mk); guardarSel(); pintarBarra(); pintarM(); });
    $$("[data-oid]", d).forEach((s) => s.onchange = () => { OF.get(s.dataset.oid).idioma = s.value; pintarM(); });
    $$("[data-opr]", d).forEach((s) => s.onchange = () => { const v = Number(String(s.value).replace(/\./g, "").replace(",", ".")); if (v > 0) OF.get(s.dataset.opr).precio = Math.round(v * 100) / 100; pintarM(); });
    $$("[data-qp]", d).forEach((b) => b.onclick = () => { const [id, c] = b.dataset.qp.split("|"); const x = OF.get(id); if (x.paises.length < 2) return; x.paises = x.paises.filter((p) => p !== c); recalcular(x); pintarM(); const a = $(`[data-add="${CSS.escape(id)}"]`, d); if (a) a.focus(); });
    $$("[data-add]", d).forEach((s) => s.onchange = () => { if (!s.value) return; const x = OF.get(s.dataset.add); x.paises.push(s.value); recalcular(x); pintarM(); });
    $$("[data-oh]", d).forEach((s) => s.onchange = () => { const x = OF.get(s.dataset.oh); const r = aAR(x.hora.tz, s.value); x.manual = true; x.hora = { ...x.hora, local: s.value, ar: r ? r.ar : "", instante: r?.instante }; pintarM(); });
    $$("[data-reset]", d).forEach((b) => b.onclick = () => { const x = OF.get(b.dataset.reset); x.manual = false; recalcular(x); pintarM(); });
    $("#m-prueba", d).onchange = (e) => { G.prueba = e.target.checked; };
    $("[data-ok]", d).onclick = (ev) => enviar(ev.currentTarget);
    if (foco) { const f = $(`[data-k="${CSS.escape(foco)}"]`, d) || $("#" + CSS.escape(foco), d); if (f) f.focus({ preventScroll: true }); }
  };
  const enviar = async (btn) => {
    const err = $("#m-err", m.dlg);
    const mostrarErr = (t) => { err.hidden = false; err.textContent = t; err.scrollIntoView({ block: "nearest", behavior: reducido() ? "auto" : "smooth" }); };
    const xs = lista();
    for (const o of xs) {
      const d = OF.get(o.id);
      if (!d.hora?.local || !d.hora?.ar) return mostrarErr(`${o.nombre}: poné una hora de inicio válida.`);
      if (d.hora.instante && d.hora.instante.getTime() < Date.now()) return mostrarErr(`${o.nombre}: la hora de inicio ya pasó.`);
      if (!d.paises.length) return mostrarErr(`${o.nombre}: elegí al menos un país.`);
      if (!(d.precio > 0)) return mostrarErr(`${o.nombre}: falta el precio.`);
    }
    const body = {
      estructura: G.estructura, presupuesto: G.presupuesto, creativos: G.creativos, cuenta: G.cuenta, modo: G.modo, prueba: !!G.prueba,
      quien: ls.get("dash_quien") || "Lorenzo",
      ofertas: xs.map((o) => { const d = OF.get(o.id); return { id: o.id, mercado: d.mercado, paises: d.paises, idioma: d.idioma, precio: d.precio, moneda: d.moneda,
        hora_inicio: d.hora.local, hora_inicio_tz: d.hora.tz, hora_inicio_ar: d.hora.ar }; }),
    };
    enviando = true;
    btn.classList.add("cargando"); btn.innerHTML = `<span class="gira">↻</span> Enviando…`;
    $("[data-x]", m.dlg).disabled = true;
    try {
      const r = await apiMovil("testeo_pedido", { body });
      enviando = false;
      m.cerrar();
      toast(`✓ Pedido <b>#${esc(r?.id ?? "?")}</b> enviado${body.prueba ? " (de prueba)" : ""}. Queda en pausa hasta tu dale.`, "ok", 7000);
      for (const o of xs) B.sel.delete(o.id);
      guardarSel();
      if (r?.id != null) abrirPedido(r.id); else irA("testeos");
    } catch (e) {
      enviando = false;
      btn.classList.remove("cargando"); btn.textContent = `Confirmar ${pl(xs.length, "testeo")}`;
      $("[data-x]", m.dlg).disabled = false;
      if (e.code === 401) { m.cerrar(); ls.del("dash_clave"); return login("Clave incorrecta"); }
      mostrarErr(e.code === 409 ? `La compu está apagada: prendela y volvé a confirmar (o marcá «pedido de prueba»).` : `No se pudo mandar el pedido: ${e.message}`);
    }
  };
  pintarM();
}

// ---------- navegación (sub-vistas del Cazador) ----------
function irA(v) {
  B.vista = v;
  if (v !== "testeos") B.abierto = null;
  ls.set("caz_vista", v);
  pintar();
  if (v === "testeos") { cargarPedidos(); arrancarRefresco(); } else pararRefresco();
  window.scrollTo({ top: 0, behavior: "auto" });
}

// ---------- montaje dentro del Dashboard ----------
let escuchando = false;
function escuchar() {
  if (escuchando) return; escuchando = true;
  document.addEventListener("visibilitychange", () => { if (B.montado && !document.hidden && B.vista === "testeos") cargarPedidos(); });
  addEventListener("storage", (e) => { if (e.key === "buscador_sel") { B.sel.clear(); try { (JSON.parse(e.newValue || "[]") || []).forEach((x) => Array.isArray(x) ? B.sel.set(String(x[0]), x[1] || null) : B.sel.set(String(x), null)); } catch {} pintar(); } });
}
// raiz: el contenedor que le da el Dashboard. ctx: { login(msg), pedido }.
function montar(raiz, ctx = {}) {
  CTX = { ...CTX, ...ctx };
  escuchar();
  const v = { ganadoras: "ofertas", oportunidades: "ofertas", seleccionadas: "testeos" }[ls.get("caz_vista")] || ls.get("caz_vista");
  if (VISTAS.some(([k]) => k === v)) B.vista = v;
  if (ctx.pedido != null) { B.vista = "testeos"; B.abierto = String(ctx.pedido); }
  raiz.innerHTML = `<nav class="bo-tabs" id="bo-tabs" aria-label="Vistas del Cazador">${VISTAS.map(([k, t]) => `<button type="button" class="seccion" data-vista="${k}" aria-pressed="${k === B.vista}">${t}${k === "testeos" ? ` <span class="num" id="tab-n"></span>` : ""}</button>`).join("")}</nav>
    <div id="bo-main"></div>`;
  $$("#bo-tabs [data-vista]", raiz).forEach((b) => b.onclick = () => irA(b.dataset.vista));
  B.montado = true;
  if (!DEMO && !clave()) return login();
  pintar();
  // Datos guardados: se muestran al toque y se refrescan si tienen más de 10 min.
  if (!B.datos || !B.cargado || Date.now() - B.cargado > 10 * 60000) cargar(); else cargarPedidos();
  if (B.vista === "testeos") arrancarRefresco();
}
function desmontar() {
  if (!B.montado) return;
  B.montado = false;
  pararRefresco();
  cerrarModal();
}
window.Cazador = {
  montar, desmontar,
  refrescar: () => { if (B.montado) { cargar(); if (B.vista === "testeos") cargarPedidos(); } },
  pintarBarra: () => { if (B.montado) pintarBarra(); },
  abrirPedido: (id) => { if (B.montado) abrirPedido(id); },
};
})();

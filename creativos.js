/* Creativos — sección del Dashboard desde el 12/10. Un «Drive» de todos los anuncios, compartido entre Lorenzo y Franco.
   Carpeta por oferta · mercado → carpeta por fecha de salida (la primera = Testeo, las demás = Renovaciones) → tarjetas con la portada.
   ⋯ de la carpeta: Correcciones generales, Transcribir todos, Ver guiones y el switch Ver métricas (Total / Hoy / Ayer / Personalizado).
   ⋯ de cada tarjeta: Correcciones (chat que toma el Claude de la Mac), Transcribir (guion en español), ver en Facebook / Drive.
   app.js lo carga la primera vez que se entra y lo monta con window.Creativos.montar(raiz, ctx).
   Backend: app-movil, módulo creativos.ts (copia en Segundo-cerebro-business/scripts/supabase/app-movil/creativos.ts). */
"use strict";
(() => {
const API = "https://tppcpnfzcxxusdhrlmdx.supabase.co/functions/v1/app-movil";
const TZ_AR = "America/Argentina/Buenos_Aires";
const POLL_MS = 4000;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ls = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const url = (u) => /^https?:\/\//i.test(String(u || "")) ? String(u) : "";
const clave = () => ls.get("dash_clave", "");
// (14/10) quién mira (para «sin ver»): sale del mail con que entró; el servidor prefiere el de la contraseña
const USUARIO_ID = { "lorenleiva7@gmail.com": "lorenzo", "francoaguero611@gmail.com": "franco" };
const usuarioId = () => USUARIO_ID[String(ls.get("dash_usuario", "")).toLowerCase()] || "";
const hoyAR = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ_AR }).format(d);
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const dm = (f) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f || ""); return m ? `${+m[3]}/${+m[2]}` : f; };
const diaSem = (f) => { try { return DIAS[new Date(f + "T12:00:00Z").getUTCDay()]; } catch { return ""; } };
const plata = (n) => n == null ? "—" : "$" + Number(n).toLocaleString("es-AR", { minimumFractionDigits: n >= 100 ? 0 : 2, maximumFractionDigits: n >= 100 ? 0 : 2 });
const roasCls = (r) => r == null ? "gris" : r < 1 ? "rojo" : r < 1.5 ? "nar" : r < 2 ? "ama" : "ver";
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
const PERSONAS = [["lorenzo", "Lorenzo"], ["franco", "Franco"]];
const ESTADO_CHAT = { abierto: "Sin mandar", en_cola: "En cola en la Mac", trabajando: "Claude está trabajando", listo: "Listo", error: "Hubo un problema" };
const ICO = {
  carpeta: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3.5 6.5 C 3.4 5.6, 4 5, 4.9 5 L9.2 5 L11 7 L19.2 7 C 20.1 7, 20.6 7.6, 20.5 8.5 L20.3 17.8 C 20.2 18.6, 19.7 19.1, 18.9 19.1 L5 19 C 4.2 19, 3.6 18.5, 3.6 17.7 Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>',
  puntos: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="5.5" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/><circle cx="18.5" cy="12" r="1.9" fill="currentColor"/></svg>',
  play: '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M8.5 5.8 L18.6 12 L8.5 18.2 Z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
};

const C = {
  raiz: null, ctx: {}, montado: false,
  o: null, g: null, f: null,              // ruta: oferta, grupo (oferta|mercado) y fecha
  raizD: null, oferta: {}, carpeta: {},   // datos
  buscar: "",
  metr: ls.get("cr_metr", "0") === "1",   // switch «Ver métricas»
  periodo: "total", desde: hoyAR(), hasta: hoyAR(),
  m: null, mCargando: false, mErr: null,  // métricas de la carpeta abierta
  timer: null, chatTimer: null,
  fila: null, filaTimer: null, abrirLuego: null,   // (13/10) fila «Correcciones» de arriba
  quien: ls.get("ws_persona", "lorenzo"),
  orden: ls.get("cr_orden", "mod"), ordenF: ls.get("cr_orden_f", "nuevas"),   // (14/10) orden de las carpetas (se recuerda)
  vistoP: null,                           // (14/10) marca de «vistos» en camino (la raíz espera a que termine)
};

// (14/10) Orden de carpetas: ofertas y mercados (con Alfabético) y fechas (sin Alfabético). «Más nuevas/antiguas» = cuándo arrancó la carpeta;
// «Últimas modificaciones» = la que tiene el creativo agregado o corregido más reciente; «Sin ver primero» = las de estrellita arriba.
const ORDENES = [["mod", "Últimas modificaciones"], ["nuevas", "Más nuevas"], ["antiguas", "Más antiguas"], ["alfa", "Alfabético (A→Z)"], ["sinver", "Sin ver primero"]];
const cmpS = (a, b) => String(a ?? "").localeCompare(String(b ?? ""));
function ordenar(xs, ord, nombre) {
  const F = {
    mod: (a, b) => cmpS(b.mod || b.ultima, a.mod || a.ultima),
    nuevas: (a, b) => cmpS(b.primera, a.primera) || cmpS(b.ultima, a.ultima),
    antiguas: (a, b) => cmpS(a.primera, b.primera) || cmpS(a.ultima, b.ultima),
    alfa: (a, b) => String(nombre(a) || "").localeCompare(String(nombre(b) || ""), "es", { sensitivity: "base", numeric: true }),
    sinver: (a, b) => ((b.sin_ver > 0) - (a.sin_ver > 0)) || cmpS(b.mod || b.ultima, a.mod || a.ultima),
  };
  return [...xs].sort((a, b) => (F[ord] || F.mod)(a, b) || cmpS(b.ultima, a.ultima) || (b.n || 0) - (a.n || 0));
}
function selOrden(id, valor, sinAlfa = false) {
  return `<label class="cr-orden"><span class="sr">Ordenar carpetas</span><select class="campo" id="${id}" aria-label="Ordenar carpetas">${ORDENES.filter(([k]) => !(sinAlfa && k === "alfa"))
    .map(([k, t]) => `<option value="${k}" ${k === valor ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
}
// estrellita «sin ver» en la esquina de la carpeta
const estrella = (n) => n > 0 ? `<span class="cr-sinver" title="${n} creativo${n === 1 ? "" : "s"} sin ver" aria-label="${n} sin ver">★</span>` : "";
const claseSinVer = (n) => n > 0 ? " sinver" : "";

async function api(accion, { q = "", body = null } = {}) {
  const r = await fetch(`${API}?accion=${accion}${q}`, {
    method: body ? "POST" : "GET",
    headers: { "x-app-clave": clave(), ...(usuarioId() ? { "x-app-usuario": usuarioId() } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { const e = new Error("Clave incorrecta"); e.code = 401; throw e; }
  if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}
const falla = (e) => { if (e.code === 401) { desmontar(); C.ctx.login?.("Clave incorrecta"); return true; } return false; };
const toast = (m, t) => C.ctx.toast ? C.ctx.toast(esc(m), t) : null;

// ---------------------------------------------------------------- ruta (#creativos · #creativos/of/<oferta> · #creativos/<grupo>/<fecha>)
// (13/10) Oferta → Mercado → Fecha. El grupo es «oferta|mercado»: la oferta sale de la primera parte.
// Si el nombre trae el mercado («Moldes de vestidos (EN)», «Cocina antiinflamatoria DACH», «(MX) Niños felices»), se saca para juntarlas
const MERC_RE = "en|fr|de|it|pt|br|mx|ar|es|co|cl|pe|uk|us|dach|francia|italia|alemania|anglo|latam|brasil|mexico|argentina|espana|portugal";
const ofertaDe = (g) => { const o = String(g || "").split("|")[0]; return o.replace(new RegExp(`^(${MERC_RE})-(?=.)`), "").replace(new RegExp(`(-(${MERC_RE}))+$`), "") || o || null; };
const nombreOferta = (n) => String(n || "").replace(new RegExp(`^\\((${MERC_RE})\\)\\s*`, "i"), "").replace(new RegExp(`\\s*(\\((${MERC_RE})\\)|\\b(${MERC_RE}))\\s*$`, "i"), "").trim() || n;
function leerRuta() {
  const p = location.hash.slice(1).split("/");
  if (p[0] !== "creativos") return {};
  if (p[1] === "of") return { o: p[2] ? decodeURIComponent(p[2]) : null };
  return { g: p[1] ? decodeURIComponent(p[1]) : null, f: /^\d{4}-\d{2}-\d{2}$/.test(p[2] || "") ? p[2] : null, chat: /^chat-(\d+)$/.exec(p[3] || "")?.[1] ?? null };
}
function ponerRuta(r) { C.g = r.g || null; C.f = r.f || null; C.o = r.o || ofertaDe(C.g); }
function ir(g = null, f = null, { empujar = true, o = null } = {}) {
  salirDeFecha(g, f);
  ponerRuta({ g, f, o }); C.m = null; C.mErr = null;
  const h = "#creativos" + (g ? "/" + encodeURIComponent(g) + (f ? "/" + f : "") : C.o ? "/of/" + encodeURIComponent(C.o) : "");
  try { if (empujar && location.hash !== h) history.pushState(null, "", location.pathname + location.search + h); else history.replaceState(null, "", location.pathname + location.search + h); } catch {}
  pintar(); window.scrollTo(0, 0);
  cargar();
}

// ---------------------------------------------------------------- montar
function montar(raiz, ctx = {}) {
  C.raiz = raiz; C.ctx = ctx; C.montado = true;
  const r = ctx.ruta || leerRuta();
  ponerRuta(r);
  addEventListener("popstate", alVolver);
  document.addEventListener("click", cerrarMenusFuera);
  document.addEventListener("keydown", teclaMenus);
  pintar(); cargar(); cargarFila();
  if (r.chat) abrirChat({ chatId: Number(r.chat) });
}
function desmontar() {
  C.montado = false; clearTimeout(C.timer); C.timer = null; clearTimeout(C.filaTimer); C.filaTimer = null; clearInterval(C.chatTimer); C.chatTimer = null;
  removeEventListener("popstate", alVolver);
  document.removeEventListener("click", cerrarMenusFuera);
  document.removeEventListener("keydown", teclaMenus);
}
// (14/10) «sin ver»: al entrar a una fecha se marcan vistos en el backend (por usuario); al salir se apagan las estrellitas de esas tarjetas
function marcarVistos(g, f) {
  const d = C.carpeta[g + "|" + f]; if (!d || !d.creativos.some((c) => c.nuevo)) return;
  C.vistoP = api("creativos_visto", { body: { grupo: g, fecha: f } }).catch(() => {}).finally(() => { C.vistoP = null; });
  const cg = (C.raizD?.carpetas || []).find((x) => x.grupo === g); const fo = (C.oferta[g]?.fechas || []).find((x) => x.fecha === f);
  const n = fo?.sin_ver || 0; if (fo) fo.sin_ver = 0; if (cg) cg.sin_ver = Math.max(0, (cg.sin_ver || 0) - n);
}
function salirDeFecha(g, f) {
  if (!C.g || !C.f || (C.g === g && C.f === f)) return;
  const d = C.carpeta[C.g + "|" + C.f]; if (d) d.creativos.forEach((c) => { c.nuevo = false; });
}
function alVolver() { if (!C.montado) return; const r = leerRuta(); if (!location.hash.startsWith("#creativos")) return; salirDeFecha(r.g, r.f); ponerRuta(r); C.m = null; pintar(); cargar(); }
// desde un aviso: abrir la carpeta y el chat
function abrir({ g = null, f = null, chat = null } = {}) {
  if (!C.montado) return;
  ir(g, f, { empujar: true });
  if (chat) abrirChat({ chatId: Number(chat) });
}

// ---------------------------------------------------------------- datos
async function cargar({ sync = false } = {}) {
  clearTimeout(C.timer); C.timer = null;
  const g = C.g, f = C.f;
  try {
    if (sync) { const r = await api("creativos_sync", { body: {} }); toast(r.nuevos ? `Listo: ${r.nuevos} creativos nuevos` : "Al día: no hay creativos nuevos"); }
    if (g && !C.raizD) api("creativos").then((r) => { C.raizD = r; if (C.montado && C.g === g) pintar(); }).catch(() => {}); // nombre de la oferta en las migas
    if (!g) { if (C.vistoP) await C.vistoP; C.raizD = await api("creativos"); }
    else if (!f) { if (C.vistoP) await C.vistoP; C.oferta[g] = await api("creativos", { q: `&grupo=${encodeURIComponent(g)}` }); }
    else C.carpeta[g + "|" + f] = await api("creativos", { q: `&grupo=${encodeURIComponent(g)}&fecha=${f}` });
  } catch (e) {
    if (falla(e)) return;
    if (C.montado && C.g === g && C.f === f) pintarError(e.message);
    return;
  }
  if (!C.montado || C.g !== g || C.f !== f) return;
  if (f) marcarVistos(g, f);
  pintar();
  if (f && C.metr && !C.m && !C.mCargando) cargarMetricas();
  if (f && C.abrirLuego) { const q = C.abrirLuego; C.abrirLuego = null; const d0 = C.carpeta[g + "|" + f];
    const cr = d0?.creativos.find((x) => x.id === q.id || x.anterior?.id === q.id || x.id === q.id2);
    if (q.chat) abrirChat({ chatId: q.chat }); else if (cr) verCreativo(cr); }
  // mientras haya transcripciones o correcciones en curso, se refresca solo
  const d = f ? C.carpeta[g + "|" + f] : null;
  const vivo = d && (d.creativos.some((c) => ["en_cola", "transcribiendo"].includes(c.transcripcion?.estado)) || d.chats.some((c) => ["en_cola", "trabajando"].includes(c.estado)));
  if (vivo) C.timer = setTimeout(() => { if (!document.hidden) cargar(); else C.timer = setTimeout(() => cargar(), POLL_MS * 2); }, POLL_MS);
}
async function cargarMetricas({ forzar = false } = {}) {
  const g = C.g, f = C.f; if (!g || !f) return;
  C.mCargando = true; C.mErr = null; pintarMetricas();
  try {
    const m = await api("creativos_metricas", { body: { grupo: g, fecha: f, periodo: C.periodo, desde: C.desde, hasta: C.hasta, forzar } });
    if (C.g === g && C.f === f) C.m = m;
  } catch (e) { if (falla(e)) return; C.mErr = e.message; }
  C.mCargando = false;
  if (C.montado && C.g === g && C.f === f) { pintarMetricas(); pintarTarjetas(); }
}

// ---------------------------------------------------------------- fila «Correcciones» (13/10)
// Arriba de todo, en cualquier carpeta: lo que se está corrigiendo y lo terminado en las últimas 48 h, de todas las ofertas y mercados.
async function cargarFila() {
  clearTimeout(C.filaTimer); C.filaTimer = null;
  try { C.fila = (await api("creativos_correcciones")).items || []; } catch (e) { if (falla(e)) return; }
  if (!C.montado) return;
  pintarFila();
  const vivo = (C.fila || []).some((x) => ["en_cola", "trabajando"].includes(x.estado));
  C.filaTimer = setTimeout(() => { if (C.montado) document.hidden ? (C.filaTimer = setTimeout(cargarFila, 30000)) : cargarFila(); }, vivo ? 6000 : 30000);
}
function pintarFila() {
  const n = $("#cr-fila", C.raiz); if (!n) return;
  const L = C.fila || [];
  if (!L.length) { n.hidden = true; n.innerHTML = ""; return; }
  const enMarcha = L.filter((x) => ["en_cola", "trabajando"].includes(x.estado)).length, terminadas = L.filter((x) => ["listo", "error"].includes(x.estado)).length;
  const scroll = $(".cr-fila-pista", n)?.scrollLeft || 0;
  n.hidden = false;
  // (14/10) estado claro: Enviada → En proceso (% y paso) → Lista / Error, con el último mensaje; «Limpiar» oculta las terminadas (por usuario)
  const ETQ = { en_cola: "Enviada", trabajando: "En proceso", listo: "Lista", error: "Error" };
  n.innerHTML = `<div class="cr-fila-cab"><b>Correcciones</b><span class="cr-mut">${enMarcha ? `${enMarcha} en marcha` : ""}${enMarcha && terminadas ? " · " : ""}${terminadas ? `${terminadas} terminada${terminadas === 1 ? "" : "s"}` : ""}</span>
      ${terminadas ? `<button type="button" class="btn chico cr-limpiar" data-limpiar title="Saca de esta franja las correcciones terminadas (no borra los chats)">Limpiar</button>` : ""}</div>
    <div class="cr-fila-pista" role="list">${L.map((x, i) => {
      const a = avance(x), vivo = ["en_cola", "trabajando"].includes(x.estado);
      const ult = x.ultimo?.texto ? String(x.ultimo.texto).replace(/\s+/g, " ") : "";
      const detalle = x.estado === "trabajando" ? `${a.txt} · ≈ ${a.resta} min` : x.estado === "en_cola" ? "Esperando turno en la Mac" : ult || (x.estado === "error" ? "Hubo un problema · ver chat" : "");
      return `<button type="button" class="cr-fi e-${esc(x.estado)}" role="listitem" data-k="${i}" aria-label="${esc(`${x.etiqueta} ${x.nombre || "carpeta " + dm(x.fecha)}: ${ETQ[x.estado] || x.estado}${x.estado === "trabajando" ? " " + a.pct + " %" : ""}`)}">
        <span class="cr-fi-img">${x.thumb ? `<img src="${esc(url(x.thumb))}" alt="" loading="lazy" onerror="this.remove()">` : ""}
          <span class="cr-fi-est">${x.estado === "listo" ? "✓" : x.estado === "error" ? "✕" : x.estado === "en_cola" ? "⋯" : `${a.pct}%`}</span></span>
        <span class="cr-fi-tx">
          <span class="cr-fi-of">${x.bandera ? `${esc(x.bandera)} ` : ""}${esc(x.oferta || x.etiqueta)}${x.mercado ? ` · ${esc(x.mercado)}` : ""}</span>
          <span class="cr-fi-nom">${esc(x.nombre || `Toda la carpeta ${dm(x.fecha)}`)}</span>
          <span class="cr-fi-paso"><span class="cr-fi-chip c-${esc(x.estado)}">${esc(ETQ[x.estado] || x.estado)}${x.estado === "trabajando" ? ` ${a.pct}%` : ""}</span><span class="cr-fi-hora">${esc(horaCorta(x.actualizado))}</span></span>
          ${vivo && x.estado === "trabajando" ? `<span class="cr-fi-barra"><span style="width:${a.pct}%"></span></span>` : ""}
          ${detalle ? `<span class="cr-fi-sub" title="${esc(detalle)}">${esc(detalle)}</span>` : ""}
          ${x.estado === "listo" && x.alcance === "creativo" && x.nuevo_id ? `<span class="cr-fi-ver">▶ Ver video corregido</span>` : x.estado === "listo" ? `<span class="cr-fi-ver">Abrir</span>` : ""}
        </span>
      </button>`; }).join("")}</div>`;
  const bl = $("[data-limpiar]", n);
  if (bl) bl.onclick = async () => {
    const ids = L.filter((x) => ["listo", "error"].includes(x.estado)).map((x) => x.chat);
    C.fila = L.filter((x) => !ids.includes(x.chat)); pintarFila();
    try { await api("creativos_correcciones_limpiar", { body: { chats: ids } }); toast(`Listo: ${ids.length} correcci${ids.length === 1 ? "ón" : "ones"} fuera de la franja`); }
    catch (e) { if (!falla(e)) toast("No se pudo limpiar: " + e.message, "error"); cargarFila(); }
  };
  const p = $(".cr-fila-pista", n); p.scrollLeft = scroll;
  $$("[data-k]", n).forEach((b) => b.onclick = () => {
    const x = L[Number(b.dataset.k)];
    // terminada: abre el video nuevo · en marcha o con error: abre el chat · general: abre la carpeta
    if (x.alcance === "creativo" && x.estado === "listo") C.abrirLuego = { id: x.nuevo_id || x.creativo_id, id2: x.creativo_id };
    else if (x.alcance === "creativo" || x.estado === "error") C.abrirLuego = { chat: x.chat };
    if (C.g === x.grupo && C.f === x.fecha && C.carpeta[x.grupo + "|" + x.fecha]) { const q = C.abrirLuego; C.abrirLuego = null;
      if (q?.chat) abrirChat({ chatId: q.chat }); else if (q) { const cr = C.carpeta[x.grupo + "|" + x.fecha].creativos.find((y) => y.id === q.id || y.anterior?.id === q.id2 || y.id === q.id2); if (cr) verCreativo(cr); } return; }
    ir(x.grupo, x.fecha);
  });
}

// ---------------------------------------------------------------- pintar
function migas() {
  const partes = [`<button type="button" class="cr-miga" data-ir="">${ICO.carpeta}Creativos</button>`];
  if (C.o) {
    const of = ofertas().find((x) => x.o === C.o);
    partes.push(`<button type="button" class="cr-miga" data-ir-o="${esc(C.o)}" ${C.g ? "" : 'aria-current="page"'}>${esc(of?.nombre || C.o)}</button>`);
  }
  if (C.g) {
    const d = C.oferta[C.g] || C.carpeta[C.g + "|" + C.f] || {};
    const cg = (C.raizD?.carpetas || []).find((x) => x.grupo === C.g);
    const etq = cg?.mercado || d.etiqueta || C.g;
    const ban = d.bandera || (C.raizD?.carpetas || []).find((x) => x.grupo === C.g)?.bandera || "";
    partes.push(`<button type="button" class="cr-miga" data-ir="${esc(C.g)}" ${C.f ? "" : 'aria-current="page"'}>${ban ? `<span aria-hidden="true">${esc(ban)}</span> ` : ""}${esc(etq)}</button>`);
  }
  if (C.f) {
    const d = C.carpeta[C.g + "|" + C.f];
    partes.push(`<span class="cr-miga actual" aria-current="page">${esc(dm(C.f))}${d?.tipo ? ` · ${d.tipo === "testeo" ? "Testeo" : "Renovaciones"}` : ""}</span>`);
  }
  return `<nav class="cr-migas" aria-label="Carpetas">${partes.join('<span class="cr-sep" aria-hidden="true">›</span>')}</nav>`;
}

function pintar() {
  if (!C.montado || !C.raiz) return;
  const acciones = !C.g && !C.o
    ? `<button type="button" class="btn chico" data-sync title="Trae de Meta los anuncios que salieron recién">↻ Buscar nuevos</button>`
    : C.f ? `<div class="cr-menu-wrap"><button type="button" class="btn icono cr-puntos" data-menu="carpeta" aria-haspopup="true" aria-expanded="false" aria-label="Opciones de la carpeta">${ICO.puntos}</button></div>` : "";
  C.raiz.innerHTML = `<div class="cr-fila" id="cr-fila" hidden></div><div class="cr-cab">${migas()}<div class="cr-acc">${acciones}</div></div><div class="cr-cuerpo" id="cr-cuerpo"></div>`;
  pintarFila();
  $$("[data-ir]", C.raiz).forEach((b) => b.onclick = () => ir(b.dataset.ir || null, null));
  $$("[data-ir-o]", C.raiz).forEach((b) => b.onclick = () => ir(null, null, { o: b.dataset.irO }));
  const s = $("[data-sync]", C.raiz);
  if (s) s.onclick = async () => { s.classList.add("cargando"); s.disabled = true; await cargar({ sync: true }); };
  const p = $('[data-menu="carpeta"]', C.raiz); if (p) p.onclick = (e) => { e.stopPropagation(); menuCarpeta(p); };
  if (!C.g && !C.o) pintarRaiz(); else if (!C.g) pintarMercados(); else if (!C.f) pintarOferta(); else pintarCarpeta();
}
function pintarError(msg) {
  const c = $("#cr-cuerpo", C.raiz); if (!c) return;
  c.innerHTML = `<div class="err-box" role="alert"><b>No se pudo cargar.</b> ${esc(msg)}<div><button type="button" class="btn chico" data-re>Reintentar</button></div></div>`;
  $("[data-re]", c).onclick = () => { pintar(); cargar(); };
}
const cargando = (t) => `<p class="vacio"><span class="cargador"></span>${esc(t)}</p>`;
const collage = (ps) => `<div class="cr-collage n${Math.min(3, ps.length)}" aria-hidden="true">${ps.slice(0, 3).map((p) => `<img src="${esc(url(p))}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`).join("") || ICO.carpeta}</div>`;

// Ofertas: junta los grupos (oferta|mercado) de la misma oferta
function ofertas() {
  const m = new Map();
  for (const x of C.raizD?.carpetas || []) {
    const o = ofertaDe(x.grupo); const e = m.get(o) ?? { o, nombre: nombreOferta(x.oferta) || o, mercados: [], n: 0, fechas: 0, ultima: x.ultima, primera: x.primera, mod: x.mod, sin_ver: 0, portadas: [] };
    e.mercados.push(x); e.n += x.n; e.fechas += x.fechas; if (x.ultima > e.ultima) e.ultima = x.ultima;
    if (x.primera < e.primera) e.primera = x.primera; if (cmpS(x.mod, e.mod) > 0) e.mod = x.mod; e.sin_ver += x.sin_ver || 0;
    m.set(o, e);
  }
  for (const e of m.values()) {
    e.mercados = ordenar(e.mercados, C.orden, (x) => x.mercado || x.etiqueta);
    for (const x of e.mercados) for (const p of x.portadas) if (e.portadas.length < 3 && !e.portadas.includes(p)) e.portadas.push(p);
  }
  return ordenar([...m.values()], C.orden, (x) => x.nombre);
}
const plural = (n, s, p = s + "s") => `${n} ${n === 1 ? s : p}`;

function pintarRaiz() {
  const c = $("#cr-cuerpo", C.raiz); const d = C.raizD;
  if (!d) { c.innerHTML = cargando("Abriendo las carpetas…"); return; }
  if (!d.carpetas.length) {
    c.innerHTML = `<p class="vacio">Todavía no hay creativos. Tocá «↻ Buscar nuevos» para traerlos de Meta.</p>`; return;
  }
  const todas = ofertas();
  const q = C.buscar.trim();
  const lista = todas.filter((x) => !q || coincide(q, x.nombre, x.o, ...x.mercados.map((m) => m.mercado)));
  c.innerHTML = `
    <div class="cr-filtro">
      <label class="sr" for="cr-buscar">Buscar oferta o país</label>
      <input class="campo" id="cr-buscar" type="search" placeholder="Buscar oferta o país" value="${esc(C.buscar)}" autocomplete="off">
      ${selOrden("cr-orden", C.orden)}
      <span class="cr-mut">${plural(todas.length, "oferta")} · ${plural(d.carpetas.length, "mercado")} · ${plural(d.carpetas.reduce((s, x) => s + x.n, 0), "creativo")}${d.sync ? ` · actualizado ${esc(horaCorta(d.sync))}` : ""}</span>
    </div>
    <div class="cr-carpetas">${lista.map((x) => `
      <button type="button" class="cr-carpeta boceto${claseSinVer(x.sin_ver)}" data-o="${esc(x.o)}">
        <span class="cr-pestana" aria-hidden="true"></span>${estrella(x.sin_ver)}
        ${collage(x.portadas)}
        <span class="cr-c-tit">${esc(x.nombre)}</span>
        <span class="cr-c-ban" aria-hidden="true">${x.mercados.slice(0, 12).map((m) => esc(m.bandera || "")).join(" ")}${x.mercados.length > 12 ? " …" : ""}</span>
        <span class="cr-c-meta">${plural(x.mercados.length, "mercado")} · ${plural(x.n, "creativo")} · último ${esc(dm(x.ultima))}</span>
      </button>`).join("") || `<p class="vacio chico">Nada coincide con «${esc(C.buscar)}».</p>`}
    </div>`;
  const inp = $("#cr-buscar", c);
  $("#cr-orden", c).onchange = (e) => { C.orden = e.target.value; ls.set("cr_orden", C.orden); pintarRaiz(); };
  inp.oninput = () => { C.buscar = inp.value; const pos = inp.selectionStart; pintarRaiz(); const n = $("#cr-buscar", C.raiz); n.focus(); try { n.setSelectionRange(pos, pos); } catch {} };
  $$("[data-o]", c).forEach((b) => b.onclick = () => {
    const of = lista.find((x) => x.o === b.dataset.o);
    // con un solo mercado se entra directo a sus fechas
    if (of?.mercados.length === 1) ir(of.mercados[0].grupo, null); else ir(null, null, { o: b.dataset.o });
  });
}

function pintarMercados() {
  const c = $("#cr-cuerpo", C.raiz);
  if (!C.raizD) { c.innerHTML = cargando("Abriendo la oferta…"); return; }
  const of = ofertas().find((x) => x.o === C.o);
  if (!of) { c.innerHTML = `<p class="vacio">No encontré esa oferta.</p>`; return; }
  const rep = (m) => of.mercados.filter((y) => y.mercado === m).length > 1; // mismo mercado dos veces: se aclara con el nombre original
  c.innerHTML = `<div class="cr-filtro cr-filtro-orden">${selOrden("cr-orden", C.orden)}</div><div class="cr-carpetas">${of.mercados.map((x) => `
      <button type="button" class="cr-carpeta boceto${claseSinVer(x.sin_ver)}" data-g="${esc(x.grupo)}">
        <span class="cr-pestana" aria-hidden="true"></span>${estrella(x.sin_ver)}
        ${collage(x.portadas)}
        <span class="cr-c-tit">${x.bandera ? `<span aria-hidden="true">${esc(x.bandera)}</span> ` : ""}${esc(x.mercado || x.etiqueta)}${rep(x.mercado) ? ` <small class="cr-mut">· ${esc(x.oferta)}</small>` : ""}</span>
        <span class="cr-c-meta">${plural(x.n, "creativo")} · ${plural(x.fechas, "fecha")} · último ${esc(dm(x.ultima))}</span>
      </button>`).join("")}</div>`;
  $$("[data-g]", c).forEach((b) => b.onclick = () => ir(b.dataset.g, null));
  $("#cr-orden", c).onchange = (e) => { C.orden = e.target.value; ls.set("cr_orden", C.orden); pintarMercados(); };
}
const horaCorta = (iso) => { try { const d = new Date(iso); const f = hoyAR(d) === hoyAR() ? "" : dm(hoyAR(d)) + " "; return f + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ_AR }); } catch { return ""; } };

function pintarOferta() {
  const c = $("#cr-cuerpo", C.raiz); const d = C.oferta[C.g];
  if (!d) { c.innerHTML = cargando("Abriendo la oferta…"); return; }
  if (!d.fechas.length) { c.innerHTML = `<p class="vacio">Esta carpeta está vacía.</p>`; return; }
  const fechas = ordenar(d.fechas.map((x) => ({ ...x, primera: x.fecha, ultima: x.fecha })), C.ordenF, (x) => x.fecha);
  c.innerHTML = `<div class="cr-filtro cr-filtro-orden">${selOrden("cr-orden-f", C.ordenF, true)}</div><div class="cr-fechas">${fechas.map((x) => `
    <button type="button" class="cr-fecha boceto${claseSinVer(x.sin_ver)}" data-f="${esc(x.fecha)}">
      <span class="cr-pestana" aria-hidden="true"></span>${estrella(x.sin_ver)}
      ${collage(x.portadas)}
      <span class="cr-f-tit"><b>${esc(dm(x.fecha))}</b> <small>${esc(diaSem(x.fecha))}</small></span>
      <span class="cr-f-meta"><span class="cr-tipo ${x.tipo === "testeo" ? "t-test" : "t-reno"}">${x.tipo === "testeo" ? "Testeo" : "Renovaciones"}</span> ${x.n} creativo${x.n === 1 ? "" : "s"}${x.trabajando ? ` <span class="cr-trab" title="Claude está corrigiendo"><span class="cargador mini"></span> corrigiendo</span>` : ""}</span>
    </button>`).join("")}</div>`;
  $$("[data-f]", c).forEach((b) => b.onclick = () => ir(C.g, b.dataset.f));
  $("#cr-orden-f", c).onchange = (e) => { C.ordenF = e.target.value; ls.set("cr_orden_f", C.ordenF); pintarOferta(); };
}

function pintarCarpeta() {
  const c = $("#cr-cuerpo", C.raiz); const d = C.carpeta[C.g + "|" + C.f];
  if (!d) { c.innerHTML = cargando("Abriendo los creativos…"); return; }
  const gen = d.chats.find((x) => x.alcance === "carpeta");
  c.innerHTML = `
    ${gen ? `<button type="button" class="cr-aviso-chat e-${esc(gen.estado)}" data-chat-gen>${["en_cola", "trabajando"].includes(gen.estado) ? '<span class="cargador mini"></span>' : "💬"} Correcciones generales: ${esc(ESTADO_CHAT[gen.estado] || gen.estado)} · abrir</button>` : ""}
    <div id="cr-metricas"></div>
    <div class="cr-tarjetas" id="cr-tarjetas"></div>`;
  const b = $("[data-chat-gen]", c); if (b) b.onclick = () => abrirChat({ chatId: gen.id });
  pintarMetricas(); pintarTarjetas();
}

function pintarMetricas() {
  const n = $("#cr-metricas", C.raiz); if (!n) return;
  if (!C.metr) { n.innerHTML = ""; return; }
  const P = [["total", "Total"], ["hoy", "Hoy"], ["ayer", "Ayer"], ["rango", "Personalizado"]];
  const t = C.m?.total;
  n.innerHTML = `<div class="cr-mbar boceto">
    <div class="cr-seg" role="group" aria-label="Período de las métricas">${P.map(([k, l]) => `<button type="button" class="btn chico" data-p="${k}" aria-pressed="${C.periodo === k}">${l}</button>`).join("")}</div>
    ${C.periodo === "rango" ? `<div class="cr-rango"><label>Desde <input type="date" data-d value="${esc(C.desde)}" max="${hoyAR()}"></label><label>Hasta <input type="date" data-h value="${esc(C.hasta)}" max="${hoyAR()}"></label><button type="button" class="btn chico pri" data-ver>Ver</button></div>` : ""}
    <div class="cr-tot" aria-live="polite">${C.mCargando ? '<span class="cargador mini"></span> leyendo Meta…' : C.mErr ? `<span class="cr-err">${esc(C.mErr)}</span>` : t ? `
      <span><small>Gastado</small><b>${plata(t.gasto)}</b></span><span><small>Ventas</small><b>${t.ventas}</b></span>
      <span><small>ROAS</small><b class="roas r-${roasCls(t.roas)}">${t.roas ?? "—"}</b></span>${C.m.periodo === "total" ? "" : `<span class="cr-mut">${esc(dm(C.m.desde))}${C.m.desde !== C.m.hasta ? "–" + esc(dm(C.m.hasta)) : ""}</span>`}` : ""}
      ${C.m?.errores?.length ? `<span class="cr-mut" title="${esc(C.m.errores.join(" · "))}">⚠ faltan datos de ${C.m.errores.length} cuenta(s)</span>` : ""}</div>
  </div>`;
  $$("[data-p]", n).forEach((b) => b.onclick = () => {
    C.periodo = b.dataset.p;
    if (C.periodo === "rango") { pintarMetricas(); $("[data-d]", n)?.focus(); return; }
    C.m = null; cargarMetricas();
  });
  const v = $("[data-ver]", n);
  if (v) v.onclick = () => {
    const de = $("[data-d]", n).value, ha = $("[data-h]", n).value;
    if (!de || !ha || de > ha) { toast("Elegí un rango válido: desde antes que hasta", "error"); return; }
    C.desde = de; C.hasta = ha; C.m = null; cargarMetricas();
  };
}

// (13/10) Orden por número: «13.10 AD 2» antes que «13.10 AD 10» (la fecha del principio no cuenta)
const sinFecha = (n) => String(n || "").replace(/^\s*\d{1,2}\.\d{1,2}\.?(\d{2,4})?\s*[-·|]?\s*/, "");
const porNumero = (a, b) => sinFecha(a.nombre).localeCompare(sinFecha(b.nombre), "es", { numeric: true, sensitivity: "base" }) || String(a.nombre).localeCompare(String(b.nombre), "es", { numeric: true });
const enCurso = (ch) => ch && ["en_cola", "trabajando"].includes(ch.estado);
// (13/10) Progreso de una corrección: el % que informa la Mac; si no informa, se estima por el tiempo (≈ 20 min por creativo, tope 90 %)
const MIN_CORR = 20;
function avance(ch) {
  if (ch.estado === "en_cola") return { pct: 0, txt: "En cola en la Mac", resta: null };
  const ini = ch.inicio ? new Date(ch.inicio).getTime() : null, ya = ini ? (Date.now() - ini) / 60e3 : 0;
  const est = Math.min(90, Math.round((ya / MIN_CORR) * 90));
  const pct = Math.max(ch.progreso || 0, ch.progreso >= 10 ? 0 : est);
  // lo que falta: el que calcula la Mac; si no, lo que queda de los ≈ 20 min según el %
  let resta = ch.eta ? (new Date(ch.eta).getTime() - Date.now()) / 60e3 : MIN_CORR * (100 - pct) / 100;
  resta = Math.max(1, Math.round(resta));
  return { pct, txt: ch.paso || "Corrigiendo…", resta, lento: !ch.eta && ya > MIN_CORR * 1.5 };
}
function anillo(pct) {
  const r = 26, c = 2 * Math.PI * r;
  return `<svg class="cr-anillo" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${r}" class="fondo"/><circle cx="32" cy="32" r="${r}" class="lleno" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct / 100)).toFixed(1)}"/></svg>`;
}
// chat que está corrigiendo esta tarjeta ahora (el suyo, el de su versión anterior o el general de la carpeta)
function corrigiendo(d, c) {
  return d.chats.find((ch) => enCurso(ch) && (ch.alcance === "carpeta" || ch.creativo_id === c.id || (c.anterior && ch.creativo_id === c.anterior.id))) || null;
}

function pintarTarjetas() {
  const n = $("#cr-tarjetas", C.raiz); const d = C.carpeta[C.g + "|" + C.f]; if (!n || !d) return;
  if (!d.creativos.length) { n.innerHTML = `<p class="vacio">No hay creativos en esta fecha.</p>`; return; }
  d.creativos.sort(porNumero);
  const chatDe = new Map(); for (const ch of d.chats) if (ch.alcance === "creativo" && !chatDe.has(ch.creativo_id)) chatDe.set(ch.creativo_id, ch);
  n.innerHTML = d.creativos.map((c, i) => {
    const tr = c.transcripcion?.estado, ch = chatDe.get(c.id), m = C.metr && C.m ? C.m.creativos?.[c.metr_id || c.id] : null;
    const corr = corrigiendo(d, c);
    return `<article class="cr-card boceto${corr ? " corrigiendo" : ""}" data-i="${i}">
      <button type="button" class="cr-poster" data-play aria-label="${corr ? `Corrigiendo ${esc(c.nombre || "creativo")}` : `Ver ${esc(c.nombre || "creativo")}`}" ${corr ? "disabled" : ""}>
        ${c.thumb ? `<img src="${esc(url(c.thumb))}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ""}
        ${corr ? (() => { const a = avance(corr); return `<span class="cr-corrigiendo" role="status" aria-label="Corrigiendo: ${a.pct} %">
            <span class="cr-anillo-box">${corr.estado === "en_cola" ? '<span class="cargador"></span>' : `${anillo(a.pct)}<b>${a.pct}%</b>`}</span>
            <span>${esc(a.txt)}</span>
            ${corr.estado === "en_cola" ? `<small>arranca cuando la Mac termine lo anterior</small>` : `<span class="cr-barrita"><span style="width:${a.pct}%"></span></span><small>${a.lento ? "tarda más de lo normal" : `faltan ≈ ${a.resta} min`} · se reemplaza por la versión nueva</small>`}
          </span>`; })()
          : `<span class="cr-playico" aria-hidden="true">${ICO.play}</span>`}
      </button>
      <div class="cr-menu-wrap cr-card-menu"><button type="button" class="cr-puntos-card" data-menu="card" aria-haspopup="true" aria-expanded="false" aria-label="Opciones de ${esc(c.nombre || "este creativo")}">${ICO.puntos}</button></div>
      <div class="cr-badges">
        ${c.origen === "fabrica" && !c.n_ads ? `<span class="cr-badge b-nuevo">sin salir</span>` : ""}
        ${c.version_de ? `<span class="cr-badge b-ver">corregido${/\sv(\d+)$/i.test(c.nombre || "") ? " " + esc(/\s(v\d+)$/i.exec(c.nombre)[1]) : ""}</span>` : ""}
        ${tr === "listo" ? `<span class="cr-badge b-ok">guion</span>` : tr === "en_cola" || tr === "transcribiendo" ? `<span class="cr-badge b-trab"><span class="cargador mini"></span>guion</span>` : tr === "error" ? `<span class="cr-badge b-err">guion ✕</span>` : ""}
        ${ch && !corr && ch.estado === "error" ? `<span class="cr-badge b-err">corrección ✕</span>` : ""}
      </div>
      <div class="cr-pie">
        <p class="cr-nom" title="${esc(c.nombre)}">${esc(c.nombre || "Sin nombre")}</p>
        ${C.metr ? (C.mCargando && !m ? `<div class="cr-m cr-mut"><span class="cargador mini"></span></div>` : `<div class="cr-m">
          <span><small>Gasto</small>${plata(m?.gasto ?? 0)}</span><span><small>Ventas</small>${m?.ventas ?? 0}</span><span><small>ROAS</small><b class="roas r-${roasCls(m?.roas ?? null)}">${m?.roas ?? "—"}</b></span></div>`)
          : `<p class="cr-mut cr-sub">${c.version_de && !c.ads?.length ? "versión nueva, sin salir" : c.n_ads ? `${c.n_ads} anuncio${c.n_ads === 1 ? "" : "s"}` : "todavía no salió"}</p>`}
      </div>
    </article>`;
  }).join("");
  $$(".cr-card", n).forEach((el) => {
    const c = d.creativos[Number(el.dataset.i)];
    $("[data-play]", el).onclick = () => verCreativo(c);
    const b = $("[data-menu]", el); b.onclick = (e) => { e.stopPropagation(); menuCard(b, c); };
  });
}

// ---------------------------------------------------------------- menús ⋯
function cerrarMenus() { $$(".cr-menu").forEach((m) => m.remove()); $$('[data-menu][aria-expanded="true"]').forEach((b) => b.setAttribute("aria-expanded", "false")); }
function cerrarMenusFuera(e) { if (!e.target.closest(".cr-menu")) cerrarMenus(); }
function teclaMenus(e) { if (e.key === "Escape" && $(".cr-menu")) { const b = $('[data-menu][aria-expanded="true"]'); cerrarMenus(); b?.focus(); } }
function menu(boton, items) {
  const yaAbierto = boton.getAttribute("aria-expanded") === "true";
  cerrarMenus(); if (yaAbierto) return;
  const m = document.createElement("div"); m.className = "cr-menu boceto"; m.setAttribute("role", "menu");
  m.innerHTML = items.map((it, i) => it.switch
    ? `<div class="cr-mi cr-mi-sw" role="menuitemcheckbox" aria-checked="${it.on}" tabindex="-1" data-k="${i}"><span>${esc(it.t)}</span><span class="cr-sw" aria-hidden="true"><span></span></span></div>`
    : it.sep ? `<hr>` : `<button type="button" class="cr-mi" role="menuitem" tabindex="-1" data-k="${i}" ${it.off ? "disabled" : ""}><span class="cr-mi-ico" aria-hidden="true">${it.ico || ""}</span><span>${esc(it.t)}${it.sub ? `<small>${esc(it.sub)}</small>` : ""}</span></button>`).join("");
  boton.parentElement.appendChild(m); boton.setAttribute("aria-expanded", "true");
  $$("[data-k]", m).forEach((el) => el.onclick = (e) => { e.stopPropagation(); const it = items[Number(el.dataset.k)]; if (!it.switch) cerrarMenus(); it.fn(el); });
  m.addEventListener("keydown", (e) => {
    const f = $$("[data-k]:not([disabled])", m), i = f.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); f[(i + 1) % f.length].focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); f[(i - 1 + f.length) % f.length].focus(); }
    if ((e.key === "Enter" || e.key === " ") && document.activeElement?.classList.contains("cr-mi-sw")) { e.preventDefault(); document.activeElement.click(); }
  });
  $("[data-k]:not([disabled])", m)?.focus({ preventScroll: true });
  // que no se salga de la pantalla
  const r = m.getBoundingClientRect(); if (r.left < 8) m.style.right = `${r.left - 8}px`;
}
function menuCarpeta(boton) {
  const d = C.carpeta[C.g + "|" + C.f]; if (!d) return;
  const sinGuion = d.creativos.filter((c) => (c.n_ads || c.video_url) && !["listo", "en_cola", "transcribiendo"].includes(c.transcripcion?.estado));
  const conGuion = d.creativos.filter((c) => c.transcripcion?.estado === "listo");
  menu(boton, [
    { t: "Correcciones", sub: "para todos los anuncios de esta fecha", ico: "💬", fn: () => abrirChat({ alcance: "carpeta" }) },
    { t: "Transcribir", sub: sinGuion.length ? `${sinGuion.length} sin guion, al español` : "todos tienen guion", ico: "📝", off: !sinGuion.length, fn: () => transcribir(sinGuion) },
    { t: "Ver guiones", sub: conGuion.length ? `${conGuion.length} listos` : "todavía ninguno", ico: "📄", off: !conGuion.length, fn: () => verGuiones(conGuion) },
    { sep: true },
    { t: "Ver métricas", switch: true, on: C.metr, fn: (el) => {
      C.metr = !C.metr; ls.set("cr_metr", C.metr ? "1" : "0"); el.setAttribute("aria-checked", C.metr);
      pintarMetricas(); pintarTarjetas(); if (C.metr && !C.m) cargarMetricas();
    } },
  ]);
}
function menuCard(boton, c) {
  const tr = c.transcripcion?.estado;
  menu(boton, [
    { t: "Correcciones", sub: "chat para rehacer este anuncio", ico: "💬", fn: () => abrirChat({ alcance: "creativo", creativo: c }) },
    tr === "listo" ? { t: "Ver guion", sub: "en español", ico: "📄", fn: () => verGuiones([c]) }
      : { t: tr === "en_cola" || tr === "transcribiendo" ? "Transcribiendo…" : "Transcribir", sub: c.n_ads || c.video_url ? "guion en español" : "cuando salga en Meta", ico: "📝", off: !(c.n_ads || c.video_url) || tr === "en_cola" || tr === "transcribiendo", fn: () => transcribir([c]) },
    ...(c.anterior ? [{ t: "Ver versión anterior", sub: c.anterior.nombre || "", ico: "⏮", fn: () => verCreativo({ ...c.anterior, n_ads: c.anterior.ads?.length || 0, anteriorDe: c }) }] : []),
    ...(c.post_id ? [{ t: "Ver en Facebook", ico: "↗", fn: () => window.open(`https://www.facebook.com/${c.post_id}`, "_blank", "noopener") }] : []),
    ...(url(c.drive_url) ? [{ t: "Abrir en Drive", ico: "↗", fn: () => window.open(c.drive_url, "_blank", "noopener") }] : []),
  ]);
}

// ---------------------------------------------------------------- ver un creativo
// (13/10) Reproductor vertical 9:16 (celu y compu) con barra de segundos, ±0,5 s y «Marcar este segundo» para escribir la corrección ahí mismo.
const tiempo = (t) => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s2 = t - m * 60; return `${m}:${s2 < 10 ? "0" : ""}${s2.toFixed(1)}`; };
const marca = (t) => { t = Math.max(0, Math.floor(t || 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
async function srcDe(c) {
  if (url(c.video_url)) return { src: c.video_url };
  for (const [ad, act] of (c.ads || []).slice(0, 3)) {
    try { const v = await api("video", { q: `&ad=${encodeURIComponent(ad)}&act=${encodeURIComponent(act)}` }); if (v.src || v.link) return v; }
    catch (e) { if (falla(e)) throw e; }
  }
  return null;
}
async function verCreativo(c) {
  const tr = c.transcripcion, esAnterior = !!c.anteriorDe;
  const m = C.ctx.abrirModal(`
    <h3 class="cr-m-tit">${esc(c.nombre || "Creativo")}${esAnterior ? ` <small class="cr-mut">· versión anterior</small>` : ""}</h3>
    <div class="cr-ver">
      <div class="cr-ver-izq">
        <div class="cr-video" id="cr-video">${c.thumb ? `<img src="${esc(url(c.thumb))}" alt="">` : ""}<span class="cr-v-carga"><span class="cargador"></span>Cargando el video…</span></div>
        <div class="cr-ctrl" id="cr-ctrl" hidden>
          <div class="cr-ctrl-fila">
            <button type="button" class="btn chico" data-paso="-0.5" aria-label="Atrás medio segundo">−0,5 s</button>
            <button type="button" class="btn chico pri cr-play" data-pp aria-label="Reproducir o pausar">▶</button>
            <button type="button" class="btn chico" data-paso="0.5" aria-label="Adelante medio segundo">+0,5 s</button>
            <span class="cr-t" id="cr-t" aria-live="off">0:00.0 / 0:00.0</span>
          </div>
          <label class="sr" for="cr-barra">Segundo del video</label>
          <input type="range" id="cr-barra" class="cr-barra" min="0" max="1" step="0.05" value="0">
        </div>
      </div>
      <div class="cr-ver-der">
        <section class="cr-gv" id="cr-gv" aria-label="Guion"><p class="cr-mut"><span class="cargador mini"></span> Cargando el guion…</p></section>
        ${esAnterior ? `<p class="cr-mut">Esta es la versión anterior. La que corre ahora es «${esc(c.anteriorDe.nombre || "")}».</p>` : `
        <form class="cr-corr" id="cr-corr">
          <div class="cr-corr-tit"><b>Corrección</b><button type="button" class="btn chico" data-marcar>📍 Marcar 0:00</button></div>
          <label class="sr" for="cr-corr-txt">Corrección para este anuncio</label>
          <textarea class="campo" id="cr-corr-txt" rows="5" placeholder="Pausá en el segundo, tocá «Marcar» y escribí qué cambiar. Ej.: [0:03] el texto dice 70 %, va 50 %"></textarea>
          <div class="cr-quien" role="group" aria-label="Escribís como">${PERSONAS.map(([k, l]) => `<button type="button" class="btn chico" data-q="${k}" aria-pressed="${C.quien === k}">${l}</button>`).join("")}</div>
          <button type="submit" class="btn pri">Mandar a Claude</button>
        </form>`}
        <div class="botones">
          ${esAnterior ? "" : `<button type="button" class="btn" data-chat>💬 Ver el chat</button>`}
          <button type="button" class="btn" data-cerrar data-foco>Cerrar</button>
        </div>
      </div>
    </div>`, { ancho: true });
  m.dlg.classList.add("cr-dlg", "cr-dlg-ver");
  $("[data-cerrar]", m.dlg).onclick = m.cerrar;
  const bc = $("[data-chat]", m.dlg); if (bc) bc.onclick = () => { m.cerrar(); abrirChat({ alcance: "creativo", creativo: c }); };
  $$("[data-q]", m.dlg).forEach((b) => b.onclick = () => { C.quien = b.dataset.q; ls.set("ws_persona", C.quien); $$("[data-q]", m.dlg).forEach((x) => x.setAttribute("aria-pressed", x.dataset.q === C.quien)); });
  const f = $("#cr-corr", m.dlg);
  if (f) f.onsubmit = async (e) => {
    e.preventDefault();
    const ta = $("#cr-corr-txt", m.dlg), texto = ta.value.trim(); if (!texto) { ta.focus(); return; }
    const btn = $('button[type="submit"]', f); btn.classList.add("cargando"); btn.disabled = true;
    const d = C.carpeta[C.g + "|" + C.f];
    const ult = d?.chats.find((x) => x.alcance === "creativo" && x.creativo_id === c.id);
    try {
      await api("creativos_mensaje", { body: ult ? { chat_id: ult.id, quien: C.quien, texto } : { alcance: "creativo", grupo: C.g, fecha: C.f, creativo_id: c.id, quien: C.quien, texto } });
      toast("Mandado a Claude. La tarjeta queda «corrigiendo» hasta que suba la versión nueva.");
      m.cerrar(); cargar();
    } catch (e2) { if (!falla(e2)) toast("No se pudo mandar: " + e2.message, "error"); btn.classList.remove("cargando"); btn.disabled = false; }
  };
  const box = $("#cr-video", m.dlg);
  let v = null;
  try { v = await srcDe(c); } catch { m.cerrar(); return; }
  if (!box.isConnected) return;
  if (!v?.src) {
    const link = v?.link || (c.post_id ? `https://www.facebook.com/${c.post_id}` : "") || c.drive_url;
    box.innerHTML = `<p class="cr-mut">${esc(v?.error || (c.ads?.length ? "No se pudo cargar el video." : "Todavía no salió en Meta."))}${url(link) ? ` <a href="${esc(url(link))}" target="_blank" rel="noopener">Abrirlo ↗</a>` : ""}</p>`;
    return;
  }
  box.innerHTML = `<video src="${esc(url(v.src))}" ${v.poster ? `poster="${esc(url(v.poster))}"` : ""} playsinline autoplay preload="auto"></video>`;
  const vid = $("video", box), ctrl = $("#cr-ctrl", m.dlg), barra = $("#cr-barra", m.dlg), t = $("#cr-t", m.dlg), pp = $("[data-pp]", m.dlg), bm = $("[data-marcar]", m.dlg);
  ctrl.hidden = false;
  const pintarT = () => {
    t.textContent = `${tiempo(vid.currentTime)} / ${tiempo(vid.duration || 0)}`;
    if (!barra.matches(":active")) barra.value = vid.currentTime;
    pp.textContent = vid.paused ? "▶" : "❚❚";
    if (bm) bm.textContent = `📍 Marcar ${marca(vid.currentTime)}`;
  };
  vid.addEventListener("loadedmetadata", () => { barra.max = vid.duration || 1; pintarT(); });
  ["timeupdate", "play", "pause", "seeked"].forEach((ev) => vid.addEventListener(ev, pintarT));
  vid.onclick = () => vid.paused ? vid.play() : vid.pause();
  pp.onclick = () => vid.paused ? vid.play() : vid.pause();
  barra.oninput = () => { vid.currentTime = Number(barra.value); pintarT(); };
  $$("[data-paso]", m.dlg).forEach((b) => b.onclick = () => { vid.pause(); vid.currentTime = Math.min(vid.duration || 0, Math.max(0, vid.currentTime + Number(b.dataset.paso))); });
  if (bm) bm.onclick = () => {
    vid.pause();
    const ta = $("#cr-corr-txt", m.dlg); const pre = ta.value && !ta.value.endsWith("\n") ? "\n" : "";
    ta.value += `${pre}[${marca(vid.currentTime)}] `; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  };
  guionVivo(c, vid, m);
  // teclado en la compu: espacio pausa, flechas ±0,5 s (si no se está escribiendo)
  m.dlg.addEventListener("keydown", (e) => {
    if (e.target.closest("textarea, input")) return;
    if (e.key === " ") { e.preventDefault(); pp.click(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); $('[data-paso="-0.5"]', m.dlg).click(); }
    if (e.key === "ArrowRight") { e.preventDefault(); $('[data-paso="0.5"]', m.dlg).click(); }
  });
}

// (13/10) Guion «karaoke»: frase actual resaltada y palabra actual marcada mientras habla; tocar una frase lleva a ese segundo.
// Sale del audio real (ElevenLabs con el segundo de cada palabra). Si el video no es en español: la frase en español y abajo el original.
async function guionVivo(c, vid, m) {
  const box = $("#cr-gv", m.dlg); if (!box) return;
  let t = c.transcripcion;
  if (!t?.segs?.length || t.estado !== "listo") {
    if (!(c.n_ads || c.video_url)) { box.innerHTML = `<p class="cr-mut">El guion aparece cuando el video esté en Meta.</p>`; return; }
    if (!["en_cola", "transcribiendo"].includes(t?.estado)) { try { await api("creativos_transcribir", { body: { ids: [c.id] } }); } catch (e) { if (falla(e)) return; } }
    box.innerHTML = `<p class="cr-mut"><span class="cargador mini"></span> Preparando el guion con los tiempos de cada palabra (≈ 20 s)…</p>`;
    for (let i = 0; i < 40 && box.isConnected; i++) {
      await new Promise((ok) => setTimeout(ok, 3000));
      try { const r = await api("creativos_uno", { q: `&id=${encodeURIComponent(c.id)}` }); t = r.transcripcion; } catch (e) { if (falla(e)) return; }
      if (t?.estado === "listo" || t?.estado === "error") break;
    }
    if (!box.isConnected) return;
    if (t?.estado !== "listo" || !t.segs?.length) { box.innerHTML = `<p class="cr-mut">${t?.estado === "error" ? "No se pudo sacar el guion: " + esc(t.error || "") : t?.es ? esc(t.es) : "El guion todavía no está."}</p>`; return; }
    c.transcripcion = t;
  }
  const es = /^(spa|es)/i.test(t.idioma || "");
  const segs = t.segs;
  box.innerHTML = `<div class="cr-gv-cab"><b>Guion</b><span class="cr-mut">${es ? "tocá una frase para ir a ese segundo" : `en español · abajo el original (${esc(t.idioma)})`}</span></div>
    <div class="cr-gv-lista" id="cr-gv-lista">${segs.map((x, i) => `
      <button type="button" class="cr-seg" data-i="${i}" data-s="${x.s}">
        <span class="cr-seg-t">${marca(x.s)}</span>
        <span class="cr-seg-es">${es ? x.w.map((w, j) => `<span class="w" data-j="${j}">${esc(w[0])}</span>`).join(" ") : esc(x.es)}</span>
        ${es ? "" : `<span class="cr-seg-or">${x.w.map((w, j) => `<span class="w" data-j="${j}">${esc(w[0])}</span>`).join(" ")}</span>`}
      </button>`).join("")}</div>`;
  const lista = $("#cr-gv-lista", box), filas = $$(".cr-seg", lista);
  filas.forEach((f) => f.onclick = () => { vid.currentTime = Number(f.dataset.s) + 0.01; vid.play(); });
  let segAct = -1, palAct = null, raf = 0;
  const marcar = () => {
    const now = vid.currentTime;
    let i = segs.findIndex((x, k) => now >= x.s - 0.05 && now < (segs[k + 1]?.s ?? Infinity));
    if (now < (segs[0]?.s ?? 0)) i = -1;
    if (i !== segAct) {
      filas[segAct]?.classList.remove("ahora"); segAct = i;
      const f = filas[i];
      if (f) { f.classList.add("ahora");
        const top = f.offsetTop - lista.offsetTop - lista.clientHeight / 3;
        lista.scrollTo({ top, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }
    }
    const x = segs[i]; let j = -1;
    if (x) j = x.w.findIndex((w) => now >= w[1] - 0.04 && now < w[2] + 0.12);
    const pal = j >= 0 ? $(`.w[data-j="${j}"]`, filas[i].querySelector(es ? ".cr-seg-es" : ".cr-seg-or")) : null;
    if (pal !== palAct) { palAct?.classList.remove("dice"); pal?.classList.add("dice"); palAct = pal; }
  };
  const loop = () => { marcar(); if (!vid.paused && box.isConnected) raf = requestAnimationFrame(loop); };
  vid.addEventListener("play", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); });
  ["seeked", "timeupdate", "pause"].forEach((ev) => vid.addEventListener(ev, marcar));
  if (!vid.paused) raf = requestAnimationFrame(loop);
  marcar();
}

// ---------------------------------------------------------------- transcribir
async function transcribir(lista) {
  const ids = lista.filter((c) => c.n_ads || c.video_url).map((c) => c.id); if (!ids.length) return;
  try {
    const r = await api("creativos_transcribir", { body: { ids } });
    toast(r.en_cola ? `Transcribiendo ${r.en_cola} creativo${r.en_cola === 1 ? "" : "s"} al español. Te aviso en la tarjeta («guion»).` : "Ya se estaban transcribiendo");
  } catch (e) { if (!falla(e)) toast("No se pudo transcribir: " + e.message, "error"); return; }
  cargar();
}
function verGuiones(lista) {
  const solo = lista.length === 1;
  const m = C.ctx.abrirModal(`
    <h3 class="cr-m-tit">${solo ? `Guion · ${esc(lista[0].nombre || "")}` : `Guiones · ${esc(dm(C.f))} (${lista.length})`}</h3>
    <div class="cr-guiones">${lista.map((c) => { const t = c.transcripcion || {}; return `
      <section class="cr-guion">
        ${solo ? "" : `<h4>${esc(c.nombre || "")}</h4>`}
        <pre data-es>${esc(t.es || "")}</pre>
        ${t.original && t.es !== t.original ? `<details><summary>Original${t.idioma ? ` (${esc(t.idioma)})` : ""}</summary><pre>${esc(t.original)}</pre></details>` : ""}
      </section>`; }).join("")}</div>
    <div class="botones"><button type="button" class="btn" data-copiar>Copiar ${solo ? "guion" : "todos"}</button><button type="button" class="btn pri" data-cerrar data-foco>Cerrar</button></div>`, { ancho: true });
  m.dlg.classList.add("cr-dlg");
  $("[data-cerrar]", m.dlg).onclick = m.cerrar;
  $("[data-copiar]", m.dlg).onclick = async (e) => {
    const txt = lista.map((c) => (solo ? "" : `### ${c.nombre}\n`) + (c.transcripcion?.es || "")).join("\n\n");
    try { await navigator.clipboard.writeText(txt); e.target.textContent = "Copiado ✓"; } catch { toast("No se pudo copiar", "error"); }
  };
}

// ---------------------------------------------------------------- correcciones (chat)
async function abrirChat({ alcance = null, creativo = null, chatId = null } = {}) {
  clearInterval(C.chatTimer); C.chatTimer = null;
  const d = C.carpeta[C.g + "|" + C.f];
  // si no viene un chat, se retoma el último de ese lugar
  if (!chatId && d) {
    const ult = d.chats.find((x) => x.alcance === alcance && (alcance === "carpeta" || x.creativo_id === creativo?.id));
    if (ult) chatId = ult.id;
  }
  const lugar = alcance === "creativo" ? creativo : null;
  const ch = { id: chatId, alcance, creativo: lugar, datos: null, enviando: false };
  const titulo = () => {
    const a = ch.datos?.chat?.alcance ?? ch.alcance;
    const cr = ch.creativo ?? (d?.creativos || []).find((x) => x.id === ch.datos?.chat?.creativo_id);
    return a === "creativo" ? `Correcciones · ${cr?.nombre || "este anuncio"}` : `Correcciones generales · ${dm(ch.datos?.chat?.fecha ?? C.f)}`;
  };
  const m = C.ctx.abrirModal(`
    <h3 class="cr-m-tit" id="cr-chat-t"></h3>
    <p class="cr-mut cr-chat-sub" id="cr-chat-sub"></p>
    <div class="cr-chat" id="cr-chat" aria-live="polite"></div>
    <form class="cr-chat-form" id="cr-chat-form">
      <div class="cr-quien" role="group" aria-label="Escribís como">${PERSONAS.map(([k, l]) => `<button type="button" class="btn chico" data-q="${k}" aria-pressed="${C.quien === k}">${l}</button>`).join("")}</div>
      <label class="sr" for="cr-chat-txt">Corrección</label>
      <textarea class="campo" id="cr-chat-txt" rows="3" placeholder="Ej.: el hook dice 70 % y la tienda tiene 50 %. Cambiá la voz y el sticker a 50 %." data-foco></textarea>
      <div class="botones"><button type="button" class="btn" data-cerrar>Cerrar</button><button type="submit" class="btn pri">Mandar a Claude</button></div>
    </form>`, { ancho: true, alCerrar: () => { clearInterval(C.chatTimer); C.chatTimer = null; cargar(); } });
  m.dlg.classList.add("cr-dlg", "cr-dlg-chat");
  $("[data-cerrar]", m.dlg).onclick = m.cerrar;
  $$("[data-q]", m.dlg).forEach((b) => b.onclick = () => { C.quien = b.dataset.q; ls.set("ws_persona", C.quien); $$("[data-q]", m.dlg).forEach((x) => x.setAttribute("aria-pressed", x.dataset.q === C.quien)); });
  const pintarChat = () => {
    if (!m.dlg.isConnected) return;
    $("#cr-chat-t", m.dlg).textContent = titulo();
    const st = ch.datos?.chat?.estado, compu = ch.datos?.compu;
    const sub = !ch.id ? (ch.alcance === "carpeta" ? `Lo que escribas acá se aplica a todos los anuncios del ${dm(C.f)}. Claude los rehace en la Mac y te contesta por acá.` : "Escribí qué cambiar. Claude lo rehace en la Mac y te contesta por acá.")
      : `${ESTADO_CHAT[st] || st || ""}${["en_cola", "trabajando"].includes(st) && compu && !compu.prendida ? " · ⚠ la Mac de Lorenzo está apagada: arranca apenas se prenda" : ""}${["en_cola", "trabajando"].includes(st) ? " · podés seguir escribiendo, lo lee antes de terminar" : ""}`;
    $("#cr-chat-sub", m.dlg).textContent = sub;
    const box = $("#cr-chat", m.dlg); const abajo = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    const msgs = ch.datos?.mensajes || [];
    box.innerHTML = msgs.length ? msgs.map((x) => `
      <div class="cr-msg ${x.autor === "claude" ? "de-claude" : "de-persona"}">
        <div class="cr-msg-quien">${esc(x.autor === "claude" ? "Claude" : (PERSONAS.find(([k]) => k === x.autor)?.[1] || x.autor))} · ${esc(horaCorta(x.creado))}</div>
        <div class="cr-msg-tx">${esc(x.texto)}</div>
        ${x.links ? `<div class="cr-msg-links">${Object.entries(x.links).map(([k, v]) => `<a href="${esc(url(v))}" target="_blank" rel="noopener">${esc(k)} ↗</a>`).join("")}</div>` : ""}
      </div>`).join("") + (["en_cola", "trabajando"].includes(st) ? `<div class="cr-msg de-claude cr-escribiendo"><span class="cargador mini"></span> ${st === "en_cola" ? "esperando turno en la Mac…" : "trabajando…"}</div>` : "")
      : `<p class="cr-mut cr-chat-vacio">Todavía no hay mensajes.</p>`;
    if (abajo || ch.recien) { box.scrollTop = box.scrollHeight; ch.recien = false; }
  };
  const leer = async () => {
    if (!ch.id) { pintarChat(); return; }
    try { ch.datos = await api("creativos_chat", { q: `&id=${ch.id}` }); }
    catch (e) { if (falla(e)) { m.cerrar(); return; } }
    pintarChat();
  };
  ch.recien = true; await leer();
  C.chatTimer = setInterval(() => { if (!document.hidden && ch.id) leer(); }, POLL_MS);
  $("#cr-chat-form", m.dlg).onsubmit = async (e) => {
    e.preventDefault(); if (ch.enviando) return;
    const ta = $("#cr-chat-txt", m.dlg); const texto = ta.value.trim(); if (!texto) { ta.focus(); return; }
    const btn = $('button[type="submit"]', m.dlg); ch.enviando = true; btn.classList.add("cargando"); btn.disabled = true;
    try {
      const r = await api("creativos_mensaje", { body: ch.id ? { chat_id: ch.id, quien: C.quien, texto }
        : { alcance: ch.alcance, grupo: C.g, fecha: C.f, creativo_id: ch.creativo?.id ?? null, quien: C.quien, texto } });
      ch.id = r.chat.id; ta.value = ""; ch.recien = true; await leer();
    } catch (e2) { if (!falla(e2)) toast("No se pudo mandar: " + e2.message, "error"); }
    ch.enviando = false; btn.classList.remove("cargando"); btn.disabled = false;
  };
  $("#cr-chat-txt", m.dlg).addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) $("#cr-chat-form", m.dlg).requestSubmit(); });
}

window.Creativos = {
  montar, desmontar, abrir,
  refrescar: () => { if (C.montado) { pintar(); cargar({ sync: !C.g }); } },
};
})();

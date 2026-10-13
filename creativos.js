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
const hoyAR = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ_AR }).format(d);
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const dm = (f) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f || ""); return m ? `${+m[3]}/${+m[2]}` : f; };
const diaSem = (f) => { try { return DIAS[new Date(f + "T12:00:00Z").getUTCDay()]; } catch { return ""; } };
const plata = (n) => n == null ? "—" : "$" + Number(n).toLocaleString("es-AR", { minimumFractionDigits: n >= 100 ? 0 : 2, maximumFractionDigits: n >= 100 ? 0 : 2 });
const roasCls = (r) => r == null ? "gris" : r < 1 ? "rojo" : r < 1.5 ? "nar" : r < 2 ? "ama" : "ver";
const PERSONAS = [["lorenzo", "Lorenzo"], ["franco", "Franco"]];
const ESTADO_CHAT = { abierto: "Sin mandar", en_cola: "En cola en la Mac", trabajando: "Claude está trabajando", listo: "Listo", error: "Hubo un problema" };
const ICO = {
  carpeta: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3.5 6.5 C 3.4 5.6, 4 5, 4.9 5 L9.2 5 L11 7 L19.2 7 C 20.1 7, 20.6 7.6, 20.5 8.5 L20.3 17.8 C 20.2 18.6, 19.7 19.1, 18.9 19.1 L5 19 C 4.2 19, 3.6 18.5, 3.6 17.7 Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>',
  puntos: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="5.5" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/><circle cx="18.5" cy="12" r="1.9" fill="currentColor"/></svg>',
  play: '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M8.5 5.8 L18.6 12 L8.5 18.2 Z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
};

const C = {
  raiz: null, ctx: {}, montado: false,
  g: null, f: null,                       // ruta: grupo y fecha
  raizD: null, oferta: {}, carpeta: {},   // datos
  buscar: "",
  metr: ls.get("cr_metr", "0") === "1",   // switch «Ver métricas»
  periodo: "total", desde: hoyAR(), hasta: hoyAR(),
  m: null, mCargando: false, mErr: null,  // métricas de la carpeta abierta
  timer: null, chatTimer: null,
  quien: ls.get("ws_persona", "lorenzo"),
};

async function api(accion, { q = "", body = null } = {}) {
  const r = await fetch(`${API}?accion=${accion}${q}`, {
    method: body ? "POST" : "GET",
    headers: { "x-app-clave": clave(), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { const e = new Error("Clave incorrecta"); e.code = 401; throw e; }
  if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}
const falla = (e) => { if (e.code === 401) { desmontar(); C.ctx.login?.("Clave incorrecta"); return true; } return false; };
const toast = (m, t) => C.ctx.toast ? C.ctx.toast(esc(m), t) : null;

// ---------------------------------------------------------------- ruta (#creativos/<grupo>/<fecha>)
function leerRuta() {
  const p = location.hash.slice(1).split("/");
  if (p[0] !== "creativos") return {};
  return { g: p[1] ? decodeURIComponent(p[1]) : null, f: /^\d{4}-\d{2}-\d{2}$/.test(p[2] || "") ? p[2] : null, chat: /^chat-(\d+)$/.exec(p[3] || "")?.[1] ?? null };
}
function ir(g = null, f = null, { empujar = true } = {}) {
  C.g = g; C.f = f; C.m = null; C.mErr = null;
  const h = "#creativos" + (g ? "/" + encodeURIComponent(g) + (f ? "/" + f : "") : "");
  try { if (empujar && location.hash !== h) history.pushState(null, "", location.pathname + location.search + h); else history.replaceState(null, "", location.pathname + location.search + h); } catch {}
  pintar(); window.scrollTo(0, 0);
  cargar();
}

// ---------------------------------------------------------------- montar
function montar(raiz, ctx = {}) {
  C.raiz = raiz; C.ctx = ctx; C.montado = true;
  const r = ctx.ruta || leerRuta();
  C.g = r.g || null; C.f = r.f || null;
  addEventListener("popstate", alVolver);
  document.addEventListener("click", cerrarMenusFuera);
  document.addEventListener("keydown", teclaMenus);
  pintar(); cargar();
  if (r.chat) abrirChat({ chatId: Number(r.chat) });
}
function desmontar() {
  C.montado = false; clearTimeout(C.timer); C.timer = null; clearInterval(C.chatTimer); C.chatTimer = null;
  removeEventListener("popstate", alVolver);
  document.removeEventListener("click", cerrarMenusFuera);
  document.removeEventListener("keydown", teclaMenus);
}
function alVolver() { if (!C.montado) return; const r = leerRuta(); if (!location.hash.startsWith("#creativos")) return; C.g = r.g || null; C.f = r.f || null; C.m = null; pintar(); cargar(); }
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
    if (!g) C.raizD = await api("creativos");
    else if (!f) C.oferta[g] = await api("creativos", { q: `&grupo=${encodeURIComponent(g)}` });
    else C.carpeta[g + "|" + f] = await api("creativos", { q: `&grupo=${encodeURIComponent(g)}&fecha=${f}` });
  } catch (e) {
    if (falla(e)) return;
    if (C.montado && C.g === g && C.f === f) pintarError(e.message);
    return;
  }
  if (!C.montado || C.g !== g || C.f !== f) return;
  pintar();
  if (f && C.metr && !C.m && !C.mCargando) cargarMetricas();
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

// ---------------------------------------------------------------- pintar
function migas() {
  const partes = [`<button type="button" class="cr-miga" data-ir="">${ICO.carpeta}Creativos</button>`];
  if (C.g) {
    const d = C.oferta[C.g] || C.carpeta[C.g + "|" + C.f] || {};
    const etq = d.etiqueta || (C.raizD?.carpetas || []).find((x) => x.grupo === C.g)?.etiqueta || C.g;
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
  const acciones = !C.g
    ? `<button type="button" class="btn chico" data-sync title="Trae de Meta los anuncios que salieron recién">↻ Buscar nuevos</button>`
    : C.f ? `<div class="cr-menu-wrap"><button type="button" class="btn icono cr-puntos" data-menu="carpeta" aria-haspopup="true" aria-expanded="false" aria-label="Opciones de la carpeta">${ICO.puntos}</button></div>` : "";
  C.raiz.innerHTML = `<div class="cr-cab">${migas()}<div class="cr-acc">${acciones}</div></div><div class="cr-cuerpo" id="cr-cuerpo"></div>`;
  $$("[data-ir]", C.raiz).forEach((b) => b.onclick = () => ir(b.dataset.ir || null, null));
  const s = $("[data-sync]", C.raiz);
  if (s) s.onclick = async () => { s.classList.add("cargando"); s.disabled = true; await cargar({ sync: true }); };
  const p = $('[data-menu="carpeta"]', C.raiz); if (p) p.onclick = (e) => { e.stopPropagation(); menuCarpeta(p); };
  if (!C.g) pintarRaiz(); else if (!C.f) pintarOferta(); else pintarCarpeta();
}
function pintarError(msg) {
  const c = $("#cr-cuerpo", C.raiz); if (!c) return;
  c.innerHTML = `<div class="err-box" role="alert"><b>No se pudo cargar.</b> ${esc(msg)}<div><button type="button" class="btn chico" data-re>Reintentar</button></div></div>`;
  $("[data-re]", c).onclick = () => { pintar(); cargar(); };
}
const cargando = (t) => `<p class="vacio"><span class="cargador"></span>${esc(t)}</p>`;
const collage = (ps) => `<div class="cr-collage n${Math.min(3, ps.length)}" aria-hidden="true">${ps.slice(0, 3).map((p) => `<img src="${esc(url(p))}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`).join("") || ICO.carpeta}</div>`;

function pintarRaiz() {
  const c = $("#cr-cuerpo", C.raiz); const d = C.raizD;
  if (!d) { c.innerHTML = cargando("Abriendo las carpetas…"); return; }
  if (!d.carpetas.length) {
    c.innerHTML = `<p class="vacio">Todavía no hay creativos. Tocá «↻ Buscar nuevos» para traerlos de Meta.</p>`; return;
  }
  const q = C.buscar.trim().toLowerCase();
  const lista = d.carpetas.filter((x) => !q || `${x.etiqueta} ${x.oferta} ${x.mercado}`.toLowerCase().includes(q));
  c.innerHTML = `
    <div class="cr-filtro">
      <label class="sr" for="cr-buscar">Buscar oferta o país</label>
      <input class="campo" id="cr-buscar" type="search" placeholder="Buscar oferta o país" value="${esc(C.buscar)}" autocomplete="off">
      <span class="cr-mut">${d.carpetas.length} ofertas · ${d.carpetas.reduce((s, x) => s + x.n, 0)} creativos${d.sync ? ` · actualizado ${esc(horaCorta(d.sync))}` : ""}</span>
    </div>
    <div class="cr-carpetas">${lista.map((x) => `
      <button type="button" class="cr-carpeta boceto" data-g="${esc(x.grupo)}">
        <span class="cr-pestana" aria-hidden="true"></span>
        ${collage(x.portadas)}
        <span class="cr-c-tit">${x.bandera ? `<span aria-hidden="true">${esc(x.bandera)}</span> ` : ""}${esc(x.etiqueta)}</span>
        <span class="cr-c-meta">${x.n} creativo${x.n === 1 ? "" : "s"} · ${x.fechas} fecha${x.fechas === 1 ? "" : "s"} · último ${esc(dm(x.ultima))}</span>
      </button>`).join("") || `<p class="vacio chico">Nada coincide con «${esc(C.buscar)}».</p>`}
    </div>`;
  const inp = $("#cr-buscar", c);
  inp.oninput = () => { C.buscar = inp.value; const pos = inp.selectionStart; pintarRaiz(); const n = $("#cr-buscar", C.raiz); n.focus(); try { n.setSelectionRange(pos, pos); } catch {} };
  $$("[data-g]", c).forEach((b) => b.onclick = () => ir(b.dataset.g, null));
}
const horaCorta = (iso) => { try { const d = new Date(iso); const f = hoyAR(d) === hoyAR() ? "" : dm(hoyAR(d)) + " "; return f + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ_AR }); } catch { return ""; } };

function pintarOferta() {
  const c = $("#cr-cuerpo", C.raiz); const d = C.oferta[C.g];
  if (!d) { c.innerHTML = cargando("Abriendo la oferta…"); return; }
  if (!d.fechas.length) { c.innerHTML = `<p class="vacio">Esta carpeta está vacía.</p>`; return; }
  c.innerHTML = `<div class="cr-fechas">${d.fechas.map((x) => `
    <button type="button" class="cr-fecha boceto" data-f="${esc(x.fecha)}">
      <span class="cr-pestana" aria-hidden="true"></span>
      ${collage(x.portadas)}
      <span class="cr-f-tit"><b>${esc(dm(x.fecha))}</b> <small>${esc(diaSem(x.fecha))}</small></span>
      <span class="cr-f-meta"><span class="cr-tipo ${x.tipo === "testeo" ? "t-test" : "t-reno"}">${x.tipo === "testeo" ? "Testeo" : "Renovaciones"}</span> ${x.n} creativo${x.n === 1 ? "" : "s"}${x.trabajando ? ` <span class="cr-trab" title="Claude está corrigiendo"><span class="cargador mini"></span> corrigiendo</span>` : ""}</span>
    </button>`).join("")}</div>`;
  $$("[data-f]", c).forEach((b) => b.onclick = () => ir(C.g, b.dataset.f));
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

function pintarTarjetas() {
  const n = $("#cr-tarjetas", C.raiz); const d = C.carpeta[C.g + "|" + C.f]; if (!n || !d) return;
  if (!d.creativos.length) { n.innerHTML = `<p class="vacio">No hay creativos en esta fecha.</p>`; return; }
  const chatDe = new Map(); for (const ch of d.chats) if (ch.alcance === "creativo" && !chatDe.has(ch.creativo_id)) chatDe.set(ch.creativo_id, ch);
  n.innerHTML = d.creativos.map((c, i) => {
    const tr = c.transcripcion?.estado, ch = chatDe.get(c.id), m = C.metr && C.m ? C.m.creativos?.[c.id] : null;
    return `<article class="cr-card boceto" data-i="${i}">
      <button type="button" class="cr-poster" data-play aria-label="Ver ${esc(c.nombre || "creativo")}">
        ${c.thumb ? `<img src="${esc(url(c.thumb))}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ""}
        <span class="cr-playico" aria-hidden="true">${ICO.play}</span>
      </button>
      <div class="cr-menu-wrap cr-card-menu"><button type="button" class="cr-puntos-card" data-menu="card" aria-haspopup="true" aria-expanded="false" aria-label="Opciones de ${esc(c.nombre || "este creativo")}">${ICO.puntos}</button></div>
      <div class="cr-badges">
        ${c.origen === "fabrica" && !c.n_ads ? `<span class="cr-badge b-nuevo">sin salir</span>` : ""}
        ${c.version_de ? `<span class="cr-badge b-ver">corregido</span>` : ""}
        ${tr === "listo" ? `<span class="cr-badge b-ok">guion</span>` : tr === "en_cola" || tr === "transcribiendo" ? `<span class="cr-badge b-trab"><span class="cargador mini"></span>guion</span>` : tr === "error" ? `<span class="cr-badge b-err">guion ✕</span>` : ""}
        ${ch ? `<span class="cr-badge ${["en_cola", "trabajando"].includes(ch.estado) ? "b-trab" : ch.estado === "listo" ? "b-ok" : ch.estado === "error" ? "b-err" : ""}">${["en_cola", "trabajando"].includes(ch.estado) ? '<span class="cargador mini"></span>' : "💬"}${ch.estado === "listo" ? "corregido" : "corrección"}</span>` : ""}
      </div>
      <div class="cr-pie">
        <p class="cr-nom" title="${esc(c.nombre)}">${esc(c.nombre || "Sin nombre")}</p>
        ${C.metr ? (C.mCargando && !m ? `<div class="cr-m cr-mut"><span class="cargador mini"></span></div>` : `<div class="cr-m">
          <span><small>Gasto</small>${plata(m?.gasto ?? 0)}</span><span><small>Ventas</small>${m?.ventas ?? 0}</span><span><small>ROAS</small><b class="roas r-${roasCls(m?.roas ?? null)}">${m?.roas ?? "—"}</b></span></div>`)
          : `<p class="cr-mut cr-sub">${c.n_ads ? `${c.n_ads} anuncio${c.n_ads === 1 ? "" : "s"}` : "todavía no salió"}</p>`}
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
  const sinGuion = d.creativos.filter((c) => c.n_ads && !["listo", "en_cola", "transcribiendo"].includes(c.transcripcion?.estado));
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
      : { t: tr === "en_cola" || tr === "transcribiendo" ? "Transcribiendo…" : "Transcribir", sub: c.n_ads ? "guion en español" : "cuando salga en Meta", ico: "📝", off: !c.n_ads || tr === "en_cola" || tr === "transcribiendo", fn: () => transcribir([c]) },
    ...(c.post_id ? [{ t: "Ver en Facebook", ico: "↗", fn: () => window.open(`https://www.facebook.com/${c.post_id}`, "_blank", "noopener") }] : []),
    ...(url(c.drive_url) ? [{ t: "Abrir en Drive", ico: "↗", fn: () => window.open(c.drive_url, "_blank", "noopener") }] : []),
  ]);
}

// ---------------------------------------------------------------- ver un creativo
async function verCreativo(c) {
  const tr = c.transcripcion;
  const m = C.ctx.abrirModal(`
    <h3 class="cr-m-tit">${esc(c.nombre || "Creativo")}</h3>
    <div class="cr-video" id="cr-video">${c.thumb ? `<img src="${esc(url(c.thumb))}" alt="">` : ""}<span class="cr-v-carga"><span class="cargador"></span>Cargando el video…</span></div>
    ${tr?.estado === "listo" ? `<details class="cr-guion-mini"><summary>Guion en español</summary><pre>${esc(tr.es)}</pre></details>` : ""}
    <div class="botones">
      <button type="button" class="btn" data-corr>💬 Correcciones</button>
      ${tr?.estado === "listo" ? "" : `<button type="button" class="btn" data-tr ${c.n_ads ? "" : "disabled"}>📝 Transcribir</button>`}
      <button type="button" class="btn pri" data-cerrar data-foco>Cerrar</button>
    </div>`, { ancho: true });
  m.dlg.classList.add("cr-dlg");
  $("[data-cerrar]", m.dlg).onclick = m.cerrar;
  $("[data-corr]", m.dlg).onclick = () => { m.cerrar(); abrirChat({ alcance: "creativo", creativo: c }); };
  const t = $("[data-tr]", m.dlg); if (t) t.onclick = () => { m.cerrar(); transcribir([c]); };
  const box = $("#cr-video", m.dlg);
  if (!c.ads?.length) { box.innerHTML = c.drive_url ? `<p class="cr-mut">Todavía no salió en Meta. <a href="${esc(url(c.drive_url))}" target="_blank" rel="noopener">Abrir en Drive ↗</a></p>` : `<p class="cr-mut">Todavía no salió en Meta.</p>`; return; }
  for (const [ad, act] of c.ads.slice(0, 3)) {
    try {
      const v = await api("video", { q: `&ad=${encodeURIComponent(ad)}&act=${encodeURIComponent(act)}` });
      if (!box.isConnected) return;
      if (v.src) { box.innerHTML = `<video src="${esc(url(v.src))}" ${v.poster ? `poster="${esc(url(v.poster))}"` : ""} controls playsinline autoplay preload="metadata"></video>`; return; }
      if (v.link) { box.innerHTML = `<p class="cr-mut">${esc(v.error || "No se puede reproducir acá.")} <a href="${esc(url(v.link))}" target="_blank" rel="noopener">Verlo en Facebook ↗</a></p>`; return; }
    } catch (e) { if (falla(e)) return; }
  }
  if (box.isConnected) box.innerHTML = `<p class="cr-mut">No se pudo cargar el video.${c.post_id ? ` <a href="https://www.facebook.com/${esc(c.post_id)}" target="_blank" rel="noopener">Verlo en Facebook ↗</a>` : ""}</p>`;
}

// ---------------------------------------------------------------- transcribir
async function transcribir(lista) {
  const ids = lista.filter((c) => c.n_ads).map((c) => c.id); if (!ids.length) return;
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

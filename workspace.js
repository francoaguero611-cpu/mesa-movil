/* Workspace — sección del Dashboard desde el 12/10 (spec: Segundo-cerebro-business/OUTPUTS/2026-10-12-workspace-spec.md).
   app.js lo carga la primera vez que se entra y lo monta con window.Workspace.montar(raiz, ctx).
   Backend: Edge Function ws-evento (copia en Segundo-cerebro-business/scripts/supabase/ws-evento).
   Etapa 1: solo lectura. Las 3 ofertas del día con su barra de etapas y links, y la «Terminal» en vivo del Claude de
   cada persona (hooks de Claude Code → ws_eventos). Lorenzo primero, deslizando Franco.
   Pendiente (etapas 2–5): Aprobar / Pedir cambios, Publicar con candado, Diagnóstico, Renovaciones con video y guion. */
"use strict";
(() => {
let CTX = { login: () => {} };

const API = "https://tppcpnfzcxxusdhrlmdx.supabase.co/functions/v1/ws-evento";
const DEMO = new URLSearchParams(location.search).get("demo") === "1";
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
const reducido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const hoyAR = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ_AR }).format(d);
const menosDias = (n) => hoyAR(new Date(Date.now() - n * 86400000));
const hora = (iso) => { try { return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: TZ_AR }); } catch { return ""; } };
const dmy = (f) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f || ""); return m ? `${+m[3]}/${+m[2]}` : f; };

const PERSONAS = [["lorenzo", "Lorenzo"], ["franco", "Franco"]];
const ETAPAS = [
  ["investigacion", "Investigación", "Oferta y los 5 anuncios elegidos"],
  ["producto", "Producto", "Entregable"],
  ["landing", "Landing y tienda", "Landing y checkout"],
  ["tracking", "Tracking", "Pixel, CAPI y dominio"],
  ["creativos", "Creativos", "Carpeta de videos"],
  ["campana", "Campaña", "Armada en pausa"],
  ["publicada", "Publicada", "Activa en Meta"],
];
const ESTADO = {
  pendiente: ["Pendiente", "e-pend"],
  en_curso: ["Armando", "e-curso"],
  para_revisar: ["Para revisar", "e-rev"],
  aprobada: ["Aprobada", "e-ok"],
  lista: ["Lista", "e-ok"],
  cambios: ["Cambios pedidos", "e-camb"],
  error: ["Error", "e-err"],
};

// Estado por persona
const W = {
  montado: false,
  persona: ls.get("ws_persona", "lorenzo"),
  fecha: "hoy",                // "hoy" | YYYY-MM-DD
  d: {},                       // persona -> { fecha, ofertas, eventos, ultimo, error, cargando }
  timer: null,
  obs: null,
  abiertas: new Set(),         // ofertas con el detalle abierto (id)
};
const fechaReal = () => W.fecha === "hoy" ? hoyAR() : W.fecha;

// ---------- API ----------
async function api(q) {
  if (DEMO) return demo(q);
  let r;
  try { r = await fetch(`${API}?accion=panel${q}`, { headers: { "x-app-clave": clave() }, cache: "no-store" }); }
  catch { const e = new Error("Sin conexión con el servidor"); e.code = 0; throw e; }
  if (r.status === 401) { const e = new Error("Clave incorrecta"); e.code = 401; throw e; }
  let j = null; try { j = await r.json(); } catch {}
  if (!r.ok || j?.error) { const e = new Error(j?.error || `Error ${r.status}`); e.code = r.status; throw e; }
  return j;
}

async function cargar(p, { incremental = false } = {}) {
  const fecha = fechaReal();
  const d = W.d[p] && W.d[p].fecha === fecha ? W.d[p] : (W.d[p] = { fecha, ofertas: null, eventos: [], ultimo: 0 });
  if (d.cargando) return;
  d.cargando = true;
  try {
    const desde = incremental && d.ultimo ? `&desde=${d.ultimo}` : "";
    const j = await api(`&dueno=${p}&fecha=${fecha}${desde}`);
    if (W.d[p] !== d) return;                          // cambió la fecha mientras tanto
    const ofertasCambiaron = JSON.stringify(j.ofertas) !== JSON.stringify(d.ofertas);
    d.ofertas = j.ofertas || [];
    const nuevos = j.eventos || [];
    d.eventos = desde ? d.eventos.concat(nuevos).slice(-800) : nuevos;
    if (d.eventos.length) d.ultimo = d.eventos[d.eventos.length - 1].id;
    d.error = null; d.ts = Date.now();
    if (ofertasCambiaron || !desde) pintarOfertas(p);
    if (desde) agregarEventos(p, nuevos); else pintarTerminal(p);
    pintarHora(p);
  } catch (e) {
    if (e.code === 401) { parar(); return CTX.login("Clave incorrecta"); }
    d.error = e.message;
    if (!d.ofertas) pintarOfertas(p);
    pintarHora(p);
  } finally { d.cargando = false; }
}

// ---------- refresco: solo la persona que se ve, solo «hoy», solo con la pestaña visible ----------
function arrancar() {
  parar();
  W.timer = setInterval(() => {
    if (!W.montado || document.hidden || W.fecha !== "hoy") return;
    if (W.fecha === "hoy" && W.d[W.persona]?.fecha !== hoyAR()) return cargar(W.persona);   // pasó la medianoche
    cargar(W.persona, { incremental: true });
  }, POLL_MS);
}
function parar() { clearInterval(W.timer); W.timer = null; }
const alVolver = () => { if (W.montado && !document.hidden) cargar(W.persona, { incremental: true }); };

// ---------- pintar ----------
function montar(raiz, ctx = {}) {
  CTX = { ...CTX, ...ctx };
  W.montado = true;
  if (!PERSONAS.some(([k]) => k === W.persona)) W.persona = "lorenzo";
  raiz.innerHTML = `
    <div class="ws-cab">
      <nav class="ws-personas" aria-label="Persona">${PERSONAS.map(([k, n]) => `<button type="button" class="seccion" data-persona="${k}" aria-pressed="${k === W.persona}">${n}</button>`).join("")}</nav>
      <div class="ws-acciones">
        <div class="ws-fechas periodos" role="group" aria-label="Fecha">
          <button type="button" class="btn chico" data-fecha="hoy">Hoy</button>
          <button type="button" class="btn chico" data-fecha="${menosDias(1)}">Ayer</button>
          <button type="button" class="btn chico" data-fecha="${menosDias(2)}">Anteayer</button>
          <label class="ws-cal"><span class="sr">Otra fecha</span><input type="date" id="ws-cal" max="${hoyAR()}"></label>
        </div>
        <button type="button" class="btn chico" id="ws-diag" disabled title="Llega en la etapa 3">Diagnóstico</button>
      </div>
    </div>
    <div class="ws-pista" id="ws-pista">${PERSONAS.map(([k, n]) => `
      <section class="ws-panel" data-panel="${k}" aria-label="Workspace de ${n}">
        <div class="ws-izq">
          <div class="ws-tit"><h3>Ofertas del día <small class="ws-fecha-t"></small></h3><span class="ws-hora num" data-hora></span></div>
          <div class="ws-ofertas" data-ofertas><p class="vacio"><span class="cargador"></span>Cargando…</p></div>
          <div class="ws-renos boceto">
            <h3>Renovaciones del día</h3>
            <p class="ws-mut">Videos con reproductor, guion en español y lo que falta: llega en la etapa 4.</p>
          </div>
        </div>
        <aside class="ws-der">
          <div class="ws-term" aria-label="Terminal de Claude de ${n}">
            <div class="ws-term-cab"><span class="ws-luz" data-luz></span>Terminal · Claude de ${n}</div>
            <ol class="ws-term-lineas" data-term role="log" aria-live="polite"></ol>
            <button type="button" class="ws-term-abajo" data-abajo hidden>Ir a lo último ↓</button>
          </div>
        </aside>
      </section>`).join("")}
    </div>`;

  $$("[data-persona]", raiz).forEach((b) => b.onclick = () => irAPersona(b.dataset.persona, true));
  $$("[data-fecha]", raiz).forEach((b) => b.onclick = () => ponerFecha(b.dataset.fecha));
  $("#ws-cal", raiz).onchange = (e) => { if (e.target.value) ponerFecha(e.target.value === hoyAR() ? "hoy" : e.target.value); };
  $$("[data-term]", raiz).forEach((t) => {
    const btn = t.parentElement.querySelector("[data-abajo]");
    t.addEventListener("scroll", () => { btn.hidden = alFondo(t); }, { passive: true });
    btn.onclick = () => { t.scrollTop = t.scrollHeight; btn.hidden = true; };
  });

  // Deslizar entre personas: scroll-snap; la que queda a la vista es la activa.
  const pista = $("#ws-pista", raiz);
  W.obs?.disconnect();
  W.obs = new IntersectionObserver((ents) => {
    if (!W.listo) return;          // hasta que se acomode en la persona guardada
    for (const e of ents) if (e.isIntersecting && e.intersectionRatio > 0.6) irAPersona(e.target.dataset.panel, false);
  }, { root: pista, threshold: [0.6] });
  $$("[data-panel]", pista).forEach((p) => W.obs.observe(p));
  W.listo = false;
  requestAnimationFrame(() => {
    const p = $(`[data-panel="${W.persona}"]`, pista); if (p) pista.scrollLeft = p.offsetLeft - pista.offsetLeft;
    setTimeout(() => { W.listo = true; }, 300);
  });

  document.addEventListener("visibilitychange", alVolver);
  pintarFechas();
  if (!DEMO && !clave()) return CTX.login();
  cargar(W.persona);
  arrancar();
}

function desmontar() {
  if (!W.montado) return;
  W.montado = false;
  parar();
  W.obs?.disconnect(); W.obs = null;
  document.removeEventListener("visibilitychange", alVolver);
}

function irAPersona(p, deslizar) {
  if (!PERSONAS.some(([k]) => k === p)) return;
  const cambio = p !== W.persona;
  W.persona = p; ls.set("ws_persona", p);
  $$("[data-persona]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.persona === p));
  if (deslizar) {
    const pista = $("#ws-pista"), panel = $(`[data-panel="${p}"]`);
    if (pista && panel) pista.scrollTo({ left: panel.offsetLeft - pista.offsetLeft, behavior: reducido() ? "auto" : "smooth" });
  }
  if (cambio || !W.d[p] || W.d[p].fecha !== fechaReal()) cargar(p);
}

function ponerFecha(f) {
  W.fecha = f;
  pintarFechas();
  for (const [k] of PERSONAS) { delete W.d[k]; const o = $(`[data-panel="${k}"] [data-ofertas]`); if (o) o.innerHTML = `<p class="vacio"><span class="cargador"></span>Cargando…</p>`; const t = $(`[data-panel="${k}"] [data-term]`); if (t) t.innerHTML = ""; }
  cargar(W.persona);
}
function pintarFechas() {
  const real = fechaReal();
  $$("[data-fecha]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.fecha === W.fecha || (b.dataset.fecha !== "hoy" && b.dataset.fecha === real)));
  const cal = $("#ws-cal"); if (cal) cal.value = real;
  $$(".ws-fecha-t").forEach((s) => s.textContent = W.fecha === "hoy" ? `hoy ${dmy(real)}` : dmy(real));
  $$("[data-luz]").forEach((l) => l.classList.toggle("vivo", W.fecha === "hoy"));
}
function pintarHora(p) {
  const d = W.d[p], h = $(`[data-panel="${p}"] [data-hora]`);
  if (!h || !d) return;
  h.innerHTML = d.error ? `<span class="ws-err-t">⚠ ${esc(d.error)}</span>` : (W.fecha === "hoy" ? `en vivo · ${hora(new Date(d.ts).toISOString())}` : "");
}

// ----- ofertas -----
function pintarOfertas(p) {
  const caja = $(`[data-panel="${p}"] [data-ofertas]`); if (!caja) return;
  const d = W.d[p];
  if (!d?.ofertas) {
    caja.innerHTML = d?.error ? `<div class="err-box" role="alert"><b>No se pudo cargar.</b> ${esc(d.error)}</div>` : `<p class="vacio"><span class="cargador"></span>Cargando…</p>`;
    return;
  }
  if (!d.ofertas.length) {
    const nombre = PERSONAS.find(([k]) => k === p)[1];
    caja.innerHTML = `<p class="vacio chico">Sin ofertas ${W.fecha === "hoy" ? "hoy" : `el ${dmy(fechaReal())}`}. Cuando el Claude de ${esc(nombre)} arranque una, aparece acá (la carga con <code>scripts/ws.py oferta</code>).</p>`;
    return;
  }
  caja.innerHTML = d.ofertas.map(tarjetaOferta).join("");
  $$("[data-abrir]", caja).forEach((b) => b.onclick = () => {
    const id = b.dataset.abrir;
    W.abiertas.has(id) ? W.abiertas.delete(id) : W.abiertas.add(id);
    const card = b.closest(".ws-oferta");
    card.classList.toggle("abierta", W.abiertas.has(id));
    b.setAttribute("aria-expanded", W.abiertas.has(id));
  });
}

function etapaActual(et) {
  // la primera que no está aprobada ni lista
  const i = ETAPAS.findIndex(([k]) => !["aprobada", "lista"].includes(et[k]?.estado));
  return i < 0 ? ETAPAS.length : i;
}

function tarjetaOferta(o) {
  const et = o.etapas || {};
  const hechas = ETAPAS.filter(([k]) => ["aprobada", "lista"].includes(et[k]?.estado)).length;
  const actual = etapaActual(et);
  const abierta = W.abiertas.has(o.id);
  const barra = ETAPAS.map(([k, n], i) => {
    const e = et[k]?.estado || "pendiente";
    return `<span class="ws-seg ${ESTADO[e]?.[1] || "e-pend"}${i === actual ? " actual" : ""}" title="${esc(n)}: ${esc(ESTADO[e]?.[0] || e)}"></span>`;
  }).join("");
  const filas = ETAPAS.map(([k, n, ayuda], i) => {
    const x = et[k] || {};
    const e = x.estado || "pendiente";
    const [txt, cls] = ESTADO[e] || [e, "e-pend"];
    const links = [];
    if (url(x.link)) links.push(`<a class="btn chico" href="${esc(x.link)}" target="_blank" rel="noopener">Revisar ↗</a>`);
    for (const l of x.links || []) if (url(l.u)) links.push(`<a class="btn chico" href="${esc(l.u)}" target="_blank" rel="noopener">${esc(l.t)} ↗</a>`);
    const ap = x.aprobacion;
    return `<li class="ws-etapa${i === actual ? " actual" : ""}">
      <span class="ws-n num">${i + 1}</span>
      <div class="ws-et-cuerpo">
        <div class="ws-et-l1"><b>${esc(n)}</b><span class="ws-estado ${cls}">${esc(txt)}</span>${x.ts ? `<span class="ws-mut num">${esc(hora(x.ts))}</span>` : ""}</div>
        <div class="ws-mut">${esc(x.nota || ayuda)}</div>
        ${ap ? `<div class="ws-ap">${ap.decision === "aprobada" ? "✓ Aprobada" : "✎ Cambios"}${ap.quien ? ` por ${esc(ap.quien)}` : ""}${ap.comentario ? `: «${esc(ap.comentario)}»` : ""}</div>` : ""}
        ${links.length ? `<div class="ws-links">${links.join("")}</div>` : ""}
      </div>
    </li>`;
  }).join("");
  const revisar = ETAPAS.filter(([k]) => et[k]?.estado === "para_revisar").length;
  return `<article class="ws-oferta boceto${abierta ? " abierta" : ""}">
    <button type="button" class="ws-of-cab" data-abrir="${esc(o.id)}" aria-expanded="${abierta}">
      <div class="ws-of-t"><h4>${esc(o.nombre)}</h4>${o.mercado ? `<span class="chip-tp">${esc(o.mercado)}</span>` : ""}${revisar ? `<span class="ws-estado e-rev">${revisar} para revisar</span>` : ""}</div>
      <div class="ws-barra" aria-label="${hechas} de ${ETAPAS.length} etapas">${barra}</div>
      <div class="ws-mut num">${hechas}/${ETAPAS.length} · ${actual < ETAPAS.length ? `ahora: ${esc(ETAPAS[actual][1])}` : "completa"}</div>
    </button>
    <ol class="ws-etapas">${filas}</ol>
  </article>`;
}

// ----- terminal -----
const alFondo = (t) => t.scrollHeight - t.scrollTop - t.clientHeight < 30;
const ICONO = { herramienta: "›", mensaje: "●", usuario: "▸", fin: "■", etapa: "◆" };
function linea(e) {
  const quien = e.tipo === "usuario" ? "Vos" : e.tipo === "mensaje" ? "Claude" : e.tipo === "etapa" ? "Etapa" : e.tipo === "fin" ? "" : e.herramienta || "";
  return `<li class="t-${esc(e.tipo)}"><span class="t-h num">${esc(hora(e.ts))}</span><span class="t-i" aria-hidden="true">${ICONO[e.tipo] || "·"}</span><span class="t-x">${quien ? `<b>${esc(quien)}</b> ` : ""}${esc(e.texto || "")}</span></li>`;
}
function pintarTerminal(p) {
  const t = $(`[data-panel="${p}"] [data-term]`); if (!t) return;
  const ev = W.d[p]?.eventos || [];
  t.innerHTML = ev.length ? ev.map(linea).join("") : `<li class="t-vacio">${W.fecha === "hoy" ? "Esperando actividad de Claude…" : "Sin actividad ese día."}</li>`;
  t.scrollTop = t.scrollHeight;
}
function agregarEventos(p, nuevos) {
  if (!nuevos.length) return;
  const t = $(`[data-panel="${p}"] [data-term]`); if (!t) return;
  const abajo = alFondo(t);
  $(".t-vacio", t)?.remove();
  t.insertAdjacentHTML("beforeend", nuevos.map(linea).join(""));
  while (t.children.length > 800) t.firstElementChild.remove();
  if (abajo) t.scrollTop = t.scrollHeight;
  else t.parentElement.querySelector("[data-abajo]").hidden = false;
}

// ---------- demo ----------
let demoN = 0;
function demo(q) {
  const dueno = /dueno=(\w+)/.exec(q)?.[1] || "lorenzo";
  const ahora = Date.now();
  const ev = (i, tipo, herramienta, texto) => ({ id: i, ts: new Date(ahora - (40 - i) * 60000).toISOString(), tipo, herramienta, texto });
  const base = dueno === "lorenzo" ? [
    ev(1, "usuario", null, "sacá el testeo de Moldes FR"),
    ev(2, "herramienta", "Impultienda · impultienda_listar_tiendas", ""),
    ev(3, "herramienta", "Bash", "Crear pixel nuevo para la tienda FR"),
    ev(4, "etapa", "tracking", "La Patronothèque: tracking → para_revisar"),
    ev(5, "mensaje", null, "Listo el pixel y la CAPI. Te dejo el link de tracking para revisar."),
    ev(6, "fin", null, "Terminó el turno"),
  ] : [ev(1, "usuario", null, "armá la landing de GLP-1 IE"), ev(2, "herramienta", "Skill", "Skill armar-landing")];
  const desde = Number(/desde=(\d+)/.exec(q)?.[1] || 0);
  let eventos = base;
  if (desde) { demoN++; eventos = demoN % 3 ? [] : [ev(desde + 1, "herramienta", "Bash", "Revisar issues de los anuncios")]; eventos[0] && (eventos[0].ts = new Date().toISOString()); }
  const E = (estado, extra = {}) => ({ estado, ts: new Date(ahora - 3600000).toISOString(), ...extra });
  const ofertas = dueno === "lorenzo" ? [
    { id: "d1", slug: "moldes-fr", nombre: "La Patronothèque", mercado: "FR", etapas: {
      investigacion: E("aprobada", { aprobacion: { decision: "aprobada", quien: "Lorenzo" } }), producto: E("lista"), landing: E("aprobada"),
      tracking: E("para_revisar", { link: "https://example.com/tracking", nota: "Pixel 1234 · CAPI ok · dominio verificado" }),
      creativos: E("en_curso", { nota: "3 de 5 videos" }), campana: { estado: "pendiente" }, publicada: { estado: "pendiente" } } },
    { id: "d2", slug: "cuero-de", nombre: "Leder & Handwerk", mercado: "DE", etapas: {
      investigacion: E("aprobada"), producto: E("cambios", { aprobacion: { decision: "cambios", quien: "Lorenzo", comentario: "faltan las láminas de moldes" } }) } },
    { id: "d3", slug: "40dias-pt", nombre: "40 Dias", mercado: "BR", etapas: { investigacion: E("para_revisar", { link: "https://example.com/biblioteca" }) } },
  ] : [{ id: "d4", slug: "glp1-ie", nombre: "GLP-1 Kitchen", mercado: "IE", etapas: { investigacion: E("aprobada"), producto: E("lista"), landing: E("en_curso") } }];
  return Promise.resolve({ dueno, fecha: hoyAR(), ofertas, eventos });
}

window.Workspace = {
  montar, desmontar,
  refrescar: () => { if (W.montado) cargar(W.persona); },
};
})();

/* ATC (atención al cliente) — sección del Dashboard desde el 27/10. Para controlar qué responden los bots y Tomi.
   Pestañas: Comentarios · Privados · Mails · Reclamos. Cada una: números del período, reporte en frases, filtros y la lista
   para revisar caso por caso (lo que escribió el cliente, qué se le respondió y quién). Lo que no está en español se muestra
   traducido, con el idioma original. Privados: «Ver chat» abre la conversación completa de Messenger.
   app.js lo carga la primera vez que se entra y lo monta con window.Atc.montar(raiz, ctx).
   Backend: Edge Function «atc» (copia en Segundo-cerebro-business/scripts/supabase/atc/index.ts). */
"use strict";
(() => {
const API = "https://tppcpnfzcxxusdhrlmdx.supabase.co/functions/v1/atc";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ls = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const url = (u) => /^https?:\/\//i.test(String(u || "")) ? String(u) : "";
const clave = () => ls.get("dash_clave", "");
const fecha = (f) => { try { return new Date(f).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
const num = (n) => Number(n ?? 0).toLocaleString("es-AR");

const TABS = [
  { id: "comentarios", nombre: "Comentarios", filtros: [["todos", "Todos"], ["pendientes", "Sin responder"], ["bot", "Bot"], ["tomi", "Tomi"], ["ocultos", "Ocultos"]] },
  { id: "privados", nombre: "Privados", filtros: [["todos", "Todos"], ["pendientes", "Sin responder"], ["bot", "Bot"], ["tomi", "Tomi"]] },
  { id: "mails", nombre: "Mails", filtros: [["todos", "Todos"], ["pendientes", "Sin responder"], ["bot", "Bot"], ["tomi", "Tomi"]] },
  { id: "reclamos", nombre: "Reclamos", filtros: [["todos", "Todos"], ["pendientes", "Abiertos"], ["bot", "Respondidos por el bot"]] },
];
const PERIODOS = [["hoy", "Hoy"], ["7d", "7 días"], ["30d", "30 días"]];
const A = { raiz: null, ctx: {}, tab: ls.get("atc_tab", "comentarios"), periodo: ls.get("atc_periodo", "hoy"), oferta: ls.get("atc_oferta", ""), ofertas: [], filtro: "todos", res: null, items: [], pag: 0, hayMas: false, cargando: false, original: new Set() };
const qOferta = () => A.oferta ? `&oferta=${encodeURIComponent(A.oferta)}` : "";

async function api(q) {
  const r = await fetch(`${API}?${q}`, { headers: { "x-app-clave": clave() }, cache: "no-store" }).catch(() => null);
  if (!r) throw new Error("Sin conexión con el servidor");
  if (r.status === 401) { A.ctx.login?.("Volvé a entrar para ver Atención al cliente."); throw new Error("Clave incorrecta"); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `Error ${r.status}`);
  return j;
}

// ---------- pintar ----------
const seg = (name, opts, val) => `<div class="segs">${opts.map(([k, t]) => `<label class="seg"><input type="radio" name="${name}" value="${esc(k)}" ${val === k ? "checked" : ""}><span>${t}</span></label>`).join("")}</div>`;
function pendDe(id) {
  const r = A.res; if (!r) return 0;
  if (id === "reclamos") return r.reclamos?.totales?.abiertas ?? 0;
  return r[id]?.totales?.sin_responder ?? 0;
}
function tiles() {
  const r = A.res; if (!r) return "";
  const t = r[A.tab]?.totales ?? {};
  const L = A.tab === "reclamos"
    ? [["Abiertos", t.abiertas, t.abiertas ? "alerta" : ""], ["Nuevos", t.nuevas], ["Cerrados", t.cerradas], ["Cerrados por el bot", t.cerradas_bot, "bot"]]
    : [["Recibidos", t.recibidos], ["Respondió el bot", t.bot, "bot"], ["Respondió Tomi", t.tomi, "tomi"], ["Sin responder", t.sin_responder, t.sin_responder ? "alerta" : ""]].concat(A.tab === "comentarios" ? [["Ocultos", t.ocultos]] : []);
  const juego = A.tab === "reclamos" && r.reclamos?.en_juego ? Object.entries(r.reclamos.en_juego).map(([m, v]) => `${m} ${num(Math.round(v))}`).join(" · ") : "";
  return `<div class="atc-tiles">${L.map(([n, v, c]) => `<div class="atc-tile ${c || ""}"><b>${num(v)}</b><span>${esc(n)}</span></div>`).join("")}${juego ? `<div class="atc-tile"><b class="chico">${esc(juego)}</b><span>En juego</span></div>` : ""}</div>`;
}
// selector de oferta: «Todas» + las que tuvieron movimiento en el período (con su total de casos del canal abierto)
function ofertasBar() {
  if (!A.ofertas.length) return "";
  const k = A.tab;
  const opts = [["", "Todas las ofertas"]].concat(A.ofertas.map((o) => [o.oferta, `${o.oferta === "sin" ? "Sin oferta" : o.oferta} · ${o[k] ?? 0}`]));
  if (A.oferta && !A.ofertas.some((o) => o.oferta === A.oferta)) opts.push([A.oferta, `${A.oferta === "sin" ? "Sin oferta" : A.oferta} · 0`]);
  return `<div class="atc-ofertas" aria-label="Filtrar por oferta">${seg("atc-of", opts, A.oferta)}</div>`;
}
function reporte() {
  const lineas = A.res?.[A.tab]?.reporte ?? [];
  return `<section class="atc-rep" aria-label="Reporte"><h3>Qué se hizo ${A.periodo === "hoy" ? "hoy" : A.periodo === "7d" ? "en 7 días" : "en 30 días"}</h3>${lineas.length ? `<ul>${lineas.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : `<p class="atc-mut">Sin movimiento en este período.</p>`}</section>`;
}
const QUIEN = { bot: ["Bot", "bot"], tomi: ["Tomi", "tomi"], nadie: ["Sin responder", "nadie"] };
function tarjeta(x, i) {
  const [qt, qc] = QUIEN[x.quien] ?? ["?", ""];
  const trad = !!x.traducido_de, verOrig = A.original.has(i);
  const txt = trad && !verOrig && x.texto_es ? x.texto_es : x.texto;
  const resp = trad && !verOrig && x.respuesta_es ? x.respuesta_es : x.respuesta;
  const etiqResp = x.quien === "tomi" ? "Respondió Tomi" : x.quien === "bot" ? "Respondió el bot" : x.tipo === "reclamos" ? "Respuesta preparada" : "Respuesta del bot (sin enviar)";
  return `<article class="atc-item" data-i="${i}">
    <header class="atc-cab"><span class="atc-quien ${qc}">${qt}</span><b>${esc(x.cliente || x.pagina || "")}</b>${x.cliente && x.pagina ? `<span class="atc-mut">en ${esc(x.pagina)}</span>` : ""}${x.oferta ? `<span class="atc-oferta">${esc(x.oferta)}</span>` : ""}<time class="atc-mut">${esc(fecha(x.fecha))}</time></header>
    ${trad ? `<p class="atc-trad">🌐 ${verOrig ? `Original en ${esc(x.traducido_de)}` : `Traducido del ${esc(x.traducido_de)}`} · <button type="button" class="atc-link" data-orig="${i}">${verOrig ? "ver en español" : "ver original"}</button></p>` : ""}
    ${x.asunto ? `<p class="atc-asunto">${esc(x.asunto)}</p>` : ""}
    <p class="atc-cli">${esc(txt || "(sin texto: imagen o sticker)")}</p>
    ${resp ? `<div class="atc-resp ${qc}"><span>${etiqResp}</span><p>${esc(resp)}</p></div>` : ""}
    ${x.respuesta_bot_no_enviada ? `<details class="atc-det"><summary>Lo que había preparado el bot</summary><p>${esc(x.respuesta_bot_no_enviada)}</p></details>` : ""}
    <footer class="atc-pie"><span class="atc-estado">${esc(x.estado || "")}</span>${(x.ordenes ?? []).length ? `<span class="atc-mut">Órdenes ${esc(x.ordenes.join(", "))}</span>` : ""}
      ${x.tipo === "privados" ? `<button type="button" class="btn chico" data-chat="${esc(x.id)}">Ver chat</button>` : ""}
      ${url(x.link) ? `<a class="btn chico" href="${esc(x.link)}" target="_blank" rel="noopener">Abrir ${x.tipo === "mails" ? "en Gmail" : x.tipo === "reclamos" ? "" : "en Facebook"}</a>` : ""}</footer>
  </article>`;
}
function lista() {
  if (!A.items.length && !A.cargando) return `<p class="vacio">No hay nada en este filtro.</p>`;
  return `<div class="atc-lista">${A.items.map(tarjeta).join("")}</div>${A.cargando ? `<p class="vacio"><span class="cargador"></span>Cargando…</p>` : A.hayMas ? `<div class="atc-mas"><button type="button" class="btn" id="atc-mas">Ver más</button></div>` : ""}`;
}
function pintar() {
  const r = A.raiz; if (!r) return;
  const tab = TABS.find((t) => t.id === A.tab) ?? TABS[0];
  const ped = A.res?.pedidos_pendientes ?? 0;
  r.innerHTML = `<div class="atc">
    <div class="atc-top">${seg("atc-per", PERIODOS, A.periodo)}<button type="button" class="btn chico" id="atc-ref" aria-label="Actualizar">↻ Actualizar</button></div>
    ${ofertasBar()}
    ${ped ? `<p class="atc-aviso">🛠️ Hay ${ped} pedido${ped > 1 ? "s" : ""} de clientes esperando tu OK (los ves en el reporte diario o en Discord).</p>` : ""}
    <div class="atc-tabs" role="tablist">${TABS.map((t) => { const n = pendDe(t.id); return `<button type="button" role="tab" class="atc-tab" aria-selected="${t.id === A.tab}" data-tab="${t.id}">${esc(t.nombre)}${n ? `<span class="atc-badge">${n}</span>` : ""}</button>`; }).join("")}</div>
    ${A.res ? tiles() + reporte() : `<p class="vacio"><span class="cargador"></span>Armando el reporte…</p>`}
    <div class="atc-filtros">${seg("atc-fil", tab.filtros, A.filtro)}</div>
    <div id="atc-lista">${lista()}</div>
  </div>`;
  $$('input[name="atc-per"]', r).forEach((x) => x.onchange = () => { A.periodo = x.value; ls.set("atc_periodo", A.periodo); todo(); });
  $$('input[name="atc-fil"]', r).forEach((x) => x.onchange = () => { A.filtro = x.value; cargarLista(); });
  $$('input[name="atc-of"]', r).forEach((x) => x.onchange = () => { A.oferta = x.value; ls.set("atc_oferta", A.oferta); A.res = null; pintar(); cargarResumen(); cargarLista(); });
  $$("[data-tab]", r).forEach((b) => b.onclick = () => { A.tab = b.dataset.tab; ls.set("atc_tab", A.tab); A.filtro = "todos"; pintar(); cargarLista(); });
  $("#atc-ref", r).onclick = () => todo();
  enlazarLista();
}
function enlazarLista() {
  const r = A.raiz; if (!r) return;
  $("#atc-mas", r)?.addEventListener("click", () => cargarLista(true));
  $$("[data-orig]", r).forEach((b) => b.onclick = () => { const i = Number(b.dataset.orig); A.original.has(i) ? A.original.delete(i) : A.original.add(i); pintarLista(); });
  $$("[data-chat]", r).forEach((b) => b.onclick = () => verChat(b.dataset.chat));
}
function pintarLista() { const n = $("#atc-lista", A.raiz); if (n) { n.innerHTML = lista(); enlazarLista(); } }

// ---------- datos ----------
async function cargarResumen() {
  try {
    const [res, of] = await Promise.all([api(`accion=resumen&periodo=${A.periodo}${qOferta()}`), api(`accion=ofertas&periodo=${A.periodo}`).catch(() => null)]);
    A.res = res; if (of) A.ofertas = of.ofertas ?? [];
  }
  catch (e) { A.res = null; A.ctx.toast?.(`No se pudo armar el reporte: ${e.message}`, "error"); }
  pintar();
}
async function cargarLista(mas = false) {
  if (!mas) { A.items = []; A.pag = 0; A.original.clear(); } else A.pag++;
  A.cargando = true; pintarLista();
  const pedido = `${A.tab}|${A.filtro}|${A.periodo}|${A.oferta}|${A.pag}`; A.ultimo = pedido;
  try {
    const j = await api(`accion=lista&tipo=${A.tab}&filtro=${A.filtro}&periodo=${A.periodo}&pag=${A.pag}${qOferta()}`);
    if (A.ultimo !== pedido) return;
    A.items = A.items.concat(j.items ?? []); A.hayMas = !!j.hay_mas;
  } catch (e) { if (A.ultimo === pedido) A.ctx.toast?.(`No se pudo cargar la lista: ${e.message}`, "error"); }
  if (A.ultimo === pedido) { A.cargando = false; pintarLista(); }
}
function todo() { A.res = null; pintar(); cargarResumen(); cargarLista(); }

// ---------- chat completo (privados) ----------
async function verChat(id) {
  const fondo = document.createElement("div");
  fondo.className = "atc-modal-fondo";
  fondo.innerHTML = `<div class="atc-modal" role="dialog" aria-modal="true" aria-label="Conversación"><header><b>Conversación</b><button type="button" class="btn chico" data-cerrar>Cerrar</button></header><div class="atc-modal-cuerpo"><p class="vacio"><span class="cargador"></span>Trayendo el chat de Facebook…</p></div></div>`;
  const cerrar = () => { fondo.remove(); removeEventListener("keydown", tecla); };
  const tecla = (e) => { if (e.key === "Escape") cerrar(); };
  fondo.onclick = (e) => { if (e.target === fondo || e.target.closest("[data-cerrar]")) cerrar(); };
  addEventListener("keydown", tecla);
  document.body.appendChild(fondo);
  const cuerpo = $(".atc-modal-cuerpo", fondo);
  try {
    const d = await api(`accion=detalle&tipo=privados&id=${encodeURIComponent(id)}`);
    cuerpo.innerHTML = `${d.traducido_de ? `<p class="atc-trad">🌐 Traducido del ${esc(d.traducido_de)} (el original abajo de cada mensaje)</p>` : ""}
      <div class="atc-chat">${(d.mensajes ?? []).map((m) => `<div class="atc-burbuja ${m.de}"><span class="atc-mut">${esc(m.de === "pagina" ? "Página" : (m.nombre || "Cliente"))} · ${esc(fecha(m.fecha))}</span><p>${esc(m.texto_es || m.texto || "(adjunto)")}</p>${m.texto_es ? `<p class="atc-orig">${esc(m.texto)}</p>` : ""}${(m.imagenes ?? []).filter(url).map((u) => `<img src="${esc(u)}" alt="Imagen que mandó" loading="lazy">`).join("")}</div>`).join("")}</div>
      ${d.respuesta_pendiente ? `<div class="atc-resp nadie"><span>Respuesta lista del bot, todavía sin enviar</span><p>${esc(d.respuesta_pendiente)}</p></div>` : ""}`;
  } catch (e) { cuerpo.innerHTML = `<div class="err-box" role="alert"><b>No se pudo traer el chat.</b> ${esc(e.message)}</div>`; }
}

window.Atc = {
  montar(raiz, ctx = {}) { A.raiz = raiz; A.ctx = ctx; if (!TABS.some((t) => t.id === A.tab)) A.tab = "comentarios"; todo(); },
};
})();

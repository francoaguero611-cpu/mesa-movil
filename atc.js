/* ATC — atención al cliente como CRM (03/11, antes lista por pestañas del 27/10; respaldo atc.js.bak-crm).
   Bandeja unificada estilo Chatwoot/Intercom en 3 columnas: bandejas y estados · conversaciones · chat + ficha del cliente.
   En el celular se ve una columna a la vez (bandejas arriba como chips, la lista y, al tocar, el chat con «Volver»).
   SOLO LECTURA: el cuadro de respuesta queda deshabilitado hasta conectar Chatwoot.
   app.js lo carga la primera vez que se entra y lo monta con window.Atc.montar(raiz, ctx).
   Backend: Edge Function «atc», acciones bandeja · contadores · conversacion · cliente · ofertas · detalle
   (copia en Segundo-cerebro-business/scripts/supabase/atc/index.ts). */
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
const TZ = "America/Argentina/Buenos_Aires";
const fecha = (f) => { try { return new Date(f).toLocaleString("es-AR", { timeZone: TZ, day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
const dia = (f) => { try { return new Date(f).toLocaleDateString("es-AR", { timeZone: TZ, day: "numeric", month: "numeric", year: "2-digit" }); } catch { return ""; } };
const num = (n) => Number(n ?? 0).toLocaleString("es-AR");
function hace(f) {
  const s = (Date.now() - Date.parse(f)) / 1000; if (!isFinite(s)) return "";
  if (s < 60) return "ahora"; if (s < 3600) return `${Math.floor(s / 60)} min`; if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d`; return dia(f);
}

// ---------- catálogo ----------
const ICO = {
  todos: '<path d="M4 4h16v12H4zM4 16l4 4h8l4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  comentarios: '<path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  privados: '<path d="M12 3C7 3 3 6.7 3 11.2c0 2.5 1.2 4.7 3.2 6.2V21l3-1.7c.9.3 1.8.4 2.8.4 5 0 9-3.7 9-8.3S17 3 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M7.5 13l3-3 2.5 2 3.5-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  mails: '<path d="M3 6h18v12H3z M3 7l9 6 9-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  reclamos: '<path d="M12 3l9 4-9 4-9-4zM6 9v6c0 2 3 4 6 4s6-2 6-4V9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
};
const svg = (k, t = 18) => `<svg viewBox="0 0 24 24" width="${t}" height="${t}" aria-hidden="true">${ICO[k] ?? ICO.todos}</svg>`;
const CANALES = [["todos", "Todo"], ["comentarios", "Comentarios"], ["privados", "Privados"], ["mails", "Mails"], ["reclamos", "Reclamos MP"]];
const NOMBRE_CANAL = { comentarios: "Comentario", privados: "Messenger", mails: "Mail", reclamos: "Reclamo" };
const FILTROS = [["todos", "Todos"], ["pendientes", "Pendientes"], ["bot", "Respondidos por el bot"], ["tomi", "Respondidos por Tomi"], ["ocultos", "Ocultos"], ["errores", "Errores"]];
const APLICA = { comentarios: ["todos", "pendientes", "bot", "tomi", "ocultos", "errores"], privados: ["todos", "pendientes", "bot", "tomi", "errores"], mails: ["todos", "pendientes", "bot", "tomi"], reclamos: ["todos", "pendientes", "bot", "tomi", "errores"], todos: ["todos", "pendientes", "bot", "tomi", "ocultos", "errores"] };
const ETQ = { pendiente: "Pendiente", bot: "Bot", tomi: "Tomi", oculto: "Oculto", error: "Error", reclamo: "Reclamo abierto", neutro: "Sin acción" };
const PERIODOS = [["hoy", "Hoy"], ["7d", "7 días"], ["30d", "30 días"]];

const A = {
  raiz: null, ctx: {}, canal: ls.get("atc_canal", "todos"), filtro: ls.get("atc_filtro", "pendientes"), periodo: ls.get("atc_periodo", "7d"),
  oferta: ls.get("atc_oferta", ""), ofertas: [], cont: null, mpTabla: 0, items: [], sig: null, hayMas: false, cargando: false,
  sel: null, conv: null, cli: null, buscar: "", original: false, movil: "lista", ultimo: "",
};
const qOferta = () => A.oferta ? `&oferta=${encodeURIComponent(A.oferta)}` : "";

async function api(q) {
  const r = await fetch(`${API}?${q}`, { headers: { "x-app-clave": clave() }, cache: "no-store" }).catch(() => null);
  if (!r) throw new Error("Sin conexión con el servidor");
  if (r.status === 401) { A.ctx.login?.("Volvé a entrar para ver Atención al cliente."); throw new Error("Clave incorrecta"); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `Error ${r.status}`);
  return j;
}

// ---------- columna 1: bandejas ----------
const cnt = (canal, filtro) => A.cont?.[canal]?.[filtro];
function bandejas() {
  const ofs = [["", "Todas las ofertas"]].concat(A.ofertas.map((o) => [o.oferta, o.oferta === "sin" ? "Sin oferta" : o.oferta]));
  if (A.oferta && !ofs.some(([k]) => k === A.oferta)) ofs.push([A.oferta, A.oferta]);
  return `<nav class="crm-nav" aria-label="Bandejas">
    <div class="crm-per" role="radiogroup" aria-label="Período">${PERIODOS.map(([k, t]) => `<button type="button" class="crm-per-b" role="radio" aria-checked="${A.periodo === k}" data-per="${k}">${t}</button>`).join("")}</div>
    <label class="crm-of"><span class="sr">Oferta</span><select id="crm-of">${ofs.map(([k, t]) => `<option value="${esc(k)}" ${A.oferta === k ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>
    <p class="crm-tit">Bandejas</p>
    <div class="crm-canales">${CANALES.map(([k, t]) => { const n = cnt(k, "pendientes"); return `<button type="button" class="crm-canal" data-canal="${k}" aria-pressed="${A.canal === k}">${svg(k)}<span>${t}</span>${n ? `<b class="crm-n alerta" title="Pendientes">${num(n)}</b>` : ""}</button>`; }).join("")}</div>
    <p class="crm-tit">Estado</p>
    <div class="crm-filtros">${FILTROS.filter(([k]) => APLICA[A.canal].includes(k)).map(([k, t]) => { const n = cnt(A.canal, k); return `<button type="button" class="crm-fil" data-fil="${k}" aria-pressed="${A.filtro === k}"><i class="crm-dot ${k}"></i><span>${t}</span>${n != null ? `<b class="crm-n">${num(n)}</b>` : ""}</button>`; }).join("")}</div>
    ${A.mpTabla ? `<p class="crm-nota">⚖️ La tabla marca ${num(A.mpTabla)} reclamos de MP abiertos; puede haber de más porque la función de disputas no cierra los de MP. Verificá en el panel de MP.</p>` : ""}
    <button type="button" class="btn chico crm-ref" id="crm-ref">↻ Actualizar</button>
  </nav>`;
}

// ---------- columna 2: conversaciones ----------
function fila(x) {
  const txt = x.ultimo_es || x.ultimo || "";
  const ini = (x.canal === "comentarios" ? (x.sub || "?") : (x.nombre || "?")).trim().charAt(0).toUpperCase();
  const k = `${x.canal}|${x.id}`;
  return `<button type="button" class="crm-fila ${A.sel === k ? "sel" : ""} e-${x.etq}" data-k="${esc(k)}">
    <span class="crm-av c-${x.canal}">${esc(ini)}<i>${svg(x.canal, 11)}</i></span>
    <span class="crm-fcu">
      <span class="crm-f1"><b>${esc(x.nombre)}</b><time>${esc(hace(x.fecha))}</time></span>
      <span class="crm-f2">${esc(NOMBRE_CANAL[x.canal])}${x.sub && x.canal !== "comentarios" ? ` · ${esc(x.sub)}` : ""}${x.oferta ? ` · ${esc(x.oferta)}` : ""}</span>
      <span class="crm-f3">${esc(txt.slice(0, 140))}</span>
      <span class="crm-f4"><span class="crm-etq e-${x.etq}">${esc(ETQ[x.etq] ?? x.etq)}</span><span class="crm-est">${esc(x.estado || "")}</span></span>
    </span>
  </button>`;
}
function lista() {
  const b = A.buscar.trim().toLowerCase();
  const its = b ? A.items.filter((x) => `${x.nombre} ${x.sub} ${x.ultimo} ${x.ultimo_es ?? ""} ${x.email ?? ""} ${x.oferta ?? ""}`.toLowerCase().includes(b)) : A.items;
  if (!its.length && !A.cargando) return `<p class="vacio crm-vacio">${b ? "Nada coincide con la búsqueda." : "No hay conversaciones en este filtro."}</p>`;
  return its.map(fila).join("") + (A.cargando ? `<p class="vacio"><span class="cargador"></span>Cargando…</p>` : A.hayMas && !b ? `<div class="crm-mas"><button type="button" class="btn chico" id="crm-mas">Cargar más</button></div>` : "");
}
function colLista() {
  const tit = CANALES.find(([k]) => k === A.canal)?.[1] ?? "";
  const fil = FILTROS.find(([k]) => k === A.filtro)?.[1] ?? "";
  return `<section class="crm-lista" aria-label="Conversaciones">
    <header class="crm-lh"><div><b>${esc(tit)}</b><span class="atc-mut"> · ${esc(fil)}</span></div>
      <input type="search" id="crm-bus" class="crm-bus" placeholder="Buscar nombre, mail o texto" value="${esc(A.buscar)}" aria-label="Buscar en la lista"></header>
    <div class="crm-filas" id="crm-filas">${lista()}</div>
  </section>`;
}

// ---------- columna 3: chat + ficha ----------
const QUIEN = { cliente: "Cliente", bot: "🤖 Bot", tomi: "Tomi", evento: "" };
function burbuja(m, cab) {
  if (m.de === "evento") return `<div class="crm-ev"><span>${esc(m.texto)}</span><time>${esc(fecha(m.fecha))}</time></div>`;
  const txt = !A.original && m.texto_es ? m.texto_es : m.texto;
  const nombre = m.de === "cliente" ? (m.nombre || (cab?.canal === "comentarios" ? "Cliente" : cab?.nombre) || "Cliente") : m.de === "tomi" ? (m.nombre || "Tomi") : QUIEN[m.de];
  return `<div class="crm-b ${m.de}${m.oculto ? " oculto" : ""}${m.sin_enviar ? " borrador" : ""}">
    <span class="crm-bq">${esc(nombre)}${m.oculto ? ' <em class="crm-etq e-oculto">🙈 Oculto</em>' : ""}${m.sin_enviar ? ' <em class="crm-etq e-pendiente">Sin enviar</em>' : ""}${m.resumen ? ' <em class="atc-mut">(resumen del bot)</em>' : ""}</span>
    <p>${esc(txt || "(sin texto: imagen o sticker)")}</p>
    ${m.texto_es && !A.original ? `<p class="crm-orig">${esc(m.texto)}</p>` : ""}
    <time>${esc(fecha(m.fecha))}</time>
  </div>`;
}
function ficha() {
  const c = A.cli, cab = A.conv?.cab;
  if (!A.conv) return "";
  if (!A.conv.email) return `<aside class="crm-ficha" aria-label="Cliente"><h4>Cliente</h4><p class="atc-mut">${cab?.canal === "comentarios" ? "Es un comentario público: Facebook no nos da el mail. Si el cliente lo escribe en el comentario, aparece acá." : "No tenemos el mail de este cliente todavía."}</p></aside>`;
  if (!c) return `<aside class="crm-ficha" aria-label="Cliente"><h4>Cliente</h4><p class="vacio"><span class="cargador"></span>Buscando compras…</p></aside>`;
  if (c.error) return `<aside class="crm-ficha"><h4>Cliente</h4><p class="atc-mut">${esc(c.error)}</p></aside>`;
  const tot = Object.entries(c.total_comprado ?? {}).map(([m, v]) => `${num(v)} ${m}`).join(" · ");
  const recAb = (c.reclamos ?? []).filter((r) => r.abierta);
  const otros = (c.contactos ?? []).filter((x) => !(x.canal === A.conv.canal && x.id === A.conv.id));
  return `<aside class="crm-ficha" aria-label="Cliente">
    <div class="crm-cli"><span class="crm-av grande">${esc((c.nombre || c.email).charAt(0).toUpperCase())}</span><div><b>${esc(c.nombre || c.email)}</b>${c.nombre ? `<span class="atc-mut">${esc(c.email)}</span>` : ""}</div></div>
    <div class="crm-kpis"><div><b>${num(c.compras.length)}</b><span>compras</span></div><div><b class="${recAb.length ? "malo" : ""}">${num(recAb.length)}</b><span>reclamos abiertos</span></div></div>
    ${tot ? `<p class="crm-tot">Pagó en total: <b>${esc(tot)}</b></p>` : ""}
    <h4>Compras</h4>
    ${c.compras.length ? `<ul class="crm-ul">${c.compras.map((o) => `<li><span class="crm-li1"><b>${esc(o.productos.join(" + ") || o.tienda || "Compra")}</b>${o.postcompra ? ' <em class="crm-etq e-neutro">post-compra</em>' : ""}</span><span class="atc-mut">${esc(dia(o.fecha))} · ${num(o.total)} ${esc(o.moneda ?? "")} · ${esc(o.pago ?? "")} · <span class="${o.estado === "paid" ? "ok" : "malo"}">${esc(o.estado === "paid" ? "pagada" : o.estado)}</span>${o.reembolsado ? ` · reembolsado ${num(o.reembolsado)}` : ""}${o.contracargo ? ` · contracargo ${num(o.contracargo)}` : ""}</span><span class="atc-mut">#${esc(o.orden)}${o.tienda ? ` · ${esc(o.tienda)}` : ""}</span></li>`).join("")}</ul>` : `<p class="atc-mut">No encontramos compras con este mail.</p>`}
    <h4>Reclamos</h4>
    ${(c.reclamos ?? []).length ? `<ul class="crm-ul">${c.reclamos.map((r) => `<li><button type="button" class="crm-link" data-abrir="reclamos|${esc(r.id)}"><span class="crm-etq ${r.abierta ? "e-reclamo" : "e-neutro"}">${r.abierta ? "Abierto" : "Cerrado"}</span> ${esc(r.pasarela === "mercadopago" ? "MP" : r.pasarela)} · ${num(r.monto)} ${esc(r.moneda ?? "")}${r.orden ? ` · #${esc(r.orden)}` : ""} · ${esc(dia(r.fecha))}</button></li>`).join("")}</ul>` : `<p class="atc-mut">Sin reclamos.</p>`}
    <h4>Otros contactos</h4>
    ${otros.length ? `<ul class="crm-ul">${otros.map((x) => `<li><button type="button" class="crm-link" data-abrir="${esc(x.canal)}|${esc(x.id)}">${svg(x.canal, 14)} ${esc((x.texto || "").slice(0, 70))}<span class="atc-mut"> · ${esc(x.estado || "")} · ${esc(dia(x.fecha))}</span></button></li>`).join("")}</ul>` : `<p class="atc-mut">No escribió por otro canal.</p>`}
  </aside>`;
}
function colChat() {
  if (!A.sel) return `<section class="crm-chat vacia" aria-label="Conversación"><div class="crm-nada">${svg("todos", 40)}<p>Elegí una conversación para ver qué escribió el cliente y qué hizo el bot.</p></div></section>`;
  const d = A.conv;
  if (!d) return `<section class="crm-chat" aria-label="Conversación"><p class="vacio"><span class="cargador"></span>Abriendo la conversación…</p></section>`;
  if (d.error) return `<section class="crm-chat" aria-label="Conversación"><div class="err-box" role="alert"><b>No se pudo abrir.</b> ${esc(d.error)}</div></section>`;
  const c = d.cab ?? {};
  const linkTxt = d.canal === "mails" ? "Abrir en Gmail" : d.canal === "reclamos" ? "" : "Abrir en Facebook";
  return `<section class="crm-chat" aria-label="Conversación">
    <header class="crm-ch">
      <button type="button" class="btn chico crm-volver" id="crm-volver" aria-label="Volver a la lista">←</button>
      <span class="crm-av c-${esc(d.canal)}">${esc((c.nombre || "?").charAt(0).toUpperCase())}<i>${svg(d.canal, 11)}</i></span>
      <div class="crm-chi"><b>${esc(c.nombre || "")}</b><span class="atc-mut">${esc(NOMBRE_CANAL[d.canal])}${c.sub ? ` · ${esc(c.sub)}` : ""}${c.oferta ? ` · ${esc(c.oferta)}` : ""}${c.categoria ? ` · ${esc(c.categoria)}` : ""}</span></div>
      <span class="crm-etq e-${esc(c.etq)}">${esc(c.estado || ETQ[c.etq] || "")}</span>
      <div class="crm-cha">
        ${d.traducido_de ? `<button type="button" class="btn chico" id="crm-trad">${A.original ? "Ver en español" : `Ver original (${esc(d.traducido_de)})`}</button>` : ""}
        ${d.canal === "privados" ? `<button type="button" class="btn chico" id="crm-vivo">Chat en vivo</button>` : ""}
        ${url(d.link) && linkTxt ? `<a class="btn chico" href="${esc(d.link)}" target="_blank" rel="noopener">${linkTxt}</a>` : ""}
      </div>
    </header>
    ${c.asunto ? `<p class="crm-asunto">✉️ ${esc(c.asunto)}</p>` : ""}
    ${c.aviso ? `<p class="crm-nota">${esc(c.aviso)}</p>` : ""}
    ${c.recomendacion ? `<p class="crm-nota">Sugerencia del bot de disputas: <b>${esc(c.recomendacion)}</b></p>` : ""}
    <div class="crm-hilo" id="crm-hilo">${(d.mensajes ?? []).map((m) => burbuja(m, c)).join("")}</div>
    <footer class="crm-comp"><textarea disabled rows="2" placeholder="Responder desde acá: se activa con Chatwoot"></textarea><button type="button" class="btn" disabled>Enviar</button></footer>
  </section>`;
}

// ---------- pintar ----------
function pintar() {
  const r = A.raiz; if (!r) return;
  r.innerHTML = `<div class="crm" data-movil="${A.movil}">${bandejas()}${colLista()}<div class="crm-der">${colChat()}${ficha()}</div></div>`;
  enlazar();
  const h = $("#crm-hilo", r); if (h) h.scrollTop = h.scrollHeight;
}
function pintarFilas() { const n = $("#crm-filas", A.raiz); if (n) { n.innerHTML = lista(); enlazarFilas(); } }
function pintarDer() {
  const n = $(".crm-der", A.raiz); if (!n) return;
  n.innerHTML = colChat() + ficha(); enlazarDer();
  $(".crm", A.raiz)?.setAttribute("data-movil", A.movil);
  const h = $("#crm-hilo", A.raiz); if (h) h.scrollTop = h.scrollHeight;
}
function enlazar() {
  const r = A.raiz;
  $$("[data-per]", r).forEach((b) => b.onclick = () => { A.periodo = b.dataset.per; ls.set("atc_periodo", A.periodo); todo(); });
  $("#crm-of", r).onchange = (e) => { A.oferta = e.target.value; ls.set("atc_oferta", A.oferta); todo(); };
  $$("[data-canal]", r).forEach((b) => b.onclick = () => {
    A.canal = b.dataset.canal; ls.set("atc_canal", A.canal);
    if (!APLICA[A.canal].includes(A.filtro)) { A.filtro = "todos"; ls.set("atc_filtro", A.filtro); }
    A.movil = "lista"; pintar(); cargarLista();
  });
  $$("[data-fil]", r).forEach((b) => b.onclick = () => { A.filtro = b.dataset.fil; ls.set("atc_filtro", A.filtro); A.movil = "lista"; pintar(); cargarLista(); });
  $("#crm-ref", r).onclick = () => todo();
  const bus = $("#crm-bus", r); if (bus) bus.oninput = () => { A.buscar = bus.value; pintarFilas(); };
  enlazarFilas(); enlazarDer();
}
function enlazarFilas() {
  const r = A.raiz;
  $$("[data-k]", r).forEach((b) => b.onclick = () => abrir(b.dataset.k));
  const m = $("#crm-mas", r); if (m) m.onclick = () => cargarLista(true);
}
function enlazarDer() {
  const r = A.raiz;
  const on = (sel, f) => { const b = $(sel, r); if (b) b.onclick = f; };
  on("#crm-volver", () => { A.movil = "lista"; $(".crm", r)?.setAttribute("data-movil", "lista"); });
  on("#crm-trad", () => { A.original = !A.original; pintarDer(); });
  on("#crm-vivo", () => verChat(A.conv.id));
  $$("[data-abrir]", r).forEach((b) => b.onclick = () => abrir(b.dataset.abrir));
}

// ---------- datos ----------
async function cargarContadores() {
  try {
    const [c, of] = await Promise.all([api(`accion=contadores&periodo=${A.periodo}${qOferta()}`), api(`accion=ofertas&periodo=${A.periodo}`).catch(() => null)]);
    A.cont = c.contadores; A.mpTabla = c.mp_abiertos_tabla ?? 0; if (of) A.ofertas = of.ofertas ?? [];
  } catch (e) { A.ctx.toast?.(`No se pudieron contar los casos: ${e.message}`, "error"); }
  const nav = $(".crm-nav", A.raiz);
  if (nav) { nav.outerHTML = bandejas(); enlazar(); }
}
async function cargarLista(mas = false) {
  if (!mas) { A.items = []; A.sig = null; }
  A.cargando = true; pintarFilas();
  const pedido = `${A.canal}|${A.filtro}|${A.periodo}|${A.oferta}|${mas ? A.sig : ""}`; A.ultimo = pedido;
  try {
    const j = await api(`accion=bandeja&canal=${A.canal}&filtro=${A.filtro}&periodo=${A.periodo}${qOferta()}${mas && A.sig ? `&antes=${encodeURIComponent(A.sig)}` : ""}`);
    if (A.ultimo !== pedido) return;
    const ya = new Set(A.items.map((x) => `${x.canal}|${x.id}`));
    A.items = A.items.concat((j.items ?? []).filter((x) => !ya.has(`${x.canal}|${x.id}`))); A.sig = j.siguiente; A.hayMas = !!j.hay_mas;
  } catch (e) { if (A.ultimo === pedido) A.ctx.toast?.(`No se pudo cargar la bandeja: ${e.message}`, "error"); }
  if (A.ultimo === pedido) {
    A.cargando = false; pintarFilas();
    // en la compu, si no hay nada abierto, abre la primera
    if (!A.sel && A.items.length && matchMedia("(min-width: 900px)").matches) abrir(`${A.items[0].canal}|${A.items[0].id}`, true);
  }
}
async function abrir(k, sinMovil = false) {
  const i = k.indexOf("|"); const canal = k.slice(0, i), id = k.slice(i + 1);
  A.sel = k; A.conv = null; A.cli = null; A.original = false; if (!sinMovil) A.movil = "chat";
  $$(".crm-fila", A.raiz).forEach((b) => b.classList.toggle("sel", b.dataset.k === k));
  pintarDer();
  try { A.conv = await api(`accion=conversacion&canal=${canal}&id=${encodeURIComponent(id)}`); }
  catch (e) { A.conv = { error: e.message }; }
  if (A.sel !== k) return;
  pintarDer();
  if (A.conv?.email) {
    try { A.cli = await api(`accion=cliente&email=${encodeURIComponent(A.conv.email)}`); } catch (e) { A.cli = { error: e.message }; }
    if (A.sel === k) pintarDer();
  }
}
function todo() { A.cont = null; A.sel = null; A.conv = null; A.cli = null; A.movil = "lista"; pintar(); cargarContadores(); cargarLista(); }

// ---------- chat completo de Messenger (en vivo) ----------
async function verChat(id) {
  const fondo = document.createElement("div");
  fondo.className = "atc-modal-fondo";
  fondo.innerHTML = `<div class="atc-modal" role="dialog" aria-modal="true" aria-label="Conversación"><header><b>Chat en vivo de Messenger</b><button type="button" class="btn chico" data-cerrar>Cerrar</button></header><div class="atc-modal-cuerpo"><p class="vacio"><span class="cargador"></span>Trayendo el chat de Facebook…</p></div></div>`;
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
  montar(raiz, ctx = {}) {
    A.raiz = raiz; A.ctx = ctx;
    if (!CANALES.some(([k]) => k === A.canal)) A.canal = "todos";
    if (!APLICA[A.canal].includes(A.filtro)) A.filtro = "todos";
    todo();
  },
};
})();

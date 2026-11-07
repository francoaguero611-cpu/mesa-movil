/* ATC — atención al cliente por PASOS (07/11, Lorenzo: «4 secciones en la misma pantalla quedan estrechas; que se vaya abriendo:
   primero los chats que hay, tocás uno y entrás a pantalla completa; que podamos responder desde acá»).
     1) Inicio: 4 tarjetas grandes (Privados · Comentarios · Mails · Reclamos MP) con pendientes y respondidos.
     2) Lista del canal a todo el ancho (filtros y buscador).
     3) Chat a pantalla completa (la ficha del cliente al costado solo si hay lugar). Messenger se responde desde acá.
     4) Reclamos MP: retenido (amarillo) · recuperado (verde) · perdido (rojo), por día/3 días/calendario, y la lista.
   Respaldo de la versión de 3 columnas: atc.js.bak-0711. Backend: Edge Function «atc» (bandeja · contadores · conversacion ·
   cliente · ofertas · reclamos_resumen · responder [POST, Messenger] · bots). */
"use strict";
(() => {
const API = "https://tppcpnfzcxxusdhrlmdx.supabase.co/functions/v1/atc";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ls = { get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const url = (u) => /^https?:\/\//i.test(String(u || "")) ? String(u) : "";
const clave = () => ls.get("dash_clave", "");
const TZ = "America/Argentina/Buenos_Aires";
const fecha = (f) => { try { return new Date(f).toLocaleString("es-AR", { timeZone: TZ, day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
const dia = (f) => { try { return new Date(f).toLocaleDateString("es-AR", { timeZone: TZ, day: "numeric", month: "numeric", year: "2-digit" }); } catch { return ""; } };
const num = (n) => Number(n ?? 0).toLocaleString("es-AR");
const pesos = (n) => "$ " + Math.round(Number(n ?? 0)).toLocaleString("es-AR");
const isoAR = (ms = Date.now()) => new Date(ms - 3 * 3600e3).toISOString().slice(0, 10);
const sumar = (d, n) => new Date(Date.parse(d + "T12:00:00Z") + n * 86400e3).toISOString().slice(0, 10);
function hace(f) { const s = (Date.now() - Date.parse(f)) / 1000; if (!isFinite(s)) return ""; if (s < 60) return "ahora"; if (s < 3600) return `${Math.floor(s / 60)} min`; if (s < 86400) return `${Math.floor(s / 3600)} h`; if (s < 7 * 86400) return `${Math.floor(s / 86400)} d`; return dia(f); }

const ICO = {
  comentarios: '<path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  privados: '<path d="M12 3C7 3 3 6.7 3 11.2c0 2.5 1.2 4.7 3.2 6.2V21l3-1.7c.9.3 1.8.4 2.8.4 5 0 9-3.7 9-8.3S17 3 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M7.5 13l3-3 2.5 2 3.5-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  mails: '<path d="M3 6h18v12H3z M3 7l9 6 9-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  reclamos: '<path d="M12 3l9 4-9 4-9-4zM6 9v6c0 2 3 4 6 4s6-2 6-4V9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
};
const svg = (k, t = 18) => `<svg viewBox="0 0 24 24" width="${t}" height="${t}" aria-hidden="true">${ICO[k] ?? ICO.comentarios}</svg>`;
const CANALES = [["privados", "Privados", "Mensajes de Messenger de las páginas"], ["comentarios", "Comentarios", "Comentarios en los anuncios"], ["mails", "Mails", "soporte@ de las tiendas"], ["reclamos", "Reclamos MP", "Reclamos de Mercado Pago"]];
const NOMBRE = Object.fromEntries(CANALES.map(([k, t]) => [k, t]));
const FILTROS = { privados: [["pendientes", "Pendientes"], ["bot", "Bot"], ["tomi", "Respondidos por nosotros"], ["todos", "Todos"], ["errores", "Errores"]], comentarios: [["pendientes", "Pendientes"], ["bot", "Bot"], ["tomi", "Nosotros"], ["ocultos", "Ocultos"], ["todos", "Todos"]], mails: [["pendientes", "Pendientes"], ["bot", "Bot"], ["tomi", "Nosotros"], ["todos", "Todos"]] };
const ETQ = { pendiente: "Pendiente", bot: "Bot", tomi: "Respondido", oculto: "Oculto", error: "Error", reclamo: "Reclamo abierto", neutro: "Sin acción" };
const PERIODOS = [["hoy", "Hoy"], ["7d", "7 días"], ["30d", "30 días"]];
const GRUPO = { abierto: ["En curso", "am"], favor: ["A favor", "ve"], contra: ["En contra", "ro"], sin_dato: ["Sin resultado", "gr"] };

const A = { raiz: null, ctx: {}, vista: "inicio", canal: "privados", filtro: "pendientes", periodo: ls.get("atc_periodo", "7d"), oferta: ls.get("atc_oferta", ""), ofertas: [],
  cont: null, bots: null, items: [], sig: null, hayMas: false, cargando: false, buscar: "", sel: null, conv: null, cli: null, verCli: false, original: false, ultimo: "",
  rec: null, recPer: ls.get("atc_rec_per", "3d"), recDesde: "", recHasta: "", recFil: "todos", enviando: false };
const qOferta = () => A.oferta ? `&oferta=${encodeURIComponent(A.oferta)}` : "";

async function api(q, body) {
  const r = await fetch(`${API}?${q}`, body ? { method: "POST", headers: { "x-app-clave": clave(), "content-type": "application/json" }, body: JSON.stringify(body) } : { headers: { "x-app-clave": clave() }, cache: "no-store" }).catch(() => null);
  if (!r) throw new Error("Sin conexión con el servidor");
  if (r.status === 401) { A.ctx.login?.("Volvé a entrar para ver Atención al cliente."); throw new Error("Clave incorrecta"); }
  const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || `Error ${r.status}`); return j;
}

// ---------- barra de arriba (migas + volver) ----------
function barra() {
  const migas = [`<button type="button" class="ac-miga" data-ir="inicio">Atención al cliente</button>`];
  if (A.vista !== "inicio") migas.push(`<button type="button" class="ac-miga" data-ir="${A.canal === "reclamos" ? "reclamos" : "lista"}">${esc(NOMBRE[A.canal])}</button>`);
  if (A.vista === "chat") migas.push(`<span class="ac-miga act">${esc(A.conv?.cab?.nombre || "Conversación")}</span>`);
  const filtrosArriba = A.vista === "inicio" || A.vista === "lista";
  const ofs = [["", "Todas las ofertas"]].concat(A.ofertas.map((o) => [o.oferta, o.oferta === "sin" ? "Sin oferta" : o.oferta]));
  return `<div class="ac-barra">${A.vista !== "inicio" ? `<button type="button" class="ac-volver" data-volver aria-label="Volver">←</button>` : ""}
    <nav class="ac-migas" aria-label="Dónde estás">${migas.join('<span class="ac-sep">/</span>')}</nav>
    ${filtrosArriba ? `<div class="ac-der"><div class="ac-seg" role="group" aria-label="Período">${PERIODOS.map(([k, t]) => `<button type="button" data-per="${k}" aria-pressed="${A.periodo === k}">${t}</button>`).join("")}</div>
      <select class="ac-sel" id="ac-of" aria-label="Oferta">${ofs.map(([k, t]) => `<option value="${esc(k)}" ${A.oferta === k ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
      <button type="button" class="ac-ic" data-ref title="Actualizar" aria-label="Actualizar">↻</button></div>` : ""}</div>`;
}

// ---------- 1) inicio: 4 tarjetas ----------
const c = (canal, f) => A.cont?.[canal]?.[f];
function inicio() {
  const r = A.rec;
  const nota = A.bots?.dm_modo === "borrador" ? `<p class="ac-aviso">💬 <b>El bot de privados está en modo borrador:</b> lee cada mensaje y prepara la respuesta, pero <b>no la manda sola</b>. Entrá al chat, tocá «Usar la respuesta del bot» (o escribí la tuya) y «Enviar».</p>`
    : A.bots?.dm_modo === "activo" ? `<p class="ac-aviso ok">💬 El bot de privados responde solo (modo activo).</p>` : "";
  return `${nota}<div class="ac-cards">${CANALES.map(([k, t, sub]) => {
    if (k === "reclamos") return `<button type="button" class="ac-card c-reclamos" data-canal="reclamos"><span class="ac-ci">${svg(k, 26)}</span><b>${t}</b><small>${sub}</small>
      <span class="ac-mini3"><span class="am"><i>Retenido</i><b>${r ? pesos(r.abiertos.monto) : "…"}</b></span><span class="ve"><i>Recuperado</i><b>${r ? pesos(r.a_favor.monto) : "…"}</b></span><span class="ro"><i>Perdido</i><b>${r ? pesos(r.en_contra.monto) : "…"}</b></span></span>
      <span class="ac-pie">${r ? `${num(r.abiertos.n)} en curso · ${num(r.respondidos)} de ${num(r.total)} respondidos` : "Cargando…"}</span></button>`;
    const pend = c(k, "pendientes"), bot = c(k, "bot"), tomi = c(k, "tomi"), tot = c(k, "todos");
    return `<button type="button" class="ac-card c-${k}" data-canal="${k}"><span class="ac-ci">${svg(k, 26)}</span><b>${t}</b><small>${sub}</small>
      <span class="ac-big ${pend ? "alerta" : ""}">${A.cont ? num(pend ?? 0) : "…"}<i>pendiente${pend === 1 ? "" : "s"}</i></span>
      <span class="ac-pie">${A.cont ? `${num(tot ?? 0)} en total · ${num(bot ?? 0)} el bot · ${num(tomi ?? 0)} nosotros` : "Cargando…"}</span></button>`;
  }).join("")}</div>`;
}

// ---------- 2) lista del canal ----------
function fila(x) {
  const txt = x.ultimo_es || x.ultimo || "", ini = (x.canal === "comentarios" ? (x.sub || "?") : (x.nombre || "?")).trim().charAt(0).toUpperCase();
  return `<button type="button" class="ac-fila e-${x.etq}" data-k="${esc(`${x.canal}|${x.id}`)}">
    <span class="ac-av c-${x.canal}">${esc(ini)}</span>
    <span class="ac-fc"><span class="ac-f1"><b>${esc(x.nombre)}</b><time>${esc(hace(x.fecha))}</time></span>
      <span class="ac-f2">${x.sub && x.canal !== "comentarios" ? esc(x.sub) : ""}${x.oferta ? `${x.sub && x.canal !== "comentarios" ? " · " : ""}${esc(x.oferta)}` : ""}</span>
      <span class="ac-f3">${esc(txt.slice(0, 220))}</span></span>
    <span class="ac-etq e-${x.etq}">${esc(ETQ[x.etq] ?? x.etq)}</span></button>`;
}
function lista() {
  const b = A.buscar.trim().toLowerCase();
  const its = b ? A.items.filter((x) => `${x.nombre} ${x.sub} ${x.ultimo} ${x.ultimo_es ?? ""} ${x.email ?? ""} ${x.oferta ?? ""}`.toLowerCase().includes(b)) : A.items;
  const filas = !its.length && !A.cargando ? `<p class="ac-vacio">${b ? "Nada coincide con la búsqueda." : "No hay conversaciones acá."}</p>` : its.map(fila).join("") + (A.cargando ? `<p class="ac-vacio"><span class="cargador"></span>Cargando…</p>` : A.hayMas && !b ? `<button type="button" class="ac-mas" id="ac-mas">Cargar más</button>` : "");
  return `<div class="ac-lt"><div class="ac-seg" role="group" aria-label="Estado">${(FILTROS[A.canal] || []).map(([k, t]) => { const n = c(A.canal, k); return `<button type="button" data-fil="${k}" aria-pressed="${A.filtro === k}">${t}${n != null ? ` <i>${num(n)}</i>` : ""}</button>`; }).join("")}</div>
    <input type="search" class="ac-bus" id="ac-bus" placeholder="Buscar nombre, mail o texto" value="${esc(A.buscar)}" aria-label="Buscar"></div>
    <div class="ac-filas" id="ac-filas">${filas}</div>`;
}

// ---------- 3) chat a pantalla completa ----------
const QUIEN = { cliente: "Cliente", bot: "🤖 Bot", tomi: "Nosotros", evento: "" };
function burbuja(m, cab) {
  if (m.de === "evento") return `<div class="ac-ev"><span>${esc(m.texto)}</span><time>${esc(fecha(m.fecha))}</time></div>`;
  const txt = !A.original && m.texto_es ? m.texto_es : m.texto;
  const nombre = m.de === "cliente" ? (m.nombre || (cab?.canal === "comentarios" ? "Cliente" : cab?.nombre) || "Cliente") : m.de === "tomi" ? (m.nombre || "Nosotros") : QUIEN[m.de];
  return `<div class="ac-b ${m.de}${m.oculto ? " oculto" : ""}${m.sin_enviar ? " borrador" : ""}">
    <span class="ac-bq">${esc(nombre)}${m.sin_enviar ? ' <em class="ac-etq e-pendiente">Sin enviar</em>' : ""}${m.oculto ? ' <em class="ac-etq e-oculto">Oculto</em>' : ""}</span>
    <p>${esc(txt || "(sin texto: imagen o sticker)")}</p>${m.texto_es && !A.original ? `<p class="ac-orig">${esc(m.texto)}</p>` : ""}<time>${esc(fecha(m.fecha))}</time></div>`;
}
function ficha() {
  const cl = A.cli, cab = A.conv?.cab;
  if (!A.conv) return "";
  if (!A.conv.email) return `<aside class="ac-ficha"><h4>Cliente</h4><p class="ac-mut">${cab?.canal === "comentarios" ? "Es un comentario público: Facebook no nos da el mail." : "Todavía no tenemos el mail de este cliente."}</p></aside>`;
  if (!cl) return `<aside class="ac-ficha"><h4>Cliente</h4><p class="ac-vacio"><span class="cargador"></span>Buscando compras…</p></aside>`;
  if (cl.error) return `<aside class="ac-ficha"><h4>Cliente</h4><p class="ac-mut">${esc(cl.error)}</p></aside>`;
  const tot = Object.entries(cl.total_comprado ?? {}).map(([m, v]) => `${num(v)} ${m}`).join(" · "), recAb = (cl.reclamos ?? []).filter((r) => r.abierta);
  return `<aside class="ac-ficha"><div class="ac-cli"><span class="ac-av grande">${esc((cl.nombre || cl.email).charAt(0).toUpperCase())}</span><div><b>${esc(cl.nombre || cl.email)}</b>${cl.nombre ? `<span class="ac-mut">${esc(cl.email)}</span>` : ""}</div></div>
    <div class="ac-kpis"><div><b>${num(cl.compras.length)}</b><span>compras</span></div><div><b class="${recAb.length ? "malo" : ""}">${num(recAb.length)}</b><span>reclamos abiertos</span></div></div>
    ${tot ? `<p class="ac-mut">Pagó en total: <b>${esc(tot)}</b></p>` : ""}
    <h4>Compras</h4>${cl.compras.length ? `<ul class="ac-ul">${cl.compras.map((o) => `<li><b>${esc(o.productos.join(" + ") || o.tienda || "Compra")}</b><span class="ac-mut">${esc(dia(o.fecha))} · ${num(o.total)} ${esc(o.moneda ?? "")} · ${esc(o.pago ?? "")} · ${esc(o.estado === "paid" ? "pagada" : o.estado)}${o.reembolsado ? ` · reembolsado ${num(o.reembolsado)}` : ""}</span><span class="ac-mut">#${esc(o.orden)}</span></li>`).join("")}</ul>` : `<p class="ac-mut">No encontramos compras con este mail.</p>`}
    ${(cl.reclamos ?? []).length ? `<h4>Reclamos</h4><ul class="ac-ul">${cl.reclamos.map((r) => `<li><span class="ac-etq ${r.abierta ? "e-reclamo" : "e-neutro"}">${r.abierta ? "Abierto" : "Cerrado"}</span> ${num(r.monto)} ${esc(r.moneda ?? "")} · ${esc(dia(r.fecha))}</li>`).join("")}</ul>` : ""}</aside>`;
}
function chat() {
  const d = A.conv;
  if (!d) return `<p class="ac-vacio"><span class="cargador"></span>Abriendo la conversación…</p>`;
  if (d.error) return `<div class="err-box" role="alert"><b>No se pudo abrir.</b> ${esc(d.error)}</div>`;
  const cab = d.cab ?? {}, linkTxt = d.canal === "mails" ? "Abrir en Gmail" : d.canal === "reclamos" ? "" : "Abrir en Facebook";
  const borrador = [...(d.mensajes ?? [])].reverse().find((m) => m.sin_enviar && m.de === "bot");
  const puede = d.canal === "privados";
  return `<div class="ac-chat ${A.verCli ? "con-cli" : ""}"><section class="ac-hilo-caja">
    <header class="ac-ch"><span class="ac-av c-${esc(d.canal)}">${esc((cab.nombre || "?").charAt(0).toUpperCase())}</span>
      <div class="ac-chi"><b>${esc(cab.nombre || "")}</b><span class="ac-mut">${esc(NOMBRE[d.canal] || "")}${cab.sub ? ` · ${esc(cab.sub)}` : ""}${cab.oferta ? ` · ${esc(cab.oferta)}` : ""}</span></div>
      <span class="ac-etq e-${esc(cab.etq)}">${esc(cab.estado || ETQ[cab.etq] || "")}</span>
      <div class="ac-cha">${d.traducido_de ? `<button type="button" class="ac-b2" id="ac-trad">${A.original ? "Ver en español" : `Ver original (${esc(d.traducido_de)})`}</button>` : ""}
        <button type="button" class="ac-b2 ac-solo-chico" id="ac-cli">${A.verCli ? "Ocultar cliente" : "Ver cliente"}</button>
        ${url(d.link) && linkTxt ? `<a class="ac-b2" href="${esc(d.link)}" target="_blank" rel="noopener">${linkTxt}</a>` : ""}</div></header>
    ${cab.asunto ? `<p class="ac-asunto">✉️ ${esc(cab.asunto)}</p>` : ""}${cab.recomendacion ? `<p class="ac-aviso">Sugerencia del bot de disputas: <b>${esc(cab.recomendacion)}</b></p>` : ""}
    <div class="ac-hilo" id="ac-hilo">${(d.mensajes ?? []).map((m) => burbuja(m, cab)).join("")}</div>
    <footer class="ac-comp">${puede ? `${borrador ? `<button type="button" class="ac-usar" id="ac-usar">↳ Usar la respuesta del bot</button>` : ""}
      <div class="ac-comp-f"><textarea id="ac-txt" rows="2" placeholder="Escribí la respuesta…" maxlength="1990"></textarea><button type="button" class="ac-env" id="ac-env" ${A.enviando ? "disabled" : ""}>${A.enviando ? "Enviando…" : "Enviar"}</button></div>
      <p class="ac-mut ac-nota">Sale por Messenger desde la página, como respuesta de una persona.</p>`
      : `<p class="ac-mut ac-nota">${d.canal === "mails" ? "Para responder un mail, abrilo en Gmail (botón de arriba)." : d.canal === "comentarios" ? "Para responder un comentario, abrilo en Facebook (botón de arriba)." : "Los reclamos de Mercado Pago los responde el bot de disputas."}</p>`}</footer>
  </section>${ficha()}</div>`;
}

// ---------- 4) reclamos MP ----------
function rangoRec() {
  const h = isoAR();
  if (A.recPer === "hoy") return [h, h];
  if (A.recPer === "3d") return [sumar(h, -2), h];
  if (A.recPer === "7d") return [sumar(h, -6), h];
  if (A.recPer === "30d") return [sumar(h, -29), h];
  if (A.recPer === "fechas") return [A.recDesde || sumar(h, -6), A.recHasta || h];
  return ["", ""];
}
function reclamos() {
  const r = A.rec, [d, h] = rangoRec();
  const head = `<div class="ac-rec-f"><div class="ac-seg" role="group" aria-label="Período">${[["hoy", "Hoy"], ["3d", "3 días"], ["7d", "7 días"], ["30d", "30 días"], ["todo", "Todo"]].map(([k, t]) => `<button type="button" data-rper="${k}" aria-pressed="${A.recPer === k}">${t}</button>`).join("")}</div>
    <label class="ac-fechas ${A.recPer === "fechas" ? "on" : ""}">📅 <input type="date" id="ac-rd" value="${esc(A.recPer === "fechas" ? d : "")}" max="${isoAR()}" aria-label="Desde"> → <input type="date" id="ac-rh" value="${esc(A.recPer === "fechas" ? h : "")}" max="${isoAR()}" aria-label="Hasta"></label></div>`;
  if (!r) return head + `<p class="ac-vacio"><span class="cargador"></span>Cargando reclamos…</p>`;
  if (r.error) return head + `<div class="err-box"><b>No se pudo cargar.</b> ${esc(r.error)}</div>`;
  const items = A.recFil === "todos" ? r.items : r.items.filter((x) => x.grupo === A.recFil);
  return `${head}
    <div class="ac-kpi3">
      <div class="k am"><i>Retenido · en curso</i><b>${pesos(r.abiertos.monto)}</b><small>${num(r.abiertos.n)} reclamo${r.abiertos.n === 1 ? "" : "s"} sin cerrar</small></div>
      <div class="k ve"><i>Recuperado · a favor</i><b>${pesos(r.a_favor.monto)}</b><small>${num(r.a_favor.n)} cerrados a nuestro favor</small></div>
      <div class="k ro"><i>Perdido · en contra</i><b>${r.en_contra.monto ? "−" : ""}${pesos(r.en_contra.monto)}</b><small>${num(r.en_contra.n)} perdidos</small></div>
    </div>
    <div class="ac-stats"><span><b>${num(r.total)}</b> reclamos</span><span><b>${num(r.respondidos)}</b> respondidos</span><span><b>${num(r.a_favor.n)}</b> a favor</span><span><b>${num(r.en_contra.n)}</b> en contra</span>${r.sin_dato.n ? `<span class="ac-mut"><b>${num(r.sin_dato.n)}</b> sin resultado guardado</span>` : ""}</div>
    <div class="ac-seg ac-recfil" role="group" aria-label="Mostrar">${[["todos", "Todos"], ["abierto", "En curso"], ["favor", "A favor"], ["contra", "En contra"]].map(([k, t]) => `<button type="button" data-rfil="${k}" aria-pressed="${A.recFil === k}">${t}</button>`).join("")}</div>
    <div class="ac-filas">${items.length ? items.map((x) => { const [gt, gc] = GRUPO[x.grupo]; return `<button type="button" class="ac-fila rec" data-k="${esc(`reclamos|${x.id}`)}"><span class="ac-dot ${gc}"></span>
      <span class="ac-fc"><span class="ac-f1"><b>${esc(x.oferta || "Reclamo")}${x.orden ? ` · #${esc(x.orden)}` : ""}</b><time>${esc(dia(x.creada))}</time></span>
        <span class="ac-f3">${esc(x.motivo || x.tipo || "")}${x.respondido ? " · respondido" : " · sin responder"}</span></span>
      <span class="ac-monto ${gc}">${x.grupo === "contra" ? "−" : ""}${pesos(x.monto)}</span><span class="ac-etq g-${gc}">${gt}</span></button>`; }).join("") : `<p class="ac-vacio">No hay reclamos en este período.</p>`}</div>
    <p class="ac-mut ac-nota">Los días cuentan desde que se abrió cada reclamo. «A favor» suma los ganados y los que el comprador canceló: es plata que se quedó.</p>`;
}

// ---------- pintar y enlazar ----------
function pintar() {
  const r = A.raiz; if (!r) return;
  const cuerpo = A.vista === "inicio" ? inicio() : A.vista === "lista" ? lista() : A.vista === "chat" ? chat() : reclamos();
  r.innerHTML = `<div class="ac v-${A.vista}">${barra()}<div class="ac-cuerpo">${cuerpo}</div></div>`;
  enlazar();
  const h = $("#ac-hilo", r); if (h) h.scrollTop = h.scrollHeight;
}
function pintarFilas() { const n = $("#ac-filas", A.raiz); if (!n || A.vista !== "lista") return; const t = document.createElement("div"); t.innerHTML = lista(); n.replaceWith($("#ac-filas", t)); enlazarFilas(); }
function ir(v) { A.vista = v; window.scrollTo({ top: 0 }); pintar(); }
function enlazar() {
  const r = A.raiz;
  $$("[data-ir]", r).forEach((b) => b.onclick = () => { const v = b.dataset.ir; if (v === "inicio") { ir("inicio"); cargarInicio(); } else if (v === "lista") { ir("lista"); } else ir("reclamos"); });
  $$("[data-volver]", r).forEach((b) => b.onclick = () => { if (A.vista === "chat") ir(A.canal === "reclamos" ? "reclamos" : "lista"); else { ir("inicio"); cargarInicio(); } });
  $$("[data-per]", r).forEach((b) => b.onclick = () => { A.periodo = b.dataset.per; ls.set("atc_periodo", A.periodo); if (A.vista === "lista") { pintar(); cargarLista(); } cargarCont(); });
  const of = $("#ac-of", r); if (of) of.onchange = () => { A.oferta = of.value; ls.set("atc_oferta", A.oferta); if (A.vista === "lista") cargarLista(); cargarCont(); };
  $$("[data-ref]", r).forEach((b) => b.onclick = () => { if (A.vista === "lista") cargarLista(); cargarInicio(); });
  $$("[data-canal]", r).forEach((b) => b.onclick = () => { A.canal = b.dataset.canal; if (A.canal === "reclamos") { ir("reclamos"); cargarRec(); return; } A.filtro = "pendientes"; A.buscar = ""; ir("lista"); cargarLista(); });
  $$("[data-fil]", r).forEach((b) => b.onclick = () => { A.filtro = b.dataset.fil; pintar(); cargarLista(); });
  const bus = $("#ac-bus", r); if (bus) bus.oninput = () => { A.buscar = bus.value; pintarFilas(); };
  $$("[data-rper]", r).forEach((b) => b.onclick = () => { A.recPer = b.dataset.rper; ls.set("atc_rec_per", A.recPer); cargarRec(); });
  const rd = $("#ac-rd", r), rh = $("#ac-rh", r);
  const cambiaF = () => { if (!rd.value && !rh.value) return; A.recPer = "fechas"; A.recDesde = rd.value || rh.value; A.recHasta = rh.value || rd.value; cargarRec(); };
  if (rd) rd.onchange = cambiaF; if (rh) rh.onchange = cambiaF;
  $$("[data-rfil]", r).forEach((b) => b.onclick = () => { A.recFil = b.dataset.rfil; pintar(); });
  const on = (sel, f) => { const b = $(sel, r); if (b) b.onclick = f; };
  on("#ac-trad", () => { A.original = !A.original; pintar(); });
  on("#ac-cli", () => { A.verCli = !A.verCli; pintar(); });
  on("#ac-usar", () => { const m = [...(A.conv?.mensajes ?? [])].reverse().find((x) => x.sin_enviar && x.de === "bot"); const t = $("#ac-txt", r); if (m && t) { t.value = m.texto; t.focus(); } });
  on("#ac-env", enviar);
  const txt = $("#ac-txt", r); if (txt) txt.onkeydown = (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) enviar(); };
  enlazarFilas();
}
function enlazarFilas() { const r = A.raiz; $$("[data-k]", r).forEach((b) => b.onclick = () => abrir(b.dataset.k)); const m = $("#ac-mas", r); if (m) m.onclick = () => cargarLista(true); }

// ---------- datos ----------
async function cargarCont() {
  try { const [cn, of] = await Promise.all([api(`accion=contadores&periodo=${A.periodo}${qOferta()}`), api(`accion=ofertas&periodo=${A.periodo}`).catch(() => null)]); A.cont = cn.contadores; if (of) A.ofertas = of.ofertas ?? []; }
  catch (e) { A.ctx.toast?.(`No se pudieron contar los casos: ${e.message}`, "error"); }
  if (A.vista === "inicio" || A.vista === "lista") pintar();
}
async function cargarInicio() {
  cargarCont();
  api("accion=bots").then((b) => { A.bots = b; if (A.vista === "inicio") pintar(); }).catch(() => {});
  if (!A.rec || A.rec.error) cargarRec(true);
}
async function cargarRec(silencio = false) {
  if (!silencio) { A.rec = null; pintar(); }
  const [d, h] = rangoRec();
  try { A.rec = await api(`accion=reclamos_resumen${d ? `&desde=${d}` : ""}${h ? `&hasta=${h}` : ""}`); } catch (e) { A.rec = { error: e.message }; }
  if (A.vista === "reclamos" || A.vista === "inicio") pintar();
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
  } catch (e) { if (A.ultimo === pedido) A.ctx.toast?.(`No se pudo cargar: ${e.message}`, "error"); }
  if (A.ultimo === pedido) { A.cargando = false; pintarFilas(); }
}
async function abrir(k) {
  const i = k.indexOf("|"), canal = k.slice(0, i), id = k.slice(i + 1);
  A.sel = k; A.conv = null; A.cli = null; A.original = false; A.verCli = false; ir("chat");
  try { A.conv = await api(`accion=conversacion&canal=${canal}&id=${encodeURIComponent(id)}`); } catch (e) { A.conv = { error: e.message }; }
  if (A.sel !== k) return; pintar();
  if (A.conv?.email) { try { A.cli = await api(`accion=cliente&email=${encodeURIComponent(A.conv.email)}`); } catch (e) { A.cli = { error: e.message }; } if (A.sel === k) pintar(); }
}
async function enviar() {
  const t = $("#ac-txt", A.raiz), texto = (t?.value || "").trim(); if (!texto || A.enviando || !A.conv) return;
  A.enviando = true; const b = $("#ac-env", A.raiz); if (b) { b.disabled = true; b.textContent = "Enviando…"; }
  try {
    await api("accion=responder", { canal: "privados", id: A.conv.id, texto });
    A.ctx.toast?.("✓ Mensaje enviado por Messenger.", "ok");
    const k = A.sel; A.enviando = false; await abrir(k); cargarCont();
  } catch (e) { A.enviando = false; A.ctx.toast?.(`No se pudo enviar: ${e.message}`, "error", 9000); if (b) { b.disabled = false; b.textContent = "Enviar"; } }
}

window.Atc = { montar(raiz, ctx = {}) { A.raiz = raiz; A.ctx = ctx; A.vista = "inicio"; pintar(); cargarInicio(); } };
})();

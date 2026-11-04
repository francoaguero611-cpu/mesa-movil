/* Jarvis (03/11, Lorenzo): el asistente personal ADENTRO del Dashboard. Botón redondo abajo a la derecha → chat a la derecha
   (en el celular, pantalla completa). Ahí:
   · llegan los avisos (los mismos de Telegram, guardados en jarvis_feed) hablados como un amigo, con métricas y botones;
   · cuando hay algo nuevo el círculo gira en rojo y suena; si es urgente (cobro, pago rechazado, bot caído) el chat se abre solo;
   · se le pregunta cualquier cosa (asistente-wa ?accion=app_chat: Claude con lectura de todo) y contesta con botones;
   · (03/11 noche) el «antes y después» de una campaña es una TARJETA dentro del chat: tabla deslizable (3 h / 12 h / 24 h / días),
     lo de hoy y los botones para surfear ahí mismo (−30 %, +30 % u otro % o monto), siempre con «¿Sí, hacelo?»;
   · cada mensaje se puede responder (flechita arriba a la derecha o deslizándolo, como WhatsApp) para hablar de ESE mensaje.
   Se dibuja por partes (cada mensaje una vez; la tarjeta actualiza solo lo que cambia) para que las animaciones no se repitan.
   Avisos: asistente ?accion=inicio cada 60 s. La charla vive en este navegador (localStorage, por usuario). */
"use strict";
(() => {
const BASE = "https://tppcpnfzcxxusdhrlmdx.supabase.co/functions/v1/";
const DASH = "https://francoaguero611-cpu.github.io/mesa-movil/";
const $ = (s, r = document) => r.querySelector(s);
const ls = { get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const NF0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }), NF2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const movil = () => matchMedia("(max-width: 720px)").matches;
const quieto = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const uid = () => Math.random().toString(36).slice(2, 10);
const J = { ctx: {}, msgs: [], abierto: false, pensando: false, timer: null, ultFeed: 0, primera: true, cita: null };
const K = () => `jv_chat_${J.ctx.usuario?.() || "x"}`;
const porU = (u) => J.msgs.find((m) => m.u === u);
const tocado = (m) => { m.v = (m.v || 0) + 1; };

// ícono propio: un núcleo con dos órbitas (nada de estrellitas)
const ICONO = `<svg viewBox="0 0 32 32" aria-hidden="true">
  <ellipse cx="16" cy="16" rx="13" ry="5.2" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".9" transform="rotate(-28 16 16)"/>
  <ellipse cx="16" cy="16" rx="13" ry="5.2" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".55" transform="rotate(32 16 16)"/>
  <circle cx="16" cy="16" r="5.6" fill="#3d9dff"/><circle cx="16" cy="16" r="4" fill="#7cc8ff"/><circle cx="14.6" cy="14.4" r="1.6" fill="#eaf8ff"/></svg>`;
const FLECHA_RESP = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M10 6 L4 12 L10 18 M4.5 12 H14 C 17.5 12, 20 14.5, 20 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const FLECHA_VOLVER = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M14.5 5.5 L8 12 L14.5 18.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CHECK = `<svg class="jv-check" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 12.5 L10.5 16 L17 9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// ---------- red ----------
async function pedir(url, body) {
  const r = await fetch(url, { method: body ? "POST" : "GET", headers: { "x-app-clave": J.ctx.clave?.() || "", "x-app-usuario": J.ctx.usuario?.() || "", ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" }).catch(() => null);
  if (!r) throw new Error("sin conexión");
  const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || `error ${r.status}`); return j;
}

// ---------- memoria de la charla ----------
function cargarMsgs() {
  try { J.msgs = JSON.parse(ls.get(K(), "[]")) || []; } catch { J.msgs = []; }
  for (const m of J.msgs) m.u ||= uid();
  J.ultFeed = Math.max(0, ...J.msgs.map((m) => (m.feed && m.feed < 1e12 ? m.feed : 0)));
}
function guardar() { J.msgs = J.msgs.slice(-150); ls.set(K(), JSON.stringify(J.msgs)); }
const sinLeer = () => J.msgs.filter((m) => m.rol === "aviso" && !m.leido);
function marcarVisto() { let n = 0; for (const m of J.msgs) if (m.rol === "aviso" && !m.leido) { m.leido = true; n++; } if (n) { guardar(); pintar(); } pintarFab(); }
function agregar(m) { m.u ||= uid(); m.t ||= new Date().toISOString(); J.msgs.push(m); return m; }

// ---------- avisos ----------
async function traerAvisos() {
  if (J.ctx.demo) { if (J.primera) demo(); J.primera = false; return; }
  let d; try { d = await pedir(BASE + "asistente?accion=inicio"); } catch { return; }
  const nuevos = [];
  const feed = (d.feed || []).slice().sort((a, b) => a.id - b.id);
  for (const x of feed.filter((x) => x.id > J.ultFeed && (J.ultFeed || Date.now() - Date.parse(x.t) < 12 * 3600e3))) {
    const acc = x.acciones?.length ? x.acciones : (x.botones || []).map((b) => ({ tipo: "url", titulo: b.titulo, url: b.url }));
    nuevos.push({ u: uid(), rol: "aviso", texto: x.texto, acciones: acc, t: x.t, feed: x.id, urgente: !!x.urgente });
  }
  if (feed.length) J.ultFeed = Math.max(J.ultFeed, ...feed.map((x) => x.id));
  // estado en vivo que pide acción ya (lo deja la revisión de cada 15 min); cada cosa una vez cada 6 h
  const v = d.vivo || {};
  for (const b of v.bots || []) vivoNuevo(nuevos, `bot:${b.bot}`, `🚨 Che, *se paró ${b.bot}*. ${b.detalle}. Pedime que lo revise y lo levanto.`);
  for (const p of v.pagos || []) vivoNuevo(nuevos, `pago:${p.act}`, `💳 Bro, *Meta rechazó el pago de ${p.nombre}*. Debe ${p.moneda} ${NF0.format(p.deuda || 0)}: pagalo ya así no se frenan los anuncios.`, p.link ? [{ tipo: "url", titulo: "💳 Pagar", url: p.link }] : []);
  const primera = J.primera; J.primera = false;
  if (!nuevos.length) { pintar(); return; }
  const charlaVacia = !J.msgs.length;
  J.msgs.push(...nuevos); guardar();
  if (primera && charlaVacia) { marcarVisto(); pintar(); return; } // la primera vez no hace sonar lo viejo
  if (J.abierto) { marcarVisto(); pintar(); abajo(); sonar(nuevos.some((x) => x.urgente)); return; }
  pintar(); sonar(nuevos.some((x) => x.urgente));
  if (nuevos.some((x) => x.urgente)) abrir(); // urgente: se abre solo
}
function vivoNuevo(lista, clave, texto, acciones = []) {
  const k = "jv_vivo_" + clave; if (Date.now() - Number(ls.get(k, "0")) < 6 * 3600e3) return;
  ls.set(k, String(Date.now()));
  lista.push({ u: uid(), rol: "aviso", texto, acciones, t: new Date().toISOString(), urgente: true });
}

// ---------- sonido (WebAudio, sin archivos) ----------
let actx = null;
const desbloquear = () => { try { actx ??= new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch {} };
addEventListener("pointerdown", desbloquear, { once: true, capture: true });
function sonar(urgente) {
  try {
    desbloquear(); if (!actx || actx.state !== "running") return;
    const notas = urgente ? [880, 660, 880] : [740, 988];
    notas.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime + i * 0.13;
      o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
      o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + 0.34);
    });
  } catch {}
}

// ---------- texto ----------
function md(t) {
  const lineas = String(t || "").split("\n").filter((l) => !/^\s*👉\s*https?:\/\/\S+\s*$/.test(l));
  return esc(lineas.join("\n").trim()).replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>").replace(/\*([^*\n]+)\*/g, "<b>$1</b>")
    .replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u.length > 42 ? u.slice(0, 40) + "…" : u}</a>`).replace(/\n/g, "<br>");
}
const plano = (t, n = 90) => { const x = String(t || "").replace(/\*+/g, "").replace(/\s+/g, " ").trim(); return x.length > n ? x.slice(0, n - 1) + "…" : x; };
function hora(iso) {
  const d = new Date(Date.parse(iso) - 3 * 3600e3).toISOString(), hoy = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  return (d.slice(0, 10) === hoy ? "" : `${d.slice(8, 10)}/${d.slice(5, 7)} `) + d.slice(11, 16);
}
function hace(iso) { const m = (Date.now() - Date.parse(iso)) / 60e3; return m < 60 ? `hace ${Math.max(1, Math.round(m))} min` : m < 36 * 60 ? `hace ${Math.round(m / 60)} h` : `el ${hora(iso)}`; }
// número que sube/baja animado hasta su valor
function contar(el, de, a, fmt, ms = 650) {
  if (!el) return;
  if (quieto() || de === a || !Number.isFinite(de)) { el.textContent = fmt(a); return; }
  const t0 = performance.now(), ease = (x) => 1 - Math.pow(1 - x, 3);
  const paso = (t) => { const p = Math.min(1, (t - t0) / ms); el.textContent = fmt(de + (a - de) * ease(p)); if (p < 1) requestAnimationFrame(paso); };
  requestAnimationFrame(paso);
}

// ---------- armado del panel ----------
function montarUI() {
  if ($("#jv-fab")) return;
  const fab = document.createElement("button");
  fab.id = "jv-fab"; fab.type = "button"; fab.className = "jv-fab"; fab.setAttribute("aria-label", "Abrir Jarvis");
  fab.innerHTML = `<span class="jv-anillo" aria-hidden="true"></span><span class="jv-orbe">${ICONO}</span><span class="jv-badge" hidden></span>`;
  fab.onclick = () => (J.abierto ? cerrar() : abrir());
  const p = document.createElement("aside");
  p.id = "jv-panel"; p.className = "jv-panel"; p.hidden = true; p.setAttribute("aria-label", "Jarvis");
  p.innerHTML = `<header class="jv-cab"><span class="jv-orbe chico">${ICONO}</span><div><b>Jarvis</b><small id="jv-estado">tu asistente · en línea</small></div>
      <button type="button" class="jv-x" id="jv-cerrar" aria-label="Cerrar">✕</button></header>
    <div class="jv-msgs" id="jv-msgs" role="log" aria-live="polite"></div>
    <div class="jv-rapidas" id="jv-rapidas"></div>
    <div class="jv-cita" id="jv-cita" hidden><span class="jv-cita-ico">${FLECHA_RESP}</span><div><small>Respondiendo a Jarvis</small><p id="jv-cita-t"></p></div><button type="button" id="jv-cita-x" aria-label="Cancelar respuesta">✕</button></div>
    <form class="jv-form" id="jv-form" autocomplete="off"><textarea id="jv-in" rows="1" placeholder="Preguntale lo que quieras…" enterkeyhint="send"></textarea>
      <button type="submit" class="jv-enviar" aria-label="Enviar"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 12 L20 4 L13 20 L11 13 Z" fill="currentColor"/></svg></button></form>`;
  document.body.append(p, fab);
  $("#jv-cerrar").onclick = cerrar;
  $("#jv-cita-x").onclick = () => soltarCita();
  const ta = $("#jv-in");
  ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; });
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !movil()) { e.preventDefault(); $("#jv-form").requestSubmit(); } });
  $("#jv-form").addEventListener("submit", (e) => { e.preventDefault(); const t = ta.value.trim(); if (!t || J.pensando) return; ta.value = ""; ta.style.height = "auto"; preguntar(t); });
  const box = $("#jv-msgs");
  box.addEventListener("click", tocar);
  deslizarParaResponder(box);
  $("#jv-rapidas").addEventListener("click", (e) => { const b = e.target.closest("[data-q]"); if (b) preguntar(b.dataset.q); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && J.abierto && !document.querySelector(".ev-fondo, .modal-fondo, #pop-hist")) { if (J.cita) soltarCita(); else cerrar(); } });
}
function pintarFab() {
  const fab = $("#jv-fab"); if (!fab) return;
  const n = J.abierto ? 0 : sinLeer().length;
  fab.classList.toggle("alerta", n > 0);
  const b = $(".jv-badge", fab); b.hidden = !n; b.textContent = n > 9 ? "9+" : String(n);
  fab.setAttribute("aria-label", n ? `Jarvis: ${n} aviso${n > 1 ? "s" : ""} nuevo${n > 1 ? "s" : ""}` : "Abrir Jarvis");
}
const RAPIDAS = ["¿Cómo venimos hoy?", "¿Qué campaña surfeo?", "Mostrame el antes y después de lo que surfeé", "¿Cuánta plata hay en Whop?", "¿Cuáles son los winners?"];
const claseMsg = (m) => m.rol === "user" ? "jv-m yo" : m.rol === "card" ? "jv-m card" : `jv-m el${m.rol === "aviso" ? " aviso" : ""}${m.urgente ? " urgente" : ""}${m.rol === "aviso" && !m.leido ? " nuevo" : ""}${m.abierta && m.card ? " expandida" : ""}`;
const ocultarAcc = (a) => /#(workspace|taller)/.test(a.url || "") || a.sec === "workspace";
function htmlMsg(m) {
  if (m.rol === "user") return `${m.cita ? `<button type="button" class="jv-citado" data-ir="${esc(m.citaU || "")}"><small>Jarvis</small>${esc(m.cita)}</button>` : ""}<p>${esc(m.texto)}</p>`;
  // (03/11, Lorenzo) «Ver antes y después» se abre ADENTRO de la misma burbuja; la flechita de arriba a la izquierda la vuelve a cerrar
  if (m.abierta && m.card) return `<button type="button" class="jv-volver" data-volver="${m.u}" aria-label="Volver al mensaje">${FLECHA_VOLVER}</button><p class="jv-orig">${md(m.texto)}</p><div class="jv-card-host"></div>`;
  const acc = (m.acciones || []).map((a, k) => ocultarAcc(a) || a.tipo === "mostrar_campana" ? "" : `<button type="button" class="jv-b${a.tipo === "nada" || a.tipo === "cancelar" ? " suave" : ""}${a.tipo === "confirmar" ? " fuerte" : ""}" data-mu="${m.u}" data-a="${k}" ${m.usado ? "disabled" : ""}>${esc(a.titulo)}</button>`).join("");
  return `<button type="button" class="jv-resp" data-resp="${m.u}" aria-label="Responder a este mensaje">${FLECHA_RESP}</button>
    <p>${md(m.texto)}</p>${acc ? `<div class="jv-acc">${acc}</div>` : ""}<time>${m.t ? hora(m.t) : ""}</time>`;
}
// Dibuja solo lo nuevo o lo que cambió (cada mensaje tiene su u y su versión v)
function pintar() {
  pintarFab();
  const box = $("#jv-msgs"); if (!box) return;
  if (!J.msgs.length) {
    box.innerHTML = `<div class="jv-hola"><span class="jv-orbe grande">${ICONO}</span><p><b>Hola${J.ctx.nombre?.() ? ", " + esc(J.ctx.nombre()) : ""}.</b> Acá te aviso todo lo que pasa y me podés pedir lo que quieras: cómo viene una campaña, el antes y después, surfearla, abrir el Drive de las renos…</p></div>`;
  } else {
    $(".jv-hola", box)?.remove();
    const vivos = new Set(); let pens = $(":scope > .pensando", box);
    for (const m of J.msgs) {
      vivos.add(m.u);
      let el = box.querySelector(`:scope > [data-u="${m.u}"]`);
      if (!el) {
        el = document.createElement("div"); el.dataset.u = m.u; el.className = claseMsg(m);
        if (m.rol === "card") montarCard(el, m); else { el.innerHTML = htmlMsg(m); el.dataset.v = String(m.v || 0); montarHost(el, m); }
        box.insertBefore(el, pens);
      } else {
        const cl = claseMsg(m) + (el.classList.contains("destello") ? " destello" : "");
        if (el.className !== cl) el.className = cl;
        if (m.rol !== "card" && el.dataset.v !== String(m.v || 0)) {
          const h0 = el.offsetHeight, w0 = el.offsetWidth;
          el.innerHTML = htmlMsg(m); el.dataset.v = String(m.v || 0); montarHost(el, m);
          if (!quieto() && h0) { const h1 = el.offsetHeight, w1 = el.offsetWidth; el.animate([{ height: h0 + "px", width: w0 + "px" }, { height: h1 + "px", width: w1 + "px" }], { duration: 380, easing: "cubic-bezier(.22,1,.36,1)" }); }
        }
      }
    }
    for (const el of [...box.querySelectorAll(":scope > [data-u]")]) if (!vivos.has(el.dataset.u)) el.remove();
    if (J.pensando && !pens) { pens = document.createElement("div"); pens.className = "jv-m el pensando"; pens.setAttribute("aria-label", "Jarvis está escribiendo"); pens.innerHTML = "<span></span><span></span><span></span>"; box.append(pens); }
    if (!J.pensando && pens) pens.remove();
  }
  const rp = $("#jv-rapidas"); if (rp) rp.innerHTML = J.pensando ? "" : RAPIDAS.map((q) => `<button type="button" data-q="${esc(q)}">${esc(q)}</button>`).join("");
}
function montarHost(el, m) { const h = m.abierta && m.card ? $(".jv-card-host", el) : null; if (h) montarCard(h, m.card); }
// abre la tarjeta en la burbuja de ese mensaje (si ya está abierta con la misma campaña, no la duplica)
function expandir(m, id, extra = {}) {
  if (m.abierta && m.card?.id === String(id) && !extra.pre) { irAMensaje(m.u); return; }
  m.card = { u: m.u, id: String(id), nombre: extra.nombre || m.card?.nombre || "", ...(m.card?.id === String(id) && m.card?.aplicado ? { aplicado: m.card.aplicado } : {}), ...(extra.pre ? { pre: extra.pre } : {}) };
  m.abierta = true; tocado(m); guardar(); pintar();
  requestAnimationFrame(() => $(`#jv-msgs > [data-u="${m.u}"]`)?.scrollIntoView({ block: "nearest", behavior: quieto() ? "auto" : "smooth" }));
}
function abajo() { const b = $("#jv-msgs"); if (b) requestAnimationFrame(() => b.scrollTo({ top: b.scrollHeight, behavior: quieto() ? "auto" : "smooth" })); }

// ---------- abrir / cerrar ----------
function abrir() {
  montarUI(); const p = $("#jv-panel");
  J.abierto = true; p.hidden = false; document.documentElement.classList.add("jv-abierto");
  requestAnimationFrame(() => p.classList.add("visible"));
  pintar(); const b = $("#jv-msgs"); if (b) b.scrollTop = b.scrollHeight;
  setTimeout(marcarVisto, 500);
  if (!movil()) setTimeout(() => $("#jv-in")?.focus({ preventScroll: true }), 250);
}
function cerrar() {
  const p = $("#jv-panel"); if (!p) return;
  J.abierto = false; p.classList.remove("visible"); document.documentElement.classList.remove("jv-abierto");
  setTimeout(() => { if (!J.abierto) p.hidden = true; }, 300);
  marcarVisto(); pintarFab();
}

// ---------- responder a un mensaje (como WhatsApp) ----------
function citar(m) {
  if (!m) return;
  const id = m.rol === "card" ? m.id : (m.acciones || []).find((a) => a.id)?.id;
  const texto = m.rol === "card" ? `Antes y después de ${m.nombre || "la campaña"}` : plano(m.texto);
  J.cita = { u: m.u, texto, id: id ? String(id) : null };
  const bar = $("#jv-cita"); $("#jv-cita-t").textContent = texto; bar.hidden = false;
  requestAnimationFrame(() => bar.classList.add("visible"));
  try { navigator.vibrate?.(8); } catch {}
  $("#jv-in")?.focus({ preventScroll: true });
}
function soltarCita() {
  J.cita = null; const bar = $("#jv-cita"); if (!bar) return;
  bar.classList.remove("visible"); setTimeout(() => { if (!J.cita) bar.hidden = true; }, 220);
}
function irAMensaje(u) {
  const el = $(`#jv-msgs > [data-u="${u}"]`); if (!el) return;
  el.scrollIntoView({ block: "center", behavior: quieto() ? "auto" : "smooth" });
  el.classList.remove("destello"); void el.offsetWidth; el.classList.add("destello");
  setTimeout(() => el.classList.remove("destello"), 1400);
}
// deslizar un mensaje de Jarvis a la derecha = responderle (solo con el dedo)
function deslizarParaResponder(box) {
  let el = null, x0 = 0, y0 = 0, dx = 0, activo = false;
  box.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch") return;
    const m = e.target.closest("#jv-msgs > .jv-m.el:not(.pensando)"); if (!m || e.target.closest("button, a, input, .jv-tabla-w")) return;
    el = m; x0 = e.clientX; y0 = e.clientY; dx = 0; activo = false;
  });
  box.addEventListener("pointermove", (e) => {
    if (!el) return;
    const ddx = e.clientX - x0, ddy = e.clientY - y0;
    if (!activo) { if (Math.abs(ddy) > 10 && Math.abs(ddy) > Math.abs(ddx)) { el = null; return; } if (ddx > 10) { activo = true; el.classList.add("arrastrando"); } else return; }
    dx = Math.max(0, Math.min(90, ddx * 0.7));
    el.style.transform = `translateX(${dx}px)`; el.style.setProperty("--resp", Math.min(1, dx / 56));
  });
  const fin = () => {
    if (!el) return;
    const m = porU(el.dataset.u), ok = activo && dx > 52;
    el.classList.remove("arrastrando"); el.style.transform = ""; el.style.removeProperty("--resp");
    el = null; if (ok) citar(m);
  };
  box.addEventListener("pointerup", fin); box.addEventListener("pointercancel", fin);
}

// ---------- charla con Claude ----------
async function preguntar(t) {
  const cita = J.cita; soltarCita();
  agregar({ rol: "user", texto: t, cita: cita?.texto, citaU: cita?.u, citaId: cita?.id }); guardar();
  J.pensando = true; pintar(); abajo();
  const hist = J.msgs.slice(-14).map((m) => ({
    rol: m.rol === "user" ? "user" : "assistant",
    texto: m.rol === "card" ? `[Te mostré la tarjeta del antes y después de la campaña ${m.nombre || ""} (id ${m.id})]`
      : m.rol === "user" && m.cita ? `(Respondiendo a: «${m.cita}»${m.citaId ? ` [campaña id ${m.citaId}]` : ""}) ${m.texto}` : m.texto,
  }));
  let r;
  try { r = J.ctx.demo ? await demoResp(t) : await pedir(BASE + "asistente-wa?accion=app_chat", { mensajes: hist }); }
  catch (e) { r = { texto: `Uh, no te pude contestar (${e.message}). Probá de nuevo en un toque.`, acciones: [] }; }
  J.pensando = false;
  const acc = r.acciones || [];
  const mm = agregar({ rol: "assistant", texto: r.texto || "Listo.", acciones: acc });
  const ms = acc.filter((a) => a.tipo === "mostrar_campana" && a.id).slice(0, 3);
  if (ms[0]) { mm.card = { u: mm.u, id: String(ms[0].id), nombre: ms[0].nombre || "" }; mm.abierta = true; }
  for (const a of ms.slice(1)) agregar({ rol: "card", id: String(a.id), nombre: a.nombre || "" });
  guardar(); pintar(); abajo();
}
function decir(texto, acciones = []) { agregar({ rol: "assistant", texto, acciones }); guardar(); pintar(); abajo(); }
function tarjeta(id, extra = {}) { agregar({ rol: "card", id: String(id), ...extra }); guardar(); pintar(); abajo(); }

// ---------- botones de los mensajes ----------
const mon = (c) => (c?.moneda && String(c.moneda).toUpperCase() !== "USD" ? String(c.moneda).toUpperCase() + " " : "US$ ");
async function tocar(e) {
  const r = e.target.closest("[data-resp]"); if (r) { citar(porU(r.dataset.resp)); return; }
  const ci = e.target.closest("[data-ir]"); if (ci) { irAMensaje(ci.dataset.ir); return; }
  const vo = e.target.closest("[data-volver]"); if (vo) { const m = porU(vo.dataset.volver); if (m) { m.abierta = false; tocado(m); guardar(); pintar(); } return; }
  const b = e.target.closest("button[data-a]"); if (!b) return;
  const m = porU(b.dataset.mu), a = m?.acciones?.[Number(b.dataset.a)]; if (!a) return;
  if (a.tipo === "ver_campana" || a.tipo === "mostrar_campana") { expandir(m, a.id, { nombre: a.nombre || "" }); return; }
  if (a.tipo === "ver_campanas") { for (const id of (a.ids || []).slice(0, 4)) agregar({ rol: "card", id: String(id) }); guardar(); pintar(); abajo(); return; }
  if (a.tipo === "seccion") { if (movil()) cerrar(); J.ctx.seccion?.(a.sec); return; }
  if (a.tipo === "url") {
    const u = String(a.url || "");
    if (u.startsWith("#") || u.startsWith(DASH)) { if (movil()) cerrar(); const h = u.startsWith("#") ? u : u.slice(DASH.length); location.hash = h && h !== "#" ? h : "#dash"; return; }
    window.open(u, "_blank", "noopener"); return;
  }
  if (a.tipo === "nada") { m.usado = true; tocado(m); agregar({ rol: "user", texto: a.titulo }); decir("Dale, la dejo así 👌 Si cambia algo te aviso."); return; }
  if (a.tipo === "cancelar") { m.usado = true; tocado(m); decir("Listo, no toco nada."); return; }
  // cambiar presupuesto: se abre la tarjeta con el antes y después y la confirmación ya armada
  if (a.tipo === "presupuesto") { expandir(m, a.id, { nombre: a.nombre || "", pre: { pct: a.pct ?? null, monto: a.monto ?? null } }); return; }
  if (a.tipo === "confirmar") { // mensajes viejos (antes de la tarjeta)
    m.usado = true; tocado(m); tarjeta(a.id, { nombre: a.nombre || "", pre: { monto: a.monto } });
  }
}

// =====================================================================================================================
// ---------- tarjeta «antes y después» dentro del chat ----------
const VER = { ok: ["Viene bien", "v"], rindio: ["Rindió", "v"], mejoro: ["Mejoró", "v"], bajo: ["Aflojó", "r"], techo: ["Techo", "r"], sigue_mal: ["Sigue mal", "r"], pocos: ["Pocos datos", "g"], empate: ["Igual", "g"] };

async function montarCard(el, m) {
  el.innerHTML = `<div class="jv-card-in cargando"><div class="jv-sk w60"></div><div class="jv-sk w40"></div><div class="jv-sk alto"></div><div class="jv-sk w80"></div></div>`;
  const st = { m, c: null, surf: null, tab: null, modo: null, unidad: ls.get("jv_unidad", "%"), pend: null };
  el._st = st;
  if (J.ctx.demo && m.id === "demo") { st.c = DEMO_C; st.surf = DEMO_S; }
  else {
    const [c, s] = await Promise.all([
      J.ctx.campana?.(m.id).catch(() => null),
      pedir(BASE + `reportes?accion=surfeos_campana&id=${encodeURIComponent(m.id)}`).catch(() => null),
    ]);
    st.c = c; st.surf = s?.surfeos?.[0] || null;
  }
  if (st.c?.nombre && !m.nombre) { m.nombre = st.c.nombre; guardar(); }
  // vino de «Surfearla +30 %» o «Volverla a US$ X»: arranca con la confirmación armada
  if (m.pre && !m.aplicado && st.c?.presupuesto) { st.pend = calcular(st, m.pre.pct != null ? { pct: m.pre.pct } : { monto: m.pre.monto }); st.modo = st.pend ? "confirmar" : null; }
  dibujarCard(el, st);
}
function presActual(st) { return Number(st.m.aplicado?.despues ?? st.c?.presupuesto ?? 0); }
function calcular(st, { pct, monto }) {
  const antes = presActual(st); if (!antes) return null;
  const nuevo = monto != null ? Math.round(Number(monto)) : Math.round(antes * (1 + Number(pct) / 100));
  if (!(nuevo > 0) || nuevo === antes) return null;
  return { antes, nuevo, pct: Math.round(((nuevo - antes) / antes) * 100) };
}
function dibujarCard(el, st) {
  const { m, c, surf } = st;
  if (!c && !surf) { el.innerHTML = `<div class="jv-card-in"><p class="jv-card-vacia">No encuentro esa campaña en el Dashboard de hoy (¿está apagada?).</p></div>`; return; }
  const nombre = c?.nombre || m.nombre || "Campaña", M = mon(c), w3 = surf?.ventanas?.["3h"], vv = VER[w3?.ver];
  const dirTxt = surf ? `${surf.a > surf.de ? "Subida" : "Bajada"} ${hace(surf.t)}: ${M}${NF0.format(surf.de)} → ${M}${NF0.format(surf.a)} (${surf.a > surf.de ? "+" : "−"}${Math.abs(Math.round(((surf.a - surf.de) / surf.de) * 100))} %)` : "No la surfeaste en los últimos 8 días";
  el.innerHTML = `<div class="jv-card-in entra">
    <header class="jv-card-cab">
      <div class="jv-card-tit"><b title="${esc(nombre)}">${esc(nombre)}</b><small>${esc(dirTxt)}</small></div>
      <button type="button" class="jv-resp" data-resp="${m.u}" aria-label="Responder sobre esta campaña">${FLECHA_RESP}</button>
    </header>
    <div class="jv-card-pres"><span>Presupuesto</span><b class="jv-pres-n">${presActual(st) ? M + NF0.format(presActual(st)) : "ABO"}</b>${vv ? `<em class="jv-ver ${vv[1]}">${vv[0]}</em>` : ""}</div>
    ${surf?.dias?.length || st.m.aplicado ? `<div class="jv-tabla-w"><div class="jv-tabla-cont"></div></div>` : ""}
    ${w3 ? `<div class="jv-3h"><span>A las 3 h</span><i>ROAS <b>${NF2.format(w3.antes?.roas ?? 0)}</b> → <b class="${(w3.despues?.roas ?? 0) >= (w3.antes?.roas ?? 0) ? "v" : "r"}">${NF2.format(w3.despues?.roas ?? 0)}</b></i><i>Ventas <b>${NF0.format(w3.antes?.v ?? 0)}</b> → <b class="${(w3.despues?.v ?? 0) >= (w3.antes?.v ?? 0) ? "v" : "r"}">${NF0.format(w3.despues?.v ?? 0)}</b></i>${w3.final ? "" : "<em>corriendo</em>"}</div>` : ""}
    ${c ? `<div class="jv-hoy"><span>Hoy</span><i>Gasto <b>US$ ${NF0.format(c.gasto || 0)}</b></i><i>Ventas <b>${NF0.format(c.ventas || 0)}</b></i><i>ROAS <b class="${(c.roas || 0) >= 1.5 ? "v" : (c.roas || 0) >= 1.22 ? "a" : "r"}">${NF2.format(c.roas || 0)}</b></i><i>Ganancia <b class="${(c.ganancia || 0) >= 0 ? "v" : "r"}">${(c.ganancia || 0) < 0 ? "−" : "+"}US$ ${NF0.format(Math.abs(c.ganancia || 0))}</b></i></div>` : ""}
    <div class="jv-ctrl"></div>
  </div>`;
  el.onclick = (e) => accionCard(e, el, st);
  el.oninput = (e) => { if (e.target.matches(".jv-otro-in")) previa(el, st); };
  el.onkeydown = (e) => { if (e.key === "Enter" && e.target.matches(".jv-otro-in")) { e.preventDefault(); $(".jv-ctrl [data-k=aplicar]", el)?.click(); } };
  dibujarTabla(el, st, false);
  dibujarCtrl(el, st, false);
  // números de la tabla y el presupuesto suben animados la primera vez
  requestAnimationFrame(() => {
    el.querySelectorAll("[data-n]").forEach((x) => contar(x, 0, Number(x.dataset.n), FMT[x.dataset.f]));
    if (J.msgs[J.msgs.length - 1]?.u === m.u) abajo(); // ya armada y es lo último: que se vea entera
  });
}
const FMT = { roas: (n) => NF2.format(n), v: (n) => NF0.format(n), g: (n) => "US$ " + NF0.format(n), gan: (n) => (n < 0 ? "−" : "+") + "US$ " + NF0.format(Math.abs(n)), gan_h: (n) => (n < 0 ? "−" : "+") + "US$ " + NF0.format(Math.abs(n)) };
// (03/11, Lorenzo) como el relojito del Dashboard: el momento del cambio, el cierre de cada día y, al final, «Ahora».
// Sin 12 h / 24 h / 48 h. Si el cambio se hizo recién desde acá y el bot todavía no lo vio, va como última fila.
function dibujarTabla(el, st, animar = true) {
  const cont = $(".jv-tabla-cont", el); if (!cont) return;
  const { surf, m } = st, M = mon(st.c), dias = surf?.dias || [];
  const dm = (d) => d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "";
  const ahora = new Date(Date.now() - 3 * 3600e3).toISOString().slice(11, 16);
  const fila = (i, mom, dia, d, p, cls = "") => `<tr class="${cls}" style="--i:${i}"><th><b>${esc(mom)}</b><small>${esc(dia)}</small></th><td>${p != null ? M + NF0.format(p) : "—"}</td>
    <td data-n="${d.g || 0}" data-f="g">${FMT.g(d.g || 0)}</td><td data-n="${d.v || 0}" data-f="v">${NF0.format(d.v || 0)}</td>
    <td class="${(d.roas || 0) >= 1.5 ? "v" : (d.roas || 0) >= 1.22 ? "a" : "r"}" data-n="${d.roas || 0}" data-f="roas">${NF2.format(d.roas || 0)}</td>
    <td class="${(d.gan || 0) >= 0 ? "v" : "r"}" data-n="${d.gan || 0}" data-f="gan">${FMT.gan(d.gan || 0)}</td></tr>`;
  const filas = [];
  if (dias.length) {
    const sube = surf.a > surf.de;
    filas.push(fila(0, `${sube ? "↑ Surfeo" : "↓ Tirón"} ${dias[0].hora ?? hora(surf.t).slice(-5)}`, dm(dias[0].dia), dias[0], surf.de, sube ? "sube" : "baja"));
    dias.slice(1).forEach((d, k) => filas.push(fila(k + 1, d.final ? "Cierre" : `Ahora ${ahora}`, dm(d.dia), d, d.p, d.final ? "" : "ahora")));
  }
  const ap = m.aplicado;
  if (ap && (!surf || Date.parse(ap.t) > Date.parse(surf.t) + 40 * 60e3)) // el cambio de recién (todavía no lo levantó el bot)
    filas.push(`<tr class="${ap.despues > ap.antes ? "sube" : "baja"} recien" style="--i:${filas.length}"><th><b>${ap.despues > ap.antes ? "↑ Surfeo" : "↓ Tirón"} ${hora(ap.t).slice(-5)}</b><small>recién, desde Jarvis</small></th><td colspan="5">${M}${NF0.format(ap.antes)} → <b>${M}${NF0.format(ap.despues)}</b> · en 3 h te digo cómo viene</td></tr>`);
  const html = filas.length ? `<table class="jv-tabla"><thead><tr><th>Momento</th><th>Presup.</th><th>Gasto</th><th>Ventas</th><th>ROAS</th><th>Ganancia</th></tr></thead><tbody>${filas.join("")}</tbody></table>`
    : `<p class="jv-tabla-nota">Todavía no hay cierres desde el cambio.</p>`;
  if (!animar || quieto()) { cont.innerHTML = html; return; }
  cont.classList.add("sale");
  setTimeout(() => { cont.innerHTML = html; cont.classList.remove("sale"); cont.classList.add("llega"); setTimeout(() => cont.classList.remove("llega"), 400); }, 140);
}
function dibujarCtrl(el, st, animar = true) {
  const box = $(".jv-ctrl", el); if (!box) return;
  const M = mon(st.c), act = presActual(st);
  let html = "";
  if (!st.c) html = `<p class="jv-ctrl-nota">No la encuentro prendida hoy: no puedo cambiarle el presupuesto desde acá.</p>`;
  else if (!act) html = `<p class="jv-ctrl-nota">Es ABO: el presupuesto está en los conjuntos. Cambialo desde la tabla.</p><div class="jv-ctrl-fila"><button type="button" class="jv-b" data-k="tabla">📊 Abrir en la tabla</button></div>`;
  else if (st.modo === "otro") {
    html = `<div class="jv-otro"><div class="jv-seg" role="radiogroup"><button type="button" data-k="unidad" data-u="%" aria-pressed="${st.unidad === "%"}">%</button><button type="button" data-k="unidad" data-u="$" aria-pressed="${st.unidad === "$"}">${M.trim()}</button></div>
      <input class="jv-otro-in" type="number" inputmode="decimal" step="any" placeholder="${st.unidad === "%" ? "ej. 20 o -15" : "ej. " + NF0.format(Math.round(act * 1.2))}" aria-label="${st.unidad === "%" ? "Porcentaje" : "Monto nuevo"}">
      <p class="jv-previa" aria-live="polite">Hoy está en ${M}${NF0.format(act)}</p></div>
      <div class="jv-ctrl-fila"><button type="button" class="jv-b fuerte" data-k="aplicar" disabled>Aplicar</button><button type="button" class="jv-b suave" data-k="volver">Cancelar</button></div>`;
  } else if (st.modo === "confirmar" && st.pend) {
    const p = st.pend, mucho = p.pct > 30;
    html = `<div class="jv-confirma${mucho ? " ojo" : ""}"><p>¿Paso el presupuesto de <b>${M}${NF0.format(p.antes)}</b> a <b>${M}${NF0.format(p.nuevo)}</b> <span>(${p.pct > 0 ? "+" : ""}${p.pct} %)</span>?</p>
      ${mucho ? `<p class="jv-ojo">Ojo: es más de +30 % de una. El método dice máximo +30 % por vez.</p>` : ""}
      <div class="jv-ctrl-fila"><button type="button" class="jv-b fuerte" data-k="si">✅ Sí, hacelo</button><button type="button" class="jv-b suave" data-k="volver">No</button></div></div>`;
  } else if (st.modo === "trabajando") html = `<div class="jv-trabajando"><span class="jv-spin"></span>Cambiándolo en Meta…</div>`;
  else if (st.modo === "hecho") html = `<div class="jv-hecho-ok">${CHECK}<p><b>Listo, hermano.</b> Quedó en ${M}${NF0.format(act)}. En 3 h te digo cómo viene.</p></div><div class="jv-ctrl-fila"><button type="button" class="jv-b fuerte" data-k="ver">📊 Ver campaña</button><button type="button" class="jv-b suave" data-k="volver">Cambiar de nuevo</button></div>`;
  else if (st.modo === "error") html = `<p class="jv-ctrl-nota r">No pude cambiarlo: ${esc(st.err || "Meta no respondió")}.</p><div class="jv-ctrl-fila"><button type="button" class="jv-b" data-k="si">Reintentar</button><button type="button" class="jv-b suave" data-k="volver">Cancelar</button></div>`;
  else html = `${st.m.aplicado ? `<p class="jv-ctrl-nota v">✓ La cambiaste ${hace(st.m.aplicado.t)}: ${M}${NF0.format(st.m.aplicado.antes)} → ${M}${NF0.format(st.m.aplicado.despues)}</p>` : ""}
    <div class="jv-ctrl-fila"><button type="button" class="jv-b baja" data-k="pct" data-p="-30">✂️ −30 %</button><button type="button" class="jv-b sube" data-k="pct" data-p="30">🚀 +30 %</button><button type="button" class="jv-b" data-k="otro">✎ Otro</button></div>`;
  if (!animar || quieto()) { box.innerHTML = html; return; }
  const h0 = box.offsetHeight; box.innerHTML = html; const h1 = box.scrollHeight;
  box.style.height = h0 + "px"; box.classList.add("cambia"); void box.offsetHeight;
  box.style.height = h1 + "px";
  setTimeout(() => { box.style.height = ""; box.classList.remove("cambia"); if (J.msgs[J.msgs.length - 1]?.u === st.m.u) abajo(); }, 320);
  if (st.modo === "otro") setTimeout(() => $(".jv-otro-in", box)?.focus({ preventScroll: true }), 60);
}
function previa(el, st) {
  const v = Number($(".jv-otro-in", el)?.value), M = mon(st.c), act = presActual(st), out = $(".jv-previa", el), btn = $("[data-k=aplicar]", el);
  const p = Number.isFinite(v) && $(".jv-otro-in", el).value !== "" ? calcular(st, st.unidad === "%" ? { pct: v } : { monto: v }) : null;
  st.pend = p; btn.disabled = !p;
  out.innerHTML = p ? `${M}${NF0.format(act)} → <b>${M}${NF0.format(p.nuevo)}</b> <span class="${p.pct > 0 ? "v" : "r"}">(${p.pct > 0 ? "+" : ""}${p.pct} %)</span>` : `Hoy está en ${M}${NF0.format(act)}`;
}
async function accionCard(e, el, st) {
  const b = e.target.closest("[data-k]"); if (!b || b.disabled) return;
  const k = b.dataset.k;
  if (k === "tabla" || k === "ver") { irAlDashboard(el, st.c?.id || st.m.id, st.m.aplicado?.despues); return; }
  if (k === "pct") { st.pend = calcular(st, { pct: Number(b.dataset.p) }); st.modo = st.pend ? "confirmar" : null; dibujarCtrl(el, st); return; }
  if (k === "otro") { st.modo = "otro"; st.pend = null; dibujarCtrl(el, st); return; }
  if (k === "unidad") { st.unidad = b.dataset.u; ls.set("jv_unidad", st.unidad); dibujarCtrl(el, st, false); $(".jv-otro-in", el)?.focus(); return; }
  if (k === "aplicar") { if (st.pend) { st.modo = "confirmar"; dibujarCtrl(el, st); } return; }
  if (k === "volver") { st.modo = null; st.pend = null; if (st.m.pre) { delete st.m.pre; guardar(); } dibujarCtrl(el, st); return; }
  if (k === "si") {
    const p = st.pend, c = st.c; if (!p || !c) return;
    st.modo = "trabajando"; dibujarCtrl(el, st);
    let r; try { r = c.id === "demo" ? (await new Promise((ok) => setTimeout(ok, 900)), { ok: true, despues: p.nuevo }) : await J.ctx.presupuesto({ id: c.id, act: c.act, nombre: c.nombre, monto: p.nuevo }); } catch (err) { r = { ok: false, error: err.message }; }
    if (!r?.ok) { st.modo = "error"; st.err = r?.error; dibujarCtrl(el, st); return; }
    if (r.simulado) { st.modo = null; st.pend = null; dibujarCtrl(el, st); decir(`Modo prueba: no lo mandé a Meta, pero quedaría en ${mon(c)}${NF0.format(p.nuevo)}.`); return; }
    const desp = Number(r.despues ?? p.nuevo);
    st.m.aplicado = { antes: p.antes, despues: desp, t: new Date().toISOString() }; delete st.m.pre; guardar();
    st.modo = "hecho"; st.pend = null; dibujarCtrl(el, st); dibujarTabla(el, st);
    const n = $(".jv-pres-n", el); n.classList.remove("brilla"); void n.offsetWidth; n.classList.add("brilla");
    contar(n, p.antes, desp, (x) => mon(c) + NF0.format(x), 900);
    try { navigator.vibrate?.(12); } catch {}
  }
}

// «Ver campaña»: el chat se corre a la derecha, el Dashboard entra deslizándose y la campaña queda seleccionada y resaltada
// en la tabla (con su presupuesto nuevo y la «Última modificación» de recién). Sin pop-ups.
function irAlDashboard(el, id, pres) {
  const p = $("#jv-panel"), raiz = document.documentElement;
  el?.classList.add("despega");
  p?.classList.add("al-dash"); raiz.classList.add("jv-transicion");
  setTimeout(() => {
    cerrar(); p?.classList.remove("al-dash"); el?.classList.remove("despega");
    J.ctx.seleccionar?.(String(id), pres);
    setTimeout(() => raiz.classList.remove("jv-transicion"), 900);
  }, quieto() ? 0 : 300);
}

// ---------- arranque ----------
function iniciar(ctx) {
  J.ctx = ctx || {}; cargarMsgs(); montarUI(); pintar();
  traerAvisos();
  clearInterval(J.timer);
  J.timer = setInterval(() => { if (!document.hidden) traerAvisos(); }, 60e3);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) traerAvisos(); });
}

// ---------- demo ----------
const DEMO_C = { id: "demo", act: "demo", nombre: "🇦🇷 23.10 CBO Panza Cero 40+ (AR)", presupuesto: 268, gasto: 262, ventas: 12, roas: 0.68, ganancia: -116 };
const DEMO_S = { t: new Date(Date.now() - 3.2 * 3600e3).toISOString(), de: 383, a: 268, dir: -1, ventanas: {
  "3h": { ver: "sigue_mal", h: 3, final: true, antes: { g: 79.6, v: 3, roas: 0.61, gan: -39.7, gan_h: -13.2 }, despues: { g: 48.5, v: 3, roas: 0.83, gan: -15.3, gan_h: -5.1 } },
  "12h": { ver: "sigue_mal", h: 12, final: false, antes: { g: 135.8, v: 7, roas: 0.71, gan: -39.3, gan_h: -3.4 }, despues: { g: 158.8, v: 8, roas: 0.71, gan: -65.8, gan_h: -6.4 } } },
  dias: [{ et: "Al surfear · 09:21", p: 383, g: 110.8, v: 4, roas: 0.54, gan: -50.1 }, { et: "Hoy hasta ahora", p: 268, g: 262, v: 12, roas: 0.68, gan: -115.9 }] };
function demo() {
  const t = (min) => new Date(Date.now() - min * 60e3).toISOString();
  J.msgs = [
    { u: uid(), rol: "aviso", t: t(30), feed: 1, texto: "🔴 *Panza Cero 40+ · CP12*\nBro, la bajaste hace 3 h y sigue sin rendir (ROAS 0,83). ¿Le bajamos más?", acciones: [{ tipo: "presupuesto", titulo: "✂️ Bajarle 30 %", id: "demo", nombre: "Panza Cero 40+", pct: -30 }, { tipo: "ver_campana", titulo: "📈 Ver antes y después", id: "demo" }, { tipo: "nada", titulo: "Dejarla así" }] },
    { u: uid(), rol: "aviso", t: t(2), feed: 3, urgente: true, texto: "🚨 **Bro, cargá US$ 600 en Whop ya mismo.** En ~5 min Meta te cobra US$ 1.000 y en Whop tenés US$ 500. Si no cargás, se frenan los anuncios." },
  ];
  J.ultFeed = 3; pintar(); sonar(true); setTimeout(abrir, 1200);
}
async function demoResp(t) {
  await new Promise((ok) => setTimeout(ok, 900));
  return { texto: `Che, en la demo no leo datos reales. Te muestro cómo se ve la tarjeta:`, acciones: [{ tipo: "mostrar_campana", titulo: "x", id: "demo" }] };
}

window.Jarvis = { iniciar, abrir, cerrar };
})();

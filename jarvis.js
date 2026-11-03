/* Jarvis (03/11, Lorenzo): el asistente personal ADENTRO del Dashboard. Botón redondo abajo a la derecha → chat a la derecha
   (en el celular, pantalla completa). Ahí:
   · llegan los avisos (los mismos de Telegram, guardados en jarvis_feed) hablados como un amigo, con métricas y botones;
   · cuando hay algo nuevo el círculo gira en rojo y suena; si es urgente (cobro, pago rechazado, bot caído) el chat se abre solo;
   · se le pregunta cualquier cosa (asistente-wa ?accion=app_chat: Claude con lectura de todo) y contesta con botones;
   · los botones resuelven: «antes y después» (pop-up del relojito), cambiar presupuesto (siempre con «¿Sí, hacelo?»), abrir
     secciones o Drive.
   Avisos: asistente ?accion=inicio cada 60 s. La charla vive en este navegador (localStorage, por usuario). */
"use strict";
(() => {
const BASE = "https://tppcpnfzcxxusdhrlmdx.supabase.co/functions/v1/";
const DASH = "https://francoaguero611-cpu.github.io/mesa-movil/";
const $ = (s, r = document) => r.querySelector(s);
const ls = { get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const NF0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const movil = () => matchMedia("(max-width: 720px)").matches;
const J = { ctx: {}, msgs: [], abierto: false, pensando: false, timer: null, ultFeed: 0, primera: true };
const K = () => `jv_chat_${J.ctx.usuario?.() || "x"}`;

// ícono propio: un núcleo con dos órbitas (nada de estrellitas)
const ICONO = `<svg viewBox="0 0 32 32" aria-hidden="true">
  <ellipse cx="16" cy="16" rx="13" ry="5.2" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".9" transform="rotate(-28 16 16)"/>
  <ellipse cx="16" cy="16" rx="13" ry="5.2" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".55" transform="rotate(32 16 16)"/>
  <circle cx="16" cy="16" r="5.6" fill="#3d9dff"/><circle cx="16" cy="16" r="4" fill="#7cc8ff"/><circle cx="14.6" cy="14.4" r="1.6" fill="#eaf8ff"/></svg>`;

// ---------- red ----------
async function pedir(url, body) {
  const r = await fetch(url, { method: body ? "POST" : "GET", headers: { "x-app-clave": J.ctx.clave?.() || "", "x-app-usuario": J.ctx.usuario?.() || "", ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" }).catch(() => null);
  if (!r) throw new Error("sin conexión");
  const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || `error ${r.status}`); return j;
}

// ---------- memoria de la charla ----------
function cargarMsgs() { try { J.msgs = JSON.parse(ls.get(K(), "[]")) || []; } catch { J.msgs = []; } J.ultFeed = Math.max(0, ...J.msgs.map((m) => m.feed || 0)); }
function guardar() { J.msgs = J.msgs.slice(-150); ls.set(K(), JSON.stringify(J.msgs)); }
const sinLeer = () => J.msgs.filter((m) => m.rol === "aviso" && !m.leido);
function marcarVisto() { let n = 0; for (const m of J.msgs) if (m.rol === "aviso" && !m.leido) { m.leido = true; n++; } if (n) guardar(); pintarFab(); }

// ---------- avisos ----------
async function traerAvisos() {
  if (J.ctx.demo) { if (J.primera) demo(); J.primera = false; return; }
  let d; try { d = await pedir(BASE + "asistente?accion=inicio"); } catch { return; }
  const nuevos = [];
  const feed = (d.feed || []).slice().sort((a, b) => a.id - b.id);
  for (const x of feed.filter((x) => x.id > J.ultFeed && (J.ultFeed || Date.now() - Date.parse(x.t) < 12 * 3600e3))) {
    const acc = x.acciones?.length ? x.acciones : (x.botones || []).map((b) => ({ tipo: "url", titulo: b.titulo, url: b.url }));
    nuevos.push({ rol: "aviso", texto: x.texto, acciones: acc, t: x.t, feed: x.id, urgente: !!x.urgente });
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
  lista.push({ rol: "aviso", texto, acciones, t: new Date().toISOString(), urgente: true });
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
function hora(iso) {
  const d = new Date(Date.parse(iso) - 3 * 3600e3).toISOString(), hoy = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  return (d.slice(0, 10) === hoy ? "" : `${d.slice(8, 10)}/${d.slice(5, 7)} `) + d.slice(11, 16);
}

// ---------- pintar ----------
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
    <form class="jv-form" id="jv-form" autocomplete="off"><textarea id="jv-in" rows="1" placeholder="Preguntale lo que quieras…" enterkeyhint="send"></textarea>
      <button type="submit" class="jv-enviar" aria-label="Enviar"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 12 L20 4 L13 20 L11 13 Z" fill="currentColor"/></svg></button></form>`;
  document.body.append(p, fab);
  $("#jv-cerrar").onclick = cerrar;
  const ta = $("#jv-in");
  ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; });
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !movil()) { e.preventDefault(); $("#jv-form").requestSubmit(); } });
  $("#jv-form").addEventListener("submit", (e) => { e.preventDefault(); const t = ta.value.trim(); if (!t || J.pensando) return; ta.value = ""; ta.style.height = "auto"; preguntar(t); });
  $("#jv-msgs").addEventListener("click", tocar);
  $("#jv-rapidas").addEventListener("click", (e) => { const b = e.target.closest("[data-q]"); if (b) preguntar(b.dataset.q); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && J.abierto && !document.querySelector(".ev-fondo, .modal-fondo, #pop-hist")) cerrar(); });
}
function pintarFab() {
  const fab = $("#jv-fab"); if (!fab) return;
  const n = J.abierto ? 0 : sinLeer().length;
  fab.classList.toggle("alerta", n > 0);
  const b = $(".jv-badge", fab); b.hidden = !n; b.textContent = n > 9 ? "9+" : String(n);
  fab.setAttribute("aria-label", n ? `Jarvis: ${n} aviso${n > 1 ? "s" : ""} nuevo${n > 1 ? "s" : ""}` : "Abrir Jarvis");
}
const RAPIDAS = ["¿Cómo venimos hoy?", "¿Qué campaña surfeo?", "¿Cuánta plata hay en Whop?", "¿Cuáles son los winners?", "¿Cómo van las renos?"];
function pintar() {
  pintarFab();
  const box = $("#jv-msgs"); if (!box) return;
  box.innerHTML = (J.msgs.length ? "" : `<div class="jv-hola"><span class="jv-orbe grande">${ICONO}</span><p><b>Hola${J.ctx.nombre?.() ? ", " + esc(J.ctx.nombre()) : ""}.</b> Acá te aviso todo lo que pasa y me podés pedir lo que quieras: cómo viene una campaña, surfearla, abrir el Drive de las renos…</p></div>`)
    + J.msgs.map((m, i) => {
      if (m.rol === "user") return `<div class="jv-m yo"><p>${esc(m.texto)}</p></div>`;
      const acc = (m.acciones || []).map((a, k) => `<button type="button" class="jv-b${a.tipo === "nada" || a.tipo === "cancelar" ? " suave" : ""}${a.tipo === "confirmar" ? " fuerte" : ""}" data-m="${i}" data-a="${k}" ${m.usado ? "disabled" : ""}>${esc(a.titulo)}</button>`).join("");
      return `<div class="jv-m el${m.rol === "aviso" ? " aviso" : ""}${m.urgente ? " urgente" : ""}${m.rol === "aviso" && !m.leido ? " nuevo" : ""}">
        <p>${md(m.texto)}</p>${acc ? `<div class="jv-acc">${acc}</div>` : ""}<time>${m.t ? hora(m.t) : ""}</time></div>`;
    }).join("")
    + (J.pensando ? `<div class="jv-m el pensando" aria-label="Jarvis está escribiendo"><span></span><span></span><span></span></div>` : "");
  $("#jv-rapidas").innerHTML = J.pensando ? "" : RAPIDAS.map((q) => `<button type="button" data-q="${esc(q)}">${esc(q)}</button>`).join("");
}
function abajo() { const b = $("#jv-msgs"); if (b) requestAnimationFrame(() => { b.scrollTop = b.scrollHeight; }); }

// ---------- abrir / cerrar ----------
function abrir() {
  montarUI(); const p = $("#jv-panel");
  J.abierto = true; p.hidden = false; document.documentElement.classList.add("jv-abierto");
  requestAnimationFrame(() => p.classList.add("visible"));
  pintar(); abajo(); setTimeout(marcarVisto, 400);
  if (!movil()) setTimeout(() => $("#jv-in")?.focus({ preventScroll: true }), 250);
}
function cerrar() {
  const p = $("#jv-panel"); if (!p) return;
  J.abierto = false; p.classList.remove("visible"); document.documentElement.classList.remove("jv-abierto");
  setTimeout(() => { if (!J.abierto) p.hidden = true; }, 260);
  marcarVisto(); pintar();
}

// ---------- charla con Claude ----------
async function preguntar(t) {
  J.msgs.push({ rol: "user", texto: t, t: new Date().toISOString() }); guardar();
  J.pensando = true; pintar(); abajo();
  const hist = J.msgs.slice(-14).map((m) => ({ rol: m.rol === "user" ? "user" : "assistant", texto: m.texto }));
  let r;
  try { r = J.ctx.demo ? await demoResp(t) : await pedir(BASE + "asistente-wa?accion=app_chat", { mensajes: hist }); }
  catch (e) { r = { texto: `Uh, no te pude contestar (${e.message}). Probá de nuevo en un toque.`, acciones: [] }; }
  J.pensando = false;
  J.msgs.push({ rol: "assistant", texto: r.texto || "Listo.", acciones: r.acciones || [], t: new Date().toISOString() }); guardar();
  pintar(); abajo();
}
function decir(texto, acciones = []) { J.msgs.push({ rol: "assistant", texto, acciones, t: new Date().toISOString() }); guardar(); pintar(); abajo(); }

// ---------- botones ----------
const mon = (c) => (c?.moneda && String(c.moneda).toUpperCase() !== "USD" ? String(c.moneda).toUpperCase() + " " : "US$ ");
async function tocar(e) {
  const b = e.target.closest("button[data-a]"); if (!b) return;
  const m = J.msgs[Number(b.dataset.m)], a = m?.acciones?.[Number(b.dataset.a)]; if (!a) return;
  if (a.tipo === "ver_campana") { J.ctx.verCampana?.(String(a.id)); return; }
  if (a.tipo === "ver_campanas") { J.ctx.verCampanas?.((a.ids || []).map(String)); return; }
  if (a.tipo === "seccion") { if (movil()) cerrar(); J.ctx.seccion?.(a.sec); return; }
  if (a.tipo === "url") {
    const u = String(a.url || "");
    if (u.startsWith("#") || u.startsWith(DASH)) { if (movil()) cerrar(); const h = u.startsWith("#") ? u : u.slice(DASH.length); location.hash = h && h !== "#" ? h : "#dash"; return; }
    window.open(u, "_blank", "noopener"); return;
  }
  if (a.tipo === "nada") { m.usado = true; J.msgs.push({ rol: "user", texto: a.titulo, t: new Date().toISOString() }); decir("Dale, la dejo así 👌 Si cambia algo te aviso."); return; }
  if (a.tipo === "cancelar") { m.usado = true; decir("Listo, no toco nada."); return; }
  if (a.tipo === "presupuesto") {
    b.disabled = true;
    let c; try { c = await J.ctx.campana?.(String(a.id)); } catch {}
    b.disabled = false;
    if (!c) { decir("No encuentro esa campaña en el Dashboard de hoy (¿está apagada?). Abrila desde la tabla y lo hacemos ahí.", [{ tipo: "seccion", titulo: "📊 Ir al Dashboard", sec: "dash" }]); return; }
    const actual = Number(c.presupuesto || 0);
    const nuevo = a.monto != null ? Math.round(Number(a.monto)) : Math.round(actual * (1 + Number(a.pct || 0) / 100));
    if (!actual || !nuevo) { decir("Esa campaña no tiene presupuesto a nivel campaña (es ABO): cambialo desde la tabla.", [{ tipo: "ver_campana", titulo: "📈 Abrirla", id: c.id }]); return; }
    if (a.pct > 30 || (a.monto != null && nuevo > actual * 1.31)) { decir(`Ojo: eso es más de +30 % de una (de ${mon(c)}${NF0.format(actual)} a ${mon(c)}${NF0.format(nuevo)}). El método dice máximo +30 % por vez.`, [{ tipo: "presupuesto", titulo: "🚀 Subir +30 %", id: c.id, nombre: c.nombre, pct: 30 }, { tipo: "cancelar", titulo: "Mejor no" }]); return; }
    m.usado = true;
    J.msgs.push({ rol: "user", texto: a.titulo, t: new Date().toISOString() });
    decir(`¿Paso *${c.nombre}* de ${mon(c)}${NF0.format(actual)} a *${mon(c)}${NF0.format(nuevo)}*?`, [{ tipo: "confirmar", titulo: "✅ Sí, hacelo", id: c.id, act: c.act, nombre: c.nombre, monto: nuevo, antes: actual, mon: mon(c) }, { tipo: "cancelar", titulo: "No" }]);
    return;
  }
  if (a.tipo === "confirmar") {
    m.usado = true; pintar();
    J.pensando = true; pintar(); abajo();
    let r; try { r = await J.ctx.presupuesto({ id: a.id, act: a.act, nombre: a.nombre, monto: a.monto }); } catch (err) { r = { ok: false, error: err.message }; }
    J.pensando = false;
    if (r.ok && r.simulado) decir(`Modo prueba: no lo mandé a Meta, pero quedaría en ${a.mon}${NF0.format(a.monto)}.`);
    else if (r.ok) decir(`Listo, hermano ✅ *${a.nombre}* quedó en ${a.mon}${NF0.format(r.despues ?? a.monto)}. En 3 h te digo cómo viene.`, [{ tipo: "ver_campana", titulo: "📈 Ver campaña", id: a.id }]);
    else decir(`No pude cambiarlo: ${r.error || "Meta no respondió"}. Probá desde la tabla.`, [{ tipo: "ver_campana", titulo: "📈 Abrirla", id: a.id }]);
  }
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
function demo() {
  const t = (min) => new Date(Date.now() - min * 60e3).toISOString();
  J.msgs = [
    { rol: "aviso", t: t(30), feed: 1, texto: "🔴 *Panza Cero 40+ · CP12*\nBro, esta la subiste hace 3 h y decayó: el ROAS pasó de 0,5 a 0,2. Yo le bajaría el presupuesto.", acciones: [{ tipo: "presupuesto", titulo: "✂️ Volverla a US$ 300", id: "demo", nombre: "Panza Cero 40+", monto: 300 }, { tipo: "ver_campana", titulo: "📈 Ver antes y después", id: "demo" }, { tipo: "nada", titulo: "Dejarla así" }] },
    { rol: "aviso", t: t(8), feed: 2, texto: "🟢 *Yogur Bariátrico · CP7*\nHermano, esta que surfeaste hace 3 h metió *7 ventas más* y el ROAS bajó 0,1 nomás (2,2 → 2,1). Está para surfearla de vuelta 🚀", acciones: [{ tipo: "presupuesto", titulo: "🚀 Surfearla +30 %", id: "demo", nombre: "Yogur Bariátrico", pct: 30 }, { tipo: "ver_campana", titulo: "📈 Ver antes y después", id: "demo" }, { tipo: "nada", titulo: "Dejarla así" }] },
    { rol: "aviso", t: t(2), feed: 3, urgente: true, texto: "🚨 **Bro, cargá US$ 600 en Whop ya mismo.** En ~5 min Meta te cobra US$ 1.000 y en Whop tenés US$ 500. Si no cargás, se frenan los anuncios." },
  ];
  J.ultFeed = 3; pintar(); sonar(true); setTimeout(abrir, 1200);
}
async function demoResp(t) {
  await new Promise((ok) => setTimeout(ok, 900));
  return { texto: `Che, en la demo no leo datos reales. En la app de verdad te contesto «${t}» con los números del Dashboard.`, acciones: [{ tipo: "seccion", titulo: "📊 Ir al Dashboard", sec: "dash" }] };
}

window.Jarvis = { iniciar, abrir, cerrar };
})();

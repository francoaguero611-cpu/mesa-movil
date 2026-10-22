/* Avisos (22/10, pedido de Lorenzo): campanita arriba a la derecha en TODA la app + pop-up en el medio cuando hace falta algo
   (falta saldo → botón a la página de carga; salió la campaña apagada → botón para prenderla; se trabó / se pausó algo).
   Los avisos los crea ws-evento: solos (terminado, corrección hecha, oferta terminada, error, saldo que frena) o desde
   Claude con scripts/taller.py aviso / campana. Usa api(), clave(), toast(), irASeccion() de app.js (scripts clásicos). */
"use strict";
(() => {
const WS = "https://tppcpnfzcxxusdhrlmdx.supabase.co/functions/v1/ws-evento";
const POLL_MS = 20000;
const $ = (s, r = document) => r.querySelector(s);
const escA = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const lsA = { get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const ICO = { listo: "✅", correccion: "✎", oferta: "🎉", error: "⚠", saldo: "💳", campana: "🚀", pausa: "⏸", info: "•" };
const A = { lista: [], ult: 0, yo: null, abierto: false, timer: null, vistos: new Set(JSON.parse(lsA.get("av_popup_vistos", "[]") || "[]")), cola: [] };
const demo = new URLSearchParams(location.search).get("demo") === "1";

async function ws(accion, q = "", body = null) {
  const r = await fetch(`${WS}?accion=${accion}${q}`, body ? { method: "POST", headers: { "x-app-clave": lsA.get("dash_clave", ""), "content-type": "application/json" }, body: JSON.stringify(body) }
    : { headers: { "x-app-clave": lsA.get("dash_clave", "") }, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `Error ${r.status}`);
  return j;
}
const hace = (iso) => { const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000); return s < 60 ? "recién" : s < 3600 ? `hace ${Math.round(s / 60)} min` : s < 86400 ? `hace ${Math.round(s / 3600)} h` : `hace ${Math.round(s / 86400)} d`; };

async function cargar() {
  if (document.hidden || (!demo && !lsA.get("dash_clave", ""))) return;
  try {
    const r = demo ? demoAvisos() : await ws("avisos", A.ult ? `&desde=${A.ult}` : "");
    if (r.yo) A.yo = r.yo;
    const nuevos = A.ult ? r.avisos : r.avisos.slice().reverse();
    if (!nuevos.length && A.ult) return;
    const ids = new Set(A.lista.map((x) => x.id));
    for (const a of nuevos) if (!ids.has(a.id)) A.lista.unshift(a);
    A.lista = A.lista.sort((a, b) => b.id - a.id).slice(0, 80);
    A.ult = Math.max(A.ult, ...A.lista.map((x) => x.id));
    for (const a of A.lista.slice().reverse()) if (a.popup && !a.leida && !A.vistos.has(a.id) && (!A.yo || a.dueno === A.yo)) A.cola.push(a);
    pintarBoton(); if (A.abierto) pintarLista();
    siguientePopup();
  } catch {}
}

// ---------- botón ----------
function montarBoton() {
  const top = $(".acciones-top"); if (!top || $("#av-btn")) return;
  top.insertAdjacentHTML("afterbegin", `<div class="av-wrap"><button class="btn icono av-btn" id="av-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Notificaciones">
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 16.5 C 6.6 15.4, 6.8 14.4, 6.8 12.4 V10.6 C 6.8 7.6, 9 5.3, 12 5.3 C 15 5.3, 17.2 7.6, 17.2 10.6 V12.4 C 17.2 14.4, 17.4 15.4, 18.1 16.5 Z M10 19 C 10.4 20.1, 11.1 20.6, 12 20.6 C 12.9 20.6, 13.6 20.1, 14 19 M12 3.4 V5.3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <b class="av-n" hidden></b></button><div class="av-panel" id="av-panel" role="dialog" aria-label="Notificaciones" hidden></div></div>`);
  $("#av-btn").onclick = (e) => { e.stopPropagation(); abrirPanel(!A.abierto); };
  document.addEventListener("click", (e) => { if (A.abierto && !e.target.closest(".av-wrap")) abrirPanel(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && A.abierto) abrirPanel(false); });
}
function noLeidas() { return A.lista.filter((a) => !a.leida && (!A.yo || a.dueno === A.yo)).length; }
function pintarBoton() {
  const n = $("#av-btn .av-n"); if (!n) return;
  const k = noLeidas(); n.hidden = !k; n.textContent = k > 9 ? "9+" : k;
  $("#av-btn").classList.toggle("hay", !!k);
}
function abrirPanel(si) {
  A.abierto = si; const p = $("#av-panel"); if (!p) return;
  p.hidden = !si; $("#av-btn").setAttribute("aria-expanded", si);
  if (si) pintarLista();
}
function pintarLista() {
  const p = $("#av-panel"); if (!p) return;
  const xs = A.lista;
  p.innerHTML = `<div class="av-cab"><b>Notificaciones</b>${noLeidas() ? `<button type="button" class="av-link" data-av="leer-todo">Marcar todo leído</button>` : ""}</div>
    <div class="av-items">${xs.map((a) => `<div class="av-item${a.leida ? "" : " nueva"} t-${escA(a.tipo)}" data-id="${a.id}">
      <span class="av-ico">${ICO[a.tipo] || "•"}</span>
      <div class="av-txt"><b>${escA(a.titulo)}</b>${a.texto ? `<span>${escA(a.texto)}</span>` : ""}<small>${hace(a.ts)}${a.dueno && A.yo && a.dueno !== A.yo ? ` · de ${escA(a.dueno)}` : ""}</small>
      ${a.accion ? `<div class="av-acc">${botonAccion(a)}</div>` : ""}</div></div>`).join("") || `<p class="av-vacio">Sin notificaciones por ahora.</p>`}</div>`;
  p.onclick = (e) => {
    const b = e.target.closest("[data-av]"); if (!b) return;
    e.stopPropagation();
    if (b.dataset.av === "leer-todo") return leer(null);
    const a = A.lista.find((x) => x.id === Number(b.closest("[data-id]")?.dataset.id));
    if (a) ejecutar(a, b);
  };
}
function botonAccion(a) {
  const x = a.accion || {};
  if (x.tipo === "link") return `<button type="button" class="av-b" data-av="ir">${escA(x.t || "Abrir")} ↗</button>`;
  if (x.tipo === "prender") return `<button type="button" class="av-b ok" data-av="prender">▶ Prender campaña</button>${x.item ? `<button type="button" class="av-b" data-av="ver">Ver</button>` : ""}`;
  if (x.tipo === "abrir") return `<button type="button" class="av-b" data-av="ver">Ver en Workspace</button>`;
  return "";
}

// ---------- acciones ----------
async function leer(ids) {
  for (const a of A.lista) if (!ids || ids.includes(a.id)) a.leida = true;
  pintarBoton(); if (A.abierto) pintarLista();
  if (!demo) ws("avisos_leer", "", ids ? { ids } : {}).catch(() => {});
}
function verItem(id) {
  abrirPanel(false); cerrarPopup();
  try { history.replaceState(null, "", location.pathname + location.search + "#workspace/" + encodeURIComponent(id)); } catch {}
  if (window.Taller && document.getElementById("tl") && window.Taller.abrir) window.Taller.abrir(id);
  else if (typeof irASeccion === "function") irASeccion("workspace");
}
async function ejecutar(a, btn) {
  const x = a.accion || {}, que = btn.dataset.av;
  if (que === "ir") { window.open(x.u, "_blank", "noopener"); leer([a.id]); return; }
  if (que === "ver") { leer([a.id]); verItem(x.item || a.item_id); return; }
  if (que === "prender") {
    if (btn.dataset.seguro !== "1") { btn.dataset.seguro = "1"; btn.textContent = "¿Seguro? Tocá de nuevo para prender"; return; }
    btn.disabled = true; btn.textContent = "Prendiendo…";
    try {
      if (demo) throw new Error("es el ejemplo, no se prende nada");
      const r = await api("estado", { body: { estado: "ACTIVE", items: [{ id: x.id, act: x.act, nivel: "campana", nombre: x.nombre || x.id }] }, escritura: true });
      const res = r?.resultados?.[0];
      if (!res?.ok) throw new Error(res?.error || "Meta no la prendió");
      if (x.item) ws("taller_meta", "", { id: x.item, meta: { estado: r.dry ? "PAUSED" : "ACTIVE" }, log: r.dry ? "Prender (simulado: modo prueba activo)" : "▶ Campaña prendida desde el aviso" }).catch(() => {});
      typeof toast === "function" && toast(r.dry ? "Modo prueba: no se prendió de verdad." : "Campaña prendida ▶");
      leer([a.id]); cerrarPopup();
    } catch (e) { btn.disabled = false; btn.dataset.seguro = ""; btn.textContent = "▶ Prender campaña"; typeof toast === "function" && toast(`No se pudo prender: ${e.message}`, "error", 8000); }
  }
}

// ---------- pop-up en el medio ----------
function siguientePopup() {
  if ($("#av-pop")) return;
  const a = A.cola.shift(); if (!a) return;
  A.vistos.add(a.id); lsA.set("av_popup_vistos", JSON.stringify([...A.vistos].slice(-200)));
  document.body.insertAdjacentHTML("beforeend", `<div class="av-pop-fondo" id="av-pop"><div class="av-pop t-${escA(a.tipo)}" role="alertdialog" aria-modal="true" aria-labelledby="av-pop-t" data-id="${a.id}">
    <div class="av-pop-ico">${ICO[a.tipo] || "•"}</div>
    <h3 id="av-pop-t">${escA(a.titulo)}</h3>${a.texto ? `<p>${escA(a.texto)}</p>` : ""}
    <div class="av-pop-acc">${botonAccion(a)}<button type="button" class="av-b tenue" data-av="cerrar">Después</button></div></div></div>`);
  const f = $("#av-pop");
  f.onclick = (e) => {
    if (e.target === f) return cerrarPopup(a);
    const b = e.target.closest("[data-av]"); if (!b) return;
    if (b.dataset.av === "cerrar") return cerrarPopup(a);
    ejecutar(a, b).then?.(() => {});
  };
  setTimeout(() => $(".av-pop .av-b", f)?.focus(), 30);
}
function cerrarPopup(a) {
  $("#av-pop")?.remove();
  if (a && a.tipo !== "saldo" && a.tipo !== "campana") leer([a.id]); // saldo y campaña quedan en la campanita hasta resolverlos
  setTimeout(siguientePopup, 300);
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#av-pop")) cerrarPopup(); });

function demoAvisos() {
  const t = (m) => new Date(Date.now() - m * 60000).toISOString();
  return { yo: "lorenzo", avisos: [
    { id: 5, ts: t(1), dueno: "lorenzo", tipo: "saldo", titulo: "Falta saldo en Atlas Cloud", texto: "US$ 0,67 · lo necesita: A7 · B-roll recetas", popup: true, leida: false, accion: { tipo: "link", u: "https://www.atlascloud.ai/console/billing", t: "Cargar saldo en Atlas Cloud" } },
    { id: 4, ts: t(8), dueno: "lorenzo", tipo: "campana", titulo: "🚀 Salió la campaña, pero está apagada", texto: "🇦🇷 23.10 CBO Yogur (LATAM)", popup: false, leida: false, accion: { tipo: "prender", id: "1", act: "1", item: "demo-yogur-a4" } },
    { id: 3, ts: t(20), dueno: "lorenzo", tipo: "correccion", titulo: "✎ Corrección hecha: A5 · Testimonio cocina", texto: "En 0:58 se congela la imagen", leida: false, accion: { tipo: "abrir", item: "demo-yogur-a5" } },
    { id: 2, ts: t(45), dueno: "lorenzo", tipo: "oferta", titulo: "🎉 Yogur Bariátrico AR: todo terminado", texto: "7 piezas listas para revisar.", leida: true },
    { id: 1, ts: t(90), dueno: "franco", tipo: "listo", titulo: "✅ Terminado: Reno JPK-2 · hook nuevo", texto: "Cuero & Oficio JA", leida: true, accion: { tipo: "abrir", item: "demo-cuero-r1" } },
  ] };
}

function arrancar() {
  montarBoton(); cargar();
  clearInterval(A.timer); A.timer = setInterval(cargar, POLL_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) cargar(); });
  // el header se vuelve a pintar a veces: si se pierde el botón, se vuelve a poner
  new MutationObserver(() => { if (!$("#av-btn") && $(".acciones-top")) { montarBoton(); pintarBoton(); } }).observe(document.body, { childList: true, subtree: true });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
window.Avisos = { cargar };
})();

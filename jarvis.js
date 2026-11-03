/* Jarvis (03/11, Lorenzo): la pantalla de INICIO del Dashboard. «Algo que me dé claridad».
   Arriba: cómo viene el negocio (hoy y ayer, mismos números del Dashboard).
   «Para hacer»: solo lo que pide una acción (bots caídos, pagos rechazados, Whop, surfeos, renos trabadas, rechazos que importan),
   cada uno con su botón para resolverlo y «Hecho» (compartido entre Lorenzo y Franco).
   «Novedades»: lo informativo (winners, renos, rechazos menores, escala), una línea por cosa, agrupado por tema.
   Backend: Edge Function «asistente» (?accion=inicio / ?accion=hecho). Cada aviso que Jarvis manda a Telegram queda en jarvis_feed. */
"use strict";
(() => {
const API = "https://tppcpnfzcxxusdhrlmdx.supabase.co/functions/v1/asistente";
const DASH = "https://francoaguero611-cpu.github.io/mesa-movil/";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ls = { get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const NF0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }), NF2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd = (n) => (n < 0 ? "−" : "+") + "US$ " + NF0.format(Math.abs(Number(n) || 0));
const J = { raiz: null, ctx: {}, d: null, err: null, hoy: null, ayer: null, filtro: ls.get("jv_filtro", "todas"), abiertas: new Set(), verHechas: false, timer: null };

async function api(q, body = null) {
  if (J.ctx.demo) return demo(q);
  const r = await fetch(`${API}?accion=${q}`, { method: body ? "POST" : "GET", headers: { "x-app-clave": J.ctx.clave?.() || "", "x-app-usuario": J.ctx.usuario?.() || "", ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" }).catch(() => null);
  if (!r) throw new Error("Sin conexión");
  if (r.status === 401) { J.ctx.login?.("Volvé a entrar para ver Jarvis."); throw new Error("Clave incorrecta"); }
  const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || `Error ${r.status}`); return j;
}

// ---------- texto de Telegram → HTML corto ----------
// «*negrita*» y «**negrita**»; las líneas «👉 https://…» se vuelven botón «Abrir».
function md(t) {
  const urls = [];
  const lineas = String(t || "").split("\n").filter((l) => { const m = l.match(/^\s*👉\s*(https?:\/\/\S+)\s*$/); if (m) { urls.push(m[1]); return false; } return true; });
  const html = esc(lineas.join("\n").trim()).replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>").replace(/\*([^*\n]+)\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
  return { html, urls };
}
const icono = (t) => (String(t || "").match(/^\s*(\p{Extended_Pictographic}️?|[⚖⚠⏸]️?)/u) || [])[1] || "•";
const sinIcono = (t) => String(t || "").replace(/^\s*(\p{Extended_Pictographic}️?|[⚖⚠⏸]️?)\s*/u, "");
function hace(iso) {
  const m = (Date.now() - Date.parse(iso)) / 60e3;
  if (m < 1) return "recién"; if (m < 60) return `hace ${Math.round(m)} min`; if (m < 12 * 60) return `hace ${Math.round(m / 60)} h`;
  const d = new Date(Date.parse(iso) - 3 * 3600e3).toISOString(), hoy = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  return `${d.slice(0, 10) === hoy ? "hoy" : d.slice(8, 10) + "/" + d.slice(5, 7)} ${d.slice(11, 16)}`;
}
const SECS = [
  ["💳 SALDO Y COBROS", "💳", "Saldo"], ["🩺 BOTS", "🩺", "Bots"], ["🏄 SURFEOS", "🏄", "Surfeos"], ["🏆 WINNERS", "🏆", "Winners"],
  ["🚫 ANUNCIOS RECHAZADOS", "🚫", "Rechazos"], ["🎬 RENOVACIONES", "🎬", "Renos"], ["🌐 ESCALA HORIZONTAL", "🌐", "Escala"],
  ["⚖️ RECLAMOS", "⚖️", "Reclamos"], ["🛟 ATENCIÓN AL CLIENTE", "🛟", "ATC"], ["📦 OFERTAS", "📦", "Ofertas"], ["📊 RESUMEN DEL DÍA", "📊", "Resumen"], ["🌙 CIERRE DEL DÍA", "🌙", "Cierre"],
];
const secInfo = (s) => SECS.find((x) => x[0] === s) || [s || "otros", "•", s ? s.replace(/^\S+\s+/, "").toLowerCase().replace(/^./, (c) => c.toUpperCase()) : "Otros"];
// a dónde lleva cada tema si el aviso no trae botón propio
const SEC_LINK = { "🏄 SURFEOS": "#dash", "🏆 WINNERS": "#ranking", "🎬 RENOVACIONES": "#workspace", "🛟 ATENCIÓN AL CLIENTE": "#atc", "⚖️ RECLAMOS": "#atc", "💳 SALDO Y COBROS": "#umbrales", "🌐 ESCALA HORIZONTAL": "#umbrales", "🚫 ANUNCIOS RECHAZADOS": "#reportes", "📦 OFERTAS": "#dash", "📊 RESUMEN DEL DÍA": "#dash", "🌙 CIERRE DEL DÍA": "#dash" };

// ---------- abrir links: los del Dashboard se quedan en la app ----------
function abrir(url) {
  if (!url) return;
  if (url.startsWith("#")) { location.hash = url; return; }
  if (url.startsWith(DASH)) { const h = url.slice(DASH.length); location.hash = h && h !== "#" ? h : "#dash"; return; }
  window.open(url, "_blank", "noopener");
}

// ---------- datos ----------
async function cargar(silencioso = false) {
  if (!silencioso) { J.err = null; pintar(); }
  const tareas = [
    api("inicio").then((d) => { J.d = d; J.err = null; }).catch((e) => { J.err = e.message; }),
    J.ctx.dash?.("hoy").then((d) => { J.hoy = tot(d); }).catch(() => {}),
    J.ctx.dash?.("ayer").then((d) => { J.ayer = tot(d); }).catch(() => {}),
  ];
  // los números del día llegan aparte: se pintan cuando estén, sin esperar al resto
  tareas.forEach((p) => p?.then(() => vivo() && pintar()));
  await Promise.all(tareas);
}
const tot = (d) => { const m = (d?.grupos || []).find((g) => g.clave === "todas")?.metricas; return m ? { gan: Number(m.ganancia || 0), roas: Number(m.roas || 0), ventas: Number(m.ventas || 0), gasto: Number(m.gasto || 0) } : null; };
const vivo = () => J.raiz && document.body.contains(J.raiz);

// ---------- armado ----------
function pendientes() {
  const d = J.d; if (!d) return { vivos: [], hacer: [], hechas: [] };
  const vivos = [];
  for (const b of d.vivo?.bots || []) vivos.push({ ico: "🚨", sec: "🩺 BOTS", html: `<b>Se paró ${esc(b.bot)}.</b> ${esc(b.detalle)}. Pedime que lo revise.`, urls: [] });
  for (const p of d.vivo?.pagos || []) vivos.push({ ico: "💳", sec: "💳 SALDO Y COBROS", html: `<b>Pago rechazado en ${esc(p.nombre)}.</b> Debe ${esc(p.moneda)} ${NF2.format(p.deuda || 0)}: pagalo así no se frenan los anuncios.`, urls: p.link ? [p.link] : [], btn: "💳 Pagar" });
  const w = d.vivo?.whop, en24 = d.vivo?.en24;
  if (w != null && en24 != null && en24 > w) vivos.push({ ico: "🟡", sec: "💳 SALDO Y COBROS", html: `<b>Cargá Whop:</b> te quedan US$ ${NF0.format(w)} y en 24 h Meta cobra ~US$ ${NF0.format(en24)}.`, urls: [], link: "#umbrales", btn: "💳 Ver cobros" });
  const hacer = (d.feed || []).filter((x) => x.tipo === "hacer" && !x.hecho_en);
  const hechas = (d.feed || []).filter((x) => x.tipo === "hacer" && x.hecho_en);
  return { vivos, hacer, hechas };
}
function novedades() {
  const xs = (J.d?.feed || []).filter((x) => x.tipo === "info");
  // el mismo aviso repetido (avance de renos cada 2 h, etc.): queda solo el más nuevo
  const vistos = new Set(), out = [];
  for (const x of xs) { const k = (x.sec || "") + "|" + String(x.texto).split("\n")[0].replace(/[\d▰▱.,]+/g, "#"); if (vistos.has(k)) continue; vistos.add(k); out.push(x); }
  return out;
}

function botones(x, urls) {
  const bs = (x.botones || []).map((b) => ({ t: b.titulo, u: b.url }));
  for (const u of urls || []) bs.push({ t: "Abrir", u });
  if (!bs.length && SEC_LINK[x.sec]) bs.push({ t: "Ver", u: SEC_LINK[x.sec] });
  return bs.slice(0, 3).map((b) => `<button type="button" class="jv-ir" data-url="${esc(b.u)}">${esc(b.t)}</button>`).join("");
}
function tarjetaHacer(x) {
  const { html, urls } = md(sinIcono(x.texto));
  return `<li class="jv-tarea" data-id="${x.id}" style="--d:${Math.random() * 0.12}s">
    <span class="jv-ico" aria-hidden="true">${icono(x.texto)}</span>
    <div class="jv-cuerpo"><p>${html}</p><div class="jv-acc">${botones(x, urls)}<span class="jv-cuando">${esc(hace(x.t))}</span></div></div>
    <button type="button" class="jv-hecho" data-hecho="${x.id}" aria-label="Marcar como hecho"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12.5 L10 17 L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
  </li>`;
}
function tarjetaVivo(v) {
  const bs = [...(v.link ? [{ t: v.btn || "Ver", u: v.link }] : []), ...v.urls.map((u) => ({ t: v.btn || "Abrir", u }))];
  return `<li class="jv-tarea jv-vivo">
    <span class="jv-ico" aria-hidden="true">${v.ico}</span>
    <div class="jv-cuerpo"><p>${v.html}</p>${bs.length ? `<div class="jv-acc">${bs.map((b) => `<button type="button" class="jv-ir" data-url="${esc(b.u)}">${esc(b.t)}</button>`).join("")}<span class="jv-cuando">ahora</span></div>` : ""}</div>
  </li>`;
}

function kpi(titulo, t, ruta) {
  if (!t) return `<button type="button" class="jv-kpi" data-url="${ruta}"><span class="jv-kpi-t">${titulo}</span><b class="jv-kpi-v jv-cargando">···</b><span class="jv-kpi-s">&nbsp;</span></button>`;
  const c = t.gan >= 0 && t.roas >= 1.22 ? "bien" : t.gan >= 0 ? "justo" : "mal";
  return `<button type="button" class="jv-kpi jv-${c}" data-url="${ruta}"><span class="jv-kpi-t">${titulo}</span><b class="jv-kpi-v">${usd(t.gan)}</b><span class="jv-kpi-s">ROAS ${NF2.format(t.roas)} · ${NF0.format(t.ventas)} ventas</span></button>`;
}

function saludo() {
  const h = new Date(Date.now() - 3 * 3600e3).getUTCHours();
  const nombre = J.ctx.nombre?.() || "";
  return `${h < 6 ? "Buenas noches" : h < 13 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches"}${nombre ? `, ${esc(nombre)}` : ""}`;
}
function frase(nH) {
  if (!J.d) return "Mirando todo…";
  if (!nH) return "Todo en orden. No hay nada que necesite que hagas algo ahora.";
  return nH === 1 ? "Hay <b>1 cosa</b> para hacer." : `Hay <b>${nH} cosas</b> para hacer.`;
}

function pintar() {
  if (!vivo()) return;
  const { vivos, hacer, hechas } = pendientes(), nov = novedades();
  const nH = vivos.length + hacer.length;
  // «Para hacer» agrupado por tema, lo más urgente primero
  const orden = ["🩺 BOTS", "💳 SALDO Y COBROS", "🚫 ANUNCIOS RECHAZADOS", "🏄 SURFEOS", "🎬 RENOVACIONES", "⚖️ RECLAMOS"];
  const grupos = new Map();
  for (const x of hacer) { const k = x.sec || "otros"; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(x); }
  const gOrd = [...grupos.keys()].sort((a, b) => (orden.indexOf(a) + 1 || 99) - (orden.indexOf(b) + 1 || 99));
  const listaHacer = `${vivos.length ? `<ul class="jv-lista">${vivos.map(tarjetaVivo).join("")}</ul>` : ""}
    ${gOrd.map((k) => { const xs = grupos.get(k), [, ic, nom] = secInfo(k), abierta = J.abiertas.has("h:" + k), vis = abierta ? xs : xs.slice(0, 4);
      return `<div class="jv-grupo"><h4>${ic} ${esc(nom)} <span>${xs.length}</span></h4><ul class="jv-lista">${vis.map(tarjetaHacer).join("")}</ul>
        ${xs.length > 4 ? `<button type="button" class="jv-mas" data-abrir="h:${esc(k)}">${abierta ? "Ver menos" : `Ver ${xs.length - 4} más`}</button>` : ""}</div>`; }).join("")}`;

  // Novedades: filtros por tema
  const temas = [...new Set(nov.map((x) => x.sec || "otros"))].sort((a, b) => (SECS.findIndex((s) => s[0] === a) + 1 || 99) - (SECS.findIndex((s) => s[0] === b) + 1 || 99));
  if (J.filtro !== "todas" && !temas.includes(J.filtro)) J.filtro = "todas";
  const nf = J.filtro === "todas" ? nov : nov.filter((x) => (x.sec || "otros") === J.filtro);
  const abiertaN = J.abiertas.has("nov"), visN = abiertaN ? nf : nf.slice(0, 8);

  J.raiz.innerHTML = `
    <header class="jv-hero">
      <div><p class="jv-fecha">${esc(new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }))}</p>
        <h2>${saludo()}</h2><p class="jv-frase">${frase(nH)}</p></div>
      <button type="button" class="jv-refrescar" id="jv-ref" aria-label="Actualizar"><span class="${J.cargando ? "gira" : ""}">↻</span></button>
    </header>
    <div class="jv-kpis">${kpi("Hoy", J.hoy, "#dash")}${kpi("Ayer", J.ayer, "#dash")}</div>
    ${J.err && !J.d ? `<div class="err-box" role="alert"><b>No pude leer los avisos.</b> ${esc(J.err)} <button type="button" class="btn chico" id="jv-reint">Reintentar</button></div>` : ""}
    <section class="jv-panel jv-hacer" aria-labelledby="jv-th">
      <header><h3 id="jv-th">Para hacer${nH ? ` <span class="jv-cont">${nH}</span>` : ""}</h3></header>
      ${!J.d ? `<p class="vacio chico"><span class="cargador"></span>Mirando todo…</p>` : nH ? listaHacer : `<p class="jv-vacio">✨ Nada pendiente. Disfrutá.</p>`}
      ${hechas.length ? `<button type="button" class="jv-mas" id="jv-ver-hechas">${J.verHechas ? "Ocultar hechas" : `✓ ${hechas.length} hecha${hechas.length > 1 ? "s" : ""} hoy`}</button>
        ${J.verHechas ? `<ul class="jv-lista jv-hechas">${hechas.map((x) => `<li class="jv-tarea jv-ok"><span class="jv-ico">✓</span><div class="jv-cuerpo"><p>${md(sinIcono(x.texto)).html}</p><div class="jv-acc"><span class="jv-cuando">${esc(x.hecho_por || "")} · ${esc(hace(x.hecho_en))}</span><button type="button" class="jv-ir" data-deshacer="${x.id}">Deshacer</button></div></div></li>`).join("")}</ul>` : ""}` : ""}
    </section>
    <section class="jv-panel" aria-labelledby="jv-tn">
      <header><h3 id="jv-tn">Novedades</h3></header>
      ${temas.length > 1 ? `<div class="jv-filtros" role="tablist">${[["todas", "", "Todas"], ...temas.map((t) => secInfo(t))].map(([k, ic, nom]) => `<button type="button" role="tab" class="jv-fil" data-fil="${esc(k)}" aria-selected="${J.filtro === k}">${ic ? ic + " " : ""}${esc(nom)}</button>`).join("")}</div>` : ""}
      ${!J.d ? `<p class="vacio chico"><span class="cargador"></span>Cargando…</p>` : nf.length ? `<ul class="jv-feed">${visN.map((x) => { const { html, urls } = md(sinIcono(x.texto)); return `<li><span class="jv-ico" aria-hidden="true">${icono(x.texto)}</span><div class="jv-cuerpo"><p>${html}</p><div class="jv-acc">${botones(x, urls)}<span class="jv-cuando">${esc(hace(x.t))}</span></div></div></li>`; }).join("")}</ul>
        ${nf.length > 8 ? `<button type="button" class="jv-mas" data-abrir="nov">${abiertaN ? "Ver menos" : `Ver ${nf.length - 8} más`}</button>` : ""}` : `<p class="jv-vacio">Sin novedades en las últimas 36 h.</p>`}
    </section>
    <p class="jv-pie">Lo mismo te llega por Telegram. ${J.d ? `Actualizado ${esc(hace(J.d.generado))}.` : ""}</p>`;
}

// ---------- eventos (delegados, una sola vez por raíz) ----------
function enlazar() {
  J.raiz.addEventListener("click", async (e) => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.id === "jv-ref") { J.cargando = true; pintar(); await cargar(true); J.cargando = false; pintar(); return; }
    if (t.id === "jv-reint") { cargar(); return; }
    if (t.id === "jv-ver-hechas") { J.verHechas = !J.verHechas; pintar(); return; }
    if (t.dataset.url) { abrir(t.dataset.url); return; }
    if (t.dataset.fil) { J.filtro = t.dataset.fil; ls.set("jv_filtro", J.filtro); J.abiertas.delete("nov"); pintar(); return; }
    if (t.dataset.abrir) { const k = t.dataset.abrir; J.abiertas.has(k) ? J.abiertas.delete(k) : J.abiertas.add(k); pintar(); return; }
    if (t.dataset.hecho || t.dataset.deshacer) {
      const id = Number(t.dataset.hecho || t.dataset.deshacer), deshacer = !!t.dataset.deshacer;
      const x = (J.d?.feed || []).find((f) => f.id === id); if (!x) return;
      const li = t.closest("li");
      if (!deshacer && li && !matchMedia("(prefers-reduced-motion: reduce)").matches) { li.classList.add("jv-saliendo"); await new Promise((ok) => setTimeout(ok, 260)); }
      const antes = { por: x.hecho_por, en: x.hecho_en };
      x.hecho_por = deshacer ? null : (J.ctx.nombre?.() || "vos"); x.hecho_en = deshacer ? null : new Date().toISOString(); pintar();
      try { await api("hecho", { id, deshacer }); if (!deshacer) J.ctx.toast?.("Listo ✓", "ok", 1800); }
      catch (err) { x.hecho_por = antes.por; x.hecho_en = antes.en; pintar(); J.ctx.toast?.("No se pudo guardar: " + err.message, "error"); }
    }
  });
}

function montar(raiz, ctx) {
  J.raiz = raiz; J.ctx = ctx || {};
  enlazar(); pintar(); cargar();
  clearInterval(J.timer);
  J.timer = setInterval(() => { if (!vivo()) { clearInterval(J.timer); return; } if (!document.hidden) cargar(true); }, 2 * 60e3);
}

// ---------- modo demo ----------
function demo(q) {
  if (q !== "inicio") return { ok: true };
  const t = (min) => new Date(Date.now() - min * 60e3).toISOString();
  return { generado: t(0), vivo: { bots: [], pagos: [], whop: 1450, en24: 2100 }, feed: [
    { id: 1, t: t(12), sec: "🏄 SURFEOS", tipo: "hacer", texto: "🔴 *Panza Cero 40+ · CP12*\nLa subiste hace 3 h y aflojó. Mirala.", botones: [{ titulo: "📈 Ver campaña", url: "#dash" }] },
    { id: 2, t: t(40), sec: "🎬 RENOVACIONES", tipo: "hacer", texto: "💸 *Falta saldo* en ElevenLabs y hay renos en proceso: cargá así no se frenan.", botones: [{ titulo: "🎬 Ver saldos", url: "#workspace" }] },
    { id: 3, t: t(55), sec: "🚫 ANUNCIOS RECHAZADOS", tipo: "hacer", texto: "🆕 *Rechazaron una reno nueva* de Yogur · CP7\n«AD3 R2». Es de la tanda 03.11: hay que cambiarla o apelar." },
    { id: 4, t: t(20), sec: "🏆 WINNERS", tipo: "info", texto: "🏆 *Nuevo winner en Hígado*: «AD5 hook 2» — 9 ventas, ROAS 2,4. Gana en 3 de 4 cuentas.", botones: [{ titulo: "🏆 Ver winners", url: "#ranking" }] },
    { id: 5, t: t(90), sec: "🎬 RENOVACIONES", tipo: "info", texto: "🎬 *Yogur 04.11*: 6/10 ▰▰▰▰▰▰▱▱▱▱" },
    { id: 6, t: t(300), sec: "🌐 ESCALA HORIZONTAL", tipo: "info", texto: "🌐 Hay *5 cuentas libres* para escala horizontal: CP19, CP20, CP21, CP26, CP27" },
  ] };
}

window.Jarvis = { montar };
})();

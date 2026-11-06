/* Reportes v2 (02/11 noche, Lorenzo): UNA página, compacta, todo a la vista.
   Tarjetas: Saldo de EtherFi a cargar · Limpiador de anuncios (Optimizar) · Rechazos (winners primero) · Winners nuevos y
   envejeciendo · Cuentas nuevas. Cada tarjeta muestra lo importante y «Ver todo» abre la lista completa.
   Lo de surfeos salió de acá: ahora vive en el Dashboard (columna «Última modificación» + flechita al lado del ROAS).
   Nada toca Meta sin un toque y una confirmación (apagar anuncios pasa por app-movil con ctx.estado).
   Backend: Edge Function «reportes» (scripts/supabase/reportes/index.ts) + cuentas-umbral (saldo y umbrales). */
"use strict";
(() => {
const API = "https://tppcpnfzcxxusdhrlmdx.supabase.co/functions/v1/reportes";
const API_UMB = "https://tppcpnfzcxxusdhrlmdx.supabase.co/functions/v1/cuentas-umbral";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ls = { get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const clave = () => ls.get("dash_clave", "");
const NF0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }), NF2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd = (n) => n == null || !Number.isFinite(Number(n)) ? "—" : "US$ " + NF0.format(Number(n));
const ro = (n) => n == null ? "—" : NF2.format(Number(n));
const rc = (r) => r == null ? "" : r >= 2 ? "rp-v" : r >= 1.22 ? "rp-a" : "rp-r";
const corto = (n) => String(n || "").replace(/ Cuenta publicitaria( USD)?/i, "");
const fch = (d) => d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "";
const R = { raiz: null, ctx: {}, d: {}, per: ls.get("rp_limp_per", "3d"), umb: null };

async function api(q, body = null) {
  const r = await fetch(`${API}?${q}`, { method: body ? "POST" : "GET", headers: { "x-app-clave": clave(), "x-app-usuario": R.ctx.usuario?.() || "", ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" }).catch(() => null);
  if (!r) throw new Error("Sin conexión");
  if (r.status === 401) { R.ctx.login?.("Volvé a entrar para ver Reportes."); throw new Error("Clave incorrecta"); }
  const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || `Error ${r.status}`); return j;
}
const toast = (m, t = "ok", ms) => R.ctx.toast?.(m, t, ms);
const met = (m) => `<span class="rp-m"><b class="${rc(m?.roas)}">${ro(m?.roas)}</b><small>${m?.v ?? 0} v · ${usd(m?.g)}</small></span>`;
const links = (link, post) => `<span class="rp-lks">${link ? `<a href="${esc(link)}" target="_blank" rel="noopener" class="rp-lk" title="Abrir en el Administrador de anuncios">Ads</a>` : ""}${post ? `<a href="${esc(post)}" target="_blank" rel="noopener" class="rp-lk" title="Ver la publicación">Post</a>` : ""}</span>`;
const card = (id, titulo, cuerpo, extraCab = "", pie = "") => `<section class="rp-card2" data-card="${id}"><header><h3>${titulo}</h3>${extraCab}</header>${cuerpo}${pie ? `<footer>${pie}</footer>` : ""}</section>`;
const cargando = (t) => `<p class="vacio chico"><span class="cargador"></span>${t}</p>`;

// ---------- tarjetas ----------
function cardSaldo() {
  const u = R.umb, T = "Saldo de EtherFi";
  if (!u) return card("saldo", T, cargando("Leyendo…"));
  if (u.__error) return card("saldo", T, `<p class="mut">No se pudo leer: ${esc(u.__error)}</p>`);
  const w = u.whop || {}, saldo = Number(w.saldo || 0), xs = (u.cuentas || []).filter((c) => String(c.moneda || "USD").toUpperCase() === "USD" && c.umbral > 0 && c.gasto_dia > 0);
  // cobros que Meta va a hacer en las próximas h horas: cada cuenta cobra un umbral cada vez que lo gastado sin cobrar lo alcanza
  const cobros = (h) => xs.reduce((t, c) => t + Math.floor((Number(c.saldo || 0) + c.gasto_dia * h / 24) / c.umbral) * c.umbral, 0);
  const H = [6, 12, 24].map((h) => ({ h, c: cobros(h), falta: Math.max(0, cobros(h) - saldo) }));
  const f24 = H[2].falta, viejo = w.leido_en && Date.now() - Date.parse(w.leido_en) > 10 * 60e3;
  const prox = xs.filter((c) => c.cobra_en_h != null).sort((a, b) => a.cobra_en_h - b.cobra_en_h).slice(0, 4);
  return card("saldo", T, `
    <div class="rp-grande ${f24 > 0 ? "mal" : "bien"}"><small>${f24 > 0 ? "Cargá para las próximas 24 h" : "Alcanza para las próximas 24 h"}</small><b>${f24 > 0 ? usd(Math.ceil(f24 / 10) * 10) : "✓"}</b>
      <span>Saldo ${usd(saldo)}${viejo ? ` · <span class="rp-r">dato de las ${new Date(w.leido_en).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>` : ""}${(w.rechazos || []).length ? ` · <span class="rp-r">${w.rechazos.length} cobros rechazados hoy</span>` : ""}</span></div>
    <div class="rp-mini3">${H.map((x) => `<span><small>Próximas ${x.h} h</small><b>${usd(x.c)}</b><i class="${x.falta > 0 ? "rp-r" : "rp-v"}">${x.falta > 0 ? `faltan ${usd(x.falta)}` : "cubre"}</i></span>`).join("")}</div>
    <ul class="rp-filas">${prox.map((c) => `<li><span>${esc(corto(c.nombre))}</span><span class="mut">cobra en ~${c.cobra_en_h < 1 ? "<1" : Math.round(c.cobra_en_h)} h</span><b>${usd(c.umbral)}</b></li>`).join("")}</ul>
    <p class="rp-nota-pie">Si el saldo no alcanza, la tarjeta rechaza y la cuenta se frena. Meta cobra sobre todo a la mañana: cargá antes de las 9 h.</p>`);
}
function cardLimpiador() {
  const d = R.d.limpiador, per = R.per, T = "Limpiador de anuncios";
  const tog = `<span class="rp-per">${[["hoy", "Hoy"], ["3d", "3 días"], ["total", "Total"]].map(([k, t]) => `<button type="button" data-per="${k}" aria-pressed="${k === per}">${t}</button>`).join("")}</span>`;
  if (!d) return card("limp", T, cargando("Revisando campañas…"), tog);
  if (d.__error) return card("limp", T, `<p class="mut">${esc(d.__error)}</p>`, tog);
  const cands = d.campanas.flatMap((c) => c.conjuntos.flatMap((s) => s.ads.filter((a) => a.candidato)));
  const n = cands.length, gasto = cands.reduce((t, a) => t + a.g, 0);
  return card("limp", T, `
    <div class="rp-grande ${n ? "mal" : "bien"}"><small>${n ? "Anuncios para apagar" : "Nada para apagar"}</small><b>${n || "✓"}</b><span>${n ? `${usd(gasto)} gastados con ROAS &lt; ${ro(d.l_roas)} · en ${d.campanas.filter((c) => c.candidatos).length} campañas` : `Ninguna campaña con ROAS &lt; ${ro(d.l_roas)} tiene anuncios así`}</span></div>
    <ul class="rp-filas">${d.campanas.slice(0, 4).map((c) => `<li><span>${esc(c.nombre)}<small class="mut"> · ${esc(c.cuenta || "")}</small></span>${met(c)}<b>${c.candidatos ? `${c.candidatos} ads` : "—"}</b></li>`).join("") || `<li class="mut">Ninguna campaña con ROAS &lt; ${ro(d.l_roas)} en este período.</li>`}</ul>
    <p class="rp-nota-pie">Campaña con ROAS &lt; ${ro(d.l_roas)} → conjunto &lt; ${ro(d.l_roas)} → anuncio &lt; ${ro(d.l_roas)} con ${usd(d.l_gasto)} o más gastados.</p>`,
    tog, d.campanas.length ? `<button class="btn chico pri" data-abrir="limp">Revisar y optimizar</button>` : "");
}
function cardRechazos() {
  const d = R.d.rechazos, T = "Rechazos y anuncios con problemas";
  if (!d) return card("rech", T, cargando("Buscando…"));
  if (d.__error) return card("rech", T, `<p class="mut">${esc(d.__error)}</p>`);
  const w = d.anuncios.filter((a) => a.winner);
  return card("rech", T, `
    <div class="rp-grande ${d.winners ? "mal" : "bien"}"><small>Winners rechazados</small><b>${d.winners}</b><span>${d.con_ventas} vendieron en 7 días · ${d.total} en total (${d.por_estado?.DISAPPROVED ?? 0} rechazados, ${d.por_estado?.WITH_ISSUES ?? 0} con problemas)</span></div>
    <ul class="rp-filas">${w.slice(0, 4).map((a) => `<li><span>${esc(a.nombre)}<small class="mut"> · ${esc(a.cuenta)}</small></span>${met(a.m7)}${links(a.link, a.post)}</li>`).join("") || `<li class="mut">Ningún winner rechazado.</li>`}</ul>`,
    "", `<button class="btn chico" data-abrir="rech">Ver todos</button>`);
}
// el mismo creativo en varias cuentas o publicaciones va junto
function porNombre(xs, k) {
  const m = new Map();
  for (const x of xs) { const e = m.get(x.nombre) ?? { nombre: x.nombre, items: [], tot: { g: 0, v: 0, val: 0 }, prev: { g: 0, v: 0, val: 0 }, rec: { g: 0, v: 0, val: 0 } };
    e.items.push(x); for (const p of ["tot", "prev", "rec"]) { e[p].g += x[p].g; e[p].v += x[p].v; e[p].val += x[p].val; } m.set(x.nombre, e); }
  for (const e of m.values()) for (const p of ["tot", "prev", "rec"]) e[p].roas = e[p].g ? e[p].val / e[p].g : null;
  return [...m.values()].sort((a, b) => k === "env" ? b.prev.g - a.prev.g : (b.tot.val - b.tot.g) - (a.tot.val - a.tot.g));
}
function cardWinners() {
  const d = R.d.winners, T = "Winners";
  if (!d) return card("win", T, cargando("Buscando…"));
  if (d.__error) return card("win", T, `<p class="mut">${esc(d.__error)}</p>`);
  const N = porNombre(d.nuevos, "nuevo"), E = porNombre(d.envejeciendo, "env");
  const fila = (e, env) => `<li><span>${esc(e.nombre)}<small class="mut"> · ${e.items.length} ${e.items.length === 1 ? "publicación" : "publicaciones"}</small></span>${env ? `<span class="rp-m"><b class="${rc(e.prev.roas)}">${ro(e.prev.roas)}</b><small>antes</small></span><span class="rp-m"><b class="${rc(e.rec.roas)}">${ro(e.rec.roas)}</b><small>ayer + hoy</small></span>` : met(e.tot)}${links(e.items[0].ads[0]?.link, e.items[0].link_post)}</li>`;
  return card("win", T, `
    <div class="rp-dos"><div><h4>Nuevos <b>${N.length}</b></h4><ul class="rp-filas">${N.slice(0, 4).map((e) => fila(e, false)).join("") || `<li class="mut">Ninguno nuevo.</li>`}</ul></div>
      <div><h4>Envejeciendo <b>${E.length}</b></h4><ul class="rp-filas">${E.slice(0, 4).map((e) => fila(e, true)).join("") || `<li class="mut">Ningún winner cayendo.</li>`}</ul></div></div>
    <p class="rp-nota-pie">Nuevo: empezó hace poco, 5+ ventas y ROAS &gt; 2. Envejeciendo: fue winner los 4 días anteriores y ayer + hoy va con ROAS &lt; 1,3: pedí renos de ese.</p>`,
    "", `<button class="btn chico" data-abrir="win">Ver todos</button>`);
}
function cardNuevas() {
  const d = R.d.nuevas, T = "Cuentas nuevas";
  if (!d) return card("nuevas", T, cargando("…"));
  if (d.__error) return card("nuevas", T, `<p class="mut">${esc(d.__error)}</p>`);
  const mal = d.cuentas.filter((c) => c.mal);
  return card("nuevas", T, `
    <div class="rp-grande ${mal.length ? "mal" : "bien"}"><small>${mal.length ? "Vienen mal" : "Vienen bien"}</small><b>${mal.length}/${d.cuentas.length}</b><span>cuentas que empezaron a gastar en los últimos ${d.dias} días</span></div>
    <ul class="rp-filas">${d.cuentas.slice(0, 6).map((c) => `<li><span>${esc(corto(c.cuenta))}<small class="mut"> · desde ${fch(c.desde)} · ${c.campanas} camp.</small></span>${met(c.total)}<b class="${c.total.gan >= 0 ? "rp-v" : "rp-r"}">${usd(c.total.gan)}</b></li>`).join("") || `<li class="mut">No hay cuentas nuevas.</li>`}</ul>`);
}

// ---------- «Ver todo» y optimizar ----------
function cerrable(m) { const x = $("[data-x]", m.dlg); if (x) x.onclick = m.cerrar; return m; }
function verRechazos() {
  const d = R.d.rechazos; if (!d) return;
  cerrable(R.ctx.abrirModal(`<h3>Rechazos y anuncios con problemas</h3><p class="mut">Métricas de los últimos 7 días. Primero los winners y los que vendieron (${d.anuncios.length} de ${d.total}).</p>
    <div class="rp-lista2">${d.anuncios.map((a) => `<div class="rp-it"><div><b>${esc(a.nombre)}</b>${a.winner ? ` <span class="rp-tag v">winner</span>` : ""} <span class="rp-tag ${a.estado === "DISAPPROVED" ? "r" : "a"}">${a.estado === "DISAPPROVED" ? "rechazado" : "con problemas"}</span>
      <small class="mut">${esc(a.cuenta)} · ${esc(a.campana?.nombre || "")} › ${esc(a.conjunto?.nombre || "")}</small>${a.motivos?.length ? `<small class="rp-mot">${esc(a.motivos.join(" · "))}</small>` : ""}</div>${met(a.m7)}${links(a.link, a.post)}</div>`).join("")}</div>
    <div class="botones"><button class="btn" data-x>Cerrar</button></div>`, { ancho: true }));
}
function verWinners() {
  const d = R.d.winners; if (!d) return;
  const bloque = (xs, env) => porNombre(xs, env ? "env" : "nuevo").map((e) => `<div class="rp-it rp-it-col"><div><b>${esc(e.nombre)}</b> ${env ? `<span class="rp-m-inline">antes <b class="${rc(e.prev.roas)}">${ro(e.prev.roas)}</b> (${e.prev.v} v) → ayer + hoy <b class="${rc(e.rec.roas)}">${ro(e.rec.roas)}</b> (${e.rec.v} v, ${usd(e.rec.g)})</span>` : `<span class="rp-m-inline"><b class="${rc(e.tot.roas)}">${ro(e.tot.roas)}</b> · ${e.tot.v} ventas · ${usd(e.tot.g)} gastados · ganancia ${usd(e.tot.val * 0.9 - e.tot.g)}</span>`}</div>
    ${e.items.map((it) => `<div class="rp-sub"><span class="mut">${it.ads.map((a) => `${esc(a.cuenta)} › ${esc(a.campana)}`).slice(0, 3).join(" · ")}${it.ads.length > 3 ? ` +${it.ads.length - 3}` : ""}</span>${met(env ? it.rec : it.tot)}${links(it.ads[0]?.link, it.link_post)}</div>`).join("")}</div>`).join("");
  cerrable(R.ctx.abrirModal(`<h3>Winners</h3><h4 class="rp-h4">Nuevos</h4><div class="rp-lista2">${bloque(d.nuevos, false) || `<p class="mut">Ninguno.</p>`}</div>
    <h4 class="rp-h4">Envejeciendo</h4><div class="rp-lista2">${bloque(d.envejeciendo, true) || `<p class="mut">Ninguno.</p>`}</div><div class="botones"><button class="btn" data-x>Cerrar</button></div>`, { ancho: true }));
}
function verLimpiador() {
  const d = R.d.limpiador; if (!d) return;
  const sel = new Set(d.campanas.flatMap((c) => c.conjuntos.flatMap((s) => s.ads.filter((a) => a.candidato).map((a) => a.id))));
  const fila = (x, nivel, chk) => `<div class="rp-lf n${nivel}${nivel === 1 && !x.malo ? " bien" : ""}">${chk ?? "<span></span>"}<span class="rp-lf-nom">${esc(x.nombre)}${x.activo === false ? ` <small class="mut">(apagado)</small>` : ""}${nivel === 0 ? `<small class="mut"> · ${esc(x.cuenta || "")}</small>` : ""}</span><span data-l="Gastado">${usd(x.g)}</span><span data-l="Ventas">${x.v}</span><span data-l="ROAS" class="${rc(x.roas)}">${ro(x.roas)}</span><span data-l="Profit" class="${x.gan >= 0 ? "rp-v" : "rp-r"}">${usd(x.gan)}</span>${x.link ? links(x.link) : "<span></span>"}</div>`;
  const m = R.ctx.abrirModal(`<h3>Limpiador · ${d.periodo === "hoy" ? "hoy" : d.periodo === "3d" ? "últimos 3 días" : "total"}</h3>
    <p class="mut">Tildados: anuncios prendidos con ROAS &lt; ${ro(d.l_roas)} y ${usd(d.l_gasto)} o más gastados, dentro de conjuntos con ROAS &lt; ${ro(d.l_roas)}. Destildá los que quieras dejar. El período se cambia en la tarjeta (Hoy · 3 días · Total).</p>
    <div class="rp-lf rp-lf-th"><span></span><span>Campaña › conjunto › anuncio</span><span>Gastado</span><span>Ventas</span><span>ROAS</span><span>Profit</span><span></span></div>
    <div class="rp-lista2 rp-lf-lista">${d.campanas.map((c) => fila(c, 0) + c.conjuntos.map((s) => fila(s, 1) + s.ads.map((a) => fila(a, 2, a.activo ? `<label class="rp-check"><input type="checkbox" data-ad="${esc(a.id)}" data-act="${esc(c.act)}" data-nom="${esc(a.nombre)}"${sel.has(a.id) ? " checked" : ""}><i></i></label>` : "<span></span>")).join("")).join("")).join("")}</div>
    <div class="botones"><button class="btn" data-x>Cerrar</button><button class="btn pri" data-opt>Optimizar: apagar ${sel.size}</button></div>`, { ancho: true });
  cerrable(m);
  const b = $("[data-opt]", m.dlg);
  $$("[data-ad]", m.dlg).forEach((c) => c.onchange = () => { c.checked ? sel.add(c.dataset.ad) : sel.delete(c.dataset.ad); b.textContent = `Optimizar: apagar ${sel.size}`; delete b.dataset.seguro; });
  b.onclick = async () => {
    if (!sel.size) return;
    if (b.dataset.seguro !== "1") { b.dataset.seguro = "1"; b.textContent = `¿Seguro? Apagar ${sel.size} anuncios`; return; }
    b.classList.add("cargando"); b.textContent = "Apagando…";
    const items = $$("[data-ad]", m.dlg).filter((c) => sel.has(c.dataset.ad)).map((c) => ({ id: c.dataset.ad, act: c.dataset.act, nivel: "anuncio", nombre: c.dataset.nom }));
    try { const r = await R.ctx.estado(items, "PAUSED"); const ok = r.filter((x) => x.ok).length;
      toast(`✓ Apagados ${ok} de ${items.length} anuncios.`, ok === items.length ? "ok" : "error", 9000); m.cerrar(); cargar("limpiador", true); }
    catch (e) { toast(`No se pudo: ${esc(e.message)}`, "error", 9000); b.classList.remove("cargando"); b.textContent = "Reintentar"; }
  };
}
async function verConfig() {
  let d; try { d = await api("accion=config"); } catch (e) { return toast(esc(e.message), "error"); }
  const usar = /^(Limpiador|Winners|Cuentas nuevas|F · Mínimos)$/;
  const grupos = []; for (const x of d.esquema) { if (!usar.test(x.g) && !(x.g === "General" && x.k === "roas_equilibrio")) continue; let g = grupos.find((y) => y.g === x.g); if (!g) grupos.push(g = { g: x.g, xs: [] }); g.xs.push(x); }
  const campo = (x) => x.t === "bool" ? `<label class="rp-sw"><input type="checkbox" data-k="${esc(x.k)}" ${x.valor ? "checked" : ""}> <span>${esc(x.n)}</span></label>`
    : `<label class="rp-campo"><span>${esc(x.n)}</span><input class="campo num" data-k="${esc(x.k)}" value="${esc(x.t === "texto" ? x.valor : NF2.format(x.valor).replace(/,00$/, ""))}" inputmode="decimal"><small class="mut">${x.a ? esc(x.a) + " · " : ""}fábrica: ${esc(String(x.def))}</small></label>`;
  const m = cerrable(R.ctx.abrirModal(`<h3>Umbrales</h3><div class="rp-config">${grupos.map((g) => `<fieldset class="rp-grupo"><legend>${esc(g.g === "General" ? "General" : g.g)}</legend>${g.xs.map(campo).join("")}</fieldset>`).join("")}</div>
    <div class="botones"><button class="btn" data-x>Cancelar</button><button class="btn pri" data-ok>Guardar</button></div>`, { ancho: true }));
  $("[data-ok]", m.dlg).onclick = async () => {
    const valores = {}; $$("[data-k]", m.dlg).forEach((i) => valores[i.dataset.k] = i.type === "checkbox" ? i.checked : i.value.trim().replace(/\./g, "").replace(",", "."));
    try { await api("accion=config", { valores }); toast("✓ Umbrales guardados.", "ok"); m.cerrar(); cargarTodo(true); } catch (e) { toast(esc(e.message), "error", 8000); }
  };
}

// ---------- pintar y cargar ----------
function pintar() {
  if (!R.raiz) return;
  R.raiz.innerHTML = `<div class="rp2">
    <div class="rp2-top"><p class="mut">Lo que hay que mirar hoy, en una pantalla. «Ver todo» abre el detalle.</p>
      <span class="rp2-bot"><button class="btn chico" data-cfg>Umbrales</button><button class="btn chico" data-rec>↻ Actualizar</button></span></div>
    <div class="rp2-grid">${cardSaldo()}${cardLimpiador()}${cardRechazos()}${cardWinners()}${cardNuevas()}</div></div>`;
  const r = R.raiz;
  $("[data-rec]", r).onclick = () => cargarTodo(true);
  $("[data-cfg]", r).onclick = verConfig;
  $$("[data-per]", r).forEach((b) => b.onclick = () => { R.per = b.dataset.per; ls.set("rp_limp_per", R.per); R.d.limpiador = null; pintar(); cargar("limpiador"); });
  $$("[data-abrir]", r).forEach((b) => b.onclick = () => ({ limp: verLimpiador, rech: verRechazos, win: verWinners })[b.dataset.abrir]?.());
}
async function cargar(k, forzar = false) {
  const q = k === "limpiador" ? `accion=resumen&tab=limpiador&periodo=${R.per}` : `accion=resumen&tab=${k}`;
  try { R.d[k] = await api(q + (forzar ? "&forzar=1" : "")); } catch (e) { R.d[k] = { __error: e.message }; }
  const y = window.scrollY; pintar(); window.scrollTo({ top: y });
}
async function cargarUmb() {
  try { const r = await fetch(`${API_UMB}?accion=ver`, { headers: { "x-app-clave": clave() }, cache: "no-store" }); const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || `Error ${r.status}`); R.umb = j; }
  catch (e) { R.umb = { __error: e.message }; }
  const y = window.scrollY; pintar(); window.scrollTo({ top: y });
}
function cargarTodo(forzar = false) {
  if (!forzar) { R.d = {}; R.umb = null; }
  pintar();
  cargarUmb(); for (const k of ["limpiador", "rechazos", "winners", "nuevas"]) cargar(k, forzar);
}
window.Reportes = { config(ctx) { R.ctx = ctx || {}; verConfig(); }, montar(raiz, ctx) { R.raiz = raiz; R.ctx = ctx || {}; document.getElementById("rp-selbar")?.remove(); cargarTodo(false); } };
})();

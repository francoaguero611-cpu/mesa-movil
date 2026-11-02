/* Reportes — sección del Dashboard desde el 02/11 (Lorenzo). Control de las consecuencias de lo que hacemos:
   Surfeos (cada cambio de presupuesto con su antes / 3 h / 24 h / 48 h y botón de techo) · Campañas (las que vienen mal, hora contra
   hora, con limpieza de anuncios) · Cuentas · Gastos (Meta contra Whop) · Mínimos · Escala (cuentas nuevas) · Bot (propuestas del
   simulacro) · Configuración (todos los umbrales, editables).
   Nada toca Meta sin un toque y una confirmación: las acciones pasan por app-movil con las funciones del ctx que da app.js.
   app.js lo carga la primera vez que se entra y lo monta con window.Reportes.montar(raiz, ctx).
   Backend: Edge Function «reportes» (copia en Segundo-cerebro-business/scripts/supabase/reportes/index.ts). */
"use strict";
(() => {
const API = "https://tppcpnfzcxxusdhrlmdx.supabase.co/functions/v1/reportes";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ls = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const clave = () => ls.get("dash_clave", "");
const NF0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }), NF2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd = (n) => n == null || !Number.isFinite(Number(n)) ? "—" : "US$ " + NF0.format(Number(n));
const usd2 = (n) => n == null || !Number.isFinite(Number(n)) ? "—" : NF2.format(Number(n));
const ro = (n) => n == null ? "—" : NF2.format(Number(n));
const a55 = (n) => Math.round((Math.floor(n) + 0.55) * 100) / 100;
const fecha = (f) => { try { return new Date(f).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
const hace = (f) => { const m = Math.round((Date.now() - Date.parse(f)) / 60e3); return m < 60 ? `hace ${m} min` : m < 48 * 60 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} días`; };

const TABS = [
  ["surfeos", "Surfeos"], ["campanas", "Campañas"], ["cuentas", "Cuentas"], ["gastos", "Gastos"],
  ["minimos", "Mínimos"], ["escala", "Escala"], ["bot", "Bot"], ["config", "Configuración"],
];
const R = { raiz: null, ctx: {}, tab: ls.get("rp_tab", "surfeos"), datos: {}, filtro: ls.get("rp_filtro", "todos"), cfg: null, cargando: false };

async function api(q, body = null) {
  const r = await fetch(`${API}?${q}`, { method: body ? "POST" : "GET", headers: { "x-app-clave": clave(), "x-app-usuario": R.ctx.usuario?.() || "", ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" }).catch(() => null);
  if (!r) throw new Error("Sin conexión con el servidor");
  if (r.status === 401) { R.ctx.login?.("Volvé a entrar para ver Reportes."); throw new Error("Clave incorrecta"); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `Error ${r.status}`);
  return j;
}
const toast = (m, t = "ok", ms) => R.ctx.toast?.(m, t, ms);

// ---------- piezas ----------
const roasCls = (r, eq = 1.22) => r == null ? "" : r >= 2 ? "rp-v" : r >= eq ? "rp-a" : "rp-r";
const chip = (txt, cls = "") => `<span class="rp-chip ${cls}">${txt}</span>`;
const ESTADO_SURF = {
  seguimiento: ["⏳ En seguimiento", ""], bajo: ["🔴 Bajo rendimiento", "rp-chip-r"], rindio: ["🟢 Rindió", "rp-chip-v"], empate: ["🟡 Empate", "rp-chip-a"],
  techo: ["🔴 Techo", "rp-chip-r"], techo_marcado: ["🧱 Techo marcado", "rp-chip-g"], mejoro: ["🟢 Mejoró después de bajarla", "rp-chip-v"], sigue_mal: ["🔴 Sigue mal", "rp-chip-r"],
};
const VER = { bajo: "🔴 bajo", ok: "✓ bien", rindio: "🟢 rindió", empate: "🟡 empate", techo: "🔴 techo", mejoro: "🟢 mejoró", sigue_mal: "🔴 sigue mal", pocos: "poco gasto todavía" };
function segs(opts, val, attr) { return `<div class="rp-segs" role="group">${opts.map(([k, t]) => `<button type="button" class="rp-seg" ${attr}="${esc(k)}" aria-pressed="${k === val}">${t}</button>`).join("")}</div>`; }
function confirmar(titulo, cuerpo, si, accion) {
  let enviando = false;
  const m = R.ctx.abrirModal(`<h3>${titulo}</h3>${cuerpo}${R.ctx.demo ? `<p class="mut">Demo: no toca Meta.</p>` : R.ctx.prueba ? `<p class="mut"><b>Modo prueba:</b> Meta no se toca.</p>` : ""}
    <div class="botones"><button class="btn" data-x>Cancelar</button><button class="btn pri" data-ok data-foco>${si}</button></div>`, { bloqueado: () => enviando });
  $("[data-x]", m.dlg).onclick = m.cerrar;
  $("[data-ok]", m.dlg).onclick = async (e) => {
    enviando = true; const b = e.currentTarget; b.classList.add("cargando"); b.innerHTML = `<span class="gira">↻</span> Haciendo…`;
    try { await accion(); } catch (err) { toast(`No se pudo: ${esc(err.message)}`, "error", 8000); }
    enviando = false; m.cerrar();
  };
  return m;
}

// ---------- acciones ----------
async function volverConTecho(s) {
  const de = Number(s.de), ahora = Number(s.ahora ?? s.a);
  confirmar("¿Volver al presupuesto de antes y marcar techo?", `<p><b>${esc(s.nombre)}</b>${s.cuenta ? ` · ${esc(s.cuenta)}` : ""}</p>
    <p>Presupuesto: ${usd2(ahora)} → <b>${usd2(de)}</b></p><p class="mut">Queda con 🧱 techo en ${usd2(de)}: el Dashboard te avisa si la querés subir de nuevo.</p>`,
    `Sí, volver a ${usd2(de)} y marcar techo`, async () => {
      if (Math.abs(ahora - de) > 0.01) {
        const r = await R.ctx.presupuesto({ id: s.campana_id, act: s.act, nombre: s.nombre, monto: de });
        if (!r.ok) throw new Error(r.error || "Meta no lo aplicó");
        if (r.simulado) { toast("Modo prueba: Meta no se tocó y no se marcó el techo.", "ok", 7000); return; }
      }
      await api("accion=techo", { id: s.campana_id, act: s.act, nombre: s.nombre, monto: de, motivo: `surfeo ${usd2(s.de)} → ${usd2(s.a)} no rindió` });
      toast(`✓ ${esc(s.nombre)}: ${usd2(de)} y 🧱 techo marcado.`, "ok", 8000);
      R.ctx.recargarTechos?.(); await cargar(true);
    });
}
function marcarTecho(x) {
  const m = R.ctx.abrirModal(`<h3>Marcar 🧱 techo</h3><p><b>${esc(x.nombre)}</b></p>
    <label class="w-lbl" for="rp-techo-m">Techo (no subir arriba de)</label><input class="campo num" id="rp-techo-m" inputmode="decimal" value="${esc(usd2(x.monto))}" data-foco>
    <label class="w-lbl" for="rp-techo-mo">Motivo (opcional)</label><input class="campo" id="rp-techo-mo" maxlength="200" placeholder="ej. con 900 cayó a ROAS 1,7">
    <p class="mut">Solo lo marca: no cambia el presupuesto.</p>
    <div class="botones"><button class="btn" data-x>Cancelar</button><button class="btn pri" data-ok>Marcar techo</button></div>`);
  $("[data-x]", m.dlg).onclick = m.cerrar;
  $("[data-ok]", m.dlg).onclick = async () => {
    const v = parseFloat($("#rp-techo-m", m.dlg).value.replace(/\./g, "").replace(",", "."));
    if (!(v > 0)) return toast("Poné un monto válido", "error");
    try { await api("accion=techo", { id: x.id, act: x.act, nombre: x.nombre, monto: v, motivo: $("#rp-techo-mo", m.dlg).value }); toast("🧱 Techo marcado.", "ok"); m.cerrar(); R.ctx.recargarTechos?.(); await cargar(true); }
    catch (e) { toast(esc(e.message), "error"); }
  };
}
async function quitarTecho(x) {
  confirmar("¿Quitar el techo?", `<p><b>${esc(x.nombre)}</b> vuelve a poder proponerse para subir.</p>`, "Sí, quitar techo", async () => {
    await api("accion=techo_quitar", { id: x.id }); toast("Techo quitado.", "ok"); R.ctx.recargarTechos?.(); await cargar(true);
  });
}
function cambiarPres(x, pct, titulo) {
  const nuevo = a55(Number(x.presupuesto) * (1 + pct / 100));
  confirmar(titulo || `¿${pct > 0 ? "Subir" : "Bajar"} ${Math.abs(pct)} %?`, `<p><b>${esc(x.nombre)}</b>${x.cuenta ? ` · ${esc(x.cuenta)}` : ""}</p><p>Presupuesto: ${usd2(x.presupuesto)} → <b>${usd2(nuevo)}</b></p>${pct > 0 && x.techo ? `<p class="techo-aviso">🧱 Tiene techo en ${usd2(x.techo)}.</p>` : ""}`,
    `Sí, ${pct > 0 ? "subir" : "bajar"} a ${usd2(nuevo)}`, async () => {
      const r = await R.ctx.presupuesto({ id: x.id, act: x.act, nombre: x.nombre, monto: nuevo });
      if (!r.ok) throw new Error(r.error || "Meta no lo aplicó");
      toast(r.simulado ? "Modo prueba: Meta no se tocó." : `✓ ${esc(x.nombre)}: ${usd2(nuevo)}. Te voy diciendo cómo sigue en Surfeos.`, "ok", 8000);
      await cargar(true);
    });
}
function apagarCampana(x) {
  confirmar("¿Apagar la campaña?", `<p><b>${esc(x.nombre)}</b>${x.cuenta ? ` · ${esc(x.cuenta)}` : ""}</p>`, "Sí, apagar", async () => {
    const r = await R.ctx.estado([{ id: x.id, act: x.act, nivel: "campana", nombre: x.nombre }], "PAUSED");
    if (!r[0]?.ok) throw new Error(r[0]?.error || "Meta no lo aplicó"); toast("✓ Apagada.", "ok"); await cargar(true);
  });
}
function surfearYAnotar(x) {
  const m = R.ctx.abrirModal(`<h3>Surfear y seguir</h3><p><b>${esc(x.nombre)}</b> · hoy ${usd2(x.presupuesto)}</p>
    ${segs([["30", "+30 %"], ["15", "+15 %"], ["-30", "−30 %"]], "30", "data-pct")}
    <label class="w-lbl" for="rp-mot">Motivo (va al historial y, cuando esté el bot, al grupo con Franco)</label><input class="campo" id="rp-mot" maxlength="200" placeholder="ej. ROAS 2,4 y 18 ventas hoy">
    <p id="rp-queda" class="mut"></p>${x.techo ? `<p class="techo-aviso">🧱 Tiene techo en ${usd2(x.techo)}.</p>` : ""}
    <div class="botones"><button class="btn" data-x>Cancelar</button><button class="btn pri" data-ok>Aplicar</button></div>`);
  let pct = 30; const queda = () => { $("#rp-queda", m.dlg).innerHTML = `Queda en <b>${usd2(a55(x.presupuesto * (1 + pct / 100)))}</b>. Te aviso a las 3, 24 y 48 h cómo sigue.`; };
  $$("[data-pct]", m.dlg).forEach((b) => b.onclick = () => { pct = Number(b.dataset.pct); $$("[data-pct]", m.dlg).forEach((y) => y.setAttribute("aria-pressed", y === b)); queda(); }); queda();
  $("[data-x]", m.dlg).onclick = m.cerrar;
  $("[data-ok]", m.dlg).onclick = async (e) => {
    const b = e.currentTarget; b.classList.add("cargando");
    try {
      const nuevo = a55(x.presupuesto * (1 + pct / 100));
      const r = await R.ctx.presupuesto({ id: x.id, act: x.act, nombre: x.nombre, monto: nuevo });
      if (!r.ok) throw new Error(r.error || "Meta no lo aplicó");
      if (!r.simulado) await api("accion=surfeo_guardar", { id: x.id, act: x.act, nombre: x.nombre, de: Number(x.presupuesto), a: nuevo, motivo: $("#rp-mot", m.dlg).value });
      toast(r.simulado ? "Modo prueba: Meta no se tocó." : `✓ Surfeada y anotada. La sigo en Surfeos.`, "ok", 8000); m.cerrar(); R.tab = "surfeos"; await cargar(true);
    } catch (err) { b.classList.remove("cargando"); toast(`No se pudo: ${esc(err.message)}`, "error", 8000); }
  };
}
function motivo(s) {
  const m = R.ctx.abrirModal(`<h3>Motivo del cambio</h3><p><b>${esc(s.nombre)}</b> · ${usd2(s.de)} → ${usd2(s.a)}</p>
    <input class="campo" id="rp-mot2" maxlength="300" value="${esc(s.motivo || "")}" data-foco><div class="botones"><button class="btn" data-x>Cancelar</button><button class="btn pri" data-ok>Guardar</button></div>`);
  $("[data-x]", m.dlg).onclick = m.cerrar;
  $("[data-ok]", m.dlg).onclick = async () => { try { await api("accion=surfeo_guardar", { surfeo: s.id, motivo: $("#rp-mot2", m.dlg).value }); m.cerrar(); await cargar(true); } catch (e) { toast(esc(e.message), "error"); } };
}
async function abrirLimpieza(x) {
  const m = R.ctx.abrirModal(`<h3>Limpieza · 3 días</h3><p><b>${esc(x.nombre)}</b>${x.cuenta ? ` · ${esc(x.cuenta)}` : ""}</p><p class="vacio"><span class="cargador"></span>Leyendo conjuntos y anuncios…</p>`, { ancho: true });
  let d; try { d = await api(`accion=limpieza&id=${encodeURIComponent(x.id)}&act=${encodeURIComponent(x.act)}`); } catch (e) { m.set(`<h3>Limpieza</h3><div class="err-box">${esc(e.message)}</div><div class="botones"><button class="btn" data-x>Cerrar</button></div>`); $("[data-x]", m.dlg).onclick = m.cerrar; return; }
  const cfg = R.cfg || {};
  const filas = d.conjuntos.map((s) => `<tr class="${s.malo ? "rp-mala" : ""}"><td><b>${esc(s.nombre)}</b>${s.reno ? " " + chip("reno") : ""}${s.protegida ? " " + chip(`protegida (${s.edad_h} h)`, "rp-chip-g") : ""}${s.minimo ? " " + chip(`mín ${usd2(s.minimo)}`) : ""}</td>
    <td class="num">${usd(s.g)}</td><td class="num">${s.v}</td><td class="num ${roasCls(s.roas)}">${ro(s.roas)}</td><td>${s.malo ? (s.apagar.length ? `${s.apagar.length} para apagar` : s.protegida ? "nueva: se espera" : "sin anuncios para apagar") : "bien"}</td></tr>`).join("");
  const ap = d.apagar;
  m.set(`<h3>Limpieza · ${esc(d.desde.slice(8))}/${esc(d.desde.slice(5, 7))} → hoy</h3><p><b>${esc(x.nombre)}</b> · 3 días: ${usd(d.total.g)} · ${d.total.v} ventas · ROAS <b class="${roasCls(d.total.roas)}">${ro(d.total.roas)}</b></p>
    <div class="rp-tabla-caja"><table class="rp-tabla"><thead><tr><th>Conjunto</th><th>Gasto</th><th>Ventas</th><th>ROAS</th><th></th></tr></thead><tbody>${filas || `<tr><td colspan="5" class="mut">Sin datos.</td></tr>`}</tbody></table></div>
    ${ap.length ? `<h4>Anuncios para apagar (gasto &gt; ${usd(cfg.d_ad_gasto ?? 10)} y ROAS &lt; ${ro(cfg.d_ad_roas ?? 1.3)}, dentro de conjuntos malos)</h4>
      <ul class="rp-lista-ap">${ap.map((a) => `<li><label><input type="checkbox" data-ap="${esc(a.id)}" checked> ${esc(a.nombre)} <span class="mut">· ${esc(a.conjunto)} · ${usd(a.g)} · ROAS ${ro(a.roas)}</span></label></li>`).join("")}</ul>` : `<p class="mut">No hay anuncios que cumplan la regla para apagar.</p>`}
    <div class="botones"><button class="btn" data-x>Cerrar</button>${x.cbo ? `<button class="btn" data-bajar>Bajar −${cfg.d_pct ?? 30} %</button>` : ""}${ap.length ? `<button class="btn pri" data-apagar>Apagar los tildados</button>` : ""}</div>`);
  $("[data-x]", m.dlg).onclick = m.cerrar;
  const bj = $("[data-bajar]", m.dlg); if (bj) bj.onclick = () => { m.cerrar(); cambiarPres(x, -(cfg.d_pct ?? 30)); };
  const bt = $("[data-apagar]", m.dlg);
  if (bt) bt.onclick = async () => {
    const ids = $$("[data-ap]:checked", m.dlg).map((i) => i.dataset.ap); if (!ids.length) return;
    if (bt.dataset.seguro !== "1") { bt.dataset.seguro = "1"; bt.textContent = `¿Seguro? Apagar ${ids.length}`; return; }
    bt.classList.add("cargando");
    try {
      const r = await R.ctx.estado(ap.filter((a) => ids.includes(a.id)).map((a) => ({ id: a.id, act: x.act, nivel: "anuncio", nombre: a.nombre })), "PAUSED");
      const ok = r.filter((y) => y.ok).length; toast(`✓ Apagados ${ok} de ${ids.length}.`, ok === ids.length ? "ok" : "error", 8000); m.cerrar();
    } catch (e) { toast(`No se pudo: ${esc(e.message)}`, "error", 8000); bt.classList.remove("cargando"); }
  };
}

// ---------- pestañas ----------
function notaHTML(n, h, final) {
  if (!n) return `<div class="rp-nota rp-nota-vacia"><b>${h} h</b><span class="mut">todavía no</span></div>`;
  const a = n.antes, d = n.despues, y = n.ayer;
  return `<div class="rp-nota ${n.ver === "bajo" || n.ver === "techo" || n.ver === "sigue_mal" ? "rp-nota-r" : n.ver === "rindio" || n.ver === "mejoro" ? "rp-nota-v" : ""}">
    <b>${h} h ${final ? "" : `<span class="mut">(van ${d.h} h)</span>`}</b>
    <span>ROAS <b class="${roasCls(a.roas)}">${ro(a.roas)}</b> → <b class="${roasCls(d.roas)}">${ro(d.roas)}</b></span>
    <span>ganancia/h ${usd(a.gan_h)} → ${usd(d.gan_h)} <span class="mut">(${n.sube_gan >= 0 ? "+" : ""}${n.sube_gan} %)</span></span>
    <span class="mut">ventas ${a.v} → ${d.v} · gasto ${usd(a.g)} → ${usd(d.g)}</span>
    <span class="mut">ayer mismas horas: ROAS ${ro(y?.roas)} · ${y?.v ?? 0} ventas</span>
    <span class="rp-ver">${final ? VER[n.ver] || n.ver : "en curso"}${n.cortado ? ` · otro cambio a las ${fecha(n.cortado)}` : ""}</span></div>`;
}
function tabSurfeos(d) {
  const hs = d.cfg?.h ?? [3, 24, 48];
  const F = [["todos", "Todos"], ["revisar", "Para revisar"], ["seguimiento", "En seguimiento"], ["rindio", "Rindieron"], ["bajadas", "Bajadas"]];
  const filtrar = (s) => R.filtro === "todos" || (R.filtro === "revisar" ? ["bajo", "techo", "sigue_mal"].includes(s.estado) : R.filtro === "bajadas" ? s.dir < 0 : R.filtro === "rindio" ? ["rindio", "mejoro"].includes(s.estado) : s.estado === "seguimiento");
  const xs = (d.surfeos || []).filter(filtrar);
  const nRev = (d.surfeos || []).filter((s) => ["bajo", "techo", "sigue_mal"].includes(s.estado)).length;
  return `<p class="rp-ayuda">Cada cambio de presupuesto de campaña (desde Meta o el Dashboard, quien sea) se anota solo a los ~10 min. Se compara la misma cantidad de horas antes y después del cambio, y las mismas horas de ayer. Decide la <b>ganancia por hora</b>, no solo el ROAS.</p>
    ${nRev ? `<p class="rp-alerta">🔴 ${nRev} para revisar: bajaron después del cambio.</p>` : ""}
    ${segs(F, R.filtro, "data-f")}
    <div class="rp-lista">${xs.map((s) => {
      const [et, ec] = ESTADO_SURF[s.estado] || [s.estado, ""], arriba = s.dir > 0;
      const notas = hs.map((h) => { const n = s.notas?.[`${h}h`]; return notaHTML(n, h, n?.final); }).join("");
      const puedeVolver = arriba && s.ahora != null && Number(s.ahora) > Number(s.de) + 0.01;
      return `<article class="rp-card">
        <div class="rp-cab"><b>${esc(s.nombre || s.campana_id)}</b>${s.cuenta ? `<span class="mut">${esc(s.cuenta)}</span>` : ""}${chip(et, ec)}${s.techo ? chip(`🧱 ${usd2(s.techo.monto)}`, "rp-chip-g") : ""}<time class="mut">${fecha(s.t)}</time></div>
        <div class="rp-cambio">${arriba ? "📈" : "📉"} ${usd2(s.de)} → <b>${usd2(s.a)}</b> <span class="mut">(${arriba ? "+" : ""}${Math.round((s.a / s.de - 1) * 100)} %) · ${esc(s.quien || s.origen)}${s.ahora != null && Math.abs(s.ahora - s.a) > 0.01 ? ` · hoy en ${usd2(s.ahora)}` : ""}</span></div>
        ${s.motivo ? `<p class="rp-motivo">«${esc(s.motivo)}»</p>` : ""}
        <div class="rp-notas">${notas}</div>
        <div class="rp-acc">${puedeVolver ? `<button class="btn chico pri" data-volver="${s.id}">Volver a ${usd2(s.de)} + 🧱 techo</button>` : ""}
          ${s.techo ? `<button class="btn chico" data-quitar="${esc(s.campana_id)}">Quitar techo</button>` : `<button class="btn chico" data-techo="${s.id}">Marcar 🧱 techo</button>`}
          <button class="btn chico" data-motivo="${s.id}">${s.motivo ? "Cambiar motivo" : "Anotar motivo"}</button></div>
      </article>`;
    }).join("") || `<p class="vacio">Nada en este filtro (últimos 7 días).</p>`}</div>`;
}
function tabCampanas(d) {
  const F = [["todos", "Todas"], ["mala_3d", "Malas 3 días"], ["mala_hora", "Malas a esta hora"], ["floja", "Flojas"]];
  const xs = (d.campanas || []).filter((c) => R.filtro === "todos" || c.estado === R.filtro);
  const n3 = (d.campanas || []).filter((c) => c.estado === "mala_3d").length, nh = (d.campanas || []).filter((c) => c.estado === "mala_hora").length;
  const celda = (m, eq) => `<td class="num"><b class="${roasCls(m.roas, eq)}">${ro(m.roas)}</b><span class="mut">${m.v} v · ${usd(m.g)}</span></td>`;
  const EST = { mala_3d: chip("🔴 mala 3 días", "rp-chip-r"), mala_hora: chip("🟠 mala ayer y hoy", "rp-chip-a"), floja: chip("🟡 floja", "rp-chip-a"), bien: "" };
  return `<p class="rp-ayuda">ROAS de hoy hasta ahora contra ayer y anteayer <b>a esta misma hora</b>, y los 3 días enteros. «Limpieza» abre los conjuntos y anuncios de los 3 días y te propone apagar los que gastaron más de US$ 10 con ROAS bajo dentro de conjuntos malos.</p>
    ${n3 || nh ? `<p class="rp-alerta">🔴 ${n3} malas hace 3 días · 🟠 ${nh} malas ayer y hoy a esta hora.</p>` : ""}
    ${segs(F, R.filtro, "data-f")}
    <div class="rp-tabla-caja"><table class="rp-tabla"><thead><tr><th>Campaña</th><th>Presup.</th><th>Hoy</th><th>Ayer a esta hora</th><th>Anteayer a esta hora</th><th>3 días</th><th></th></tr></thead><tbody>
    ${xs.map((c) => `<tr class="${c.estado === "mala_3d" ? "rp-mala" : ""}"><td><b>${c.techo ? "🧱 " : ""}${esc(c.nombre)}</b><span class="mut">${esc(c.cuenta || "")}</span>${EST[c.estado] || ""}</td>
      <td class="num">${c.cbo ? usd2(c.presupuesto) : "ABO"}</td>${celda(c.hoy, d.cfg?.equilibrio)}${celda(c.ayer_hora, d.cfg?.equilibrio)}${celda(c.ante_hora, d.cfg?.equilibrio)}
      <td class="num"><b class="${roasCls(c.tres.roas, d.cfg?.equilibrio)}">${ro(c.tres.roas)}</b><span class="mut">${usd(c.tres.gan)} ganancia</span></td>
      <td class="rp-acc-td"><button class="btn chico" data-limp="${esc(c.id)}">Limpieza</button>${c.cbo ? `<button class="btn chico" data-surf="${esc(c.id)}">Surfear</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="7" class="mut">Nada en este filtro.</td></tr>`}
    </tbody></table></div>`;
}
function tabCuentas(d) {
  const ag = (d.cuentas || []).filter((k) => k.agotada).length;
  return `<p class="rp-ayuda">Gasto, ROAS y ganancia por cuenta en los últimos días. «Agotada» = todas sus campañas debajo del equilibrio por ${d.dias} días: conviene escalar en otra cuenta.</p>
    ${ag ? `<p class="rp-alerta">🪫 ${ag} cuenta${ag === 1 ? "" : "s"} agotada${ag === 1 ? "" : "s"}.</p>` : ""}
    <div class="rp-tabla-caja"><table class="rp-tabla"><thead><tr><th>Cuenta</th>${(d.cuentas?.[0]?.dias || []).map((x) => `<th>${esc(x.dia.slice(8))}/${esc(x.dia.slice(5, 7))}</th>`).join("")}<th>Total</th></tr></thead><tbody>
    ${(d.cuentas || []).map((k) => `<tr class="${k.agotada ? "rp-mala" : ""}"><td><b>${esc(k.cuenta)}</b><span class="mut">${k.n} campañas</span>${k.agotada ? chip("🪫 agotada", "rp-chip-r") : ""}</td>
      ${k.dias.map((x) => `<td class="num"><b class="${roasCls(x.roas)}">${ro(x.roas)}</b><span class="mut">${usd(x.g)} · ${usd(x.gan)}</span></td>`).join("")}
      <td class="num"><b class="${roasCls(k.roas)}">${ro(k.roas)}</b><span class="mut">${usd(k.g)} · ${usd(k.gan)}</span></td></tr>`).join("")}
    </tbody></table></div>`;
}
function tabGastos(d) {
  const w = d.whop, viejo = w && Date.now() - Date.parse(w.leido) > 3 * 3600e3;
  return `<p class="rp-ayuda">${esc(d.nota)}</p>
    <div class="rp-tabla-caja"><table class="rp-tabla"><thead><tr><th>Día</th><th>Gastado en Meta</th><th>Facturado</th><th>ROAS</th><th>Ganancia</th></tr></thead><tbody>
    ${(d.dias || []).map((x) => `<tr><td><b>${esc(x.dia.slice(8))}/${esc(x.dia.slice(5, 7))}</b><span class="mut">${x.campanas} campañas</span></td><td class="num">${usd(x.g)}</td><td class="num">${usd(x.val)}</td><td class="num ${roasCls(x.roas)}">${ro(x.roas)}</td><td class="num">${usd(x.gan)}</td></tr>`).join("")}
    </tbody></table></div>
    <h3 class="rp-h3">Whop</h3>
    ${!w ? `<p class="mut">Sin datos de Whop.</p>` : `${viejo ? `<p class="rp-alerta">⚠️ El saldo de Whop es de ${hace(w.leido)} (${fecha(w.leido)}): la ventana de Whop de la Mac no está abierta, así que no se actualiza.</p>` : ""}
      <div class="rp-tiles"><div class="rp-tile"><b>${usd(w.saldo)}</b><span>Saldo disponible</span></div><div class="rp-tile"><b>${usd(w.cobros_hoy_usd)}</b><span>Cobros de hoy (últimos de cada tarjeta)</span></div>${w.retenido_chicas != null ? `<div class="rp-tile"><b>${usd(w.retenido_chicas)}</b><span>Retenido (~US$ 2, vuelve)</span></div>` : ""}</div>`}`;
}
function tabMinimos(d) {
  const al = (d.minimos || []).filter((x) => x.alerta).length;
  return `<p class="rp-ayuda">Cuánto del presupuesto de cada CBO está atado a gastos mínimos de conjuntos (renos nuevas). Arriba de ${d.pct_max} % los winners se quedan sin aire.</p>
    ${al ? `<p class="rp-alerta">⚖️ ${al} CBO con más de ${d.pct_max} % en mínimos.</p>` : ""}
    <div class="rp-lista">${(d.minimos || []).map((x) => `<article class="rp-card ${x.alerta ? "rp-card-r" : ""}">
      <div class="rp-cab"><b>${esc(x.nombre)}</b><span class="mut">${esc(x.cuenta || "")}</span>${x.alerta ? chip("⚖️ ahogando", "rp-chip-r") : ""}</div>
      <div class="rp-barra" role="img" aria-label="${x.pct} % en mínimos"><span style="width:${Math.min(100, x.pct)}%"></span></div>
      <p class="mut">${x.pct} % del presupuesto en mínimos: ${usd2(x.suma)} de ${usd2(x.presupuesto)} · ${x.sets.length} de ${x.activos} conjuntos prendidos con mínimo</p>
      <ul class="rp-lista-ap">${x.sets.map((s) => `<li><label><input type="checkbox" data-min="${esc(s.id)}" data-camp="${esc(x.id)}"> ${esc(s.nombre)} <span class="mut">· mín ${usd2(s.minimo)}${s.creado ? ` · desde ${fecha(s.creado)}` : ""}</span></label></li>`).join("")}</ul>
      <div class="rp-acc"><button class="btn chico" data-sacarmin="${esc(x.id)}">Sacar mínimo a los tildados</button></div></article>`).join("") || `<p class="vacio">Ninguna CBO prendida tiene conjuntos con mínimo.</p>`}</div>`;
}
function tabEscala(d) {
  return `<p class="rp-ayuda">Campañas nuevas que no son testeo (escala horizontal y cuentas nuevas), a las 24, 48 y 72 h de arrancar.</p>
    <div class="rp-lista">${(d.escala || []).map((e) => `<article class="rp-card ${e.accion === "apagar" || e.accion === "bajar" ? "rp-card-r" : e.accion === "subir" ? "rp-card-v" : ""}">
      <div class="rp-cab"><b>${esc(e.nombre)}</b><span class="mut">${esc(e.cuenta || "")}</span>${chip(`${e.edad_h} h`)}${chip(e.hito)}</div>
      <p>ROAS <b class="${roasCls(e.m.roas)}">${ro(e.m.roas)}</b> · ${e.m.v} ventas · gasto ${usd(e.m.g)} · ganancia ${usd(e.m.gan)} · presupuesto ${usd2(e.presupuesto)}</p>
      <p class="rp-motivo">${esc(e.motivo)}</p>
      <div class="rp-acc">${e.accion === "subir" ? `<button class="btn chico pri" data-esc="${esc(e.id)}" data-pct="30">+30 %</button>` : ""}${e.accion === "bajar" ? `<button class="btn chico pri" data-esc="${esc(e.id)}" data-pct="-30">−30 %</button>` : ""}${e.accion === "apagar" ? `<button class="btn chico pri" data-apagar-c="${esc(e.id)}">Apagar</button>` : ""}</div></article>`).join("") || `<p class="vacio">No hay campañas nuevas de escala en los últimos 4 días.</p>`}</div>`;
}
const ICONO_P = { a_subir: "🟢", b_bajo: "🔴", b_nota: "📊", c_bajar: "🟠", c_apagar: "⛔", d_mala: "🟠", e_recuperar: "🔁", f_minimos: "⚖️", g_subir: "🆕", g_bajar: "🆕", g_apagar: "🆕", h_cuenta: "🪫" };
function tabBot(d) {
  return `<p class="rp-alerta rp-alerta-g">🧪 <b>Modo simulacro.</b> El bot corre en el servidor cada 30 min: sigue los surfeos y arma estas propuestas tal como te van a llegar por WhatsApp. Todavía no manda WhatsApp ni toca Meta. Compará lo que propone con lo que hicieron ustedes.</p>
    <div class="rp-lista">${(d.propuestas || []).map((p) => `<article class="rp-card"><div class="rp-cab">${ICONO_P[p.tipo] || "•"} <b>${esc(p.nombre || "")}</b><time class="mut">${fecha(p.creada)}</time>${chip(p.estado)}</div>
      <pre class="rp-wa">${esc(p.texto).replace(/\*([^*\n]+)\*/g, "<b>$1</b>")}</pre><p class="mut">${esc(p.motivo || "")}</p></article>`).join("") || `<p class="vacio">Todavía no hay propuestas. Salen en los horarios configurados (y los avisos de surfeo, en el momento).</p>`}</div>`;
}
function tabConfig(d) {
  const grupos = []; for (const x of d.esquema) { let g = grupos.find((y) => y.g === x.g); if (!g) grupos.push(g = { g: x.g, xs: [] }); g.xs.push(x); }
  const campo = (x) => x.t === "bool" ? `<label class="rp-sw"><input type="checkbox" data-k="${esc(x.k)}" ${x.valor ? "checked" : ""}> <span>${esc(x.n)}</span></label>`
    : `<label class="rp-campo"><span>${esc(x.n)}${x.t === "pct" ? "" : ""}</span><input class="campo num" data-k="${esc(x.k)}" value="${esc(x.t === "texto" ? x.valor : NF2.format(x.valor).replace(/,00$/, ""))}" inputmode="${x.t === "texto" ? "text" : "decimal"}">
       <small class="mut">${x.a ? esc(x.a) + " · " : ""}fábrica: ${esc(String(x.def))}</small></label>`;
  return `<p class="rp-ayuda">Todos los umbrales del bot y de los reportes. Al guardar, se usan desde la próxima pasada (máx. 30 min).${d.actualizado ? ` Último cambio: ${fecha(d.actualizado)}${d.quien ? ` (${esc(d.quien)})` : ""}.` : ""}</p>
    <form id="rp-form" class="rp-config">${grupos.map((g) => `<fieldset class="rp-grupo"><legend>${esc(g.g)}</legend>${g.xs.map(campo).join("")}</fieldset>`).join("")}
    <div class="rp-acc rp-fijo"><button type="submit" class="btn pri">Guardar umbrales</button><button type="button" class="btn" data-fabrica>Volver a los de fábrica</button></div></form>`;
}

// ---------- pintar y eventos ----------
function pintar() {
  const r = R.raiz; if (!r) return;
  const d = R.datos[R.tab];
  const cuerpo = !d ? `<p class="vacio"><span class="cargador"></span>Cargando…</p>` : d.__error ? `<div class="err-box" role="alert"><b>No se pudo cargar.</b> ${esc(d.__error)} <button class="btn chico" data-recargar>Reintentar</button></div>`
    : ({ surfeos: tabSurfeos, campanas: tabCampanas, cuentas: tabCuentas, gastos: tabGastos, minimos: tabMinimos, escala: tabEscala, bot: tabBot, config: tabConfig })[R.tab](d);
  r.innerHTML = `<div class="rp">
    <div class="rp-top"><div class="rp-tabs" role="tablist">${TABS.map(([k, t]) => `<button type="button" class="rp-tab" role="tab" data-tab="${k}" aria-selected="${k === R.tab}">${t}</button>`).join("")}</div>
      <button type="button" class="btn chico" data-recargar title="Volver a leer">↻ Actualizar</button></div>
    <div class="rp-cuerpo">${cuerpo}</div></div>`;
  enlazar();
}
function enlazar() {
  const r = R.raiz, d = R.datos[R.tab] || {};
  $$("[data-tab]", r).forEach((b) => b.onclick = () => { R.tab = b.dataset.tab; R.filtro = "todos"; ls.set("rp_tab", R.tab); cargar(); });
  $$("[data-recargar]", r).forEach((b) => b.onclick = () => cargar(true));
  $$("[data-f]", r).forEach((b) => b.onclick = () => { R.filtro = b.dataset.f; ls.set("rp_filtro", R.filtro); pintar(); });
  const S = (id) => (d.surfeos || []).find((s) => String(s.id) === String(id));
  $$("[data-volver]", r).forEach((b) => b.onclick = () => volverConTecho(S(b.dataset.volver)));
  $$("[data-techo]", r).forEach((b) => b.onclick = () => { const s = S(b.dataset.techo); marcarTecho({ id: s.campana_id, act: s.act, nombre: s.nombre, monto: s.dir > 0 ? s.de : s.ahora ?? s.a }); });
  $$("[data-quitar]", r).forEach((b) => b.onclick = () => { const s = (d.surfeos || []).find((x) => x.campana_id === b.dataset.quitar); quitarTecho({ id: b.dataset.quitar, nombre: s?.nombre }); });
  $$("[data-motivo]", r).forEach((b) => b.onclick = () => motivo(S(b.dataset.motivo)));
  const C = (id) => (d.campanas || []).find((c) => c.id === id);
  $$("[data-limp]", r).forEach((b) => b.onclick = () => abrirLimpieza(C(b.dataset.limp)));
  $$("[data-surf]", r).forEach((b) => b.onclick = () => surfearYAnotar(C(b.dataset.surf)));
  const E = (id) => (d.escala || []).find((e) => e.id === id);
  $$("[data-esc]", r).forEach((b) => b.onclick = () => cambiarPres(E(b.dataset.esc), Number(b.dataset.pct)));
  $$("[data-apagar-c]", r).forEach((b) => b.onclick = () => apagarCampana(E(b.dataset.apagarC)));
  $$("[data-sacarmin]", r).forEach((b) => b.onclick = () => {
    const x = (d.minimos || []).find((m) => m.id === b.dataset.sacarmin), ids = $$(`[data-min][data-camp="${x.id}"]:checked`, r).map((i) => i.dataset.min);
    if (!ids.length) return toast("Tildá los conjuntos a los que les querés sacar el mínimo.", "error");
    const sets = x.sets.filter((s) => ids.includes(String(s.id)));
    confirmar("¿Sacar el gasto mínimo?", `<p><b>${esc(x.nombre)}</b></p><ul>${sets.map((s) => `<li>${esc(s.nombre)} · mín ${usd2(s.minimo)}</li>`).join("")}</ul>`, `Sí, sacar ${sets.length}`, async () => {
      const res = await R.ctx.quitarMinimo(sets.map((s) => ({ id: s.id, act: x.act, nombre: s.nombre })));
      const ok = Array.isArray(res) ? res.filter((y) => y.ok).length : 0; toast(`✓ Mínimo sacado a ${ok} de ${sets.length}.`, ok === sets.length ? "ok" : "error", 8000); await cargar(true);
    });
  });
  const f = $("#rp-form", r);
  if (f) {
    f.onsubmit = async (e) => {
      e.preventDefault(); const valores = {};
      $$("[data-k]", f).forEach((i) => valores[i.dataset.k] = i.type === "checkbox" ? i.checked : i.value.trim().replace(/\./g, "").replace(",", "."));
      for (const x of d.esquema) if (x.t === "texto") valores[x.k] = $(`[data-k="${x.k}"]`, f).value;
      try { await api("accion=config", { valores }); toast("✓ Umbrales guardados.", "ok"); await cargar(true); } catch (err) { toast(esc(err.message), "error", 8000); }
    };
    $("[data-fabrica]", f).onclick = () => confirmar("¿Volver a los umbrales de fábrica?", `<p>Se pisan todos los valores con los de la propuesta del 02/11.</p>`, "Sí, volver", async () => {
      const valores = Object.fromEntries(d.esquema.map((x) => [x.k, x.def])); await api("accion=config", { valores }); toast("✓ Umbrales de fábrica.", "ok"); await cargar(true);
    });
  }
}
async function cargar(forzar = false) {
  if (!forzar && R.datos[R.tab] && !R.datos[R.tab].__error) return pintar();
  const tab = R.tab; R.datos[tab] = null; pintar();
  try {
    if (!R.cfg) api("accion=config").then((c) => { R.cfg = Object.fromEntries(c.esquema.map((x) => [x.k, x.valor])); }).catch(() => {});
    R.datos[tab] = tab === "config" ? await api("accion=config") : await api(`accion=resumen&tab=${tab}`);
    if (tab === "config") R.cfg = Object.fromEntries(R.datos[tab].esquema.map((x) => [x.k, x.valor]));
  } catch (e) { R.datos[tab] = { __error: e.message }; }
  if (R.tab === tab) pintar();
}
window.Reportes = {
  montar(raiz, ctx) { R.raiz = raiz; R.ctx = ctx || {}; R.datos = {}; if (!TABS.some(([k]) => k === R.tab)) R.tab = "surfeos"; cargar(true); },
};
})();

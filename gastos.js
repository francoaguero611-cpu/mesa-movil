/* Gastos (11/11, Lorenzo: «una sección de gastos que me mida todos los gastos que tenemos a diario: APIMart, ElevenLabs, RunPod
   y todo lo que usamos día a día»).
   Backend: Edge Function «gastos» (?accion=ver · fijo). Los datos los sube cada Mac cada hora con scripts/gastos/medir.py
   (RunPod por día, APIMart por diferencia del total gastado, ElevenLabs plan prorrateado, Gemini del log, AWS).
   Las suscripciones fijas se cargan acá abajo (US$ por mes → se reparten por día). */
"use strict";
(() => {
const API = "https://tppcpnfzcxxusdhrlmdx.supabase.co/functions/v1/gastos";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ls = { get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const clave = () => ls.get("dash_clave", "");
const isoAR = (ms = Date.now()) => new Date(ms - 3 * 3600e3).toISOString().slice(0, 10);
const sumar = (d, n) => new Date(Date.parse(d + "T12:00:00Z") + n * 86400e3).toISOString().slice(0, 10);
const usd = (n, dec) => { const v = Number(n || 0); const d = dec ?? (Math.abs(v) < 100 ? 2 : 0); return "US$ " + v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d }); };
const ent = (n) => Number(n || 0).toLocaleString("es-AR");
const diaCorto = (f) => { const [, m, d] = f.split("-"); return `${+d}/${+m}`; };
const DSEM = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const dsem = (f) => DSEM[new Date(f + "T12:00:00Z").getUTCDay()];
function hace(f) { const s = (Date.now() - Date.parse(f)) / 1000; if (!isFinite(s)) return "—"; if (s < 90) return "recién"; if (s < 3600) return `hace ${Math.round(s / 60)} min`; if (s < 86400) return `hace ${Math.round(s / 3600)} h`; return `hace ${Math.round(s / 86400)} d`; }

// colores fijos por servicio (los fijos rotan en grises tornasolados)
const COL = { runpod: "#c9c2f2", apimart: "#e7f2a6", elevenlabs: "#bfe9d9", gemini: "#f1d58a", aws: "#f2c6dc" };
const COL_FIJO = ["#8a8a94", "#a3a0b8", "#9fb3ad", "#b7b39a", "#b39aa8", "#7d8a9a"];
const colorDe = (id, i) => COL[id] || COL_FIJO[i % COL_FIJO.length];

const PERIODOS = [["hoy", "Hoy"], ["7", "7 días"], ["30", "30 días"], ["mes", "Este mes"]];
const G = { raiz: null, per: ls.get("gst_per", "7"), datos: null, cargando: false, toast: null, login: null, editando: null };

function rango() {
  const hoy = isoAR();
  if (G.per === "hoy") return [hoy, hoy];
  if (G.per === "mes") return [hoy.slice(0, 8) + "01", hoy];
  return [sumar(hoy, -(+G.per - 1)), hoy];
}

async function pedir(accion, q = "", body) {
  const r = await fetch(`${API}?accion=${accion}${q}`, { method: body ? "POST" : "GET", cache: "no-store",
    headers: { "x-app-clave": clave(), ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401) { G.login?.("Tu sesión venció: volvé a entrar."); throw new Error("sesión vencida"); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(d.error || `error ${r.status}`);
  return d;
}

async function cargar() {
  if (!G.raiz) return;
  G.cargando = true; pintar();
  // para comparar, siempre se pide desde 30 días antes (o desde el 1 del mes) aunque se muestre menos
  const [d, h] = rango(); const desde = d < sumar(h, -29) ? d : sumar(h, -29);
  try { G.datos = await pedir("ver", `&desde=${desde}&hasta=${h}`); G.error = null; }
  catch (e) { G.error = e.message; }
  G.cargando = false; pintar();
}

function recortar() {
  const D = G.datos; if (!D) return null;
  const [d, h] = rango();
  const dias = D.dias.filter((x) => x.fecha >= d && x.fecha <= h);
  const tot = {}; let total = 0;
  for (const x of dias) for (const [s, v] of Object.entries(x.servicios)) { tot[s] = (tot[s] || 0) + v; total += v; }
  const sv = D.servicios.map((s) => ({ ...s, per: tot[s.id] || 0 })).sort((a, b) => b.per - a.per || b.total - a.total);
  return { dias, sv, total, d, h };
}

function kpis(R) {
  const D = G.datos, hoy = D.hoy;
  const porDia = Object.fromEntries(D.dias.map((x) => [x.fecha, x.total]));
  const tHoy = porDia[hoy] || 0, tAyer = porDia[sumar(hoy, -1)] || 0;
  const ult7 = D.dias.filter((x) => x.fecha > sumar(hoy, -7) && x.fecha <= hoy);
  const ult30 = D.dias.filter((x) => x.fecha > sumar(hoy, -30) && x.fecha <= hoy);
  const s7 = ult7.reduce((t, x) => t + x.total, 0);
  const s30 = ult30.reduce((t, x) => t + x.total, 0);
  // proyección del mes: lo que va del mes + (promedio de los últimos 7 días completos × días que faltan)
  const mes = hoy.slice(0, 8), [y, m] = hoy.split("-").map(Number), dm = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const vaMes = D.dias.filter((x) => x.fecha.startsWith(mes)).reduce((t, x) => t + x.total, 0);
  const completos = D.dias.filter((x) => x.fecha < hoy && x.fecha >= sumar(hoy, -7));
  const prom = completos.length ? completos.reduce((t, x) => t + x.total, 0) / completos.length : 0;
  const proy = vaMes + prom * (dm - +hoy.slice(8));
  const dif = tHoy - tAyer;
  const tend = tAyer ? `<span class="gst-tend ${dif > 0 ? "sube" : "baja"}">${dif > 0 ? "▲" : "▼"} ${usd(Math.abs(dif))} ${dif > 0 ? "más" : "menos"} que ayer completo</span>` : "";
  return `<div class="gst-kpis">
    <div class="gst-k grande"><span class="gst-kt">Gastado hoy</span><b class="num">${usd(tHoy)}</b>${tend}<small>sigue sumando hasta la medianoche</small></div>
    <div class="gst-k"><span class="gst-kt">Últimos 7 días</span><b class="num">${usd(s7)}</b><small>${usd(s7 / Math.max(1, ult7.length))} por día</small></div>
    <div class="gst-k"><span class="gst-kt">Últimos 30 días</span><b class="num">${usd(s30)}</b><small>${usd(s30 / Math.max(1, ult30.length))} por día</small></div>
    <div class="gst-k"><span class="gst-kt">Proyección del mes</span><b class="num">${usd(proy, 0)}</b><small>van ${usd(vaMes, 0)} · al ritmo de la última semana</small></div>
  </div>`;
}

function grafico(R) {
  const dias = R.dias; if (!dias.length) return "";
  if (dias.length === 1) return ""; // en «Hoy» no hay barras: alcanza con la lista
  const orden = R.sv.map((s) => s.id);
  const max = Math.max(1, ...dias.map((x) => x.total));
  const W = 100 / dias.length;
  const paso = max > 200 ? 100 : max > 80 ? 25 : max > 30 ? 10 : 5;
  const lineas = []; for (let v = paso; v < max; v += paso) lineas.push(v);
  const barras = dias.map((x, i) => {
    let y = 0;
    const seg = orden.map((s, j) => { const v = x.servicios[s] || 0; if (!v) return ""; const h = v / max * 100; const r = `<span class="gst-seg" style="bottom:${y}%;height:${h}%;background:${colorDe(s, j)}"></span>`; y += h; return r; }).join("");
    const et = dias.length <= 10 || i % Math.ceil(dias.length / 10) === 0 || i === dias.length - 1;
    return `<div tabindex="0" class="gst-col${x.fecha === G.datos.hoy ? " hoy" : ""}" data-dia="${x.fecha}" style="left:${i * W}%;width:${W}%" aria-label="${dsem(x.fecha)} ${diaCorto(x.fecha)}: ${usd(x.total)}">
      <span class="gst-pila">${seg}</span>${et ? `<span class="gst-eje">${dsem(x.fecha)} ${diaCorto(x.fecha)}</span>` : ""}</div>`;
  }).join("");
  return `<div class="gst-graf" role="img" aria-label="Gasto por día">
    <div class="gst-area">${lineas.map((v) => `<span class="gst-linea" style="bottom:${v / max * 100}%"><i>${usd(v, 0)}</i></span>`).join("")}${barras}</div>
    <div class="gst-tip" hidden></div>
  </div>
  <div class="gst-ley">${R.sv.filter((s) => s.per > 0).map((s, j) => `<span><i style="background:${colorDe(s.id, R.sv.indexOf(s))}"></i>${esc(s.nombre)}</span>`).join("")}</div>`;
}

function detalle(s) {
  const d = s.detalle_hoy || {}, out = [];
  if (s.id === "runpod") {
    if (d.gastando_por_hora > 0) out.push(`<span class="gst-alerta">● gastando ${usd(d.gastando_por_hora)}/h ahora: hay pods prendidos</span>`);
    if (d.pods) out.push(`hoy ${d.pods} pods · ${String(d.horas).replace(".", ",")} h`);
    if (d.saldo != null) out.push(`saldo ${usd(d.saldo)}`);
  }
  if (s.id === "elevenlabs") {
    if (d.creditos != null) out.push(`hoy ${ent(d.creditos)} créditos`);
    if (d.creditos_libres != null) out.push(`quedan ${ent(d.creditos_libres)}`);
    if (d.plan_usd_mes) out.push(`plan ${esc(d.plan || "")} ${usd(d.plan_usd_mes, 0)}/mes`);
  }
  if (s.id === "gemini" && d.consultas) out.push(`hoy ${ent(d.consultas)} consultas (tope US$ 15/día)`);
  if (s.id === "apimart" && s.saldo != null) out.push(`saldo ${usd(s.saldo)}`);
  if (s.id === "aws") out.push("se paga con tarjeta");
  if (s.fijo) { const f = G.datos.fijos.find((x) => `fijo:${x.id}` === s.id); if (f) out.push(`${usd(f.usd_mes, 0)}/mes`); }
  return out.join(" · ");
}

function lista(R) {
  const [d, h] = [R.d, R.h];
  const titPer = G.per === "hoy" ? "hoy" : `del ${diaCorto(d)} al ${diaCorto(h)}`;
  return `<div class="gst-card"><div class="gst-cab"><h3>Por servicio <small>${titPer}</small></h3><span class="gst-tot num">${usd(R.total)}</span></div>
    <div class="gst-filas">${R.sv.map((s, i) => {
      const pct = R.total ? s.per / R.total * 100 : 0;
      return `<div class="gst-fila"><i class="gst-punto" style="background:${colorDe(s.id, i)}"></i>
        <div class="gst-nom"><b>${esc(s.nombre)}</b><small>${esc(s.sub || "")}</small><span class="gst-det">${detalle(s)}</span></div>
        <div class="gst-barra" aria-hidden="true"><span style="width:${pct.toFixed(1)}%;background:${colorDe(s.id, i)}"></span></div>
        <div class="gst-val"><b class="num">${usd(s.per)}</b><small>${pct.toFixed(0)} %${G.per !== "hoy" ? ` · hoy ${usd(s.hoy)}` : ""}</small></div></div>`;
    }).join("") || `<p class="gst-vacio">Todavía no hay gastos medidos en estos días.</p>`}</div></div>`;
}

function fijos() {
  const F = G.datos.fijos || [];
  const mes = F.filter((f) => f.activo).reduce((t, f) => t + Number(f.usd_mes), 0);
  return `<div class="gst-card"><div class="gst-cab"><h3>Suscripciones fijas <small>se reparten por día</small></h3><span class="gst-tot num">${usd(mes, 0)}/mes</span></div>
    <p class="gst-ayuda">Lo que se paga todos los meses aunque no se use (Claude, Impultienda, Higgsfield, UTMify, dominios…). ElevenLabs no va acá: se mide solo.</p>
    <div class="gst-fijos">${F.map((f) => G.editando === f.id ? formFijo(f) : `
      <div class="gst-fijo${f.activo ? "" : " off"}"><div><b>${esc(f.nombre)}</b><small>desde ${diaCorto(f.desde)}${f.activo ? "" : " · pausada"}</small></div>
        <span class="num">${usd(f.usd_mes, f.usd_mes % 1 ? 2 : 0)}/mes</span>
        <span class="gst-acc"><button type="button" class="btn chico" data-editar="${f.id}">Editar</button><button type="button" class="btn chico" data-pausar="${f.id}">${f.activo ? "Pausar" : "Reactivar"}</button></span></div>`).join("")}
      ${G.editando === "nuevo" ? formFijo(null) : `<button type="button" class="btn chico gst-nuevo" data-editar="nuevo">+ Agregar suscripción</button>`}</div></div>`;
}

function formFijo(f) {
  return `<form class="gst-form" data-id="${f ? f.id : ""}">
    <label>Nombre<input name="nombre" required maxlength="80" value="${esc(f?.nombre || "")}" placeholder="Ej.: Claude Max"></label>
    <label>US$ por mes<input name="usd_mes" required inputmode="decimal" value="${f ? String(f.usd_mes).replace(".", ",") : ""}" placeholder="0"></label>
    <label>Desde<input name="desde" type="date" value="${f?.desde || isoAR()}"></label>
    <span class="gst-acc"><button type="submit" class="btn chico primario">Guardar</button><button type="button" class="btn chico" data-cancelar>Cancelar</button>
    ${f ? `<button type="button" class="btn chico peligro" data-borrar="${f.id}">Borrar</button>` : ""}</span></form>`;
}

function pintar() {
  const r = G.raiz; if (!r) return;
  const per = `<div class="gst-per" role="tablist">${PERIODOS.map(([k, t]) => `<button type="button" role="tab" data-per="${k}" aria-selected="${G.per === k}">${t}</button>`).join("")}</div>`;
  const pie = G.datos ? `<span class="gst-med">Última medición ${hace(G.datos.medido)} · se mide sola cada hora</span>` : "";
  let cuerpo;
  if (!G.datos && G.cargando) cuerpo = `<p class="vacio"><span class="cargador"></span>Midiendo los gastos…</p>`;
  else if (!G.datos) cuerpo = `<div class="err-box" role="alert"><b>No se pudieron leer los gastos.</b> ${esc(G.error || "")}<div><button type="button" class="btn chico" data-reintentar>Reintentar</button></div></div>`;
  else { const R = recortar(), g = grafico(R); cuerpo = `${kpis(R)}${g ? `<div class="gst-card">${g}</div>` : ""}${lista(R)}${fijos()}`; }
  r.innerHTML = `<div class="gst-top"><div><h2>Gastos de la empresa</h2>${pie}</div>${per}</div>${G.error && G.datos ? `<p class="gst-aviso">No se pudo actualizar: ${esc(G.error)}</p>` : ""}${cuerpo}`;
  r.classList.toggle("cargando", G.cargando);
}

// ---------- eventos ----------
function eventos(r) {
  r.addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.per) { G.per = b.dataset.per; ls.set("gst_per", G.per); pintar(); return; }
    if (b.hasAttribute("data-reintentar")) return cargar();
    if (b.dataset.editar) { G.editando = b.dataset.editar === "nuevo" ? "nuevo" : +b.dataset.editar; pintar(); $(".gst-form input", r)?.focus(); return; }
    if (b.hasAttribute("data-cancelar")) { G.editando = null; pintar(); return; }
    if (b.dataset.pausar) { const f = G.datos.fijos.find((x) => x.id === +b.dataset.pausar); if (f) await guardar({ ...f, activo: !f.activo }); return; }
    if (b.dataset.borrar) {
      if (b.dataset.seguro !== "1") { b.dataset.seguro = "1"; b.textContent = "¿Seguro? Tocá de nuevo"; return; }
      await guardar({ id: +b.dataset.borrar, borrar: true }); return;
    }
  });
  r.addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.target, fd = new FormData(f);
    const monto = Number(String(fd.get("usd_mes") || "").replace(/\./g, "").replace(",", "."));
    if (!isFinite(monto) || monto < 0) { G.toast?.("El monto tiene que ser un número (US$ por mes).", "error"); return; }
    await guardar({ id: f.dataset.id ? +f.dataset.id : undefined, nombre: fd.get("nombre"), usd_mes: monto, desde: fd.get("desde"), activo: true });
  });
  // cartelito al pasar por una barra
  const tip = () => $(".gst-tip", r);
  r.addEventListener("pointerover", (e) => {
    const c = e.target.closest(".gst-col"); const t = tip(); if (!c || !t || !G.datos) return;
    const x = G.datos.dias.find((d) => d.fecha === c.dataset.dia); if (!x) return;
    const R = recortar();
    t.innerHTML = `<b>${dsem(x.fecha)} ${diaCorto(x.fecha)} · ${usd(x.total)}</b>${R.sv.filter((s) => x.servicios[s.id]).map((s) => `<span><i style="background:${colorDe(s.id, R.sv.indexOf(s))}"></i>${esc(s.nombre)}<em>${usd(x.servicios[s.id])}</em></span>`).join("")}`;
    t.hidden = false;
    const g = c.closest(".gst-graf").getBoundingClientRect(), cb = c.getBoundingClientRect();
    const izq = Math.min(Math.max(0, cb.left - g.left + cb.width / 2 - t.offsetWidth / 2), g.width - t.offsetWidth);
    t.style.left = izq + "px";
  });
  r.addEventListener("pointerout", (e) => { if (e.target.closest(".gst-col") && !e.relatedTarget?.closest?.(".gst-col")) { const t = tip(); if (t) t.hidden = true; } });
}

async function guardar(body) {
  try { await pedir("fijo", "", body); G.editando = null; G.toast?.(body.borrar ? "Suscripción borrada." : "Guardado.", "ok"); await cargar(); }
  catch (e) { G.toast?.("No se pudo guardar: " + e.message, "error", 6000); }
}

let reloj = 0;
window.Gastos = {
  montar(raiz, { login, toast } = {}) {
    G.raiz = raiz; G.login = login; G.toast = toast; G.editando = null;
    eventos(raiz); pintar(); cargar();
    clearInterval(reloj); reloj = setInterval(() => { if (!document.body.contains(G.raiz)) return clearInterval(reloj); if (!document.hidden) cargar(); }, 5 * 60e3);
  },
};
})();

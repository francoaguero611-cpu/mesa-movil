/* Lanzamientos (12/11, Lorenzo): «una sección para poder ver las cosas únicamente que salieron en cierta fecha: las renos,
   los testeos, las aperturas de mercado… yo filtro todo de ayer y veo cómo viene lo de ayer, entre ayer y hoy, o solo hoy».
   Renos: «la campaña madre abierta, con las métricas totales de la campaña, y adentro únicamente los conjuntos nuevos».
   - Elegís el día que SALIÓ (se creó el conjunto) y qué días de resultados ver: desde que salió hasta hoy · solo ese día · solo hoy.
   - Tabla con el ROAS de cada día + total (memoria campanas-tabla-roas-por-dia). Rojo < 1,3.
   Backend: Edge Function «lanzamientos» (?fecha&desde&hasta). */
"use strict";
(() => {
const API = "https://tppcpnfzcxxusdhrlmdx.supabase.co/functions/v1/lanzamientos";
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ls = { get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const clave = () => ls.get("dash_clave", "");
const isoAR = (ms = Date.now()) => new Date(ms - 3 * 3600e3).toISOString().slice(0, 10);
const sumar = (d, n) => new Date(Date.parse(d + "T12:00:00Z") + n * 86400e3).toISOString().slice(0, 10);
const num = (v, d = 2) => Number(v || 0).toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
const usd = (v) => "US$ " + num(v, Math.abs(Number(v || 0)) < 100 ? 2 : 0);
const DSEM = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const diaCorto = (f) => `${DSEM[new Date(f + "T12:00:00Z").getUTCDay()]} ${+f.slice(8, 10)}/${+f.slice(5, 7)}`;
const horaAR = (iso) => iso ? new Date(Date.parse(iso) - 3 * 3600e3).toISOString().slice(11, 16) : "";
const colR = (r) => r == null ? "" : r < 1.3 ? "mal" : r >= 2 ? "bien" : "medio";
const roasTx = (r) => r == null ? "—" : num(r);
const TIPOS = { testeo: ["Testeos y aperturas", "Campañas nuevas que salieron ese día"], escala: ["Escala", "Campañas nuevas de winners, CostCap, BidCap…"],
  reno: ["Renos", "Madre abierta: total de la campaña y abajo solo los conjuntos nuevos"], conjunto: ["Otros conjuntos nuevos", "Conjuntos nuevos en campañas que ya existían"] };
const ESTADO = { ACTIVE: ["Prendido", "on"], PAUSED: ["Apagado", "off"], CAMPAIGN_PAUSED: ["Campaña apagada", "off"], ADSET_PAUSED: ["Apagado", "off"],
  WITH_ISSUES: ["Con problemas", "mal"], DISAPPROVED: ["Rechazado", "mal"], PENDING_REVIEW: ["En revisión", "rev"], IN_PROCESS: ["Procesando", "rev"] };
const VER = [["desde", "Desde que salió"], ["dia", "Solo ese día"], ["hoy", "Solo hoy"]];

const L = { raiz: null, fecha: ls.get("lz_fecha", ""), ver: ls.get("lz_ver", "desde"), tipo: "todo", datos: null, error: null, cargando: false, login: null, cerradas: new Set() };
if (!VER.some(([k]) => k === L.ver)) L.ver = "desde";

function rango() {
  const hoy = isoAR(), f = L.fecha || sumar(hoy, -1);
  if (L.ver === "dia") return [f, f];
  if (L.ver === "hoy") return [hoy, hoy];
  return [f, (Date.parse(hoy) - Date.parse(f)) / 86400e3 > 30 ? sumar(f, 30) : hoy];
}
async function cargar(forzar = false) {
  if (!L.raiz) return;
  if (!L.fecha) L.fecha = sumar(isoAR(), -1);
  const [desde, hasta] = rango();
  L.cargando = true; L.raiz.classList.add("cargando"); pintar();
  try {
    const r = await fetch(`${API}?fecha=${L.fecha}&desde=${desde}&hasta=${hasta}${forzar ? "&forzar=1" : ""}`, { cache: "no-store", headers: { "x-app-clave": clave() } });
    if (r.status === 401) { L.login?.("Tu sesión venció: volvé a entrar."); throw new Error("sesión vencida"); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) throw new Error(d.error || `error ${r.status}`);
    L.datos = d; L.error = null;
  } catch (e) { L.error = e.message; }
  L.cargando = false; L.raiz?.classList.remove("cargando"); pintar();
}

function celdasDias(m, dias) {
  return dias.map((d) => { const p = m.por_dia?.[d] || {}; const r = p.roas;
    return `<td class="lz-r ${colR(r)}" title="${diaCorto(d)} · gasto ${usd(p.gasto)} · ${p.ventas || 0} ventas · ${usd(p.facturacion)}">${p.gasto > 0 ? roasTx(r) : "<span class='lz-0'>—</span>"}</td>`; }).join("");
}
function chipEstado(st) { const e = ESTADO[st] || [st || "?", "off"]; return `<span class="lz-st ${e[1]}">${esc(e[0])}</span>`; }
function linkMeta(act, id, nivel) {
  const q = nivel === "set" ? `ads?act=${act}&selected_adset_ids=${id}` : `adsets?act=${act}&selected_campaign_ids=${id}`;
  return `https://adsmanager.facebook.com/adsmanager/manage/${q}`;
}
function filaMet(m, dias) {
  return `<td class="num">${usd(m.gasto)}</td><td class="num">${m.ventas || 0}</td>${celdasDias(m, dias)}<td class="lz-r tot ${colR(m.roas)}">${roasTx(m.roas)}</td>
    <td class="num lz-x">${m.pagos_iniciados || 0}</td><td class="num lz-x">${m.cpa != null ? usd(m.cpa) : "—"}</td>`;
}
function anunciosTx(a) {
  if (!a?.total) return "";
  const x = [`${a.activos}/${a.total} anuncios`];
  if (a.rechazados) x.push(`<b class="mal">${a.rechazados} rechazado${a.rechazados > 1 ? "s" : ""}</b>`);
  if (a.revision) x.push(`${a.revision} en revisión`);
  return x.join(" · ");
}
function filasItem(it, dias) {
  const abierta = !L.cerradas.has(it.id);
  const sub = [it.cuenta, it.presupuesto ? `${it.tipo_presupuesto} ${usd(it.presupuesto)}/día` : it.tipo_presupuesto, it.nueva && it.inicio ? `arrancó ${horaAR(it.inicio)}` : ""].filter(Boolean).join(" · ");
  const sets = it.conjuntos || [];
  const verSets = !it.nueva || sets.length > 1;
  let h = `<tr class="lz-camp${it.nueva ? "" : " madre"}" data-id="${esc(it.id)}">
    <td class="lz-nom">${verSets ? `<button type="button" class="lz-ab" aria-expanded="${abierta}" aria-label="${abierta ? "Cerrar" : "Abrir"} conjuntos">${abierta ? "▾" : "▸"}</button>` : ""}
      <div><a href="${linkMeta(it.act, it.id)}" target="_blank" rel="noopener">${esc(it.nombre)}</a>
      <small>${esc(sub)}${it.nueva ? "" : " · <i>total de la campaña</i>"}${it.nueva && sets.length === 1 ? ` · ${anunciosTx(sets[0].anuncios)}` : ""}</small></div></td>
    <td>${chipEstado(it.estado)}</td>${filaMet(it.metricas, dias)}</tr>`;
  if (verSets && abierta) for (const s of sets) {
    const sub2 = [s.creado ? `creado ${horaAR(s.creado)}` : "", s.inicio && s.inicio !== s.creado ? `arranca ${diaCorto(isoAR(Date.parse(s.inicio)))} ${horaAR(s.inicio)}` : "", s.minimo ? `mínimo ${usd(s.minimo)}` : "", anunciosTx(s.anuncios)].filter(Boolean).join(" · ");
    h += `<tr class="lz-set"><td class="lz-nom"><span class="lz-rama" aria-hidden="true"></span><div><a href="${linkMeta(it.act, s.id, "set")}" target="_blank" rel="noopener">${esc(s.nombre)}</a><small>${sub2}</small></div></td>
      <td>${chipEstado(s.estado)}</td>${filaMet(s.metricas, dias)}</tr>`;
  }
  return h;
}

function pintar() {
  const R = L.raiz; if (!R) return;
  const hoy = isoAR(), f = L.fecha || sumar(hoy, -1), d = L.datos;
  const atajos = [[hoy, "Hoy"], [sumar(hoy, -1), "Ayer"], [sumar(hoy, -2), "Anteayer"]];
  const listo = d && d.fecha === f;
  const items = listo ? d.items.map((x) => TIPOS[x.tipo] ? x : { ...x, tipo: x.nueva ? "testeo" : "conjunto" }) : [];
  const cuenta = (t) => t === "reno" || t === "conjunto" ? items.filter((x) => x.tipo === t).reduce((s, x) => s + x.conjuntos.length, 0) : items.filter((x) => x.tipo === t).length;
  const tiposCon = Object.keys(TIPOS).filter((t) => items.some((x) => x.tipo === t));
  if (L.tipo !== "todo" && !tiposCon.includes(L.tipo)) L.tipo = "todo";
  const dias = listo ? d.dias : [];
  const T = listo ? d.total : null;
  const cab = `<div class="lz-top"><div><h2>Lanzamientos</h2><p class="lz-sub">Solo lo que salió un día y cómo viene.</p></div>
    ${d?.generado ? `<span class="lz-med">actualizado ${horaAR(d.generado)}${L.cargando ? " · actualizando…" : ""}</span>` : ""}</div>
    <div class="lz-ctrl">
      <div class="lz-grupo"><span class="lz-et">Lo que salió el</span>
        <div class="lz-pills" role="tablist">${atajos.map(([v, t]) => `<button type="button" role="tab" aria-selected="${f === v}" data-fecha="${v}">${t}</button>`).join("")}</div>
        <label class="lz-fecha"><span class="sr">Otra fecha</span><input type="date" id="lz-fecha" value="${f}" max="${hoy}"></label></div>
      <div class="lz-grupo"><span class="lz-et">Ver resultados</span>
        <div class="lz-pills" role="tablist">${VER.map(([k, t]) => `<button type="button" role="tab" aria-selected="${L.ver === k}" data-ver="${k}">${t}</button>`).join("")}</div></div>
    </div>`;
  let cuerpo = "";
  if (L.error && !listo) cuerpo = `<div class="err-box" role="alert"><b>No se pudo cargar.</b> ${esc(L.error)} <button type="button" class="btn chico" id="lz-re">Reintentar</button></div>`;
  else if (!listo) cuerpo = `<p class="vacio"><span class="cargador"></span>Buscando lo que salió el ${diaCorto(f)} en todas las cuentas…</p>`;
  else if (!items.length) cuerpo = `<p class="vacio">El ${diaCorto(f)} no salió nada nuevo (ni campañas ni conjuntos).</p>`;
  else {
    const rango = dias.length === 1 ? diaCorto(dias[0]) : `${diaCorto(dias[0])} → ${diaCorto(dias[dias.length - 1])}`;
    cuerpo = `<div class="lz-kpis">
      <div class="lz-k heroe"><span class="lz-kt">ROAS de lo que salió</span><span class="lz-val num">${roasTx(T.roas)}</span><small>${rango}</small></div>
      <div class="lz-k"><span class="lz-kt">Gasto</span><span class="lz-val num">${usd(T.gasto)}</span><small>solo lo nuevo</small></div>
      <div class="lz-k"><span class="lz-kt">Ventas</span><span class="lz-val num">${T.ventas}</span><small>${usd(T.facturacion)} facturado</small></div>
      <div class="lz-k"><span class="lz-kt">Qué salió</span><span class="lz-que">${tiposCon.map((t) => `<span><b>${cuenta(t)}</b> ${{ reno: ["conjunto de renos", "conjuntos de renos"], conjunto: ["conjunto nuevo", "conjuntos nuevos"], testeo: ["testeo o apertura", "testeos y aperturas"], escala: ["campaña de escala", "campañas de escala"] }[t][cuenta(t) === 1 ? 0 : 1]}</span>`).join("")}</span></div>
    </div>
    ${dias.length > 1 ? `<div class="lz-card lz-dias"><table><thead><tr><th>Todo lo nuevo, día por día</th>${dias.map((x) => `<th>${diaCorto(x)}</th>`).join("")}<th>Total</th></tr></thead>
      <tbody><tr><td>ROAS</td>${dias.map((x) => `<td class="lz-r ${colR(T.por_dia[x].roas)}">${T.por_dia[x].gasto > 0 ? roasTx(T.por_dia[x].roas) : "—"}</td>`).join("")}<td class="lz-r tot ${colR(T.roas)}">${roasTx(T.roas)}</td></tr>
      <tr><td>Gasto</td>${dias.map((x) => `<td class="num">${usd(T.por_dia[x].gasto)}</td>`).join("")}<td class="num">${usd(T.gasto)}</td></tr>
      <tr><td>Ventas</td>${dias.map((x) => `<td class="num">${T.por_dia[x].ventas}</td>`).join("")}<td class="num">${T.ventas}</td></tr></tbody></table></div>` : ""}
    <div class="lz-pills lz-tipos" role="tablist"><button type="button" role="tab" aria-selected="${L.tipo === "todo"}" data-tipo="todo">Todo</button>${tiposCon.map((t) => `<button type="button" role="tab" aria-selected="${L.tipo === t}" data-tipo="${t}">${TIPOS[t][0]} <span class="num">${cuenta(t)}</span></button>`).join("")}</div>
    ${tiposCon.filter((t) => L.tipo === "todo" || L.tipo === t).map((t) => `<div class="lz-card"><div class="lz-cab"><h3>${TIPOS[t][0]} <small>${TIPOS[t][1]}</small></h3></div>
      <div class="lz-tabla"><table><thead><tr><th>${t === "reno" || t === "conjunto" ? "Campaña madre / conjuntos nuevos" : "Campaña"}</th><th>Estado</th><th>Gasto</th><th>Ventas</th>${dias.map((x) => `<th class="lz-r">ROAS ${diaCorto(x)}</th>`).join("")}<th class="lz-r">ROAS total</th><th class="lz-x">Pagos inic.</th><th class="lz-x">CPA</th></tr></thead>
      <tbody>${items.filter((x) => x.tipo === t).map((x) => filasItem(x, dias)).join("")}</tbody></table></div></div>`).join("")}
    ${d.errores?.length ? `<p class="lz-aviso">Faltan datos de: ${esc(d.errores.join(" · "))}</p>` : ""}
    <p class="lz-nota">Salió = el conjunto empieza a correr ese día (hora AR): las renos armadas a la noche cuentan para el día en que arrancan. Ventas = la mayor entre el pixel y la tienda (con post-venta). ROAS en rojo = menor a 1,3.</p>`;
  }
  R.innerHTML = cab + cuerpo;
  $$("[data-fecha]", R).forEach((b) => b.onclick = () => elegirFecha(b.dataset.fecha));
  $("#lz-fecha", R)?.addEventListener("change", (e) => { if (e.target.value) elegirFecha(e.target.value); });
  $$("[data-ver]", R).forEach((b) => b.onclick = () => { L.ver = b.dataset.ver; ls.set("lz_ver", L.ver); cargar(); });
  $$("[data-tipo]", R).forEach((b) => b.onclick = () => { L.tipo = b.dataset.tipo; pintar(); });
  $$(".lz-ab", R).forEach((b) => b.onclick = () => { const id = b.closest("tr").dataset.id; L.cerradas.has(id) ? L.cerradas.delete(id) : L.cerradas.add(id); pintar(); });
  $("#lz-re", R)?.addEventListener("click", () => cargar(true));
}
function elegirFecha(f) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || f > isoAR()) return;
  L.fecha = f; ls.set("lz_fecha", f); L.datos = null; cargar();
}

window.Lanzamientos = {
  montar(raiz, { login } = {}) {
    L.raiz = raiz; L.login = login;
    // cada vez que se entra arranca en «ayer» salvo que se haya elegido otra fecha hoy mismo
    if (!L.fecha || ls.get("lz_fecha_dia", "") !== isoAR()) { L.fecha = sumar(isoAR(), -1); ls.set("lz_fecha_dia", isoAR()); ls.set("lz_fecha", L.fecha); }
    pintar(); cargar();
  },
  refrescar() { cargar(true); },
};
})();

/* =====================================================================================================
   TABLERO DE TAREAS (07/11, Lorenzo) — v2: tres columnas (Sin iniciar · En proceso · Terminadas) con post-its chicos y
   cerrados; al tocar uno se abre grande en el medio con su checklist (lo terminado tachado, lo que falta con su %).
   Fechas: ayer / hoy / mañana / cualquier día (todo queda guardado). Botones: nueva tarea, marcar lista, mover, eliminar.
   De dónde salen las tareas:
     · el TALLER (lo que cada chat marca con scripts/taller.py) agrupado solo: Post-venta (OTO 1–4…), Testeo (Impultienda,
       VSL/landing, 5 creativos, pixel, fan page, campaña), Renovaciones…  → ws-evento ?accion=taller
     · el servidor «tablero»: manuales (tuyas o de Claude con scripts/tablero.py), DIARIAS (optimizar anuncios, escala
       horizontal) y SUGERIDAS por resultados (vino bien → renovar; 2 días bien → crear la post-venta) → tablero ?accion=ver
     · los cambios que hacés sobre una del taller (lista / eliminada) se guardan en el servidor con ref «taller:<id>».
   ===================================================================================================== */
(() => {
  const WS = "https://tppcpnfzcxxusdhrlmdx.supabase.co/functions/v1/ws-evento";
  const TB = "https://tppcpnfzcxxusdhrlmdx.supabase.co/functions/v1/tablero";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ls = { get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  const clave = () => ls.get("dash_clave", "");
  const usuario = () => { const m = ls.get("dash_usuario", "") || ""; return /franco/i.test(m) ? "franco" : m ? "lorenzo" : ""; };
  const DEMO = /[?&]demo=1/.test(location.search);
  const isoAR = (ms = Date.now()) => new Date(ms - 3 * 3600e3).toISOString().slice(0, 10);
  const sumar = (d, n) => new Date(Date.parse(d + "T12:00:00Z") + n * 86400e3).toISOString().slice(0, 10);
  const T = { items: null, guardadas: {}, fecha: isoAR(), filtro: ls.get("tb_filtro", "todos"), abierto: false, grande: null, pAb: new Set(), ult: 0, st: "" };

  // ---------- tareas que salen solas del taller ----------
  const HECHO = new Set(["para_revisar", "aprobado", "listo"]);
  const norm = (o) => String(o || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\b(sano|desafio|sistema)\b/g, "").replace(/\s+/g, " ").trim();
  const pctPasos = (ps) => { const xs = (ps || []).filter((p) => p && p.estado !== "salto"); if (!xs.length) return null; let t = 0; for (const p of xs) t += p.estado === "ok" ? 1 : p.estado === "curso" && p.de ? Math.min(0.95, (p.n || 0) / p.de) : 0; return Math.round((t / xs.length) * 100); };
  const pctItem = (it) => HECHO.has(it.estado) ? 100 : it.progreso != null ? Math.max(0, Math.min(99, Math.round(it.progreso))) : pctPasos(it.pasos) ?? 0;
  const esReno = (it) => it.tipo === "reno" || (it.tipo === "creativo" && /\breno\b|^r\d{1,2}\b|^reno /i.test(it.nombre || ""));
  const POST = new Set(["oto", "postventa", "entregable", "downsell", "upsell"]), TESTEO = new Set(["tienda", "landing", "tracking", "fanpage", "pagina", "campana"]);
  const porNombre = (a, b) => String(a.nombre).localeCompare(String(b.nombre), "es", { numeric: true });
  function delTaller(items, fecha) {
    const ini = Date.parse(fecha + "T03:00:00Z"), fin = ini + 86400e3, hoy = isoAR(), G = new Map();
    for (const it of items || []) {
      if (it.estado === "archivado" || it.estado === "cancelado") continue; // (08/11) lo terminado o descartado no es tarea
      const a = Date.parse(it.actualizado || it.inicio || 0), i0 = Date.parse(it.inicio || it.actualizado || 0);
      if (fecha === hoy) { const edad = (Date.now() - a) / 3600e3; if (edad > 72 || (edad > 24 && HECHO.has(it.estado))) continue; }
      else if (fecha < hoy) { if (!(i0 < fin && a >= ini)) continue; }
      else continue;
      const k = norm(it.oferta); if (!k) continue;
      if (!G.has(k)) G.set(k, { oferta: it.oferta, items: [] });
      const g = G.get(k); g.items.push(it); if ((it.oferta || "").length > g.oferta.length) g.oferta = it.oferta;
    }
    const out = [];
    for (const g of G.values()) {
      const post = g.items.filter((x) => POST.has(x.tipo)), renos = g.items.filter((x) => !POST.has(x.tipo) && esReno(x));
      let resto = g.items.filter((x) => !post.includes(x) && !renos.includes(x));
      const esTest = resto.some((x) => TESTEO.has(x.tipo));
      // (08/11, Lorenzo) renovaciones y creativos de la misma oferta son UNA tarea (si no es un testeo)
      const crea = esTest ? [] : resto.filter((x) => /creativo|traduccion|avatar/.test(x.tipo));
      resto = resto.filter((x) => !crea.includes(x));
      if (post.length) out.push(armar("postventa", `Post-venta ${g.oferta}`, post));
      if (renos.length || crea.length) out.push(armar("renos", `${renos.length ? "Renovaciones" : "Creativos"} ${g.oferta}`, [...renos, ...crea]));
      if (resto.length) out.push(armar(esTest ? "testeo" : "otros", `${esTest ? "Testeo" : "Tareas"} ${g.oferta}`, resto));
    }
    return out;
  }
  function armar(clase, titulo, its) {
    let filas = []; const fila = (t, it) => ({ t, it, pct: it ? pctItem(it) : 0 });
    if (clase === "testeo") {
      const us = new Set(), toma = (f) => { const x = its.filter((i) => !us.has(i) && f(i)).sort(porNombre); x.forEach((i) => us.add(i)); return x; };
      const tienda = toma((i) => i.tipo === "tienda"), vsl = toma((i) => i.tipo === "vsl" || i.tipo === "landing"), crea = toma((i) => i.tipo === "creativo" || i.tipo === "traduccion");
      const px = toma((i) => i.tipo === "tracking"), fp = toma((i) => i.tipo === "fanpage" || i.tipo === "pagina"), camp = toma((i) => i.tipo === "campana");
      filas.push(...(tienda.length ? tienda.map((i) => fila("Configuración de Impultienda", i)) : [fila("Configuración de Impultienda")]));
      filas.push(...(vsl.length ? vsl.map((i) => fila(i.tipo === "vsl" ? "VSL / landing" : "Landing", i)) : [fila("VSL / landing")]));
      for (let n = 0; n < Math.max(5, crea.length); n++) filas.push(fila(`Creativo ${n + 1}`, crea[n]));
      filas.push(fila("Pixel + CAPI", px[0])); filas.push(fila("Fan page", fp[0]));
      filas.push(...(camp.length ? camp.map((i) => fila("Campaña", i)) : [fila("Campaña")]));
      for (const i of its.filter((x) => !us.has(x)).sort(porNombre)) filas.push(fila(i.tipo === "avatar" ? "Avatares / voces" : "Extra", i));
    } else if (clase === "postventa") {
      const otos = its.filter((i) => i.tipo === "oto").sort(porNombre), otros = its.filter((i) => i.tipo !== "oto").sort(porNombre);
      for (let n = 0; n < Math.max(4, otos.length); n++) filas.push(fila(`OTO ${n + 1}`, otos[n]));
      for (const i of otros) filas.push(fila(i.tipo === "entregable" ? "Entregables" : i.tipo === "downsell" ? "Downsell" : "Páginas y downsells", i));
    } else filas = its.sort(porNombre).map((i) => fila(i.nombre, i));
    const pct = Math.round(filas.reduce((t, f) => t + f.pct, 0) / Math.max(1, filas.length));
    const arranco = filas.some((f) => f.it && (f.pct > 0 || !["en_cola"].includes(f.it.estado)));
    return { id: "taller:" + clase + ":" + norm(titulo), fuente: "taller", clase, titulo, filas, pct, arranco, duenos: [...new Set(its.map((i) => i.dueno).filter(Boolean))] };
  }

  // ---------- tareas guardadas (manuales, diarias, sugeridas) + cambios sobre las del taller ----------
  function deGuardadas(rows) {
    return (rows || []).filter((r) => !r.eliminada && !String(r.ref || "").startsWith("taller:")).map((r) => {
      const items = r.items || [], ok = items.filter((x) => x.ok).length, pct = items.length ? Math.round((ok / items.length) * 100) : r.estado === "listo" ? 100 : 0;
      return { id: "g:" + r.id, fila: r, fuente: "guardada", clase: r.clase || "manual", titulo: r.titulo, nota: r.nota, pct, duenos: r.dueno ? [r.dueno] : [], items, estadoG: r.estado };
    });
  }
  function todas() {
    const rows = T.guardadas[T.fecha] || [], ov = new Map(rows.filter((r) => String(r.ref || "").startsWith("taller:")).map((r) => [r.ref.slice(7), r]));
    let xs = [...(T.items ? delTaller(T.items, T.fecha) : []).map((t) => ({ ...t, ov: ov.get(t.id) })).filter((t) => !t.ov?.eliminada), ...deGuardadas(rows)];
    for (const t of xs) t.col = columna(t);
    if (T.filtro !== "todos") xs = xs.filter((t) => !t.duenos.length || t.duenos.includes(T.filtro));
    return xs;
  }
  function columna(t) {
    if (t.fuente === "taller") { if (t.ov?.estado) return t.ov.estado; return t.pct >= 100 ? "listo" : t.arranco ? "en_proceso" : "sin_iniciar"; }
    if (t.estadoG === "listo" || (t.items.length && t.pct === 100)) return "listo";
    if (t.estadoG === "en_proceso" || t.pct > 0) return "en_proceso";
    return "sin_iniciar";
  }

  // ---------- red ----------
  async function pedir(url, body) {
    const r = await fetch(url, body ? { method: "POST", headers: { "x-app-clave": clave(), "x-app-usuario": usuario(), "content-type": "application/json" }, body: JSON.stringify(body) } : { headers: { "x-app-clave": clave() }, cache: "no-store" });
    const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || r.status); return j;
  }
  async function cargar(forzar = false) {
    if (DEMO) { if (!T.items) { T.items = demoItems(); T.guardadas = JSON.parse(ls.get("tb_demo", "{}")); } pintar(); badge(); return; }
    if (!clave()) return;
    const f = T.fecha;
    try {
      const [w, g] = await Promise.all([
        forzar || !T.items || Date.now() - T.ult > 50e3 ? pedir(`${WS}?accion=taller&dias=${f < isoAR() ? 10 : 3}`) : Promise.resolve(null),
        pedir(`${TB}?accion=ver&fecha=${f}`),
      ]);
      if (w) { T.items = w.items || []; T.ult = Date.now(); }
      T.guardadas[f] = g.tareas || []; T.st = "";
    } catch (e) { T.st = "No pude leer las tareas: " + String(e.message || e); }
    pintar(); badge();
  }
  async function guardar(cambio) {
    if (DEMO) {
      const rows = T.guardadas[T.fecha] ||= [];
      if (cambio.id) Object.assign(rows.find((r) => r.id === cambio.id) || {}, cambio);
      else if (cambio.ref && rows.find((r) => r.ref === cambio.ref)) Object.assign(rows.find((r) => r.ref === cambio.ref), cambio);
      else rows.push({ id: Math.random().toString(36).slice(2), items: [], estado: "sin_iniciar", ...cambio });
      ls.set("tb_demo", JSON.stringify(T.guardadas)); pintar(); badge(); return rows.find((r) => r.id === cambio.id || r.ref === cambio.ref) || rows[rows.length - 1];
    }
    const r = await pedir(`${TB}?accion=guardar`, { fecha: T.fecha, ...cambio });
    const rows = T.guardadas[T.fecha] ||= [], i = rows.findIndex((x) => x.id === r.tarea.id);
    i >= 0 ? (rows[i] = r.tarea) : rows.push(r.tarea);
    pintar(); badge(); return r.tarea;
  }

  // ---------- botón en el encabezado ----------
  const ICO = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 6.5l1.6 1.6L8.6 5M4 12.5l1.6 1.6 3-3.1M4 18.5l1.6 1.6 3-3.1M11.5 6.8H20M11.5 12.8H20M11.5 18.8H17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  function boton() {
    const arriba = $(".acciones-top"); if (!arriba || $("#tb-btn", arriba)) return;
    const b = document.createElement("button"); b.id = "tb-btn"; b.type = "button"; b.className = "btn icono tb-btn"; b.setAttribute("aria-label", "Tareas"); b.title = "Tareas de hoy";
    b.innerHTML = `${ICO}<span class="tb-badge" hidden></span>`; b.onclick = abrir;
    const av = $(".av-wrap", arriba); av ? arriba.insertBefore(b, av) : arriba.append(b);
  }
  function badge() {
    const b = $("#tb-btn .tb-badge"); if (!b || T.fecha !== isoAR()) return;
    const n = todas().filter((t) => t.col !== "listo").length; b.hidden = !n; b.textContent = n;
  }

  // ---------- pop-up ----------
  const CLASE = { postventa: ["Post-venta", "lila"], testeo: ["Testeo", "menta"], renos: ["Renovaciones", "lima"], creativos: ["Creativos", "rosa"], otros: ["Tareas", "gris"], diaria: ["Todos los días", "celeste"], sugerida: ["Sugerida", "durazno"], manual: ["Tarea", "gris"] };
  const QUIEN = { lorenzo: "Lorenzo", franco: "Franco", claude: "Claude" };
  const COLS = [["sin_iniciar", "Sin iniciar"], ["en_proceso", "En proceso"], ["listo", "Terminadas"]];
  const ESTADO = { trabajando: "trabajando", corrigiendo: "corrigiendo", esperando: "esperando", error: "trabado", pausado: "en pausa", en_cola: "en cola", para_revisar: "para revisar", aprobado: "aprobado", listo: "listo" };
  const DSEM = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const nomFecha = (f) => { const h = isoAR(); if (f === h) return "Hoy"; if (f === sumar(h, -1)) return "Ayer"; if (f === sumar(h, 1)) return "Mañana"; const d = new Date(f + "T12:00:00Z"); return `${DSEM[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`; };

  function abrir() {
    if ($(".tb-velo")) return;
    T.fecha = isoAR();
    const v = document.createElement("div"); v.className = "tb-velo"; v.setAttribute("role", "dialog"); v.setAttribute("aria-modal", "true"); v.setAttribute("aria-label", "Tareas");
    v.innerHTML = `<div class="tb-caja"><div class="tb-cab">
        <div class="tb-tit-g"><h2>Tareas</h2><small class="tb-fecha"></small></div>
        <div class="tb-dias" role="group" aria-label="Día"><button type="button" data-tbd="-1" aria-label="Día anterior">‹</button><button type="button" data-tbd="ayer">Ayer</button><button type="button" data-tbd="hoy">Hoy</button><button type="button" data-tbd="manana">Mañana</button><button type="button" data-tbd="1" aria-label="Día siguiente">›</button><label class="tb-cal" title="Elegir fecha"><input type="date" class="tb-date"><span aria-hidden="true">📅</span></label></div>
        <div class="tb-fil" role="group" aria-label="De quién">${[["todos", "Todos"], ["lorenzo", "Lorenzo"], ["franco", "Franco"]].map(([k, t]) => `<button type="button" data-tbf="${k}">${t}</button>`).join("")}</div>
        <button type="button" class="tb-nueva" data-tbn>+ Nueva tarea</button>
        <button type="button" class="tb-x" aria-label="Cerrar">✕</button></div>
      <div class="tb-lienzo" data-lenis-prevent><div class="tb-cols"></div></div><div class="tb-capa" hidden></div></div>`;
    document.body.append(v); T.abierto = true;
    requestAnimationFrame(() => v.classList.add("visible"));
    v.addEventListener("click", clic);
    $(".tb-date", v).onchange = (e) => { if (e.target.value) irA(e.target.value); };
    document.addEventListener("keydown", tecla);
    pintar(); cargar(true);
    T.timer = setInterval(() => { if (!T.grande) cargar(true); }, 60e3);
  }
  function irA(f) { T.fecha = f; T.grande = null; pintar(); cargar(); }
  function tecla(e) { if (e.key === "Escape") { if (T.grande) { T.grande = null; pintarGrande(); } else cerrar(); } }
  function cerrar() { const v = $(".tb-velo"); if (!v) return; v.classList.remove("visible"); T.abierto = false; T.grande = null; clearInterval(T.timer); document.removeEventListener("keydown", tecla); setTimeout(() => v.remove(), 280); T.fecha = isoAR(); badge(); }

  async function clic(e) {
    const v = $(".tb-velo");
    if (e.target.classList.contains("tb-capa") || e.target.closest("[data-tbcerrar]")) { T.grande = null; return pintarGrande(); }
    if (e.target === v || e.target.closest(".tb-x")) return cerrar();
    const d = e.target.closest("[data-tbd]"); if (d) { const k = d.dataset.tbd, h = isoAR(); return irA(k === "hoy" ? h : k === "ayer" ? sumar(h, -1) : k === "manana" ? sumar(h, 1) : sumar(T.fecha, +k)); }
    const f = e.target.closest("[data-tbf]"); if (f) { T.filtro = f.dataset.tbf; ls.set("tb_filtro", T.filtro); return pintar(); }
    if (e.target.closest("[data-tbn]")) { T.grande = "nueva"; return pintarGrande(); }
    const c = e.target.closest("[data-tbc]"); if (c) { T.grande = c.dataset.tbc; T.seguro = false; return pintarGrande(); }
    const p = e.target.closest("[data-tbp]"); if (p) { const id = p.dataset.tbp; T.pAb.has(id) ? T.pAb.delete(id) : T.pAb.add(id); return pintarGrande(); }
    const a = e.target.closest("[data-tba]"); if (a) return accion(a.dataset.tba, a);
    const it = e.target.closest("[data-tbi]"); if (it) return tildar(+it.dataset.tbi);
  }
  const actual = () => todas().find((t) => t.id === T.grande) || (T.ultTodas || []).find((t) => t.id === T.grande);
  async function accion(k, btn) {
    const t = actual(); if (!t && k !== "crear") return;
    try {
      if (k === "crear") {
        const g = $(".tb-grande"), titulo = $(".tb-in-tit", g).value.trim(); if (!titulo) return $(".tb-in-tit", g).focus();
        const items = $(".tb-in-items", g).value.split("\n").map((x) => x.trim()).filter(Boolean).map((t) => ({ t, ok: false }));
        await guardar({ titulo, dueno: $(".tb-in-dueno", g).value || null, items, clase: "manual", origen: "manual", estado: "sin_iniciar" });
        T.grande = null; return pintarGrande();
      }
      if (k === "eliminar") {
        if (!T.seguro) { T.seguro = true; btn.textContent = "¿Seguro? Eliminar"; return; }
        if (t.fuente === "taller") await guardar({ ref: "taller:" + t.id, titulo: t.titulo, origen: "override", eliminada: true });
        else await guardar({ id: t.fila.id, eliminada: true });
        T.grande = null; return pintarGrande();
      }
      const est = { listo: "listo", proceso: "en_proceso", iniciar: "sin_iniciar" }[k]; if (!est) return;
      if (t.fuente === "taller") await guardar({ ref: "taller:" + t.id, titulo: t.titulo, origen: "override", estado: est });
      else await guardar({ id: t.fila.id, estado: est, items: est === "listo" ? t.items.map((x) => ({ ...x, ok: true })) : t.items });
      pintarGrande();
    } catch (er) { alertaTx("No se pudo guardar: " + er.message); }
  }
  async function tildar(i) {
    const t = actual(); if (!t || t.fuente !== "guardada") return;
    const items = t.items.map((x, j) => j === i ? { ...x, ok: !x.ok } : x), ok = items.filter((x) => x.ok).length;
    try { await guardar({ id: t.fila.id, items, estado: ok === items.length ? "listo" : ok ? "en_proceso" : t.estadoG === "listo" ? "en_proceso" : t.estadoG }); pintarGrande(); } catch (er) { alertaTx("No se pudo guardar: " + er.message); }
  }
  function alertaTx(m) { const g = $(".tb-grande .tb-err"); if (g) g.textContent = m; }

  const barra = (p) => `<span class="tb-barra" aria-hidden="true"><i style="width:${p}%"></i></span>`;
  function pintar() {
    const v = $(".tb-velo"); if (!v) return;
    $$("[data-tbf]", v).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tbf === T.filtro)));
    const h = isoAR(); $$("[data-tbd]", v).forEach((b) => { const k = b.dataset.tbd; b.setAttribute("aria-pressed", String((k === "hoy" && T.fecha === h) || (k === "ayer" && T.fecha === sumar(h, -1)) || (k === "manana" && T.fecha === sumar(h, 1)))); });
    $(".tb-date", v).value = T.fecha;
    $(".tb-fecha", v).textContent = `${nomFecha(T.fecha)}${["Hoy", "Ayer", "Mañana"].includes(nomFecha(T.fecha)) ? " · " + new Date(T.fecha + "T12:00:00Z").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) : ""}`;
    const xs = todas(); T.ultTodas = xs;
    const cols = $(".tb-cols", v);
    const cargando = !T.items && !T.guardadas[T.fecha];
    cols.innerHTML = (T.st ? `<p class="tb-vacio">${esc(T.st)}</p>` : "") + COLS.map(([k, nom]) => {
      const ts = xs.filter((t) => t.col === k);
      return `<section class="tb-col c-${k}"><header><b>${nom}</b><span class="num">${ts.length}</span></header>
        <div class="tb-notas">${cargando ? `<p class="tb-vacio chico">Cargando…</p>` : ts.length ? ts.map(nota).join("") : `<p class="tb-vacio chico">${k === "listo" ? "Nada terminado todavía" : "Nada acá"}</p>`}</div></section>`;
    }).join("");
    pintarGrande();
  }
  function nota(t, i) {
    const [cl, color] = CLASE[t.clase] || CLASE.manual;
    return `<button type="button" class="tb-nota c-${color}${t.col === "listo" ? " hecha" : ""}" data-tbc="${esc(t.id)}" style="--r:${((t.titulo.length * 7) % 7 - 3) * 0.4}deg">
      <small>${cl}${t.duenos.length ? " · " + t.duenos.map((d) => QUIEN[d] || d).join(" y ") : ""}</small>
      <b>${esc(t.titulo)}</b>
      ${t.col !== "listo" && (t.pct > 0 || t.fuente === "taller") ? `<span class="tb-pie">${barra(t.pct)}<span class="num">${t.pct}%</span></span>` : t.col === "listo" ? `<span class="tb-ok">✓ Terminada</span>` : ""}
    </button>`;
  }
  function pintarGrande() {
    const v = $(".tb-velo"); if (!v) return;
    const capa = $(".tb-capa", v);
    if (!T.grande) { capa.hidden = true; capa.innerHTML = ""; return; }
    capa.hidden = false;
    if (T.grande === "nueva") {
      capa.innerHTML = `<div class="tb-grande c-gris" role="dialog" aria-label="Nueva tarea"><button type="button" class="tb-x chico" data-tbcerrar aria-label="Cerrar">✕</button>
        <small>Nueva tarea · ${esc(nomFecha(T.fecha))}</small>
        <input class="tb-in-tit" placeholder="¿Qué hay que hacer?" maxlength="140">
        <label class="tb-lbl">Checklist (una por renglón, opcional)<textarea class="tb-in-items" rows="5" placeholder="Paso 1&#10;Paso 2"></textarea></label>
        <label class="tb-lbl">De quién<select class="tb-in-dueno"><option value="">Los dos</option><option value="lorenzo">Lorenzo</option><option value="franco">Franco</option></select></label>
        <p class="tb-err"></p><div class="tb-acc"><button type="button" class="tb-b fuerte" data-tba="crear">Agregar</button><button type="button" class="tb-b" data-tbcerrar>Cancelar</button></div></div>`;
      setTimeout(() => $(".tb-in-tit", capa)?.focus(), 50); return;
    }
    const t = actual(); if (!t) { T.grande = null; capa.hidden = true; return; }
    const [cl, color] = CLASE[t.clase] || CLASE.manual;
    const lista = t.fuente === "taller" ? t.filas.map((f, j) => { const pid = `${t.id}|${j}`, ab = T.pAb.has(pid), ok = f.pct === 100;
        return `<li class="${ok ? "ok" : ""}${f.it ? "" : " falta"}"><button type="button" data-tbp="${esc(pid)}" ${f.it ? "" : "disabled"}><span class="tb-mini${ok ? " si" : ""}">${ok ? "✓" : ""}</span><span class="tb-ft">${esc(f.t)}${f.it && f.t !== f.it.nombre ? `<small>${esc(f.it.nombre)}</small>` : !f.it ? `<small>todavía no arrancó</small>` : ""}</span><span class="tb-fp num">${ok ? (f.it?.estado === "para_revisar" ? "a revisar" : "") : f.pct + "%"}</span></button>
          ${ab && f.it ? `<div class="tb-pasos">${!ok && f.it.estado ? `<p class="tb-est">${esc(ESTADO[f.it.estado] || f.it.estado)}${f.it.nota ? " · " + esc(f.it.nota) : ""}</p>` : ""}${(f.it.pasos || []).length ? `<ul>${f.it.pasos.map((p) => `<li class="${p.estado}"><span class="tb-mini${p.estado === "ok" ? " si" : ""}">${p.estado === "ok" ? "✓" : p.estado === "error" ? "!" : ""}</span><span>${esc(p.t || p.k)}${p.estado === "curso" && p.de ? ` <i class="num">${p.n || 0}/${p.de}</i>` : ""}</span>${p.det && p.estado !== "ok" ? `<small>${esc(p.det)}</small>` : ""}</li>`).join("")}</ul>` : `<p class="tb-est">Sin pasos cargados.</p>`}${(f.it.links || []).map((l) => `<a class="tb-lk" href="${esc(l.u || l.url)}" target="_blank" rel="noopener">${esc(l.t || "Abrir")}</a>`).join("")}${f.it.carpeta ? `<a class="tb-lk" href="${esc(f.it.carpeta)}" target="_blank" rel="noopener">Carpeta</a>` : ""}</div>` : ""}</li>`; }).join("")
      : t.items.map((x, j) => `<li class="${x.ok ? "ok" : ""}"><button type="button" data-tbi="${j}"><span class="tb-mini${x.ok ? " si" : ""}">${x.ok ? "✓" : ""}</span><span class="tb-ft">${esc(x.t)}</span></button></li>`).join("");
    capa.innerHTML = `<div class="tb-grande c-${color}${t.col === "listo" ? " hecha" : ""}" role="dialog" aria-label="${esc(t.titulo)}"><button type="button" class="tb-x chico" data-tbcerrar aria-label="Cerrar">✕</button>
      <small>${cl}${t.duenos.length ? " · " + t.duenos.map((d) => QUIEN[d] || d).join(" y ") : ""} · ${COLS.find((c) => c[0] === t.col)[1]}</small>
      <h3>${esc(t.titulo)}</h3>${t.nota ? `<p class="tb-nota-tx">${esc(t.nota)}</p>` : ""}
      ${t.fuente === "taller" || t.items.length ? `<div class="tb-pie grande">${barra(t.pct)}<span class="num">${t.pct}%</span></div>` : ""}
      ${lista ? `<ul class="tb-filas">${lista}</ul>` : `<p class="tb-est">Sin checklist.</p>`}
      <p class="tb-err"></p>
      <div class="tb-acc">${t.col !== "listo" ? `<button type="button" class="tb-b fuerte" data-tba="listo">✓ Marcar lista</button>` : `<button type="button" class="tb-b" data-tba="proceso">Volver a en proceso</button>`}
        ${t.col === "sin_iniciar" ? `<button type="button" class="tb-b" data-tba="proceso">Pasar a en proceso</button>` : t.col === "en_proceso" ? `<button type="button" class="tb-b" data-tba="iniciar">Volver a sin iniciar</button>` : ""}
        <button type="button" class="tb-b peligro" data-tba="eliminar">Eliminar</button></div></div>`;
  }

  // ---------- demo ----------
  function demoItems() {
    const h = (m) => new Date(Date.now() - m * 60e3).toISOString(), p = (...e) => e.map((x, i) => ({ k: "p" + i, t: x[0], estado: x[1], n: x[2], de: x[3] }));
    return [
      { id: "a", dueno: "lorenzo", oferta: "Hígado Sano IT", tipo: "oto", nombre: "OTO1 · Dottor Fausto IA", estado: "listo", actualizado: h(30), pasos: p(["Guion", "ok"], ["Voz", "ok"], ["Render", "ok"]) },
      { id: "b", dueno: "lorenzo", oferta: "Hígado Sano IT", tipo: "oto", nombre: "OTO2 · VSL Collagene", estado: "para_revisar", actualizado: h(20) },
      { id: "c", dueno: "lorenzo", oferta: "Hígado Sano IT", tipo: "oto", nombre: "OTO3 · VSL Cuore", estado: "trabajando", actualizado: h(5), pasos: p(["Guion", "ok"], ["Voz", "ok"], ["Lip-sync", "curso", 8, 15], ["Render", "pendiente"]) },
      { id: "d", dueno: "lorenzo", oferta: "Hígado Sano IT", tipo: "oto", nombre: "OTO4 · VSL Pancia", estado: "en_cola", actualizado: h(5) },
      { id: "e", dueno: "franco", oferta: "Hígado Sano FR", tipo: "tienda", nombre: "Foie Sain FR · tienda", estado: "listo", actualizado: h(90) },
      { id: "f", dueno: "franco", oferta: "Hígado Sano FR", tipo: "vsl", nombre: "VSL Foie Sain FR", estado: "trabajando", progreso: 53, actualizado: h(3) },
      ...[1, 2, 3, 4, 5].map((n) => ({ id: "g" + n, dueno: "franco", oferta: "Hígado Sano FR", tipo: "creativo", nombre: `FR ${n}`, estado: n < 4 ? "para_revisar" : "trabajando", progreso: n < 4 ? 100 : 40, actualizado: h(10) })),
      ...[1, 2, 3, 4].map((n) => ({ id: "r" + n, dueno: "lorenzo", oferta: "Ayuno 2.0 AR", tipo: "reno", nombre: `R0${n} · reno 08.11`, estado: "listo", progreso: 100, actualizado: h(8) })),
      { id: "k", dueno: "lorenzo", oferta: "Hígado Sano KR", tipo: "tienda", nombre: "Tienda Corea", estado: "en_cola", actualizado: h(8) },
    ];
  }

  // ---------- arranque ----------
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boton); else boton();
  setInterval(() => { boton(); if (!T.abierto) cargar(); }, 5 * 60e3);
  setTimeout(() => cargar(), 4000);
  window.Tablero = { abrir, cerrar };
})();

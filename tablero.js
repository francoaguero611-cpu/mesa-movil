/* =====================================================================================================
   TABLERO DE TAREAS (07/11, Lorenzo): «un botón a la vista que no ocupe espacio; se abre un pop-up grande tipo Miro con las
   tareas de hoy (de Lorenzo y de Franco) con su checkbox; tocás una y se abre su checklist: OTO 1 tachado si terminó, OTO 3
   con 53 %… En un testeo: config de Impultienda, VSL/landing, los 5 creativos, pixel, fan page… que se tache solo».
   Lee el TALLER (ws-evento ?accion=taller: lo que cada chat marca con scripts/taller.py) y lo agrupa solo en tareas:
   oferta (normalizada) + clase (Post-venta · Testeo · Renovaciones · Creativos · Otros). Los testeos y post-ventas tienen
   plantilla: lo que falta aparece sin tachar y con 0 %.
   ===================================================================================================== */
(() => {
  const API = "https://tppcpnfzcxxusdhrlmdx.supabase.co/functions/v1/ws-evento";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const clave = () => { try { return localStorage.getItem("dash_clave") || ""; } catch { return ""; } };
  const DEMO = /[?&]demo=1/.test(location.search);
  const T = { items: null, st: "", abierto: false, filtro: (() => { try { return localStorage.getItem("tb_filtro") || "todos"; } catch { return "todos"; } })(), abiertas: new Set(), piezaAb: new Set(), ult: 0 };

  // ---------- agrupar en tareas ----------
  const HECHO = new Set(["para_revisar", "aprobado", "listo"]);
  const norm = (o) => String(o || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\b(sano|desafio|sistema)\b/g, "").replace(/\s+/g, " ").trim();
  const pctPasos = (ps) => {
    const xs = (ps || []).filter((p) => p && p.estado !== "salto"); if (!xs.length) return null;
    let t = 0; for (const p of xs) t += p.estado === "ok" ? 1 : p.estado === "curso" && p.de ? Math.min(0.95, (p.n || 0) / p.de) : 0;
    return Math.round((t / xs.length) * 100);
  };
  const pctItem = (it) => HECHO.has(it.estado) ? 100 : it.progreso != null ? Math.max(0, Math.min(99, Math.round(it.progreso))) : pctPasos(it.pasos) ?? 0;
  const esReno = (it) => it.tipo === "reno" || (it.tipo === "creativo" && /\breno\b|^r\d{1,2}\b|^reno /i.test(it.nombre || ""));
  const POST = new Set(["oto", "postventa", "entregable", "downsell", "upsell"]);
  const TESTEO = new Set(["tienda", "landing", "tracking", "fanpage", "pagina", "campana"]);
  function tareas(items) {
    const ahora = Date.now(), G = new Map();
    for (const it of items || []) {
      const edad = (ahora - Date.parse(it.actualizado || it.inicio || 0)) / 3600e3;
      if (edad > 72 || (edad > 24 && HECHO.has(it.estado))) continue;
      const k = norm(it.oferta); if (!k) continue;
      if (!G.has(k)) G.set(k, { k, oferta: it.oferta, items: [] });
      const g = G.get(k); g.items.push(it); if ((it.oferta || "").length > g.oferta.length) g.oferta = it.oferta;
    }
    const out = [];
    for (const g of G.values()) {
      const post = g.items.filter((x) => POST.has(x.tipo));
      const renos = g.items.filter((x) => !POST.has(x.tipo) && esReno(x));
      const resto = g.items.filter((x) => !post.includes(x) && !renos.includes(x));
      const esTesteo = resto.some((x) => TESTEO.has(x.tipo));
      if (post.length) out.push(armar("postventa", `Post-venta ${g.oferta}`, post));
      if (renos.length) out.push(armar("renos", `Renovaciones ${g.oferta}`, renos));
      if (resto.length) out.push(armar(esTesteo ? "testeo" : resto.every((x) => /creativo|traduccion|avatar/.test(x.tipo)) ? "creativos" : "otros", `${esTesteo ? "Testeo" : resto.every((x) => /creativo|traduccion|avatar/.test(x.tipo)) ? "Creativos" : "Tareas"} ${g.oferta}`, resto));
    }
    return out.sort((a, b) => (a.pct === 100) - (b.pct === 100) || b.ult - a.ult);
  }
  const porNombre = (a, b) => String(a.nombre).localeCompare(String(b.nombre), "es", { numeric: true });
  function armar(clase, titulo, its) {
    let filas = [];
    const fila = (t, it) => ({ t, it, pct: it ? pctItem(it) : 0 });
    if (clase === "testeo") {
      const usados = new Set(), toma = (f) => { const x = its.filter((i) => !usados.has(i) && f(i)).sort(porNombre); x.forEach((i) => usados.add(i)); return x; };
      const tienda = toma((i) => i.tipo === "tienda"), vsl = toma((i) => i.tipo === "vsl" || i.tipo === "landing");
      const crea = toma((i) => i.tipo === "creativo" || i.tipo === "traduccion"), px = toma((i) => i.tipo === "tracking");
      const fp = toma((i) => i.tipo === "fanpage" || i.tipo === "pagina"), camp = toma((i) => i.tipo === "campana");
      filas.push(...(tienda.length ? tienda.map((i) => fila("Configuración de Impultienda", i)) : [fila("Configuración de Impultienda")]));
      filas.push(...(vsl.length ? vsl.map((i) => fila(i.tipo === "vsl" ? "VSL / landing" : "Landing", i)) : [fila("VSL / landing")]));
      for (let n = 0; n < Math.max(5, crea.length); n++) filas.push(crea[n] ? fila(`Creativo ${n + 1}`, crea[n]) : fila(`Creativo ${n + 1}`));
      filas.push(px.length ? fila("Pixel + CAPI", px[0]) : fila("Pixel + CAPI"));
      filas.push(fp.length ? fila("Fan page", fp[0]) : fila("Fan page"));
      filas.push(...(camp.length ? camp.map((i) => fila("Campaña", i)) : [fila("Campaña")]));
      for (const i of its.filter((x) => !usados.has(x)).sort(porNombre)) filas.push(fila(i.tipo === "avatar" ? "Avatares / voces" : "Extra", i));
    } else if (clase === "postventa") {
      const otos = its.filter((i) => i.tipo === "oto").sort(porNombre), otros = its.filter((i) => i.tipo !== "oto").sort(porNombre);
      for (let n = 0; n < Math.max(4, otos.length); n++) filas.push(otos[n] ? fila(`OTO ${n + 1}`, otos[n]) : fila(`OTO ${n + 1}`));
      for (const i of otros) filas.push(fila(i.tipo === "entregable" ? "Entregables" : i.tipo === "downsell" ? "Downsell" : "Páginas y downsells", i));
    } else {
      filas = its.sort(porNombre).map((i) => fila(i.nombre, i));
    }
    const pct = Math.round(filas.reduce((t, f) => t + f.pct, 0) / Math.max(1, filas.length));
    const duenos = [...new Set(its.map((i) => i.dueno).filter(Boolean))];
    const ult = Math.max(...its.map((i) => Date.parse(i.actualizado || 0) || 0));
    return { id: clase + ":" + norm(titulo), clase, titulo, filas, pct, duenos, ult, hechas: filas.filter((f) => f.pct === 100).length };
  }

  // ---------- datos ----------
  async function cargar(forzar = false) {
    if (!forzar && Date.now() - T.ult < 50e3 && T.items) return;
    T.ult = Date.now();
    if (DEMO) { T.items = demo(); pintar(); badge(); return; }
    if (!clave()) return;
    try {
      const r = await fetch(`${API}?accion=taller&dias=3`, { headers: { "x-app-clave": clave() }, cache: "no-store" });
      const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || r.status);
      T.items = j.items || []; T.st = "";
    } catch (e) { T.st = "No pude leer el taller: " + String(e.message || e); }
    pintar(); badge();
  }

  // ---------- botón (en el encabezado, al lado de la campanita) ----------
  const ICO = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 6.5l1.6 1.6L8.6 5M4 12.5l1.6 1.6 3-3.1M4 18.5l1.6 1.6 3-3.1M11.5 6.8H20M11.5 12.8H20M11.5 18.8H17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  function boton() {
    const arriba = $(".acciones-top"); if (!arriba || $("#tb-btn", arriba)) return;
    const b = document.createElement("button");
    b.id = "tb-btn"; b.type = "button"; b.className = "btn icono tb-btn"; b.setAttribute("aria-label", "Tareas de hoy"); b.title = "Tareas de hoy";
    b.innerHTML = `${ICO}<span class="tb-badge" hidden></span>`;
    b.onclick = abrir;
    const av = $(".av-wrap", arriba); av ? arriba.insertBefore(b, av) : arriba.append(b);
    badge();
  }
  function badge() {
    const b = $("#tb-btn .tb-badge"); if (!b || !T.items) return;
    const n = tareas(T.items).filter((t) => t.pct < 100).length;
    b.hidden = !n; b.textContent = n;
  }

  // ---------- pop-up tablero ----------
  const CLASE = { postventa: ["Post-venta", "lila"], testeo: ["Testeo", "menta"], renos: ["Renovaciones", "lima"], creativos: ["Creativos", "rosa"], otros: ["Tareas", "gris"] };
  const QUIEN = { lorenzo: "Lorenzo", franco: "Franco" };
  const ESTADO = { trabajando: "trabajando", corrigiendo: "corrigiendo", esperando: "esperando", error: "trabado", pausado: "en pausa", en_cola: "en cola", para_revisar: "para revisar", aprobado: "aprobado", listo: "listo" };
  function abrir() {
    if ($(".tb-velo")) return;
    const v = document.createElement("div"); v.className = "tb-velo"; v.setAttribute("role", "dialog"); v.setAttribute("aria-modal", "true"); v.setAttribute("aria-label", "Tareas de hoy");
    v.innerHTML = `<div class="tb-caja"><div class="tb-cab"><div><h2>Tareas de hoy</h2><small class="tb-fecha"></small></div>
      <div class="tb-fil" role="group" aria-label="De quién">${[["todos", "Todos"], ["lorenzo", "Lorenzo"], ["franco", "Franco"]].map(([k, t]) => `<button type="button" data-tbf="${k}" aria-pressed="${T.filtro === k}">${t}</button>`).join("")}</div>
      <button type="button" class="tb-x" aria-label="Cerrar">✕</button></div><div class="tb-lienzo"><div class="tb-grid"></div></div></div>`;
    document.body.append(v); T.abierto = true;
    requestAnimationFrame(() => v.classList.add("visible"));
    v.addEventListener("click", (e) => {
      if (e.target === v || e.target.closest(".tb-x")) return cerrar();
      const f = e.target.closest("[data-tbf]"); if (f) { T.filtro = f.dataset.tbf; try { localStorage.setItem("tb_filtro", T.filtro); } catch {} return pintar(); }
      const c = e.target.closest("[data-tbt]"); if (c) { const id = c.dataset.tbt; T.abiertas.has(id) ? T.abiertas.delete(id) : T.abiertas.add(id); return pintar(); }
      const p = e.target.closest("[data-tbp]"); if (p) { const id = p.dataset.tbp; T.piezaAb.has(id) ? T.piezaAb.delete(id) : T.piezaAb.add(id); return pintar(); }
    });
    document.addEventListener("keydown", tecla);
    pintar(); cargar(true);
    T.timer = setInterval(() => cargar(true), 60e3);
  }
  function tecla(e) { if (e.key === "Escape") cerrar(); }
  function cerrar() { const v = $(".tb-velo"); if (!v) return; v.classList.remove("visible"); T.abierto = false; clearInterval(T.timer); document.removeEventListener("keydown", tecla); setTimeout(() => v.remove(), 280); }

  const barra = (p) => `<span class="tb-barra" aria-hidden="true"><i style="width:${p}%"></i></span>`;
  function pintar() {
    const v = $(".tb-velo"); if (!v) return;
    $$("[data-tbf]", v).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tbf === T.filtro)));
    const f = new Date(); $(".tb-fecha", v).textContent = f.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }) + (T.ult ? ` · actualizado ${new Date(T.ult).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` : "");
    const g = $(".tb-grid", v);
    if (!T.items) { g.innerHTML = `<p class="tb-vacio">Cargando las tareas…</p>`; return; }
    let ts = tareas(T.items); if (T.filtro !== "todos") ts = ts.filter((t) => t.duenos.includes(T.filtro));
    if (!ts.length) { g.innerHTML = `<p class="tb-vacio">${T.st ? esc(T.st) : "No hay tareas en curso hoy."}</p>`; return; }
    g.innerHTML = (T.st ? `<p class="tb-vacio">${esc(T.st)}</p>` : "") + ts.map((t, i) => {
      const [cl, color] = CLASE[t.clase] || CLASE.otros, ab = T.abiertas.has(t.id), lista = ab ? t.filas : t.filas.slice(0, 7);
      return `<article class="tb-nota c-${color}${t.pct === 100 ? " hecha" : ""}" style="--r:${((i * 37) % 7 - 3) * 0.35}deg">
        <button type="button" class="tb-nota-cab" data-tbt="${esc(t.id)}" aria-expanded="${ab}">
          <span class="tb-check${t.pct === 100 ? " si" : ""}" aria-hidden="true">${t.pct === 100 ? "✓" : ""}</span>
          <span class="tb-tit"><small>${cl}${t.duenos.length ? " · " + t.duenos.map((d) => QUIEN[d] || d).join(" y ") : ""}</small><b>${esc(t.titulo)}</b></span>
          <span class="tb-pct num">${t.pct}%</span></button>
        ${barra(t.pct)}<small class="tb-cuenta">${t.hechas} de ${t.filas.length} listas</small>
        <ul class="tb-filas">${lista.map((f, j) => { const pid = `${t.id}|${j}`, pab = T.piezaAb.has(pid), ok = f.pct === 100;
          return `<li class="${ok ? "ok" : ""}${f.it ? "" : " falta"}"><button type="button" data-tbp="${esc(pid)}" ${f.it ? "" : "disabled"}>
            <span class="tb-mini${ok ? " si" : ""}" aria-hidden="true">${ok ? "✓" : ""}</span><span class="tb-ft">${esc(f.t)}${f.it && f.t !== f.it.nombre ? `<small>${esc(f.it.nombre)}</small>` : !f.it ? `<small>todavía no arrancó</small>` : ""}</span>
            <span class="tb-fp num">${ok ? (f.it?.estado === "para_revisar" ? "a revisar" : "") : f.pct + "%"}</span></button>
            ${pab && f.it ? `<div class="tb-pasos">${f.it.estado && !ok ? `<p class="tb-est">${esc(ESTADO[f.it.estado] || f.it.estado)}${f.it.nota ? " · " + esc(f.it.nota) : ""}</p>` : ""}${(f.it.pasos || []).length ? `<ul>${f.it.pasos.map((p) => `<li class="${p.estado}"><span class="tb-mini${p.estado === "ok" ? " si" : ""}">${p.estado === "ok" ? "✓" : p.estado === "error" ? "!" : ""}</span>${esc(p.t || p.k)}${p.estado === "curso" && p.de ? ` <i class="num">${p.n || 0}/${p.de}</i>` : ""}${p.det && p.estado !== "ok" ? `<small>${esc(p.det)}</small>` : ""}</li>`).join("")}</ul>` : `<p class="tb-est">Sin pasos cargados.</p>`}${(f.it.links || []).length ? `<p class="tb-links">${f.it.links.map((l) => `<a href="${esc(l.u || l.url)}" target="_blank" rel="noopener">${esc(l.t || "Abrir")}</a>`).join("")}</p>` : ""}${f.it.carpeta ? `<p class="tb-links"><a href="${esc(f.it.carpeta)}" target="_blank" rel="noopener">Carpeta</a></p>` : ""}</div>` : ""}</li>`; }).join("")}</ul>
        ${!ab && t.filas.length > 7 ? `<button type="button" class="tb-mas" data-tbt="${esc(t.id)}">+ ${t.filas.length - 7} más</button>` : ""}
      </article>`;
    }).join("");
  }

  // ---------- demo ----------
  function demo() {
    const h = (m) => new Date(Date.now() - m * 60e3).toISOString(), p = (...e) => e.map((x, i) => ({ k: "p" + i, t: x[0], estado: x[1], n: x[2], de: x[3] }));
    return [
      { id: "a", dueno: "lorenzo", oferta: "Hígado Sano IT", tipo: "oto", nombre: "OTO1 · Dottor Fausto IA", estado: "listo", actualizado: h(30), pasos: p(["Guion", "ok"], ["Voz", "ok"], ["Render", "ok"]) },
      { id: "b", dueno: "lorenzo", oferta: "Hígado Sano IT", tipo: "oto", nombre: "OTO2 · VSL Collagene", estado: "para_revisar", actualizado: h(20), pasos: p(["Guion", "ok"], ["Voz", "ok"], ["Render", "ok"]) },
      { id: "c", dueno: "lorenzo", oferta: "Hígado Sano IT", tipo: "oto", nombre: "OTO3 · VSL Cuore e Pressione", estado: "trabajando", actualizado: h(5), pasos: p(["Guion", "ok"], ["Voz", "ok"], ["Lip-sync", "curso", 8, 15], ["Render", "pendiente"]) },
      { id: "d", dueno: "lorenzo", oferta: "Hígado Sano IT", tipo: "oto", nombre: "OTO4 · VSL Pancia", estado: "en_cola", actualizado: h(5), pasos: p(["Guion", "ok"], ["Voz", "pendiente"], ["Render", "pendiente"]) },
      { id: "e", dueno: "franco", oferta: "Hígado Sano FR", tipo: "tienda", nombre: "Foie Sain FR · tienda", estado: "listo", actualizado: h(90) },
      { id: "f", dueno: "franco", oferta: "Hígado Sano FR", tipo: "vsl", nombre: "VSL Foie Sain FR", estado: "trabajando", progreso: 53, actualizado: h(3) },
      ...[1, 2, 3, 4, 5].map((n) => ({ id: "g" + n, dueno: "franco", oferta: "Hígado Sano FR", tipo: "creativo", nombre: `FR ${n}`, estado: n < 4 ? "para_revisar" : "trabajando", progreso: n < 4 ? 100 : 40, actualizado: h(10) })),
      { id: "h", dueno: "franco", oferta: "Hígado Sano FR", tipo: "tracking", nombre: "Pixel + CAPI + dominio", estado: "esperando", progreso: 80, actualizado: h(60) },
      ...[1, 2, 3, 4, 5, 6].map((n) => ({ id: "r" + n, dueno: "lorenzo", oferta: "Ayuno 2.0 AR", tipo: "reno", nombre: `R0${n} · reno 08.11`, estado: n < 3 ? "para_revisar" : "trabajando", progreso: n < 3 ? 100 : 30 + n * 8, actualizado: h(8) })),
    ];
  }

  // ---------- arranque ----------
  function vigilar() { boton(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", vigilar); else vigilar();
  setInterval(() => { vigilar(); if (!T.abierto) cargar(); }, 5 * 60e3);
  setTimeout(() => cargar(), 4000);
  new MutationObserver(() => { if (!$("#tb-btn")) boton(); }).observe(document.body, { childList: true, subtree: false });
  window.Tablero = { abrir, cerrar };
})();

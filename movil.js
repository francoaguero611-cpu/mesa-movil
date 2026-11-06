/* =====================================================================================================
   MESA CELULAR (06/11, Lorenzo: «tiene que ser una versión para celular y otra para computadora, como si fuera otra app»).
   Mismo diseño Mesa, pero armado como app: barra de pestañas abajo, encabezado fijo arriba, campañas como tarjetas,
   isla como panel de acciones que sube desde abajo, ventanas como hojas. Se prende con html.ms-cel (pantallas ≤ 760 px).
   Solo acomoda lo que ya pinta app.js / mesa.js: no cambia datos ni acciones.
   ===================================================================================================== */
(() => {
  const mq = matchMedia("(max-width: 760px)");
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const raiz = document.documentElement;
  const ico = (d, w = 22) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const I = {
    dash: "M4 20 C 9 19.6, 15 20.2, 20.5 19.8 M6.5 17 V11.5 M11.5 17 V6.5 M16.5 17 V9.5",
    reportes: "M5 4.5 C 9.5 4.3, 14 4.6, 18.8 4.4 L18.6 19.6 C 14 19.8, 9.5 19.5, 5.2 19.7 Z M8.3 15.5 L11 12.3 L13.2 14.2 L16 10",
    umbrales: "M4.5 15.5 C 4.6 10.8, 8 7.2, 12 7.1 C 16.1 7, 19.5 10.6, 19.5 15.4 M12 15.2 L15.4 10.6 M3.8 18.6 H20.2",
    mas: "M5 12 h.01 M12 12 h.01 M19 12 h.01",
    estrella: "M12 3 C 12.6 8.4, 15.6 11.4, 21 12 C 15.6 12.6, 12.6 15.6, 12 21 C 11.4 15.6, 8.4 12.6, 3 12 C 8.4 11.4, 11.4 8.4, 12 3 Z",
  };
  const MAS = [["ranking", "Ranking", "Los mejores anuncios"], ["cazador", "Cazador", "Ofertas de la Biblioteca"], ["creativos", "Creativos", "Carpetas de entregas"], ["atc", "ATC", "Comentarios, mails y reclamos"]];
  const ETQ = { presupuesto: "Presupuesto", roas: "ROAS", ganancia: "Ganancia", gasto: "Gastado", facturacion: "Facturación", ventas: "Ventas", margen: "Margen", cpa: "CPA", ticket_promedio: "Ticket" };

  function irSec(sec) { const b = $(`#secciones [data-sec="${sec}"]`); if (b) b.click(); window.scrollTo({ top: 0 }); }
  function vibrar() { try { navigator.vibrate && navigator.vibrate(8); } catch {} }

  // ---------- barra de pestañas de abajo ----------
  function pestanas() {
    if ($(".mc-tabs")) return;
    const n = document.createElement("nav");
    n.className = "mc-tabs"; n.setAttribute("aria-label", "Secciones");
    const tab = (id, t, d) => `<button type="button" class="mc-tab" data-mc="${id}" aria-current="false">${ico(d)}<span>${t}</span></button>`;
    n.innerHTML = `${tab("dash", "Inicio", I.dash)}${tab("reportes", "Reportes", I.reportes)}
      <button type="button" class="mc-jarvis" data-mc="jarvis" aria-label="Abrir Jarvis"><span class="mc-jv-orbe">${ico(I.estrella, 22)}</span><span class="mc-jv-badge" hidden></span></button>
      ${tab("umbrales", "Umbrales", I.umbrales)}${tab("mas", "Más", I.mas)}`;
    document.body.append(n);
    n.addEventListener("click", (e) => {
      const b = e.target.closest("[data-mc]"); if (!b) return;
      vibrar();
      const id = b.dataset.mc;
      if (id === "jarvis") return window.Jarvis?.abrir();
      if (id === "mas") return abrirMas();
      cerrarMas(); irSec(id);
    });
    marcarTab();
  }
  function marcarTab() {
    const act = $('#secciones [data-sec][aria-pressed="true"]')?.dataset.sec || "dash";
    const tab = MAS.some(([k]) => k === act) ? "mas" : act;
    $$(".mc-tab").forEach((b) => b.setAttribute("aria-current", b.dataset.mc === tab ? "page" : "false"));
    // número de avisos de Jarvis en el botón del medio
    const bj = $("#jv-fab .jv-badge"), mb = $(".mc-jv-badge");
    if (mb) { const v = bj && !bj.hidden ? bj.textContent.trim() : ""; mb.hidden = !v; mb.textContent = v; }
  }

  // ---------- hoja «Más» ----------
  function abrirMas() {
    if ($(".mc-hoja")) return cerrarMas();
    const act = $('#secciones [data-sec][aria-pressed="true"]')?.dataset.sec;
    const h = document.createElement("div");
    h.className = "mc-hoja-velo";
    h.innerHTML = `<div class="mc-hoja" role="dialog" aria-modal="true" aria-label="Más secciones"><span class="mc-asa" aria-hidden="true"></span>
      <h3>Más secciones</h3>
      <div class="mc-mas">${MAS.map(([k, t, s]) => { const sb = $(`#secciones [data-sec="${k}"] svg`); return `<button type="button" class="mc-mas-b${act === k ? " act" : ""}" data-ir="${k}">${sb ? sb.outerHTML : ""}<b>${t}</b><small>${s}</small></button>`; }).join("")}</div>
      <button type="button" class="mc-opciones" data-opc>Opciones de la cuenta</button></div>`;
    document.body.append(h);
    requestAnimationFrame(() => h.classList.add("visible"));
    h.addEventListener("click", (e) => {
      const b = e.target.closest("[data-ir]");
      if (b) { cerrarMas(); irSec(b.dataset.ir); return; }
      if (e.target.closest("[data-opc]")) { cerrarMas(); setTimeout(() => $("#b-menu")?.click(), 260); return; }
      if (e.target === h) cerrarMas();
    });
    arrastrarParaCerrar($(".mc-hoja", h), cerrarMas);
  }
  function cerrarMas() { const h = $(".mc-hoja-velo"); if (!h) return; h.classList.remove("visible"); setTimeout(() => h.remove(), 320); }
  // bajar la hoja con el dedo la cierra
  function arrastrarParaCerrar(hoja, cerrar) {
    let y0 = null, dy = 0;
    hoja.addEventListener("touchstart", (e) => { if (hoja.scrollTop > 0) return; y0 = e.touches[0].clientY; dy = 0; hoja.style.transition = "none"; }, { passive: true });
    hoja.addEventListener("touchmove", (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); hoja.style.transform = `translateY(${dy}px)`; }, { passive: true });
    hoja.addEventListener("touchend", () => { if (y0 == null) return; y0 = null; hoja.style.transition = ""; hoja.style.transform = ""; if (dy > 90) cerrar(); });
  }

  // ---------- campañas como tarjetas: cada dato con su nombre arriba ----------
  function etiquetas() {
    const t = $("#tabla-scroll table"); if (!t) return;
    const nombres = {};
    $$("thead th", t).forEach((th) => { const k = [...th.classList].find((c) => c.startsWith("c-")); if (k) nombres[k.slice(2)] = th.textContent.trim(); });
    $$("tbody td.num, tfoot td.num", t).forEach((td) => {
      if (td.dataset.l) return;
      const k = [...td.classList].find((c) => c.startsWith("c-")); if (!k) return;
      const key = k.slice(2); td.dataset.l = ETQ[key] || nombres[key] || "";
    });
  }

  // ---------- encabezado: título de la sección + saludo ----------
  function encabezado() {
    const top = $(".top"); if (!top) return;
    if (!$(".mc-logo", top)) {
      const l = document.createElement("img");
      l.className = "mc-logo"; l.src = "icons/icon-192.png?v=27"; l.alt = "";
      $(".marca", top)?.prepend(l);
    }
  }

  // ---------- todo junto, cada vez que la app vuelve a pintar ----------
  let pend = 0;
  function armar() {
    if (!raiz.classList.contains("ms-cel")) return;
    pestanas(); encabezado(); marcarTab(); etiquetas();
    // el buscador va solo en su renglón; abajo, la tira de filtros (cuenta, oferta, comparar días, apagadas…)
    const fb = $(".filtro-camp > #f-buscar"); if (fb) $(".filtro-camp").before(fb);
    document.body.classList.toggle("mc-con-isla", !!$("#barra:not([hidden])"));
  }
  const obs = new MutationObserver(() => { cancelAnimationFrame(pend); pend = requestAnimationFrame(armar); });

  function aplicar() {
    raiz.classList.toggle("ms-cel", mq.matches);
    if (mq.matches) { armar(); obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-pressed", "hidden"] }); }
    else { obs.disconnect(); $(".mc-tabs")?.remove(); cerrarMas(); }
  }
  mq.addEventListener ? mq.addEventListener("change", aplicar) : mq.addListener(aplicar);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", aplicar); else aplicar();
  window.MesaCel = { activo: () => mq.matches };
})();

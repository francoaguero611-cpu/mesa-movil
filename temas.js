/* Diseños nuevos (06/11, Lorenzo): selector flotante para comparar los 4 diseños + marcas en las tarjetas clave.
   El tema se fija en <head> (index.html) antes de pintar; acá solo va lo que necesita la página armada. */
"use strict";
(() => {
const TEMAS = [["actual", "Actual"], ["terminal", "Terminal"], ["neon", "Neón"], ["cabina", "Cabina"], ["estudio", "Estudio"]];
const raiz = document.documentElement;
function poner(t) {
  if (t === "actual") { raiz.removeAttribute("data-tema"); } else raiz.setAttribute("data-tema", t);
  try { localStorage.setItem("dash_diseno", t); } catch {}
  document.querySelectorAll(".tem-sel button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.t === t)));
}
function selector() {
  let ver = false; try { ver = localStorage.getItem("dash_disenos_ver") === "1"; } catch {}
  if (!ver || document.querySelector(".tem-sel")) return;
  const d = document.createElement("div"); d.className = "tem-sel"; d.setAttribute("role", "group"); d.setAttribute("aria-label", "Elegir diseño");
  const act = raiz.getAttribute("data-tema") || "actual";
  d.innerHTML = TEMAS.map(([k, n]) => `<button type="button" data-t="${k}" aria-pressed="${k === act}">${n}</button>`).join("");
  d.addEventListener("click", (e) => { const b = e.target.closest("button[data-t]"); if (b) poner(b.dataset.t); });
  document.body.append(d);
}
function marcar() {
  document.querySelectorAll(".met .lbl").forEach((l) => {
    const t = l.textContent.trim().toLowerCase(), m = l.parentElement;
    m.classList.toggle("es-ganancia", t === "ganancia");
    m.classList.toggle("es-roas", t === "roas");
  });
}
let pend = false;
new MutationObserver(() => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; marcar(); }); }).observe(document.body, { childList: true, subtree: true });
marcar(); selector();
})();

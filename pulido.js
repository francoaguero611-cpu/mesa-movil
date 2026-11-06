/* Pulido (06/11, Lorenzo) — la parte de pulido.css que necesita JS. Inspirado en Count Up y Border Beam de 21st.dev.
   - Los números de las tarjetas (.met .val) ruedan desde el valor anterior hasta el nuevo (la primera vez, desde 0).
     Lee el formato argentino (5.322,78 · 39 % · US$ 2.620) y lo respeta; si no entiende el texto, no toca nada.
   - Cascada de entrada de las tarjetas la primera vez que aparecen.
   - Haz de luz en la tarjeta «Ganancia» cuando es positiva.
   Decorativo: si algo falla, la app sigue igual. */
"use strict";
(() => {
const reducido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const NUM = /-?\d{1,3}(?:\.\d{3})+(?:,\d+)?|-?\d+(?:,\d+)?/;   // 5.322,78 · 2,03 · 375 · -12
const previo = new Map();     // etiqueta → número mostrado antes
const vistos = new WeakSet();
const propio = new WeakMap();  // nodo de texto → texto final que le puso esta animación (para no releer un número a medio rodar)
let yaEntraron = false;

function leer(tx) {
  const m = tx.match(NUM); if (!m) return null;
  const s = m[0], dec = (s.split(",")[1] || "").length;
  const v = parseFloat(s.replace(/\./g, "").replace(",", "."));
  if (!isFinite(v)) return null;
  const miles = /\./.test(s) || Math.abs(v) >= 1000;
  return { v, dec, miles, antes: tx.slice(0, m.index), despues: tx.slice(m.index + s.length) };
}
function fmt(v, dec, miles) {
  return v.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: miles });
}
function nodoTexto(el) { // el texto que tiene el número (puede estar dentro del chip de ROAS)
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) if (NUM.test(n.nodeValue)) return n;
  return null;
}
function etiqueta(met) {
  const l = met.querySelector(".lbl"); const caja = met.closest("[id], section, .tarjetas");
  return (caja && (caja.id || caja.className) || "") + "|" + (l ? l.textContent.trim() : "");
}
function rodar(met) {
  const val = met.querySelector(".val"); if (!val) return;
  const n = nodoTexto(val); if (!n) return;
  if (propio.has(n)) return;                       // ya lo estamos rodando (o ya terminó): no es un valor nuevo
  const p = leer(n.nodeValue); if (!p) return;
  const final = n.nodeValue; propio.set(n, final);
  const k = etiqueta(met), desde = previo.has(k) ? previo.get(k) : (yaEntraron ? p.v : 0);
  previo.set(k, p.v);
  if (desde === p.v || reducido()) return;
  met.classList.remove("pul-sube", "pul-baja");
  if (previo.size && desde !== 0) { void met.offsetWidth; met.classList.add(p.v > desde ? "pul-sube" : "pul-baja"); }
  const dur = Math.min(1100, 500 + Math.log10(Math.abs(p.v - desde) + 1) * 160), t0 = performance.now();
  const paso = (t) => {
    if (!n.isConnected) return;
    const x = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - x, 4);      // arranca rápido y frena suave
    n.nodeValue = p.antes + fmt(desde + (p.v - desde) * e, p.dec, p.miles) + p.despues;
    if (x < 1) requestAnimationFrame(paso); else n.nodeValue = final;   // termina exactamente en el texto original
  };
  if (document.hidden) { n.nodeValue = final; return; }      // pestaña oculta: sin animación (el navegador frena los cuadros)
  requestAnimationFrame(paso);
  setTimeout(() => { if (n.isConnected) n.nodeValue = final; }, dur + 250);   // red de seguridad: siempre termina en el valor real
}
function haz(met) {
  const l = met.querySelector(".lbl"), v = met.querySelector(".val");
  const ok = l && /^ganancia$/i.test(l.textContent.trim()) && v && v.classList.contains("positivo");
  let luz = met.querySelector(":scope > .pul-haz-luz");
  if (ok && !luz) { luz = document.createElement("span"); luz.className = "pul-haz-luz"; luz.setAttribute("aria-hidden", "true"); met.append(luz); met.classList.add("pul-haz"); }
  if (!ok && luz) { luz.remove(); met.classList.remove("pul-haz"); }
}
function revisar() {
  const nuevas = [];
  document.querySelectorAll(".met:not(.esqueleto)").forEach((met) => {
    try { haz(met); } catch { /* decorativo */ }
    if (!vistos.has(met)) { vistos.add(met); nuevas.push(met); }
    try { rodar(met); } catch { /* decorativo */ }
  });
  if (!yaEntraron && nuevas.length && !reducido()) {
    nuevas.forEach((m, i) => { m.style.setProperty("--i", i); m.classList.add("pul-entra"); m.addEventListener("animationend", () => m.classList.remove("pul-entra"), { once: true }); });
  }
  if (nuevas.length) yaEntraron = true;
}
let pend = false;
const obs = new MutationObserver(() => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; obs.disconnect(); revisar(); obs.observe(document.body, { childList: true, subtree: true }); }); });
function iniciar() { revisar(); obs.observe(document.body, { childList: true, subtree: true }); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();

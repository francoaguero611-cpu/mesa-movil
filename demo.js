/* Modo DEMO (?demo=1): datos falsos que respetan el contrato. Nada sale a la red. */
(function () {
  "use strict";
  const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = (seed) => { let a = hash(seed); return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const r2 = (n) => Math.round(n * 100) / 100;
  const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const ACT_T = "act_1029384756", ACT_G = "act_5566778899";

  // grupo: [clave, oferta, mercado, bandera, ticket, act, cuenta, paises, perfiles de campaña (ROAS objetivo; null = sin gasto)]
  const G = [
    ["cuero-oficio|francia", "Cuero", "Francia", "🇫🇷", 19.99, ACT_T, "TESTEOS", ["FR"], [3.2, 2.2, 1.4]],
    ["moldes-1500|latam", "Moldes", "LATAM", "🌎", 9.99, ACT_T, "TESTEOS", ["MX", "CO", "AR", "CL", "PE"], [2.6, 1.8, 1.1, null]],
    ["glp1-kitchen|anglo", "GLP-1 Kitchen", "Anglo", "🇬🇧", 24.99, ACT_G, "GALILEO SHOPS", ["GB", "IE", "CA", "AU", "NZ"], [2.05, 1.55, 0.7]],
    ["40-dias|mexico", "40 Días", "México", "🇲🇽", 7.99, ACT_T, "TESTEOS", ["MX"], [1.9, 2.8]],
    ["cuero-oficio|alemania", "Cuero", "Alemania", "🇩🇪", 19.99, ACT_T, "TESTEOS", ["DE", "AT", "CH"], [1.35, 0.9]],
    ["moldes-1500|italia", "Moldes", "Italia", "🇮🇹", 9.99, ACT_T, "TESTEOS", ["IT"], [2.4, 1.6]],
    ["bibelwelt-3d|alemania", "Bibelwelt 3D", "Alemania", "🇩🇪", 14.99, ACT_G, "GALILEO SHOPS", ["DE"], [1.2]],
    ["otros", "Otros", "Sin clasificar", null, 12.99, ACT_T, "TESTEOS", ["US"], [0.6]],
  ];
  const TIPOS = [
    ["CBO MADRE", null, ["Iteraciones", "Renovaciones"]],
    ["COSTCAP", "COST_CAP", ["BID 8 USD", "BID 9 USD", "BID 10 USD"]],
    ["BIDCAP", "LOWEST_COST_WITH_BID_CAP", ["BID 22 USD", "BID 21 USD", "BID 20 USD", "BID 19 USD"]],
    ["Testeo CBO", null, ["Testeo 5 creativos"]],
  ];
  const ADS = ["UGC Jorge — hook taller", "B-roll cinturón 70% OFF", "Viñetas 1.500 moldes", "Avatar IA cocina — reno 3", "Hook «no sabía coser»", "Reno winner + SFX", "Carrusel láminas A4", "Testimonial voz clonada", "B-roll manos cuero 2", "Iteración hook visual 4"];
  const FACT = { hoy: [1, 1], ayer: [1.05, 2], "7d": [6.2, 3], "30d": [24, 4] };

  const ESTR = [];   // estructura fija (ids, nombres, estados); métricas por período
  const ESTADOS = new Map();
  G.forEach(([clave, oferta, mercado, band, ticket, act, cuenta, paises, perfiles], gi) => {
    perfiles.forEach((roas, ci) => {
      const tipo = TIPOS[(gi + ci) % TIPOS.length];
      const cid = `1202${String(gi).padStart(2, "0")}${String(ci).padStart(2, "0")}0000${hash(clave + ci) % 9000 + 1000}`;
      const dia = 2 + ((gi * 3 + ci) % 7);
      const c = { id: cid, act, cuenta, grupo: clave, ticket, paises, roas, band, oferta,
        nombre: `${band || "🏳️"} ${dia}.10 ${tipo[0]} ${oferta}${mercado !== "Sin clasificar" ? "" : " (viejo)"}`,
        estrategia: tipo[1], presupuesto: tipo[1] ? null : (roas && roas > 2 ? 150.55 : 30.55), conjuntos: [] };
      ESTADOS.set(cid, roas == null || (gi === 4 && ci === 1) || gi === 7 ? (roas == null ? "ACTIVE" : "PAUSED") : "ACTIVE");
      tipo[2].forEach((cn, si) => {
        const sid = cid.slice(0, -4) + "1" + si + String(hash(cid + si) % 900 + 100);
        const s = { id: sid, nombre: `${dia}.10 ${cn}`, bid: /BID (\d+)/.test(cn) ? +cn.match(/BID (\d+)/)[1] : null, estrategia: tipo[1], presupuesto: tipo[1] ? 50.55 : null, anuncios: [] };
        ESTADOS.set(sid, si === 2 && ci === 0 ? "PAUSED" : "ACTIVE");
        const nAds = 2 + (hash(sid) % 3);
        for (let ai = 0; ai < nAds; ai++) {
          const aid = sid.slice(0, -3) + "7" + ai + String(hash(sid + ai) % 900 + 100);
          s.anuncios.push({ id: aid, nombre: ADS[(gi + ci * 3 + si + ai) % ADS.length], post: `78768949443588${gi}_${hash(aid) % 1e9}` });
          ESTADOS.set(aid, ai === nAds - 1 && (hash(aid) % 3 === 0) ? "PAUSED" : "ACTIVE");
        }
        c.conjuntos.push(s);
      });
      ESTR.push(c);
    });
  });

  const VACIO = { gasto: 0, ventas: 0, facturacion: 0, ganancia: 0, impresiones: 0, alcance: 0, clics: 0, visitas: 0, carritos: 0, pagos_iniciados: 0 };
  function metricasAd(c, a, per) {
    const [f, s] = FACT[per] || FACT.hoy;
    const R = rng(a.id + per + s);
    if (c.roas == null) return derivadas({ ...VACIO });
    const gasto = r2((6 + R() * 26) * f);
    const roasA = Math.max(0, c.roas * (0.55 + R() * 0.9));
    const ventas = Math.max(0, Math.round((gasto * roasA) / c.ticket));
    const bumps = ventas ? r2(ventas * c.ticket * (R() * 0.18)) : 0;
    const facturacion = r2(ventas * c.ticket + bumps);
    const visitas = ventas ? Math.round(ventas / (0.018 + R() * 0.03)) : Math.round(gasto / (0.25 + R() * 0.5) * 0.75);
    const clics = Math.round(visitas / (0.65 + R() * 0.2));
    const impresiones = Math.round(clics / (0.009 + R() * 0.016));
    const alcance = Math.round(impresiones / (1.05 + R() * 1.3));
    const carritos = ventas ? Math.round(ventas * (2 + R() * 1.6)) : Math.round(visitas * 0.04 * R());
    const pagos_iniciados = ventas ? Math.round(ventas * (1.25 + R() * 0.6)) : Math.round(carritos * 0.4 * R());
    return derivadas({ gasto, ventas, facturacion, ganancia: r2(facturacion * 0.88 - gasto), impresiones, alcance, clics, visitas, carritos, pagos_iniciados });
  }
  const div = (a, b, k = 1) => b ? r2((a / b) * k) : null;
  function derivadas(t) {
    t.roas = t.gasto ? r2(t.facturacion / t.gasto) : null;
    t.margen = t.facturacion ? Math.round((t.ganancia / t.facturacion) * 1e4) / 1e4 : null;
    t.ticket_promedio = div(t.facturacion, t.ventas);
    t.cpa = div(t.gasto, t.ventas);
    t.costo_pago_iniciado = div(t.gasto, t.pagos_iniciados);
    t.costo_carrito = div(t.gasto, t.carritos);
    t.conv_visitas = t.visitas ? Math.round((t.ventas / t.visitas) * 1e4) / 1e4 : null;
    t.ctr = t.impresiones ? Math.round((t.clics / t.impresiones) * 1e5) / 1e5 : null;
    t.cpc = div(t.gasto, t.clics);
    t.cpm = div(t.gasto, t.impresiones, 1000);
    t.frecuencia = div(t.impresiones, t.alcance);
    return t;
  }
  const SUMABLES = Object.keys(VACIO);
  const suma = (xs) => { const t = {}; for (const k of SUMABLES) t[k] = xs.reduce((s, x) => s + (x[k] || 0), 0);
    t.gasto = r2(t.gasto); t.facturacion = r2(t.facturacion); t.ganancia = r2(t.ganancia); return derivadas(t); };
  function arbol(c, per) {
    const conjuntos = c.conjuntos.map((s) => {
      const anuncios = s.anuncios.map((a) => ({ ...a, thumb: null, estado: ESTADOS.get(a.id), ...metricasAd(c, a, per) }));
      return { id: s.id, nombre: s.nombre, estado: ESTADOS.get(s.id), presupuesto: s.presupuesto, tipo_presupuesto: s.presupuesto ? "ABO" : "CBO", bid: s.bid, estrategia: s.estrategia, ...suma(anuncios), anuncios };
    });
    return { conjuntos, tot: suma(conjuntos) };
  }
  const met = (t) => ({ con_bump: Math.round(t.ventas * 0.23), pct_bump: t.ventas ? Math.round(t.ventas * 0.23) / t.ventas : null, con_post: Math.round(t.ventas * 0.09), pct_post: t.ventas ? Math.round(t.ventas * 0.09) / t.ventas : null, ventas_principales: t.ventas, facturacion: t.facturacion, ganancia: t.ganancia, margen: t.facturacion ? r2(t.ganancia / t.facturacion) : null, roas: t.roas, gasto: t.gasto, ventas: t.ventas });

  function dash(per) {
    const hoy = new Date();
    const campanas = ESTR.map((c) => { const { tot } = arbol(c, per); const { alcance, ...m } = tot; const abo = !c.presupuesto; return { id: c.id, act: c.act, cuenta: c.cuenta, nombre: c.nombre, grupo: c.grupo, estado: ESTADOS.get(c.id), presupuesto: abo ? r2(c.conjuntos.reduce((x, s) => x + (s.presupuesto || 0), 0)) || null : c.presupuesto, tipo_presupuesto: abo ? "ABO" : "CBO", estrategia: c.estrategia, ...m }; })
      .filter((c) => c.gasto > 0 || c.estado === "ACTIVE");
    const grupos = G.map(([clave, oferta, mercado, bandera]) => ({ clave, oferta, mercado, etiqueta: `${oferta} · ${mercado}`, bandera, metricas: met(suma(campanas.filter((c) => c.grupo === clave))) }))
      .filter((g) => g.metricas.gasto > 0 || g.metricas.facturacion > 0).sort((a, b) => b.metricas.gasto - a.metricas.gasto);
    const todas = { clave: "todas", oferta: "Todas", mercado: null, etiqueta: "Todas", metricas: met(suma(grupos.map((g) => ({ ...g.metricas })))) };
    const deCache = per === "30d";
    const hora = deCache ? new Date(hoy.getTime() - 47 * 60000) : hoy;
    const d = (n) => new Date(hoy.getTime() - n * 864e5).toISOString().slice(0, 10);
    const rango = { hoy: [0, 0], ayer: [1, 1], "7d": [6, 0], "30d": [29, 0] }[per];
    return { generado: hoy.toISOString(), periodo: per, desde: d(rango[0]), hasta: d(rango[1]),
      cache: { de_cache: deCache, hora: hora.toISOString(), aviso: deCache ? `Meta sin cupo de llamadas (TESTEOS): datos de las ${hora.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` : null },
      errores: per === "ayer" ? ["GALILEO SHOPS: Meta no devolvió conjuntos (límite de llamadas)"] : [],
      grupos: [todas, ...grupos], campanas };
  }
  function detalle(id, per) {
    const c = ESTR.find((x) => x.id === id);
    if (!c) throw Object.assign(new Error("Campaña no encontrada"), { code: 404 });
    return { id: c.id, act: c.act, conjuntos: arbol(c, per).conjuntos };
  }
  function buscarAd(id) { for (const c of ESTR) for (const s of c.conjuntos) for (const a of s.anuncios) if (a.id === id) return { c, s, a }; return null; }

  function capPlan(b) {
    const encontrados = (b.ads || []).map(buscarAd).filter(Boolean);
    if (!encontrados.length) throw new Error("No encontré esos anuncios");
    const c = encontrados[0].c;
    const m7 = encontrados.map(({ c, a }) => { const x = metricasAd(c, a, "7d"), h = metricasAd(c, a, "hoy"); return { g: x.gasto + h.gasto, v: x.ventas + h.ventas }; });
    const gasto = r2(m7.reduce((s, x) => s + x.g, 0)), compras = m7.reduce((s, x) => s + x.v, 0);
    if (!compras && b.escalera === "cpa5") throw new Error("Esos anuncios no tienen compras en los últimos 7 días + hoy: no se puede sacar el CPA promedio.");
    const cpa = compras ? r2(gasto / compras) : null;
    const ais = b.tipo === "aislada";
    const base = b.escalera === "cpa5" ? Math.floor(b.tipo === "bidcap" ? cpa * 2 : cpa) : Math.floor(c.ticket * 2);
    const bids = ais ? [] : [0, 1, 2, 3, 4, 5].map((i) => b.escalera === "cpa5" ? base + i : base - i);
    const pc = 50.55;
    const presC = ais ? (Number(b.presupuesto) || 30.55) : null;
    const man = new Date(Date.now() + 864e5);
    const dm = `${man.getDate()}.${man.getMonth() + 1}`;
    const T = b.tipo === "bidcap" ? "BIDCAP" : ais ? "CBO AISLADA" : "COSTCAP";
    const f2 = (n) => n.toFixed(2).replace(".", ",");
    const texto = ais ? (cpa ? `CPA del anuncio = ${f2(gasto)} ÷ ${compras} = ${f2(cpa)} (referencia)` : "")
      : b.escalera === "cpa5"
      ? (b.tipo === "bidcap" ? `CPA = ${f2(gasto)} ÷ ${compras} = ${f2(cpa)} × 2 = ${f2(cpa * 2)} → ${base}. Escalera ${bids[0]}…${bids[5]}` : `CPA = ${f2(gasto)} ÷ ${compras} = ${f2(cpa)} → ${base}. Escalera ${bids[0]}…${bids[5]}`)
      : `Ticket ${c.ticket.toFixed(2).replace(".", ",")} × 2 = ${(c.ticket * 2).toFixed(2).replace(".", ",")} → ${base}. Escalera ${bids[0]}…${bids[5]}`;
    const hl = { FR: "05:00", DE: "05:00", AT: "05:00", CH: "05:00", IT: "05:00", GB: "04:00", IE: "04:00", MX: "21:00 (día anterior)", CO: "22:00 (día anterior)", AR: "00:00", CL: "00:00", PE: "22:00 (día anterior)", CA: "23:00 (día anterior)", AU: "13:00", NZ: "15:00", US: "23:00 (día anterior)" };
    return { tipo: b.tipo, escalera: b.escalera,
      calculo: { gasto, compras, cpa_promedio: cpa, cpa_base: b.escalera === "cpa5" ? base : null, ventana: "últimos 7 días + hoy", ticket: c.ticket, ticket_fuente: "precio del producto (tabla PRECIO)", texto },
      bids, presupuesto_conjunto: ais ? null : pc, conjuntos: ais ? 3 : bids.length, presupuesto_total: ais ? presC : r2(pc * bids.length), ...(ais ? { presupuesto_campana: presC, tipo_presupuesto: "CBO" } : {}),
      nombre_campana: `${c.band || ""} ${dm} ${T} ${c.oferta}`.trim(), nombres_conjuntos: ais ? [1, 2, 3].map((i) => `${dm} AISLADA ${i}`) : bids.map((x) => `${dm} BID ${x} USD`),
      inicio: { iso: `${man.toISOString().slice(0, 10)}T00:00:00-0300`, ar: `${man.getDate()}/${man.getMonth() + 1} 00:00 AR`, locales: c.paises.map((p) => ({ pais: p, hora: hl[p] || "—" })), regla: "El país más adelantado arranca a las 05:00 locales; si no se puede, lo más temprano en todos." },
      origen: { campana: c.nombre, pixel: "1126243803161942", paises: c.paises, pagina: c.oferta === "40 Días" ? "Mariana Gutierrez" : "Carolina Castro", posts: encontrados.map(({ a }) => ({ ad_id: a.id, post: a.post, nombre: a.nombre })) },
      avisos: ["falta ciclo de vida: lo aplica el proceso local (navegador invisible)", ...(compras < 4 ? [`Solo ${compras} compras en la ventana: el CPA puede estar sesgado.`] : [])] };
  }


  // ---------- Reglas (demo) ----------
  const ahoraISO = () => new Date().toISOString();
  const haceDias = (n, h = 10) => { const d = new Date(Date.now() - n * 864e5); d.setHours(h, 12, 0, 0); return d.toISOString(); };
  const V = (valor, tipo, unidad, min, max, etiqueta) => ({ valor, tipo, unidad, min, max, etiqueta });
  const REGLAS = [
    { id: "A1", grupo: "cortes_testeos", orden: 10, funcion: "cortes-testeos", origen: "sistema", activa: true, modo: "auto",
      nombre: "Corte por gasto sin señales", descripcion: "Apaga el anuncio que ya gastó y no trajo ni ventas ni pagos iniciados.",
      condiciones: [{ metrica: "gasto", op: ">=", var: "gasto_min" }, { metrica: "ventas_reales", op: "=", valor: 0 }, { metrica: "pagos_iniciados", op: "=", valor: 0 },
        { metrica: "texto", texto: "si el producto sale menos de 19,99 usa el gasto mínimo barato" }],
      accion: { tipo: "apagar", nivel: "anuncio", texto: "Apagar anuncio" },
      alcance: { nivel: "anuncio", campanas: "testeos", texto: "anuncios de testeos activos" }, horario: "cada 15 min de 06 a 00 AR",
      variables: { gasto_min: V(6, "numero", "USD", 1, 100, "Gasto mínimo (precio ≥ 19,99)"), gasto_min_barato: V(4, "numero", "USD", 1, 100, "Gasto mínimo (precio < 19,99)") },
      notas: "Con buen costo por pago iniciado aguanta hasta ¾ del precio (lo maneja la función, no se edita acá)." },
    { id: "T15", grupo: "cortes_testeos", orden: 20, funcion: "cortes-testeos", origen: "sistema", activa: true, modo: "auto",
      nombre: "Testeo nuevo sin ventas muere entero", descripcion: "Si un testeo nuevo se gastó el tope sin una sola venta, se apaga la campaña completa.",
      condiciones: [{ metrica: "gasto", op: ">=", var: "tope" }, { metrica: "ventas_reales", op: "=", valor: 0 }, { metrica: "dias_desde_inicio", op: "<=", var: "dias" }],
      accion: { tipo: "apagar", nivel: "campana", texto: "Apagar campaña" },
      alcance: { nivel: "campana", campanas: "testeos", texto: "campañas de testeo" }, horario: "cada 15 min de 06 a 00 AR",
      variables: { tope: V(15, "numero", "USD", 5, 200, "Tope sin ventas"), dias: V(2, "entero", "días", 1, 7, "Días que cuenta como nuevo") } },
    { id: "K4", grupo: "cortes_caps", orden: 30, funcion: "cortes-caps", origen: "sistema", activa: true, modo: "auto",
      nombre: "CostCap/BidCap sin ventas con ¾ del precio", descripcion: "Apaga el conjunto de CostCap o BidCap que gastó tres cuartos del precio sin vender (aunque tenga pagos iniciados).",
      condiciones: [{ metrica: "tipo_campana", op: "es", valor: ["CostCap", "BidCap"] }, { metrica: "texto", texto: "gasto ≥ el % del precio del producto" }, { metrica: "ventas_reales", op: "=", valor: 0 }],
      accion: { tipo: "apagar", nivel: "conjunto", texto: "Apagar conjunto" },
      alcance: { nivel: "conjunto", campanas: "costcap_bidcap", texto: "conjuntos de CostCap/BidCap (cualquier fecha)" }, horario: "cada 15 min de 06 a 00 AR",
      variables: { fraccion_precio: V(75, "pct", "%", 25, 300, "Parte del precio gastada") } },
    { id: "RV-1", grupo: "revivir", orden: 40, funcion: "cortes-testeos", origen: "sistema", activa: true, modo: "auto",
      nombre: "Revivir lo que vende", descripcion: "Vuelve a prender anuncios apagados (incluso a mano) que venden con buen ROAS.",
      condiciones: [{ metrica: "ventas_reales", op: ">=", valor: 1 }, { metrica: "roas_real", op: ">=", var: "roas_revivir" }],
      accion: { tipo: "prender", nivel: "anuncio", texto: "Prender anuncio" },
      alcance: { nivel: "anuncio", campanas: "todas", texto: "anuncios y campañas apagados de testeos y caps" }, horario: "cada 15 min",
      variables: { roas_revivir: V(1.5, "numero", "", 1, 5, "ROAS para revivir") } },
    { id: "SURF-SUBE", grupo: "surfeo", orden: 50, funcion: "surfeo3", origen: "sistema", activa: true, modo: "auto",
      nombre: "Surfeo: sube fuerte", descripcion: "Con ROAS real muy bueno en el día, duplica el presupuesto.",
      condiciones: [{ metrica: "roas_real", op: ">", var: "roas_sube" }],
      accion: { tipo: "subir_presupuesto", nivel: "conjunto", var: "pct_sube", texto: "Subir presupuesto" },
      alcance: { nivel: "conjunto", campanas: "cbo_surfeo", texto: "CBO y conjuntos de CostCap/BidCap" }, horario: "cada hora; sin lecturas 23:40/23:50/23:55/00:05",
      variables: { roas_sube: V(2.5, "numero", "", 1, 10, "ROAS para subir"), pct_sube: V(100, "pct", "%", 1, 300, "Cuánto sube"),
        franja_desde: V("23:20", "hora", "", null, null, "Franja protegida desde"), franja_hasta: V("00:10", "hora", "", null, null, "Franja protegida hasta") } },
    { id: "MAD-1", grupo: "madres", orden: 60, funcion: "surfeo-madres", origen: "sistema", activa: true, modo: "avisar",
      nombre: "Madre del día floja", descripcion: "Si la madre del día viene mal, apaga los anuncios que gastaron ¾ del ticket sin vender.",
      condiciones: [{ metrica: "roas_real", op: "<", var: "roas_madre" }, { metrica: "texto", texto: "anuncio con ¾ del ticket gastado y sin ventas" }],
      accion: { tipo: "apagar", nivel: "anuncio", texto: "Apagar anuncio" },
      alcance: { nivel: "anuncio", campanas: "madres", texto: "anuncios de la CBO madre del día" }, horario: "cada 2 h desde el día 2",
      variables: { roas_madre: V(1.3, "numero", "", 0.5, 5, "ROAS mínimo de la madre") } },
    { id: "ESC-BID", grupo: "escalado", orden: 70, funcion: "app-movil", origen: "sistema", activa: true, modo: "avisar",
      nombre: "Armar BidCap desde testeo", descripcion: "Testeo con ROAS alto varios días sin escalar: propone la escalera de BidCap.",
      condiciones: [{ metrica: "roas_real", op: ">", var: "roas_min" }, { metrica: "ventas_reales", op: ">", var: "ventas_min" }, { metrica: "dias_desde_inicio", op: ">=", var: "dias" }],
      accion: { tipo: "crear", nivel: "campana", texto: "Armar BidCap (bid = CPA × 2, escalera de 1 USD)" },
      alcance: { nivel: "campana", campanas: "testeos", ventana: "4d", texto: "testeos, últimos 4 días" }, horario: "todos los días 10:00 AR",
      variables: { roas_min: V(2, "numero", "", 1, 10, "ROAS mínimo"), ventas_min: V(4, "entero", "", 1, 100, "Ventas mínimas"), dias: V(4, "entero", "días", 1, 14, "Días seguidos"),
        presupuesto_conjunto: V(50.55, "numero", "USD", 10, 500, "Presupuesto por conjunto") } },
    { id: "L-aviso-cpa-glp1", grupo: "mis_reglas", orden: 100, funcion: "motor", origen: "lorenzo", activa: true, modo: "avisar",
      nombre: "Aviso CPA alto en GLP-1", descripcion: "Que me avise si un conjunto de GLP-1 se va de CPA.",
      condiciones: [{ metrica: "cpa", op: ">", var: "c1" }, { metrica: "gasto", op: ">=", var: "c2" }],
      accion: { tipo: "avisar", nivel: "conjunto", canal: "discord", texto: "Avisar por Discord" },
      alcance: { nivel: "conjunto", campanas: "todas", nombre_contiene: "GLP", ventana: "hoy" }, horario: "lo evalúa el motor de reglas",
      variables: { c1: V(18, "numero", "USD", 0, 100000, "CPA"), c2: V(20, "numero", "USD", 0, 100000, "Gasto") } },
  ];
  REGLAS.forEach((r) => { r.actualizado = haceDias(3); r.actualizado_por = "sistema"; });
  let histN = 1;
  const HIST = [
    { id: histN++, regla_id: "A1", antes: { variables: { gasto_min: { ...REGLAS[0].variables.gasto_min, valor: 5 } } }, despues: { variables: { gasto_min: { ...REGLAS[0].variables.gasto_min } } }, cambiado_por: "claude", fecha: haceDias(1, 9) },
    { id: histN++, regla_id: "K4", antes: { modo: "avisar" }, despues: { modo: "auto" }, cambiado_por: "lorenzo", fecha: haceDias(2, 18) },
    { id: histN++, regla_id: "SURF-SUBE", antes: { variables: { pct_sube: { ...REGLAS[4].variables.pct_sube, valor: 30 } } }, despues: { variables: { pct_sube: { ...REGLAS[4].variables.pct_sube } } }, cambiado_por: "lorenzo", fecha: haceDias(2, 11) },
    { id: histN++, regla_id: "A1", antes: { activa: false }, despues: { activa: true }, cambiado_por: "franco", fecha: haceDias(4, 8) },
  ];
  const errR = (msg, campo) => { throw Object.assign(new Error(msg), { code: 400, data: { error: msg, campo } }); };
  const subset = (r) => ({ nombre: r.nombre, descripcion: r.descripcion, condiciones: r.condiciones, accion: r.accion, alcance: r.alcance, variables: r.variables, activa: r.activa, modo: r.modo });
  const ACC_D = { apagar: "Apagar", prender: "Prender", subir_presupuesto: "Subir presupuesto", bajar_presupuesto: "Bajar presupuesto", avisar: "Avisar", crear: "Crear" };
  const NIV_D = { anuncio: "anuncio", conjunto: "conjunto", campana: "campaña" };

  function evaluarRegla(r) {
    const al = r.alcance || {}, nivel = al.nivel || r.accion?.nivel || "anuncio";
    const per = (al.ventana && al.ventana !== "hoy") ? "7d" : "hoy";
    const vars = r.variables || {};
    const prender = r.accion?.tipo === "prender";
    const items = [];
    for (const c of ESTR) {
      const tipo = c.estrategia === "COST_CAP" ? "CostCap" : c.estrategia ? "BidCap" : c.presupuesto ? "CBO" : "ABO";
      const camp = al.campanas || "todas";
      if (camp === "testeos" && !/Testeo|CBO/.test(c.nombre)) continue;
      if (camp === "costcap_bidcap" && !c.estrategia) continue;
      if (camp === "madres" && !/MADRE/.test(c.nombre)) continue;
      if (al.tipo_campana?.length && !al.tipo_campana.includes(tipo)) continue;
      if (al.nombre_contiene && !c.nombre.toLowerCase().includes(String(al.nombre_contiene).toLowerCase()) && !c.oferta.toLowerCase().includes(String(al.nombre_contiene).toLowerCase())) continue;
      const { conjuntos, tot } = arbol(c, per);
      const base = { campana: c.nombre, cuenta: c.cuenta, tipo };
      if (nivel === "campana") items.push({ nivel, id: c.id, nombre: c.nombre, m: tot, presupuesto: c.presupuesto, estado: ESTADOS.get(c.id), ...base });
      else for (const s of conjuntos) {
        if (nivel === "conjunto") items.push({ nivel, id: s.id, nombre: s.nombre, m: s, presupuesto: s.presupuesto, estado: s.estado, ...base });
        else for (const a of s.anuncios) items.push({ nivel, id: a.id, nombre: a.nombre, m: a, estado: a.estado, ...base });
      }
    }
    const val = (it, k) => ({ gasto: it.m.gasto, ventas: it.m.ventas, ventas_reales: it.m.ventas, ventas_pixel: Math.round(it.m.ventas * 1.1), roas: it.m.roas, roas_real: it.m.roas,
      roas_pixel: it.m.roas == null ? null : r2(it.m.roas * 1.08), cpa: it.m.cpa, pagos_iniciados: it.m.pagos_iniciados, costo_pago_iniciado: it.m.costo_pago_iniciado,
      presupuesto: it.presupuesto, tipo_campana: it.tipo, nombre: it.nombre, dias_desde_inicio: 1 + (hash(it.id) % 9), hora: new Date().getHours() })[k];
    const cumple = (op, a, b) => {
      if (op === "es") return Array.isArray(b) ? b.includes(a) : String(a).toLowerCase() === String(b).toLowerCase();
      if (op === "contiene") return String(a).toLowerCase().includes(String(b).toLowerCase());
      if (op === "no_contiene") return !String(a).toLowerCase().includes(String(b).toLowerCase());
      if (a == null || b == null || typeof b !== "number") return false;
      return { ">": a > b, ">=": a >= b, "<": a < b, "<=": a <= b, "=": a === b, "!=": a !== b }[op] ?? false;
    };
    const conds = (r.condiciones || []).filter((c) => c.metrica && c.metrica !== "texto");
    const candidatos = items.filter((it) => prender ? it.estado !== "ACTIVE" : it.estado === "ACTIVE");
    const usados = [...new Set(["gasto", "ventas_reales", "roas_real", "cpa", "pagos_iniciados", ...conds.map((c) => c.metrica)])].filter((k) => k !== "tipo_campana" && k !== "nombre");
    const a = r.accion || {};
    const accTx = a.texto ? a.texto + (a.var ? ` ${vars[a.var]?.valor}${vars[a.var]?.tipo === "pct" ? " %" : ""}` : "") : `${ACC_D[a.tipo] || a.tipo} ${NIV_D[a.nivel] || ""}`;
    const afectaria = candidatos.filter((it) => conds.every((c) => cumple(c.op, val(it, c.metrica), c.var ? vars[c.var]?.valor : c.valor)))
      .map((it) => ({ nivel: it.nivel, id: it.id, nombre: it.nombre, campana: it.campana, cuenta: it.cuenta, metricas: Object.fromEntries(usados.map((k) => [k, val(it, k)])), accion: accTx }));
    const textos = (r.condiciones || []).filter((c) => c.metrica === "texto" || (!c.metrica && c.texto)).length;
    return { afectaria: afectaria.slice(0, 40), evaluados: candidatos.length, nota: `Demo: datos falsos de ${per === "hoy" ? "hoy" : "los últimos días"}${textos ? `; ${textos} condición(es) en texto no se evalúan acá` : ""}. No toca Meta.` };
  }

  function reglasDemo(accion, p, body) {
    if (accion === "reglas_list") return { reglas: JSON.parse(JSON.stringify(REGLAS)),
      grupos: [["cortes_testeos", "Cortes de testeos"], ["cortes_caps", "Cortes de CostCap/BidCap"], ["revivir", "Revivir"], ["surfeo", "Surfeo"], ["madres", "Madres"], ["escalado", "Escalado"], ["mis_reglas", "Mis reglas"]].map(([id, nombre]) => ({ id, nombre })),
      metricas: ["gasto", "ventas_reales", "ventas_pixel", "roas_real", "roas_pixel", "cpa", "pagos_iniciados", "costo_pago_iniciado", "dias_desde_inicio", "presupuesto", "tipo_campana", "nombre", "hora"].map((id) => ({ id })),
      operadores: [">", ">=", "<", "<=", "=", "!=", "es", "contiene", "no_contiene"], acciones: ["apagar", "prender", "subir_presupuesto", "bajar_presupuesto", "avisar"] };
    if (accion === "reglas_historial") { const id = p.get("id"); return { historial: JSON.parse(JSON.stringify(HIST.filter((h) => !id || h.regla_id === id).slice(0, 100))) }; }
    if (accion === "reglas_probar") return evaluarRegla(body?.regla || {});
    if (accion === "reglas_borrar") {
      const i = REGLAS.findIndex((r) => r.id === body?.id);
      if (i < 0) errR("No existe esa regla", "id");
      if (REGLAS[i].origen !== "lorenzo") errR("Las reglas del sistema no se borran: apagala", "id");
      HIST.unshift({ id: histN++, regla_id: body.id, antes: subset(REGLAS[i]), despues: null, cambiado_por: "lorenzo", fecha: ahoraISO() });
      REGLAS.splice(i, 1); return { ok: true };
    }
    if (accion === "reglas_guardar") {
      const b = body?.regla || {};
      let o = REGLAS.find((r) => r.id === b.id);
      const nueva = !o;
      if (nueva) {
        if (!String(b.nombre || "").trim()) errR("Falta el nombre", "nombre");
        if (!b.condiciones?.length) errR("Tiene que tener al menos una condición", "condiciones");
        const slug = String(b.nombre).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
        o = { id: b.id || `L-${slug}`, grupo: "mis_reglas", funcion: "motor", origen: "lorenzo", orden: 100 + REGLAS.length, activa: true, modo: "avisar", variables: {} };
        if (REGLAS.some((r) => r.id === o.id)) o.id += "-" + (Date.now() % 1000);
      }
      for (const [k, v] of Object.entries(b.variables || {})) {
        const def = o.variables?.[k] || v; const x = v?.valor;
        if (["numero", "entero", "pct"].includes(def.tipo)) {
          if (typeof x !== "number" || !isFinite(x)) errR(`${def.etiqueta || k}: tiene que ser un número`, `variables.${k}`);
          if (def.tipo === "entero" && !Number.isInteger(x)) errR(`${def.etiqueta || k}: tiene que ser entero`, `variables.${k}`);
          if (def.min != null && x < def.min) errR(`${def.etiqueta || k}: el mínimo es ${def.min}`, `variables.${k}`);
          if (def.max != null && x > def.max) errR(`${def.etiqueta || k}: el máximo es ${def.max}`, `variables.${k}`);
        }
      }
      const modo = b.modo || o.modo;
      if (modo === "auto" && (nueva || o.modo !== "auto") && !body.confirmar) errR("Para pasar a Auto hace falta confirmar", "modo");
      const antes = nueva ? null : subset(JSON.parse(JSON.stringify(o)));
      if (o.origen === "lorenzo") { const { id, origen, grupo, funcion, ...resto } = b; Object.assign(o, JSON.parse(JSON.stringify(resto))); }
      else {
        for (const [k, v] of Object.entries(b.variables || {})) if (o.variables[k]) o.variables[k].valor = v.valor;
        if ("activa" in b) o.activa = b.activa;
        if (b.modo) o.modo = b.modo;
      }
      o.actualizado = ahoraISO(); o.actualizado_por = body.por || "lorenzo";
      if (nueva) REGLAS.push(o);
      const despues = subset(JSON.parse(JSON.stringify(o)));
      HIST.unshift({ id: histN++, regla_id: o.id, antes, despues, cambiado_por: body.por || "lorenzo", fecha: o.actualizado });
      return { ok: true, regla: JSON.parse(JSON.stringify(o)), antes, despues };
    }
    return undefined;
  }

  const LOG = [];
  async function handle(accion, q, body) {
    const p = new URLSearchParams(q.replace(/^&/, ""));
    const dry = p.get("dry") === "1";
    await wait(accion === "dash" ? 380 : accion === "dash_detalle" ? 520 : 650);
    const per = p.get("periodo") || "hoy";
    if (accion === "dash") return JSON.parse(JSON.stringify(dash(per)));
    if (accion === "dash_detalle") return JSON.parse(JSON.stringify(detalle(p.get("id"), per)));
    if (accion === "estado") {
      const resultados = (body.items || []).map((it) => {
        if (!ESTADOS.has(it.id)) return { id: it.id, ok: false, error: "no existe", estado: null };
        if (!dry) ESTADOS.set(it.id, body.estado);
        return { id: it.id, ok: true, error: null, estado: body.estado, ...(dry ? { simulado: true } : {}) };
      });
      LOG.unshift({ creado: new Date().toISOString(), accion: "estado", dry, resumen: `${body.estado === "ACTIVE" ? "Prender" : "Apagar"} ${resultados.length}: ${(body.items || []).map((i) => i.nombre).join(", ")}` });
      return { dry, resultados };
    }
    if (accion === "cap_plan") return capPlan(body);
    if (accion === "cap_crear") {
      const plan = capPlan(body);
      LOG.unshift({ creado: new Date().toISOString(), accion: "cap_crear", dry, resumen: `${plan.nombre_campana} · ${plan.conjuntos} conjuntos` });
      const ais = body.tipo === "aislada";
      if (dry) return { ...plan, dry: true, pasos: [ais ? `Crear campaña CBO «${plan.nombre_campana}» (OUTCOME_SALES), US$ ${String(plan.presupuesto_campana).replace(".", ",")}/día, activa` : `Crear campaña ABO «${plan.nombre_campana}» (OUTCOME_SALES), activa`, ...plan.nombres_conjuntos.map((n, i) => ais ? `Conjunto «${n}» · inicio ${plan.inicio.ar}` : `Conjunto «${n}» · bid US$ ${plan.bids[i]} · US$ ${String(plan.presupuesto_conjunto).replace(".", ",")} · inicio ${plan.inicio.ar}`), `Copiar ${plan.origen.posts.length} anuncio(s) por Post ID en cada conjunto (multianunciante OPT_OUT)`, "Dejar pendiente el ciclo de vida para el proceso local"] };
      const cid = "120299" + Date.now().toString().slice(-9);
      const cn = plan.nombres_conjuntos;
      return { ok: true, dry: false, campaign_id: cid, adsets: cn.map((b, i) => cid.slice(0, -2) + "5" + i), ads: cn.flatMap((b, i) => plan.origen.posts.map((x, j) => cid.slice(0, -3) + "8" + i + j)),
        log: [`campaña ${cid} creada${ais ? ` (CBO US$ ${plan.presupuesto_campana}/día)` : ""}`, ...cn.map((n) => `conjunto «${n}» creado`), `${cn.length * plan.origen.posts.length} anuncios por Post ID`, "start_time " + plan.inicio.iso], falta_ciclo_de_vida: true,
        link_ads_manager: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${body.act.replace("act_", "")}&selected_campaign_ids=${cid}` };
    }
    if (accion.startsWith("reglas_")) { const r = reglasDemo(accion, p, body); if (r !== undefined) return r; }
    if (accion === "dash_log") return { log: LOG.slice(0, 50) };
    throw new Error("Acción desconocida en demo: " + accion);
  }

  // ---------- avisos de ejemplo (mismo contrato que mandan las funciones del servidor) ----------
  const CC = (gi, ci) => ESTR.filter((c) => c.grupo === G[gi][0])[ci];
  const sinAct = (c) => c.act.replace(/^act_/, "");
  const mAd = (c, a) => { const m = metricasAd(c, a, "hoy"); return { roas: m.roas, ventas: m.ventas, gasto: m.gasto }; };
  const mS = (c, s) => { const m = suma(s.anuncios.map((a) => metricasAd(c, a, "hoy"))); return { roas: m.roas, ventas: m.ventas, gasto: m.gasto }; };
  const mC = (c) => { const m = suma(c.conjuntos.flatMap((s) => s.anuncios.map((a) => metricasAd(c, a, "hoy")))); return { roas: m.roas, ventas: m.ventas, gasto: m.gasto }; };
  const itC = (c, x = {}) => ({ n: "campana", id: c.id, c: c.id, a: sinAct(c), nom: c.nombre, ...mC(c), ...x });
  const itS = (c, s, x = {}) => ({ n: "conjunto", id: s.id, c: c.id, a: sinAct(c), nom: s.nombre, cn: c.nombre, ...mS(c, s), ...x });
  const itA = (c, s, a, x = {}, conS = true) => ({ n: "anuncio", id: a.id, c: c.id, ...(conS ? { s: s.id } : {}), a: sinAct(c), nom: a.nombre, cn: c.nombre, ...mAd(c, a), ...x });
  function ejemplo(t) {
    const ev = (tt, r, items) => ({ t: tt, r, items, v: 1 });
    if (t === "apagar") {
      const c = CC(2, 2), s = c.conjuntos[1]; ESTADOS.set(s.id, "PAUSED");
      return ev("apagar", "Gastó más de ¾ del ticket sin ventas reales en la ventana de la regla y el conjunto viene con ROAS < 1,3.", [itS(c, s, { r: "¾ ticket sin ventas (US$ 18,74)" })]);
    }
    if (t === "varios") {
      const a1 = CC(2, 1), a2 = CC(4, 0), a3 = CC(0, 2);
      const xs = [[a1, a1.conjuntos[0], a1.conjuntos[0].anuncios[0], true], [a2, a2.conjuntos[0], a2.conjuntos[0].anuncios[1], false], [a3, a3.conjuntos[0], a3.conjuntos[0].anuncios[0], true]];
      xs.forEach(([, , a]) => ESTADOS.set(a.id, "PAUSED"));
      return ev("apagar", "Corte de las 14:00: anuncios con 6 USD gastados y ningún pago iniciado.", xs.map(([c, s, a, conS], i) => itA(c, s, a, { r: "6 USD sin pagos iniciados", roas: 0, ventas: 0, gasto: [6.12, 6.4, 6.05][i] }, conS)));
    }
    if (t === "campana_apagada") {
      const c = CC(4, 1); ESTADOS.set(c.id, "PAUSED");
      return ev("apagar", "D3: viene con ROAS < 1,3 ayer y hoy, y no tiene anuncios para rescatar.", [itC(c)]);
    }
    if (t === "surf_sube") {
      const c = CC(0, 0); const antes = c.presupuesto; c.presupuesto = r2(antes * 2);
      return ev("surf_sube", "ROAS real por encima de 2,5 en la última lectura: duplico el presupuesto.", [itC(c, { antes, despues: c.presupuesto, roas: 3.12 })]);
    }
    if (t === "surf_baja") {
      const c = CC(0, 1), s = c.conjuntos[1]; const antes = s.presupuesto; s.presupuesto = r2(antes * 0.7);
      return ev("surf_baja", "ROAS real ≤ 1,5 en la lectura de las 16:00: bajo el presupuesto 30 %.", [itS(c, s, { antes, despues: s.presupuesto, roas: 1.31 })]);
    }
    if (t === "base") {
      const c = CC(3, 1); const antes = c.presupuesto; c.presupuesto = r2(antes * 1.3);
      return ev("base", "Cierre del día de la madre: ROAS ≥ 1,5 con más del 30 % de la base gastado. Mañana arranca con +30 %.", [itC(c, { antes, despues: c.presupuesto })]);
    }
    if (t === "reset") {
      const c = CC(4, 0);
      return ev("reset", "Reset de las 23:50: lo surfeado hoy vuelve a su presupuesto base para mañana.", [itC(c, { antes: 39.72, despues: c.presupuesto })]);
    }
    if (t === "revivir") {
      const c = CC(0, 0); let s = c.conjuntos[0], a = s.anuncios[0];
      for (const ss of c.conjuntos) for (const aa of ss.anuncios) if (ESTADOS.get(aa.id) === "PAUSED") { s = ss; a = aa; }
      ESTADOS.set(a.id, "ACTIVE");
      return ev("revivir", "Estaba apagado pero vendió hoy con ROAS ≥ 1,5: lo vuelvo a prender.", [itA(c, s, a)]);
    }
    if (t === "rescate") {
      const c = CC(1, 1), x1 = c.conjuntos[0].anuncios[1], x2 = c.conjuntos[1].anuncios[0];
      ESTADOS.set(x1.id, "PAUSED"); ESTADOS.set(x2.id, "PAUSED");
      return ev("rescate", "La campaña venía para cortarse, pero tiene anuncios con venta y ROAS ≥ 1,5: la salvo y apago solo los malos.", [itC(c, { r: "queda con sus anuncios buenos" }), itA(c, c.conjuntos[0], x1, { r: "sin ventas, ¾ ticket gastado", roas: 0, ventas: 0, gasto: 7.6 }), itA(c, c.conjuntos[1], x2, { r: "ROAS 0,6 con 1 venta", roas: 0.6, ventas: 1, gasto: 16.4 })]);
    }
    if (t === "venta") { const c = CC(5, 0), s = c.conjuntos[0], a = s.anuncios[0]; return ev("venta", "Primera venta real del testeo de Moldes Italia.", [itA(c, s, a, { ventas: 1 })]); }
    if (t === "validacion") { const c = CC(5, 0); return ev("validacion", "ROAS 2,4 con 6 ventas: pasa el criterio de validación (≥ 2 sin postventa).", [itC(c)]); }
    if (t === "winner") { const c = CC(0, 0), s = c.conjuntos[0], a = s.anuncios[0]; return ev("winner", "Más de 4 ventas y ROAS mayor a 2.", [itA(c, s, a, { roas: 3.4, ventas: 7 })]); }
    if (t === "escala") { const c = CC(0, 0), d = CC(3, 1); return ev("escala", "ROAS > 2 en los últimos 4 días y todavía no están en ninguna estructura de escala.", [itA(c, c.conjuntos[0], c.conjuntos[0].anuncios[0]), itA(c, c.conjuntos[1], c.conjuntos[1].anuncios[0]), itA(d, d.conjuntos[0], d.conjuntos[0].anuncios[0])]); }
    if (t === "categoria") { const c = CC(2, 0); return ev("categoria", "Con 4 días de datos, el testeo queda como rentable.", [itC(c, { r: "categoría: rentable" })]); }
    if (t === "alerta") return ev("alerta", "Meta frenó las consultas de TESTEOS (límite de llamadas). Los cortes de las 15:00 quedan en cola y se reintentan cada 5 minutos.", []);
    if (t === "cola") { const c = CC(0, 1), s = c.conjuntos[0]; return ev("cola", "Se aplicó a las 15:20, tarde: Meta estaba sin cupo a las 15:00.", [itS(c, s, { r: "apagado con 20 min de demora" })]); }
    if (t === "reporte") return ev("reporte", "Hoy hasta las 22:00: US$ 1.240 facturados, ROAS 1,92, 3 testeos rentables y 2 para cortar.", []);
    if (t === "prueba") return ev("prueba", "Si ves esto, los avisos llegan bien a este equipo.", []);
    return ev(t, "Evento de un tipo que la app no conoce: se muestra genérico.", []);
  }
  window.DemoAPI = { handle, ejemplo };
})();

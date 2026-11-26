/*
 * AgroEstructura - Diseñador «a mi medida»: plano visto desde arriba + vista 3D al lado.
 *
 * El cliente (o el dueño) arma su invernadero:
 *   - naves una al lado de la otra, cada una con su TIPO, ANCHO, LARGO y desde dónde EMPIEZA (escalonadas, en L…);
 *   - forma libre del TERRENO (marca las esquinas del lote en el plano);
 *   - elementos: puertas (frente/fondo), ventana cenital, cortinas, altura de postes, canales entre naves.
 * En el plano se arrastra: la nave (para correrla), sus bordes (largo y ancho) y las esquinas del terreno.
 * Todo también se puede hacer con los campos del panel (teclado y lectores de pantalla).
 *
 * Diseño (el mismo formato que guarda el servidor, ver backend/diseno.py):
 *   { distancia, anchoCanal, naves: [{ tipo, ancho, largo, inicio, alturaPostes, cenital, cortinas }],
 *     canales: [bool…] (líneas 0..N), puertas: [{ nave, lado, posicion, ancho }], terreno: [[x, z]…] }
 *
 * Uso:  const d = await AgroDisenador.abrir(disenoInicial, { anchoCanal });  // null si cancela
 *       AgroDisenador.svgPlano(d)  → texto SVG del plano (para la tarjeta del cotizador y el PDF)
 */
(function () {
  const TIPOS = {
    Guadua: { nombre: 'Capilla de guadua', corto: 'Guadua', color: '#c9a66b' },
    Cercha: { nombre: 'Capilla en cercha', corto: 'Cercha', color: '#e8b86a' },
    Tubular: { nombre: 'Metálica tubular', corto: 'Metálica', color: '#9fb3c8' },
    UnaAgua: { nombre: 'Una sola agua', corto: 'Una agua', color: '#9bc48f' },
    SaranCapilla: { nombre: 'Sarán / polisombra', corto: 'Sarán', color: '#6b7280' },
  };
  const CON_FORMULA = ['Tubular', 'Guadua']; // los demás: precio pendiente (fórmulas por definir)
  const SIN_CENITAL = ['UnaAgua', 'SaranCapilla'];
  const PASO = 0.5; // los arrastres se ajustan cada 0,5 m
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fN = (n) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n);
  const entre = (v, a, b) => Math.min(Math.max(v, a), b);
  const ajustar = (v) => Math.round(v / PASO) * PASO;
  const copia = (o) => JSON.parse(JSON.stringify(o));

  /* ---------------------------------------------------------------- modelo */
  function naveBase(tipo, ancho, largo) { return { tipo, ancho, largo, inicio: 0, alturaPostes: null, cenital: tipo === 'Tubular', cortinas: true }; }

  /** Diseño a partir del formulario simple (naves iguales). */
  function desdeSimple(p) {
    const tipo = TIPOS[p.tipo] ? p.tipo : 'Guadua';
    const N = entre(Math.round(Number(p.naves) || 1), 1, 20);
    const ancho = entre(Number(p.ancho) || 9, 2, 100), largo = entre(Number(p.largo) || 40, 2, 500);
    const conCanal = p.anchoCanal && p.anchoCanal !== '0';
    return {
      distancia: entre(Number(p.distancia) || 2.5, 0.5, 10), anchoCanal: conCanal ? p.anchoCanal : '0.90',
      naves: Array.from({ length: N }, () => naveBase(tipo, ancho, largo)),
      canales: Array.from({ length: N + 1 }, () => !!conCanal), puertas: [], terreno: [],
    };
  }
  /** Ajusta tamaños de listas y rangos (después de agregar o quitar naves). */
  function sanear(d) {
    d.naves = d.naves.slice(0, 20);
    d.naves.forEach((n) => {
      n.ancho = entre(Number(n.ancho) || 9, 2, 100); n.largo = entre(Number(n.largo) || 30, 2, 500);
      n.inicio = entre(Number(n.inicio) || 0, -500, 500);
      if (SIN_CENITAL.includes(n.tipo)) n.cenital = false;
      if (n.tipo === 'SaranCapilla') n.cortinas = false;
    });
    const L = d.naves.length + 1;
    d.canales = Array.from({ length: L }, (_, i) => !!(d.canales && d.canales[i]));
    d.puertas = (d.puertas || []).filter((p) => d.naves[p.nave]).map((p) => {
      const n = d.naves[p.nave]; p.ancho = entre(Number(p.ancho) || 3, 0.8, Math.min(10, n.ancho)); p.posicion = entre(Number(p.posicion) || 0, 0, n.ancho - p.ancho); return p;
    });
    return d;
  }
  /** Posición x de cada nave (una al lado de la otra). */
  const xs = (d) => { let x = 0; return d.naves.map((n) => { const x0 = x; x += n.ancho; return x0; }); };

  /** Si el diseño equivale a «naves iguales» con fórmula, devuelve los parámetros simples (se cotiza solo). */
  function comoSimple(d) {
    const a = d.naves[0];
    const iguales = d.naves.every((x) => x.tipo === a.tipo && x.ancho === a.ancho && x.largo === a.largo && x.inicio === a.inicio && !x.alturaPostes && x.cortinas);
    const extras = d.puertas.length || (a.tipo !== 'Tubular' && d.naves.some((x) => x.cenital));
    const canalesOk = d.canales.every(Boolean) || !d.canales.some(Boolean);
    if (!iguales || extras || !canalesOk || !CON_FORMULA.includes(a.tipo)) return null;
    return { tipo: a.tipo, largo: a.largo, ancho: a.ancho, naves: d.naves.length, distancia: d.distancia, anchoCanal: d.canales.every(Boolean) ? d.anchoCanal : '0' };
  }
  function resumen(d) {
    const area = d.naves.reduce((s, n) => s + n.ancho * n.largo, 0);
    const z0 = Math.min(...d.naves.map((n) => n.inicio)), z1 = Math.max(...d.naves.map((n) => n.inicio + n.largo));
    return { naves: d.naves.length, area, anchoTotal: d.naves.reduce((s, n) => s + n.ancho, 0), largoTotal: z1 - z0, tipos: [...new Set(d.naves.map((n) => TIPOS[n.tipo].nombre))] };
  }
  /** ¿Algún punto de la nave queda por fuera del terreno dibujado? */
  function dentro(pt, pol) {
    let c = false;
    for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
      const [xi, zi] = pol[i], [xj, zj] = pol[j];
      if ((zi > pt[1]) !== (zj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - zi)) / (zj - zi) + xi) c = !c;
    }
    return c;
  }
  function avisos(d) {
    const lista = [];
    if (d.terreno.length >= 3) {
      const x = xs(d);
      d.naves.forEach((n, i) => {
        const esquinas = [[x[i], n.inicio], [x[i] + n.ancho, n.inicio], [x[i], n.inicio + n.largo], [x[i] + n.ancho, n.inicio + n.largo]];
        if (esquinas.some((e) => !dentro(e, d.terreno))) lista.push(`La nave ${i + 1} se sale del terreno.`);
      });
    }
    return lista;
  }

  /* ---------------------------------------------------------------- plano (SVG) */
  function limites(d) {
    const x = xs(d); let minX = 0, maxX = x.length ? x[x.length - 1] + d.naves[d.naves.length - 1].ancho : 10;
    let minZ = Math.min(...d.naves.map((n) => n.inicio)), maxZ = Math.max(...d.naves.map((n) => n.inicio + n.largo));
    d.terreno.forEach(([a, b]) => { minX = Math.min(minX, a); maxX = Math.max(maxX, a); minZ = Math.min(minZ, b); maxZ = Math.max(maxZ, b); });
    const ext = Math.max(maxX - minX, maxZ - minZ, 10), pad = Math.max(3, ext * 0.1);
    return { minX: minX - pad, minZ: minZ - pad * 1.4, w: maxX - minX + pad * 2, h: maxZ - minZ + pad * 2.4, ext };
  }
  function paso(ext) { return ext <= 30 ? [1, 5] : ext <= 150 ? [5, 10] : ext <= 400 ? [10, 50] : [50, 100]; }

  /**
   * SVG del plano. op: { sel (nave seleccionada), editable, caja (viewBox fijo mientras se arrastra), dibujando }
   * Devuelve { svg (contenido interno), caja }.
   */
  function contenidoPlano(d, op) {
    const o = op || {};
    const caja = o.caja || limites(d);
    const fs = caja.ext / 38, [menor, mayor] = paso(caja.ext), x = xs(d);
    let s = `<rect x="${caja.minX}" y="${caja.minZ}" width="${caja.w}" height="${caja.h}" fill="#0f172a"/>`;
    // Cuadrícula en metros
    const desdeX = Math.ceil(caja.minX / menor) * menor, desdeZ = Math.ceil(caja.minZ / menor) * menor;
    for (let gx = desdeX; gx <= caja.minX + caja.w; gx += menor) {
      const m = Math.abs(gx % mayor) < 1e-6; s += `<line x1="${gx}" y1="${caja.minZ}" x2="${gx}" y2="${caja.minZ + caja.h}" stroke="${m ? '#334155' : '#1e293b'}" stroke-width="${caja.ext / (m ? 600 : 900)}"/>`;
      if (m) s += `<text x="${gx + fs * 0.2}" y="${caja.minZ + fs * 1.1}" font-size="${fs * 0.7}" fill="#64748b">${fN(gx)} m</text>`;
    }
    for (let gz = desdeZ; gz <= caja.minZ + caja.h; gz += menor) {
      const m = Math.abs(gz % mayor) < 1e-6; s += `<line x1="${caja.minX}" y1="${gz}" x2="${caja.minX + caja.w}" y2="${gz}" stroke="${m ? '#334155' : '#1e293b'}" stroke-width="${caja.ext / (m ? 600 : 900)}"/>`;
      if (m) s += `<text x="${caja.minX + fs * 0.2}" y="${gz - fs * 0.2}" font-size="${fs * 0.7}" fill="#64748b">${fN(gz)} m</text>`;
    }
    // Frente
    const zFrente = Math.min(...d.naves.map((n) => n.inicio));
    s += `<text x="${(x[0] + (x[x.length - 1] + d.naves[d.naves.length - 1].ancho)) / 2}" y="${zFrente - fs * 0.9}" font-size="${fs * 0.85}" fill="#4be277" text-anchor="middle" font-weight="700">▲ FRENTE</text>`;
    // Terreno
    if (d.terreno.length) {
      const pts = d.terreno.map(([a, b]) => `${a},${b}`).join(' ');
      s += d.terreno.length >= 3 && !o.dibujando
        ? `<polygon points="${pts}" fill="rgba(250,204,21,.07)" stroke="#facc15" stroke-width="${caja.ext / 300}" stroke-dasharray="${caja.ext / 80} ${caja.ext / 160}"/>`
        : `<polyline points="${pts}" fill="none" stroke="#facc15" stroke-width="${caja.ext / 300}"/>`;
      if (o.editable) d.terreno.forEach(([a, b], k) => { s += `<circle data-accion="vertice" data-k="${k}" cx="${a}" cy="${b}" r="${caja.ext / 90}" fill="#facc15" stroke="#0f172a" stroke-width="${caja.ext / 600}" style="cursor:move"><title>Esquina ${k + 1} del terreno</title></circle>`; });
    }
    // Naves
    d.naves.forEach((n, i) => {
      const t = TIPOS[n.tipo], sel = o.sel === i, cx = x[i] + n.ancho / 2;
      s += `<rect data-accion="nave" data-i="${i}" x="${x[i]}" y="${n.inicio}" width="${n.ancho}" height="${n.largo}" fill="${t.color}" fill-opacity="${sel ? 0.5 : 0.32}" stroke="${sel ? '#4be277' : t.color}" stroke-width="${caja.ext / (sel ? 200 : 400)}" ${o.editable ? 'style="cursor:grab"' : ''}><title>Nave ${i + 1}: ${esc(t.nombre)}, ${fN(n.ancho)} × ${fN(n.largo)} m</title></rect>`;
      const f = Math.min(fs, n.ancho / 4.2);
      s += `<text x="${cx}" y="${n.inicio + n.largo / 2 - f * 0.4}" font-size="${f * 1.15}" fill="#f8fafc" text-anchor="middle" font-weight="700" pointer-events="none">N${i + 1}</text>`;
      s += `<text x="${cx}" y="${n.inicio + n.largo / 2 + f * 0.75}" font-size="${f * 0.72}" fill="#e2e8f0" text-anchor="middle" pointer-events="none">${esc(t.corto)}</text>`;
      s += `<text x="${cx}" y="${n.inicio + n.largo / 2 + f * 1.7}" font-size="${f * 0.72}" fill="#e2e8f0" text-anchor="middle" pointer-events="none">${fN(n.ancho)} × ${fN(n.largo)} m</text>`;
      if (n.cenital) s += `<line x1="${cx}" y1="${n.inicio}" x2="${cx}" y2="${n.inicio + n.largo}" stroke="#adc6ff" stroke-width="${caja.ext / 350}" stroke-dasharray="${caja.ext / 120}" pointer-events="none"/>`;
    });
    // Canales
    const lineasX = x.concat(x[x.length - 1] + d.naves[d.naves.length - 1].ancho);
    d.canales.forEach((c, i) => {
      if (!c) return;
      const vec = [d.naves[i - 1], d.naves[i]].filter(Boolean);
      const z0 = Math.min(...vec.map((n) => n.inicio)), z1 = Math.max(...vec.map((n) => n.inicio + n.largo));
      s += `<line x1="${lineasX[i]}" y1="${z0}" x2="${lineasX[i]}" y2="${z1}" stroke="#22c55e" stroke-width="${Math.max(Number(d.anchoCanal) || 0.9, caja.ext / 150)}" stroke-opacity=".85" pointer-events="none"/>`;
    });
    // Puertas
    d.puertas.forEach((p) => {
      const n = d.naves[p.nave], px = x[p.nave] + p.posicion, z = p.lado === 'frente' ? n.inicio : n.inicio + n.largo, g = caja.ext / 90;
      s += `<rect x="${px}" y="${z - g / 2}" width="${p.ancho}" height="${g}" fill="#d97706" pointer-events="none"/>`;
    });
    // Asas de la nave seleccionada
    if (o.editable && o.sel != null && d.naves[o.sel]) {
      const n = d.naves[o.sel], x0 = x[o.sel], r = caja.ext / 55;
      const asa = (acc, cx, cy, titulo, cursor) => `<circle data-accion="${acc}" cx="${cx}" cy="${cy}" r="${r}" fill="#4be277" stroke="#0f172a" stroke-width="${caja.ext / 500}" style="cursor:${cursor}"><title>${titulo}</title></circle>`;
      s += asa('asa-frente', x0 + n.ancho / 2, n.inicio, 'Arrastra para mover el frente', 'ns-resize');
      s += asa('asa-fondo', x0 + n.ancho / 2, n.inicio + n.largo, 'Arrastra para cambiar el largo', 'ns-resize');
      s += asa('asa-ancho', x0 + n.ancho, n.inicio + n.largo / 2, 'Arrastra para cambiar el ancho', 'ew-resize');
    }
    return { svg: s, caja };
  }
  /** SVG completo del plano (solo para ver: tarjeta del cotizador y PDF). */
  function svgPlano(d, op) {
    const { svg, caja } = contenidoPlano(d, Object.assign({ editable: false }, op));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${caja.minX} ${caja.minZ} ${caja.w} ${caja.h}" font-family="Arial, sans-serif" role="img" aria-label="Plano del invernadero visto desde arriba">${svg}</svg>`;
  }

  /* ---------------------------------------------------------------- editor */
  let raiz = null, estado = null, vista = null, resolver = null;
  let paraDueno = false; // solo el dueño ve la marca «precio pendiente»

  const opcionesTipo = (sel) => Object.entries(TIPOS).map(([k, t]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(t.nombre)}${paraDueno && !CON_FORMULA.includes(k) ? ' (precio pendiente)' : ''}</option>`).join('');
  const campo = (id, etiqueta, attrs, ayuda) => `<div class="flex flex-col gap-1"><label for="${id}" class="font-label-sm text-label-sm text-on-surface-variant">${etiqueta}</label><input id="${id}" ${attrs} class="campo w-full bg-surface-container-lowest text-on-surface px-3 py-2.5 rounded-lg">${ayuda ? `<p class="ayuda">${ayuda}</p>` : ''}</div>`;
  const boton = (id, icono, texto, clase) => `<button type="button" id="${id}" class="${clase || 'dis-boton'}"><span class="material-symbols-outlined text-[18px]">${icono}</span><span>${texto}</span></button>`;

  function construir() {
    raiz = document.createElement('div');
    raiz.id = 'disenador';
    raiz.className = 'dis-capa hidden';
    raiz.setAttribute('role', 'dialog'); raiz.setAttribute('aria-modal', 'true'); raiz.setAttribute('aria-labelledby', 'disTitulo');
    raiz.innerHTML = `
      <header class="dis-cabecera">
        <div class="flex items-center gap-2 min-w-0"><span class="material-symbols-outlined text-primary">draw</span><h2 id="disTitulo" tabindex="-1" class="font-headline-sm text-headline-sm truncate">Diseña tu invernadero a tu medida</h2></div>
        <div class="flex flex-wrap gap-2 justify-end">
          ${boton('disDeshacer', 'undo', 'Deshacer')}${boton('disRehacer', 'redo', 'Rehacer')}
          ${boton('disCancelar', 'close', 'Cancelar')}
          ${boton('disUsar', 'check', 'Usar este diseño', 'dis-boton dis-principal')}
        </div>
      </header>
      <div class="dis-cuerpo">
        <section class="dis-tarjeta dis-plano-tarjeta" aria-labelledby="disPlanoTitulo">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 id="disPlanoTitulo" class="font-label-md text-label-md uppercase text-on-surface-variant">Plano (visto desde arriba)</h3>
            <div class="flex flex-wrap gap-2">
              ${boton('disAgregar', 'add', 'Agregar nave')}
              ${boton('disTerreno', 'polyline', 'Dibujar terreno')}
              ${boton('disBorrarTerreno', 'delete', 'Borrar terreno')}
            </div>
          </div>
          <p id="disAyudaPlano" class="ayuda">Toca una nave para elegirla. Arrástrala para correrla hacia adelante o atrás; usa los puntos verdes para cambiar el largo y el ancho.</p>
          <svg id="disPlano" class="dis-plano" role="application" aria-label="Plano editable del invernadero. También puedes cambiar todo con los campos del panel." font-family="Arial, sans-serif"></svg>
        </section>
        <div class="dis-lateral">
          <section class="dis-tarjeta">
            <h3 class="font-label-md text-label-md uppercase text-on-surface-variant">Vista 3D</h3>
            <div id="dis3d" class="dis-3d"><p class="ayuda p-3">La vista 3D no está disponible en este navegador.</p></div>
          </section>
          <section class="dis-tarjeta" aria-labelledby="disNaveTitulo">
            <div class="flex items-center justify-between gap-2">
              <h3 id="disNaveTitulo" class="font-label-md text-label-md uppercase text-on-surface-variant">Nave elegida</h3>
              <select id="disSel" aria-label="Nave elegida" class="campo bg-surface-container-lowest text-on-surface px-3 py-2 rounded-lg"></select>
            </div>
            <div class="flex flex-col gap-1"><label for="disTipo" class="font-label-sm text-label-sm text-on-surface-variant">TIPO DE ESTRUCTURA</label><select id="disTipo" class="campo w-full bg-surface-container-lowest text-on-surface px-3 py-2.5 rounded-lg"></select></div>
            <div class="grid grid-cols-2 gap-3">
              ${campo('disAncho', 'ANCHO (m)', 'type="number" min="2" max="100" step="0.5" inputmode="decimal"')}
              ${campo('disLargo', 'LARGO (m)', 'type="number" min="2" max="500" step="0.5" inputmode="decimal"')}
              ${campo('disInicio', 'EMPIEZA A (m del frente)', 'type="number" min="-500" max="500" step="0.5" inputmode="decimal"', 'Para naves escalonadas.')}
              ${campo('disAltura', 'ALTURA DE POSTES (m)', 'type="number" min="1.5" max="8" step="0.1" inputmode="decimal" placeholder="Normal"', 'Vacío = altura normal.')}
            </div>
            <label class="dis-check"><input type="checkbox" id="disCenital"> Ventana cenital (opcional, con recargo)</label>
            <label class="dis-check"><input type="checkbox" id="disCortinas"> Cortinas laterales</label>
            <div class="flex flex-wrap gap-2">
              ${boton('disIzq', 'arrow_back', 'Mover')}${boton('disDer', 'arrow_forward', 'Mover')}
              ${boton('disDuplicar', 'content_copy', 'Duplicar')}${boton('disEliminar', 'delete', 'Eliminar', 'dis-boton dis-peligro')}
            </div>
          </section>
          <section class="dis-tarjeta" aria-labelledby="disGenTitulo">
            <h3 id="disGenTitulo" class="font-label-md text-label-md uppercase text-on-surface-variant">Postes y canales</h3>
            <div class="grid grid-cols-2 gap-3">
              ${campo('disDist', 'DISTANCIA ENTRE POSTES (m)', 'type="number" min="0.5" max="10" step="0.5" inputmode="decimal"')}
              <div class="flex flex-col gap-1"><label for="disAnchoCanal" class="font-label-sm text-label-sm text-on-surface-variant">ANCHO DE CANAL</label><select id="disAnchoCanal" class="campo w-full bg-surface-container-lowest text-on-surface px-3 py-2.5 rounded-lg"><option value="0.90">0.90 m</option><option value="1.20">1.20 m</option><option value="1.50">1.50 m</option><option value="2.00">2.00 m</option></select></div>
            </div>
            <fieldset><legend class="font-label-sm text-label-sm text-on-surface-variant mb-1">CANALES (opcionales, con recargo)</legend><div id="disCanales" class="flex flex-col gap-1"></div></fieldset>
          </section>
          <section class="dis-tarjeta" aria-labelledby="disPuertasTitulo">
            <div class="flex items-center justify-between gap-2"><h3 id="disPuertasTitulo" class="font-label-md text-label-md uppercase text-on-surface-variant">Puertas</h3>${boton('disAgregarPuerta', 'door_front', 'Agregar puerta')}</div>
            <div id="disPuertas" class="flex flex-col gap-2"></div>
          </section>
          <section class="dis-tarjeta" aria-labelledby="disResTitulo">
            <h3 id="disResTitulo" class="font-label-md text-label-md uppercase text-on-surface-variant">Resumen</h3>
            <div id="disResumen" aria-live="polite"></div>
          </section>
        </div>
      </div>`;
    document.body.appendChild(raiz);
    raiz.querySelector('#disTipo').innerHTML = opcionesTipo('Guadua');
    eventos();
  }

  /* ---------- historial (deshacer / rehacer) ---------- */
  function guardarHistoria() {
    const t = JSON.stringify(estado.d);
    if (estado.hist[estado.pos] === t) return;
    estado.hist = estado.hist.slice(0, estado.pos + 1); estado.hist.push(t); estado.pos = estado.hist.length - 1;
    if (estado.hist.length > 80) { estado.hist.shift(); estado.pos--; }
    botonesHistoria();
  }
  function irHistoria(paso) {
    const p = estado.pos + paso; if (p < 0 || p >= estado.hist.length) return;
    estado.pos = p; estado.d = JSON.parse(estado.hist[p]); estado.sel = Math.min(estado.sel, estado.d.naves.length - 1);
    pintarTodo(); botonesHistoria();
  }
  function botonesHistoria() { $('disDeshacer').disabled = estado.pos <= 0; $('disRehacer').disabled = estado.pos >= estado.hist.length - 1; }
  const $ = (id) => raiz.querySelector('#' + id);

  /* ---------- pintar ---------- */
  function pintarPlano(caja) {
    const { svg, caja: c } = contenidoPlano(estado.d, { sel: estado.sel, editable: true, caja, dibujando: estado.dibujando });
    const el = $('disPlano'); el.setAttribute('viewBox', `${c.minX} ${c.minZ} ${c.w} ${c.h}`); el.innerHTML = svg;
    estado.caja = c;
  }
  function pintarPanel() {
    const d = estado.d, n = d.naves[estado.sel];
    $('disSel').innerHTML = d.naves.map((x, i) => `<option value="${i}" ${i === estado.sel ? 'selected' : ''}>Nave ${i + 1} · ${esc(TIPOS[x.tipo].corto)}</option>`).join('');
    $('disTipo').innerHTML = opcionesTipo(n.tipo);
    const val = (id, v) => { const e = $(id); if (document.activeElement !== e) e.value = v; };
    val('disAncho', n.ancho); val('disLargo', n.largo); val('disInicio', n.inicio); val('disAltura', n.alturaPostes || '');
    $('disCenital').checked = n.cenital; $('disCenital').disabled = SIN_CENITAL.includes(n.tipo);
    $('disCortinas').checked = n.cortinas; $('disCortinas').disabled = n.tipo === 'SaranCapilla';
    $('disIzq').disabled = estado.sel === 0; $('disDer').disabled = estado.sel === d.naves.length - 1;
    $('disEliminar').disabled = d.naves.length === 1;
    val('disDist', d.distancia); $('disAnchoCanal').value = d.anchoCanal;
    const N = d.naves.length;
    $('disCanales').innerHTML = d.canales.map((c, i) => {
      const nombre = i === 0 ? 'Costado izquierdo (nave 1)' : i === N ? `Costado derecho (nave ${N})` : `Entre la nave ${i} y la ${i + 1}`;
      return `<label class="dis-check"><input type="checkbox" data-canal="${i}" ${c ? 'checked' : ''}> ${nombre}</label>`;
    }).join('');
    $('disPuertas').innerHTML = d.puertas.length ? d.puertas.map((p, k) => `
      <div class="dis-puerta" role="group" aria-label="Puerta ${k + 1}">
        <select data-puerta="${k}" data-campo="nave" aria-label="Nave de la puerta ${k + 1}" class="campo bg-surface-container-lowest text-on-surface px-2 py-2 rounded-lg">${d.naves.map((_, i) => `<option value="${i}" ${i === p.nave ? 'selected' : ''}>Nave ${i + 1}</option>`).join('')}</select>
        <select data-puerta="${k}" data-campo="lado" aria-label="Lado de la puerta ${k + 1}" class="campo bg-surface-container-lowest text-on-surface px-2 py-2 rounded-lg"><option value="frente" ${p.lado === 'frente' ? 'selected' : ''}>Frente</option><option value="fondo" ${p.lado === 'fondo' ? 'selected' : ''}>Fondo</option></select>
        <input data-puerta="${k}" data-campo="posicion" type="number" step="0.5" min="0" value="${p.posicion}" aria-label="Distancia desde la izquierda de la nave, puerta ${k + 1} (m)" title="Distancia desde la izquierda de la nave (m)" class="campo bg-surface-container-lowest text-on-surface px-2 py-2 rounded-lg">
        <input data-puerta="${k}" data-campo="ancho" type="number" step="0.5" min="0.8" max="10" value="${p.ancho}" aria-label="Ancho de la puerta ${k + 1} (m)" title="Ancho de la puerta (m)" class="campo bg-surface-container-lowest text-on-surface px-2 py-2 rounded-lg">
        <button type="button" data-quitar-puerta="${k}" aria-label="Quitar la puerta ${k + 1}" class="btn-icono rounded-lg text-on-surface-variant hover:text-danger-alert"><span class="material-symbols-outlined text-[20px]">close</span></button>
      </div>`).join('') + '<p class="ayuda">Nave · Frente o fondo · Distancia desde la izquierda de la nave (m) · Ancho (m)</p>' : '<p class="ayuda">Sin puertas. Pulsa «Agregar puerta» para ubicar una en la nave elegida.</p>';
    const r = resumen(d), simple = comoSimple(d), av = avisos(d);
    $('disResumen').innerHTML = `
      <ul class="ayuda dis-lista">
        <li><b>${r.naves}</b> nave${r.naves > 1 ? 's' : ''} · <b>${fN(r.area)} m²</b> cubiertos</li>
        <li>Ancho total ${fN(r.anchoTotal)} m · largo total ${fN(r.largoTotal)} m</li>
        <li>${esc(r.tipos.join(' + '))}</li>
        ${d.terreno.length >= 3 ? `<li>Terreno marcado con ${d.terreno.length} esquinas</li>` : ''}
      </ul>
      ${av.map((a) => `<p class="dis-aviso" role="alert"><span class="material-symbols-outlined text-[18px]">warning</span>${esc(a)}</p>`).join('')}
      <p class="dis-estado ${simple ? 'dis-ok' : 'dis-pendiente'}"><span class="material-symbols-outlined text-[18px]">${simple ? 'calculate' : 'pending_actions'}</span>${simple
        ? 'Todas las naves son iguales: la lista de materiales se calcula automáticamente.'
        : (paraDueno ? 'Diseño a medida: precio pendiente (faltan las fórmulas de este tipo de diseño). El cliente lo puede enviar igual.' : 'Diseño a medida: revisamos tu diseño y te enviamos la cotización.')}</p>`;
  }
  function pintar3D() { if (vista) vista.actualizar({ diseno: Object.assign({}, estado.d, { anchoCanal: estado.d.anchoCanal }) }); }
  function pintarTodo(caja) { sanear(estado.d); pintarPlano(caja); pintarPanel(); pintar3D(); }
  function cambiar(fn) { fn(estado.d); pintarTodo(); guardarHistoria(); }

  /* ---------- arrastrar en el plano ---------- */
  function aMetros(ev) {
    const svg = $('disPlano'), pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
    const m = svg.getScreenCTM(); if (!m) return [0, 0];
    const r = pt.matrixTransform(m.inverse()); return [r.x, r.y];
  }
  function alPresionar(ev) {
    const objetivo = ev.target.closest('[data-accion]');
    const [mx, mz] = aMetros(ev);
    if (estado.dibujando) {
      const t = estado.d.terreno, cerca = t.length >= 3 && Math.hypot(t[0][0] - mx, t[0][1] - mz) < estado.caja.ext / 40;
      if (cerca) { terminarTerreno(); return; }
      t.push([ajustar(mx), ajustar(mz)]); pintarTodo(estado.caja); return;
    }
    if (!objetivo) return;
    ev.preventDefault();
    const acc = objetivo.dataset.accion;
    if (acc === 'nave') { estado.sel = Number(objetivo.dataset.i); }
    const n = estado.d.naves[estado.sel];
    estado.arrastre = { acc, k: Number(objetivo.dataset.k), x: mx, z: mz, inicio: n.inicio, largo: n.largo, ancho: n.ancho, caja: estado.caja, movio: false };
    $('disPlano').setPointerCapture(ev.pointerId);
    pintarTodo(estado.caja);
  }
  function alMover(ev) {
    const a = estado.arrastre; if (!a) return;
    const [mx, mz] = aMetros(ev), dz = mz - a.z, dx = mx - a.x, n = estado.d.naves[estado.sel];
    if (a.acc === 'nave') n.inicio = ajustar(a.inicio + dz);
    else if (a.acc === 'asa-fondo') n.largo = entre(ajustar(a.largo + dz), 2, 500);
    else if (a.acc === 'asa-frente') { const fin = a.inicio + a.largo; n.inicio = Math.min(ajustar(a.inicio + dz), fin - 2); n.largo = fin - n.inicio; }
    else if (a.acc === 'asa-ancho') n.ancho = entre(ajustar(a.ancho + dx), 2, 100);
    else if (a.acc === 'vertice') estado.d.terreno[a.k] = [ajustar(mx), ajustar(mz)];
    a.movio = a.movio || Math.abs(dz) > 0.2 || Math.abs(dx) > 0.2;
    pintarTodo(a.caja); // el plano no cambia de escala mientras se arrastra
  }
  function alSoltar() {
    if (!estado.arrastre) return;
    const movio = estado.arrastre.movio; estado.arrastre = null;
    pintarTodo(); if (movio) guardarHistoria();
  }
  function terminarTerreno() {
    estado.dibujando = false;
    if (estado.d.terreno.length < 3) estado.d.terreno = [];
    $('disTerreno').lastElementChild.textContent = 'Dibujar terreno';
    $('disAyudaPlano').textContent = 'Toca una nave para elegirla. Arrástrala para correrla hacia adelante o atrás; usa los puntos verdes para cambiar el largo y el ancho. Las esquinas amarillas del terreno también se pueden arrastrar.';
    pintarTodo(); guardarHistoria();
  }

  /* ---------- eventos del panel ---------- */
  function eventos() {
    const svg = $('disPlano');
    svg.addEventListener('pointerdown', alPresionar);
    svg.addEventListener('pointermove', alMover);
    svg.addEventListener('pointerup', alSoltar);
    svg.addEventListener('pointercancel', alSoltar);
    const num = (id, fn) => $(id).addEventListener('change', (e) => { const v = parseFloat(e.target.value); cambiar((d) => fn(d, v, e.target.value)); });
    $('disSel').addEventListener('change', (e) => { estado.sel = Number(e.target.value); pintarTodo(); });
    $('disTipo').addEventListener('change', (e) => cambiar((d) => { const n = d.naves[estado.sel]; n.tipo = e.target.value; if (n.tipo === 'Tubular') n.cenital = true; if (n.tipo !== 'SaranCapilla' && !n.cortinas) n.cortinas = true; }));
    num('disAncho', (d, v) => { if (v > 0) d.naves[estado.sel].ancho = v; });
    num('disLargo', (d, v) => { if (v > 0) d.naves[estado.sel].largo = v; });
    num('disInicio', (d, v) => { if (Number.isFinite(v)) d.naves[estado.sel].inicio = v; });
    num('disAltura', (d, v, t) => { d.naves[estado.sel].alturaPostes = t === '' || !(v > 0) ? null : entre(v, 1.5, 8); });
    num('disDist', (d, v) => { if (v > 0) d.distancia = entre(v, 0.5, 10); });
    $('disAnchoCanal').addEventListener('change', (e) => cambiar((d) => { d.anchoCanal = e.target.value; }));
    $('disCenital').addEventListener('change', (e) => cambiar((d) => { d.naves[estado.sel].cenital = e.target.checked; }));
    $('disCortinas').addEventListener('change', (e) => cambiar((d) => { d.naves[estado.sel].cortinas = e.target.checked; }));
    $('disCanales').addEventListener('change', (e) => { const i = e.target.dataset.canal; if (i != null) cambiar((d) => { d.canales[Number(i)] = e.target.checked; }); });
    $('disAgregar').addEventListener('click', () => cambiar((d) => { if (d.naves.length >= 20) return; const u = d.naves[d.naves.length - 1]; d.naves.push(Object.assign(copia(u))); d.canales.push(d.canales[d.canales.length - 1]); estado.sel = d.naves.length - 1; }));
    $('disDuplicar').addEventListener('click', () => cambiar((d) => { if (d.naves.length >= 20) return; d.naves.splice(estado.sel + 1, 0, copia(d.naves[estado.sel])); d.canales.splice(estado.sel + 1, 0, d.canales[estado.sel + 1]); d.puertas.forEach((p) => { if (p.nave > estado.sel) p.nave++; }); estado.sel++; }));
    $('disEliminar').addEventListener('click', () => cambiar((d) => {
      if (d.naves.length === 1) return;
      const i = estado.sel; d.naves.splice(i, 1); d.canales.splice(i + 1, 1);
      d.puertas = d.puertas.filter((p) => p.nave !== i).map((p) => Object.assign(p, { nave: p.nave > i ? p.nave - 1 : p.nave }));
      estado.sel = Math.min(i, d.naves.length - 1);
    }));
    const mover = (paso) => cambiar((d) => {
      const i = estado.sel, j = i + paso; if (j < 0 || j >= d.naves.length) return;
      [d.naves[i], d.naves[j]] = [d.naves[j], d.naves[i]];
      d.puertas.forEach((p) => { if (p.nave === i) p.nave = j; else if (p.nave === j) p.nave = i; });
      estado.sel = j;
    });
    $('disIzq').addEventListener('click', () => mover(-1));
    $('disDer').addEventListener('click', () => mover(1));
    $('disAgregarPuerta').addEventListener('click', () => cambiar((d) => { const n = d.naves[estado.sel]; d.puertas.push({ nave: estado.sel, lado: 'frente', posicion: Math.max(0, n.ancho / 2 - 1.5), ancho: Math.min(3, n.ancho) }); }));
    $('disPuertas').addEventListener('change', (e) => {
      const k = e.target.dataset.puerta; if (k == null) return;
      cambiar((d) => { const p = d.puertas[Number(k)]; const c = e.target.dataset.campo; p[c] = c === 'lado' ? e.target.value : Number(e.target.value); });
    });
    $('disPuertas').addEventListener('click', (e) => { const b = e.target.closest('[data-quitar-puerta]'); if (b) cambiar((d) => { d.puertas.splice(Number(b.dataset.quitarPuerta), 1); }); });
    $('disTerreno').addEventListener('click', () => {
      if (estado.dibujando) { terminarTerreno(); return; }
      estado.dibujando = true; estado.d.terreno = [];
      $('disTerreno').lastElementChild.textContent = 'Terminar terreno';
      $('disAyudaPlano').textContent = 'Toca en el plano cada esquina del lote, en orden. Para cerrar, toca la primera esquina o pulsa «Terminar terreno».';
      pintarTodo(estado.caja);
    });
    $('disBorrarTerreno').addEventListener('click', () => cambiar((d) => { d.terreno = []; estado.dibujando = false; $('disTerreno').lastElementChild.textContent = 'Dibujar terreno'; }));
    $('disDeshacer').addEventListener('click', () => irHistoria(-1));
    $('disRehacer').addEventListener('click', () => irHistoria(1));
    $('disCancelar').addEventListener('click', () => cerrar(null));
    $('disUsar').addEventListener('click', () => { if (estado.dibujando) terminarTerreno(); cerrar(copia(estado.d)); });
    raiz.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); if (estado.dibujando) terminarTerreno(); else cerrar(null); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !['INPUT', 'SELECT'].includes(document.activeElement.tagName)) { e.preventDefault(); irHistoria(e.shiftKey ? 1 : -1); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !['INPUT', 'SELECT'].includes(document.activeElement.tagName)) { e.preventDefault(); irHistoria(1); }
    });
  }

  function cerrar(resultado) {
    if (resultado === null && estado.hist.length > 1 && !confirm('¿Salir sin usar los cambios del diseño?')) return;
    raiz.classList.add('hidden'); document.documentElement.classList.remove('dis-abierto');
    const r = resolver; resolver = null; if (estado.volverFoco) estado.volverFoco.focus();
    r(resultado ? sanear(resultado) : null);
  }

  /** Abre el diseñador. Devuelve una promesa con el diseño (o null si se cancela). */
  function abrir(inicial, opciones) {
    if (!raiz) construir();
    const o = opciones || {};
    paraDueno = !!o.dueno;
    const d = sanear(copia(inicial && inicial.naves ? inicial : desdeSimple(o.simple || {})));
    if (o.anchoCanal && o.anchoCanal !== '0') d.anchoCanal = o.anchoCanal;
    estado = { d, sel: 0, hist: [JSON.stringify(d)], pos: 0, dibujando: false, arrastre: null, caja: null, volverFoco: document.activeElement };
    raiz.classList.remove('hidden'); document.documentElement.classList.add('dis-abierto');
    if (!vista && window.AgroVista3D) { $('dis3d').innerHTML = ''; vista = AgroVista3D.crear($('dis3d')); if (!vista) $('dis3d').innerHTML = '<p class="ayuda p-3">La vista 3D no está disponible en este navegador.</p>'; }
    pintarTodo(); botonesHistoria();
    $('disTitulo').focus();
    return new Promise((ok) => { resolver = ok; });
  }

  window.AgroDisenador = { abrir, svgPlano, desdeSimple, comoSimple, resumen, avisos, sanear, TIPOS, CON_FORMULA };
})();

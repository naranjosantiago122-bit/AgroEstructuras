/*
 * AgroEstructura - Chat «Cotización en línea».
 * Hace las preguntas una por una y calcula con el mismo motor del cotizador (AgroCalculo).
 * Botón flotante en todas las páginas: AgroChat.iniciar()
 */
(function () {
  const C = AgroCalculo, D = AgroDatos, esc = D.esc;
  const TOTAL_PASOS = 9;
  let datos = {}, pasoActual = null, ocupado = false;
  let btn, panel, msgs, form, input, barra, txtPaso;

  const NAVES_OK = (n) => Number.isInteger(n) && n >= 1 && n <= 20;
  const num = (t) => parseFloat(String(t).replace(',', '.').replace(/[^\d.\-]/g, ''));
  const norm = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

  /* Cada paso: n (número de paso), q (pregunta), chips, y cómo guardar la respuesta */
  const PASOS = {
    estructura: { n: 1, q: 'Hola 👋, ¿qué quieres cotizar para tu proyecto agrícola?',
      chips: [{ t: 'Invernadero', v: 'inv' }, { t: 'Casa malla / sarán', v: 'saran' }],
      ok: (v) => (v === 'saran' ? 'saran' : 'modalidad') },
    saran: { n: 1, q: 'Por ahora el cotizador calcula <b>invernaderos</b> (metálico tubular o capilla de guadua). La cotización de casa malla / sarán todavía no está disponible en esta versión.',
      chips: [{ t: 'Cotizar un invernadero', v: 'ok' }], ok: () => 'modalidad' },
    modalidad: { n: 2, q: '¿Requieres el proyecto a <b>Todo costo</b> (materiales + instalación) o solo <b>Mano de obra</b>?',
      chips: [{ t: 'Todo costo', v: 'Todo Costo' }, { t: 'Solo mano de obra', v: 'Mano de Obra' }],
      ok: (v) => { datos.modalidad = v; return 'tipo'; } },
    tipo: { n: 3, q: '¿Qué tipo de estructura prefieres?',
      chips: [{ t: 'Metálico tubular', v: 'Tubular' }, { t: 'Capilla de guadua', v: 'Guadua' }],
      ok: (v) => { datos.tipo = v; return 'largo'; } },
    largo: { n: 4, q: '¿Cuál es el <b>largo</b> del invernadero en metros? (Ej: 50)', numero: true,
      validar: (t) => { const v = num(t); return v > 0 && v <= 1000 ? { ok: true, v } : { ok: false, e: 'Escribe un número mayor que 0, por ejemplo 50.' }; },
      ok: (v) => { datos.largo = v; return 'ancho'; } },
    ancho: { n: 5, q: '¿Y el <b>ancho</b> total en metros? (Ej: 24)', numero: true,
      validar: (t) => { const v = num(t); return v > 0 && v <= 1000 ? { ok: true, v } : { ok: false, e: 'Escribe un número mayor que 0, por ejemplo 24.' }; },
      ok: (v) => { datos.ancho = v; return 'naves'; } },
    naves: { n: 6, q: '¿Cuántas <b>naves acopladas</b> tendrá?',
      chips: [{ t: '1', v: 1 }, { t: '2', v: 2 }, { t: '3', v: 3 }, { t: '4', v: 4 }], numero: true,
      validar: (t) => { const v = num(t); return NAVES_OK(v) ? { ok: true, v } : { ok: false, e: 'Escribe un número entero entre 1 y 20.' }; },
      ok: (v) => { datos.naves = Number(v); return 'plastico'; } },
    plastico: { n: 7, q: '¿Qué <b>calibre de plástico</b> quieres?',
      chips: [{ t: 'Calibre 6', v: '6' }, { t: 'Calibre 7', v: '7' }, { t: 'Calibre 10', v: '10' }],
      ok: (v) => { datos.calibrePlastico = v; return 'canal'; } },
    canal: { n: 8, q: '¿Necesita <b>canal de desagüe</b>? Elige el ancho.',
      chips: [{ t: 'No requiere', v: '0' }, { t: '0.90 m', v: '0.90' }, { t: '1.20 m', v: '1.20' }, { t: '1.50 m', v: '1.50' }, { t: '2.00 m', v: '2.00' }],
      ok: (v) => { datos.anchoCanal = v; return 'cliente'; } },
    cliente: { n: 9, q: '¿A nombre de qué <b>cliente o proyecto</b> es la cotización?', texto: true,
      chips: [{ t: 'Omitir', v: '' }],
      validar: (t) => ({ ok: true, v: t.trim() }),
      ok: (v) => { datos.cliente = v || 'Cotización en línea'; return 'resumen'; } },
  };

  /* ---------- Interfaz ---------- */
  function construir() {
    btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'chatBoton';
    btn.className = 'no-print fixed bottom-5 right-5 z-[70] flex items-center gap-2 px-4 py-3 rounded-full bg-primary text-on-primary font-label-lg text-label-lg font-bold shadow-[0_8px_24px_-4px_rgba(75,226,119,0.45)] hover:bg-spring-lime transition-all active:scale-95';
    btn.setAttribute('aria-label', 'Abrir Cotización en línea');
    btn.innerHTML = '<span class="material-symbols-outlined text-[22px]">forum</span><span class="hidden sm:inline">Cotización en línea</span>';
    btn.addEventListener('click', () => alternar(true));

    panel = document.createElement('section');
    panel.id = 'chatPanel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Cotización en línea');
    panel.className = 'no-print hidden fixed bottom-4 right-4 z-[80] w-[calc(100vw-2rem)] max-w-md h-[min(640px,calc(100vh-2rem))] bg-surface-card border border-border-grid rounded-2xl shadow-2xl flex flex-col overflow-hidden';
    panel.innerHTML = `
      <div class="px-4 py-3 bg-surface-container-low border-b border-border-grid flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <div class="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-forest-deep to-primary-container flex items-center justify-center text-on-primary"><span class="material-symbols-outlined">forum</span>
            <span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary border-2 border-surface-card"></span></div>
          <div><h2 class="font-headline-sm text-headline-sm text-on-surface leading-tight">Cotización en línea</h2><p class="font-body-sm text-body-sm text-on-surface-variant">Asistente de cotización</p></div>
        </div>
        <div class="flex items-center gap-1">
          <button type="button" id="chatReiniciar" title="Reiniciar chat" aria-label="Reiniciar chat" class="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container"><span class="material-symbols-outlined text-[20px]">restart_alt</span></button>
          <button type="button" id="chatCerrar" title="Cerrar" aria-label="Cerrar chat" class="p-2 rounded-lg text-on-surface-variant hover:text-danger-alert hover:bg-surface-container"><span class="material-symbols-outlined text-[20px]">close</span></button>
        </div>
      </div>
      <div class="px-4 py-2 bg-surface-container-lowest border-b border-border-grid flex items-center justify-between shrink-0 font-label-sm text-label-sm">
        <span class="text-on-surface-variant">Progreso de la cotización</span>
        <span class="flex items-center gap-2"><span id="chatPaso" class="text-spring-lime">Paso 1 de ${TOTAL_PASOS}</span><span class="w-24 h-1.5 bg-surface-container-high rounded-full overflow-hidden"><span id="chatBarra" class="block h-full bg-primary rounded-full transition-all" style="width:0%"></span></span></span>
      </div>
      <div id="chatMsgs" class="flex-1 overflow-y-auto p-4 space-y-4 font-body-md text-body-md" aria-live="polite"></div>
      <form id="chatForm" class="p-3 border-t border-border-grid bg-surface-container-low flex items-center gap-2 shrink-0" autocomplete="off">
        <input id="chatInput" type="text" placeholder="Escribe aquí tu respuesta…" aria-label="Tu respuesta" class="flex-1 bg-surface-container-lowest border border-border-grid focus:border-wireframe-blue rounded-xl px-4 py-2.5 text-on-surface placeholder:text-input-affordance focus:outline-none">
        <button type="submit" aria-label="Enviar" class="h-10 w-11 rounded-xl bg-primary hover:bg-spring-lime text-on-primary flex items-center justify-center transition-all active:scale-95"><span class="material-symbols-outlined text-[20px]">send</span></button>
      </form>`;
    document.body.appendChild(btn); document.body.appendChild(panel);
    msgs = panel.querySelector('#chatMsgs'); form = panel.querySelector('#chatForm'); input = panel.querySelector('#chatInput');
    barra = panel.querySelector('#chatBarra'); txtPaso = panel.querySelector('#chatPaso');
    panel.querySelector('#chatCerrar').addEventListener('click', () => alternar(false));
    panel.querySelector('#chatReiniciar').addEventListener('click', reiniciar);
    form.addEventListener('submit', (e) => { e.preventDefault(); const t = input.value.trim(); if (!t) return; input.value = ''; texto(t); });
    panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') alternar(false); });
    msgs.addEventListener('click', (e) => {
      const b = e.target.closest('[data-chip]'); if (!b || b.disabled || ocupado) return;
      elegir(b.dataset.paso, b.dataset.chip, b.textContent.trim());
    });
  }

  const dibujarBot = (html, extra) => {
    const d = document.createElement('div'); d.className = 'flex items-start gap-3 aparece';
    d.innerHTML = `<div class="w-8 h-8 rounded-lg bg-forest-deep border border-primary/40 text-primary flex items-center justify-center shrink-0 text-xs font-bold">AG</div>
      <div class="space-y-2 max-w-[86%]"><div class="bg-surface-container-low border border-border-grid p-3 rounded-2xl rounded-tl-sm text-on-surface leading-relaxed">${html}</div>${extra || ''}</div>`;
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d;
  };
  const dibujarUsuario = (t) => {
    const d = document.createElement('div'); d.className = 'flex items-end justify-end gap-2 aparece';
    d.innerHTML = `<div class="bg-primary-container text-on-primary-container px-4 py-2.5 rounded-2xl rounded-br-sm max-w-[80%] font-semibold">${esc(t)}</div>`;
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
  };
  const chipsHtml = (paso, chips) => `<div class="flex flex-wrap gap-2 pt-1">${chips.map((c) =>
    `<button type="button" data-paso="${paso}" data-chip="${esc(String(c.v))}" class="px-3.5 py-1.5 rounded-xl border border-border-grid bg-surface-container-lowest hover:bg-surface-container-high hover:border-primary text-on-surface text-sm font-semibold transition disabled:opacity-40 disabled:pointer-events-none">${esc(c.t)}</button>`).join('')}</div>`;
  const desactivarChips = () => msgs.querySelectorAll('[data-chip]').forEach((b) => { b.disabled = true; });

  function progreso(n) {
    txtPaso.textContent = `Paso ${Math.min(n, TOTAL_PASOS)} de ${TOTAL_PASOS}`;
    barra.style.width = Math.round(((n - 1) / TOTAL_PASOS) * 100) + '%';
  }

  /* ---------- Conversación ---------- */
  function preguntar(nombre) {
    pasoActual = nombre;
    if (nombre === 'resumen') return resumen();
    const p = PASOS[nombre];
    progreso(p.n);
    input.placeholder = p.numero ? 'Escribe un número…' : (p.texto ? 'Escribe el nombre…' : 'Escribe o elige una opción…');
    input.inputMode = p.numero ? 'decimal' : 'text';
    dibujarBot(p.q, p.chips ? chipsHtml(nombre, p.chips) : '');
    ocupado = false;
  }
  function conRetraso(fn) { ocupado = true; setTimeout(fn, 350); }

  function elegir(paso, valor, etiqueta) {
    if (paso === 'resumen') { // botones de la cotización final
      desactivarChips(); dibujarUsuario(etiqueta);
      if (valor.indexOf('abrir:') === 0) { location.href = 'nuevo-proyecto.html?id=' + encodeURIComponent(valor.slice(6)); return; }
      conRetraso(() => { accionesResumen[valor](); ocupado = false; });
      return;
    }
    const p = PASOS[paso]; if (!p || paso !== pasoActual) return;
    desactivarChips(); dibujarUsuario(etiqueta);
    const v = (typeof p.chips[0].v === 'number') ? Number(valor) : valor;
    const sig = p.ok(v);
    conRetraso(() => preguntar(sig));
  }
  function texto(t) {
    if (ocupado) return;
    dibujarUsuario(t);
    if (pasoActual === 'resumen') { conRetraso(() => { dibujarBot('Usa los botones de abajo, o pulsa <b>reiniciar</b> para cotizar otra estructura.'); ocupado = false; }); return; }
    const p = PASOS[pasoActual];
    // ¿Coincide con alguna opción escrita?
    if (p.chips) {
      const c = p.chips.find((x) => norm(x.t) === norm(t) || norm(String(x.v)) === norm(t) || (norm(t).length >= 4 && norm(x.t).includes(norm(t))));
      if (c && !(p.numero && c.t !== 'Omitir')) { desactivarChips(); const v = typeof c.v === 'number' ? c.v : c.v; const sig = p.ok(v); conRetraso(() => preguntar(sig)); return; }
    }
    if (p.validar) {
      const r = p.validar(t);
      if (r.ok) { desactivarChips(); const sig = p.ok(r.v); conRetraso(() => preguntar(sig)); }
      else conRetraso(() => { dibujarBot(r.e); ocupado = false; });
      return;
    }
    conRetraso(() => { dibujarBot('No te entendí. Elige una de las opciones de arriba.'); ocupado = false; });
  }

  function paramsDesdeDatos() {
    return { tipo: datos.tipo, largo: datos.largo, ancho: datos.ancho, distancia: 2.5, naves: datos.naves, calibrePlastico: datos.calibrePlastico, anchoPlastico: '5.80', anchoCanal: datos.anchoCanal, calibreCanal: '6', modalidad: datos.modalidad };
  }
  function resumen() {
    progreso(TOTAL_PASOS + 1); barra.style.width = '100%'; txtPaso.textContent = '¡Listo!';
    const p = paramsDesdeDatos(); const r = C.calcular(p, D.getPrecios(), []);
    if (!r.ok) { dibujarBot('No pude calcular: ' + esc(r.errores.join(' '))); ocupado = false; return; }
    const fila = (a, b) => `<div class="flex justify-between gap-3"><span class="text-on-surface-variant">${a}</span><span class="font-semibold text-on-surface text-right">${b}</span></div>`;
    const card = `<div class="rounded-xl border border-primary/30 bg-surface-container-lowest p-3.5 space-y-1.5 text-sm">
      <div class="flex items-center justify-between border-b border-border-grid pb-2 mb-1"><span class="font-label-md text-label-md uppercase text-on-surface-variant">Resumen</span><span class="text-xs font-semibold text-spring-lime bg-primary/10 px-2 py-0.5 rounded">${esc(datos.cliente)}</span></div>
      ${fila('Estructura', esc(C.NOMBRE_TIPO[p.tipo]))}
      ${fila('Medidas', `${p.largo} × ${p.ancho} m · ${p.naves} nave${p.naves > 1 ? 's' : ''}`)}
      ${fila('Plástico / canal', `Cal. ${esc(p.calibrePlastico)} · ${p.anchoCanal === '0' ? 'sin canal' : esc(p.anchoCanal) + ' m'}`)}
      ${fila('Modalidad', esc(p.modalidad))}
      ${fila('Materiales', C.fCOP(r.cMat))}
      ${fila('Mano de obra', C.fCOP(r.cObra))}
      <div class="flex justify-between pt-2 mt-1 border-t border-border-grid"><span class="font-bold text-on-surface">TOTAL</span><span class="font-headline-sm text-headline-sm text-spring-lime tabular">${C.fCOP(r.total)}</span></div>
      <p class="text-[11px] text-on-surface-variant pt-1">Supuestos: postes cada 2.5 m y plástico de 5.80 m de ancho. Puedes cambiarlos en el cotizador.</p></div>`;
    const acciones = chipsHtml('resumen', [{ t: 'Ver en el cotizador', v: 'ver' }, { t: 'Guardar presupuesto', v: 'guardar' }, { t: 'Cotizar otro', v: 'otro' }]);
    dibujarBot('¡Listo! Esta es tu cotización:', card + acciones);
    ocupado = false;
  }

  // Acciones del resumen (paso 'resumen')
  const accionesResumen = {
    ver() { D.setBorrador({ params: paramsDesdeDatos(), cliente: datos.cliente, auto: true }); location.href = 'nuevo-proyecto.html?borrador=1'; },
    guardar(botonEtq) {
      const p = paramsDesdeDatos(); const r = C.calcular(p, D.getPrecios(), []);
      const proy = D.guardarProyecto({ cliente: datos.cliente, params: p, insumos: [], precios: D.getPrecios(), resultado: r });
      if (!proy) { dibujarBot('No pude guardar: el almacenamiento del navegador está lleno o bloqueado.'); return; }
      dibujarBot(`✓ Guardado como <b>${esc(proy.id)}</b>. ¿Quieres abrirlo?`, chipsHtml('resumen', [{ t: 'Abrir en el cotizador', v: 'abrir:' + proy.id }, { t: 'Cotizar otro', v: 'otro' }]));
    },
    otro() { reiniciar(); },
  };
  function reiniciar() { datos = {}; msgs.innerHTML = ''; ocupado = false; preguntar('estructura'); }

  function alternar(abrir) {
    panel.classList.toggle('hidden', !abrir); btn.classList.toggle('hidden', abrir);
    if (abrir) { if (!msgs.children.length) preguntar('estructura'); setTimeout(() => input.focus(), 50); } else btn.focus();
  }

  function iniciar() { if (document.getElementById('chatPanel')) return; construir(); }
  window.AgroChat = { iniciar, abrir: () => { iniciar(); alternar(true); } };
})();

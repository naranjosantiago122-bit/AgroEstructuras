/* AgroEstructura - Centro Principal: indicadores y tabla de presupuestos (datos reales guardados). */
(function () {
  const $ = (id) => document.getElementById(id);
  const C = AgroCalculo, D = AgroDatos, esc = D.esc;
  if (!AgroLayout.montar('dashboard', { soloDueno: true })) return;
  const ses = D.getSesion();

  let mostrarTodos = false;
  const LIMITE = 8;
  const fN = (n) => new Intl.NumberFormat('es-CO').format(Math.round(n));

  const primerNombre = (ses.nombre || '').split(' ')[0];
  $('saludo').textContent = ses.invitado ? '¿En qué vamos a trabajar hoy? 👋' : `¿En qué vamos a trabajar hoy, ${primerNombre}? 👋`;

  const claseEstado = { 'Aprobado': 'bg-primary/10 text-spring-lime border-primary/30', 'En revisión': 'bg-secondary-container/20 text-wireframe-blue border-wireframe-blue/30', 'Cotizado': 'bg-surface-container-highest text-on-surface-variant border-border-grid' };
  const claseTipo = { Tubular: 'bg-secondary-container/20 text-wireframe-blue border-wireframe-blue/30', Guadua: 'bg-tertiary-container/20 text-tertiary border-tertiary/30' };
  const areaDe = (p) => p.resultado.area != null ? p.resultado.area : p.params.largo * p.params.ancho * p.params.naves;

  function indicadores(arr) {
    $('kpiCantidad').textContent = arr.length;
    const hoy = new Date();
    const delMes = arr.filter((p) => { const f = new Date(p.fecha); return f.getMonth() === hoy.getMonth() && f.getFullYear() === hoy.getFullYear(); });
    $('kpiMes').textContent = arr.length ? `${delMes.length} este mes` : 'Aún no hay presupuestos';
    $('kpiArea').innerHTML = `${fN(arr.reduce((s, p) => s + areaDe(p), 0))} <span class="text-body-md font-normal text-on-surface-variant">m²</span>`;
    $('kpiTotalMes').textContent = C.fCOP(delMes.reduce((s, p) => s + p.resultado.total, 0));
    if (arr.length) {
      const cuenta = {}; arr.forEach((p) => { cuenta[p.params.tipo] = (cuenta[p.params.tipo] || 0) + 1; });
      const top = Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a])[0];
      $('kpiTipo').textContent = C.NOMBRE_TIPO[top] || top;
      $('kpiTipoDet').textContent = `${cuenta[top]} de ${arr.length} presupuesto${arr.length === 1 ? '' : 's'} (${Math.round(cuenta[top] / arr.length * 100)} %)`;
    } else { $('kpiTipo').textContent = '—'; $('kpiTipoDet').textContent = 'Aún sin datos'; }
    $('txtAlmacen').textContent = `${arr.length} presupuesto${arr.length === 1 ? '' : 's'} · ${D.getInsumos().length} insumo${D.getInsumos().length === 1 ? '' : 's'} libre${D.getInsumos().length === 1 ? '' : 's'}`;
  }

  function tabla() {
    const arr = D.getProyectos();
    indicadores(arr); AgroLayout.refrescarResumen();
    const q = $('filtro').value.trim().toLowerCase();
    const filtrados = arr.filter((p) => !q || p.cliente.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
    const visibles = mostrarTodos ? filtrados : filtrados.slice(0, LIMITE);
    $('vacio').classList.toggle('hidden', arr.length > 0);
    $('cuerpoTabla').parentElement.parentElement.classList.toggle('hidden', arr.length === 0);

    $('cuerpoTabla').innerHTML = visibles.map((p) => `
      <tr class="hover:bg-surface-container/40 transition-colors">
        <td class="py-3 px-3"><div class="font-semibold text-on-surface"><a href="nuevo-proyecto.html?id=${encodeURIComponent(p.id)}" title="Abrir en el cotizador" class="text-wireframe-blue hover:text-primary underline underline-offset-4">${esc(p.cliente)}</a>${p.visibleCliente ? ' <span class="ml-1 px-1.5 py-0.5 rounded bg-primary/10 text-spring-lime text-xs font-label-sm">Enviada</span>' : ''}${p.ejemplo ? ' <span class="ml-1 px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant text-xs font-label-sm uppercase">Ejemplo</span>' : ''}</div><div class="text-xs text-on-surface-variant font-mono">${esc(p.id)}</div></td>
        <td class="py-3 px-3"><span class="inline-flex px-2.5 py-1 rounded-full border text-xs font-label-sm ${claseTipo[p.params.tipo] || ''}">${esc(C.NOMBRE_TIPO[p.params.tipo] || p.params.tipo)}</span></td>
        <td class="py-3 px-3 text-on-surface-variant whitespace-nowrap"><div class="text-on-surface">${esc(p.params.largo)} × ${esc(p.params.ancho)} m <span class="text-xs text-on-surface-variant">por nave</span></div><div class="text-xs">${fN(areaDe(p))} m² · ${esc(p.params.naves)} nave${p.params.naves > 1 ? 's' : ''}</div></td>
        <td class="py-3 px-3"><select data-estado="${esc(p.id)}" aria-label="Estado del presupuesto de ${esc(p.cliente)}" class="sel-estado ${claseEstado[p.estado] || claseEstado.Cotizado}">${D.ESTADOS.map((e) => `<option value="${esc(e)}" ${e === p.estado ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select></td>
        <td class="py-3 px-3 text-right font-bold text-spring-lime tabular whitespace-nowrap">${C.fCOP(p.resultado.total)}</td>
        <td class="py-2 px-1"><div class="flex items-center justify-center">
          <a href="nuevo-proyecto.html?id=${encodeURIComponent(p.id)}&copia=1" title="Duplicar (crear una variante)" aria-label="Duplicar ${esc(p.cliente)}" class="btn-icono rounded-lg text-on-surface-variant hover:text-secondary hover:bg-surface-container"><span class="material-symbols-outlined text-[20px]">content_copy</span></a>
          <button type="button" data-borrar="${esc(p.id)}" title="Eliminar" aria-label="Eliminar ${esc(p.cliente)}" class="btn-icono rounded-lg text-on-surface-variant hover:text-danger-alert hover:bg-danger-alert/10"><span class="material-symbols-outlined text-[20px]">delete</span></button>
        </div></td>
      </tr>`).join('') || (arr.length ? '<tr><td colspan="6" class="py-8 text-center text-on-surface-variant">Ningún presupuesto coincide con el filtro.</td></tr>' : '');

    $('pieTabla').textContent = arr.length ? `Mostrando ${visibles.length} de ${filtrados.length} presupuesto${filtrados.length === 1 ? '' : 's'}` : '';
    $('btnMas').classList.toggle('hidden', filtrados.length <= LIMITE);
    $('btnMas').textContent = mostrarTodos ? 'Mostrar menos' : 'Mostrar todos';
  }

  $('filtro').addEventListener('input', tabla);
  $('btnMas').addEventListener('click', () => { mostrarTodos = !mostrarTodos; tabla(); });
  $('btnEjemplos').addEventListener('click', () => { D.cargarEjemplos(); tabla(); AgroLayout.toast('Ejemplos cargados', 'Son presupuestos de prueba, calculados con tus precios actuales.', 'info'); });

  $('cuerpoTabla').addEventListener('click', (e) => {
    const b = e.target.closest('[data-borrar]');
    if (b) {
      const indice = D.getProyectos().findIndex((x) => x.id === b.dataset.borrar);
      const p = D.getProyecto(b.dataset.borrar);
      if (!p) return;
      // Si venía de una solicitud, la solicitud vuelve a «En revisión» (el cliente deja de ver la cotización)
      const sol = p.idSolicitud ? D.getSolicitud(p.idSolicitud) : null;
      const solAntes = sol ? { estado: sol.estado, idPresupuesto: sol.idPresupuesto } : null;
      D.borrarProyecto(p.id);
      if (sol) D.actualizarSolicitud(sol.id, { estado: 'En revisión', idPresupuesto: null });
      tabla(); solicitudes();
      AgroLayout.toast('Presupuesto eliminado', `${p.cliente} (${p.id})`, 'info', { texto: 'Deshacer', fn: () => {
        D.restaurarProyecto(p, indice);
        if (sol) D.actualizarSolicitud(sol.id, solAntes);
        tabla(); solicitudes(); AgroLayout.toast('Presupuesto recuperado', p.cliente);
      } });
    }
  });
  $('cuerpoTabla').addEventListener('change', (e) => {
    const s = e.target.closest('[data-estado]'); if (!s) return;
    const p = D.getProyecto(s.dataset.estado); const anterior = p ? p.estado : null;
    if (!D.setEstado(s.dataset.estado, s.value)) return;
    tabla();
    AgroLayout.toast('Estado actualizado', `${p.cliente}: ${s.value}`, 'ok', { texto: 'Deshacer', fn: () => { D.setEstado(p.id, anterior); tabla(); } });
  });

  /* ---------- Solicitudes de los clientes ---------- */
  const claseSol = { 'Pendiente': 'bg-tertiary/15 text-tertiary border-tertiary/40', 'En revisión': 'bg-secondary-container/20 text-wireframe-blue border-wireframe-blue/30', 'Cotizada': 'bg-primary/10 text-spring-lime border-primary/30' };
  const ORDEN_SOL = { 'Pendiente': 0, 'En revisión': 1, 'Cotizada': 2 };
  function solicitudes() {
    const todas = D.getSolicitudes();
    const verTodas = $('verCotizadas').checked;
    const lista = todas.filter((s) => verTodas || s.estado !== 'Cotizada')
      .sort((a, b) => (ORDEN_SOL[a.estado] - ORDEN_SOL[b.estado]) || (b.fecha < a.fecha ? -1 : 1));
    const n = D.pendientes();
    $('subSolicitudes').textContent = n
      ? `Tienes ${n} solicitud${n === 1 ? '' : 'es'} sin revisar. Cotízala${n === 1 ? '' : 's'} y envíale${n === 1 ? '' : 's'} la cotización.`
      : 'Diseños que enviaron los clientes. Cotízalos y envíales la cotización.';
    if (!lista.length) {
      $('listaSolicitudes').innerHTML = `<p class="py-6 text-center text-on-surface-variant font-body-sm text-body-sm">${todas.length ? 'No hay solicitudes por atender. Marca «Mostrar también las ya enviadas» para ver el historial.' : 'Aún no llegan solicitudes. Cuando un cliente envíe su diseño, aparecerá aquí.'}</p>`;
      return;
    }
    $('listaSolicitudes').innerHTML = lista.map((s) => {
      const p = s.params;
      const accion = s.idPresupuesto && D.getProyecto(s.idPresupuesto)
        ? `<a href="nuevo-proyecto.html?id=${encodeURIComponent(s.idPresupuesto)}" class="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-lg border border-border-grid text-on-surface hover:border-primary hover:text-primary font-label-md text-label-md"><span class="material-symbols-outlined text-[18px]">open_in_new</span>Abrir ${esc(s.idPresupuesto)}</a>`
        : `<a href="nuevo-proyecto.html?solicitud=${encodeURIComponent(s.id)}" class="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-lg bg-primary hover:bg-spring-lime text-on-primary font-label-md text-label-md font-bold"><span class="material-symbols-outlined text-[18px]">calculate</span>Cotizar</a>`;
      return `
      <article class="rounded-xl border ${s.estado === 'Pendiente' ? 'border-tertiary/40' : 'border-border-grid'} bg-surface-container-low p-4 flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <div class="flex flex-col gap-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-label-md text-label-md text-on-surface">${esc(s.id)}</span>
            <span class="px-2.5 py-0.5 rounded-full border text-xs font-label-sm ${claseSol[s.estado] || ''}">${esc(s.estado === 'Cotizada' ? 'Enviada al cliente' : s.estado)}</span>
            <span class="text-xs text-on-surface-variant">${esc(D.fechaLarga(s.fecha))}</span>
          </div>
          <p class="font-body-md text-body-md text-on-surface"><b>${esc(s.nombre)}</b>${s.proyecto ? ' · ' + esc(s.proyecto) : ''}${s.ciudad ? ' · ' + esc(s.ciudad) : ''} · ${esc(s.telefono || s.correo)}</p>
          <p class="ayuda">${esc(C.NOMBRE_TIPO[p.tipo] || p.tipo)} · ${esc(p.largo)} × ${esc(p.ancho)} m por nave · ${esc(p.naves)} nave${p.naves > 1 ? 's' : ''} · plástico cal. ${esc(p.calibrePlastico)} · ${p.anchoCanal === '0' ? 'sin canal' : 'canal ' + esc(p.anchoCanal) + ' m'} · <b>${esc(p.modalidad)}</b></p>
          ${s.observaciones ? `<p class="ayuda"><b>Observaciones:</b> ${esc(s.observaciones)}</p>` : ''}
        </div>
        <div class="shrink-0">${accion}</div>
      </article>`;
    }).join('');
  }
  $('verCotizadas').addEventListener('change', solicitudes);
  // Si el cliente envía una solicitud desde otra pestaña del mismo navegador, se actualiza sola
  window.addEventListener('storage', (e) => { if (e.key === D.K.solicitudes) { solicitudes(); AgroLayout.refrescarResumen(); } });

  $('btnReporte').addEventListener('click', () => {
    if (!D.getProyectos().length) { AgroLayout.toast('Sin datos', 'Aún no hay presupuestos para el reporte.', 'info'); return; }
    const blob = new Blob([D.proyectosCSV()], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'presupuestos-agroestructura-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    AgroLayout.toast('Reporte descargado', 'Ábrelo con Excel.');
  });

  solicitudes();
  tabla();
})();

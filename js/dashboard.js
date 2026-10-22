/* AgroEstructura - Centro Principal: indicadores y tabla de presupuestos (datos reales guardados). */
(function () {
  const $ = (id) => document.getElementById(id);
  const C = AgroCalculo, D = AgroDatos, esc = D.esc;
  AgroLayout.montar('dashboard');
  const ses = D.getSesion();
  if (!ses) return;

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
        <td class="py-3 px-3"><div class="font-semibold text-on-surface">${esc(p.cliente)}${p.ejemplo ? ' <span class="ml-1 px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant text-[10px] font-label-sm uppercase">Ejemplo</span>' : ''}</div><div class="text-xs text-on-surface-variant font-mono">${esc(p.id)}</div></td>
        <td class="py-3 px-3"><span class="inline-flex px-2.5 py-1 rounded-full border text-xs font-label-sm ${claseTipo[p.params.tipo] || ''}">${esc(C.NOMBRE_TIPO[p.params.tipo] || p.params.tipo)}</span></td>
        <td class="py-3 px-3 text-on-surface-variant whitespace-nowrap"><div class="text-on-surface">${esc(p.params.largo)} × ${esc(p.params.ancho)} m</div><div class="text-xs">${fN(areaDe(p))} m² · ${esc(p.params.naves)} nave${p.params.naves > 1 ? 's' : ''}</div></td>
        <td class="py-3 px-3"><button type="button" data-estado="${esc(p.id)}" title="Clic para cambiar el estado" class="inline-flex px-2.5 py-1 rounded-full border text-xs font-label-sm ${claseEstado[p.estado] || claseEstado.Cotizado} hover:brightness-125">${esc(p.estado)}</button></td>
        <td class="py-3 px-3 text-right font-bold text-spring-lime tabular whitespace-nowrap">${C.fCOP(p.resultado.total)}</td>
        <td class="py-3 px-3"><div class="flex items-center justify-center gap-1">
          <a href="nuevo-proyecto.html?id=${encodeURIComponent(p.id)}" title="Abrir en el cotizador" aria-label="Abrir ${esc(p.cliente)}" class="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container"><span class="material-symbols-outlined text-[20px]">open_in_new</span></a>
          <button type="button" data-borrar="${esc(p.id)}" title="Eliminar" aria-label="Eliminar ${esc(p.cliente)}" class="p-1.5 rounded-lg text-on-surface-variant hover:text-danger-alert hover:bg-danger-alert/10"><span class="material-symbols-outlined text-[20px]">delete</span></button>
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
      const p = D.getProyecto(b.dataset.borrar);
      if (p && confirm(`¿Eliminar el presupuesto de «${p.cliente}»? Esta acción no se puede deshacer.`)) { D.borrarProyecto(p.id); tabla(); AgroLayout.toast('Presupuesto eliminado', p.id); }
      return;
    }
    const s = e.target.closest('[data-estado]');
    if (s) { D.ciclarEstado(s.dataset.estado); tabla(); }
  });

  $('btnReporte').addEventListener('click', () => {
    if (!D.getProyectos().length) { AgroLayout.toast('Sin datos', 'Aún no hay presupuestos para el reporte.', 'info'); return; }
    const blob = new Blob([D.proyectosCSV()], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'presupuestos-agroestructura-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    AgroLayout.toast('Reporte descargado', 'Ábrelo con Excel.');
  });

  tabla();
})();

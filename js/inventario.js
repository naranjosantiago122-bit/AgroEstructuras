/* AgroEstructura - Inventario: precios base e insumos libres. */
(function () {
  const $ = (id) => document.getElementById(id);
  const C = AgroCalculo, D = AgroDatos, esc = D.esc;
  AgroLayout.montar('inventario');
  if (!D.getSesion()) return;

  let sinGuardar = false;

  function estado(modo, texto) {
    const cfg = {
      ok: ['Al día', 'Sin cambios', 'info', 'text-on-surface-variant'],
      pend: ['Pendiente', 'Cambios sin guardar', 'edit', 'text-tertiary'],
      guardado: ['Guardado', 'Hace un momento', 'check_circle', 'text-spring-lime'],
    }[modo];
    $('estadoGuardado').textContent = cfg[0]; $('estadoGuardadoDet').textContent = cfg[1];
    $('iconoAviso').textContent = cfg[2]; $('iconoAviso').className = 'material-symbols-outlined text-[20px] ' + cfg[3];
    $('txtAviso').textContent = texto;
    $('avisoGuardado').className = 'w-full md:w-auto flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-container-lowest border text-on-surface-variant ' + (modo === 'guardado' ? 'border-primary/40' : (modo === 'pend' ? 'border-tertiary/40' : 'border-border-grid'));
  }

  function cargarBase() {
    const p = D.getPrecios();
    document.querySelectorAll('.base-input').forEach((i) => { i.value = p[i.dataset.key]; i.classList.remove('text-danger-alert'); });
  }

  function pintarInsumos() {
    const arr = D.getInsumos();
    $('contadorInsumos').textContent = arr.length; AgroLayout.refrescarResumen();
    $('gridInsumos').innerHTML = arr.length ? arr.map((i) => `
      <div class="bg-surface-card border border-border-grid rounded-xl p-4 flex flex-col justify-between gap-4 hover:border-wireframe-blue/40 transition-all shadow-md">
        <div class="flex items-start justify-between gap-2">
          <div class="flex flex-col gap-1 min-w-0"><span class="font-label-sm text-label-sm text-wireframe-blue uppercase tracking-wider">${esc(i.unidad || 'Insumo')}</span><span class="font-headline-sm text-headline-sm text-on-surface font-semibold leading-snug break-words">${esc(i.nombre)}</span></div>
          <button type="button" data-borrar="${esc(i.id)}" title="Eliminar insumo" aria-label="Eliminar ${esc(i.nombre)}" class="text-on-surface-variant hover:text-danger-alert hover:bg-danger-alert/10 p-1.5 rounded-lg shrink-0"><span class="material-symbols-outlined text-[20px]">delete</span></button>
        </div>
        <div class="flex flex-col gap-1.5 pt-2 border-t border-border-grid">
          <div class="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm"><span>Precio unitario (COP)</span><span class="text-spring-lime">Editable</span></div>
          <div class="flex items-center rounded-lg border border-border-grid bg-surface-container-lowest focus-within:border-wireframe-blue"><span class="px-3 py-2 font-label-md text-label-md text-wireframe-blue font-bold border-r border-border-grid">$</span>
            <input type="number" min="0" step="50" value="${esc(i.precio)}" data-precio="${esc(i.id)}" aria-label="Precio de ${esc(i.nombre)}" class="w-full bg-transparent text-on-surface font-metric-display text-headline-sm px-3 py-1.5 focus:outline-none text-right tabular"></div>
        </div>
      </div>`).join('')
      : `<div class="col-span-full py-10 px-4 rounded-xl border border-dashed border-border-grid text-center flex flex-col items-center gap-2">
           <span class="material-symbols-outlined text-[36px] text-on-surface-variant">inventory_2</span>
           <span class="font-headline-sm text-headline-sm text-on-surface">No hay insumos adicionales</span>
           <p class="font-body-sm text-body-sm text-on-surface-variant">Usa el formulario de arriba para añadir cemento, tornillos, alambre u otros insumos.</p></div>`;
  }

  /* ---------- Crear insumo ---------- */
  $('formInsumo').addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = $('insNombre').value.trim(); const precio = parseFloat($('insPrecio').value);
    const err = $('errInsumo');
    const mal = !nombre ? 'Escribe el nombre del insumo.' : (!(precio > 0) ? 'Escribe un precio mayor que 0.' : '');
    err.textContent = mal; err.classList.toggle('hidden', !mal);
    if (mal) return;
    if (!D.addInsumo(nombre, precio)) return;
    $('insNombre').value = ''; $('insPrecio').value = '';
    pintarInsumos(); AgroLayout.toast('Insumo registrado', `${nombre} — ${C.fCOP(precio)}`);
    $('insNombre').focus();
  });

  /* ---------- Insumos: editar precio / eliminar ---------- */
  $('gridInsumos').addEventListener('change', (e) => {
    const i = e.target.closest('[data-precio]'); if (!i) return;
    const v = parseFloat(i.value);
    if (!(v >= 0)) { AgroLayout.toast('Precio inválido', 'Escribe un número válido.', 'error'); pintarInsumos(); return; }
    D.setPrecioInsumo(i.dataset.precio, v);
    AgroLayout.toast('Precio actualizado', C.fCOP(v));
  });
  $('gridInsumos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-borrar]'); if (!b) return;
    const ins = D.getInsumos().find((x) => x.id === b.dataset.borrar);
    if (ins && confirm(`¿Eliminar «${ins.nombre}» del almacén?`)) { D.delInsumo(ins.id); pintarInsumos(); AgroLayout.toast('Insumo eliminado', ins.nombre); }
  });

  /* ---------- Precios base ---------- */
  document.querySelectorAll('.base-input').forEach((i) => i.addEventListener('input', () => {
    sinGuardar = true; i.classList.remove('text-danger-alert'); estado('pend', 'Tienes cambios en los precios base sin guardar.');
  }));

  $('btnGuardar').addEventListener('click', () => {
    const nuevo = {}; let ok = true;
    document.querySelectorAll('.base-input').forEach((i) => {
      const v = parseFloat(i.value);
      if (!(v > 0)) { ok = false; i.classList.add('text-danger-alert'); } else nuevo[i.dataset.key] = v;
    });
    if (!ok) { AgroLayout.toast('Revisa los precios', 'Todos los precios base deben ser mayores que 0.', 'error'); return; }
    if (!D.setPrecios(nuevo)) { AgroLayout.toast('No se pudo guardar', 'El almacenamiento del navegador está lleno o bloqueado.', 'error'); return; }
    sinGuardar = false; estado('guardado', '✓ Precios guardados exitosamente.');
    AgroLayout.toast('Precios guardados', 'Se aplicarán a los nuevos cálculos.');
  });

  $('btnReset').addEventListener('click', () => {
    if (!confirm('¿Restablecer los 4 precios base a los valores iniciales?')) return;
    D.resetPrecios(); cargarBase(); sinGuardar = false; estado('guardado', '✓ Precios base restablecidos.');
    AgroLayout.toast('Precios restablecidos', 'Se usan los valores iniciales.', 'info');
  });

  window.addEventListener('beforeunload', (e) => { if (sinGuardar) { e.preventDefault(); e.returnValue = ''; } });

  cargarBase(); pintarInsumos(); estado('ok', 'Los precios base están al día.');
})();

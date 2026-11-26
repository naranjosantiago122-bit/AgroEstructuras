/*
 * AgroEstructura - «Mis solicitudes» (cliente).
 * Muestra las solicitudes del cliente con su estado. La cotización con precios solo aparece
 * cuando el dueño la libera (como la vista v_cotizaciones_cliente de la base de datos).
 */
(async function () {
  const $ = (id) => document.getElementById(id);
  const C = AgroCalculo, D = AgroDatos, esc = D.esc;
  if (!(await AgroLayout.montar('solicitudes'))) return;
  // El dueño tiene su propia bandeja en el Centro Principal
  if (D.esDueno()) { location.replace('centro-principal.html'); return; }

  const ESTADO = {
    'Pendiente': { clase: 'bg-tertiary/15 text-tertiary border-tertiary/40', icono: 'schedule', texto: 'Recibida. Aún no la hemos revisado.' },
    'En revisión': { clase: 'bg-secondary-container/20 text-wireframe-blue border-wireframe-blue/30', icono: 'engineering', texto: 'Estamos preparando tu cotización.' },
    'Cotizada': { clase: 'bg-primary/10 text-spring-lime border-primary/30', icono: 'task_alt', texto: '¡Tu cotización está lista!' },
  };

  function pintar() {
    if (D.getRol() === D.ROLES.INVITADO) {
      $('lista').innerHTML = `
        <div class="py-12 px-4 text-center flex flex-col items-center gap-3 border border-dashed border-border-grid rounded-xl">
          <span class="material-symbols-outlined text-[44px] text-on-surface-variant">person_add</span>
          <p class="font-headline-sm text-headline-sm text-on-surface">Crea una cuenta para enviar y seguir tus solicitudes</p>
          <p class="ayuda max-w-md">Necesitamos tu nombre y teléfono para enviarte la cotización. Puedes seguir diseñando como invitado.</p>
          <a href="acceso.html?volver=mis-solicitudes.html" class="px-4 min-h-[44px] inline-flex items-center rounded-lg bg-primary text-on-primary font-label-md text-label-md font-bold hover:bg-spring-lime">Crear cuenta o ingresar</a>
        </div>`;
      return;
    }
    const arr = D.misSolicitudes();
    if (!arr.length) {
      $('lista').innerHTML = `
        <div class="py-12 px-4 text-center flex flex-col items-center gap-3 border border-dashed border-border-grid rounded-xl">
          <span class="material-symbols-outlined text-[44px] text-on-surface-variant">assignment</span>
          <p class="font-headline-sm text-headline-sm text-on-surface">Aún no has enviado solicitudes</p>
          <p class="ayuda max-w-md">Diseña tu invernadero y pulsa «Enviar solicitud de cotización». Aquí verás cómo va.</p>
          <a href="nuevo-proyecto.html" class="px-4 min-h-[44px] inline-flex items-center rounded-lg bg-primary text-on-primary font-label-md text-label-md font-bold hover:bg-spring-lime">Diseñar mi invernadero</a>
        </div>`;
      return;
    }
    $('lista').innerHTML = arr.map((s) => {
      const p = s.params; const e = ESTADO[s.estado] || ESTADO.Pendiente;
      const cot = s.cotizacionLista; // el servidor dice si ya fue liberada (los precios se piden al abrirla)
      const acciones = [
        cot ? `<button type="button" data-pdf="${esc(s.id)}" class="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-lg bg-primary hover:bg-spring-lime text-on-primary font-label-md text-label-md font-bold"><span class="material-symbols-outlined text-[18px]">picture_as_pdf</span>Ver cotización</button>` : '',
        `<button type="button" data-ver="${esc(s.id)}" class="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-lg border border-border-grid text-on-surface hover:border-primary hover:text-primary font-label-md text-label-md"><span class="material-symbols-outlined text-[18px]">view_in_ar</span>Ver diseño</button>`,
        s.estado === 'Pendiente' ? `<button type="button" data-cancelar="${esc(s.id)}" class="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-lg text-on-surface-variant hover:text-danger-alert hover:bg-danger-alert/10 font-label-md text-label-md"><span class="material-symbols-outlined text-[18px]">close</span>Cancelar solicitud</button>` : '',
      ].join('');
      return `
      <article class="bg-surface-card rounded-xl p-5 border ${cot ? 'border-primary/40' : 'border-border-grid'} shadow-md flex flex-col gap-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="font-headline-sm text-headline-sm text-on-surface">${esc(s.proyecto || 'Mi invernadero')}</h2>
            <span class="text-xs text-on-surface-variant">${esc(s.id)} · ${esc(D.fechaLarga(s.fecha))}</span>
          </div>
          <span class="self-start inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-label-sm ${e.clase}"><span class="material-symbols-outlined text-[16px]">${e.icono}</span>${esc(s.estado)}</span>
        </div>
        <p class="font-body-md text-body-md ${cot ? 'text-spring-lime font-semibold' : 'text-on-surface'}">${esc(cot ? e.texto + ' Descárgala en PDF.' : e.texto)}</p>
        ${s.diseno ? `<p class="ayuda"><b class="text-primary">Diseño a medida</b> · ${s.diseno.naves.length} nave${s.diseno.naves.length > 1 ? 's' : ''} · ${esc(Math.round(s.diseno.naves.reduce((t, n) => t + n.ancho * n.largo, 0)).toLocaleString('es-CO'))} m² · ${esc([...new Set(s.diseno.naves.map((n) => C.NOMBRE_TIPO[n.tipo]))].join(' + '))}</p>` : ''}
        <p class="ayuda">${esc(C.NOMBRE_TIPO[p.tipo] || p.tipo)} · ${esc(p.largo)} × ${esc(p.ancho)} m por nave · ${esc(p.naves)} nave${p.naves > 1 ? 's' : ''} · plástico cal. ${esc(p.calibrePlastico)} · ${p.anchoCanal === '0' ? 'sin canal' : 'canal ' + esc(p.anchoCanal) + ' m'} · ${esc(p.modalidad)}</p>
        ${s.observaciones ? `<p class="ayuda"><b>Tus observaciones:</b> ${esc(s.observaciones)}</p>` : ''}
        <div class="flex flex-wrap gap-2 pt-1">${acciones}</div>
      </article>`;
    }).join('');
  }

  $('lista').addEventListener('click', async (ev) => {
    const pdf = ev.target.closest('[data-pdf]');
    if (pdf) {
      const soltar = AgroLayout.ocupado(pdf);
      const cot = await D.cotizacionDeSolicitud(pdf.dataset.pdf);
      soltar();
      if (!cot) { AgroLayout.toast('Cotización no disponible', 'Puede que la estén actualizando. Intenta en un momento.', 'info'); await D.recargarSolicitudes(); pintar(); return; }
      const ok = AgroPdf.abrir({ cliente: cot.cliente, id: cot.id, fechaIso: cot.fecha, params: cot.params, diseno: cot.diseno, resultado: cot.resultado });
      if (!ok) AgroLayout.toast('Ventana bloqueada', 'Permite las ventanas emergentes de este sitio para ver el PDF.', 'error');
      return;
    }
    const ver = ev.target.closest('[data-ver]');
    if (ver) {
      const s = D.getSolicitud(ver.dataset.ver); if (!s) return;
      D.setBorrador({ params: s.params, cliente: s.proyecto || 'Mi invernadero' });
      location.href = 'nuevo-proyecto.html?borrador=1';
      return;
    }
    const can = ev.target.closest('[data-cancelar]');
    if (can) {
      const s = D.getSolicitud(can.dataset.cancelar); if (!s) return;
      const r = await D.cancelarSolicitud(s.id);
      if (!r.ok) { AgroLayout.toast('No se puede cancelar', r.error, 'info'); await D.recargarSolicitudes(); pintar(); return; }
      pintar(); AgroLayout.refrescarResumen();
      AgroLayout.toast('Solicitud cancelada', s.id, 'info', { texto: 'Deshacer', fn: async () => {
        const x = await D.restaurarSolicitud(s);
        if (!x.ok) AgroLayout.toast('No se pudo recuperar', x.error, 'error');
        pintar(); AgroLayout.refrescarResumen();
      } });
    }
  });
  // layout.js consulta al servidor cada 30 s: si el dueño envía la cotización, la tarjeta se actualiza sola
  document.addEventListener('agro:solicitudes', pintar);

  pintar();
})();

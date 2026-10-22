/* AgroEstructura - Página «Nuevo Proyecto» (cotizador). */
(function () {
  const $ = (id) => document.getElementById(id);
  const C = AgroCalculo, D = AgroDatos, esc = D.esc;
  AgroLayout.montar('cotizador');
  if (!D.getSesion()) return; // exigirSesion ya redirigió

  const DEFECTO = { cliente: '', tipo: 'Tubular', largo: 50, ancho: 24, distancia: 2.5, naves: 2, calibrePlastico: '6', anchoPlastico: '5.80', anchoCanal: '0', calibreCanal: '6', modalidad: 'Todo Costo' };

  let insumosProy = [];   // insumos libres añadidos a este proyecto: { uid, nombre, precio, cantidad }
  let ultimo = null;      // último cálculo: { cliente, params, precios, insumos, resultado }
  let obsoleto = false;   // true si cambiaron los datos después de calcular
  let idActual = null;    // id del presupuesto guardado (si ya se guardó)
  let fechaIso = null;

  const fN = (n) => new Intl.NumberFormat('es-CO').format(n);

  /* ---------- Lectura / escritura del formulario ---------- */
  function leerParams() {
    return {
      tipo: $('tipo').value,
      largo: parseFloat($('largo').value),
      ancho: parseFloat($('ancho').value),
      distancia: parseFloat($('distancia').value),
      naves: parseInt($('naves').value, 10),
      calibrePlastico: $('calPlastico').value,
      anchoPlastico: $('anchoPlastico').value,
      anchoCanal: $('anchoCanal').value,
      calibreCanal: $('calCanal').value,
      modalidad: document.querySelector('input[name=modalidad]:checked').value,
    };
  }
  function escribirParams(p, cliente) {
    $('cliente').value = cliente || '';
    $('tipo').value = p.tipo; $('largo').value = p.largo; $('ancho').value = p.ancho;
    $('distancia').value = p.distancia; $('naves').value = p.naves;
    $('calPlastico').value = p.calibrePlastico; $('anchoPlastico').value = p.anchoPlastico;
    $('anchoCanal').value = p.anchoCanal; $('calCanal').value = p.calibreCanal;
    document.querySelectorAll('input[name=modalidad]').forEach((r) => { r.checked = r.value === p.modalidad; });
  }

  /* ---------- Estado visual ---------- */
  function estado(listo) {
    const e = $('chipEstado');
    if (listo === 'listo') { e.textContent = 'ESTADO: CÁLCULO LISTO'; e.className = 'font-label-sm text-label-sm text-spring-lime font-bold'; }
    else if (listo === 'obsoleto') { e.textContent = 'ESTADO: DATOS MODIFICADOS · VUELVE A CALCULAR'; e.className = 'font-label-sm text-label-sm text-tertiary font-bold'; }
    else { e.textContent = 'ESTADO: PENDIENTE DE CÁLCULO'; e.className = 'font-label-sm text-label-sm text-tertiary font-bold'; }
  }
  const chipId = () => { $('chipId').textContent = idActual || 'BORRADOR'; };
  function mostrarError(msg) { const m = $('msgError'); m.textContent = msg; m.classList.remove('hidden'); }
  function ocultarError() { $('msgError').classList.add('hidden'); }

  /* ---------- Simulador ---------- */
  function actualizarSimulador() {
    const p = leerParams();
    const r = AgroSimulador.dibujar($('lienzo'), p);
    $('txtModelo').textContent = 'Modelo: ' + p.tipo;
    $('badgeModelo').className = 'px-3 py-1 rounded-full font-label-sm text-label-sm flex items-center gap-1.5 self-start ' + (p.tipo === 'Tubular' ? 'bg-secondary-container/20 text-wireframe-blue' : 'bg-tertiary-container/20 text-tertiary');
    $('txtSimulador').textContent = r.mensaje;
  }

  /* ---------- Insumos libres ---------- */
  function refrescarSelectInsumos() {
    const sel = $('selInsumo'); const arr = D.getInsumos();
    if (!arr.length) {
      sel.innerHTML = '<option value="">Sin insumos guardados (créalos en Inventario)</option>';
      $('btnAddInsumo').disabled = true; $('btnAddInsumo').classList.add('opacity-40', 'cursor-not-allowed');
    } else {
      sel.innerHTML = arr.map((i) => `<option value="${esc(i.id)}">${esc(i.nombre)} — ${C.fCOP(i.precio)}</option>`).join('');
      $('btnAddInsumo').disabled = false; $('btnAddInsumo').classList.remove('opacity-40', 'cursor-not-allowed');
    }
  }
  function pintarChips() {
    const cont = $('chipsInsumos');
    if (!insumosProy.length) { cont.innerHTML = ''; return; }
    const MO = leerParams().modalidad !== 'Todo Costo';
    cont.innerHTML = insumosProy.map((i) => `
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-container text-on-surface text-[12px] font-label-sm ${MO ? 'opacity-50' : ''}">
        <span class="w-1.5 h-1.5 rounded-full bg-spring-lime"></span>${esc(fN(i.cantidad))}× ${esc(i.nombre)}
        <button type="button" data-quitar="${esc(i.uid)}" aria-label="Quitar ${esc(i.nombre)}" class="text-on-surface-variant hover:text-danger-alert ml-1">×</button>
      </span>`).join('') + (MO ? '<p class="w-full font-body-sm text-body-sm text-on-surface-variant">En «Solo mano de obra» los insumos no se suman al total.</p>' : '');
  }
  function añadirInsumo() {
    const id = $('selInsumo').value; const cant = parseFloat($('cantInsumo').value);
    const ins = D.getInsumos().find((i) => i.id === id);
    if (!ins) { AgroLayout.toast('Elige un insumo', 'Selecciona un insumo de la lista.', 'info'); return; }
    if (!(cant > 0)) { AgroLayout.toast('Cantidad inválida', 'Escribe una cantidad mayor que 0.', 'error'); return; }
    const ya = insumosProy.find((x) => x.id === ins.id);
    if (ya) ya.cantidad += cant; else insumosProy.push({ uid: D.uid('p'), id: ins.id, nombre: ins.nombre, precio: ins.precio, cantidad: cant });
    pintarChips(); marcarObsoleto();
    AgroLayout.toast('Insumo añadido', `${fN(cant)} × ${ins.nombre}`);
  }

  /* ---------- Tabla de materiales ---------- */
  function pintarBom(res) {
    const cuerpo = $('cuerpoBom');
    if (!res) {
      cuerpo.innerHTML = '<tr><td colspan="4" class="py-8 px-4 text-center text-on-surface-variant italic">Ingresa los parámetros y pulsa «Calcular proyecto».</td></tr>';
      ['txtMateriales', 'txtManoObra', 'txtTotal'].forEach((id) => { $(id).textContent = '—'; });
      return;
    }
    let h = '';
    res.filas.forEach((f) => {
      if (f.tipo === 'seccion') {
        const col = f.color === 'amber' ? 'text-tertiary' : 'text-wireframe-blue';
        h += `<tr class="bg-surface-container-highest/40 font-label-sm text-label-sm ${col}"><td colspan="4" class="py-2 px-4 uppercase font-bold tracking-wider">${esc(f.texto)}</td></tr>`;
      } else {
        h += `<tr class="hover:bg-surface-container/40 transition-colors">
          <td class="py-3 px-4 font-semibold text-on-surface">${esc(f.nombre)}</td>
          <td class="py-3 px-3 text-center font-label-md text-label-md text-on-surface tabular">${esc(fN(f.cant))} ${esc(f.unidad)}</td>
          <td class="py-3 px-4 text-right font-label-md text-label-md text-on-surface-variant tabular">${C.fCOP(f.pu)}</td>
          <td class="py-3 px-4 text-right font-label-md text-label-md tabular ${res.soloManoDeObra ? 'text-on-surface-variant font-normal' : 'text-spring-lime font-bold'}">${res.soloManoDeObra ? 'Lo aporta el cliente' : C.fCOP(f.st)}</td></tr>`;
      }
    });
    if (res.soloManoDeObra) h += '<tr><td colspan="4" class="py-3 px-4 text-center text-tertiary font-semibold bg-surface-container-low">Cálculo «Solo mano de obra»: los materiales los aporta el cliente (las cantidades son de referencia).</td></tr>';
    cuerpo.innerHTML = h;
    $('txtMateriales').textContent = C.fCOP(res.cMat);
    $('txtManoObra').textContent = C.fCOP(res.cObra);
    $('txtTotal').textContent = C.fCOP(res.total);
  }

  /* ---------- Calcular ---------- */
  function calcular() {
    const p = leerParams(); const cliente = $('cliente').value.trim();
    const errores = [];
    if (!cliente) errores.push('Escribe el nombre del cliente o del proyecto.');
    errores.push(...C.validar(p));
    if (errores.length) {
      mostrarError(errores.join(' '));
      AgroLayout.toast('Revisa los datos', errores[0], 'error');
      if (!cliente) $('cliente').focus();
      return;
    }
    ocultarError();
    const precios = D.getPrecios();
    const extras = insumosProy.map((i) => ({ nombre: i.nombre, precio: i.precio, cantidad: i.cantidad }));
    const res = C.calcular(p, precios, extras);
    ultimo = { cliente, params: p, precios, insumos: extras, resultado: res };
    obsoleto = false;
    pintarBom(res); estado('listo'); actualizarSimulador();
    $('txtFecha').textContent = D.fechaLarga(fechaIso);
    AgroLayout.toast('Presupuesto calculado', `${cliente}: ${fN(res.area)} m² configurados.`);
  }
  function marcarObsoleto() {
    if (ultimo && !obsoleto) { obsoleto = true; estado('obsoleto'); }
  }

  /* ---------- Guardar y exportar ---------- */
  function guardar() {
    if (!ultimo) { AgroLayout.toast('Calcula primero', 'Pulsa «Calcular proyecto» antes de guardar en el historial.', 'info'); return; }
    if (obsoleto) { AgroLayout.toast('Datos modificados', 'Vuelve a calcular antes de guardar para que el presupuesto coincida.', 'info'); return; }
    const datos = { cliente: ultimo.cliente, params: ultimo.params, insumos: ultimo.insumos, precios: ultimo.precios, resultado: ultimo.resultado };
    if (idActual) datos.id = idActual;
    const proy = D.guardarProyecto(datos);
    if (!proy) { AgroLayout.toast('No se pudo guardar', 'El almacenamiento del navegador está lleno o bloqueado.', 'error'); return; }
    idActual = proy.id; fechaIso = proy.fecha; chipId(); AgroLayout.refrescarResumen();
    try { history.replaceState(null, '', 'nuevo-proyecto.html?id=' + encodeURIComponent(proy.id)); } catch (e) {}
    AgroLayout.toast('Presupuesto guardado', `${proy.id} · lo ves en el Centro Principal.`);
  }

  function exportarPdf() {
    if (!ultimo) { AgroLayout.toast('Calcula primero', 'No hay un presupuesto para exportar.', 'info'); return; }
    if (obsoleto) { AgroLayout.toast('Datos modificados', 'Vuelve a calcular antes de exportar.', 'info'); return; }
    const u = ultimo, p = u.params, r = u.resultado;
    const filas = r.filas.map((f) => f.tipo === 'seccion'
      ? `<tr><td colspan="4" style="background:#eee;font-weight:bold;text-transform:uppercase;font-size:11px">${esc(f.texto)}</td></tr>`
      : `<tr><td>${esc(f.nombre)}</td><td style="text-align:center">${esc(fN(f.cant))} ${esc(f.unidad)}</td><td style="text-align:right">${C.fCOP(f.pu)}</td><td style="text-align:right">${r.soloManoDeObra ? 'Lo aporta el cliente' : C.fCOP(f.st)}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Cotización ${esc(u.cliente)}</title>
<style>body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px}h1{margin:0 0 4px;font-size:22px}h2{font-size:14px;margin:22px 0 8px;border-bottom:2px solid #22c55e;padding-bottom:4px}
table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #bbb;padding:6px 8px}th{background:#f1f5f9;text-align:left}.meta td{border:none;padding:2px 8px 2px 0}
.tot{margin-top:14px;margin-left:auto;width:320px;font-size:13px}.tot td{border:none;padding:3px 0}.gran td{font-size:16px;font-weight:bold;border-top:2px solid #111;padding-top:8px}
.pie{margin-top:28px;font-size:11px;color:#555}</style></head><body>
<h1>AgroEstructura V.2 PRO — Cotización</h1>
<table class="meta"><tr><td><b>Cliente / proyecto:</b></td><td>${esc(u.cliente)}</td><td><b>Fecha:</b></td><td>${esc(D.fechaLarga(fechaIso))}</td></tr>
<tr><td><b>Presupuesto:</b></td><td>${esc(idActual || 'Borrador (sin guardar)')}</td><td><b>Modalidad:</b></td><td>${esc(p.modalidad)}</td></tr></table>
<h2>Configuración estructural</h2>
<table><tr><th>Estructura</th><th>Largo</th><th>Ancho</th><th>Naves</th><th>Dist. postes</th><th>Plástico</th><th>Canal</th></tr>
<tr><td>${esc(C.NOMBRE_TIPO[p.tipo])}</td><td>${p.largo} m</td><td>${p.ancho} m</td><td>${p.naves}</td><td>${p.distancia} m</td><td>Cal. ${esc(p.calibrePlastico)} · ${esc(p.anchoPlastico)} m</td><td>${p.anchoCanal === '0' ? 'No requiere' : esc(p.anchoCanal) + ' m · Cal. ' + esc(p.calibreCanal)}</td></tr></table>
<h2>Desglose de materiales y costos</h2>
<table><tr><th>Ítem / componente</th><th style="text-align:center">Cant.</th><th style="text-align:right">Vr. unitario</th><th style="text-align:right">Subtotal (COP)</th></tr>${filas}</table>
<table class="tot"><tr><td>Costo materiales</td><td style="text-align:right">${C.fCOP(r.cMat)}</td></tr><tr><td>Mano de obra</td><td style="text-align:right">${C.fCOP(r.cObra)}</td></tr>
<tr class="gran"><td>TOTAL PRESUPUESTO</td><td style="text-align:right">${C.fCOP(r.total)}</td></tr></table>
<p class="pie">Valores en pesos colombianos (COP), calculados con los precios del inventario a la fecha de esta cotización. Es un estimado y puede variar.</p>
<script>window.onload=function(){window.print();}<\/script></body></html>`;
    const w = window.open('', '_blank');
    if (!w) { AgroLayout.toast('Ventana bloqueada', 'Permite las ventanas emergentes de este sitio para exportar el PDF.', 'error'); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  /* ---------- Limpiar ---------- */
  function limpiar() {
    escribirParams(DEFECTO, '');
    insumosProy = []; ultimo = null; obsoleto = false; idActual = null; fechaIso = null;
    pintarChips(); pintarBom(null); estado('pendiente'); chipId(); ocultarError(); actualizarSimulador();
    $('txtFecha').textContent = D.fechaLarga();
    try { history.replaceState(null, '', 'nuevo-proyecto.html'); } catch (e) {}
  }

  /* ---------- Eventos ---------- */
  $('formCalculo').addEventListener('submit', (e) => { e.preventDefault(); calcular(); });
  $('formCalculo').addEventListener('input', () => { actualizarSimulador(); marcarObsoleto(); ocultarError(); pintarChips(); });
  $('formCalculo').addEventListener('change', () => { actualizarSimulador(); marcarObsoleto(); pintarChips(); });
  $('btnAddInsumo').addEventListener('click', añadirInsumo);
  $('chipsInsumos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-quitar]'); if (!b) return;
    insumosProy = insumosProy.filter((i) => i.uid !== b.dataset.quitar); pintarChips(); marcarObsoleto();
  });
  $('btnGuardar').addEventListener('click', guardar);
  $('btnPdf').addEventListener('click', exportarPdf);
  $('btnLimpiar').addEventListener('click', limpiar);

  /* ---------- Arranque: ?id= (abrir guardado), ?borrador=1 (chat / portafolio), ?tipo= (inicio) ---------- */
  refrescarSelectInsumos();
  $('txtFecha').textContent = D.fechaLarga();
  const q = new URLSearchParams(location.search);
  if (q.get('id')) {
    const pr = D.getProyecto(q.get('id'));
    if (pr) {
      escribirParams(pr.params, pr.cliente);
      insumosProy = (pr.insumos || []).map((i) => ({ uid: D.uid('p'), id: null, nombre: i.nombre, precio: i.precio, cantidad: i.cantidad }));
      idActual = pr.id; fechaIso = pr.fecha;
      ultimo = { cliente: pr.cliente, params: pr.params, precios: pr.precios, insumos: pr.insumos || [], resultado: pr.resultado };
      pintarChips(); pintarBom(pr.resultado); estado('listo'); chipId(); $('txtFecha').textContent = D.fechaLarga(pr.fecha);
    } else {
      AgroLayout.toast('No encontré ese presupuesto', 'Puede que lo hayas eliminado.', 'error');
    }
  } else if (q.get('borrador')) {
    const b = D.tomarBorrador();
    if (b && b.params) {
      escribirParams(Object.assign({}, DEFECTO, b.params), b.cliente || '');
      if (b.auto && (b.cliente || '').trim()) { actualizarSimulador(); calcular(); }
      else AgroLayout.toast('Datos cargados', 'Revisa los valores y pulsa «Calcular proyecto».', 'info');
    }
  } else if (q.get('tipo')) {
    const t = q.get('tipo');
    if (t === 'tubular') $('tipo').value = 'Tubular';
    if (t === 'guadua') $('tipo').value = 'Guadua';
    if (t === 'mano-obra') document.querySelector('input[name=modalidad][value="Mano de Obra"]').checked = true;
  }
  actualizarSimulador(); pintarChips();
  window.addEventListener('resize', actualizarSimulador);
})();

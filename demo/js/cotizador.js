/*
 * AgroEstructura - Página «Nuevo Proyecto» (cotizador).
 * Dueño  : calcula con precios, guarda presupuestos, exporta PDF y envía la cotización al cliente.
 * Cliente: configura su invernadero, ve el diseño y la lista de materiales SIN precios, y envía una solicitud.
 */
(async function () {
  const $ = (id) => document.getElementById(id);
  const C = AgroCalculo, D = AgroDatos, esc = D.esc;
  if (!(await AgroLayout.montar('cotizador'))) return; // sin sesión o sin servidor: ya redirigió o avisó

  const dueno = D.esDueno();
  const invitado = D.getRol() === D.ROLES.INVITADO;

  const DEFECTO = { cliente: '', tipo: 'Tubular', largo: 50, ancho: 24, distancia: 2.5, naves: 2, calibrePlastico: '6', anchoPlastico: '5.80', anchoCanal: '0', calibreCanal: '6', modalidad: 'Todo Costo' };

  let insumosProy = [];   // insumos libres añadidos a este proyecto (solo dueño): { uid, nombre, precio, cantidad }
  let ultimo = null;      // último cálculo: { cliente, params, precios, insumos, resultado }
  let obsoleto = false;   // true si cambiaron los datos después de calcular
  let idActual = null;    // id del presupuesto guardado (si ya se guardó)
  let fechaIso = null;
  let idSolicitud = null; // solicitud del cliente que el dueño está cotizando
  let guardadoAlDia = false; // el presupuesto guardado coincide con lo que se ve
  let cerrarAvisoError = null; // cierra el aviso «Revisa los datos» cuando el cálculo ya sale bien
  let diseno = null;      // diseño «a mi medida» (plano + 3D). null = naves iguales con el formulario

  const fN = (n) => new Intl.NumberFormat('es-CO').format(n);

  /* ---------- Lectura / escritura del formulario ---------- */
  /** Parámetros del cálculo. Con un diseño a medida, las medidas salen del diseño (resumen si las naves son distintas). */
  function leerParams() {
    const p = leerFormulario();
    if (!diseno) return p;
    const simple = AgroDisenador.comoSimple(diseno);
    if (simple) return Object.assign(p, simple);
    const nav = diseno.naves, cuenta = {};
    nav.forEach((x) => { cuenta[x.tipo] = (cuenta[x.tipo] || 0) + 1; });
    return Object.assign(p, {
      tipo: Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a])[0],
      largo: Math.max(...nav.map((x) => x.largo)), ancho: Math.round((nav.reduce((t, x) => t + x.ancho, 0) / nav.length) * 100) / 100,
      naves: nav.length, distancia: diseno.distancia, anchoCanal: diseno.canales.some(Boolean) ? diseno.anchoCanal : '0',
    });
  }
  function leerFormulario() {
    return {
      tipo: $('tipo').value,
      largo: parseFloat($('largo').value),
      ancho: parseFloat($('ancho').value),
      distancia: parseFloat($('distancia').value),
      naves: parseFloat($('naves').value),
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
    const t = dueno
      ? { listo: 'ESTADO: CÁLCULO LISTO', obsoleto: 'ESTADO: DATOS MODIFICADOS · VUELVE A CALCULAR', pendiente: 'ESTADO: PENDIENTE DE CÁLCULO' }
      : { listo: 'ESTADO: DISEÑO LISTO', obsoleto: 'ESTADO: CAMBIASTE DATOS · ACTUALIZA LOS MATERIALES', pendiente: 'ESTADO: EN DISEÑO' };
    e.textContent = t[listo] || t.pendiente;
    e.className = 'font-label-sm text-label-sm font-bold ' + (listo === 'listo' ? 'text-spring-lime' : 'text-tertiary');
  }
  const chipId = () => { $('chipId').textContent = idActual || 'BORRADOR'; };
  function mostrarError(msg) { const m = $('msgError'); m.textContent = msg; m.classList.remove('hidden'); }
  function ocultarError() { $('msgError').classList.add('hidden'); }

  /** Marca (o limpia) el error de un campo: borde rojo, mensaje debajo y aria-invalid. */
  function errorCampo(id, msg) {
    const input = $(id), p = $('err-' + id);
    if (!input || !p) return;
    const caja = input.closest('.campo') || input;
    caja.classList.toggle('con-error', !!msg);
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    p.textContent = msg || ''; p.classList.toggle('hidden', !msg);
  }
  const CAMPOS = ['cliente', 'largo', 'ancho', 'distancia', 'naves'];
  const limpiarErroresCampos = () => CAMPOS.forEach((id) => errorCampo(id, ''));

  /** Botón Guardar (dueño): muestra si el presupuesto ya está guardado. */
  function botonGuardar(modo) {
    if (!dueno) return;
    guardadoAlDia = modo === 'guardado';
    const txt = { nuevo: 'Guardar presupuesto', guardado: 'Guardado', cambios: 'Guardar cambios' }[modo];
    $('txtGuardar').textContent = txt;
    $('iconoGuardar').textContent = modo === 'guardado' ? 'check_circle' : 'save';
    botonLiberar();
  }

  /** Resumen de los parámetros usados, visible junto al resultado (no hay que recordarlos). */
  function pintarResumen(p, cliente) {
    const el = $('txtResumen');
    if (!p) { el.classList.add('hidden'); el.textContent = ''; return; }
    if (diseno) {
      const rd = AgroDisenador.resumen(diseno);
      el.innerHTML = `<b>${esc(cliente)}</b> · Diseño a medida · ${rd.naves} nave${rd.naves > 1 ? 's' : ''} · ${esc(fN(Math.round(rd.area)))} m² · ${esc(rd.tipos.join(' + '))} · plástico cal. ${esc(p.calibrePlastico)} (${esc(p.anchoPlastico)} m) · <b>${esc(p.modalidad)}</b>`;
      el.classList.remove('hidden');
      return;
    }
    const canal = p.anchoCanal === '0' ? 'sin canal' : `canal ${p.anchoCanal} m`;
    el.innerHTML = `<b>${esc(cliente)}</b> · ${esc(C.NOMBRE_TIPO[p.tipo] || p.tipo)} · ${esc(fN(p.largo))} × ${esc(fN(p.ancho))} m por nave · ${esc(p.naves)} nave${p.naves > 1 ? 's' : ''} · postes cada ${esc(fN(p.distancia))} m · plástico cal. ${esc(p.calibrePlastico)} (${esc(p.anchoPlastico)} m) · ${esc(canal)} · <b>${esc(p.modalidad)}</b>`;
    el.classList.remove('hidden');
  }

  /* ---------- Simulador ---------- */
  /* Vista 3D (js/estructura3d.js se carga como módulo; puede llegar un poco después que este archivo) */
  let vista3d = null;
  function iniciar3D() {
    if (vista3d || !window.AgroVista3D) return;
    $('marco3d').classList.remove('hidden');
    vista3d = AgroVista3D.crear($('vista3d'));
    if (!vista3d) { $('marco3d').classList.add('hidden'); return; } // sin WebGL: queda el dibujo 2D
    $('marco2d').classList.add('hidden');
    $('btnVista3d').addEventListener('click', () => vista3d.vistaInicial());
    $('btnCubierta3d').addEventListener('click', (e) => {
      const b = e.currentTarget, ver = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(ver)); b.title = ver ? 'Ver solo la estructura (sin plástico ni malla)' : 'Poner la cubierta';
      vista3d.cubierta(ver);
    });
    actualizarSimulador();
  }
  if (window.AgroVista3D) iniciar3D(); else document.addEventListener('agro:3d-listo', iniciar3D, { once: true });

  function actualizarSimulador() {
    const p = leerParams();
    if (vista3d) {
      vista3d.actualizar(diseno ? { diseno } : p);
      const lim = C.LIMITE_DISTANCIA[p.tipo];
      const aviso = lim && p.distancia > lim ? `Alerta técnica: la distancia entre postes supera el máximo para ${C.NOMBRE_TIPO[p.tipo]} (${lim} m).` : '';
      $('aviso3d').textContent = aviso; $('aviso3d').classList.toggle('hidden', !aviso);
    }
    const r = AgroSimulador.dibujar($('lienzo'), p);
    $('txtModelo').textContent = 'Modelo: ' + (C.NOMBRE_TIPO[p.tipo] || p.tipo);
    $('badgeModelo').className = 'px-3 py-1 rounded-full font-label-sm text-label-sm flex items-center gap-1.5 self-start ' + (p.tipo === 'Tubular' ? 'bg-secondary-container/20 text-wireframe-blue' : 'bg-tertiary-container/20 text-tertiary');
    $('txtSimulador').textContent = r.mensaje;
  }

  /* ---------- Insumos libres (solo dueño) ---------- */
  function refrescarSelectInsumos() {
    if (!dueno) return;
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
    if (!cont) return;
    if (!insumosProy.length) { cont.innerHTML = ''; return; }
    const MO = leerParams().modalidad !== 'Todo Costo';
    cont.innerHTML = insumosProy.map((i) => `
      <span class="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-0.5 rounded-md bg-surface-container text-on-surface text-[12px] font-label-sm ${MO ? 'opacity-50' : ''}">
        <span class="w-1.5 h-1.5 rounded-full bg-spring-lime"></span>${esc(fN(i.cantidad))}× ${esc(i.nombre)}
        <button type="button" data-quitar="${esc(i.uid)}" aria-label="Quitar ${esc(i.nombre)}" class="btn-chip text-on-surface-variant hover:text-danger-alert hover:bg-danger-alert/10 ml-0.5"><span class="material-symbols-outlined text-[16px]">close</span></button>
      </span>`).join('') + (MO ? '<p class="w-full font-body-sm text-body-sm text-on-surface-variant">En «Solo mano de obra» los insumos no se suman al total.</p>' : '');
  }
  function añadirInsumo() {
    const id = $('selInsumo').value; const cant = parseFloat($('cantInsumo').value);
    const ins = D.getInsumos().find((i) => String(i.id) === id);
    if (!ins) { AgroLayout.toast('Elige un insumo', 'Selecciona un insumo de la lista.', 'info'); return; }
    if (!(cant > 0)) { AgroLayout.toast('Cantidad inválida', 'Escribe una cantidad mayor que 0.', 'error'); return; }
    const ya = insumosProy.find((x) => x.id === ins.id);
    if (ya) ya.cantidad += cant; else insumosProy.push({ uid: D.uid('p'), id: ins.id, nombre: ins.nombre, precio: ins.precio, cantidad: cant });
    pintarChips(); marcarObsoleto();
    AgroLayout.toast('Insumo añadido', `${fN(cant)} × ${ins.nombre}`);
  }

  /* ---------- Tabla de materiales ---------- */
  const COLUMNAS = dueno ? 4 : 2;
  function filaMensaje(texto, clase) {
    return `<tr><td colspan="${COLUMNAS}" class="py-8 px-4 text-center ${clase || 'text-on-surface-variant italic'}">${texto}</td></tr>`;
  }
  /** Lista de materiales cuando el precio está pendiente (diseño a medida o tipo sin fórmula). */
  function pintarPendiente(motivo) {
    $('cuerpoBom').innerHTML = filaMensaje(dueno ? esc(motivo) : 'Diseño a medida: la lista de materiales y el valor te llegan con la cotización.', 'text-tertiary font-semibold');
    ['txtMateriales', 'txtManoObra', 'txtTotal'].map($).filter(Boolean).forEach((el) => { el.textContent = 'Pendiente'; });
  }
  function pintarBom(res) {
    const cuerpo = $('cuerpoBom');
    const totales = ['txtMateriales', 'txtManoObra', 'txtTotal'].map($).filter(Boolean);
    if (!res) {
      cuerpo.innerHTML = filaMensaje(dueno ? 'Ingresa los parámetros y pulsa «Calcular proyecto».' : 'Configura tu invernadero y pulsa «Ver materiales y diseño».');
      totales.forEach((el) => { el.textContent = '—'; });
      pintarResumen(null);
      return;
    }
    // El cliente nunca recibe precios en pantalla; si Libardo decide no mostrar cantidades, solo ve el resumen.
    if (!dueno && !D.CLIENTE_VE_CANTIDADES) {
      cuerpo.innerHTML = filaMensaje('La lista de materiales llegará con tu cotización.', 'text-on-surface-variant');
      return;
    }
    let h = '';
    res.filas.forEach((f) => {
      if (f.tipo === 'seccion') {
        const col = f.color === 'amber' ? 'text-tertiary' : 'text-wireframe-blue';
        h += `<tr class="bg-surface-container-highest/40 font-label-sm text-label-sm ${col}"><td colspan="${COLUMNAS}" class="py-2 px-4 uppercase font-bold tracking-wider">${esc(f.texto)}</td></tr>`;
      } else {
        h += `<tr class="hover:bg-surface-container/40 transition-colors">
          <td class="py-3 px-4 font-semibold text-on-surface">${esc(f.nombre)}</td>
          <td class="py-3 px-3 text-center font-label-md text-label-md text-on-surface tabular">${esc(fN(f.cant))} ${esc(f.unidad)}</td>${dueno ? `
          <td class="py-3 px-4 text-right font-label-md text-label-md text-on-surface-variant tabular">${C.fCOP(f.pu)}</td>
          <td class="py-3 px-4 text-right font-label-md text-label-md tabular ${res.soloManoDeObra ? 'text-on-surface-variant font-normal' : 'text-spring-lime font-bold'}">${res.soloManoDeObra ? 'Lo aporta el cliente' : C.fCOP(f.st)}</td>` : ''}</tr>`;
      }
    });
    if (res.soloManoDeObra) {
      h += `<tr><td colspan="${COLUMNAS}" class="py-3 px-4 text-center text-tertiary font-semibold bg-surface-container-low">${dueno
        ? 'Cálculo «Solo mano de obra»: los materiales los aporta el cliente (las cantidades son de referencia).'
        : '«Solo mano de obra»: tú compras estos materiales; las cantidades son de referencia.'}</td></tr>`;
    }
    if (!dueno) {
      // En vez de columnas de precio: qué incluye el valor que le enviaremos
      h += `<tr><td colspan="${COLUMNAS}" class="py-3 px-4 bg-surface-container-low"><p class="ayuda flex gap-2 items-start"><span class="material-symbols-outlined text-primary text-[18px]">verified</span><span><b class="text-on-surface">Observación:</b> el valor de tu cotización ${esc(C.textoIncluye(res.soloManoDeObra).replace(/^Incluye/, 'incluye'))}</span></p></td></tr>`;
    }
    cuerpo.innerHTML = h;
    if (dueno) {
      $('txtMateriales').textContent = C.fCOP(res.cMat);
      $('txtManoObra').textContent = C.fCOP(res.cObra);
      $('txtTotal').textContent = C.fCOP(res.total);
    }
  }

  /** Marca en rojo los campos con error y lleva el foco al primero. */
  function mostrarErrores(errores) {
    const porCampo = {};
    errores.forEach((e) => { if (!porCampo[e.campo]) porCampo[e.campo] = e.mensaje; });
    Object.keys(porCampo).forEach((id) => errorCampo(id, porCampo[id]));
    const n = Object.keys(porCampo).filter((id) => CAMPOS.includes(id)).length;
    mostrarError(n === 0 ? errores[0].mensaje : (n === 1 ? 'Hay 1 campo por corregir (marcado en rojo).' : `Hay ${n} campos por corregir (marcados en rojo).`));
    if (cerrarAvisoError) cerrarAvisoError();
    cerrarAvisoError = AgroLayout.toast('Revisa los datos', errores[0].mensaje, 'error');
    const primero = CAMPOS.find((id) => porCampo[id]);
    if (primero) $(primero).focus();
  }

  /* ---------- Calcular: valida aquí (aviso inmediato) y calcula en el SERVIDOR. Devuelve true si salió bien ---------- */
  let turnoCalculo = 0; // si se piden dos cálculos seguidos, solo cuenta el último
  async function calcular(irAlResultado) {
    const p = leerParams(); const cliente = $('cliente').value.trim();
    const errores = [];
    if (!cliente) errores.push({ campo: 'cliente', mensaje: dueno ? 'Escribe el nombre del cliente o del proyecto.' : 'Escribe un nombre para tu proyecto.' });
    errores.push(...C.validarCampos(p));
    limpiarErroresCampos();
    if (errores.length) { mostrarErrores(errores); return false; }
    ocultarError();
    const turno = ++turnoCalculo;
    const soltar = AgroLayout.ocupado(document.querySelector('#formCalculo button[type=submit]'));
    const r = await D.calcular(p, dueno ? insumosProy : [], diseno);
    soltar();
    if (turno !== turnoCalculo) return false;
    if (!r.ok) { mostrarErrores(r.errores); return false; }
    if (cerrarAvisoError) { cerrarAvisoError(); cerrarAvisoError = null; }
    const copiaDiseno = diseno ? JSON.parse(JSON.stringify(diseno)) : null;
    if (r.pendiente) {
      // Diseño a medida o tipo sin fórmula: no hay precio automático (fórmulas pendientes). El cliente sí puede enviarlo.
      ultimo = { cliente, params: p, insumos: [], resultado: null, pendiente: r.motivo, diseno: copiaDiseno };
      obsoleto = false;
      pintarPendiente(r.motivo); pintarResumen(p, cliente); estado('listo'); actualizarSimulador(); botonGuardar(idActual ? 'cambios' : 'nuevo');
      if (irAlResultado === true && window.innerWidth < 1280) $('tarjetaBom').scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (irAlResultado !== 'silencio') AgroLayout.toast(dueno ? 'Precio pendiente' : 'Diseño listo', dueno ? r.motivo : 'Envía tu solicitud: revisamos tu diseño y te enviamos la cotización.', 'info');
      return true;
    }
    const res = r.resultado;
    ultimo = { cliente, params: p, insumos: insumosProy.slice(), resultado: res, diseno: copiaDiseno };
    obsoleto = false;
    pintarBom(res); pintarResumen(p, cliente); estado('listo'); actualizarSimulador();
    botonGuardar(idActual ? 'cambios' : 'nuevo');
    $('txtFecha').textContent = D.fechaLarga(fechaIso);
    // En celular y tablet el resultado queda debajo del simulador: se baja hasta él
    if (irAlResultado === true && window.innerWidth < 1280) $('tarjetaBom').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (irAlResultado !== 'silencio') AgroLayout.toast(dueno ? 'Presupuesto calculado' : 'Diseño listo', `${cliente}: ${fN(res.area)} m² configurados.`);
    return true;
  }
  function marcarObsoleto() {
    if (!dueno) mostrarEnviar();
    if (ultimo && !obsoleto) { obsoleto = true; estado('obsoleto'); botonGuardar(idActual ? 'cambios' : 'nuevo'); }
  }

  /* ---------- Dueño: guardar, exportar y enviar al cliente ---------- */
  async function guardar() {
    if (!ultimo) { AgroLayout.toast('Calcula primero', 'Pulsa «Calcular proyecto» antes de guardar.', 'info'); return; }
    if (ultimo.pendiente) { AgroLayout.toast('Precio pendiente', 'Este diseño todavía no tiene fórmula de precios, así que no se puede guardar un total.', 'info'); return; }
    if (obsoleto) { AgroLayout.toast('Datos modificados', 'Vuelve a calcular antes de guardar para que el presupuesto coincida.', 'info'); return; }
    const soltar = AgroLayout.ocupado($('btnGuardar'));
    // El servidor vuelve a calcular con los precios actuales y guarda el detalle con esos precios
    const r = await D.guardarProyecto({ id: idActual, cliente: ultimo.cliente, params: ultimo.params, diseno: ultimo.diseno, insumos: ultimo.insumos, idSolicitud });
    soltar();
    if (!r.ok) { AgroLayout.toast('No se pudo guardar', r.error, 'error'); return; }
    const proy = r.proyecto;
    if (proy.resultado.total !== ultimo.resultado.total) AgroLayout.toast('Precios actualizados', 'Algún precio cambió desde que calculaste; se guardó con los precios de hoy.', 'info');
    ultimo.resultado = proy.resultado; pintarBom(proy.resultado);
    idActual = proy.id; fechaIso = proy.fecha; chipId(); botonGuardar('guardado');
    AgroLayout.refrescarResumen(); pintarBanner();
    try { history.replaceState(null, '', 'nuevo-proyecto.html?id=' + encodeURIComponent(proy.id)); } catch (e) {}
    AgroLayout.toast('Presupuesto guardado', proy.visibleCliente
      ? `${proy.id} · el cliente ya ve esta versión actualizada.`
      : `${proy.id} · lo ves en el Centro Principal.`);
  }

  /** interno = false: PDF para el cliente (solo el valor total). interno = true: con precios por material. */
  function exportarPdf(interno) {
    if (!ultimo) { AgroLayout.toast('Calcula primero', 'No hay un presupuesto para exportar.', 'info'); return; }
    if (obsoleto) { AgroLayout.toast('Datos modificados', 'Vuelve a calcular antes de exportar.', 'info'); return; }
    if (ultimo.pendiente) { AgroLayout.toast('Precio pendiente', 'Todavía no hay un valor para poner en el PDF.', 'info'); return; }
    const ok = AgroPdf.abrir({ cliente: ultimo.cliente, id: idActual, fechaIso, params: ultimo.params, diseno: ultimo.diseno, resultado: ultimo.resultado, interno: interno === true });
    if (!ok) AgroLayout.toast('Ventana bloqueada', 'Permite las ventanas emergentes de este sitio para exportar el PDF.', 'error');
  }

  /** Botón «Enviar al cliente»: solo aparece si el presupuesto viene de una solicitud. */
  function botonLiberar() {
    const b = $('btnLiberar'); if (!b) return;
    b.classList.toggle('hidden', !idSolicitud); b.classList.toggle('flex', !!idSolicitud);
    const pr = idActual ? D.getProyecto(idActual) : null;
    const visible = !!(pr && pr.visibleCliente);
    $('txtLiberar').textContent = visible ? 'Retirar del cliente' : 'Enviar al cliente';
    $('iconoLiberar').textContent = visible ? 'unpublished' : 'outgoing_mail';
  }
  async function liberar() {
    if (!idSolicitud) return;
    if (!idActual || !guardadoAlDia) { AgroLayout.toast('Guarda primero', 'Guarda el presupuesto para enviar exactamente lo que ves.', 'info'); return; }
    const pr = D.getProyecto(idActual); const sol = D.getSolicitud(idSolicitud);
    const visible = !(pr && pr.visibleCliente);
    const soltar = AgroLayout.ocupado($('btnLiberar'));
    const r = await D.liberarCotizacion(idActual, visible);
    soltar();
    if (!r.ok) { AgroLayout.toast('No se pudo enviar', r.error, 'error'); return; }
    botonLiberar(); pintarBanner(); AgroLayout.refrescarResumen();
    const nombre = sol ? sol.nombre : 'El cliente';
    if (visible) {
      AgroLayout.toast('Cotización enviada', `${nombre} ya la puede ver en «Mis solicitudes». Si quieres, mándasela también con «Enviar por correo».`, 'ok', { texto: 'Deshacer', fn: async () => { await D.liberarCotizacion(idActual, false); botonLiberar(); pintarBanner(); } });
    } else {
      AgroLayout.toast('Cotización retirada', `${nombre} ya no la ve.`, 'info');
    }
  }

  /** Envía la cotización al correo del cliente (el servidor arma el correo SIN precios por material). */
  async function enviarPorCorreo() {
    if (!idActual) return;
    const soltar = AgroLayout.ocupado($('btnCorreo'));
    const r = await D.enviarCorreo(idActual);
    soltar();
    if (!r.ok) { AgroLayout.toast('No se pudo enviar el correo', r.error, 'error'); return; }
    if (r.modo === 'prueba') AgroLayout.toast('Correo guardado (modo prueba)', 'Aún no hay cuenta de correo configurada: el correo quedó como archivo en backend/correos_salida. Configúrala en backend/.env para enviarlo de verdad.', 'info');
    else AgroLayout.toast('Correo enviado', `La cotización se envió a ${r.para}.`);
  }

  /** Enlace de WhatsApp al cliente (wa.me), con el número colombiano si tiene 10 dígitos. */
  function enlaceWhatsApp(sol, texto) {
    let tel = String(sol.telefono || '').replace(/\D/g, '');
    if (tel.length === 10) tel = '57' + tel;
    return tel.length >= 11 ? `https://wa.me/${tel}?text=${encodeURIComponent(texto)}` : '';
  }
  /** Aviso con los datos de la solicitud que se está cotizando. */
  function pintarBanner() {
    const el = $('bannerSolicitud'); if (!el) return;
    const sol = idSolicitud ? D.getSolicitud(idSolicitud) : null;
    if (!sol) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    const enviada = sol.estado === 'Cotizada';
    // Al cliente solo se le comunica el valor TOTAL (nunca el precio de cada material)
    const pr = idActual ? D.getProyecto(idActual) : null;
    const total = pr ? ` por un valor total de ${C.fCOP(pr.resultado.total)}` : '';
    const wa = enlaceWhatsApp(sol, enviada
      ? `Hola ${sol.nombre}, tu cotización ${sol.id}${total} ya está lista. ${pr ? C.textoIncluye(pr.resultado.soloManoDeObra) + ' ' : ''}Puedes verla y descargarla en AgroEstructuras, en «Mis solicitudes».`
      : `Hola ${sol.nombre}, recibimos tu solicitud ${sol.id}. Estamos preparando tu cotización.`);
    el.innerHTML = `
      <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div class="flex flex-col gap-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="material-symbols-outlined text-tertiary text-[20px]">assignment</span>
            <span class="font-label-md text-label-md text-tertiary">SOLICITUD ${esc(sol.id)}</span>
            <span class="px-2 py-0.5 rounded-full border text-xs font-label-sm ${enviada ? 'bg-primary/10 text-spring-lime border-primary/30' : 'bg-secondary-container/20 text-wireframe-blue border-wireframe-blue/30'}">${esc(enviada ? 'Enviada al cliente' : sol.estado)}</span>
          </div>
          <p class="font-body-md text-body-md text-on-surface"><b>${esc(sol.nombre)}</b>${sol.ciudad ? ' · ' + esc(sol.ciudad) : ''} · ${esc(sol.telefono || 'sin teléfono')} · <a class="underline hover:text-primary" href="mailto:${esc(sol.correo)}">${esc(sol.correo)}</a></p>
          ${sol.observaciones ? `<p class="ayuda"><b>Observaciones:</b> ${esc(sol.observaciones)}</p>` : '<p class="ayuda">Sin observaciones.</p>'}
        </div>
        <div class="shrink-0 flex flex-wrap gap-2">
          ${enviada ? `<button type="button" id="btnCorreo" title="Envía al correo del cliente el valor total y lo que incluye (sin precios por material)" class="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-lg border border-primary/40 text-spring-lime hover:bg-primary/10 font-label-md text-label-md"><span class="material-symbols-outlined text-[18px]">mail</span>Enviar por correo</button>` : ''}
          ${wa ? `<a href="${esc(wa)}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-lg border border-primary/40 text-spring-lime hover:bg-primary/10 font-label-md text-label-md"><span class="material-symbols-outlined text-[18px]">chat</span>${enviada ? 'Avisar por WhatsApp' : 'Escribir por WhatsApp'}</a>` : ''}
        </div>
      </div>`;
    el.classList.remove('hidden');
  }

  /* ---------- Cliente: enviar la solicitud de cotización ---------- */
  function mostrarEnviar() {
    const a = $('zonaEnviar'), b = $('zonaEnviada'); if (!a || !b) return;
    a.classList.remove('hidden'); b.classList.add('hidden'); b.classList.remove('flex');
  }
  async function enviarSolicitud() {
    const soltar = AgroLayout.ocupado($('btnEnviar'));
    if (!(await calcular('silencio'))) { soltar(); return; }
    const observaciones = $('observaciones').value;
    if (invitado) {
      // Guarda el diseño y lo recupera después de crear la cuenta
      D.setBorrador({ params: ultimo.params, cliente: ultimo.cliente, observaciones, diseno: ultimo.diseno });
      location.href = 'acceso.html?motivo=solicitud&volver=' + encodeURIComponent('nuevo-proyecto.html?borrador=1');
      return;
    }
    const r = await D.crearSolicitud({ params: ultimo.params, diseno: ultimo.diseno, proyecto: ultimo.cliente, observaciones });
    soltar();
    if (!r.ok) { if (r.errores) mostrarErrores(r.errores); else AgroLayout.toast('No se pudo enviar', r.error, 'error'); return; }
    AgroLayout.refrescarResumen();
    $('zonaEnviar').classList.add('hidden');
    const z = $('zonaEnviada');
    z.innerHTML = `
      <p class="flex items-center gap-2 font-headline-sm text-headline-sm text-spring-lime"><span class="material-symbols-outlined">task_alt</span>Solicitud ${esc(r.solicitud.id)} enviada</p>
      <p class="ayuda">Revisaremos tu diseño y te enviaremos la cotización con precios. La verás en «Mis solicitudes»; también te podemos escribir al ${esc(r.solicitud.telefono || 'correo ' + r.solicitud.correo)}.</p>
      <div class="flex flex-wrap gap-2 pt-1">
        <a href="mis-solicitudes.html" class="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-lg bg-primary hover:bg-spring-lime text-on-primary font-label-md text-label-md font-bold"><span class="material-symbols-outlined text-[18px]">assignment</span>Ver mis solicitudes</a>
        <button type="button" id="btnOtroDiseno" class="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-lg border border-border-grid text-on-surface-variant hover:text-on-surface font-label-md text-label-md"><span class="material-symbols-outlined text-[18px]">add</span>Diseñar otro</button>
      </div>`;
    z.classList.remove('hidden'); z.classList.add('flex');
    $('btnOtroDiseno').addEventListener('click', () => { $('observaciones').value = ''; limpiar(); });
    AgroLayout.toast('Solicitud enviada', `${r.solicitud.id} · te avisaremos cuando la cotización esté lista.`);
  }

  /* ---------- Limpiar (con opción de deshacer) ---------- */
  function foto() {
    return { params: leerFormulario(), cliente: $('cliente').value, insumosProy: insumosProy.slice(), ultimo, obsoleto, idActual, fechaIso, idSolicitud, guardadoAlDia, diseno, url: location.search };
  }
  function restaurar(f) {
    escribirParams(f.params, f.cliente);
    insumosProy = f.insumosProy; ultimo = f.ultimo; obsoleto = f.obsoleto; idActual = f.idActual; fechaIso = f.fechaIso; idSolicitud = f.idSolicitud; diseno = f.diseno; pintarTarjetaDiseno();
    pintarChips(); chipId(); limpiarErroresCampos(); ocultarError(); actualizarSimulador(); pintarBanner();
    if (ultimo && ultimo.pendiente) { pintarPendiente(ultimo.pendiente); pintarResumen(ultimo.params, ultimo.cliente); estado('listo'); }
    else if (ultimo) { pintarBom(ultimo.resultado); pintarResumen(ultimo.params, ultimo.cliente); estado(obsoleto ? 'obsoleto' : 'listo'); botonGuardar(f.guardadoAlDia ? 'guardado' : (idActual ? 'cambios' : 'nuevo')); }
    else { pintarBom(null); estado('pendiente'); botonGuardar('nuevo'); }
    $('txtFecha').textContent = D.fechaLarga(fechaIso);
    try { history.replaceState(null, '', 'nuevo-proyecto.html' + f.url); } catch (e) {}
  }
  function limpiar() {
    const antes = foto();
    const habiaAlgo = antes.ultimo || antes.insumosProy.length || antes.cliente.trim() || antes.diseno;
    escribirParams(DEFECTO, '');
    insumosProy = []; ultimo = null; obsoleto = false; idActual = null; fechaIso = null; idSolicitud = null; diseno = null; pintarTarjetaDiseno();
    pintarChips(); pintarBom(null); estado('pendiente'); chipId(); ocultarError(); limpiarErroresCampos(); actualizarSimulador(); botonGuardar('nuevo'); pintarBanner(); mostrarEnviar();
    $('txtFecha').textContent = D.fechaLarga();
    try { history.replaceState(null, '', 'nuevo-proyecto.html'); } catch (e) {}
    if (habiaAlgo) AgroLayout.toast('Formulario limpio', 'Se borraron los datos de este diseño.', 'info', { texto: 'Deshacer', fn: () => restaurar(antes) });
  }

  /* ---------- Diseño «a mi medida» (js/disenador.js) ---------- */
  function pintarTarjetaDiseno() {
    const medida = !!diseno;
    const radio = document.querySelector(`input[name=formaDiseno][value=${medida ? 'medida' : 'simple'}]`); if (radio) radio.checked = true;
    $('camposSimples').classList.toggle('hidden', medida);
    $('tarjetaDiseno').classList.toggle('hidden', !medida); $('tarjetaDiseno').classList.toggle('flex', medida);
    if (!medida) return;
    $('planoMini').innerHTML = AgroDisenador.svgPlano(diseno);
    const rd = AgroDisenador.resumen(diseno);
    $('txtDiseno').textContent = `${rd.naves} nave${rd.naves > 1 ? 's' : ''} · ${fN(Math.round(rd.area))} m² · ancho total ${fN(rd.anchoTotal)} m · ${rd.tipos.join(' + ')}`;
    const simple = AgroDisenador.comoSimple(diseno), est = $('estadoDiseno');
    est.className = 'dis-estado ' + (simple ? 'dis-ok' : 'dis-pendiente');
    est.textContent = simple ? 'Todas las naves son iguales: se calcula automáticamente.'
      : (dueno ? 'Diseño a medida: precio pendiente (faltan las fórmulas de este tipo de diseño).' : 'Diseño a medida: revisamos tu diseño y te enviamos la cotización.');
  }
  async function abrirDisenador() {
    const res = await AgroDisenador.abrir(diseno || AgroDisenador.desdeSimple(leerFormulario()), { anchoCanal: $('anchoCanal').value, dueno });
    if (res) {
      diseno = res;
      $('anchoCanal').value = diseno.canales.some(Boolean) ? diseno.anchoCanal : '0';
      marcarObsoleto(); mostrarEnviar();
      AgroLayout.toast('Diseño actualizado', dueno ? 'Pulsa «Calcular proyecto» para ver el resultado.' : 'Pulsa «Ver materiales y diseño» y luego envía tu solicitud.', 'info');
    }
    pintarTarjetaDiseno(); actualizarSimulador();
  }
  function volverANavesIguales() {
    if (!diseno) return;
    const antes = diseno, simple = AgroDisenador.comoSimple(diseno);
    diseno = null;
    if (simple) { $('tipo').value = simple.tipo; $('largo').value = simple.largo; $('ancho').value = simple.ancho; $('naves').value = simple.naves; $('distancia').value = simple.distancia; }
    pintarTarjetaDiseno(); actualizarSimulador(); marcarObsoleto();
    AgroLayout.toast('Naves iguales', simple ? 'Se pasaron las medidas de tu diseño al formulario.' : 'Tu diseño a medida se guardó por si quieres volver.', 'info',
      { texto: 'Deshacer', fn: () => { diseno = antes; pintarTarjetaDiseno(); actualizarSimulador(); marcarObsoleto(); } });
  }
  document.querySelectorAll('input[name=formaDiseno]').forEach((radio) => radio.addEventListener('change', (e) => {
    if (e.target.value === 'medida' && !diseno) abrirDisenador();
    else if (e.target.value === 'simple') volverANavesIguales();
  }));
  $('btnEditarDiseno').addEventListener('click', abrirDisenador);

  /* ---------- Eventos ---------- */
  $('formCalculo').addEventListener('submit', (e) => { e.preventDefault(); calcular(true); });
  $('formCalculo').addEventListener('input', (e) => { if (e.target && e.target.id) errorCampo(e.target.id, ''); actualizarSimulador(); marcarObsoleto(); ocultarError(); pintarChips(); });
  $('formCalculo').addEventListener('change', () => { actualizarSimulador(); marcarObsoleto(); pintarChips(); });
  $('btnLimpiar').addEventListener('click', limpiar);
  if (dueno) {
    $('btnAddInsumo').addEventListener('click', añadirInsumo);
    $('chipsInsumos').addEventListener('click', (e) => {
      const b = e.target.closest('[data-quitar]'); if (!b) return;
      insumosProy = insumosProy.filter((i) => i.uid !== b.dataset.quitar); pintarChips(); marcarObsoleto();
    });
    $('btnGuardar').addEventListener('click', guardar);
    $('btnPdf').addEventListener('click', () => exportarPdf(false));
    $('btnPdfInterno').addEventListener('click', () => exportarPdf(true));
    $('btnLiberar').addEventListener('click', liberar);
    $('bannerSolicitud').addEventListener('click', (e) => { if (e.target.closest('#btnCorreo')) enviarPorCorreo(); });
  } else {
    $('cliente').placeholder = 'Ej: Invernadero de rosas, finca La Esperanza';
    // El cliente no ve nada sobre precios: se quita la marca «precio pendiente» de los tipos
    [...$('tipo').options].forEach((o) => { o.textContent = o.textContent.replace(' · precio pendiente', ''); });
    $('btnEnviar').addEventListener('click', enviarSolicitud);
    $('observaciones').addEventListener('input', mostrarEnviar);
    if (invitado) $('txtEnviar').textContent = 'Crear cuenta y enviar solicitud';
  }

  /* ---------- Arranque ----------
   * ?solicitud=  (dueño cotiza la solicitud de un cliente)   ?id= (abrir guardado)   ?id=&copia=1 (duplicar)
   * ?borrador=1  (viene del chat, del portafolio o de crear la cuenta)   ?tipo= (inicio)
   */
  refrescarSelectInsumos();
  pintarBom(null);
  $('txtFecha').textContent = D.fechaLarga();
  const q = new URLSearchParams(location.search);
  const conUid = (lista) => (lista || []).map((i) => ({ uid: D.uid('p'), id: i.id, nombre: i.nombre, precio: i.precio, cantidad: i.cantidad }));
  if (dueno && q.get('solicitud')) {
    // Abrir la solicitud la pasa a «En revisión» en el servidor
    const r = await D.revisarSolicitud(q.get('solicitud'));
    const sol = r.ok ? r.solicitud : null;
    if (sol && sol.idPresupuesto) { location.replace('nuevo-proyecto.html?id=' + encodeURIComponent(sol.idPresupuesto)); return; }
    if (sol) {
      idSolicitud = sol.id;
      escribirParams(Object.assign({}, DEFECTO, sol.params), sol.nombre + (sol.proyecto ? ' — ' + sol.proyecto : ''));
      diseno = sol.diseno || null; pintarTarjetaDiseno();
      AgroLayout.refrescarResumen(); pintarBanner(); botonLiberar();
      actualizarSimulador(); await calcular('silencio');
      AgroLayout.toast('Solicitud cargada', 'Revisa las medidas, ajusta si hace falta, guarda y pulsa «Enviar al cliente».', 'info');
    } else {
      AgroLayout.toast('No encontré esa solicitud', r.error || 'Puede que el cliente la haya cancelado.', 'error');
    }
  } else if (dueno && q.get('id') && q.get('copia')) {
    const r = await D.cargarProyecto(q.get('id'));
    if (r.ok) {
      const pr = r.proyecto;
      escribirParams(pr.params, pr.cliente + ' (copia)');
      insumosProy = conUid(pr.insumos);
      pintarChips();
      try { history.replaceState(null, '', 'nuevo-proyecto.html'); } catch (e) {}
      AgroLayout.toast('Copia lista', 'Ajusta lo que necesites y pulsa «Calcular proyecto». Se guardará como un presupuesto nuevo.', 'info');
    } else {
      AgroLayout.toast('No encontré ese presupuesto', r.error, 'error');
    }
  } else if (dueno && q.get('id')) {
    const r = await D.cargarProyecto(q.get('id'));
    if (r.ok) {
      const pr = r.proyecto;
      escribirParams(pr.params, pr.cliente);
      diseno = pr.diseno || null; pintarTarjetaDiseno();
      insumosProy = conUid(pr.insumos);
      idActual = pr.id; fechaIso = pr.fecha; idSolicitud = pr.idSolicitud || null;
      ultimo = { cliente: pr.cliente, params: pr.params, insumos: insumosProy.slice(), resultado: pr.resultado };
      pintarChips(); pintarBom(pr.resultado); pintarResumen(pr.params, pr.cliente); estado('listo'); chipId(); botonGuardar('guardado'); pintarBanner(); $('txtFecha').textContent = D.fechaLarga(pr.fecha);
    } else {
      AgroLayout.toast('No encontré ese presupuesto', r.error, 'error');
    }
  } else if (q.get('borrador')) {
    const b = D.tomarBorrador();
    if (b && b.params) {
      escribirParams(Object.assign({}, DEFECTO, b.params), b.cliente || '');
      diseno = b.diseno || null; pintarTarjetaDiseno();
      if (!dueno && b.observaciones) $('observaciones').value = b.observaciones;
      if (b.auto && (b.cliente || '').trim()) { actualizarSimulador(); await calcular(); }
      else if (!dueno && b.observaciones !== undefined) { actualizarSimulador(); await calcular('silencio'); AgroLayout.toast('Tu diseño sigue aquí', 'Revisa los datos y pulsa «Enviar solicitud de cotización».', 'info'); }
      else AgroLayout.toast('Datos cargados', dueno ? 'Revisa los valores y pulsa «Calcular proyecto».' : 'Revisa los valores y pulsa «Ver materiales y diseño».', 'info');
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

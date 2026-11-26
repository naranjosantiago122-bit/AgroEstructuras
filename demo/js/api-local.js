/*
 * AgroEstructuras — DEMO SIN SERVIDOR (para GitHub Pages).
 * Imita la API /api/... del back-end (Python + MySQL) dentro del navegador, con localStorage.
 * Así la misma interfaz de frontend/ funciona sin XAMPP ni Flask.
 *
 * OJO: es solo para mostrar el proyecto. Aquí los precios SÍ quedan en el navegador
 * (cualquiera los ve con F12). La versión real, con los precios protegidos, es frontend/ + backend/.
 * Clave de administrador de la demo: AGRO-DEMO
 */
(function () {
  const KEY = 'agro_demo_db_v1';
  const CODIGO_DEMO = 'AGRO-DEMO';
  const PRECIOS_INICIALES = { tubo: 45000, guadua: 15000, carevaca_s: 17000, carevaca_r: 22000 };
  const NOMBRES = { tubo: 'Tubo Galvanizado 2"x6m', guadua: 'Poste de Guadua Tratada 6m', carevaca_s: 'Carevaca Sencilla', carevaca_r: 'Carevaca Reforzada' };
  const PLASTICO = { '5.80': 3200, '6.00': 4200, '6.50': 5200, '8.00': 7200, '10.00': 8200 };
  const CANAL = { '0.90': 350000, '1.20': 355000, '1.50': 360000, '2.00': 365000 };
  const TIPOS = { Tubular: 'Metálico Tubular', Guadua: 'Capilla de Guadua', Cercha: 'Capilla en cercha', UnaAgua: 'Una sola agua', SaranCapilla: 'Sarán capilla' };
  const CON_FORMULA = ['Tubular', 'Guadua'];
  const DMAX = { Tubular: 5, Guadua: 4, Cercha: 5, UnaAgua: 4, SaranCapilla: 4 };
  const LIMITES = { largo: [2, 500], ancho: [2, 100], distancia: [0.5, 5], naves: [1, 20] };

  // ---------------- almacenamiento ----------------
  function nuevaBase() {
    return { seq: 1, usuarios: [], sesion: null, precios: Object.assign({}, PRECIOS_INICIALES),
      insumos: [{ id: 101, nombre: 'Alambre galvanizado cal. 12 (rollo)', precio: 95000, activo: true },
                { id: 102, nombre: 'Grapas y amarres (paquete)', precio: 18000, activo: true }],
      solicitudes: [], cotizaciones: [], obras: [] };
  }
  let mem = null;
  function db() {
    if (mem) return mem;
    try { mem = JSON.parse(localStorage.getItem(KEY)); } catch (e) { mem = null; }
    if (!mem) mem = nuevaBase();
    return mem;
  }
  function guardar() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* sin almacenamiento */ } }
  const hoy = () => new Date().toISOString();
  const anio = () => new Date().getFullYear();
  const codigo = (pref, lista) => `${pref}-${anio()}-${String(lista.length + 1).padStart(4, '0')}`;
  const ok = (o) => Object.assign({ ok: true, status: 200 }, o || {});
  const err = (error, status, extra) => Object.assign({ ok: false, error, status: status || 400 }, extra || {});
  const yo = () => { const d = db(); return d.usuarios.find((u) => u.id === d.sesion) || null; };
  const publico = (u) => (u ? { id: u.id, nombre: u.nombre, correo: u.correo, telefono: u.telefono || '', ciudad: u.ciudad || '', rol: u.rol } : null);
  const esDueno = () => { const u = yo(); return !!u && u.rol === 'dueno'; };

  // ---------------- cálculo (traducción de backend/calculo.py) ----------------
  const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
  const anchoTxt = (v) => { const n = num(v); return n === null ? String(v) : (n === 0 ? '0' : n.toFixed(2)); };
  function normalizar(d) {
    d = d || {};
    const naves = num(d.naves);
    const p = { tipo: String(d.tipo || ''), largo: num(d.largo), ancho: num(d.ancho), distancia: num(d.distancia),
      naves: naves !== null && naves === Math.trunc(naves) ? Math.trunc(naves) : naves,
      calibrePlastico: String(d.calibrePlastico || ''), anchoPlastico: anchoTxt(d.anchoPlastico),
      anchoCanal: anchoTxt(d.anchoCanal), calibreCanal: String(d.calibreCanal || '6'), modalidad: String(d.modalidad || '') };
    const e = [];
    if (!TIPOS[p.tipo]) e.push({ campo: 'tipo', mensaje: 'Elige un tipo de estructura válido.' });
    if (!['Todo Costo', 'Mano de Obra'].includes(p.modalidad)) e.push({ campo: 'modalidad', mensaje: 'Elige «Todo Costo» o «Mano de Obra».' });
    if (!['6', '7', '10'].includes(p.calibrePlastico)) e.push({ campo: 'calPlastico', mensaje: 'Elige un calibre de plástico válido.' });
    if (!PLASTICO[p.anchoPlastico]) e.push({ campo: 'anchoPlastico', mensaje: 'Elige un ancho de rollo válido.' });
    if (p.anchoCanal !== '0' && !CANAL[p.anchoCanal]) e.push({ campo: 'anchoCanal', mensaje: 'Elige un ancho de canal válido.' });
    const rango = (c, etq) => { const [lo, hi] = LIMITES[c]; if (!(p[c] > 0)) e.push({ campo: c, mensaje: `Escribe ${etq} en metros (un número mayor que 0).` }); else if (p[c] < lo || p[c] > hi) e.push({ campo: c, mensaje: `Debe estar entre ${lo} y ${hi} m.` }); };
    rango('largo', 'el largo'); rango('ancho', 'el ancho por nave');
    if (!(p.distancia > 0)) e.push({ campo: 'distancia', mensaje: 'Escribe la distancia entre postes en metros (mayor que 0).' });
    if (!(Number.isInteger(p.naves) && p.naves >= 1 && p.naves <= 20)) e.push({ campo: 'naves', mensaje: 'El número de naves debe ser un número entero entre 1 y 20.' });
    if (DMAX[p.tipo] && p.distancia > DMAX[p.tipo]) e.push({ campo: 'distancia', mensaje: `Alerta técnica: para ${TIPOS[p.tipo]} los postes no deben superar ${DMAX[p.tipo]} m de separación.` });
    return { p, errores: e };
  }
  function calcular(p, insumos) {
    const pr = db().precios; const naves = p.naves; const soloMO = p.modalidad !== 'Todo Costo';
    const secciones = Math.ceil(p.largo / p.distancia); const arcos = secciones + 1;
    const postesLat = arcos * 2 * naves;
    const postesCen = p.tipo === 'Guadua' ? arcos * Math.max(1, Math.floor(p.ancho / 8)) * naves : 0;
    const filas = []; let cMat = 0;
    const item = (sec, nombre, cant, unidad, pu) => { const st = cant * pu; cMat += st; filas.push({ tipo: 'item', seccion: sec, nombre, cant, unidad, pu, st }); };
    if (naves > 1) filas.push({ tipo: 'seccion', texto: `Ingeniería para ${naves} naves acopladas`, color: 'amber' });
    if (p.tipo === 'Tubular') item('estructura', NOMBRES.tubo, Math.ceil(postesLat + arcos * (p.ancho / 3) * naves), 'un', pr.tubo);
    else item('estructura', NOMBRES.guadua, Math.ceil(postesLat + postesCen + arcos * (p.ancho / 3) * naves), 'un', pr.guadua);
    item('cubierta', NOMBRES.carevaca_s, secciones * 20 * naves, 'un', pr.carevaca_s);
    item('cubierta', NOMBRES.carevaca_r, secciones * 3 * naves, 'un', pr.carevaca_r);
    item('cubierta', `Plástico Lechoso UV6+ Cal.${p.calibrePlastico} (${p.anchoPlastico} m)`, Math.ceil(p.largo * p.ancho * 1.05 * naves), 'm²', PLASTICO[p.anchoPlastico] || 3200);
    if (p.anchoCanal !== '0') item('canal', `Canal Cal.${p.calibreCanal} (${p.anchoCanal} m) - Rollo 100 m`, Math.ceil(p.largo * (2 + naves - 1) / 100), 'rollos', CANAL[p.anchoCanal] || 350000);
    if (!soloMO && insumos && insumos.length) {
      filas.push({ tipo: 'seccion', texto: 'Insumos adicionales', color: 'blue' });
      insumos.forEach((i) => item('insumo', i.nombre, i.cantidad, 'un', i.precio));
    }
    const cObra = (arcos * 120000 + p.largo * 25000) * naves;
    if (soloMO) cMat = 0;
    return { ok: true, soloManoDeObra: soloMO, filas, cMat, cObra, total: cMat + cObra, area: p.largo * p.ancho * naves };
  }
  const sinPrecios = (r) => ({ ok: true, soloManoDeObra: r.soloManoDeObra, area: r.area,
    filas: r.filas.map((f) => (f.tipo === 'seccion' ? { tipo: 'seccion', texto: f.texto, color: f.color } : { tipo: 'item', nombre: f.nombre, cant: f.cant, unidad: f.unidad })) });
  function insumosPorId(lista) {
    const salida = [];
    (lista || []).forEach((i) => { const m = db().insumos.find((x) => x.id === Number(i.id) && x.activo); const c = num(i.cantidad); if (m && c > 0) salida.push({ id: m.id, nombre: m.nombre, precio: m.precio, cantidad: c }); });
    return salida;
  }
  const pendienteDe = (p, diseno) => (diseno ? 'El diseño a medida todavía no tiene fórmula de precio: lo cotiza el dueño.'
    : (CON_FORMULA.includes(p.tipo) ? null : `«${TIPOS[p.tipo]}» todavía no tiene fórmula de materiales ni precio: lo cotiza el dueño. Fórmulas pendientes.`));

  // ---------------- vistas ----------------
  function solVista(s, paraDueno) {
    const v = { id: s.id, fecha: s.fecha, estado: s.estado, proyecto: s.proyecto || '', observaciones: s.observaciones || '', params: s.params, diseno: s.diseno || null };
    const u = db().usuarios.find((x) => x.id === s.idCliente) || {};
    const cot = db().cotizaciones.find((q) => q.idSolicitud === s.id && q.estado !== 'Anulado');
    if (paraDueno) Object.assign(v, { nombre: u.nombre || '', correo: u.correo || '', telefono: u.telefono || '', ciudad: u.ciudad || '', idPresupuesto: cot ? cot.id : null });
    else v.cotizacionLista = !!(cot && cot.visibleCliente);
    return v;
  }
  function cotGuardar(body, id) {
    const { p, errores } = normalizar(body.params);
    if (errores.length) return err(errores[0].mensaje, 400, { errores, campo: errores[0].campo });
    const pend = pendienteDe(p, body.diseno);
    if (pend) return err(pend + ' Por ahora no se puede guardar un total automático.', 400);
    if (!String(body.cliente || '').trim()) return err('Escribe el nombre del cliente o proyecto.', 400, { campo: 'cliente' });
    const ins = insumosPorId(body.insumos); const r = calcular(p, ins); const d = db();
    let q = id ? d.cotizaciones.find((x) => x.id === id) : null;
    if (!q) { q = { id: codigo('PRJ', d.cotizaciones), fecha: hoy(), estado: 'Cotizado', visibleCliente: false, ejemplo: false }; d.cotizaciones.unshift(q); }
    Object.assign(q, { cliente: String(body.cliente).trim(), params: p, diseno: body.diseno || null, idSolicitud: body.idSolicitud || q.idSolicitud || null, resultado: r, insumos: ins });
    if (q.idSolicitud) { const s = d.solicitudes.find((x) => x.id === q.idSolicitud); if (s && s.estado === 'Pendiente') s.estado = 'En revisión'; }
    guardar();
    return ok({ cotizacion: q, status: id ? 200 : 201 });
  }
  function actualizarEstadoSolicitud(q) {
    if (!q.idSolicitud) return;
    const s = db().solicitudes.find((x) => x.id === q.idSolicitud);
    if (s && s.estado !== 'Cancelada') s.estado = q.visibleCliente && q.estado !== 'Anulado' ? 'Cotizada' : 'En revisión';
  }

  // ---------------- enrutador ----------------
  async function api(ruta, o) {
    o = o || {};
    const metodo = o.method || (o.body !== undefined ? 'POST' : 'GET');
    const b = o.body || {};
    const d = db();
    const u = yo();
    const seg = ruta.split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
    const [a, id, accion] = seg;
    const soloDueno = () => (esDueno() ? null : err('Solo el dueño puede hacer esto.', 403));

    if (a === 'sesion') return ok({ usuario: publico(u) });
    if (a === 'logout') { d.sesion = null; guardar(); return ok(); }
    if (a === 'login') {
      const x = d.usuarios.find((v) => v.correo === String(b.correo || '').trim().toLowerCase() && v.clave === String(b.clave || ''));
      if (!x) return err('Correo o contraseña incorrectos.', 401);
      d.sesion = x.id; guardar(); return ok({ usuario: publico(x) });
    }
    if (a === 'registro') {
      const correo = String(b.correo || '').trim().toLowerCase();
      if (!String(b.nombre || '').trim()) return err('Escribe tu nombre.', 400, { campo: 'regNombre' });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return err('Escribe un correo válido.', 400, { campo: 'regCorreo' });
      if (String(b.clave || '').length < 8) return err('La contraseña debe tener al menos 8 caracteres.', 400, { campo: 'regPassword' });
      if (b.tipo === 'administrador' && String(b.codigo || '') !== CODIGO_DEMO) return err('La clave de administrador no es correcta. En esta demostración es AGRO-DEMO.', 400, { campo: 'regCodigo' });
      if (d.usuarios.some((v) => v.correo === correo)) return err('Ese correo ya está registrado. Inicia sesión.', 409, { campo: 'regCorreo' });
      const nuevo = { id: d.seq++, nombre: String(b.nombre).trim(), correo, telefono: b.telefono || '', ciudad: b.ciudad || '', clave: String(b.clave), rol: b.tipo === 'administrador' ? 'dueno' : 'cliente' };
      d.usuarios.push(nuevo); d.sesion = nuevo.id; guardar();
      return ok({ usuario: publico(nuevo), status: 201 });
    }
    if (a === 'calculo') {
      const { p, errores } = normalizar(b.params);
      if (errores.length) return err(errores[0].mensaje, 400, { errores, campo: errores[0].campo });
      const pend = pendienteDe(p, b.diseno);
      if (pend) return ok({ pendiente: true, motivo: pend, params: p, resultado: null, insumos: [] });
      const ins = esDueno() ? insumosPorId(b.insumos) : [];
      const r = calcular(p, ins);
      return ok({ params: p, resultado: esDueno() ? r : sinPrecios(r), insumos: ins });
    }
    if (a === 'solicitudes') {
      if (!u) return err('Inicia sesión.', 401);
      if (!id && metodo === 'GET') return ok({ solicitudes: d.solicitudes.filter((s) => s.estado !== 'Cancelada' && (esDueno() || s.idCliente === u.id)).map((s) => solVista(s, esDueno())) });
      if (!id && metodo === 'POST') {
        if (esDueno()) return err('Las solicitudes las envían los clientes. Como dueño, crea el presupuesto directamente.', 403);
        const { p, errores } = normalizar(b.params);
        if (errores.length) return err(errores[0].mensaje, 400, { errores });
        const s = { id: codigo('SOL', d.solicitudes), fecha: hoy(), estado: 'Pendiente', idCliente: u.id, params: p, diseno: b.diseno || null, proyecto: b.proyecto || '', observaciones: b.observaciones || '' };
        d.solicitudes.unshift(s); guardar(); return ok({ solicitud: solVista(s, false), status: 201 });
      }
      const s = d.solicitudes.find((x) => x.id === id);
      if (!s) return err('No encontramos la solicitud.', 404);
      if (accion === 'cancelar') { s.estado = 'Cancelada'; guardar(); return ok(); }
      if (accion === 'restaurar') { s.estado = 'Pendiente'; guardar(); return ok(); }
      if (accion === 'revisar') { const no = soloDueno(); if (no) return no; if (s.estado === 'Pendiente') s.estado = 'En revisión'; guardar(); return ok({ solicitud: solVista(s, true) }); }
      if (accion === 'cotizacion') {
        const q = d.cotizaciones.find((x) => x.idSolicitud === s.id && x.visibleCliente && x.estado !== 'Anulado');
        if (!q) return err('La cotización todavía no está lista.', 404);
        const r = sinPrecios(q.resultado);
        return ok({ cotizacion: { id: q.id, fecha: q.fecha, cliente: q.cliente, params: q.params, diseno: q.diseno, resultado: { total: q.resultado.total, area: r.area, soloManoDeObra: r.soloManoDeObra, filas: r.filas } } });
      }
    }
    if (a === 'cotizaciones') {
      const no = soloDueno(); if (no) return no;
      if (!id && metodo === 'GET') return ok({ cotizaciones: d.cotizaciones.filter((q) => q.estado !== 'Anulado') });
      if (id === 'ejemplos') {
        [['Finca La Esperanza (ejemplo)', { tipo: 'Tubular', largo: 40, ancho: 8, distancia: 4.5, naves: 3, calibrePlastico: '7', anchoPlastico: '8.00', anchoCanal: '1.20', calibreCanal: '7', modalidad: 'Todo Costo' }],
         ['Vivero Los Pinos (ejemplo)', { tipo: 'Guadua', largo: 20, ancho: 6, distancia: 3, naves: 1, calibrePlastico: '6', anchoPlastico: '6.00', anchoCanal: '0', calibreCanal: '6', modalidad: 'Todo Costo' }]]
          .forEach(([c, params]) => { const r = cotGuardar({ cliente: c, params }); if (r.ok) r.cotizacion.ejemplo = true; });
        guardar(); return ok();
      }
      if (!id && metodo === 'POST') return cotGuardar(b);
      const q = d.cotizaciones.find((x) => x.id === id);
      if (!q) return err('No encontramos el presupuesto.', 404);
      if (!accion && metodo === 'GET') return ok({ cotizacion: q });
      if (!accion && metodo === 'PUT') return cotGuardar(b, id);
      if (accion === 'estado') { q.estado = b.estado; guardar(); return ok(); }
      if (accion === 'liberar') { q.visibleCliente = !!b.visible; actualizarEstadoSolicitud(q); guardar(); return ok(); }
      if (accion === 'anular') { q.estado = 'Anulado'; q.visibleCliente = false; actualizarEstadoSolicitud(q); guardar(); return ok(); }
      if (accion === 'restaurar') { q.estado = b.estado && b.estado !== 'Anulado' ? b.estado : 'Cotizado'; q.visibleCliente = !!b.visibleCliente; actualizarEstadoSolicitud(q); guardar(); return ok(); }
      if (accion === 'correo') {
        const s = q.idSolicitud ? d.solicitudes.find((x) => x.id === q.idSolicitud) : null;
        const c = s ? (d.usuarios.find((x) => x.id === s.idCliente) || {}).correo : '';
        return ok({ modo: 'prueba', para: c || '(sin correo)', detalle: 'Demostración: en la versión real el correo sale del servidor.' });
      }
    }
    if (a === 'correo') return ok({ modo: 'prueba', remitente: null });
    if (a === 'precios') {
      const no = soloDueno(); if (no) return no;
      if (id === 'restablecer') { d.precios = Object.assign({}, PRECIOS_INICIALES); guardar(); return ok({ precios: d.precios }); }
      if (metodo === 'PUT') {
        for (const k of Object.keys(PRECIOS_INICIALES)) { const v = num(b[k]); if (!(v > 0)) return err('Todos los precios base deben ser mayores que 0.', 400, { campo: k }); d.precios[k] = v; }
        guardar(); return ok({ precios: d.precios });
      }
      return ok({ precios: d.precios });
    }
    if (a === 'insumos') {
      const no = soloDueno(); if (no) return no;
      if (!id && metodo === 'GET') return ok({ insumos: d.insumos.filter((i) => i.activo).map(({ id: i, nombre, precio }) => ({ id: i, nombre, precio })) });
      if (!id && metodo === 'POST') {
        const precio = num(b.precio);
        if (!String(b.nombre || '').trim() || !(precio >= 0)) return err('Escribe el nombre y un precio válido.', 400);
        const ins = { id: 1000 + d.seq++, nombre: String(b.nombre).trim(), precio, activo: true }; d.insumos.unshift(ins); guardar();
        return ok({ insumo: { id: ins.id, nombre: ins.nombre, precio: ins.precio }, status: 201 });
      }
      const ins = d.insumos.find((x) => x.id === Number(id)); if (!ins) return err('No encontramos el insumo.', 404);
      if (b.precio !== undefined) ins.precio = num(b.precio);
      if (b.activo !== undefined) ins.activo = !!b.activo;
      guardar(); return ok();
    }
    if (a === 'obras') {
      if (!id && metodo === 'GET') return ok({ obras: d.obras.filter((x) => x.activo !== false) });
      const no = soloDueno(); if (no) return no;
      if (!id && metodo === 'POST') { const obra = Object.assign({ id: 2000 + d.seq++, activo: true, fecha: hoy() }, b); if (b.foto && !obra.foto_url) obra.foto_url = b.foto; d.obras.unshift(obra); guardar(); return ok({ obra, status: 201 }); }
      const ob = d.obras.find((x) => x.id === Number(id)); if (!ob) return err('No encontramos la obra.', 404);
      if (b.activo !== undefined) ob.activo = !!b.activo; guardar(); return ok();
    }
    return err('Esta acción no está disponible en la demostración.', 404);
  }

  window.AgroDemoAPI = api;
  window.AgroDemoReiniciar = function () { mem = nuevaBase(); guardar(); location.reload(); };
})();

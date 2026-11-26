/*
 * AgroEstructura - Datos y sesión, conectados al back-end (Python + MySQL) por la API /api/...
 *
 * Cómo funciona:
 *  - Al abrir cada página se llama a  await AgroDatos.iniciar()  (lo hace AgroLayout.montar):
 *    pregunta al servidor quién tiene la sesión y trae los datos que ese rol PUEDE ver.
 *  - Las lecturas (getProyectos, getSolicitudes, ...) devuelven esa copia en memoria al instante.
 *  - Las escrituras (guardarProyecto, crearSolicitud, ...) son async: van al servidor y actualizan la copia.
 *  - El cliente nunca recibe precios: el servidor no se los envía (no es solo que estén ocultos).
 *  - En el navegador solo quedan el borrador del diseño y la marca de «invitado» (sin precios).
 */
(function () {
  const K = { borrador: 'agro_v4_borrador', invitado: 'agro_v4_invitado' };
  const ROLES = { DUENO: 'dueno', CLIENTE: 'cliente', INVITADO: 'invitado' };
  // ¿El cliente ve las cantidades de materiales (sin precios)? Pregunta pendiente para Libardo.
  const CLIENTE_VE_CANTIDADES = true;
  const ESTADOS = ['Cotizado', 'En revisión', 'Aprobado'];
  const ESTADOS_SOLICITUD = ['Pendiente', 'En revisión', 'Cotizada'];
  const SIN_CONEXION = 'No se pudo cargar la demostración.';

  let sesion = null; // usuario del servidor: { id, nombre, correo, telefono, ciudad, rol }
  const cache = { proyectos: [], solicitudes: [], insumos: [], precios: {}, obras: [] };

  /* ---------- Utilidades ---------- */
  const uid = (p) => (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const local = {
    leer(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    guardar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    quitar(k) { try { localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } },
  };

  /** Llama a la API. Devuelve siempre un objeto { ok, error?, ... } (nunca lanza error). */
  /** DEMO: en lugar de llamar al servidor, usa la API simulada de js/api-local.js (localStorage). */
  async function api(ruta, opciones) {
    try { return await window.AgroDemoAPI(ruta, opciones || {}); }
    catch (e) { return { ok: false, error: 'Error en la demostración: ' + e.message }; }
  }
  const post = (ruta, body) => api(ruta, { body: body || {} });

  /* ---------- Sesión ---------- */
  const esInvitadoLocal = () => !!local.leer(K.invitado);
  function getSesion() {
    if (sesion) return Object.assign({}, sesion, { invitado: false });
    if (esInvitadoLocal()) return { nombre: 'Invitado', invitado: true, rol: ROLES.INVITADO };
    return null;
  }
  const getRol = () => { const s = getSesion(); return s ? s.rol : ROLES.INVITADO; };
  const esDueno = () => getRol() === ROLES.DUENO;
  const inicioDe = (rol) => (rol === ROLES.DUENO ? 'centro-principal.html' : 'nuevo-proyecto.html');

  /**
   * Pregunta al servidor quién tiene la sesión y carga los datos permitidos para ese rol.
   * opciones.datos = false -> solo la sesión (página de inicio y de acceso).
   * Devuelve { ok, error? }.
   */
  async function iniciar(opciones) {
    const r = await api('/sesion');
    if (!r.ok) return { ok: false, error: r.error || SIN_CONEXION };
    sesion = r.usuario;
    if (sesion) local.quitar(K.invitado);
    if (opciones && opciones.datos === false) return { ok: true };
    return recargar();
  }
  /** Vuelve a traer del servidor los datos del rol actual. */
  async function recargar() {
    const pedidos = { obras: api('/obras') };
    if (esDueno()) Object.assign(pedidos, { proyectos: api('/cotizaciones'), solicitudes: api('/solicitudes'), insumos: api('/insumos'), precios: api('/precios') });
    else if (sesion) pedidos.solicitudes = api('/solicitudes');
    const claves = Object.keys(pedidos);
    const res = await Promise.all(claves.map((k) => pedidos[k]));
    let error = null;
    claves.forEach((k, i) => {
      const r = res[i];
      if (!r.ok) { error = error || r.error; return; }
      cache[k] = { proyectos: r.cotizaciones, solicitudes: r.solicitudes, insumos: r.insumos, precios: r.precios, obras: r.obras }[k];
    });
    return error ? { ok: false, error } : { ok: true };
  }

  /** Para las páginas internas: si no hay sesión (ni invitado), manda a acceso.html y vuelve después. */
  function exigirSesion() {
    if (!getSesion()) {
      const volver = location.pathname.split('/').pop() + location.search;
      location.replace('acceso.html?volver=' + encodeURIComponent(volver));
      return false;
    }
    return true;
  }

  async function registrar(d) {
    const r = await post('/registro', { nombre: d.nombre, correo: d.correo, telefono: d.telefono, ciudad: d.ciudad, clave: d.password, tipo: d.tipo, codigo: d.codigo });
    if (!r.ok) return { ok: false, error: r.error, campo: r.campo };
    sesion = r.usuario; local.quitar(K.invitado);
    return { ok: true, rol: sesion.rol };
  }
  async function iniciarSesion(correo, clave) {
    const r = await post('/login', { correo, clave });
    if (!r.ok) return { ok: false, error: r.error };
    sesion = r.usuario; local.quitar(K.invitado);
    return { ok: true, rol: sesion.rol };
  }
  async function cerrarSesion() {
    await post('/logout');
    sesion = null; local.quitar(K.invitado);
  }
  async function entrarComoInvitado() {
    if (sesion) await cerrarSesion();
    local.guardar(K.invitado, true);
  }

  /* ---------- Cálculo (en el servidor) ---------- */
  /**
   * params + insumos [{id, cantidad}] (+ diseño a medida) -> { ok, resultado, insumos } o { ok:false, errores }.
   * Precios solo para el dueño. Si el diseño o el tipo aún no tiene fórmula: { ok: true, pendiente: true, motivo }.
   */
  async function calcular(params, insumos, diseno) {
    const r = await post('/calculo', { params, diseno: diseno || null, insumos: (insumos || []).map((i) => ({ id: i.id, cantidad: i.cantidad })) });
    if (!r.ok) return { ok: false, error: r.error, errores: r.errores || [{ campo: r.campo || '', mensaje: r.error }] };
    if (r.pendiente) return { ok: true, pendiente: true, motivo: r.motivo, resultado: null, insumos: [] };
    return { ok: true, resultado: r.resultado, insumos: r.insumos || [] };
  }

  /* ---------- Presupuestos / cotizaciones (solo dueño) ---------- */
  const getProyectos = () => cache.proyectos;
  const getProyecto = (id) => cache.proyectos.find((p) => p.id === id);
  function ponerEnCache(p) {
    const i = cache.proyectos.findIndex((x) => x.id === p.id);
    if (i >= 0) cache.proyectos[i] = p; else cache.proyectos.unshift(p);
  }
  /** Presupuesto completo (con la lista de materiales). */
  async function cargarProyecto(id) {
    const r = await api('/cotizaciones/' + encodeURIComponent(id));
    if (!r.ok) return { ok: false, error: r.error };
    ponerEnCache(r.cotizacion);
    return { ok: true, proyecto: r.cotizacion };
  }
  /** Crea o actualiza (si trae id). El servidor recalcula el total con los precios actuales. */
  async function guardarProyecto(d) {
    const body = { cliente: d.cliente, params: d.params, diseno: d.diseno || null, insumos: (d.insumos || []).map((i) => ({ id: i.id, cantidad: i.cantidad })), idSolicitud: d.idSolicitud || null };
    const r = d.id ? await api('/cotizaciones/' + encodeURIComponent(d.id), { method: 'PUT', body }) : await post('/cotizaciones', body);
    if (!r.ok) return { ok: false, error: r.error };
    ponerEnCache(r.cotizacion);
    if (d.idSolicitud) await recargarSolicitudes();
    return { ok: true, proyecto: r.cotizacion };
  }
  async function borrarProyecto(id) {
    const r = await post('/cotizaciones/' + encodeURIComponent(id) + '/anular');
    if (r.ok) { cache.proyectos = cache.proyectos.filter((p) => p.id !== id); await recargarSolicitudes(); }
    return r;
  }
  async function restaurarProyecto(p) {
    const r = await post('/cotizaciones/' + encodeURIComponent(p.id) + '/restaurar', { estado: p.estado, visibleCliente: p.visibleCliente });
    if (r.ok) await recargar();
    return r;
  }
  async function setEstado(id, estado) {
    const r = await api('/cotizaciones/' + encodeURIComponent(id) + '/estado', { method: 'PATCH', body: { estado } });
    if (r.ok) { const p = getProyecto(id); if (p) p.estado = estado; }
    return r;
  }
  async function liberarCotizacion(id, visible) {
    const r = await post('/cotizaciones/' + encodeURIComponent(id) + '/liberar', { visible: !!visible });
    if (r.ok) { const p = getProyecto(id); if (p) p.visibleCliente = !!visible; await recargarSolicitudes(); }
    return r;
  }
  /** Envía al correo del cliente la cotización (solo el valor total). Devuelve { ok, modo: 'smtp'|'prueba', para, detalle }. */
  const enviarCorreo = (id) => post('/cotizaciones/' + encodeURIComponent(id) + '/correo');
  async function cargarEjemplos() {
    const r = await post('/cotizaciones/ejemplos');
    if (r.ok) await recargar();
    return r;
  }
  function proyectosCSV() {
    const filas = [['ID', 'Fecha', 'Cliente', 'Estructura', 'Largo (m)', 'Ancho por nave (m)', 'Naves', 'Modalidad', 'Estado', 'Materiales (COP)', 'Mano de obra (COP)', 'Total (COP)']];
    cache.proyectos.forEach((p) => filas.push([p.id, String(p.fecha).slice(0, 10), p.cliente, AgroCalculo.NOMBRE_TIPO[p.params.tipo] || p.params.tipo, p.params.largo, p.params.ancho, p.params.naves, p.params.modalidad, p.estado, Math.round(p.resultado.cMat), Math.round(p.resultado.cObra), Math.round(p.resultado.total)]));
    const celda = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    return '﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n');
  }

  /* ---------- Solicitudes (cliente: las suyas, sin precios · dueño: todas) ---------- */
  const getSolicitudes = () => cache.solicitudes;
  const getSolicitud = (id) => cache.solicitudes.find((s) => s.id === id);
  const misSolicitudes = () => (esDueno() ? [] : cache.solicitudes);
  const pendientes = () => (esDueno() ? cache.solicitudes.filter((s) => s.estado === 'Pendiente').length : 0);
  async function recargarSolicitudes() {
    if (!sesion) return;
    const r = await api('/solicitudes');
    if (r.ok) cache.solicitudes = r.solicitudes;
  }
  async function crearSolicitud(d) {
    if (!sesion) return { ok: false, error: 'Inicia sesión o crea una cuenta para enviar la solicitud.' };
    const r = await post('/solicitudes', { params: d.params, diseno: d.diseno || null, proyecto: d.proyecto, observaciones: d.observaciones, origen: d.origen });
    if (!r.ok) return { ok: false, error: r.error, errores: r.errores };
    cache.solicitudes.unshift(r.solicitud);
    return { ok: true, solicitud: r.solicitud };
  }
  async function cancelarSolicitud(id) {
    const r = await post('/solicitudes/' + encodeURIComponent(id) + '/cancelar');
    if (r.ok) cache.solicitudes = cache.solicitudes.filter((s) => s.id !== id);
    return r;
  }
  async function restaurarSolicitud(s) {
    const r = await post('/solicitudes/' + encodeURIComponent(s.id) + '/restaurar');
    if (r.ok) await recargarSolicitudes();
    return r;
  }
  /** El dueño abre una solicitud: pasa a «En revisión». Devuelve la solicitud con los datos del cliente. */
  async function revisarSolicitud(id) {
    const r = await post('/solicitudes/' + encodeURIComponent(id) + '/revisar');
    if (!r.ok) return { ok: false, error: r.error };
    const i = cache.solicitudes.findIndex((s) => s.id === id);
    if (i >= 0) cache.solicitudes[i] = r.solicitud; else cache.solicitudes.unshift(r.solicitud);
    return { ok: true, solicitud: r.solicitud };
  }
  /** Cotización con precios que el dueño liberó para esta solicitud (solo la ve su cliente). */
  async function cotizacionDeSolicitud(id) {
    const r = await api('/solicitudes/' + encodeURIComponent(id) + '/cotizacion');
    return r.ok ? r.cotizacion : null;
  }

  /* ---------- Inventario (solo dueño) ---------- */
  const getPrecios = () => cache.precios;
  async function setPrecios(nuevos) {
    const r = await api('/precios', { method: 'PUT', body: nuevos });
    if (r.ok) cache.precios = r.precios;
    return r;
  }
  async function resetPrecios() {
    const r = await post('/precios/restablecer');
    if (r.ok) cache.precios = r.precios;
    return r;
  }
  const getInsumos = () => cache.insumos;
  async function addInsumo(nombre, precio) {
    const r = await post('/insumos', { nombre, precio });
    if (r.ok) cache.insumos.unshift(r.insumo);
    return r;
  }
  async function setPrecioInsumo(id, precio) {
    const r = await api('/insumos/' + id, { method: 'PATCH', body: { precio } });
    if (r.ok) { const i = cache.insumos.find((x) => x.id === id); if (i) i.precio = precio; }
    return r;
  }
  async function delInsumo(id) {
    const r = await api('/insumos/' + id, { method: 'PATCH', body: { activo: false } });
    if (r.ok) cache.insumos = cache.insumos.filter((i) => i.id !== id);
    return r;
  }
  async function restaurarInsumo(ins) {
    const r = await api('/insumos/' + ins.id, { method: 'PATCH', body: { activo: true } });
    if (r.ok) { const l = await api('/insumos'); if (l.ok) cache.insumos = l.insumos; }
    return r;
  }

  /* ---------- Obras del portafolio (ver: todos · editar: dueño) ---------- */
  const getObras = () => cache.obras;
  async function addObra(o) {
    const r = await post('/obras', o);
    if (r.ok) cache.obras.unshift(r.obra);
    return r;
  }
  async function delObra(id) {
    const r = await api('/obras/' + id, { method: 'PATCH', body: { activo: false } });
    if (r.ok) cache.obras = cache.obras.filter((o) => o.id !== id);
    return r;
  }
  async function restaurarObra(o) {
    const r = await api('/obras/' + o.id, { method: 'PATCH', body: { activo: true } });
    if (r.ok) { const l = await api('/obras'); if (l.ok) cache.obras = l.obras; }
    return r;
  }

  /* ---------- Borrador (diseño que pasa del chat / portafolio / registro al cotizador; sin precios) ---------- */
  const setBorrador = (b) => local.guardar(K.borrador, b);
  function tomarBorrador() { const b = local.leer(K.borrador); local.quitar(K.borrador); return b; }

  /* ---------- Formato ---------- */
  const fechaLarga = (iso) => {
    const d = new Date(iso || Date.now());
    const mes = d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '').toUpperCase();
    return String(d.getDate()).padStart(2, '0') + ' ' + mes + ' ' + d.getFullYear();
  };
  const iniciales = (nombre) => (nombre || '?').split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();

  window.AgroDatos = {
    esc, uid, fechaLarga, iniciales, SIN_CONEXION,
    ROLES, CLIENTE_VE_CANTIDADES, ESTADOS, ESTADOS_SOLICITUD,
    iniciar, recargar, getSesion, getRol, esDueno, inicioDe, exigirSesion,
    registrar, iniciarSesion, cerrarSesion, entrarComoInvitado,
    calcular,
    getProyectos, getProyecto, cargarProyecto, guardarProyecto, borrarProyecto, restaurarProyecto, setEstado, liberarCotizacion, enviarCorreo, cargarEjemplos, proyectosCSV,
    getSolicitudes, getSolicitud, misSolicitudes, pendientes, recargarSolicitudes, crearSolicitud, cancelarSolicitud, restaurarSolicitud, revisarSolicitud, cotizacionDeSolicitud,
    getPrecios, setPrecios, resetPrecios, getInsumos, addInsumo, setPrecioInsumo, delInsumo, restaurarInsumo,
    getObras, addObra, delObra, restaurarObra,
    setBorrador, tomarBorrador,
  };
})();

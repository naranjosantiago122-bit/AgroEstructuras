/*
 * AgroEstructura - Datos y sesión (guardados en el navegador con localStorage).
 * Cuando exista el back-end (Python + MySQL), este archivo es el único que habrá que cambiar:
 * las páginas solo llaman a estas funciones.
 */
(function () {
  const K = {
    precios: 'agro_v3_precios',
    insumos: 'agro_v3_insumos',
    proyectos: 'agro_v3_proyectos',
    obras: 'agro_v3_obras',
    usuarios: 'agro_v3_usuarios',
    sesion: 'agro_v3_sesion',
    borrador: 'agro_v3_borrador',
    solicitudes: 'agro_v3_solicitudes',
  };

  /* ---------- Roles (igual que la tabla «roles» de la base de datos v2) ----------
   * dueno   : ve precios, inventario, presupuestos y las solicitudes de los clientes.
   * cliente : diseña su invernadero SIN precios y envía una solicitud de cotización.
   * invitado: como el cliente, pero debe crear una cuenta para enviar la solicitud.
   * IMPORTANTE: esto es un prototipo sin servidor. Los precios siguen dentro del navegador
   * (calculo.js y localStorage) y se pueden ver con F12. La protección real la hará el back-end.
   */
  const ROLES = { DUENO: 'dueno', CLIENTE: 'cliente', INVITADO: 'invitado' };
  // Código para crear la cuenta del dueño en esta demostración (cámbialo si quieres).
  const CODIGO_DUENO = 'AGRO-DUENO-2026';
  // ¿El cliente ve las cantidades de materiales (sin precios)? Pregunta pendiente para Libardo.
  const CLIENTE_VE_CANTIDADES = true;

  function leer(clave, defecto) {
    try { const v = JSON.parse(localStorage.getItem(clave)); return (v === null || v === undefined) ? defecto : v; }
    catch (e) { return defecto; }
  }
  function guardar(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); return true; }
    catch (e) { return false; } // sin espacio o almacenamiento bloqueado
  }
  const uid = (p) => (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Precios base e insumos ---------- */
  const getPrecios = () => Object.assign({}, AgroCalculo.PRECIOS_BASE, leer(K.precios, {}));
  const setPrecios = (p) => guardar(K.precios, p);
  const resetPrecios = () => { try { localStorage.removeItem(K.precios); } catch (e) {} };

  const getInsumos = () => { const v = leer(K.insumos, []); return Array.isArray(v) ? v : []; };
  const setInsumos = (arr) => guardar(K.insumos, arr);
  function addInsumo(nombre, precio) {
    const arr = getInsumos();
    const nuevo = { id: uid('ins'), nombre: String(nombre).trim(), precio: Number(precio), unidad: 'Unidad' };
    arr.unshift(nuevo); setInsumos(arr); return nuevo;
  }
  const delInsumo = (id) => setInsumos(getInsumos().filter((i) => i.id !== id));
  function setPrecioInsumo(id, precio) {
    const arr = getInsumos(); const i = arr.find((x) => x.id === id);
    if (i) { i.precio = Number(precio) || 0; setInsumos(arr); }
  }

  /* ---------- Proyectos (presupuestos) ---------- */
  const ESTADOS = ['Cotizado', 'En revisión', 'Aprobado'];
  const getProyectos = () => { const v = leer(K.proyectos, []); return Array.isArray(v) ? v : []; };
  const setProyectos = (arr) => guardar(K.proyectos, arr);
  const getProyecto = (id) => getProyectos().find((p) => p.id === id);

  function siguienteId() {
    const y = new Date().getFullYear();
    const nums = getProyectos().map((p) => parseInt(String(p.id).split('-').pop(), 10)).filter((n) => !isNaN(n));
    const n = (nums.length ? Math.max.apply(null, nums) : 0) + 1;
    return 'PRJ-' + y + '-' + String(n).padStart(4, '0');
  }

  /** Guarda (o actualiza si trae id) un presupuesto ya calculado. */
  function guardarProyecto(proy) {
    if (!proy.id) delete proy.id;
    const arr = getProyectos();
    const i = proy.id ? arr.findIndex((p) => p.id === proy.id) : -1;
    if (i >= 0) { arr[i] = Object.assign({}, arr[i], proy); }
    else { proy = Object.assign({ id: siguienteId(), fecha: new Date().toISOString(), estado: 'Cotizado' }, proy); arr.unshift(proy); }
    const ok = setProyectos(arr);
    return ok ? (i >= 0 ? arr[i] : proy) : null;
  }
  const borrarProyecto = (id) => setProyectos(getProyectos().filter((p) => p.id !== id));
  /** Cambia el estado de un presupuesto a uno de ESTADOS. */
  function setEstado(id, estado) {
    if (ESTADOS.indexOf(estado) < 0) return null;
    const arr = getProyectos(); const p = arr.find((x) => x.id === id);
    if (!p) return null;
    p.estado = estado; setProyectos(arr); return p.estado;
  }
  /** Vuelve a poner un elemento borrado en su posición original (para «Deshacer»). */
  function reinsertar(arr, item, indice) { arr.splice(Math.min(Math.max(indice, 0), arr.length), 0, item); return arr; }
  const restaurarProyecto = (p, i) => setProyectos(reinsertar(getProyectos(), p, i));
  const restaurarInsumo = (ins, i) => setInsumos(reinsertar(getInsumos(), ins, i));
  const restaurarObra = (o, i) => guardar(K.obras, reinsertar(getObras(), o, i));
  function ciclarEstado(id) {
    const arr = getProyectos(); const p = arr.find((x) => x.id === id);
    if (!p) return null;
    p.estado = ESTADOS[(ESTADOS.indexOf(p.estado) + 1) % ESTADOS.length];
    setProyectos(arr); return p.estado;
  }

  /** Crea dos presupuestos de ejemplo usando el motor de cálculo real (marcados como ejemplo). */
  function cargarEjemplos() {
    const precios = getPrecios();
    const ejemplos = [
      { cliente: 'Flores La Ceja', params: { tipo: 'Tubular', largo: 50, ancho: 24, distancia: 2.5, naves: 2, calibrePlastico: '7', anchoPlastico: '5.80', anchoCanal: '1.20', calibreCanal: '6', modalidad: 'Todo Costo' }, estado: 'Aprobado' },
      { cliente: 'Hortalizas El Retiro', params: { tipo: 'Guadua', largo: 35, ancho: 18, distancia: 2.5, naves: 1, calibrePlastico: '6', anchoPlastico: '5.80', anchoCanal: '1.20', calibreCanal: '6', modalidad: 'Todo Costo' }, estado: 'En revisión' },
    ];
    ejemplos.forEach((e) => {
      const r = AgroCalculo.calcular(e.params, precios, []);
      if (r.ok) guardarProyecto({ cliente: e.cliente, params: e.params, insumos: [], precios, resultado: r, estado: e.estado, ejemplo: true });
    });
  }

  function proyectosCSV() {
    const filas = [['ID', 'Fecha', 'Cliente', 'Estructura', 'Largo (m)', 'Ancho por nave (m)', 'Naves', 'Modalidad', 'Estado', 'Materiales (COP)', 'Mano de obra (COP)', 'Total (COP)']];
    getProyectos().forEach((p) => filas.push([p.id, p.fecha.slice(0, 10), p.cliente, AgroCalculo.NOMBRE_TIPO[p.params.tipo] || p.params.tipo, p.params.largo, p.params.ancho, p.params.naves, p.params.modalidad, p.estado, Math.round(p.resultado.cMat), Math.round(p.resultado.cObra), Math.round(p.resultado.total)]));
    const celda = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    return '﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n');
  }

  /* ---------- Obras del portafolio ---------- */
  const getObras = () => { const v = leer(K.obras, []); return Array.isArray(v) ? v : []; };
  function addObra(o) {
    const arr = getObras(); const nueva = Object.assign({ id: uid('obra') }, o); arr.unshift(nueva);
    return guardar(K.obras, arr) ? nueva : null;
  }
  const delObra = (id) => guardar(K.obras, getObras().filter((o) => o.id !== id));

  /* ---------- Solicitudes de cotización (tabla «solicitudes»: SIN precios) ---------- */
  const ESTADOS_SOLICITUD = ['Pendiente', 'En revisión', 'Cotizada'];
  const getSolicitudes = () => { const v = leer(K.solicitudes, []); return Array.isArray(v) ? v : []; };
  const setSolicitudes = (arr) => guardar(K.solicitudes, arr);
  const getSolicitud = (id) => getSolicitudes().find((x) => x.id === id);
  /** Solicitudes del cliente con sesión abierta (como la vista v_solicitudes_cliente). */
  function misSolicitudes() {
    const s = getSesion(); if (!s || !s.correo) return [];
    return getSolicitudes().filter((x) => x.correo === s.correo);
  }
  const pendientes = () => getSolicitudes().filter((x) => x.estado === 'Pendiente').length;
  function siguienteIdSolicitud() {
    const y = new Date().getFullYear();
    const nums = getSolicitudes().map((x) => parseInt(String(x.id).split('-').pop(), 10)).filter((v) => !isNaN(v));
    return 'SOL-' + y + '-' + String((nums.length ? Math.max.apply(null, nums) : 0) + 1).padStart(4, '0');
  }
  /** El cliente envía su configuración. Solo guarda especificaciones: nunca precios ni totales. */
  function crearSolicitud(d) {
    const s = getSesion();
    if (!s || !s.correo || s.rol === ROLES.INVITADO) return { ok: false, error: 'Inicia sesión o crea una cuenta para enviar la solicitud.' };
    const p = d.params;
    const sol = {
      id: siguienteIdSolicitud(), fecha: new Date().toISOString(), estado: 'Pendiente',
      nombre: s.nombre, correo: s.correo, telefono: s.telefono || '', ciudad: s.ciudad || '',
      proyecto: String(d.proyecto || '').trim(), observaciones: String(d.observaciones || '').trim(),
      params: { tipo: p.tipo, largo: p.largo, ancho: p.ancho, distancia: p.distancia, naves: p.naves, calibrePlastico: p.calibrePlastico, anchoPlastico: p.anchoPlastico, anchoCanal: p.anchoCanal, calibreCanal: p.calibreCanal, modalidad: p.modalidad },
      idPresupuesto: null,
    };
    const arr = getSolicitudes(); arr.unshift(sol);
    return setSolicitudes(arr) ? { ok: true, solicitud: sol } : { ok: false, error: 'El almacenamiento del navegador está lleno o bloqueado.' };
  }
  function actualizarSolicitud(id, cambios) {
    const arr = getSolicitudes(); const x = arr.find((v) => v.id === id);
    if (!x) return null;
    Object.assign(x, cambios); setSolicitudes(arr); return x;
  }
  /** El cliente cancela una solicitud que aún nadie ha revisado. */
  function cancelarSolicitud(id) {
    const x = getSolicitud(id); const s = getSesion();
    if (!x || !s || x.correo !== s.correo || x.estado !== 'Pendiente') return false;
    return setSolicitudes(getSolicitudes().filter((v) => v.id !== id));
  }
  const restaurarSolicitud = (x, i) => setSolicitudes(reinsertar(getSolicitudes(), x, i));
  /**
   * El dueño libera (o retira) la cotización para que el cliente la vea (cotizaciones.visible_cliente).
   * Al liberar, la solicitud pasa a «Cotizada».
   */
  function liberarCotizacion(idPresupuesto, visible) {
    const arr = getProyectos(); const p = arr.find((x) => x.id === idPresupuesto);
    if (!p || !p.idSolicitud) return false;
    p.visibleCliente = !!visible; setProyectos(arr);
    actualizarSolicitud(p.idSolicitud, { estado: visible ? 'Cotizada' : 'En revisión', idPresupuesto: p.id });
    return true;
  }
  /** Cotización que ve el cliente (como la vista v_cotizaciones_cliente): solo si fue liberada y es suya. */
  function cotizacionDeSolicitud(idSolicitud) {
    const x = getSolicitud(idSolicitud); const s = getSesion();
    if (!x || !s || x.correo !== s.correo || !x.idPresupuesto) return null;
    const p = getProyecto(x.idPresupuesto);
    return p && p.visibleCliente ? p : null;
  }

  /* ---------- Borrador (viene del chat o del portafolio hacia el cotizador) ---------- */
  const setBorrador = (b) => guardar(K.borrador, b);
  function tomarBorrador() { const b = leer(K.borrador, null); try { localStorage.removeItem(K.borrador); } catch (e) {} return b; }

  /* ---------- Cuentas y sesión (modo demostración, sin servidor) ---------- */
  async function hash(texto) {
    try {
      if (window.crypto && crypto.subtle) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('agro::' + texto));
        return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) {}
    let h = 5381; const s = 'agro::' + texto;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return 'f' + (h >>> 0).toString(16);
  }
  const getUsuarios = () => { const v = leer(K.usuarios, []); return Array.isArray(v) ? v : []; };

  async function registrar(d) {
    const correo = d.correo.trim().toLowerCase();
    if (getUsuarios().some((u) => u.correo === correo)) return { ok: false, error: 'Ese correo ya está registrado. Inicia sesión.' };
    const codigo = (d.codigo || '').trim();
    if (codigo && codigo !== CODIGO_DUENO) return { ok: false, campo: 'regCodigo', error: 'El código de administrador no es correcto. Déjalo vacío si eres cliente.' };
    const rol = codigo ? ROLES.DUENO : ROLES.CLIENTE;
    const u = { nombre: d.nombre.trim(), correo, telefono: (d.telefono || '').trim(), ciudad: (d.ciudad || '').trim(), rol, clave: await hash(d.password), creado: new Date().toISOString() };
    const arr = getUsuarios(); arr.push(u);
    if (!guardar(K.usuarios, arr)) return { ok: false, error: 'No se pudo guardar la cuenta (almacenamiento del navegador bloqueado).' };
    guardar(K.sesion, sesionDe(u));
    return { ok: true, rol };
  }
  async function iniciarSesion(correo, password) {
    const c = correo.trim().toLowerCase();
    const u = getUsuarios().find((x) => x.correo === c);
    if (!u || u.clave !== await hash(password)) return { ok: false, error: 'Correo o contraseña incorrectos.' };
    guardar(K.sesion, sesionDe(u));
    return { ok: true, rol: u.rol || ROLES.CLIENTE };
  }
  // Las cuentas creadas antes de los roles quedan como «cliente» (lo más seguro).
  const sesionDe = (u) => ({ nombre: u.nombre, correo: u.correo, telefono: u.telefono || '', ciudad: u.ciudad || '', rol: u.rol || ROLES.CLIENTE });
  const entrarComoInvitado = () => guardar(K.sesion, { nombre: 'Invitado', invitado: true, rol: ROLES.INVITADO });
  function getSesion() {
    const s = leer(K.sesion, null);
    if (s && !s.rol) s.rol = s.invitado ? ROLES.INVITADO : ROLES.CLIENTE;
    return s;
  }
  /** Rol actual: 'dueno' | 'cliente' | 'invitado' (sin sesión cuenta como invitado). */
  const getRol = () => { const s = getSesion(); return s ? s.rol : ROLES.INVITADO; };
  const esDueno = () => getRol() === ROLES.DUENO;
  /** Página de inicio de cada rol después de entrar. */
  const inicioDe = (rol) => (rol === ROLES.DUENO ? 'centro-principal.html' : 'nuevo-proyecto.html');
  function cerrarSesion() { try { localStorage.removeItem(K.sesion); } catch (e) {} }
  /** Para las páginas internas: si no hay sesión, manda a acceso.html y vuelve después. */
  function exigirSesion() {
    if (!getSesion()) {
      const volver = location.pathname.split('/').pop() + location.search;
      location.replace('acceso.html?volver=' + encodeURIComponent(volver));
      return false;
    }
    return true;
  }

  /* ---------- Utilidades de formato ---------- */
  const fechaLarga = (iso) => {
    const d = new Date(iso || Date.now());
    const mes = d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '').toUpperCase();
    return String(d.getDate()).padStart(2, '0') + ' ' + mes + ' ' + d.getFullYear();
  };
  const iniciales = (nombre) => (nombre || '?').split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();

  window.AgroDatos = {
    K, esc, uid, fechaLarga, iniciales,
    getPrecios, setPrecios, resetPrecios,
    getInsumos, addInsumo, delInsumo, setPrecioInsumo, setInsumos,
    ESTADOS, getProyectos, getProyecto, guardarProyecto, borrarProyecto, ciclarEstado, setEstado, restaurarProyecto, restaurarInsumo, restaurarObra, cargarEjemplos, proyectosCSV,
    getObras, addObra, delObra,
    setBorrador, tomarBorrador,
    registrar, iniciarSesion, entrarComoInvitado, getSesion, cerrarSesion, exigirSesion,
    ROLES, CLIENTE_VE_CANTIDADES, getRol, esDueno, inicioDe,
    ESTADOS_SOLICITUD, getSolicitudes, getSolicitud, misSolicitudes, pendientes, crearSolicitud, actualizarSolicitud, cancelarSolicitud, restaurarSolicitud,
    liberarCotizacion, cotizacionDeSolicitud,
  };
})();

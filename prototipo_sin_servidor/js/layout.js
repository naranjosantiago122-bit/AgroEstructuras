/*
 * AgroEstructura - Estructura común de las páginas internas:
 * barra superior + menú lateral (diseño de Stitch), avisos emergentes y botón del chat.
 * Uso: if (!AgroLayout.montar('cotizador')) return;                       // página para todos los roles
 *      if (!AgroLayout.montar('inventario', { soloDueno: true })) return;  // página solo del dueño
 * Los elementos con data-solo="dueno" o data-solo="cliente" se muestran solo a ese rol
 * (el invitado cuenta como cliente).
 */
(function () {
  // Menú según el rol
  const MENU = {
    dueno: [
      { id: 'dashboard', href: 'centro-principal.html', icono: 'space_dashboard', texto: 'Centro Principal' },
      { id: 'cotizador', href: 'nuevo-proyecto.html', icono: 'architecture', texto: 'Nuevo Proyecto' },
      { id: 'inventario', href: 'inventario.html', icono: 'inventory_2', texto: 'Inventario' },
      { id: 'portafolio', href: 'portafolio.html', icono: 'view_in_ar', texto: 'Portafolio' },
    ],
    cliente: [
      { id: 'cotizador', href: 'nuevo-proyecto.html', icono: 'architecture', texto: 'Diseñar mi invernadero' },
      { id: 'solicitudes', href: 'mis-solicitudes.html', icono: 'assignment', texto: 'Mis solicitudes' },
      { id: 'portafolio', href: 'portafolio.html', icono: 'view_in_ar', texto: 'Galería de trabajos' },
    ],
  };
  const NOMBRE_ROL = { dueno: 'Dueño', cliente: 'Cliente', invitado: 'Modo invitado' };

  const esc = (t) => AgroDatos.esc(t);
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : (varios || uno + 's')}`;

  function textoResumen() {
    const D = AgroDatos;
    if (D.esDueno()) return `${plural(D.getProyectos().length, 'presupuesto')} · ${plural(D.pendientes(), 'solicitud pendiente', 'solicitudes pendientes')}`;
    if (D.getRol() === D.ROLES.INVITADO) return 'Crea una cuenta para enviar solicitudes';
    return plural(D.misSolicitudes().length, 'solicitud enviada', 'solicitudes enviadas');
  }
  /** Actualiza el contador del menú lateral y el aviso de solicitudes pendientes. */
  function refrescarResumen() {
    const el = document.getElementById('resumenAlmacen');
    if (el) el.textContent = textoResumen();
    const b = document.getElementById('badgePendientes');
    if (b) { const n = AgroDatos.pendientes(); b.textContent = n; b.classList.toggle('hidden', !n); }
  }

  /** Muestra u oculta los elementos marcados con data-solo según el rol. */
  function aplicarRol(raiz) {
    const dueno = AgroDatos.esDueno();
    (raiz || document).querySelectorAll('[data-solo]').forEach((el) => {
      const ver = el.dataset.solo === 'dueno' ? dueno : !dueno;
      if (!ver) el.remove();   // se quita del documento (no solo se oculta)
    });
  }

  function enlaceNav(it, activo) {
    const on = it.id === activo;
    const cls = on
      ? 'bg-surface-container-highest text-primary font-bold'
      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-body-md text-body-md';
    return `<a href="${it.href}" ${on ? 'aria-current="page"' : ''} class="flex items-center gap-3 px-space-md py-2.5 rounded-lg transition-all ${cls}">
      <span class="material-symbols-outlined text-[20px]">${it.icono}</span><span class="flex-1">${it.texto}</span>${it.id === 'dashboard' ? '<span id="badgePendientes" class="hidden min-w-[22px] h-[22px] px-1.5 rounded-full bg-tertiary text-on-tertiary text-xs font-bold flex items-center justify-center" title="Solicitudes pendientes"></span>' : ''}</a>`;
  }

  /** Monta la barra y el menú. Devuelve false si redirigió (sin sesión o sin permiso). */
  function montar(activo, opciones) {
    if (!AgroDatos.exigirSesion()) return false;
    const ses = AgroDatos.getSesion() || { nombre: 'Invitado', invitado: true, rol: 'invitado' };
    const rol = ses.rol;
    if (opciones && opciones.soloDueno && rol !== AgroDatos.ROLES.DUENO) {
      location.replace(AgroDatos.inicioDe(rol) + '?sinPermiso=1');
      return false;
    }
    const ITEMS = MENU[rol === AgroDatos.ROLES.DUENO ? 'dueno' : 'cliente'];

    const shell = document.getElementById('shell');
    shell.innerHTML = `
    <header class="no-print fixed top-0 left-0 right-0 h-16 z-50 bg-surface-card/90 backdrop-blur-xl border-b border-border-grid shadow-[0_1px_8px_rgba(0,0,0,0.3)]">
      <div class="w-full h-16 px-gutter flex items-center justify-between gap-space-md">
        <div class="flex items-center gap-space-sm">
          <button id="btnMenu" type="button" aria-label="Abrir menú" class="lg:hidden p-2 rounded-lg text-on-surface-variant hover:bg-surface-container"><span class="material-symbols-outlined">menu</span></button>
          <a href="index.html" class="flex items-center gap-space-sm" title="Ir al inicio">
            <img src="img/logo.png" alt="AgroEstructuras" class="h-10 w-auto">
            <span class="hidden sm:flex flex-col leading-tight">
              <span class="flex items-center gap-space-xs"><span class="font-headline-sm text-headline-sm tracking-tight text-on-surface uppercase">AgroEstructura</span><span class="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 font-label-sm text-label-sm text-primary">V.2 PRO</span></span>
              <span class="font-body-sm text-body-sm text-on-surface-variant">Software Agrícola y Estructural</span>
            </span>
          </a>
        </div>
        <div class="relative flex items-center gap-space-sm">
          <div class="hidden md:flex flex-col text-right leading-tight">
            <span class="font-label-md text-label-md text-on-surface">${esc(ses.nombre)}</span>
            <span class="font-body-sm text-body-sm text-wireframe-blue">${esc(NOMBRE_ROL[rol] || 'Cliente')}${ses.correo ? ' · ' + esc(ses.correo) : ''}</span>
          </div>
          <button id="btnUsuario" type="button" aria-haspopup="true" aria-expanded="false" class="w-9 h-9 rounded-full bg-surface-container-highest ring-2 ring-primary/40 text-primary font-label-md text-label-md flex items-center justify-center">${esc(AgroDatos.iniciales(ses.nombre))}</button>
          <div id="menuUsuario" class="hidden absolute right-0 top-12 w-52 bg-surface-card border border-border-grid rounded-xl shadow-2xl p-1.5 z-50">
            <a href="index.html" class="flex items-center gap-2 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-body-md text-body-md"><span class="material-symbols-outlined text-[18px]">home</span>Página de inicio</a>
            <button id="btnSalir" type="button" class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-danger-alert/10 hover:text-danger-alert font-body-md text-body-md"><span class="material-symbols-outlined text-[18px]">logout</span>Cerrar sesión</button>
          </div>
        </div>
      </div>
    </header>

    <div id="velo" class="no-print hidden fixed inset-0 z-40 bg-canvas-void/70 lg:hidden"></div>
    <aside id="menuLateral" class="no-print fixed left-0 top-16 bottom-0 w-64 bg-surface-container-low border-r border-border-grid z-40 hidden lg:flex flex-col justify-between py-space-md">
      <div class="flex flex-col gap-space-xs px-space-sm">
        <div class="px-space-sm py-space-xs font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Menú</div>
        <nav class="flex flex-col gap-1">${ITEMS.map((it) => enlaceNav(it, activo)).join('')}</nav>
      </div>
      <div class="px-space-md">
        <div class="p-space-sm rounded-lg bg-surface-container border border-border-grid flex flex-col gap-1">
          <div class="flex items-center justify-between"><span class="font-label-sm text-label-sm text-on-surface-variant">${esc((NOMBRE_ROL[rol] || 'Cliente').toUpperCase())}</span><span class="font-label-sm text-label-sm text-spring-lime">EN ESTE NAVEGADOR</span></div>
          <span id="resumenAlmacen" class="font-body-sm text-body-sm text-wireframe-blue">${esc(textoResumen())}</span>
        </div>
      </div>
    </aside>
    <div id="toastContenedor" aria-live="polite"></div>`;

    // Menú móvil
    const aside = document.getElementById('menuLateral');
    const velo = document.getElementById('velo');
    const abrir = (v) => {
      aside.classList.toggle('hidden', !v); aside.classList.toggle('flex', v);
      velo.classList.toggle('hidden', !v);
    };
    document.getElementById('btnMenu').addEventListener('click', () => abrir(aside.classList.contains('hidden')));
    velo.addEventListener('click', () => abrir(false));

    // Menú de usuario
    const btnU = document.getElementById('btnUsuario');
    const menuU = document.getElementById('menuUsuario');
    btnU.addEventListener('click', (e) => {
      e.stopPropagation();
      const v = menuU.classList.toggle('hidden');
      btnU.setAttribute('aria-expanded', String(!v));
    });
    document.addEventListener('click', () => menuU.classList.add('hidden'));
    document.getElementById('btnSalir').addEventListener('click', () => { AgroDatos.cerrarSesion(); location.href = 'acceso.html'; });

    aplicarRol(document);
    refrescarResumen();
    if (new URLSearchParams(location.search).get('sinPermiso')) {
      toast('Sección solo para el dueño', 'Esa página tiene precios y solo la ve la cuenta del dueño.', 'info');
      try { const u = new URL(location.href); u.searchParams.delete('sinPermiso'); history.replaceState(null, '', u.pathname.split('/').pop() + u.search); } catch (e) {}
    }
    if (window.AgroChat) AgroChat.iniciar();
    return true;
  }

  /**
   * Aviso emergente. tipo: 'ok' | 'error' | 'info'
   * accion (opcional): { texto: 'Deshacer', fn: () => {...} } -> muestra un botón dentro del aviso.
   * Los errores y los avisos con acción duran más y se pueden cerrar con «×».
   */
  function toast(titulo, mensaje, tipo, accion) {
    let cont = document.getElementById('toastContenedor');
    if (!cont) { cont = document.createElement('div'); cont.id = 'toastContenedor'; cont.setAttribute('aria-live', 'polite'); document.body.appendChild(cont); }
    const icono = tipo === 'error' ? 'error' : (tipo === 'info' ? 'info' : 'task_alt');
    const color = tipo === 'error' ? 'text-danger-alert' : (tipo === 'info' ? 'text-secondary' : 'text-primary');
    const el = document.createElement('div');
    el.className = 'toast bg-surface-card border border-border-grid text-on-surface px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 max-w-sm';
    el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    el.innerHTML = `<span class="material-symbols-outlined ${color} text-[24px]">${icono}</span>
      <div class="flex-1 min-w-0"><div class="font-label-md text-label-md text-on-surface font-bold">${esc(titulo)}</div><div class="font-body-sm text-body-sm text-on-surface-variant">${esc(mensaje || '')}</div></div>
      ${accion ? `<button type="button" class="toast-accion">${esc(accion.texto)}</button>` : ''}
      <button type="button" class="toast-cerrar" aria-label="Cerrar aviso"><span class="material-symbols-outlined text-[18px]">close</span></button>`;
    cont.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));
    let cerrado = false;
    const cerrar = () => { if (cerrado) return; cerrado = true; el.classList.remove('visible'); setTimeout(() => el.remove(), 300); };
    el.querySelector('.toast-cerrar').addEventListener('click', cerrar);
    if (accion) el.querySelector('.toast-accion').addEventListener('click', () => { cerrar(); accion.fn(); });
    setTimeout(cerrar, (tipo === 'error' || accion) ? 7000 : 3500);
    return cerrar;
  }

  window.AgroLayout = { montar, toast, refrescarResumen, aplicarRol };
})();

/*
 * AgroEstructura - Estructura común de las páginas internas:
 * barra superior + menú lateral (diseño de Stitch), avisos emergentes y botón del chat.
 * Uso: AgroLayout.montar('cotizador');   // id de la página activa
 */
(function () {
  const ITEMS = [
    { id: 'dashboard', href: 'centro-principal.html', icono: 'space_dashboard', texto: 'Centro Principal' },
    { id: 'cotizador', href: 'nuevo-proyecto.html', icono: 'architecture', texto: 'Nuevo Proyecto' },
    { id: 'inventario', href: 'inventario.html', icono: 'inventory_2', texto: 'Inventario' },
    { id: 'portafolio', href: 'portafolio.html', icono: 'view_in_ar', texto: 'Portafolio' },
  ];

  const esc = (t) => AgroDatos.esc(t);

  const textoResumen = (p, i) => `${p} presupuesto${p === 1 ? '' : 's'} · ${i} insumo${i === 1 ? '' : 's'} libre${i === 1 ? '' : 's'}`;
  /** Actualiza el contador «Datos locales» del menú lateral. */
  function refrescarResumen() {
    const el = document.getElementById('resumenAlmacen');
    if (el) el.textContent = textoResumen(AgroDatos.getProyectos().length, AgroDatos.getInsumos().length);
  }

  function enlaceNav(it, activo) {
    const on = it.id === activo;
    const cls = on
      ? 'bg-surface-container-highest text-primary font-bold'
      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-body-md text-body-md';
    return `<a href="${it.href}" ${on ? 'aria-current="page"' : ''} class="flex items-center gap-3 px-space-md py-2.5 rounded-lg transition-all ${cls}">
      <span class="material-symbols-outlined text-[20px]">${it.icono}</span>${it.texto}</a>`;
  }

  function montar(activo) {
    if (!AgroDatos.exigirSesion()) return;
    const ses = AgroDatos.getSesion() || { nombre: 'Invitado', invitado: true };
    const nProy = AgroDatos.getProyectos().length;
    const nIns = AgroDatos.getInsumos().length;

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
            <span class="font-body-sm text-body-sm text-wireframe-blue">${ses.invitado ? 'Modo invitado' : esc(ses.correo || 'Sesión activa')}</span>
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
        <div class="px-space-sm py-space-xs font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Módulos de Ingeniería</div>
        <nav class="flex flex-col gap-1">${ITEMS.map((it) => enlaceNav(it, activo)).join('')}</nav>
      </div>
      <div class="px-space-md">
        <div class="p-space-sm rounded-lg bg-surface-container border border-border-grid flex flex-col gap-1">
          <div class="flex items-center justify-between"><span class="font-label-sm text-label-sm text-on-surface-variant">DATOS LOCALES</span><span class="font-label-sm text-label-sm text-spring-lime">EN ESTE NAVEGADOR</span></div>
          <span id="resumenAlmacen" class="font-body-sm text-body-sm text-wireframe-blue">${textoResumen(nProy, nIns)}</span>
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

    if (window.AgroChat) AgroChat.iniciar();
  }

  /** Aviso emergente. tipo: 'ok' | 'error' | 'info' */
  function toast(titulo, mensaje, tipo) {
    let cont = document.getElementById('toastContenedor');
    if (!cont) { cont = document.createElement('div'); cont.id = 'toastContenedor'; document.body.appendChild(cont); }
    const icono = tipo === 'error' ? 'error' : (tipo === 'info' ? 'info' : 'task_alt');
    const color = tipo === 'error' ? 'text-danger-alert' : (tipo === 'info' ? 'text-secondary' : 'text-primary');
    const el = document.createElement('div');
    el.className = 'toast bg-surface-card border border-border-grid text-on-surface px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 max-w-sm';
    el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    el.innerHTML = `<span class="material-symbols-outlined ${color} text-[24px]">${icono}</span><div><div class="font-label-md text-label-md text-on-surface font-bold">${esc(titulo)}</div><div class="font-body-sm text-body-sm text-on-surface-variant">${esc(mensaje || '')}</div></div>`;
    cont.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));
    setTimeout(() => { el.classList.remove('visible'); setTimeout(() => el.remove(), 300); }, 3200);
  }

  window.AgroLayout = { montar, toast, refrescarResumen };
})();

/* AgroEstructura - Portafolio de obras (con fotos guardadas en el navegador). */
(function () {
  const $ = (id) => document.getElementById(id);
  const D = AgroDatos, esc = D.esc;
  AgroLayout.montar('portafolio');
  if (!D.getSesion()) return;

  const TIPOS = {
    tubular: { nombre: 'Metálico Tubular', badge: 'text-wireframe-blue', punto: 'bg-wireframe-blue', trazo: 'text-wireframe-blue' },
    guadua: { nombre: 'Capilla de Guadua', badge: 'text-tertiary', punto: 'bg-tertiary', trazo: 'text-tertiary' },
    tunel: { nombre: 'Cubierta tipo túnel', badge: 'text-spring-lime', punto: 'bg-spring-lime', trazo: 'text-spring-lime' },
    riego: { nombre: 'Riego / ventilación', badge: 'text-secondary', punto: 'bg-secondary', trazo: 'text-secondary' },
  };
  let filtro = 'all';
  let fotoData = null;
  const fN = (n) => new Intl.NumberFormat('es-CO').format(n);

  /* ---------- Pintar ---------- */
  function filtros(obras) {
    const cuenta = (t) => obras.filter((o) => o.tipo === t).length;
    const botones = [['all', `Todas las obras (${obras.length})`]].concat(Object.keys(TIPOS).map((t) => [t, `${TIPOS[t].nombre} (${cuenta(t)})`]));
    $('filtros').innerHTML = botones.map(([k, txt]) => {
      const on = k === filtro;
      return `<button type="button" role="tab" aria-selected="${on}" data-filtro="${k}" class="px-4 py-2 rounded-lg font-label-sm text-label-sm uppercase tracking-wider whitespace-nowrap transition-all ${on ? 'bg-surface-container-highest text-primary font-bold shadow-sm' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}">${esc(txt)}</button>`;
    }).join('');
  }

  function tarjeta(o) {
    const t = TIPOS[o.tipo] || TIPOS.tubular;
    const dims = (o.largo && o.ancho) ? `${o.largo} × ${o.ancho} m (${fN(o.largo * o.ancho)} m²)` : 'No registradas';
    const media = o.foto
      ? `<img src="${o.foto}" alt="Foto de ${esc(o.nombre)}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">`
      : `<div class="absolute inset-0 flex flex-col items-center justify-center bg-surface-container-highest text-center p-3"><span class="material-symbols-outlined text-4xl ${t.badge} mb-1">image</span><span class="font-label-md text-label-md text-on-surface-variant uppercase">Sin fotografía</span></div>`;
    return `<article class="proyecto flex flex-col bg-surface-card rounded-xl overflow-hidden shadow-lg border border-border-grid transition-all duration-300 hover:-translate-y-1 group">
      <div class="relative w-full h-56 bg-surface-container-lowest overflow-hidden">${media}
        <span class="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-surface-dim/80 backdrop-blur-md font-label-sm text-label-sm ${t.badge} uppercase font-bold tracking-wider">${esc(t.nombre)}</span>
        ${o.anio ? `<span class="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-surface-dim/90 font-label-sm text-label-sm text-spring-lime font-mono">Año ${esc(o.anio)}</span>` : ''}</div>
      <div class="p-4 flex flex-col flex-1 justify-between gap-4">
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm"><span class="material-symbols-outlined text-[16px] text-primary">location_on</span><span>${esc(o.ubicacion || 'Sin ubicación')}</span></div>
          <h2 class="font-headline-sm text-headline-sm text-on-surface font-bold leading-snug">${esc(o.nombre)}</h2>
          ${o.notas ? `<p class="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">${esc(o.notas)}</p>` : ''}
        </div>
        <div class="bg-surface-container-low p-3 rounded-lg flex flex-col gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
          <div class="flex items-center justify-between"><span>Dimensiones:</span><span class="text-on-surface font-semibold">${esc(dims)}</span></div>
          <div class="flex items-center justify-between"><span>Estructura:</span><span class="text-on-surface font-semibold">${esc(t.nombre)}</span></div>
        </div>
        <div class="flex gap-2">
          <button type="button" data-ficha="${esc(o.id)}" class="flex-1 py-2.5 px-3 rounded-lg bg-surface-container-high hover:bg-primary hover:text-on-primary text-on-surface font-label-lg text-label-lg font-semibold flex items-center justify-center gap-2 transition-all"><span class="material-symbols-outlined text-[18px]">engineering</span>Ver ficha técnica</button>
          <button type="button" data-borrar="${esc(o.id)}" title="Eliminar obra" aria-label="Eliminar ${esc(o.nombre)}" class="px-3 rounded-lg text-on-surface-variant hover:text-danger-alert hover:bg-danger-alert/10 border border-border-grid"><span class="material-symbols-outlined text-[20px]">delete</span></button>
        </div>
      </div></article>`;
  }

  function distribucion(obras) {
    const sec = $('distribucion');
    if (!obras.length) { sec.classList.add('hidden'); return; }
    sec.classList.remove('hidden');
    $('totalDistrib').textContent = `Total: ${obras.length} obra${obras.length === 1 ? '' : 's'}`;
    $('donutN').textContent = obras.length;
    const trayecto = 'M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831';
    let acum = 0, svg = `<path class="text-surface-container-lowest" d="${trayecto}" fill="none" stroke="currentColor" stroke-width="3.8"></path>`, ley = '';
    Object.keys(TIPOS).forEach((k) => {
      const n = obras.filter((o) => o.tipo === k).length; if (!n) return;
      const pct = n / obras.length * 100;
      svg += `<path class="${TIPOS[k].trazo}" d="${trayecto}" fill="none" stroke="currentColor" stroke-width="3.8" stroke-dasharray="${pct.toFixed(2)}, 100" stroke-dashoffset="${(-acum).toFixed(2)}"></path>`;
      acum += pct;
      ley += `<div class="flex items-center justify-between"><span class="flex items-center gap-1.5 text-on-surface-variant"><span class="w-2.5 h-2.5 rounded-full ${TIPOS[k].punto}"></span>${esc(TIPOS[k].nombre)}</span><span class="font-mono text-on-surface font-semibold">${n} (${Math.round(pct)}%)</span></div>`;
    });
    $('donut').innerHTML = svg; $('leyenda').innerHTML = ley;
  }

  function pintar() {
    const obras = D.getObras();
    $('chipTotal').textContent = `${obras.length} obra${obras.length === 1 ? '' : 's'}`;
    filtros(obras);
    const visibles = obras.filter((o) => filtro === 'all' || o.tipo === filtro);
    $('grilla').innerHTML = visibles.map(tarjeta).join('');
    $('vacio').classList.toggle('hidden', obras.length > 0);
    if (obras.length && !visibles.length) $('grilla').innerHTML = '<p class="col-span-full text-center text-on-surface-variant py-10">No hay obras de este tipo.</p>';
    distribucion(obras);
  }

  /* ---------- Modales ---------- */
  let ultimoFoco = null;
  function abrir(m) { ultimoFoco = document.activeElement; m.classList.remove('hidden'); m.classList.add('flex'); const f = m.querySelector('input,button,select'); if (f) setTimeout(() => f.focus(), 30); }
  function cerrar(m) { m.classList.add('hidden'); m.classList.remove('flex'); if (ultimoFoco) ultimoFoco.focus(); }
  ['modalFicha', 'modalNueva'].forEach((id) => {
    const m = $(id);
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-cerrar]')) cerrar(m); });
    m.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(m); });
  });

  function ficha(id) {
    const o = D.getObras().find((x) => x.id === id); if (!o) return;
    const t = TIPOS[o.tipo] || TIPOS.tubular;
    $('fichaTitulo').textContent = o.nombre;
    $('fichaSub').textContent = `${t.nombre}${o.ubicacion ? ' · ' + o.ubicacion : ''}${o.anio ? ' · ' + o.anio : ''}`;
    const dato = (a, b) => `<div><span class="text-on-surface-variant block">${a}</span><span class="text-on-surface font-semibold">${esc(b)}</span></div>`;
    const puedeCotizar = (o.tipo === 'tubular' || o.tipo === 'guadua') && o.largo && o.ancho;
    $('fichaCuerpo').innerHTML = `
      ${o.foto ? `<img src="${o.foto}" alt="Foto de ${esc(o.nombre)}" class="w-full max-h-72 object-cover rounded-lg">` : ''}
      <div class="p-4 rounded-lg bg-surface-container-low grid grid-cols-2 gap-3 font-body-sm text-body-sm">
        ${dato('Estructura', t.nombre)}${dato('Ubicación', o.ubicacion || 'No registrada')}
        ${dato('Dimensiones', o.largo && o.ancho ? `${o.largo} × ${o.ancho} m` : 'No registradas')}${dato('Área', o.largo && o.ancho ? `${fN(o.largo * o.ancho)} m²` : '—')}
        ${dato('Año de ejecución', o.anio || 'No registrado')}</div>
      ${o.notas ? `<div class="p-4 rounded-lg bg-surface-container-low"><span class="font-label-sm text-label-sm text-spring-lime uppercase font-semibold">Descripción</span><p class="font-body-md text-body-md text-on-surface mt-1 whitespace-pre-line">${esc(o.notas)}</p></div>` : ''}
      ${puedeCotizar ? `<button type="button" id="btnDuplicar" data-id="${esc(o.id)}" class="self-end px-4 py-2 bg-primary hover:bg-spring-lime text-on-primary font-label-md text-label-md rounded-lg flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">calculate</span>Cotizar una estructura igual</button>` : ''}`;
    abrir($('modalFicha'));
  }

  /* ---------- Eventos ---------- */
  $('filtros').addEventListener('click', (e) => { const b = e.target.closest('[data-filtro]'); if (b) { filtro = b.dataset.filtro; pintar(); } });
  $('grilla').addEventListener('click', (e) => {
    const f = e.target.closest('[data-ficha]'); if (f) { ficha(f.dataset.ficha); return; }
    const b = e.target.closest('[data-borrar]');
    if (b) { const o = D.getObras().find((x) => x.id === b.dataset.borrar); if (o && confirm(`¿Eliminar la obra «${o.nombre}»?`)) { D.delObra(o.id); pintar(); AgroLayout.toast('Obra eliminada', o.nombre); } }
  });
  $('fichaCuerpo').addEventListener('click', (e) => {
    const b = e.target.closest('#btnDuplicar'); if (!b) return;
    const o = D.getObras().find((x) => x.id === b.dataset.id); if (!o) return;
    D.setBorrador({ params: { tipo: o.tipo === 'guadua' ? 'Guadua' : 'Tubular', largo: o.largo, ancho: o.ancho }, cliente: '' });
    location.href = 'nuevo-proyecto.html?borrador=1';
  });

  const abrirNueva = () => { $('formObra').reset(); fotoData = null; previa(null); $('errObra').classList.add('hidden'); $('oAnio').value = new Date().getFullYear(); abrir($('modalNueva')); };
  $('btnNueva').addEventListener('click', abrirNueva); $('btnNueva2').addEventListener('click', abrirNueva);

  function previa(src) {
    $('oFotoPrevia').classList.toggle('hidden', !src); if (src) $('oFotoPrevia').src = src;
    $('oFotoIcono').classList.toggle('hidden', !!src);
    $('oFotoTexto').textContent = src ? 'Clic para cambiar la imagen' : 'Haz clic para elegir una imagen (JPG o PNG)';
  }
  // Reduce la foto a máx. 900 px para que quepa en el almacenamiento del navegador
  $('oFoto').addEventListener('change', () => {
    const f = $('oFoto').files[0]; if (!f) return;
    if (!/^image\//.test(f.type)) { AgroLayout.toast('Archivo no válido', 'Elige una imagen JPG o PNG.', 'error'); return; }
    const lector = new FileReader();
    lector.onload = () => {
      const img = new Image();
      img.onload = () => {
        const esc9 = Math.min(1, 900 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * esc9); c.height = Math.round(img.height * esc9);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        fotoData = c.toDataURL('image/jpeg', 0.8); previa(fotoData);
      };
      img.onerror = () => AgroLayout.toast('No se pudo leer la imagen', 'Prueba con otro archivo.', 'error');
      img.src = lector.result;
    };
    lector.readAsDataURL(f);
  });

  $('formObra').addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = $('oNombre').value.trim(), ubic = $('oUbicacion').value.trim();
    const largo = parseFloat($('oLargo').value), ancho = parseFloat($('oAncho').value), anio = parseInt($('oAnio').value, 10);
    let msg = '';
    if (!nombre) msg = 'Escribe el nombre de la obra.';
    else if (!ubic) msg = 'Escribe la ubicación (municipio).';
    else if (($('oLargo').value && !(largo > 0)) || ($('oAncho').value && !(ancho > 0))) msg = 'Las medidas deben ser mayores que 0.';
    else if (!!$('oLargo').value !== !!$('oAncho').value) msg = 'Escribe largo y ancho, o deja ambos vacíos.';
    else if ($('oAnio').value && !(anio >= 1990 && anio <= new Date().getFullYear() + 1)) msg = 'Escribe un año válido.';
    $('errObra').textContent = msg; $('errObra').classList.toggle('hidden', !msg);
    if (msg) return;
    const obra = D.addObra({ nombre, tipo: $('oTipo').value, ubicacion: ubic, largo: largo || null, ancho: ancho || null, anio: anio || null, notas: $('oNotas').value.trim(), foto: fotoData });
    if (!obra) { $('errObra').textContent = 'No se pudo guardar: el almacenamiento del navegador está lleno. Prueba sin foto o con una más pequeña.'; $('errObra').classList.remove('hidden'); return; }
    cerrar($('modalNueva')); filtro = 'all'; pintar(); AgroLayout.toast('Obra registrada', nombre);
  });

  pintar();
})();

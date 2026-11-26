/* AgroEstructura - Página de acceso (registro e inicio de sesión), conectada al servidor. */
(async function () {
  const $ = (id) => document.getElementById(id);
  const D = AgroDatos;

  // Página a la que volver después de entrar (solo páginas propias, por seguridad)
  const v = new URLSearchParams(location.search).get('volver') || '';
  const volverValido = /^[a-z0-9\-]+\.html(\?[\w=&%\-]*)?$/i.test(v) ? v : '';
  // Sin «volver», cada rol entra a su página: el dueño al Centro Principal, el cliente al diseñador
  const destino = (rol) => volverValido || D.inicioDe(rol);

  // Viene de «Enviar solicitud» sin cuenta: se explica por qué está aquí
  if (new URLSearchParams(location.search).get('motivo') === 'solicitud') {
    const p = document.createElement('p');
    p.className = 'max-w-xl mx-auto mb-6 p-4 rounded-xl bg-surface-card border border-primary/30 text-sm text-on-surface flex gap-2 items-start';
    p.setAttribute('role', 'status');
    p.innerHTML = '<span class="material-symbols-outlined text-primary text-[20px]">info</span><span>Para enviar tu solicitud necesitamos tus datos de contacto. <b>Crea una cuenta o inicia sesión</b>: tu diseño quedó guardado y lo verás al volver.</span>';
    $('avisoSesion').before(p);
  }

  // ¿Ya hay una sesión abierta en el servidor?
  const carga = await D.iniciar({ datos: false });
  if (!carga.ok) { $('errLogin').textContent = carga.error; $('errLogin').classList.remove('hidden'); }
  const ses = D.getSesion();
  if (ses && ses.rol !== D.ROLES.INVITADO) {
    $('avisoSesion').classList.remove('hidden');
    $('nombreSesion').textContent = ses.nombre;
    $('btnContinuar').href = destino(ses.rol);
    $('btnCambiar').addEventListener('click', async () => { await D.cerrarSesion(); $('avisoSesion').classList.add('hidden'); });
  }

  function marcar(id, mensaje) {
    const p = document.querySelector(`.err[data-for="${id}"]`); const i = $(id);
    if (p) { p.textContent = mensaje || ''; p.classList.toggle('hidden', !mensaje); }
    if (i) i.classList.toggle('border-danger-alert', !!mensaje);
    return !mensaje;
  }
  const mostrar = (id, msg) => { const e = $(id); e.textContent = msg; e.classList.toggle('hidden', !msg); };

  /* ---------- Tipo de cuenta: usuario o administrador ---------- */
  const tipoCuenta = () => (document.querySelector('input[name=tipoCuenta]:checked') || {}).value || 'usuario';
  function cambiarTipo() {
    const admin = tipoCuenta() === 'administrador';
    $('bloqueClaveAdmin').classList.toggle('hidden', !admin);
    $('txtCrearCuenta').textContent = admin ? 'CREAR CUENTA DE ADMINISTRADOR' : 'CREAR CUENTA DE CLIENTE';
    if (admin) $('regCodigo').focus();
    else { $('regCodigo').value = ''; marcar('regCodigo', ''); }
  }
  document.querySelectorAll('input[name=tipoCuenta]').forEach((r) => r.addEventListener('change', cambiarTipo));
  $('btnVerCodigo').addEventListener('click', () => {
    const i = $('regCodigo'); const oculto = i.type === 'password';
    i.type = oculto ? 'text' : 'password'; $('btnVerCodigo').firstElementChild.textContent = oculto ? 'visibility_off' : 'visibility';
  });

  $('formRegistro').addEventListener('submit', async (e) => {
    e.preventDefault(); mostrar('errRegistro', '');
    const nombre = $('regNombre').value.trim(), correo = $('regCorreo').value.trim(), clave = $('regClave').value;
    const tipo = tipoCuenta(), codigo = tipo === 'administrador' ? $('regCodigo').value.trim() : '';
    let ok = true;
    ok = marcar('regCodigo', tipo === 'administrador' && !codigo ? 'Escribe la clave de administrador. Si no la tienes, elige «Cliente».' : '') && ok;
    ok = marcar('regNombre', nombre.length < 3 ? 'Escribe tu nombre completo.' : '') && ok;
    ok = marcar('regCorreo', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo) ? '' : 'Escribe un correo válido, por ejemplo nombre@correo.com.') && ok;
    ok = marcar('regClave', (clave.length >= 8 && /[a-zA-Z]/.test(clave) && /\d/.test(clave)) ? '' : 'Mínimo 8 caracteres, con al menos una letra y un número.') && ok;
    if (!ok) { const primero = document.querySelector('#formRegistro .err:not(.hidden)'); if (primero) { const c = $(primero.dataset.for); if (c) c.focus(); } return; }
    const soltar = AgroLayout.ocupado(e.submitter);
    const r = await D.registrar({ nombre, correo, telefono: $('regTel').value, ciudad: $('regCiudad').value, password: clave, tipo, codigo });
    if (!r.ok) { soltar(); if (r.campo && $(r.campo)) marcar(r.campo, r.error); else mostrar('errRegistro', r.error); return; }
    location.href = destino(r.rol);
  });

  $('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault(); mostrar('errLogin', '');
    const correo = $('logCorreo').value.trim(), clave = $('logClave').value;
    if (!correo || !clave) { mostrar('errLogin', 'Escribe tu correo y tu contraseña.'); return; }
    const soltar = AgroLayout.ocupado(e.submitter);
    const r = await D.iniciarSesion(correo, clave);
    if (!r.ok) { soltar(); mostrar('errLogin', r.error); return; }
    location.href = destino(r.rol);
  });

  $('btnVer').addEventListener('click', () => {
    const i = $('logClave'); const oculto = i.type === 'password';
    i.type = oculto ? 'text' : 'password'; $('iconoVer').textContent = oculto ? 'visibility_off' : 'visibility';
  });
  $('btnOlvido').addEventListener('click', () => $('msgOlvido').classList.toggle('hidden'));
  $('btnInvitado').addEventListener('click', async () => { await D.entrarComoInvitado(); location.href = destino(D.ROLES.INVITADO); });
})();

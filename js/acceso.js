/* AgroEstructura - Página de acceso (registro e inicio de sesión). */
(function () {
  const $ = (id) => document.getElementById(id);
  const D = AgroDatos;

  // Página a la que volver después de entrar (solo páginas propias, por seguridad)
  const v = new URLSearchParams(location.search).get('volver') || '';
  const destino = /^[a-z0-9\-]+\.html(\?[\w=&%\-]*)?$/i.test(v) ? v : 'centro-principal.html';

  const ses = D.getSesion();
  if (ses) {
    $('avisoSesion').classList.remove('hidden');
    $('nombreSesion').textContent = ses.nombre;
    $('btnContinuar').href = destino;
    $('btnCambiar').addEventListener('click', () => { D.cerrarSesion(); $('avisoSesion').classList.add('hidden'); });
  }

  function marcar(id, mensaje) {
    const p = document.querySelector(`.err[data-for="${id}"]`); const i = $(id);
    if (p) { p.textContent = mensaje || ''; p.classList.toggle('hidden', !mensaje); }
    if (i) i.classList.toggle('border-danger-alert', !!mensaje);
    return !mensaje;
  }
  const mostrar = (id, msg) => { const e = $(id); e.textContent = msg; e.classList.toggle('hidden', !msg); };

  $('formRegistro').addEventListener('submit', async (e) => {
    e.preventDefault(); mostrar('errRegistro', '');
    const nombre = $('regNombre').value.trim(), correo = $('regCorreo').value.trim(), clave = $('regClave').value;
    let ok = true;
    ok = marcar('regNombre', nombre.length < 3 ? 'Escribe tu nombre completo.' : '') && ok;
    ok = marcar('regCorreo', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo) ? '' : 'Escribe un correo válido, por ejemplo nombre@correo.com.') && ok;
    ok = marcar('regClave', (clave.length >= 8 && /[a-zA-Z]/.test(clave) && /\d/.test(clave)) ? '' : 'Mínimo 8 caracteres, con al menos una letra y un número.') && ok;
    if (!ok) return;
    const r = await D.registrar({ nombre, correo, telefono: $('regTel').value, ciudad: $('regCiudad').value, password: clave });
    if (!r.ok) { mostrar('errRegistro', r.error); return; }
    location.href = destino;
  });

  $('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault(); mostrar('errLogin', '');
    const correo = $('logCorreo').value.trim(), clave = $('logClave').value;
    if (!correo || !clave) { mostrar('errLogin', 'Escribe tu correo y tu contraseña.'); return; }
    const r = await D.iniciarSesion(correo, clave);
    if (!r.ok) { mostrar('errLogin', r.error); return; }
    location.href = destino;
  });

  $('btnVer').addEventListener('click', () => {
    const i = $('logClave'); const oculto = i.type === 'password';
    i.type = oculto ? 'text' : 'password'; $('iconoVer').textContent = oculto ? 'visibility_off' : 'visibility';
  });
  $('btnOlvido').addEventListener('click', () => $('msgOlvido').classList.toggle('hidden'));
  $('btnInvitado').addEventListener('click', () => { D.entrarComoInvitado(); location.href = destino; });
})();

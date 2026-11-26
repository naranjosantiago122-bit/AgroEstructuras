"""
Sesión y permisos.
- La sesión es una cookie firmada de Flask (HttpOnly, SameSite=Lax) que solo guarda el id del usuario.
- El rol se lee SIEMPRE de la base de datos en cada petición (no se confía en lo que mande el navegador).
- @requiere_sesion: cualquier usuario con cuenta.  @requiere_dueno: solo el rol «dueno».
"""
from functools import wraps

from flask import g, jsonify, session

import db


def usuario_actual():
    if "usuario" in g:
        return g.usuario
    g.usuario = None
    uid = session.get("id_usuario")
    if uid:
        g.usuario = db.uno(
            """SELECT u.id_usuario, u.nombre, u.correo, u.telefono, u.ciudad, r.nombre AS rol
               FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol
               WHERE u.id_usuario = %s AND u.activo = 1""",
            (uid,),
        )
        if g.usuario is None:
            session.clear()
    return g.usuario


def es_dueno():
    u = usuario_actual()
    return bool(u and u["rol"] == "dueno")


def error(mensaje, estado=400, **extra):
    return jsonify({"ok": False, "error": mensaje, **extra}), estado


def requiere_sesion(f):
    @wraps(f)
    def envoltura(*args, **kwargs):
        if not usuario_actual():
            return error("Inicia sesión para continuar.", 401)
        return f(*args, **kwargs)
    return envoltura


def requiere_dueno(f):
    @wraps(f)
    def envoltura(*args, **kwargs):
        if not usuario_actual():
            return error("Inicia sesión para continuar.", 401)
        if not es_dueno():
            return error("Esta sección es solo para el dueño.", 403)
        return f(*args, **kwargs)
    return envoltura


def publico_usuario(u):
    """Datos del usuario que se pueden enviar al navegador (nunca la clave)."""
    if not u:
        return None
    return {"id": u["id_usuario"], "nombre": u["nombre"], "correo": u["correo"],
            "telefono": u["telefono"] or "", "ciudad": u["ciudad"] or "", "rol": u["rol"]}

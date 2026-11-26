"""API de cuentas: registro, inicio y cierre de sesión."""
import hmac
import re
import threading
import time

import pymysql
from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

import config
import db
from seguridad import error, publico_usuario, usuario_actual

bp = Blueprint("cuentas", __name__, url_prefix="/api")

CORREO = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
# Hash que se compara cuando el correo no existe, para que la respuesta tarde lo mismo
_HASH_FALSO = generate_password_hash("clave-que-no-existe-123")


# Límite de intentos con la clave de administrador (evita adivinarla probando muchas veces)
MAX_INTENTOS_CLAVE = 5
VENTANA_SEGUNDOS = 15 * 60
_intentos = {}  # ip -> [momentos de los intentos fallidos]
_candado = threading.Lock()


def _bloqueado(ip):
    ahora = time.time()
    with _candado:
        recientes = [t for t in _intentos.get(ip, []) if ahora - t < VENTANA_SEGUNDOS]
        _intentos[ip] = recientes
        return len(recientes) >= MAX_INTENTOS_CLAVE


def _fallo_clave(ip):
    with _candado:
        _intentos.setdefault(ip, []).append(time.time())


def _texto(datos, clave, maximo):
    return str(datos.get(clave) or "").strip()[:maximo]


@bp.get("/sesion")
def ver_sesion():
    return jsonify({"ok": True, "usuario": publico_usuario(usuario_actual())})


@bp.post("/registro")
def registro():
    d = request.get_json(silent=True) or {}
    nombre, correo = _texto(d, "nombre", 100), _texto(d, "correo", 120).lower()
    telefono, ciudad = _texto(d, "telefono", 20), _texto(d, "ciudad", 80)
    clave, codigo = str(d.get("clave") or ""), str(d.get("codigo") or "").strip()
    # Tipo de cuenta elegido en el formulario. Sin «tipo» (versiones viejas), manda el código como antes.
    tipo = str(d.get("tipo") or ("administrador" if codigo else "usuario"))
    if tipo not in ("usuario", "administrador"):
        return error("Elige el tipo de cuenta: usuario o administrador.", 400)
    if tipo == "usuario":
        codigo = ""  # una cuenta de usuario nunca se vuelve administrador

    ip = request.remote_addr or "?"
    if tipo == "administrador":
        if _bloqueado(ip):
            return error("Demasiados intentos con la clave de administrador. Espera 15 minutos e inténtalo de nuevo.", 429, campo="regCodigo")
        if not codigo:
            return error("Escribe la clave de administrador. Si no la tienes, elige «Cliente».", 400, campo="regCodigo")

    errores = {}
    if len(nombre) < 3:
        errores["regNombre"] = "Escribe tu nombre completo."
    if not CORREO.match(correo):
        errores["regCorreo"] = "Escribe un correo válido, por ejemplo nombre@correo.com."
    if len(clave) < 8 or not re.search(r"[A-Za-z]", clave) or not re.search(r"\d", clave) or len(clave) > 128:
        errores["regClave"] = "Mínimo 8 caracteres, con al menos una letra y un número."
    if tipo == "administrador" and not (config.CODIGO_DUENO and hmac.compare_digest(codigo, config.CODIGO_DUENO)):
        _fallo_clave(ip)
        errores["regCodigo"] = "La clave de administrador no es correcta. Si no la tienes, elige «Cliente»."
    if errores:
        campo, mensaje = next(iter(errores.items()))
        return error(mensaje, 400, campo=campo, errores=errores)

    rol = "dueno" if tipo == "administrador" else "cliente"
    try:
        uid = db.ejecutar(
            """INSERT INTO usuarios (id_rol, nombre, correo, telefono, ciudad, clave_hash)
               VALUES ((SELECT id_rol FROM roles WHERE nombre = %s), %s, %s, %s, %s, %s)""",
            (rol, nombre, correo, telefono or None, ciudad or None, generate_password_hash(clave)),
        )
        db.confirmar()
    except pymysql.err.IntegrityError:
        return error("Ese correo ya está registrado. Inicia sesión.", 409, campo="regCorreo")
    session.clear()
    session["id_usuario"] = uid
    return jsonify({"ok": True, "usuario": publico_usuario(usuario_actual())}), 201


@bp.post("/login")
def login():
    d = request.get_json(silent=True) or {}
    correo, clave = _texto(d, "correo", 120).lower(), str(d.get("clave") or "")
    if not correo or not clave:
        return error("Escribe tu correo y tu contraseña.")
    fila = db.uno("SELECT id_usuario, clave_hash FROM usuarios WHERE correo = %s AND activo = 1", (correo,))
    valido = check_password_hash(fila["clave_hash"] if fila else _HASH_FALSO, clave)
    if not fila or not valido:
        return error("Correo o contraseña incorrectos.", 401)
    session.clear()
    session["id_usuario"] = fila["id_usuario"]
    return jsonify({"ok": True, "usuario": publico_usuario(usuario_actual())})


@bp.post("/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})

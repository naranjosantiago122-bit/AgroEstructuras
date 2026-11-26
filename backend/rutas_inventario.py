"""
API del inventario (solo dueño) y del portafolio de obras (ver: todos; editar: dueño).
Cada cambio de precio queda en historial_precios con el usuario que lo hizo.
"""
import base64
import binascii
import uuid
from datetime import datetime

from flask import Blueprint, jsonify, request

import calculo
import config
import db
import modelo
from seguridad import error, requiere_dueno, usuario_actual

bp = Blueprint("inventario", __name__, url_prefix="/api")


def _precio(valor, minimo=0.0):
    try:
        n = float(valor)
    except (TypeError, ValueError):
        return None
    return n if minimo <= n <= 1_000_000_000 else None


def _cambiar_precio(id_material, precio):
    actual = db.uno("SELECT precio_unitario FROM materiales WHERE id_material = %s", (id_material,))
    if actual and float(actual["precio_unitario"]) != precio:
        db.ejecutar("UPDATE materiales SET precio_unitario = %s WHERE id_material = %s", (precio, id_material))
        db.ejecutar("INSERT INTO historial_precios (id_material, precio, id_usuario) VALUES (%s, %s, %s)",
                    (id_material, precio, usuario_actual()["id_usuario"]))


# ============================================================ precios base
@bp.get("/precios")
@requiere_dueno
def ver_precios():
    return jsonify({"ok": True, "precios": {k: v["precio"] for k, v in modelo.precios_actuales()["base"].items()}})


def _guardar_precios(nuevos):
    base = modelo.precios_actuales()["base"]
    limpios = {}
    for codigo in base:
        p = _precio(nuevos.get(codigo), minimo=0.01)
        if p is None:
            return error("Todos los precios base deben ser mayores que 0.", 400, campo=codigo)
        limpios[codigo] = p
    for codigo, p in limpios.items():
        _cambiar_precio(base[codigo]["id"], p)
    db.confirmar()
    return jsonify({"ok": True, "precios": limpios})


@bp.put("/precios")
@requiere_dueno
def guardar_precios():
    return _guardar_precios(request.get_json(silent=True) or {})


@bp.post("/precios/restablecer")
@requiere_dueno
def restablecer_precios():
    return _guardar_precios(calculo.PRECIOS_BASE)


# ============================================================ insumos adicionales
def _insumo_json(r):
    return {"id": r["id_material"], "nombre": r["nombre"], "precio": modelo.f(r["precio_unitario"]), "unidad": r["unidad"]}


@bp.get("/insumos")
@requiere_dueno
def listar_insumos():
    filas = db.todos("SELECT * FROM materiales WHERE tipo = 'insumo' AND activo = 1 ORDER BY id_material DESC")
    return jsonify({"ok": True, "insumos": [_insumo_json(r) for r in filas]})


@bp.post("/insumos")
@requiere_dueno
def crear_insumo():
    d = request.get_json(silent=True) or {}
    nombre = str(d.get("nombre") or "").strip()[:100]
    precio = _precio(d.get("precio"), minimo=0.01)
    if not nombre:
        return error("Escribe el nombre del insumo.", 400, campo="insumoNombre")
    if precio is None:
        return error("Escribe un precio mayor que 0.", 400, campo="insumoPrecio")
    mid = db.ejecutar("INSERT INTO materiales (nombre, unidad, precio_unitario, tipo) VALUES (%s, 'Unidad', %s, 'insumo')", (nombre, precio))
    db.ejecutar("INSERT INTO historial_precios (id_material, precio, id_usuario) VALUES (%s, %s, %s)", (mid, precio, usuario_actual()["id_usuario"]))
    db.confirmar()
    return jsonify({"ok": True, "insumo": _insumo_json(db.uno("SELECT * FROM materiales WHERE id_material = %s", (mid,)))}), 201


@bp.patch("/insumos/<int:id_material>")
@requiere_dueno
def editar_insumo(id_material):
    d = request.get_json(silent=True) or {}
    if not db.uno("SELECT 1 AS x FROM materiales WHERE id_material = %s AND tipo = 'insumo'", (id_material,)):
        return error("No encontré ese insumo.", 404)
    if "precio" in d:
        precio = _precio(d.get("precio"))
        if precio is None:
            return error("Escribe un precio válido.")
        _cambiar_precio(id_material, precio)
    if "activo" in d:  # eliminar = desactivar (los presupuestos viejos lo siguen nombrando); deshacer = reactivar
        db.ejecutar("UPDATE materiales SET activo = %s WHERE id_material = %s", (int(bool(d["activo"])), id_material))
    db.confirmar()
    return jsonify({"ok": True})


# ============================================================ obras (portafolio)
CATEGORIA = {"tubular": "Metálico Tubular", "guadua": "Capilla de Guadua", "tunel": "Cubierta tipo túnel", "riego": "Sistema de riego / ventilación"}
TIPO_OBRA = {v: k for k, v in CATEGORIA.items()}
FOTOS = config.UPLOADS / "obras"
FORMATOS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
FIRMAS = {"jpg": (b"\xff\xd8\xff",), "png": (b"\x89PNG",), "webp": (b"RIFF",)}


def _obra_json(r):
    return {"id": r["id_obra"], "nombre": r["nombre"], "tipo": TIPO_OBRA.get(r["categoria"], "tubular"),
            "ubicacion": r["ubicacion"] or "", "largo": modelo.f(r["largo"]), "ancho": modelo.f(r["ancho"]),
            "anio": r["anio"], "notas": r["descripcion"] or "", "foto": ("/uploads/obras/" + r["ruta_foto"]) if r["ruta_foto"] else None}


def _leer_obras(where="o.activo = 1", args=()):
    return db.todos(f"""SELECT o.*, c.nombre AS categoria FROM obras o JOIN categorias_obra c ON c.id_categoria = o.id_categoria
                        WHERE {where} ORDER BY o.fecha_registro DESC, o.id_obra DESC""", args)


@bp.get("/obras")
def listar_obras():
    return jsonify({"ok": True, "obras": [_obra_json(r) for r in _leer_obras()]})


def _guardar_foto(data_url):
    """Recibe 'data:image/jpeg;base64,...' (la foto ya reducida en el navegador). Devuelve el nombre del archivo."""
    if not data_url:
        return None
    try:
        cabecera, contenido = str(data_url).split(",", 1)
        tipo = cabecera.split(":", 1)[1].split(";", 1)[0]
        ext = FORMATOS[tipo]
        datos = base64.b64decode(contenido, validate=True)
    except (ValueError, IndexError, KeyError, binascii.Error):
        raise ValueError("La foto no es una imagen válida (usa JPG, PNG o WEBP).")
    if len(datos) > 3 * 1024 * 1024:
        raise ValueError("La foto es muy pesada (máximo 3 MB).")
    if not datos.startswith(FIRMAS[ext]):
        raise ValueError("La foto no es una imagen válida (usa JPG, PNG o WEBP).")
    FOTOS.mkdir(parents=True, exist_ok=True)
    nombre = f"{uuid.uuid4().hex}.{ext}"
    (FOTOS / nombre).write_bytes(datos)
    return nombre


@bp.post("/obras")
@requiere_dueno
def crear_obra():
    d = request.get_json(silent=True) or {}
    nombre, ubicacion = str(d.get("nombre") or "").strip()[:100], str(d.get("ubicacion") or "").strip()[:100]
    if not nombre:
        return error("Escribe el nombre de la obra.")
    if not ubicacion:
        return error("Escribe la ubicación (municipio).")
    categoria = db.uno("SELECT id_categoria FROM categorias_obra WHERE nombre = %s", (CATEGORIA.get(d.get("tipo"), CATEGORIA["tubular"]),))
    largo, ancho = _precio(d.get("largo"), 0.01) if d.get("largo") else None, _precio(d.get("ancho"), 0.01) if d.get("ancho") else None
    try:
        anio = int(d["anio"]) if d.get("anio") else None
    except (TypeError, ValueError):
        anio = None
    if anio is not None and not 1990 <= anio <= datetime.now().year + 1:
        return error("Escribe un año válido.")
    try:
        foto = _guardar_foto(d.get("foto"))
    except ValueError as e:
        return error(str(e))
    oid = db.ejecutar("""INSERT INTO obras (id_categoria, nombre, ubicacion, largo, ancho, anio, descripcion, ruta_foto)
                         VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                      (categoria["id_categoria"], nombre, ubicacion, largo, ancho, anio, str(d.get("notas") or "").strip()[:400] or None, foto))
    db.confirmar()
    return jsonify({"ok": True, "obra": _obra_json(_leer_obras("o.id_obra = %s", (oid,))[0])}), 201


@bp.patch("/obras/<int:id_obra>")
@requiere_dueno
def activar_obra(id_obra):
    """Eliminar = desactivar; deshacer = reactivar."""
    activo = int(bool((request.get_json(silent=True) or {}).get("activo")))
    if not db.uno("SELECT 1 AS x FROM obras WHERE id_obra = %s", (id_obra,)):
        return error("No encontré esa obra.", 404)
    db.ejecutar("UPDATE obras SET activo = %s WHERE id_obra = %s", (activo, id_obra))
    db.confirmar()
    return jsonify({"ok": True})

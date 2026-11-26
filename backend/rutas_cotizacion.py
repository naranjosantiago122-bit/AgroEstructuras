"""
API del flujo de cotización:
  /api/calculo        cualquiera (con o sin cuenta). Precios SOLO si es el dueño.
  /api/solicitudes    el cliente envía y sigue sus solicitudes (sin precios); el dueño las ve todas.
  /api/cotizaciones   solo el dueño: presupuestos con precios, y «enviar al cliente».
"""
import threading

from flask import Blueprint, jsonify, request

import calculo
import config
import correo
import db
import diseno as disenos
import modelo
from seguridad import error, es_dueno, requiere_dueno, requiere_sesion, usuario_actual

bp = Blueprint("cotizacion", __name__, url_prefix="/api")


def _params_o_error(datos):
    """
    Valida los parámetros. Si viene un diseño a medida, lo limpia y:
      - si equivale a «naves iguales» con fórmula, usa esos parámetros (se cotiza normal);
      - si no, usa un resumen (para guardar) y marca el precio como PENDIENTE.
    Devuelve (params, diseno_limpio, motivo_pendiente | None, respuesta_error | None).
    """
    datos = datos or {}
    try:
        dis = disenos.limpiar(datos.get("diseno"))
        params = dict(datos.get("params") or {})
        pendiente = None
        if dis:
            simple = disenos.como_simple(dis)
            params.update(simple or disenos.resumen(dis))
            if not simple:
                pendiente = disenos.motivo_pendiente(dis)
        p = modelo.normalizar(params)
        if not pendiente and p["tipo"] not in calculo.CON_FORMULA:
            pendiente = f"«{calculo.TIPOS[p['tipo']]}» todavía no tiene fórmula de materiales ni precio: lo cotiza el dueño. Fórmulas pendientes."
        return p, dis, pendiente, None
    except calculo.ErrorValidacion as e:
        return None, None, None, error(e.errores[0]["mensaje"], 400, errores=e.errores, campo=e.errores[0]["campo"])


# ============================================================ cálculo
@bp.post("/calculo")
def calcular():
    d = request.get_json(silent=True) or {}
    p, dis, pendiente, err = _params_o_error(d)
    if err:
        return err
    if pendiente:  # sin fórmula todavía: no se inventa ningún precio
        return jsonify({"ok": True, "pendiente": True, "motivo": pendiente, "params": p, "resultado": None, "insumos": []})
    dueno = es_dueno()
    insumos = modelo.insumos_por_id(d.get("insumos")) if dueno else []
    resultado = calculo.calcular(p, modelo.precios_actuales(), insumos)
    if not dueno:
        resultado = calculo.sin_precios(resultado)
    return jsonify({"ok": True, "params": p, "resultado": resultado, "insumos": insumos})


# ============================================================ solicitudes
def _leer_solicitudes(where, args, para_dueno):
    cols, joins = modelo.sql_parametros("s")
    extra = """, u.nombre AS cliente_nombre, u.correo AS cliente_correo, u.telefono AS cliente_telefono, u.ciudad AS cliente_ciudad,
               (SELECT q.codigo FROM cotizaciones q WHERE q.id_solicitud = s.id_solicitud AND q.estado <> 'anulada'
                ORDER BY q.id_cotizacion DESC LIMIT 1) AS codigo_cotizacion,
               (SELECT COUNT(*) FROM cotizaciones q WHERE q.id_solicitud = s.id_solicitud AND q.visible_cliente = 1
                AND q.estado <> 'anulada') AS cotizacion_lista"""
    filas = db.todos(f"""SELECT s.codigo, s.nombre_proyecto, s.observaciones, s.diseno_json, s.estado, s.fecha_creacion, {cols} {extra}
                         FROM solicitudes s JOIN usuarios u ON u.id_usuario = s.id_cliente {joins}
                         WHERE {where} ORDER BY s.fecha_creacion DESC, s.id_solicitud DESC""", args)
    return [modelo.solicitud_json(r, para_dueno) for r in filas]


def _solicitud(codigo):
    return db.uno("""SELECT s.*, u.telefono, u.correo FROM solicitudes s JOIN usuarios u ON u.id_usuario = s.id_cliente
                     WHERE s.codigo = %s""", (codigo,))


@bp.get("/solicitudes")
@requiere_sesion
def listar_solicitudes():
    u = usuario_actual()
    if u["rol"] == "dueno":
        return jsonify({"ok": True, "solicitudes": _leer_solicitudes("s.estado <> 'cancelada'", (), True)})
    return jsonify({"ok": True, "solicitudes": _leer_solicitudes("s.id_cliente = %s AND s.estado <> 'cancelada'", (u["id_usuario"],), False)})


@bp.post("/solicitudes")
@requiere_sesion
def crear_solicitud():
    u = usuario_actual()
    if u["rol"] != "cliente":
        return error("Las solicitudes las envían los clientes. Como dueño, crea el presupuesto directamente.", 403)
    d = request.get_json(silent=True) or {}
    p, dis, _pendiente, err = _params_o_error(d)  # el diseño a medida se puede enviar aunque su precio esté pendiente
    if err:
        return err
    ids = modelo.ids_parametros(p)
    codigo = modelo.siguiente_codigo("SOL", "solicitudes")
    origen = "chat" if d.get("origen") == "chat" else "formulario"
    ids_sol = db.ejecutar(
        """INSERT INTO solicitudes (codigo, id_cliente, nombre_proyecto, id_tipo_estructura, id_modalidad, largo, ancho,
                                    distancia_postes, numero_naves, id_calibre_plastico, id_ancho_plastico, id_ancho_canal,
                                    id_calibre_canal, observaciones, diseno_json, origen)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (codigo, u["id_usuario"], str(d.get("proyecto") or "").strip()[:120] or None, ids["id_tipo_estructura"],
         ids["id_modalidad"], p["largo"], p["ancho"], p["distancia"], p["naves"], ids["id_calibre_plastico"],
         ids["id_ancho_plastico"], ids["id_ancho_canal"], ids["id_calibre_canal"],
         str(d.get("observaciones") or "").strip()[:600] or None, disenos.a_texto(dis), origen))
    # Aviso en el panel para cada dueño (tabla notificaciones)
    duenos = db.todos("SELECT u.id_usuario, u.correo FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol WHERE r.nombre = 'dueno' AND u.activo = 1")
    for dueno in duenos:
        db.ejecutar("INSERT INTO notificaciones (id_solicitud, id_destinatario, canal, mensaje, estado_envio) VALUES (%s, %s, 'panel', %s, 'enviada')",
                    (ids_sol, dueno["id_usuario"], f"Nueva solicitud {codigo} de {u['nombre']}"))
    db.confirmar()
    sol = _leer_solicitudes("s.codigo = %s", (codigo,), False)[0]
    # Aviso por correo al dueño, en segundo plano (el cliente no espera a que salga el correo)
    asunto, texto, html = correo.aviso_nueva_solicitud(
        {"codigo": codigo, "proyecto": sol["proyecto"], "observaciones": sol["observaciones"], "params": sol["params"]},
        {"nombre": u["nombre"], "correo": u["correo"], "telefono": u["telefono"] or "", "ciudad": u["ciudad"] or ""})
    _avisar_en_segundo_plano(ids_sol, duenos, asunto, texto, html)
    sol.update({"telefono": u["telefono"] or "", "correo": u["correo"]})
    return jsonify({"ok": True, "solicitud": sol}), 201


def _registrar_correo(con, id_solicitud, id_destinatario, asunto, ok, detalle):
    """Deja constancia del correo en la tabla notificaciones (canal 'correo')."""
    with con.cursor() as c:
        c.execute("""INSERT INTO notificaciones (id_solicitud, id_destinatario, canal, mensaje, estado_envio, fecha_envio)
                     VALUES (%s, %s, 'correo', %s, %s, IF(%s, NOW(), NULL))""",
                  (id_solicitud, id_destinatario, f"{asunto} · {detalle}"[:500], "enviada" if ok else "fallida", int(ok)))


def _avisar_en_segundo_plano(id_solicitud, duenos, asunto, texto, html):
    """Envía el aviso de solicitud nueva sin hacer esperar al cliente. Usa su propia conexión a MySQL."""
    destinos = [c.strip() for c in config.CORREO_AVISOS.split(",") if c.strip()] or [d["correo"] for d in duenos]
    if not destinos:
        return

    def tarea():
        ok, detalle = correo.enviar(destinos, asunto, texto, html)
        try:
            con = db.conectar()
            try:
                for d in duenos:
                    _registrar_correo(con, id_solicitud, d["id_usuario"], asunto, ok, detalle)
                con.commit()
            finally:
                con.close()
        except Exception:  # el aviso por correo nunca debe romper la solicitud
            pass

    threading.Thread(target=tarea, daemon=True).start()


def _solicitud_propia(codigo):
    u = usuario_actual()
    s = db.uno("SELECT id_solicitud, estado, id_cliente FROM solicitudes WHERE codigo = %s", (codigo,))
    return s if s and s["id_cliente"] == u["id_usuario"] else None


@bp.post("/solicitudes/<codigo>/cancelar")
@requiere_sesion
def cancelar_solicitud(codigo):
    s = _solicitud_propia(codigo)
    if not s:
        return error("No encontré esa solicitud.", 404)
    if s["estado"] != "pendiente":
        return error("Esa solicitud ya está en revisión y no se puede cancelar.", 409)
    db.ejecutar("UPDATE solicitudes SET estado = 'cancelada' WHERE id_solicitud = %s", (s["id_solicitud"],))
    db.confirmar()
    return jsonify({"ok": True})


@bp.post("/solicitudes/<codigo>/restaurar")
@requiere_sesion
def restaurar_solicitud(codigo):
    s = _solicitud_propia(codigo)
    if not s or s["estado"] != "cancelada":
        return error("No se puede recuperar esa solicitud.", 409)
    db.ejecutar("UPDATE solicitudes SET estado = 'pendiente' WHERE id_solicitud = %s", (s["id_solicitud"],))
    db.confirmar()
    return jsonify({"ok": True})


@bp.post("/solicitudes/<codigo>/revisar")
@requiere_dueno
def revisar_solicitud(codigo):
    """El dueño abre la solicitud: pasa a «En revisión» y su aviso queda leído."""
    s = db.uno("SELECT id_solicitud, estado FROM solicitudes WHERE codigo = %s", (codigo,))
    if not s or s["estado"] == "cancelada":
        return error("No encontré esa solicitud. Puede que el cliente la haya cancelado.", 404)
    if s["estado"] == "pendiente":
        db.ejecutar("UPDATE solicitudes SET estado = 'en_revision' WHERE id_solicitud = %s", (s["id_solicitud"],))
    db.ejecutar("UPDATE notificaciones SET leida = 1 WHERE id_solicitud = %s AND id_destinatario = %s",
                (s["id_solicitud"], usuario_actual()["id_usuario"]))
    db.confirmar()
    return jsonify({"ok": True, "solicitud": _leer_solicitudes("s.codigo = %s", (codigo,), True)[0]})


@bp.get("/solicitudes/<codigo>/cotizacion")
@requiere_sesion
def cotizacion_de_solicitud(codigo):
    """
    El cliente descarga SU cotización, solo si el dueño la liberó (visible_cliente = 1).
    Recibe únicamente el valor total y las cantidades: nunca el precio de cada material.
    """
    u = usuario_actual()
    s = db.uno("SELECT id_solicitud, id_cliente FROM solicitudes WHERE codigo = %s", (codigo,))
    if not s or (u["rol"] != "dueno" and s["id_cliente"] != u["id_usuario"]):
        return error("No encontré esa solicitud.", 404)
    cot = modelo.leer_cotizaciones("q.id_solicitud = %s AND q.visible_cliente = 1 AND q.estado <> 'anulada'",
                                   (s["id_solicitud"],), con_detalle=True)
    if not cot:
        return error("La cotización todavía no está lista.", 404)
    return jsonify({"ok": True, "cotizacion": modelo.cotizacion_para_cliente(cot[0])})


# ============================================================ cotizaciones (solo dueño)
@bp.get("/cotizaciones")
@requiere_dueno
def listar_cotizaciones():
    return jsonify({"ok": True, "cotizaciones": modelo.leer_cotizaciones("q.estado <> 'anulada'", ())})


@bp.get("/cotizaciones/<codigo>")
@requiere_dueno
def ver_cotizacion(codigo):
    cot = modelo.leer_cotizaciones("q.codigo = %s AND q.estado <> 'anulada'", (codigo,), con_detalle=True)
    if not cot:
        return error("No encontré ese presupuesto. Puede que lo hayas eliminado.", 404)
    return jsonify({"ok": True, "cotizacion": cot[0]})


def _guardar(codigo=None):
    d = request.get_json(silent=True) or {}
    cliente = str(d.get("cliente") or "").strip()
    if not cliente:
        return error("Escribe el nombre del cliente o del proyecto.", 400, campo="cliente")
    p, dis, pendiente, err = _params_o_error(d)
    if err:
        return err
    if pendiente:  # sin fórmula no se puede guardar un total: no se inventan precios
        return error(pendiente, 409, pendiente=True)
    solicitud = None
    if not codigo and d.get("idSolicitud"):
        solicitud = _solicitud(str(d["idSolicitud"]))
        if not solicitud or solicitud["estado"] == "cancelada":
            return error("Esa solicitud ya no existe.", 404)
    insumos = modelo.insumos_por_id(d.get("insumos"))
    resultado = calculo.calcular(p, modelo.precios_actuales(), insumos)  # el total lo calcula SIEMPRE el servidor
    nuevo = modelo.guardar_cotizacion(usuario_actual()["id_usuario"], cliente, p, resultado, codigo=codigo, solicitud=solicitud, diseno=dis)
    if not nuevo:
        return error("No encontré ese presupuesto.", 404)
    db.confirmar()
    return jsonify({"ok": True, "cotizacion": modelo.leer_cotizaciones("q.codigo = %s", (nuevo,), con_detalle=True)[0]}), (200 if codigo else 201)


@bp.post("/cotizaciones")
@requiere_dueno
def crear_cotizacion():
    return _guardar()


@bp.put("/cotizaciones/<codigo>")
@requiere_dueno
def actualizar_cotizacion(codigo):
    return _guardar(codigo)


@bp.patch("/cotizaciones/<codigo>/estado")
@requiere_dueno
def cambiar_estado(codigo):
    estado = modelo.ESTADO_COT_DB.get(str((request.get_json(silent=True) or {}).get("estado")))
    if estado not in ("cotizada", "en_revision", "aprobada"):
        return error("Estado no válido.")
    if not db.uno("SELECT 1 AS x FROM cotizaciones WHERE codigo = %s AND estado <> 'anulada'", (codigo,)):
        return error("No encontré ese presupuesto.", 404)
    db.ejecutar("UPDATE cotizaciones SET estado = %s WHERE codigo = %s", (estado, codigo))
    db.confirmar()
    return jsonify({"ok": True})


def _sincronizar_solicitud(id_solicitud):
    """La solicitud queda «cotizada» si tiene una cotización visible; si no, «en revisión»."""
    if not id_solicitud:
        return
    visible = db.uno("SELECT COUNT(*) AS n FROM cotizaciones WHERE id_solicitud = %s AND visible_cliente = 1 AND estado <> 'anulada'",
                     (id_solicitud,))["n"]
    db.ejecutar("UPDATE solicitudes SET estado = %s WHERE id_solicitud = %s AND estado <> 'cancelada'",
                ("cotizada" if visible else "en_revision", id_solicitud))


@bp.post("/cotizaciones/<codigo>/liberar")
@requiere_dueno
def liberar(codigo):
    """Enviar al cliente (visible = true) o retirarla (visible = false)."""
    visible = bool((request.get_json(silent=True) or {}).get("visible"))
    q = db.uno("SELECT id_cotizacion, id_solicitud FROM cotizaciones WHERE codigo = %s AND estado <> 'anulada'", (codigo,))
    if not q or not q["id_solicitud"]:
        return error("Solo se pueden enviar presupuestos que vienen de una solicitud.", 409)
    db.ejecutar("UPDATE cotizaciones SET visible_cliente = %s, fecha_envio = IF(%s, NOW(), fecha_envio) WHERE id_cotizacion = %s",
                (int(visible), int(visible), q["id_cotizacion"]))
    _sincronizar_solicitud(q["id_solicitud"])
    if visible:
        u = usuario_actual()
        db.ejecutar("INSERT INTO respuestas_solicitud (id_solicitud, id_usuario, mensaje, id_cotizacion) VALUES (%s, %s, %s, %s)",
                    (q["id_solicitud"], u["id_usuario"], "Tu cotización está lista.", q["id_cotizacion"]))
        cliente = db.uno("SELECT id_cliente FROM solicitudes WHERE id_solicitud = %s", (q["id_solicitud"],))
        db.ejecutar("INSERT INTO notificaciones (id_solicitud, id_destinatario, canal, mensaje, estado_envio) VALUES (%s, %s, 'panel', %s, 'enviada')",
                    (q["id_solicitud"], cliente["id_cliente"], f"Tu cotización {codigo} está lista"))
    db.confirmar()
    return jsonify({"ok": True})


@bp.post("/cotizaciones/<codigo>/correo")
@requiere_dueno
def enviar_por_correo(codigo):
    """
    Envía la cotización al correo del cliente: valor TOTAL, observación de lo que incluye y cantidades.
    Nunca el precio de cada material (se arma con la misma versión recortada que ve el cliente).
    Solo se puede después de «Enviar al cliente», para que el enlace del correo le funcione.
    """
    q = db.uno("""SELECT q.id_solicitud, q.visible_cliente, s.codigo AS sol, u.nombre, u.correo
                  FROM cotizaciones q JOIN solicitudes s ON s.id_solicitud = q.id_solicitud
                  JOIN usuarios u ON u.id_usuario = s.id_cliente
                  WHERE q.codigo = %s AND q.estado <> 'anulada'""", (codigo,))
    if not q:
        return error("Solo se pueden enviar por correo los presupuestos que vienen de una solicitud.", 409)
    if not q["visible_cliente"]:
        return error("Primero pulsa «Enviar al cliente»; después la puedes mandar por correo.", 409)
    completa = modelo.leer_cotizaciones("q.codigo = %s", (codigo,), con_detalle=True)[0]
    asunto, texto, html = correo.cotizacion_para_cliente(modelo.cotizacion_para_cliente(completa), q["sol"], q["nombre"], config.CLIENTE_VE_CANTIDADES)
    ok, detalle = correo.enviar(q["correo"], asunto, texto, html)
    cliente = db.uno("SELECT id_cliente FROM solicitudes WHERE id_solicitud = %s", (q["id_solicitud"],))
    _registrar_correo(db.con(), q["id_solicitud"], cliente["id_cliente"], asunto, ok, detalle)
    db.confirmar()
    if not ok:
        return error(detalle, 502)
    return jsonify({"ok": True, "modo": correo.modo(), "para": q["correo"], "detalle": detalle})


@bp.get("/correo/estado")
@requiere_dueno
def estado_correo():
    return jsonify({"ok": True, "modo": correo.modo(), "remitente": config.CORREO_REMITENTE if correo.modo() == "smtp" else None})


@bp.post("/cotizaciones/<codigo>/anular")
@requiere_dueno
def anular(codigo):
    """Eliminar desde el panel = anular (no se borra, para poder deshacer y conservar el historial)."""
    q = db.uno("SELECT id_cotizacion, id_solicitud FROM cotizaciones WHERE codigo = %s AND estado <> 'anulada'", (codigo,))
    if not q:
        return error("No encontré ese presupuesto.", 404)
    db.ejecutar("UPDATE cotizaciones SET estado = 'anulada', visible_cliente = 0 WHERE id_cotizacion = %s", (q["id_cotizacion"],))
    _sincronizar_solicitud(q["id_solicitud"])
    db.confirmar()
    return jsonify({"ok": True})


@bp.post("/cotizaciones/<codigo>/restaurar")
@requiere_dueno
def restaurar(codigo):
    d = request.get_json(silent=True) or {}
    estado = modelo.ESTADO_COT_DB.get(str(d.get("estado")), "cotizada")
    if estado == "anulada":
        estado = "cotizada"
    q = db.uno("SELECT id_cotizacion, id_solicitud FROM cotizaciones WHERE codigo = %s AND estado = 'anulada'", (codigo,))
    if not q:
        return error("No se puede recuperar ese presupuesto.", 409)
    db.ejecutar("UPDATE cotizaciones SET estado = %s, visible_cliente = %s WHERE id_cotizacion = %s",
                (estado, int(bool(d.get("visibleCliente")) and bool(q["id_solicitud"])), q["id_cotizacion"]))
    _sincronizar_solicitud(q["id_solicitud"])
    db.confirmar()
    return jsonify({"ok": True})


@bp.post("/cotizaciones/ejemplos")
@requiere_dueno
def ejemplos():
    """Dos presupuestos de prueba (marcados como ejemplo), calculados con los precios actuales."""
    casos = [
        ("Flores La Ceja", {"tipo": "Tubular", "largo": 50, "ancho": 24, "distancia": 2.5, "naves": 2, "calibrePlastico": "7",
                            "anchoPlastico": "5.80", "anchoCanal": "1.20", "calibreCanal": "6", "modalidad": "Todo Costo"}, "aprobada"),
        ("Hortalizas El Retiro", {"tipo": "Guadua", "largo": 35, "ancho": 18, "distancia": 2.5, "naves": 1, "calibrePlastico": "6",
                                  "anchoPlastico": "5.80", "anchoCanal": "1.20", "calibreCanal": "6", "modalidad": "Todo Costo"}, "en_revision"),
    ]
    precios = modelo.precios_actuales()
    for cliente, params, estado in casos:
        p = modelo.normalizar(params)
        codigo = modelo.guardar_cotizacion(usuario_actual()["id_usuario"], cliente, p, calculo.calcular(p, precios), ejemplo=True)
        db.ejecutar("UPDATE cotizaciones SET estado = %s WHERE codigo = %s", (estado, codigo))
    db.confirmar()
    return jsonify({"ok": True})

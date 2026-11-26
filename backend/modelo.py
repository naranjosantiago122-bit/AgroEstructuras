"""
Funciones que leen y escriben las tablas, y convierten las filas de MySQL al formato
que usa el front-end (el mismo que usaba js/datos.js con localStorage).
"""
from datetime import datetime

import calculo
import db
import diseno as disenos

ESTADO_SOL = {"pendiente": "Pendiente", "en_revision": "En revisión", "cotizada": "Cotizada", "cancelada": "Cancelada"}
ESTADO_COT = {"cotizada": "Cotizado", "en_revision": "En revisión", "aprobada": "Aprobado", "anulada": "Anulado"}
ESTADO_COT_DB = {v: k for k, v in ESTADO_COT.items()}
TIPO_DB = calculo.TIPOS                                  # 'Tubular' -> 'Metálico Tubular'
TIPO_FRONT = {v: k for k, v in TIPO_DB.items()}          # 'Metálico Tubular' -> 'Tubular'


def f(x):
    """Decimal -> int o float (para JSON)."""
    if x is None:
        return None
    n = float(x)
    return int(n) if n.is_integer() else n


def fecha_iso(d):
    return d.isoformat() if isinstance(d, datetime) else d


# ---------------------------------------------------------------- catálogos y precios
def catalogo():
    """Valores válidos para validar los parámetros."""
    return {
        "anchos_plastico": {f"{float(r['ancho_m']):.2f}" for r in db.todos("SELECT ancho_m FROM anchos_plastico")},
        "anchos_canal": {f"{float(r['ancho_m']):.2f}" for r in db.todos("SELECT ancho_m FROM anchos_canal")},
        "distancia_max": {TIPO_FRONT[r["nombre"]]: float(r["distancia_max"])
                          for r in db.todos("SELECT nombre, distancia_max FROM tipos_estructura") if r["nombre"] in TIPO_FRONT},
    }


def normalizar(params):
    c = catalogo()
    return calculo.normalizar(params, c["anchos_plastico"], c["anchos_canal"], c["distancia_max"])


def precios_actuales():
    base = {r["codigo"]: {"id": r["id_material"], "nombre": r["nombre"], "precio": f(r["precio_unitario"])}
            for r in db.todos("SELECT id_material, codigo, nombre, precio_unitario FROM materiales WHERE tipo = 'base'")}
    return {
        "base": base,
        "plastico": {f"{float(r['ancho_m']):.2f}": f(r["precio_m2"]) for r in db.todos("SELECT ancho_m, precio_m2 FROM anchos_plastico")},
        "canal": {f"{float(r['ancho_m']):.2f}": f(r["precio_rollo"]) for r in db.todos("SELECT ancho_m, precio_rollo FROM anchos_canal")},
    }


def insumos_por_id(lista):
    """[{id, cantidad}] del navegador -> insumos con nombre y precio ACTUAL de la base de datos."""
    salida = []
    for i in lista or []:
        try:
            mid, cant = int(i.get("id")), float(i.get("cantidad"))
        except (TypeError, ValueError, AttributeError):
            continue
        if cant <= 0 or cant > 100000:
            continue
        m = db.uno("SELECT id_material, nombre, precio_unitario FROM materiales WHERE id_material = %s AND tipo = 'insumo'", (mid,))
        if m:
            salida.append({"id": m["id_material"], "nombre": m["nombre"], "precio": f(m["precio_unitario"]), "cantidad": f(cant)})
    return salida


def ids_parametros(p):
    """Ids de las tablas de catálogo para guardar los parámetros en solicitudes / cotizaciones."""
    uno = lambda sql, a: (db.uno(sql, (a,)) or {}).get("id")
    return {
        "id_tipo_estructura": uno("SELECT id_tipo_estructura AS id FROM tipos_estructura WHERE nombre = %s", TIPO_DB[p["tipo"]]),
        "id_modalidad": uno("SELECT id_modalidad AS id FROM modalidades WHERE nombre = %s", p["modalidad"]),
        "id_calibre_plastico": uno("SELECT id_calibre AS id FROM calibres WHERE valor = %s", int(p["calibrePlastico"])),
        "id_ancho_plastico": uno("SELECT id_ancho_plastico AS id FROM anchos_plastico WHERE ancho_m = %s", p["anchoPlastico"]),
        "id_ancho_canal": None if p["anchoCanal"] == "0" else uno("SELECT id_ancho_canal AS id FROM anchos_canal WHERE ancho_m = %s", p["anchoCanal"]),
        "id_calibre_canal": None if p["anchoCanal"] == "0" else uno("SELECT id_calibre AS id FROM calibres WHERE valor = %s", int(p["calibreCanal"])),
    }


# Columnas y uniones para leer los parámetros de solicitudes (s) o cotizaciones (q)
def sql_parametros(alias):
    return f"""te.nombre AS tipo_nombre, mo.nombre AS modalidad, {alias}.largo, {alias}.ancho, {alias}.distancia_postes,
       {alias}.numero_naves, cp.valor AS calibre_plastico, ap.ancho_m AS ancho_plastico, ac.ancho_m AS ancho_canal, cc.valor AS calibre_canal""", f"""
JOIN tipos_estructura te ON te.id_tipo_estructura = {alias}.id_tipo_estructura
JOIN modalidades mo ON mo.id_modalidad = {alias}.id_modalidad
JOIN calibres cp ON cp.id_calibre = {alias}.id_calibre_plastico
JOIN anchos_plastico ap ON ap.id_ancho_plastico = {alias}.id_ancho_plastico
LEFT JOIN anchos_canal ac ON ac.id_ancho_canal = {alias}.id_ancho_canal
LEFT JOIN calibres cc ON cc.id_calibre = {alias}.id_calibre_canal"""


def params_de_fila(r):
    return {
        "tipo": TIPO_FRONT.get(r["tipo_nombre"], "Tubular"),
        "largo": f(r["largo"]), "ancho": f(r["ancho"]), "distancia": f(r["distancia_postes"]),
        "naves": int(r["numero_naves"]),
        "calibrePlastico": str(r["calibre_plastico"]),
        "anchoPlastico": f"{float(r['ancho_plastico']):.2f}",
        "anchoCanal": "0" if r["ancho_canal"] is None else f"{float(r['ancho_canal']):.2f}",
        "calibreCanal": str(r["calibre_canal"] or 6),
        "modalidad": r["modalidad"],
    }


# ---------------------------------------------------------------- códigos SOL-2026-0001 / PRJ-2026-0001
def siguiente_codigo(prefijo, tabla):
    anio = datetime.now().year
    fila = db.uno(f"SELECT codigo FROM {tabla} WHERE codigo LIKE %s ORDER BY codigo DESC LIMIT 1 FOR UPDATE",
                  (f"{prefijo}-{anio}-%",))
    n = int(fila["codigo"].rsplit("-", 1)[1]) + 1 if fila else 1
    return f"{prefijo}-{anio}-{n:04d}"


# ---------------------------------------------------------------- solicitudes
def solicitud_json(r, para_dueno):
    s = {
        "id": r["codigo"], "fecha": fecha_iso(r["fecha_creacion"]), "estado": ESTADO_SOL[r["estado"]],
        "proyecto": r.get("nombre_proyecto") or "", "observaciones": r.get("observaciones") or "",
        "params": params_de_fila(r),
        "diseno": disenos.de_texto(r.get("diseno_json")),  # diseño a medida (sin precios) o None
    }
    if para_dueno:
        s.update({"nombre": r["cliente_nombre"], "correo": r["cliente_correo"], "telefono": r["cliente_telefono"] or "",
                  "ciudad": r["cliente_ciudad"] or "", "idPresupuesto": r.get("codigo_cotizacion")})
    else:
        s["cotizacionLista"] = bool(r.get("cotizacion_lista"))
    return s


# ---------------------------------------------------------------- cotizaciones (presupuestos)
def cotizacion_json(r, con_detalle):
    p = params_de_fila(r)
    proy = {
        "id": r["codigo"], "fecha": fecha_iso(r["fecha_creacion"]), "estado": ESTADO_COT[r["estado"]],
        "cliente": r["cliente_nombre"], "params": p,
        "idSolicitud": r.get("codigo_solicitud"), "visibleCliente": bool(r["visible_cliente"]),
        "ejemplo": (r.get("notas_internas") or "") == "EJEMPLO",
        "diseno": disenos.de_texto(r.get("diseno_json")),
        "resultado": {"cMat": f(r["costo_materiales"]), "cObra": f(r["costo_mano_obra"]), "total": f(r["total"]),
                      "area": f(r["area_total"]), "soloManoDeObra": p["modalidad"] != "Todo Costo"},
    }
    if con_detalle:
        detalle = db.todos("""SELECT id_material, seccion, descripcion, cantidad, unidad, precio_unitario, subtotal
                              FROM detalle_cotizacion WHERE id_cotizacion = %s ORDER BY orden""", (r["id_cotizacion"],))
        filas, insumos = [], []
        if p["naves"] > 1:
            filas.append({"tipo": "seccion", "texto": f"Ingeniería para {p['naves']} naves acopladas", "color": "amber"})
        for d in detalle:
            if d["seccion"] == "insumo":
                if not insumos:
                    filas.append({"tipo": "seccion", "texto": "Insumos adicionales", "color": "blue"})
                insumos.append({"id": d["id_material"], "nombre": d["descripcion"], "precio": f(d["precio_unitario"]), "cantidad": f(d["cantidad"])})
            filas.append({"tipo": "item", "nombre": d["descripcion"], "cant": f(d["cantidad"]), "unidad": d["unidad"],
                          "pu": f(d["precio_unitario"]), "st": f(d["subtotal"])})
        proy["resultado"]["filas"] = filas
        proy["insumos"] = insumos
    return proy


def cotizacion_para_cliente(c):
    """
    Lo que recibe el cliente: SOLO el valor total y las cantidades de materiales.
    Sin precio unitario, sin subtotales y sin separar materiales / mano de obra
    (decisión del dueño: el cliente no debe saber cuánto cuesta cada material).
    """
    r = c["resultado"]
    filas = []
    for f_ in r.get("filas", []):
        if f_["tipo"] == "seccion":
            filas.append({"tipo": "seccion", "texto": f_["texto"], "color": f_.get("color")})
        else:
            filas.append({"tipo": "item", "nombre": f_["nombre"], "cant": f_["cant"], "unidad": f_["unidad"]})
    return {
        "id": c["id"], "fecha": c["fecha"], "cliente": c["cliente"], "params": c["params"], "diseno": c.get("diseno"),
        "resultado": {"total": r["total"], "area": r["area"], "soloManoDeObra": r["soloManoDeObra"], "filas": filas},
    }


def leer_cotizaciones(where, args, con_detalle=False):
    cols, joins = sql_parametros("q")
    filas = db.todos(f"""SELECT q.*, s.codigo AS codigo_solicitud, {cols}
                         FROM cotizaciones q LEFT JOIN solicitudes s ON s.id_solicitud = q.id_solicitud {joins}
                         WHERE {where} ORDER BY q.fecha_creacion DESC, q.id_cotizacion DESC""", args)
    return [cotizacion_json(r, con_detalle) for r in filas]


def guardar_cotizacion(id_dueno, cliente, p, resultado, codigo=None, solicitud=None, ejemplo=False, diseno=None):
    """Crea o actualiza una cotización y su detalle (precios del momento). Devuelve el código."""
    ids = ids_parametros(p)
    valores = {
        **ids, "cliente_nombre": cliente[:120], "largo": p["largo"], "ancho": p["ancho"],
        "distancia_postes": p["distancia"], "numero_naves": p["naves"], "area_total": resultado["area"],
        "costo_materiales": resultado["cMat"], "costo_mano_obra": resultado["cObra"], "total": resultado["total"],
        "diseno_json": disenos.a_texto(diseno),
    }
    if codigo:
        fila = db.uno("SELECT id_cotizacion FROM cotizaciones WHERE codigo = %s AND estado <> 'anulada'", (codigo,))
        if not fila:
            return None
        idc = fila["id_cotizacion"]
        asignar = ", ".join(f"{k} = %s" for k in valores)
        db.ejecutar(f"UPDATE cotizaciones SET {asignar} WHERE id_cotizacion = %s", (*valores.values(), idc))
        db.ejecutar("DELETE FROM detalle_cotizacion WHERE id_cotizacion = %s", (idc,))
    else:
        codigo = siguiente_codigo("PRJ", "cotizaciones")
        valores.update({"codigo": codigo, "id_dueno": id_dueno, "notas_internas": "EJEMPLO" if ejemplo else None})
        if solicitud:
            valores.update({"id_solicitud": solicitud["id_solicitud"], "id_cliente": solicitud["id_cliente"],
                            "cliente_contacto": (solicitud["telefono"] or solicitud["correo"])[:120],
                            "observaciones": solicitud["observaciones"]})
        columnas = ", ".join(valores)
        marcas = ", ".join(["%s"] * len(valores))
        idc = db.ejecutar(f"INSERT INTO cotizaciones ({columnas}) VALUES ({marcas})", tuple(valores.values()))
    orden = 0
    for fila in resultado["filas"]:
        if fila["tipo"] != "item":
            continue
        orden += 1
        db.ejecutar("""INSERT INTO detalle_cotizacion (id_cotizacion, id_material, seccion, descripcion, cantidad, unidad,
                                                       precio_unitario, subtotal, orden)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (idc, fila["id_material"], fila["seccion"], fila["nombre"][:150], fila["cant"], fila["unidad"],
                     fila["pu"], fila["st"], orden))
    return codigo

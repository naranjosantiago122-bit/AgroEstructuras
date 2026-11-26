"""
Motor de cálculo de AgroEstructuras (lista de materiales, mano de obra y total).
Traducción directa de frontend/js/calculo.js (fórmulas del index.html V.2).
Las operaciones van en el mismo orden que en JavaScript para que los resultados
coincidan exactamente (se verificó con pruebas/test_calculo.py contra 300 casos).

Este módulo no toca la base de datos: recibe los precios y devuelve el resultado.
"""
import math

# Rangos aceptados (iguales a los del front-end)
LIMITES = {"largo": (2, 500), "ancho": (2, 100), "distancia": (0.5, 5), "naves": (1, 20)}

# Clave que usa el front-end -> nombre en la tabla tipos_estructura
TIPOS = {"Tubular": "Metálico Tubular", "Guadua": "Capilla de Guadua",
         "Cercha": "Capilla en cercha", "UnaAgua": "Una sola agua", "SaranCapilla": "Sarán capilla"}
# Tipos que ya tienen fórmula de materiales. Los demás: precio PENDIENTE (el dueño entregará fórmulas y precios).
CON_FORMULA = ("Tubular", "Guadua")


class SinFormula(Exception):
    """El tipo o el diseño todavía no tiene fórmula de materiales / precio."""

    def __init__(self, motivo):
        super().__init__(motivo)
        self.motivo = motivo
MODALIDADES = ("Todo Costo", "Mano de Obra")
CALIBRES = ("6", "7", "10")

# Mano de obra (fórmula del original): por arco y por metro de largo, en cada nave
MO_POR_ARCO = 120000
MO_POR_METRO = 25000

# Precios iniciales de los materiales base (los mismos del script SQL)
PRECIOS_BASE = {"tubo": 45000, "guadua": 15000, "carevaca_s": 17000, "carevaca_r": 22000}


class ErrorValidacion(Exception):
    """Datos inválidos. errores = [{campo, mensaje}]"""

    def __init__(self, errores):
        super().__init__("Datos inválidos")
        self.errores = errores


def _numero(valor):
    try:
        if isinstance(valor, bool):
            return None
        n = float(valor)
        return n if math.isfinite(n) else None
    except (TypeError, ValueError):
        return None


def _ancho_texto(valor):
    """'5.8' -> '5.80'; '0' o vacío -> '0'."""
    n = _numero(valor)
    if not n:
        return "0"
    return f"{n:.2f}"


def normalizar(datos, anchos_plastico, anchos_canal, distancia_max):
    """
    Convierte los parámetros que llegan del front-end y los valida.
    anchos_plastico / anchos_canal: conjuntos de textos válidos ('5.80', ...).
    distancia_max: {'Tubular': 5.0, 'Guadua': 4.0}
    Devuelve el diccionario limpio o lanza ErrorValidacion.
    """
    d = datos if isinstance(datos, dict) else {}
    naves = _numero(d.get("naves"))
    p = {
        "tipo": str(d.get("tipo", "")),
        "largo": _numero(d.get("largo")),
        "ancho": _numero(d.get("ancho")),
        "distancia": _numero(d.get("distancia")),
        "naves": int(naves) if naves is not None and naves == int(naves) else naves,
        "calibrePlastico": str(d.get("calibrePlastico", "")),
        "anchoPlastico": _ancho_texto(d.get("anchoPlastico")),
        "anchoCanal": _ancho_texto(d.get("anchoCanal")),
        "calibreCanal": str(d.get("calibreCanal", "6")),
        "modalidad": str(d.get("modalidad", "")),
    }
    errores = []
    if p["tipo"] not in TIPOS:
        errores.append({"campo": "tipo", "mensaje": "Elige un tipo de estructura válido."})
    if p["modalidad"] not in MODALIDADES:
        errores.append({"campo": "modalidad", "mensaje": "Elige «Todo Costo» o «Mano de Obra»."})
    if p["calibrePlastico"] not in CALIBRES:
        errores.append({"campo": "calPlastico", "mensaje": "Elige un calibre de plástico válido."})
    if p["anchoPlastico"] not in anchos_plastico:
        errores.append({"campo": "anchoPlastico", "mensaje": "Elige un ancho de rollo válido."})
    if p["anchoCanal"] != "0" and p["anchoCanal"] not in anchos_canal:
        errores.append({"campo": "anchoCanal", "mensaje": "Elige un ancho de canal válido."})
    if p["anchoCanal"] != "0" and p["calibreCanal"] not in CALIBRES:
        errores.append({"campo": "calCanal", "mensaje": "Elige un calibre de canal válido."})

    lo, hi = LIMITES["largo"]
    if not (p["largo"] and p["largo"] > 0):
        errores.append({"campo": "largo", "mensaje": "Escribe el largo en metros (un número mayor que 0)."})
    elif not lo <= p["largo"] <= hi:
        errores.append({"campo": "largo", "mensaje": f"El largo debe estar entre {lo} y {hi} m."})
    lo, hi = LIMITES["ancho"]
    if not (p["ancho"] and p["ancho"] > 0):
        errores.append({"campo": "ancho", "mensaje": "Escribe el ancho por nave en metros (un número mayor que 0)."})
    elif not lo <= p["ancho"] <= hi:
        errores.append({"campo": "ancho", "mensaje": f"El ancho por nave debe estar entre {lo} y {hi} m."})
    if not (p["distancia"] and p["distancia"] > 0):
        errores.append({"campo": "distancia", "mensaje": "Escribe la distancia entre postes en metros (mayor que 0)."})
    elif p["distancia"] < LIMITES["distancia"][0]:
        errores.append({"campo": "distancia", "mensaje": f"La distancia entre postes debe ser de al menos {LIMITES['distancia'][0]} m."})
    lo, hi = LIMITES["naves"]
    if not (isinstance(p["naves"], int) and lo <= p["naves"] <= hi):
        errores.append({"campo": "naves", "mensaje": f"El número de naves debe ser un número entero entre {lo} y {hi}."})
    limite = distancia_max.get(p["tipo"])
    if limite and p["distancia"] and p["distancia"] > limite:
        errores.append({"campo": "distancia", "mensaje": (
            "Alerta técnica: para Guadua los postes no deben superar 4 m de separación."
            if p["tipo"] == "Guadua" else
            "Alerta técnica: para Tubular los arcos no deben superar 5 m de separación."
            if p["tipo"] == "Tubular" else
            f"Alerta técnica: para {TIPOS[p['tipo']]} los postes no deben superar {limite:g} m de separación.")})
    if errores:
        raise ErrorValidacion(errores)
    return p


def calcular(p, precios, insumos=()):
    """
    p: parámetros ya normalizados.
    precios: {
      'base':    {'tubo': {'id', 'nombre', 'precio'}, 'guadua': ..., 'carevaca_s': ..., 'carevaca_r': ...},
      'plastico': {'5.80': precio_m2, ...},
      'canal':    {'0.90': precio_rollo, ...},
    }
    insumos: [{'id', 'nombre', 'precio', 'cantidad'}]  (insumos adicionales del dueño)
    Devuelve el mismo formato que calcular() de calculo.js, y cada ítem trae además
    'seccion' e 'id_material' para guardarlo en detalle_cotizacion.
    """
    if p["tipo"] not in CON_FORMULA:
        raise SinFormula(f"«{TIPOS[p['tipo']]}» todavía no tiene fórmula de materiales ni precio: lo cotiza el dueño.")
    base = precios["base"]
    solo_mo = p["modalidad"] != "Todo Costo"
    naves = p["naves"]
    largo, ancho, distancia = p["largo"], p["ancho"], p["distancia"]

    precio_plastico = precios["plastico"].get(p["anchoPlastico"], 3200)

    secciones = math.ceil(largo / distancia)
    arcos_por_nave = secciones + 1
    postes_laterales = (arcos_por_nave * 2) * naves
    postes_centrales = (arcos_por_nave * max(1, math.floor(ancho / 8))) * naves if p["tipo"] == "Guadua" else 0
    total_care_s = (secciones * 20) * naves
    total_care_r = (secciones * 3) * naves
    area_techo = (largo * ancho * 1.05) * naves

    filas = []
    c_mat = 0

    def item(seccion, codigo_o_none, nombre, cant, unidad, pu):
        nonlocal c_mat
        st = cant * pu
        c_mat += st
        filas.append({"tipo": "item", "seccion": seccion, "id_material": codigo_o_none,
                      "nombre": nombre, "cant": cant, "unidad": unidad, "pu": pu, "st": st})

    if naves > 1:
        filas.append({"tipo": "seccion", "texto": f"Ingeniería para {naves} naves acopladas", "color": "amber"})

    if p["tipo"] == "Tubular":
        total_tubos = postes_laterales + ((arcos_por_nave * (ancho / 3)) * naves)
        m = base["tubo"]
        item("estructura", m["id"], m["nombre"], math.ceil(total_tubos), "un", m["precio"])
    else:
        total_gua = postes_laterales + postes_centrales + ((arcos_por_nave * (ancho / 3)) * naves)
        m = base["guadua"]
        item("estructura", m["id"], m["nombre"], math.ceil(total_gua), "un", m["precio"])

    m = base["carevaca_s"]
    item("cubierta", m["id"], m["nombre"], total_care_s, "un", m["precio"])
    m = base["carevaca_r"]
    item("cubierta", m["id"], m["nombre"], total_care_r, "un", m["precio"])
    item("cubierta", None, f"Plástico Lechoso UV6+ Cal.{p['calibrePlastico']} ({p['anchoPlastico']} m)",
         math.ceil(area_techo), "m²", precio_plastico)

    if p["anchoCanal"] != "0":
        p_canal = precios["canal"].get(p["anchoCanal"], 350000)
        lineas = 2 + (naves - 1)
        rollos = math.ceil((largo * lineas) / 100)
        item("canal", None, f"Canal Cal.{p['calibreCanal']} ({p['anchoCanal']} m) - Rollo 100 m", rollos, "rollos", p_canal)

    if not solo_mo and insumos:
        filas.append({"tipo": "seccion", "texto": "Insumos adicionales", "color": "blue"})
        for i in insumos:
            item("insumo", i.get("id"), i["nombre"], i["cantidad"], "un", i["precio"])

    c_obra = ((arcos_por_nave * MO_POR_ARCO) + (largo * MO_POR_METRO)) * naves
    if solo_mo:
        c_mat = 0

    return {
        "ok": True,
        "soloManoDeObra": solo_mo,
        "filas": filas,
        "cMat": c_mat,
        "cObra": c_obra,
        "total": c_mat + c_obra,
        "area": largo * ancho * naves,
    }


def sin_precios(resultado):
    """Versión para el cliente: cantidades sin ningún precio, subtotal ni total."""
    filas = []
    for f in resultado["filas"]:
        if f["tipo"] == "seccion":
            filas.append({"tipo": "seccion", "texto": f["texto"], "color": f.get("color")})
        else:
            filas.append({"tipo": "item", "nombre": f["nombre"], "cant": f["cant"], "unidad": f["unidad"]})
    return {"ok": True, "soloManoDeObra": resultado["soloManoDeObra"], "filas": filas, "area": resultado["area"]}

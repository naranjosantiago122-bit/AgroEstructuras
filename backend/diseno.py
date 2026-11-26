"""
Diseño personalizado del invernadero (lo arma el cliente en el diseñador de planta + 3D).

    { "distancia": 3, "anchoCanal": "0.90",
      "naves":   [{ "tipo", "ancho", "largo", "inicio", "alturaPostes", "cenital", "cortinas" }],   (de izquierda a derecha)
      "canales": [bool, ...]   (líneas 0..N: 0 = costado izquierdo, N = costado derecho)
      "puertas": [{ "nave", "lado": "frente"|"fondo", "posicion", "ancho" }],
      "terreno": [[x, z], ...] (esquinas del lote, en metros) }

El diseño NO lleva precios. Se limpia aquí (tipos, rangos y tamaños) antes de guardarlo.
Si todas las naves son iguales y de un tipo con fórmula, se cotiza automáticamente con el cálculo normal;
si no, el precio queda PENDIENTE hasta que el dueño entregue las fórmulas (cercha, puertas, cenital, etc.).
"""
import json
import math

import calculo

MAX_NAVES, MAX_PUERTAS, MAX_VERTICES = 20, 60, 60


def _num(v, minimo, maximo, defecto=None):
    try:
        n = float(v)
    except (TypeError, ValueError):
        return defecto
    if not math.isfinite(n):
        return defecto
    return min(max(n, minimo), maximo)


def limpiar(d):
    """Devuelve el diseño limpio (o None si no viene). Lanza calculo.ErrorValidacion si no sirve."""
    if not d:
        return None
    if not isinstance(d, dict) or not isinstance(d.get("naves"), list) or not d["naves"]:
        raise calculo.ErrorValidacion([{"campo": "diseno", "mensaje": "El diseño no tiene naves."}])
    if len(d["naves"]) > MAX_NAVES:
        raise calculo.ErrorValidacion([{"campo": "diseno", "mensaje": f"El diseño puede tener máximo {MAX_NAVES} naves."}])
    naves = []
    for n in d["naves"]:
        if not isinstance(n, dict) or n.get("tipo") not in calculo.TIPOS:
            raise calculo.ErrorValidacion([{"campo": "diseno", "mensaje": "Una nave del diseño tiene un tipo de estructura no válido."}])
        naves.append({
            "tipo": n["tipo"],
            "ancho": _num(n.get("ancho"), 2, 100, 9), "largo": _num(n.get("largo"), 2, 500, 30),
            "inicio": _num(n.get("inicio"), -500, 500, 0),
            "alturaPostes": _num(n.get("alturaPostes"), 1.5, 8) if n.get("alturaPostes") else None,
            "cenital": bool(n.get("cenital")), "cortinas": n.get("cortinas") is not False,
        })
    canales = d.get("canales") if isinstance(d.get("canales"), list) else []
    canales = [bool(canales[i]) if i < len(canales) else False for i in range(len(naves) + 1)]
    puertas = []
    for p in (d.get("puertas") or [])[:MAX_PUERTAS]:
        if not isinstance(p, dict):
            continue
        try:
            i = int(p.get("nave"))
        except (TypeError, ValueError):
            continue
        if 0 <= i < len(naves):
            puertas.append({"nave": i, "lado": "fondo" if p.get("lado") == "fondo" else "frente",
                            "posicion": _num(p.get("posicion"), 0, naves[i]["ancho"], 0), "ancho": _num(p.get("ancho"), 0.8, 10, 3)})
    terreno = []
    for v in (d.get("terreno") or [])[:MAX_VERTICES]:
        if isinstance(v, (list, tuple)) and len(v) == 2:
            x, z = _num(v[0], -2000, 2000), _num(v[1], -2000, 2000)
            if x is not None and z is not None:
                terreno.append([round(x, 2), round(z, 2)])
    ancho_canal = str(d.get("anchoCanal") or "0")
    return {"version": 1, "distancia": _num(d.get("distancia"), 0.5, 10, 2.5), "anchoCanal": ancho_canal,
            "naves": naves, "canales": canales, "puertas": puertas, "terreno": terreno if len(terreno) >= 3 else []}


def como_simple(d):
    """
    Si el diseño equivale a «todas las naves iguales» de un tipo con fórmula, devuelve los parámetros
    del cálculo normal (tipo, largo, ancho, naves, distancia, anchoCanal). Si no, None (precio pendiente).
    El terreno no cambia el precio.
    """
    n = d["naves"]
    a = n[0]
    iguales = all(x["tipo"] == a["tipo"] and x["ancho"] == a["ancho"] and x["largo"] == a["largo"] and x["inicio"] == a["inicio"]
                  and not x["alturaPostes"] and x["cortinas"] for x in n)
    sin_extras = not d["puertas"] and (a["tipo"] == "Tubular" or not any(x["cenital"] for x in n))
    canales_formula = all(d["canales"]) or not any(d["canales"])
    if not (iguales and sin_extras and canales_formula and a["tipo"] in calculo.CON_FORMULA):
        return None
    return {"tipo": a["tipo"], "largo": a["largo"], "ancho": a["ancho"], "naves": len(n), "distancia": d["distancia"],
            "anchoCanal": d["anchoCanal"] if all(d["canales"]) else "0"}


def resumen(d):
    """Parámetros resumen de un diseño a medida (para las columnas de la tabla; el detalle va en diseno_json)."""
    n = d["naves"]
    tipos = [x["tipo"] for x in n]
    return {"tipo": max(set(tipos), key=tipos.count), "largo": max(x["largo"] for x in n),
            "ancho": round(sum(x["ancho"] for x in n) / len(n), 2), "naves": len(n), "distancia": d["distancia"],
            "anchoCanal": d["anchoCanal"] if any(d["canales"]) else "0"}


def motivo_pendiente(d):
    """Explica por qué el diseño no se puede calcular solo (para mostrarlo en pantalla)."""
    n = d["naves"]
    sin = sorted({calculo.TIPOS[x["tipo"]] for x in n if x["tipo"] not in calculo.CON_FORMULA})
    razones = []
    if sin:
        razones.append("tipos sin fórmula todavía: " + ", ".join(sin))
    if len({(x["ancho"], x["largo"], x["inicio"]) for x in n}) > 1:
        razones.append("naves de distinto ancho, largo o ubicación")
    if len({x["tipo"] for x in n}) > 1:
        razones.append("mezcla de tipos de estructura")
    if d["puertas"]:
        razones.append("puertas")
    if any(x["cenital"] for x in n if x["tipo"] != "Tubular"):
        razones.append("ventana cenital")
    if any(x["alturaPostes"] for x in n):
        razones.append("altura de postes personalizada")
    if not all(x["cortinas"] for x in n):
        razones.append("naves sin cortinas")
    if any(d["canales"]) and not all(d["canales"]):
        razones.append("canales solo en algunas líneas")
    return "Diseño a medida (" + "; ".join(razones or ["personalizado"]) + "): el precio lo calcula el dueño. Fórmulas pendientes."


def a_texto(d):
    return json.dumps(d, ensure_ascii=False, separators=(",", ":")) if d else None


def de_texto(t):
    try:
        return json.loads(t) if t else None
    except (TypeError, ValueError):
        return None

"""
Compara calculo.py con el motor original de JavaScript (calculo.js) en 300 casos
generados al azar (casos_calculo_js.json). Uso:  .venv\\Scripts\\python pruebas\\test_calculo.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import calculo  # noqa: E402

datos = json.loads((Path(__file__).parent / "casos_calculo_js.json").read_text(encoding="utf-8"))
pr = datos["precios"]
precios = {
    "base": {k: {"id": i + 1, "nombre": k, "precio": pr[k]} for i, k in enumerate(["tubo", "guadua", "carevaca_s", "carevaca_r"])},
    "plastico": {"5.80": 3200, "6.00": 4200, "6.50": 5200, "8.00": 7200, "10.00": 8200},
    "canal": {"0.90": 350000, "1.20": 355000, "1.50": 360000, "2.00": 365000},
}
ANCHOS_P = set(precios["plastico"])
ANCHOS_C = set(precios["canal"])
DIST_MAX = {"Tubular": 5.0, "Guadua": 4.0}

fallas = 0
for n, caso in enumerate(datos["casos"], 1):
    p = calculo.normalizar(caso["params"], ANCHOS_P, ANCHOS_C, DIST_MAX)
    r = calculo.calcular(p, precios, caso["extras"])
    e = caso["esperado"]
    filas_py = [{"tipo": "seccion", "texto": f["texto"]} if f["tipo"] == "seccion"
                else {"tipo": "item", "cant": f["cant"], "unidad": f["unidad"], "pu": f["pu"], "st": f["st"]} for f in r["filas"]]
    iguales = (filas_py == e["filas"] and r["cMat"] == e["cMat"] and r["cObra"] == e["cObra"]
               and r["total"] == e["total"] and r["area"] == e["area"])
    if not iguales:
        fallas += 1
        print("DIFERENTE caso", n, caso["params"], "\n  py:", r["total"], filas_py, "\n  js:", e["total"], e["filas"])

# Casos inválidos: deben rechazarse con el campo correcto
invalidos = [
    ({"largo": 99999}, "largo"), ({"naves": 3.7}, "naves"), ({"ancho": -3}, "ancho"),
    ({"tipo": "Guadua", "distancia": 4.5}, "distancia"), ({"anchoPlastico": "7.00"}, "anchoPlastico"),
    ({"modalidad": "Gratis"}, "modalidad"), ({"largo": "abc"}, "largo"), ({"naves": True}, "naves"),
]
base = {"tipo": "Tubular", "largo": 50, "ancho": 24, "distancia": 2.5, "naves": 2, "calibrePlastico": "6",
        "anchoPlastico": "5.80", "anchoCanal": "0", "calibreCanal": "6", "modalidad": "Todo Costo"}
for cambio, campo in invalidos:
    try:
        calculo.normalizar({**base, **cambio}, ANCHOS_P, ANCHOS_C, DIST_MAX)
        fallas += 1; print("NO RECHAZÓ", cambio)
    except calculo.ErrorValidacion as ex:
        if campo not in [x["campo"] for x in ex.errores]:
            fallas += 1; print("CAMPO INCORRECTO", cambio, ex.errores)

total = len(datos["casos"]) + len(invalidos)
print(f"{total - fallas}/{total} casos correctos")
sys.exit(1 if fallas else 0)

"""
Prueba de la API completa contra una base de datos de PRUEBA (agroestructuras_prueba),
que se crea al empezar y se borra al terminar. La base real no se toca.
Uso:  .venv\\Scripts\\python pruebas\\test_api.py
"""
import os
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))
os.environ["CODIGO_DUENO"] = "CODIGO-PRUEBA"
import config  # noqa: E402

BASE_PRUEBA = "agroestructuras_prueba"
config.DB["database"] = BASE_PRUEBA
config.CODIGO_DUENO = "CODIGO-PRUEBA"
# Correos en modo prueba, en una carpeta temporal que se borra al final
import shutil  # noqa: E402
import socket  # noqa: E402
import threading  # noqa: E402
import time  # noqa: E402
from email import message_from_bytes, policy  # noqa: E402

config.SMTP_HOST = ""
config.CORREOS_SALIDA = RAIZ / "pruebas" / "_correos_prueba"
shutil.rmtree(config.CORREOS_SALIDA, ignore_errors=True)


def leer_eml(contiene, espera=4.0):
    """Busca en la carpeta de prueba un .eml cuyo asunto contenga el texto. Devuelve (asunto, para, texto, html)."""
    fin = time.time() + espera
    while time.time() < fin:
        for f in sorted(config.CORREOS_SALIDA.glob("*.eml")) if config.CORREOS_SALIDA.exists() else []:
            m = message_from_bytes(f.read_bytes(), policy=policy.default)
            if contiene in m["Subject"]:
                return m["Subject"], m["To"], m.get_body(("plain",)).get_content(), m.get_body(("html",)).get_content()
        time.sleep(0.2)
    return None


class SMTPFalso:
    """Servidor SMTP mínimo en 127.0.0.1 que guarda lo que recibe (para probar el envío real sin internet)."""

    def __init__(self):
        self.sock = socket.socket(); self.sock.bind(("127.0.0.1", 0)); self.sock.listen(1)
        self.puerto = self.sock.getsockname()[1]; self.recibido = []
        threading.Thread(target=self._atender, daemon=True).start()

    def _atender(self):
        while True:
            try:
                con, _ = self.sock.accept()
            except OSError:
                return
            f = con.makefile("rb"); w = lambda t: con.sendall(t.encode() + b"\r\n")
            w("220 falso"); datos = None; para = []
            for linea in f:
                l = linea.decode(errors="replace").rstrip("\r\n")
                if datos is not None:
                    if l == ".":
                        self.recibido.append((para, "\n".join(datos))); datos = None; w("250 ok")
                    else:
                        datos.append(l)
                    continue
                cmd = l.upper()
                if cmd.startswith("EHLO") or cmd.startswith("HELO"): w("250 falso")
                elif cmd.startswith("RCPT"): para.append(l.split(":", 1)[1].strip(" <>")); w("250 ok")
                elif cmd.startswith("DATA"): datos = []; w("354 envia")
                elif cmd.startswith("QUIT"): w("221 adios"); break
                else: w("250 ok")
            con.close()

import pymysql  # noqa: E402

import instalar  # noqa: E402

admin = pymysql.connect(host=config.DB["host"], port=config.DB["port"], user=config.DB["user"], password=config.DB["password"], charset="utf8mb4")
with admin.cursor() as c:
    c.execute(f"DROP DATABASE IF EXISTS `{BASE_PRUEBA}`")
instalar.crear_base(admin, BASE_PRUEBA)

from app import app  # noqa: E402

fallas = 0


def ver(texto, cond):
    global fallas
    if not cond:
        fallas += 1
    print(("OK    " if cond else "FALLA ") + texto)


PARAMS = {"tipo": "Tubular", "largo": 50, "ancho": 24, "distancia": 2.5, "naves": 2, "calibrePlastico": "6",
          "anchoPlastico": "5.80", "anchoCanal": "0", "calibreCanal": "6", "modalidad": "Todo Costo"}

try:
    anon, cli, dueno, otro = (app.test_client() for _ in range(4))

    # ---- sin sesión
    r = anon.post("/api/calculo", json={"params": PARAMS})
    ver("cálculo sin sesión responde sin precios", r.status_code == 200 and "total" not in r.json["resultado"]
        and all("pu" not in f for f in r.json["resultado"]["filas"]))
    ver("sin sesión no ve cotizaciones (401)", anon.get("/api/cotizaciones").status_code == 401)
    ver("escritura sin JSON se rechaza (415, protección CSRF)", anon.post("/api/login", data={"correo": "x"}).status_code == 415)
    r = anon.post("/api/calculo", json={"params": {**PARAMS, "largo": 99999}})
    ver("validación en el servidor (largo 99999 → 400, campo largo)", r.status_code == 400 and r.json["campo"] == "largo")

    # ---- registro
    r = cli.post("/api/registro", json={"nombre": "Carla Cliente", "correo": "carla@prueba.co", "telefono": "3001234567", "ciudad": "La Ceja", "clave": "clave1234"})
    ver("registro de cliente", r.status_code == 201 and r.json["usuario"]["rol"] == "cliente")
    ver("correo repetido → 409", cli.post("/api/registro", json={"nombre": "Otra", "correo": "CARLA@prueba.co", "clave": "clave1234"}).status_code == 409)
    ver("clave débil → 400", anon.post("/api/registro", json={"nombre": "Débil", "correo": "d@prueba.co", "clave": "123"}).json.get("campo") == "regClave")
    r = dueno.post("/api/registro", json={"nombre": "Libardo", "correo": "libardo@prueba.co", "clave": "clave1234", "codigo": "MALO"})
    ver("código de dueño incorrecto → 400", r.status_code == 400 and r.json["campo"] == "regCodigo")
    r = dueno.post("/api/registro", json={"nombre": "Libardo Dueño", "correo": "libardo@prueba.co", "telefono": "3109876543", "clave": "clave1234", "codigo": "CODIGO-PRUEBA"})
    ver("registro del dueño con código", r.status_code == 201 and r.json["usuario"]["rol"] == "dueno")
    # Tipo de cuenta elegido en el formulario
    r = anon.post("/api/registro", json={"nombre": "Sin Clave", "correo": "sinclave@prueba.co", "clave": "clave1234", "tipo": "administrador", "codigo": ""})
    ver("tipo administrador sin clave → 400 (campo regCodigo)", r.status_code == 400 and r.json["campo"] == "regCodigo")
    r = app.test_client().post("/api/registro", json={"nombre": "Usuario Listo", "correo": "listo@prueba.co", "clave": "clave1234", "tipo": "usuario", "codigo": "CODIGO-PRUEBA"})
    ver("tipo usuario aunque mande la clave → queda como cliente (nunca administrador)", r.status_code == 201 and r.json["usuario"]["rol"] == "cliente")
    ver("tipo de cuenta inválido → 400", anon.post("/api/registro", json={"nombre": "Raro", "correo": "raro@prueba.co", "clave": "clave1234", "tipo": "jefe"}).status_code == 400)
    otro.post("/api/registro", json={"nombre": "Otro Cliente", "correo": "otro@prueba.co", "clave": "clave1234"})
    clave_bd = pymysql.connect(host=config.DB["host"], user=config.DB["user"], password=config.DB["password"], database=BASE_PRUEBA).cursor()
    clave_bd.execute("SELECT clave_hash FROM usuarios WHERE correo = 'carla@prueba.co'")
    ver("la contraseña se guarda cifrada (hash), no en texto", "clave1234" not in clave_bd.fetchone()[0])
    ver("login con clave mala → 401", anon.post("/api/login", json={"correo": "carla@prueba.co", "clave": "malamala1"}).status_code == 401)

    # ---- permisos del cliente
    for metodo, ruta in (("get", "/api/cotizaciones"), ("get", "/api/precios"), ("get", "/api/insumos"), ("put", "/api/precios"), ("post", "/api/obras")):
        ver(f"cliente NO puede {metodo.upper()} {ruta} (403)", getattr(cli, metodo)(ruta, json={}).status_code == 403)
    r = cli.post("/api/calculo", json={"params": PARAMS})
    ver("cliente: cálculo sin precios", "total" not in r.json["resultado"] and "cMat" not in r.json["resultado"])

    # ---- diseño a medida
    NAVE = {"tipo": "Guadua", "ancho": 9, "largo": 40, "inicio": 0, "cortinas": True}
    iguales = {"distancia": 3, "anchoCanal": "0", "naves": [NAVE, NAVE, NAVE], "canales": [False] * 4, "puertas": [], "terreno": []}
    r1 = dueno.post("/api/calculo", json={"params": PARAMS, "diseno": iguales}).json
    r2 = dueno.post("/api/calculo", json={"params": {**PARAMS, "tipo": "Guadua", "largo": 40, "ancho": 9, "naves": 3, "distancia": 3}}).json
    ver("diseño con naves iguales se calcula igual que el modo simple", r1.get("resultado") and r1["resultado"]["total"] == r2["resultado"]["total"])
    distinto = {**iguales, "naves": [NAVE, {**NAVE, "largo": 30, "inicio": 10}, {**NAVE, "tipo": "Cercha"}],
                "puertas": [{"nave": 0, "lado": "frente", "posicion": 3, "ancho": 3}], "terreno": [[0, 0], [30, 0], [30, 50], [0, 50]]}
    r = dueno.post("/api/calculo", json={"params": PARAMS, "diseno": distinto}).json
    ver("diseño a medida → precio PENDIENTE (no inventa valores)", r.get("pendiente") is True and r["resultado"] is None and "Capilla en cercha" in r["motivo"] and "puertas" in r["motivo"])
    r = anon.post("/api/calculo", json={"params": {**PARAMS, "tipo": "Cercha"}}).json
    ver("tipo cercha en modo simple → pendiente", r.get("pendiente") is True)
    ver("diseño con tipo inválido → 400", anon.post("/api/calculo", json={"params": PARAMS, "diseno": {"naves": [{**NAVE, "tipo": "Castillo"}]}}).status_code == 400)
    ver("diseño con más de 20 naves → 400", anon.post("/api/calculo", json={"params": PARAMS, "diseno": {"naves": [NAVE] * 21}}).status_code == 400)
    r = dueno.post("/api/cotizaciones", json={"cliente": "Prueba", "params": PARAMS, "diseno": distinto})
    ver("el dueño no puede guardar un total de un diseño pendiente (409)", r.status_code == 409 and r.json.get("pendiente") is True)
    r = cli.post("/api/solicitudes", json={"params": PARAMS, "proyecto": "Lote irregular", "diseno": distinto})
    sol_dis = r.json.get("solicitud", {})
    ver("el cliente envía una solicitud con diseño a medida", r.status_code == 201 and len(sol_dis.get("diseno", {}).get("naves", [])) == 3)
    ver("el diseño guardado conserva puertas y terreno, y la solicitud su resumen", sol_dis["diseno"]["puertas"][0]["lado"] == "frente"
        and len(sol_dis["diseno"]["terreno"]) == 4 and sol_dis["params"]["naves"] == 3 and sol_dis["params"]["largo"] == 40)
    ver("el dueño ve el diseño en la solicitud", any(s["id"] == sol_dis["id"] and s["diseno"] for s in dueno.get("/api/solicitudes").json["solicitudes"]))
    cli.post(f"/api/solicitudes/{sol_dis['id']}/cancelar", json={})  # para no alterar los conteos de abajo

    # ---- solicitud del cliente
    r = cli.post("/api/solicitudes", json={"params": {**PARAMS, "largo": 60}, "proyecto": "Rosas La Esperanza", "observaciones": "Terreno con pendiente"})
    ver("cliente envía solicitud SOL-AAAA-NNNN", r.status_code == 201 and re.fullmatch(r"SOL-\d{4}-\d{4}", r.json["solicitud"]["id"]) is not None)
    sol = r.json["solicitud"]["id"]
    texto = str(r.json)
    ver("la solicitud no trae precios", "total" not in texto and "precio" not in texto)
    ver("dueño no envía solicitudes (403)", dueno.post("/api/solicitudes", json={"params": PARAMS}).status_code == 403)
    ver("otro cliente no ve la solicitud ajena", otro.get("/api/solicitudes").json["solicitudes"] == [])
    ver("otro cliente no puede cancelarla (404)", otro.post(f"/api/solicitudes/{sol}/cancelar", json={}).status_code == 404)

    # ---- dueño: ve la solicitud, la cotiza y la libera
    lista = dueno.get("/api/solicitudes").json["solicitudes"]
    ver("dueño ve la solicitud con contacto", len(lista) == 1 and lista[0]["telefono"] == "3001234567" and lista[0]["estado"] == "Pendiente")
    ver("revisar → «En revisión»", dueno.post(f"/api/solicitudes/{sol}/revisar", json={}).json["solicitud"]["estado"] == "En revisión")
    ver("cliente ya no puede cancelar (en revisión → 409)", cli.post(f"/api/solicitudes/{sol}/cancelar", json={}).status_code == 409)
    r = dueno.post("/api/insumos", json={"nombre": "Cemento gris", "precio": 32000})
    ins = r.json["insumo"]["id"]
    r = dueno.post("/api/cotizaciones", json={"cliente": "Carla — Rosas", "params": {**PARAMS, "largo": 60}, "idSolicitud": sol,
                                              "insumos": [{"id": ins, "cantidad": 3}]})
    cot = r.json["cotizacion"]
    ver("dueño crea cotización PRJ-…-0001 vinculada", r.status_code == 201 and cot["id"].endswith("-0001") and cot["idSolicitud"] == sol)
    esperado = dueno.post("/api/calculo", json={"params": {**PARAMS, "largo": 60}, "insumos": [{"id": ins, "cantidad": 3}]}).json["resultado"]["total"]
    ver(f"total guardado = total calculado ({cot['resultado']['total']:,})", cot["resultado"]["total"] == esperado)
    ver("el detalle incluye el insumo", any(f.get("nombre") == "Cemento gris" for f in cot["resultado"]["filas"]))
    ver("cliente aún no ve la cotización (404)", cli.get(f"/api/solicitudes/{sol}/cotizacion").status_code == 404)
    ver("correo antes de «Enviar al cliente» → 409", dueno.post(f"/api/cotizaciones/{cot['id']}/correo", json={}).status_code == 409)

    # ---- correo: aviso al dueño por la solicitud nueva (se envía en segundo plano)
    aviso = leer_eml(sol)
    ver("correo de aviso al dueño por la solicitud nueva", aviso is not None and "libardo@prueba.co" in aviso[1]
        and "Carla Cliente" in aviso[2] and f"solicitud={sol}" in aviso[2] and "Terreno con pendiente" in aviso[2])
    ver("liberar al cliente", dueno.post(f"/api/cotizaciones/{cot['id']}/liberar", json={"visible": True}).status_code == 200)
    mias = cli.get("/api/solicitudes").json["solicitudes"]
    ver("solicitud del cliente: «Cotizada» y lista", mias[0]["estado"] == "Cotizada" and mias[0]["cotizacionLista"] is True)
    r = cli.get(f"/api/solicitudes/{sol}/cotizacion")
    ver("cliente descarga SU cotización con total", r.status_code == 200 and r.json["cotizacion"]["resultado"]["total"] == esperado)
    res_cli = r.json["cotizacion"]["resultado"]
    ver("…pero SIN precio por material, subtotales ni materiales/mano de obra",
        all("pu" not in f and "st" not in f for f in res_cli["filas"]) and "cMat" not in res_cli and "cObra" not in res_cli
        and "insumos" not in r.json["cotizacion"] and "32000" not in r.get_data(as_text=True))
    ver("…y con las cantidades de materiales", any(f.get("cant") for f in res_cli["filas"]))

    # ---- correo de la cotización al cliente (modo prueba: queda como .eml)
    ver("el cliente no puede mandar correos (403)", cli.post(f"/api/cotizaciones/{cot['id']}/correo", json={}).status_code == 403)
    r = dueno.post(f"/api/cotizaciones/{cot['id']}/correo", json={})
    ver("dueño envía la cotización por correo (modo prueba)", r.status_code == 200 and r.json["modo"] == "prueba" and r.json["para"] == "carla@prueba.co")
    em = leer_eml(cot["id"])
    total_txt = "$ " + f"{round(esperado):,}".replace(",", ".")
    ver(f"correo al cliente: para Carla, con el total {total_txt}", em is not None and "carla@prueba.co" in em[1] and total_txt in em[2] and total_txt in em[3])
    ver("correo al cliente: observación (mano de obra, materiales y acarreo)", em is not None and "Acarreo de los materiales hasta el punto de construcción" in em[2] and "Precio de los materiales" in em[3])
    ver("correo al cliente: SIN precio por material ni subtotales", em is not None and not any(x in em[2] + em[3] for x in ("32.000", "45.000", "17.000", "22.000", "3.200", "Vr.", "Subtotal", "Costo materiales")))
    clave_bd.connection.commit()
    clave_bd.execute("SELECT COUNT(*) FROM notificaciones WHERE canal = 'correo' AND estado_envio = 'enviada'")
    ver("los correos quedan registrados en notificaciones", clave_bd.fetchone()[0] >= 2)

    # ---- correo por SMTP de verdad (contra un servidor de correo falso local)
    falso = SMTPFalso()
    config.SMTP_HOST, config.SMTP_PUERTO, config.SMTP_TLS, config.SMTP_USUARIO = "127.0.0.1", falso.puerto, False, ""
    r = dueno.post(f"/api/cotizaciones/{cot['id']}/correo", json={})
    time.sleep(0.3)
    ver("envío por SMTP: el servidor de correo recibió el mensaje para Carla", r.status_code == 200 and r.json["modo"] == "smtp"
        and falso.recibido and falso.recibido[0][0] == ["carla@prueba.co"])
    config.SMTP_HOST, config.SMTP_PUERTO = "127.0.0.1", 1  # puerto cerrado: debe fallar con mensaje claro
    r = dueno.post(f"/api/cotizaciones/{cot['id']}/correo", json={})
    ver("si el servidor de correo no responde → error claro (502)", r.status_code == 502 and "No se pudo enviar" in r.json["error"])
    config.SMTP_HOST = ""
    ver("otro cliente no puede verla (404)", otro.get(f"/api/solicitudes/{sol}/cotizacion").status_code == 404)

    # ---- precios: cambio, historial y nuevo cálculo
    viejo = dueno.get("/api/precios").json["precios"]
    ver("dueño ve los 4 precios base", set(viejo) == {"tubo", "guadua", "carevaca_s", "carevaca_r"})
    ver("precio 0 se rechaza", dueno.put("/api/precios", json={**viejo, "tubo": 0}).status_code == 400)
    dueno.put("/api/precios", json={**viejo, "tubo": 50000})
    clave_bd.connection.commit()
    clave_bd.execute("SELECT COUNT(*) FROM historial_precios hp JOIN materiales m USING (id_material) WHERE m.codigo = 'tubo' AND hp.precio = 50000")
    ver("el cambio de precio queda en historial_precios", clave_bd.fetchone()[0] == 1)
    ver("la cotización guardada conserva el precio del momento", dueno.get(f"/api/cotizaciones/{cot['id']}").json["cotizacion"]["resultado"]["total"] == esperado)
    nuevo = dueno.post("/api/calculo", json={"params": PARAMS}).json["resultado"]["total"]
    dueno.post("/api/precios/restablecer", json={})
    ver("un cálculo nuevo usa el precio nuevo", nuevo > dueno.post("/api/calculo", json={"params": PARAMS}).json["resultado"]["total"])

    # ---- anular y deshacer
    dueno.post(f"/api/cotizaciones/{cot['id']}/anular", json={})
    ver("anular: el cliente deja de verla y vuelve a «En revisión»", cli.get(f"/api/solicitudes/{sol}/cotizacion").status_code == 404
        and cli.get("/api/solicitudes").json["solicitudes"][0]["estado"] == "En revisión")
    dueno.post(f"/api/cotizaciones/{cot['id']}/restaurar", json={"estado": "Cotizado", "visibleCliente": True})
    ver("deshacer: vuelve a estar enviada", cli.get(f"/api/solicitudes/{sol}/cotizacion").status_code == 200)
    ver("cambiar estado a «Aprobado»", dueno.patch(f"/api/cotizaciones/{cot['id']}/estado", json={"estado": "Aprobado"}).status_code == 200
        and dueno.get("/api/cotizaciones").json["cotizaciones"][0]["estado"] == "Aprobado")

    # ---- obras
    PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    r = dueno.post("/api/obras", json={"nombre": "Finca El Rosal", "tipo": "guadua", "ubicacion": "Rionegro", "largo": 40, "ancho": 16, "anio": 2025, "foto": PNG})
    ver("dueño registra obra con foto", r.status_code == 201 and r.json["obra"]["foto"].startswith("/uploads/obras/"))
    ver("foto falsa se rechaza", dueno.post("/api/obras", json={"nombre": "X", "ubicacion": "Y", "foto": "data:image/png;base64,SG9sYQ=="}).status_code == 400)
    ver("todos ven la galería (sin sesión)", len(anon.get("/api/obras").json["obras"]) == 1)
    ver("la foto se puede abrir", anon.get(r.json["obra"]["foto"]).status_code == 200)
    foto = RAIZ / "uploads" / "obras" / r.json["obra"]["foto"].rsplit("/", 1)[1]
    foto.unlink(missing_ok=True)

    # ---- límite de intentos con la clave de administrador
    import rutas_cuentas
    rutas_cuentas._intentos.clear()
    for i in range(5):
        anon.post("/api/registro", json={"nombre": "Intruso", "correo": f"intruso{i}@prueba.co", "clave": "clave1234", "tipo": "administrador", "codigo": f"ADIVINA-{i}"})
    r = anon.post("/api/registro", json={"nombre": "Intruso", "correo": "intruso9@prueba.co", "clave": "clave1234", "tipo": "administrador", "codigo": "CODIGO-PRUEBA"})
    ver("tras 5 claves equivocadas se bloquea 15 min (429), aunque la siguiente sea correcta", r.status_code == 429)
    ver("…y una cuenta de usuario sí se puede crear durante el bloqueo", anon.post("/api/registro", json={"nombre": "Normal", "correo": "normal@prueba.co", "clave": "clave1234", "tipo": "usuario"}).status_code == 201)
    rutas_cuentas._intentos.clear()

    # ---- front-end servido por Flask
    ver("sirve index.html", anon.get("/").status_code == 200 and b"AgroEstructura" in anon.get("/").data)
    ver("no sirve la carpeta herramientas", anon.get("/herramientas/servidor.js").status_code == 404)
    ver("cerrar sesión", cli.post("/api/logout", json={}).status_code == 200 and cli.get("/api/sesion").json["usuario"] is None)
finally:
    try:
        clave_bd.connection.close()  # si queda abierta, MySQL no deja borrar la base de prueba
    except Exception:
        pass
    time.sleep(0.5)  # deja terminar el aviso en segundo plano antes de borrar la base
    with admin.cursor() as c:
        c.execute(f"DROP DATABASE IF EXISTS `{BASE_PRUEBA}`")
    admin.close()
    shutil.rmtree(config.CORREOS_SALIDA, ignore_errors=True)

print(f"\nFallas: {fallas}")
sys.exit(1 if fallas else 0)

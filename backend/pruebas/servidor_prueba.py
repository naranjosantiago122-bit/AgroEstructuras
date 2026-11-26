"""
Arranca el servidor contra una base de datos de PRUEBA nueva (agroestructuras_prueba) en el puerto 5001.
Sirve para probar en el navegador sin tocar la base real. Al terminar, borra la base con:
    .venv\\Scripts\\python pruebas\\servidor_prueba.py --borrar
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import config  # noqa: E402

BASE_PRUEBA = "agroestructuras_prueba"
import pymysql  # noqa: E402

import instalar  # noqa: E402

import shutil  # noqa: E402

# Correos en modo prueba, en una carpeta aparte (se borra con --borrar)
config.SMTP_HOST = ""
config.CORREOS_SALIDA = Path(__file__).resolve().parent / "_correos_servidor_prueba"
shutil.rmtree(config.CORREOS_SALIDA, ignore_errors=True)

admin = pymysql.connect(host=config.DB["host"], port=config.DB["port"], user=config.DB["user"], password=config.DB["password"], charset="utf8mb4")
with admin.cursor() as c:
    c.execute(f"DROP DATABASE IF EXISTS `{BASE_PRUEBA}`")
if "--borrar" in sys.argv:
    print("Base de prueba borrada.")
    sys.exit(0)
instalar.crear_base(admin, BASE_PRUEBA)
admin.close()

config.DB["database"] = BASE_PRUEBA
config.CODIGO_DUENO = "CODIGO-PRUEBA"
from app import app  # noqa: E402

print("Servidor de PRUEBA en http://127.0.0.1:5001", flush=True)
app.run(host="127.0.0.1", port=5001, debug=False)

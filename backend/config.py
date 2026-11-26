"""
Configuración del back-end. Los valores se leen del archivo .env (junto a este archivo).
Ver .env.ejemplo. El archivo .env NO se sube a ningún repositorio: tiene claves.
"""
import os
from pathlib import Path

BASE = Path(__file__).resolve().parent


def _cargar_env():
    archivo = BASE / ".env"
    if not archivo.exists():
        return
    for linea in archivo.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#") or "=" not in linea:
            continue
        clave, valor = linea.split("=", 1)
        os.environ.setdefault(clave.strip(), valor.strip())


_cargar_env()

# Conexión a MySQL / MariaDB
DB = {
    "host": os.environ.get("DB_HOST", "127.0.0.1"),
    "port": int(os.environ.get("DB_PUERTO", "3306")),
    "user": os.environ.get("DB_USUARIO", "root"),
    "password": os.environ.get("DB_CLAVE", ""),
    "database": os.environ.get("DB_NOMBRE", "agroestructuras"),
}

# Clave para firmar la cookie de sesión. Si falta, se genera una al arrancar
# (las sesiones se cierran cada vez que se reinicia el servidor).
SECRET_KEY = os.environ.get("SECRET_KEY") or os.urandom(32).hex()

# Código para registrar la cuenta del dueño. Vacío = nadie puede registrarse como dueño.
CODIGO_DUENO = os.environ.get("CODIGO_DUENO", "")

PUERTO = int(os.environ.get("PUERTO", "5000"))

# Dirección con la que se abre la página (para los enlaces de los correos)
URL_PUBLICA = os.environ.get("URL_PUBLICA", f"http://localhost:{PUERTO}").rstrip("/")

# Correo saliente (SMTP). Si SMTP_HOST está vacío, los correos NO se envían:
# se guardan como archivos .eml en backend/correos_salida (modo prueba).
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PUERTO = int(os.environ.get("SMTP_PUERTO", "587") or 587)
SMTP_USUARIO = os.environ.get("SMTP_USUARIO", "")
SMTP_CLAVE = os.environ.get("SMTP_CLAVE", "")
SMTP_TLS = os.environ.get("SMTP_TLS", "si").lower() not in ("no", "0", "false")
CORREO_REMITENTE = os.environ.get("CORREO_REMITENTE", "") or SMTP_USUARIO or "no-responder@agroestructuras.local"
NOMBRE_REMITENTE = os.environ.get("NOMBRE_REMITENTE", "AgroEstructuras")
# ¿El correo al cliente lleva las cantidades de materiales? (igual que CLIENTE_VE_CANTIDADES en frontend/js/datos.js)
CLIENTE_VE_CANTIDADES = os.environ.get("CLIENTE_VE_CANTIDADES", "si").lower() not in ("no", "0", "false")
# A dónde llegan los avisos de solicitudes nuevas. Vacío = al correo de cada cuenta de dueño.
CORREO_AVISOS = os.environ.get("CORREO_AVISOS", "")

# Carpetas
FRONTEND = (BASE.parent / "frontend").resolve()
UPLOADS = (BASE / "uploads").resolve()
CORREOS_SALIDA = (BASE / "correos_salida").resolve()

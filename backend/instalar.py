"""
Instalador de la base de datos de AgroEstructuras.
  1. Crea la base «agroestructuras» con base_de_datos/agroestructuras_v2.sql (si no existe).
  2. Aplica la migración agroestructuras_v2_1_backend.sql (si falta).
  3. Crea el usuario de MySQL «agro_app» con permisos SOLO sobre esa base (leer y escribir datos,
     sin poder borrar tablas), para que la aplicación no use la cuenta root.
  4. Escribe backend/.env con la clave de ese usuario, la clave de las sesiones y el código del dueño.

No borra nada: si la base ya existe, la deja como está.
Uso:  .venv\\Scripts\\python instalar.py            (MySQL de XAMPP con root sin contraseña)
      .venv\\Scripts\\python instalar.py --root-clave MI_CLAVE
"""
import argparse
import secrets
import sys
from pathlib import Path

import pymysql

BASE = Path(__file__).resolve().parent
SQL = BASE.parent / "base_de_datos"
ENV = BASE / ".env"


def sentencias(texto):
    """Divide un script .sql en sentencias (el script no usa DELIMITER ni procedimientos)."""
    lineas = [l for l in texto.splitlines() if not l.strip().startswith("--")]
    actual, salida = [], []
    for l in lineas:
        actual.append(l)
        if l.rstrip().endswith(";"):
            s = "\n".join(actual).strip().rstrip(";").strip()
            if s:
                salida.append(s)
            actual = []
    return salida


def ejecutar_script(con, archivo, nombre_base):
    texto = (SQL / archivo).read_text(encoding="utf-8")
    texto = texto.replace("CREATE DATABASE IF NOT EXISTS agroestructuras", f"CREATE DATABASE IF NOT EXISTS `{nombre_base}`")
    texto = texto.replace("USE agroestructuras;", f"USE `{nombre_base}`;")
    with con.cursor() as c:
        for s in sentencias(texto):
            c.execute(s)
    con.commit()


def crear_base(con, nombre_base):
    """Crea la base y aplica la migración si hace falta. Devuelve un texto con lo que hizo."""
    with con.cursor() as c:
        c.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = %s", (nombre_base,))
        tablas = c.fetchone()[0]
    hecho = []
    if tablas == 0:
        ejecutar_script(con, "agroestructuras_v2.sql", nombre_base)
        hecho.append(f"base «{nombre_base}» creada (v2)")
    else:
        hecho.append(f"base «{nombre_base}» ya existía ({tablas} tablas): no se tocó")
    with con.cursor() as c:
        c.execute("""SELECT COUNT(*) FROM information_schema.columns
                     WHERE table_schema = %s AND table_name = 'solicitudes' AND column_name = 'nombre_proyecto'""", (nombre_base,))
        tiene = c.fetchone()[0]
    if not tiene:
        ejecutar_script(con, "agroestructuras_v2_1_backend.sql", nombre_base)
        hecho.append("migración v2.1 aplicada")
    with con.cursor() as c:
        c.execute("""SELECT COUNT(*) FROM information_schema.columns
                     WHERE table_schema = %s AND table_name = 'solicitudes' AND column_name = 'diseno_json'""", (nombre_base,))
        tiene_diseno = c.fetchone()[0]
    if not tiene_diseno:
        ejecutar_script(con, "agroestructuras_v2_2_disenos.sql", nombre_base)
        hecho.append("migración v2.2 (diseño personalizado) aplicada")
    return hecho


def leer_env():
    datos = {}
    if ENV.exists():
        for l in ENV.read_text(encoding="utf-8").splitlines():
            if "=" in l and not l.strip().startswith("#"):
                k, v = l.split("=", 1)
                datos[k.strip()] = v.strip()
    return datos


def main():
    a = argparse.ArgumentParser(description="Instala la base de datos de AgroEstructuras")
    a.add_argument("--host", default="127.0.0.1")
    a.add_argument("--puerto", type=int, default=3306)
    a.add_argument("--root-usuario", default="root")
    a.add_argument("--root-clave", default="")
    a.add_argument("--base", default="agroestructuras")
    args = a.parse_args()

    try:
        con = pymysql.connect(host=args.host, port=args.puerto, user=args.root_usuario, password=args.root_clave, charset="utf8mb4")
    except pymysql.err.OperationalError as e:
        sys.exit(f"No pude conectarme a MySQL ({e}). Enciende MySQL en el panel de XAMPP y vuelve a intentarlo.")

    for linea in crear_base(con, args.base):
        print("·", linea)

    env = leer_env()
    clave_app = env.get("DB_CLAVE") if env.get("DB_USUARIO") == "agro_app" else None
    clave_app = clave_app or secrets.token_urlsafe(18)
    usuario_db, clave_db = "agro_app", clave_app
    try:
        with con.cursor() as c:
            for host in ("localhost", "127.0.0.1"):
                c.execute(f"CREATE USER IF NOT EXISTS 'agro_app'@'{host}' IDENTIFIED BY %s", (clave_app,))
                c.execute(f"ALTER USER 'agro_app'@'{host}' IDENTIFIED BY %s", (clave_app,))
                c.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON `{args.base}`.* TO 'agro_app'@'{host}'")
            c.execute("FLUSH PRIVILEGES")
        con.commit()
        print("· usuario de MySQL «agro_app» listo (solo puede leer y escribir datos de la base)")
    except pymysql.err.MySQLError as e:
        # Pasa, por ejemplo, si la tabla interna mysql.db de XAMPP está dañada.
        con.rollback()
        with con.cursor() as c:
            for host in ("localhost", "127.0.0.1"):
                try:
                    c.execute(f"DROP USER IF EXISTS 'agro_app'@'{host}'")
                except pymysql.err.MySQLError:
                    pass
        usuario_db, clave_db = args.root_usuario, args.root_clave
        print(f"! No pude crear el usuario «agro_app» ({e.args[-1]}).")
        print(f"  La aplicación usará la cuenta «{usuario_db}» de MySQL (lo normal en XAMPP).")
        print("  Si quieres el usuario con permisos limitados, repara MySQL con:  mysqlcheck -u root --repair mysql")

    codigo = env.get("CODIGO_DUENO") or "DUENO-" + secrets.token_hex(4).upper()
    nuevo = {
        "DB_HOST": args.host, "DB_PUERTO": str(args.puerto), "DB_USUARIO": usuario_db, "DB_CLAVE": clave_db,
        "DB_NOMBRE": args.base, "SECRET_KEY": env.get("SECRET_KEY") or secrets.token_hex(32),
        "CODIGO_DUENO": codigo, "PUERTO": env.get("PUERTO", "5000"),
    }
    # Correo (SMTP): vacío = modo prueba. Se conserva lo que ya estuviera configurado.
    for clave in ("URL_PUBLICA", "SMTP_HOST", "SMTP_PUERTO", "SMTP_USUARIO", "SMTP_CLAVE", "SMTP_TLS", "CORREO_REMITENTE",
                  "NOMBRE_REMITENTE", "CORREO_AVISOS", "CLIENTE_VE_CANTIDADES"):
        nuevo[clave] = env.get(clave, {"SMTP_PUERTO": "587", "SMTP_TLS": "si", "NOMBRE_REMITENTE": "AgroEstructuras",
                                      "CLIENTE_VE_CANTIDADES": "si"}.get(clave, ""))
    for clave, valor in env.items():  # cualquier otra línea que se haya agregado a mano
        nuevo.setdefault(clave, valor)
    ENV.write_text("# Generado por instalar.py. NO compartas este archivo: tiene claves.\n"
                   + "\n".join(f"{k}={v}" for k, v in nuevo.items()) + "\n", encoding="utf-8")
    print("· archivo backend/.env escrito")
    print(f"\nCódigo para crear la cuenta del dueño: {codigo}")
    print("(Está en backend/.env, en CODIGO_DUENO. Puedes cambiarlo ahí y reiniciar el servidor.)")


if __name__ == "__main__":
    main()

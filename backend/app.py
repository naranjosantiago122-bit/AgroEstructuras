"""
AgroEstructuras · back-end (Flask + MySQL).
Sirve la API en /api/... y también las páginas del front-end (carpeta ../frontend),
así todo funciona en la misma dirección: http://localhost:5000

Arrancar:  INICIAR_BACKEND.bat   (o: .venv\\Scripts\\python app.py)
"""
import pymysql
from flask import Flask, abort, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException

import config
import db
import rutas_cotizacion
import rutas_cuentas
import rutas_inventario


def crear_app():
    app = Flask(__name__, static_folder=None)
    app.config.update(
        SECRET_KEY=config.SECRET_KEY,
        SESSION_COOKIE_HTTPONLY=True,      # el JavaScript de la página no puede leer la cookie
        SESSION_COOKIE_SAMESITE="Lax",     # otra página no puede usar la sesión
        MAX_CONTENT_LENGTH=6 * 1024 * 1024,
    )
    app.json.ensure_ascii = False
    app.teardown_appcontext(db.cerrar)
    for bp in (rutas_cuentas.bp, rutas_cotizacion.bp, rutas_inventario.bp):
        app.register_blueprint(bp)

    @app.before_request
    def solo_json():
        # Las escrituras de la API deben ser JSON: así otra página no puede enviarlas con un formulario (CSRF)
        if request.path.startswith("/api/") and request.method in ("POST", "PUT", "PATCH", "DELETE") and not request.is_json:
            return jsonify({"ok": False, "error": "La petición debe ser JSON."}), 415

    @app.after_request
    def cabeceras(resp):
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["X-Frame-Options"] = "DENY"
        resp.headers["Referrer-Policy"] = "same-origin"
        if request.path.startswith("/api/"):
            resp.headers["Cache-Control"] = "no-store"
        return resp

    @app.errorhandler(HTTPException)
    def error_http(e):
        if request.path.startswith("/api/"):
            mensajes = {404: "No existe esa dirección de la API.", 405: "Método no permitido.", 413: "El archivo es muy pesado."}
            return jsonify({"ok": False, "error": mensajes.get(e.code, e.description)}), e.code
        return e

    @app.errorhandler(pymysql.err.OperationalError)
    def sin_base_de_datos(e):
        app.logger.error("MySQL: %s", e)
        return jsonify({"ok": False, "error": "No hay conexión con la base de datos. ¿Está encendido MySQL en XAMPP?"}), 503

    @app.errorhandler(Exception)
    def error_inesperado(e):
        app.logger.exception(e)
        return jsonify({"ok": False, "error": "Ocurrió un error en el servidor. Intenta de nuevo."}), 500

    # ---------------------------------------------------------------- archivos
    @app.get("/uploads/<path:ruta>")
    def subidos(ruta):
        return send_from_directory(config.UPLOADS, ruta)

    @app.get("/")
    def inicio():
        return send_from_directory(config.FRONTEND, "index.html")

    @app.get("/<path:ruta>")
    def frontend(ruta):
        if ruta.startswith(("herramientas/", "api/")):
            abort(404)
        return send_from_directory(config.FRONTEND, ruta)

    return app


app = crear_app()

if __name__ == "__main__":
    print(f"AgroEstructuras en http://localhost:{config.PUERTO}  (Ctrl+C para detener)")
    app.run(host="127.0.0.1", port=config.PUERTO, debug=False)

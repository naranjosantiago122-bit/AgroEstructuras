"""
Conexión a MySQL con PyMySQL: una conexión por petición, guardada en flask.g.
Todas las consultas usan parámetros (%s), nunca texto concatenado, para evitar inyección SQL.
Las escrituras se confirman con commit() de forma explícita; si algo falla antes,
la conexión se cierra sin confirmar y MySQL deshace los cambios.
"""
import pymysql
from flask import g

import config


def conectar():
    return pymysql.connect(
        **config.DB,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
    )


def con():
    if "db" not in g:
        g.db = conectar()
    return g.db


def cerrar(_error=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def uno(sql, args=()):
    with con().cursor() as c:
        c.execute(sql, args)
        return c.fetchone()


def todos(sql, args=()):
    with con().cursor() as c:
        c.execute(sql, args)
        return c.fetchall()


def ejecutar(sql, args=()):
    """Ejecuta INSERT/UPDATE/DELETE. Devuelve el id insertado (si aplica)."""
    with con().cursor() as c:
        c.execute(sql, args)
        return c.lastrowid


def confirmar():
    con().commit()

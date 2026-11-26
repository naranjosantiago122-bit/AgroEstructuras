"""
Envío de correos (SMTP) y plantillas.
  - aviso_nueva_solicitud(): al dueño, cuando un cliente envía su diseño.
  - cotizacion_para_cliente(): al cliente, con SOLO el valor total (nunca el precio de cada material).

Si SMTP_HOST está vacío en .env, el correo NO se envía: se guarda como archivo .eml en
backend/correos_salida (modo prueba). Esos archivos se abren con doble clic en Outlook o Correo.
"""
import re
import smtplib
import ssl
from datetime import datetime
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from html import escape

import config

# Qué incluye el valor total. Debe decir lo mismo que INCLUYE en frontend/js/calculo.js.
INCLUYE_TODO_COSTO = ["Mano de obra", "Precio de los materiales", "Acarreo de los materiales hasta el punto de construcción"]
INCLUYE_SOLO_MO = ["Mano de obra"]
NOTA_SOLO_MO = "Los materiales los aporta el cliente."
NOMBRE_TIPO = {"Tubular": "Metálico Tubular", "Guadua": "Capilla de Guadua"}


def modo():
    """'smtp' si hay servidor de correo configurado; 'prueba' si los correos se guardan como archivo."""
    return "smtp" if config.SMTP_HOST else "prueba"


def _linea(texto):
    """Quita saltos de línea (evita inyectar cabeceras en el asunto o el destinatario)."""
    return re.sub(r"[\r\n]+", " ", str(texto or "")).strip()


def enviar(para, asunto, texto, html):
    """Envía (o guarda en modo prueba) un correo. Devuelve (ok, detalle)."""
    msg = EmailMessage()
    msg["From"] = formataddr((_linea(config.NOMBRE_REMITENTE), _linea(config.CORREO_REMITENTE)))
    msg["To"] = ", ".join(_linea(p) for p in (para if isinstance(para, (list, tuple)) else [para]))
    msg["Subject"] = _linea(asunto)
    msg["Message-ID"] = make_msgid(domain="agroestructuras")
    msg.set_content(texto)
    msg.add_alternative(html, subtype="html")

    if modo() == "prueba":
        config.CORREOS_SALIDA.mkdir(parents=True, exist_ok=True)
        nombre = datetime.now().strftime("%Y%m%d-%H%M%S-%f") + "-" + re.sub(r"[^a-z0-9]+", "-", asunto.lower())[:50].strip("-") + ".eml"
        (config.CORREOS_SALIDA / nombre).write_bytes(bytes(msg))
        return True, f"Modo prueba: el correo se guardó en backend/correos_salida/{nombre}"
    try:
        if config.SMTP_PUERTO == 465:
            servidor = smtplib.SMTP_SSL(config.SMTP_HOST, 465, timeout=15, context=ssl.create_default_context())
        else:
            servidor = smtplib.SMTP(config.SMTP_HOST, config.SMTP_PUERTO, timeout=15)
            if config.SMTP_TLS:
                servidor.starttls(context=ssl.create_default_context())
        with servidor:
            if config.SMTP_USUARIO:
                servidor.login(config.SMTP_USUARIO, config.SMTP_CLAVE)
            servidor.send_message(msg)
        return True, "Correo enviado."
    except smtplib.SMTPAuthenticationError:
        return False, "El servidor de correo rechazó el usuario o la contraseña (revisa SMTP_USUARIO y SMTP_CLAVE en .env)."
    except (smtplib.SMTPException, OSError) as e:
        return False, f"No se pudo enviar el correo: {e}"


# ---------------------------------------------------------------- plantillas
def _cop(n):
    return "$ " + f"{round(n):,}".replace(",", ".")


def _num(n):
    entero = float(n).is_integer()
    t = f"{int(n):,}" if entero else f"{n:,.2f}"
    return t.replace(",", "X").replace(".", ",").replace("X", ".")


def _marco(titulo, cuerpo):
    return f"""<!DOCTYPE html><html lang="es"><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="background:#14532d;color:#fff;padding:18px 24px;font-size:20px;font-weight:bold">AgroEstructuras · {escape(titulo)}</td></tr>
<tr><td style="padding:24px;font-size:14px;line-height:1.5">{cuerpo}</td></tr>
<tr><td style="padding:14px 24px;background:#f8fafc;color:#64748b;font-size:12px">Este correo lo envió la plataforma de cotizaciones de AgroEstructuras.</td></tr>
</table></td></tr></table></body></html>"""


def _configuracion(p):
    canal = "No requiere" if p["anchoCanal"] == "0" else f"{p['anchoCanal']} m · Cal. {p['calibreCanal']}"
    filas = [("Estructura", NOMBRE_TIPO.get(p["tipo"], p["tipo"])), ("Medidas", f"{_num(p['largo'])} m de largo × {_num(p['ancho'])} m por nave · {p['naves']} nave{'s' if p['naves'] > 1 else ''}"),
             ("Distancia entre postes", f"{_num(p['distancia'])} m"), ("Plástico", f"Calibre {p['calibrePlastico']} · rollo de {p['anchoPlastico']} m"),
             ("Canal", canal), ("Modalidad", p["modalidad"])]
    html = "".join(f'<tr><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;color:#475569">{escape(a)}</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0"><b>{escape(b)}</b></td></tr>' for a, b in filas)
    texto = "\n".join(f"  {a}: {b}" for a, b in filas)
    return f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 16px">{html}</table>', texto


def _boton(url, texto):
    return f'<p style="margin:20px 0"><a href="{escape(url)}" style="background:#16a34a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;display:inline-block">{escape(texto)}</a></p>'


def aviso_nueva_solicitud(sol, cliente):
    """sol: dict con codigo, proyecto, observaciones, params. cliente: nombre, correo, telefono, ciudad."""
    url = f"{config.URL_PUBLICA}/nuevo-proyecto.html?solicitud={sol['codigo']}"
    tabla, texto_cfg = _configuracion(sol["params"])
    contacto = " · ".join(x for x in [cliente["telefono"], cliente["correo"], cliente["ciudad"]] if x)
    obs = sol.get("observaciones") or "Sin observaciones."
    html = _marco("Nueva solicitud", f"""
<p style="margin-top:0">Llegó una nueva solicitud de cotización:</p>
<p style="font-size:18px;margin:4px 0"><b>{escape(sol['codigo'])}</b> · {escape(cliente['nombre'])}</p>
<p style="margin:4px 0;color:#475569">{escape(sol.get('proyecto') or '')}<br>{escape(contacto)}</p>
{tabla}
<p><b>Observaciones del cliente:</b> {escape(obs)}</p>
{_boton(url, 'Abrir y cotizar')}""")
    texto = (f"Nueva solicitud {sol['codigo']} de {cliente['nombre']}\n{sol.get('proyecto') or ''}\nContacto: {contacto}\n\n"
             f"{texto_cfg}\n\nObservaciones: {obs}\n\nAbrir y cotizar: {url}\n")
    return f"Nueva solicitud {sol['codigo']} · {cliente['nombre']}", texto, html


def cotizacion_para_cliente(cot, sol_codigo, nombre_cliente, ver_cantidades=True):
    """
    cot: la cotización YA RECORTADA para el cliente (modelo.cotizacion_para_cliente): sin precios por material.
    Lleva: valor total, observación de lo que incluye, configuración y (opcional) cantidades.
    """
    r, p = cot["resultado"], cot["params"]
    solo_mo = r["soloManoDeObra"]
    incluye = INCLUYE_SOLO_MO if solo_mo else INCLUYE_TODO_COSTO
    url = f"{config.URL_PUBLICA}/mis-solicitudes.html"
    tabla, texto_cfg = _configuracion(p)
    items = [f for f in r.get("filas", []) if f["tipo"] == "item"]
    materiales_html = materiales_txt = ""
    if ver_cantidades and items:
        titulo = "Materiales que debes aportar (referencia)" if solo_mo else "Materiales incluidos"
        filas = "".join(f'<tr><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">{escape(f["nombre"])}</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right">{escape(_num(f["cant"]))} {escape(f["unidad"])}</td></tr>' for f in items)
        materiales_html = f'<p style="margin:16px 0 4px"><b>{titulo}</b></p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">{filas}</table>'
        materiales_txt = f"\n{titulo}:\n" + "\n".join(f"  - {f['nombre']}: {_num(f['cant'])} {f['unidad']}" for f in items) + "\n"
    lista = "".join(f"<li>{escape(t)}</li>" for t in incluye)
    nota = f'<p style="margin:6px 0 0;color:#475569">{escape(NOTA_SOLO_MO)}</p>' if solo_mo else ""
    html = _marco("Tu cotización", f"""
<p style="margin-top:0">Hola {escape(nombre_cliente)}, tu cotización está lista.</p>
<p style="margin:4px 0;color:#475569">Cotización <b>{escape(cot['id'])}</b> · solicitud {escape(sol_codigo)} · {escape(cot['cliente'])}</p>
<div style="border:2px solid #16a34a;border-radius:10px;padding:14px 18px;margin:16px 0;text-align:right">
  <div style="font-size:12px;letter-spacing:.06em;color:#14532d;font-weight:bold">VALOR TOTAL DE LA COTIZACIÓN</div>
  <div style="font-size:28px;font-weight:bold;margin-top:4px">{_cop(r['total'])}</div>
</div>
<div style="border:1px solid #cbd5e1;border-left:4px solid #16a34a;border-radius:6px;padding:10px 14px;background:#f8fafc">
  <b>Observación:</b> dentro de esta cotización está incluido:<ul style="margin:6px 0 0;padding-left:20px">{lista}</ul>{nota}
</div>
<p style="margin:16px 0 4px"><b>Tu invernadero</b></p>
{tabla}{materiales_html}
{_boton(url, 'Ver y descargar la cotización en PDF')}
<p style="color:#64748b;font-size:12px">Valor en pesos colombianos (COP).</p>""")
    texto = (f"Hola {nombre_cliente}, tu cotización {cot['id']} (solicitud {sol_codigo}) está lista.\n\n"
             f"VALOR TOTAL DE LA COTIZACIÓN: {_cop(r['total'])} (COP)\n\n"
             f"Observación: dentro de esta cotización está incluido:\n" + "\n".join(f"  - {t}" for t in incluye) + (f"\n{NOTA_SOLO_MO}" if solo_mo else "") +
             f"\n\nTu invernadero:\n{texto_cfg}\n{materiales_txt}\nVer y descargar en PDF: {url}\n")
    return f"Tu cotización {cot['id']} de AgroEstructuras está lista", texto, html

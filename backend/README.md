# AgroEstructuras · Back-end (Python + Flask + MySQL)

Servidor que guarda todo en MySQL y **calcula las cotizaciones con los precios reales**. También sirve las páginas del front-end, así que todo funciona en una sola dirección: **http://localhost:5000**.

## Cómo usarlo

**La primera vez**
1. Abre el panel de **XAMPP** y pulsa **Start** en **MySQL**.
2. Doble clic en **`INSTALAR.bat`**. Hace esto:
   - crea el entorno de Python (`.venv`) e instala Flask y PyMySQL;
   - crea la base `agroestructuras` con `base_de_datos/agroestructuras_v2.sql` y la migración `agroestructuras_v2_1_backend.sql`;
   - escribe `backend/.env` con las claves y **muestra el código del dueño** (`CODIGO_DUENO`).

**Cada vez que lo vayas a usar**
1. Enciende MySQL en XAMPP.
2. Doble clic en **`INICIAR_BACKEND.bat`**. Se abre http://localhost:5000. No cierres la ventana negra mientras lo usas.

**La cuenta de Libardo:** regístrate en la página, abre «¿Eres el administrador?» y escribe el código que está en `backend/.env` (`CODIGO_DUENO`). Sin ese código, todas las cuentas son de cliente.

## Correo

- **Aviso al dueño:** cuando un cliente envía una solicitud, al dueño le llega un correo con los datos y el botón «Abrir y cotizar». Va al correo de la cuenta del dueño, o a `CORREO_AVISOS` si está configurado.
- **Cotización al cliente:** en el cotizador, después de «Enviar al cliente», aparece el botón **«Enviar por correo»**. El correo lleva el **valor total**, la observación (mano de obra, precio de los materiales y acarreo hasta el punto de construcción), la configuración y las cantidades. **Nunca va el precio de cada material.**
- Cada correo queda registrado en la tabla `notificaciones` (canal `correo`, enviada o fallida).

**Modo prueba (así viene):** mientras `SMTP_HOST` esté vacío en `.env`, los correos **no se envían**. Se guardan como archivos `.eml` en `backend/correos_salida/`, que se abren con doble clic en Outlook o Correo de Windows.

**Para enviarlos de verdad con Gmail:**
1. En la cuenta de Google de AgroEstructuras activa la **verificación en 2 pasos**.
2. Entra a https://myaccount.google.com/apppasswords y crea una **contraseña de aplicación**: son 16 letras, distinta de tu contraseña normal.
3. Abre `backend/.env` y llena:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PUERTO=587
   SMTP_USUARIO=correo_de_agroestructuras@gmail.com
   SMTP_CLAVE=las16letrasdelacontrasena
   ```
4. Cierra y vuelve a abrir `INICIAR_BACKEND.bat`.

Con Outlook/Hotmail: `SMTP_HOST=smtp-mail.outlook.com`, puerto 587. Si la página se publica en internet, cambia `URL_PUBLICA` por la dirección real, para que los enlaces de los correos funcionen.

## Qué hace el servidor

| Regla | Cómo se cumple |
|---|---|
| El cliente no ve precios | El cálculo lo hace `calculo.py` en el servidor. Al cliente se le envían solo las cantidades: el precio no viaja al navegador, así que **no se ve con F12**. |
| Solo el dueño ve presupuestos, inventario y solicitudes de todos | Cada ruta de la API revisa el rol en la base de datos (`@requiere_dueno`). |
| A la cotización que recibe el cliente solo le llega el **valor total** | `cotizacion_para_cliente()` en `modelo.py` quita el precio por material, los subtotales y la separación materiales / mano de obra antes de enviarla. El PDF normal («PDF para el cliente») tampoco los muestra; el «PDF interno» sí, y sale marcado «USO INTERNO». |
| El cliente solo ve sus propias solicitudes | Las consultas filtran por `id_cliente` de la sesión. La cotización le llega solo si `visible_cliente = 1`. |
| El total no se puede alterar desde el navegador | Al guardar, el servidor recalcula con los precios de MySQL e ignora cualquier total que envíe el navegador. |
| Historial de precios | Cada cambio de precio queda en `historial_precios` con el usuario que lo hizo. |
| Contraseñas | Se guardan cifradas (hash de Werkzeug), nunca en texto. |
| Sesión | Cookie firmada, `HttpOnly` y `SameSite=Lax`. La API solo acepta JSON, lo que protege contra CSRF. |
| Inyección SQL | Todas las consultas usan parámetros (`%s`). |

## Archivos

```
backend/
├── app.py                 arranca Flask: API /api/... + páginas del front-end + /uploads
├── config.py              lee el archivo .env
├── db.py                  conexión a MySQL (PyMySQL)
├── seguridad.py           sesión, roles (@requiere_sesion, @requiere_dueno)
├── calculo.py             motor de cálculo (traducido de calculo.js, mismos resultados)
├── modelo.py              lee/escribe tablas y convierte al formato del front-end
├── rutas_cuentas.py       /api/registro, /login, /logout, /sesion
├── rutas_cotizacion.py    /api/calculo, /solicitudes, /cotizaciones
├── rutas_inventario.py    /api/precios, /insumos, /obras (fotos en uploads/obras)
├── correo.py              envío SMTP (o .eml en modo prueba) y plantillas de los correos
├── instalar.py            crea la base, la migración y el .env
├── INSTALAR.bat · INICIAR_BACKEND.bat
├── requirements.txt · .env.ejemplo · .gitignore (.env y uploads NO se suben)
└── pruebas/
    ├── test_calculo.py        Python vs. JavaScript en 300 casos + 8 inválidos
    ├── test_api.py            48 pruebas de la API en una base de PRUEBA (se crea y se borra)
    └── servidor_prueba.py     servidor en el puerto 5001 con base de prueba (para probar en el navegador)
```

## API (resumen)

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /api/sesion` · `POST /api/registro` · `POST /api/login` · `POST /api/logout` | todos | Cuentas |
| `POST /api/calculo` | todos | Calcula. Con precios solo para el dueño |
| `GET/POST /api/solicitudes` | cliente (las suyas) · dueño (todas) | Ver y enviar solicitudes (sin precios) |
| `POST /api/solicitudes/<SOL>/cancelar` · `/restaurar` | cliente | Cancelar si sigue pendiente, y deshacer |
| `POST /api/solicitudes/<SOL>/revisar` | dueño | La pasa a «en revisión» |
| `GET /api/solicitudes/<SOL>/cotizacion` | su cliente | La cotización con precios, solo si fue liberada |
| `GET/POST /api/cotizaciones` · `GET/PUT /api/cotizaciones/<PRJ>` | dueño | Presupuestos |
| `POST /api/cotizaciones/<PRJ>/liberar` · `/anular` · `/restaurar` · `PATCH .../estado` | dueño | Enviar al cliente, eliminar (anular) y deshacer, cambiar estado |
| `GET/PUT /api/precios` · `POST /api/precios/restablecer` | dueño | Precios base |
| `GET/POST /api/insumos` · `PATCH /api/insumos/<id>` | dueño | Insumos adicionales |
| `GET /api/obras` · `POST /api/obras` · `PATCH /api/obras/<id>` | ver: todos · editar: dueño | Portafolio |

## Pruebas

```
.venv\Scripts\python pruebas\test_calculo.py
.venv\Scripts\python pruebas\test_api.py
```

## Pendiente

- Configurar la cuenta de correo real (ver «Correo»). Avisos por Telegram, si se quieren.
- Pantalla para editar los precios del **plástico por ancho** y del **canal** (están en MySQL, en `anchos_plastico` y `anchos_canal`), y las constantes de **mano de obra** (en `calculo.py`).
- Recuperar la contraseña por correo.
- Para publicarlo en internet hace falta un hosting con Python y MySQL; GitHub Pages ya no sirve porque solo aloja páginas estáticas. La versión sin servidor quedó en `prototipo_sin_servidor/`.

# AgroEstructuras

Proyecto de formación ADSO (Análisis y Desarrollo de Software, SENA). Todo el trabajo de esta carpeta gira en torno a este proyecto: front-end, back-end, prototipado y base de datos.

## Qué es
Sitio web de **cotizaciones en línea** para invernaderos de polietileno y estructuras para saran/polisombra. El dueño del proyecto trabaja en el sector de invernaderos y tiene gran parte de la información real (fórmulas, cantidades, precios).

## Reglas de trabajo
- Responder siempre en **español**.
- Guardar todo lo que se genere dentro de esta carpeta (`C:\Users\LENOVO\Desktop\Escritorio-Organizado\Proyectos\AgroEstructuras`; antes estaba en Descargas, se movió el 2026-11-11), nunca en la carpeta "sesion de hoy".
- Stack del curso: **HTML, CSS, Python y MySQL** (editor: VS Code). Si se propone otra tecnología, justificarla.
- Python: `python` es solo el acceso de la Tienda, pero **`py` funciona (Python 3.14)**. El back-end usa su propio entorno en `backend/.venv` (Flask + PyMySQL). Node.js sigue disponible para scripts auxiliares.
- **Bitácora:** al terminar cada tarea, agrega una entrada al FINAL de `BITACORA.md` (raíz del proyecto) con fecha y hora, «Claude Code», qué se hizo, archivos tocados y qué queda pendiente. No borres entradas anteriores. El Claude del chat también lee y escribe ese archivo.
- MySQL: **XAMPP** (MariaDB 10.4) en `C:\xampp`. La app usa `root`. La tabla interna `mysql.db` estaba dañada y el 2026-11-23 quedó marcada como «crashed» (MySQL no arrancaba). Se reparó con `aria_chk --recover`, con permiso del usuario. Sus 3 filas eran ilegibles y se perdieron; se restauró el permiso de `pma` sobre `phpmyadmin` y se borró el usuario sobrante `agro_app`. Respaldo de los archivos originales en `respaldos/mysql_db_2026-11-23/`. Ahora sí se podría crear un usuario de MySQL con permisos limitados (volver a correr `instalar.py`), pero preguntar antes.
- Para ver la base: XAMPP Apache + MySQL → http://localhost/phpmyadmin (base `agroestructuras`).

## Funcionalidades previstas
1. Registro e inicio de sesión de usuarios.
2. Formulario de cotización:
   - Tipo de trabajo: todo costo o solo mano de obra.
   - Cubierta: polietileno o saran/polisombra.
   - Medidas: largo, ancho, altura.
   - Estructura: guadua o palo inmunizado.
   - Diseño: pagoda, capilla, capilla en cercha, tubular, espacial.
   - Tipo de plástico o malla, y observaciones del trabajo.
3. Vista previa **3D** que cambia con las opciones (idea: Three.js).
4. Resultado de la cotización: opciones elegidas, lista de materiales con cantidad y precio, y **TOTAL**.
5. **Cotización en línea** como chat flotante que hace las preguntas paso a paso.
6. Galería de trabajos, historial "Mis cotizaciones" y panel de administrador (precios y fórmulas).

## Estructura de la carpeta
```
AgroEstructuras/
├── CLAUDE.md                      (este archivo)
├── BITACORA.md                    registro de avances (se agrega al final)
├── wireframes/
│   ├── wireframes.html            wireframes de baja fidelidad (versión digital)
│   └── wireframes_a_mano.html     versión estilo cuaderno, 8 pantallas, descarga PNG
├── figma/                         8 pantallas SVG para importar a Figma (top nav)
│   └── 01_Home ... 08_Cotizacion_en_linea_chat
├── frontend/                      FRONT-END (HTML/CSS/JS + Tailwind compilado). Lo sirve el back-end. Ver frontend/README.md
│   ├── index · acceso · centro-principal · nuevo-proyecto · inventario · portafolio · mis-solicitudes (.html)
│   └── js/datos.js (cliente de la API /api) · js/calculo.js (solo validaciones; SIN precios)
├── backend/                       BACK-END Python (Flask) + MySQL. Ver backend/README.md. INSTALAR.bat / INICIAR_BACKEND.bat -> http://localhost:5000
│   └── calculo.py (motor de cálculo, igual a calculo.js en 300 casos) · rutas_*.py (API) · pruebas/
├── prototipo_sin_servidor/        copia del front-end anterior (localStorage; para GitHub Pages o demo)
├── referencia_stitch/             exportación de Stitch (DESIGN.md + pantallas). Sus datos son de relleno, no del proyecto
└── base_de_datos/                 MODELO v2 (híbrido). La v1 quedó en v1_anterior/
    ├── agroestructuras_v2_1_backend.sql  migración: solicitudes.nombre_proyecto (+ vista actualizada)
    ├── agroestructuras_v2.sql     script MySQL/MariaDB: 16 tablas + 2 vistas + datos iniciales (probado en MariaDB 10.4)
    ├── MER_AgroEstructuras_v2.png imagen del MER
    ├── agroestructuras_v2_er.drawio / .mmd   MER editable (draw.io, PK→FK por fila) y código Mermaid
    └── abrir_en_drawio_v2.html    acceso directo que abre el MER en draw.io
```

## Base de datos v2 (MySQL / MariaDB) — resumen
16 tablas: `roles`, `usuarios`, `tipos_estructura`, `modalidades`, `calibres`, `anchos_plastico`, `anchos_canal`, `materiales`, `historial_precios`, `solicitudes`, `cotizaciones`, `detalle_cotizacion`, `respuestas_solicitud`, `notificaciones`, `categorias_obra`, `obras`. Vistas: `v_solicitudes_cliente` (sin precios) y `v_cotizaciones_cliente` (solo las liberadas).
- **Regla del dueño (2026-11-23):** lo que se ENTREGA al cliente (PDF, «Mis solicitudes», WhatsApp) lleva solo el **valor total** y las cantidades, nunca el costo de cada material ni el desglose materiales/mano de obra. En lugar de columnas de precio lleva la observación «incluye mano de obra, precio de los materiales y acarreo de los materiales hasta el punto de construcción» (texto en `INCLUYE` de `frontend/js/calculo.js`). El dueño tiene además un «PDF interno» con precios.
- **Regla de privacidad:** las `solicitudes` del cliente NO tienen precios. Los precios viven en `materiales`, `anchos_plastico`, `anchos_canal`, `cotizaciones` y `detalle_cotizacion`, y solo el rol `dueno` los ve. El cliente consulta únicamente las vistas; una cotización solo le llega si `cotizaciones.visible_cliente = 1`.
- `cotizaciones` guarda su propia copia de los parámetros (el dueño puede ajustarlos) y puede venir de una solicitud o de una llamada (`id_solicitud` y `id_cliente` nulos, usa `cliente_nombre`).
- `detalle_cotizacion` guarda el precio del momento; `historial_precios` registra cada cambio de precio.
- El modelo guarda lo que realmente usa la página V.2: naves, distancia entre postes, ancho/calibre de plástico y canal, insumos libres.
- Los datos iniciales son los valores por defecto del `index.html` V.2 (los precios reales los cambia el dueño). El usuario del dueño (Libardo) NO se crea en el script; se crea desde la aplicación.
- Probado en una base aislada: el script corre sin errores y las restricciones (CHECK, FK, UNIQUE, ENUM) rechazan datos inválidos; la suma del detalle coincide con el total.

## Estado actual
- Hecho: wireframes de baja fidelidad (dibujados a mano y digitales), 8 pantallas SVG para Figma, modelo entidad-relación y script SQL.
- Hecho (2026-10-12): **prototipo en Figma** terminado por el usuario, con la mayoría de botones conectados. Requisitos de la materia de prototipado, para referencia: Requisitos de la guía: Home en escala de grises, patrón de navegación (**top nav**, asignado), pantalla con formulario (≥4 campos), pantalla con tabla (≥3 columnas y 3 filas), user flow de ≥3 pantallas conectadas en modo Prototipo (Home → Registro → Cotizador → Resultado) y la foto del boceto en papel dentro del archivo.
- El Figma lo maneja el usuario en su escritorio; Claude no tiene control del escritorio en esta sesión y guía paso a paso.
- Hecho (2026-10-21/22): **front-end interactivo** en `frontend/` con la estructura de los diseños de Stitch y el cálculo real del `index.html` V.2 (`Escritorio\Trabajos de VScode\AgroEstructuras\index.html`, que solo calcula Tubular y Guadua). `calculo.js` se verificó contra la función original en 11 casos. Incluye registro/login de demostración, cotizador con simulador y PDF, inventario, portafolio con fotos, dashboard con datos reales y chat de cotización.
- Hecho (2026-11-23): **auditoría UX de 12 claves** aplicada al front-end (validación con rangos y error por campo, ayudas, «Deshacer» en limpiar/borrar, selector de estado, duplicar presupuesto, foco visible, contraste, letra ≥12 px, botones de 44 px). Las clases nuevas van en `css/app.css` porque Tailwind está compilado. No se tocaron las fórmulas.
- Hecho (2026-11-23): **separación de roles en el front-end** (dueño / cliente / invitado, como en la BD v2). El cliente diseña sin precios y envía una solicitud (`agro_v3_solicitudes`). El dueño la cotiza desde el Centro Principal y la «envía al cliente» (`visibleCliente`). El cliente la descarga en `mis-solicitudes.html`. La cuenta del dueño se crea con el código `AGRO-DUENO-2026` (`CODIGO_DUENO` en `datos.js`); las cuentas antiguas quedan como cliente. (Ese prototipo quedó en prototipo_sin_servidor/.)
- Hecho (2026-11-23): **back-end Python + MySQL** en `backend/`. Base `agroestructuras` creada en XAMPP (v2 + migración v2.1, sin usuarios: Libardo se registra con el `CODIGO_DUENO` de `backend/.env`). El cálculo con precios vive en el servidor y al cliente solo le llegan cantidades. Eliminar un presupuesto = anularlo. Pruebas: `test_calculo.py` (308/308), `test_api.py` (48/48) y de punta a punta en Edge (36/36).
- Pendiente del front-end: sarán/polisombra (sin fórmula), contactos reales del pie de página, conexión a back-end. El calibre del plástico no cambia el precio (igual que en el original).

## Entregas académicas
- Grupo: Santiago Naranjo, Valentina Arias y Samuel Muñoz. Ficha 3386122. Instructor de prototipado: Ing. Anselmo Tabares.
- 2026-10-21: documento Word de wireframes digitales (portada, introducción, objetivo, 8 wireframes, conclusiones, glosario) en `Escritorio\trabajo de prototipado\Wireframes_Digitales_AgroEstructuras.docx`. Se sube al Drive (plazo: 2026-10-22).
- 2026-10-19: wireframes de baja fidelidad del `index.html` V.2 (versión de Escritorio\Trabajos de VScode) en `Escritorio\Frimware de baja fidelidad 2`.

## Decisión de negocio (2026-11-11): modelo híbrido
El dueño del proyecto (**Libardo**) pidió que el cliente **no vea precios**. Se acordó el modelo híbrido:
1. El cliente se registra, navega y configura su invernadero (tipo, medidas, cubierta) y ve el diseño 2D/3D, **sin precios**. Al pulsar el botón se envía una **solicitud de cotización**.
2. Libardo recibe un **aviso** (opciones: correo + bot de Telegram; botón de WhatsApp `wa.me` como respaldo).
3. Libardo entra a un **panel privado** (rol dueño), ve el cálculo con precios, genera el **PDF con el diseño** y se lo envía al cliente (o lo libera para que lo descargue).
- **Importante:** con solo front-end los precios se pueden ver con F12. El cálculo con precios debe vivir en el **back-end (Python + MySQL)** y solo el rol «dueño» puede verlo. El front-end actual (`frontend/`) es solo prototipo.
- Cambios previstos en la BD: tabla `solicitudes` (cliente, especificaciones, estado pendiente/en revisión/cotizada), campo `rol` en usuarios (cliente/dueño), registro de avisos enviados.
- Preguntas pendientes para Libardo: ¿el cliente ve cantidades de materiales? ¿ve algún precio aproximado? ¿quién envía el PDF? ¿aviso por WhatsApp, Telegram o correo? ¿cuántas solicitudes al día?

## Decisión de negocio (2026-11-23): herramienta solo para Libardo — REEMPLAZA el modelo híbrido
Libardo NO quiere registro de usuarios. AgroEstructuras es una herramienta solo para él: él hace la cotización (con los datos de contacto del cliente), genera el PDF con la cotización y el diseño del invernadero, y se lo envía al cliente por WhatsApp o correo.
- Modelo de datos v3 en `base_de_datos/v3/` (14 tablas: administrador, clientes, tipos_estructura, modalidades, calibres, anchos_plastico, anchos_canal, materiales, historial_precios, cotizaciones, detalle_cotizacion, envios, categorias_obra, obras). Aún sin probar en XAMPP.
- Hay que adaptar back-end y front-end: quitar registro/roles de cliente, solicitudes y «Mis solicitudes».
- Documento de requisitos (IEEE 830 + APA): `documentacion/Ficha_Tecnica_AgroEstructuras_IEEE830.docx`.

## Próximos pasos sugeridos
1. Pedir al usuario las fórmulas, cantidades y precios reales (incluidas las de sarán) y cargarlos en MySQL.
2. (Hecho 2026-11-11) MER y SQL v2 del modelo híbrido.
3. (Hecho 2026-11-23) Back-end en Python + MySQL. (Hecho) Correo: aviso al dueño por solicitud nueva y botón «Enviar por correo» de la cotización (solo total), en `backend/correo.py`. Está en MODO PRUEBA (.eml en backend/correos_salida) hasta que el usuario llene SMTP_* en backend/.env (Gmail con contraseña de aplicación). Pendiente: Telegram, pantalla de precios de plástico/canal/mano de obra, recuperar contraseña, hosting.
4. Mejorar la vista 3D del simulador si se desea.

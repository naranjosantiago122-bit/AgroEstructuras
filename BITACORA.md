# Bitácora de AgroEstructuras

Registro de avances del proyecto. Lo llevan el Claude de VS Code (Claude Code) y el Claude del chat.
**Regla:** cada entrada nueva va al FINAL, con fecha, quién la escribe, qué se hizo y qué queda pendiente.

---

## 2026-11-23 · Resumen del día (escrito por Claude del chat)

**Hecho**
- Auditoría UX de 12 claves aplicada al front-end (validaciones, ayudas, «Deshacer», foco visible, contraste, botones de 44 px).
- Separación de roles en el front-end (dueño / cliente / invitado). El prototipo anterior quedó en `prototipo_sin_servidor/`.
- Back-end Python (Flask) + MySQL en `backend/`. Pruebas: `test_calculo.py` 308/308, `test_api.py` 48/48, Edge 36/36.
- Regla del dueño: al cliente solo le llega el valor total y las cantidades, nunca el precio por material.
- Envío por correo (`backend/correo.py`): aviso al dueño por solicitud nueva y botón «Enviar por correo» con solo el total. Probado con servidor SMTP de prueba en el computador.

**Pendiente para el usuario**
- Activar verificación en 2 pasos en el Gmail de AgroEstructuras y crear una contraseña de aplicación.
- Llenar `SMTP_HOST`, `SMTP_USUARIO` y `SMTP_CLAVE` en `backend/.env` y reiniciar con `backend/INICIAR_BACKEND.bat`.

**En curso (23:10)**
- Se pidió a Claude Code: «ahora agrega el aviso por Telegram».

**Pendiente del proyecto**
- Telegram, pantalla de precios de plástico/canal/mano de obra, recuperar contraseña, hosting.
- Sarán/polisombra (sin fórmula), contactos reales del pie de página.
- Cambiar `URL_PUBLICA` cuando la página esté publicada en internet.

---

## 2026-11-24 · Ficha técnica IEEE 830 y modelo v3 (escrito por Claude del chat)

**Contexto:** Libardo decidió (2026-11-23) que NO haya registro de usuarios. AgroEstructuras pasa a ser una herramienta solo para él: cotiza, genera el PDF con el diseño y lo envía al cliente por WhatsApp o correo.

**Hecho**
- Documento Word `documentacion/Ficha_Tecnica_AgroEstructuras_IEEE830.docx` (normas APA, estructura IEEE 830): portada con logo e integrantes, introducción, planteamiento del problema, objetivo general, 10 RF, 10 RNF, 10 RU, diccionario de las 14 entidades, MER y glosario.
- Modelo de datos v3 en `base_de_datos/v3/`: `agroestructuras_v3.sql` (14 tablas; base `agroestructuras_v3`, no toca la base actual), `MER_AgroEstructuras_v3.png` y `agroestructuras_v3_er.drawio`. Cambios frente a v2: salen roles, usuarios, solicitudes, respuestas_solicitud, notificaciones y las vistas del cliente; entran `administrador` (solo Libardo), `clientes` (solo contactos, sin cuenta) y `envios` (WhatsApp/correo). `cotizaciones` agrega altura e imagen_diseno.
- El SQL v3 no se ha probado todavía en XAMPP.

**Pendiente**
- Probar `agroestructuras_v3.sql` en XAMPP.
- Adaptar back-end y front-end al modelo v3: quitar registro/roles de cliente y «Mis solicitudes»; agregar clientes como contactos, PDF con imagen del diseño y envío por WhatsApp.
- En la portada del Word falta el nombre del instructor.

---

## 2026-11-24 21:20 · Registro con elección de tipo de cuenta (escrito por Claude Code)

**Pedido del usuario:** al registrarse, que salga un menú para elegir «Usuario» o «Administrador»; si es administrador, que pida una clave que solo tiene el dueño.

**Hecho**
- `frontend/acceso.html`: al inicio del formulario de registro hay dos opciones grandes (Usuario / Administrador). Si se elige Administrador aparece el campo «Clave de administrador» (oculta, con botón para verla) y es obligatorio. El botón cambia a «CREAR CUENTA DE USUARIO / DE ADMINISTRADOR». Al volver a Usuario, la clave escrita se borra. Se quitó el desplegable anterior «¿Eres el administrador?».
- `frontend/js/acceso.js` y `frontend/js/datos.js`: envían el tipo de cuenta; validan que la clave no esté vacía.
- `frontend/css/app.css`: estilos de las dos opciones (`.opcion-cuenta`), con foco visible y área táctil de 44 px.
- `backend/rutas_cuentas.py`: el servidor recibe `tipo` («usuario» o «administrador»). Una cuenta «usuario» nunca queda como administrador aunque mande la clave. **Límite de intentos:** 5 claves equivocadas en 15 minutos desde el mismo equipo → bloqueo de 15 min (las cuentas de usuario se pueden seguir creando).
- La clave sigue siendo `CODIGO_DUENO` en `backend/.env`.
- Pruebas: `backend/pruebas/test_api.py` con 5 casos nuevos (sin clave, tipo usuario con clave, tipo inválido, bloqueo, usuario durante el bloqueo), 0 fallas. Prueba en Edge (10 comprobaciones, computador y celular), 0 fallas.

**Ojo**
- Esto conserva las cuentas de usuario (clientes), lo que se aparta de la decisión v3 «herramienta solo para Libardo». Hay que definir con el usuario cómo queda el resto.

**Pendiente**
- Lo mismo de la entrada anterior (probar SQL v3, decidir/adaptar al modelo v3, instructor en la portada del Word).

---

## 2026-11-24 21:41 · Vista 3D de las estructuras (escrito por Claude Code)

**Pedido del usuario:** cambiar el diseño que se genera al pedir la estructura, parecido a sus videos (en `referencia_estructuras/videos/`).

**Identificación de los videos (confirmada por el usuario)**
- Video 1 (9.16.16 PM (1)): estructura **a una sola agua**.
- Video 2 (9.16.16 PM): **sarán/polisombra tipo capilla**: sin alfardas, postes altos y bajos, cables del largo del invernadero + 10 m para bajar al anclaje.
- Video 3 (9.16.23 PM): **metálica tubular** con sus canales.
- Video 4 (9.16.47 PM): **capilla de guadua**; canales centrales o cenitales opcionales **con recargo**.
- Hojas de fotogramas en `referencia_estructuras/fotogramas/`.

**Hecho**
- Three.js 0.187 (MIT) dentro del proyecto: `frontend/js/vendor/three/` (funciona sin internet).
- `frontend/js/estructura3d.js`: vista 3D que se puede girar, con los 4 tipos armados con piezas (postes, alfardas, cumbrera, arcos con ventana cenital, tirantes, canales, cables y anclajes, plástico o malla). Cambia con largo, ancho por nave, naves, distancia entre postes y canal. Botones «quitar cubierta» y «vista inicial». Las alturas son APROXIMADAS (constante `ALTURAS`), hay que ajustarlas con Libardo.
- `frontend/disenos-3d.html`: página para ver los 4 diseños y mostrárselos a Libardo.
- Cotizador (`nuevo-proyecto.html` + `js/cotizador.js`): la vista previa ahora es 3D (el dibujo 2D queda solo si el navegador no tiene WebGL). Alerta técnica encima del 3D si la distancia entre postes supera el máximo.
- PDF (`js/pdf.js`): lleva la imagen 3D de la estructura (también el PDF que descarga el cliente).
- Pruebas en Edge: 4 tipos con y sin cubierta, caso enorme (500 m × 20 naves) sin trabarse, cotizador 3D + PDF (0 fallas, 0 errores de consola).

**Pendiente**
- Pedirle a Libardo las medidas reales: altura a canal, altura de cumbrera, altura de postes altos/bajos del sarán, separación de postes centrales.
- «Una sola agua» y «sarán capilla» ya se ven en 3D, pero NO están en el formulario de cotización porque no tienen fórmulas de materiales ni precios: pedírselas a Libardo.
- Ventana/canal cenital de la capilla como opción con recargo: falta el precio.
- Idea del usuario: que el usuario pueda «modelar o dibujar» su invernadero. Propuesto: primero editor sobre el 3D; el dibujo libre del terreno necesita reglas de cotización para formas irregulares.

---

## 2026-11-24 22:10 · Forma de trabajo en equipo (escrito por Claude del chat)

**Acuerdo con el usuario:** el Claude de VS Code y el Claude del chat trabajan en paralelo sobre esta carpeta, sin pisarse.

**Reparto**
- **Claude Code (VS Code):** es el ÚNICO que edita el código (`frontend/`, `backend/`, `base_de_datos/`).
- **Claude del chat:** lee y revisa el código, prueba la página en el navegador, redacta textos y documentos (`documentacion/`) y prepara instrucciones para Claude Code. NO edita código mientras Claude Code esté trabajando; si encuentra un error, lo anota aquí como «Para Claude Code».
- **Los dos:** escriben en esta bitácora, siempre AL FINAL y sin borrar entradas.

**Para Claude Code**
- Antes de cada tarea, lee la última entrada de esta bitácora por si hay notas del chat.
- Contradicción pendiente de decidir con el usuario: la entrada de las 21:20 conserva el registro de cuentas «Usuario / Administrador», pero la decisión v3 (2026-11-23) dice que NO habrá registro de clientes (herramienta solo para Libardo). No sigas ampliando el registro de clientes hasta que el usuario lo defina.

**Pendiente**
- Que el usuario confirme si se queda el registro de usuarios o se pasa del todo al modelo v3.

---

## 2026-11-24 22:47 · Diseñador «a mi medida» + capilla en cercha (escrito por Claude Code)

**Pedido del usuario:** que el cliente pueda diseñar su invernadero («no todos son iguales»): naves de distinto largo, ancho y tipo; forma libre del terreno; elementos opcionales ubicados; nuevo tipo **capilla en cercha** (sin postes centrales, más cara). Forma elegida: plano desde arriba + 3D al lado. Después: en el registro, «Usuario» → **«Cliente»**.

**Hecho**
- `frontend/js/disenador.js` (nuevo): diseñador en pantalla completa. Plano con cuadrícula en metros; naves que se arrastran (correr, cambiar largo y ancho con puntos verdes); terreno por esquinas (arrastrables); panel por nave (tipo, ancho, largo, desde dónde empieza, altura de postes, ventana cenital, cortinas, mover, duplicar, eliminar); canales por línea; puertas (nave, frente/fondo, posición, ancho); resumen y avisos (nave fuera del terreno); deshacer/rehacer (Ctrl+Z / Ctrl+Y).
- `frontend/js/estructura3d.js`: reescrito para armar cualquier diseño (naves distintas, escalonadas), + tipo **Cercha** (tirante, montantes y diagonales), ventana cenital, puertas, cortinas, alturas y contorno del terreno.
- Cotizador (`nuevo-proyecto.html`, `js/cotizador.js`): «Forma del invernadero: Naves iguales / A mi medida». Con diseño a medida se ve una tarjeta con el plano; el 3D muestra el diseño; la solicitud y la cotización guardan el diseño.
- PDF (`js/pdf.js`): tabla de naves, plano desde arriba e imagen 3D del diseño.
- Back-end: `backend/diseno.py` (limpia/valida el diseño), `calculo.py` (tipos nuevos; sin fórmula → no inventa precio), rutas devuelven «precio pendiente». Migración `base_de_datos/agroestructuras_v2_2_disenos.sql` (columna `diseno_json` en solicitudes y cotizaciones + tipos Capilla en cercha, Una sola agua, Sarán capilla) — aplicada en la base real.
- Registro: «Usuario» → «Cliente» (opción, botón y mensajes, también los del servidor).
- Pruebas: `test_calculo.py` 308/308; `test_api.py` 0 fallas (incluye 9 casos de diseño); Edge: diseñador de punta a punta 18/18, 0 errores.

**PENDIENTE (el usuario pidió que se lo recuerde)**
- Fórmulas y precios: capilla en cercha, una sola agua, sarán, puertas, ventana cenital, cortinas, altura de postes, naves de distinto tamaño y terrenos irregulares. Mientras tanto, un diseño a medida se puede ENVIAR, pero su precio queda «pendiente» y el dueño no puede guardar un total automático.
- Alturas reales para el 3D.

---

## 2026-11-24 23:30 · Tipos que faltaban en el formulario (escrito por Claude Code)

**Pedido del usuario:** en «Tipo de estructura» faltaban el sarán y la estructura a una sola agua (mencionó también «pagoda»).

**Hecho**
- `nuevo-proyecto.html`: el selector ahora trae los 5 tipos: Metálico tubular, Capilla de guadua, **Capilla en cercha**, **Una sola agua**, **Sarán / polisombra tipo capilla**. Para el dueño los 3 nuevos dicen «precio pendiente»; al cliente no se le muestra esa marca (tampoco en el diseñador).
- `js/simulador.js`: texto explicativo de cada tipo nuevo. `js/cotizador.js`: la etiqueta «Modelo» muestra el nombre legible.
- `js/chat.js`: el chat ya no dice que el sarán «no está disponible»; sigue la conversación (sin preguntar plástico) y ofrece cercha y una sola agua. Si el tipo no tiene fórmula, el resumen dice que el valor llega con la cotización (al dueño: «precio pendiente»).
- Pruebas en Edge: tipos nuevos 9/9 y diseñador 18/18, 0 errores.

**Pendiente**
- Confirmar con el usuario si «pagoda» es lo mismo que «una sola agua» o un tipo aparte (si es aparte: pedir video o foto).
- Sigue pendiente lo de fórmulas y precios (ver entrada anterior).

---

## 2026-11-25 · Ficha técnica de prototipado (escrito por Claude del chat)

**Pedido del usuario:** ficha técnica de prototipado (tablero del 25-11-26) «con todas las actualizaciones», es decir, con la versión que está implementada hoy (registro Cliente/Administrador, solicitudes, 5 tipos, 3D, diseñador a medida).

**Hecho**
- `documentacion/Ficha_Tecnica_Prototipado_AgroEstructuras.docx` (APA, 34 págs.): portada con nombre técnico PPP, planteamiento, objetivo general y 5 específicos, 10 RF / 10 RNF / 10 RU de la versión actual, 10 wireframes de baja fidelidad documentados, 9 pantallas de alta fidelidad (capturas reales de la interfaz con datos de ejemplo), 13 criterios WCAG 2.2 y 9 principios Gestalt aplicados, glosario y referencias.
- Imágenes en `wireframes/version_actual_baja_fidelidad/` y `wireframes/version_actual_alta_fidelidad/`.
- Las carpetas `wireframes/v3_baja_fidelidad` y `v3_alta_fidelidad` (enfoque «solo Libardo») quedaron desactualizadas.

**Ojo**
- La ficha IEEE 830 del 24-11 y el modelo `base_de_datos/v3` siguen con el enfoque «solo Libardo, sin registro»; no coinciden con la versión implementada.

**Para Claude Code**
- En el Centro principal, el indicador «Total cotizado este mes» se corta cuando el valor pasa de $ 100.000.000 (se vio con datos de prueba).

---

## 2026-11-25 21:40 · Proyecto en GitHub + demo para GitHub Pages (escrito por Claude del chat)

**Hecho**
- Todo el proyecto subido a https://github.com/naranjosantiago122-bit/AgroEstructuras (repositorio público que ya existía; se conservó su historial). No se subieron `backend/.env`, `.venv`, `respaldos/`, `backend/uploads/` ni `backend/correos_salida/` (ver `.gitignore`).
- Nueva carpeta `demo/`: copia de `frontend/` que funciona SIN servidor para GitHub Pages. `demo/js/api-local.js` imita la API `/api` con localStorage (mismo cálculo que `backend/calculo.py`). Clave de administrador de la demo: `AGRO-DEMO`. Aviso verde arriba con «reiniciar datos».
- `index.html` de la raíz abre `demo/index.html`. README actualizado con el enlace de Pages.
- Probado de punta a punta (cliente registra y envía solicitud → dueño la cotiza y la libera → cliente la ve «Cotizada»), 0 errores de consola.

**Para Claude Code**
- Si cambias `frontend/`, la demo NO se actualiza sola: hay que volver a copiar los archivos a `demo/` (menos `js/datos.js`, que en la demo llama a `AgroDemoAPI`) y subir los cambios.
- GitHub Pages: activar en Settings → Pages (rama main, carpeta raíz) si aún no está.

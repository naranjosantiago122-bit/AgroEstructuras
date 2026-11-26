# AgroEstructura V.2 PRO — Front-end interactivo

Front-end en HTML, CSS y JavaScript (con Tailwind por CDN) basado en los diseños de Stitch y en el cálculo real del `index.html` original.
Todavía no tiene servidor: los datos se guardan en el navegador (`localStorage`). El archivo `js/datos.js` es el único que habrá que cambiar cuando exista el back-end (Python + MySQL).

## Cómo abrirlo

**Ahora el front-end funciona con el back-end** (Python + MySQL), en la carpeta `../backend`. Los pasos están en `backend/README.md`. En resumen: enciende MySQL en XAMPP, ejecuta `backend/INSTALAR.bat` (solo la primera vez) y luego `backend/INICIAR_BACKEND.bat`, que abre http://localhost:5000. El `INICIAR_SERVIDOR.bat` de esta carpeta hace lo mismo.

- Si abres los .html con doble clic, sin el servidor, las páginas muestran «No pudimos cargar la información».
- `js/datos.js` llama a la API `/api/...`. Los precios y el cálculo están en el servidor (`backend/calculo.py`). `js/calculo.js` solo conserva las validaciones y los nombres.
- La versión anterior, que funcionaba sin servidor (localStorage) y servía para GitHub Pages, quedó en `../prototipo_sin_servidor/`.

## Roles (modelo híbrido)

| Rol | Qué ve | Cómo se crea |
|---|---|---|
| **Dueño** | Precios, inventario, presupuestos, PDF y la bandeja de **solicitudes** en el Centro Principal | Registro con el **código de administrador** (está en `backend/.env`, en `CODIGO_DUENO`) |
| **Cliente** | Diseña su invernadero, ve la vista previa y la lista de materiales **sin precios**, envía la solicitud y la sigue en «Mis solicitudes» | Registro normal (sin código) |
| **Invitado** | Igual que el cliente, pero para enviar la solicitud debe crear una cuenta (su diseño se conserva) | «Continuar como invitado» |

Flujo: el cliente envía la solicitud → el dueño la ve en el Centro Principal (aviso con el número de pendientes) → pulsa «Cotizar», revisa, guarda y pulsa **«Enviar al cliente»** (puede avisarle por WhatsApp) → el cliente ve «Ver cotización» y descarga el PDF con el diseño.

- `CLIENTE_VE_CANTIDADES` en `js/datos.js` decide si el cliente ve las cantidades de materiales (pregunta pendiente para Libardo).
- Los precios ya no llegan al navegador del cliente: el servidor no se los envía. Las solicitudes llegan al dueño desde cualquier equipo.

## Páginas

| Archivo | Pantalla | Qué hace |
|---|---|---|
| `index.html` | Inicio | Presentación, servicios y botón flotante del chat |
| `acceso.html` | Registro / Inicio de sesión | Cuentas con validación; también «Continuar como invitado» |
| `centro-principal.html` | Centro Principal | Indicadores reales, tabla de presupuestos (filtrar, cambiar estado, abrir, eliminar, descargar CSV) |
| `nuevo-proyecto.html` | Cotizador | Formulario, simulador en perspectiva, lista de materiales (BOM), guardar y exportar a PDF |
| `inventario.html` | Inventario | Precios base y insumos libres que usa el cotizador |
| `portafolio.html` | Portafolio | Obras con foto, filtros, ficha técnica y gráfico (el cliente solo mira) |
| `mis-solicitudes.html` | Mis solicitudes (cliente) | Estado de cada solicitud, cancelar si sigue pendiente, ver el diseño y descargar la cotización liberada |
| Chat «Cotización en línea» | En todas las páginas | Hace las preguntas paso a paso y calcula con el mismo motor |

## Estructura

```
frontend/
├── index.html · acceso.html · centro-principal.html · nuevo-proyecto.html · inventario.html · portafolio.html
├── INICIAR_SERVIDOR.bat        abre el sitio y lo comparte en la red (para el celular)
├── css/
│   ├── tailwind.css            CSS de Tailwind ya compilado (35 KB)
│   ├── fonts.css               fuentes locales
│   └── app.css                 estilos comunes
├── fonts/                      Space Grotesk, Work Sans y los íconos Material Symbols
├── img/logo.png                ícono de AgroEstructuras
├── herramientas/               servidor.js (servidor local) y tailwind.config.js (sistema de diseño «AgroTech Dark Matrix» de Stitch)
└── js/
    ├── calculo.js              motor de cálculo (fórmulas del index.html original, sin tocar la pantalla)
    ├── datos.js                datos y sesión (localStorage)  ← aquí se conectará el back-end
    ├── layout.js               barra superior, menú lateral y avisos
    ├── simulador.js            dibujo de la estructura (canvas)
    ├── chat.js                 chat de cotización
    ├── pdf.js                  cotización en PDF (con el dibujo de la estructura)
    ├── solicitudes.js          página «Mis solicitudes»
    └── acceso.js · cotizador.js · dashboard.js · inventario.js · portafolio.js    (una por página)
```

## Si agregas clases nuevas de Tailwind

El CSS está compilado: si escribes una clase de Tailwind que no se usaba antes, hay que recompilarlo. En una carpeta aparte (con Node):
`npm install tailwindcss@3` y luego
`npx tailwindcss -c herramientas/tailwind.config.js -i herramientas/entrada.css -o css/tailwind.css --minify`.

## Qué se verificó

- **Cálculo:** `calculo.js` se comparó contra la función `calcularBOM` del `index.html` original en 11 casos (tubular y guadua, varias naves, canales, plásticos, decimales, mano de obra, límites de distancia): **todos coinciden** en cantidades y totales.
- Se recorrió cada página en el navegador: registro con errores y éxito, cálculo, alerta técnica, guardar/abrir presupuestos, inventario, chat completo, portafolio con foto, PDF y versión de celular. Sin errores en la consola.

## Cosas a tener en cuenta

- **Sarán / polisombra:** el cálculo de esta línea no existe todavía (el `index.html` original solo calcula Tubular y Guadua). El chat y la tarjeta de inicio lo dicen con claridad.
- **Calibre del plástico:** igual que en el original, solo aparece en el nombre del ítem; **no cambia el precio**. El precio depende del ancho del rollo.
- **Solo mano de obra:** el total es solo la mano de obra; los materiales se muestran como cantidades de referencia.
- **Cuentas:** son de demostración. La contraseña se guarda con un hash en el navegador, pero sin servidor no hay seguridad real. Con el back-end se reemplaza `datos.js`.
- **Datos de ejemplo:** en el Centro Principal, el botón «Cargar ejemplos» crea dos presupuestos de prueba (marcados como «Ejemplo»), calculados con tus precios.
- **Fotos del portafolio:** se reducen a 900 px y se guardan en el navegador (límite de unos 5 MB en total).

## Diferencias con los diseños de Stitch

Stitch generó datos de relleno que no son del proyecto, y **no se incluyeron**: cifras de cotización inventadas, «servidor de cálculo», correo y teléfonos de contacto, normas y certificaciones (NSR-10, NTC 5427), resistencia al viento, porcentajes de ahorro y obras ficticias. Los indicadores ahora salen de los presupuestos reales.
También se dejó fuera el ítem «Configuración» del menú (no tenía pantalla) y el tipo «Multitúnel» (no tiene fórmula de cálculo).

## Pendiente

1. Back-end en Python y base de datos MySQL (modelo en `../base_de_datos/`).
2. Cálculo de sarán / polisombra.
3. Cargar los precios y cantidades reales en el inventario.
4. Datos de contacto reales en el pie de página, cuando se definan.

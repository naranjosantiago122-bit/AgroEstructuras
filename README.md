# AgroEstructuras

Herramienta web para **cotizar y diseñar invernaderos** (polietileno y sarán/polisombra) para la empresa AgroEstructuras.

**Nombre técnico:** Sistema web para la cotización y el diseño de invernaderos dirigido a la empresa AgroEstructuras y sus clientes del sector agrícola.

Proyecto formativo del programa **Tecnología en Análisis y Desarrollo de Software (ADSO)** del SENA, ficha **3386122**.

**Integrantes:** Santiago Naranjo · Valentina Arias · Samuel Muñoz

## Ver la demostración en el navegador

**https://naranjosantiago122-bit.github.io/AgroEstructuras/** (GitHub Pages)

Es la interfaz actual (carpeta `demo/`) funcionando sin servidor: los datos se guardan en el navegador de cada persona.
- Para entrar como **dueño**, crea una cuenta eligiendo «Administrador» con la clave **AGRO-DEMO**.
- Para entrar como **cliente**, crea una cuenta «Cliente» (o «Continuar como invitado»).
- El enlace «reiniciar datos» del aviso verde borra todo y empieza de cero.

> En la demo los precios quedan en el navegador. La versión real (`frontend/` + `backend/`) los guarda en el servidor y el cliente nunca los recibe.

## Qué hace (versión actual: AgroEstructura V.2 PRO)

| Usuario | Qué puede hacer |
|---|---|
| **Cliente** | Diseña su invernadero (5 tipos de estructura), lo ve en 3D, lo arma «a su medida» en un plano, envía una solicitud de cotización **sin ver precios** y la sigue en «Mis solicitudes». |
| **Dueño (administrador)** | Ve las solicitudes en el Centro principal, calcula el presupuesto con sus precios, genera el PDF (cliente e interno) y lo entrega por la página, por correo o por WhatsApp. Administra inventario, precios y portafolio. |
| **Invitado** | Puede diseñar sin cuenta; para enviar la solicitud debe registrarse. |

Tipos de estructura: metálico tubular, capilla de guadua, capilla en cercha, una sola agua y sarán tipo capilla (los tres últimos aún sin fórmula de precio).

## Tecnologías

- **Front-end:** HTML, CSS (Tailwind compilado), JavaScript y Three.js (vista 3D).
- **Back-end:** Python 3 con Flask y PyMySQL.
- **Base de datos:** MySQL / MariaDB (XAMPP).

## Estructura del repositorio

```
AgroEstructuras/
├── demo/                  Copia de frontend/ que funciona sin servidor (GitHub Pages)
├── frontend/              Páginas, estilos, scripts y vista 3D
├── backend/               API en Python (Flask) + pruebas
├── base_de_datos/         Scripts SQL y modelos entidad-relación (v1, v2, v3)
├── documentacion/         Fichas técnicas en Word (IEEE 830 y prototipado)
├── wireframes/            Wireframes de baja y alta fidelidad
├── figma/                 Pantallas SVG para Figma
├── referencia_estructuras/  Videos y fotogramas de las estructuras reales
├── referencia_stitch/     Diseños de referencia generados con Stitch
├── prototipo_sin_servidor/  Versión anterior (octubre), sin 3D ni diseñador
├── BITACORA.md            Registro de avances
└── CLAUDE.md              Resumen técnico del proyecto
```

## Cómo correrlo en el computador

1. Instala **XAMPP** y enciende **MySQL**.
2. En `backend/`, copia `.env.ejemplo` como `.env` y llena los datos (clave de administrador, correo).
3. Ejecuta `backend/INSTALAR.bat` (solo la primera vez): crea el entorno de Python y la base de datos.
4. Ejecuta `backend/INICIAR_BACKEND.bat` y abre **http://localhost:5000**.

Más detalles en `backend/README.md` y `frontend/README.md`.

## Pendiente

- Fórmulas y precios reales de capilla en cercha, una sola agua, sarán, puertas, ventana cenital y cortinas.
- Alturas reales de las estructuras para el 3D.
- Definir con el dueño si se mantiene el registro de clientes (modelo v2) o se pasa al modelo v3 (herramienta solo para el dueño).

> El archivo `backend/.env` **no** está en el repositorio porque tiene claves. Cada integrante debe crear el suyo a partir de `.env.ejemplo`.

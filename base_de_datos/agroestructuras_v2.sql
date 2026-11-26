-- ==========================================================================
-- AgroEstructuras - Base de datos v2 (MySQL 8 / MariaDB 10.4+)
-- Modelo híbrido: el cliente pide una solicitud SIN precios; el dueño (Libardo) la cotiza
-- con precios y le envía el PDF.  16 tablas + 2 vistas.
-- Este archivo se genera a partir del mismo modelo que el MER (agroestructuras_v2_er.*).
-- ==========================================================================
CREATE DATABASE IF NOT EXISTS agroestructuras CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE agroestructuras;

-- (Opcional) Para empezar de cero, quita los comentarios de las 2 líneas siguientes.  ¡BORRA TODOS LOS DATOS!
-- DROP DATABASE agroestructuras;  CREATE DATABASE agroestructuras CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;  USE agroestructuras;

-- Tipos de usuario: cliente y dueno (Libardo).
CREATE TABLE roles (
  id_rol INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(30) NOT NULL UNIQUE,
  PRIMARY KEY (id_rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Personas que entran al sistema. El rol decide que puede ver (solo el dueno ve precios).
CREATE TABLE usuarios (
  id_usuario INT NOT NULL AUTO_INCREMENT,
  id_rol INT NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  correo VARCHAR(120) NOT NULL UNIQUE,
  telefono VARCHAR(20),
  ciudad VARCHAR(80),
  clave_hash VARCHAR(255) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario),
  CONSTRAINT fk_usuarios_id_rol FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Metalico Tubular y Capilla de Guadua, con la separacion maxima permitida entre postes.
CREATE TABLE tipos_estructura (
  id_tipo_estructura INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(50) NOT NULL UNIQUE,
  distancia_max DECIMAL(4,1) NOT NULL,
  descripcion VARCHAR(150),
  PRIMARY KEY (id_tipo_estructura),
  CONSTRAINT ck_tipos_estructura_1 CHECK (distancia_max > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Todo Costo (materiales + mano de obra) o Solo Mano de Obra.
CREATE TABLE modalidades (
  id_modalidad INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(30) NOT NULL UNIQUE,
  PRIMARY KEY (id_modalidad)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Calibres disponibles para plastico y canal (6, 7, 10).
CREATE TABLE calibres (
  id_calibre INT NOT NULL AUTO_INCREMENT,
  valor TINYINT NOT NULL UNIQUE,
  PRIMARY KEY (id_calibre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ancho del rollo de plastico y su precio por m2.
CREATE TABLE anchos_plastico (
  id_ancho_plastico INT NOT NULL AUTO_INCREMENT,
  ancho_m DECIMAL(4,2) NOT NULL UNIQUE,
  precio_m2 DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id_ancho_plastico),
  CONSTRAINT ck_anchos_plastico_1 CHECK (precio_m2 >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ancho del canal de desague y precio del rollo de 100 m.
CREATE TABLE anchos_canal (
  id_ancho_canal INT NOT NULL AUTO_INCREMENT,
  ancho_m DECIMAL(4,2) NOT NULL UNIQUE,
  precio_rollo DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id_ancho_canal),
  CONSTRAINT ck_anchos_canal_1 CHECK (precio_rollo >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Materiales base (tubo, guadua, carevacas) e insumos libres, con su precio actual. Solo el dueno lo ve.
CREATE TABLE materiales (
  id_material INT NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(30) UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  unidad VARCHAR(20) NOT NULL DEFAULT 'Unidad',
  precio_unitario DECIMAL(12,2) NOT NULL,
  tipo ENUM('base','insumo') NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_material),
  CONSTRAINT ck_materiales_1 CHECK (precio_unitario >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cada cambio de precio de un material, con quien lo hizo y cuando.
CREATE TABLE historial_precios (
  id_historial INT NOT NULL AUTO_INCREMENT,
  id_material INT NOT NULL,
  precio DECIMAL(12,2) NOT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  id_usuario INT NOT NULL,
  PRIMARY KEY (id_historial),
  CONSTRAINT fk_historial_precios_id_material FOREIGN KEY (id_material) REFERENCES materiales(id_material),
  CONSTRAINT fk_historial_precios_id_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lo que pide el cliente desde el sitio. NO tiene precios.
CREATE TABLE solicitudes (
  id_solicitud INT NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(20) NOT NULL UNIQUE,
  id_cliente INT NOT NULL,
  id_tipo_estructura INT NOT NULL,
  id_modalidad INT NOT NULL,
  largo DECIMAL(8,2) NOT NULL,
  ancho DECIMAL(8,2) NOT NULL,
  distancia_postes DECIMAL(4,1) NOT NULL DEFAULT 2.5,
  numero_naves TINYINT NOT NULL DEFAULT 1,
  id_calibre_plastico INT NOT NULL,
  id_ancho_plastico INT NOT NULL,
  id_ancho_canal INT,
  id_calibre_canal INT,
  observaciones TEXT,
  origen ENUM('formulario','chat') NOT NULL DEFAULT 'formulario',
  estado ENUM('pendiente','en_revision','cotizada','cancelada') NOT NULL DEFAULT 'pendiente',
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_solicitud),
  CONSTRAINT fk_solicitudes_id_cliente FOREIGN KEY (id_cliente) REFERENCES usuarios(id_usuario),
  CONSTRAINT fk_solicitudes_id_tipo_estructura FOREIGN KEY (id_tipo_estructura) REFERENCES tipos_estructura(id_tipo_estructura),
  CONSTRAINT fk_solicitudes_id_modalidad FOREIGN KEY (id_modalidad) REFERENCES modalidades(id_modalidad),
  CONSTRAINT fk_solicitudes_id_calibre_plastico FOREIGN KEY (id_calibre_plastico) REFERENCES calibres(id_calibre),
  CONSTRAINT fk_solicitudes_id_ancho_plastico FOREIGN KEY (id_ancho_plastico) REFERENCES anchos_plastico(id_ancho_plastico),
  CONSTRAINT fk_solicitudes_id_ancho_canal FOREIGN KEY (id_ancho_canal) REFERENCES anchos_canal(id_ancho_canal),
  CONSTRAINT fk_solicitudes_id_calibre_canal FOREIGN KEY (id_calibre_canal) REFERENCES calibres(id_calibre),
  CONSTRAINT ck_solicitudes_1 CHECK (largo > 0),
  CONSTRAINT ck_solicitudes_2 CHECK (ancho > 0),
  CONSTRAINT ck_solicitudes_3 CHECK (distancia_postes > 0),
  CONSTRAINT ck_solicitudes_4 CHECK (numero_naves >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cotizacion con precios, hecha por el dueno (desde una solicitud o por una llamada). Solo el dueno la ve hasta que la libera.
CREATE TABLE cotizaciones (
  id_cotizacion INT NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(20) NOT NULL UNIQUE,
  id_solicitud INT,
  id_cliente INT,
  cliente_nombre VARCHAR(120) NOT NULL,
  cliente_contacto VARCHAR(120),
  id_dueno INT NOT NULL,
  id_tipo_estructura INT NOT NULL,
  id_modalidad INT NOT NULL,
  largo DECIMAL(8,2) NOT NULL,
  ancho DECIMAL(8,2) NOT NULL,
  distancia_postes DECIMAL(4,1) NOT NULL DEFAULT 2.5,
  numero_naves TINYINT NOT NULL DEFAULT 1,
  id_calibre_plastico INT NOT NULL,
  id_ancho_plastico INT NOT NULL,
  id_ancho_canal INT,
  id_calibre_canal INT,
  observaciones TEXT,
  area_total DECIMAL(12,2) NOT NULL,
  costo_materiales DECIMAL(14,2) NOT NULL DEFAULT 0,
  costo_mano_obra DECIMAL(14,2) NOT NULL DEFAULT 0,
  total DECIMAL(14,2) NOT NULL DEFAULT 0,
  estado ENUM('cotizada','en_revision','aprobada','anulada') NOT NULL DEFAULT 'cotizada',
  visible_cliente TINYINT(1) NOT NULL DEFAULT 0,
  ruta_pdf VARCHAR(255),
  notas_internas TEXT,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_envio DATETIME,
  PRIMARY KEY (id_cotizacion),
  CONSTRAINT fk_cotizaciones_id_solicitud FOREIGN KEY (id_solicitud) REFERENCES solicitudes(id_solicitud),
  CONSTRAINT fk_cotizaciones_id_cliente FOREIGN KEY (id_cliente) REFERENCES usuarios(id_usuario),
  CONSTRAINT fk_cotizaciones_id_dueno FOREIGN KEY (id_dueno) REFERENCES usuarios(id_usuario),
  CONSTRAINT fk_cotizaciones_id_tipo_estructura FOREIGN KEY (id_tipo_estructura) REFERENCES tipos_estructura(id_tipo_estructura),
  CONSTRAINT fk_cotizaciones_id_modalidad FOREIGN KEY (id_modalidad) REFERENCES modalidades(id_modalidad),
  CONSTRAINT fk_cotizaciones_id_calibre_plastico FOREIGN KEY (id_calibre_plastico) REFERENCES calibres(id_calibre),
  CONSTRAINT fk_cotizaciones_id_ancho_plastico FOREIGN KEY (id_ancho_plastico) REFERENCES anchos_plastico(id_ancho_plastico),
  CONSTRAINT fk_cotizaciones_id_ancho_canal FOREIGN KEY (id_ancho_canal) REFERENCES anchos_canal(id_ancho_canal),
  CONSTRAINT fk_cotizaciones_id_calibre_canal FOREIGN KEY (id_calibre_canal) REFERENCES calibres(id_calibre),
  CONSTRAINT ck_cotizaciones_1 CHECK (largo > 0),
  CONSTRAINT ck_cotizaciones_2 CHECK (ancho > 0),
  CONSTRAINT ck_cotizaciones_3 CHECK (distancia_postes > 0),
  CONSTRAINT ck_cotizaciones_4 CHECK (numero_naves >= 1),
  CONSTRAINT ck_cotizaciones_5 CHECK (total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lista de materiales (BOM) de cada cotizacion; guarda el precio del momento.
CREATE TABLE detalle_cotizacion (
  id_detalle INT NOT NULL AUTO_INCREMENT,
  id_cotizacion INT NOT NULL,
  id_material INT,
  seccion ENUM('estructura','cubierta','canal','insumo') NOT NULL,
  descripcion VARCHAR(150) NOT NULL,
  cantidad DECIMAL(12,2) NOT NULL,
  unidad VARCHAR(20) NOT NULL,
  precio_unitario DECIMAL(12,2) NOT NULL,
  subtotal DECIMAL(14,2) NOT NULL,
  orden SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (id_detalle),
  CONSTRAINT fk_detalle_cotizacion_id_cotizacion FOREIGN KEY (id_cotizacion) REFERENCES cotizaciones(id_cotizacion) ON DELETE CASCADE,
  CONSTRAINT fk_detalle_cotizacion_id_material FOREIGN KEY (id_material) REFERENCES materiales(id_material)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Conversacion entre cliente y dueno sobre una solicitud; puede adjuntar una cotizacion.
CREATE TABLE respuestas_solicitud (
  id_respuesta INT NOT NULL AUTO_INCREMENT,
  id_solicitud INT NOT NULL,
  id_usuario INT NOT NULL,
  mensaje TEXT NOT NULL,
  id_cotizacion INT,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_respuesta),
  CONSTRAINT fk_respuestas_solicitud_id_solicitud FOREIGN KEY (id_solicitud) REFERENCES solicitudes(id_solicitud) ON DELETE CASCADE,
  CONSTRAINT fk_respuestas_solicitud_id_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
  CONSTRAINT fk_respuestas_solicitud_id_cotizacion FOREIGN KEY (id_cotizacion) REFERENCES cotizaciones(id_cotizacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Avisos al dueno cuando llega una solicitud (correo, Telegram, WhatsApp o el panel).
CREATE TABLE notificaciones (
  id_notificacion INT NOT NULL AUTO_INCREMENT,
  id_solicitud INT NOT NULL,
  id_destinatario INT NOT NULL,
  canal ENUM('correo','telegram','whatsapp','panel') NOT NULL,
  mensaje VARCHAR(500) NOT NULL,
  estado_envio ENUM('pendiente','enviada','fallida') NOT NULL DEFAULT 'pendiente',
  leida TINYINT(1) NOT NULL DEFAULT 0,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_envio DATETIME,
  PRIMARY KEY (id_notificacion),
  CONSTRAINT fk_notificaciones_id_solicitud FOREIGN KEY (id_solicitud) REFERENCES solicitudes(id_solicitud) ON DELETE CASCADE,
  CONSTRAINT fk_notificaciones_id_destinatario FOREIGN KEY (id_destinatario) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tipos de obra del portafolio.
CREATE TABLE categorias_obra (
  id_categoria INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(60) NOT NULL UNIQUE,
  PRIMARY KEY (id_categoria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Obras ejecutadas que se muestran en el portafolio, con su foto.
CREATE TABLE obras (
  id_obra INT NOT NULL AUTO_INCREMENT,
  id_categoria INT NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  ubicacion VARCHAR(100),
  largo DECIMAL(8,2),
  ancho DECIMAL(8,2),
  anio SMALLINT,
  descripcion VARCHAR(400),
  ruta_foto VARCHAR(255),
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_obra),
  CONSTRAINT fk_obras_id_categoria FOREIGN KEY (id_categoria) REFERENCES categorias_obra(id_categoria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Índices para las consultas más frecuentes ----------
CREATE INDEX idx_solicitudes_cliente_estado ON solicitudes (id_cliente, estado);
CREATE INDEX idx_solicitudes_estado_fecha ON solicitudes (estado, fecha_creacion);
CREATE INDEX idx_cotizaciones_cliente ON cotizaciones (id_cliente, visible_cliente);
CREATE INDEX idx_cotizaciones_estado_fecha ON cotizaciones (estado, fecha_creacion);
CREATE INDEX idx_notificaciones_dest ON notificaciones (id_destinatario, leida);
CREATE INDEX idx_historial_material ON historial_precios (id_material, fecha);

-- ==========================================================================
-- DATOS INICIALES (valores del index.html V.2 original; el dueño los puede cambiar)
-- ==========================================================================
INSERT INTO roles (nombre) VALUES ('cliente'), ('dueno');

INSERT INTO tipos_estructura (nombre, distancia_max, descripcion) VALUES
  ('Metálico Tubular', 5.0, 'Sin postes centrales (luz libre)'),
  ('Capilla de Guadua', 4.0, 'Con postes centrales');

INSERT INTO modalidades (nombre) VALUES ('Todo Costo'), ('Mano de Obra');

INSERT INTO calibres (valor) VALUES (6), (7), (10);

INSERT INTO anchos_plastico (ancho_m, precio_m2) VALUES (5.80, 3200), (6.00, 4200), (6.50, 5200), (8.00, 7200), (10.00, 8200);

INSERT INTO anchos_canal (ancho_m, precio_rollo) VALUES (0.90, 350000), (1.20, 355000), (1.50, 360000), (2.00, 365000);

INSERT INTO materiales (codigo, nombre, unidad, precio_unitario, tipo) VALUES
  ('tubo',       'Tubo Galvanizado 2"x6m',       'un', 45000, 'base'),
  ('guadua',     'Poste de Guadua Tratada 6m',   'un', 15000, 'base'),
  ('carevaca_s', 'Carevaca Sencilla',            'un', 17000, 'base'),
  ('carevaca_r', 'Carevaca Reforzada',           'un', 22000, 'base');

INSERT INTO categorias_obra (nombre) VALUES
  ('Metálico Tubular'), ('Capilla de Guadua'), ('Cubierta tipo túnel'), ('Sistema de riego / ventilación');

-- El usuario del dueño (Libardo) NO se crea aquí para no dejar una contraseña conocida.
-- Créalo desde la aplicación (registro con rol 'dueno') o con este ejemplo, poniendo SU correo
-- y un hash generado por la aplicación:
--   INSERT INTO usuarios (id_rol, nombre, correo, clave_hash)
--   VALUES ((SELECT id_rol FROM roles WHERE nombre='dueno'), 'Libardo', 'correo-de-libardo@ejemplo.com', '<hash generado por la app>');

-- ==========================================================================
-- VISTAS PARA EL CLIENTE: no incluyen ningún precio.
-- La aplicación debe consultar SOLO estas vistas cuando quien entra tiene rol 'cliente'.
-- ==========================================================================
CREATE VIEW v_solicitudes_cliente AS
SELECT s.id_solicitud, s.codigo, s.id_cliente, te.nombre AS estructura, m.nombre AS modalidad,
       s.largo, s.ancho, s.distancia_postes, s.numero_naves,
       cp.valor AS calibre_plastico, ap.ancho_m AS ancho_plastico, ac.ancho_m AS ancho_canal, cc.valor AS calibre_canal,
       s.observaciones, s.estado, s.fecha_creacion
FROM solicitudes s
JOIN tipos_estructura te ON te.id_tipo_estructura = s.id_tipo_estructura
JOIN modalidades m ON m.id_modalidad = s.id_modalidad
JOIN calibres cp ON cp.id_calibre = s.id_calibre_plastico
JOIN anchos_plastico ap ON ap.id_ancho_plastico = s.id_ancho_plastico
LEFT JOIN anchos_canal ac ON ac.id_ancho_canal = s.id_ancho_canal
LEFT JOIN calibres cc ON cc.id_calibre = s.id_calibre_canal;

-- Solo las cotizaciones que el dueño ya liberó (visible_cliente = 1).
CREATE VIEW v_cotizaciones_cliente AS
SELECT q.id_cotizacion, q.codigo, q.id_cliente, q.id_solicitud, q.total, q.estado, q.ruta_pdf, q.fecha_envio
FROM cotizaciones q
WHERE q.visible_cliente = 1;

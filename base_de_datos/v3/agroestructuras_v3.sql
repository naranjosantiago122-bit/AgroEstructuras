-- ==========================================================================
-- AgroEstructuras - Base de datos v3 (MySQL 8 / MariaDB 10.4+)
-- Herramienta de cotización SOLO para el dueño (Libardo). No hay registro de clientes:
-- el dueño cotiza, genera el PDF con el diseño y lo envía por WhatsApp o correo.
-- 14 tablas. Reemplaza el modelo híbrido v2 (roles, usuarios, solicitudes, respuestas,
-- notificaciones y vistas del cliente).
-- ==========================================================================
CREATE DATABASE IF NOT EXISTS agroestructuras_v3 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE agroestructuras_v3;

-- Único usuario del sistema: el dueño (Libardo). Se crea desde la aplicación.
CREATE TABLE administrador (
  id_admin INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  correo VARCHAR(120) NOT NULL UNIQUE,
  telefono VARCHAR(20),
  clave_hash VARCHAR(255) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_admin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contactos a los que se les cotiza. No tienen cuenta ni contraseña.
CREATE TABLE clientes (
  id_cliente INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(120) NOT NULL,
  telefono VARCHAR(20),
  correo VARCHAR(120),
  municipio VARCHAR(80),
  direccion_obra VARCHAR(150),
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_cliente),
  CONSTRAINT ck_clientes_contacto CHECK (telefono IS NOT NULL OR correo IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tipos_estructura (
  id_tipo_estructura INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(50) NOT NULL UNIQUE,
  distancia_max DECIMAL(4,1) NOT NULL,
  descripcion VARCHAR(150),
  PRIMARY KEY (id_tipo_estructura),
  CONSTRAINT ck_tipos_estructura_1 CHECK (distancia_max > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE modalidades (
  id_modalidad INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(30) NOT NULL UNIQUE,
  PRIMARY KEY (id_modalidad)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE calibres (
  id_calibre INT NOT NULL AUTO_INCREMENT,
  valor TINYINT NOT NULL UNIQUE,
  PRIMARY KEY (id_calibre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE anchos_plastico (
  id_ancho_plastico INT NOT NULL AUTO_INCREMENT,
  ancho_m DECIMAL(4,2) NOT NULL UNIQUE,
  precio_m2 DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id_ancho_plastico),
  CONSTRAINT ck_anchos_plastico_1 CHECK (precio_m2 >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE anchos_canal (
  id_ancho_canal INT NOT NULL AUTO_INCREMENT,
  ancho_m DECIMAL(4,2) NOT NULL UNIQUE,
  precio_rollo DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id_ancho_canal),
  CONSTRAINT ck_anchos_canal_1 CHECK (precio_rollo >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE materiales (
  id_material INT NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(30) UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  unidad VARCHAR(20) NOT NULL DEFAULT 'un',
  precio_unitario DECIMAL(12,2) NOT NULL,
  tipo ENUM('base','insumo') NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_material),
  CONSTRAINT ck_materiales_1 CHECK (precio_unitario >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE historial_precios (
  id_historial INT NOT NULL AUTO_INCREMENT,
  id_material INT NOT NULL,
  id_admin INT NOT NULL,
  precio_anterior DECIMAL(12,2) NOT NULL,
  precio_nuevo DECIMAL(12,2) NOT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_historial),
  CONSTRAINT fk_historial_material FOREIGN KEY (id_material) REFERENCES materiales(id_material),
  CONSTRAINT fk_historial_admin FOREIGN KEY (id_admin) REFERENCES administrador(id_admin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cotizaciones (
  id_cotizacion INT NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(20) NOT NULL UNIQUE,
  id_cliente INT NOT NULL,
  id_admin INT NOT NULL,
  id_tipo_estructura INT NOT NULL,
  id_modalidad INT NOT NULL,
  largo DECIMAL(8,2) NOT NULL,
  ancho DECIMAL(8,2) NOT NULL,
  altura DECIMAL(4,2),
  distancia_postes DECIMAL(4,1) NOT NULL DEFAULT 2.5,
  numero_naves TINYINT NOT NULL DEFAULT 1,
  id_calibre_plastico INT NOT NULL,
  id_ancho_plastico INT NOT NULL,
  id_ancho_canal INT,
  id_calibre_canal INT,
  area_total DECIMAL(12,2) NOT NULL,
  costo_materiales DECIMAL(14,2) NOT NULL DEFAULT 0,
  costo_mano_obra DECIMAL(14,2) NOT NULL DEFAULT 0,
  total DECIMAL(14,2) NOT NULL DEFAULT 0,
  imagen_diseno VARCHAR(255),
  ruta_pdf VARCHAR(255),
  observaciones TEXT,
  notas_internas TEXT,
  estado ENUM('borrador','enviada','aprobada','rechazada','anulada') NOT NULL DEFAULT 'borrador',
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_cotizacion),
  CONSTRAINT fk_cot_cliente FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente),
  CONSTRAINT fk_cot_admin FOREIGN KEY (id_admin) REFERENCES administrador(id_admin),
  CONSTRAINT fk_cot_tipo FOREIGN KEY (id_tipo_estructura) REFERENCES tipos_estructura(id_tipo_estructura),
  CONSTRAINT fk_cot_modalidad FOREIGN KEY (id_modalidad) REFERENCES modalidades(id_modalidad),
  CONSTRAINT fk_cot_calibre_plastico FOREIGN KEY (id_calibre_plastico) REFERENCES calibres(id_calibre),
  CONSTRAINT fk_cot_ancho_plastico FOREIGN KEY (id_ancho_plastico) REFERENCES anchos_plastico(id_ancho_plastico),
  CONSTRAINT fk_cot_ancho_canal FOREIGN KEY (id_ancho_canal) REFERENCES anchos_canal(id_ancho_canal),
  CONSTRAINT fk_cot_calibre_canal FOREIGN KEY (id_calibre_canal) REFERENCES calibres(id_calibre),
  CONSTRAINT ck_cot_largo CHECK (largo > 0),
  CONSTRAINT ck_cot_ancho CHECK (ancho > 0),
  CONSTRAINT ck_cot_distancia CHECK (distancia_postes > 0),
  CONSTRAINT ck_cot_naves CHECK (numero_naves >= 1),
  CONSTRAINT ck_cot_total CHECK (total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE detalle_cotizacion (
  id_detalle INT NOT NULL AUTO_INCREMENT,
  id_cotizacion INT NOT NULL,
  id_material INT,
  seccion ENUM('estructura','cubierta','canal','insumo','mano_obra') NOT NULL,
  descripcion VARCHAR(150) NOT NULL,
  cantidad DECIMAL(12,2) NOT NULL,
  unidad VARCHAR(20) NOT NULL,
  precio_unitario DECIMAL(12,2) NOT NULL,
  subtotal DECIMAL(14,2) NOT NULL,
  orden SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (id_detalle),
  CONSTRAINT fk_detalle_cotizacion FOREIGN KEY (id_cotizacion) REFERENCES cotizaciones(id_cotizacion) ON DELETE CASCADE,
  CONSTRAINT fk_detalle_material FOREIGN KEY (id_material) REFERENCES materiales(id_material),
  CONSTRAINT ck_detalle_cantidad CHECK (cantidad >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE envios (
  id_envio INT NOT NULL AUTO_INCREMENT,
  id_cotizacion INT NOT NULL,
  canal ENUM('whatsapp','correo') NOT NULL,
  destino VARCHAR(120) NOT NULL,
  mensaje VARCHAR(500),
  estado_envio ENUM('pendiente','enviado','fallido') NOT NULL DEFAULT 'pendiente',
  fecha_envio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_envio),
  CONSTRAINT fk_envios_cotizacion FOREIGN KEY (id_cotizacion) REFERENCES cotizaciones(id_cotizacion) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE categorias_obra (
  id_categoria INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(60) NOT NULL UNIQUE,
  PRIMARY KEY (id_categoria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  PRIMARY KEY (id_obra),
  CONSTRAINT fk_obras_categoria FOREIGN KEY (id_categoria) REFERENCES categorias_obra(id_categoria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Índices para las búsquedas más frecuentes
CREATE INDEX idx_cot_estado_fecha ON cotizaciones (estado, fecha_creacion);
CREATE INDEX idx_cot_cliente ON cotizaciones (id_cliente);
CREATE INDEX idx_clientes_nombre ON clientes (nombre);
CREATE INDEX idx_envios_cotizacion ON envios (id_cotizacion, fecha_envio);
CREATE INDEX idx_historial_material ON historial_precios (id_material, fecha);

-- ==========================================================================
-- DATOS INICIALES (valores del index.html V.2; el dueño los cambia en Inventario)
-- ==========================================================================
INSERT INTO tipos_estructura (nombre, distancia_max, descripcion) VALUES
  ('Metálico Tubular', 5.0, 'Sin postes centrales (luz libre)'),
  ('Capilla de Guadua', 4.0, 'Con postes centrales');
INSERT INTO modalidades (nombre) VALUES ('Todo Costo'), ('Mano de Obra');
INSERT INTO calibres (valor) VALUES (6), (7), (10);
INSERT INTO anchos_plastico (ancho_m, precio_m2) VALUES (5.80, 3200), (6.00, 4200), (6.50, 5200), (8.00, 7200), (10.00, 8200);
INSERT INTO anchos_canal (ancho_m, precio_rollo) VALUES (0.90, 350000), (1.20, 355000), (1.50, 360000), (2.00, 365000);
INSERT INTO materiales (codigo, nombre, unidad, precio_unitario, tipo) VALUES
  ('tubo',       'Tubo Galvanizado 2"x6m',     'un', 45000, 'base'),
  ('guadua',     'Poste de Guadua Tratada 6m', 'un', 15000, 'base'),
  ('carevaca_s', 'Carevaca Sencilla',          'un', 17000, 'base'),
  ('carevaca_r', 'Carevaca Reforzada',         'un', 22000, 'base');
INSERT INTO categorias_obra (nombre) VALUES
  ('Metálico Tubular'), ('Capilla de Guadua'), ('Cubierta tipo túnel'), ('Sistema de riego / ventilación');
-- La cuenta de Libardo NO se crea aquí (no se deja una contraseña conocida): se crea desde la aplicación.

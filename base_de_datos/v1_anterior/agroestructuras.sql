-- =====================================================
-- AgroEstructuras - Base de datos MySQL
-- Sistema de cotizaciones de invernaderos y estructuras para saran
-- =====================================================
DROP DATABASE IF EXISTS agroestructuras;
CREATE DATABASE agroestructuras CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE agroestructuras;

-- ---------- Usuarios ----------
CREATE TABLE usuarios (
  id_usuario     INT AUTO_INCREMENT PRIMARY KEY,
  nombre         VARCHAR(100) NOT NULL,
  correo         VARCHAR(120) NOT NULL UNIQUE,
  telefono       VARCHAR(20),
  ciudad         VARCHAR(80),
  password_hash  VARCHAR(255) NOT NULL,
  rol            ENUM('cliente','admin') NOT NULL DEFAULT 'cliente',
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------- Catálogos de opciones del cotizador ----------
CREATE TABLE tipos_trabajo (            -- Todo costo / Solo mano de obra
  id_tipo_trabajo INT AUTO_INCREMENT PRIMARY KEY,
  nombre          VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE tipos_cubierta (           -- Polietileno / Saran-polisombra
  id_tipo_cubierta INT AUTO_INCREMENT PRIMARY KEY,
  nombre           VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE tipos_estructura (         -- Guadua / Palo inmunizado
  id_tipo_estructura INT AUTO_INCREMENT PRIMARY KEY,
  nombre             VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE disenos (                  -- Pagoda, capilla, cercha, tubular, espacial
  id_diseno   INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(60) NOT NULL UNIQUE,
  descripcion VARCHAR(255)
);

CREATE TABLE plasticos (                -- Plásticos y mallas disponibles
  id_plastico      INT AUTO_INCREMENT PRIMARY KEY,
  id_tipo_cubierta INT NOT NULL,
  nombre           VARCHAR(80) NOT NULL,
  calibre          VARCHAR(20),          -- ej. 6, 7 (polietileno)
  porcentaje_sombra TINYINT,             -- ej. 80 (saran)
  precio_m2        DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (id_tipo_cubierta) REFERENCES tipos_cubierta(id_tipo_cubierta)
);

-- ---------- Materiales y reglas de cálculo ----------
CREATE TABLE materiales (
  id_material INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  unidad      VARCHAR(20) NOT NULL,      -- und, kg, m, m2
  precio_unit DECIMAL(10,2) NOT NULL
);

-- Cuánto material necesita cada diseño según la estructura (editable por el admin)
CREATE TABLE reglas_material (
  id_regla           INT AUTO_INCREMENT PRIMARY KEY,
  id_diseno          INT NOT NULL,
  id_tipo_estructura INT NOT NULL,
  id_material        INT NOT NULL,
  cantidad_por_m2    DECIMAL(10,4) NOT NULL,   -- cantidad de material por m2 de área
  FOREIGN KEY (id_diseno)          REFERENCES disenos(id_diseno),
  FOREIGN KEY (id_tipo_estructura) REFERENCES tipos_estructura(id_tipo_estructura),
  FOREIGN KEY (id_material)        REFERENCES materiales(id_material)
);

CREATE TABLE tarifas_mano_obra (        -- precio de mano de obra por m2 según diseño
  id_tarifa INT AUTO_INCREMENT PRIMARY KEY,
  id_diseno INT NOT NULL,
  precio_m2 DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (id_diseno) REFERENCES disenos(id_diseno)
);

-- ---------- Cotizaciones ----------
CREATE TABLE cotizaciones (
  id_cotizacion      INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario         INT NOT NULL,
  id_tipo_trabajo    INT NOT NULL,
  id_tipo_cubierta   INT NOT NULL,
  id_tipo_estructura INT NOT NULL,
  id_diseno          INT NOT NULL,
  id_plastico        INT NOT NULL,
  largo              DECIMAL(8,2) NOT NULL,
  ancho              DECIMAL(8,2) NOT NULL,
  altura             DECIMAL(8,2) NOT NULL,
  observaciones      TEXT,
  origen             ENUM('formulario','chat') NOT NULL DEFAULT 'formulario',
  costo_materiales   DECIMAL(12,2) NOT NULL DEFAULT 0,
  costo_mano_obra    DECIMAL(12,2) NOT NULL DEFAULT 0,
  total              DECIMAL(12,2) NOT NULL DEFAULT 0,
  fecha              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_usuario)         REFERENCES usuarios(id_usuario),
  FOREIGN KEY (id_tipo_trabajo)    REFERENCES tipos_trabajo(id_tipo_trabajo),
  FOREIGN KEY (id_tipo_cubierta)   REFERENCES tipos_cubierta(id_tipo_cubierta),
  FOREIGN KEY (id_tipo_estructura) REFERENCES tipos_estructura(id_tipo_estructura),
  FOREIGN KEY (id_diseno)          REFERENCES disenos(id_diseno),
  FOREIGN KEY (id_plastico)        REFERENCES plasticos(id_plastico)
);

CREATE TABLE detalle_cotizacion (       -- lista de materiales de cada cotización
  id_detalle    INT AUTO_INCREMENT PRIMARY KEY,
  id_cotizacion INT NOT NULL,
  id_material   INT NOT NULL,
  cantidad      DECIMAL(10,2) NOT NULL,
  precio_unit   DECIMAL(10,2) NOT NULL,   -- precio guardado al momento de cotizar
  subtotal      DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (id_cotizacion) REFERENCES cotizaciones(id_cotizacion) ON DELETE CASCADE,
  FOREIGN KEY (id_material)   REFERENCES materiales(id_material)
);

-- ---------- Galería ----------
CREATE TABLE categorias_galeria (
  id_categoria INT AUTO_INCREMENT PRIMARY KEY,
  nombre       VARCHAR(60) NOT NULL UNIQUE
);

CREATE TABLE galeria (
  id_foto      INT AUTO_INCREMENT PRIMARY KEY,
  id_categoria INT NOT NULL,
  titulo       VARCHAR(100) NOT NULL,
  descripcion  VARCHAR(255),
  ubicacion    VARCHAR(100),
  ruta_imagen  VARCHAR(255) NOT NULL,
  fecha        DATE,
  FOREIGN KEY (id_categoria) REFERENCES categorias_galeria(id_categoria)
);

-- =====================================================
-- Datos iniciales (ejemplo: ajusta los precios y cantidades reales)
-- =====================================================
INSERT INTO tipos_trabajo (nombre) VALUES ('Todo costo'), ('Solo mano de obra');
INSERT INTO tipos_cubierta (nombre) VALUES ('Polietileno'), ('Saran / polisombra');
INSERT INTO tipos_estructura (nombre) VALUES ('Guadua'), ('Palo inmunizado');
INSERT INTO disenos (nombre) VALUES ('Pagoda'), ('Capilla'), ('Capilla en cercha'), ('Tubular'), ('Espacial');
INSERT INTO categorias_galeria (nombre) VALUES ('Invernaderos'), ('Saran / polisombra'), ('Guadua'), ('Palos inmunizados');

INSERT INTO plasticos (id_tipo_cubierta, nombre, calibre, porcentaje_sombra, precio_m2) VALUES
 (1, 'Plástico para invernadero cal. 6', '6', NULL, 0),
 (1, 'Plástico para invernadero cal. 7', '7', NULL, 0),
 (2, 'Saran 80%', NULL, 80, 0),
 (2, 'Saran 65%', NULL, 65, 0);

INSERT INTO materiales (nombre, unidad, precio_unit) VALUES
 ('Guadua', 'und', 0),
 ('Palo inmunizado', 'und', 0),
 ('Alambre', 'kg', 0),
 ('Grapas', 'kg', 0),
 ('Amarres / zunchos', 'und', 0);

INSERT INTO tarifas_mano_obra (id_diseno, precio_m2) VALUES (1,0),(2,0),(3,0),(4,0),(5,0);

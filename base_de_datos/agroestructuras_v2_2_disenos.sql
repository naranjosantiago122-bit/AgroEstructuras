-- ============================================================================
-- AgroEstructuras · Migración v2.1 -> v2.2 (diseño personalizado)
-- Se ejecuta DESPUÉS de agroestructuras_v2_1_backend.sql. No borra datos.
--
-- 1. El cliente puede diseñar su invernadero «a su medida» (naves de distinto tipo, ancho y largo,
--    forma del terreno, puertas, ventana cenital, cortinas, altura de postes). El diseño se guarda
--    completo, como texto JSON, en la solicitud y en la cotización.
-- 2. Tipos de estructura nuevos (según los videos de referencia). Su FÓRMULA de materiales y su
--    PRECIO están PENDIENTES: el dueño los entregará. distancia_max = 4.0 es PROVISIONAL.
-- ============================================================================
USE agroestructuras;

ALTER TABLE solicitudes  ADD COLUMN diseno_json MEDIUMTEXT NULL AFTER observaciones;
ALTER TABLE cotizaciones ADD COLUMN diseno_json MEDIUMTEXT NULL AFTER observaciones;

INSERT IGNORE INTO tipos_estructura (nombre, distancia_max, descripcion) VALUES
  ('Capilla en cercha', 4.0, 'Sin postes centrales: el techo lo sostiene una cercha (precio pendiente)'),
  ('Una sola agua', 4.0, 'Techo de una sola caída (precio pendiente)'),
  ('Sarán capilla', 4.0, 'Sarán / polisombra sin alfardas, postes altos y bajos y cables (precio pendiente)');

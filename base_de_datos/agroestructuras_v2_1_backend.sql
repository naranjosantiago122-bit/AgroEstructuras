-- ============================================================================
-- AgroEstructuras · Migración v2 -> v2.1 (necesaria para el back-end)
-- Se ejecuta DESPUÉS de agroestructuras_v2.sql. No borra datos.
--
-- Cambio: el cliente le pone un nombre a su proyecto («Invernadero finca La
-- Esperanza») y la tabla solicitudes no tenía dónde guardarlo.
-- ============================================================================
USE agroestructuras;

ALTER TABLE solicitudes
  ADD COLUMN nombre_proyecto VARCHAR(120) NULL AFTER id_cliente;

-- La vista del cliente ahora también muestra el nombre del proyecto (sigue SIN precios)
CREATE OR REPLACE VIEW v_solicitudes_cliente AS
SELECT s.id_solicitud, s.codigo, s.id_cliente, s.nombre_proyecto, te.nombre AS estructura, m.nombre AS modalidad,
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

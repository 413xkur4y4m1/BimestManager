-- =====================================================================
-- BimestManager · Migración
-- Fecha: 2026-06-09
-- Objetivo:
--   1. Que los MAESTROS creen prácticas/kits (se agrega practicas.creado_por).
--   2. Agendar sesiones en un LABORATORIO concreto y detectar choques de
--      horario (se agrega la tabla laboratorios + sesiones.laboratorio_id).
--   3. Que el maestro indique el KIT solicitado por sesión, para que el
--      laboratorista lo prepare (se agrega sesiones.kit_id).
--
-- Es IDEMPOTENTE: se puede ejecutar varias veces sin error.
-- Uso:  mysql -u <usuario> -p labs < sql/2026_practicas_maestro_laboratorios.sql
-- =====================================================================

-- --------------------------------------------------------------------
-- Tabla de laboratorios (aulas físicas). La administra el ADMIN.
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `laboratorios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `ubicacion` varchar(150) DEFAULT NULL,
  `capacidad` int DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_laboratorio_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------------------
-- Columnas nuevas (guardadas para poder re-ejecutar sin error).
-- MySQL 8 no soporta "ADD COLUMN IF NOT EXISTS", así que usamos un
-- procedimiento que consulta information_schema antes de alterar.
-- --------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `bm_migracion_practicas_labs`;
DELIMITER $$
CREATE PROCEDURE `bm_migracion_practicas_labs`()
BEGIN
  -- practicas.creado_por -> maestro que creó la práctica
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'practicas' AND COLUMN_NAME = 'creado_por'
  ) THEN
    ALTER TABLE `practicas`
      ADD COLUMN `creado_por` int DEFAULT NULL,
      ADD KEY `idx_practicas_creado_por` (`creado_por`),
      ADD CONSTRAINT `fk_practicas_creador`
        FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL;
  END IF;

  -- sesiones.laboratorio_id -> dónde se imparte la sesión (motor anti-choque)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sesiones' AND COLUMN_NAME = 'laboratorio_id'
  ) THEN
    ALTER TABLE `sesiones`
      ADD COLUMN `laboratorio_id` int DEFAULT NULL,
      ADD KEY `idx_sesiones_laboratorio` (`laboratorio_id`),
      ADD CONSTRAINT `fk_sesiones_laboratorio`
        FOREIGN KEY (`laboratorio_id`) REFERENCES `laboratorios` (`id`) ON DELETE SET NULL;
  END IF;

  -- sesiones.kit_id -> kit solicitado para que el laboratorista lo prepare
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sesiones' AND COLUMN_NAME = 'kit_id'
  ) THEN
    ALTER TABLE `sesiones`
      ADD COLUMN `kit_id` int DEFAULT NULL,
      ADD KEY `idx_sesiones_kit` (`kit_id`),
      ADD CONSTRAINT `fk_sesiones_kit`
        FOREIGN KEY (`kit_id`) REFERENCES `kits` (`id`) ON DELETE SET NULL;
  END IF;
END $$
DELIMITER ;

CALL `bm_migracion_practicas_labs`();
DROP PROCEDURE IF EXISTS `bm_migracion_practicas_labs`;

-- --------------------------------------------------------------------
-- Laboratorios de ejemplo (solo si aún no existen).
-- --------------------------------------------------------------------
INSERT INTO `laboratorios` (`nombre`, `ubicacion`, `capacidad`)
SELECT * FROM (SELECT 'Laboratorio de Química A' AS n, 'Edificio C · Planta baja' AS u, 30 AS c) AS t
WHERE NOT EXISTS (SELECT 1 FROM `laboratorios` WHERE `nombre` = 'Laboratorio de Química A');

INSERT INTO `laboratorios` (`nombre`, `ubicacion`, `capacidad`)
SELECT * FROM (SELECT 'Laboratorio de Química B' AS n, 'Edificio C · Primer piso' AS u, 25 AS c) AS t
WHERE NOT EXISTS (SELECT 1 FROM `laboratorios` WHERE `nombre` = 'Laboratorio de Química B');

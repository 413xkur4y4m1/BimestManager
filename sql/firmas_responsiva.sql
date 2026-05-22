-- ============================================================
-- Migracion: firma digital por alumno en su responsiva
-- ------------------------------------------------------------
-- Se guarda la firma en disco (carpeta /imageFirma del proyecto)
-- y en la base de datos solamente la RUTA RELATIVA a la imagen.
-- ============================================================

USE labs;

ALTER TABLE equipo_integrantes
  ADD COLUMN firma_imagen VARCHAR(255) NULL AFTER usuario_id,
  ADD COLUMN firmado_at   TIMESTAMP    NULL AFTER firma_imagen;

-- (opcional) indice para auditar firmas por fecha
CREATE INDEX idx_equipo_integrantes_firmado_at
  ON equipo_integrantes (firmado_at);

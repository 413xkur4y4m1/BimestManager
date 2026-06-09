-- =====================================================================
-- BimestManager · Seed de 500 materiales aleatorios
-- Inserta 500 materiales con nombre y stock pseudo-aleatorios en `materiales`.
-- Uso:  mysql -u <usuario> -p labs < sql/seed_500_materiales.sql
-- Se puede ejecutar varias veces (cada corrida agrega 500 filas nuevas).
-- =====================================================================

INSERT INTO `materiales` (`nombre`, `stock`)
WITH RECURSIVE seq (n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < 500
)
SELECT
  CONCAT(
    ELT(1 + FLOOR(RAND() * 30),
      'Ácido clorhídrico', 'Hidróxido de sodio', 'Etanol', 'Sulfato de cobre',
      'Nitrato de plata', 'Cloruro de sodio', 'Permanganato de potasio', 'Fenolftaleína',
      'Acetona', 'Glucosa', 'Bicarbonato de sodio', 'Ácido sulfúrico',
      'Yoduro de potasio', 'Amoniaco', 'Peróxido de hidrógeno', 'Carbonato de calcio',
      'Sacarosa', 'Almidón', 'Azul de metileno', 'Ácido acético',
      'Vaso de precipitados', 'Matraz Erlenmeyer', 'Pipeta graduada', 'Bureta',
      'Tubo de ensayo', 'Probeta', 'Embudo de vidrio', 'Mechero Bunsen',
      'Termómetro de laboratorio', 'Gradilla metálica'
    ),
    ' ',
    ELT(1 + FLOOR(RAND() * 8),
      '50 mL', '100 mL', '250 mL', '500 mL', '1 L', '100 g', '250 g', 'grado reactivo'
    ),
    ' [', LPAD(n, 3, '0'), ']'
  ) AS nombre,
  FLOOR(RAND() * 300) + 1 AS stock
FROM seq;

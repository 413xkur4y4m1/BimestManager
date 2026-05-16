-- Consultas de evidencia para el reporte (capturar resultado).
-- Demuestran que la WEB ejecuta SQL real y que el usuario tiene permisos mínimos.

-- 1) Conteo total de usuarios (dato real, no simulado)
SELECT COUNT(*) AS total_usuarios FROM usuarios;

-- 2) Últimos 5 usuarios registrados
SELECT id, nombre, correo, rol, is_active, fecha_registro
FROM usuarios
ORDER BY id DESC
LIMIT 5;

-- 3) Sesiones activas y pendientes
SELECT estado, COUNT(*) AS cuantas
FROM sesiones
GROUP BY estado;

-- 4) Préstamos no devueltos (riesgo operativo)
SELECT p.id, u.nombre AS alumno, m.nombre AS material, p.fecha_prestamo
FROM prestamos p
JOIN usuarios u ON u.id = p.usuario_id
JOIN materiales m ON m.id = p.material_id
WHERE p.fecha_devolucion IS NULL
ORDER BY p.fecha_prestamo ASC;

-- 5) Verificar que el usuario de la app NO puede hacer DDL (debe fallar):
--   Ejecutar como bimest_app:
--     CREATE TABLE labs.prueba_ddl (id INT);    -- ERROR 1142
--     DROP TABLE labs.usuarios;                  -- ERROR 1142
--     GRANT ALL ON *.* TO 'x'@'%';              -- ERROR 1227

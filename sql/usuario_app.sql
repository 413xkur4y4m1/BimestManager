-- =============================================================================
-- Usuario de aplicación con permisos MÍNIMOS para BimestManager
-- =============================================================================
-- Rúbrica Parcial 2: "Usuario de app con permisos mínimos (NO usar sa/root)".
-- Este script crea un usuario dedicado para que la app Node se conecte a MySQL
-- SIN privilegios administrativos (sin DROP, ALTER, GRANT, CREATE USER, etc.).
--
-- Ejecutar como root UNA SOLA VEZ:
--   mysql -u root -p < sql/usuario_app.sql
--
-- Luego en .env:
--   DB_USER=bimest_app
--   DB_PASSWORD=<la_password_de_abajo>
-- =============================================================================

-- Cambia la password antes de ejecutar en cualquier ambiente que no sea local.
SET @app_user      = 'bimest_app';
SET @app_password  = 'Bimest_App_2026!_cambia_esto';
SET @app_host_loc  = 'localhost';     -- cuando WEB y DB están en la misma máquina
SET @app_host_lan  = '192.168.%';     -- cuando WEB está en otro server (ajusta a tu red)
SET @db_quimica    = 'labs';
SET @db_turismo    = 'labs';          -- mismo schema en este proyecto

-- ----------- Crear usuarios -----------
CREATE USER IF NOT EXISTS 'bimest_app'@'localhost'  IDENTIFIED BY 'Bimest_App_2026!_cambia_esto';
CREATE USER IF NOT EXISTS 'bimest_app'@'192.168.%'  IDENTIFIED BY 'Bimest_App_2026!_cambia_esto';

-- ----------- Exigir TLS (cifrado del canal MySQL) -----------
-- REQUIRE SSL obliga a que la conexión venga sobre TLS. Si la app intenta
-- conectarse en claro, MySQL la rechaza. Quita la línea si tu MySQL aún no
-- tiene certificados configurados; volverás a habilitarlo cuando el servidor
-- DB tenga los certs.
ALTER USER 'bimest_app'@'localhost' REQUIRE SSL;
ALTER USER 'bimest_app'@'192.168.%' REQUIRE SSL;

-- ----------- Permisos mínimos sobre la base de la app -----------
-- DML únicamente. NO se otorga: CREATE, DROP, ALTER, INDEX, GRANT, FILE,
-- SUPER, PROCESS, RELOAD, SHUTDOWN, CREATE USER, REFERENCES, TRIGGER, EVENT.
GRANT SELECT, INSERT, UPDATE, DELETE ON labs.* TO 'bimest_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON labs.* TO 'bimest_app'@'192.168.%';

-- (Opcional) permiso para ejecutar procedimientos almacenados si los agregas:
-- GRANT EXECUTE ON labs.* TO 'bimest_app'@'localhost';

-- ----------- Endurecimiento de cuenta -----------
ALTER USER 'bimest_app'@'localhost'
  WITH MAX_QUERIES_PER_HOUR 0
       MAX_UPDATES_PER_HOUR 0
       MAX_CONNECTIONS_PER_HOUR 0
       MAX_USER_CONNECTIONS 20
       PASSWORD EXPIRE INTERVAL 180 DAY
       FAILED_LOGIN_ATTEMPTS 5
       PASSWORD_LOCK_TIME 1;

ALTER USER 'bimest_app'@'192.168.%'
  WITH MAX_USER_CONNECTIONS 20
       PASSWORD EXPIRE INTERVAL 180 DAY
       FAILED_LOGIN_ATTEMPTS 5
       PASSWORD_LOCK_TIME 1;

FLUSH PRIVILEGES;

-- ----------- Verificación (correr manualmente) -----------
-- SHOW GRANTS FOR 'bimest_app'@'localhost';
-- SHOW GRANTS FOR 'bimest_app'@'192.168.%';
-- SELECT user, host, ssl_type FROM mysql.user WHERE user = 'bimest_app';

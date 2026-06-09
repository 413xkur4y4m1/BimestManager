// ============================================================
// init-db.js - Carga el esquema en la base de datos
// ============================================================
// Pensado para correr DENTRO del contenedor de la app en Coolify,
// donde DB_HOST (hostname interno de Docker) si es alcanzable.
//
//   Uso:  node scripts/init-db.js
//
// Usa las MISMAS variables de entorno que la app (DB_HOST, DB_USER,
// DB_PASSWORD, DB_NAME, DB_PORT, DB_SSL). Lee sql/schema_cloud.sql y
// lo ejecuta. Es idempotente: las tablas usan CREATE TABLE IF NOT EXISTS.
// ============================================================

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const SCHEMA_PATH = path.join(__dirname, '..', 'sql', 'schema_cloud.sql');

const construirSsl = () => {
  if (String(process.env.DB_SSL || '').toLowerCase() !== 'true') return undefined;
  return {
    rejectUnauthorized:
      String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() === 'true'
  };
};

(async () => {
  if (!fs.existsSync(SCHEMA_PATH)) {
    console.error(`No se encontro el esquema en ${SCHEMA_PATH}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');

  const host = process.env.DB_HOST;
  const database = process.env.DB_NAME;
  console.log(`Conectando a ${host}:${process.env.DB_PORT || 3306} / base "${database}"...`);

  let conexion;
  try {
    // Conectamos SIN base fija para poder crearla si no existe.
    conexion = await mysql.createConnection({
      host,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: construirSsl(),
      multipleStatements: true // necesario para ejecutar el .sql completo de una
    });
  } catch (err) {
    console.error('No se pudo conectar al servidor de base de datos:', err.message);
    process.exit(1);
  }

  try {
    // Crea la base si no existe y la selecciona. Asi funciona aunque el
    // nombre real difiera (default / labs) o la base aun no exista.
    await conexion.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
    await conexion.changeUser({ database });

    console.log('Ejecutando schema_cloud.sql...');
    await conexion.query(sql);

    const [tablas] = await conexion.query('SHOW TABLES;');
    console.log(`Esquema cargado correctamente. Tablas en "${database}": ${tablas.length}`);
    for (const fila of tablas) {
      console.log('  - ' + Object.values(fila)[0]);
    }
  } catch (err) {
    console.error('Error al ejecutar el esquema:', err.message);
    process.exitCode = 1;
  } finally {
    await conexion.end();
  }
})();

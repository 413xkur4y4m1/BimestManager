// ============================================================
// init-db.js - Carga el esquema y migraciones en la base de datos
// ============================================================
// Pensado para correr DENTRO del contenedor de la app en Coolify,
// donde DB_HOST (hostname interno de Docker) si es alcanzable.
//
//   Uso:  node scripts/init-db.js          (schema + migraciones)
//         node scripts/init-db.js --seed    (ademas inserta datos de demo)
//
// Usa las MISMAS variables de entorno que la app (DB_HOST, DB_USER,
// DB_PASSWORD, DB_NAME, DB_PORT, DB_SSL).
//
// - schema_cloud.sql y las migraciones son IDEMPOTENTES: se pueden correr
//   varias veces sin romper nada.
// - Los seeds NO son idempotentes (agregan filas cada vez), por eso solo
//   corren con --seed.
// ============================================================

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const SQL_DIR = path.join(__dirname, '..', 'sql');

// Orden de ejecucion. El schema primero (crea tablas base), luego las
// migraciones idempotentes que agregan tablas/columnas nuevas.
const ARCHIVOS_BASE = [
  'schema_cloud.sql',
  '2026_practicas_maestro_laboratorios.sql'
];

// Solo con --seed (insertan datos de ejemplo, NO idempotentes).
const ARCHIVOS_SEED = [
  'seed_500_materiales.sql'
];

const construirSsl = () => {
  if (String(process.env.DB_SSL || '').toLowerCase() !== 'true') return undefined;
  return {
    rejectUnauthorized:
      String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() === 'true'
  };
};

// Divide un archivo .sql en sentencias respetando la directiva DELIMITER
// (necesaria para los procedimientos almacenados de las migraciones, que
// mysql2 no entiende si se mandan en bloque).
const dividirSentencias = (sql) => {
  const sentencias = [];
  let delimitador = ';';
  let buffer = '';

  for (const linea of sql.split(/\r?\n/)) {
    const limpia = linea.trim();
    if (limpia.startsWith('--') || limpia.startsWith('#') || limpia === '') continue;

    const cambioDelim = limpia.match(/^DELIMITER\s+(\S+)/i);
    if (cambioDelim) { delimitador = cambioDelim[1]; continue; }

    buffer += linea + '\n';

    let idx;
    while ((idx = buffer.indexOf(delimitador)) !== -1) {
      const sentencia = buffer.slice(0, idx).trim();
      if (sentencia) sentencias.push(sentencia);
      buffer = buffer.slice(idx + delimitador.length);
    }
  }

  if (buffer.trim()) sentencias.push(buffer.trim());
  return sentencias;
};

const ejecutarArchivo = async (conexion, nombre) => {
  const ruta = path.join(SQL_DIR, nombre);
  if (!fs.existsSync(ruta)) {
    console.warn('  [!] No existe ' + nombre + ', se omite.');
    return;
  }
  const sql = fs.readFileSync(ruta, 'utf8');
  const sentencias = dividirSentencias(sql);
  for (const sentencia of sentencias) {
    await conexion.query(sentencia);
  }
  console.log('  [ok] ' + nombre + ' (' + sentencias.length + ' sentencias)');
};

(async () => {
  const conSeed = process.argv.includes('--seed') ||
    String(process.env.SEED || '').toLowerCase() === 'true';

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
      multipleStatements: true
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

    console.log('Aplicando esquema y migraciones...');
    for (const archivo of ARCHIVOS_BASE) {
      await ejecutarArchivo(conexion, archivo);
    }

    if (conSeed) {
      console.log('Insertando datos de demo (--seed)...');
      for (const archivo of ARCHIVOS_SEED) {
        await ejecutarArchivo(conexion, archivo);
      }
    } else {
      console.log('(Datos de demo omitidos. Usa --seed para insertarlos.)');
    }

    const [tablas] = await conexion.query('SHOW TABLES;');
    console.log(`\nListo. Tablas en "${database}": ${tablas.length}`);
    for (const fila of tablas) {
      console.log('  - ' + Object.values(fila)[0]);
    }
  } catch (err) {
    console.error('Error al ejecutar el SQL:', err.message);
    process.exitCode = 1;
  } finally {
    await conexion.end();
  }
})();

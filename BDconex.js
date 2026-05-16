const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const habilitarSsl = String(process.env.DB_SSL || '').toLowerCase() === 'true';

const construirSsl = () => {
  if (!habilitarSsl) return undefined;

  const caPath = process.env.DB_SSL_CA
    ? path.resolve(process.env.DB_SSL_CA)
    : path.join(__dirname, 'certs', 'mysql-ca.pem');

  const ssl = {
    rejectUnauthorized: String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() === 'true'
  };

  if (fs.existsSync(caPath)) {
    ssl.ca = fs.readFileSync(caPath);
  }

  return ssl;
};

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: construirSsl()
});

const testConnection = async () => {
  const connection = await pool.getConnection();

  try {
    await connection.ping();
    const modo = habilitarSsl ? 'con TLS' : 'sin TLS';
    const puerto = Number(process.env.DB_PORT) || 3306;
    console.log(`Conexion a MySQL verificada correctamente (${modo}) en ${process.env.DB_HOST}:${puerto}.`);
  } finally {
    connection.release();
  }
};

module.exports = {
  pool,
  testConnection,
  sslHabilitado: habilitarSsl
};

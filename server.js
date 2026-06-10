const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const http = require('http');
const https = require('https');

dotenv.config();

const { testConnection } = require('./BDconex');
const logger = require('./Middlewares/logger');
const { asegurarCertificado } = require('./Middlewares/certificados');
const authRoutes = require('./rutas/authRuta');
const estudianteRoutes = require('./rutas/estudianteRuta');
const estudianteTurismRoutes = require('./rutas/estudianteTurismRuta');
const maestroRoutes = require('./rutas/maestroRuta');
const adminRoutes = require('./rutas/adminRuta');
const adminTurismoRoutes = require('./rutas/adminTurismoRuta');
const monitoreoRoutes = require('./rutas/monitoreoRuta');
const monitoreoControlador = require('./controlador/monitoreoControlador');

const app = express();

app.disable('x-powered-by');

// CSP relajada para que el WebView del cliente movil cargue assets via HTTP.
// El `upgrade-insecure-requests` por defecto de helmet rompe los stylesheets
// cuando la app corre en http://localhost o IP de LAN.
const enProduccion = process.env.NODE_ENV === 'production';
app.use(helmet({
  contentSecurityPolicy: enProduccion ? undefined : false,
  hsts: enProduccion ? {
    maxAge: 31536000,
    includeSubDomains: true
  } : false
}));
// Origenes permitidos para CORS. En la nube, la web vive en otro dominio
// (ej. https://bimestmanager.com) y consume esta API en api.bimestmanager.com.
// Define CORS_ORIGINS como lista separada por comas. Si no se define,
// se refleja cualquier origen (comodo para desarrollo local).
const origenesPermitidos = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: origenesPermitidos.length ? origenesPermitidos : true,
  credentials: true
}));
app.use(morgan('combined', { stream: logger.morganStream }));
app.use(morgan('dev'));
// Limite mayor en JSON porque las firmas viajan como dataURL base64 (~50-200 KB)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'vista'));

app.use(express.static(path.join(__dirname, 'public')));

// Firmas digitales: se sirven como recursos estaticos para mostrarse en el UI.
// La carpeta vive fuera de /public para que sea facil rotar/auditar sin tocar el resto.
app.use('/imageFirma', express.static(path.join(__dirname, 'imageFirma')));

// La UI del sistema (login, dashboards) ya NO se sirve desde la API: vive en
// la web (bimestmanager.com). Este host expone solo la API REST + una pagina
// de documentacion en la raiz.
app.get(['/', '/docs'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'api-docs.html'));
});

app.get('/salud', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// Dashboard de monitoreo (vista) + endpoints JSON
app.get('/monitor', monitoreoControlador.verDashboard);
app.use('/monitor', monitoreoRoutes);

app.use('/auth', authRoutes);
app.use('/estudiantes', estudianteRoutes);
app.use('/turismo/estudiantes', estudianteTurismRoutes);
app.use('/turismo/admin', adminTurismoRoutes);
app.use('/maestro', maestroRoutes);
app.use('/admin', adminRoutes);

const RUTAS_API = ['/auth', '/estudiantes', '/turismo', '/maestro', '/admin', '/monitor'];
const esRutaApi = (url) => RUTAS_API.some((prefijo) => url.startsWith(prefijo));

app.use((req, res) => {
  if (esRutaApi(req.originalUrl)) {
    return res.status(404).json({ error: 'Ruta no encontrada.' });
  }

  return res.status(404).send('Ruta no encontrada.');
});

app.use((err, req, res, next) => {
  logger.error('Error no controlado', { url: req.originalUrl, error: err.message, stack: err.stack });

  const status = err.status || 500;
  const message = err.message || 'Error interno del servidor.';

  if (esRutaApi(req.originalUrl)) {
    return res.status(status).json({ error: message });
  }

  return res.status(status).send(message);
});

const arrancarServidor = async () => {
  const PORT = Number(process.env.PORT || 4000);
  const HTTPS_PORT = Number(process.env.HTTPS_PORT || 4443);
  const habilitarHttps = String(process.env.HTTPS_ENABLED || 'true').toLowerCase() === 'true';

  http.createServer(app).listen(PORT, () => {
    logger.info(`HTTP escuchando en http://localhost:${PORT}`);
  });

  if (habilitarHttps) {
    try {
      const { key, cert, generado } = await asegurarCertificado();
      if (generado) {
        logger.warn('Certificado autofirmado generado en certs/. Para producción reemplázalo por uno emitido por CA.');
      }
      https.createServer({ key, cert }, app).listen(HTTPS_PORT, () => {
        logger.info(`HTTPS escuchando en https://localhost:${HTTPS_PORT}`);
      });
    } catch (err) {
      logger.error('No se pudo iniciar HTTPS', { error: err.message });
    }
  }

  try {
    await testConnection();
    logger.info('Conexión a MySQL OK');
  } catch (error) {
    logger.error('No se pudo verificar la conexión con la base de datos', { error: error.message });
  }

  // Si MONITOR_URL + MONITOR_TOKEN están en el .env, empieza a empujar
  // métricas al servidor proy (en la red Tailscale)
  monitoreoControlador.iniciarEnvioRemoto();
};

if (require.main === module) {
  arrancarServidor();
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: reason?.message || String(reason) });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
});

module.exports = app;

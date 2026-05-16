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

app.use(helmet({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true
  }
}));
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(morgan('combined', { stream: logger.morganStream }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'vista'));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/salud', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// Vistas auth
app.get('/login', (req, res) => res.render('auth/login'));
app.get('/registro', (req, res) => res.render('auth/registro'));

// Vistas dashboards (la auth real corre client-side via /auth/yo)
app.get('/estudiante', (req, res) => res.render('estudiante'));
app.get('/maestro', (req, res) => res.render('maestro'));
app.get('/admin', (req, res) => res.render('admin'));
app.get('/turismo/estudiante', (req, res) => res.render('turismo/estudiante'));
app.get('/turismo/admin', (req, res) => res.render('turismo/admin'));

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

const path = require('path');
const fs = require('fs');
const winston = require('winston');
require('winston-daily-rotate-file');

const LOG_DIR = path.join(__dirname, '..', 'logs');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const formatoTxt = winston.format.printf(({ timestamp, level, message, ...meta }) => {
  const extras = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level.toUpperCase()}] ${message}${extras}`;
});

const formatoArchivo = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  formatoTxt
);

const formatoConsola = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  formatoTxt
);

const transporteApp = new winston.transports.DailyRotateFile({
  filename: path.join(LOG_DIR, 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '5m',
  maxFiles: '14d',
  level: 'info'
});

const transporteError = new winston.transports.DailyRotateFile({
  filename: path.join(LOG_DIR, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '5m',
  maxFiles: '30d',
  level: 'error'
});

const transporteAcceso = new winston.transports.DailyRotateFile({
  filename: path.join(LOG_DIR, 'access-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '5m',
  maxFiles: '14d',
  level: 'info'
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: formatoArchivo,
  transports: [
    transporteApp,
    transporteError,
    new winston.transports.Console({ format: formatoConsola })
  ]
});

const accessLogger = winston.createLogger({
  level: 'info',
  format: formatoArchivo,
  transports: [transporteAcceso]
});

logger.morganStream = {
  write: (linea) => accessLogger.info(linea.trim())
};

module.exports = logger;

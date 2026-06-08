const path = require('path');
const fs = require('fs');
const winston = require('winston');
const Transport = require('winston-transport');
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

// =========================================================
// TRANSPORTE HTTP — empuja logs al servidor proy (Tailscale)
// =========================================================
class TransporteProy extends Transport {
  constructor(opts = {}) {
    super(opts);
    this.url = opts.url;            // e.g. http://100.115.7.108:3000/api/ingesta/log
    this.origen = opts.origen || 'bimest';
    this.bufer = [];
    this.maxBufer = opts.maxBufer || 50;
    this.intervaloMs = opts.intervaloMs || 5000;
    this.envioEnCurso = false;
    this._timer = setInterval(() => this.flush().catch(() => {}), this.intervaloMs);
    this._timer.unref?.();
  }
  log(info, callback) {
    setImmediate(() => this.emit('logged', info));
    if (!this.url) { callback?.(); return; }
    // Copio sólo los campos serializables
    const { level, message, timestamp, stack, ...meta } = info;
    this.bufer.push({ level, message, timestamp, stack, ...meta });
    if (this.bufer.length >= this.maxBufer) {
      this.flush().catch(() => {});
    }
    callback?.();
  }
  async flush() {
    if (this.envioEnCurso || this.bufer.length === 0) return;
    this.envioEnCurso = true;
    const lote = this.bufer.splice(0, this.maxBufer);
    try {
      // Node 18+ ya tiene fetch global
      const respuesta = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origen: this.origen, entradas: lote }),
        signal: AbortSignal.timeout?.(4000),
      });
      if (!respuesta.ok) {
        // 403 (IP fuera del tailnet) — descartamos para no acumular eternamente
        if (respuesta.status !== 403 && respuesta.status !== 503) {
          this.bufer.unshift(...lote);
        }
      }
    } catch (_err) {
      // Red caída — descartamos para no acumular eternamente (winston ya logra a disco igual)
      // Reinyectamos hasta 200 entradas máximo para no consumir memoria
      if (this.bufer.length + lote.length <= 200) {
        this.bufer.unshift(...lote);
      }
    } finally {
      this.envioEnCurso = false;
    }
  }
}

const transportes = [
  transporteApp,
  transporteError,
  new winston.transports.Console({ format: formatoConsola }),
];

// Sólo activamos el transporte remoto si MONITOR_URL está configurado.
// La autenticación la maneja proy validando la IP de origen (rango Tailscale).
const MONITOR_URL = process.env.MONITOR_URL;          // ej: http://100.115.7.108:3000
if (MONITOR_URL) {
  transportes.push(new TransporteProy({
    url: `${MONITOR_URL.replace(/\/$/, '')}/api/ingesta/log`,
    origen: process.env.MONITOR_ORIGEN || 'bimest',
    level: process.env.MONITOR_LEVEL || 'info',
    handleExceptions: false,
  }));
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: formatoArchivo,
  transports: transportes,
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

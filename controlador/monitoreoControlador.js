const os = require('os');
const si = require('systeminformation');
const { pool } = require('../BDconex');
const logger = require('../Middlewares/logger');

const promedioCargaCpu = () => {
  const cpus = os.cpus();
  let user = 0;
  let nice = 0;
  let sys = 0;
  let idle = 0;
  let irq = 0;

  for (const cpu of cpus) {
    user += cpu.times.user;
    nice += cpu.times.nice;
    sys += cpu.times.sys;
    idle += cpu.times.idle;
    irq += cpu.times.irq;
  }

  const total = user + nice + sys + idle + irq;
  const usado = total - idle;
  return { porcentaje: total === 0 ? 0 : Number(((usado / total) * 100).toFixed(2)), nucleos: cpus.length };
};

const formatearBytes = (bytes) => Number((bytes / 1024 / 1024).toFixed(2));

/**
 * Recolecta una muestra completa de métricas del proceso/host actual.
 * Reutilizada tanto para responder al cliente como para enviarla a proy.
 */
const recolectarMetricas = async () => {
  const totalMem = os.totalmem();
  const libreMem = os.freemem();
  const usadaMem = totalMem - libreMem;
  const cpu = promedioCargaCpu();

  const [disco, redStats, cpuLoad] = await Promise.all([
    si.fsSize().catch(() => []),
    si.networkStats().catch(() => []),
    si.currentLoad().catch(() => null)
  ]);

  const discos = disco.map((d) => ({
    sistema: d.fs,
    tipo: d.type,
    total_gb: Number((d.size / 1024 / 1024 / 1024).toFixed(2)),
    usado_gb: Number((d.used / 1024 / 1024 / 1024).toFixed(2)),
    uso_porcentaje: Number(d.use?.toFixed?.(2) ?? 0)
  }));

  const red = redStats.map((iface) => ({
    interfaz: iface.iface,
    rx_kbps: Number((iface.rx_sec / 1024).toFixed(2)) || 0,
    tx_kbps: Number((iface.tx_sec / 1024).toFixed(2)) || 0,
    rx_total_mb: formatearBytes(iface.rx_bytes),
    tx_total_mb: formatearBytes(iface.tx_bytes)
  }));

  let dbOk = false;
  let dbLatenciaMs = null;
  try {
    const inicio = Date.now();
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    dbLatenciaMs = Date.now() - inicio;
    dbOk = true;
  } catch (err) {
    logger.error('Ping DB falló en /metricas', { error: err.message });
  }

  return {
    timestamp: new Date().toISOString(),
    hostname: os.hostname(),
    uptime_segundos: Math.round(os.uptime()),
    proceso_uptime_segundos: Math.round(process.uptime()),
    cpu: {
      porcentaje_global: cpuLoad ? Number(cpuLoad.currentLoad.toFixed(2)) : cpu.porcentaje,
      porcentaje_usuario: cpuLoad ? Number(cpuLoad.currentLoadUser.toFixed(2)) : null,
      porcentaje_sistema: cpuLoad ? Number(cpuLoad.currentLoadSystem.toFixed(2)) : null,
      nucleos: cpu.nucleos,
      load_avg_1min: os.loadavg()[0]
    },
    memoria: {
      total_mb: formatearBytes(totalMem),
      usada_mb: formatearBytes(usadaMem),
      libre_mb: formatearBytes(libreMem),
      uso_porcentaje: Number(((usadaMem / totalMem) * 100).toFixed(2))
    },
    disco: discos,
    red,
    base_datos: {
      ok: dbOk,
      latencia_ms: dbLatenciaMs
    },
    proceso: {
      pid: process.pid,
      version_node: process.version,
      memoria_rss_mb: formatearBytes(process.memoryUsage().rss),
      memoria_heap_mb: formatearBytes(process.memoryUsage().heapUsed)
    }
  };
};

const obtenerMetricas = async (req, res, next) => {
  try {
    const muestra = await recolectarMetricas();
    res.json(muestra);
  } catch (error) {
    next(error);
  }
};

/**
 * Si MONITOR_URL está configurado: redirige al dashboard de proy en la red Tailscale.
 * Caso contrario: muestra el dashboard local como fallback.
 */
const verDashboard = (req, res) => {
  const MONITOR_URL = process.env.MONITOR_URL;
  if (MONITOR_URL && process.env.MONITOR_REDIRECT !== 'false') {
    return res.redirect(MONITOR_URL.replace(/\/$/, ''));
  }
  res.render('monitor');
};

// =========================================================
// Envío periódico de métricas al servidor remoto proy
// =========================================================
let intervaloEnvio = null;

const iniciarEnvioRemoto = () => {
  const MONITOR_URL = process.env.MONITOR_URL;
  const INTERVALO = parseInt(process.env.MONITOR_INTERVAL_MS || '5000', 10);
  const ORIGEN = process.env.MONITOR_ORIGEN || 'bimest';

  if (!MONITOR_URL) {
    logger.info('Envío remoto de métricas DESACTIVADO (falta MONITOR_URL)');
    return null;
  }

  const url = `${MONITOR_URL.replace(/\/$/, '')}/api/ingesta/metricas`;
  logger.info('Envío remoto de métricas ACTIVADO', { url, intervaloMs: INTERVALO, origen: ORIGEN });

  const enviar = async () => {
    try {
      const muestra = await recolectarMetricas();
      const respuesta = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origen: ORIGEN, ...muestra }),
        signal: AbortSignal.timeout?.(4000),
      });
      if (!respuesta.ok) {
        logger.warn('proy rechazó la métrica', { status: respuesta.status });
      }
    } catch (err) {
      // No spam: sólo registra si está activado el debug
      if (process.env.MONITOR_DEBUG === 'true') {
        logger.warn('No se pudo enviar métrica a proy', { error: err.message });
      }
    }
  };

  // Una inmediata + setInterval
  enviar();
  intervaloEnvio = setInterval(enviar, INTERVALO);
  intervaloEnvio.unref?.();
  return intervaloEnvio;
};

const detenerEnvioRemoto = () => {
  if (intervaloEnvio) {
    clearInterval(intervaloEnvio);
    intervaloEnvio = null;
  }
};

module.exports = {
  obtenerMetricas,
  verDashboard,
  recolectarMetricas,
  iniciarEnvioRemoto,
  detenerEnvioRemoto,
};

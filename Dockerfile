# ============================================================
# BimestManager - Imagen para despliegue en la nube (Coolify)
# ============================================================
# Multi-stage: 'deps' compila modulos nativos (bcrypt) y luego
# copiamos solo lo necesario a una imagen final mas liviana.
# ============================================================

# ---------- Etapa 1: dependencias ----------
FROM node:20-bookworm-slim AS deps

# Herramientas para compilar modulos nativos (bcrypt usa node-gyp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiamos manifiestos primero para aprovechar la cache de capas
COPY package.json package-lock.json ./

# Instalacion reproducible solo con dependencias de produccion
RUN npm ci --omit=dev

# ---------- Etapa 2: imagen final ----------
FROM node:20-bookworm-slim AS runner

# curl: necesario para el HEALTHCHECK contra /salud
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
# En la nube NO usamos el HTTPS autofirmado del codigo: Traefik (Coolify)
# termina TLS con Let's Encrypt y reenvia el trafico a este puerto HTTP.
ENV HTTPS_ENABLED=false
ENV PORT=4000

WORKDIR /app

# node_modules ya compilado desde la etapa 'deps'
COPY --from=deps /app/node_modules ./node_modules

# Codigo de la aplicacion
COPY . .

# Directorios que la app escribe en runtime (logs y firmas digitales).
# En Coolify conviene montar estos como volumenes persistentes.
RUN mkdir -p logs imageFirma certs \
    && chown -R node:node /app

# Corremos como usuario sin privilegios
USER node

EXPOSE 4000

# Coolify tambien puede definir su propio healthcheck; este sirve de respaldo.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:${PORT}/salud || exit 1

CMD ["node", "server.js"]

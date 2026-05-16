const jwt = require('jsonwebtoken');
const UsuarioModelo = require('../modelo/usuarioModelo');

const TOKEN_COOKIE_NAME = 'bimest_token';
const AUTH_COOKIE_MAX_AGE_MS = Number(process.env.AUTH_COOKIE_MAX_AGE_MS || 2 * 60 * 60 * 1000);

const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  MAESTRO: 'MAESTRO',
  ALUMNO: 'ALUMNO'
});

const FUENTES = Object.freeze({
  QUIMICA: 'QUIMICA',
  TURISMO: 'TURISMO'
});

const REDIRECT_POR_ROL = Object.freeze({
  [`${FUENTES.QUIMICA}:${ROLES.ADMIN}`]: '/admin',
  [`${FUENTES.QUIMICA}:${ROLES.MAESTRO}`]: '/maestro',
  [`${FUENTES.QUIMICA}:${ROLES.ALUMNO}`]: '/estudiante',
  [`${FUENTES.TURISMO}:${ROLES.ADMIN}`]: '/turismo/admin',
  [`${FUENTES.TURISMO}:${ROLES.ALUMNO}`]: '/turismo/estudiante'
});

const obtenerRedirectPorRol = (rol, fuente = FUENTES.QUIMICA) =>
  REDIRECT_POR_ROL[`${fuente}:${rol}`] || '/';

const esAdmin = (usuario) => Boolean(usuario) && usuario.rol === ROLES.ADMIN;
const esMaestro = (usuario) => Boolean(usuario) && usuario.rol === ROLES.MAESTRO;
const esAlumno = (usuario) => Boolean(usuario) && usuario.rol === ROLES.ALUMNO;
const esFuenteTurismo = (usuario) => Boolean(usuario) && usuario.fuente === FUENTES.TURISMO;
const esFuenteQuimica = (usuario) =>
  Boolean(usuario) && (usuario.fuente === FUENTES.QUIMICA || !usuario.fuente);

const buildCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/'
});

const extraerToken = (req) => {
  const tokenCookie = req.cookies && req.cookies[TOKEN_COOKIE_NAME];

  if (tokenCookie) {
    return tokenCookie;
  }

  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
};

const limpiarCookieSesion = (res) => {
  res.clearCookie(TOKEN_COOKIE_NAME, buildCookieOptions());
};

const firmarToken = (usuario) => jwt.sign(
  {
    id: usuario.id,
    rol: usuario.rol,
    fuente: usuario.fuente || FUENTES.QUIMICA
  },
  process.env.JWT_SECRET,
  {
    expiresIn: process.env.JWT_EXPIRES_IN || '2h'
  }
);

const guardarCookieSesion = (res, token) => {
  res.cookie(TOKEN_COOKIE_NAME, token, {
    ...buildCookieOptions(),
    maxAge: AUTH_COOKIE_MAX_AGE_MS
  });
};

const autenticar = (req, res, next) => {
  const token = extraerToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Debes iniciar sesion.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = payload;
    return next();
  } catch (error) {
    limpiarCookieSesion(res);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'La sesion expiro. Inicia sesion de nuevo.' });
    }

    return res.status(401).json({ error: 'Sesion invalida.' });
  }
};

const cargarUsuarioActual = async (req, res, next) => {
  try {
    const fuente = req.auth.fuente || FUENTES.QUIMICA;
    const usuario = await UsuarioModelo.obtenerResumenPorIdGlobal(req.auth.id, fuente);

    if (!usuario) {
      limpiarCookieSesion(res);
      return res.status(401).json({ error: 'El usuario ya no existe.' });
    }

    if (!usuario.is_active) {
      limpiarCookieSesion(res);
      return res.status(403).json({ error: 'Tu cuenta no esta autorizada para entrar.' });
    }

    req.usuario = usuario;
    return next();
  } catch (error) {
    return next(error);
  }
};

const autorizarRoles = (...rolesPermitidos) => (req, res, next) => {
  if (!req.usuario) {
    return res.status(401).json({ error: 'No hay usuario autenticado.' });
  }

  if (!rolesPermitidos.includes(req.usuario.rol)) {
    return res.status(403).json({ error: 'No tienes permisos para esta accion.' });
  }

  return next();
};

const autorizarFuentes = (...fuentesPermitidas) => (req, res, next) => {
  if (!req.usuario) {
    return res.status(401).json({ error: 'No hay usuario autenticado.' });
  }

  const fuenteUsuario = req.usuario.fuente || FUENTES.QUIMICA;

  if (!fuentesPermitidas.includes(fuenteUsuario)) {
    return res.status(403).json({ error: 'No tienes acceso a este modulo.' });
  }

  return next();
};

const protegerRol = (...rolesPermitidos) => [
  autenticar,
  cargarUsuarioActual,
  autorizarRoles(...rolesPermitidos)
];

const protegerRolFuente = (fuente, ...rolesPermitidos) => [
  autenticar,
  cargarUsuarioActual,
  autorizarFuentes(fuente),
  autorizarRoles(...rolesPermitidos)
];

const soloAdmin = protegerRolFuente(FUENTES.QUIMICA, ROLES.ADMIN);
const soloMaestro = protegerRolFuente(FUENTES.QUIMICA, ROLES.MAESTRO);
const soloAlumno = protegerRolFuente(FUENTES.QUIMICA, ROLES.ALUMNO);
const adminOMaestro = protegerRolFuente(FUENTES.QUIMICA, ROLES.ADMIN, ROLES.MAESTRO);

const soloAdminTurismo = protegerRolFuente(FUENTES.TURISMO, ROLES.ADMIN);
const soloAlumnoTurismo = protegerRolFuente(FUENTES.TURISMO, ROLES.ALUMNO);

module.exports = {
  TOKEN_COOKIE_NAME,
  ROLES,
  FUENTES,
  autenticar,
  autorizarRoles,
  autorizarFuentes,
  cargarUsuarioActual,
  firmarToken,
  guardarCookieSesion,
  limpiarCookieSesion,
  obtenerRedirectPorRol,
  esAdmin,
  esMaestro,
  esAlumno,
  esFuenteTurismo,
  esFuenteQuimica,
  protegerRol,
  protegerRolFuente,
  soloAdmin,
  soloMaestro,
  soloAlumno,
  adminOMaestro,
  soloAdminTurismo,
  soloAlumnoTurismo
};

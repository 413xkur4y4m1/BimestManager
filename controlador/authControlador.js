const bcrypt = require('bcrypt');
const UsuarioModelo = require('../modelo/usuarioModelo');
const EstudianteModelo = require('../modelo/estudianteModelo');
const EstudianteTurismModelo = require('../modelo/estudianteTurismModelo');
const {
  firmarToken,
  guardarCookieSesion,
  limpiarCookieSesion,
  obtenerRedirectPorRol,
  FUENTES
} = require('../Middlewares/auth');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizarEmail = (email) => String(email || '').trim().toLowerCase();
const limpiarTexto = (texto) => String(texto || '').trim();

const authControlador = {
  registrarAlumno: async (req, res) => {
    try {
      const nombre = limpiarTexto(req.body.nombre);
      const email = normalizarEmail(req.body.email);
      const password = String(req.body.password || '');

      if (!nombre || !email || !password) {
        return res.status(400).json({ error: 'Nombre, email y password son obligatorios.' });
      }

      if (nombre.length < 3) {
        return res.status(400).json({ error: 'El nombre debe tener al menos 3 caracteres.' });
      }

      if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: 'El email no tiene un formato valido.' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'La password debe tener al menos 8 caracteres.' });
      }

      const usuarioExistente = await UsuarioModelo.obtenerPorEmailGlobal(email);

      if (usuarioExistente) {
        return res.status(409).json({ error: 'Ya existe una cuenta registrada con ese email.' });
      }

      const estudianteId = await EstudianteModelo.crearRegistroPendiente({
        nombre,
        email,
        password
      });

      return res.status(201).json({
        message: 'Registro completado. Tu cuenta queda pendiente de autorizacion por un maestro.',
        id: estudianteId
      });
    } catch (error) {
      console.error('Error al registrar alumno:', error);
      return res.status(500).json({ error: 'No se pudo completar el registro.' });
    }
  },

  registrarAlumnoTurismo: async (req, res) => {
    try {
      const nombre = limpiarTexto(req.body.nombre);
      const email = normalizarEmail(req.body.email);
      const password = String(req.body.password || '');
      const grupo = limpiarTexto(req.body.grupo) || null;

      if (!nombre || !email || !password) {
        return res.status(400).json({ error: 'Nombre, email y password son obligatorios.' });
      }

      if (nombre.length < 3) {
        return res.status(400).json({ error: 'El nombre debe tener al menos 3 caracteres.' });
      }

      if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: 'El email no tiene un formato valido.' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'La password debe tener al menos 8 caracteres.' });
      }

      if (grupo && grupo.length > 50) {
        return res.status(400).json({ error: 'El grupo no puede exceder 50 caracteres.' });
      }

      const usuarioExistente = await UsuarioModelo.obtenerPorEmailGlobal(email);

      if (usuarioExistente) {
        return res.status(409).json({ error: 'Ya existe una cuenta registrada con ese email.' });
      }

      const estudianteId = await EstudianteTurismModelo.crearRegistroPendiente({
        nombre,
        email,
        password,
        grupo
      });

      return res.status(201).json({
        message: 'Registro completado. Tu cuenta queda pendiente de autorizacion por un administrador.',
        id: estudianteId
      });
    } catch (error) {
      console.error('Error al registrar alumno turismo:', error);
      return res.status(500).json({ error: 'No se pudo completar el registro.' });
    }
  },

  login: async (req, res) => {
    try {
      const email = normalizarEmail(req.body.email);
      const password = String(req.body.password || '');

      if (!email || !password) {
        return res.status(400).json({ error: 'Email y password son obligatorios.' });
      }

      const usuario = await UsuarioModelo.obtenerPorEmailGlobal(email);

      if (!usuario) {
        return res.status(401).json({ error: 'Credenciales invalidas.' });
      }

      const passwordValida = await bcrypt.compare(password, usuario.password);

      if (!passwordValida) {
        return res.status(401).json({ error: 'Credenciales invalidas.' });
      }

      if (!usuario.is_active) {
        const mensajeAutorizador = usuario.fuente === FUENTES.TURISMO
          ? 'Tu cuenta aun no ha sido autorizada por un administrador.'
          : 'Tu cuenta aun no ha sido autorizada por un maestro.';

        return res.status(403).json({ error: mensajeAutorizador });
      }

      const token = firmarToken(usuario);
      guardarCookieSesion(res, token);

      const datosUsuario = {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        fuente: usuario.fuente
      };

      if (usuario.fuente === FUENTES.TURISMO) {
        datosUsuario.grupo = usuario.grupo;
      } else {
        datosUsuario.grupo_id = usuario.grupo_id;
      }

      return res.json({
        message: 'Inicio de sesion correcto.',
        redirectTo: obtenerRedirectPorRol(usuario.rol, usuario.fuente),
        usuario: datosUsuario
      });
    } catch (error) {
      console.error('Error en login:', error);
      return res.status(500).json({ error: 'No se pudo iniciar sesion.' });
    }
  },

  logout: async (req, res) => {
    limpiarCookieSesion(res);
    return res.json({ message: 'Sesion cerrada correctamente.' });
  },

  yo: async (req, res) => res.json({ usuario: req.usuario })
};

module.exports = authControlador;

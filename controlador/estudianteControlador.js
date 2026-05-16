const EstudianteModelo = require('../modelo/estudianteModelo');

const responderError = (res, error, fallbackMessage) => {
  if (error.status) {
    return res.status(error.status).json({
      error: error.message,
      code: error.code || 'DOMAIN_ERROR'
    });
  }

  console.error(fallbackMessage, error);
  return res.status(500).json({ error: fallbackMessage });
};

const estudianteControlador = {
  obtenerMiPanel: async (req, res) => {
    try {
      const perfil = await EstudianteModelo.obtenerPerfilPrivado(req.usuario.id);

      if (!perfil) {
        return res.status(404).json({ error: 'No se encontro el perfil del estudiante.' });
      }

      const [adeudos, notificaciones, sesionActiva] = await Promise.all([
        EstudianteModelo.obtenerAdeudos(req.usuario.id),
        EstudianteModelo.obtenerNotificaciones(req.usuario.id),
        perfil.grupo_id ? EstudianteModelo.obtenerSesionActivaPorGrupo(perfil.grupo_id) : Promise.resolve(null)
      ]);

      const equipoActual = sesionActiva
        ? await EstudianteModelo.obtenerEquipoDelAlumnoEnSesion(req.usuario.id, sesionActiva.id)
        : null;

      return res.json({
        usuario: perfil,
        adeudos,
        notificaciones,
        sesionActiva,
        equipoActual
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo cargar el panel del estudiante.');
    }
  },

  crearEquipo: async (req, res) => {
    try {
      const nombre = String(req.body.nombre || '').trim();

      if (nombre.length > 50) {
        return res.status(400).json({ error: 'El nombre del equipo no puede exceder 50 caracteres.' });
      }

      const equipo = await EstudianteModelo.crearEquipoEnSesionActiva({
        usuarioId: req.usuario.id,
        nombreEquipo: nombre
      });

      return res.status(201).json({
        message: 'Equipo creado correctamente.',
        equipo
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo crear el equipo.');
    }
  },

  unirseAEquipo: async (req, res) => {
    try {
      const equipoId = Number(req.params.id);

      if (!Number.isInteger(equipoId) || equipoId <= 0) {
        return res.status(400).json({ error: 'El id del equipo debe ser un entero positivo.' });
      }

      const equipo = await EstudianteModelo.unirseAEquipoEnSesionActiva({
        usuarioId: req.usuario.id,
        equipoId
      });

      return res.json({
        message: 'Te uniste al equipo correctamente.',
        equipo
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo completar la union al equipo.');
    }
  },

  listarPendientes: async (req, res) => {
    try {
      const estudiantes = await EstudianteModelo.listarPendientesActivacion();
      return res.json(estudiantes);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar los alumnos pendientes.');
    }
  },

  asignarGrupo: async (req, res) => {
    try {
      const { id } = req.params;
      const grupoId = Number(req.body.grupo_id);

      if (!Number.isInteger(grupoId) || grupoId <= 0) {
        return res.status(400).json({ error: 'grupo_id debe ser un entero positivo.' });
      }

      const resultado = await EstudianteModelo.asignarGrupoPorId(id, grupoId);

      return res.json({
        message: 'Grupo asignado correctamente.',
        estudiante: resultado
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo asignar el grupo al alumno.');
    }
  },

  activarEstudiante: async (req, res) => {
    try {
      const { id } = req.params;
      const grupoIdRaw = req.body.grupo_id;
      const grupoId = grupoIdRaw === undefined || grupoIdRaw === null || grupoIdRaw === ''
        ? null
        : Number(grupoIdRaw);

      if (grupoId !== null && (!Number.isInteger(grupoId) || grupoId <= 0)) {
        return res.status(400).json({ error: 'grupo_id debe ser un entero positivo.' });
      }

      const resultado = await EstudianteModelo.activarEstudiantePorId(id, grupoId);

      return res.json({
        message: 'Alumno autorizado correctamente.',
        estudiante: resultado
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo autorizar al alumno.');
    }
  }
};

module.exports = estudianteControlador;

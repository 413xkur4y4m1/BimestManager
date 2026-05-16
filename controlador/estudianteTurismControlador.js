const EstudianteTurismModelo = require('../modelo/estudianteTurismModelo');

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

const aEnteroPositivo = (valor) => {
  const num = Number(valor);
  return Number.isInteger(num) && num > 0 ? num : null;
};

const limpiarTexto = (texto) => String(texto || '').trim();

const estudianteTurismControlador = {
  obtenerMiPanel: async (req, res) => {
    try {
      const perfil = await EstudianteTurismModelo.obtenerPerfilPrivado(req.usuario.id);

      if (!perfil) {
        return res.status(404).json({ error: 'No se encontro el perfil del estudiante.' });
      }

      const [notificaciones, sesionActiva, misPrestamos, misAdeudos] = await Promise.all([
        EstudianteTurismModelo.obtenerNotificaciones(req.usuario.id),
        perfil.grupo
          ? EstudianteTurismModelo.obtenerSesionActivaPorGrupo(perfil.grupo)
          : Promise.resolve(null),
        EstudianteTurismModelo.obtenerMisPrestamos(req.usuario.id),
        EstudianteTurismModelo.obtenerMisAdeudos(req.usuario.id)
      ]);

      const materialesSugeridos = sesionActiva
        ? await EstudianteTurismModelo.listarMaterialesSugeridosPractica(sesionActiva.practica_id)
        : [];

      const materialesDisponibles = sesionActiva
        ? await EstudianteTurismModelo.listarMaterialesDisponibles()
        : [];

      return res.json({
        usuario: perfil,
        notificaciones,
        sesionActiva,
        materialesSugeridos,
        materialesDisponibles,
        misPrestamos,
        misAdeudos
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo cargar el panel del estudiante de turismo.');
    }
  },

  listarMisPrestamos: async (req, res) => {
    try {
      const sesionId = req.query.sesion_id !== undefined
        ? aEnteroPositivo(req.query.sesion_id)
        : null;

      if (req.query.sesion_id !== undefined && sesionId === null) {
        return res.status(400).json({ error: 'sesion_id debe ser un entero positivo.' });
      }

      const estado = req.query.estado || null;

      const prestamos = await EstudianteTurismModelo.obtenerMisPrestamos(
        req.usuario.id,
        { sesionId, estado }
      );

      return res.json(prestamos);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar tus prestamos.');
    }
  },

  listarMisAdeudos: async (req, res) => {
    try {
      const adeudos = await EstudianteTurismModelo.obtenerMisAdeudos(req.usuario.id);
      return res.json(adeudos);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar tus adeudos.');
    }
  },

  listarMisNotificaciones: async (req, res) => {
    try {
      const notificaciones = await EstudianteTurismModelo.obtenerNotificaciones(req.usuario.id);
      return res.json(notificaciones);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar tus notificaciones.');
    }
  },

  marcarNotificacionLeida: async (req, res) => {
    try {
      const notificacionId = aEnteroPositivo(req.params.id);

      if (notificacionId === null) {
        return res.status(400).json({ error: 'El id de la notificacion debe ser un entero positivo.' });
      }

      const resultado = await EstudianteTurismModelo.marcarNotificacionLeida({
        usuarioId: req.usuario.id,
        notificacionId
      });

      return res.json({
        message: 'Notificacion marcada como leida.',
        notificacion: resultado
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo marcar la notificacion.');
    }
  },

  obtenerSesionActiva: async (req, res) => {
    try {
      const perfil = await EstudianteTurismModelo.obtenerPerfilPrivado(req.usuario.id);

      if (!perfil) {
        return res.status(404).json({ error: 'No se encontro el perfil del estudiante.' });
      }

      if (!perfil.grupo) {
        return res.json({ sesionActiva: null });
      }

      const sesionActiva = await EstudianteTurismModelo.obtenerSesionActivaPorGrupo(perfil.grupo);

      return res.json({ sesionActiva });
    } catch (error) {
      return responderError(res, error, 'No se pudo obtener la sesion activa.');
    }
  },

  listarMisSesiones: async (req, res) => {
    try {
      const perfil = await EstudianteTurismModelo.obtenerPerfilPrivado(req.usuario.id);

      if (!perfil) {
        return res.status(404).json({ error: 'No se encontro el perfil del estudiante.' });
      }

      if (!perfil.grupo) {
        return res.json([]);
      }

      const sesiones = await EstudianteTurismModelo.listarSesionesPorGrupo(perfil.grupo);
      return res.json(sesiones);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar las sesiones.');
    }
  },

  listarMaterialesDisponibles: async (req, res) => {
    try {
      const materiales = await EstudianteTurismModelo.listarMaterialesDisponibles();
      return res.json(materiales);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar los materiales disponibles.');
    }
  },

  listarSugerenciasPractica: async (req, res) => {
    try {
      const practicaId = aEnteroPositivo(req.params.practicaId);

      if (practicaId === null) {
        return res.status(400).json({ error: 'El id de la practica debe ser un entero positivo.' });
      }

      const sugerencias = await EstudianteTurismModelo.listarMaterialesSugeridosPractica(practicaId);
      return res.json(sugerencias);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar las sugerencias de la practica.');
    }
  },

  solicitarPrestamo: async (req, res) => {
    try {
      const sesionId = aEnteroPositivo(req.body.sesion_id);
      const materialId = aEnteroPositivo(req.body.material_id);
      const cantidad = aEnteroPositivo(req.body.cantidad);

      if (sesionId === null) {
        return res.status(400).json({ error: 'sesion_id debe ser un entero positivo.' });
      }

      if (materialId === null) {
        return res.status(400).json({ error: 'material_id debe ser un entero positivo.' });
      }

      if (cantidad === null) {
        return res.status(400).json({ error: 'cantidad debe ser un entero positivo.' });
      }

      const prestamo = await EstudianteTurismModelo.solicitarPrestamo({
        usuarioId: req.usuario.id,
        sesionId,
        materialId,
        cantidad
      });

      return res.status(201).json({
        message: 'Prestamo registrado correctamente.',
        prestamo
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo registrar el prestamo.');
    }
  },

  devolverPrestamo: async (req, res) => {
    try {
      const prestamoId = aEnteroPositivo(req.params.id);

      if (prestamoId === null) {
        return res.status(400).json({ error: 'El id del prestamo debe ser un entero positivo.' });
      }

      const resultado = await EstudianteTurismModelo.devolverPrestamo({
        usuarioId: req.usuario.id,
        prestamoId
      });

      return res.json({
        message: 'Prestamo devuelto correctamente.',
        prestamo: resultado
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo registrar la devolucion.');
    }
  },

  reportarIncidencia: async (req, res) => {
    try {
      const prestamoId = aEnteroPositivo(req.params.id);
      const tipo = limpiarTexto(req.body.tipo).toUpperCase();
      const descripcion = req.body.descripcion === undefined || req.body.descripcion === null
        ? null
        : limpiarTexto(req.body.descripcion) || null;

      if (prestamoId === null) {
        return res.status(400).json({ error: 'El id del prestamo debe ser un entero positivo.' });
      }

      if (!tipo) {
        return res.status(400).json({ error: 'El tipo de incidencia es obligatorio.' });
      }

      if (descripcion !== null && descripcion.length > 1000) {
        return res.status(400).json({ error: 'La descripcion no puede exceder 1000 caracteres.' });
      }

      const incidencia = await EstudianteTurismModelo.reportarIncidencia({
        usuarioId: req.usuario.id,
        prestamoId,
        tipo,
        descripcion
      });

      return res.status(201).json({
        message: 'Incidencia reportada correctamente.',
        incidencia
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo reportar la incidencia.');
    }
  },

  listarPendientes: async (req, res) => {
    try {
      const estudiantes = await EstudianteTurismModelo.listarPendientesActivacion();
      return res.json(estudiantes);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar los alumnos pendientes.');
    }
  },

  asignarGrupo: async (req, res) => {
    try {
      const estudianteId = aEnteroPositivo(req.params.id);
      const grupo = limpiarTexto(req.body.grupo);

      if (estudianteId === null) {
        return res.status(400).json({ error: 'El id del estudiante debe ser un entero positivo.' });
      }

      if (!grupo) {
        return res.status(400).json({ error: 'El grupo es obligatorio.' });
      }

      const resultado = await EstudianteTurismModelo.asignarGrupoPorId(estudianteId, grupo);

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
      const estudianteId = aEnteroPositivo(req.params.id);
      const grupoRaw = req.body.grupo;
      const grupo = grupoRaw === undefined || grupoRaw === null || grupoRaw === ''
        ? null
        : limpiarTexto(grupoRaw) || null;

      if (estudianteId === null) {
        return res.status(400).json({ error: 'El id del estudiante debe ser un entero positivo.' });
      }

      const resultado = await EstudianteTurismModelo.activarEstudiantePorId(estudianteId, grupo);

      return res.json({
        message: 'Alumno autorizado correctamente.',
        estudiante: resultado
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo autorizar al alumno.');
    }
  }
};

module.exports = estudianteTurismControlador;

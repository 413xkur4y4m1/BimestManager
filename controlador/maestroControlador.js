const MaestroModelo = require('../modelo/maestroModelo');

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

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

const parsearIdPositivo = (valor) => {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
};

const esFechaIsoValida = (valor) => {
  if (!FECHA_REGEX.test(valor)) {
    return false;
  }

  const fecha = new Date(`${valor}T00:00:00Z`);

  if (Number.isNaN(fecha.getTime())) {
    return false;
  }

  return fecha.toISOString().slice(0, 10) === valor;
};

const normalizarHora = (valor) => {
  if (valor === undefined || valor === null || valor === '') {
    return { ok: true, valor: null };
  }

  const texto = String(valor).trim();

  if (!HORA_REGEX.test(texto)) {
    return { ok: false };
  }

  return { ok: true, valor: texto.length === 5 ? `${texto}:00` : texto };
};

const parsearEnteroOpcional = (valor, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) => {
  if (valor === undefined || valor === null || valor === '') {
    return { ok: true, valor: null };
  }

  const numero = Number(valor);

  if (!Number.isInteger(numero) || numero < min || numero > max) {
    return { ok: false };
  }

  return { ok: true, valor: numero };
};

const maestroControlador = {
  obtenerResumen: async (req, res) => {
    try {
      const resumen = await MaestroModelo.obtenerResumen(req.usuario.id);
      return res.json(resumen);
    } catch (error) {
      return responderError(res, error, 'No se pudo cargar el resumen del maestro.');
    }
  },

  listarGrupos: async (req, res) => {
    try {
      const grupos = await MaestroModelo.listarGruposConConteo();
      return res.json(grupos);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar los grupos.');
    }
  },

  crearGrupo: async (req, res) => {
    try {
      const grupo = await MaestroModelo.crearGrupo(req.body.nombre);
      return res.status(201).json({
        message: 'Grupo creado correctamente.',
        grupo
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo crear el grupo.');
    }
  },

  listarAlumnosActivos: async (req, res) => {
    try {
      const grupoId = req.query.grupo_id ? parsearIdPositivo(req.query.grupo_id) : null;

      if (req.query.grupo_id && !grupoId) {
        return res.status(400).json({ error: 'grupo_id debe ser un entero positivo.' });
      }

      const alumnos = await MaestroModelo.listarAlumnosActivos(grupoId);
      return res.json(alumnos);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar los alumnos.');
    }
  },

  listarAlumnosPorGrupo: async (req, res) => {
    try {
      const grupoId = parsearIdPositivo(req.params.id);

      if (!grupoId) {
        return res.status(400).json({ error: 'El id del grupo debe ser un entero positivo.' });
      }

      const resultado = await MaestroModelo.listarAlumnosPorGrupo(grupoId);
      return res.json(resultado);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar los alumnos del grupo.');
    }
  },

  listarPracticas: async (req, res) => {
    try {
      const tipo = req.query.tipo ? String(req.query.tipo).toUpperCase() : null;
      const practicas = await MaestroModelo.listarPracticas(tipo);
      return res.json(practicas);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar las practicas.');
    }
  },

  listarMisSesiones: async (req, res) => {
    try {
      const estado = req.query.estado ? String(req.query.estado).toUpperCase() : null;
      const sesiones = await MaestroModelo.listarMisSesiones(req.usuario.id, estado);
      return res.json(sesiones);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar tus sesiones.');
    }
  },

  obtenerDetalleSesion: async (req, res) => {
    try {
      const sesionId = parsearIdPositivo(req.params.id);

      if (!sesionId) {
        return res.status(400).json({ error: 'El id de la sesion debe ser un entero positivo.' });
      }

      const detalle = await MaestroModelo.obtenerDetalleSesion(sesionId, req.usuario.id);
      return res.json(detalle);
    } catch (error) {
      return responderError(res, error, 'No se pudo cargar el detalle de la sesion.');
    }
  },

  crearSesion: async (req, res) => {
    try {
      const practicaId = parsearIdPositivo(req.body.practica_id);
      const grupoId = parsearIdPositivo(req.body.grupo_id);

      if (!practicaId) {
        return res.status(400).json({ error: 'practica_id debe ser un entero positivo.' });
      }

      if (!grupoId) {
        return res.status(400).json({ error: 'grupo_id debe ser un entero positivo.' });
      }

      const fecha = String(req.body.fecha || '').trim();

      if (!esFechaIsoValida(fecha)) {
        return res.status(400).json({ error: 'fecha debe tener formato YYYY-MM-DD.' });
      }

      const hora = normalizarHora(req.body.hora_inicio);

      if (!hora.ok) {
        return res.status(400).json({ error: 'hora_inicio debe tener formato HH:MM o HH:MM:SS.' });
      }

      const duracion = parsearEnteroOpcional(req.body.duracion_min, { min: 1, max: 1440 });

      if (!duracion.ok) {
        return res.status(400).json({ error: 'duracion_min debe ser un entero entre 1 y 1440.' });
      }

      const numEquipos = parsearEnteroOpcional(req.body.num_equipos, { min: 1, max: 100 });

      if (!numEquipos.ok) {
        return res.status(400).json({ error: 'num_equipos debe ser un entero entre 1 y 100.' });
      }

      const integrantesPorEquipo = parsearEnteroOpcional(req.body.integrantes_por_equipo, { min: 1, max: 50 });

      if (!integrantesPorEquipo.ok) {
        return res.status(400).json({ error: 'integrantes_por_equipo debe ser un entero entre 1 y 50.' });
      }

      const sesion = await MaestroModelo.crearSesion({
        maestroId: req.usuario.id,
        practicaId,
        grupoId,
        fecha,
        horaInicio: hora.valor,
        duracionMin: duracion.valor,
        numEquipos: numEquipos.valor,
        integrantesPorEquipo: integrantesPorEquipo.valor
      });

      return res.status(201).json({
        message: 'Sesion programada correctamente. Se notifico a los alumnos del grupo.',
        sesion
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo crear la sesion.');
    }
  },

  listarAlumnosDeSesion: async (req, res) => {
    try {
      const sesionId = parsearIdPositivo(req.params.id);

      if (!sesionId) {
        return res.status(400).json({ error: 'El id de la sesion debe ser un entero positivo.' });
      }

      const alumnos = await MaestroModelo.listarAlumnosDeSesion(sesionId, req.usuario.id);
      return res.json(alumnos);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar los alumnos de la sesion.');
    }
  },

  crearEquipoEnSesion: async (req, res) => {
    try {
      const sesionId = parsearIdPositivo(req.params.id);

      if (!sesionId) {
        return res.status(400).json({ error: 'El id de la sesion debe ser un entero positivo.' });
      }

      const integranteIds = Array.isArray(req.body.integrantes) ? req.body.integrantes : [];

      if (!integranteIds.length) {
        return res.status(400).json({ error: 'integrantes debe ser un arreglo con al menos un id.' });
      }

      const equipo = await MaestroModelo.crearEquipoEnSesion({
        sesionId,
        maestroId: req.usuario.id,
        nombre: req.body.nombre,
        integranteIds
      });

      return res.status(201).json({
        message: 'Equipo creado correctamente.',
        equipo
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo crear el equipo.');
    }
  },

  eliminarEquipoDeSesion: async (req, res) => {
    try {
      const equipoId = parsearIdPositivo(req.params.id);

      if (!equipoId) {
        return res.status(400).json({ error: 'El id del equipo debe ser un entero positivo.' });
      }

      const resultado = await MaestroModelo.eliminarEquipoDeSesion({
        equipoId,
        maestroId: req.usuario.id
      });

      return res.json({
        message: 'Equipo eliminado correctamente.',
        equipo: resultado
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo eliminar el equipo.');
    }
  },

  listarTodosLosEquipos: async (req, res) => {
    try {
      const incluirFinalizadas = req.query.incluir_finalizadas === 'true' || req.query.incluir_finalizadas === '1';
      const equipos = await MaestroModelo.listarTodosLosEquipos(req.usuario.id, { incluirFinalizadas });
      return res.json(equipos);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar los equipos.');
    }
  },

  listarMaterialesActivos: async (req, res) => {
    try {
      const materiales = await MaestroModelo.listarMaterialesActivos();
      return res.json(materiales);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar los materiales.');
    }
  },

  listarIncidenciasDeSesion: async (req, res) => {
    try {
      const sesionId = parsearIdPositivo(req.params.id);

      if (!sesionId) {
        return res.status(400).json({ error: 'El id de la sesion debe ser un entero positivo.' });
      }

      const incidencias = await MaestroModelo.listarIncidenciasDeSesion(sesionId, req.usuario.id);
      return res.json(incidencias);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar las incidencias de la sesion.');
    }
  },

  registrarIncidencia: async (req, res) => {
    try {
      const sesionId = parsearIdPositivo(req.params.id);

      if (!sesionId) {
        return res.status(400).json({ error: 'El id de la sesion debe ser un entero positivo.' });
      }

      const equipoId = parsearIdPositivo(req.body.equipo_id);
      const materialId = parsearIdPositivo(req.body.material_id);

      if (!equipoId) {
        return res.status(400).json({ error: 'equipo_id debe ser un entero positivo.' });
      }
      if (!materialId) {
        return res.status(400).json({ error: 'material_id debe ser un entero positivo.' });
      }

      const tipo = String(req.body.tipo || '').trim().toUpperCase();
      const responsableRaw = req.body.responsable_usuario_id;
      const responsableUsuarioId = responsableRaw === undefined || responsableRaw === null || responsableRaw === ''
        ? null
        : parsearIdPositivo(responsableRaw);

      if (responsableRaw && !responsableUsuarioId) {
        return res.status(400).json({ error: 'responsable_usuario_id debe ser un entero positivo.' });
      }

      const generarAdeudo = req.body.generar_adeudo === true
        || req.body.generar_adeudo === 'true'
        || req.body.generar_adeudo === 1
        || req.body.generar_adeudo === '1';

      const incidencia = await MaestroModelo.registrarIncidencia({
        sesionId,
        maestroId: req.usuario.id,
        equipoId,
        materialId,
        tipo,
        descripcion: req.body.descripcion,
        responsableUsuarioId,
        generarAdeudo
      });

      return res.status(201).json({
        message: generarAdeudo
          ? 'Incidencia registrada y adeudo generado.'
          : 'Incidencia registrada.',
        incidencia
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo registrar la incidencia.');
    }
  },

  cambiarEstadoSesion: async (req, res) => {
    try {
      const sesionId = parsearIdPositivo(req.params.id);

      if (!sesionId) {
        return res.status(400).json({ error: 'El id de la sesion debe ser un entero positivo.' });
      }

      const nuevoEstado = req.body.estado ? String(req.body.estado).toUpperCase() : '';

      if (!nuevoEstado) {
        return res.status(400).json({ error: 'estado es obligatorio.' });
      }

      const resultado = await MaestroModelo.cambiarEstadoSesion({
        sesionId,
        maestroId: req.usuario.id,
        nuevoEstado
      });

      return res.json({
        message: `La sesion paso de ${resultado.estado_anterior} a ${resultado.estado}.`,
        sesion: resultado
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo actualizar el estado de la sesion.');
    }
  }
};

module.exports = maestroControlador;

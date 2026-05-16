const { pool } = require('../BDconex');

const ESTADOS_SESION = ['PROGRAMADA', 'EN_CURSO', 'FINALIZADA'];
const TIPOS_PRACTICA = ['QUIMICA', 'TURISMO'];
const TIPOS_INCIDENCIA = ['ROTO', 'PERDIDO'];

const TRANSICIONES_PERMITIDAS = {
  PROGRAMADA: ['EN_CURSO', 'FINALIZADA'],
  EN_CURSO: ['FINALIZADA'],
  FINALIZADA: []
};

const crearErrorDominio = (status, message, code) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

const MaestroModelo = {
  ESTADOS_SESION,
  TIPOS_PRACTICA,
  TIPOS_INCIDENCIA,

  listarTodosLosEquipos: async (maestroId, { incluirFinalizadas = false } = {}) => {
    const params = [maestroId];
    let filtroSesion = "AND s.estado <> 'FINALIZADA'";
    if (incluirFinalizadas) filtroSesion = '';

    const [equipos] = await pool.query(
      `
        SELECT
          e.id, e.nombre,
          e.sesion_id,
          s.fecha, s.hora_inicio, s.estado AS sesion_estado,
          p.nombre AS practica,
          g.nombre AS grupo
        FROM equipos e
        INNER JOIN sesiones s ON s.id = e.sesion_id
        INNER JOIN practicas p ON p.id = s.practica_id
        INNER JOIN grupos g ON g.id = s.grupo_id
        WHERE s.maestro_id = ?
          ${filtroSesion}
        ORDER BY s.fecha DESC, s.hora_inicio DESC, s.id DESC, e.id ASC
      `,
      params
    );

    if (!equipos.length) return [];

    const equipoIds = equipos.map((e) => e.id);
    const placeholders = equipoIds.map(() => '?').join(',');

    const [integrantes] = await pool.query(
      `
        SELECT ei.equipo_id, u.id, u.nombre, u.email
        FROM equipo_integrantes ei
        INNER JOIN usuarios u ON u.id = ei.usuario_id
        WHERE ei.equipo_id IN (${placeholders})
        ORDER BY u.nombre ASC
      `,
      equipoIds
    );

    const [conteoIncidencias] = await pool.query(
      `
        SELECT equipo_id, COUNT(*) AS total
        FROM incidencias
        WHERE equipo_id IN (${placeholders})
        GROUP BY equipo_id
      `,
      equipoIds
    );

    const integrantesPorEquipo = integrantes.reduce((acc, fila) => {
      if (!acc[fila.equipo_id]) acc[fila.equipo_id] = [];
      acc[fila.equipo_id].push({ id: fila.id, nombre: fila.nombre, email: fila.email });
      return acc;
    }, {});

    const incidenciasPorEquipo = conteoIncidencias.reduce((acc, fila) => {
      acc[fila.equipo_id] = Number(fila.total);
      return acc;
    }, {});

    return equipos.map((eq) => ({
      ...eq,
      integrantes: integrantesPorEquipo[eq.id] || [],
      incidencias_total: incidenciasPorEquipo[eq.id] || 0
    }));
  },

  listarMaterialesActivos: async () => {
    const [rows] = await pool.query(
      `
        SELECT id, nombre, stock
        FROM materiales
        WHERE is_active = TRUE
        ORDER BY nombre ASC
      `
    );
    return rows;
  },

  listarIncidenciasDeSesion: async (sesionId, maestroId) => {
    const [sesiones] = await pool.query(
      `SELECT id, maestro_id FROM sesiones WHERE id = ? LIMIT 1`,
      [sesionId]
    );

    if (!sesiones.length) {
      throw crearErrorDominio(404, 'La sesion no existe.', 'SESSION_NOT_FOUND');
    }

    if (sesiones[0].maestro_id !== Number(maestroId)) {
      throw crearErrorDominio(403, 'Esa sesion pertenece a otro maestro.', 'SESSION_NOT_OWNED');
    }

    const [rows] = await pool.query(
      `
        SELECT
          i.id, i.sesion_id, i.equipo_id, e.nombre AS equipo,
          i.material_id, m.nombre AS material,
          i.tipo, i.descripcion,
          i.responsable_usuario_id, u.nombre AS responsable, u.email AS responsable_email,
          i.created_at,
          a.id AS adeudo_id, a.estado AS adeudo_estado
        FROM incidencias i
        INNER JOIN materiales m ON m.id = i.material_id
        LEFT JOIN equipos e ON e.id = i.equipo_id
        LEFT JOIN usuarios u ON u.id = i.responsable_usuario_id
        LEFT JOIN adeudos a ON a.incidencia_id = i.id
        WHERE i.sesion_id = ?
        ORDER BY i.created_at DESC, i.id DESC
      `,
      [sesionId]
    );

    return rows;
  },

  registrarIncidencia: async ({
    sesionId,
    maestroId,
    equipoId,
    materialId,
    tipo,
    descripcion,
    responsableUsuarioId,
    generarAdeudo
  }) => {
    if (!TIPOS_INCIDENCIA.includes(tipo)) {
      throw crearErrorDominio(
        400,
        `Tipo de incidencia invalido. Permitidos: ${TIPOS_INCIDENCIA.join(', ')}.`,
        'INCIDENT_TYPE_INVALID'
      );
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [sesiones] = await connection.query(
        `
          SELECT id, maestro_id, grupo_id, estado
          FROM sesiones
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [sesionId]
      );

      if (!sesiones.length) {
        throw crearErrorDominio(404, 'La sesion no existe.', 'SESSION_NOT_FOUND');
      }

      const sesion = sesiones[0];

      if (sesion.maestro_id !== Number(maestroId)) {
        throw crearErrorDominio(403, 'Esa sesion pertenece a otro maestro.', 'SESSION_NOT_OWNED');
      }

      const [equipos] = await connection.query(
        `SELECT id, nombre, sesion_id FROM equipos WHERE id = ? LIMIT 1`,
        [equipoId]
      );

      if (!equipos.length || equipos[0].sesion_id !== sesion.id) {
        throw crearErrorDominio(
          404,
          'El equipo no existe o no pertenece a esta sesion.',
          'TEAM_NOT_FOUND'
        );
      }

      const [materiales] = await connection.query(
        `SELECT id, nombre, is_active FROM materiales WHERE id = ? LIMIT 1`,
        [materialId]
      );

      if (!materiales.length) {
        throw crearErrorDominio(404, 'El material no existe.', 'MATERIAL_NOT_FOUND');
      }

      let responsableValido = null;

      if (responsableUsuarioId) {
        const [responsables] = await connection.query(
          `
            SELECT u.id, u.nombre
            FROM equipo_integrantes ei
            INNER JOIN usuarios u ON u.id = ei.usuario_id
            WHERE ei.equipo_id = ? AND ei.usuario_id = ?
            LIMIT 1
          `,
          [equipoId, responsableUsuarioId]
        );

        if (!responsables.length) {
          throw crearErrorDominio(
            409,
            'El responsable indicado no pertenece al equipo.',
            'RESPONSIBLE_NOT_IN_TEAM'
          );
        }

        responsableValido = responsables[0];
      }

      const descripcionLimpia = descripcion === undefined || descripcion === null
        ? null
        : String(descripcion).trim() || null;

      const [incidenciaResult] = await connection.query(
        `
          INSERT INTO incidencias
            (sesion_id, equipo_id, material_id, tipo, descripcion, responsable_usuario_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          sesion.id,
          equipoId,
          materialId,
          tipo,
          descripcionLimpia,
          responsableValido ? responsableValido.id : null
        ]
      );

      const incidenciaId = incidenciaResult.insertId;

      let adeudoId = null;

      if (generarAdeudo) {
        if (!responsableValido) {
          throw crearErrorDominio(
            400,
            'Para generar un adeudo necesitas seleccionar un responsable del equipo.',
            'DEBT_REQUIRES_RESPONSIBLE'
          );
        }

        const [adeudoResult] = await connection.query(
          `
            INSERT INTO adeudos (usuario_id, material_id, incidencia_id, estado)
            VALUES (?, ?, ?, 'PENDIENTE')
          `,
          [responsableValido.id, materialId, incidenciaId]
        );

        adeudoId = adeudoResult.insertId;

        await connection.query(
          `INSERT INTO notificaciones (usuario_id, mensaje) VALUES (?, ?)`,
          [
            responsableValido.id,
            `Se registro un adeudo a tu nombre por ${tipo === 'ROTO' ? 'romper' : 'perder'} ${materiales[0].nombre}.`
          ]
        );
      } else if (responsableValido) {
        await connection.query(
          `INSERT INTO notificaciones (usuario_id, mensaje) VALUES (?, ?)`,
          [
            responsableValido.id,
            `Se registro una incidencia (${tipo}) a tu nombre por ${materiales[0].nombre}.`
          ]
        );
      }

      await connection.commit();

      return {
        id: incidenciaId,
        sesion_id: sesion.id,
        equipo_id: Number(equipoId),
        material_id: Number(materialId),
        material: materiales[0].nombre,
        tipo,
        descripcion: descripcionLimpia,
        responsable_usuario_id: responsableValido ? responsableValido.id : null,
        responsable: responsableValido ? responsableValido.nombre : null,
        adeudo_id: adeudoId
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  obtenerResumen: async (maestroId) => {
    const [[pendientes]] = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM usuarios
        WHERE rol = 'ALUMNO' AND is_active = FALSE
      `
    );

    const [conteoPorEstado] = await pool.query(
      `
        SELECT estado, COUNT(*) AS total
        FROM sesiones
        WHERE maestro_id = ?
        GROUP BY estado
      `,
      [maestroId]
    );

    const sesionesPorEstado = ESTADOS_SESION.reduce((acc, estado) => {
      acc[estado] = 0;
      return acc;
    }, {});

    for (const fila of conteoPorEstado) {
      sesionesPorEstado[fila.estado] = Number(fila.total);
    }

    const [proximaRows] = await pool.query(
      `
        SELECT
          s.id, s.fecha, s.hora_inicio, s.estado,
          p.nombre AS practica, g.nombre AS grupo
        FROM sesiones s
        INNER JOIN practicas p ON p.id = s.practica_id
        INNER JOIN grupos g ON g.id = s.grupo_id
        WHERE s.maestro_id = ?
          AND s.estado <> 'FINALIZADA'
          AND TIMESTAMP(s.fecha, COALESCE(s.hora_inicio, '00:00:00')) >= NOW()
        ORDER BY s.fecha ASC, s.hora_inicio ASC, s.id ASC
        LIMIT 1
      `,
      [maestroId]
    );

    return {
      alumnos_pendientes: Number(pendientes.total),
      sesiones_por_estado: sesionesPorEstado,
      proxima_sesion: proximaRows[0] || null
    };
  },

  listarGruposConConteo: async () => {
    const [rows] = await pool.query(
      `
        SELECT
          g.id,
          g.nombre,
          COUNT(DISTINCT CASE WHEN u.rol = 'ALUMNO' AND u.is_active = TRUE THEN u.id END) AS alumnos_activos,
          COUNT(DISTINCT CASE WHEN u.rol = 'ALUMNO' AND u.is_active = FALSE THEN u.id END) AS alumnos_pendientes
        FROM grupos g
        LEFT JOIN usuarios u ON u.grupo_id = g.id
        GROUP BY g.id, g.nombre
        ORDER BY g.nombre ASC
      `
    );

    return rows.map((fila) => ({
      id: fila.id,
      nombre: fila.nombre,
      alumnos_activos: Number(fila.alumnos_activos),
      alumnos_pendientes: Number(fila.alumnos_pendientes)
    }));
  },

  crearGrupo: async (nombre) => {
    const nombreLimpio = String(nombre || '').trim();

    if (!nombreLimpio) {
      throw crearErrorDominio(400, 'El nombre del grupo es obligatorio.', 'GROUP_NAME_REQUIRED');
    }

    if (nombreLimpio.length > 50) {
      throw crearErrorDominio(400, 'El nombre del grupo no puede exceder 50 caracteres.', 'GROUP_NAME_TOO_LONG');
    }

    const [existentes] = await pool.query(
      `
        SELECT id
        FROM grupos
        WHERE LOWER(nombre) = LOWER(?)
        LIMIT 1
      `,
      [nombreLimpio]
    );

    if (existentes.length) {
      throw crearErrorDominio(409, 'Ya existe un grupo con ese nombre.', 'GROUP_ALREADY_EXISTS');
    }

    const [result] = await pool.query(
      `
        INSERT INTO grupos (nombre)
        VALUES (?)
      `,
      [nombreLimpio]
    );

    return { id: result.insertId, nombre: nombreLimpio };
  },

  listarAlumnosActivos: async (grupoId = null) => {
    const params = [];
    let where = `WHERE u.rol = 'ALUMNO' AND u.is_active = TRUE`;

    if (grupoId !== null) {
      where += ' AND u.grupo_id = ?';
      params.push(grupoId);
    }

    const [rows] = await pool.query(
      `
        SELECT u.id, u.nombre, u.email, u.grupo_id, g.nombre AS grupo, u.is_active
        FROM usuarios u
        LEFT JOIN grupos g ON g.id = u.grupo_id
        ${where}
        ORDER BY u.nombre ASC
      `,
      params
    );

    return rows;
  },

  listarAlumnosPorGrupo: async (grupoId) => {
    const [grupos] = await pool.query(
      `
        SELECT id, nombre
        FROM grupos
        WHERE id = ?
        LIMIT 1
      `,
      [grupoId]
    );

    if (!grupos.length) {
      throw crearErrorDominio(404, 'El grupo indicado no existe.', 'GROUP_NOT_FOUND');
    }

    const [rows] = await pool.query(
      `
        SELECT id, nombre, email, is_active, created_at
        FROM usuarios
        WHERE rol = 'ALUMNO' AND grupo_id = ?
        ORDER BY is_active DESC, nombre ASC
      `,
      [grupoId]
    );

    return {
      grupo: grupos[0],
      alumnos: rows
    };
  },

  listarPracticas: async (tipo = null) => {
    if (tipo !== null && !TIPOS_PRACTICA.includes(tipo)) {
      throw crearErrorDominio(
        400,
        `Tipo de practica invalido. Permitidos: ${TIPOS_PRACTICA.join(', ')}.`,
        'PRACTICE_TYPE_INVALID'
      );
    }

    const params = [];
    let where = '';

    if (tipo !== null) {
      where = 'WHERE tipo = ?';
      params.push(tipo);
    }

    const [rows] = await pool.query(
      `
        SELECT id, nombre, descripcion, tipo, created_at
        FROM practicas
        ${where}
        ORDER BY nombre ASC
      `,
      params
    );

    return rows;
  },

  listarMisSesiones: async (maestroId, estado = null) => {
    if (estado !== null && !ESTADOS_SESION.includes(estado)) {
      throw crearErrorDominio(
        400,
        `Estado de sesion invalido. Permitidos: ${ESTADOS_SESION.join(', ')}.`,
        'SESSION_STATE_INVALID'
      );
    }

    const params = [maestroId];
    let filtroEstado = '';

    if (estado !== null) {
      filtroEstado = 'AND s.estado = ?';
      params.push(estado);
    }

    const [rows] = await pool.query(
      `
        SELECT
          s.id,
          s.practica_id,
          p.nombre AS practica,
          p.tipo AS practica_tipo,
          s.grupo_id,
          g.nombre AS grupo,
          s.fecha,
          s.hora_inicio,
          s.duracion_min,
          s.num_equipos,
          s.integrantes_por_equipo,
          s.estado,
          (
            SELECT COUNT(*) FROM equipos e WHERE e.sesion_id = s.id
          ) AS equipos_creados
        FROM sesiones s
        INNER JOIN practicas p ON p.id = s.practica_id
        INNER JOIN grupos g ON g.id = s.grupo_id
        WHERE s.maestro_id = ?
          ${filtroEstado}
        ORDER BY s.fecha DESC, s.hora_inicio DESC, s.id DESC
      `,
      params
    );

    return rows;
  },

  obtenerDetalleSesion: async (sesionId, maestroId) => {
    const [sesiones] = await pool.query(
      `
        SELECT
          s.id, s.practica_id, s.maestro_id, s.grupo_id,
          s.fecha, s.hora_inicio, s.duracion_min,
          s.num_equipos, s.integrantes_por_equipo, s.estado,
          p.nombre AS practica_nombre,
          p.tipo AS practica_tipo,
          p.descripcion AS practica_descripcion,
          g.nombre AS grupo_nombre
        FROM sesiones s
        INNER JOIN practicas p ON p.id = s.practica_id
        INNER JOIN grupos g ON g.id = s.grupo_id
        WHERE s.id = ?
        LIMIT 1
      `,
      [sesionId]
    );

    if (!sesiones.length) {
      throw crearErrorDominio(404, 'La sesion no existe.', 'SESSION_NOT_FOUND');
    }

    const sesion = sesiones[0];

    if (sesion.maestro_id !== Number(maestroId)) {
      throw crearErrorDominio(403, 'Esa sesion pertenece a otro maestro.', 'SESSION_NOT_OWNED');
    }

    const [equipos] = await pool.query(
      `
        SELECT id, nombre, sesion_id
        FROM equipos
        WHERE sesion_id = ?
        ORDER BY id ASC
      `,
      [sesion.id]
    );

    let integrantesPorEquipo = {};

    if (equipos.length) {
      const equipoIds = equipos.map((e) => e.id);
      const placeholders = equipoIds.map(() => '?').join(',');

      const [integrantes] = await pool.query(
        `
          SELECT ei.equipo_id, u.id, u.nombre, u.email
          FROM equipo_integrantes ei
          INNER JOIN usuarios u ON u.id = ei.usuario_id
          WHERE ei.equipo_id IN (${placeholders})
          ORDER BY u.nombre ASC
        `,
        equipoIds
      );

      integrantesPorEquipo = integrantes.reduce((acc, fila) => {
        if (!acc[fila.equipo_id]) {
          acc[fila.equipo_id] = [];
        }
        acc[fila.equipo_id].push({ id: fila.id, nombre: fila.nombre, email: fila.email });
        return acc;
      }, {});
    }

    return {
      sesion,
      equipos: equipos.map((equipo) => ({
        id: equipo.id,
        nombre: equipo.nombre,
        integrantes: integrantesPorEquipo[equipo.id] || []
      }))
    };
  },

  crearSesion: async ({
    maestroId,
    practicaId,
    grupoId,
    fecha,
    horaInicio,
    duracionMin,
    numEquipos,
    integrantesPorEquipo
  }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [practicas] = await connection.query(
        `SELECT id, nombre FROM practicas WHERE id = ? LIMIT 1`,
        [practicaId]
      );

      if (!practicas.length) {
        throw crearErrorDominio(404, 'La practica indicada no existe.', 'PRACTICE_NOT_FOUND');
      }

      const [grupos] = await connection.query(
        `SELECT id, nombre FROM grupos WHERE id = ? LIMIT 1`,
        [grupoId]
      );

      if (!grupos.length) {
        throw crearErrorDominio(404, 'El grupo indicado no existe.', 'GROUP_NOT_FOUND');
      }

      const [result] = await connection.query(
        `
          INSERT INTO sesiones
            (practica_id, maestro_id, grupo_id, fecha, hora_inicio, duracion_min, num_equipos, integrantes_por_equipo, estado)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PROGRAMADA')
        `,
        [
          practicaId,
          maestroId,
          grupoId,
          fecha,
          horaInicio || null,
          duracionMin || null,
          numEquipos || null,
          integrantesPorEquipo || null
        ]
      );

      const mensaje = `Se programo una nueva sesion de ${practicas[0].nombre} para tu grupo el ${fecha}${horaInicio ? ` a las ${horaInicio}` : ''}.`;

      await connection.query(
        `
          INSERT INTO notificaciones (usuario_id, mensaje)
          SELECT id, ?
          FROM usuarios
          WHERE grupo_id = ? AND rol = 'ALUMNO' AND is_active = TRUE
        `,
        [mensaje, grupoId]
      );

      await connection.commit();

      return {
        id: result.insertId,
        practica_id: Number(practicaId),
        practica: practicas[0].nombre,
        grupo_id: Number(grupoId),
        grupo: grupos[0].nombre,
        fecha,
        hora_inicio: horaInicio || null,
        duracion_min: duracionMin || null,
        num_equipos: numEquipos || null,
        integrantes_por_equipo: integrantesPorEquipo || null,
        estado: 'PROGRAMADA'
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  listarAlumnosDeSesion: async (sesionId, maestroId) => {
    const [sesiones] = await pool.query(
      `
        SELECT id, maestro_id, grupo_id
        FROM sesiones
        WHERE id = ?
        LIMIT 1
      `,
      [sesionId]
    );

    if (!sesiones.length) {
      throw crearErrorDominio(404, 'La sesion no existe.', 'SESSION_NOT_FOUND');
    }

    const sesion = sesiones[0];

    if (sesion.maestro_id !== Number(maestroId)) {
      throw crearErrorDominio(403, 'Esa sesion pertenece a otro maestro.', 'SESSION_NOT_OWNED');
    }

    const [alumnos] = await pool.query(
      `
        SELECT u.id, u.nombre, u.email, u.is_active,
               (
                 SELECT e.nombre
                 FROM equipo_integrantes ei
                 INNER JOIN equipos e ON e.id = ei.equipo_id
                 WHERE ei.usuario_id = u.id AND e.sesion_id = ?
                 LIMIT 1
               ) AS equipo_actual
        FROM usuarios u
        WHERE u.rol = 'ALUMNO'
          AND u.grupo_id = ?
          AND u.is_active = TRUE
        ORDER BY u.nombre ASC
      `,
      [sesion.id, sesion.grupo_id]
    );

    return alumnos;
  },

  crearEquipoEnSesion: async ({ sesionId, maestroId, nombre, integranteIds }) => {
    const idsLimpios = Array.isArray(integranteIds)
      ? Array.from(new Set(integranteIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)))
      : [];

    if (!idsLimpios.length) {
      throw crearErrorDominio(
        400,
        'Selecciona al menos un alumno para el equipo.',
        'TEAM_MEMBERS_REQUIRED'
      );
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [sesiones] = await connection.query(
        `
          SELECT id, maestro_id, grupo_id, num_equipos, integrantes_por_equipo, estado
          FROM sesiones
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [sesionId]
      );

      if (!sesiones.length) {
        throw crearErrorDominio(404, 'La sesion no existe.', 'SESSION_NOT_FOUND');
      }

      const sesion = sesiones[0];

      if (sesion.maestro_id !== Number(maestroId)) {
        throw crearErrorDominio(403, 'Esa sesion pertenece a otro maestro.', 'SESSION_NOT_OWNED');
      }

      if (sesion.estado === 'FINALIZADA') {
        throw crearErrorDominio(
          409,
          'No puedes formar equipos en una sesion finalizada.',
          'SESSION_FINISHED'
        );
      }

      if (sesion.integrantes_por_equipo !== null && idsLimpios.length > sesion.integrantes_por_equipo) {
        throw crearErrorDominio(
          409,
          `Esta sesion permite un maximo de ${sesion.integrantes_por_equipo} integrantes por equipo.`,
          'TEAM_TOO_LARGE'
        );
      }

      const [conteoEquipos] = await connection.query(
        `SELECT COUNT(*) AS total FROM equipos WHERE sesion_id = ?`,
        [sesion.id]
      );

      const totalEquipos = Number(conteoEquipos[0].total);

      if (sesion.num_equipos !== null && totalEquipos >= sesion.num_equipos) {
        throw crearErrorDominio(
          409,
          'La sesion ya alcanzo el numero maximo de equipos.',
          'TEAM_LIMIT_REACHED'
        );
      }

      const placeholders = idsLimpios.map(() => '?').join(',');

      const [alumnos] = await connection.query(
        `
          SELECT id, nombre, grupo_id, is_active
          FROM usuarios
          WHERE id IN (${placeholders})
            AND rol = 'ALUMNO'
        `,
        idsLimpios
      );

      if (alumnos.length !== idsLimpios.length) {
        throw crearErrorDominio(
          404,
          'Alguno de los alumnos seleccionados no existe.',
          'STUDENT_NOT_FOUND'
        );
      }

      const fueraDelGrupo = alumnos.find((a) => a.grupo_id !== sesion.grupo_id);

      if (fueraDelGrupo) {
        throw crearErrorDominio(
          409,
          `${fueraDelGrupo.nombre} no pertenece al grupo de la sesion.`,
          'STUDENT_NOT_IN_GROUP'
        );
      }

      const inactivo = alumnos.find((a) => !a.is_active);

      if (inactivo) {
        throw crearErrorDominio(
          409,
          `${inactivo.nombre} aun no esta autorizado.`,
          'STUDENT_INACTIVE'
        );
      }

      const [duplicados] = await connection.query(
        `
          SELECT u.id, u.nombre, e.nombre AS equipo
          FROM equipo_integrantes ei
          INNER JOIN equipos e ON e.id = ei.equipo_id
          INNER JOIN usuarios u ON u.id = ei.usuario_id
          WHERE e.sesion_id = ?
            AND ei.usuario_id IN (${placeholders})
        `,
        [sesion.id, ...idsLimpios]
      );

      if (duplicados.length) {
        const nombres = duplicados.map((d) => `${d.nombre} (en ${d.equipo})`).join(', ');
        throw crearErrorDominio(
          409,
          `Estos alumnos ya estan en otro equipo de esta sesion: ${nombres}.`,
          'STUDENT_ALREADY_IN_TEAM'
        );
      }

      const nombreLimpio = String(nombre || '').trim() || `Equipo ${totalEquipos + 1}`;

      const [equiposExistentes] = await connection.query(
        `
          SELECT id
          FROM equipos
          WHERE sesion_id = ? AND LOWER(nombre) = LOWER(?)
          LIMIT 1
        `,
        [sesion.id, nombreLimpio]
      );

      if (equiposExistentes.length) {
        throw crearErrorDominio(
          409,
          'Ya existe un equipo con ese nombre en la sesion.',
          'TEAM_NAME_ALREADY_EXISTS'
        );
      }

      const [equipoResult] = await connection.query(
        `INSERT INTO equipos (sesion_id, nombre) VALUES (?, ?)`,
        [sesion.id, nombreLimpio]
      );

      const equipoId = equipoResult.insertId;

      const valuesPlaceholders = idsLimpios.map(() => '(?, ?)').join(', ');
      const valuesParams = idsLimpios.flatMap((id) => [equipoId, id]);

      await connection.query(
        `INSERT INTO equipo_integrantes (equipo_id, usuario_id) VALUES ${valuesPlaceholders}`,
        valuesParams
      );

      await connection.query(
        `INSERT INTO responsivas (sesion_id, equipo_id, estado) VALUES (?, ?, 'ACTIVA')`,
        [sesion.id, equipoId]
      );

      const mensaje = `Fuiste asignado al equipo ${nombreLimpio} para la sesion del laboratorio.`;
      const notifPlaceholders = idsLimpios.map(() => '(?, ?)').join(', ');
      const notifParams = idsLimpios.flatMap((id) => [id, mensaje]);

      await connection.query(
        `INSERT INTO notificaciones (usuario_id, mensaje) VALUES ${notifPlaceholders}`,
        notifParams
      );

      await connection.commit();

      return {
        id: equipoId,
        sesion_id: sesion.id,
        nombre: nombreLimpio,
        integrantes: alumnos.map((a) => ({ id: a.id, nombre: a.nombre }))
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  eliminarEquipoDeSesion: async ({ equipoId, maestroId }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [equipos] = await connection.query(
        `
          SELECT e.id, e.nombre, e.sesion_id, s.maestro_id, s.estado
          FROM equipos e
          INNER JOIN sesiones s ON s.id = e.sesion_id
          WHERE e.id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [equipoId]
      );

      if (!equipos.length) {
        throw crearErrorDominio(404, 'El equipo no existe.', 'TEAM_NOT_FOUND');
      }

      const equipo = equipos[0];

      if (equipo.maestro_id !== Number(maestroId)) {
        throw crearErrorDominio(403, 'Ese equipo pertenece a otra sesion.', 'TEAM_NOT_OWNED');
      }

      if (equipo.estado === 'FINALIZADA') {
        throw crearErrorDominio(
          409,
          'No puedes borrar equipos de una sesion finalizada.',
          'SESSION_FINISHED'
        );
      }

      await connection.query(`DELETE FROM responsivas WHERE equipo_id = ?`, [equipoId]);
      await connection.query(`DELETE FROM equipos WHERE id = ?`, [equipoId]);

      await connection.commit();

      return { id: Number(equipoId) };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  cambiarEstadoSesion: async ({ sesionId, maestroId, nuevoEstado }) => {
    if (!ESTADOS_SESION.includes(nuevoEstado)) {
      throw crearErrorDominio(
        400,
        `Estado de sesion invalido. Permitidos: ${ESTADOS_SESION.join(', ')}.`,
        'SESSION_STATE_INVALID'
      );
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [sesiones] = await connection.query(
        `
          SELECT id, maestro_id, grupo_id, estado, practica_id
          FROM sesiones
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [sesionId]
      );

      if (!sesiones.length) {
        throw crearErrorDominio(404, 'La sesion no existe.', 'SESSION_NOT_FOUND');
      }

      const sesion = sesiones[0];

      if (sesion.maestro_id !== Number(maestroId)) {
        throw crearErrorDominio(403, 'Esa sesion pertenece a otro maestro.', 'SESSION_NOT_OWNED');
      }

      if (sesion.estado === nuevoEstado) {
        throw crearErrorDominio(
          409,
          `La sesion ya esta en estado ${nuevoEstado}.`,
          'SESSION_STATE_UNCHANGED'
        );
      }

      const transicionesValidas = TRANSICIONES_PERMITIDAS[sesion.estado];

      if (!transicionesValidas.includes(nuevoEstado)) {
        throw crearErrorDominio(
          409,
          `No se puede pasar de ${sesion.estado} a ${nuevoEstado}.`,
          'SESSION_STATE_INVALID_TRANSITION'
        );
      }

      await connection.query(
        `
          UPDATE sesiones
          SET estado = ?
          WHERE id = ?
        `,
        [nuevoEstado, sesionId]
      );

      const mensaje = nuevoEstado === 'EN_CURSO'
        ? 'Tu sesion de laboratorio comenzo. Ya puedes formar tu equipo.'
        : nuevoEstado === 'FINALIZADA'
          ? 'Tu sesion de laboratorio fue finalizada.'
          : `El estado de tu sesion cambio a ${nuevoEstado}.`;

      await connection.query(
        `
          INSERT INTO notificaciones (usuario_id, mensaje)
          SELECT id, ?
          FROM usuarios
          WHERE grupo_id = ? AND rol = 'ALUMNO' AND is_active = TRUE
        `,
        [mensaje, sesion.grupo_id]
      );

      await connection.commit();

      return {
        id: Number(sesionId),
        estado_anterior: sesion.estado,
        estado: nuevoEstado
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
};

module.exports = MaestroModelo;

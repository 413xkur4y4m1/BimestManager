const bcrypt = require('bcrypt');
const { pool } = require('../BDconex');

const PASSWORD_SALT_ROUNDS = 10;

const crearErrorDominio = (status, message, code) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

const EstudianteModelo = {
  crearRegistroPendiente: async ({ nombre, email, password }) => {
    const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

    const [result] = await pool.query(
      `
        INSERT INTO usuarios (nombre, email, password, rol, is_active)
        VALUES (?, ?, ?, 'ALUMNO', FALSE)
      `,
      [nombre, email, passwordHash]
    );

    return result.insertId;
  },

  obtenerPerfilPrivado: async (usuarioId) => {
    const [rows] = await pool.query(
      `
        SELECT u.id, u.nombre, u.email, u.rol, u.grupo_id, u.is_active, g.nombre AS grupo
        FROM usuarios u
        LEFT JOIN grupos g ON g.id = u.grupo_id
        WHERE u.id = ? AND u.rol = 'ALUMNO'
        LIMIT 1
      `,
      [usuarioId]
    );

    return rows[0] || null;
  },

  obtenerAdeudos: async (usuarioId) => {
    const [rows] = await pool.query(
      `
        SELECT a.id, m.nombre AS material, a.estado, a.created_at
        FROM adeudos a
        INNER JOIN materiales m ON m.id = a.material_id
        WHERE a.usuario_id = ?
        ORDER BY a.created_at DESC
      `,
      [usuarioId]
    );

    return rows;
  },

  obtenerNotificaciones: async (usuarioId) => {
    const [rows] = await pool.query(
      `
        SELECT id, mensaje, leido, created_at
        FROM notificaciones
        WHERE usuario_id = ?
        ORDER BY created_at DESC
      `,
      [usuarioId]
    );

    return rows;
  },

  obtenerSesionActivaPorGrupo: async (grupoId) => {
    const [rows] = await pool.query(
      `
        SELECT
          s.id,
          s.practica_id,
          p.nombre AS practica,
          s.grupo_id,
          g.nombre AS grupo,
          s.fecha,
          s.hora_inicio,
          s.duracion_min,
          s.num_equipos,
          s.integrantes_por_equipo,
          s.estado,
          (
            SELECT COUNT(*)
            FROM equipos e
            WHERE e.sesion_id = s.id
          ) AS equipos_creados,
          CASE
            WHEN s.num_equipos IS NULL THEN NULL
            ELSE GREATEST(
              s.num_equipos - (
                SELECT COUNT(*)
                FROM equipos e
                WHERE e.sesion_id = s.id
              ),
              0
            )
          END AS cupos_restantes
        FROM sesiones s
        INNER JOIN practicas p ON p.id = s.practica_id
        INNER JOIN grupos g ON g.id = s.grupo_id
        WHERE s.grupo_id = ?
          AND s.estado <> 'FINALIZADA'
          AND (
            s.estado = 'EN_CURSO'
            OR s.fecha = CURDATE()
          )
        ORDER BY (s.estado = 'EN_CURSO') DESC, s.fecha DESC, s.hora_inicio DESC, s.id DESC
        LIMIT 1
      `,
      [grupoId]
    );

    return rows[0] || null;
  },

  obtenerEquipoDelAlumnoEnSesion: async (usuarioId, sesionId) => {
    const [equipos] = await pool.query(
      `
        SELECT
          e.id,
          e.nombre,
          e.sesion_id,
          COUNT(ei2.id) AS integrantes_actuales
        FROM equipo_integrantes ei
        INNER JOIN equipos e ON e.id = ei.equipo_id
        LEFT JOIN equipo_integrantes ei2 ON ei2.equipo_id = e.id
        WHERE ei.usuario_id = ?
          AND e.sesion_id = ?
        GROUP BY e.id, e.nombre, e.sesion_id
        LIMIT 1
      `,
      [usuarioId, sesionId]
    );

    if (!equipos.length) {
      return null;
    }

    const equipo = equipos[0];
    const [integrantes] = await pool.query(
      `
        SELECT u.id, u.nombre, u.email
        FROM equipo_integrantes ei
        INNER JOIN usuarios u ON u.id = ei.usuario_id
        WHERE ei.equipo_id = ?
        ORDER BY u.nombre ASC
      `,
      [equipo.id]
    );

    return {
      ...equipo,
      integrantes
    };
  },

  listarEquiposDisponiblesEnSesion: async (sesionId, integrantesPorEquipo = null) => {
    const [rows] = await pool.query(
      `
        SELECT
          e.id,
          e.nombre,
          e.sesion_id,
          COUNT(ei.id) AS integrantes_actuales
        FROM equipos e
        LEFT JOIN equipo_integrantes ei ON ei.equipo_id = e.id
        WHERE e.sesion_id = ?
        GROUP BY e.id, e.nombre, e.sesion_id
        ORDER BY e.id ASC
      `,
      [sesionId]
    );

    return rows.map((equipo) => {
      const integrantesActuales = Number(equipo.integrantes_actuales);
      const cuposDisponibles = integrantesPorEquipo === null
        ? null
        : Math.max(integrantesPorEquipo - integrantesActuales, 0);

      return {
        ...equipo,
        integrantes_actuales: integrantesActuales,
        cupos_disponibles: cuposDisponibles,
        lleno: integrantesPorEquipo === null ? false : integrantesActuales >= integrantesPorEquipo
      };
    });
  },

  listarPendientesActivacion: async () => {
    const [rows] = await pool.query(
      `
        SELECT u.id, u.nombre, u.email, u.created_at, g.nombre AS grupo
        FROM usuarios u
        LEFT JOIN grupos g ON g.id = u.grupo_id
        WHERE u.rol = 'ALUMNO'
          AND u.is_active = FALSE
        ORDER BY u.created_at ASC
      `
    );

    return rows;
  },

  asignarGrupoPorId: async (estudianteId, grupoId) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [estudiantes] = await connection.query(
        `
          SELECT id
          FROM usuarios
          WHERE id = ? AND rol = 'ALUMNO'
          LIMIT 1
          FOR UPDATE
        `,
        [estudianteId]
      );

      if (!estudiantes.length) {
        throw crearErrorDominio(404, 'El estudiante no existe.', 'STUDENT_NOT_FOUND');
      }

      const [grupos] = await connection.query(
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

      await connection.query(
        `
          UPDATE usuarios
          SET grupo_id = ?
          WHERE id = ?
        `,
        [grupoId, estudianteId]
      );

      await connection.query(
        `
          INSERT INTO notificaciones (usuario_id, mensaje)
          VALUES (?, ?)
        `,
        [
          estudianteId,
          `Se te asigno al grupo ${grupos[0].nombre}.`
        ]
      );

      await connection.commit();

      return {
        id: Number(estudianteId),
        grupo_id: Number(grupoId),
        grupo: grupos[0].nombre
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  activarEstudiantePorId: async (estudianteId, grupoId = null) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.query(
        `
          SELECT id, is_active
          FROM usuarios
          WHERE id = ? AND rol = 'ALUMNO'
          LIMIT 1
          FOR UPDATE
        `,
        [estudianteId]
      );

      if (!rows.length) {
        throw crearErrorDominio(404, 'El estudiante no existe.', 'STUDENT_NOT_FOUND');
      }

      if (rows[0].is_active) {
        throw crearErrorDominio(409, 'El estudiante ya estaba autorizado.', 'STUDENT_ALREADY_ACTIVE');
      }

      if (grupoId !== null) {
        const [grupos] = await connection.query(
          `
            SELECT id
            FROM grupos
            WHERE id = ?
            LIMIT 1
          `,
          [grupoId]
        );

        if (!grupos.length) {
          throw crearErrorDominio(404, 'El grupo indicado no existe.', 'GROUP_NOT_FOUND');
        }
      }

      await connection.query(
        `
          UPDATE usuarios
          SET is_active = TRUE,
              grupo_id = COALESCE(?, grupo_id)
          WHERE id = ?
        `,
        [grupoId, estudianteId]
      );

      await connection.query(
        `
          INSERT INTO notificaciones (usuario_id, mensaje)
          VALUES (?, ?)
        `,
        [
          estudianteId,
          'Tu cuenta fue autorizada. Ya puedes iniciar sesion en el sistema.'
        ]
      );

      await connection.commit();

      return { id: Number(estudianteId) };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  crearEquipoEnSesionActiva: async ({ usuarioId, nombreEquipo }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [usuarios] = await connection.query(
        `
          SELECT id, grupo_id, is_active
          FROM usuarios
          WHERE id = ? AND rol = 'ALUMNO'
          LIMIT 1
          FOR UPDATE
        `,
        [usuarioId]
      );

      if (!usuarios.length) {
        throw crearErrorDominio(404, 'El alumno no existe.', 'STUDENT_NOT_FOUND');
      }

      const alumno = usuarios[0];

      if (!alumno.is_active) {
        throw crearErrorDominio(403, 'Tu cuenta aun no esta autorizada.', 'STUDENT_INACTIVE');
      }

      if (!alumno.grupo_id) {
        throw crearErrorDominio(
          403,
          'No puedes crear equipos hasta que un maestro te asigne a un grupo.',
          'GROUP_NOT_ASSIGNED'
        );
      }

      const [sesiones] = await connection.query(
        `
          SELECT id, num_equipos, estado
          FROM sesiones
          WHERE grupo_id = ?
            AND estado <> 'FINALIZADA'
            AND (
              estado = 'EN_CURSO'
              OR fecha = CURDATE()
            )
          ORDER BY (estado = 'EN_CURSO') DESC, fecha DESC, hora_inicio DESC, id DESC
          LIMIT 1
          FOR UPDATE
        `,
        [alumno.grupo_id]
      );

      if (!sesiones.length) {
        throw crearErrorDominio(
          403,
          'No hay una sesion activa para tu grupo en este momento.',
          'SESSION_NOT_ACTIVE'
        );
      }

      const sesion = sesiones[0];

      const [equipoActualRows] = await connection.query(
        `
          SELECT e.id, e.nombre
          FROM equipo_integrantes ei
          INNER JOIN equipos e ON e.id = ei.equipo_id
          WHERE ei.usuario_id = ?
            AND e.sesion_id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [usuarioId, sesion.id]
      );

      if (equipoActualRows.length) {
        throw crearErrorDominio(
          409,
          `Ya perteneces al equipo ${equipoActualRows[0].nombre} en esta sesion.`,
          'ALREADY_IN_TEAM'
        );
      }

      const [conteoRows] = await connection.query(
        `
          SELECT COUNT(*) AS total
          FROM equipos
          WHERE sesion_id = ?
        `,
        [sesion.id]
      );

      const totalEquipos = Number(conteoRows[0].total);

      if (sesion.num_equipos !== null && totalEquipos >= sesion.num_equipos) {
        throw crearErrorDominio(
          409,
          'La sesion ya alcanzo el numero maximo de equipos.',
          'TEAM_LIMIT_REACHED'
        );
      }

      const nombreFinal = (nombreEquipo || '').trim() || `Equipo ${totalEquipos + 1}`;

      const [equiposExistentes] = await connection.query(
        `
          SELECT id
          FROM equipos
          WHERE sesion_id = ? AND LOWER(nombre) = LOWER(?)
          LIMIT 1
        `,
        [sesion.id, nombreFinal]
      );

      if (equiposExistentes.length) {
        throw crearErrorDominio(
          409,
          'Ya existe un equipo con ese nombre en la sesion activa.',
          'TEAM_NAME_ALREADY_EXISTS'
        );
      }

      const [equipoResult] = await connection.query(
        `
          INSERT INTO equipos (sesion_id, nombre)
          VALUES (?, ?)
        `,
        [sesion.id, nombreFinal]
      );

      await connection.query(
        `
          INSERT INTO equipo_integrantes (equipo_id, usuario_id)
          VALUES (?, ?)
        `,
        [equipoResult.insertId, usuarioId]
      );

      await connection.query(
        `
          INSERT INTO responsivas (sesion_id, equipo_id, estado)
          VALUES (?, ?, 'ACTIVA')
        `,
        [sesion.id, equipoResult.insertId]
      );

      await connection.commit();

      return {
        id: equipoResult.insertId,
        nombre: nombreFinal,
        sesion_id: sesion.id,
        integrantes_actuales: 1,
        total_equipos: totalEquipos + 1,
        cupos_restantes:
          sesion.num_equipos === null ? null : Math.max(sesion.num_equipos - (totalEquipos + 1), 0)
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  unirseAEquipoEnSesionActiva: async ({ usuarioId, equipoId }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [usuarios] = await connection.query(
        `
          SELECT id, grupo_id, is_active
          FROM usuarios
          WHERE id = ? AND rol = 'ALUMNO'
          LIMIT 1
          FOR UPDATE
        `,
        [usuarioId]
      );

      if (!usuarios.length) {
        throw crearErrorDominio(404, 'El alumno no existe.', 'STUDENT_NOT_FOUND');
      }

      const alumno = usuarios[0];

      if (!alumno.is_active) {
        throw crearErrorDominio(403, 'Tu cuenta aun no esta autorizada.', 'STUDENT_INACTIVE');
      }

      if (!alumno.grupo_id) {
        throw crearErrorDominio(
          403,
          'No puedes unirte a un equipo hasta que un maestro te asigne a un grupo.',
          'GROUP_NOT_ASSIGNED'
        );
      }

      const [sesiones] = await connection.query(
        `
          SELECT id, integrantes_por_equipo, estado
          FROM sesiones
          WHERE grupo_id = ?
            AND estado <> 'FINALIZADA'
            AND (
              estado = 'EN_CURSO'
              OR fecha = CURDATE()
            )
          ORDER BY (estado = 'EN_CURSO') DESC, fecha DESC, hora_inicio DESC, id DESC
          LIMIT 1
          FOR UPDATE
        `,
        [alumno.grupo_id]
      );

      if (!sesiones.length) {
        throw crearErrorDominio(
          403,
          'No hay una sesion activa para tu grupo en este momento.',
          'SESSION_NOT_ACTIVE'
        );
      }

      const sesion = sesiones[0];

      const [equipoActualRows] = await connection.query(
        `
          SELECT e.id, e.nombre
          FROM equipo_integrantes ei
          INNER JOIN equipos e ON e.id = ei.equipo_id
          WHERE ei.usuario_id = ?
            AND e.sesion_id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [usuarioId, sesion.id]
      );

      if (equipoActualRows.length) {
        throw crearErrorDominio(
          409,
          `Ya perteneces al equipo ${equipoActualRows[0].nombre} en esta sesion.`,
          'ALREADY_IN_TEAM'
        );
      }

      const [equipos] = await connection.query(
        `
          SELECT id, nombre, sesion_id
          FROM equipos
          WHERE id = ?
            AND sesion_id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [equipoId, sesion.id]
      );

      if (!equipos.length) {
        throw crearErrorDominio(
          404,
          'El equipo no existe o no pertenece a la sesion activa de tu grupo.',
          'TEAM_NOT_FOUND'
        );
      }

      const equipo = equipos[0];

      const [conteoRows] = await connection.query(
        `
          SELECT COUNT(*) AS total
          FROM equipo_integrantes
          WHERE equipo_id = ?
        `,
        [equipo.id]
      );

      const integrantesActuales = Number(conteoRows[0].total);

      if (sesion.integrantes_por_equipo !== null && integrantesActuales >= sesion.integrantes_por_equipo) {
        throw crearErrorDominio(
          409,
          'Ese equipo ya alcanzo el maximo de integrantes permitidos.',
          'TEAM_FULL'
        );
      }

      await connection.query(
        `
          INSERT INTO equipo_integrantes (equipo_id, usuario_id)
          VALUES (?, ?)
        `,
        [equipo.id, usuarioId]
      );

      await connection.commit();

      return {
        id: equipo.id,
        nombre: equipo.nombre,
        sesion_id: equipo.sesion_id,
        integrantes_actuales: integrantesActuales + 1,
        cupos_disponibles:
          sesion.integrantes_por_equipo === null
            ? null
            : Math.max(sesion.integrantes_por_equipo - (integrantesActuales + 1), 0)
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
};

module.exports = EstudianteModelo;

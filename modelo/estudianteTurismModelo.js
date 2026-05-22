const bcrypt = require('bcrypt');
const { pool } = require('../BDconex');

const PASSWORD_SALT_ROUNDS = 10;

const ESTADOS_PRESTAMO = ['PRESTADO', 'DEVUELTO', 'PENDIENTE', 'ADEUDO'];
const ESTADOS_INCIDENCIA = ['PENDIENTE', 'RESUELTO'];
const TIPOS_INCIDENCIA = ['ROTO', 'PERDIDO'];

const crearErrorDominio = (status, message, code) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

const EstudianteTurismModelo = {
  ESTADOS_PRESTAMO,
  ESTADOS_INCIDENCIA,
  TIPOS_INCIDENCIA,

  crearRegistroPendiente: async ({ nombre, email, password, grupo = null }) => {
    const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    const grupoLimpio = grupo === undefined || grupo === null
      ? null
      : String(grupo).trim() || null;

    const [result] = await pool.query(
      `
        INSERT INTO usuarios_turismo (nombre, email, password, rol, grupo, is_active)
        VALUES (?, ?, ?, 'ALUMNO', ?, FALSE)
      `,
      [nombre, email, passwordHash, grupoLimpio]
    );

    return result.insertId;
  },

  obtenerPorEmail: async (email) => {
    const [rows] = await pool.query(
      `
        SELECT id, nombre, email, password, rol, grupo, is_active
        FROM usuarios_turismo
        WHERE email = ?
        LIMIT 1
      `,
      [email]
    );

    return rows[0] || null;
  },

  obtenerResumenPorId: async (id) => {
    const [rows] = await pool.query(
      `
        SELECT id, nombre, email, rol, grupo, is_active
        FROM usuarios_turismo
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    return rows[0] || null;
  },

  obtenerPerfilPrivado: async (usuarioId) => {
    const [rows] = await pool.query(
      `
        SELECT id, nombre, email, rol, grupo, is_active, created_at
        FROM usuarios_turismo
        WHERE id = ? AND rol = 'ALUMNO'
        LIMIT 1
      `,
      [usuarioId]
    );

    return rows[0] || null;
  },

  obtenerNotificaciones: async (usuarioId) => {
    const [rows] = await pool.query(
      `
        SELECT id, mensaje, leido, created_at
        FROM notificaciones_turismo
        WHERE usuario_id = ?
        ORDER BY created_at DESC
      `,
      [usuarioId]
    );

    return rows;
  },

  obtenerSesionActivaPorGrupo: async (grupo) => {
    if (!grupo) {
      return null;
    }

    const [rows] = await pool.query(
      `
        SELECT
          s.id,
          s.practica_id,
          p.nombre AS practica,
          p.descripcion AS practica_descripcion,
          p.duracion_minutos,
          s.grupo,
          s.fecha_inicio,
          s.fecha_fin,
          s.estado
        FROM sesiones_turismo s
        INNER JOIN practicas_turismo p ON p.id = s.practica_id
        WHERE s.grupo = ?
          AND s.estado <> 'FINALIZADA'
          AND NOW() >= s.fecha_inicio
          AND NOW() <= s.fecha_fin
        ORDER BY s.fecha_inicio DESC, s.id DESC
        LIMIT 1
      `,
      [grupo]
    );

    return rows[0] || null;
  },

  listarSesionesPorGrupo: async (grupo) => {
    if (!grupo) {
      return [];
    }

    const [rows] = await pool.query(
      `
        SELECT
          s.id,
          s.practica_id,
          p.nombre AS practica,
          s.grupo,
          s.fecha_inicio,
          s.fecha_fin,
          s.estado
        FROM sesiones_turismo s
        INNER JOIN practicas_turismo p ON p.id = s.practica_id
        WHERE s.grupo = ?
        ORDER BY s.fecha_inicio DESC, s.id DESC
      `,
      [grupo]
    );

    return rows;
  },

  listarMaterialesSugeridosPractica: async (practicaId) => {
    const [rows] = await pool.query(
      `
        SELECT
          s.id,
          s.material_id,
          m.nombre AS material,
          m.stock,
          m.estado AS material_estado,
          m.is_active AS material_activo,
          s.cantidad_sugerida
        FROM sugerencias_material_turismo s
        INNER JOIN materiales_turismo m ON m.id = s.material_id
        WHERE s.practica_id = ?
        ORDER BY m.nombre ASC
      `,
      [practicaId]
    );

    return rows.map((fila) => ({
      ...fila,
      material_activo: Boolean(fila.material_activo)
    }));
  },

  listarMaterialesDisponibles: async () => {
    const [rows] = await pool.query(
      `
        SELECT id, nombre, stock, estado, is_active
        FROM materiales_turismo
        WHERE is_active = TRUE
          AND estado = 'DISPONIBLE'
          AND stock > 0
        ORDER BY nombre ASC
      `
    );

    return rows.map((fila) => ({
      ...fila,
      is_active: Boolean(fila.is_active)
    }));
  },

  obtenerMisPrestamos: async (usuarioId, { sesionId = null, estado = null } = {}) => {
    if (estado !== null && !ESTADOS_PRESTAMO.includes(estado)) {
      throw crearErrorDominio(
        400,
        `Estado de prestamo invalido. Permitidos: ${ESTADOS_PRESTAMO.join(', ')}.`,
        'LOAN_STATE_INVALID'
      );
    }

    const condiciones = ['p.alumno_id = ?'];
    const params = [usuarioId];

    if (sesionId !== null) {
      condiciones.push('p.sesion_id = ?');
      params.push(sesionId);
    }

    if (estado !== null) {
      condiciones.push('p.estado = ?');
      params.push(estado);
    }

    const [rows] = await pool.query(
      `
        SELECT
          p.id,
          p.sesion_id,
          p.material_id,
          m.nombre AS material,
          p.cantidad,
          p.estado,
          p.fecha_prestamo,
          p.fecha_devolucion,
          ses.practica_id,
          pr.nombre AS practica
        FROM prestamos_material_turismo p
        INNER JOIN materiales_turismo m ON m.id = p.material_id
        INNER JOIN sesiones_turismo ses ON ses.id = p.sesion_id
        INNER JOIN practicas_turismo pr ON pr.id = ses.practica_id
        WHERE ${condiciones.join(' AND ')}
        ORDER BY p.fecha_prestamo DESC, p.id DESC
      `,
      params
    );

    return rows;
  },

  obtenerMisAdeudos: async (usuarioId) => {
    const [rows] = await pool.query(
      `
        SELECT
          p.id AS prestamo_id,
          p.material_id,
          m.nombre AS material,
          p.cantidad,
          p.estado AS prestamo_estado,
          p.fecha_prestamo,
          i.id AS incidencia_id,
          i.tipo AS incidencia_tipo,
          i.descripcion AS incidencia_descripcion,
          i.estado AS incidencia_estado,
          i.created_at AS incidencia_created_at
        FROM prestamos_material_turismo p
        INNER JOIN materiales_turismo m ON m.id = p.material_id
        LEFT JOIN incidencias_turismo i ON i.prestamo_id = p.id
        WHERE p.alumno_id = ?
          AND (
            p.estado IN ('ADEUDO', 'PENDIENTE')
            OR (i.id IS NOT NULL AND i.estado = 'PENDIENTE')
          )
        ORDER BY p.fecha_prestamo DESC, p.id DESC
      `,
      [usuarioId]
    );

    return rows;
  },

  solicitarPrestamo: async ({ usuarioId, sesionId, materialId, cantidad }) => {
    const cantidadNum = Number(cantidad);

    if (!Number.isInteger(cantidadNum) || cantidadNum <= 0) {
      throw crearErrorDominio(
        400,
        'La cantidad debe ser un entero positivo.',
        'LOAN_QUANTITY_INVALID'
      );
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [usuarios] = await connection.query(
        `
          SELECT id, grupo, is_active
          FROM usuarios_turismo
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

      if (!alumno.grupo) {
        throw crearErrorDominio(
          403,
          'No puedes solicitar prestamos hasta que un administrador te asigne a un grupo.',
          'GROUP_NOT_ASSIGNED'
        );
      }

      const [sesiones] = await connection.query(
        `
          SELECT id, grupo, estado, fecha_inicio, fecha_fin
          FROM sesiones_turismo
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

      if (sesion.grupo !== alumno.grupo) {
        throw crearErrorDominio(
          403,
          'Esa sesion no pertenece a tu grupo.',
          'SESSION_NOT_OWNED_BY_GROUP'
        );
      }

      if (sesion.estado === 'FINALIZADA') {
        throw crearErrorDominio(
          409,
          'La sesion ya fue finalizada.',
          'SESSION_FINALIZED'
        );
      }

      const ahora = new Date();
      if (ahora < new Date(sesion.fecha_inicio) || ahora > new Date(sesion.fecha_fin)) {
        throw crearErrorDominio(
          403,
          'La sesion no esta activa en este momento.',
          'SESSION_NOT_ACTIVE'
        );
      }

      const [materiales] = await connection.query(
        `
          SELECT id, nombre, stock, estado, is_active
          FROM materiales_turismo
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [materialId]
      );

      if (!materiales.length) {
        throw crearErrorDominio(404, 'El material no existe.', 'MATERIAL_NOT_FOUND');
      }

      const material = materiales[0];

      if (!material.is_active) {
        throw crearErrorDominio(409, 'El material esta inactivo.', 'MATERIAL_INACTIVE');
      }

      if (material.estado !== 'DISPONIBLE') {
        throw crearErrorDominio(
          409,
          'El material no esta disponible para prestamo.',
          'MATERIAL_NOT_AVAILABLE'
        );
      }

      if (material.stock < cantidadNum) {
        throw crearErrorDominio(
          409,
          `Stock insuficiente. Disponible: ${material.stock}.`,
          'MATERIAL_STOCK_INSUFFICIENT'
        );
      }

      const [duplicados] = await connection.query(
        `
          SELECT id
          FROM prestamos_material_turismo
          WHERE alumno_id = ?
            AND sesion_id = ?
            AND material_id = ?
            AND estado IN ('PRESTADO', 'PENDIENTE')
          LIMIT 1
          FOR UPDATE
        `,
        [usuarioId, sesionId, materialId]
      );

      if (duplicados.length) {
        throw crearErrorDominio(
          409,
          'Ya tienes una solicitud o prestamo activo de ese material en la sesion.',
          'LOAN_ALREADY_ACTIVE'
        );
      }

      // La solicitud queda PENDIENTE; el stock NO se descuenta hasta que el admin la apruebe.
      const [result] = await connection.query(
        `
          INSERT INTO prestamos_material_turismo
            (sesion_id, alumno_id, material_id, cantidad, estado)
          VALUES (?, ?, ?, ?, 'PENDIENTE')
        `,
        [sesionId, usuarioId, materialId, cantidadNum]
      );

      const [alumnoInfo] = await connection.query(
        `SELECT nombre FROM usuarios_turismo WHERE id = ? LIMIT 1`,
        [usuarioId]
      );
      const nombreAlumno = (alumnoInfo[0] && alumnoInfo[0].nombre) || 'Un alumno';

      await connection.query(
        `INSERT INTO notificaciones_turismo (usuario_id, mensaje) VALUES (?, ?)`,
        [
          usuarioId,
          `Tu solicitud de ${cantidadNum} unidad(es) de ${material.nombre} fue enviada y queda en espera de aprobacion del administrador.`
        ]
      );

      // Notificar a todos los admins activos para que vean la solicitud
      await connection.query(
        `
          INSERT INTO notificaciones_turismo (usuario_id, mensaje)
          SELECT id, ?
          FROM usuarios_turismo
          WHERE rol = 'ADMIN' AND is_active = TRUE
        `,
        [`${nombreAlumno} solicito ${cantidadNum} unidad(es) de ${material.nombre}. Requiere aprobacion.`]
      );

      await connection.commit();

      return {
        id: result.insertId,
        sesion_id: Number(sesionId),
        alumno_id: Number(usuarioId),
        material_id: Number(materialId),
        material: material.nombre,
        cantidad: cantidadNum,
        estado: 'PENDIENTE'
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  devolverPrestamo: async ({ usuarioId, prestamoId }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [prestamos] = await connection.query(
        `
          SELECT id, alumno_id, material_id, cantidad, estado
          FROM prestamos_material_turismo
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [prestamoId]
      );

      if (!prestamos.length) {
        throw crearErrorDominio(404, 'El prestamo no existe.', 'LOAN_NOT_FOUND');
      }

      const prestamo = prestamos[0];

      if (prestamo.alumno_id !== Number(usuarioId)) {
        throw crearErrorDominio(403, 'Ese prestamo no es tuyo.', 'LOAN_NOT_OWNED');
      }

      if (prestamo.estado === 'DEVUELTO') {
        throw crearErrorDominio(409, 'El prestamo ya estaba devuelto.', 'LOAN_ALREADY_RETURNED');
      }

      if (prestamo.estado === 'ADEUDO') {
        throw crearErrorDominio(
          409,
          'El prestamo esta marcado como adeudo, contacta al administrador.',
          'LOAN_IN_DEBT'
        );
      }

      await connection.query(
        `
          UPDATE prestamos_material_turismo
          SET estado = 'DEVUELTO', fecha_devolucion = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [prestamoId]
      );

      await connection.query(
        `UPDATE materiales_turismo SET stock = stock + ? WHERE id = ?`,
        [prestamo.cantidad, prestamo.material_id]
      );

      await connection.query(
        `INSERT INTO notificaciones_turismo (usuario_id, mensaje) VALUES (?, ?)`,
        [usuarioId, 'Se registro la devolucion de tu prestamo.']
      );

      await connection.commit();

      return { id: Number(prestamoId), estado: 'DEVUELTO' };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  reportarIncidencia: async ({ usuarioId, prestamoId, tipo, descripcion }) => {
    if (!TIPOS_INCIDENCIA.includes(tipo)) {
      throw crearErrorDominio(
        400,
        `Tipo de incidencia invalido. Permitidos: ${TIPOS_INCIDENCIA.join(', ')}.`,
        'INCIDENT_TYPE_INVALID'
      );
    }

    const descripcionLimpia = descripcion === undefined || descripcion === null
      ? null
      : String(descripcion).trim() || null;

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [prestamos] = await connection.query(
        `
          SELECT id, alumno_id, material_id, estado
          FROM prestamos_material_turismo
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [prestamoId]
      );

      if (!prestamos.length) {
        throw crearErrorDominio(404, 'El prestamo no existe.', 'LOAN_NOT_FOUND');
      }

      const prestamo = prestamos[0];

      if (prestamo.alumno_id !== Number(usuarioId)) {
        throw crearErrorDominio(403, 'Ese prestamo no es tuyo.', 'LOAN_NOT_OWNED');
      }

      const [existentes] = await connection.query(
        `
          SELECT id
          FROM incidencias_turismo
          WHERE prestamo_id = ? AND estado = 'PENDIENTE'
          LIMIT 1
        `,
        [prestamoId]
      );

      if (existentes.length) {
        throw crearErrorDominio(
          409,
          'Ya existe una incidencia pendiente para ese prestamo.',
          'INCIDENT_ALREADY_PENDING'
        );
      }

      const [result] = await connection.query(
        `
          INSERT INTO incidencias_turismo (prestamo_id, descripcion, tipo, estado)
          VALUES (?, ?, ?, 'PENDIENTE')
        `,
        [prestamoId, descripcionLimpia, tipo]
      );

      await connection.query(
        `
          UPDATE prestamos_material_turismo
          SET estado = 'ADEUDO'
          WHERE id = ?
        `,
        [prestamoId]
      );

      await connection.query(
        `INSERT INTO notificaciones_turismo (usuario_id, mensaje) VALUES (?, ?)`,
        [
          usuarioId,
          `Reportaste una incidencia (${tipo}) sobre tu prestamo. Quedo en revision por el administrador.`
        ]
      );

      await connection.commit();

      return {
        id: result.insertId,
        prestamo_id: Number(prestamoId),
        tipo,
        descripcion: descripcionLimpia,
        estado: 'PENDIENTE'
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  marcarNotificacionLeida: async ({ usuarioId, notificacionId }) => {
    const [result] = await pool.query(
      `
        UPDATE notificaciones_turismo
        SET leido = TRUE
        WHERE id = ? AND usuario_id = ? AND leido = FALSE
      `,
      [notificacionId, usuarioId]
    );

    if (!result.affectedRows) {
      throw crearErrorDominio(
        404,
        'La notificacion no existe o ya estaba leida.',
        'NOTIFICATION_NOT_FOUND_OR_READ'
      );
    }

    return { id: Number(notificacionId), leido: true };
  },

  listarPendientesActivacion: async () => {
    const [rows] = await pool.query(
      `
        SELECT id, nombre, email, grupo, created_at
        FROM usuarios_turismo
        WHERE rol = 'ALUMNO'
          AND is_active = FALSE
        ORDER BY created_at ASC
      `
    );

    return rows;
  },

  asignarGrupoPorId: async (estudianteId, grupo) => {
    const grupoLimpio = String(grupo || '').trim();

    if (!grupoLimpio) {
      throw crearErrorDominio(400, 'El grupo es obligatorio.', 'GROUP_REQUIRED');
    }

    if (grupoLimpio.length > 50) {
      throw crearErrorDominio(
        400,
        'El grupo no puede exceder 50 caracteres.',
        'GROUP_NAME_TOO_LONG'
      );
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [estudiantes] = await connection.query(
        `
          SELECT id
          FROM usuarios_turismo
          WHERE id = ? AND rol = 'ALUMNO'
          LIMIT 1
          FOR UPDATE
        `,
        [estudianteId]
      );

      if (!estudiantes.length) {
        throw crearErrorDominio(404, 'El estudiante no existe.', 'STUDENT_NOT_FOUND');
      }

      await connection.query(
        `UPDATE usuarios_turismo SET grupo = ? WHERE id = ?`,
        [grupoLimpio, estudianteId]
      );

      await connection.query(
        `INSERT INTO notificaciones_turismo (usuario_id, mensaje) VALUES (?, ?)`,
        [estudianteId, `Se te asigno al grupo ${grupoLimpio}.`]
      );

      await connection.commit();

      return { id: Number(estudianteId), grupo: grupoLimpio };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  activarEstudiantePorId: async (estudianteId, grupo = null) => {
    const grupoLimpio = grupo === undefined || grupo === null || grupo === ''
      ? null
      : String(grupo).trim() || null;

    if (grupoLimpio !== null && grupoLimpio.length > 50) {
      throw crearErrorDominio(
        400,
        'El grupo no puede exceder 50 caracteres.',
        'GROUP_NAME_TOO_LONG'
      );
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.query(
        `
          SELECT id, is_active
          FROM usuarios_turismo
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

      await connection.query(
        `
          UPDATE usuarios_turismo
          SET is_active = TRUE,
              grupo = COALESCE(?, grupo)
          WHERE id = ?
        `,
        [grupoLimpio, estudianteId]
      );

      await connection.query(
        `INSERT INTO notificaciones_turismo (usuario_id, mensaje) VALUES (?, ?)`,
        [
          estudianteId,
          'Tu cuenta fue autorizada. Ya puedes iniciar sesion en el sistema de turismo.'
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
  }
};

module.exports = EstudianteTurismModelo;

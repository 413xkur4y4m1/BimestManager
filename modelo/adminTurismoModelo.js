const bcrypt = require('bcrypt');
const { pool } = require('../BDconex');

const PASSWORD_SALT_ROUNDS = 10;

const ROLES_USUARIO = ['ADMIN', 'ALUMNO'];
const ROLES_CREABLES = ['ADMIN'];
const ESTADOS_MATERIAL = ['DISPONIBLE', 'DAÑADO'];
const ESTADOS_SESION = ['PROGRAMADA', 'EN_CURSO', 'FINALIZADA'];
const ESTADOS_PRESTAMO = ['PRESTADO', 'DEVUELTO', 'PENDIENTE', 'ADEUDO'];
const ESTADOS_INCIDENCIA = ['PENDIENTE', 'RESUELTO'];
const TIPOS_INCIDENCIA = ['ROTO', 'PERDIDO'];

const TRANSICIONES_SESION = {
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

const AdminTurismoModelo = {
  ROLES_USUARIO,
  ROLES_CREABLES,
  ESTADOS_MATERIAL,
  ESTADOS_SESION,
  ESTADOS_PRESTAMO,
  ESTADOS_INCIDENCIA,
  TIPOS_INCIDENCIA,

  // ============= DASHBOARD =============

  obtenerResumen: async () => {
    const [[usuarios]] = await pool.query(
      `
        SELECT
          SUM(CASE WHEN rol = 'ADMIN' THEN 1 ELSE 0 END) AS admins,
          SUM(CASE WHEN rol = 'ALUMNO' AND is_active = TRUE THEN 1 ELSE 0 END) AS alumnos_activos,
          SUM(CASE WHEN rol = 'ALUMNO' AND is_active = FALSE THEN 1 ELSE 0 END) AS alumnos_pendientes
        FROM usuarios_turismo
      `
    );

    const [[materiales]] = await pool.query(
      `
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) AS activos,
          SUM(CASE WHEN is_active = TRUE AND estado = 'DISPONIBLE' THEN 1 ELSE 0 END) AS disponibles,
          SUM(CASE WHEN is_active = TRUE AND estado = 'DAÑADO' THEN 1 ELSE 0 END) AS daniados,
          COALESCE(SUM(CASE WHEN is_active = TRUE THEN stock ELSE 0 END), 0) AS stock_total,
          SUM(CASE WHEN is_active = TRUE AND stock = 0 THEN 1 ELSE 0 END) AS sin_stock
        FROM materiales_turismo
      `
    );

    const [[practicas]] = await pool.query(
      `
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) AS activas
        FROM practicas_turismo
      `
    );

    const [[sesiones]] = await pool.query(
      `
        SELECT
          SUM(CASE WHEN estado = 'PROGRAMADA' THEN 1 ELSE 0 END) AS programadas,
          SUM(CASE WHEN estado = 'EN_CURSO' THEN 1 ELSE 0 END) AS en_curso,
          SUM(CASE WHEN estado = 'FINALIZADA' THEN 1 ELSE 0 END) AS finalizadas
        FROM sesiones_turismo
      `
    );

    const [[prestamos]] = await pool.query(
      `
        SELECT
          SUM(CASE WHEN estado = 'PRESTADO' THEN 1 ELSE 0 END) AS prestados,
          SUM(CASE WHEN estado = 'DEVUELTO' THEN 1 ELSE 0 END) AS devueltos,
          SUM(CASE WHEN estado = 'PENDIENTE' THEN 1 ELSE 0 END) AS pendientes,
          SUM(CASE WHEN estado = 'ADEUDO' THEN 1 ELSE 0 END) AS adeudos
        FROM prestamos_material_turismo
      `
    );

    const [[incidencias]] = await pool.query(
      `
        SELECT
          SUM(CASE WHEN estado = 'PENDIENTE' THEN 1 ELSE 0 END) AS pendientes,
          SUM(CASE WHEN estado = 'RESUELTO' THEN 1 ELSE 0 END) AS resueltas
        FROM incidencias_turismo
      `
    );

    return {
      usuarios: {
        admins: Number(usuarios.admins || 0),
        alumnos_activos: Number(usuarios.alumnos_activos || 0),
        alumnos_pendientes: Number(usuarios.alumnos_pendientes || 0)
      },
      materiales: {
        total: Number(materiales.total || 0),
        activos: Number(materiales.activos || 0),
        disponibles: Number(materiales.disponibles || 0),
        daniados: Number(materiales.daniados || 0),
        stock_total: Number(materiales.stock_total || 0),
        sin_stock: Number(materiales.sin_stock || 0)
      },
      practicas: {
        total: Number(practicas.total || 0),
        activas: Number(practicas.activas || 0)
      },
      sesiones: {
        programadas: Number(sesiones.programadas || 0),
        en_curso: Number(sesiones.en_curso || 0),
        finalizadas: Number(sesiones.finalizadas || 0)
      },
      prestamos: {
        prestados: Number(prestamos.prestados || 0),
        devueltos: Number(prestamos.devueltos || 0),
        pendientes: Number(prestamos.pendientes || 0),
        adeudos: Number(prestamos.adeudos || 0)
      },
      incidencias: {
        pendientes: Number(incidencias.pendientes || 0),
        resueltas: Number(incidencias.resueltas || 0)
      }
    };
  },

  // ============= USUARIOS =============

  listarUsuarios: async ({ rol = null, soloPendientes = false, grupo = null } = {}) => {
    if (rol !== null && !ROLES_USUARIO.includes(rol)) {
      throw crearErrorDominio(
        400,
        `Rol invalido. Permitidos: ${ROLES_USUARIO.join(', ')}.`,
        'USER_ROLE_INVALID'
      );
    }

    const condiciones = [];
    const params = [];

    if (rol !== null) {
      condiciones.push('rol = ?');
      params.push(rol);
    }

    if (soloPendientes) {
      condiciones.push('is_active = FALSE');
    }

    if (grupo !== null) {
      condiciones.push('grupo = ?');
      params.push(grupo);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `
        SELECT id, nombre, email, rol, grupo, is_active, created_at
        FROM usuarios_turismo
        ${where}
        ORDER BY rol ASC, is_active DESC, nombre ASC
      `,
      params
    );

    return rows;
  },

  crearUsuarioConRol: async ({ nombre, email, password, rol, grupo = null }) => {
    if (!ROLES_CREABLES.includes(rol)) {
      throw crearErrorDominio(
        400,
        `Solo se pueden crear usuarios con rol ${ROLES_CREABLES.join(' o ')}.`,
        'USER_ROLE_NOT_CREATABLE'
      );
    }

    const nombreLimpio = String(nombre || '').trim();
    const emailLimpio = String(email || '').trim().toLowerCase();
    const passwordLimpio = String(password || '');
    const grupoLimpio = grupo === undefined || grupo === null
      ? null
      : String(grupo).trim() || null;

    if (!nombreLimpio || !emailLimpio || !passwordLimpio) {
      throw crearErrorDominio(
        400,
        'Nombre, email y password son obligatorios.',
        'USER_FIELDS_REQUIRED'
      );
    }

    if (grupoLimpio && grupoLimpio.length > 50) {
      throw crearErrorDominio(
        400,
        'El grupo no puede exceder 50 caracteres.',
        'GROUP_NAME_TOO_LONG'
      );
    }

    const [existentes] = await pool.query(
      `SELECT id FROM usuarios_turismo WHERE email = ? LIMIT 1`,
      [emailLimpio]
    );

    if (existentes.length) {
      throw crearErrorDominio(409, 'Ya existe un usuario con ese email.', 'USER_EMAIL_TAKEN');
    }

    const passwordHash = await bcrypt.hash(passwordLimpio, PASSWORD_SALT_ROUNDS);

    const [result] = await pool.query(
      `
        INSERT INTO usuarios_turismo (nombre, email, password, rol, grupo, is_active)
        VALUES (?, ?, ?, ?, ?, TRUE)
      `,
      [nombreLimpio, emailLimpio, passwordHash, rol, grupoLimpio]
    );

    return {
      id: result.insertId,
      nombre: nombreLimpio,
      email: emailLimpio,
      rol,
      grupo: grupoLimpio
    };
  },

  cambiarEstadoUsuario: async ({ usuarioId, activo }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [usuarios] = await connection.query(
        `
          SELECT id, rol, is_active
          FROM usuarios_turismo
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [usuarioId]
      );

      if (!usuarios.length) {
        throw crearErrorDominio(404, 'El usuario no existe.', 'USER_NOT_FOUND');
      }

      const usuario = usuarios[0];
      const nuevoEstado = Boolean(activo);

      if (Boolean(usuario.is_active) === nuevoEstado) {
        throw crearErrorDominio(
          409,
          `El usuario ya estaba ${nuevoEstado ? 'activo' : 'inactivo'}.`,
          'USER_STATE_UNCHANGED'
        );
      }

      await connection.query(
        `UPDATE usuarios_turismo SET is_active = ? WHERE id = ?`,
        [nuevoEstado, usuarioId]
      );

      const mensaje = nuevoEstado
        ? 'Tu cuenta fue habilitada por un administrador.'
        : 'Tu cuenta fue deshabilitada por un administrador.';

      await connection.query(
        `INSERT INTO notificaciones_turismo (usuario_id, mensaje) VALUES (?, ?)`,
        [usuarioId, mensaje]
      );

      await connection.commit();

      return { id: Number(usuarioId), is_active: nuevoEstado };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  asignarGrupoUsuario: async ({ usuarioId, grupo }) => {
    const grupoLimpio = String(grupo || '').trim();

    if (!grupoLimpio) {
      throw crearErrorDominio(400, 'El grupo es obligatorio.', 'GROUP_REQUIRED');
    }

    if (grupoLimpio.length > 50) {
      throw crearErrorDominio(400, 'El grupo no puede exceder 50 caracteres.', 'GROUP_NAME_TOO_LONG');
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [usuarios] = await connection.query(
        `
          SELECT id, rol
          FROM usuarios_turismo
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [usuarioId]
      );

      if (!usuarios.length) {
        throw crearErrorDominio(404, 'El usuario no existe.', 'USER_NOT_FOUND');
      }

      await connection.query(
        `UPDATE usuarios_turismo SET grupo = ? WHERE id = ?`,
        [grupoLimpio, usuarioId]
      );

      await connection.query(
        `INSERT INTO notificaciones_turismo (usuario_id, mensaje) VALUES (?, ?)`,
        [usuarioId, `Se te asigno al grupo ${grupoLimpio}.`]
      );

      await connection.commit();

      return { id: Number(usuarioId), grupo: grupoLimpio };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // ============= MATERIALES =============

  listarMateriales: async ({ incluirInactivos = false, estado = null } = {}) => {
    if (estado !== null && !ESTADOS_MATERIAL.includes(estado)) {
      throw crearErrorDominio(
        400,
        `Estado de material invalido. Permitidos: ${ESTADOS_MATERIAL.join(', ')}.`,
        'MATERIAL_STATE_INVALID'
      );
    }

    const condiciones = [];
    const params = [];

    if (!incluirInactivos) {
      condiciones.push('is_active = TRUE');
    }

    if (estado !== null) {
      condiciones.push('estado = ?');
      params.push(estado);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `
        SELECT id, nombre, stock, estado, is_active, created_at
        FROM materiales_turismo
        ${where}
        ORDER BY is_active DESC, nombre ASC
      `,
      params
    );

    return rows;
  },

  crearMaterial: async ({ nombre, stock, estado = 'DISPONIBLE' }) => {
    const nombreLimpio = String(nombre || '').trim();
    const stockNum = Number(stock);

    if (!nombreLimpio) {
      throw crearErrorDominio(400, 'El nombre del material es obligatorio.', 'MATERIAL_NAME_REQUIRED');
    }

    if (!Number.isInteger(stockNum) || stockNum < 0) {
      throw crearErrorDominio(
        400,
        'El stock debe ser un entero mayor o igual a 0.',
        'MATERIAL_STOCK_INVALID'
      );
    }

    if (!ESTADOS_MATERIAL.includes(estado)) {
      throw crearErrorDominio(
        400,
        `Estado invalido. Permitidos: ${ESTADOS_MATERIAL.join(', ')}.`,
        'MATERIAL_STATE_INVALID'
      );
    }

    const [existentes] = await pool.query(
      `SELECT id FROM materiales_turismo WHERE LOWER(nombre) = LOWER(?) LIMIT 1`,
      [nombreLimpio]
    );

    if (existentes.length) {
      throw crearErrorDominio(409, 'Ya existe un material con ese nombre.', 'MATERIAL_ALREADY_EXISTS');
    }

    const [result] = await pool.query(
      `INSERT INTO materiales_turismo (nombre, stock, estado) VALUES (?, ?, ?)`,
      [nombreLimpio, stockNum, estado]
    );

    return {
      id: result.insertId,
      nombre: nombreLimpio,
      stock: stockNum,
      estado,
      is_active: true
    };
  },

  ajustarStockMaterial: async ({ materialId, delta }) => {
    const deltaNum = Number(delta);

    if (!Number.isInteger(deltaNum) || deltaNum === 0) {
      throw crearErrorDominio(
        400,
        'El ajuste de stock debe ser un entero distinto de cero.',
        'MATERIAL_DELTA_INVALID'
      );
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [materiales] = await connection.query(
        `
          SELECT id, nombre, stock, is_active
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
        throw crearErrorDominio(
          409,
          'No se puede ajustar el stock de un material inactivo.',
          'MATERIAL_INACTIVE'
        );
      }

      const nuevoStock = material.stock + deltaNum;

      if (nuevoStock < 0) {
        throw crearErrorDominio(
          409,
          'El ajuste dejaria el stock en negativo.',
          'MATERIAL_STOCK_NEGATIVE'
        );
      }

      await connection.query(
        `UPDATE materiales_turismo SET stock = ? WHERE id = ?`,
        [nuevoStock, materialId]
      );

      await connection.commit();

      return {
        id: Number(materialId),
        nombre: material.nombre,
        stock_anterior: material.stock,
        stock: nuevoStock,
        delta: deltaNum
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  cambiarEstadoMaterial: async ({ materialId, estado }) => {
    if (!ESTADOS_MATERIAL.includes(estado)) {
      throw crearErrorDominio(
        400,
        `Estado invalido. Permitidos: ${ESTADOS_MATERIAL.join(', ')}.`,
        'MATERIAL_STATE_INVALID'
      );
    }

    const [materiales] = await pool.query(
      `SELECT id, estado FROM materiales_turismo WHERE id = ? LIMIT 1`,
      [materialId]
    );

    if (!materiales.length) {
      throw crearErrorDominio(404, 'El material no existe.', 'MATERIAL_NOT_FOUND');
    }

    if (materiales[0].estado === estado) {
      throw crearErrorDominio(
        409,
        `El material ya estaba en estado ${estado}.`,
        'MATERIAL_STATE_UNCHANGED'
      );
    }

    await pool.query(
      `UPDATE materiales_turismo SET estado = ? WHERE id = ?`,
      [estado, materialId]
    );

    return { id: Number(materialId), estado };
  },

  desactivarMaterial: async (materialId) => {
    const [result] = await pool.query(
      `UPDATE materiales_turismo SET is_active = FALSE WHERE id = ? AND is_active = TRUE`,
      [materialId]
    );

    if (!result.affectedRows) {
      throw crearErrorDominio(
        404,
        'El material no existe o ya estaba inactivo.',
        'MATERIAL_NOT_FOUND_OR_INACTIVE'
      );
    }

    return { id: Number(materialId), is_active: false };
  },

  // ============= PRACTICAS =============

  listarPracticas: async ({ incluirInactivas = false } = {}) => {
    const where = incluirInactivas ? '' : 'WHERE is_active = TRUE';

    const [rows] = await pool.query(
      `
        SELECT id, nombre, descripcion, duracion_minutos, is_active, created_at
        FROM practicas_turismo
        ${where}
        ORDER BY is_active DESC, nombre ASC
      `
    );

    return rows;
  },

  crearPractica: async ({ nombre, descripcion = null, duracionMinutos = null }) => {
    const nombreLimpio = String(nombre || '').trim();
    const descripcionLimpia = descripcion === undefined || descripcion === null
      ? null
      : String(descripcion).trim() || null;
    const duracionNum = duracionMinutos === undefined || duracionMinutos === null || duracionMinutos === ''
      ? null
      : Number(duracionMinutos);

    if (!nombreLimpio) {
      throw crearErrorDominio(400, 'El nombre de la practica es obligatorio.', 'PRACTICE_NAME_REQUIRED');
    }

    if (duracionNum !== null && (!Number.isInteger(duracionNum) || duracionNum <= 0)) {
      throw crearErrorDominio(
        400,
        'La duracion debe ser un entero positivo en minutos.',
        'PRACTICE_DURATION_INVALID'
      );
    }

    const [existentes] = await pool.query(
      `SELECT id FROM practicas_turismo WHERE LOWER(nombre) = LOWER(?) LIMIT 1`,
      [nombreLimpio]
    );

    if (existentes.length) {
      throw crearErrorDominio(409, 'Ya existe una practica con ese nombre.', 'PRACTICE_ALREADY_EXISTS');
    }

    const [result] = await pool.query(
      `
        INSERT INTO practicas_turismo (nombre, descripcion, duracion_minutos)
        VALUES (?, ?, ?)
      `,
      [nombreLimpio, descripcionLimpia, duracionNum]
    );

    return {
      id: result.insertId,
      nombre: nombreLimpio,
      descripcion: descripcionLimpia,
      duracion_minutos: duracionNum,
      is_active: true
    };
  },

  actualizarPractica: async ({ practicaId, nombre, descripcion, duracionMinutos }) => {
    const sets = [];
    const params = [];

    if (nombre !== undefined) {
      const nombreLimpio = String(nombre || '').trim();
      if (!nombreLimpio) {
        throw crearErrorDominio(400, 'El nombre de la practica es obligatorio.', 'PRACTICE_NAME_REQUIRED');
      }
      sets.push('nombre = ?');
      params.push(nombreLimpio);
    }

    if (descripcion !== undefined) {
      const descripcionLimpia = descripcion === null
        ? null
        : String(descripcion).trim() || null;
      sets.push('descripcion = ?');
      params.push(descripcionLimpia);
    }

    if (duracionMinutos !== undefined) {
      const duracionNum = duracionMinutos === null || duracionMinutos === ''
        ? null
        : Number(duracionMinutos);

      if (duracionNum !== null && (!Number.isInteger(duracionNum) || duracionNum <= 0)) {
        throw crearErrorDominio(
          400,
          'La duracion debe ser un entero positivo en minutos.',
          'PRACTICE_DURATION_INVALID'
        );
      }

      sets.push('duracion_minutos = ?');
      params.push(duracionNum);
    }

    if (!sets.length) {
      throw crearErrorDominio(
        400,
        'No se proporcionaron campos para actualizar.',
        'PRACTICE_NO_FIELDS'
      );
    }

    params.push(practicaId);

    const [result] = await pool.query(
      `UPDATE practicas_turismo SET ${sets.join(', ')} WHERE id = ?`,
      params
    );

    if (!result.affectedRows) {
      throw crearErrorDominio(404, 'La practica no existe.', 'PRACTICE_NOT_FOUND');
    }

    return { id: Number(practicaId) };
  },

  desactivarPractica: async (practicaId) => {
    const [result] = await pool.query(
      `UPDATE practicas_turismo SET is_active = FALSE WHERE id = ? AND is_active = TRUE`,
      [practicaId]
    );

    if (!result.affectedRows) {
      throw crearErrorDominio(
        404,
        'La practica no existe o ya estaba inactiva.',
        'PRACTICE_NOT_FOUND_OR_INACTIVE'
      );
    }

    return { id: Number(practicaId), is_active: false };
  },

  // ============= SUGERENCIAS DE MATERIAL =============

  listarSugerenciasPorPractica: async (practicaId) => {
    const [practicas] = await pool.query(
      `SELECT id, nombre FROM practicas_turismo WHERE id = ? LIMIT 1`,
      [practicaId]
    );

    if (!practicas.length) {
      throw crearErrorDominio(404, 'La practica no existe.', 'PRACTICE_NOT_FOUND');
    }

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

    return {
      practica: practicas[0],
      sugerencias: rows.map((fila) => ({
        ...fila,
        material_activo: Boolean(fila.material_activo)
      }))
    };
  },

  agregarSugerencia: async ({ practicaId, materialId, cantidadSugerida = 1 }) => {
    const cantidadNum = Number(cantidadSugerida);

    if (!Number.isInteger(cantidadNum) || cantidadNum <= 0) {
      throw crearErrorDominio(
        400,
        'La cantidad sugerida debe ser un entero positivo.',
        'SUGGESTION_QUANTITY_INVALID'
      );
    }

    const [practicas] = await pool.query(
      `SELECT id FROM practicas_turismo WHERE id = ? LIMIT 1`,
      [practicaId]
    );

    if (!practicas.length) {
      throw crearErrorDominio(404, 'La practica no existe.', 'PRACTICE_NOT_FOUND');
    }

    const [materiales] = await pool.query(
      `SELECT id, is_active FROM materiales_turismo WHERE id = ? LIMIT 1`,
      [materialId]
    );

    if (!materiales.length) {
      throw crearErrorDominio(404, 'El material no existe.', 'MATERIAL_NOT_FOUND');
    }

    if (!materiales[0].is_active) {
      throw crearErrorDominio(409, 'El material esta inactivo.', 'MATERIAL_INACTIVE');
    }

    const [duplicados] = await pool.query(
      `
        SELECT id
        FROM sugerencias_material_turismo
        WHERE practica_id = ? AND material_id = ?
        LIMIT 1
      `,
      [practicaId, materialId]
    );

    if (duplicados.length) {
      throw crearErrorDominio(
        409,
        'Ese material ya esta sugerido para la practica.',
        'SUGGESTION_ALREADY_EXISTS'
      );
    }

    const [result] = await pool.query(
      `
        INSERT INTO sugerencias_material_turismo (practica_id, material_id, cantidad_sugerida)
        VALUES (?, ?, ?)
      `,
      [practicaId, materialId, cantidadNum]
    );

    return {
      id: result.insertId,
      practica_id: Number(practicaId),
      material_id: Number(materialId),
      cantidad_sugerida: cantidadNum
    };
  },

  actualizarSugerencia: async ({ sugerenciaId, cantidadSugerida }) => {
    const cantidadNum = Number(cantidadSugerida);

    if (!Number.isInteger(cantidadNum) || cantidadNum <= 0) {
      throw crearErrorDominio(
        400,
        'La cantidad sugerida debe ser un entero positivo.',
        'SUGGESTION_QUANTITY_INVALID'
      );
    }

    const [result] = await pool.query(
      `UPDATE sugerencias_material_turismo SET cantidad_sugerida = ? WHERE id = ?`,
      [cantidadNum, sugerenciaId]
    );

    if (!result.affectedRows) {
      throw crearErrorDominio(404, 'La sugerencia no existe.', 'SUGGESTION_NOT_FOUND');
    }

    return { id: Number(sugerenciaId), cantidad_sugerida: cantidadNum };
  },

  eliminarSugerencia: async (sugerenciaId) => {
    const [result] = await pool.query(
      `DELETE FROM sugerencias_material_turismo WHERE id = ?`,
      [sugerenciaId]
    );

    if (!result.affectedRows) {
      throw crearErrorDominio(404, 'La sugerencia no existe.', 'SUGGESTION_NOT_FOUND');
    }

    return { id: Number(sugerenciaId) };
  },

  // ============= SESIONES =============

  listarSesiones: async ({ estado = null, grupo = null, practicaId = null } = {}) => {
    if (estado !== null && !ESTADOS_SESION.includes(estado)) {
      throw crearErrorDominio(
        400,
        `Estado de sesion invalido. Permitidos: ${ESTADOS_SESION.join(', ')}.`,
        'SESSION_STATE_INVALID'
      );
    }

    const condiciones = [];
    const params = [];

    if (estado !== null) {
      condiciones.push('s.estado = ?');
      params.push(estado);
    }

    if (grupo !== null) {
      condiciones.push('s.grupo = ?');
      params.push(grupo);
    }

    if (practicaId !== null) {
      condiciones.push('s.practica_id = ?');
      params.push(practicaId);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `
        SELECT
          s.id,
          s.practica_id,
          p.nombre AS practica,
          s.grupo,
          s.fecha_inicio,
          s.fecha_fin,
          s.estado,
          s.created_at,
          (
            SELECT COUNT(*)
            FROM prestamos_material_turismo pm
            WHERE pm.sesion_id = s.id
          ) AS total_prestamos
        FROM sesiones_turismo s
        INNER JOIN practicas_turismo p ON p.id = s.practica_id
        ${where}
        ORDER BY s.fecha_inicio DESC, s.id DESC
      `,
      params
    );

    return rows;
  },

  crearSesion: async ({ practicaId, grupo, fechaInicio, fechaFin }) => {
    const grupoLimpio = String(grupo || '').trim();

    if (!grupoLimpio) {
      throw crearErrorDominio(400, 'El grupo es obligatorio.', 'GROUP_REQUIRED');
    }

    if (grupoLimpio.length > 50) {
      throw crearErrorDominio(400, 'El grupo no puede exceder 50 caracteres.', 'GROUP_NAME_TOO_LONG');
    }

    if (!fechaInicio || !fechaFin) {
      throw crearErrorDominio(
        400,
        'fecha_inicio y fecha_fin son obligatorias.',
        'SESSION_DATES_REQUIRED'
      );
    }

    if (new Date(fechaFin) <= new Date(fechaInicio)) {
      throw crearErrorDominio(
        400,
        'La fecha_fin debe ser posterior a fecha_inicio.',
        'SESSION_DATES_INVALID'
      );
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [practicas] = await connection.query(
        `SELECT id, nombre, is_active FROM practicas_turismo WHERE id = ? LIMIT 1`,
        [practicaId]
      );

      if (!practicas.length) {
        throw crearErrorDominio(404, 'La practica no existe.', 'PRACTICE_NOT_FOUND');
      }

      if (!practicas[0].is_active) {
        throw crearErrorDominio(409, 'La practica esta inactiva.', 'PRACTICE_INACTIVE');
      }

      const [result] = await connection.query(
        `
          INSERT INTO sesiones_turismo (practica_id, grupo, fecha_inicio, fecha_fin, estado)
          VALUES (?, ?, ?, ?, 'PROGRAMADA')
        `,
        [practicaId, grupoLimpio, fechaInicio, fechaFin]
      );

      await connection.query(
        `
          INSERT INTO notificaciones_turismo (usuario_id, mensaje)
          SELECT id, ?
          FROM usuarios_turismo
          WHERE grupo = ? AND rol = 'ALUMNO' AND is_active = TRUE
        `,
        [
          `Se programo una nueva sesion de ${practicas[0].nombre} para tu grupo.`,
          grupoLimpio
        ]
      );

      await connection.commit();

      return {
        id: result.insertId,
        practica_id: Number(practicaId),
        practica: practicas[0].nombre,
        grupo: grupoLimpio,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        estado: 'PROGRAMADA'
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  cambiarEstadoSesion: async ({ sesionId, nuevoEstado }) => {
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
          SELECT id, grupo, estado, practica_id
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

      if (sesion.estado === nuevoEstado) {
        throw crearErrorDominio(
          409,
          `La sesion ya esta en estado ${nuevoEstado}.`,
          'SESSION_STATE_UNCHANGED'
        );
      }

      const transicionesValidas = TRANSICIONES_SESION[sesion.estado];

      if (!transicionesValidas.includes(nuevoEstado)) {
        throw crearErrorDominio(
          409,
          `No se puede pasar de ${sesion.estado} a ${nuevoEstado}.`,
          'SESSION_STATE_INVALID_TRANSITION'
        );
      }

      await connection.query(
        `UPDATE sesiones_turismo SET estado = ? WHERE id = ?`,
        [nuevoEstado, sesionId]
      );

      const mensaje = nuevoEstado === 'EN_CURSO'
        ? 'Tu sesion de turismo comenzo. Ya puedes solicitar materiales.'
        : nuevoEstado === 'FINALIZADA'
          ? 'Tu sesion de turismo fue finalizada.'
          : `El estado de tu sesion cambio a ${nuevoEstado}.`;

      await connection.query(
        `
          INSERT INTO notificaciones_turismo (usuario_id, mensaje)
          SELECT id, ?
          FROM usuarios_turismo
          WHERE grupo = ? AND rol = 'ALUMNO' AND is_active = TRUE
        `,
        [mensaje, sesion.grupo]
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
  },

  obtenerDetalleSesion: async (sesionId) => {
    const [sesiones] = await pool.query(
      `
        SELECT
          s.id, s.practica_id, s.grupo, s.fecha_inicio, s.fecha_fin, s.estado, s.created_at,
          p.nombre AS practica_nombre,
          p.descripcion AS practica_descripcion,
          p.duracion_minutos
        FROM sesiones_turismo s
        INNER JOIN practicas_turismo p ON p.id = s.practica_id
        WHERE s.id = ?
        LIMIT 1
      `,
      [sesionId]
    );

    if (!sesiones.length) {
      throw crearErrorDominio(404, 'La sesion no existe.', 'SESSION_NOT_FOUND');
    }

    const sesion = sesiones[0];

    const [prestamos] = await pool.query(
      `
        SELECT
          pm.id,
          pm.alumno_id,
          u.nombre AS alumno,
          u.email AS alumno_email,
          pm.material_id,
          m.nombre AS material,
          pm.cantidad,
          pm.estado,
          pm.fecha_prestamo,
          pm.fecha_devolucion
        FROM prestamos_material_turismo pm
        INNER JOIN usuarios_turismo u ON u.id = pm.alumno_id
        INNER JOIN materiales_turismo m ON m.id = pm.material_id
        WHERE pm.sesion_id = ?
        ORDER BY pm.fecha_prestamo DESC, pm.id DESC
      `,
      [sesionId]
    );

    const [alumnos] = await pool.query(
      `
        SELECT id, nombre, email, is_active
        FROM usuarios_turismo
        WHERE grupo = ? AND rol = 'ALUMNO'
        ORDER BY nombre ASC
      `,
      [sesion.grupo]
    );

    return { sesion, prestamos, alumnos };
  },

  // ============= PRESTAMOS =============

  listarPrestamos: async ({ estado = null, sesionId = null, alumnoId = null } = {}) => {
    if (estado !== null && !ESTADOS_PRESTAMO.includes(estado)) {
      throw crearErrorDominio(
        400,
        `Estado de prestamo invalido. Permitidos: ${ESTADOS_PRESTAMO.join(', ')}.`,
        'LOAN_STATE_INVALID'
      );
    }

    const condiciones = [];
    const params = [];

    if (estado !== null) {
      condiciones.push('pm.estado = ?');
      params.push(estado);
    }

    if (sesionId !== null) {
      condiciones.push('pm.sesion_id = ?');
      params.push(sesionId);
    }

    if (alumnoId !== null) {
      condiciones.push('pm.alumno_id = ?');
      params.push(alumnoId);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `
        SELECT
          pm.id,
          pm.sesion_id,
          ses.grupo,
          pm.alumno_id,
          u.nombre AS alumno,
          u.email AS alumno_email,
          pm.material_id,
          m.nombre AS material,
          pm.cantidad,
          pm.estado,
          pm.fecha_prestamo,
          pm.fecha_devolucion
        FROM prestamos_material_turismo pm
        INNER JOIN usuarios_turismo u ON u.id = pm.alumno_id
        INNER JOIN materiales_turismo m ON m.id = pm.material_id
        INNER JOIN sesiones_turismo ses ON ses.id = pm.sesion_id
        ${where}
        ORDER BY pm.fecha_prestamo DESC, pm.id DESC
      `,
      params
    );

    return rows;
  },

  registrarPrestamo: async ({ sesionId, alumnoId, materialId, cantidad }) => {
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

      const [sesiones] = await connection.query(
        `
          SELECT id, grupo, estado
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

      if (sesion.estado === 'FINALIZADA') {
        throw crearErrorDominio(409, 'La sesion ya fue finalizada.', 'SESSION_FINALIZED');
      }

      const [alumnos] = await connection.query(
        `
          SELECT id, grupo, is_active, rol
          FROM usuarios_turismo
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [alumnoId]
      );

      if (!alumnos.length) {
        throw crearErrorDominio(404, 'El alumno no existe.', 'STUDENT_NOT_FOUND');
      }

      const alumno = alumnos[0];

      if (alumno.rol !== 'ALUMNO') {
        throw crearErrorDominio(409, 'El usuario no es un alumno.', 'USER_NOT_STUDENT');
      }

      if (!alumno.is_active) {
        throw crearErrorDominio(409, 'El alumno no esta activo.', 'STUDENT_INACTIVE');
      }

      if (alumno.grupo !== sesion.grupo) {
        throw crearErrorDominio(
          409,
          'El alumno no pertenece al grupo de la sesion.',
          'STUDENT_NOT_IN_SESSION_GROUP'
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

      await connection.query(
        `UPDATE materiales_turismo SET stock = stock - ? WHERE id = ?`,
        [cantidadNum, materialId]
      );

      const [result] = await connection.query(
        `
          INSERT INTO prestamos_material_turismo
            (sesion_id, alumno_id, material_id, cantidad, estado)
          VALUES (?, ?, ?, ?, 'PRESTADO')
        `,
        [sesionId, alumnoId, materialId, cantidadNum]
      );

      await connection.query(
        `INSERT INTO notificaciones_turismo (usuario_id, mensaje) VALUES (?, ?)`,
        [
          alumnoId,
          `Se registro un prestamo de ${cantidadNum} unidad(es) de ${material.nombre} a tu nombre.`
        ]
      );

      await connection.commit();

      return {
        id: result.insertId,
        sesion_id: Number(sesionId),
        alumno_id: Number(alumnoId),
        material_id: Number(materialId),
        material: material.nombre,
        cantidad: cantidadNum,
        estado: 'PRESTADO'
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  marcarPrestamoDevuelto: async (prestamoId) => {
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

      if (prestamo.estado === 'DEVUELTO') {
        throw crearErrorDominio(409, 'El prestamo ya estaba devuelto.', 'LOAN_ALREADY_RETURNED');
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
        [prestamo.alumno_id, 'Se registro la devolucion de tu prestamo.']
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

  aprobarSolicitudPrestamo: async (prestamoId) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [prestamos] = await connection.query(
        `
          SELECT id, sesion_id, alumno_id, material_id, cantidad, estado
          FROM prestamos_material_turismo
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [prestamoId]
      );

      if (!prestamos.length) {
        throw crearErrorDominio(404, 'La solicitud no existe.', 'LOAN_NOT_FOUND');
      }

      const prestamo = prestamos[0];

      if (prestamo.estado !== 'PENDIENTE') {
        throw crearErrorDominio(
          409,
          `Solo se pueden aprobar solicitudes en estado PENDIENTE (actual: ${prestamo.estado}).`,
          'LOAN_NOT_PENDING'
        );
      }

      const [sesiones] = await connection.query(
        `SELECT id, estado FROM sesiones_turismo WHERE id = ? LIMIT 1`,
        [prestamo.sesion_id]
      );

      if (sesiones.length && sesiones[0].estado === 'FINALIZADA') {
        throw crearErrorDominio(409, 'La sesion ya fue finalizada.', 'SESSION_FINALIZED');
      }

      const [materiales] = await connection.query(
        `
          SELECT id, nombre, stock, estado, is_active
          FROM materiales_turismo
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [prestamo.material_id]
      );

      if (!materiales.length) {
        throw crearErrorDominio(404, 'El material ya no existe.', 'MATERIAL_NOT_FOUND');
      }

      const material = materiales[0];

      if (!material.is_active) {
        throw crearErrorDominio(409, 'El material esta inactivo.', 'MATERIAL_INACTIVE');
      }

      if (material.estado !== 'DISPONIBLE') {
        throw crearErrorDominio(
          409,
          'El material ya no esta disponible.',
          'MATERIAL_NOT_AVAILABLE'
        );
      }

      if (material.stock < prestamo.cantidad) {
        throw crearErrorDominio(
          409,
          `Stock insuficiente para aprobar. Disponible: ${material.stock}.`,
          'MATERIAL_STOCK_INSUFFICIENT'
        );
      }

      await connection.query(
        `UPDATE materiales_turismo SET stock = stock - ? WHERE id = ?`,
        [prestamo.cantidad, prestamo.material_id]
      );

      await connection.query(
        `UPDATE prestamos_material_turismo SET estado = 'PRESTADO' WHERE id = ?`,
        [prestamoId]
      );

      await connection.query(
        `INSERT INTO notificaciones_turismo (usuario_id, mensaje) VALUES (?, ?)`,
        [
          prestamo.alumno_id,
          `Tu solicitud de ${prestamo.cantidad} unidad(es) de ${material.nombre} fue aprobada. Pasa a recoger el material.`
        ]
      );

      await connection.commit();

      return { id: Number(prestamoId), estado: 'PRESTADO' };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  rechazarSolicitudPrestamo: async ({ prestamoId, motivo = null }) => {
    const motivoLimpio = motivo === undefined || motivo === null
      ? null
      : String(motivo).trim() || null;

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
        throw crearErrorDominio(404, 'La solicitud no existe.', 'LOAN_NOT_FOUND');
      }

      const prestamo = prestamos[0];

      if (prestamo.estado !== 'PENDIENTE') {
        throw crearErrorDominio(
          409,
          `Solo se pueden rechazar solicitudes en estado PENDIENTE (actual: ${prestamo.estado}).`,
          'LOAN_NOT_PENDING'
        );
      }

      const [materiales] = await connection.query(
        `SELECT nombre FROM materiales_turismo WHERE id = ? LIMIT 1`,
        [prestamo.material_id]
      );
      const nombreMaterial = (materiales[0] && materiales[0].nombre) || 'material';

      // Cerramos la solicitud sin tocar stock (no hubo entrega).
      await connection.query(
        `
          UPDATE prestamos_material_turismo
          SET estado = 'DEVUELTO', fecha_devolucion = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [prestamoId]
      );

      const mensaje = motivoLimpio
        ? `Tu solicitud de ${prestamo.cantidad} unidad(es) de ${nombreMaterial} fue rechazada por el administrador. Motivo: ${motivoLimpio}.`
        : `Tu solicitud de ${prestamo.cantidad} unidad(es) de ${nombreMaterial} fue rechazada por el administrador.`;

      await connection.query(
        `INSERT INTO notificaciones_turismo (usuario_id, mensaje) VALUES (?, ?)`,
        [prestamo.alumno_id, mensaje]
      );

      await connection.commit();

      return { id: Number(prestamoId), estado: 'RECHAZADA' };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  marcarPrestamoAdeudo: async (prestamoId) => {
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

      if (prestamo.estado === 'DEVUELTO') {
        throw crearErrorDominio(
          409,
          'No se puede marcar como adeudo un prestamo ya devuelto.',
          'LOAN_ALREADY_RETURNED'
        );
      }

      if (prestamo.estado === 'ADEUDO') {
        throw crearErrorDominio(409, 'El prestamo ya estaba en adeudo.', 'LOAN_ALREADY_IN_DEBT');
      }

      await connection.query(
        `UPDATE prestamos_material_turismo SET estado = 'ADEUDO' WHERE id = ?`,
        [prestamoId]
      );

      await connection.query(
        `INSERT INTO notificaciones_turismo (usuario_id, mensaje) VALUES (?, ?)`,
        [prestamo.alumno_id, 'Tu prestamo fue marcado como adeudo. Contacta al administrador.']
      );

      await connection.commit();

      return { id: Number(prestamoId), estado: 'ADEUDO' };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // ============= INCIDENCIAS =============

  listarIncidencias: async ({ estado = null } = {}) => {
    if (estado !== null && !ESTADOS_INCIDENCIA.includes(estado)) {
      throw crearErrorDominio(
        400,
        `Estado de incidencia invalido. Permitidos: ${ESTADOS_INCIDENCIA.join(', ')}.`,
        'INCIDENT_STATE_INVALID'
      );
    }

    const params = [];
    let where = '';

    if (estado !== null) {
      where = 'WHERE i.estado = ?';
      params.push(estado);
    }

    const [rows] = await pool.query(
      `
        SELECT
          i.id,
          i.prestamo_id,
          i.tipo,
          i.descripcion,
          i.estado,
          i.created_at,
          pm.alumno_id,
          u.nombre AS alumno,
          u.email AS alumno_email,
          pm.material_id,
          m.nombre AS material,
          pm.cantidad,
          pm.sesion_id,
          ses.grupo
        FROM incidencias_turismo i
        INNER JOIN prestamos_material_turismo pm ON pm.id = i.prestamo_id
        INNER JOIN usuarios_turismo u ON u.id = pm.alumno_id
        INNER JOIN materiales_turismo m ON m.id = pm.material_id
        INNER JOIN sesiones_turismo ses ON ses.id = pm.sesion_id
        ${where}
        ORDER BY i.created_at DESC, i.id DESC
      `,
      params
    );

    return rows;
  },

  resolverIncidencia: async ({ incidenciaId, marcarPrestamoDevuelto = false }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [incidencias] = await connection.query(
        `
          SELECT id, prestamo_id, estado
          FROM incidencias_turismo
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [incidenciaId]
      );

      if (!incidencias.length) {
        throw crearErrorDominio(404, 'La incidencia no existe.', 'INCIDENT_NOT_FOUND');
      }

      const incidencia = incidencias[0];

      if (incidencia.estado === 'RESUELTO') {
        throw crearErrorDominio(409, 'La incidencia ya estaba resuelta.', 'INCIDENT_ALREADY_RESOLVED');
      }

      const [prestamos] = await connection.query(
        `
          SELECT id, alumno_id, material_id, cantidad, estado
          FROM prestamos_material_turismo
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [incidencia.prestamo_id]
      );

      if (!prestamos.length) {
        throw crearErrorDominio(404, 'El prestamo asociado no existe.', 'LOAN_NOT_FOUND');
      }

      const prestamo = prestamos[0];

      await connection.query(
        `UPDATE incidencias_turismo SET estado = 'RESUELTO' WHERE id = ?`,
        [incidenciaId]
      );

      if (marcarPrestamoDevuelto && prestamo.estado !== 'DEVUELTO') {
        await connection.query(
          `
            UPDATE prestamos_material_turismo
            SET estado = 'DEVUELTO', fecha_devolucion = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [prestamo.id]
        );

        await connection.query(
          `UPDATE materiales_turismo SET stock = stock + ? WHERE id = ?`,
          [prestamo.cantidad, prestamo.material_id]
        );
      }

      await connection.query(
        `INSERT INTO notificaciones_turismo (usuario_id, mensaje) VALUES (?, ?)`,
        [prestamo.alumno_id, 'Tu incidencia fue marcada como resuelta.']
      );

      await connection.commit();

      return {
        id: Number(incidenciaId),
        estado: 'RESUELTO',
        prestamo_devuelto: Boolean(marcarPrestamoDevuelto && prestamo.estado !== 'DEVUELTO')
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
};

module.exports = AdminTurismoModelo;

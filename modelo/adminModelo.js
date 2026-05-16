const bcrypt = require('bcrypt');
const { pool } = require('../BDconex');

const PASSWORD_SALT_ROUNDS = 10;
const ROLES_USUARIO = ['ADMIN', 'MAESTRO', 'ALUMNO'];
const ROLES_CREABLES = ['ADMIN', 'MAESTRO'];
const TIPOS_PRACTICA = ['QUIMICA', 'TURISMO'];
const ESTADOS_PRESTAMO = ['ACTIVO', 'DEVUELTO'];
const ESTADOS_ADEUDO = ['PENDIENTE', 'RESUELTO'];

const crearErrorDominio = (status, message, code) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

const AdminModelo = {
  ROLES_USUARIO,
  ROLES_CREABLES,
  TIPOS_PRACTICA,
  ESTADOS_PRESTAMO,
  ESTADOS_ADEUDO,

  obtenerResumen: async () => {
    const [[usuarios]] = await pool.query(
      `
        SELECT
          SUM(CASE WHEN rol = 'ADMIN' THEN 1 ELSE 0 END) AS admins,
          SUM(CASE WHEN rol = 'MAESTRO' THEN 1 ELSE 0 END) AS maestros,
          SUM(CASE WHEN rol = 'ALUMNO' AND is_active = TRUE THEN 1 ELSE 0 END) AS alumnos_activos,
          SUM(CASE WHEN rol = 'ALUMNO' AND is_active = FALSE THEN 1 ELSE 0 END) AS alumnos_pendientes
        FROM usuarios
      `
    );

    const [[materiales]] = await pool.query(
      `
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) AS activos,
          COALESCE(SUM(CASE WHEN is_active = TRUE THEN stock ELSE 0 END), 0) AS stock_total,
          SUM(CASE WHEN is_active = TRUE AND stock = 0 THEN 1 ELSE 0 END) AS sin_stock
        FROM materiales
      `
    );

    const [[prestamos]] = await pool.query(
      `
        SELECT
          SUM(CASE WHEN estado = 'ACTIVO' THEN 1 ELSE 0 END) AS activos,
          SUM(CASE WHEN estado = 'DEVUELTO' THEN 1 ELSE 0 END) AS devueltos
        FROM prestamos
      `
    );

    const [[adeudos]] = await pool.query(
      `
        SELECT
          SUM(CASE WHEN estado = 'PENDIENTE' THEN 1 ELSE 0 END) AS pendientes,
          SUM(CASE WHEN estado = 'RESUELTO' THEN 1 ELSE 0 END) AS resueltos
        FROM adeudos
      `
    );

    return {
      usuarios: {
        admins: Number(usuarios.admins || 0),
        maestros: Number(usuarios.maestros || 0),
        alumnos_activos: Number(usuarios.alumnos_activos || 0),
        alumnos_pendientes: Number(usuarios.alumnos_pendientes || 0)
      },
      materiales: {
        total: Number(materiales.total || 0),
        activos: Number(materiales.activos || 0),
        stock_total: Number(materiales.stock_total || 0),
        sin_stock: Number(materiales.sin_stock || 0)
      },
      prestamos: {
        activos: Number(prestamos.activos || 0),
        devueltos: Number(prestamos.devueltos || 0)
      },
      adeudos: {
        pendientes: Number(adeudos.pendientes || 0),
        resueltos: Number(adeudos.resueltos || 0)
      }
    };
  },

  listarUsuarios: async ({ rol = null, soloPendientes = false } = {}) => {
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
      condiciones.push('u.rol = ?');
      params.push(rol);
    }

    if (soloPendientes) {
      condiciones.push('u.is_active = FALSE');
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `
        SELECT u.id, u.nombre, u.email, u.rol, u.is_active, u.created_at,
               u.grupo_id, g.nombre AS grupo
        FROM usuarios u
        LEFT JOIN grupos g ON g.id = u.grupo_id
        ${where}
        ORDER BY u.rol ASC, u.is_active DESC, u.nombre ASC
      `,
      params
    );

    return rows;
  },

  crearUsuarioConRol: async ({ nombre, email, password, rol }) => {
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

    if (!nombreLimpio || !emailLimpio || !passwordLimpio) {
      throw crearErrorDominio(
        400,
        'Nombre, email y password son obligatorios.',
        'USER_FIELDS_REQUIRED'
      );
    }

    const [existentes] = await pool.query(
      `SELECT id FROM usuarios WHERE email = ? LIMIT 1`,
      [emailLimpio]
    );

    if (existentes.length) {
      throw crearErrorDominio(409, 'Ya existe un usuario con ese email.', 'USER_EMAIL_TAKEN');
    }

    const passwordHash = await bcrypt.hash(passwordLimpio, PASSWORD_SALT_ROUNDS);

    const [result] = await pool.query(
      `
        INSERT INTO usuarios (nombre, email, password, rol, is_active)
        VALUES (?, ?, ?, ?, TRUE)
      `,
      [nombreLimpio, emailLimpio, passwordHash, rol]
    );

    return { id: result.insertId, nombre: nombreLimpio, email: emailLimpio, rol };
  },

  cambiarEstadoUsuario: async ({ usuarioId, activo }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [usuarios] = await connection.query(
        `
          SELECT id, rol, is_active
          FROM usuarios
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
        `UPDATE usuarios SET is_active = ? WHERE id = ?`,
        [nuevoEstado, usuarioId]
      );

      const mensaje = nuevoEstado
        ? 'Tu cuenta fue habilitada por un administrador.'
        : 'Tu cuenta fue deshabilitada por un administrador.';

      await connection.query(
        `INSERT INTO notificaciones (usuario_id, mensaje) VALUES (?, ?)`,
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

  listarMateriales: async ({ incluirInactivos = false } = {}) => {
    const where = incluirInactivos ? '' : 'WHERE is_active = TRUE';

    const [rows] = await pool.query(
      `
        SELECT id, nombre, stock, is_active, created_at
        FROM materiales
        ${where}
        ORDER BY is_active DESC, nombre ASC
      `
    );

    return rows;
  },

  crearMaterial: async ({ nombre, stock }) => {
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

    const [existentes] = await pool.query(
      `SELECT id FROM materiales WHERE LOWER(nombre) = LOWER(?) LIMIT 1`,
      [nombreLimpio]
    );

    if (existentes.length) {
      throw crearErrorDominio(409, 'Ya existe un material con ese nombre.', 'MATERIAL_ALREADY_EXISTS');
    }

    const [result] = await pool.query(
      `INSERT INTO materiales (nombre, stock) VALUES (?, ?)`,
      [nombreLimpio, stockNum]
    );

    return { id: result.insertId, nombre: nombreLimpio, stock: stockNum, is_active: true };
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
          FROM materiales
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
        `UPDATE materiales SET stock = ? WHERE id = ?`,
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

  desactivarMaterial: async (materialId) => {
    const [result] = await pool.query(
      `UPDATE materiales SET is_active = FALSE WHERE id = ? AND is_active = TRUE`,
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
        ORDER BY tipo ASC, nombre ASC
      `,
      params
    );

    return rows;
  },

  crearPractica: async ({ nombre, descripcion, tipo }) => {
    const nombreLimpio = String(nombre || '').trim();
    const descripcionLimpia = descripcion === undefined || descripcion === null
      ? null
      : String(descripcion).trim() || null;

    if (!nombreLimpio) {
      throw crearErrorDominio(400, 'El nombre de la practica es obligatorio.', 'PRACTICE_NAME_REQUIRED');
    }

    if (!TIPOS_PRACTICA.includes(tipo)) {
      throw crearErrorDominio(
        400,
        `Tipo de practica invalido. Permitidos: ${TIPOS_PRACTICA.join(', ')}.`,
        'PRACTICE_TYPE_INVALID'
      );
    }

    const [result] = await pool.query(
      `INSERT INTO practicas (nombre, descripcion, tipo) VALUES (?, ?, ?)`,
      [nombreLimpio, descripcionLimpia, tipo]
    );

    return {
      id: result.insertId,
      nombre: nombreLimpio,
      descripcion: descripcionLimpia,
      tipo
    };
  },

  listarKitsPorPractica: async (practicaId) => {
    const [practicas] = await pool.query(
      `SELECT id, nombre, tipo FROM practicas WHERE id = ? LIMIT 1`,
      [practicaId]
    );

    if (!practicas.length) {
      throw crearErrorDominio(404, 'La practica no existe.', 'PRACTICE_NOT_FOUND');
    }

    const [kits] = await pool.query(
      `SELECT id, nombre FROM kits WHERE practica_id = ? ORDER BY id ASC`,
      [practicaId]
    );

    if (!kits.length) {
      return { practica: practicas[0], kits: [] };
    }

    const kitIds = kits.map((k) => k.id);
    const placeholders = kitIds.map(() => '?').join(',');

    const [items] = await pool.query(
      `
        SELECT km.kit_id, km.material_id, km.cantidad,
               m.nombre AS material, m.stock, m.is_active AS material_activo
        FROM kit_materiales km
        INNER JOIN materiales m ON m.id = km.material_id
        WHERE km.kit_id IN (${placeholders})
        ORDER BY m.nombre ASC
      `,
      kitIds
    );

    const itemsPorKit = items.reduce((acc, fila) => {
      if (!acc[fila.kit_id]) {
        acc[fila.kit_id] = [];
      }
      acc[fila.kit_id].push({
        material_id: fila.material_id,
        material: fila.material,
        cantidad: fila.cantidad,
        stock: fila.stock,
        material_activo: Boolean(fila.material_activo)
      });
      return acc;
    }, {});

    return {
      practica: practicas[0],
      kits: kits.map((kit) => ({
        ...kit,
        materiales: itemsPorKit[kit.id] || []
      }))
    };
  },

  crearKit: async ({ practicaId, nombre }) => {
    const nombreLimpio = nombre === undefined || nombre === null
      ? null
      : String(nombre).trim() || null;

    const [practicas] = await pool.query(
      `SELECT id FROM practicas WHERE id = ? LIMIT 1`,
      [practicaId]
    );

    if (!practicas.length) {
      throw crearErrorDominio(404, 'La practica no existe.', 'PRACTICE_NOT_FOUND');
    }

    const [result] = await pool.query(
      `INSERT INTO kits (practica_id, nombre) VALUES (?, ?)`,
      [practicaId, nombreLimpio]
    );

    return { id: result.insertId, practica_id: Number(practicaId), nombre: nombreLimpio };
  },

  agregarMaterialAKit: async ({ kitId, materialId, cantidad }) => {
    const cantidadNum = Number(cantidad);

    if (!Number.isInteger(cantidadNum) || cantidadNum <= 0) {
      throw crearErrorDominio(
        400,
        'La cantidad debe ser un entero positivo.',
        'KIT_QUANTITY_INVALID'
      );
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [kits] = await connection.query(
        `SELECT id FROM kits WHERE id = ? LIMIT 1`,
        [kitId]
      );

      if (!kits.length) {
        throw crearErrorDominio(404, 'El kit no existe.', 'KIT_NOT_FOUND');
      }

      const [materiales] = await connection.query(
        `SELECT id, is_active FROM materiales WHERE id = ? LIMIT 1`,
        [materialId]
      );

      if (!materiales.length) {
        throw crearErrorDominio(404, 'El material no existe.', 'MATERIAL_NOT_FOUND');
      }

      if (!materiales[0].is_active) {
        throw crearErrorDominio(409, 'El material esta inactivo.', 'MATERIAL_INACTIVE');
      }

      const [duplicados] = await connection.query(
        `SELECT id FROM kit_materiales WHERE kit_id = ? AND material_id = ? LIMIT 1`,
        [kitId, materialId]
      );

      if (duplicados.length) {
        throw crearErrorDominio(
          409,
          'Ese material ya esta registrado en el kit.',
          'KIT_MATERIAL_ALREADY_EXISTS'
        );
      }

      const [result] = await connection.query(
        `INSERT INTO kit_materiales (kit_id, material_id, cantidad) VALUES (?, ?, ?)`,
        [kitId, materialId, cantidadNum]
      );

      await connection.commit();

      return {
        id: result.insertId,
        kit_id: Number(kitId),
        material_id: Number(materialId),
        cantidad: cantidadNum
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  listarPrestamos: async ({ estado = null } = {}) => {
    if (estado !== null && !ESTADOS_PRESTAMO.includes(estado)) {
      throw crearErrorDominio(
        400,
        `Estado de prestamo invalido. Permitidos: ${ESTADOS_PRESTAMO.join(', ')}.`,
        'LOAN_STATE_INVALID'
      );
    }

    const params = [];
    let where = '';

    if (estado !== null) {
      where = 'WHERE p.estado = ?';
      params.push(estado);
    }

    const [rows] = await pool.query(
      `
        SELECT p.id, p.usuario_id, u.nombre AS usuario, u.email,
               p.material_id, m.nombre AS material,
               p.cantidad, p.fecha_prestamo, p.fecha_devolucion, p.estado
        FROM prestamos p
        INNER JOIN usuarios u ON u.id = p.usuario_id
        INNER JOIN materiales m ON m.id = p.material_id
        ${where}
        ORDER BY p.fecha_prestamo DESC, p.id DESC
      `,
      params
    );

    return rows;
  },

  registrarPrestamo: async ({ usuarioId, materialId, cantidad }) => {
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
        `SELECT id, is_active FROM usuarios WHERE id = ? LIMIT 1`,
        [usuarioId]
      );

      if (!usuarios.length) {
        throw crearErrorDominio(404, 'El usuario no existe.', 'USER_NOT_FOUND');
      }

      if (!usuarios[0].is_active) {
        throw crearErrorDominio(
          409,
          'No se puede prestar a un usuario inactivo.',
          'USER_INACTIVE'
        );
      }

      const [materiales] = await connection.query(
        `
          SELECT id, nombre, stock, is_active
          FROM materiales
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

      if (material.stock < cantidadNum) {
        throw crearErrorDominio(
          409,
          `Stock insuficiente. Disponible: ${material.stock}.`,
          'MATERIAL_STOCK_INSUFFICIENT'
        );
      }

      await connection.query(
        `UPDATE materiales SET stock = stock - ? WHERE id = ?`,
        [cantidadNum, materialId]
      );

      const [result] = await connection.query(
        `
          INSERT INTO prestamos (usuario_id, material_id, cantidad, estado)
          VALUES (?, ?, ?, 'ACTIVO')
        `,
        [usuarioId, materialId, cantidadNum]
      );

      await connection.query(
        `INSERT INTO notificaciones (usuario_id, mensaje) VALUES (?, ?)`,
        [
          usuarioId,
          `Se registro un prestamo de ${cantidadNum} unidad(es) de ${material.nombre} a tu nombre.`
        ]
      );

      await connection.commit();

      return {
        id: result.insertId,
        usuario_id: Number(usuarioId),
        material_id: Number(materialId),
        material: material.nombre,
        cantidad: cantidadNum,
        estado: 'ACTIVO'
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
          SELECT id, usuario_id, material_id, cantidad, estado
          FROM prestamos
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
          UPDATE prestamos
          SET estado = 'DEVUELTO', fecha_devolucion = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [prestamoId]
      );

      await connection.query(
        `UPDATE materiales SET stock = stock + ? WHERE id = ?`,
        [prestamo.cantidad, prestamo.material_id]
      );

      await connection.query(
        `INSERT INTO notificaciones (usuario_id, mensaje) VALUES (?, ?)`,
        [prestamo.usuario_id, 'Se registro la devolucion de tu prestamo.']
      );

      await connection.commit();

      return {
        id: Number(prestamoId),
        estado: 'DEVUELTO'
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  listarAdeudos: async ({ estado = null } = {}) => {
    if (estado !== null && !ESTADOS_ADEUDO.includes(estado)) {
      throw crearErrorDominio(
        400,
        `Estado de adeudo invalido. Permitidos: ${ESTADOS_ADEUDO.join(', ')}.`,
        'DEBT_STATE_INVALID'
      );
    }

    const params = [];
    let where = '';

    if (estado !== null) {
      where = 'WHERE a.estado = ?';
      params.push(estado);
    }

    const [rows] = await pool.query(
      `
        SELECT a.id, a.usuario_id, u.nombre AS usuario, u.email,
               a.material_id, m.nombre AS material,
               a.incidencia_id, a.estado, a.created_at
        FROM adeudos a
        INNER JOIN usuarios u ON u.id = a.usuario_id
        INNER JOIN materiales m ON m.id = a.material_id
        ${where}
        ORDER BY a.created_at DESC, a.id DESC
      `,
      params
    );

    return rows;
  },

  resolverAdeudo: async (adeudoId) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [adeudos] = await connection.query(
        `
          SELECT id, usuario_id, material_id, estado
          FROM adeudos
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [adeudoId]
      );

      if (!adeudos.length) {
        throw crearErrorDominio(404, 'El adeudo no existe.', 'DEBT_NOT_FOUND');
      }

      const adeudo = adeudos[0];

      if (adeudo.estado === 'RESUELTO') {
        throw crearErrorDominio(409, 'El adeudo ya estaba resuelto.', 'DEBT_ALREADY_RESOLVED');
      }

      await connection.query(
        `UPDATE adeudos SET estado = 'RESUELTO' WHERE id = ?`,
        [adeudoId]
      );

      await connection.query(
        `INSERT INTO notificaciones (usuario_id, mensaje) VALUES (?, ?)`,
        [adeudo.usuario_id, 'Tu adeudo fue marcado como resuelto.']
      );

      await connection.commit();

      return { id: Number(adeudoId), estado: 'RESUELTO' };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  listarIncidencias: async () => {
    const [rows] = await pool.query(
      `
        SELECT i.id, i.sesion_id, i.equipo_id, e.nombre AS equipo,
               i.material_id, m.nombre AS material,
               i.tipo, i.descripcion,
               i.responsable_usuario_id, u.nombre AS responsable,
               i.created_at
        FROM incidencias i
        INNER JOIN materiales m ON m.id = i.material_id
        LEFT JOIN equipos e ON e.id = i.equipo_id
        LEFT JOIN usuarios u ON u.id = i.responsable_usuario_id
        ORDER BY i.created_at DESC, i.id DESC
      `
    );

    return rows;
  }
};

module.exports = AdminModelo;

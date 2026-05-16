const { pool } = require('../BDconex');

const FUENTES = Object.freeze({
  QUIMICA: 'QUIMICA',
  TURISMO: 'TURISMO'
});

const UsuarioModelo = {
  FUENTES,

  obtenerPorEmail: async (email) => {
    const [rows] = await pool.query(
      `
        SELECT id, nombre, email, password, rol, grupo_id, is_active
        FROM usuarios
        WHERE email = ?
        LIMIT 1
      `,
      [email]
    );

    return rows[0] || null;
  },

  obtenerPorEmailTurismo: async (email) => {
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

  obtenerPorEmailGlobal: async (email) => {
    const usuario = await UsuarioModelo.obtenerPorEmail(email);

    if (usuario) {
      return { ...usuario, fuente: FUENTES.QUIMICA };
    }

    const turismo = await UsuarioModelo.obtenerPorEmailTurismo(email);

    if (turismo) {
      return { ...turismo, fuente: FUENTES.TURISMO };
    }

    return null;
  },

  obtenerResumenPorId: async (id) => {
    const [rows] = await pool.query(
      `
        SELECT u.id, u.nombre, u.email, u.rol, u.grupo_id, u.is_active, g.nombre AS grupo
        FROM usuarios u
        LEFT JOIN grupos g ON g.id = u.grupo_id
        WHERE u.id = ?
        LIMIT 1
      `,
      [id]
    );

    return rows[0] || null;
  },

  obtenerResumenTurismoPorId: async (id) => {
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

  obtenerResumenPorIdGlobal: async (id, fuente) => {
    if (fuente === FUENTES.TURISMO) {
      const usuario = await UsuarioModelo.obtenerResumenTurismoPorId(id);
      return usuario ? { ...usuario, fuente: FUENTES.TURISMO } : null;
    }

    const usuario = await UsuarioModelo.obtenerResumenPorId(id);
    return usuario ? { ...usuario, fuente: FUENTES.QUIMICA } : null;
  }
};

module.exports = UsuarioModelo;

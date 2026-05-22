const AdminModelo = require('../modelo/adminModelo');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

const parsearBooleano = (valor) => {
  if (valor === true || valor === 'true' || valor === 1 || valor === '1') {
    return { ok: true, valor: true };
  }
  if (valor === false || valor === 'false' || valor === 0 || valor === '0') {
    return { ok: true, valor: false };
  }
  return { ok: false };
};

const adminControlador = {
  obtenerResumen: async (req, res) => {
    try {
      const resumen = await AdminModelo.obtenerResumen();
      return res.json(resumen);
    } catch (error) {
      return responderError(res, error, 'No se pudo cargar el resumen del panel admin.');
    }
  },

  listarUsuarios: async (req, res) => {
    try {
      const rol = req.query.rol ? String(req.query.rol).toUpperCase() : null;
      const soloPendientes = req.query.solo_pendientes === 'true' || req.query.solo_pendientes === '1';

      const usuarios = await AdminModelo.listarUsuarios({ rol, soloPendientes });
      return res.json(usuarios);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar los usuarios.');
    }
  },

  crearUsuario: async (req, res) => {
    try {
      const nombre = String(req.body.nombre || '').trim();
      const email = String(req.body.email || '').trim().toLowerCase();
      const password = String(req.body.password || '');
      const rol = String(req.body.rol || '').trim().toUpperCase();

      if (!nombre || !email || !password || !rol) {
        return res.status(400).json({
          error: 'nombre, email, contraseña y rol son obligatorios.'
        });
      }

      if (nombre.length < 3) {
        return res.status(400).json({ error: 'El nombre debe tener al menos 3 caracteres.' });
      }

      if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: 'El email no tiene un formato valido.' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
      }

      const usuario = await AdminModelo.crearUsuarioConRol({ nombre, email, password, rol });

      return res.status(201).json({
        message: 'Usuario creado correctamente.',
        usuario
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo crear el usuario.');
    }
  },

  cambiarEstadoUsuario: async (req, res) => {
    try {
      const usuarioId = parsearIdPositivo(req.params.id);

      if (!usuarioId) {
        return res.status(400).json({ error: 'El id del usuario debe ser un numero positivo.' });
      }

      const activo = parsearBooleano(req.body.activo);

      if (!activo.ok) {
        return res.status(400).json({ error: 'activo debe ser true o false.' });
      }

      const resultado = await AdminModelo.cambiarEstadoUsuario({
        usuarioId,
        activo: activo.valor
      });

      return res.json({
        message: resultado.is_active
          ? 'Usuario activado correctamente.'
          : 'Usuario desactivado correctamente.',
        usuario: resultado
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo cambiar el estado del usuario.');
    }
  },

  listarMateriales: async (req, res) => {
    try {
      const incluirInactivos = req.query.incluir_inactivos === 'true' || req.query.incluir_inactivos === '1';
      const materiales = await AdminModelo.listarMateriales({ incluirInactivos });
      return res.json(materiales);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar los materiales.');
    }
  },

  crearMaterial: async (req, res) => {
    try {
      const material = await AdminModelo.crearMaterial({
        nombre: req.body.nombre,
        stock: req.body.stock
      });

      return res.status(201).json({
        message: 'Material creado correctamente.',
        material
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo crear el material.');
    }
  },

  ajustarStockMaterial: async (req, res) => {
    try {
      const materialId = parsearIdPositivo(req.params.id);

      if (!materialId) {
        return res.status(400).json({ error: 'El id del material debe ser un numero positivo.' });
      }

      const resultado = await AdminModelo.ajustarStockMaterial({
        materialId,
        delta: req.body.delta
      });

      return res.json({
        message: `Stock ajustado en ${resultado.delta > 0 ? '+' : ''}${resultado.delta}.`,
        material: resultado
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo ajustar el stock del material.');
    }
  },

  desactivarMaterial: async (req, res) => {
    try {
      const materialId = parsearIdPositivo(req.params.id);

      if (!materialId) {
        return res.status(400).json({ error: 'El id del material debe ser un numero positivo.' });
      }

      const resultado = await AdminModelo.desactivarMaterial(materialId);

      return res.json({
        message: 'Material desactivado correctamente.',
        material: resultado
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo desactivar el material.');
    }
  },

  listarPracticas: async (req, res) => {
    try {
      const tipo = req.query.tipo ? String(req.query.tipo).toUpperCase() : null;
      const practicas = await AdminModelo.listarPracticas(tipo);
      return res.json(practicas);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar las practicas.');
    }
  },

  crearPractica: async (req, res) => {
    try {
      const tipo = req.body.tipo ? String(req.body.tipo).trim().toUpperCase() : null;

      if (tipo === 'TURISMO') {
        return res.status(403).json({
          error: 'El laboratorio de turismo aun no esta habilitado en el sistema.',
          code: 'PRACTICE_TYPE_DISABLED'
        });
      }

      if (tipo !== 'QUIMICA') {
        return res.status(400).json({
          error: 'Tipo de practica invalido. Por ahora solo se permite QUIMICA.',
          code: 'PRACTICE_TYPE_INVALID'
        });
      }

      const practica = await AdminModelo.crearPractica({
        nombre: req.body.nombre,
        descripcion: req.body.descripcion,
        tipo
      });

      return res.status(201).json({
        message: 'Practica creada correctamente.',
        practica
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo crear la practica.');
    }
  },

  listarKitsPorPractica: async (req, res) => {
    try {
      const practicaId = parsearIdPositivo(req.params.id);

      if (!practicaId) {
        return res.status(400).json({ error: 'El id de la practica debe ser un numero positivo.' });
      }

      const data = await AdminModelo.listarKitsPorPractica(practicaId);
      return res.json(data);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar los kits de la practica.');
    }
  },

  crearKit: async (req, res) => {
    try {
      const practicaId = parsearIdPositivo(req.params.id);

      if (!practicaId) {
        return res.status(400).json({ error: 'El id de la practica debe ser un numero positivo.' });
      }

      const kit = await AdminModelo.crearKit({
        practicaId,
        nombre: req.body.nombre
      });

      return res.status(201).json({
        message: 'Kit creado correctamente.',
        kit
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo crear el kit.');
    }
  },

  agregarMaterialAKit: async (req, res) => {
    try {
      const kitId = parsearIdPositivo(req.params.id);

      if (!kitId) {
        return res.status(400).json({ error: 'El id del kit debe ser un numero positivo.' });
      }

      const materialId = parsearIdPositivo(req.body.material_id);

      if (!materialId) {
        return res.status(400).json({ error: 'El id del material debe ser un numero positivo.' });
      }

      const item = await AdminModelo.agregarMaterialAKit({
        kitId,
        materialId,
        cantidad: req.body.cantidad
      });

      return res.status(201).json({
        message: 'Material agregado al kit correctamente.',
        item
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo agregar el material al kit.');
    }
  },

  listarPrestamos: async (req, res) => {
    try {
      const estado = req.query.estado ? String(req.query.estado).toUpperCase() : null;
      const prestamos = await AdminModelo.listarPrestamos({ estado });
      return res.json(prestamos);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar los prestamos.');
    }
  },

  registrarPrestamo: async (req, res) => {
    try {
      const usuarioId = parsearIdPositivo(req.body.usuario_id);

      if (!usuarioId) {
        return res.status(400).json({ error: 'El id del usuario debe ser un numero positivo.' });
      }

      const materialId = parsearIdPositivo(req.body.material_id);

      if (!materialId) {
        return res.status(400).json({ error: 'El id del material debe ser un numero positivo.' });
      }

      const prestamo = await AdminModelo.registrarPrestamo({
        usuarioId,
        materialId,
        cantidad: req.body.cantidad
      });

      return res.status(201).json({
        message: 'Prestamo registrado correctamente.',
        prestamo
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo registrar el prestamo.');
    }
  },

  marcarPrestamoDevuelto: async (req, res) => {
    try {
      const prestamoId = parsearIdPositivo(req.params.id);

      if (!prestamoId) {
        return res.status(400).json({ error: 'El id del prestamo debe ser un numero positivo.' });
      }

      const resultado = await AdminModelo.marcarPrestamoDevuelto(prestamoId);

      return res.json({
        message: 'Prestamo marcado como devuelto.',
        prestamo: resultado
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo marcar el prestamo como devuelto.');
    }
  },

  listarAdeudos: async (req, res) => {
    try {
      const estado = req.query.estado ? String(req.query.estado).toUpperCase() : null;
      const adeudos = await AdminModelo.listarAdeudos({ estado });
      return res.json(adeudos);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar los adeudos.');
    }
  },

  resolverAdeudo: async (req, res) => {
    try {
      const adeudoId = parsearIdPositivo(req.params.id);

      if (!adeudoId) {
        return res.status(400).json({ error: 'El id del adeudo debe ser un numero positivo.' });
      }

      const resultado = await AdminModelo.resolverAdeudo(adeudoId);

      return res.json({
        message: 'Adeudo resuelto.',
        adeudo: resultado
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo resolver el adeudo.');
    }
  },

  listarIncidencias: async (req, res) => {
    try {
      const incidencias = await AdminModelo.listarIncidencias();
      return res.json(incidencias);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar las incidencias.');
    }
  },

  listarResponsivas: async (req, res) => {
    try {
      const estado = req.query.estado ? String(req.query.estado).toUpperCase() : null;
      const responsivas = await AdminModelo.listarResponsivas({ estado });
      return res.json(responsivas);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar las responsivas.');
    }
  }
};

module.exports = adminControlador;

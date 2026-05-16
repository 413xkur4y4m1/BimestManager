const AdminTurismoModelo = require('../modelo/adminTurismoModelo');

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

const limpiarTextoOpcional = (valor) =>
  valor === undefined || valor === null ? null : String(valor).trim() || null;

const adminTurismoControlador = {
  // ============= DASHBOARD =============

  obtenerResumen: async (req, res) => {
    try {
      const resumen = await AdminTurismoModelo.obtenerResumen();
      return res.json(resumen);
    } catch (error) {
      return responderError(res, error, 'No se pudo cargar el resumen del panel admin de turismo.');
    }
  },

  // ============= USUARIOS =============

  listarUsuarios: async (req, res) => {
    try {
      const rol = req.query.rol ? String(req.query.rol).toUpperCase() : null;
      const soloPendientes = req.query.solo_pendientes === 'true' || req.query.solo_pendientes === '1';
      const grupo = req.query.grupo ? String(req.query.grupo).trim() || null : null;

      const usuarios = await AdminTurismoModelo.listarUsuarios({ rol, soloPendientes, grupo });
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
      const grupo = limpiarTextoOpcional(req.body.grupo);

      if (!nombre || !email || !password || !rol) {
        return res.status(400).json({
          error: 'nombre, email, password y rol son obligatorios.'
        });
      }

      if (nombre.length < 3) {
        return res.status(400).json({ error: 'El nombre debe tener al menos 3 caracteres.' });
      }

      if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: 'El email no tiene un formato valido.' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'La password debe tener al menos 8 caracteres.' });
      }

      const usuario = await AdminTurismoModelo.crearUsuarioConRol({
        nombre,
        email,
        password,
        rol,
        grupo
      });

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

      const resultado = await AdminTurismoModelo.cambiarEstadoUsuario({
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

  asignarGrupoUsuario: async (req, res) => {
    try {
      const usuarioId = parsearIdPositivo(req.params.id);

      if (!usuarioId) {
        return res.status(400).json({ error: 'El id del usuario debe ser un numero positivo.' });
      }

      const grupo = String(req.body.grupo || '').trim();

      if (!grupo) {
        return res.status(400).json({ error: 'El grupo es obligatorio.' });
      }

      const resultado = await AdminTurismoModelo.asignarGrupoUsuario({ usuarioId, grupo });

      return res.json({
        message: 'Grupo asignado correctamente.',
        usuario: resultado
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo asignar el grupo al usuario.');
    }
  },

  // ============= MATERIALES =============

  listarMateriales: async (req, res) => {
    try {
      const incluirInactivos = req.query.incluir_inactivos === 'true' || req.query.incluir_inactivos === '1';
      const estado = req.query.estado ? String(req.query.estado).toUpperCase() : null;

      const materiales = await AdminTurismoModelo.listarMateriales({ incluirInactivos, estado });
      return res.json(materiales);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar los materiales.');
    }
  },

  crearMaterial: async (req, res) => {
    try {
      const estado = req.body.estado
        ? String(req.body.estado).trim().toUpperCase()
        : 'DISPONIBLE';

      const material = await AdminTurismoModelo.crearMaterial({
        nombre: req.body.nombre,
        stock: req.body.stock,
        estado
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

      const resultado = await AdminTurismoModelo.ajustarStockMaterial({
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

  cambiarEstadoMaterial: async (req, res) => {
    try {
      const materialId = parsearIdPositivo(req.params.id);

      if (!materialId) {
        return res.status(400).json({ error: 'El id del material debe ser un numero positivo.' });
      }

      const estado = String(req.body.estado || '').trim().toUpperCase();

      if (!estado) {
        return res.status(400).json({ error: 'El estado es obligatorio.' });
      }

      const resultado = await AdminTurismoModelo.cambiarEstadoMaterial({
        materialId,
        estado
      });

      return res.json({
        message: `Material marcado como ${estado}.`,
        material: resultado
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo cambiar el estado del material.');
    }
  },

  desactivarMaterial: async (req, res) => {
    try {
      const materialId = parsearIdPositivo(req.params.id);

      if (!materialId) {
        return res.status(400).json({ error: 'El id del material debe ser un numero positivo.' });
      }

      const resultado = await AdminTurismoModelo.desactivarMaterial(materialId);

      return res.json({
        message: 'Material desactivado correctamente.',
        material: resultado
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo desactivar el material.');
    }
  },

  // ============= PRACTICAS =============

  listarPracticas: async (req, res) => {
    try {
      const incluirInactivas = req.query.incluir_inactivas === 'true' || req.query.incluir_inactivas === '1';
      const practicas = await AdminTurismoModelo.listarPracticas({ incluirInactivas });
      return res.json(practicas);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar las practicas.');
    }
  },

  crearPractica: async (req, res) => {
    try {
      const practica = await AdminTurismoModelo.crearPractica({
        nombre: req.body.nombre,
        descripcion: req.body.descripcion,
        duracionMinutos: req.body.duracion_minutos
      });

      return res.status(201).json({
        message: 'Practica creada correctamente.',
        practica
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo crear la practica.');
    }
  },

  actualizarPractica: async (req, res) => {
    try {
      const practicaId = parsearIdPositivo(req.params.id);

      if (!practicaId) {
        return res.status(400).json({ error: 'El id de la practica debe ser un numero positivo.' });
      }

      const resultado = await AdminTurismoModelo.actualizarPractica({
        practicaId,
        nombre: req.body.nombre,
        descripcion: req.body.descripcion,
        duracionMinutos: req.body.duracion_minutos
      });

      return res.json({
        message: 'Practica actualizada correctamente.',
        practica: resultado
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo actualizar la practica.');
    }
  },

  desactivarPractica: async (req, res) => {
    try {
      const practicaId = parsearIdPositivo(req.params.id);

      if (!practicaId) {
        return res.status(400).json({ error: 'El id de la practica debe ser un numero positivo.' });
      }

      const resultado = await AdminTurismoModelo.desactivarPractica(practicaId);

      return res.json({
        message: 'Practica desactivada correctamente.',
        practica: resultado
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo desactivar la practica.');
    }
  },

  // ============= SUGERENCIAS =============

  listarSugerenciasPractica: async (req, res) => {
    try {
      const practicaId = parsearIdPositivo(req.params.id);

      if (!practicaId) {
        return res.status(400).json({ error: 'El id de la practica debe ser un numero positivo.' });
      }

      const data = await AdminTurismoModelo.listarSugerenciasPorPractica(practicaId);
      return res.json(data);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar las sugerencias.');
    }
  },

  agregarSugerencia: async (req, res) => {
    try {
      const practicaId = parsearIdPositivo(req.params.id);

      if (!practicaId) {
        return res.status(400).json({ error: 'El id de la practica debe ser un numero positivo.' });
      }

      const materialId = parsearIdPositivo(req.body.material_id);

      if (!materialId) {
        return res.status(400).json({ error: 'El id del material debe ser un numero positivo.' });
      }

      const sugerencia = await AdminTurismoModelo.agregarSugerencia({
        practicaId,
        materialId,
        cantidadSugerida: req.body.cantidad_sugerida
      });

      return res.status(201).json({
        message: 'Sugerencia agregada correctamente.',
        sugerencia
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo agregar la sugerencia.');
    }
  },

  actualizarSugerencia: async (req, res) => {
    try {
      const sugerenciaId = parsearIdPositivo(req.params.id);

      if (!sugerenciaId) {
        return res.status(400).json({ error: 'El id de la sugerencia debe ser un numero positivo.' });
      }

      const resultado = await AdminTurismoModelo.actualizarSugerencia({
        sugerenciaId,
        cantidadSugerida: req.body.cantidad_sugerida
      });

      return res.json({
        message: 'Sugerencia actualizada correctamente.',
        sugerencia: resultado
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo actualizar la sugerencia.');
    }
  },

  eliminarSugerencia: async (req, res) => {
    try {
      const sugerenciaId = parsearIdPositivo(req.params.id);

      if (!sugerenciaId) {
        return res.status(400).json({ error: 'El id de la sugerencia debe ser un numero positivo.' });
      }

      const resultado = await AdminTurismoModelo.eliminarSugerencia(sugerenciaId);

      return res.json({
        message: 'Sugerencia eliminada correctamente.',
        sugerencia: resultado
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo eliminar la sugerencia.');
    }
  },

  // ============= SESIONES =============

  listarSesiones: async (req, res) => {
    try {
      const estado = req.query.estado ? String(req.query.estado).toUpperCase() : null;
      const grupo = req.query.grupo ? String(req.query.grupo).trim() || null : null;
      const practicaIdRaw = req.query.practica_id;
      const practicaId = practicaIdRaw === undefined ? null : parsearIdPositivo(practicaIdRaw);

      if (practicaIdRaw !== undefined && practicaId === null) {
        return res.status(400).json({ error: 'practica_id debe ser un entero positivo.' });
      }

      const sesiones = await AdminTurismoModelo.listarSesiones({ estado, grupo, practicaId });
      return res.json(sesiones);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar las sesiones.');
    }
  },

  crearSesion: async (req, res) => {
    try {
      const practicaId = parsearIdPositivo(req.body.practica_id);

      if (!practicaId) {
        return res.status(400).json({ error: 'El id de la practica debe ser un numero positivo.' });
      }

      const sesion = await AdminTurismoModelo.crearSesion({
        practicaId,
        grupo: req.body.grupo,
        fechaInicio: req.body.fecha_inicio,
        fechaFin: req.body.fecha_fin
      });

      return res.status(201).json({
        message: 'Sesion creada correctamente.',
        sesion
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo crear la sesion.');
    }
  },

  cambiarEstadoSesion: async (req, res) => {
    try {
      const sesionId = parsearIdPositivo(req.params.id);

      if (!sesionId) {
        return res.status(400).json({ error: 'El id de la sesion debe ser un numero positivo.' });
      }

      const nuevoEstado = String(req.body.estado || '').trim().toUpperCase();

      if (!nuevoEstado) {
        return res.status(400).json({ error: 'El estado es obligatorio.' });
      }

      const resultado = await AdminTurismoModelo.cambiarEstadoSesion({
        sesionId,
        nuevoEstado
      });

      return res.json({
        message: `Sesion movida a ${nuevoEstado}.`,
        sesion: resultado
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo cambiar el estado de la sesion.');
    }
  },

  obtenerDetalleSesion: async (req, res) => {
    try {
      const sesionId = parsearIdPositivo(req.params.id);

      if (!sesionId) {
        return res.status(400).json({ error: 'El id de la sesion debe ser un numero positivo.' });
      }

      const detalle = await AdminTurismoModelo.obtenerDetalleSesion(sesionId);
      return res.json(detalle);
    } catch (error) {
      return responderError(res, error, 'No se pudo obtener el detalle de la sesion.');
    }
  },

  // ============= PRESTAMOS =============

  listarPrestamos: async (req, res) => {
    try {
      const estado = req.query.estado ? String(req.query.estado).toUpperCase() : null;
      const sesionIdRaw = req.query.sesion_id;
      const alumnoIdRaw = req.query.alumno_id;

      const sesionId = sesionIdRaw === undefined ? null : parsearIdPositivo(sesionIdRaw);
      const alumnoId = alumnoIdRaw === undefined ? null : parsearIdPositivo(alumnoIdRaw);

      if (sesionIdRaw !== undefined && sesionId === null) {
        return res.status(400).json({ error: 'sesion_id debe ser un entero positivo.' });
      }

      if (alumnoIdRaw !== undefined && alumnoId === null) {
        return res.status(400).json({ error: 'alumno_id debe ser un entero positivo.' });
      }

      const prestamos = await AdminTurismoModelo.listarPrestamos({ estado, sesionId, alumnoId });
      return res.json(prestamos);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar los prestamos.');
    }
  },

  registrarPrestamo: async (req, res) => {
    try {
      const sesionId = parsearIdPositivo(req.body.sesion_id);
      const alumnoId = parsearIdPositivo(req.body.alumno_id);
      const materialId = parsearIdPositivo(req.body.material_id);

      if (!sesionId) {
        return res.status(400).json({ error: 'sesion_id debe ser un entero positivo.' });
      }

      if (!alumnoId) {
        return res.status(400).json({ error: 'alumno_id debe ser un entero positivo.' });
      }

      if (!materialId) {
        return res.status(400).json({ error: 'material_id debe ser un entero positivo.' });
      }

      const prestamo = await AdminTurismoModelo.registrarPrestamo({
        sesionId,
        alumnoId,
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

      const resultado = await AdminTurismoModelo.marcarPrestamoDevuelto(prestamoId);

      return res.json({
        message: 'Prestamo marcado como devuelto.',
        prestamo: resultado
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo marcar el prestamo como devuelto.');
    }
  },

  marcarPrestamoAdeudo: async (req, res) => {
    try {
      const prestamoId = parsearIdPositivo(req.params.id);

      if (!prestamoId) {
        return res.status(400).json({ error: 'El id del prestamo debe ser un numero positivo.' });
      }

      const resultado = await AdminTurismoModelo.marcarPrestamoAdeudo(prestamoId);

      return res.json({
        message: 'Prestamo marcado como adeudo.',
        prestamo: resultado
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo marcar el prestamo como adeudo.');
    }
  },

  // ============= INCIDENCIAS =============

  listarIncidencias: async (req, res) => {
    try {
      const estado = req.query.estado ? String(req.query.estado).toUpperCase() : null;
      const incidencias = await AdminTurismoModelo.listarIncidencias({ estado });
      return res.json(incidencias);
    } catch (error) {
      return responderError(res, error, 'No se pudieron cargar las incidencias.');
    }
  },

  resolverIncidencia: async (req, res) => {
    try {
      const incidenciaId = parsearIdPositivo(req.params.id);

      if (!incidenciaId) {
        return res.status(400).json({ error: 'El id de la incidencia debe ser un numero positivo.' });
      }

      const marcarPrestamoDevueltoFlag = parsearBooleano(req.body.marcar_prestamo_devuelto);
      const marcarPrestamoDevuelto = marcarPrestamoDevueltoFlag.ok
        ? marcarPrestamoDevueltoFlag.valor
        : false;

      const resultado = await AdminTurismoModelo.resolverIncidencia({
        incidenciaId,
        marcarPrestamoDevuelto
      });

      return res.json({
        message: 'Incidencia resuelta.',
        incidencia: resultado
      });
    } catch (error) {
      return responderError(res, error, 'No se pudo resolver la incidencia.');
    }
  }
};

module.exports = adminTurismoControlador;

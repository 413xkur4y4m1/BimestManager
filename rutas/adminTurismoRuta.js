const express = require('express');

const adminTurismoControlador = require('../controlador/adminTurismoControlador');
const { soloAdminTurismo } = require('../Middlewares/auth');

const router = express.Router();

router.use(soloAdminTurismo);

router.get('/resumen', adminTurismoControlador.obtenerResumen);

router.get('/usuarios', adminTurismoControlador.listarUsuarios);
router.post('/usuarios', adminTurismoControlador.crearUsuario);
router.patch('/usuarios/:id/estado', adminTurismoControlador.cambiarEstadoUsuario);
router.patch('/usuarios/:id/grupo', adminTurismoControlador.asignarGrupoUsuario);

router.get('/materiales', adminTurismoControlador.listarMateriales);
router.post('/materiales', adminTurismoControlador.crearMaterial);
router.patch('/materiales/:id/stock', adminTurismoControlador.ajustarStockMaterial);
router.patch('/materiales/:id/estado', adminTurismoControlador.cambiarEstadoMaterial);
router.delete('/materiales/:id', adminTurismoControlador.desactivarMaterial);

router.get('/practicas', adminTurismoControlador.listarPracticas);
router.post('/practicas', adminTurismoControlador.crearPractica);
router.patch('/practicas/:id', adminTurismoControlador.actualizarPractica);
router.delete('/practicas/:id', adminTurismoControlador.desactivarPractica);

router.get('/practicas/:id/sugerencias', adminTurismoControlador.listarSugerenciasPractica);
router.post('/practicas/:id/sugerencias', adminTurismoControlador.agregarSugerencia);
router.patch('/sugerencias/:id', adminTurismoControlador.actualizarSugerencia);
router.delete('/sugerencias/:id', adminTurismoControlador.eliminarSugerencia);

router.get('/sesiones', adminTurismoControlador.listarSesiones);
router.post('/sesiones', adminTurismoControlador.crearSesion);
router.get('/sesiones/:id', adminTurismoControlador.obtenerDetalleSesion);
router.patch('/sesiones/:id/estado', adminTurismoControlador.cambiarEstadoSesion);

router.get('/prestamos', adminTurismoControlador.listarPrestamos);
router.post('/prestamos', adminTurismoControlador.registrarPrestamo);
router.patch('/prestamos/:id/aprobar', adminTurismoControlador.aprobarSolicitudPrestamo);
router.patch('/prestamos/:id/rechazar', adminTurismoControlador.rechazarSolicitudPrestamo);
router.patch('/prestamos/:id/devolucion', adminTurismoControlador.marcarPrestamoDevuelto);
router.patch('/prestamos/:id/adeudo', adminTurismoControlador.marcarPrestamoAdeudo);

router.get('/incidencias', adminTurismoControlador.listarIncidencias);
router.patch('/incidencias/:id/resolver', adminTurismoControlador.resolverIncidencia);

module.exports = router;

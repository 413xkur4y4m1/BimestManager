const express = require('express');

const adminControlador = require('../controlador/adminControlador');
const { soloAdmin } = require('../Middlewares/auth');

const router = express.Router();

router.use(soloAdmin);

router.get('/resumen', adminControlador.obtenerResumen);

router.get('/usuarios', adminControlador.listarUsuarios);
router.post('/usuarios', adminControlador.crearUsuario);
router.patch('/usuarios/:id/estado', adminControlador.cambiarEstadoUsuario);

router.get('/materiales', adminControlador.listarMateriales);
router.post('/materiales', adminControlador.crearMaterial);
router.patch('/materiales/:id/stock', adminControlador.ajustarStockMaterial);
router.patch('/materiales/:id', adminControlador.editarMaterial);
router.delete('/materiales/:id', adminControlador.desactivarMaterial);

router.get('/practicas', adminControlador.listarPracticas);
router.post('/practicas', adminControlador.crearPractica);
router.get('/practicas/:id/kits', adminControlador.listarKitsPorPractica);
router.post('/practicas/:id/kits', adminControlador.crearKit);
router.delete('/kits/:id', adminControlador.eliminarKit);
router.post('/kits/:id/materiales', adminControlador.agregarMaterialAKit);
router.delete('/kits/:kitId/materiales/:materialId', adminControlador.quitarMaterialDeKit);

router.get('/prestamos', adminControlador.listarPrestamos);
router.post('/prestamos', adminControlador.registrarPrestamo);
router.patch('/prestamos/:id/devolucion', adminControlador.marcarPrestamoDevuelto);

router.get('/adeudos', adminControlador.listarAdeudos);
router.patch('/adeudos/:id/resolver', adminControlador.resolverAdeudo);

router.get('/incidencias', adminControlador.listarIncidencias);

router.get('/responsivas', adminControlador.listarResponsivas);

router.get('/sesiones', adminControlador.listarSesiones);

module.exports = router;
